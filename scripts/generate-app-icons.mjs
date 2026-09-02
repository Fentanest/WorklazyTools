import fs from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import puppeteer from "puppeteer-core";

const sourcePath = path.resolve("public/icon.svg");
const outputDirectory = path.resolve("public");
const sourceSvg = await fs.readFile(sourcePath, "utf8");
const fullBleedSvg = withFullBleedBackground(sourceSvg);
const sourceForegroundWidth = 392 - 112;
const maskableForegroundScale = (512 * 0.66) / sourceForegroundWidth;
const maskableSvg = withScaledForeground(fullBleedSvg, maskableForegroundScale);
const variants = [
  { name: "icon-180.png", size: 180, svg: fullBleedSvg },
  { name: "icon-192.png", size: 192, svg: sourceSvg },
  { name: "icon-512.png", size: 512, svg: sourceSvg },
  { name: "icon-maskable-192.png", size: 192, svg: maskableSvg },
  { name: "icon-maskable-512.png", size: 512, svg: maskableSvg },
];

const browser = await puppeteer.launch({
  executablePath: await findBrowser(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  for (const variant of variants) {
    await page.setViewport({ width: variant.size, height: variant.size, deviceScaleFactor: 1 });
    await page.setContent(renderDocument(variant.svg), { waitUntil: "load" });
    await page.waitForFunction(() => {
      const image = document.querySelector("img");
      return image?.complete && image.naturalWidth > 0;
    });
    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: variant.size, height: variant.size },
    });
    const rgba = await readRgbaPixels(page, screenshot, variant.size);
    await fs.writeFile(path.join(outputDirectory, variant.name), encodeRgbaPng(variant.size, variant.size, rgba));
  }
} finally {
  await browser.close();
}

console.log(`Generated ${variants.length} app icons in ${outputDirectory}`);

function withFullBleedBackground(svg) {
  const roundedBackground = `  <use href="#bg-square" fill="#09090D" />
  <rect x="1" y="1" width="510" height="510" rx="127" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="2" />`;
  if (!svg.includes(roundedBackground)) {
    throw new Error("The expected rounded icon background was not found in public/icon.svg.");
  }
  return svg.replace(roundedBackground, `  <rect width="512" height="512" fill="#09090D" />`);
}

function withScaledForeground(svg, scale) {
  const foreground = `  <g filter="url(#subtle-shadow)">`;
  if (!svg.includes(foreground)) {
    throw new Error("The expected icon foreground was not found in public/icon.svg.");
  }
  const offset = 256 * (1 - scale);
  return svg.replace(
    foreground,
    `  <g transform="translate(${offset} ${offset}) scale(${scale})" filter="url(#subtle-shadow)">`,
  );
}

function renderDocument(svg) {
  const source = Buffer.from(svg).toString("base64");
  return `<!doctype html>
<html>
  <head>
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
      img { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body><img src="data:image/svg+xml;base64,${source}" alt=""></body>
</html>`;
}

async function readRgbaPixels(page, png, size) {
  const source = Buffer.from(png).toString("base64");
  await page.setContent(`<!doctype html><img src="data:image/png;base64,${source}" alt="">`, { waitUntil: "load" });
  const pixels = await page.evaluate((canvasSize) => {
    const image = document.querySelector("img");
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.getContext("2d").drawImage(image, 0, 0);
    const rgba = canvas.getContext("2d").getImageData(0, 0, canvasSize, canvasSize).data;
    let binary = "";
    for (let offset = 0; offset < rgba.length; offset += 32_768) {
      binary += String.fromCharCode(...rgba.subarray(offset, offset + 32_768));
    }
    return btoa(binary);
  }, size);
  return Buffer.from(pixels, "base64");
}

function encodeRgbaPng(width, height, rgba) {
  const rowLength = width * 4;
  const scanlines = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (rowLength + 1);
    scanlines[targetOffset] = 0;
    rgba.copy(scanlines, targetOffset + 1, y * rowLength, (y + 1) * rowLength);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return chunk;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function findBrowser() {
  const candidates = [
    process.env.WORKLAZY_CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next common browser path.
    }
  }
  throw new Error("A Chromium or Chrome executable is required. Set WORKLAZY_CHROME_PATH and try again.");
}
