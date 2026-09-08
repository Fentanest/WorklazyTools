import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import pngjs from "pngjs";

const { PNG } = pngjs;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "tests/fixtures/pdf-raster-benchmark");
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_COUNTS = [1, 4, 16];
const TYPES = ["blank", "text-vector", "photo-scan", "transparency"];
const FIXED_DATE = new Date("2026-09-09T00:00:00.000Z");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function photoPng() {
  const width = 1024;
  const height = 1448;
  const png = new PNG({ width, height, colorType: 6 });
  const noise = random(0x574c5437);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4;
    const wave = Math.sin(x / 31) * 28 + Math.cos(y / 47) * 24;
    const grain = (noise() - 0.5) * 72;
    const sky = y < height * 0.48;
    png.data[offset] = Math.max(0, Math.min(255, (sky ? 92 + y * 0.045 : 74 + y * 0.07) + wave + grain));
    png.data[offset + 1] = Math.max(0, Math.min(255, (sky ? 132 + y * 0.035 : 92 + y * 0.06) + wave * 0.65 + grain));
    png.data[offset + 2] = Math.max(0, Math.min(255, (sky ? 176 + y * 0.025 : 66 + y * 0.035) + wave * 0.35 + grain));
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
}

function transparencyPng() {
  const width = 640;
  const height = 640;
  const png = new PNG({ width, height, colorType: 6 });
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4;
    const dx = x - width / 2;
    const dy = y - height / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    png.data[offset] = (x * 3 + y) % 256;
    png.data[offset + 1] = (x + y * 2) % 256;
    png.data[offset + 2] = (255 - x + y) % 256;
    png.data[offset + 3] = Math.max(0, Math.min(230, Math.round(230 - distance * 0.55)));
  }
  return PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
}

function stabilize(document, type, pageCount) {
  document.setTitle(`Worklazy raster benchmark ${type} ${pageCount}`);
  document.setAuthor("Worklazy Tools");
  document.setCreator("Worklazy Tools fixture generator");
  document.setProducer("Worklazy Tools fixture generator");
  document.setCreationDate(FIXED_DATE);
  document.setModificationDate(FIXED_DATE);
}

async function fixture(type, pageCount, assets) {
  const document = await PDFDocument.create();
  stabilize(document, type, pageCount);
  const font = type === "text-vector" ? await document.embedFont(StandardFonts.Helvetica) : undefined;
  const photo = type === "photo-scan" ? await document.embedPng(assets.photo) : undefined;
  const transparent = type === "transparency" ? await document.embedPng(assets.transparency) : undefined;
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (type === "text-vector") {
      page.drawText("xxxxxxxxxx", { x: 72, y: 720, size: 8, font, color: rgb(0, 0, 0) });
      page.drawRectangle({ x: 60, y: 694, width: 170, height: 1, color: rgb(0.1, 0.25, 0.7) });
      page.drawRectangle({ x: 60, y: 650, width: 230, height: 24, borderWidth: 1, borderColor: rgb(0.2, 0.2, 0.2), color: rgb(0.93, 0.95, 1) });
      for (let line = 0; line < 28; line += 1) {
        page.drawText(`Vector text line ${String(line + 1).padStart(2, "0")} / page ${index + 1}`, {
          x: 72,
          y: 620 - line * 18,
          size: line % 4 === 0 ? 11 : 9,
          font,
          color: rgb(0.08, 0.08, 0.1),
        });
      }
    } else if (photo) {
      page.drawImage(photo, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    } else if (transparent) {
      page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: 42, y: 80, width: 510, height: 690, color: rgb(0.1, 0.3, 0.85), opacity: 0.25 });
      page.drawRectangle({ x: 105, y: 150, width: 390, height: 520, color: rgb(0.9, 0.2, 0.25), opacity: 0.36 });
      page.drawImage(transparent, { x: 80, y: 180, width: 435, height: 435, opacity: 0.7 });
    }
  }
  return document.save({ useObjectStreams: false, updateFieldAppearances: false });
}

async function generate() {
  const assets = { photo: photoPng(), transparency: transparencyPng() };
  const first = [];
  const second = [];
  for (const type of TYPES) for (const pageCount of PAGE_COUNTS) {
    first.push({ type, pageCount, bytes: await fixture(type, pageCount, assets) });
    second.push({ type, pageCount, bytes: await fixture(type, pageCount, assets) });
  }
  assert.deepEqual(first.map(({ bytes }) => sha256(bytes)), second.map(({ bytes }) => sha256(bytes)), "raster fixtures must be deterministic");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const files = [];
  for (const entry of first) {
    const name = `${entry.type}-${entry.pageCount}.pdf`;
    fs.writeFileSync(path.join(outputDirectory, name), entry.bytes);
    files.push({ type: entry.type, pageCount: entry.pageCount, file: name, bytes: entry.bytes.byteLength, sha256: sha256(entry.bytes) });
  }
  const manifest = {
    schemaVersion: 1,
    generatedAt: FIXED_DATE.toISOString(),
    page: { widthPoints: PAGE_WIDTH, heightPoints: PAGE_HEIGHT, background: "#FFFFFF" },
    photo: { width: 1024, height: 1448, seed: "0x574c5437", sourceSha256: sha256(assets.photo) },
    transparency: { width: 640, height: 640, sourceSha256: sha256(assets.transparency) },
    readability: {
      text: "xxxxxxxxxx",
      font: "Helvetica",
      fontSizePoints: 8,
      baseline: { x: 72, y: 720 },
      inkThreshold: 127,
      roiPointsFromTop: { x: 68, y: 112, width: 58, height: 18 },
      minimumInkHeightFormula: "floor(DPI * 0.057)",
    },
    files,
  };
  fs.writeFileSync(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${files.length} deterministic raster benchmark fixtures in ${path.relative(repositoryRoot, outputDirectory)}.`);
}

await generate();
