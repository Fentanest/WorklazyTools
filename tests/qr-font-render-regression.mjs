import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import { PNG } from "pngjs";
import QRCode from "qrcode";

import coverageInput from "../scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/coverage.json" with { type: "json" };
import { createQrLabelPdf } from "../src/features/qr-studio/qrLabelPdf.ts";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = process.env.QR_FONT_RENDER_OUTPUT || "/tmp/worklazy-qr-font-render";
const fullFontPath = path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf");
const subsetFontPath = path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf");
const pdfjs = await import(pathToFileURL(path.join(repositoryRoot, "node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const fullFont = await fs.readFile(fullFontPath);
const subsetFont = await fs.readFile(subsetFontPath);
assert.equal(fullFont.length, 4_644_748);
assert.equal(subsetFont.length, 931_704);
const fullCharacterSet = new Set(fontkit.create(fullFont).characterSet);
const ksX1001 = new Set();
const decoder = new TextDecoder("euc-kr", { fatal: true });
for (let lead = 0xb0; lead < 0xc9; lead += 1) {
  for (let trail = 0xa1; trail < 0xff; trail += 1) {
    ksX1001.add(decoder.decode(Uint8Array.of(lead, trail)).codePointAt(0));
  }
}
assert.equal(ksX1001.size, 2_350);
const ranges = [
  [0x20, 0x7e], [0xa0, 0xff], [0x1100, 0x11ff], [0x2000, 0x206f],
  [0x20a0, 0x20cf], [0x3000, 0x303f], [0x3131, 0x318e], [0xff01, 0xff60],
  [0xffe0, 0xffe6],
];
const requested = new Set(ksX1001);
for (const [start, end] of ranges) {
  for (let codepoint = start; codepoint <= end; codepoint += 1) requested.add(codepoint);
}
const inventory = [...requested].filter((codepoint) => fullCharacterSet.has(codepoint)).sort((a, b) => a - b);
const expanded = [...coverageInput.codepoints];
assert.equal(inventory.length, 3_095);
assert.equal(expanded.length, 3_394);

const png = new Blob([await QRCode.toBuffer("https://worklazy.net/ko/tools/qr-studio/bulk", {
  width: 320,
  margin: 4,
})]);
const sample = [
  ["김민수 서울 강남구 테헤란로 123", "한글 라벨 주소 품목 설명"],
  ["가나다라마바사아자차카타파하", "상품 A-01 수량 10 가격 ₩12,000"],
  ["ＡＢＣ１２３ （주） 테스트", "「안내」 · ₩ € $ % … — “배송”"],
  ["office ffi fi fl AV To 0123", "é café Ångström München"],
  ["ㄱㄴㄷ 가 한", "가 각 간 한 글"],
  ["  가\t나\n다\u00a0라  ", " 줄바꿈\r\n 탭\t정리 "],
  ["아주 긴 한글 제목 반복 ".repeat(6), "설명 줄바꿈과 말줄임표 검증 ".repeat(10)],
  ["", ""],
];
const grid = (codepoints) => Array.from(
  { length: Math.ceil(codepoints.length / 20) },
  (_, index) => ({
    png,
    title: codepoints.slice(index * 20, index * 20 + 20).map((codepoint) => String.fromCodePoint(codepoint)).join(""),
    description: `inventory ${index}`,
  }),
);
const fixtures = {
  sample: {
    preset: "a4",
    entries: Array.from({ length: 25 }, (_, index) => ({
      png,
      title: sample[index % sample.length][0],
      description: sample[index % sample.length][1],
    })),
    expectedPages: 2,
  },
  inventory: { preset: "a4", entries: grid(inventory), expectedPages: 7 },
  expanded: { preset: "letter", entries: grid(expanded), expectedPages: 8 },
};

const results = [];
for (const [fixture, { entries, preset, expectedPages }] of Object.entries(fixtures)) {
  const records = [];
  for (const [kind, bytes] of [["full", fullFont], ["subset", subsetFont]]) {
    const blob = await createQrLabelPdf(entries, preset, exactArrayBuffer(bytes));
    const data = new Uint8Array(await blob.arrayBuffer());
    const prefix = path.join(outputRoot, `${fixture}-${kind}`);
    await fs.writeFile(`${prefix}.pdf`, data);
    const loadingTask = pdfjs.getDocument({
      data: data.slice(),
      disableFontFace: true,
      isEvalSupported: false,
    });
    const document = await loadingTask.promise;
    assert.equal(document.numPages, expectedPages, `${fixture}/${kind} page count`);
    const texts = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      texts.push((await page.getTextContent()).items.map((item) => item.str));
      page.cleanup();
    }
    await fs.writeFile(`${prefix}.text.json`, `${JSON.stringify(texts)}\n`);
    records.push({ kind, bytes: data.length, pages: document.numPages, texts });
    await loadingTask.destroy();
    execFileSync("pdftoppm", ["-r", "144", "-png", `${prefix}.pdf`, prefix]);
  }

  let pixels = 0;
  let changedPixels = 0;
  for (let pageNumber = 1; pageNumber <= expectedPages; pageNumber += 1) {
    const full = PNG.sync.read(await fs.readFile(path.join(outputRoot, `${fixture}-full-${pageNumber}.png`)));
    const subset = PNG.sync.read(await fs.readFile(path.join(outputRoot, `${fixture}-subset-${pageNumber}.png`)));
    assert.equal(subset.width, full.width, `${fixture} page ${pageNumber} width`);
    assert.equal(subset.height, full.height, `${fixture} page ${pageNumber} height`);
    for (let offset = 0; offset < full.data.length; offset += 4) {
      pixels += 1;
      if (
        full.data[offset] !== subset.data[offset]
        || full.data[offset + 1] !== subset.data[offset + 1]
        || full.data[offset + 2] !== subset.data[offset + 2]
        || full.data[offset + 3] !== subset.data[offset + 3]
      ) changedPixels += 1;
    }
  }
  const textEqual = JSON.stringify(records[0].texts) === JSON.stringify(records[1].texts);
  const result = {
    fixture,
    preset,
    entries: entries.length,
    pages: expectedPages,
    fullPdfBytes: records[0].bytes,
    subsetPdfBytes: records[1].bytes,
    pixels,
    changedPixels,
    pdfJsTextEqual: textEqual,
  };
  console.log(JSON.stringify(result));
  assert.equal(changedPixels, 0, `${fixture} Poppler pixels changed`);
  assert.equal(textEqual, true, `${fixture} PDF.js extraction changed`);
  results.push(result);
}

await fs.writeFile(path.join(outputRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`QR font render regression passed: ${results.length} fixtures, Poppler changed pixels 0, PDF.js extraction identical.`);

function exactArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
