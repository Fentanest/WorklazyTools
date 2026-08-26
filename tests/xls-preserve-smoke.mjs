import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import ExcelJS from "exceljs";
import puppeteer from "puppeteer-core";

const run = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-xls-preserve-"));
const sourceXlsx = path.join(temporaryDirectory, "styled-legacy.xlsx");
const sourceXls = path.join(temporaryDirectory, "styled-legacy.xls");

try {
  await createStyledWorkbook(sourceXlsx);
  const profileDirectory = path.join(temporaryDirectory, "libreoffice-profile");
  await fs.mkdir(profileDirectory);
  await run("/usr/bin/libreoffice", [
    "--headless",
    `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
    "--convert-to",
    "xls:MS Excel 97",
    "--outdir",
    temporaryDirectory,
    sourceXlsx,
  ], { timeout: 60_000 });
  await fs.access(sourceXls);

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(480_000);
    const pageErrors = [];
    const officeRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/vendor/zetaoffice/")) officeRequests.push(request.url());
    });

    await page.goto(`${baseUrl}/ko/tools/excel-merger/`, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('.ios-switch[aria-label="XLSX 수식 보존"]');
    await page.waitForSelector("script[data-worklazy-adsense]");
    const categories = await page.$$eval(".settings-category > h3", (items) => items.map((item) => item.textContent));
    if (categories.join(",") !== "XLSX 입력,XLS 입력,CSV 입력,빈 영역 정리,병합 세부 설정") {
      throw new Error(`Excel settings were not categorized as expected: ${categories.join(",")}`);
    }
    const baseDefaults = await readRetentionToggles(page);
    if (JSON.stringify(baseDefaults) !== JSON.stringify({ xlsxFormulas: true, xlsxFormatting: true, xlsFormulas: false, xlsFormatting: false })) {
      throw new Error(`Excel retention defaults are incorrect: ${JSON.stringify(baseDefaults)}`);
    }

    await (await page.$('input[type="file"]')).uploadFile(sourceXlsx);
    await page.waitForFunction(() => document.querySelector(".file-security-status.ready"));
    if (officeRequests.length) throw new Error("Office assets were requested for an XLSX-only selection.");
    assertRetention(await mergeAndInspect(page), { formula: true, formatting: true }, "XLSX formulas + formatting");
    await page.click('.ios-switch[aria-label="XLSX 서식 보존"]');
    assertRetention(await mergeAndInspect(page), { formula: true, formatting: false }, "XLSX formulas only");
    await page.click('.ios-switch[aria-label="XLSX 수식 보존"]');
    assertRetention(await mergeAndInspect(page), { formula: false, formatting: false }, "XLSX values only");
    await page.click('.ios-switch[aria-label="XLSX 서식 보존"]');
    assertRetention(await mergeAndInspect(page), { formula: false, formatting: true }, "XLSX formatting only");

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('.ios-switch[aria-label="XLS 수식 보존"]');
    await page.waitForFunction(() => location.pathname.endsWith("/tools/excel-merger/xls-preserve/"));
    await page.waitForSelector('.ios-switch[aria-label="XLS 수식 보존"][aria-checked="true"]');
    if (!new URL(page.url()).search.endsWith("formula=1&format=0")) throw new Error(`XLS formula-only route is incorrect: ${page.url()}`);
    const boundary = await page.evaluate(() => ({
      isolated: crossOriginIsolated,
      marker: Boolean(document.querySelector('meta[name="worklazy-excel-preserve-isolation"]')),
      noIndex: document.querySelector('meta[name="robots"]')?.content || "",
      ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
      googleAnalytics: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
      naverAnalytics: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
      heading: document.querySelector("h1")?.textContent || "",
    }));
    if (!boundary.isolated || !boundary.marker || boundary.noIndex !== "noindex, nofollow"
      || boundary.ads || boundary.googleAnalytics || boundary.naverAnalytics || boundary.heading !== "Excel 병합기") {
      throw new Error(`XLS preservation boundary or shared UI is incomplete: ${JSON.stringify(boundary)}`);
    }

    await page.evaluate(() => {
      window.__xlsProgressSamples = [];
      new MutationObserver(() => {
        const progress = document.querySelector(".operation-progress-track")?.getAttribute("aria-valuenow") || "";
        const message = document.querySelector(".operation-current-message")?.textContent || "";
        const sample = `${progress}:${message}`;
        if (message && !window.__xlsProgressSamples.includes(sample)) window.__xlsProgressSamples.push(sample);
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    await (await page.$('input[type="file"]')).uploadFile(sourceXls);
    await page.waitForFunction(() => document.querySelector(".operation-progress.status-success") || document.querySelector(".error-banner"));
    const preparationError = await page.$eval(".error-banner", (element) => element.textContent || "").catch(() => "");
    if (preparationError) throw new Error(`XLS preservation preparation failed: ${preparationError}`);
    await page.waitForFunction(() => document.querySelector(".file-security-status.ready"));
    const preparation = await page.evaluate(async () => ({
      samples: window.__xlsProgressSamples,
      cacheNames: (await caches.keys()).filter((name) => name.startsWith("worklazy-office-")),
      cachedAssets: (await (await caches.open("worklazy-office-2026-08-26")).keys()).filter((request) => request.url.includes("/vendor/zetaoffice/")).length,
    }));
    if (!preparation.samples.some((sample) => sample.includes("MB"))
      || new Set(preparation.samples.map((sample) => sample.split(":", 1)[0])).size < 4
      || preparation.samples.length > 140
      || preparation.cacheNames.length !== 1
      || preparation.cachedAssets !== 6) {
      throw new Error(`XLS download progress or cache state is incomplete: ${JSON.stringify(preparation)}`);
    }

    const formulaOnly = await mergeAndInspect(page);
    assertRetention(formulaOnly, { formula: true, formatting: false }, "XLS formulas only");
    const warning = await page.$eval(".result-warnings", (element) => element.textContent || "");
    if (!warning.includes("선택한 수식·서식 보존 설정")) {
      throw new Error(`XLS preservation compatibility notice is missing: ${warning}`);
    }

    await page.click('.ios-switch[aria-label="XLS 서식 보존"]');
    await page.waitForFunction(() => location.search.includes("formula=1") && location.search.includes("format=1"));
    if (await page.$$eval(".excel-file-item", (items) => items.length) !== 1) throw new Error("Switching between XLS preservation options cleared the selected file.");
    assertRetention(await mergeAndInspect(page), { formula: true, formatting: true }, "XLS formulas + formatting");

    await page.click('.ios-switch[aria-label="XLS 수식 보존"]');
    await page.waitForFunction(() => location.search.includes("formula=0") && location.search.includes("format=1"));
    assertRetention(await mergeAndInspect(page), { formula: false, formatting: true }, "XLS formatting only");

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('.ios-switch[aria-label="XLS 서식 보존"]');
    await page.waitForFunction(() => location.pathname.endsWith("/tools/excel-merger/"));
    await page.waitForSelector('.ios-switch[aria-label="XLS 수식 보존"][aria-checked="false"]');
    const returned = await page.evaluate(() => ({
      marker: Boolean(document.querySelector('meta[name="worklazy-excel-preserve-isolation"]')),
      ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
      heading: document.querySelector("h1")?.textContent || "",
      fileCount: document.querySelectorAll(".excel-file-item").length,
    }));
    if (returned.marker || !returned.ads || returned.heading !== "Excel 병합기" || returned.fileCount !== 0) {
      throw new Error(`Switching back did not restore the standard Excel screen safely: ${JSON.stringify(returned)}`);
    }
    await page.click('.ios-switch[aria-label="XLS 서식 보존"]');
    await page.waitForFunction(() => location.pathname.endsWith("/tools/excel-merger/xls-preserve/") && location.search.includes("formula=0") && location.search.includes("format=1"));
    await page.click('.ios-switch[aria-label="XLS 서식 보존"]');
    await page.waitForFunction(() => location.pathname.endsWith("/tools/excel-merger/") && !location.search);
    if (pageErrors.length) throw new Error(`XLS preservation browser errors:\n${pageErrors.join("\n")}`);
    console.log(`Excel retention smoke passed: four XLSX states, three XLS preservation states, ${preparation.samples.length} progress states.`);
  } finally {
    await browser.close();
  }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function readRetentionToggles(page) {
  const labels = {
    xlsxFormulas: "XLSX 수식 보존",
    xlsxFormatting: "XLSX 서식 보존",
    xlsFormulas: "XLS 수식 보존",
    xlsFormatting: "XLS 서식 보존",
  };
  return page.evaluate((toggleLabels) => Object.fromEntries(Object.entries(toggleLabels).map(([key, label]) => [
    key,
    document.querySelector(`.ios-switch[aria-label="${label}"]`)?.getAttribute("aria-checked") === "true",
  ])), labels);
}

async function mergeAndInspect(page) {
  await page.waitForFunction(() => !document.querySelector(".summary-card .primary-button")?.disabled);
  await page.click(".summary-card .primary-button");
  await page.waitForSelector(".result-download");
  const bytes = await page.$eval(".result-download", async (link) => {
    const response = await fetch(link.href);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  });
  const merged = new ExcelJS.Workbook();
  await merged.xlsx.load(Buffer.from(bytes));
  const sheet = merged.worksheets[0];
  return {
    bytes: bytes.length,
    formula: sheet.getCell("A3").formula,
    value: sheet.getCell("A3").value,
    bold: sheet.getCell("A1").font?.bold,
    color: sheet.getCell("A1").font?.color?.argb,
    fill: sheet.getCell("A1").fill?.fgColor?.argb,
    border: sheet.getCell("A1").border?.top?.style,
    alignment: sheet.getCell("A1").alignment?.horizontal,
    numberFormat: sheet.getCell("A1").numFmt,
    merged: sheet.getCell("B1").isMerged && sheet.getCell("C1").isMerged,
  };
}

function assertRetention(actual, expected, label) {
  const formulaPreserved = actual.formula === "SUM(A1:A2)";
  const formattingPreserved = actual.bold === true
    && actual.color === "FF1F4E78"
    && actual.fill === "FFFFE699"
    && actual.border === "thin"
    && actual.alignment === "center"
    && actual.numberFormat === "0.00"
    && actual.merged;
  if (formulaPreserved !== expected.formula || formattingPreserved !== expected.formatting || actual.bytes < 512) {
    throw new Error(`${label} retention mismatch: ${JSON.stringify(actual)}`);
  }
}

async function createStyledWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("보존 확인");
  sheet.getCell("A1").value = 2;
  sheet.getCell("A2").value = 3;
  sheet.getCell("A3").value = { formula: "SUM(A1:A2)", result: 5 };
  sheet.getCell("A1").font = { bold: true, color: { argb: "FF1F4E78" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } };
  sheet.getCell("A1").border = { top: { style: "thin", color: { argb: "FF000000" } } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").numFmt = "0.00";
  sheet.mergeCells("B1:C1");
  sheet.getCell("B1").value = "병합 셀";
  await workbook.xlsx.writeFile(filePath);
}
