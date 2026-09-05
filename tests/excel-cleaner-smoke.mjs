import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";

const runCommand = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-excel-cleaner-smoke-"));
const downloads = path.join(temporaryDirectory, "downloads");

try {
  await runCommand(process.execPath, ["scripts/generate-excel-cleaner-fixtures.mjs", temporaryDirectory]);
  await fs.mkdir(downloads);
  const duplicateA = path.join(temporaryDirectory, "a", "same.xlsx");
  const duplicateB = path.join(temporaryDirectory, "b", "same.xlsx");
  await fs.mkdir(path.dirname(duplicateA));
  await fs.mkdir(path.dirname(duplicateB));
  await fs.copyFile(path.join(temporaryDirectory, "formula.xlsx"), duplicateA);
  await fs.copyFile(path.join(temporaryDirectory, "formula.xlsx"), duplicateB);
  const largeCsv = path.join(temporaryDirectory, "large.csv");
  await fs.writeFile(largeCsv, `A,B,C,D,E,F,G,H,I,J\n${Array.from({ length: 20_000 }, (_, index) => ` row ${index} ,${index},x,x,x,x,x,x,x,x`).join("\n")}`, "utf8");
  const redosCsv = path.join(temporaryDirectory, "redos.csv");
  await fs.writeFile(redosCsv, `Value\n${"a".repeat(38)}!\n`, "utf8");
  const originalFormula = await fs.readFile(path.join(temporaryDirectory, "formula.xlsx"));

  const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, protocolTimeout: 300_000, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });
    page.setDefaultTimeout(240_000);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("worklazy_privacy_consent", "granted");
      globalThis.__excelCleanerRevokedUrls = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => { globalThis.__excelCleanerRevokedUrls.push(url); revoke(url); };
    });
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === new URL(baseUrl).origin) failedRequests.push(`${request.url()} ${request.failure()?.errorText || "unknown"}`);
    });
    const client = await page.createCDPSession();

    await openCleaner(page);
    const initial = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent || "",
      rules: document.querySelectorAll("[data-testid='excel-cleaner-add-rule'] option").length,
      fileInputs: document.querySelectorAll('[data-tool-page="excel-cleaner"] input[type="file"]').length,
      ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
      isolated: Boolean(document.querySelector('meta[name="worklazy-video-isolation"], meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]')),
    }));
    if (initial.title !== "Excel 데이터 정리" || initial.rules !== 28 || initial.fileInputs !== 1 || !initial.ads || initial.isolated) throw new Error(`Initial UI or ad boundary failed: ${JSON.stringify(initial)}`);

    await upload(page, path.join(temporaryDirectory, "formula.xlsx"), 1);
    await page.click("[data-testid='excel-cleaner-add-rule'] button");
    await page.select("[data-testid='excel-cleaner-add-rule'] select", "collapse-spaces");
    await page.click("[data-testid='excel-cleaner-add-rule'] button");
    await page.click('[data-testid="excel-cleaner-rule"]:nth-child(2) button[aria-label="규칙 위로 이동"]');
    let order = await ruleOrder(page);
    if (order[0] !== "collapse-spaces") throw new Error(`Button ordering alternative failed: ${JSON.stringify(order)}`);
    await page.evaluate(() => {
      const cards = document.querySelectorAll("[data-testid='excel-cleaner-rule']");
      const transfer = new DataTransfer();
      cards[0].dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
      cards[1].dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      cards[1].dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    });
    await page.waitForFunction(() => JSON.parse(document.querySelector("[data-testid='excel-cleaner-rule'] textarea")?.value || "{}").type === "trim-whitespace");
    order = await ruleOrder(page);
    const actionGeometry = await page.$eval("[data-testid='excel-cleaner-actions']", (actions) => {
      const parent = actions.getBoundingClientRect();
      const buttons = Array.from(actions.querySelectorAll("button"), (button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, legacyPrimaryClass: button.classList.contains("ui-primary-button") };
      });
      return {
        parent: { left: parent.left, right: parent.right, width: parent.width },
        buttons,
        overflowLeft: Math.max(0, parent.left - Math.min(...buttons.map(({ left }) => left))),
        overflowRight: Math.max(0, Math.max(...buttons.map(({ right }) => right)) - parent.right),
      };
    });
    if (actionGeometry.overflowLeft > 0.5 || actionGeometry.overflowRight > 0.5 || actionGeometry.buttons.some(({ width, legacyPrimaryClass }) => width > 320 || legacyPrimaryClass)) {
      throw new Error(`Cleaner action buttons escaped their card or retained the legacy full-width class: ${JSON.stringify(actionGeometry)}`);
    }
    const previewSelector = "[data-testid='excel-cleaner-actions'] [data-slot='button']";
    const previewAction = await page.$eval(previewSelector, (button) => ({ disabled: button.disabled, text: button.textContent || "" }));
    if (previewAction.disabled) throw new Error(`Cleaner preview action stayed disabled: ${JSON.stringify({ previewAction, order })}`);
    await page.click(previewSelector);
    try {
      await page.waitForSelector("[data-testid='excel-cleaner-preview']", { timeout: 60_000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        actions: Array.from(document.querySelectorAll("[data-testid='excel-cleaner-actions'] button"), (button) => ({ disabled: button.disabled, text: button.textContent || "" })),
        notices: Array.from(document.querySelectorAll("[data-slot='notice']"), (notice) => notice.textContent || ""),
        progress: document.querySelector(".ui-operation-progress")?.textContent || "",
      }));
      throw new Error(`Cleaner preview did not render: ${JSON.stringify({ previewAction, state })}\n${error.message || error}`);
    }
    await page.type("[data-testid='excel-cleaner-rule'] textarea", " ");
    await page.waitForSelector("[data-testid='excel-cleaner-preview-stale']");
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const exactDownloads = await downloadLinks(page, client, downloads, "exact");
    if (exactDownloads.length !== 1 || !exactDownloads[0].name.endsWith(".xlsx")) throw new Error(`Single input output topology failed: ${JSON.stringify(exactDownloads.map((item) => item.name))}`);
    const exact = await inspectCleanerWorkbook(exactDownloads[0].bytes, "Data");
    if (exact.sheetCount !== 5 || exact.formula !== "A2+B2" || exact.reportSheets !== 4) throw new Error(`Formula save/reopen or four-report topology failed: ${JSON.stringify(exact)}`);

    await openCleaner(page);
    await upload(page, duplicateA, duplicateB, path.join(temporaryDirectory, "damaged.xlsx"), 2);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-cleaner-file"]').length === 3 && document.querySelector('[data-testid="excel-cleaner-file"] [data-slot="notice"][role="alert"]'));
    const damagedMessage = await page.$eval('[data-testid="excel-cleaner-file"] [data-slot="notice"][role="alert"]', (element) => element.textContent || "");
    if (!damagedMessage.includes("파일 구조") || damagedMessage.includes("DAMAGED_FILE")) throw new Error(`Damaged-file isolation leaked an internal code: ${damagedMessage}`);
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const multiDownloads = await downloadLinks(page, client, downloads, "multi");
    const xlsx = multiDownloads.filter((item) => item.name.endsWith(".xlsx"));
    const zip = multiDownloads.find((item) => item.name.endsWith(".zip"));
    if (xlsx.length !== 2 || !zip || new Set(xlsx.map((item) => item.name)).size !== 2 || !xlsx.some((item) => item.name === "same-cleaned-2.xlsx")) throw new Error(`Per-file success, suffix, or ZIP threshold failed: ${JSON.stringify(multiDownloads.map((item) => item.name))}`);
    const archive = await JSZip.loadAsync(zip.bytes);
    const archiveNames = Object.values(archive.files).filter((entry) => !entry.dir).map((entry) => entry.name);
    if (archiveNames.length !== 2 || new Set(archiveNames).size !== 2 || archiveNames.some((name) => name.includes("/") || name.includes("\\"))) throw new Error(`ZIP names failed the safe collision contract: ${JSON.stringify(archiveNames)}`);

    await openCleaner(page);
    await upload(page, path.join(temporaryDirectory, "dangerous.csv"), 1);
    await page.click('.ui-segmented-control button:nth-child(2)');
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    await page.waitForSelector('[data-testid="csv-risk-warning"]');
    const rawUrl = await page.$eval('[data-testid="excel-cleaner-download"][download$=".csv"]', (anchor) => anchor.href);
    const rawCsv = await downloadLinks(page, client, downloads, "csv-raw");
    const rawText = new TextDecoder().decode(rawCsv[0].bytes);
    if (!rawText.includes("=1+1") || rawText.includes("'=1+1")) throw new Error(`CSV original mode changed risky source text: ${rawText}`);
    await page.click('[data-ui-component="toggle-row"] button[role="switch"]');
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForFunction((url) => globalThis.__excelCleanerRevokedUrls.includes(url), {}, rawUrl);
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const safeCsv = await downloadLinks(page, client, downloads, "csv-safe");
    const safeText = new TextDecoder().decode(safeCsv[0].bytes);
    if (!safeText.includes("'=1+1") || await page.$('[data-testid="csv-risk-warning"]')) throw new Error(`CSV safe mode did not prefix and clear its warning: ${safeText}`);

    await openCleaner(page);
    await upload(page, path.join(temporaryDirectory, "complex-formula.xlsx"), 1);
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForFunction(() => document.querySelector("[data-testid='excel-cleaner-results'] [data-slot='notice'][role='alert']")?.textContent?.includes("확인"));
    const formulaFailure = await page.$eval("[data-testid='excel-cleaner-results'] [data-slot='notice'][role='alert']", (element) => element.textContent || "");
    await page.click('[data-ui-component="toggle-row"] button[role="switch"]');
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-cleaner-download"][download$=".xlsx"]').length === 1);
    const degraded = await downloadLinks(page, client, downloads, "formula-degraded");
    const degradedBook = new ExcelJS.Workbook();
    await degradedBook.xlsx.load(degraded[0].bytes);
    if (degradedBook.getWorksheet("Complex").getCell("C2").formula !== undefined || degradedBook.getWorksheet("Complex").getCell("C2").value !== 3) throw new Error("Confirmed shared formula was not downgraded to its stored value.");

    await openCleaner(page);
    await upload(page, redosCsv, 1);
    await page.select("[data-testid='excel-cleaner-add-rule'] select", "regex-replace");
    await page.click("[data-testid='excel-cleaner-add-rule'] button");
    const redosRule = JSON.parse(await page.$eval("[data-testid='excel-cleaner-rule'] textarea", (element) => element.value));
    redosRule.pattern = "(a+)+$";
    await replaceTextarea(page, "[data-testid='excel-cleaner-rule'] textarea", JSON.stringify(redosRule, null, 2));
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForFunction(() => document.querySelector("[data-testid='excel-cleaner-results'] [data-slot='notice'][role='alert']")?.textContent?.includes("30초"), { timeout: 60_000 });
    const watchdogFailure = await page.$eval("[data-testid='excel-cleaner-results'] [data-slot='notice'][role='alert']", (element) => element.textContent || "");
    if (!watchdogFailure.includes(redosRule.id) || watchdogFailure.includes("WORKER_TIMEOUT")) throw new Error(`Regex watchdog did not identify the rule safely: ${watchdogFailure}`);
    redosRule.pattern = "a+";
    await replaceTextarea(page, "[data-testid='excel-cleaner-rule'] textarea", JSON.stringify(redosRule, null, 2));
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-cleaner-download"][download$=".xlsx"]').length === 1);

    await openCleaner(page);
    await upload(page, largeCsv, 1);
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForSelector("[data-testid='excel-cleaner-cancel']");
    await page.click("[data-testid='excel-cleaner-cancel']");
    await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-error")?.textContent?.includes("취소"));
    await page.click("[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']");
    await page.waitForSelector(".ui-operation-progress.ui-status-success");

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await openCleaner(page);
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      addButtonHeight: document.querySelector("[data-testid='excel-cleaner-add-rule'] button")?.getBoundingClientRect().height || 0,
      fileButtonHeight: document.querySelector("[data-ui-part=drop-target] [data-slot=button]")?.getBoundingClientRect().height || 0,
    }));
    if (mobile.overflow > 1 || mobile.addButtonHeight < 40 || mobile.fileButtonHeight < 40) throw new Error(`Mobile overflow or button alternative failed: ${JSON.stringify(mobile)}`);

    if (!(await fs.readFile(path.join(temporaryDirectory, "formula.xlsx"))).equals(originalFormula)) throw new Error("Input file bytes changed during browser processing.");
    if (pageErrors.length) throw new Error(`Browser page errors:\n${pageErrors.join("\n")}`);
    if (failedRequests.length) throw new Error(`Same-origin request failures:\n${failedRequests.join("\n")}`);
    console.log(JSON.stringify({
      initial,
      ruleOrderAfterDrag: order,
      actionGeometry,
      exact,
      multiDownloads: multiDownloads.map(({ name, size }) => ({ name, size })),
      archiveNames,
      damagedMessage,
      csv: { rawRiskWarning: true, safePrefix: true },
      formulaFailure,
      regexWatchdog: watchdogFailure,
      cancellationAndRerun: "passed",
      inputUnchanged: true,
      mobile,
    }, null, 2));
  } finally { await browser.close(); }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function openCleaner(page) {
  await page.goto(`${baseUrl}/ko/tools/excel-cleaner/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="excel-cleaner-page"]');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
}

async function upload(page, ...paths) {
  const minimumReady = typeof paths.at(-1) === "number" ? paths.pop() : paths.length;
  const input = await page.$('[data-tool-page="excel-cleaner"] input[type="file"]');
  await input.uploadFile(...paths);
  await page.waitForFunction((count) => document.querySelectorAll('[data-testid="excel-cleaner-file"]:not([data-inspecting])').length >= count || document.querySelectorAll("[data-testid='excel-cleaner-sheets']").length >= count, {}, minimumReady);
  await page.waitForFunction((count) => document.querySelectorAll("[data-testid='excel-cleaner-sheets']").length >= count, {}, minimumReady);
}

async function ruleOrder(page) {
  return page.$$eval("[data-testid='excel-cleaner-rule'] textarea", (items) => items.map((item) => JSON.parse(item.value).type));
}

async function replaceTextarea(page, selector, value) {
  await page.click(selector);
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.type(value);
  await page.waitForFunction((expected) => document.querySelector("[data-testid='excel-cleaner-rule'] textarea")?.value === expected, {}, value);
}

async function downloadLinks(page, client, root, phase) {
  const directory = path.join(root, phase);
  await fs.mkdir(directory);
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
  const names = await page.$$eval("[data-testid='excel-cleaner-download']", (items) => items.map((item) => item.download));
  const results = [];
  for (let index = 0; index < names.length; index += 1) {
    await page.$$eval("[data-testid='excel-cleaner-download']", (items, selected) => items[selected].click(), index);
    const target = await waitForDownload(directory, names[index]);
    const bytes = await fs.readFile(target);
    if (!bytes.byteLength) throw new Error(`Empty cleaner download: ${names[index]}`);
    results.push({ name: names[index], bytes, size: bytes.byteLength });
  }
  return results;
}

async function waitForDownload(directory, name) {
  const target = path.join(directory, name);
  for (let attempt = 0; attempt < 480; attempt += 1) {
    const entries = await fs.readdir(directory);
    if (entries.includes(name) && !entries.some((entry) => entry.endsWith(".crdownload"))) return target;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Cleaner download did not finish: ${name}`);
}

async function inspectCleanerWorkbook(bytes, cleanedSheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const cleaned = workbook.getWorksheet(cleanedSheetName);
  const reports = ["변경 요약", "처리 규칙", "오류 행", "제외 행"].filter((name) => workbook.getWorksheet(name));
  return { sheetCount: workbook.worksheets.length, reportSheets: reports.length, formula: cleaned?.getCell("D2").formula };
}
