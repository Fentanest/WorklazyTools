import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from './recovery-server.mjs';

const output = path.resolve(process.env.RAIL_OUTPUT || 'scratch/mobile-rail/after');
const widths = (process.env.RAIL_WIDTHS || '320,390,414,621,700,768,820,1024').split(',').map(Number);
const languages = (process.env.RAIL_LANGS || 'ko,en').split(',');
const records = [];
let browser, server, image, baseUrl;
before(async () => {
  await fs.mkdir(output, { recursive: true });
  if (!process.env.RAIL_URL) server = await startRecoveryServer({ root: process.env.RAIL_DIST || 'dist', port: 0 });
  baseUrl = process.env.RAIL_URL || server.url;
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const png = new PNG({ width: 960, height: 640 }); png.data.fill(210); image = PNG.sync.write(png);
});
after(async () => {
  await browser?.close(); await server?.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
});
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function geometry(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('.asp-workspace__rail'), r = rail.getBoundingClientRect(), style = getComputedStyle(rail);
    const header = document.querySelector('.mobile-header').getBoundingClientRect(), tabs = document.querySelector('.bottom-tabs').getBoundingClientRect();
    const safeTop = header.bottom + 8, safeBottom = tabs.top - 8;
    const exposedHeight = Math.max(0, Math.min(r.bottom, safeBottom) - Math.max(r.top, safeTop));
    const points = [], buttons = [];
    for (const button of rail.querySelectorAll('button.asp-rail__tool')) {
      const b = button.getBoundingClientRect(), fullX = b.left >= r.left + 1 && b.right <= r.right - 1;
      const clipped = b.top < safeTop - .5 || b.bottom > safeBottom + .5;
      buttons.push({ fullX, clipped, marked: button.hasAttribute('data-shell-clipped'), pointerEvents: getComputedStyle(button).pointerEvents });
      if (!fullX) continue; // All horizontal tools are tested separately with real Tab navigation.
      for (const [x, y] of [[b.left + b.width / 2, b.top + b.height / 2], [b.left + b.width / 2, b.top + 2], [b.left + b.width / 2, b.bottom - 2], [b.left + 2, b.top + b.height / 2], [b.right - 2, b.top + b.height / 2]]) {
        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        points.push({ hit: hit === button || button.contains(hit), expected: !clipped, x, y, blockedBy: hit?.closest('header,nav')?.className || hit?.tagName });
      }
    }
    return { scrollY, top: r.top, bottom: r.bottom, height: r.height, opacity: Number(style.opacity), clipPath: style.clipPath,
      clipTop: parseFloat(style.getPropertyValue('--wl-rail-clip-top')) || 0, clipBottom: parseFloat(style.getPropertyValue('--wl-rail-clip-bottom')) || 0,
      safeTop, safeBottom, exposedHeight, inside: r.top >= safeTop - .5 && r.bottom <= safeBottom + .5, buttons, points };
  });
}
for (const width of widths) for (const lang of languages) test(`${width} ${lang}: rail entry, all tools and menus clear shell`, { timeout: 120000 }, async () => {
  const mobile = width <= 820, theme = lang === 'ko' ? 'light-coral' : 'dark-coral';
  const context = await browser.newContext({ viewport: { width, height: 750 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  const page = await context.newPage(), record = { width, lang, theme };
  try {
    await context.addInitScript(theme => { if (window === window.top) localStorage.setItem('worklazy-theme', theme); }, theme);
    await context.route('**/*', route => new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort());
    await page.goto(`${baseUrl}/${lang}/tools/image-studio/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.asp-image-editor .lower-canvas').waitFor();
    await page.locator('[data-testid=library-image-editor] input[type=file]').first().setInputFiles({ name: 'rail-fixture.png', mimeType: 'image/png', buffer: image });
    await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      scrollTo({ top: 0, behavior: 'instant' });
    });
    await settle(page);
    const rail = page.locator('.asp-workspace__rail'), buttons = rail.locator('button.asp-rail__tool');
    assert.equal(await buttons.count(), 10);
    if (!mobile) {
      assert.equal(await rail.getAttribute('data-mobile-rail'), null);
      assert.equal(await rail.evaluate(el => getComputedStyle(el).clipPath), 'none');
      record.desktop = await rail.evaluate(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { height: r.height, flexDirection: s.flexDirection }; });
      assert.equal(record.desktop.flexDirection, 'column');
    } else {
      const bounds = await page.locator('.asp-workspace').evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, height: el.getBoundingClientRect().height }));
      record.states = [];
      for (let y = Math.max(0, bounds.top - 750 + 20); y <= bounds.top + bounds.height + 100; y += 20) {
        await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await settle(page);
        record.states.push(await geometry(page));
      }
      record.maxHeight = Math.max(...record.states.map(s => s.height));
      record.points = record.states.flatMap(s => s.points);
      record.blocked = record.points.filter(p => p.expected && !p.hit);
      assert.ok(record.maxHeight <= 80, `rail occupies ${record.maxHeight}px instead of one compact row`);
      assert.ok(record.points.filter(p => p.expected).length >= 50, 'positive hit sample cannot be empty');
      assert.equal(record.blocked.length, 0, 'fully visible tools are never covered');
      assert.equal(record.points.filter(p => !p.expected && p.hit).length, 0, 'clipped controls cannot intercept pointer input');
      assert.ok(record.states.every(s => s.opacity === 1), 'no whole-strip opacity flicker during entry or exit');
      assert.ok(record.states.every(s => Math.abs(s.clipTop - Math.max(0, s.safeTop - s.top)) < .6 && Math.abs(s.clipBottom - Math.max(0, s.bottom - s.safeBottom)) < .6), 'clip follows the actual shell boundaries');
      assert.ok(record.states.every(s => s.buttons.every(b => b.marked === b.clipped && (!b.clipped || b.pointerEvents === 'none'))), 'only shell-clipped controls lose pointer input');
      const partial = record.states.filter(s => s.exposedHeight > 2 && s.exposedHeight < s.height - 2);
      assert.ok(partial.length >= 2, 'entry and exit include partially exposed, still painted rail states');
      record.partialStates = partial.length;
      const entry = partial[0]; await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), entry.scrollY); await settle(page);
      await page.screenshot({ path: path.join(output, `${width}-${lang}-entry.png`) });
      // Tab from an offscreen strip reveals it and every horizontally hidden tool.
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), bounds.top + bounds.height + 50); await settle(page);
      await buttons.first().focus(); await settle(page);
      record.focus = await geometry(page); assert.equal(record.focus.inside, true);
      const seen = new Set(); record.keyboard = [];
      for (let step = 0; step < 35 && seen.size < 10; step++) {
        const info = await page.evaluate(() => {
          const b = document.activeElement; if (!b?.matches('button.asp-rail__tool')) return null;
          const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { title: b.getAttribute('title'), hit: hit === b || b.contains(hit) };
        });
        if (info) { seen.add(info.title); record.keyboard.push(info); assert.equal(info.hit, true, 'focused tools remain visible'); }
        await page.keyboard.press('Tab'); await settle(page);
      }
      assert.equal(seen.size, 10, 'all tools survive compacting');
      record.menus = [];
      const toggles = rail.locator('button.asp-rail__flyout-toggle'); assert.equal(await toggles.count(), 3);
      for (let i = 0; i < await toggles.count(); i++) {
        await toggles.nth(i).focus(); await toggles.nth(i).click(); const menu = rail.getByRole('menu'); await menu.waitFor(); await settle(page);
        const metrics = await menu.evaluate(el => { const r = el.getBoundingClientRect(), h = document.querySelector('.mobile-header').getBoundingClientRect(), n = document.querySelector('.bottom-tabs').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, headerBottom: h.bottom, navTop: n.top, popover: el.matches(':popover-open') }; });
        record.menus.push(metrics); assert.ok(metrics.top >= metrics.headerBottom && metrics.bottom <= metrics.navTop); assert.equal(metrics.popover, true);
        for (const item of await menu.getByRole('menuitem').all()) {
          await item.scrollIntoViewIfNeeded(); assert.equal(await item.evaluate(el => { const r = el.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h === el || el.contains(h); }), true);
        }
        await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' });
      }
      if (width === 820 && lang === 'en') {
        await toggles.first().focus(); await toggles.first().click(); await rail.getByRole('menu').waitFor();
        await page.setViewportSize({ width: 1024, height: 750 }); await settle(page);
        assert.equal(await rail.getByRole('menu').count(), 0); assert.equal(await rail.getAttribute('data-mobile-rail'), null);
        assert.equal(await rail.evaluate(el => getComputedStyle(el).clipPath), 'none');
        assert.equal(await rail.locator('[data-shell-clipped]').count(), 0);
        record.responsiveRestore = true; await page.setViewportSize({ width, height: 750 }); await settle(page);
      }
      await rail.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' })); await settle(page);
      record.documentWidth = await page.evaluate(() => document.documentElement.scrollWidth); assert.ok(record.documentWidth <= width);
    }
    await page.screenshot({ path: path.join(output, `${width}-${lang}.png`) }); record.passed = true;
  } catch (error) {
    record.passed = false; record.error = error.message;
    await page.screenshot({ path: path.join(output, `${width}-${lang}-failure.png`) }).catch(() => {}); throw error;
  } finally { records.push(record); await context.close(); }
});
