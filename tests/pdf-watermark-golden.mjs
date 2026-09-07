import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import { PNG } from "pngjs";

import { finishPdfFiles, preflightPdfFiles, PdfFinishEngineError } from "../src/features/pdf-editor/finish/engine.ts";
import { createPageSelection } from "../src/features/pdf-editor/finish/selection.ts";

const execFileAsync = promisify(execFile);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const artifactDirectory = path.resolve(process.env.PDF_WATERMARK_ARTIFACTS || "/tmp/worklazy-u4-4/golden");
await fs.mkdir(artifactDirectory, { recursive: true });

const selection = (totalPages) => {
  const result = createPageSelection(totalPages, `1-${totalPages}`, "all", { startPage: 1, excludeCover: false });
  assert.ok(!("error" in result));
  return result;
};

const png = new PNG({ width: 100, height: 50 });
for (let index = 0; index < png.data.length; index += 4) {
  png.data[index] = 210;
  png.data[index + 1] = 25;
  png.data[index + 2] = 45;
  png.data[index + 3] = 255;
}
const watermarkImage = new File([PNG.sync.write(png)], "golden-watermark.png", { type: "image/png" });

const options = (layer, pattern) => ({
  template: "WATERMARK",
  region: "center",
  fontSize: 24,
  color: "#d2192d",
  margin: 0,
  startNumber: 1,
  startPage: 1,
  excludeCover: false,
  watermark: {
    content: "image",
    image: watermarkImage,
    layer,
    pattern,
    region: "center",
    rotation: -28,
    opacity: 1,
    sizePercent: 70,
    gap: 16,
    offsetX: 8,
    offsetY: 8,
  },
});

await verifyContentStreamFixtures();
await verifyContentStreamPixelMatrix();
const cropFixture = await createRotatedCropFixture();
const metrics = {};
for (const layer of ["background", "foreground"]) {
  for (const pattern of ["single", "tile"]) {
    const id = `${layer}-${pattern}`;
    const [output] = await finishPdfFiles({
      files: [{ key: id, file: cropFixture, selection: selection(4) }],
      options: options(layer, pattern),
      locale: "en-US",
    });
    const pdfPath = path.join(artifactDirectory, `${id}.pdf`);
    await fs.writeFile(pdfPath, Buffer.from(output.buffer));
    metrics[id] = {
      pdfjs: await renderPdfJs(output.buffer, id),
      poppler: await renderPoppler(pdfPath, id),
    };
  }
}

for (const renderer of ["pdfjs", "poppler"]) {
  for (const pattern of ["single", "tile"]) {
    const background = metrics[`background-${pattern}`][renderer];
    const foreground = metrics[`foreground-${pattern}`][renderer];
    assert.equal(background.length, 4);
    assert.equal(foreground.length, 4);
    for (let page = 0; page < 4; page += 1) {
      assert.ok(background[page].red > 0 && foreground[page].red > 0, `${renderer}/${pattern}/rotation-${page * 90} lost the watermark`);
      assert.ok(background[page].blue > foreground[page].blue + 500, `${renderer}/${pattern}/rotation-${page * 90} did not preserve background ordering`);
      assert.ok(foreground[page].red > background[page].red + 500, `${renderer}/${pattern}/rotation-${page * 90} did not preserve foreground ordering`);
      assert.deepEqual(
        [background[page].width, background[page].height],
        [foreground[page].width, foreground[page].height],
        `${renderer}/${pattern}/rotation-${page * 90} changed the CropBox viewport`,
      );
    }
  }
}

const stableMetrics = Object.fromEntries(Object.entries(metrics).map(([id, renderers]) => [id,
  Object.fromEntries(Object.entries(renderers).map(([renderer, pages]) => [renderer,
    pages.map(({ width, height, red, blue }) => ({ width, height, red, blue })),
  ])),
]));
const expectedMetrics = JSON.parse(await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-watermark-golden.json"), "utf8"));
assert.deepEqual(stableMetrics, expectedMetrics, "PDF.js or Poppler watermark pixels changed from the reviewed golden metrics");
await fs.writeFile(path.join(artifactDirectory, "metrics.json"), `${JSON.stringify(stableMetrics, null, 2)}\n`);
console.log(`PDF watermark golden passed: 4 /Contents fixtures and 128 PDF.js/Poppler layer, tile, CropBox, and rotation renders. Artifacts: ${artifactDirectory}`);

async function verifyContentStreamFixtures() {
  const directory = path.join(repositoryRoot, "tests/fixtures/pdf-finish/background");
  for (const name of ["empty-contents.pdf", "single-stream.pdf", "multiple-streams.pdf"]) {
    const bytes = await fs.readFile(path.join(directory, name));
    for (const layer of ["background", "foreground"]) {
      for (const pattern of ["single", "tile"]) {
        const file = new File([bytes], name, { type: "application/pdf" });
        const outputs = await finishPdfFiles({ files: [{ key: name, file, selection: selection(1) }], options: options(layer, pattern), locale: "en-US" });
        assert.equal(outputs.length, 1, `${name}/${layer}/${pattern} produced no result`);
        const reopened = await PDFDocument.load(outputs[0].buffer, { updateMetadata: false });
        assert.equal(reopened.getPageCount(), 1, `${name}/${layer}/${pattern} did not reopen`);
      }
    }
  }
  const malformedBytes = await fs.readFile(path.join(directory, "malformed-contents-type.pdf"));
  const malformed = new File([malformedBytes], "malformed-contents-type.pdf", { type: "application/pdf" });
  const input = { files: [{ key: "malformed", file: malformed, selection: selection(1) }], options: options("background", "single"), locale: "en-US" };
  const preflight = await preflightPdfFiles(input);
  assert.equal(preflight.errors[0]?.code, "background-placement");
  await assert.rejects(finishPdfFiles(input), (error) => error instanceof PdfFinishEngineError && error.code === "background-placement");
}

async function verifyContentStreamPixelMatrix() {
  const directory = path.join(repositoryRoot, "tests/fixtures/pdf-finish/background");
  for (const fixtureName of ["empty-contents.pdf", "single-stream.pdf", "multiple-streams.pdf"]) {
    const original = await fs.readFile(path.join(directory, fixtureName));
    for (const rotation of [0, 90, 180, 270]) {
      const source = await PDFDocument.load(original, { updateMetadata: false });
      source.getPage(0).setCropBox(10, 15, 180, 170);
      source.getPage(0).setRotation(degrees(rotation));
      const file = new File([await source.save()], `${fixtureName}-${rotation}.pdf`, { type: "application/pdf" });
      for (const pattern of ["single", "tile"]) {
        const pair = {};
        for (const layer of ["background", "foreground"]) {
          const id = `contents-${fixtureName.replace(/\.pdf$/u, "")}-${rotation}-${pattern}-${layer}`;
          const [output] = await finishPdfFiles({ files: [{ key: id, file, selection: selection(1) }], options: options(layer, pattern), locale: "en-US" });
          const pdfPath = path.join(artifactDirectory, `${id}.pdf`);
          await fs.writeFile(pdfPath, Buffer.from(output.buffer));
          pair[layer] = {
            pdfjs: (await renderPdfJs(output.buffer, id))[0],
            poppler: (await renderPoppler(pdfPath, id, 1))[0],
          };
        }
        for (const renderer of ["pdfjs", "poppler"]) {
          const background = pair.background[renderer];
          const foreground = pair.foreground[renderer];
          assert.ok(background.red > 0 && foreground.red > 0, `${fixtureName}/${rotation}/${pattern}/${renderer} lost the watermark`);
          assert.deepEqual([background.width, background.height], rotation % 180 === 0 ? [180, 170] : [170, 180]);
          assert.deepEqual([foreground.width, foreground.height], [background.width, background.height]);
          if (fixtureName !== "empty-contents.pdf") {
            assert.ok(background.blue >= foreground.blue, `${fixtureName}/${rotation}/${pattern}/${renderer} reversed background ordering`);
            assert.ok(foreground.red >= background.red, `${fixtureName}/${rotation}/${pattern}/${renderer} reversed foreground ordering`);
          }
        }
      }
    }
  }
}

async function createRotatedCropFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  for (const rotation of [0, 90, 180, 270]) {
    const page = document.addPage([240, 220]);
    page.setCropBox(20, 20, 200, 180);
    page.setRotation(degrees(rotation));
    page.drawRectangle({ x: 55, y: 50, width: 130, height: 120, color: rgb(0.04, 0.08, 0.88) });
  }
  return new File([await document.save()], "rotated-crop.pdf", { type: "application/pdf" });
}

async function renderPdfJs(buffer, id) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  try {
    const document = await task.promise;
    const results = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const output = canvas.toBuffer("image/png");
      await fs.writeFile(path.join(artifactDirectory, `${id}-pdfjs-${pageNumber}.png`), output);
      results.push(pixelMetrics(PNG.sync.read(output)));
    }
    return results;
  } finally {
    await task.destroy();
  }
}

async function renderPoppler(pdfPath, id, pages = 4) {
  const prefix = path.join(artifactDirectory, `${id}-poppler`);
  await execFileAsync("pdftoppm", ["-cropbox", "-r", "72", "-png", pdfPath, prefix]);
  const results = [];
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const image = PNG.sync.read(await fs.readFile(`${prefix}-${pageNumber}.png`));
    results.push(pixelMetrics(image));
  }
  return results;
}

function pixelMetrics(image) {
  let red = 0;
  let blue = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const [r, g, b] = image.data.subarray(index, index + 3);
    if (r > 165 && g < 100 && b < 110) red += 1;
    if (b > 165 && r < 100 && g < 110) blue += 1;
  }
  return { width: image.width, height: image.height, red, blue };
}
