import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4220', insecure = process.env.INSECURE_TEST_URL || base.replace('127.0.0.1', '10.20.10.229'), out = process.env.IE1_OUTPUT || '/tmp/sol-ie1/p3/ui';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const png = new PNG({ width: 64, height: 48 });
png.data.fill(255);
const buffer = PNG.sync.write(png), records = [];
async function setup(lang = 'en', url = base) {
    const features = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`, 'utf8')), lib = features.image.library, labels = lib.labels;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*', route => route.request().url().startsWith(url + '/') || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
    await context.addInitScript(() => {
        window.__p3Workers = 0;
        window.__p3Terminated = 0;
        const Original = window.Worker;
        window.Worker = function (url, options) {
            if (String(url).includes('bgRemoval.worker')) {
                window.__p3Workers++;
                return { onmessage: null, postMessage(request) { this.timer = setInterval(() => this.onmessage?.({ data: { type: 'progress', runId: request.runId, stage: 'run', current: 0, total: 1 } }), 50); }, terminate() { if (this.stopped)
                        return; this.stopped = true; clearInterval(this.timer); window.__p3Terminated++; } };
            }
            return new Original(url, options);
        };
        if (typeof CacheStorage !== 'undefined') {
        const remove = CacheStorage.prototype.delete;
        CacheStorage.prototype.delete = function (name) {
            if (window.__p3HoldDelete && name === 'worklazy-models-v1')
                return new Promise(resolve => window.__p3ReleaseDelete = async () => { const value = await remove.call(this, name); resolve(value); window.__p3DeleteResolved = true; });
            return remove.call(this, name);
        };
        }
    });
    const page = await context.newPage(), heavy = [], errors = [];
    page.setDefaultTimeout(45000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/\/vendor\/(bg-removal|onnxruntime-web)\//.test(r.url()))
        heavy.push(r.url()); });
    await page.goto(`${url}/${lang}/tools/image-studio/`);
    await page.getByTestId('library-image-editor').locator('.lower-canvas').waitFor();
    await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'p3-synthetic.png', mimeType: 'image/png', buffer });
    await page.getByText(lang === 'en' ? '1 files selected' : '1개 파일 선택됨', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    const panel = page.locator('.asp-options-panel'), controls = page.getByTestId('image-background-controls');
    const label = key => labels[key] || key;
    const open = async () => { await page.getByRole('button', { name: label('Magic — more tools'), exact: true }).click(); await page.getByRole('menuitem', { name: label('Remove background'), exact: true }).click(); await panel.getByRole('button', { name: label('Remove background'), exact: true }).waitFor(); };
    const run = async () => panel.getByRole('button', { name: label('Remove background'), exact: true }).click();
    return { context, page, panel, controls, lib, label, open, run, heavy, errors };
}
try {
    for (const lang of ['en', 'ko'])
        await test(`${lang}: HTTP panel warns before execution and failure owns focus`, async () => {
            const f = await setup(lang, insecure);
            const { page, panel, open, run, heavy, lib, context, errors } = f;
            try {
                await open();
                assert.match(await panel.locator('.asp-hint').innerText(), /HTTPS/);
                assert.ok((await panel.locator('.asp-hint').innerText()).includes(lib.httpsHint));
                assert.equal(heavy.length, 0);
                assert.equal(await page.locator('dialog[open]').count(), 0);
                assert.equal(await page.evaluate(() => window.__p3Workers), 0);
                assert.equal(await page.getByTestId('image-editor-operation-error').count(), 0);
                await page.screenshot({ path: `${out}/${lang}-http-before-run.png` });
                await run();
                const alert = page.getByTestId('image-editor-operation-error');
                await alert.waitFor();
                await page.waitForFunction(() => document.activeElement?.dataset.testid === 'image-editor-operation-error');
                await page.waitForTimeout(100);
                assert.deepEqual(await alert.evaluate(n => ({focused:document.activeElement === n, tag:n.tagName, live:!!n.closest('[role=alert],[role=status],[aria-live]')})), {focused:true, tag:'H3', live:false});
                assert.deepEqual(heavy, []);
                assert.equal(await page.locator('dialog[open]').count(), 0);
                assert.equal(await page.evaluate(() => window.__p3Workers), 0);
                assert.deepEqual(errors, []);
                records.push({ name: lang + '-http', heavy: 0, workers: 0, focus: await alert.evaluate(n => n.dataset.testid) });
            }
            finally {
                await context.close();
            }
        });
    for (const lang of ['en', 'ko'])
        await test(`${lang}: cancellation status replaces older notices and clears on the next work`, async () => {
            const { context, page, panel, controls, lib, label, open, run, heavy, errors } = await setup(lang);
            try {
                await controls.locator('select').selectOption('person');
                await open();
                const clear = controls.getByRole('button', { name: lib.clearModels, exact: true });
                await clear.click();
                await page.getByText(lib.modelsCleared, { exact: true }).waitFor();
                await run();
                const dialog = page.getByRole('dialog', { name: lib.downloadTitle });
                await dialog.waitFor();
                assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 0);
                assert.equal(heavy.length, 0);
                await dialog.getByRole('button', { name: lib.download, exact: true }).click();
                await page.waitForFunction(() => window.__p3Workers === 1);
                await panel.getByRole('button', { name: label('Cancel background removal'), exact: true }).click();
                const status = page.getByTestId('image-background-cancelled');
                await status.waitFor();
                assert.equal(await status.innerText(), lib.cancelled);
                await page.waitForFunction(() => !document.querySelector('[data-testid=image-background-controls] select').disabled);
                assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 0);
                assert.equal(await page.getByRole('alert').count(), 0);
                await page.screenshot({ path: `${out}/${lang}-cancel-status.png` });
                await run();
                await page.waitForFunction(() => window.__p3Workers === 2);
                assert.equal(await status.count(), 0);
                await controls.getByRole('button', { name: lang === 'en' ? 'Cancel operation' : '작업 취소', exact: true }).click();
                await status.waitFor();
                await page.getByRole('button', { name: 'JPG', exact: true }).click();
                await status.waitFor({ state: 'hidden' });
                await clear.click();
                await page.getByText(lib.modelsCleared, { exact: true }).waitFor();
                await page.getByRole('button', { name: 'PNG', exact: true }).click();
                assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 0);
                await clear.click();
                await page.getByText(lib.modelsCleared, { exact: true }).waitFor();
                await page.locator('.upper-canvas').click();
                assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 1, 'ordinary canvas clicks retain the completed notice');
                await page.getByRole('button', { name: label('Export'), exact: true }).click();
                assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 1, 'opening a tool retains the completed notice');
                await page.locator('.asp-menu--export').getByRole('button', { name: 'JPEG', exact: true }).click();
                assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 0, 'choosing a format starts new work');
                const exportScrim = page.locator('.asp-pop__scrim');
                if (await exportScrim.isVisible()) await page.locator('.asp-menu--export').getByRole('button', {name:'JPEG',exact:true}).press('Escape');
                await page.locator('.asp-rail__slot > button').filter({hasText:label('Crop & rotate')}).first().click();
                await clear.click();
                await page.getByText(lib.modelsCleared, {exact:true}).waitFor();
                await panel.getByRole('button', {name:label('Rotate right'),exact:true}).click();
                await page.getByText(lib.modelsCleared, {exact:true}).waitFor({state:'hidden'});
                assert.deepEqual(errors, []);
                records.push({ name: lang + '-cancel', workerStops: await page.evaluate(() => window.__p3Terminated), status: lib.cancelled });
            }
            finally {
                await context.close();
            }
        });
    await test('real edits invalidate a pending model-deletion notice', async () => {
        const {context, page, panel, controls, lib, label} = await setup();
        try {
            await page.locator('.asp-rail__slot > button').filter({hasText:label('Crop & rotate')}).first().click();
            await page.evaluate(() => window.__p3HoldDelete = true);
            await controls.getByRole('button', {name:lib.clearModels,exact:true}).click();
            await page.waitForFunction(() => typeof window.__p3ReleaseDelete === 'function');
            await panel.getByRole('button', {name:label('Rotate right'),exact:true}).click();
            await page.evaluate(() => window.__p3ReleaseDelete());
            await page.waitForFunction(() => window.__p3DeleteResolved);
            await page.waitForTimeout(100);
            assert.equal(await page.getByText(lib.modelsCleared, {exact:true}).count(), 0);
        } finally { await context.close(); }
    });
    await test('late model-deletion completion cannot restore a stale notice', async () => {
        const { context, page, controls, lib } = await setup();
        try {
            await page.evaluate(() => window.__p3HoldDelete = true);
            await controls.getByRole('button', { name: lib.clearModels, exact: true }).click();
            await page.waitForFunction(() => typeof window.__p3ReleaseDelete === 'function');
            await page.getByRole('button', { name: 'JPG', exact: true }).click();
            await page.evaluate(() => window.__p3ReleaseDelete());
            await page.waitForFunction(() => window.__p3DeleteResolved);
            await page.waitForTimeout(100);
            assert.equal(await page.getByText(lib.modelsCleared, { exact: true }).count(), 0);
        }
        finally {
            await context.close();
        }
    });
}
finally {
    await fs.writeFile(out + '/results.json', JSON.stringify(records, null, 2) + '\n');
    await browser.close();
}
