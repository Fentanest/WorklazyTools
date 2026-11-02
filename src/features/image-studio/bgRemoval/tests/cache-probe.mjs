import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/home/better0101/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
const page = await browser.newPage(); const facts = [];
try {
  await page.goto('http://127.0.0.1:4192'); await page.waitForFunction(() => window.ready);
  for (const [stage, expected] of [['empty', 127232270], ['model-and-obsolete', 28747738], ['warm', 0], ['corrupt-new', 28747738]]) {
    const fact = await page.evaluate(stage => window.productCachePlan(stage), stage); facts.push(fact);
    assert.equal(fact.missingBytes, expected); assert.match(fact.runtimeUrl, /asyncify\.wasm$/);
    if (stage === 'model-and-obsolete') assert.deepEqual(fact.cached, ['product']);
    if (stage === 'corrupt-new') assert.ok(!fact.cacheKeys.includes(fact.runtimeUrl));
    console.log(`ok ${facts.length} - product cache plan ${stage}`);
  }
} finally { fs.writeFileSync((process.env.BG_TEST_OUTPUT ?? '/tmp/sol-ie-bg-fix1') + '/product-cache-plans.json', JSON.stringify(facts, null, 2)); await browser.close(); }
console.log('1..4\n# tests 4\n# pass 4\n# fail 0');
