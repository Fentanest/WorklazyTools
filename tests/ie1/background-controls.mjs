import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4210', insecure = process.env.INSECURE_TEST_URL || base.replace('127.0.0.1', '10.20.10.229'), out = process.env.IE1_OUTPUT || '/tmp/sol-ie1/safari-fix/bg-controls';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const image = new PNG({ width: 64, height: 48 });
image.data.fill(255);
const buffer = PNG.sync.write(image), records = {};
async function setup(url, fake = false) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*', r => r.request().url().startsWith(url + '/') || /^(blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    await context.addInitScript(({ fake }) => {
        window.__bgStages = [];
        window.__bgWorkers = 0;
        window.__bgTerminated = 0;
        window.__bgUiPhase = 'cold';
        const Original = window.Worker;
        window.Worker = function (url, options) {
            if (String(url).includes('bgRemoval.worker')) {
                window.__bgWorkers++;
                if (fake)
                    return {
                        onmessage: null, onerror: null,
                        postMessage(request) { this.timer = setInterval(() => this.onmessage?.({ data: { type: 'progress', runId: request.runId, stage: 'run', current: 0, total: 1 } }), 50); },
                        terminate() { if (this.stopped) return; this.stopped = true; clearInterval(this.timer); window.__bgTerminated++; }
                    };
            }
            return new Original(url, options);
        };
        let last = '';
        new MutationObserver(() => { const bar = document.querySelector('.asp-options-panel [role=progressbar]'); if (!bar)
            return; const stage = bar.parentElement.querySelector('.asp-field-label')?.textContent?.trim(), value = bar.getAttribute('aria-valuenow'), key = window.__bgUiPhase + stage + value; if (key !== last) {
            last = key;
            window.__bgStages.push({ phase: window.__bgUiPhase, stage, value });
        } }).observe(document, { subtree: true, childList: true, attributes: true });
    }, { fake });
    const page = await context.newPage(), heavy = [];
    page.setDefaultTimeout(45000);
    page.on('request', r => { if (/\/vendor\/(bg-removal|onnxruntime-web)\//.test(r.url()))
        heavy.push(r.url()); });
    await page.goto(url + '/en/tools/image-studio/');
    await page.getByTestId('library-image-editor').locator('.lower-canvas').waitFor();
    await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'bg-control.png', mimeType: 'image/png', buffer });
    await page.getByText('1 files selected', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    return { context, page, heavy };
}
async function start(page) { await page.getByRole('button', { name: 'Magic — more tools', exact: true }).click(); await page.getByRole('menuitem', { name: 'Remove background', exact: true }).click(); await page.getByRole('button', { name: 'Remove background', exact: true }).last().click(); }
try {
    await test('insecure HTTP rejects before model consent, heavy fetch or worker', async () => { const { context, page, heavy } = await setup(insecure); try {
        assert.equal(await page.evaluate(() => isSecureContext), false);
        await start(page);
        await page.getByRole('alert').filter({ hasText: /secure HTTPS/ }).waitFor();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('dialog[open]').count(), 0);
        assert.deepEqual(heavy, []);
        assert.equal(await page.evaluate(() => window.__bgWorkers), 0);
        records.http = { heavy, workers: 0, alert: await page.getByRole('alert').allTextContents() };
        await page.getByRole('alert').scrollIntoViewIfNeeded();
        await page.screenshot({ path: out + '/http-https-required.png' });
    }
    finally {
        await context.close();
    } });
    await test('panel cancel remains at the run action; cold progress and warm cached stage are honest', async () => { const { context, page, heavy } = await setup(base, true); try {
        await page.getByTestId('image-background-controls').locator('select').selectOption('person');
        await page.evaluate(async () => { await caches.delete('worklazy-models-v1'); });
        await start(page);
        assert.match(await page.locator('.asp-options-panel .asp-hint').first().innerText(), /41MB/);
        assert.doesNotMatch(await page.locator('.asp-options-panel .asp-hint').first().innerText(), /127MB/);
        const dialog = page.getByRole('dialog', { name: 'Download background removal files' });
        await dialog.waitFor();
        assert.equal(heavy.length, 0);
        await dialog.getByRole('button', { name: 'Download', exact: true }).click();
        await page.waitForFunction(() => window.__bgWorkers === 1);
        const cancel = page.locator('.asp-options-panel').getByRole('button', { name: 'Cancel background removal', exact: true });
        await cancel.waitFor();
        assert.equal(await cancel.isEnabled(), true);
        const box = await cancel.boundingBox();
        assert.ok(box.y >= 0 && box.y + box.height <= 900, 'cancel stays visible at the run-action position');
        await page.screenshot({ path: out + '/panel-cancel-cold.png' });
        assert.ok((await page.evaluate(() => window.__bgStages)).some(s => s.phase === 'cold' && s.stage === 'Downloading model…' && Number(s.value) > 0), 'native progress receives nonzero download progress');
        await cancel.click();
        await cancel.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.__bgTerminated), 1);
        assert.equal(await page.getByRole('alert').count(), 0);
        const before = heavy.length;
        await page.evaluate(() => window.__bgUiPhase = 'warm');
        await start(page);
        await page.waitForFunction(() => window.__bgWorkers === 2);
        await cancel.waitFor();
        const warm = await page.evaluate(() => window.__bgStages.filter(s => s.phase === 'warm'));
        assert.ok(warm.length);
        assert.ok(warm.every(s => s.stage !== 'Downloading model…'), 'cached runs never claim a download');
        assert.equal(heavy.length, before);
        await page.screenshot({ path: out + '/panel-cancel-warm.png' });
        await cancel.click();
        await cancel.waitFor({ state: 'hidden' });
        await page.getByTestId('image-background-controls').locator('select').selectOption('product');
        assert.match(await page.locator('.asp-options-panel .asp-hint').first().innerText(), /127MB/);
        assert.doesNotMatch(await page.locator('.asp-options-panel .asp-hint').first().innerText(), /41MB/);
        records.ui = { coldRequests: before, warmRequests: heavy.length - before, stages: await page.evaluate(() => window.__bgStages), terminated: await page.evaluate(() => window.__bgTerminated) };
    }
    finally {
        await context.close();
    } });
}
finally {
    await fs.writeFile(out + '/results.json', JSON.stringify(records, null, 2) + '\n');
    await browser.close();
}
