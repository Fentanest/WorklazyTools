import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";

const run = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-excel-compare-smoke-"));

try {
  await run(process.execPath, ["scripts/generate-excel-compare-fixtures.mjs", temporaryDirectory]);
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
    await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === new URL(baseUrl).origin) failedRequests.push(`${request.url()} ${request.failure()?.errorText || "unknown"}`);
    });

    await page.goto(`${baseUrl}/ko/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const initial = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent || "",
      modes: document.querySelectorAll('.excel-compare-mode-grid button[role="radio"]').length,
      supportRows: document.querySelectorAll(".excel-support-table tbody tr").length,
      inputCount: document.querySelectorAll('.excel-compare-page input[type="file"]').length,
      dragButtons: document.querySelectorAll('.excel-compare-page .drop-zone[role="button"] .secondary-button').length,
      ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
      isolated: Boolean(document.querySelector('meta[name="worklazy-video-isolation"], meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]')),
    }));
    if (initial.title !== "Excel 비교·대사" || initial.modes !== 3 || initial.supportRows !== 6 || initial.inputCount !== 2 || initial.dragButtons !== 2 || !initial.ads || initial.isolated) {
      throw new Error(`Initial Excel comparison UI or standard ad boundary is incomplete: ${JSON.stringify(initial)}`);
    }

    let inputs = await page.$$('.excel-compare-page input[type="file"]');
    await inputs[0].uploadFile(fixture("left.xlsx"));
    await inputs[1].uploadFile(fixture("right.xlsx"));
    await page.waitForFunction(() => document.querySelectorAll(".excel-sheet-fields").length === 2 && !document.querySelector('.excel-compare-page > .primary-button')?.disabled);
    await page.click('.excel-compare-page > .primary-button');
    await page.waitForSelector(".operation-progress.status-success");
    const onePair = await reportLinks(page);
    if (onePair.length !== 1 || !onePair[0].name.endsWith(".xlsx")) {
      const state = await page.evaluate(() => ({ progress: document.querySelector(".operation-progress")?.textContent || "", errors: [...document.querySelectorAll(".inline-notice.error")].map((item) => item.textContent || "") }));
      throw new Error(`One pair must create one XLSX and no ZIP: ${JSON.stringify({ onePair, state, pageErrors })}`);
    }
    await assertNineSheetReport(onePair[0].bytes);

    await page.click(".excel-add-pair");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 2);
    inputs = await page.$$('.excel-compare-page input[type="file"]');
    await inputs[2].uploadFile(fixture("formula.xlsb"));
    await inputs[3].uploadFile(fixture("macro.xlsm"));
    await page.waitForFunction(() => document.querySelectorAll(".excel-sheet-fields").length === 4 && !document.querySelector('.excel-compare-page > .primary-button')?.disabled);
    await page.click(".excel-add-pair");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="excel-compare-pair"]').length === 3);
    inputs = await page.$$('.excel-compare-page input[type="file"]');
    await inputs[4].uploadFile(fixture("damaged.xlsx"));
    await inputs[5].uploadFile(fixture("macro.xlsm"));
    await page.waitForFunction(() => document.querySelectorAll(".excel-sheet-fields").length === 5 && document.querySelector(".field-error") && !document.querySelector('.excel-compare-page > .primary-button')?.disabled);
    const formatLabels = await page.$$eval(".excel-sheet-fields p", (items) => items.map((item) => item.textContent || ""));
    if (!formatLabels.some((text) => text.includes("XLSB") && text.includes("서식 비교 제외")) || !formatLabels.some((text) => text.includes("XLSM") && text.includes("서식 비교 가능"))) {
      throw new Error(`Format support labels do not match the fixed matrix: ${JSON.stringify(formatLabels)}`);
    }
    await page.click('.excel-compare-page > .primary-button');
    await page.waitForSelector(".operation-progress.status-success");
    const multiPair = await reportLinks(page);
    const reports = multiPair.filter((item) => item.name.endsWith(".xlsx"));
    const archives = multiPair.filter((item) => item.name.endsWith(".zip"));
    if (reports.length !== 2 || archives.length !== 1) throw new Error(`Two successful pairs must create two reports and one ZIP: ${JSON.stringify(multiPair.map(({ name }) => name))}`);
    const isolatedFailure = await page.$eval(".inline-notice.error", (element) => element.textContent || "");
    if (!isolatedFailure.includes("damaged.xlsx") || !isolatedFailure.includes("macro.xlsm") || isolatedFailure.includes("DAMAGED_FILE") || isolatedFailure.includes("PROCESSING_FAILED")) {
      throw new Error(`A failed pair was not isolated behind a user-facing message: ${isolatedFailure}`);
    }
    for (const report of reports) await assertNineSheetReport(report.bytes);
    const archive = await JSZip.loadAsync(archives[0].bytes);
    const archiveNames = Object.values(archive.files).filter((entry) => !entry.dir).map((entry) => entry.name);
    if (archiveNames.length !== 2 || archiveNames.some((name) => !name.endsWith(".xlsx") || name.includes("/") || name.includes("\\"))) {
      throw new Error(`ZIP report names were not safely bounded: ${JSON.stringify(archiveNames)}`);
    }

    const filters = await page.$$eval(".excel-status-filters button", (buttons) => buttons.map((button) => ({
      text: button.textContent?.trim() || "",
      color: getComputedStyle(button.querySelector("span")).backgroundColor,
    })));
    if (filters.length !== 8 || filters.some((item) => !item.text || item.color === "rgba(0, 0, 0, 0)")) throw new Error(`Status filters need both text and color: ${JSON.stringify(filters)}`);
    const rowsBeforeSearch = await page.$$eval(".excel-result-table tbody tr", (rows) => rows.length);
    await page.type(".excel-result-search input", "updated");
    await page.waitForFunction((before) => {
      const count = document.querySelectorAll(".excel-result-table tbody tr").length;
      return count > 0 && count <= before;
    }, {}, rowsBeforeSearch);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    inputs = await page.$$('.excel-compare-page input[type="file"]');
    await inputs[0].uploadFile(fixture("cancel-left.xlsx"));
    await inputs[1].uploadFile(fixture("cancel-right.xlsx"));
    await page.waitForFunction(() => document.querySelectorAll(".excel-sheet-fields").length === 2 && !document.querySelector('.excel-compare-page > .primary-button')?.disabled);
    await page.click('.excel-compare-page > .primary-button');
    await page.waitForSelector(".cancel-operation button");
    await page.click(".cancel-operation button");
    await page.waitForFunction(() => document.querySelector(".operation-progress.status-error")?.textContent?.includes("취소"));

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="excel-compare-page"]');
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pairColumns: getComputedStyle(document.querySelector(".excel-pair-files")).gridTemplateColumns,
      actionHeight: document.querySelector(".drop-zone .secondary-button")?.getBoundingClientRect().height || 0,
    }));
    if (mobile.overflow > 1 || mobile.pairColumns.split(" ").length !== 1 || mobile.actionHeight < 40) throw new Error(`Mobile layout or file-button alternative failed: ${JSON.stringify(mobile)}`);

    if (pageErrors.length) throw new Error(`Browser page errors:\n${pageErrors.join("\n")}`);
    if (failedRequests.length) throw new Error(`Same-origin request failures:\n${failedRequests.join("\n")}`);
    console.log(JSON.stringify({
      onePairDownloads: onePair.map(({ name }) => name),
      multiPairDownloads: multiPair.map(({ name }) => name),
      zipEntries: archiveNames,
      isolatedFailure,
      statusFilters: filters.map(({ text }) => text),
      cancellation: "passed",
      mobile,
    }, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function reportLinks(page) {
  const links = await page.$$eval(".excel-report-downloads .result-download", async (items) => Promise.all(items.map(async (item) => {
    const anchor = item;
    const buffer = await (await fetch(anchor.href)).arrayBuffer();
    return { name: anchor.download, bytes: Array.from(new Uint8Array(buffer)) };
  })));
  return links.map((item) => ({ name: item.name, bytes: Buffer.from(item.bytes) }));
}

async function assertNineSheetReport(bytes) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const names = workbook.worksheets.map((sheet) => sheet.name);
  const expected = ["Summary", "Parameters", "Matched", "Changed", "Added", "Removed", "Duplicates", "Ambiguous", "Errors"];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`Report topology differs from the nine-sheet contract: ${JSON.stringify(names)}`);
  workbook.worksheets.forEach((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
    if (typeof cell.value !== "string" || cell.formula !== undefined) throw new Error(`Report cell was not serialized as untrusted text: ${sheet.name}!${cell.address}`);
  })));
}
