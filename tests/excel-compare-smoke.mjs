import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";

import { assertMobileBottomLayout } from "./mobile-bottom-assertion.mjs";
import { assertVisibleXlsxReport } from "./xlsx-report-assertions.mjs";

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
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-left-a.csv"), `Key,Value\nA,${"x".repeat(17_000)}\nA,tail`, "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-right-a.csv"), "Key,Value\nA,right", "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-left-b.csv"), `Key,Value\nB,${"y".repeat(17_000)}\nB,tail`, "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-right-b.csv"), "Key,Value\nB,right", "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-key-too-long-left.csv"), `Key\n${"k".repeat(32_768)}\n${"k".repeat(32_768)}`, "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-key-too-long-right.csv"), "Key\nother", "utf8");
  await writeTypedKeyWorkbook(path.join(temporaryDirectory, "typed-key-left.xlsx"), "before");
  await writeTypedKeyWorkbook(path.join(temporaryDirectory, "typed-key-right.xlsx"), "after");
  const groupedUiLeft = ["Key,Value"];
  const groupedUiRight = ["Key,Value"];
  for (let index = 0; index < 51; index += 1) groupedUiLeft.push(`K000,left-zero-${index}`);
  for (let index = 0; index < 51; index += 1) {
    groupedUiLeft.push(`K002,${index === 0 ? `dialog-${"x".repeat(220)}` : `left-two-${index}`}`);
    groupedUiRight.push(`K002,right-two-${index}`);
  }
  for (let group = 3; group <= 500; group += 1) {
    const key = `K${String(group).padStart(3, "0")}`;
    groupedUiLeft.push(`${key},left-${group}-a`, `${key},left-${group}-b`);
    groupedUiRight.push(`${key},right-${group}`);
  }
  groupedUiRight.push("K001,right-only-first", "K001,right-only-tail-value");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-ui-left.csv"), `${groupedUiLeft.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(temporaryDirectory, "duplicate-ui-right.csv"), `${groupedUiRight.join("\n")}\n`, "utf8");
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
      dropZones: Array.from(document.querySelectorAll('[data-testid=excel-compare-page] [data-testid=excel-pair-drop-zone]'), (zone) => ({
        role: zone.getAttribute("role"),
        fileButtons: zone.querySelectorAll('[data-slot="button"]').length,
      })),
      ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
      isolated: Boolean(document.querySelector('meta[name="worklazy-video-isolation"], meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]')),
    }));
    if (initial.title !== "Excel 비교·대사" || initial.modes !== 3 || initial.supportRows !== 6 || initial.inputCount !== 1
      || initial.dropZones.length !== 1 || initial.dropZones.some(({ role, fileButtons }) => role !== null || fileButtons !== 1) || !initial.ads || initial.isolated) {
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
    const groupedDuplicates = await assertGroupedDuplicateDownloads(browser, {
      leftA: path.join(temporaryDirectory, "duplicate-left-a.csv"),
      rightA: path.join(temporaryDirectory, "duplicate-right-a.csv"),
      leftB: path.join(temporaryDirectory, "duplicate-left-b.csv"),
      rightB: path.join(temporaryDirectory, "duplicate-right-b.csv"),
    }, downloadRoot);
    const groupedDuplicateUi = await assertGroupedDuplicateUi(browser, {
      left: path.join(temporaryDirectory, "duplicate-ui-left.csv"),
      right: path.join(temporaryDirectory, "duplicate-ui-right.csv"),
    });
    const standardKeyDisplay = await assertStandardKeyDisplay(browser, {
      left: path.join(temporaryDirectory, "typed-key-left.xlsx"),
      right: path.join(temporaryDirectory, "typed-key-right.xlsx"),
    }, downloadRoot);
    const duplicateKeyTooLong = [];
    for (const language of ["ko", "en"]) {
      duplicateKeyTooLong.push(await assertDuplicateKeyTooLongIsolation(browser, {
        validLeftA: path.join(temporaryDirectory, "duplicate-left-a.csv"),
        validRightA: path.join(temporaryDirectory, "duplicate-right-a.csv"),
        invalidLeft: path.join(temporaryDirectory, "duplicate-key-too-long-left.csv"),
        invalidRight: path.join(temporaryDirectory, "duplicate-key-too-long-right.csv"),
        validLeftB: path.join(temporaryDirectory, "duplicate-left-b.csv"),
        validRightB: path.join(temporaryDirectory, "duplicate-right-b.csv"),
      }, downloadRoot, language));
    }

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
      groupedDuplicates,
      groupedDuplicateUi,
      standardKeyDisplay,
      duplicateKeyTooLong,
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
  await assertVisibleXlsxReport(bytes);
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

async function assertGroupedDuplicateDownloads(browser, files, root) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const client = await page.createCDPSession();
    let inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[0].uploadFile(files.leftA, files.rightA);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2);
    await page.click('[data-testid=excel-compare-mode-grid] button:nth-child(2)');
    await page.select('[data-testid=excel-pair-mode-options] select', "error");
    await page.click("[data-testid=excel-add-pair]");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 2);
    inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[1].uploadFile(files.leftB, files.rightB);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 4);
    const policySelectors = await page.$$('[data-testid=excel-pair-mode-options] select');
    await policySelectors[1].select("error");
    await page.waitForFunction(() => !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const downloads = await downloadReportLinks(page, client, root, "grouped-duplicates");
    const reports = downloads.filter((item) => item.name.endsWith(".xlsx"));
    const zipFile = downloads.find((item) => item.name.endsWith(".zip"));
    if (reports.length !== 2 || !zipFile) throw new Error(`Grouped duplicate run must create two reports and one ZIP: ${downloads.map((item) => item.name).join(", ")}`);

    const direct = [];
    for (const report of reports) direct.push(await assertGroupedDuplicateReport(report.bytes));
    const archive = await JSZip.loadAsync(zipFile.bytes);
    const zipped = [];
    for (const entry of Object.values(archive.files).filter((candidate) => !candidate.dir)) {
      zipped.push(await assertGroupedDuplicateReport(await entry.async("uint8array")));
    }
    if (zipped.length !== 2) throw new Error(`Grouped duplicate ZIP must contain two reports: ${zipped.length}`);
    return { direct, zipped, zipBytes: zipFile.size };
  } finally {
    await page.close();
  }
}

async function assertGroupedDuplicateUi(browser, files) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const input = await page.$('[data-testid=excel-compare-page] input[type="file"]');
    await input.uploadFile(files.left, files.right);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2);
    await page.click('[data-testid=excel-compare-mode-grid] button:nth-child(2)');
    await page.waitForFunction(() => !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    await page.$$eval('[data-testid=excel-status-filters] button:not([data-status="duplicate"])', (buttons) => buttons.forEach((button) => button.click()));
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length === 500);

    const collapsed = await page.evaluate(() => ({
      rows: document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length,
      duplicateLists: document.querySelectorAll("[data-testid=excel-duplicate-list]").length,
      countText: document.querySelector("[data-testid=excel-duplicate-guidance] strong")?.textContent?.trim() || "",
      hasInternalText: /string:|number:|DUPLICATE_KEY/u.test(document.querySelector("[data-testid=excel-result-table]")?.textContent || ""),
      showMore: document.querySelector("[data-testid=excel-result-show-more]")?.textContent?.trim() || "",
      firstRightEmpty: document.querySelector("[data-testid=excel-duplicate-row]:first-child [data-testid=excel-duplicate-empty][data-side=right]")?.textContent?.trim() || "",
      firstRightButtons: document.querySelectorAll("[data-testid=excel-duplicate-row]:first-child [data-side=right] button").length,
    }));
    if (collapsed.rows !== 500 || collapsed.duplicateLists !== 0 || collapsed.countText !== "중복 키 501개" || collapsed.showMore !== "결과 더 보기 (1개 남음)"
      || collapsed.firstRightEmpty !== "오른쪽 0건" || collapsed.firstRightButtons !== 0
      || collapsed.hasInternalText) {
      throw new Error(`Grouped duplicate collapsed state, display key, or 500-group limit is invalid: ${JSON.stringify(collapsed)}`);
    }

    await setResultSearch(page, "right-only-tail-value");
    const valueSearch = await page.evaluate(() => ({
      rows: document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length,
      text: document.querySelector("[data-testid=excel-result-table] tbody")?.textContent || "",
      lists: document.querySelectorAll("[data-testid=excel-duplicate-list]").length,
    }));
    if (valueSearch.rows !== 1 || !valueSearch.text.includes("K001") || valueSearch.text.includes("right-only-tail-value") || valueSearch.lists !== 0) {
      throw new Error(`Search did not inspect a value outside the closed DOM: ${JSON.stringify(valueSearch)}`);
    }
    await setResultSearch(page, "552");
    const rowSearch = await page.evaluate(() => ({
      rows: document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length,
      text: document.querySelector("[data-testid=excel-result-table] tbody")?.textContent || "",
    }));
    if (rowSearch.rows < 1 || !rowSearch.text.includes("K001") || !rowSearch.text.includes("왼쪽 0건")) {
      throw new Error(`Search did not inspect every source row number outside the closed DOM: ${JSON.stringify(rowSearch)}`);
    }
    await setResultSearch(page, "");
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length === 500);
    await page.click("[data-testid=excel-result-show-more]");
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length === 501);
    const lastGroup = await page.$eval("[data-testid=excel-duplicate-row]:last-child", (row) => ({
      text: row.textContent || "",
      leftButtons: row.querySelectorAll('[data-side="left"] button').length,
    }));
    if (!lastGroup.text.includes("K001") || !lastGroup.text.includes("왼쪽 0건") || lastGroup.leftButtons !== 0) {
      throw new Error(`The 501st group or zero-side text is invalid: ${JSON.stringify(lastGroup)}`);
    }

    await page.click('[data-testid=excel-status-filters] button[data-status="duplicate"]');
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length === 0);
    await page.click('[data-testid=excel-status-filters] button[data-status="duplicate"]');
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length === 500);

    const secondRow = "[data-testid=excel-duplicate-row]:nth-child(2)";
    await page.click(`${secondRow} [data-testid=excel-duplicate-toggle][data-side=left]`);
    await page.waitForFunction((selector) => document.querySelectorAll(`${selector} [data-testid=excel-duplicate-list][data-side=left] li`).length === 50, {}, secondRow);
    const independentBeforeMore = await page.$eval(secondRow, (row) => ({
      leftItems: row.querySelectorAll('[data-testid=excel-duplicate-list][data-side="left"] li').length,
      rightLists: row.querySelectorAll('[data-testid=excel-duplicate-list][data-side="right"]').length,
      leftExpanded: row.querySelector('[data-testid=excel-duplicate-toggle][data-side="left"]')?.getAttribute("aria-expanded"),
      rightExpanded: row.querySelector('[data-testid=excel-duplicate-toggle][data-side="right"]')?.getAttribute("aria-expanded"),
    }));
    if (JSON.stringify(independentBeforeMore) !== JSON.stringify({ leftItems: 50, rightLists: 0, leftExpanded: "true", rightExpanded: "false" })) {
      throw new Error(`Duplicate sides did not expand independently at 50 rows: ${JSON.stringify(independentBeforeMore)}`);
    }
    await page.click(`${secondRow} [data-testid=excel-duplicate-show-more][data-side=left]`);
    await page.waitForFunction((selector) => document.querySelectorAll(`${selector} [data-testid=excel-duplicate-list][data-side=left] li`).length === 51, {}, secondRow);
    await page.click(`${secondRow} [data-testid=excel-duplicate-toggle][data-side=right]`);
    await page.waitForFunction((selector) => document.querySelectorAll(`${selector} [data-testid=excel-duplicate-list][data-side=right] li`).length === 50, {}, secondRow);

    const fullValueTrigger = await page.$(`${secondRow} [data-testid=excel-full-value-trigger][data-side=left]`);
    await fullValueTrigger.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid=excel-full-value-dialog][role="dialog"]');
    const dialog = await page.$eval('[data-testid=excel-full-value-dialog]', (element) => ({
      label: element.getAttribute("aria-labelledby"),
      text: element.textContent || "",
    }));
    if (!dialog.label || !dialog.text.includes("전체 값") || !dialog.text.includes(`dialog-${"x".repeat(220)}`)) {
      throw new Error(`Full-value dialog is not named or lossless: ${JSON.stringify({ ...dialog, text: dialog.text.slice(0, 80) })}`);
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[data-testid=excel-full-value-dialog]"));
    const focusReturned = await page.evaluate(() => document.activeElement?.matches('[data-testid=excel-full-value-trigger][data-side="left"]'));
    if (!focusReturned) throw new Error("Full-value dialog did not return focus to its keyboard trigger after Escape.");

    await page.click(`${secondRow} [data-testid=excel-duplicate-toggle][data-side=left]`);
    const independentAfterClose = await page.$eval(secondRow, (row) => ({
      leftLists: row.querySelectorAll('[data-testid=excel-duplicate-list][data-side="left"]').length,
      rightItems: row.querySelectorAll('[data-testid=excel-duplicate-list][data-side="right"] li').length,
      nestedButtons: row.querySelectorAll('button button').length,
      minimumTargetHeight: Math.min(...Array.from(row.querySelectorAll("button"), (button) => button.getBoundingClientRect().height)),
    }));
    if (independentAfterClose.leftLists !== 0 || independentAfterClose.rightItems !== 50 || independentAfterClose.nestedButtons !== 0 || independentAfterClose.minimumTargetHeight < 44) {
      throw new Error(`Independent close, button nesting, or touch targets are invalid: ${JSON.stringify(independentAfterClose)}`);
    }
    const layout = await page.$eval(secondRow, (row) => {
      const lineCount = (element) => {
        const range = document.createRange();
        const text = element.firstChild;
        if (!text) return 0;
        const lines = new Set();
        for (let index = 0; index < text.length; index += 1) {
          if (!text.data[index].trim()) continue;
          range.setStart(text, index);
          range.setEnd(text, index + 1);
          lines.add(range.getBoundingClientRect().y);
        }
        return lines.size;
      };
      const table = row.closest("table");
      const region = table.parentElement;
      const headers = [...table.querySelectorAll("th")];
      return {
        statusLines: lineCount(row.cells[1].querySelector("span")),
        reasonLines: lineCount(row.cells[6]),
        statusWidth: row.cells[1].getBoundingClientRect().width,
        reasonWidth: row.cells[6].getBoundingClientRect().width,
        keyWidth: row.cells[3].getBoundingClientRect().width,
        statusWhiteSpace: getComputedStyle(row.cells[1]).whiteSpace,
        reasonWhiteSpace: getComputedStyle(row.cells[6]).whiteSpace,
        headerWhiteSpace: headers.map((header) => getComputedStyle(header).whiteSpace),
        tableWidth: table.getBoundingClientRect().width,
        regionWidth: region.getBoundingClientRect().width,
      };
    });
    if (layout.statusLines !== 1 || layout.reasonLines !== 1 || layout.statusWhiteSpace !== "nowrap" || layout.reasonWhiteSpace !== "nowrap"
      || layout.headerWhiteSpace.some((value) => value !== "nowrap") || layout.keyWidth < 128 || layout.tableWidth <= layout.regionWidth) {
      throw new Error(`Grouped result status, reason, header, key width, or named horizontal scroll layout is invalid: ${JSON.stringify(layout)}`);
    }
    return { collapsed, valueSearch, rowSearch, lastGroup, independentBeforeMore, independentAfterClose, layout, dialogNamed: true, keyboardOpen: true, escapeClosed: true, focusReturned };
  } finally {
    await page.close();
  }
}

async function assertStandardKeyDisplay(browser, files, root) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const client = await page.createCDPSession();
    const input = await page.$('[data-testid=excel-compare-page] input[type="file"]');
    await input.uploadFile(files.left, files.right);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2);
    await page.click('[data-testid=excel-compare-mode-grid] button:nth-child(2)');
    await page.waitForFunction(() => !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");

    const inspectRows = () => page.$$eval("[data-testid=excel-result-table] tbody tr", (rows) => ({
      keys: rows.map((row) => row.cells[3]?.textContent?.trim() || ""),
      values: rows.map((row) => row.cells[4]?.textContent?.trim() || ""),
      internal: rows.filter((row) => /(?:number|string):|DUPLICATE_KEY|REPORT_INTEGRITY_FAILED|PROCESSING_FAILED/u.test(row.textContent || "")).map((row) => row.textContent || ""),
    }));
    const beforeFilter = await inspectRows();
    if (beforeFilter.internal.length || !["1", "2", "Unique"].every((key) => beforeFilter.keys.includes(key))) {
      throw new Error(`Standard typed keys are not public display values before filtering: ${JSON.stringify(beforeFilter)}`);
    }

    await page.$$eval('[data-testid=excel-status-filters] button:not([data-status="changed"])', (buttons) => buttons.forEach((button) => button.click()));
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-result-table] tbody tr").length === 4);
    const afterFilter = await inspectRows();
    if (afterFilter.internal.length || JSON.stringify(afterFilter.keys.sort()) !== JSON.stringify(["1", "1", "2", "Unique"].sort())) {
      throw new Error(`Standard typed keys are not public display values after filtering: ${JSON.stringify(afterFilter)}`);
    }
    if (!afterFilter.values.some((value) => value.includes("before-number-one")) || !afterFilter.values.some((value) => value.includes("before-text-one"))) {
      throw new Error(`Number and text keys with the same display did not remain independent: ${JSON.stringify(afterFilter)}`);
    }

    const downloads = await downloadReportLinks(page, client, root, "standard-key-display");
    const report = downloads.find((item) => item.name.endsWith(".xlsx"));
    if (!report) throw new Error("Standard key display comparison did not produce an XLSX report.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(report.bytes);
    const changed = workbook.getWorksheet("Changed");
    const reportKeys = changed.getRows(2, changed.rowCount - 1).map((row) => String(row.getCell(9).value ?? ""));
    if (reportKeys.some((key) => /^(?:number|string):/u.test(key)) || JSON.stringify(reportKeys.sort()) !== JSON.stringify(["1", "1", "2", "Unique"].sort())) {
      throw new Error(`Standard report Key cells expose normalized identities: ${JSON.stringify(reportKeys)}`);
    }
    return { beforeFilter, afterFilter, reportKeys };
  } finally {
    await page.close();
  }
}

async function writeTypedKeyWorkbook(filePath, label) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(["Key", "Value"]);
  sheet.addRow([1, `${label}-number-one`]);
  const textOne = sheet.addRow(["1", `${label}-text-one`]);
  textOne.getCell(1).numFmt = "@";
  sheet.addRow([2, `${label}-number-two`]);
  sheet.addRow(["Unique", `${label}-text-unique`]);
  await workbook.xlsx.writeFile(filePath);
}

async function setResultSearch(page, value) {
  await page.$eval("[data-testid=excel-result-search] input", (input, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter.call(input, nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertGroupedDuplicateReport(bytes) {
  const summary = await assertNineSheetReport(bytes, {
    matched: 0, changed: 0, added: 0, removed: 0, duplicate: 1, ambiguous: 0, unmatched: 0, error: 0,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const duplicates = workbook.getWorksheet("Duplicates");
  if (duplicates.columnCount !== 13 || duplicates.rowCount !== 4) throw new Error(`Grouped duplicate report shape is invalid: ${duplicates.rowCount}x${duplicates.columnCount}`);
  const rowNotations = duplicates.getRows(2, 3).map((row) => String(row.getCell(5).value ?? ""));
  const rightRows = duplicates.getRows(2, 3).map((row) => String(row.getCell(6).value ?? ""));
  if (JSON.stringify(rowNotations) !== JSON.stringify(["2 [1/2]", "2 [2/2]", "3"]) || JSON.stringify(rightRows) !== JSON.stringify(["2", "", ""])) {
    throw new Error(`Grouped duplicate row notation or independent-side exhaustion is invalid: ${JSON.stringify({ rowNotations, rightRows })}`);
  }
  const longValue = duplicates.getRows(2, 2).map((row) => String(row.getCell(10).value).slice("2: ".length)).join("");
  if (!/^[AB] \| [xy]{17000}$/u.test(longValue)) throw new Error(`Grouped duplicate long source row was not restored: ${longValue.length}`);
  const parametersSheet = workbook.getWorksheet("Parameters");
  const parameters = Object.fromEntries(parametersSheet.getRows(2, parametersSheet.rowCount - 1).map((row) => [String(row.getCell(1).value), String(row.getCell(2).value)]));
  const expected = {
    duplicateCountUnit: "key-group",
    duplicateReportSplit: "true",
    duplicateReportSplitGroupCount: "1",
    duplicateReportDataRows: "3",
    duplicateReportCellLimit: "32767",
    duplicateReportListCellLimit: "16000",
    duplicateReportMultilineKeyLimit: "16000",
    duplicateReportLayout: "independent-side-chunks-v1",
    "duplicateReportGroup.1": "Duplicates!2:4",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (parameters[key] !== value) throw new Error(`Grouped duplicate Parameter ${key} differs: ${parameters[key]}`);
  }
  return { summary, dataRows: duplicates.rowCount - 1, rowNotations, key: String(duplicates.getCell("I2").value) };
}

async function assertDuplicateKeyTooLongIsolation(browser, files, root, language) {
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(180_000);
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.goto(`${baseUrl}/${language}/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const client = await page.createCDPSession();
    let inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[0].uploadFile(files.validLeftA, files.validRightA);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 2);
    await page.click('[data-testid=excel-compare-mode-grid] button:nth-child(2)');
    await page.select('[data-testid=excel-pair-mode-options] select', "error");
    await page.click("[data-testid=excel-add-pair]");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 2);
    inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[1].uploadFile(files.invalidLeft, files.invalidRight);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 4);
    await page.click("[data-testid=excel-add-pair]");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 3);
    inputs = await page.$$('[data-testid=excel-compare-page] input[type="file"]');
    await inputs[2].uploadFile(files.validLeftB, files.validRightB);
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=excel-sheet-fields]").length === 6);
    for (const policy of await page.$$('[data-testid=excel-pair-mode-options] select')) await policy.select("error");
    await page.waitForFunction(() => !document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]')?.disabled);
    await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
    await page.waitForSelector(".ui-operation-progress.ui-status-success");
    const localizedUi = await page.$eval("[data-testid=excel-duplicate-row]", (row) => ({
      count: document.querySelector("[data-testid=excel-duplicate-guidance] strong")?.textContent?.trim() || "",
      left: row.querySelector('[data-testid=excel-duplicate-toggle][data-side="left"]')?.textContent?.trim() || "",
      right: row.querySelector('[data-testid=excel-duplicate-toggle][data-side="right"]')?.textContent?.trim() || "",
      key: row.querySelector("td:nth-child(4)")?.textContent?.trim() || "",
      table: document.querySelector("[data-testid=excel-result-table]")?.textContent || "",
    }));
    const expectedUi = language === "ko"
      ? { count: "중복 키 2개", left: "왼쪽 2건 보기", right: "오른쪽 1건 보기" }
      : { count: "2 duplicate keys", left: "Show 2 left rows", right: "Show 1 right row" };
    if (localizedUi.count !== expectedUi.count || localizedUi.left !== expectedUi.left || localizedUi.right !== expectedUi.right
      || !/^[AB]$/u.test(localizedUi.key) || localizedUi.table.includes("string:") || localizedUi.table.includes("DUPLICATE_KEY")) {
      throw new Error(`Grouped duplicate locale, plural, or public display is invalid (${language}): ${JSON.stringify(localizedUi)}`);
    }
    const downloads = await downloadReportLinks(page, client, root, `duplicate-key-too-long-${language}`);
    const reports = downloads.filter((item) => item.name.endsWith(".xlsx"));
    const archives = downloads.filter((item) => item.name.endsWith(".zip"));
    if (reports.length !== 2 || archives.length !== 1 || downloads.length !== 3) {
      throw new Error(`Two valid pairs and one overlong-key pair must create only two reports and one ZIP (${language}): ${downloads.map((item) => item.name).join(", ")}`);
    }
    const direct = [];
    for (const report of reports) direct.push(await assertGroupedDuplicateReport(report.bytes));
    const archive = await JSZip.loadAsync(archives[0].bytes);
    const entries = Object.values(archive.files).filter((entry) => !entry.dir);
    if (entries.length !== 2) throw new Error(`The overlong-key ZIP must contain only the two valid reports (${language}): ${entries.length}`);
    const zipped = [];
    for (const entry of entries) zipped.push(await assertGroupedDuplicateReport(await entry.async("uint8array")));
    if (JSON.stringify(direct) !== JSON.stringify(zipped)) throw new Error(`Direct and ZIP reports differ for the overlong-key batch (${language}).`);
    const failure = await page.$eval("[data-testid=excel-compare-error]", (element) => element.textContent || "");
    const expectedGuidance = language === "ko"
      ? "선택한 키 열의 내용이 너무 길어 보고서를 만들지 못했습니다. 더 짧은 값이 있는 열을 키로 선택해 다시 비교해 주세요."
      : "The selected key columns contain too much text for the report. Choose key columns with shorter values and compare again.";
    if (!failure.includes("duplicate-key-too-long-left.csv") || !failure.includes("duplicate-key-too-long-right.csv")
      || failure.includes("DUPLICATE_KEY_TOO_LONG") || !failure.includes(expectedGuidance)) {
      throw new Error(`The overlong-key cause and recovery guidance were not safely isolated (${language}): ${failure}`);
    }
    return { language, reports: reports.length, zipEntries: entries.length, rawCodeHidden: true, localizedUi, causeAndRecoveryGuidance: expectedGuidance, failure };
  } finally {
    await page.close();
  }
}
