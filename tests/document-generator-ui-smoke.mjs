import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import PizZip from 'pizzip';
import ExcelJS from 'exceljs';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { generatorTemplate, generatorWorkbook } from './helpers/document-generator-fixtures.mjs';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4389';
const output = process.env.GENERATOR_UI_EVIDENCE_DIR ?? '/tmp/worklazy-u7-ui-prep/u7-2/ui-smoke';
await fs.mkdir(output, { recursive: true });
const template = path.join(output, 'synthetic-template.docx');
const dataA = path.join(output, 'synthetic-a.xlsx');
const dataB = path.join(output, 'synthetic-b.xlsx');
const damaged = path.join(output, 'synthetic-damaged.xlsx');
await fs.writeFile(template, generatorTemplate());
await fs.writeFile(dataA, await generatorWorkbook('A'));
await fs.writeFile(dataB, await generatorWorkbook('B'));
await fs.writeFile(damaged, 'synthetic invalid workbook');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const external = [], errors = [], consoleErrors = [], screenshots = [], downloads = [];
const observations = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
await context.addInitScript(() => {
  window.__layoutShifts = [];
  window.__revokedUrls = [];
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = url => { window.__revokedUrls.push(url); revoke(url); };
  new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value); }).observe({ type: 'layout-shift', buffered: true });
});
await context.route('**/*', route => {
  const url = route.request().url();
  if (!url.startsWith(base + '/')) { external.push(url); return route.abort(); }
  return route.continue();
});

async function open(language = 'en', width = 1280, height = 900) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`${base}/${language}/tools/document-generator/`, { waitUntil: 'networkidle' });
  const essential = page.getByRole('button', { name: language === 'ko' ? '필수 기능만 사용' : 'Use essential features only' });
  if (await essential.count()) await essential.click();
  await page.waitForTimeout(350);
  const initialCls = await page.evaluate(() => window.__layoutShifts.reduce((sum, value) => sum + value, 0));
  assert.ok(initialCls <= .1, `initial CLS ${initialCls}`);
  observations.push({language,width,height,initialCls});
  return page;
}

async function upload(page, files = [dataA, dataB]) {
  const inputs = page.locator('input[type=file]');
  // The visible order promises template first; this also verifies that a later data replacement keeps it.
  await inputs.nth(0).setInputFiles(template);
  await page.getByText(/Template variables:|양식 변수:/).waitFor();
  await page.locator('input[type=file]').nth(1).setInputFiles(files);
  await page.waitForFunction(() => document.querySelectorAll('input[type=number]').length > 0);
}

async function prepare(page, language = 'en') {
  const headers = page.locator('input[type=number]');
  for (let index = 0; index < await headers.count(); index++) await headers.nth(index).fill('2');
  await headers.first().focus(); await page.keyboard.press('ArrowUp');
  assert.equal(await headers.first().inputValue(), '3', 'native keyboard increment');
  await page.keyboard.press('ArrowDown');
  const button = page.getByRole('button', { name: language === 'ko' ? '전체 행 검사' : 'Check all rows' });
  await button.focus(); assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), language === 'ko' ? '전체 행 검사' : 'Check all rows');
  await page.keyboard.press('Enter');
  await page.locator('[data-testid=document-generator-plan]').waitFor();
}

async function shot(page, name, fullPage = true) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file, fullPage }); screenshots.push(file); return file;
}

async function saveDownload(page, action, name, expectedName) {
  const event = page.waitForEvent('download'); await action(); const download = await event;
  if (expectedName) assert.equal(download.suggestedFilename(), expectedName, 'C2 result filename reaches browser download');
  const file = path.join(output, name); await download.saveAs(file); downloads.push({file,suggestedFilename:download.suggestedFilename()}); return file;
}

try {
  const page = await open('en');
  assert.equal(await page.locator('input[type=file]').count(), 2, 'two native file inputs');
  await upload(page);
  assert.match(await page.locator('body').innerText(), /Template variables: name, value, empty, code/);
  assert.equal(await page.getByText(/Map columns for data file/).count(), 2);
  const firstMapping = page.getByRole('heading', {name:'Map columns for data file 1'}).locator('xpath=ancestor::section');
  const firstHeader = firstMapping.getByRole('spinbutton', {name:'Header row'});
  await firstHeader.fill('2');
  const firstAlias = firstMapping.getByRole('textbox').first();
  assert.equal(await firstHeader.inputValue(), '2', 'header selection is established before alias negative');
  assert.equal(await firstAlias.inputValue(), 'name', 'physical column 1 alias is the negative target');
  await firstAlias.fill('');
  await page.getByRole('button', {name:'Check all rows'}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('alert').innerText(), 'Assign distinct aliases to blank or duplicate headers.', 'explicit alias error is visible');
  assert.equal(await firstHeader.inputValue(), '2', 'alias editing does not alter the header row');
  await firstAlias.fill('name');
  await prepare(page);
  assert.equal(await page.locator('[data-testid=document-generator-plan] li').count(), 10);
  const rowPicker = page.getByRole('combobox', { name: 'Sample row' });
  await rowPicker.selectOption({ index: 1 });
  const chosenRow = await rowPicker.inputValue();
  assert.match(await page.locator('[data-testid=document-generator-selected-row]').innerText(), /A-First-2|A-First-1/);
  const sample = await saveDownload(page, async () => {
    await page.getByRole('button', { name: 'Create sample' }).click();
    await page.getByRole('link', { name: 'Download sample DOCX' }).waitFor();
    await page.getByRole('link', { name: 'Download sample DOCX' }).click();
  }, 'sample.docx');
  assert.ok(new PizZip(await fs.readFile(sample)).file('word/document.xml'), 'sample reopens');
  assert.ok(chosenRow, 'explicit selected sample row');
  const sampleUrl = await page.getByRole('link', { name:'Download sample DOCX' }).getAttribute('href');
  await rowPicker.selectOption({index:0});
  await page.getByRole('link', {name:'Download sample DOCX'}).waitFor({state:'detached'});
  await page.waitForFunction(url => window.__revokedUrls.includes(url), sampleUrl);
  const replacementSample = await saveDownload(page, async () => {
    await page.getByRole('button', {name:'Create sample'}).click();
    await page.getByRole('link', {name:'Download sample DOCX'}).waitFor();
    await page.getByRole('link', {name:'Download sample DOCX'}).click();
  }, 'sample-after-row-change.docx');
  const replacementXml = new PizZip(await fs.readFile(replacementSample)).file('word/document.xml')?.asText() ?? '';
  assert.match(replacementXml, /A-First-1/, 'replacement sample uses newly selected row');
  assert.doesNotMatch(replacementXml, /A-First-2/, 'replacement sample is not stale');
  const replacementSampleUrl = await page.getByRole('link', {name:'Download sample DOCX'}).getAttribute('href');
  const pattern = page.getByRole('textbox', { name: 'Filename pattern' });
  await pattern.fill('same.docx');
  await page.waitForFunction(url => window.__revokedUrls.includes(url), replacementSampleUrl);
  await page.getByRole('button', { name: 'Check all rows' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="document-generator-plan"] li')].every(item => item.textContent?.toLowerCase().includes('filename')));
  await shot(page, 'en-desktop-name-collision');
  await pattern.fill('document-{file}-{row}.docx');
  await page.getByRole('button', { name: 'Check all rows' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="document-generator-plan"] li').length === 10);
  await page.getByRole('button', { name: 'Generate documents' }).click();
  const cancelDuring = page.getByRole('button', { name: 'Cancel' });
  if (await cancelDuring.isVisible().catch(() => false)) await shot(page, 'en-desktop-processing', false);
  await page.locator('[data-testid=document-generator-results] li').nth(5).waitFor({ timeout: 30000 });
  assert.equal(await page.locator('[data-testid=document-generator-results] li').count(), 6, 'six successful outputs');
  assert.match(await page.locator('body').innerText(), /Failed/);
  await shot(page, 'en-desktop-results');
  const resultNames = await page.locator('[data-testid=document-generator-results] strong').allTextContents();
  const one = await saveDownload(page, () => page.locator('[data-testid=document-generator-results] li').first().getByRole('button', { name: 'Download' }).click(), 'result-one.docx', resultNames[0]);
  assert.ok(new PizZip(await fs.readFile(one)).file('word/document.xml'), 'individual result reopens');
  await page.getByRole('button', { name: 'Create results ZIP' }).click();
  const zipFile = await saveDownload(page, () => page.getByRole('link', { name: 'Download completed ZIP' }).click(), 'results.zip');
  assert.equal(Object.values(new PizZip(await fs.readFile(zipFile)).files).filter(item => !item.dir).length, 6, 'ZIP has six complete entries');
  const oldZipUrl = await page.getByRole('link', {name:'Download completed ZIP'}).getAttribute('href');
  const latestManifest = await saveDownload(page, () => page.getByRole('button', { name: 'Latest attempt report' }).click(), 'latest-attempt.xlsx');
  const resultsManifest = await saveDownload(page, () => page.getByRole('button', { name: 'Published results report' }).click(), 'published-results.xlsx');
  for (const file of [latestManifest, resultsManifest]) { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await fs.readFile(file)); assert.ok(workbook.worksheets[0].rowCount >= 7, `${path.basename(file)} reopens`); }
  await page.evaluate(() => new Promise((resolve, reject) => {
    const generate = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Generate documents');
    if (!generate) { reject(new Error('generate button missing')); return; }
    const clickCancel = () => { const cancel=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Cancel'); if(cancel){cancel.click();return true;}return false; };
    const observer = new MutationObserver(() => { if(clickCancel()){observer.disconnect();resolve();} });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true}); generate.click();
    if(clickCancel()){observer.disconnect();resolve();}
  }));
  await page.getByRole('button', { name: 'Cancel' }).waitFor({ state: 'detached', timeout: 30000 });
  assert.deepEqual(await page.locator('[data-testid=document-generator-results] strong').allTextContents(), resultNames, 'cancel preserves published results');
  assert.match(await page.locator('body').innerText(), /Previously completed results remain/);
  assert.equal(await page.getByRole('link', {name:'Download completed ZIP'}).getAttribute('href'), oldZipUrl, 'cancel before first commit preserves prior ZIP');
  await shot(page, 'en-desktop-canceled');
  const publishedHref = await page.locator('[data-testid=document-generator-results] li').first().getByRole('button', { name:'Download' }).count();
  assert.equal(publishedHref, 1, 'old result remains actionable after canceled retry');
  const axe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(axe.violations.map(item => item.id), [], 'stable U7 result has no axe violations');
  const flowCls = await page.evaluate(() => window.__layoutShifts.reduce((sum, value) => sum + value, 0));
  observations.push({name:'full-interactive-flow-not-web-vital-navigation-window',flowCls});
  await page.getByRole('button', {name:'Generate documents'}).click();
  await page.getByRole('link', {name:'Download completed ZIP'}).waitFor({state:'detached',timeout:30000});
  await page.waitForFunction(url => window.__revokedUrls.includes(url), oldZipUrl);
  await page.locator('[data-testid=document-generator-results] li').nth(5).waitFor({timeout:30000});
  await page.locator('input[type=file]').nth(0).setInputFiles(template);
  assert.equal(await page.locator('[data-testid=document-generator-results]').count(), 0, 'file replacement removes old links');
  await page.close();

  const damagedPage = await open('ko', 390, 844);
  await upload(damagedPage, [dataA, damaged]);
  assert.equal(await damagedPage.getByText(/데이터 파일 2:/).count(), 1, 'numbered damaged input');
  await prepare(damagedPage, 'ko');
  await shot(damagedPage, 'ko-mobile-damaged-selected');
  await damagedPage.close();

  for (const profile of [
    { language:'en', width:320, height:720, theme:'light' },
    { language:'ko', width:820, height:900, theme:'dark' },
    { language:'en', width:821, height:900, theme:'dark' },
    { language:'ko', width:1440, height:1000, theme:'light' },
  ]) {
    const candidate = await open(profile.language, profile.width, profile.height);
    if (profile.theme === 'dark') await candidate.evaluate(() => document.documentElement.classList.add('dark'));
    await upload(candidate, [dataA]); await prepare(candidate, profile.language);
    const suffix = `${profile.language}-${profile.width}-${profile.theme}-selected`;
    await shot(candidate, suffix);
    const metrics = await candidate.evaluate(() => ({ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, activeTag:document.activeElement?.tagName }));
    assert.ok(metrics.scrollWidth <= metrics.clientWidth, `${suffix} horizontal overflow`);
    await candidate.keyboard.press('Tab');
    const focus = await candidate.evaluate(() => ({tag:document.activeElement?.tagName, name:document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0,80), interactive:document.activeElement instanceof HTMLElement && document.activeElement.matches('a,button,input,select,textarea,[tabindex]')}));
    assert.equal(focus.interactive, true, `${suffix} keyboard focus reaches an interactive control`);
    observations.push({name:`${suffix}-keyboard`,focus});
    await candidate.close();
  }
  assert.equal(external.length, 0, 'no external transport attempts');
  assert.equal(errors.length, 0, 'no page exceptions');
  const cases = ['upload-order','two-input-mapping','explicit-alias-error','keyboard-header-and-prepare','preflight','selected-value-and-name-preview','selected-sample-reopen','name-collision','processing','six-results','individual-c2-name-reopen','zip-six','two-manifests-reopen','cancel-preserves','replacement-url-cleanup','numbered-damaged','responsive-selected','axe','initial-cls'];
  await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify({ cases, external, errors, consoleErrors, screenshots, downloads, observations, browser:await browser.version() }, null, 2));
  console.log(JSON.stringify({ cases:cases.length, screenshots:screenshots.length, downloads:downloads.length, external:external.length, errors:errors.length }));
} finally {
  await context.close(); await browser.close();
}
