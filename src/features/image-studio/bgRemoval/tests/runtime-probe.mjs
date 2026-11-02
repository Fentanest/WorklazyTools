import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output = process.env.BG_TEST_OUTPUT ?? '/tmp/sol-ie-bg-fix1';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/home/better0101/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const results = [];
try {
  for (const ep of ['wasm', 'webgpu']) {
    const context = await browser.newContext(), page = await context.newPage(), requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('http://127.0.0.1:4192'); await page.waitForFunction(() => window.ready);
    const shaderF16 = await page.evaluate(() => window.supported()); requests.length = 0;
    const result = await page.evaluate(ep => window.runtimeProbe(ep), ep);
    const wasm = result.events.find(e => e.type === 'consumed-wasm'), abi = result.events.find(e => e.type === 'abi');
    assert.equal(wasm.bytes, 28747738); assert.equal(wasm.sha256, 'ca319e9539cd0f1e291cf56074760121eaf39650f5dbf84b6e52c07f4b2944ec');
    assert.equal(abi.exportIcKind, 'function'); assert.ok(!/ke\.ic|not a function|LinkError/.test(result.error ?? ''));
    assert.equal(requests.filter(url => /\.mjs(?:$|\?)/.test(url)).length, 0);
    assert.equal(requests.filter(url => /\.wasm(?:$|\?)/.test(url) && !url.includes('/vendor/onnxruntime-web/1.31.1/ort-wasm-simd-threaded.asyncify.wasm')).length, 0);
    if (ep === 'wasm') { assert.equal(result.ok, true); assert.deepEqual(result.inputNames, ['input']); }
    else if (!shaderF16) { assert.equal(result.ok, false); assert.match(result.error, /webgpu|adapter|GPU/i); }
    results.push({ ep, shaderF16, ...result, requests, abiErrors: 0, externalMjsRequests: 0, actualGpuInference: false });
    console.log(`ok ${results.length} - default webgpu bundle + verified asyncify Worker initialization ep=${ep}`);
    await context.close();
  }
} finally { fs.writeFileSync(output + '/runtime-probes.json', JSON.stringify(results, null, 2)); await browser.close(); }
console.log('1..2\n# tests 2\n# pass 2\n# fail 0');
