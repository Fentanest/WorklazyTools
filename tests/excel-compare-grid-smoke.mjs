import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import ExcelJS from "exceljs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "excel-grid-smoke-"));
await fs.writeFile(path.join(temporary, "left.csv"), "Date,Amount\n01/02/2024,5\n02/30/2024,8");
await fs.writeFile(path.join(temporary, "right.csv"), "Amount,Date\n5,2024-01-02\n8,2024-02-29");
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.evaluateOnNewDocument(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: temporary });
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", { urls: ["*googlesyndication.com*", "*doubleclick.net*", "*google-analytics.com*", "*googletagmanager.com*"] });
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.goto(`${baseUrl}/en/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="excel-compare-page"] input[type=file]');
  const input = await page.$('[data-testid="excel-compare-page"] input[type=file]');
  await input.uploadFile(path.join(temporary, "left.csv"), path.join(temporary, "right.csv"));
  await page.waitForSelector('[data-testid="excel-column-mapping"] [role=switch]').catch(async (error) => { console.error(await page.$eval("body", (body) => body.innerText)); throw error; });
  await page.click('[data-testid="excel-column-mapping"] [role=switch]');
  const mappings = await page.$$('[data-testid="excel-column-mapping"] select');
  await mappings[1].select("2");
  await page.select('[data-testid="excel-string-dates"] select', "US");
  await page.click('[data-testid="excel-string-dates"] fieldset:nth-of-type(1) button');
  const dateButtons = await page.$$('[data-testid="excel-string-dates"] fieldset:nth-of-type(2) button');
  await dateButtons[1].click();
  await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
  await page.waitForSelector('[data-testid="excel-comparison-grid"]');
  await page.click('[data-testid="excel-comparison-grid"] > summary');
  const initial = await page.$$eval('[data-testid="excel-comparison-grid"] [data-record-id]', (items) => items.map((item) => ({ id: item.dataset.recordId, status: item.dataset.status, addresses: [...item.querySelectorAll("[data-source-address]")].map((cell) => cell.dataset.sourceAddress) })));
  assert.ok(initial.some((item) => item.addresses.join(",") === "A2,B2"));
  const runId = await page.$eval('[data-testid="excel-comparison-grid"]', (element) => element.dataset.runId);
  for (const layout of ["split", "threeColumns", "full", "left", "right", "top", "bottom", "horizontal", "vertical", "threeRows"]) {
    await page.select('[data-testid="excel-comparison-grid"] select', layout);
    assert.deepEqual(await page.$$eval('[data-testid="excel-comparison-grid"] [data-record-id]', (items) => items.map((item) => item.dataset.recordId)), initial.map((item) => item.id));
  }
  const gridInputs = await page.$$('[data-testid="excel-comparison-grid"] input');
  await gridInputs[0].type("3");
  const visible = await page.$$eval('[data-testid="excel-comparison-grid"] [data-record-id]', (items) => items.map((item) => item.dataset.recordId));
  assert.ok(visible.length < initial.length);
  assert.equal(await page.$eval('[data-testid="excel-comparison-grid"]', (element) => element.dataset.runId), runId);
  const listIds = await page.$$eval('[data-testid="excel-result-table"] [data-record-id]', (items) => items.map((item) => item.dataset.recordId));
  assert.deepEqual(listIds, initial.map((item) => item.id));
  const gridButtons = await page.$$('[data-testid="excel-comparison-grid"] > div > button');
  await gridButtons[1].click();
  const reportPath = path.join(temporary, "visible-report.xlsx");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await fs.stat(reportPath).then(() => true, () => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(reportPath);
  const exportedIds = [];
  workbook.getWorksheet("Parameters").eachRow((row) => { const key = String(row.getCell(1).value); if (key.startsWith("record:")) exportedIds.push(key.slice(7)); });
  assert.deepEqual(exportedIds, [...visible].sort((a, b) => initial.findIndex((r) => r.id === a) - initial.findIndex((r) => r.id === b)));
  const screenshotPath = process.env.EXCEL_GRID_SCREENSHOT;
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Excel grid smoke passed: ${initial.length} records, 10 layouts preserve IDs; hide preserves run ${runId}.`);
} finally { await browser.close(); await fs.rm(temporary, { recursive: true, force: true }); }
