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
const blockExternal = context => context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (!/^https?:$/.test(url.protocol)) return route.continue();
  if (url.origin !== server.url) return route.abort();
  // Host network-change notifications can cancel Chromium's loopback fetches
  // mid-preparation. Fetch the real local response through Playwright's HTTP
  // client, keeping status, headers and bytes; no retry or substitute content.
  // Browser CSP, runtime integrity checks and readiness assertions still apply.
  const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
  try { await route.fulfill({ response }); }
  finally { await response.dispose(); }
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
  if (tool === 'document-redactor') {
    // The input is sr-only. Wait for the completed engine preparation and
    // usable picker, and report a terminal preparation failure immediately.
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-tool-page="document-redactor"]');
      const input = root?.querySelector('.redactor-file-picker input[type=file]');
      return input && !input.disabled || root?.querySelector('[role=alert]');
    }, null, { timeout: 45000 });
    assert.equal(await page.locator('[data-tool-page="document-redactor"] [role=alert]').count(), 0, 'redactor preparation failed');
    assert.equal(await page.locator('.redactor-file-picker input[type=file]').isEnabled(), true);
    await page.locator('.redactor-file-picker [data-ui-part=drop-target] button:enabled').waitFor();
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
}

for (const lang of ['ko', 'en']) for (const hash of ['', '#other']) {
  test(`${lang} language navigation ${hash || 'without hash'} retains top reset`, { timeout: 30000 }, async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await blockExternal(context);
    const page = await context.newPage();
    const record = { lang, hash, regression: 'non-guide-route' };
    diagnostics(page, record);
    try {
      await page.goto(`${server.url}/${lang}/tools/text-tools/${hash}`, { waitUntil: 'domcontentloaded' });
      await ready(page, 'text-tools');
      await position(page);
      const next = lang === 'ko' ? 'en' : 'ko';
      record.before = await page.evaluate(next => {
        // Dispatch through the real LanguageSwitcher without scrolling its
        // header control into view before the route reset is exercised.
        scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
        const y = scrollY;
        const select = document.querySelector('.wl-topbar select[data-ui-component=language-switcher]');
        select.value = next;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return y;
      }, next);
      assert.ok(record.before > 100, 'route must start scrolled away from the top');
      await page.waitForURL(url => url.pathname === `/${next}/tools/text-tools` && url.hash === hash);
      // History changes before React commits the translated route. Measure
      // only after its real content, fonts and layout effects are ready.
      const expectedGuide = JSON.parse(await fs.readFile(`src/locales/${next}/guides.json`, 'utf8')).textTools.title;
      await page.waitForFunction(({ language, title }) => document.documentElement.lang === language
        && document.querySelector('#tool-guide-title')?.textContent === title, { language: next, title: expectedGuide });
      await ready(page, 'text-tools');
      await position(page);
      record.after = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
      assert.equal(record.after.hash, hash);
      assert.equal(record.after.y, 0, 'non-guide hash must retain the route top reset');
      record.passed = true;
    } catch (error) { record.passed = false; record.error = error.message; throw error; }
    finally { records.push(record); await context.close(); }
  });
}

test('automatic late result cannot reclaim the guide after the initial layout window', { timeout: 30000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: 'block' });
  await blockExternal(context);
  const page = await context.newPage();
  const record = { regression: 'automatic-late-result' };
  diagnostics(page, record);
  // Observe the actual lifecycle instead of sleeping until an assumed deadline.
  await page.addInitScript(() => {
    const NativeObserver = ResizeObserver;
    window.guideLayoutObserver = { started: false, released: false };
    window.ResizeObserver = class extends NativeObserver {
      observe(target, options) {
        if (target.matches('.main-content')) { this.guide = true; window.guideLayoutObserver.started = true; }
        super.observe(target, options);
      }
      disconnect() {
        if (this.guide) window.guideLayoutObserver.released = true;
        super.disconnect();
      }
    };
  });
  try {
    await page.goto(`${server.url}/ko/tools/text-tools/#tool-guide-title`, { waitUntil: 'domcontentloaded' });
    await ready(page, 'text-tools');
    record.initial = await position(page); checkHeading(record.initial);
    // History restoration can overwrite the scroll after layout, fonts and
    // entry animation have finished, without producing another resize.
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    record.browserRestoration = await position(page); checkHeading(record.browserRestoration);
    await page.waitForFunction(() => window.guideLayoutObserver.started && window.guideLayoutObserver.released, null, { timeout: 15000 });
    record.before = await page.evaluate(() => {
      // Remove native browser scroll anchoring from this product-correction test.
      document.documentElement.style.overflowAnchor = 'none';
      scrollTo({ top: 0, behavior: 'instant' });
      return scrollY;
    });
    await position(page);
    await page.evaluate(() => {
      const result = document.createElement('section');
      result.textContent = 'Automatic result'; result.style.height = '400px';
      document.querySelector('.main-content').prepend(result);
    });
    record.after = await position(page);
    assert.equal(record.after.hash, '#tool-guide-title');
    assert.equal(await page.evaluate(() => scrollY), record.before, 'automatic result must not scroll without user input');
    assert.ok(record.after.top > record.after.viewport.height, 'late results must not return to the guide');
    record.passed = true;
  } catch (error) { record.passed = false; record.error = error.message; throw error; }
  finally { records.push(record); await context.close(); }
});
function diagnostics(page, record) {
  record.diagnostics = [];
  const log = (kind, details) => record.diagnostics.push({ kind, at: Date.now(), stage: record.stage, ...details });
  page.on('pageerror', error => log('pageerror', { message: error.message }));
  page.on('requestfailed', request => log('requestfailed', { url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (!response.ok()) log('http-error', { url: response.url(), status: response.status() }); });
  page.on('worker', worker => log('worker', { url: worker.url() }));
}
async function preparationState(page) {
  return page.evaluate(() => ({
    url: location.href, readyState: document.readyState, fonts: document.fonts.status,
    inert: document.documentElement.inert,
    isolation: Boolean(document.querySelector('meta[name="worklazy-redactor-isolation"]')),
    picker: Boolean(document.querySelector('.redactor-file-picker input[type=file]:enabled')),
    messages: [...document.querySelectorAll('[role=status],[role=alert]')].map(el => el.textContent),
    resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, duration: r.duration, bytes: r.transferSize })),
  })).catch(error => ({ error: error.message }));
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
    return { count: document.querySelectorAll('#tool-guide-title').length, top: rect.top, bottom: rect.bottom, scrollY,
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
    diagnostics(page, record);
    try {
      record.stage = 'initial-preparation';
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
      record.stage = 'fragment-reload-preparation';
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page, tool);
      record.stage = 'fragment-geometry';
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
    } catch (error) { record.passed = false; record.error = error.message; record.preparation = await preparationState(page); throw error; }
    finally {
      records.push(record);
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
      await page.close(); if (!view.zoom) await context.close();
    }
  });
}
