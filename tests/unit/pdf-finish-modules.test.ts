import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";
import {
  FINISH_EXECUTION_ORDER,
  MEMORY_RESULT_LIMIT_BYTES,
  OcgPreflightReasonCode,
  applyNormalizedStamp,
  applyParity,
  captureTokenValues,
  checkMemoryResultRegistration,
  chooseCanvasDpi,
  createFinishAnchors,
  createFinishExecutionPlan,
  createNormalizedStamp,
  createPageSelection,
  createSixTextRegions,
  createTilePlacements,
  cssPointToPdf,
  decideDocumentFont,
  displayNumber,
  estimateOutputWarning,
  estimatePreflightOutputWarning,
  expandTokens,
  formatCanonicalRange,
  formatDatePattern,
  isThumbnailDisabled,
  layoutTextLines,
  measureBatchResources,
  measureCanvas,
  parseRange,
  preprocessText,
  selectionAnchor,
  setFilePageSelection,
  stampPdfCorners,
  toggleThumbnailPage,
  tokenPageCount,
  viewportPointToPdf,
  type CapturedTokenValues,
  type PdfViewportGeometry,
  type TextFontProbe,
  type TileLayoutInput,
} from "../../src/features/pdf-editor/finish/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

const geometryFixtures: PdfViewportGeometry[] = [
  { width: 400, height: 600, rotation: 0, transform: [1, 0, 0, -1, -50, 700] },
  { width: 600, height: 400, rotation: 90, transform: [0, 1, 1, 0, -100, -50] },
  { width: 400, height: 600, rotation: 180, transform: [-1, 0, 0, 1, 450, -100] },
  { width: 600, height: 400, rotation: 270, transform: [0, -1, -1, 0, 700, 450] },
];

test("finish geometry preserves the E5 non-zero CropBox corners and upright rotation in all six regions", async () => {
  const legacy = JSON.parse(await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish/legacy-oracle/manifest.json"), "utf8"));
  assert.deepEqual(legacy.input.rotations, [0, 90, 180, 270]);
  assert.equal(legacy.input.nonZeroCropBoxes, true);
  const expectedCorners = [
    [[50, 700], [450, 700], [50, 100], [450, 100]],
    [[50, 100], [50, 700], [450, 100], [450, 700]],
    [[450, 100], [50, 100], [450, 700], [50, 700]],
    [[450, 700], [450, 100], [50, 700], [50, 100]],
  ];
  for (const [index, viewport] of geometryFixtures.entries()) {
    const viewportCorners = [[0, 0], [viewport.width, 0], [0, viewport.height], [viewport.width, viewport.height]] as const;
    assert.deepEqual(viewportCorners.map(([x, y]) => Object.values(viewportPointToPdf(viewport.transform, x, y))), expectedCorners[index]);
    const anchors = createFinishAnchors(viewport);
    assert.deepEqual(anchors.map(({ region }) => region), [
      "top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right",
    ]);
    assert.ok(anchors.every(({ textRotation }) => textRotation === viewport.rotation));
    assert.deepEqual(Object.values(anchors[0].pdf), expectedCorners[index][0]);
    assert.deepEqual(Object.values(anchors[2].pdf), expectedCorners[index][1]);
    assert.deepEqual(Object.values(anchors[3].pdf), expectedCorners[index][2]);
    assert.deepEqual(Object.values(anchors[5].pdf), expectedCorners[index][3]);
  }
});

test("finish geometry matches literal E5 anchors with margins across four actual mixed-size PDF.js viewports", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const source = await PDFDocument.create({ updateMetadata: false });
  const pageInputs = [
    { width: 400, height: 600, rotation: 0 },
    { width: 300, height: 500, rotation: 90 },
    { width: 700, height: 200, rotation: 180 },
    { width: 400, height: 400, rotation: 270 },
  ] as const;
  for (const input of pageInputs) {
    const page = source.addPage([input.width + 100, input.height + 200]);
    page.setCropBox(50, 100, input.width, input.height);
    page.setRotation(degrees(input.rotation));
  }
  const expected = [
    {
      visual: [400, 600], rotation: 0,
      anchors: [[90, 690], [260, 690], [430, 690], [90, 130], [260, 130], [430, 130]],
    },
    {
      visual: [500, 300], rotation: 90,
      anchors: [[60, 140], [60, 360], [60, 580], [320, 140], [320, 360], [320, 580]],
    },
    {
      visual: [700, 200], rotation: 180,
      anchors: [[710, 110], [390, 110], [70, 110], [710, 270], [390, 270], [70, 270]],
    },
    {
      visual: [400, 400], rotation: 270,
      anchors: [[440, 460], [440, 290], [440, 120], [80, 460], [80, 290], [80, 120]],
    },
  ] as const;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await source.save()) });
  try {
    const document = await loadingTask.promise;
    const visualSizes = new Set<string>();
    for (const [index, golden] of expected.entries()) {
      const page = await document.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      assert.deepEqual([viewport.width, viewport.height, viewport.rotation], [...golden.visual, golden.rotation]);
      visualSizes.add(`${viewport.width}x${viewport.height}`);
      const geometry: PdfViewportGeometry = {
        width: viewport.width,
        height: viewport.height,
        rotation: golden.rotation,
        transform: viewport.transform,
      };
      const anchors = createFinishAnchors(geometry, { top: 10, right: 20, bottom: 30, left: 40 });
      assert.deepEqual(anchors.map(({ pdf }) => [pdf.x, pdf.y]), golden.anchors);
      assert.deepEqual(anchors.map(({ region }) => region), [
        "top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right",
      ]);
      assert.ok(anchors.every(({ textRotation }) => textRotation === golden.rotation));
      for (const anchor of anchors) {
        assert.deepEqual(viewport.convertToPdfPoint(anchor.viewport.x, anchor.viewport.y), [anchor.pdf.x, anchor.pdf.y]);
      }
    }
    assert.equal(visualSizes.size, 4);
  } finally {
    await loadingTask.destroy();
  }
});

test("selection keeps a file-local physical exact set, canonical ranges, lower bounds, parity and numbering", () => {
  assert.deepEqual(parseRange("2-4,6,8", 10), { ok: true, pages: [2, 3, 4, 6, 8], canonicalText: "2-4,6,8" });
  assert.equal(formatCanonicalRange([8, 4, 2, 3, 6, 4]), "2-4,6,8");
  assert.deepEqual(applyParity([2, 3, 4, 5], "odd"), [3, 5]);
  assert.deepEqual(applyParity([2, 3, 4, 5], "even"), [2, 4]);
  assert.equal(selectionAnchor({ startPage: 4, excludeCover: true }), 4);
  assert.equal(selectionAnchor({ startPage: 1, excludeCover: true }), 2);
  assert.equal(isThumbnailDisabled(1, 10, { startPage: 1, excludeCover: true }), true);
  assert.equal(isThumbnailDisabled(2, 10, { startPage: 1, excludeCover: true }), false);

  const lowerBoundOptions = { startPage: 4, excludeCover: true };
  const lowerBoundSelection = createPageSelection(10, "1-8", "even", lowerBoundOptions);
  assert.ok(!("error" in lowerBoundSelection));
  assert.deepEqual(lowerBoundSelection.exactPages, [4, 6, 8]);
  assert.equal(isThumbnailDisabled(2, 10, lowerBoundOptions), true);
  assert.equal(isThumbnailDisabled(3, 10, lowerBoundOptions), true);
  assert.strictEqual(toggleThumbnailPage(lowerBoundSelection, 3, lowerBoundOptions), lowerBoundSelection);
  assert.deepEqual(createPageSelection(1, "1", "all", { startPage: 1, excludeCover: true }), {
    totalPages: 1,
    exactPages: [],
    parity: "all",
    rangeText: "1",
    canExecute: false,
  });

  const initial = createPageSelection(10, "2-8", "even", { startPage: 1, excludeCover: false });
  assert.ok(!("error" in initial));
  assert.deepEqual(initial.exactPages, [2, 4, 6, 8]);
  const toggled = toggleThumbnailPage(initial, 3, { startPage: 1, excludeCover: false });
  assert.deepEqual(toggled, {
    totalPages: 10,
    exactPages: [2, 3, 4, 6, 8],
    parity: "all",
    rangeText: "2-4,6,8",
    canExecute: true,
  });
  const empty = toggleThumbnailPage({ totalPages: 1, exactPages: [1], parity: "odd", rangeText: "1", canExecute: true }, 1, { startPage: 1, excludeCover: false });
  assert.equal(empty.canExecute, false);
  assert.equal(empty.rangeText, "");
  assert.equal(displayNumber(4, 5, { startPage: 4, excludeCover: true }), 5);
  assert.equal(displayNumber(6, 5, { startPage: 4, excludeCover: true }), 7);
  assert.equal(tokenPageCount(10), 10);
  const otherFile = createPageSelection(3, "1-3", "all", { startPage: 1, excludeCover: false });
  assert.ok(!("error" in otherFile));
  const byFile = setFilePageSelection(setFilePageSelection({}, "a.pdf", toggled), "b.pdf", otherFile);
  assert.deepEqual(byFile["a.pdf"].exactPages, [2, 3, 4, 6, 8]);
  assert.deepEqual(byFile["b.pdf"].exactPages, [1, 2, 3]);
});

test("tokens use one captured clock and one-pass expansion with the v8/v9 date whitelist", () => {
  let clockCalls = 0;
  const values = captureTokenValues({
    page: 5,
    pages: 10,
    filename: "file{page}\tname.pdf",
    locale: "en-US",
    clock: () => { clockCalls += 1; return new Date(2026, 8, 6, 12); },
  });
  assert.equal(clockCalls, 1);
  const dateGoldens = [
    ["YYYY-MM-DD", "2026-09-06"],
    ["YYYY.MM.DD", "2026.09.06"],
    ["DD/MM/YYYY", "06/09/2026"],
    ["YYYY MM DD", "2026 09 06"],
    ["MM-DD", "09-06"],
    ["YYYY/MM/DD", "2026/09/06"],
    ["DD.MM.YYYY", "06.09.2026"],
    ["YYYY", "2026"],
    ["DD-MM", "06-09"],
    ["MM/DD.YYYY", "09/06.2026"],
  ] as const;
  for (const [format, expected] of dateGoldens) assert.equal(formatDatePattern(format, values.date), expected);
  for (const format of ["yyyy-MM-DD", "HH", "foo", "", "YYYY-YYYY", "MM/MM", "YYYY--MM", "YYYY  MM", "YYYY/MM/", " YYYY-MM-DD", "YYYYMMDD", "YYYY年MM月DD日", "YYYY\tMM"]) {
    assert.equal(formatDatePattern(format, values.date), null, format);
  }
  const expanded = expandTokens("{filename}|{page}/{pages}|{date}|{date:YYYY/MM/DD}|{foo}|{date:}", values);
  assert.equal(expanded.text, "file{page}\tname|5/10|9/6/2026|2026/09/06|{foo}|{date:}");
  assert.deepEqual(expanded.warnings.map(({ token }) => token), ["{foo}"]);
  assert.deepEqual(expanded.errors.map(({ token }) => token), ["{date:}"]);
  assert.equal(expandTokens("{{page}}|{da{page}te}", values).text, "{5}|{da5te}");
  assert.equal(clockCalls, 1);
  const korean = expandTokens("{date}", { ...values, date: new Date(2026, 8, 5, 12), locale: "ko-KR" });
  assert.equal(korean.text, "2026. 9. 5.");
});

test("text preprocessing, whole-candidate coverage and document-wide font selection match the probes", async () => {
  const values: CapturedTokenValues = {
    page: 5,
    pages: 10,
    filename: "file{page}\tname",
    date: new Date(2026, 8, 6, 12),
    locale: "en-US",
  };
  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  const helvetica = await document.embedFont(StandardFonts.Helvetica);
  const notoBytes = await fs.readFile(path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"));
  const noto = await document.embedFont(notoBytes, { subset: false });
  const preprocessingGoldens = [
    { input: "A\tB\r\nC\rD", lines: ["A    B", "C", "D"], warnings: [], errors: [], font: "helvetica", blocked: false, missing: [] },
    { input: "가\r나", lines: ["가", "나"], warnings: [], errors: [], font: "noto", blocked: false, missing: [] },
    { input: "A\0B", lines: ["A\0B"], warnings: [], errors: [{ code: "control-character", line: 1, column: 2, codePoint: 0 }], blocked: true },
    { input: "A\vB", lines: ["A\vB"], warnings: [], errors: [{ code: "control-character", line: 1, column: 2, codePoint: 11 }], blocked: true },
    { input: "A\u0085B", lines: ["A\u0085B"], warnings: [], errors: [{ code: "control-character", line: 1, column: 2, codePoint: 133 }], blocked: true },
    {
      input: "{filename} {page}/{pages} {date} {date:YYYY-MM-DD}",
      lines: ["file{page}    name 5/10 9/6/2026 2026-09-06"], warnings: [], errors: [], font: "helvetica", blocked: false, missing: [],
    },
    {
      input: "{foo}", lines: ["{foo}"],
      warnings: [{ code: "unknown-token", token: "{foo}", offset: 0 }], errors: [], font: "helvetica", blocked: false, missing: [],
    },
    {
      input: "{date:foo}", lines: ["{date:foo}"], warnings: [],
      errors: [{ code: "date-format", offset: 0, token: "{date:foo}" }], blocked: true,
    },
    { input: "\n\n", lines: ["", "", ""], warnings: [], errors: [], font: "helvetica", blocked: false, missing: [] },
    {
      input: `${"A".repeat(80)}🙂`, lines: [`${"A".repeat(80)}🙂`], warnings: [], errors: [], font: "noto", blocked: true,
      missing: [{ field: "probe", line: 1, column: 81, codePoint: 0x1f642 }],
    },
  ] as const;
  for (const golden of preprocessingGoldens) {
    const prepared = preprocessText(golden.input, values);
    assert.deepEqual(prepared.lines, golden.lines, golden.input);
    assert.deepEqual(prepared.warnings, golden.warnings, golden.input);
    assert.deepEqual(prepared.errors, golden.errors, golden.input);
    const decision = decideDocumentFont([{ field: "probe", prepared }], helvetica, noto);
    assert.equal(decision.blocked, golden.blocked, golden.input);
    if ("font" in golden) assert.equal(decision.font, golden.font, golden.input);
    if ("missing" in golden) assert.deepEqual(decision.missing, golden.missing, golden.input);
  }
  const resume = decideDocumentFont([{ field: "header", prepared: preprocessText("Résumé €", values) }], helvetica, noto);
  assert.deepEqual(resume, { font: "helvetica", blocked: false, missing: [] });
  const russian = decideDocumentFont([{ field: "header", prepared: preprocessText("Русский", values) }], helvetica, noto);
  assert.deepEqual(russian, { font: "noto", blocked: false, missing: [] });
  const greek = decideDocumentFont([{ field: "header", prepared: preprocessText("Δοκιμή", values) }], helvetica, noto);
  assert.deepEqual(greek.missing, [{ field: "header", line: 1, column: 6, codePoint: 0x03ae }]);
  assert.equal(greek.blocked, true);
  const emoji = decideDocumentFont([{ field: "watermark", prepared: preprocessText(`${"A".repeat(80)}🙂`, values) }], helvetica, noto);
  assert.deepEqual(emoji.missing, [{ field: "watermark", line: 1, column: 81, codePoint: 0x1f642 }]);
  assert.equal(emoji.blocked, true);
  const mixed = decideDocumentFont([
    { field: "header", prepared: preprocessText("ASCII", values) },
    { field: "footer", prepared: preprocessText("Русский", values) },
  ], helvetica, noto);
  assert.equal(mixed.font, "noto");
  const coverageTrace: string[] = [];
  const traced = decideDocumentFont(
    ["Русский", "ASCII"].map((text) => ({ field: text, prepared: preprocessText(text, values) })),
    {
      widthOfTextAtSize: () => 1,
      encodeText: (text) => {
        coverageTrace.push(`H:${text}`);
        if (text === "Русский") throw new Error("unsupported");
      },
    },
    {
      widthOfTextAtSize: () => 1,
      encodeText: () => undefined,
      getCharacterSet: () => {
        coverageTrace.push("N");
        return [..."РусскийASCII"].map((character) => character.codePointAt(0) ?? 0);
      },
    },
  );
  assert.deepEqual(coverageTrace, ["H:Русский", "H:ASCII", "N"]);
  assert.deepEqual(traced, { font: "noto", blocked: false, missing: [] });
  let notoCoverageCalls = 0;
  const noFallback = decideDocumentFont(
    [{ field: "header", prepared: preprocessText("ASCII", values) }],
    { encodeText: () => undefined, widthOfTextAtSize: () => 1 },
    { encodeText: () => undefined, widthOfTextAtSize: () => 1, getCharacterSet: () => { notoCoverageCalls += 1; return []; } },
  );
  assert.equal(noFallback.font, "helvetica");
  assert.equal(notoCoverageCalls, 0);
});

test("six-region text layout uses identical measured/drawn runs and reports horizontal, vertical and margin overflow", async () => {
  const document = await PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const line of ["A".repeat(80), "i", ""]) {
    const narrow = layoutTextLines({ lines: [line], size: 12, region: { x: 0, y: 0, width: 5, height: 100 }, alignment: "left", vertical: "top", font });
    assert.deepEqual(narrow, { ok: false, error: "narrow-region", ellipsisWidth: 12 }, JSON.stringify(line));
  }
  const ellipsisOnly = layoutTextLines({ lines: ["AAAA", "B", "C"], size: 12, region: { x: 0, y: 0, width: 12, height: 100 }, alignment: "left", vertical: "top", font });
  assert.ok(ellipsisOnly.ok);
  assert.equal(ellipsisOnly.runs[0].text, "…");
  assert.equal(ellipsisOnly.runs[0].width, 12);
  assert.ok(ellipsisOnly.warnings.includes("horizontal-overflow"));
  const twoLines = layoutTextLines({ lines: ["A".repeat(80), "B", "C"], size: 12, region: { x: 0, y: 0, width: 50, height: 28.8 }, alignment: "center", vertical: "top", font });
  assert.ok(twoLines.ok);
  assert.deepEqual(twoLines.runs.map(({ text, width, y }) => ({ text, width, y })), [
    { text: "AAAA…", width: 44.016, y: 16.8 },
    { text: "B", width: 8.004, y: 2.400000000000002 },
  ]);
  assert.deepEqual(twoLines.warnings, ["horizontal-overflow", "vertical-overflow"]);
  const zeroLines = layoutTextLines({ lines: ["A".repeat(80), "B", "C"], size: 12, region: { x: 0, y: 0, width: 50, height: 10 }, alignment: "right", vertical: "bottom", font });
  assert.ok(zeroLines.ok);
  assert.deepEqual(zeroLines.runs, []);
  assert.deepEqual(zeroLines.warnings, ["horizontal-overflow", "vertical-overflow"]);

  const regions = createSixTextRegions(600, 800, { top: 20, right: 30, bottom: 40, left: 30 });
  assert.deepEqual(regions.map(({ region }) => region), ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]);
  const sixRegionRuns = regions.map((region) => {
    const result = layoutTextLines({ lines: ["AB", "CD"], size: 12, region: region.box, alignment: region.alignment, vertical: region.vertical, font });
    assert.ok(result.ok);
    assert.equal(result.lineHeight, 14.399999999999999);
    return result.runs.map(({ text, width, x, y }) => ({ text, width, x, y }));
  });
  assert.deepEqual(sixRegionRuns, [
    [{ text: "AB", width: 16.008, x: 30, y: 768 }, { text: "CD", width: 17.328, x: 30, y: 753.6 }],
    [{ text: "AB", width: 16.008, x: 291.996, y: 768 }, { text: "CD", width: 17.328, x: 291.336, y: 753.6 }],
    [{ text: "AB", width: 16.008, x: 553.992, y: 768 }, { text: "CD", width: 17.328, x: 552.672, y: 753.6 }],
    [{ text: "AB", width: 16.008, x: 30, y: 54.4 }, { text: "CD", width: 17.328, x: 30, y: 40 }],
    [{ text: "AB", width: 16.008, x: 291.996, y: 54.4 }, { text: "CD", width: 17.328, x: 291.336, y: 40 }],
    [{ text: "AB", width: 16.008, x: 553.992, y: 54.4 }, { text: "CD", width: 17.328, x: 552.672, y: 40 }],
  ]);
  assert.throws(() => createSixTextRegions(100, 100, { top: 50, bottom: 50, left: 0, right: 0 }), /margin-exhausts-page/);
  assert.throws(() => createSixTextRegions(100, 100, { top: 0, bottom: 0, left: 50, right: 50 }), /margin-exhausts-page/);

  const values: CapturedTokenValues = { page: 1, pages: 1, filename: "file", date: new Date(0), locale: "en-US" };
  const prepared = preprocessText("A\tB\r\nC\rD", values);
  const runs = layoutTextLines({ lines: prepared.lines, size: 12, region: { x: 0, y: 0, width: 200, height: 100 }, alignment: "left", vertical: "top", font });
  assert.ok(runs.ok);
  assert.deepEqual(runs.runs.map(({ text }) => text), ["A    B", "C", "D"]);
  assert.deepEqual(runs.runs.map(({ text, width }) => width === font.widthOfTextAtSize(text, 12)), [true, true, true]);
});

test("tile policy permits 400, rejects the projected 420 before allocation and keeps offset/rotation", () => {
  type TileInputHasNoLimitOverride = "maximumTiles" extends keyof TileLayoutInput ? false : true;
  const tileInputHasNoLimitOverride: TileInputHasNoLimitOverride = true;
  assert.equal(tileInputHasNoLimitOverride, true);
  const measurePlacementCreation = (input: TileLayoutInput & Record<string, unknown>) => {
    const originalPush = Array.prototype.push;
    let generated = 0;
    Array.prototype.push = function (...values) {
      generated += values.filter((value) => value && typeof value === "object" && "rotation" in value && "x" in value && "y" in value).length;
      return originalPush.apply(this, values);
    };
    try {
      return { result: createTilePlacements(input), generated };
    } finally {
      Array.prototype.push = originalPush;
    }
  };
  const { result: allowed, generated: allowedGenerated } = measurePlacementCreation({ pageWidth: 200, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 0, rotation: -32 });
  assert.ok(allowed.ok);
  assert.equal(allowed.count, 400);
  assert.equal(allowed.placements.length, 400);
  assert.equal(allowedGenerated, 400);
  assert.equal(allowed.placements[0].rotation, -32);
  const projected420 = { pageWidth: 201, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 0 };
  const rejected = measurePlacementCreation(projected420);
  assert.deepEqual(rejected, {
    result: { ok: false, error: "tile-limit", count: 420, maximumTiles: 400 },
    generated: 0,
  });
  const attemptedOverride = measurePlacementCreation({ ...projected420, maximumTiles: 1_000 });
  assert.deepEqual(attemptedOverride, {
    result: { ok: false, error: "tile-limit", count: 420, maximumTiles: 400 },
    generated: 0,
  });
  const { result: spaced, generated: spacedGenerated } = measurePlacementCreation({ pageWidth: 201, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 1, offsetX: 0, offsetY: 0 });
  assert.ok(spaced.ok);
  assert.equal(spaced.count, 361);
  assert.equal(spacedGenerated, 361);
  const offset = createTilePlacements({ pageWidth: 20, pageHeight: 20, tileWidth: 10, tileHeight: 10, gap: 0, offsetX: 5, offsetY: 5, rotation: 30 });
  assert.deepEqual(offset, {
    ok: true,
    count: 4,
    placements: [
      { x: 5, y: 5, rotation: 30 },
      { x: 15, y: 5, rotation: 30 },
      { x: 5, y: 15, rotation: 30 },
      { x: 15, y: 15, rotation: 30 },
    ],
  });
  assert.equal(createTilePlacements({ pageWidth: 200, pageHeight: 200, tileWidth: 0, tileHeight: 10, gap: 0 }).ok, false);
  assert.equal(createTilePlacements({ pageWidth: 200, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: -1 }).ok, false);
});

test("canvas A policy, DPI fallback, B-only metrics, warning expression and 200MiB pre-registration guard match goldens", async () => {
  const a4 = measureCanvas({ width: 595.28 * 200 / 72, height: 841.89 * 200 / 72 });
  assert.deepEqual({ width: a4.width, height: a4.height, pixels: a4.pixels }, { width: 1654, height: 2339, pixels: 3_868_706 });
  const a4At150 = measureCanvas({ width: 595.28 * 150 / 72, height: 841.89 * 150 / 72 });
  const metrics = measureBatchResources(Array.from({ length: 8 }, () => a4At150));
  assert.equal(metrics.cumulativePixels, 17_413_712);
  assert.equal(a4At150.allowed, true);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const viewportSource = await PDFDocument.create({ updateMetadata: false });
  const sourcePage = viewportSource.addPage([600, 800]);
  sourcePage.setCropBox(50, 100, 400, 600);
  sourcePage.node.set(PDFName.of("UserUnit"), viewportSource.context.obj(2));
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await viewportSource.save()) });
  try {
    const viewportDocument = await loadingTask.promise;
    const page = await viewportDocument.getPage(1);
    const viewportGoldens = [
      [0, 150, 1667, 2500, 4_167_500, 16_670_000, true],
      [0, 200, 2223, 3334, 7_411_482, 29_645_928, true],
      [0, 300, 3334, 5000, 16_670_000, 66_680_000, false],
      [90, 150, 2500, 1667, 4_167_500, 16_670_000, true],
      [90, 200, 3334, 2223, 7_411_482, 29_645_928, true],
      [90, 300, 5000, 3334, 16_670_000, 66_680_000, false],
      [180, 150, 1667, 2500, 4_167_500, 16_670_000, true],
      [180, 200, 2223, 3334, 7_411_482, 29_645_928, true],
      [180, 300, 3334, 5000, 16_670_000, 66_680_000, false],
      [270, 150, 2500, 1667, 4_167_500, 16_670_000, true],
      [270, 200, 3334, 2223, 7_411_482, 29_645_928, true],
      [270, 300, 5000, 3334, 16_670_000, 66_680_000, false],
    ] as const;
    for (const [rotation, dpi, width, height, pixels, rgbaBytes, allowed] of viewportGoldens) {
      const measured = measureCanvas(page.getViewport({ scale: dpi / 72, rotation }));
      assert.deepEqual(
        { width: measured.width, height: measured.height, pixels: measured.pixels, rgbaBytes: measured.rgbaBytes, allowed: measured.allowed },
        { width, height, pixels, rgbaBytes, allowed },
        `rotation=${rotation},dpi=${dpi}`,
      );
    }
    const actualViewportFallback = chooseCanvasDpi({
      requestedDpi: 300,
      viewportAtDpi: (dpi) => page.getViewport({ scale: dpi / 72, rotation: 90 }),
    });
    assert.equal(actualViewportFallback.appliedDpi, 200);
    assert.deepEqual(actualViewportFallback.attempts.map(({ dpi }) => dpi), [300, 200]);
  } finally {
    await loadingTask.destroy();
  }

  const downgraded = chooseCanvasDpi({ requestedDpi: 300, viewportAtDpi: (dpi) => ({ width: 1_200 * dpi / 72, height: 1_200 * dpi / 72 }) });
  assert.equal(downgraded.appliedDpi, 200);
  assert.equal(downgraded.decision, "use-lower-dpi");
  const downgradedTo150 = chooseCanvasDpi({ requestedDpi: 300, viewportAtDpi: (dpi) => ({ width: 1_600 * dpi / 72, height: 1_000 * dpi / 72 }) });
  assert.deepEqual({
    attempts: downgradedTo150.attempts.map(({ dpi }) => dpi),
    appliedDpi: downgradedTo150.appliedDpi,
    supported: downgradedTo150.supported,
    decision: downgradedTo150.decision,
  }, {
    attempts: [300, 200, 150],
    appliedDpi: 150,
    supported: true,
    decision: "use-lower-dpi",
  });
  const unsupported = chooseCanvasDpi({ requestedDpi: 300, viewportAtDpi: (dpi) => ({ width: 3_000 * dpi / 72, height: 3_000 * dpi / 72 }) });
  assert.equal(unsupported.appliedDpi, null);
  assert.equal(unsupported.decision, "unsupported-reduce-range");
  assert.deepEqual(unsupported.attempts.map(({ dpi }) => dpi), [300, 200, 150]);
  assert.deepEqual(measureCanvas({ width: 100, height: 100 }, { maxSide: 4_096, maxArea: 9_999 }), {
    width: 100,
    height: 100,
    pixels: 10_000,
    rgbaBytes: 40_000,
    maxSideExceeded: false,
    maxAreaExceeded: true,
    allowed: false,
  });
  assert.deepEqual(measureCanvas({ width: 4_096, height: 4_096 }), {
    width: 4_096,
    height: 4_096,
    pixels: 16_777_216,
    rgbaBytes: 67_108_864,
    maxSideExceeded: false,
    maxAreaExceeded: false,
    allowed: true,
  });
  assert.deepEqual(measureCanvas({ width: 4_096.01, height: 1 }), {
    width: 4_097,
    height: 1,
    pixels: 4_097,
    rgbaBytes: 16_388,
    maxSideExceeded: true,
    maxAreaExceeded: false,
    allowed: false,
  });

  const rawLedgerMetrics = measureBatchResources(
    [measureCanvas({ width: 100, height: 100 }), measureCanvas({ width: 100, height: 200 })],
    [
      { resources: [{ pixels: 100, bytes: 400, count: 1 }, { pixels: 200, bytes: 800, count: 1 }] },
      { resources: [{ pixels: 100, bytes: 400, count: 2 }] },
      { resources: [{ pixels: 50, bytes: 200, count: 1 }] },
    ],
  );
  assert.deepEqual(rawLedgerMetrics, {
    cumulativePixels: 30_000,
    cumulativeRawRgbaBytes: 120_000,
    rawRgbaLedger: [
      { pixels: 300, bytes: 1_200, resourceCount: 2 },
      { pixels: 200, bytes: 800, resourceCount: 2 },
      { pixels: 50, bytes: 200, resourceCount: 1 },
    ],
    peakRawRgbaBytes: 1_200,
    peakRawResourceCount: 2,
  });
  assert.equal("allowed" in rawLedgerMetrics, false);
  assert.equal("decision" in rawLedgerMetrics, false);

  assert.deepEqual(estimateOutputWarning({ selectedPixels: 1_000, bytesPerPixel: 1, inputBytes: 100 }), { estimatedBytes: 1_000, thresholdBytes: 1_000, warn: false });
  assert.deepEqual(estimateOutputWarning({ selectedPixels: 1_001, bytesPerPixel: 1, inputBytes: 100 }), { estimatedBytes: 1_001, thresholdBytes: 1_000, warn: true });
  assert.deepEqual(estimateOutputWarning({ selectedPixels: 104_857_601, bytesPerPixel: 1, inputBytes: 20_000_000 }), { estimatedBytes: 104_857_601, thresholdBytes: 104_857_600, warn: true });
  let coefficientCalls = 0;
  assert.deepEqual(estimatePreflightOutputWarning({
    selectedPagePixels: [400, 600],
    dpi: 300,
    format: "jpeg",
    coefficient: (dpi, format) => { coefficientCalls += 1; assert.equal(dpi, 300); assert.equal(format, "jpeg"); return 2; },
    inputBytes: 100,
  }), { estimatedBytes: 2_000, thresholdBytes: 1_000, warn: true });
  assert.equal(coefficientCalls, 1);

  const mib = 1024 * 1024;
  const rows = [
    [[200], [200]],
    [[199, 2, 1], [199]],
    [[201], []],
    [[100, 100, 1], [100, 100]],
  ] as const;
  for (const [inputs, expected] of rows) {
    let retained = 0;
    const registered: number[] = [];
    for (const current of inputs) {
      const decision = checkMemoryResultRegistration(retained, current * mib);
      if (!decision.register) break;
      retained = decision.totalBytes;
      registered.push(current);
    }
    assert.deepEqual(registered, expected);
  }
  assert.equal(checkMemoryResultRegistration(MEMORY_RESULT_LIMIT_BYTES - 1, 1).register, true);
  assert.equal(checkMemoryResultRegistration(MEMORY_RESULT_LIMIT_BYTES, 1).register, false);
});

test("stamp coordinates ignore DPR, preserve center-relative width/aspect, scale uniformly and clamp", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fixture = await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish/legacy-oracle/input.pdf"));
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fixture) });
  try {
    const document = await loadingTask.promise;
    const page = await document.getPage(1);
    const expectedByRotation = [
      [170, 460],
      [210, 280],
      [330, 340],
      [290, 520],
    ] as const;
    let combinations = 0;
    for (const [rotationIndex, rotation] of [0, 90, 180, 270].entries()) {
      for (const dpr of [1, 2]) {
        for (const shrink of [1, 0.5]) {
          const viewport = page.getViewport({ scale: 0.5, rotation });
          const rect = { left: 17, top: 23, width: viewport.width * shrink, height: viewport.height * shrink };
          let conversionCalls = 0;
          const point = cssPointToPdf({
            clientX: rect.left + rect.width * 0.3,
            clientY: rect.top + rect.height * 0.4,
            rect,
            viewport: {
              width: viewport.width,
              height: viewport.height,
              convertToPdfPoint: (x, y) => {
                conversionCalls += 1;
                return viewport.convertToPdfPoint(x, y);
              },
            },
          });
          assert.deepEqual([point.pdf.x, point.pdf.y], expectedByRotation[rotationIndex], `CSS rotation=${rotation},dpr=${dpr},shrink=${shrink}`);
          assert.equal(conversionCalls, 1);
          const bitmapViewport = page.getViewport({ scale: 0.5 * dpr, rotation });
          assert.deepEqual(
            bitmapViewport.convertToPdfPoint(viewport.width * 0.3 * dpr, viewport.height * 0.4 * dpr),
            expectedByRotation[rotationIndex],
            `bitmap rotation=${rotation},dpr=${dpr},shrink=${shrink}`,
          );
          combinations += 1;
        }
      }
    }
    assert.equal(combinations, 16);
  } finally {
    await loadingTask.destroy();
  }

  const model = createNormalizedStamp({ x: 320, y: 510, width: 80, height: 60, viewportWidth: 400, viewportHeight: 600, aspect: 4 / 3 });
  assert.deepEqual(model, { cx: 0.9, cy: 0.9, rw: 0.2, aspect: 4 / 3 });
  assert.deepEqual(applyNormalizedStamp(model, { width: 400, height: 600 }), { x: 320, y: 510, width: 80, height: 60, cx: 360, cy: 540 });
  assert.deepEqual(applyNormalizedStamp(model, { width: 600, height: 400 }), { x: 480, y: 310, width: 120, height: 90, cx: 540, cy: 355 });
  const narrow = applyNormalizedStamp(model, { width: 100, height: 10 });
  assert.ok(Math.abs(narrow.width - 40 / 3) < 1e-12);
  assert.equal(narrow.height, 10);
  assert.equal(narrow.cx, 90);
  assert.equal(narrow.cy, 5);
  const corners = stampPdfCorners(narrow, { width: 100, height: 10, convertToPdfPoint: (x, y) => [x + 1, y + 2] });
  assert.equal(corners.length, 4);
  assert.deepEqual(
    stampPdfCorners(
      { x: 10, y: 20, width: 30, height: 40, cx: 25, cy: 40 },
      { width: 100, height: 100, convertToPdfPoint: (x, y) => [x + 1, y + 2] },
    ),
    [{ x: 11, y: 22 }, { x: 41, y: 22 }, { x: 11, y: 62 }, { x: 41, y: 62 }],
  );
});

test("finish plan emits the canonical composite order as a pure 1-based plan", () => {
  assert.deepEqual(FINISH_EXECUTION_ORDER, [
    "structure-and-forms", "background", "original", "foreground", "numbers-and-headers", "stamp", "raster",
  ]);
  const plan = createFinishExecutionPlan({ structureOrForms: true, background: true, foreground: true, numbersOrHeaders: true, stamp: true, raster: true });
  assert.deepEqual(plan.steps.map(({ order }) => order), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(plan.enabledStages, FINISH_EXECUTION_ORDER);
  assert.deepEqual(createFinishExecutionPlan({}).enabledStages, ["original"]);
});

test("preflight helper is a single re-export of the product classifier and keeps internal reason codes", async () => {
  const product = await import("../../src/features/pdf-editor/finish/preflight.ts");
  const helper = await import("../helpers/pdf-finish-ocg-preflight.mjs");
  assert.equal(helper.classifyOcgPreflight, product.classifyOcgPreflight);
  const manifest = JSON.parse(await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish/manifest.json"), "utf8"));
  for (const filename of ["on.pdf", "r11-type3-page-true-1.pdf"]) {
    const fixture = manifest.ocg.files.find(({ file }: { file: string }) => file.endsWith(`/${filename}`));
    const result = await product.classifyOcgPreflight(await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish", fixture.file)));
    assert.deepEqual({ allowed: result.allowed, reason: result.reason }, fixture.preflight);
    assert.equal(result.reasonCode, result.allowed ? OcgPreflightReasonCode.Allow : filename.includes("type3") ? OcgPreflightReasonCode.ReachableType3 : OcgPreflightReasonCode.UnsupportedOptionalContent);
    const repeated = await product.classifyOcgPreflight(await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish", fixture.file)));
    assert.deepEqual(
      { allowed: repeated.allowed, reason: repeated.reason, reasonCode: repeated.reasonCode, type3: repeated.type3 },
      { allowed: result.allowed, reason: result.reason, reasonCode: result.reasonCode, type3: result.type3 },
    );
  }
});

test("finish pure policy outputs are deterministic", () => {
  const values: CapturedTokenValues = {
    page: 3,
    pages: 8,
    filename: "sample{page}",
    date: new Date(2026, 8, 6, 12),
    locale: "en-US",
  };
  const factories = [
    () => createFinishAnchors(geometryFixtures[1], { top: 10, right: 20, bottom: 30, left: 40 }),
    () => createPageSelection(8, "2-8", "even", { startPage: 1, excludeCover: false }),
    () => expandTokens("{filename}-{page}-{date:YYYY-MM-DD}", values),
    () => preprocessText("A\tB\r\nC", values),
    () => createSixTextRegions(600, 800, { top: 20, right: 30, bottom: 40, left: 30 }),
    () => createTilePlacements({ pageWidth: 201, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 1, rotation: -32 }),
    () => measureCanvas({ width: 595.28 * 200 / 72, height: 841.89 * 200 / 72 }),
    () => applyNormalizedStamp({ cx: 0.9, cy: 0.9, rw: 0.2, aspect: 4 / 3 }, { width: 600, height: 400 }),
    () => createFinishExecutionPlan({ structureOrForms: true, background: true, stamp: true }),
  ];
  for (const factory of factories) {
    const expected = factory();
    for (let repeat = 0; repeat < 20; repeat += 1) assert.deepEqual(factory(), expected);
  }
});

test("layout accepts injected width behavior without coupling to a PDF draw call", () => {
  const fixedWidthFont: TextFontProbe = {
    encodeText: () => undefined,
    widthOfTextAtSize: (text, size) => [...text].length * size,
  };
  const result = layoutTextLines({ lines: ["ABCD"], size: 10, region: { x: 0, y: 0, width: 30, height: 12 }, alignment: "left", vertical: "top", font: fixedWidthFont });
  assert.ok(result.ok);
  assert.equal(result.runs[0].text, "AB…");
  assert.equal(result.runs[0].width, 30);
});
