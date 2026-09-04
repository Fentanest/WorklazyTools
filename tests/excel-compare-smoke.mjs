import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";

import { assertMobileBottomLayout } from "./mobile-bottom-assertion.mjs";

const run = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-excel-compare-smoke-"));
const downloadRoot = path.join(temporaryDirectory, "downloads");

try {
  await run(process.execPath, ["scripts/generate-excel-compare-fixtures.mjs", temporaryDirectory]);
  await fs.mkdir(downloadRoot);
  await fs.writeFile(path.join(temporaryDirectory, "direction-left.csv"), "ID,Value\nA,left", "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "direction-right.csv"), "ID,Value\nA,left\nB,right-only", "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "amount-left.csv"), "Amount\n10\n10", "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "amount-right.csv"), "Amount\n10\n10\n10", "utf8");
  const fixture = (name) => path.join(temporaryDirectory, name);
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("worklazy_privacy_consent", "granted");
      globalThis.__excelCompareRevokedUrls = [];
      const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => {
        globalThis.__excelCompareRevokedUrls.push(url);
        revokeObjectUrl(url);
      };
    });
    const client = await page.createCDPSession();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().includes("excelCompare.worker")) setTimeout(() => request.continue(), 250);
      else void request.continue();
    });
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === new URL(baseUrl).origin) failedRequests.push(`${request.url()} ${request.failure()?.errorText || "unknown"}`);
    });

    const navigation = await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const responseHeaders = navigation?.headers() ?? {};
    const isolation = await page.evaluate(() => ({
      crossOriginIsolated,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    }));
    isolation.coop = responseHeaders["cross-origin-opener-policy"] ?? "absent";
    isolation.coep = responseHeaders["cross-origin-embedder-policy"] ?? "absent";
    const initial = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent || "",
      modes: document.querySelectorAll('[data-testid=excel-compare-mode-grid] button[role="radio"]').length,
      supportRows: document.querySelectorAll("[data-testid=excel-support-table] tbody tr").length,
      inputCount: document.querySelectorAll('[data-testid=excel-compare-page] input[type="file"]').length,
      dragButtons: document.querySelectorAll('[data-testid=excel-compare-page] [data-testid=excel-pair-drop-zone][role="button"] [data-slot="button"]').length,
      ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
      isolated: Boolean(document.querySelector('meta[name="worklazy-video-isolation"], meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]')),
    }));
    if (initial.title !== "Excel 비교·대사" || initial.modes !== 3 || initial.supportRows !== 6 || initial.inputCount !== 1 || initial.dragButtons !== 1 || !initial.ads || initial.isolated) {
      throw new Error(`Initial Excel comparison UI or standard ad boundary is incomplete: ${JSON.stringify(initial)}`);
    }

    let inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[0].uploadFile(fixture("left.xlsx"), fixture("right.xlsx"));
    await page.waitForFunction(() => document.querySelector("[data-testid=excel-pair-swap]")?.disabled);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2 && !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    if (await page.$eval("[data-testid=excel-pair-swap]", (button) => button.disabled)) throw new Error("Pair swap did not become available after both inspections completed.");
    const namesBeforeSwap = await selectedPairNames(page);
    await page.click("[data-testid=excel-pair-swap]");
    const namesAfterSwap = await selectedPairNames(page);
    if (JSON.stringify(namesAfterSwap) !== JSON.stringify([...namesBeforeSwap].reverse())) throw new Error(`Pair files did not swap: ${JSON.stringify({ namesBeforeSwap, namesAfterSwap })}`);
    await page.click("[data-testid=excel-pair-swap]");
    await inputs[0].uploadFile(fixture("sample.csv"), fixture("damaged.xlsx"));
    await page.waitForFunction(() => document.querySelector("[data-testid=excel-pair-overflow]")?.textContent?.includes("2개"));
    if (JSON.stringify(await selectedPairNames(page)) !== JSON.stringify(namesBeforeSwap)) throw new Error("An overflow drop replaced an occupied slot.");
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const onePair = await downloadReportLinks(page, client, downloadRoot, "one-pair");
    if (onePair.length !== 1 || !onePair[0].name.endsWith(".xlsx")) {
      const state = await page.evaluate(() => ({ progress: document.querySelector(".ui-operation-progress")?.textContent || "", errors: [...document.querySelectorAll("[data-testid=excel-compare-error]")].map((item) => item.textContent || "") }));
      throw new Error(`One pair must create one XLSX and no ZIP: ${JSON.stringify({ onePair, state, pageErrors })}`);
    }
    const onePairSummary = await assertNineSheetReport(onePair[0].bytes, {
      matched: 8, changed: 2, added: 0, removed: 0, duplicate: 0, ambiguous: 0, unmatched: 0, error: 0,
    });
    const previousReportUrl = await page.$eval('[data-testid=excel-report-downloads] a[download$=".xlsx"]', (anchor) => anchor.href);

    await page.click("[data-testid=excel-add-pair]");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 2);
    inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[1].uploadFile(fixture("formula.xlsb"), fixture("macro.xlsm"));
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 4 && !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click("[data-testid=excel-add-pair]");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 3);
    inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[2].uploadFile(fixture("damaged.xlsx"), fixture("macro.xlsm"));
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 5 && document.querySelector("[data-testid=excel-file-error]") && !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    const formatLabels = await page.$$eval("[data-testid=excel-sheet-fields] p", (items) => items.map((item) => item.textContent || ""));
    if (!formatLabels.some((text) => text.includes("XLSB") && text.includes("서식 비교 제외")) || !formatLabels.some((text) => text.includes("XLSM") && text.includes("서식 비교 가능"))) {
      throw new Error(`Format support labels do not match the fixed matrix: ${JSON.stringify(formatLabels)}`);
    }
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForFunction((url) => !Array.from(document.querySelectorAll("[data-testid=excel-report-downloads] a")).some((anchor) => anchor.href === url), {}, previousReportUrl);
    await page.waitForFunction((url) => globalThis.__excelCompareRevokedUrls.includes(url), {}, previousReportUrl);
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const multiPair = await downloadReportLinks(page, client, downloadRoot, "multi-pair");
    const reports = multiPair.filter((item) => item.name.endsWith(".xlsx"));
    const archives = multiPair.filter((item) => item.name.endsWith(".zip"));
    if (reports.length !== 2 || archives.length !== 1) throw new Error(`Two successful pairs must create two reports and one ZIP: ${JSON.stringify(multiPair.map(({ name }) => name))}`);
    const isolatedFailure = await page.$eval("[data-testid=excel-compare-error]", (element) => element.textContent || "");
    if (!isolatedFailure.includes("damaged.xlsx") || !isolatedFailure.includes("macro.xlsm") || isolatedFailure.includes("DAMAGED_FILE") || isolatedFailure.includes("PROCESSING_FAILED")) {
      throw new Error(`A failed pair was not isolated behind a user-facing message: ${isolatedFailure}`);
    }
    const multiSummaries = [];
    for (const report of reports) multiSummaries.push(await assertNineSheetReport(report.bytes));
    const archive = await JSZip.loadAsync(archives[0].bytes);
    const archiveNames = Object.values(archive.files).filter((entry) => !entry.dir).map((entry) => entry.name);
    if (archiveNames.length !== 2 || archiveNames.some((name) => !name.endsWith(".xlsx") || name.includes("/") || name.includes("\\"))) {
      throw new Error(`ZIP report names were not safely bounded: ${JSON.stringify(archiveNames)}`);
    }

    const filters = await page.$$eval("[data-testid=excel-status-filters] button", (buttons) => buttons.map((button) => ({
      text: button.textContent?.trim() || "",
      color: getComputedStyle(button.querySelector("span")).backgroundColor,
    })));
    if (filters.length !== 8 || filters.some((item) => !item.text || item.color === "rgba(0, 0, 0, 0)")) throw new Error(`Status filters need both text and color: ${JSON.stringify(filters)}`);
    const rowsBeforeSearch = await page.$$eval("[data-testid=excel-result-table] tbody tr", (rows) => rows.length);
    await page.type("[data-testid=excel-result-search] input", "updated");
    await page.waitForFunction((before) => {
      const count = document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length;
      return count > 0 && count <= before;
    }, {}, rowsBeforeSearch);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[0].uploadFile(fixture("cancel-left.xlsx"), fixture("cancel-right.xlsx"));
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2 && !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector("[data-testid=excel-compare-cancel]");
    await page.click("[data-testid=excel-compare-cancel]");
    await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-error")?.textContent?.includes("취소"));

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const mobileLayout = await page.evaluate(() => {
      const dropZone = document.querySelector("[data-testid=excel-compare-page] [data-testid=excel-pair-drop-zone]");
      const sectionCard = document.querySelector(".ui-section-card");
      const hint = dropZone?.querySelector('[data-ui-part="drop-hint"]');
      const protectedHintSegment = Array.from(hint?.querySelectorAll('[data-ui-part="drop-hint-segment"]') ?? []).find((segment) => segment.textContent?.includes("SpreadsheetML"));
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pairColumns: getComputedStyle(document.querySelector("[data-testid=excel-pair-files]")).gridTemplateColumns,
        actionHeight: document.querySelector("[data-testid=excel-compare-page] [data-testid=excel-pair-drop-zone] [data-slot=button]")?.getBoundingClientRect().height || 0,
        dropOverflow: (dropZone?.scrollWidth || 0) - (dropZone?.clientWidth || 0),
        dropRadius: dropZone ? getComputedStyle(dropZone).borderRadius : "",
        cardRadius: sectionCard ? getComputedStyle(sectionCard).borderRadius : "",
        hintText: hint?.textContent || "",
        protectedHintSegmentLines: protectedHintSegment?.getClientRects().length || 0,
      };
    });
    const mobileBottom = await assertMobileBottomLayout(page, {
      bottomTargetSelector: "[data-testid=excel-compare-page] > :last-child",
      scenarioId: "excel-compare-smoke-mobile-bottom",
    });
    const mobile = { ...mobileLayout, ...mobileBottom };
    if (
      mobile.overflow > 1
      || mobile.pairColumns.split(" ").length !== 1
      || mobile.actionHeight < 44
      || mobile.dropOverflow > 1
      || Number.parseFloat(mobile.dropRadius) < 12
      || mobile.hintText !== "XLSX·XLSM·XLS·XLSB·SpreadsheetML .xls·CSV"
      || mobile.protectedHintSegmentLines !== 1
    ) throw new Error(`Mobile layout, drop-zone polish, or navigation clearance failed: ${JSON.stringify(mobile)}`);

    const b4Affordance = await assertB4Affordance(page, fixture("left.xlsx"), fixture("right.xlsx"));
    const integrityFailures = [];
    for (const mode of ["zero", "mismatch"]) integrityFailures.push(await assertIntegrityFailure(browser, fixture("left.xlsx"), fixture("right.xlsx"), mode));
    const swapDirection = await assertSwapDirection(browser, path.join(temporaryDirectory, "direction-left.csv"), path.join(temporaryDirectory, "direction-right.csv"));
    const optionalReconciliation = await assertOptionalReconciliation(browser, path.join(temporaryDirectory, "amount-left.csv"), path.join(temporaryDirectory, "amount-right.csv"), downloadRoot);

    if (pageErrors.length) throw new Error(`Browser page errors:\n${pageErrors.join("\n")}`);
    if (failedRequests.length) throw new Error(`Same-origin request failures:\n${failedRequests.join("\n")}`);
    console.log(JSON.stringify({
      onePairDownloads: onePair.map(({ name, size }) => ({ name, size })),
      onePairSummary,
      multiPairDownloads: multiPair.map(({ name, size }) => ({ name, size })),
      multiSummaries,
      zipEntries: archiveNames,
      isolation,
      replacementRevokedAfterAnchorRemoval: previousReportUrl,
      integrityFailures,
      pairAssignment: { namesBeforeSwap, namesAfterSwap, overflowRejected: 2 },
      swapDirection,
      optionalReconciliation,
      isolatedFailure,
      statusFilters: filters.map(({ text }) => text),
      b4Affordance,
      cancellation: "passed",
      mobile,
    }, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function downloadReportLinks(page, client, root, phase) {
  const directory = path.join(root, phase);
  await fs.mkdir(directory);
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
  const names = await page.$$eval("[data-testid=excel-report-downloads] [data-testid=excel-report-download]", (items) => items.map((item) => item.download));
  const results = [];
  for (let index = 0; index < names.length; index += 1) {
    await page.$$eval("[data-testid=excel-report-downloads] [data-testid=excel-report-download]", (items, selected) => items[selected].click(), index);
    const savedPath = await waitForDownload(directory, names[index]);
    const bytes = await fs.readFile(savedPath);
    if (bytes.byteLength === 0 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      throw new Error(`Downloaded report failed the size or ZIP signature check: ${names[index]} (${bytes.byteLength} bytes)`);
    }
    results.push({ name: names[index], bytes, size: bytes.byteLength, savedPath });
  }
  return results;
}

async function assertNineSheetReport(bytes, expectedSummary) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const names = workbook.worksheets.map((sheet) => sheet.name);
  const expected = ["Summary", "Parameters", "Matched", "Changed", "Added", "Removed", "Duplicates", "Ambiguous", "Errors"];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Report topology differs from the nine-sheet contract: ${JSON.stringify(names)}`);
  workbook.worksheets.forEach((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
    if (typeof cell.value !== "string" || cell.formula !== undefined) throw new Error(`Report cell was not serialized as untrusted text: ${sheet.name}!${cell.address}`);
  })));
  const summary = Object.fromEntries(workbook.getWorksheet("Summary").getRows(2, 8).map((row) => [String(row.getCell(1).value), Number(row.getCell(2).value)]));
  if (Object.values(summary).some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error(`Summary values are invalid: ${JSON.stringify(summary)}`);
  if (expectedSummary && JSON.stringify(summary) !== JSON.stringify(expectedSummary)) throw new Error(`Summary values differ: ${JSON.stringify(summary)}`);
  return summary;
}

async function waitForDownload(directory, fileName) {
  const target = path.join(directory, fileName);
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const entries = await fs.readdir(directory);
    if (entries.includes(fileName) && !entries.some((name) => name.endsWith(".crdownload"))) return target;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Excel comparison download did not finish: ${fileName}`);
}

async function selectedPairNames(page) {
  return page.$$eval('[data-testid="excel-compare-pair"]:first-of-type [data-testid=excel-selected-file] strong', (items) => items.map((item) => item.textContent || ""));
}

async function assertB4Affordance(page, leftPath, rightPath) {
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=excel-add-pair]");
  await page.click("[data-testid=excel-compare-mode-grid] button:nth-child(2)");
  await new Promise((resolve) => setTimeout(resolve, 240));
  const contrast = await page.evaluate(() => {
    const selected = document.querySelector("[data-testid=excel-compare-mode-grid] [data-selected=true]");
    const adjacent = document.querySelector("[data-testid=excel-compare-mode-grid] button:not([data-selected])");
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const parse = (value) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const composite = ([red, green, blue, alpha], backdrop) => {
      const opacity = alpha / 255;
      return [red, green, blue].map((channel, index) => channel * opacity + backdrop[index] * (1 - opacity));
    };
    const luminance = (channels) => {
      const linear = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const border = getComputedStyle(selected).borderTopColor;
    const background = getComputedStyle(adjacent).backgroundColor;
    const pageBackground = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    const values = [
      luminance(composite(parse(border), pageBackground)),
      luminance(composite(parse(background), pageBackground)),
    ].sort((a, b) => b - a);
    return { border, background, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
  });

  const addBefore = await page.$eval("[data-testid=excel-add-pair]", (button) => ({
    width: button.getBoundingClientRect().width,
    height: button.getBoundingClientRect().height,
    background: getComputedStyle(button).backgroundColor,
    shadow: getComputedStyle(button).boxShadow,
    hoverClass: button.className.includes("hover:bg-green-500/10!"),
  }));
  await page.hover("[data-testid=excel-add-pair]");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const addHover = await page.$eval("[data-testid=excel-add-pair]", (button) => getComputedStyle(button).backgroundColor);
  await page.keyboard.press("Tab");
  await page.focus("[data-testid=excel-add-pair]");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const addFocus = await page.$eval("[data-testid=excel-add-pair]", (button) => ({ shadow: getComputedStyle(button).boxShadow, visible: button.matches(":focus-visible") }));

  const input = await page.$('[data-testid=excel-compare-page] input[type="file"]');
  await input.uploadFile(leftPath, rightPath);
  await page.waitForFunction(() => !document.querySelector("[data-testid=excel-pair-swap]")?.disabled);
  const swapBefore = await page.$eval("[data-testid=excel-pair-swap]", (button) => ({
    width: button.getBoundingClientRect().width,
    height: button.getBoundingClientRect().height,
    background: getComputedStyle(button).backgroundColor,
    shadow: getComputedStyle(button).boxShadow,
    hoverClass: button.className.includes("hover:bg-green-500/10!"),
  }));
  await page.hover("[data-testid=excel-pair-swap]");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const swapHover = await page.$eval("[data-testid=excel-pair-swap]", (button) => getComputedStyle(button).backgroundColor);
  await page.keyboard.press("Tab");
  await page.focus("[data-testid=excel-pair-swap]");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const swapFocus = await page.$eval("[data-testid=excel-pair-swap]", (button) => ({ shadow: getComputedStyle(button).boxShadow, visible: button.matches(":focus-visible") }));
  const hoverCapable = await page.evaluate(() => matchMedia("(hover: hover)").matches);
  const result = { contrast, hoverCapable, add: { ...addBefore, hover: addHover, focus: addFocus }, swap: { ...swapBefore, hover: swapHover, focus: swapFocus } };
  if (contrast.ratio < 3 || addBefore.height < 44 || swapBefore.width < 44 || swapBefore.height < 44
    || !addBefore.hoverClass || !swapBefore.hoverClass
    || (hoverCapable && (addBefore.background === addHover || swapBefore.background === swapHover))
    || !addFocus.visible || !swapFocus.visible || addFocus.shadow === addBefore.shadow || swapFocus.shadow === swapBefore.shadow) {
    throw new Error(`B4 selected-card contrast or Swap/Add affordance failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function assertIntegrityFailure(browser, leftPath, rightPath, mode) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    await page.evaluate((injectionMode) => {
      const NativeBlob = Blob;
      Object.defineProperty(window, "Blob", {
        configurable: true,
        value: class extends NativeBlob {
          get size() {
            const actual = super.size;
            if (this.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return actual;
            return injectionMode === "zero" ? 0 : actual + 1;
          }
        },
      });
    }, mode);
    const inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[0].uploadFile(leftPath, rightPath);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2 && !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const message = await page.$eval("[data-testid=excel-compare-error]", (element) => element.textContent || "");
    if (!message.includes("다시 실행해 내려받아") || /REPORT_|Worker|worker|ArrayBuffer|Blob/u.test(message)) {
      throw new Error(`Integrity failure did not use the safe retry guidance (${mode}): ${message}`);
    }
    if (await page.$("[data-testid=excel-report-downloads] a")) throw new Error(`Integrity failure exposed a download (${mode}).`);
    return { mode, message };
  } finally {
    await page.close();
  }
}

async function assertSwapDirection(browser, leftPath, rightPath) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const input = await page.$('[data-testid=excel-compare-page] input[type="file"]');
    await input.uploadFile(leftPath, rightPath);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2);
    await page.click('[data-testid=excel-compare-mode-grid] button:nth-child(2)');
    await page.waitForFunction(() => !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const before = await page.evaluate(() => ({
      added: document.querySelectorAll('[data-testid=excel-result-table] tbody tr[data-status="added"]').length,
      removed: document.querySelectorAll('[data-testid=excel-result-table] tbody tr[data-status="removed"]').length,
    }));
    await page.click("[data-testid=excel-pair-swap]");
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForFunction(() => document.querySelector(".ui-operation-progress")?.classList.contains("ui-status-running"));
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const after = await page.evaluate(() => ({
      added: document.querySelectorAll('[data-testid=excel-result-table] tbody tr[data-status="added"]').length,
      removed: document.querySelectorAll('[data-testid=excel-result-table] tbody tr[data-status="removed"]').length,
    }));
    if (before.added === 0 || before.removed !== 0 || after.removed !== before.added || after.added !== 0) {
      throw new Error(`Pair swap did not reverse added/removed semantics: ${JSON.stringify({ before, after })}`);
    }
    return { before, after };
  } finally {
    await page.close();
  }
}

async function assertOptionalReconciliation(browser, leftPath, rightPath, root) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const client = await page.createCDPSession();
    const input = await page.$('[data-testid=excel-compare-page] input[type="file"]');
    await input.uploadFile(leftPath, rightPath);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2);
    await page.click('[data-testid=excel-compare-mode-grid] button:nth-child(3)');
    await page.waitForSelector('[data-reconcile-field="leftDateColumn"] select');

    await page.select('[data-reconcile-field="leftDateColumn"] select', "");
    await page.waitForFunction(() => ["leftDateColumn", "rightDateColumn"].every((key) => document.querySelector(`[data-reconcile-field="${key}"] select`)?.value === ""));
    await page.select('[data-reconcile-field="rightDateColumn"] select', "1");
    await page.waitForFunction(() => ["leftDateColumn", "rightDateColumn"].every((key) => document.querySelector(`[data-reconcile-field="${key}"] select`)?.value === "1"));
    await page.select('[data-reconcile-field="rightDateColumn"] select', "");
    await page.select('[data-reconcile-field="leftPartnerColumn"] select', "");
    await page.waitForFunction(() => ["leftDateColumn", "rightDateColumn", "leftPartnerColumn", "rightPartnerColumn"].every((key) => document.querySelector(`[data-reconcile-field="${key}"] select`)?.value === ""));
    const mappingState = await page.evaluate(() => ({
      dateToleranceDisabled: document.querySelector('[data-testid=excel-number-options] input[type="number"]')?.disabled,
      compareDisabled: document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled,
      unusedLabels: Array.from(document.querySelectorAll('[data-testid=excel-reconcile-grid] option[value=""]'), (option) => option.textContent || ""),
    }));
    if (!mappingState.dateToleranceDisabled || mappingState.compareDisabled || mappingState.unusedLabels.length !== 4 || mappingState.unusedLabels.some((label) => label !== "사용 안 함")) {
      throw new Error(`Optional reconciliation mapping UI is inconsistent: ${JSON.stringify(mappingState)}`);
    }
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const report = (await downloadReportLinks(page, client, root, "amount-only"))[0];
    const summary = await assertNineSheetReport(report.bytes, {
      matched: 0, changed: 0, added: 0, removed: 0, duplicate: 0, ambiguous: 2, unmatched: 3, error: 0,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(report.bytes);
    const sheet = workbook.getWorksheet("Parameters");
    const parameters = Object.fromEntries(sheet.getRows(2, sheet.rowCount - 1).map((row) => [String(row.getCell(1).value), String(row.getCell(2).value)]));
    for (const key of ["reconcileLeftDateColumn", "reconcileRightDateColumn", "reconcileLeftPartnerColumn", "reconcileRightPartnerColumn", "reconcileDateToleranceDays"]) {
      if (parameters[key] !== "UNUSED") throw new Error(`Amount-only report did not mark ${key} as UNUSED: ${parameters[key]}`);
    }
    if (parameters.reconciliationCandidatesPerTarget !== "10") throw new Error(`Candidate limit did not match Parameters: ${parameters.reconciliationCandidatesPerTarget}`);
    return { size: report.size, summary, unused: "date+partner", candidateLimit: parameters.reconciliationCandidatesPerTarget };
  } finally {
    await page.close();
  }
}
