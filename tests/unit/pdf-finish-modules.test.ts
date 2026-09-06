import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts } from "pdf-lib";
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

test("selection keeps a file-local physical exact set, canonical ranges, lower bounds, parity and numbering", () => {
  assert.deepEqual(parseRange("2-4,6,8", 10), { ok: true, pages: [2, 3, 4, 6, 8], canonicalText: "2-4,6,8" });
  assert.equal(formatCanonicalRange([8, 4, 2, 3, 6, 4]), "2-4,6,8");
  assert.deepEqual(applyParity([2, 3, 4, 5], "odd"), [3, 5]);
  assert.deepEqual(applyParity([2, 3, 4, 5], "even"), [2, 4]);
  assert.equal(selectionAnchor({ startPage: 4, excludeCover: true }), 4);
  assert.equal(selectionAnchor({ startPage: 1, excludeCover: true }), 2);
  assert.equal(isThumbnailDisabled(1, 10, { startPage: 1, excludeCover: true }), true);
  assert.equal(isThumbnailDisabled(2, 10, { startPage: 1, excludeCover: true }), false);

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
  assert.deepEqual(preprocessText("A\tB\r\nC\rD", values).lines, ["A    B", "C", "D"]);
  assert.deepEqual(preprocessText("{filename} {page}/{pages} {date} {date:YYYY-MM-DD}", values).lines, ["file{page}    name 5/10 9/6/2026 2026-09-06"]);
  for (const [character, codePoint] of [["\0", 0], ["\v", 11], ["\u0085", 133]] as const) {
    const prepared = preprocessText(`A${character}B`, values);
    assert.deepEqual(prepared.errors.at(-1), { code: "control-character", line: 1, column: 2, codePoint });
  }
  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  const helvetica = await document.embedFont(StandardFonts.Helvetica);
  const notoBytes = await fs.readFile(path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"));
  const noto = await document.embedFont(notoBytes, { subset: false });
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
  const narrow = layoutTextLines({ lines: ["A"], size: 12, region: { x: 0, y: 0, width: 5, height: 100 }, alignment: "left", vertical: "top", font });
  assert.deepEqual(narrow, { ok: false, error: "narrow-region", ellipsisWidth: 12 });
  const ellipsisOnly = layoutTextLines({ lines: ["AAAA", "B", "C"], size: 12, region: { x: 0, y: 0, width: 12, height: 100 }, alignment: "left", vertical: "top", font });
  assert.ok(ellipsisOnly.ok);
  assert.equal(ellipsisOnly.runs[0].text, "…");
  assert.equal(ellipsisOnly.runs[0].width, 12);
  assert.ok(ellipsisOnly.warnings.includes("horizontal-overflow"));
  const twoLines = layoutTextLines({ lines: ["A".repeat(80), "B", "C"], size: 12, region: { x: 0, y: 0, width: 50, height: 28.8 }, alignment: "center", vertical: "top", font });
  assert.ok(twoLines.ok);
  assert.equal(twoLines.runs.length, 2);
  assert.ok(twoLines.warnings.includes("horizontal-overflow"));
  assert.ok(twoLines.warnings.includes("vertical-overflow"));
  assert.equal(twoLines.runs[0].text, "AAAA…");
  const zeroLines = layoutTextLines({ lines: ["A"], size: 12, region: { x: 0, y: 0, width: 50, height: 10 }, alignment: "right", vertical: "bottom", font });
  assert.ok(zeroLines.ok);
  assert.equal(zeroLines.runs.length, 0);
  assert.deepEqual(zeroLines.warnings, ["vertical-overflow"]);

  const regions = createSixTextRegions(600, 800, { top: 20, right: 30, bottom: 40, left: 30 });
  assert.deepEqual(regions.map(({ region }) => region), ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]);
  for (const region of regions) {
    const result = layoutTextLines({ lines: ["AB"], size: 12, region: region.box, alignment: region.alignment, vertical: region.vertical, font });
    assert.ok(result.ok);
    const run = result.runs[0];
    if (region.alignment === "left") assert.equal(run.x, region.box.x);
    if (region.alignment === "center") assert.equal(run.x, region.box.x + (region.box.width - run.width) / 2);
    if (region.alignment === "right") assert.equal(run.x, region.box.x + region.box.width - run.width);
  }
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
  const allowed = createTilePlacements({ pageWidth: 200, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 0, rotation: -32 });
  assert.ok(allowed.ok);
  assert.equal(allowed.count, 400);
  assert.equal(allowed.placements.length, 400);
  assert.equal(allowed.placements[0].rotation, -32);
  assert.deepEqual(createTilePlacements({ pageWidth: 201, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 0 }), { ok: false, error: "tile-limit", count: 420, maximumTiles: 400 });
  const spaced = createTilePlacements({ pageWidth: 201, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: 1, offsetX: 0, offsetY: 0 });
  assert.ok(spaced.ok);
  assert.equal(spaced.count, 361);
  assert.equal(createTilePlacements({ pageWidth: 200, pageHeight: 200, tileWidth: 0, tileHeight: 10, gap: 0 }).ok, false);
  assert.equal(createTilePlacements({ pageWidth: 200, pageHeight: 200, tileWidth: 10, tileHeight: 10, gap: -1 }).ok, false);
});

test("canvas A policy, DPI fallback, B-only metrics, warning expression and 200MiB pre-registration guard match goldens", () => {
  const a4 = measureCanvas({ width: 595.28 * 200 / 72, height: 841.89 * 200 / 72 });
  assert.deepEqual({ width: a4.width, height: a4.height, pixels: a4.pixels }, { width: 1654, height: 2339, pixels: 3_868_706 });
  const a4At150 = measureCanvas({ width: 595.28 * 150 / 72, height: 841.89 * 150 / 72 });
  const metrics = measureBatchResources(Array.from({ length: 8 }, () => a4At150));
  assert.equal(metrics.cumulativePixels, 17_413_712);
  assert.equal(a4At150.allowed, true);

  const downgraded = chooseCanvasDpi({ requestedDpi: 300, viewportAtDpi: (dpi) => ({ width: 1_200 * dpi / 72, height: 1_200 * dpi / 72 }) });
  assert.equal(downgraded.appliedDpi, 200);
  assert.equal(downgraded.decision, "use-lower-dpi");
  const unsupported = chooseCanvasDpi({ requestedDpi: 300, viewportAtDpi: (dpi) => ({ width: 3_000 * dpi / 72, height: 3_000 * dpi / 72 }) });
  assert.equal(unsupported.appliedDpi, null);
  assert.equal(unsupported.decision, "unsupported-reduce-range");
  assert.deepEqual(unsupported.attempts.map(({ dpi }) => dpi), [300, 200, 150]);

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

test("stamp coordinates ignore DPR, preserve center-relative width/aspect, scale uniformly and clamp", () => {
  for (const viewport of geometryFixtures) {
    for (const dpr of [1, 2]) {
      for (const shrink of [1, 0.5]) {
        const rect = { left: 17, top: 23, width: viewport.width * shrink, height: viewport.height * shrink };
        const point = cssPointToPdf({
          clientX: rect.left + rect.width * 0.3,
          clientY: rect.top + rect.height * 0.4,
          rect,
          viewport: {
            width: viewport.width,
            height: viewport.height,
            convertToPdfPoint: (x, y) => {
              const pdf = viewportPointToPdf(viewport.transform, x, y);
              return [pdf.x, pdf.y];
            },
          },
        });
        const expected = viewportPointToPdf(viewport.transform, viewport.width * 0.3, viewport.height * 0.4);
        assert.deepEqual(point.pdf, expected, `rotation=${viewport.rotation},dpr=${dpr},shrink=${shrink}`);
      }
    }
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
