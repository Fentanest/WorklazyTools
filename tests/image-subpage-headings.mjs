// Build first, then: node --experimental-strip-types --test tests/image-subpage-headings.mjs
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { supportedLanguages } from '../src/i18n/languages.ts';

const rows = JSON.parse(await fs.readFile(new URL('./fixtures/direct-entry-contract.json', import.meta.url), 'utf8'))
  .filter(row => row.owner === 'image-studio');
assert.equal(rows.length, 3, 'Exercise every image subpage');
let server;
let browser;
let base;

before(async () => {
  server = await preview({ configFile: false, envDir: false, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } });
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
});

async function context(javaScriptEnabled) {
  const result = await browser.newContext({ javaScriptEnabled, serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  await result.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(base).origin
      ? route.abort() : route.continue();
  });
  return result;
}

for (const language of supportedLanguages) for (const row of rows) {
  test(`${language} ${row.path}: static and hydrated h1 agree`, { timeout: 60_000 }, async t => {
    const staticContext = await context(false);
    const liveContext = await context(true);
    try {
      const url = new URL(`${language}${row.path}/`, base).href;
      const staticPage = await staticContext.newPage();
      const staticResponse = await staticPage.goto(url);
      assert.equal(staticResponse.status(), 200);
      assert.equal(await staticPage.locator('h1').count(), 1);
      const heading = await staticPage.locator('h1').innerText();
      const title = await staticPage.title();
      assert.ok(heading.trim(), 'Static h1 must not be empty');

      const livePage = await liveContext.newPage();
      const errors = [];
      livePage.on('pageerror', error => errors.push(error.message));
      assert.equal((await livePage.goto(url)).status(), 200);
      await livePage.locator(row.readySelector).waitFor();
      // Wait for the actual React tool and its lazy editor, not the SEO fallback.
      await livePage.locator('[data-image-owner="editor"] input[type="file"]').first().waitFor({ state: 'attached' });
      await livePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await livePage.locator('.seo-static-fallback').count(), 0);
      assert.equal(await livePage.locator('h1').count(), 1);
      const hydratedHeading = await livePage.locator('h1').innerText();
      t.diagnostic(JSON.stringify({ heading, hydratedHeading, title }));
      assert.equal(hydratedHeading, heading);
      assert.equal(await livePage.title(), title, 'Document title stays unchanged');
      assert.deepEqual(errors, []);
      if (process.env.H1_SCREENSHOT_DIR) {
        await fs.mkdir(process.env.H1_SCREENSHOT_DIR, { recursive: true });
        await livePage.screenshot({ path: path.join(process.env.H1_SCREENSHOT_DIR, `${language}-${row.purpose}.png`) });
      }
    } finally {
      await staticContext.close();
      await liveContext.close();
    }
  });
}
