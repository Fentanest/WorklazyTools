import assert from "node:assert/strict";
import { BlobWriter } from "@zip.js/zip.js";
import fs from "node:fs";
import test from "node:test";
import JSZip from "jszip";

import {
  QR_BULK_LIMITS,
  buildQrPayload,
  compileQrTemplate,
  createSpreadsheetDisplayLookup,
  effectiveQrErrorCorrection,
  effectiveQrQuietZone,
  estimateQrBulkDurationMs,
  estimateQrBulkOutputBytes,
  qrLabelCell,
  renderQrTemplate,
  validateQrBulkBudget,
  type QrPayloadFields,
  type QrPayloadType,
} from "../../src/features/qr-studio/qrBulk.ts";
import { SafeZipEntryPathRegistry, UnsafeFileNameError, validateSafeZipEntryPath } from "../../src/utils/fileNameSafety.ts";
import { createIncrementalZipArchiveWriter } from "../../src/utils/zipArchive.ts";

const golden = JSON.parse(fs.readFileSync(new URL("../fixtures/qr-bulk-golden.json", import.meta.url), "utf8")) as Array<{ type: QrPayloadType; fields: QrPayloadFields; expected: string }>;

test("all seven QR payload types match the Korean escape-heavy golden fixture", () => {
  assert.equal(golden.length, 7);
  golden.forEach((fixture) => assert.equal(buildQrPayload(fixture.type, fixture.fields), fixture.expected, fixture.type));
});

test("templates bind to stable column numbers and reject missing or duplicate referenced headers", () => {
  const headers = [{ column: 1, name: "Name" }, { column: 2, name: "ID" }];
  const compiled = compileQrTemplate("{{Name}}-{{ID}}", headers);
  assert.equal(renderQrTemplate(compiled, (column) => column === 1 ? "한글" : "007"), "한글-007");
  assert.throws(() => compileQrTemplate("{{Missing}}", headers), (error) => error instanceof Error && error.message === "MISSING_HEADER");
  assert.throws(() => compileQrTemplate("{{Name}}", [...headers, { column: 3, name: "Name" }]), (error) => error instanceof Error && error.message === "DUPLICATE_HEADER");
});

test("spreadsheet row lookup prefers displayValue and keeps sourceRow/sourceColumn", () => {
  const lookup = createSpreadsheetDisplayLookup({
    name: "Sheet1", rowCount: 2, columnCount: 1, merges: [], rowLineage: [], columnLineage: [], tables: [],
    cells: [{ row: 2, column: 1, address: "A2", type: "number", value: 1012345678, displayValue: "010-1234-5678", sourceRow: 7, sourceColumn: 3, rowLineageId: "row:7", columnLineageId: "column:3" }],
  });
  assert.equal(lookup(7, 3), "010-1234-5678");
  assert.equal(lookup(2, 1), "");
});

test("logo settings force H and at least two quiet-zone modules", () => {
  assert.equal(effectiveQrErrorCorrection("L", true), "H");
  assert.equal(effectiveQrErrorCorrection("Q", false), "Q");
  assert.equal(effectiveQrQuietZone(0, true), 2);
  assert.equal(effectiveQrQuietZone(9, false), 8);
  assert.equal(effectiveQrQuietZone(4, false), 4);
});

test("output, row, input, cell, PDF and storage budgets are enforced", () => {
  const estimate = estimateQrBulkOutputBytes(1_001, 640, true, false);
  assert.ok(estimate > 0);
  assert.equal(estimateQrBulkDurationMs(1_001, 640), 72_072);
  assert.doesNotThrow(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: 1, rows: 1, estimatedOutputBytes: 1 }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: QR_BULK_LIMITS.inputBytes + 1, selectedCells: 1, rows: 1, estimatedOutputBytes: 1 }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: QR_BULK_LIMITS.selectedCells + 1, rows: 1, estimatedOutputBytes: 1 }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: 1, rows: QR_BULK_LIMITS.rows + 1, estimatedOutputBytes: 1 }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: 1, rows: 1_001, estimatedOutputBytes: 1, memoryFallback: true }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: 1, rows: 2_401, estimatedOutputBytes: 1, includePdf: true }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: 1, rows: 1, estimatedOutputBytes: QR_BULK_LIMITS.hardOutputBytes + 1 }));
  assert.throws(() => validateQrBulkBudget({ inputBytes: 1, selectedCells: 1, rows: 1, estimatedOutputBytes: 101, availableStorageBytes: 100 }));
});

test("A4 and Letter label grids keep exact 3 by 8 boundaries", () => {
  for (const preset of ["a4", "letter"] as const) {
    const first = qrLabelCell(0, preset);
    const last = qrLabelCell(23, preset);
    const next = qrLabelCell(24, preset);
    assert.equal(first.page, 0);
    assert.equal(first.x, 36);
    assert.ok(Math.abs(last.y - 36) < 1e-8);
    assert.equal(last.column, 2);
    assert.equal(next.page, 1);
    assert.equal(next.x, 36);
  }
});

test("safe ZIP entry paths validate every segment and collide by NFC and case", () => {
  const registry = new SafeZipEntryPathRegistry();
  registry.add(validateSafeZipEntryPath("그룹/QR-01.png"));
  assert.throws(() => registry.add(validateSafeZipEntryPath("그룹/qr-01.PNG")), (error) => error instanceof UnsafeFileNameError && error.reason === "DUPLICATE");
  assert.throws(() => validateSafeZipEntryPath("../escape.png"), (error) => error instanceof UnsafeFileNameError);
  assert.throws(() => validateSafeZipEntryPath("group\\escape.png"), (error) => error instanceof UnsafeFileNameError);
});

test("incremental ZIP writer accepts safe grouped paths and rejects path collisions", async () => {
  const output = new BlobWriter("application/zip");
  const writer = createIncrementalZipArchiveWriter(output);
  await writer.add(validateSafeZipEntryPath("서울/qr-01.png"), new Blob(["first"]));
  await writer.add(validateSafeZipEntryPath("부산/qr-01.png"), new Blob(["second"]));
  await assert.rejects(writer.add(validateSafeZipEntryPath("서울/QR-01.PNG"), new Blob(["duplicate"])), (error) => error instanceof UnsafeFileNameError && error.reason === "DUPLICATE");
  await writer.close();
  const outputBlob = await output.getData();
  const archive = await JSZip.loadAsync(new Uint8Array(await outputBlob.arrayBuffer()));
  assert.deepEqual(Object.keys(archive.files).sort(), ["부산/qr-01.png", "서울/qr-01.png"].sort());
  assert.equal(await archive.file("서울/qr-01.png")?.async("string"), "first");
  assert.equal(await archive.file("부산/qr-01.png")?.async("string"), "second");
});
