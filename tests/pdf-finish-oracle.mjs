import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { classifyOcgPreflight } from "./helpers/pdf-finish-ocg-preflight.mjs";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, "..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "pdf-finish");
const manifest = JSON.parse(await fs.readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const { PDFArray, PDFDict, PDFDocument, PDFName } = require("pdf-lib");
const nodePdfjs = await import(pathToFileURL(path.join(repositoryRoot, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs")).href);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const outputPath = process.env.PDF_FINISH_ORACLE_OUTPUT || path.join(os.tmpdir(), "worklazy-u4-0", "pdf-finish-oracle.json");
const chromeExecutable = process.env.CHROME_BIN || "/usr/bin/google-chrome";

function commandVersion(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout}`);
  return `${result.stdout}${result.stderr}`.trim().split("\n")[0];
}

async function startPdfjsServer() {
  const buildDirectory = path.join(repositoryRoot, "node_modules", "pdfjs-dist", "build");
  const files = new Map([
    ["/pdf.mjs", { path: path.join(buildDirectory, "pdf.mjs"), type: "text/javascript" }],
    ["/pdf.worker.mjs", { path: path.join(buildDirectory, "pdf.worker.mjs"), type: "text/javascript" }],
  ]);
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === "/") {
        response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
        response.end("<!doctype html><meta charset=utf-8><canvas id=surface></canvas>");
        return;
      }
      const entry = files.get(request.url);
      if (!entry) { response.writeHead(404); response.end("not found"); return; }
      response.writeHead(200, { "Content-Type": entry.type, "Cache-Control": "no-store" });
      response.end(await fs.readFile(entry.path));
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function popplerRender(pdfPath, temporaryDirectory) {
  const prefix = path.join(temporaryDirectory, "page");
  const result = spawnSync("pdftoppm", ["-r", "72", "-png", pdfPath, prefix], { encoding: "utf8" });
  assert.equal(result.status, 0, `${pdfPath}: ${result.stderr}`);
  return result;
}

async function readPopplerPages(temporaryDirectory) {
  const names = (await fs.readdir(temporaryDirectory)).filter((name) => /^page-\d+\.png$/.test(name)).sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
  return Promise.all(names.map(async (name, index) => {
    const image = PNG.sync.read(await fs.readFile(path.join(temporaryDirectory, name)));
    return { page: index + 1, width: image.width, height: image.height, sha256: sha256(image.data) };
  }));
}

async function browserRender(page, bytes) {
  return page.evaluate(async (base64) => {
    const binary = atob(base64);
    const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const task = globalThis.pdfjsLib.getDocument({ data, useSystemFonts: true });
    const document = await task.promise;
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const pdfPage = await document.getPage(pageNumber);
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
          sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
        });
        pdfPage.cleanup();
      }
      return pages;
    } finally {
      await task.destroy();
    }
  }, bytes.toString("base64"));
}

function normalizeExpectedAttempt(attempt) {
  return attempt.result === "OPEN"
    ? { result: "OPEN", permissions: attempt.permissions }
    : { result: attempt.result, code: attempt.code };
}

async function encryptedAttempt(bytes, password, omitted) {
  const options = { data: Uint8Array.from(bytes), useSystemFonts: true };
  if (!omitted) options.password = password;
  const task = nodePdfjs.getDocument(options);
  try {
    const document = await task.promise;
    return { result: "OPEN", permissions: await document.getPermissions() };
  } catch (error) {
    return { result: error.name, code: error.code };
  } finally {
    await task.destroy();
  }
}

async function verifyFixtureContracts() {
  const encryption = [];
  for (const fixture of manifest.fixtures.filter(({ category }) => category === "encrypted")) {
    const bytes = await fs.readFile(path.join(fixtureRoot, fixture.file));
    const correctPassword = fixture.expectation.variant === "open" ? manifest.passwords.user : "";
    const inputs = {
      omitted: [undefined, true],
      empty: ["", false],
      wrong: [manifest.passwords.wrong, false],
      correct: [correctPassword, false],
      owner: [manifest.passwords.owner, false],
    };
    const attempts = {};
    for (const [name, [password, omitted]] of Object.entries(inputs)) {
      attempts[name] = await encryptedAttempt(bytes, password, omitted);
      assert.deepEqual(attempts[name], normalizeExpectedAttempt(fixture.expectation.attempts[name]), `${fixture.file}:${name}`);
    }
    for (const attempt of Object.values(attempts).filter(({ result }) => result === "OPEN")) assert.notEqual(attempt.permissions, null, `${fixture.file}: finish must reject non-null permissions`);
    const poppler = spawnSync("pdftotext", ["-upw", correctPassword, path.join(fixtureRoot, fixture.file), "-"], { encoding: "utf8" });
    assert.equal(poppler.status, 0, `${fixture.file}: ${poppler.stderr}`);
    assert.ok(poppler.stdout.includes(fixture.expectation.expectedText), `${fixture.file}: Poppler text mismatch`);
    encryption.push({ file: fixture.file, attempts, popplerText: poppler.stdout.trim(), finishAcceptance: fixture.expectation.finishAcceptance });
  }

  const damage = [];
  for (const fixture of manifest.fixtures.filter(({ category }) => category === "damage")) {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...values) => warnings.push(values.join(" "));
    const task = nodePdfjs.getDocument({ data: Uint8Array.from(await fs.readFile(path.join(fixtureRoot, fixture.file))), useSystemFonts: true });
    try {
      const document = await task.promise;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) await (await document.getPage(pageNumber)).getOperatorList();
      assert.equal(fixture.expectation.pdfjs, "OPEN", fixture.file);
      assert.equal(document.numPages, fixture.expectation.pages, fixture.file);
      if (fixture.expectation.warningIncludes) assert.ok(warnings.some((warning) => warning.includes(fixture.expectation.warningIncludes)), `${fixture.file}: ${warnings.join(" | ")}`);
      damage.push({ file: fixture.file, result: "OPEN", pages: document.numPages, warnings });
    } catch (error) {
      assert.equal(error.name, fixture.expectation.pdfjs, fixture.file);
      damage.push({ file: fixture.file, result: error.name, warnings });
    } finally {
      console.warn = originalWarn;
      await task.destroy();
    }
  }

  for (const fixture of manifest.fixtures.filter(({ category }) => ["background", "risk"].includes(category))) {
    const task = nodePdfjs.getDocument({ data: Uint8Array.from(await fs.readFile(path.join(fixtureRoot, fixture.file))), useSystemFonts: true });
    try {
      const document = await task.promise;
      assert.ok(document.numPages > 0, fixture.file);
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) await (await document.getPage(pageNumber)).getOperatorList();
    } finally {
      await task.destroy();
    }
  }

  const removalFixture = manifest.fixtures.find(({ category }) => category === "removal");
  const removalBytes = await fs.readFile(path.join(fixtureRoot, removalFixture.file));
  const removalDocument = await PDFDocument.load(removalBytes, { updateMetadata: false });
  for (const catalogKey of removalFixture.expectation.catalogKeys) assert.ok(removalDocument.catalog.has(PDFName.of(catalogKey)), catalogKey);
  assert.ok(removalBytes.includes(Buffer.from(removalFixture.expectation.embeddedSentinel)), "embedded attachment sentinel");
  assert.ok(removalBytes.includes(Buffer.from(removalFixture.expectation.xmpSentinel)), "XMP sentinel");
  const annotationArray = removalDocument.context.lookup(removalDocument.getPage(0).node.get(PDFName.of("Annots")), PDFArray);
  const annotationSubtypes = annotationArray.asArray().map((reference) => removalDocument.context.lookup(reference, PDFDict).lookup(PDFName.of("Subtype")).decodeText());
  for (const subtype of removalFixture.expectation.annotationSubtypes) assert.ok(annotationSubtypes.includes(subtype), subtype);
  const removalTask = nodePdfjs.getDocument({ data: Uint8Array.from(removalBytes), useSystemFonts: true });
  let removal;
  try {
    const document = await removalTask.promise;
    const attachments = await document.getAttachments();
    const viewerPreferences = await document.getViewerPreferences();
    removal = {
      attachments: [...attachments.keys()],
      outlineItems: (await document.getOutline()).length,
      pageLabels: await document.getPageLabels(),
      viewerPreferences: Object.fromEntries(viewerPreferences),
      annotationSubtypes,
    };
    assert.deepEqual(removal.attachments, ["fixture.txt"]);
    assert.equal(removal.outlineItems, 1);
    assert.deepEqual(removal.pageLabels, ["i", "A-1"]);
  } finally {
    await removalTask.destroy();
  }
  return { encryption, damage, removal };
}

assert.equal(manifest.counts.ocg.pixelOracle, 56);
await fs.access(chromeExecutable);
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-pdf-finish-oracle-"));
const { server, origin } = await startPdfjsServer();
const browser = await chromium.launch({ executablePath: chromeExecutable, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const externalRequests = [];
page.on("request", (request) => { if (!request.url().startsWith(origin)) externalRequests.push(request.url()); });
const browserConsole = [];
page.on("console", (message) => browserConsole.push({ type: message.type(), text: message.text() }));
const result = {
  schemaVersion: 1,
  environment: {
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    chrome: await browser.version(),
    poppler: commandVersion("pdftoppm", ["-v"]),
    pdfjs: require("pdfjs-dist/package.json").version,
    pixelFormat: "unpremultiplied RGBA, SHA-256, white canvas background, 72 dpi/scale 1",
  },
  ocg: [],
  fixtureContracts: undefined,
  externalRequests,
  browserConsole,
};

try {
  await page.goto(origin, { waitUntil: "load" });
  await page.evaluate(async () => {
    globalThis.pdfjsLib = await import("/pdf.mjs");
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  });
  for (const fixture of manifest.ocg.files) {
    const bytes = await fs.readFile(path.join(fixtureRoot, fixture.file));
    const classification = await classifyOcgPreflight(bytes);
    assert.equal(classification.allowed, fixture.preflight.allowed, `${fixture.file}: ${classification.reason}`);
    const row = { file: fixture.file, cohort: fixture.cohort, preflight: { allowed: classification.allowed, reason: classification.reason } };
    if (fixture.pixelOracle) {
      const popplerDirectory = path.join(temporaryRoot, path.basename(fixture.file, ".pdf"));
      await fs.mkdir(popplerDirectory, { recursive: true });
      popplerRender(path.join(fixtureRoot, fixture.file), popplerDirectory);
      row.poppler = await readPopplerPages(popplerDirectory);
      row.pdfjs = await browserRender(page, bytes);
      assert.deepEqual(row.poppler, fixture.pixelOracle.poppler, `${fixture.file}: Poppler pixel oracle`);
      assert.deepEqual(row.pdfjs, fixture.pixelOracle.pdfjs, `${fixture.file}: PDF.js pixel oracle`);
    }
    result.ocg.push(row);
  }
  result.fixtureContracts = await verifyFixtureContracts();
  assert.deepEqual(externalRequests, []);
  result.summary = {
    preflightChecked: result.ocg.length,
    preflightAllowed: result.ocg.filter(({ preflight }) => preflight.allowed).length,
    preflightExcluded: result.ocg.filter(({ preflight }) => !preflight.allowed).length,
    pixelFixtures: result.ocg.filter(({ poppler }) => poppler).length,
    pixelPages: result.ocg.reduce((total, row) => total + (row.poppler?.length ?? 0), 0),
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, environment: result.environment, summary: result.summary }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
