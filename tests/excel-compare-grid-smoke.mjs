import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import ExcelJS from "exceljs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const testLanguage=process.env.EXCEL_GRID_LANG||"en";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "excel-grid-smoke-"));
await fs.writeFile(path.join(temporary, "left.csv"), "Date,Amount\n01/02/2024,5\n02/30/2024,8");
await fs.writeFile(path.join(temporary, "right.csv"), "Amount,Date\n5,2024-01-02\n8,2024-02-29");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1360, height: 940 });
  await page.evaluateOnNewDocument(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
  const cdp = await page.createCDPSession();
  await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: temporary });
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", { urls: ["*googlesyndication.com*", "*doubleclick.net*", "*google-analytics.com*", "*googletagmanager.com*"] });
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.goto(`${baseUrl}/${testLanguage}/tools/excel-compare/`, { waitUntil: "domcontentloaded" });
  if (process.env.EXCEL_GRID_HANDOFF) await page.evaluate(async (testLanguage) => {
    const { default: i18n } = await import('/src/i18n/config.ts');
    const handoff = await fetch('/docs/jobs/todo/diffchecker-port-20261023/excel-shared-handoff.json').then((response) => response.json());
    for (const language of ['ko','en']) { const nested = {}; for (const [key,value] of Object.entries(handoff.localeEntries[language])) { const parts=key.split('.'); let target=nested; for(const part of parts.slice(0,-1)) target=target[part] ??= {}; target[parts.at(-1)]=value; } i18n.addResourceBundle(language,'features',nested,true,true); }
    await i18n.changeLanguage(testLanguage);
  },testLanguage);
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
  assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.applied),'US');
  await page.click('[data-excel-mode="reconcile"]');assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.requested),'US');assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.applied),'off');assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.inactiveReason),'reconcile');assert.ok((await page.$eval('[data-testid="excel-date-policy"]',el=>el.textContent)).includes(testLanguage==='ko'?'회계대사에서는 적용하지':'Inactive in reconciliation'));if(process.env.EXCEL_POLICY_SCREENSHOT)await (await page.$('[data-testid="excel-string-dates"]')).screenshot({path:process.env.EXCEL_POLICY_SCREENSHOT});
  await page.select('[data-testid="excel-string-dates"] select','EU');assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.requested),'EU');assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.applied),'off');await page.click('[data-excel-mode="position"]');assert.equal(await page.$eval('[data-testid="excel-date-policy"]',el=>el.dataset.applied),'EU');await page.select('[data-testid="excel-string-dates"] select','US');

  await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');
  await page.waitForSelector('[data-testid="excel-comparison-grid"]');
  await page.click('[data-testid="excel-comparison-grid"] > summary');
  const initial = await page.$$eval('[data-testid="excel-comparison-grid"] [data-record-id]', (items) => items.map((item) => ({ id: item.dataset.recordId, status: item.dataset.status, addresses: [...item.querySelectorAll("[data-source-address]")].map((cell) => cell.dataset.sourceAddress) })));
  assert.ok(initial.some((item) => item.addresses.join(",") === "A2,B2"));
  assert.equal(await page.$$eval('[data-testid="excel-worksheet-grid"]',items=>items.length),2);
  assert.equal(await page.$eval('[data-testid="excel-worksheet-grid"][data-side="left"] [data-source-address="A1"]',element=>element.innerText),"Date");
  assert.equal(await page.$eval('[data-testid="excel-worksheet-grid"][data-side="right"] [data-source-address="B1"]',element=>element.innerText),"Date");
  const sourceId=await page.$eval('[data-testid="excel-worksheet-grid"][data-side="left"] [data-source-address="A2"]',element=>element.dataset.recordIds);
  assert.equal(sourceId,await page.$eval('[data-testid="excel-worksheet-grid"][data-side="right"] [data-source-address="B2"]',element=>element.dataset.recordIds));
  assert.equal(await page.$$eval('[data-testid="excel-original-matrix"] td',items=>items.length),12);
  const runId = await page.$eval('[data-testid="excel-comparison-grid"]', (element) => element.dataset.runId);
  for (const layout of ["split", "threeColumns"]) {
    await page.select('[data-testid="excel-comparison-grid"] select', layout);
    assert.deepEqual(await page.$$eval('[data-testid="excel-comparison-grid"] [data-record-id]', (items) => items.map((item) => item.dataset.recordId)), initial.map((item) => item.id));
  }
  await page.waitForSelector('[data-testid="excel-grid-change-column"]');
  assert.equal(await page.$eval('[data-testid="excel-sheet-layout"]',element=>getComputedStyle(element).gridTemplateColumns.split(" ").length),3);
  assert.equal(await page.$$eval('[data-testid="excel-grid-change-column"] [data-change-record-id]',items=>items.length),initial.length);
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
  const matrixRows=[Array.from({length:20},(_,i)=>`Column${i+1}`).join(',')];
  for(let row=1;row<=80;row++)matrixRows.push(Array.from({length:20},(_,column)=>`r${row}c${column+1}`).join(','));
  for(const side of ['left','right'])await fs.writeFile(path.join(temporary,`matrix-${side}.csv`),matrixRows.join('\n'));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid="excel-compare-page"] input[type=file]');
  await (await page.$('[data-testid="excel-compare-page"] input[type=file]')).uploadFile(path.join(temporary,'matrix-left.csv'),path.join(temporary,'matrix-right.csv'));
  await page.waitForFunction(()=>!document.querySelector('[data-testid=excel-compare-actions] [data-ui-component=primary-button]').disabled);
  await page.click('[data-testid=excel-compare-actions] [data-ui-component=primary-button]');await page.waitForSelector('[data-testid="excel-comparison-grid"]');await page.click('[data-testid="excel-comparison-grid"] > summary');
  assert.equal(await page.$$eval('[data-testid="excel-original-matrix"] td',items=>items.length),960);
  const matrixRun=await page.$eval('[data-testid="excel-comparison-grid"]',element=>element.dataset.runId);
  const hiddenInputs=await page.$$('[data-testid="excel-comparison-grid"] > div > label > input');
  await hiddenInputs[0].type(Array.from({length:81},(_,i)=>i+1).filter(row=>row!==4&&row!==7).join(','));await hiddenInputs[1].type(Array.from({length:20},(_,i)=>i+1).filter(column=>column!==4).join(','));
  const addresses=()=>page.$$eval('[data-testid="excel-worksheet-grid"][data-side="left"] td[data-source-address]',items=>items.map(item=>item.dataset.sourceAddress));
  assert.deepEqual(await addresses(),['D4','D7']);
  await (await page.$$('[data-testid="excel-comparison-grid"] > div > button'))[0].click();assert.deepEqual(await addresses(),['D7','D4']);
  assert.equal(await page.$eval('[data-testid="excel-comparison-grid"]',element=>element.dataset.runId),matrixRun);
  await page.click('[data-testid="excel-worksheet-grid"][data-side="left"] [data-source-address="D4"] button');assert.ok((await page.$eval('[data-testid="excel-matrix-cell-details"]',element=>element.innerText)).includes('r3c4'));
  console.log(`Excel grid smoke passed: ${initial.length} records, 2 layouts preserve IDs; hide preserves run ${runId}.`);
} finally { await browser.close(); await fs.rm(temporary, { recursive: true, force: true }); }
