import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

export async function runPdfCompareUiLifecycle({ page, root, out, corpus, baseUrl }) {
  const ExcelJS = createRequire(path.join(root, 'package.json'))('exceljs');
  const downloads = []; page.on('download', item => downloads.push(item));
  const result = { cases: [] };
  const heading = () => page.getByRole('heading', { name: 'Comparison results' });
  const report = () => page.getByRole('button', { name: 'Download report' });
  const files = () => page.locator('[data-tool-page="pdf-compare"] input[type="file"]');
  const fixture = name => path.join(corpus, 'fixtures', `${name}.pdf`);
  const save = () => fs.writeFile(path.join(out, 'lifecycle-results.json'), JSON.stringify(result, null, 2));
  const setup = async two => {
    await page.goto(`${baseUrl}/en/tools/pdf-compare/`);
    const consent = page.getByRole('button', { name: 'Use essential features only' }); if (await consent.count()) await consent.click();
    await files().nth(0).setInputFiles(fixture('normal-ascii')); await files().nth(1).setInputFiles(fixture('changed-word'));
    if (two) { await page.getByRole('button', { name: 'Add comparison pair' }).click(); await files().nth(2).setInputFiles(fixture('normal-number')); await files().nth(3).setInputFiles(fixture('changed-number')); }
    await page.getByRole('button', { name: 'Start comparison' }).click(); await heading().waitFor({ timeout: 120000 });
    await page.evaluate(() => {
      window.reportEvents = { created: [], revoked: [], clicks: [] };
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), click = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = blob => { const url = create(blob); if (/spreadsheetml|zip/.test(blob.type)) window.reportEvents.created.push(url); return url; };
      URL.revokeObjectURL = url => { if (window.reportEvents.created.includes(url)) window.reportEvents.revoked.push(url); return revoke(url); };
      HTMLAnchorElement.prototype.click = function () { if (/\.(xlsx|zip)$/.test(this.download)) window.reportEvents.clicks.push(this.download); return click.call(this); };
    });
  };
  const actions = {
    swap: () => page.getByRole('button', { name: 'Swap sides' }).first().click(),
    threshold: () => page.getByRole('combobox').first().selectOption('32'),
    replacement: () => files().nth(0).setInputFiles(fixture('normal-number')),
    add: () => page.getByRole('button', { name: 'Add comparison pair' }).click(),
    remove: () => page.getByRole('button', { name: 'Remove pair' }).first().click(),
    mapping: async () => { await page.getByRole('button', { name: /Manual matching/ }).first().click(); await page.getByRole('combobox', { name: 'Before PDF' }).first().selectOption(''); await page.getByRole('button', { name: 'Apply mapping and compare again' }).click(); },
    rerun: () => page.getByRole('button', { name: 'Compare again' }).click(),
    unmount: async () => { await page.locator('a[href="/en/"]').first().click(); await page.locator('[data-tool-page="pdf-compare"]').waitFor({ state: 'detached' }); },
  };
  const selectedCase = process.env.PDF_COMPARE_UI_LIFECYCLE_CASE;
  for (const [name, action] of Object.entries(actions).filter(([name]) => !selectedCase || selectedCase === name)) {
    await setup(name === 'remove'); let release, requested; const gate = new Promise(resolve => { release = resolve; }), pending = new Promise(resolve => { requested = resolve; });
    const pattern = '**/xlsxReport-*.js'; await page.route(pattern, async route => { requested(); await gate; await route.continue(); });
    const initial = downloads.length; await report().click();
    let timeout; try { await Promise.race([pending, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('XLSX chunk not requested')), 20000); })]); } finally { clearTimeout(timeout); }
    try { await action(); } finally { release(); }
    const immediate = { oldResultsHidden: await heading().count() === 0, oldDownloadAbsent: await report().count() === 0 };
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(750);
    const events = await page.evaluate(() => window.reportEvents);
    const row = { name, ...immediate, lateDownloads: downloads.length - initial, reportUrls: events.created.length, anchorClicks: events.clicks.length };
    result.cases.push(row); await save();
    assert.equal(row.lateDownloads, 0, `${name}: stale automatic download`); assert.equal(row.reportUrls, 0, `${name}: stale result URL`); assert.equal(row.anchorClicks, 0);
    if (name !== 'rerun') assert.ok(row.oldResultsHidden && row.oldDownloadAbsent);
    if (name === 'unmount') assert.equal(await page.locator('[data-tool-page="pdf-compare"]').count(), 0);
    await page.unroute(pattern);
    if (name === 'swap') {
      await page.getByRole('button', { name: 'Start comparison' }).click(); await heading().waitFor();
      const promise = page.waitForEvent('download'); await report().click(); const download = await promise; const output = path.join(out, 'current-direction.xlsx'); await download.saveAs(output);
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(output); const names = [workbook.worksheets[0].getCell('A2').value, workbook.worksheets[0].getCell('B2').value];
      assert.deepEqual(names, ['changed-word.pdf', 'normal-ascii.pdf']); await page.getByRole('button', { name: 'Swap sides' }).click();
      const urls = await page.evaluate(() => window.reportEvents); assert.ok(urls.created.length === 1 && urls.revoked.includes(urls.created[0]));
      result.normalDownload = { names, revokedOnInvalidation: true }; await save();
    }
  }
  await setup(); await page.evaluate(() => {
    const original = File.prototype.arrayBuffer, pending = [];
    window.releaseFileReads = () => { File.prototype.arrayBuffer = original; pending.forEach(release => release()); };
    File.prototype.arrayBuffer = function () { const file = this; return new Promise(resolve => pending.push(() => resolve(original.call(file)))); };
  });
  await page.getByRole('button', { name: 'Compare again' }).click(); await page.getByRole('button', { name: 'Cancel comparison' }).waitFor();
  result.rerun = { oldResultsHidden: await heading().count() === 0, oldDownloadAbsent: await report().count() === 0 }; await save(); assert.ok(result.rerun.oldResultsHidden && result.rerun.oldDownloadAbsent);
  await page.getByRole('button', { name: 'Cancel comparison' }).click(); await page.evaluate(() => window.releaseFileReads()); await heading().waitFor();
  await files().nth(0).setInputFiles(fixture('long')); await files().nth(1).setInputFiles(fixture('long')); await page.getByRole('button', { name: 'Start comparison' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(el => el.textContent.includes('Comparing pages.') && Number(el.textContent.match(/(\d+)%/)?.[1]) >= 3));
  await page.getByRole('button', { name: 'Cancel comparison' }).click(); await heading().waitFor(); assert.ok(await page.getByText(/partial result containing completed pages/).count());
  const promise = page.waitForEvent('download'); await report().click(); const partial = await promise; const output = path.join(out, 'canceled-partial.xlsx'); await partial.saveAs(output);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(output); const states = workbook.worksheets[0].getColumn(7).values.slice(2);
  result.partial = { complete: states.filter(s => s === 'Complete').length, canceled: states.filter(s => s === 'Canceled').length, unknown: states.filter(s => s === 'Unknown').length };
  assert.ok(result.partial.complete > 0 && result.partial.canceled > 0 && result.partial.unknown > 0); await save();
  console.log(`PASS ${result.cases.length} selected delayed export cases; hidden old rerun result and canceled partial XLSX; current XLSX/revoke checked when swap selected`);
}
