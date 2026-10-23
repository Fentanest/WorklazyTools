import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';

test('static standalone Folder UI runs actual worker, filters, options, replacement and bilingual labels', { timeout: 120000 }, async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-static-ui-'));
  let server, browser;
  try {
    await build({ configFile: false, root: process.cwd(), base: './', plugins: [react(), tailwind()], resolve: { alias: { '@': path.resolve('src') } },
      logLevel: 'error', build: { outDir: out, emptyOutDir: false, rollupOptions: { input: path.resolve('tests/fixtures/folder-compare/index.html') } } });
    server = await preview({ configFile: false, root: process.cwd(), build: { outDir: out }, preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => { const url = new URL(route.request().url()); if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue(); external.push(url.href); return route.abort(); });
    const base = server.resolvedUrls.local[0]; const url = new URL('tests/fixtures/folder-compare/index.html', base).href;
    await page.goto(url); await page.getByRole('heading', { name: 'Folder comparison', exact: true }).waitFor();
    const makeZip = async (name, contents) => { const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false }); await writer.add(name, new BlobReader(new Blob([contents]))); return Buffer.from(await (await writer.close()).arrayBuffer()); };
    await page.getByLabel('Original Choose ZIP', { exact: true }).setInputFiles({ name: 'left.zip', mimeType: 'application/zip', buffer: await makeZip('root/a.txt', 'one') });
    await page.getByLabel('Revised Choose ZIP', { exact: true }).setInputFiles({ name: 'right.zip', mimeType: 'application/zip', buffer: await makeZip('root/a.txt', 'two') });
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Comparison finished' }).waitFor();
    await page.locator('summary').filter({ hasText: 'root/' }).click();
    await page.locator('summary').filter({ hasText: 'a.txt — Different bytes' }).waitFor();
    await page.getByRole('combobox', { name: 'All statuses' }).selectOption('equal'); assert.equal(await page.locator('summary').count(), 0);
    await page.getByRole('combobox', { name: 'All statuses' }).selectOption('all');
    await page.getByRole('checkbox', { name: 'Omit the first ZIP path component' }).check();
    assert.equal(await page.getByRole('status').count(), 0);
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Comparison finished' }).waitFor();
    await page.locator('summary').filter({ hasText: 'a.txt — Different bytes' }).click();
    await page.getByText('root/a.txt · 3 B', { exact: true }).first().waitFor();
    await page.getByLabel('Revised Choose ZIP', { exact: true }).setInputFiles({ name: 'equal.zip', mimeType: 'application/zip', buffer: await makeZip('root/a.txt', 'one') });
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Comparison finished' }).waitFor();
    await page.locator('summary').filter({ hasText: 'a.txt — Equal bytes' }).waitFor();
    if (process.env.FOLDER_UI_SCREENSHOT) await page.screenshot({ path: process.env.FOLDER_UI_SCREENSHOT, fullPage: true });
    await page.getByRole('textbox', { name: 'Filter paths' }).fill('missing'); assert.equal(await page.locator('summary').count(), 0);
    await page.goto(url + '?language=ko'); await page.getByRole('heading', { name: '폴더 비교', exact: true }).waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
  } finally { if (browser) await browser.close(); if (server) await server.httpServer.close(); await fs.rm(out, { recursive: true, force: true }); }
});
