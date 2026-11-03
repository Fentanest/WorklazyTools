import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startRecoveryServer } from './recovery-server.mjs';

const output = path.resolve(process.env.GUIDE_OFFSET_OUTPUT || 'scratch/shell-a11y-fix1/offset-after');
const views = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile-320', width: 320, height: 640 },
  { name: 'native-200', zoom: true },
];
const records = [];
let server, browser, zoomContext, profiles;
const blockExternal = context => context.route('**/*', route => {
  const url = new URL(route.request().url());
  return !/^https?:$/.test(url.protocol) || url.origin === server.url ? route.continue() : route.abort();
});
before(async () => {
  await fs.mkdir(output, { recursive: true });
  server = await startRecoveryServer({ root: process.env.GUIDE_OFFSET_DIST || 'dist', port: 0 });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  profiles = await fs.mkdtemp(path.join(os.tmpdir(), 'shell-guide-offset-'));
  await fs.mkdir(path.join(profiles, 'Default'));
  await fs.writeFile(path.join(profiles, 'Default/Preferences'), JSON.stringify({ partition: { per_host_zoom_levels: { x: {
    '127.0.0.1': { zoom_level: Math.log(2) / Math.log(1.2) },
  } } } }));
  zoomContext = await chromium.launchPersistentContext(profiles, {
    executablePath: '/usr/bin/google-chrome', headless: true, viewport: null, serviceWorkers: 'block',
    args: ['--window-size=1280,1000', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  await blockExternal(zoomContext);
});
after(async () => {
  await zoomContext?.close(); await browser?.close(); await server?.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
  if (profiles) await fs.rm(profiles, { recursive: true, force: true });
});
async function ready(page, tool) {
  await page.locator('#tool-guide-title').waitFor();
  if (tool === 'document-redactor') await page.locator('.redactor-file-picker input[type=file]').waitFor({ timeout: 45000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
}
async function position(page) {
  // Wait for painted geometry, not a fixed sleep or the desired destination.
  // A wrong but settled endpoint must still fail checkHeading below.
  await page.evaluate(async () => {
    let previous, stable = 0;
    for (let frame = 0; frame < 150; frame++) {
      await new Promise(requestAnimationFrame);
      const rect = document.querySelector('#tool-guide-title').getBoundingClientRect();
      const geometry = [scrollY, rect.top, rect.bottom, document.documentElement.scrollHeight, innerHeight];
      stable = document.fonts.status === 'loaded' && previous && geometry.every((n, i) => Math.abs(n - previous[i]) < 0.1) ? stable + 1 : 0;
      previous = geometry;
      if (stable >= 5) return;
    }
    throw new Error('Anchor scroll did not settle');
  });
  return page.evaluate(() => {
    const title = document.querySelector('#tool-guide-title');
    const rect = title.getBoundingClientRect();
    const headers = [...document.querySelectorAll('.wl-topbar,.mobile-header,.app-topbar')].filter(el =>
      el.getClientRects().length && ['fixed', 'sticky'].includes(getComputedStyle(el).position));
    const headerBottom = Math.max(0, ...headers.map(el => el.getBoundingClientRect().bottom));
    return { count: document.querySelectorAll('#tool-guide-title').length, top: rect.top, bottom: rect.bottom,
      headerBottom, gap: rect.top - headerBottom, viewport: { width: innerWidth, height: innerHeight },
      outerWidth, dpr: devicePixelRatio, scale: visualViewport.scale, hash: location.hash,
      padding: getComputedStyle(document.documentElement).scrollPaddingBlockStart,
      margin: getComputedStyle(title).scrollMarginBlockStart };
  });
}
function checkHeading(row) {
  assert.equal(row.count, 1);
  assert.equal(row.hash, '#tool-guide-title');
  assert.ok(row.top >= row.headerBottom, `heading hidden above ${row.headerBottom}: ${row.top}`);
  assert.ok(row.bottom <= row.viewport.height, 'heading below viewport');
  assert.ok(row.gap <= 48, `duplicate header clearance: gap ${row.gap}px exceeds 48px`);
}
for (const lang of ['ko', 'en']) for (const tool of ['text-tools', 'payroll-calculator', 'document-redactor']) for (const view of views) {
  test(`${lang} ${tool} ${view.name}: guide has one header clearance`, { timeout: 90000 }, async () => {
    const context = view.zoom ? zoomContext : await browser.newContext({ viewport: { width: view.width, height: view.height }, serviceWorkers: 'block' });
    if (!view.zoom) await blockExternal(context);
    const page = await context.newPage(); const record = { lang, tool, view: view.name };
    try {
      await page.goto(`${server.url}/${lang}/tools/${tool}/`, { waitUntil: 'domcontentloaded' });
      await ready(page, tool);
      await page.locator('a[href="#tool-guide-title"]').first().click();
      record.click = await position(page);
      if (view.zoom) {
        assert.equal(record.click.viewport.width * 2, record.click.outerWidth);
        assert.equal(record.click.dpr, 2); assert.equal(record.click.scale, 1);
      }
      const cdp = await context.newCDPSession(page);
      try {
        const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        await fs.writeFile(path.join(output, `${lang}-${tool}-${view.name}.png`), Buffer.from(image.data, 'base64'));
      } finally { await cdp.detach(); }
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, tool);
      record.directFragment = await position(page);
      checkHeading(record.click); checkHeading(record.directFragment);
      if (lang === 'ko' && tool === 'document-redactor' && view.name === 'mobile-320') {
        // Force a late layout change after entry has already settled. Then
        // verify that keyboard navigation releases alignment, even with the
        // guide hash still present and another layout change afterwards.
        await page.evaluate(() => {
          const block = document.createElement('div');
          block.id = 'guide-layout-regression'; block.style.height = '200px';
          document.querySelector('.main-content').prepend(block);
        });
        record.lateLayout = await position(page); checkHeading(record.lateLayout);
        await page.keyboard.press('Control+Home');
        record.userScroll = await position(page);
        assert.ok(record.userScroll.top > record.userScroll.viewport.height, 'keyboard navigation must leave the guide');
        await page.evaluate(() => { document.getElementById('guide-layout-regression').style.height = '400px'; });
        record.releasedLayout = await position(page);
        assert.equal(record.releasedLayout.hash, '#tool-guide-title');
        assert.ok(record.releasedLayout.top > record.releasedLayout.viewport.height, 'later layout must not steal the viewport from the user');
      }
      record.passed = true;
    } catch (error) { record.passed = false; record.error = error.message; throw error; }
    finally {
      records.push(record);
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
      await page.close(); if (!view.zoom) await context.close();
    }
  });
}
