import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, "..");
const outputDirectory = path.join(testsDirectory, "fixtures", "pdf-finish", "legacy-oracle");
const baseCommit = "5bc6854175331bdd73b267784d9633cdccda8446";
const require = createRequire(path.join(repositoryRoot, "package.json"));
const { build, transform } = require("esbuild");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const { PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream, degrees, rgb } = require("pdf-lib");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const relative = (absolute) => path.relative(outputDirectory, absolute).split(path.sep).join("/");
const clientSourcePath = path.join(repositoryRoot, "src", "features", "pdf-editor", "pdfWorkerClient.ts");
const workerSourcePath = path.join(repositoryRoot, "src", "features", "pdf-editor", "pdf.worker.ts");

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, { encoding: "utf8", ...options });
  assert.equal(result.status, 0, `${commandName}: ${result.stderr || result.stdout}`);
  return result;
}

function commandVersion(commandName, args) {
  const result = command(commandName, args);
  return `${result.stdout}${result.stderr}`.trim().split("\n")[0];
}

function sourceAtBase(relativePath) {
  return command("git", ["show", `${baseCommit}:${relativePath}`], { cwd: repositoryRoot, encoding: null }).stdout;
}

async function startPdfjsServer() {
  const buildDirectory = path.join(repositoryRoot, "node_modules", "pdfjs-dist", "build");
  const files = new Map([
    ["/pdf.mjs", path.join(buildDirectory, "pdf.mjs")],
    ["/pdf.worker.mjs", path.join(buildDirectory, "pdf.worker.mjs")],
  ]);
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === "/") {
        response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
        response.end("<!doctype html><meta charset=utf-8><canvas id=surface></canvas>");
        return;
      }
      const file = files.get(request.url);
      if (!file) { response.writeHead(404); response.end("not found"); return; }
      response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      response.end(await fs.readFile(file));
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function renderWithPdfjs(page, bytes) {
  return page.evaluate(async (base64) => {
    const binary = atob(base64);
    const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const task = globalThis.pdfjsLib.getDocument({ data, useSystemFonts: true });
    const pdfDocument = await task.promise;
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const pdfPage = await pdfDocument.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const canvas = globalThis.document.querySelector("#surface");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: true });
        await pdfPage.render({ canvasContext: context, viewport, background: "rgb(255,255,255)" }).promise;
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const digest = await crypto.subtle.digest("SHA-256", imageData.data);
        pages.push({
          page: pageNumber,
          width: canvas.width,
          height: canvas.height,
          rgbaSha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
          pngBase64: canvas.toDataURL("image/png").split(",")[1],
        });
        pdfPage.cleanup();
      }
      return pages;
    } finally {
      await task.destroy();
    }
  }, bytes.toString("base64"));
}

for (const relativePath of ["src/features/pdf-editor/pdfWorkerClient.ts", "src/features/pdf-editor/pdf.worker.ts"]) {
  assert.ok((await fs.readFile(path.join(repositoryRoot, relativePath))).equals(sourceAtBase(relativePath)), `${relativePath} differs from ${baseCommit}`);
}

await fs.rm(outputDirectory, { recursive: true, force: true });
for (const directory of ["client", "output", "structure", "render"]) await fs.mkdir(path.join(outputDirectory, directory), { recursive: true });
const temporaryDirectory = await fs.mkdtemp(path.join(path.resolve("/tmp"), "worklazy-pdf-legacy-oracle-"));
const workerBundlePath = path.join(temporaryDirectory, "worker.cjs");
const nodeModulesLink = path.join(temporaryDirectory, "node_modules");
let browser;
let pdfjsServer;
const NativeDate = Date;

try {
  const clientSource = await fs.readFile(clientSourcePath, "utf8");
  const functionStart = clientSource.indexOf("async function createWatermarkImage(");
  const functionEnd = clientSource.indexOf("\nexport async function imagesToPdf", functionStart);
  assert.ok(functionStart >= 0 && functionEnd > functionStart, "Legacy watermark function was not found.");
  const browserSource = (await transform(`${clientSource.slice(functionStart, functionEnd)}\nglobalThis.createLegacyWatermarkPng = createWatermarkImage;`, { loader: "ts", format: "iife" })).code;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.goto("data:text/html,<html><body></body></html>");
  await page.addScriptTag({ content: browserSource });
  const clientRecords = [];
  let fixedWatermark;
  for (const [name, text] of [["short", "Legacy TEST"], ["wide", "W".repeat(200)], ["surrogate", `${"W".repeat(119)}😀Z`]]) {
    const result = await page.evaluate(async (inputText) => {
      const operations = [];
      const prototype = CanvasRenderingContext2D.prototype;
      const originalMeasureText = prototype.measureText;
      const originalFillText = prototype.fillText;
      prototype.measureText = function measured(value) {
        operations.push({ operation: "measureText", utf16Units: value.length, text: value, font: this.font });
        return originalMeasureText.call(this, value);
      };
      prototype.fillText = function filled(value, x, y) {
        operations.push({ operation: "fillText", utf16Units: value.length, text: value, fillStyle: this.fillStyle, font: this.font, x, y });
        return originalFillText.call(this, value, x, y);
      };
      try {
        const bytes = new Uint8Array(await globalThis.createLegacyWatermarkPng(inputText));
        return { bytes: Array.from(bytes), operations };
      } finally {
        prototype.measureText = originalMeasureText;
        prototype.fillText = originalFillText;
      }
    }, text);
    const bytes = Buffer.from(result.bytes);
    const file = path.join(outputDirectory, "client", `${name}.png`);
    await fs.writeFile(file, bytes);
    const png = PNG.sync.read(bytes);
    let maximumAlpha = 0;
    for (let index = 3; index < png.data.length; index += 4) maximumAlpha = Math.max(maximumAlpha, png.data[index]);
    const record = { name, file: relative(file), bytes: bytes.length, sha256: sha256(bytes), width: png.width, height: png.height, maximumAlpha, operations: result.operations };
    clientRecords.push(record);
    if (name === "short") fixedWatermark = bytes;
  }
  assert.ok(fixedWatermark);
  assert.equal(clientRecords[0].width, 420);
  assert.equal(clientRecords[1].width, 1800);
  assert.ok(clientRecords.every(({ height, maximumAlpha }) => height === 92 && maximumAlpha <= 209));
  assert.equal(clientRecords[2].operations.find(({ operation }) => operation === "fillText").utf16Units, 120);
  const servedPdfjs = await startPdfjsServer();
  pdfjsServer = servedPdfjs.server;
  const externalRequests = [];
  page.on("request", (request) => { if (!request.url().startsWith(servedPdfjs.origin)) externalRequests.push(request.url()); });
  await page.goto(servedPdfjs.origin, { waitUntil: "load" });
  await page.evaluate(async () => {
    globalThis.pdfjsLib = await import("/pdf.mjs");
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  });

  await build({
    entryPoints: [workerSourcePath],
    outfile: workerBundlePath,
    bundle: true,
    format: "cjs",
    platform: "node",
    external: ["pdf-lib", "jszip"],
    logLevel: "silent",
  });
  await fs.symlink(path.join(repositoryRoot, "node_modules"), nodeModulesLink, "dir");
  const fixedTime = Date.parse("2026-09-05T03:00:00Z");
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, argumentsList, newTarget) {
      return Reflect.construct(target, argumentsList.length ? argumentsList : [fixedTime], newTarget);
    },
    get(target, property, receiver) {
      return property === "now" ? () => fixedTime : Reflect.get(target, property, receiver);
    },
  });
  require("jszip");
  const posted = [];
  globalThis.self = { postMessage(data, transfer) { posted.push({ data, transfer }); } };
  require(workerBundlePath);

  const inputDocument = await PDFDocument.create();
  const inputFont = await inputDocument.embedFont(StandardFonts.Helvetica);
  for (const [index, rotation] of [0, 90, 180, 270].entries()) {
    const pdfPage = inputDocument.addPage(index % 2 ? [800, 600] : [600, 800]);
    pdfPage.setCropBox(50, 100, index % 2 ? 600 : 400, index % 2 ? 400 : 600);
    pdfPage.setRotation(degrees(rotation));
    pdfPage.drawRectangle({ x: 70, y: 140, width: 150, height: 60, color: rgb(0.1, 0.6, 0.3) });
    pdfPage.drawText(`Original ${index + 1}`, { font: inputFont, size: 18, x: 80, y: 170 });
  }
  const inputBytes = Buffer.from(await inputDocument.save());
  const inputPath = path.join(outputDirectory, "input.pdf");
  await fs.writeFile(inputPath, inputBytes);

  async function structureOracle(bytes) {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    return {
      pages: document.getPages().map((pdfPage) => ({
        rotation: pdfPage.getRotation().angle,
        mediaBox: pdfPage.getMediaBox(),
        cropBox: pdfPage.getCropBox(),
        resources: pdfPage.node.Resources()?.toString(),
        contents: pdfPage.node.Contents()?.asArray().map((reference) => {
          const stream = document.context.lookup(reference);
          return stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1") : String(stream);
        }),
      })),
      objects: document.context.enumerateIndirectObjects().map(([reference, object]) => ({
        reference: String(reference),
        type: object.constructor.name,
        dictionary: object instanceof PDFRawStream ? object.dict.toString() : String(object),
        decodedSha256: object instanceof PDFRawStream ? sha256(decodePDFRawStream(object).decode()) : null,
      })),
    };
  }

  const modeRecords = [];
  for (const mode of ["none", "numbers", "watermark", "both"]) {
    const outputs = [];
    const structures = [];
    const popplerRuns = [];
    const pdfjsRuns = [];
    for (let run = 1; run <= 2; run += 1) {
      posted.length = 0;
      const watermarkImage = Uint8Array.from(fixedWatermark).buffer;
      await globalThis.self.onmessage({ data: {
        type: "merge",
        language: "en",
        inputs: [{ id: "source", name: "source.pdf", mimeType: "application/pdf", buffer: Uint8Array.from(inputBytes).buffer }],
        pages: [0, 1, 2, 3].map((pageIndex) => ({ sourceId: "source", pageIndex, rotation: 0 })),
        fileName: "legacy.pdf",
        options: {
          pageNumbers: ["numbers", "both"].includes(mode),
          watermarkImage: ["watermark", "both"].includes(mode) ? watermarkImage : undefined,
        },
      } });
      const terminal = posted.find(({ data }) => data.type === "result");
      assert.ok(terminal, JSON.stringify(posted));
      const bytes = Buffer.from(terminal.data.result.buffer);
      const structure = await structureOracle(bytes);
      outputs.push(bytes);
      structures.push(structure);
      const runDirectory = path.join(temporaryDirectory, `${mode}-${run}`);
      await fs.mkdir(runDirectory, { recursive: true });
      const runPdf = path.join(runDirectory, "output.pdf");
      await fs.writeFile(runPdf, bytes);
      command("pdftoppm", ["-scale-to", "650", "-png", runPdf, path.join(runDirectory, "page")]);
      const images = [];
      for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
        const imageBytes = await fs.readFile(path.join(runDirectory, `page-${pageNumber}.png`));
        const image = PNG.sync.read(imageBytes);
        images.push({ page: pageNumber, width: image.width, height: image.height, rgbaSha256: sha256(image.data), pngSha256: sha256(imageBytes), bytes: imageBytes });
      }
      popplerRuns.push(images);
      pdfjsRuns.push(await renderWithPdfjs(page, bytes));
    }
    assert.ok(outputs[0].equals(outputs[1]), `${mode}: worker bytes differ`);
    assert.deepEqual(structures[0], structures[1], `${mode}: structure differs`);
    assert.deepEqual(popplerRuns[0].map(({ rgbaSha256 }) => rgbaSha256), popplerRuns[1].map(({ rgbaSha256 }) => rgbaSha256), `${mode}: Poppler pixels differ`);
    assert.deepEqual(pdfjsRuns[0].map(({ rgbaSha256 }) => rgbaSha256), pdfjsRuns[1].map(({ rgbaSha256 }) => rgbaSha256), `${mode}: PDF.js pixels differ`);
    const outputPath = path.join(outputDirectory, "output", `${mode}.pdf`);
    const structurePath = path.join(outputDirectory, "structure", `${mode}.json`);
    await fs.writeFile(outputPath, outputs[0]);
    await fs.writeFile(structurePath, `${JSON.stringify(structures[0], null, 2)}\n`);
    const popplerRender = [];
    for (const image of popplerRuns[0]) {
      const imagePath = path.join(outputDirectory, "render", `poppler-${mode}-${image.page}.png`);
      await fs.writeFile(imagePath, image.bytes);
      popplerRender.push({ page: image.page, file: relative(imagePath), width: image.width, height: image.height, rgbaSha256: image.rgbaSha256, pngSha256: image.pngSha256 });
    }
    const pdfjsRender = [];
    for (const image of pdfjsRuns[0]) {
      const imagePath = path.join(outputDirectory, "render", `pdfjs-${mode}-${image.page}.png`);
      const imageBytes = Buffer.from(image.pngBase64, "base64");
      await fs.writeFile(imagePath, imageBytes);
      pdfjsRender.push({ page: image.page, file: relative(imagePath), width: image.width, height: image.height, rgbaSha256: image.rgbaSha256, pngSha256: sha256(imageBytes) });
    }
    modeRecords.push({
      mode,
      options: { pageNumbers: ["numbers", "both"].includes(mode), watermark: ["watermark", "both"].includes(mode) },
      output: { file: relative(outputPath), bytes: outputs[0].length, sha256: sha256(outputs[0]), secondRunSha256: sha256(outputs[1]), byteEqual: true },
      structure: { file: relative(structurePath), sha256: sha256(Buffer.from(`${JSON.stringify(structures[0], null, 2)}\n`)), secondRunEqual: true },
      render: {
        poppler: { engine: "Poppler", pages: popplerRender, secondRunChangedPixels: [0, 0, 0, 0] },
        pdfjs: { engine: "PDF.js in Chrome", pages: pdfjsRender, secondRunChangedPixels: [0, 0, 0, 0] },
      },
    });
  }

  const manifest = {
    schemaVersion: 1,
    baseCommit,
    source: {
      client: { file: "src/features/pdf-editor/pdfWorkerClient.ts", sha256: sha256(await fs.readFile(clientSourcePath)) },
      worker: { file: "src/features/pdf-editor/pdf.worker.ts", sha256: sha256(await fs.readFile(workerSourcePath)) },
    },
    input: { file: relative(inputPath), bytes: inputBytes.length, sha256: sha256(inputBytes), rotations: [0, 90, 180, 270], mixedMediaBoxes: true, nonZeroCropBoxes: true },
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      chrome: browser.version(),
      poppler: commandVersion("pdftoppm", ["-v"]),
      pdfLib: require("pdf-lib/package.json").version,
      pdfjs: require("pdfjs-dist/package.json").version,
      systemUiFont: command("fc-match", ["--format", "%{family}|%{file}", "system-ui"]).stdout,
      captureTime: "2026-09-05T03:00:00.000Z (fixed)",
      render: { popplerDpi: "default 150, overridden by -scale-to 650", pdfjsScale: 1, background: "white", pixelFormat: "unpremultiplied RGBA SHA-256" },
    },
    client: {
      contract: { width: { minimum: 420, maximum: 1800 }, height: 92, fillAlpha: 0.82, utf16SliceUnits: 120 },
      records: clientRecords,
    },
    modes: modeRecords,
    externalRequests,
    determinism: { runs: 2, byteEqualModes: 4, structureEqualModes: 4, popplerPixelDiffs: 0, pdfjsPixelDiffs: 0 },
  };
  assert.deepEqual(externalRequests, []);
  await fs.writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ outputDirectory, baseCommit, environment: manifest.environment, determinism: manifest.determinism, modes: modeRecords.map(({ mode, output }) => ({ mode, bytes: output.bytes, sha256: output.sha256 })) }, null, 2));
} finally {
  globalThis.Date = NativeDate;
  if (browser) await browser.close();
  if (pdfjsServer) await new Promise((resolve, reject) => pdfjsServer.close((error) => error ? reject(error) : resolve()));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
