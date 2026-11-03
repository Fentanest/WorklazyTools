import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4210', out = process.env.IE1_OUTPUT || '/tmp/sol-ie1/safari-fix/output-pixels';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const facts = [];
function fixture(width, height, alpha = false) {
    const p = new PNG({ width, height });
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            p.data[i] = x % 2 ? 250 : 15;
            p.data[i + 1] = y % 2 ? 235 : 25;
            p.data[i + 2] = (x + y) % 2 ? 245 : 35;
            p.data[i + 3] = alpha && (x < width / 4 || y < height / 4) ? 0 : 255;
        }
    return PNG.sync.write(p);
}
async function setup(profile = 'desktop', fallback = false) {
    const context = await browser.newContext(profile === 'mobile' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await context.route('**/*', r => r.request().url().startsWith(base + '/') || /^(blob:|data:)/.test(r.request().url()) ? r.continue() : r.abort());
    if (fallback)
        await context.addInitScript(() => { const url = HTMLCanvasElement.prototype.toDataURL, blob = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toDataURL = function (type, ...args) { return url.call(this, type === 'image/webp' ? 'image/png' : type, ...args); }; HTMLCanvasElement.prototype.toBlob = function (callback, type, ...args) { return blob.call(this, callback, type === 'image/webp' ? 'image/png' : type, ...args); }; });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('dialog', d => d.accept());
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/en/tools/image-studio/');
    await page.locator('[data-testid=library-image-editor] .lower-canvas, [data-testid=image-editor-canvas-stage] canvas').first().waitFor().catch(async error=>{await fs.writeFile(path.join(out,'setup-failure.json'),JSON.stringify({url:page.url(),errors,body:await page.locator('body').innerText()},null,2));throw error});
    const library = await page.getByTestId('library-image-editor').count() > 0;
    if (process.env.EXPECT_ENGINE)
        assert.equal(library, process.env.EXPECT_ENGINE === 'library');
    return { context, page, library, errors };
}
async function put(page, library, buffer, name = 'pixel-source.png') {
    if (library)
        await page.evaluate(() => window.__pixelOldCanvas = document.querySelector('.lower-canvas'));
    await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name, mimeType: 'image/png', buffer });
    await page.getByText('1 files selected', { exact: true }).waitFor();
    if (library)
        await page.waitForFunction(() => document.querySelector('.lower-canvas') !== window.__pixelOldCanvas && !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    else {
        const input = PNG.sync.read(buffer);
        await page.waitForFunction(([w, h]) => { const n = document.querySelector('[data-testid=image-editor-export-result]'); return n && +n.dataset.width === w && +n.dataset.height === h; }, [input.width, input.height]);
    }
}
async function readDownload(page, pending, name) {
    const d = await pending, p = path.join(out, name);
    await d.saveAs(p);
    const bytes = await fs.readFile(p);
    let dimensions = null;
    try {
        dimensions = await page.evaluate(async (list) => { const b = await createImageBitmap(new Blob([new Uint8Array(list)])); const s = [b.width, b.height]; b.close(); return s; }, [...bytes]);
    }
    catch { }
    const record = { file: p, suggested: d.suggestedFilename(), bytes: bytes.length, magic: bytes.subarray(0, 16).toString('hex'), dimensions };
    facts.push(record);
    return { ...record, buffer: bytes };
}
async function native(page, format, name, decision) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('.asp-menu--export').getByRole('button', { name: format.toUpperCase(), exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.locator('.asp-menu--export .asp-download').click();
    if (decision) {
        const d = page.getByRole('dialog', { name: 'This format may retain the original' });
        await d.waitFor();
        await d.getByRole('button', { name: decision, exact: true }).click();
    }
    return readDownload(page, pending, name);
}
async function footer(page, format, name) { await page.getByRole('button', { name: format === 'jpeg' ? 'JPG' : format === 'webp' ? 'WebP' : 'PNG', exact: true }).click(); const pending = page.waitForEvent('download'); await page.getByTestId('image-editor-export-action').locator('button').click(); return readDownload(page, pending, name); }
function encoding(file, format) {
    if (format === 'png')
        assert.equal(file.buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    else if (format === 'jpeg')
        assert.equal(file.buffer.subarray(0, 3).toString('hex'), 'ffd8ff');
    else {
        assert.equal(file.buffer.subarray(0, 4).toString(), 'RIFF');
        assert.equal(file.buffer.subarray(8, 12).toString(), 'WEBP');
    }
    assert.match(file.suggested, format === 'jpeg' ? /\.jpe?g$/ : new RegExp('\\.' + format + '$'));
}
try {
    const discovery = await setup();
    const engine = discovery.library ? 'library' : 'legacy';
    await discovery.context.close();
    for (const profile of ['desktop', 'mobile'])
        for (const [width, height] of [[960, 640], [64, 48]])
            for (const format of ['png', 'jpeg', 'webp'])
                await test(`original pixels ${profile} ${format} ${width}x${height}`, async () => {
                    const { context, page, library, errors } = await setup(profile);
                    try {
                        const source = fixture(width, height);
                        await put(page, library, source);
                        const file = await footer(page, format, `${engine}-${profile}-${width}-${format}.${format === 'jpeg' ? 'jpg' : format}`);
                        encoding(file, format);
                        assert.deepEqual(file.dimensions, [width, height], 'automatic export must use source pixels, independent of viewport/DPR');
                        if (format === 'png') {
                            const decoded = PNG.sync.read(file.buffer), input = PNG.sync.read(source);
                            assert.equal(Buffer.compare(decoded.data, input.data), 0, 'one-pixel checkerboard detail and alpha must survive; increasing a preview raster is insufficient');
                        }
                        if (library) {
                            const direct = await native(page, format, `${engine}-${profile}-${width}-native.${format === 'jpeg' ? 'jpg' : format}`);
                            encoding(direct, format);
                            assert.deepEqual(direct.dimensions, [width, height]);
                            assert.equal(direct.suggested, file.suggested, 'native/footer download basename must agree');
                        }
                        assert.deepEqual(errors, []);
                    }
                    finally {
                        await context.close();
                    }
                });
    for (const profile of ['desktop', 'mobile'])
        await test(`alpha dimensions ${profile}`, async () => {
            const { context, page, library, errors } = await setup(profile);
            try {
                const source = fixture(320, 200, true);
                await put(page, library, source, 'transparent.png');
                const file = await footer(page, 'png', `${engine}-${profile}-alpha.png`);
                assert.deepEqual(file.dimensions, [320, 200]);
                const input = PNG.sync.read(source), actual = PNG.sync.read(file.buffer);
                for (let i = 3; i < input.data.length; i += 4)
                    assert.equal(actual.data[i], input.data[i], 'alpha is preserved without preview margins');
                assert.deepEqual(errors, []);
            }
            finally {
                await context.close();
            }
        });
    for (const route of discovery.library ? ['native', 'footer'] : ['footer'])
        await test(`WebP PNG-fallback is rejected ${route}`, async () => {
            const { context, page, library } = await setup('desktop', true);
            try {
                await put(page, library, fixture(64, 48));
                let downloads = 0;
                page.on('download', () => downloads++);
                if (route === 'native') {
                    await page.getByRole('button', { name: 'Export', exact: true }).click();
                    await page.locator('.asp-menu--export').getByRole('button', { name: 'WEBP', exact: true }).click();
                    await page.locator('.asp-menu--export .asp-download').click();
                }
                else {
                    await page.getByRole('button', { name: 'WebP', exact: true }).click();
                    await page.getByTestId('image-editor-export-action').locator('button').click();
                }
                await page.getByRole('alert').filter({ hasText: /cannot encode/ }).waitFor();
            await page.waitForFunction(() => document.activeElement?.closest('[role=alert]'));
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'alert', 'failure focus remains at the operation alert');
                await page.waitForTimeout(100);
                assert.equal(downloads, 0, 'unsupported encoder must not produce a disguised PNG download');
            }
            finally {
                await context.close();
            }
        });
    if (discovery.library) {
        for (const [profile, width, height, expected] of [['desktop', 4000, 3000, [4000, 3000]], ['mobile', 6000, 4000, [4096, 2731]]]) {
            await test(`automatic source pixels ${profile} ${width}x${height}`, async () => {
                const { context, page, library } = await setup(profile);
                try {
                    await put(page, library, fixture(width, height));
                    if (profile === 'mobile') assert.match(await page.getByTestId('image-editor-shrink').innerText(), /6000×4000.*4096×2731/);
                    const file = await footer(page, 'png', `automatic-${profile}-${width}.png`);
                    assert.deepEqual(file.dimensions, expected, 'no custom size fields are used to mask the automatic export plan');
                    const pixels = PNG.sync.read(file.buffer);
                    assert.equal(pixels.data[3], 255, 'no preview margin appears around the photo');
                } finally { await context.close(); }
            });
        }
        await test('changing footer format hides the old result download', async () => {
            const { context, page, library } = await setup();
            try {
                await put(page, library, fixture(320, 200));
                await page.locator('.asp-commit').click();
                await page.getByTestId('image-editor-result').locator('a[download]').waitFor();
                await page.getByRole('button', { name: 'JPG', exact: true }).click();
                await page.getByTestId('image-editor-result').waitFor({ state: 'hidden' });
                const file = await footer(page, 'jpeg', 'changed-format.jpg');
                encoding(file, 'jpeg');
                assert.deepEqual(file.dimensions, [320, 200]);
            } finally { await context.close(); }
        });
        await test('a blank drawing stays protected when its result format changes', async () => {
            const { context, page } = await setup();
            try {
                await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
                await page.locator('.asp-rail__slot > button').filter({ hasText: /^Text$/ }).first().click();
                await page.locator('#asp-text-input').fill('Keep this drawing');
                await page.locator('.asp-text-add .asp-btn-accent').click();
                await page.locator('.asp-commit').click();
                await page.getByTestId('image-editor-result').locator('a[download]').waitFor();
                await page.getByRole('button', { name: 'JPG', exact: true }).click();
                await page.getByTestId('image-editor-result').waitFor({ state: 'hidden' });
                await page.getByRole('link', { name: 'Home', exact: true }).first().click();
                await page.getByTestId('unsaved-work-dialog').waitFor();
            } finally { await context.close(); }
        });
        await test('format changes discard an older pending preview result', async () => {
            const { context, page, library } = await setup();
            try {
                await put(page, library, fixture(320, 200));
                await page.getByTestId('image-editor-png-size').locator('input[type=number]').first().fill('200');
                await page.evaluate(() => {
                    const original = HTMLCanvasElement.prototype.toBlob;
                    window.__pixelHold = true;
                    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
                        if (window.__pixelHold) { window.__pixelHold = false; window.__pixelRelease = () => original.call(this, callback, ...args); }
                        else original.call(this, callback, ...args);
                    };
                });
                await page.locator('.asp-commit').click();
                await page.waitForFunction(() => typeof window.__pixelRelease === 'function');
                await page.getByRole('button', { name: 'JPG', exact: true }).click();
                await page.evaluate(() => window.__pixelRelease());
                await page.getByText('The edit changed while the result was being prepared. Create the result again.', { exact: true }).waitFor();
                assert.equal(await page.getByTestId('image-editor-result').count(), 0);
            } finally { await context.close(); }
        });

        for (const format of ['svg', 'json', 'pdf'])
            await test(`image-frame ${format} shares original pixel plan`, async () => {
                const { context, page, library } = await setup();
                try {
                    await put(page, library, fixture(960, 640));
                    await page.locator('.asp-rail__slot > button').filter({ hasText: /^Redact$/ }).first().click();
                    await page.getByRole('button', { name: 'Solid', exact: true }).click();
                    for (const [label, value] of [['Left', '100'], ['Top', '100'], ['Width', '100'], ['Height', '80']])
                        await page.getByRole('spinbutton', { name: label, exact: true }).fill(value);
                    await page.getByRole('button', { name: 'Apply redaction', exact: true }).click();
                    const file = await native(page, format, `image-frame.${format}`, format === 'pdf' ? undefined : 'Flatten layers and export');
                    if (format === 'svg') {
                        const text = file.buffer.toString();
                        assert.match(text, /<svg[^>]*width="960"[^>]*height="640"/);
                        assert.equal((text.match(/<image\b/g) || []).length, 1);
                    }
                    else if (format === 'json') {
                        const scene = JSON.parse(file.buffer.toString());
                        assert.equal(scene.objects.length, 1);
                        const dims = await page.evaluate(async (src) => { const b = await createImageBitmap(await (await fetch(src)).blob()); return [b.width, b.height]; }, scene.objects[0].src);
                        assert.deepEqual(dims, [960, 640]);
                    }
                    else {
                        const pdf = await PDFDocument.load(file.buffer), images = pdf.context.enumerateIndirectObjects().flatMap(([, o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype'))?.toString() === '/Image' ? [[+o.dict.get(PDFName.of('Width')).toString(), +o.dict.get(PDFName.of('Height')).toString()]] : []);
                        assert.ok(images.length);
                        assert.ok(images.every(s => s[0] === 960 && s[1] === 640));
                    }
                }
                finally {
                    await context.close();
                }
            });
        await test('pending warning retains captured SVG filename and bytes', async () => {
            const { context, page, library } = await setup();
            try {
                await put(page, library, fixture(320, 200));
                await page.locator('.asp-rail__slot > button').filter({ hasText: /^Redact$/ }).first().click();
                await page.getByRole('button', { name: 'Solid', exact: true }).click();
                await page.getByRole('button', { name: 'Apply redaction', exact: true }).click();
                await page.getByRole('button', { name: 'Export', exact: true }).click();
                await page.locator('.asp-menu--export').getByRole('button', { name: 'SVG', exact: true }).click();
                const pending = page.waitForEvent('download');
                await page.locator('.asp-menu--export .asp-download').click();
                const dialog = page.getByRole('dialog', { name: 'This format may retain the original' });
                await dialog.waitFor();
                await page.getByRole('button', { name: 'Export', exact: true }).evaluate(n => n.click());
                await page.locator('.asp-menu--export').getByRole('button', { name: 'JSON', exact: true }).evaluate(n => n.click());
                await dialog.getByRole('button', { name: 'Flatten layers and export', exact: true }).click();
                const file = await readDownload(page, pending, 'captured-format.svg');
                assert.match(file.suggested, /\.svg$/);
                assert.match(file.buffer.toString(), /<svg\b/);
            }
            finally {
                await context.close();
            }
        });
    }
}
finally {
    await fs.writeFile(path.join(out, 'files.json'), JSON.stringify(facts, null, 2) + '\n');
    await browser.close();
}
