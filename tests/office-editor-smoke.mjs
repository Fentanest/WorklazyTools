import fs from "node:fs/promises";
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
  const page = await browser.newPage();
  page.setDefaultTimeout(420_000);
  await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDirectory });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/ko/tools/office-editor`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".office-landing-drop [data-ui-part=drop-target]");
  const landingBoundary = await page.evaluate(() => ({
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    dropHint: document.querySelector(".office-landing-drop")?.textContent || "",
  }));
  if (!landingBoundary.dropHint.includes("자동")) throw new Error(`Office landing drop is incomplete: ${JSON.stringify(landingBoundary)}`);
  await dropFile(page, ".office-landing-drop [data-ui-part=drop-target]", documentPath);
  await page.waitForFunction(() => location.pathname.endsWith("/tools/office-editor/app/"));
  await page.waitForSelector(".office-editor-app");
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
  await page.waitForFunction(() => document.querySelector(".office-canvas-shell.active") || document.querySelector(".error-banner"));
  const error = await page.$eval(".error-banner", (element) => element.textContent || "").catch(() => "");
  if (error) throw new Error(`Office editor reported an error: ${error}`);
  await page.waitForSelector(".office-canvas-shell.active");
  const progress = await page.evaluate(async () => ({
    samples: window.__officeProgressSamples,
    cacheEntries: (await caches.keys()).filter((name) => name.startsWith("worklazy-office-")).length,
    saveEnabled: !document.querySelector('.office-app-toolbar button:has(svg.lucide-save)')?.disabled,
    canvas: document.querySelector(".office-canvas")?.getBoundingClientRect().toJSON(),
    focus: document.querySelector(".office-editor-focus")?.getBoundingClientRect().toJSON(),
    koreanFonts: ["NanumGothic-Regular.ttf"].map((name) => {
      try { return FS.stat(`/usr/share/fonts/${name}`).size; } catch { return 0; }
    }),
  }));
  if (!progress.samples.some((sample) => /MB/.test(sample)) || new Set(progress.samples.map((sample) => sample.split(":", 1)[0])).size < 3 || progress.samples.length > 120
    || progress.cacheEntries !== 1 || !progress.saveEnabled || !progress.canvas || progress.canvas.width < 800 || progress.canvas.height < 780
    || !progress.focus || progress.focus.height < 940 || progress.koreanFonts.join(",") !== "2054744") {
    throw new Error(`Office progress or canvas state is incomplete: ${JSON.stringify(progress)}`);
  }

  const editMarker = " Browser edit verified";
  await page.click(".office-canvas");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageUp");
  const scrollAfter = await page.evaluate(() => window.scrollY);
  if (scrollAfter !== scrollBefore) throw new Error(`Office canvas navigation also scrolled the page: ${scrollBefore} -> ${scrollAfter}`);
  await page.keyboard.press("End");
  await page.keyboard.type(editMarker);
  await page.$eval('.office-app-toolbar button:has(svg.lucide-save)', (button) => button.click());
  const savedPath = await waitForDownload(downloadDirectory, "office-editor-check.docx");
  const saved = await fs.readFile(savedPath);
  if (saved.length < 512 || saved[0] !== 0x50 || saved[1] !== 0x4b) throw new Error("Saved DOCX did not pass the container check.");
  const savedArchive = await JSZip.loadAsync(saved);
  const savedDocumentXml = await savedArchive.file("word/document.xml")?.async("string");
  if (!savedDocumentXml?.includes(editMarker.trim())) throw new Error("Keyboard editing was not persisted in the saved DOCX.");

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".office-editor-app");
  await page.evaluate(() => {
    window.__officeProgressSamples = [];
    new MutationObserver(() => {
      const message = document.querySelector(".ui-operation-current-message")?.textContent || "";
      if (message && !window.__officeProgressSamples.includes(message)) window.__officeProgressSamples.push(message);
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await (await page.$('.office-file-picker input[type="file"]')).uploadFile(documentPath);
  await page.waitForFunction(() => document.querySelector(".office-canvas-shell.active") || document.querySelector(".error-banner"));
  const cachedError = await page.$eval(".error-banner", (element) => element.textContent || "").catch(() => "");
  if (cachedError) throw new Error(`Cached office editor start reported an error: ${cachedError}`);
  const cacheReuse = await page.evaluate(async () => {
    const messages = Array.from(document.querySelectorAll(".ui-operation-log li"), (item) => item.textContent || "");
    const cache = await caches.open("worklazy-office-2026-08-26");
    const keys = await cache.keys();
    return { messages, assetCount: keys.filter((request) => request.url.includes("/vendor/zetaoffice/")).length };
  });
  const cachedMessages = cacheReuse.messages.filter((message) => message.includes("저장된 편집 파일 확인 중"));
  if (cachedMessages.length < 6 || cacheReuse.assetCount !== 7) throw new Error(`Office assets were not reused from browser storage: ${JSON.stringify(cacheReuse)}`);

  page.once("dialog", (dialog) => dialog.accept());
  await (await page.$('.office-file-picker input[type="file"]')).uploadFile(spreadsheetPath);
  await page.waitForFunction(() => document.querySelector(".office-canvas-shell.active") && document.querySelector(".office-toolbar-document strong")?.textContent === "korean-calc.xlsx");
  const calcError = await page.$eval(".error-banner", (element) => element.textContent || "").catch(() => "");
  if (calcError) throw new Error(`Korean Calc document reported an error: ${calcError}`);
  await page.click(".office-canvas");
  await page.keyboard.down("Control");
  await page.keyboard.press("Home");
  await page.keyboard.up("Control");
  const calcScrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("Arrow navigation verified");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageUp");
  const calcScrollAfter = await page.evaluate(() => window.scrollY);
  if (calcScrollAfter !== calcScrollBefore) throw new Error(`Calc cell navigation also scrolled the page: ${calcScrollBefore} -> ${calcScrollAfter}`);
  await page.$eval('.office-app-toolbar button:has(svg.lucide-save)', (button) => button.click());
  const savedSpreadsheetPath = await waitForDownload(downloadDirectory, "korean-calc.xlsx");
  const savedSpreadsheet = new ExcelJS.Workbook();
  await savedSpreadsheet.xlsx.load(await fs.readFile(savedSpreadsheetPath));
  const savedValues = savedSpreadsheet.worksheets.flatMap((sheet) => sheet.getSheetValues().flat()).filter(Boolean).map(String);
  if (!savedValues.includes("한글 셀 표시 확인") || !savedValues.some((value) => value.includes("Arrow navigation verified"))) {
    throw new Error(`Calc did not preserve Korean text and keyboard cell editing: ${JSON.stringify(savedValues)}`);
  }
  if (pageErrors.length) throw new Error(`Office browser errors:\n${pageErrors.join("\n")}`);
  console.log(`Office editor smoke passed: ${progress.samples.length} download states, ${cachedMessages.length} cached states, Korean Calc keyboard edit and ${saved.length} saved DOCX bytes.`);
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
