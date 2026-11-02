import fs from "node:fs/promises";
import assert from "node:assert/strict";
import ts from "typescript";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import ExcelJS from "exceljs";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-office-smoke-"));
const documentPath = path.join(temporaryDirectory, "office-editor-check.docx");
const spreadsheetPath = path.join(temporaryDirectory, "korean-calc.xlsx");
const downloadDirectory = path.join(temporaryDirectory, "downloads");
await fs.mkdir(downloadDirectory);
await fs.writeFile(documentPath, await createDocx());
await createKoreanSpreadsheet(spreadsheetPath);

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  await checkPersistentHandoff(browser);
  if (process.env.OFFICE_HANDOFF_ONLY !== "1") {
  const page = await browser.newPage();
  await fenceNetwork(page);
  page.setDefaultTimeout(420_000);
  await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDirectory });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  
  // Drop zone in ready state (no file)
  await page.goto(`${baseUrl}/ko/tools/office-editor/app/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='office-app-dropzone']");
  await page.waitForFunction(() => document.querySelector("[data-testid='office-app-dropzone']").textContent.includes("준비가 끝났습니다"));
  
  // Drop file to open it
  await dropFile(page, "[data-testid='office-app-dropzone'] [data-ui-part=drop-target]", documentPath);
  await page.waitForFunction(() => document.querySelector("[data-testid='office-canvas-shell'][data-active='true']") && document.querySelector("[data-testid='office-toolbar-document'] strong")?.textContent === "office-editor-check.docx");
  console.log("Drop zone is visible in ready state and can open a dropped file.");
  await new Promise(r => setTimeout(r, 500));
  const topBarExists = await page.evaluate(() => !!document.querySelector(".wl-topbar"));
  if (topBarExists) throw new Error("TopBar should be hidden in Office Editor mode.");
  console.log("TopBar is hidden in editor mode.");

  await page.goto(`${baseUrl}/ko/tools/office-editor?guide=1`, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-testid='office-landing-drop'] [data-ui-part=drop-target]");
  const landingBoundary = await page.evaluate(() => ({
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    dropHint: document.querySelector("[data-testid='office-landing-drop']")?.textContent || "",
  }));
  if (!landingBoundary.dropHint) throw new Error(`Office landing drop is incomplete: ${JSON.stringify(landingBoundary)}`);
  await dropFile(page, "[data-testid='office-landing-drop'] [data-ui-part=drop-target]", documentPath);
  await page.waitForFunction(() => location.pathname.endsWith("/tools/office-editor/app/"));
  await page.waitForSelector("[data-tool-page='office-editor-app']");
  const boundary = await page.evaluate(() => ({
    isolated: crossOriginIsolated,
    marker: Boolean(document.querySelector('meta[name="worklazy-office-isolation"]')),
    noIndex: document.querySelector('meta[name="robots"]')?.content || "",
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    googleAnalytics: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
    naverAnalytics: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
  }));
  if (!boundary.isolated || !boundary.marker || boundary.noIndex !== "noindex, nofollow"
    || boundary.ads || boundary.googleAnalytics || boundary.naverAnalytics) {
    throw new Error(`Office workspace boundary is incomplete: ${JSON.stringify(boundary)}`);
  }

  await page.evaluate(() => {
    window.__officeProgressSamples = [];
    new MutationObserver(() => {
      const progress = document.querySelector(".ui-operation-progress-track")?.getAttribute("aria-valuenow") || "";
      const message = document.querySelector(".ui-operation-current-message")?.textContent || "";
      const sample = `${progress}:${message}`;
      if (message && !window.__officeProgressSamples.includes(sample)) window.__officeProgressSamples.push(sample);
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.waitForFunction(() => document.querySelector("[data-testid='office-canvas-shell'][data-active='true']") || document.querySelector("[data-slot='notice'][role='alert']"));
  const error = await page.$eval("[data-slot='notice'][role='alert']", (element) => element.textContent || "").catch(() => "");
  if (error) throw new Error(`Office editor reported an error: ${error}`);
  await page.waitForSelector("[data-testid='office-canvas-shell'][data-active='true']");
  const progress = await page.evaluate(async () => ({
    samples: window.__officeProgressSamples,
    cacheEntries: (await caches.keys()).filter((name) => name.startsWith("worklazy-office-")).length,
    saveEnabled: !document.querySelector("[data-testid='office-save']")?.disabled,
    canvas: document.querySelector("[data-testid='office-canvas']")?.getBoundingClientRect().toJSON(),
    focus: document.querySelector("[data-tool-page='office-editor-app'][data-focus-mode='true']")?.getBoundingClientRect().toJSON(),
    koreanFonts: ["NanumGothic-Regular.ttf"].map((name) => {
      try { return FS.stat(`/usr/share/fonts/${name}`).size; } catch { return 0; }
    }),
  }));
  if (!progress.samples.some((sample) => /MB|저장된/.test(sample)) || new Set(progress.samples.map((sample) => sample.split(":", 1)[0])).size < 3 || progress.samples.length > 120
    || progress.cacheEntries !== 1 || !progress.saveEnabled || !progress.canvas || progress.canvas.width < 800 || progress.canvas.height < 780
    || !progress.focus || progress.focus.height < 940 || progress.koreanFonts.join(",") !== "2054744") {
    throw new Error(`Office progress or canvas state is incomplete: ${JSON.stringify(progress)}`);
  }

  const editMarker = " Browser edit verified";
  await page.click("[data-testid='office-canvas']");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageUp");
  const scrollAfter = await page.evaluate(() => window.scrollY);
  if (scrollAfter !== scrollBefore) throw new Error(`Office canvas navigation also scrolled the page: ${scrollBefore} -> ${scrollAfter}`);
  await page.keyboard.press("End");
  await page.keyboard.type(editMarker);
  await page.$eval("[data-testid='office-save']", (button) => button.click());
  const savedPath = await waitForDownload(downloadDirectory, "office-editor-check.docx");
  const saved = await fs.readFile(savedPath);
  if (saved.length < 512 || saved[0] !== 0x50 || saved[1] !== 0x4b) throw new Error("Saved DOCX did not pass the container check.");
  const savedArchive = await JSZip.loadAsync(saved);
  const savedDocumentXml = await savedArchive.file("word/document.xml")?.async("string");
  if (!savedDocumentXml?.includes(editMarker.trim())) throw new Error("Keyboard editing was not persisted in the saved DOCX.");

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("[data-tool-page='office-editor-app']");
  await page.evaluate(() => {
    window.__officeProgressSamples = [];
    new MutationObserver(() => {
      const message = document.querySelector(".ui-operation-current-message")?.textContent || "";
      if (message && !window.__officeProgressSamples.includes(message)) window.__officeProgressSamples.push(message);
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await (await page.$("[data-testid='office-file-picker']")).uploadFile(documentPath);
  await page.waitForFunction(() => document.querySelector("[data-testid='office-canvas-shell'][data-active='true']") || document.querySelector("[data-slot='notice'][role='alert']"));
  const cachedError = await page.$eval("[data-slot='notice'][role='alert']", (element) => element.textContent || "").catch(() => "");
  if (cachedError) throw new Error(`Cached office editor start reported an error: ${cachedError}`);
  const cacheReuse = await page.evaluate(async () => {
    const messages = Array.from(document.querySelectorAll(".ui-operation-log li"), (item) => item.textContent || "");
    const cache = await caches.open("worklazy-office-2026-10-07");
    const keys = await cache.keys();
    return { messages, assetCount: keys.filter((request) => request.url.includes("/vendor/zetaoffice/")).length };
  });
  const cachedMessages = cacheReuse.messages.filter((message) => message.includes("저장된 편집 파일 확인 중"));
  if (cachedMessages.length < 6 || cacheReuse.assetCount !== 7) throw new Error(`Office assets were not reused from browser storage: ${JSON.stringify(cacheReuse)}`);

  page.once("dialog", (dialog) => dialog.accept());
  await (await page.$("[data-testid='office-file-picker']")).uploadFile(spreadsheetPath);
  await page.waitForFunction(() => document.querySelector("[data-testid='office-canvas-shell'][data-active='true']") && document.querySelector("[data-testid='office-toolbar-document'] strong")?.textContent === "korean-calc.xlsx");
  const calcError = await page.$eval("[data-slot='notice'][role='alert']", (element) => element.textContent || "").catch(() => "");
  if (calcError) throw new Error(`Korean Calc document reported an error: ${calcError}`);
  await page.click("[data-testid='office-canvas']");
  await page.keyboard.down("Control");
  await page.keyboard.press("Home");
  await page.keyboard.up("Control");
  await waitForCalcState(page, "Ctrl+Home to select A1", (state) => state.range.row === 0 && state.range.column === 0 && state.cells.a1 === "한글 셀 표시 확인");
  const calcScrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await waitForCalcState(page, "ArrowDown to select A2", (state) => state.range.row === 1 && state.range.column === 0 && state.cells.a2 === "이동 전");
  await page.keyboard.type("Arrow navigation verified");
  await page.keyboard.press("Enter");
  await waitForCalcState(page, "A2 keyboard edit to be applied", (state) => state.cells.a1 === "한글 셀 표시 확인" && state.cells.a2.includes("Arrow navigation verified"));
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageUp");
  const calcScrollAfter = await page.evaluate(() => window.scrollY);
  if (calcScrollAfter !== calcScrollBefore) throw new Error(`Calc cell navigation also scrolled the page: ${calcScrollBefore} -> ${calcScrollAfter}`);
  await page.$eval("[data-testid='office-save']", (button) => button.click());
  const savedSpreadsheetPath = await waitForDownload(downloadDirectory, "korean-calc.xlsx");
  const savedSpreadsheet = new ExcelJS.Workbook();
  await savedSpreadsheet.xlsx.load(await fs.readFile(savedSpreadsheetPath));
  const savedValues = savedSpreadsheet.worksheets.flatMap((sheet) => sheet.getSheetValues().flat()).filter(Boolean).map(String);
  if (!savedValues.includes("한글 셀 표시 확인") || !savedValues.some((value) => value.includes("Arrow navigation verified"))) {
    throw new Error(`Calc did not preserve Korean text and keyboard cell editing: ${JSON.stringify(savedValues)}`);
  }
  if (pageErrors.length) throw new Error(`Office browser errors:\n${pageErrors.join("\n")}`);
  console.log(`Office editor smoke passed: ${progress.samples.length} download states, ${cachedMessages.length} cached states, Korean Calc keyboard edit and ${saved.length} saved DOCX bytes.`);
  }
} finally {
  await browser.close();
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function waitForDownload(directory, fileName) {
  const target = path.join(directory, fileName);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const entries = await fs.readdir(directory);
    if (entries.includes(fileName) && !entries.some((name) => name.endsWith(".crdownload"))) return target;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Saved office file download did not finish.");
}

async function dropFile(page, selector, filePath) {
  const bytes = await fs.readFile(filePath);
  const name = path.basename(filePath);
  await page.$eval(selector, (element, payload) => {
    const binary = atob(payload.base64);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    const transfer = new DataTransfer();
    transfer.items.add(new File([data], payload.name));
    for (const type of ["dragenter", "dragover", "drop"]) {
      element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }
  }, { name, base64: bytes.toString("base64") });
}

async function waitForCalcState(page, label, predicate) {
  let lastState = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    lastState = await readCalcState(page);
    if (lastState && predicate(lastState)) return lastState;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Calc did not complete ${label}: ${JSON.stringify(lastState)}`);
}

async function readCalcState(page) {
  for (const worker of page.workers()) {
    const state = await worker.evaluate(() => {
      if (typeof documentModel === "undefined" || !documentModel) return null;
      try {
        const controller = documentModel.getCurrentController();
        const address = controller.getSelection().getRangeAddress();
        const sheet = documentModel.getSheets().getByIndex(0);
        return {
          range: { row: address.StartRow, column: address.StartColumn, endRow: address.EndRow, endColumn: address.EndColumn },
          cells: { a1: sheet.getCellByPosition(0, 0).getString(), a2: sheet.getCellByPosition(0, 1).getString() },
        };
      } catch {
        return null;
      }
    }).catch(() => null);
    if (state) return state;
  }
  return null;
}

async function createDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Office editor browser verification document.</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  zip.folder("word").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function createKoreanSpreadsheet(filePath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("한글 시트");
  sheet.getCell("A1").value = "한글 셀 표시 확인";
  sheet.getCell("A1").font = { name: "NanumGothic", size: 12 };
  sheet.getCell("A2").value = "이동 전";
  sheet.getColumn(1).width = 28;
  await workbook.xlsx.writeFile(filePath);
}

// Native IndexedDB contract samples, using compiled product modules without a
// storage mock. Kept in the Office smoke so the existing runtime checks remain.
async function fenceNetwork(page) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = request.url();
    if (/^(data:|blob:)/.test(url) || new URL(url).origin === new URL(baseUrl).origin) void request.continue();
    else void request.abort();
  });
}
async function checkPersistentHandoff(browser) {
  const compile = async (name) => ts.transpileModule(await fs.readFile(`src/${name}.ts`, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const pending = await compile("features/office-editor/pendingOfficeFile");
  const core = await compile("app/persistentHandoff").catch((error) => { if (error.code === "ENOENT") return null; throw error; });
  const tabs = await Promise.all([browser.newPage(), browser.newPage()]);
  let passed = 0;
  try {
    for (const page of tabs) {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.url() === `${baseUrl}/__handoff-contract__`) void request.respond({ status: 200, contentType: "text/html", body: "<title>Office handoff contract</title>" });
        else void request.abort();
      });
      await page.goto(`${baseUrl}/__handoff-contract__`);
      await page.evaluate(({ pending, core }) => {
        const load = (code, dependencies = {}) => {
          const exports = {}; new Function("exports", "require", code)(exports, (id) => {
            if (!(id in dependencies)) throw new Error(`Unknown dependency ${id}`);
            return dependencies[id];
          }); return exports;
        };
        window.handoffCore = core ? load(core) : null;
        window.handoffPending = load(pending, { "../../app/persistentHandoff": window.handoffCore });
        window.openHandoffDB = (version = 2) => new Promise((resolve, reject) => {
          const request = indexedDB.open("worklazy-office-handoff", version);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        window.handoffRecords = async () => {
          const db = await window.openHandoffDB();
          try { return await new Promise((resolve, reject) => {
            const tx = db.transaction("records", "readonly"); const req = tx.objectStore("records").getAll();
            tx.oncomplete = () => resolve(req.result); tx.onabort = () => reject(tx.error);
          }); } finally { db.close(); }
        };
        window.resetHandoff = async () => {
          sessionStorage.clear();
          await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase("worklazy-office-handoff"); req.onsuccess = resolve; req.onerror = () => reject(req.error);
          });
        };
      }, { pending, core });
    }
    const [a, b] = tabs;
    await a.evaluate(() => window.resetHandoff());
    // This regression deliberately precedes new-module-only tests. The legacy
    // implementation fails on returned file names, rather than a missing import.
    await Promise.all(tabs.map((page, index) => page.evaluate((index) => window.handoffPending.stagePendingOfficeFile(new File([`private-${index}`], `tab-${index}.docx`)), index)));
    const received = await Promise.all(tabs.map((page) => page.evaluate(async () => (await window.handoffPending.takePendingOfficeFile())?.name)));
    assert.deepEqual(received, ["tab-0.docx", "tab-1.docx"], "independent tabs must receive their own case"); passed++;
    assert.equal(await a.evaluate(async () => (await window.handoffRecords()).length), 0);
    await a.evaluate(async () => {
      await window.handoffPending.stagePendingOfficeFile(new File(["first"], "first.docx"));
      await window.handoffPending.stagePendingOfficeFile(new File(["second"], "second.docx"));
      const token = JSON.parse(sessionStorage.getItem("worklazy-handoff-token:office-editor"));
      if (Object.keys(token).sort().join() !== "id,nonce") throw new Error("token leaked metadata");
      if ((await window.handoffPending.takePendingOfficeFile()).name !== "second.docx") throw new Error("wrong sequential case");
      if (await window.handoffPending.takePendingOfficeFile()) throw new Error("reused tab token");
    }); passed++;
    await a.evaluate(() => window.resetHandoff());
    const token = await a.evaluate(() => window.handoffCore.stagePersistentHandoff(new File(["clone"], "clone.docx")));
    const duplicate = await Promise.all(tabs.map((page) => page.evaluate(async (token) => (await window.handoffCore.consumePersistentHandoff(token))?.name ?? null, token)));
    assert.equal(duplicate.filter(Boolean).length, 1); passed++;
    await a.evaluate(async () => {
      const c = window.handoffCore;
      const token = await c.stagePersistentHandoff(new File(["exact"], "exact.docx"));
      for (const [t, receiver, path] of [[{ ...token, nonce: "wrong" }, "office-editor", c.OFFICE_HANDOFF_PATH], [token, "other", c.OFFICE_HANDOFF_PATH], [token, "office-editor", "/wrong"]]) {
        if (await c.consumePersistentHandoff(t, receiver, path)) throw new Error("mismatch accepted");
      }
      if (!(await c.consumePersistentHandoff(token))) throw new Error("mismatch deleted live case");
    }); passed++;
    await a.evaluate(async () => {
      await window.resetHandoff(); const c = window.handoffCore;
      const now = Date.now; let clock = 1000000; Date.now = () => clock;
      try {
        const live = await c.stagePersistentHandoff(new File(["boundary"], "boundary.docx"));
        clock += c.HANDOFF_TTL_MS;
        await c.purgeExpired(); if ((await window.handoffRecords()).length !== 1) throw new Error("purged at equality");
        if (!(await c.consumePersistentHandoff(live))) throw new Error("refused at equality");
        const expired = await c.stagePersistentHandoff(new File(["expired"], "expired.docx"));
        clock += c.HANDOFF_TTL_MS + 1;
        if (await c.consumePersistentHandoff(expired)) throw new Error("expired accepted");
        await c.purgeExpired(); if ((await window.handoffRecords()).length) throw new Error("expired retained");
      } finally { Date.now = now; }
    }); passed++;
    await a.evaluate(async () => {
      await window.resetHandoff(); const c = window.handoffCore;
      const attempts = await Promise.allSettled(Array.from({ length: 21 }, (_, i) => c.stagePersistentHandoff(new File([`${i}`], `${i}.docx`))));
      if (attempts.filter((r) => r.status === "fulfilled").length !== 20 || attempts.filter((r) => r.status === "rejected" && r.reason.code === "full").length !== 1) throw new Error("non-atomic cap");
      const now = Date.now; Date.now = () => now() + c.HANDOFF_TTL_MS + 1;
      try { await c.stagePersistentHandoff(new File(["new"], "new.docx")); } finally { Date.now = now; }
      if ((await window.handoffRecords()).length !== 1) throw new Error("expired cap cleanup");
    }); passed++;
    for (const expired of [false, true]) {
      await a.evaluate(() => window.resetHandoff());
      const token = await a.evaluate(() => window.handoffCore.stagePersistentHandoff(new File(["race"], "race.docx")));
      const results = await Promise.all(tabs.map((page, index) => page.evaluate(async ({ token, index, expired }) => {
        const now = Date.now; if (expired) Date.now = () => now() + 900001;
        try { return index ? (await window.handoffCore.purgeExpired(), null) : (await window.handoffCore.consumePersistentHandoff(token))?.name ?? null; }
        finally { Date.now = now; }
      }, { token, index, expired })));
      assert.equal(results[0], expired ? null : "race.docx");
      assert.equal(await a.evaluate(async () => (await window.handoffRecords()).length), 0); passed++;
    }
    await a.evaluate(async () => {
      await window.resetHandoff();
      await new Promise((resolve, reject) => {
        const req = indexedDB.open("worklazy-office-handoff", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("pending-files");
        req.onsuccess = () => {
          const db = req.result; const tx = db.transaction("pending-files", "readwrite");
          tx.objectStore("pending-files").put({ file: new File(["legacy"], "legacy.docx") }, "office-editor");
          tx.oncomplete = () => { window.legacyDB = db; resolve(); }; tx.onabort = () => reject(tx.error);
        };
      });
    });
    assert.deepEqual(await b.evaluate(async () => {
      const c = window.handoffCore;
      const attempts = [c.purgeExpired(), c.stagePersistentHandoff(new File(["blocked"], "blocked.docx"))];
      const results = await Promise.race([Promise.all(attempts.map((p) => p.then(() => "unexpected", (e) => e.code))), new Promise((resolve) => setTimeout(() => resolve("hung"), 2000))]);
      const retry = await c.purgeExpired().then(() => "unexpected", (e) => e.code);
      return [results, retry];
    }), [["blocked", "blocked"], "blocked"]);
    await a.evaluate(() => window.legacyDB.close());
    await b.evaluate(async () => { const db = await window.openHandoffDB(1); db.close(); await window.handoffCore.purgeExpired(); });
    const upgraded = await a.evaluate(async () => { const db = await window.openHandoffDB(); const result = { version: db.version, stores: [...db.objectStoreNames] }; db.close(); return result; });
    assert.deepEqual(upgraded, { version: 2, stores: ["records"] }); passed++;
    assert.equal(await a.evaluate(() => new Promise((resolve) => { const r = indexedDB.open("worklazy-office-handoff", 1); r.onerror = () => resolve(r.error.name); r.onsuccess = () => { r.result.close(); resolve("unexpected"); }; })), "VersionError"); passed++;
    await a.evaluate(async () => {
      await window.resetHandoff();
      await new Promise((resolve) => { const r = indexedDB.open("worklazy-office-handoff", 1); r.onupgradeneeded = () => r.result.createObjectStore("pending-files"); r.onsuccess = () => { r.result.close(); resolve(); }; });
      await new Promise((resolve, reject) => { const r = indexedDB.open("worklazy-office-handoff", 2); r.onupgradeneeded = () => { r.result.deleteObjectStore("pending-files"); r.result.createObjectStore("records", { keyPath: "id" }); r.transaction.abort(); }; r.onerror = () => resolve(); r.onsuccess = () => { r.result.close(); reject(new Error("upgrade did not abort")); }; });
      const old = await window.openHandoffDB(1);
      if (old.version !== 1 || !old.objectStoreNames.contains("pending-files") || old.objectStoreNames.contains("records")) throw new Error("partial upgrade"); old.close();
      await window.handoffCore.purgeExpired();
      const complete = await window.openHandoffDB();
      if (complete.version !== 2 || complete.objectStoreNames.contains("pending-files") || !complete.objectStoreNames.contains("records")) throw new Error("restart failed"); complete.close();
    }); passed++;
    await a.evaluate(async () => {
      // Hold a genuine product connection open until a later native versionchange.
      const close = IDBDatabase.prototype.close; let held; let requested = false;
      IDBDatabase.prototype.close = function () { held = this; };
      try { await window.handoffCore.purgeExpired(); } finally { IDBDatabase.prototype.close = close; }
      const original = held.onversionchange;
      held.onversionchange = function (event) { requested = true; original.call(this, event); };
      const upgraded = await window.openHandoffDB(3); upgraded.close();
      if (!requested) throw new Error("product connection did not close on versionchange");
    }); passed++;
    await a.evaluate(async () => {
      await window.resetHandoff(); const c = window.handoffCore;
      const token = await c.stagePersistentHandoff(new File(["abort"], "abort.docx"));
      const original = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (...args) { const result = original.apply(this, args); this.transaction.abort(); return result; };
      try {
        const result = await c.consumePersistentHandoff(token).then(() => "success", (e) => e.code);
        if (result !== "unavailable") throw new Error("aborted delete delivered a file");
      } finally { IDBObjectStore.prototype.delete = original; }
      if (!(await c.consumePersistentHandoff(token))) throw new Error("abort lost the original record");
    }); passed++;
    console.log(`Office persistent handoff: ${passed} native Chromium contract samples passed.`);
    if (process.env.OFFICE_HANDOFF_ONLY === "1") console.log(`# tests ${passed}`);
  } finally { for (const page of tabs) await page.close(); }
}
