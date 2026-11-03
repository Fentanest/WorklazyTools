import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4230', out = process.env.IE1_OUTPUT || '/tmp/sol-ie1/p3b/ui';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = new PNG({ width: 960, height: 640 });
p.data.fill(255);
const buffer = PNG.sync.write(p), results = [];
async function setup(lang, fallback = false) {
    const lib = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`, 'utf8')).image.library, context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*', r => r.request().url().startsWith(base + '/') || /^(blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    if (fallback)
        await context.addInitScript(() => { const url = HTMLCanvasElement.prototype.toDataURL, blob = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toDataURL = function (type, ...args) { return url.call(this, type === 'image/webp' ? 'image/png' : type, ...args); }; HTMLCanvasElement.prototype.toBlob = function (callback, type, ...args) { return blob.call(this, callback, type === 'image/webp' ? 'image/png' : type, ...args); }; });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(45000);
    await page.goto(`${base}/${lang}/tools/image-studio/`);
    await page.getByTestId('library-image-editor').locator('.lower-canvas').waitFor();
    await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'p3b-synthetic.png', mimeType: 'image/png', buffer });
    await page.getByText(lang === 'en' ? '1 files selected' : '1개 파일 선택됨', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    return { page, context, lib, errors, label: key => lib.labels[key] || key };
}
try {
    for (const lang of ['en', 'ko'])
        for (const route of ['native', 'footer'])
            await test(`${lang} ${route}: codec failure uses the JPG chip terminology`, async () => {
                const { page, context, lib, label, errors } = await setup(lang, true);
                try {
                    let downloads = 0;
                    page.on('download', () => downloads++);
                    if (route === 'native') {
                        await page.getByRole('button', { name: label('Export'), exact: true }).click();
                        await page.locator('.asp-menu--export').getByRole('button', { name: 'WEBP', exact: true }).click();
                        await page.locator('.asp-menu--export .asp-download').click();
                    }
                    else {
                        await page.getByRole('button', { name: 'WebP', exact: true }).click();
                        await page.getByTestId('image-editor-export-action').locator('button').click();
                    }
                    const alert = page.getByTestId('image-editor-operation-error');
                    await alert.waitFor();
                    await page.waitForFunction(() => document.activeElement?.dataset.testid === 'image-editor-operation-error');
                    assert.equal(await alert.innerText(), lib.unsupportedFormat);
                    assert.match(await alert.innerText(), /JPG/);
                    assert.doesNotMatch(await alert.innerText(), /JPEG/);
                    assert.equal(downloads, 0);
                    assert.deepEqual(errors, []);
                    results.push({ lang, route, message: await alert.innerText(), downloads });
                    await page.screenshot({ path: `${out}/${lang}-${route}-codec.png` });
                }
                finally {
                    await context.close();
                }
            });
    for (const lang of ['en', 'ko'])
        await test(`${lang}: crop help distinguishes preview coordinates from output pixels`, async () => {
            const { page, context, lib, label, errors } = await setup(lang);
            try {
                await page.locator('.asp-rail__slot > button').filter({ hasText: label('Crop & rotate') }).first().click();
                const text = (await page.locator('.asp-options-panel .asp-hint').allTextContents()).join('\n');
                if (lang === 'ko') {
                    assert.match(text, /미리보기 단위/);
                    assert.match(text, /원본 픽셀 밀도/);
                }
                else {
                    assert.match(text, /preview coordinates/);
                    assert.match(text, /source image’s pixel density/);
                }
                for (const key of ['Left', 'Top', 'Width', 'Height']) {
                    const input = page.getByRole('spinbutton', { name: label(key), exact: true });
                    await input.waitFor();
                    assert.equal(await input.count(), 1);
                }
                assert.deepEqual(errors, []);
                results.push({ lang, cropHint: text });
                await page.locator('.asp-options-panel .asp-hint').last().scrollIntoViewIfNeeded();
                await page.screenshot({ path: `${out}/${lang}-crop-help.png` });
            }
            finally {
                await context.close();
            }
        });
}
finally {
    await fs.writeFile(out + '/results.json', JSON.stringify(results, null, 2) + '\n');
    await browser.close();
}
