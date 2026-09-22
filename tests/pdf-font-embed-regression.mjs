import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { PNG } from "pngjs";

import { createPdfDocument, embedCustomPdfFont, embedHelvetica } from "../src/utils/pdfFontEmbed.ts";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.resolve(process.env.PDF_FONT_EMBED_OUTPUT
  || path.join(repositoryRoot, "tests/visual-artifacts/ui-c/font-embed-regression"));
const pdfjs = await import(pathToFileURL(path.join(repositoryRoot, "node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const fullFont = await fs.readFile(path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"));
const subsetFont = gunzipSync(await fs.readFile(path.join(
  repositoryRoot,
  "scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf.gz",
)));
const samples = [
  "한글 테스트",
  "A B | A\u00a0B",
  "가 ㄱㄴ",
  "0123, ABC! 「안내」 · ₩ € $ % … —",
];
const isolatedGlyphs = ["한", "글", "테", "스", "트"];
const results = [];

for (const [kind, fontBytes] of [["full", fullFont], ["subset", subsetFont]]) {
  const sourceFont = fontkit.create(fontBytes);
  const cff = sourceFont["CFF "];
  assert.equal(cff?.isCIDFont, true, `${kind}: fixture must be a CID-keyed CFF font`);

  const document = await createPdfDocument();
  const font = await embedCustomPdfFont(document, exactArrayBuffer(fontBytes));
  const page = document.addPage([560, 260]);
  const encoded = samples.map((sample, index) => {
    const value = font.encodeText(sample).toString();
    page.drawText(sample, { font, size: 16, x: 24, y: 210 - index * 48 });
    const measured = font.widthOfTextAtSize(sample, 16);
    const expected = sourceFont.layout(sample).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0)
      * (1000 / sourceFont.unitsPerEm) * (16 / 1000);
    assert.equal(measured, expected, `${kind}: measurement must keep shaped advances for ${JSON.stringify(sample)}`);
    return value;
  });
  const glyphPage = document.addPage([420, 180]);
  isolatedGlyphs.forEach((value, index) => glyphPage.drawText(value, {
    font,
    size: 24,
    x: 30 + index * 70,
    y: 100,
  }));

  const pdfBytes = await document.save({ useObjectStreams: false });
  const pdfPath = path.join(outputRoot, `${kind}.pdf`);
  await fs.writeFile(pdfPath, pdfBytes);
  const structure = await inspectPdf(pdfBytes);

  assert.equal(structure.type0.get(PDFName.of("Encoding"))?.toString(), structure.encodingRef, `${kind}: Type0 must use the generated Encoding CMap`);
  assert.equal(structure.descendant.get(PDFName.of("Subtype"))?.toString(), "/CIDFontType0", `${kind}: descendant font type`);
  assert.equal(structure.descendant.has(PDFName.of("CIDToGIDMap")), false, `${kind}: Type0 CFF must not declare CIDToGIDMap`);
  assert.equal(structure.descriptor.has(PDFName.of("FontFile2")), false, `${kind}: CFF must not use FontFile2`);
  assert.equal(structure.descriptor.has(PDFName.of("FontFile3")), true, `${kind}: CFF must use FontFile3`);
  assert.equal(structure.fontStream.dict.get(PDFName.of("Subtype"))?.toString(), "/CIDFontType0C", `${kind}: raw CFF stream subtype`);
  assert.deepEqual([...structure.fontBytes.subarray(0, 4)], [1, 0, 4, 3], `${kind}: embedded stream must start with a raw CFF header, not OTTO`);

  const encoding = parseEncodingCmap(structure.encodingCmap);
  const toUnicode = parseUnicodeCmap(structure.unicodeCmap);
  const roundTrips = encoded.map((value) => decodeEncodedText(value, toUnicode));
  assert.deepEqual(roundTrips, samples, `${kind}: low-level ToUnicode round trip`);

  const shapedSpace = sourceFont.layout(samples[0]).glyphs[2];
  assert.equal(shapedSpace.codePoints[0], 0x20, `${kind}: expected shaped Hangul space`);
  const shapedSpaceCid = glyphIdToCid(cff.topDict.charset, shapedSpace.id);
  const shapedSpaceCode = Number.parseInt(encoded[0].slice(1, -1).slice(8, 12), 16);
  assert.equal(encoding.get(shapedSpaceCode), shapedSpaceCid, `${kind}: content code must select the shaped-space CID`);
  assert.equal(toUnicode.get(shapedSpaceCode), " ", `${kind}: shaped-space ToUnicode`);
  assert.match(
    structure.descendant.get(PDFName.of("W"))?.toString() ?? "",
    new RegExp(`(?:^|\\s)${shapedSpaceCid} \\[ ${shapedSpace.advanceWidth * (1000 / sourceFont.unitsPerEm)} \\]`),
    `${kind}: /W must include the shaped-space CID and width`,
  );

  const ordinarySpaceCode = argumentsCode(encoded[1], 1);
  const noBreakSpaceCode = argumentsCode(encoded[1], 7);
  assert.notEqual(ordinarySpaceCode, noBreakSpaceCode, `${kind}: many-to-one spaces need distinct content codes`);
  assert.equal(encoding.get(ordinarySpaceCode), encoding.get(noBreakSpaceCode), `${kind}: U+0020 and U+00A0 select the same CID`);
  assert.equal(toUnicode.get(ordinarySpaceCode), " ", `${kind}: U+0020 round trip`);
  assert.equal(toUnicode.get(noBreakSpaceCode), "\u00a0", `${kind}: U+00A0 round trip`);

  const commands = renderPdf(kind, pdfPath);
  const popplerPage = PNG.sync.read(await fs.readFile(path.join(outputRoot, `${kind}-poppler-1.png`)));
  const ghostscriptPage = PNG.sync.read(await fs.readFile(path.join(outputRoot, `${kind}-gs-1.png`)));
  const popplerBox = inkBounds(popplerPage);
  const ghostscriptBox = inkBounds(ghostscriptPage);
  for (const edge of ["left", "top", "right", "bottom"]) {
    assert.ok(Math.abs(popplerBox[edge] - ghostscriptBox[edge]) <= 3, `${kind}: renderer ${edge} differs by more than 3 px`);
  }
  const ghostscriptGlyphPage = PNG.sync.read(await fs.readFile(path.join(outputRoot, `${kind}-gs-2.png`)));
  const glyphHashes = isolatedGlyphs.map((_, index) => cropInkHash(ghostscriptGlyphPage, (30 + index * 70) * 2, 100));
  assert.equal(new Set(glyphHashes).size, isolatedGlyphs.length, `${kind}: Ghostscript rendered repeated tofu glyphs`);

  const extracted = await pdfJsText(pdfBytes);
  assert.equal(extracted.includes("堺"), false, `${kind}: PDF.js extracted a glyph number as a CJK character`);
  assert.ok(extracted.includes("한글 테스트"), `${kind}: PDF.js lost the Hangul-space sample`);

  results.push({
    kind,
    pdfBytes: pdfBytes.length,
    fontBytes: structure.fontBytes.length,
    fontSha256: createHash("sha256").update(structure.fontBytes).digest("hex"),
    shapedSpace: { gid: shapedSpace.id, cid: shapedSpaceCid, code: shapedSpaceCode, width: shapedSpace.advanceWidth },
    roundTrips,
    popplerBox,
    ghostscriptBox,
    glyphHashes,
    commands,
  });
}

const fallbackResult = await verifyNonCffFallback();

await fs.writeFile(path.join(outputRoot, "results.json"), `${JSON.stringify({ cidCff: results, fallback: fallbackResult }, null, 2)}\n`);
console.log(`PDF font embed regression passed: ${results.length} fonts, exact low-level text round trips, CID widths, Poppler and Ghostscript render checks.`);

async function verifyNonCffFallback() {
  const ttfBytes = await fs.readFile(path.join(repositoryRoot, "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"));
  const document = await createPdfDocument();
  const custom = await embedCustomPdfFont(document, exactArrayBuffer(ttfBytes));
  const standard = await embedHelvetica(document);
  const page = document.addPage([300, 160]);
  page.drawText("Custom TTF 123", { font: custom, size: 16, x: 24, y: 100 });
  page.drawText("Standard Helvetica 456", { font: standard, size: 16, x: 24, y: 60 });
  const bytes = await document.save({ useObjectStreams: false });
  await fs.writeFile(path.join(outputRoot, "non-cff-fallback.pdf"), bytes);
  const parsed = await PDFDocument.load(bytes);
  const dictionaries = [...parsed.context.enumerateIndirectObjects()]
    .map(([, object]) => object)
    .filter((object) => object instanceof PDFDict);
  const descendant = dictionaries.find((object) => object.get(PDFName.of("Subtype"))?.toString() === "/CIDFontType2");
  const descriptor = dictionaries.find((object) => object.get(PDFName.of("Type"))?.toString() === "/FontDescriptor");
  const standardFont = dictionaries.find((object) => object.get(PDFName.of("Subtype"))?.toString() === "/Type1");
  assert.ok(descendant instanceof PDFDict, "TTF fallback must keep CIDFontType2");
  assert.ok(descriptor instanceof PDFDict, "TTF fallback descriptor missing");
  assert.equal(descriptor.has(PDFName.of("FontFile2")), true, "TTF fallback must keep FontFile2");
  assert.equal(descriptor.has(PDFName.of("FontFile3")), false, "TTF fallback must not use FontFile3");
  assert.ok(standardFont instanceof PDFDict, "StandardFonts path must stay Type1");
  return { pdfBytes: bytes.length, ttfSubtype: "/CIDFontType2", standardSubtype: "/Type1" };
}

async function inspectPdf(bytes) {
  const document = await PDFDocument.load(bytes);
  const objects = [...document.context.enumerateIndirectObjects()];
  const type0 = objects.map(([, object]) => object).find((object) => object instanceof PDFDict
    && object.get(PDFName.of("Subtype"))?.toString() === "/Type0");
  assert.ok(type0 instanceof PDFDict, "Type0 font dictionary missing");
  const descendant = objects.map(([, object]) => object).find((object) => object instanceof PDFDict
    && object.get(PDFName.of("Subtype"))?.toString() === "/CIDFontType0");
  assert.ok(descendant instanceof PDFDict, "CIDFontType0 dictionary missing");
  const descriptor = objects.map(([, object]) => object).find((object) => object instanceof PDFDict
    && object.get(PDFName.of("Type"))?.toString() === "/FontDescriptor");
  assert.ok(descriptor instanceof PDFDict, "font descriptor missing");
  const encodingRef = type0.get(PDFName.of("Encoding"))?.toString();
  const unicodeRef = type0.get(PDFName.of("ToUnicode"))?.toString();
  const fontRef = descriptor.get(PDFName.of("FontFile3"))?.toString();
  const streamByRef = new Map(objects.filter(([, object]) => object instanceof PDFRawStream));
  const findStream = (ref) => [...streamByRef].find(([candidate]) => candidate.toString() === ref)?.[1];
  const encodingStream = findStream(encodingRef);
  const unicodeStream = findStream(unicodeRef);
  const fontStream = findStream(fontRef);
  assert.ok(encodingStream instanceof PDFRawStream, "Encoding CMap missing");
  assert.ok(unicodeStream instanceof PDFRawStream, "ToUnicode CMap missing");
  assert.ok(fontStream instanceof PDFRawStream, "FontFile3 stream missing");
  return {
    type0,
    descendant,
    descriptor,
    encodingRef,
    encodingCmap: Buffer.from(decodePDFRawStream(encodingStream).decode()).toString("latin1"),
    unicodeCmap: Buffer.from(decodePDFRawStream(unicodeStream).decode()).toString("latin1"),
    fontStream,
    fontBytes: decodePDFRawStream(fontStream).decode(),
  };
}

function parseEncodingCmap(source) {
  return new Map([...source.matchAll(/<([0-9A-F]{4})>\s+(\d+)/gu)]
    .map((match) => [Number.parseInt(match[1], 16), Number.parseInt(match[2], 10)]));
}

function parseUnicodeCmap(source) {
  return new Map([...source.matchAll(/<([0-9A-F]{4})>\s+<([0-9A-F]+)>/gu)]
    .filter((match) => match[1] !== "0000")
    .map((match) => [Number.parseInt(match[1], 16), decodeUtf16Be(match[2])]));
}

function decodeUtf16Be(hex) {
  const bytes = Buffer.from(hex, "hex");
  for (let index = 0; index < bytes.length; index += 2) {
    const value = bytes[index];
    bytes[index] = bytes[index + 1];
    bytes[index + 1] = value;
  }
  return bytes.toString("utf16le");
}

function decodeEncodedText(value, mapping) {
  const hex = value.slice(1, -1);
  let result = "";
  for (let offset = 0; offset < hex.length; offset += 4) {
    result += mapping.get(Number.parseInt(hex.slice(offset, offset + 4), 16)) ?? "\ufffd";
  }
  return result;
}

function argumentsCode(value, index) {
  return Number.parseInt(value.slice(1, -1).slice(index * 4, index * 4 + 4), 16);
}

function glyphIdToCid(charset, glyphId) {
  if (glyphId === 0) return 0;
  if (Array.isArray(charset)) return charset[glyphId];
  const offset = glyphId - 1;
  const range = charset.ranges.find((candidate) => candidate.offset <= offset && offset <= candidate.offset + candidate.nLeft);
  assert.ok(range, `CID missing for glyph ${glyphId}`);
  return range.first + offset - range.offset;
}

function renderPdf(kind, pdfPath) {
  const commands = [
    {
      name: "poppler",
      command: "pdftoppm",
      args: ["-r", "144", "-png", pdfPath, path.join(outputRoot, `${kind}-poppler`)],
    },
    {
      name: "ghostscript",
      command: "gs",
      args: [
        "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=png16m", "-r144",
        `-sOutputFile=${path.join(outputRoot, `${kind}-gs-%d.png`)}`,
        pdfPath,
      ],
    },
  ];
  return commands.map(({ name, command, args }) => {
    const result = spawnSync(command, args, { encoding: "utf8" });
    assert.equal(result.status, 0, `${kind}: ${name} failed: ${result.stderr || result.error?.message}`);
    assert.equal(result.stderr, "", `${kind}: ${name} stderr`);
    return { name, status: result.status, stdout: result.stdout, stderr: result.stderr };
  });
}

function inkBounds(png) {
  const bounds = { left: png.width, top: png.height, right: -1, bottom: -1, pixels: 0 };
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      if (png.data[offset] >= 245 && png.data[offset + 1] >= 245 && png.data[offset + 2] >= 245) continue;
      bounds.left = Math.min(bounds.left, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.right = Math.max(bounds.right, x);
      bounds.bottom = Math.max(bounds.bottom, y);
      bounds.pixels += 1;
    }
  }
  assert.ok(bounds.pixels > 0, "rendered page has no ink");
  return bounds;
}

function cropInkHash(png, centerX, baselineY) {
  const left = Math.max(0, Math.floor(centerX - 8));
  const right = Math.min(png.width, Math.ceil(centerX + 92));
  const top = Math.max(0, Math.floor(png.height - baselineY * 2 - 60));
  const bottom = Math.min(png.height, Math.ceil(png.height - baselineY * 2 + 10));
  const bits = [];
  let ink = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * png.width + x) * 4;
      const dark = png.data[offset] < 200 || png.data[offset + 1] < 200 || png.data[offset + 2] < 200;
      bits.push(dark ? 1 : 0);
      if (dark) ink += 1;
    }
  }
  assert.ok(ink > 20, "expected glyph ink in Ghostscript crop");
  return createHash("sha256").update(Uint8Array.from(bits)).digest("hex");
}

async function pdfJsText(bytes) {
  const task = pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, isEvalSupported: false });
  const document = await task.promise;
  const text = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    text.push((await page.getTextContent()).items.map((item) => item.str).join(""));
    page.cleanup();
  }
  await task.destroy();
  return text.join("\n");
}

function exactArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
