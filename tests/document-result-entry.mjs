// U6 shared document-result entry helper: synthesize two DOCX pairs in memory
// (pair 1: 34 body paragraphs with 12 word-level changes, a 2x2 table with one
// changed cell, a changed header, no footnotes/endnotes/comments; pair 2 is
// byte-identical before/after), drive the real document-compare entry flow
// (file inputs -> compare -> result link), and hand back the result URLs.
// Never navigates to a result URL directly.
//
// Usage as a check: node tests/document-result-entry.mjs --out out.json
// Usage as a library:
//   import { synthesizeDocumentPair, enterDocumentResult } from "./document-result-entry.mjs";
//   const { before, after } = synthesizeDocumentPair(); // {name,mime,buffer}[]
//   const { pairUrls } = await enterDocumentResult(page, "ko", { before, after });
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CHANGED_PARAGRAPHS = new Set([3, 5, 7, 9, 12, 15, 18, 21, 24, 27, 30, 33]);

function paragraphText(index, variant) {
  const changed = CHANGED_PARAGRAPHS.has(index);
  const body = changed
    ? (variant === "before"
      ? `본문 ${index}번째 문단입니다. 기존 계약에 따라 대여금을 상환합니다.`
      : `본문 ${index}번째 문단입니다. 변경 계약에 따라 자금을 상환합니다.`)
    : `본문 ${index}번째 문단입니다. 공통 기준 문장으로 양쪽이 같습니다.`;
  return body;
}

function buildDocumentXml(variant) {
  const paragraphs = [];
  for (let index = 1; index <= 34; index += 1) {
    paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(paragraphText(index, variant))}</w:t></w:r></w:p>`);
  }
  const changedCell = variant === "before" ? "수정 전 셀" : "수정 후 셀";
  const cell = (text) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`;
  const table = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>`
    + `<w:tr>${cell("공통 셀 1")}${cell("공통 셀 2")}</w:tr>`
    + `<w:tr>${cell("공통 셀 3")}${cell(changedCell)}</w:tr></w:tbl>`;
  const headerText = variant === "before" ? "머리말 기준 문장입니다." : "머리말 변경 문장입니다.";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:body>`
    + paragraphs.join("")
    + table
    + `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>`
    + `</w:body></w:document>`;
}

function buildHeaderXml(variant) {
  const text = variant === "before" ? "머리말 기준 문장입니다." : "머리말 변경 문장입니다.";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:hdr xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:hdr>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
  + `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`
  + `</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`
  + `</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`
  + `</Relationships>`;

// Minimal stored (uncompressed) ZIP writer: enough for the worker's stdlib
// zipfile reader, no dependency, fully deterministic bytes.
export function packStoredZip(entries) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    const nameBytes = encoder.encode(name);
    const crc = crc32(bytes) >>> 0;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names for the Korean file names
    local.setUint16(8, 0, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, bytes.length, true);
    local.setUint32(22, bytes.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(Buffer.from(local.buffer), Buffer.from(nameBytes), Buffer.from(bytes));
    central.push({ nameBytes, crc, size: bytes.length, offset });
    offset += 30 + nameBytes.length + bytes.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const entry of central) {
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, 0, true);
    header.setUint16(14, 0, true);
    header.setUint32(16, entry.crc, true);
    header.setUint32(20, entry.size, true);
    header.setUint32(24, entry.size, true);
    header.setUint16(28, entry.nameBytes.length, true);
    header.setUint32(42, entry.offset, true);
    chunks.push(Buffer.from(header.buffer), Buffer.from(entry.nameBytes));
    centralSize += 46 + entry.nameBytes.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralStart, true);
  chunks.push(Buffer.from(end.buffer));
  return Buffer.concat(chunks);
}

export function synthesizeDocx(variant) {
  return packStoredZip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["word/document.xml", buildDocumentXml(variant)],
    ["word/_rels/document.xml.rels", DOCUMENT_RELS],
    ["word/header1.xml", buildHeaderXml(variant)],
  ]);
}

// Pair 1 carries the 12 body changes plus the table and header changes.
// Pair 2 is byte-identical before/after (empty-change coverage).
export function synthesizeDocumentPair() {
  const before = [
    { name: "u6-entry-1-before.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: synthesizeDocx("before") },
    { name: "u6-entry-2-before.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: synthesizeDocx("before") },
  ];
  const after = [
    { name: "u6-entry-1-after.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: synthesizeDocx("after") },
    { name: "u6-entry-2-after.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: synthesizeDocx("before") },
  ];
  return { before, after };
}

// Drives the real entry flow on a playwright Page that is already on the
// entry page: file inputs -> compare -> both pair result links. Returns both
// pair result URLs. Never navigates to a result URL directly; leaving a
// result uses the client-side back link so the in-memory session survives.
export async function runEntryFlow(page, language, files, options = {}) {
  const workerTimeout = options.workerTimeoutMs ?? 240_000;
  await page.locator("[data-document-file-column='before'] input[type='file']").waitFor({ state: "attached" });
  await page.locator("[data-document-file-column='before'] input[type='file']").setInputFiles(files.before);
  await page.locator("[data-document-file-column='after'] input[type='file']").setInputFiles(files.after);
  await page.locator("[data-testid='document-action-bar'] [data-ui-component='primary-button']").click();
  // Poll with state dumps instead of one blind wait: same 240s budget, but a
  // stall reports where the entry flow stopped.
  const pollStarted = Date.now();
  for (;;) {
    const cards = await page.locator("[data-testid='document-result-card']").count();
    if (cards === 2) break;
    const elapsed = Date.now() - pollStarted;
    if (elapsed >= 60_000 && Math.floor(elapsed / 60_000) !== Math.floor((elapsed - 10_000) / 60_000)) {
      console.log(`[entry-poll] t+${Math.round(elapsed / 1000)}s cards=${cards} ` + await page.evaluate(() => JSON.stringify({
        b: document.querySelectorAll("[data-testid='document-file-list-before'] [data-testid='document-file-item']").length,
        a: document.querySelectorAll("[data-testid='document-file-list-after'] [data-testid='document-file-item']").length,
        copy: document.querySelector("[data-testid='document-action-copy'] strong")?.textContent?.slice(0, 60) ?? "(none)",
        alert: document.querySelector("[role='alert']")?.textContent?.slice(0, 80) ?? "(none)",
      })).catch(() => "(unreadable)"));
    }
    if (elapsed > workerTimeout) {      const stuck = await page.evaluate(() => ({
        copy: document.querySelector("[data-testid='document-action-copy'] strong")?.textContent?.slice(0, 120) ?? "(none)",
        alert: document.querySelector("[role='alert']")?.textContent?.slice(0, 200) ?? "(none)",
      })).catch(() => ({ copy: "(unreadable)", alert: "(unreadable)" }));
      throw new Error(`result cards stuck at ${cards}/2 after ${workerTimeout}ms: ${JSON.stringify(stuck)}`);
    }
    await page.waitForTimeout(10_000);
  }
  const pairUrls = [];
  for (const pairNumber of [1, 2]) {
    await page.locator("[data-testid='document-view-result']").nth(pairNumber - 1).click();
    await page.waitForFunction((expected) => location.pathname.endsWith(`/tools/document-compare/results/${expected}`)
      && document.querySelector("[data-testid='document-result-view']"), pairNumber, { timeout: 30_000 });
    // Fonts, two animation frames, then the U6 3s settle.
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    await page.waitForTimeout(3000);
    pairUrls.push(page.url());
    if (pairNumber === 1) {
      // Client-side back navigation keeps the in-memory compare session (a
      // full reload would discard it and the entry would show zero cards).
      await page.locator("[data-testid='document-result-back']").click();
      await page.waitForFunction(() => !location.pathname.includes("/results/")
        && document.querySelectorAll("[data-testid='document-result-card']").length === 2, null, { timeout: 30_000 });
    }
  }
  return { pairUrls };
}

export async function enterDocumentResult(page, language, files, options = {}) {
  const baseUrl = options.baseUrl;
  if (!baseUrl) throw new Error("enterDocumentResult needs options.baseUrl.");
  await page.goto(`${baseUrl}/${language}/tools/document-compare/`, { waitUntil: "networkidle" });
  return runEntryFlow(page, language, files, options);
}

async function startDevServer(port) {
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error("Vite dev exited early.");
    try { const response = await fetch(baseUrl); if (response.ok) return { child, baseUrl }; } catch { /* starting */ }
    if (Date.now() > deadline) { child.kill("SIGTERM"); throw new Error(`Timed out waiting for ${baseUrl}.`); }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function toPlaywrightFiles(entries) {
  return entries.map((entry) => ({ name: entry.name, mimeType: entry.mimeType, buffer: entry.buffer }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const out = outIndex === -1 ? undefined : args[outIndex + 1];
  const port = Number(process.env.UI_DOCRESULT_PORT ?? "4235");
  const baseUrl = process.env.TEST_BASE_URL;
  let server;
  const passed = [];
  try {
    if (!baseUrl) server = (await startDevServer(port)).child;
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
    });
    try {
      const root = baseUrl || `http://127.0.0.1:${port}`;
      const page = await (await browser.newContext({ locale: "ko-KR" })).newPage();
      page.setDefaultTimeout(30_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const files = synthesizeDocumentPair();
      assert.equal(files.before.length, 2);
      assert.equal(files.after.length, 2);
      // Spot-check the synthetic package before driving the browser.
      assert.ok(files.before[0].buffer.length > 1024, "synthetic docx is too small");
      assert.notDeepEqual(files.before[0].buffer, files.after[0].buffer);
      assert.deepEqual(files.before[1].buffer, files.after[1].buffer);
      passed.push("synthetic pair differs in pair 1 only");
      const { pairUrls } = await enterDocumentResult(page, "ko",
        { before: toPlaywrightFiles(files.before), after: toPlaywrightFiles(files.after) },
        { baseUrl: root });
      assert.equal(pairUrls.length, 2);
      assert.ok(pairUrls[0].endsWith("/tools/document-compare/results/1"), pairUrls[0]);
      assert.ok(pairUrls[1].endsWith("/tools/document-compare/results/2"), pairUrls[1]);
      passed.push("entry flow reaches both pair result URLs without direct goto");
      // Pair 1 carries changes: the change rail renders. Pair 2 is identical:
      // U5 keeps the rail unrendered on empty changes. Client-side link
      // navigation keeps the in-memory compare session; direct result-URL
      // loads would discard it. The entry flow ends on pair 2's result, so
      // step back to the entry first.
      await page.locator("[data-testid='document-result-back']").click();
      await page.waitForFunction(() => !location.pathname.includes("/results/")
        && document.querySelectorAll("[data-testid='document-result-card']").length === 2, null, { timeout: 30_000 });
      await page.locator("[data-testid='document-view-result']").nth(0).click();
      await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/1")
        && document.querySelector("[data-testid='document-result-view']"), null, { timeout: 30_000 });
      assert.equal(await page.locator("[data-testid='document-change-rail']").count(), 1, "pair 1 change rail is missing");
      passed.push("pair 1 change rail renders");
      await page.locator("[data-testid='document-result-back']").click();
      await page.waitForFunction(() => !location.pathname.includes("/results/")
        && document.querySelectorAll("[data-testid='document-result-card']").length === 2, null, { timeout: 30_000 });
      await page.locator("[data-testid='document-view-result']").nth(1).click();
      await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/2")
        && document.querySelector("[data-testid='document-result-view']"), null, { timeout: 30_000 });
      assert.equal(await page.locator("[data-testid='document-change-rail']").count(), 0, "pair 2 must not render a change rail on empty changes");
      passed.push("pair 2 omits the change rail on empty changes");
      assert.ok(!errors.length, `page errors: ${errors.join("; ")}`);
      console.log(`Document result entry contract passed: ${passed.length} checks.`);
      if (out) await fs.writeFile(out, `${JSON.stringify({ passed, pairUrls }, null, 1)}\n`);
    } finally {
      await browser.close();
    }
  } finally {
    if (server) server.kill("SIGTERM");
  }
}
