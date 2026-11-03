// Chrome CDP ArrayBuffer backing-store samples + Linux process-tree PSS.
// Measures the real product asset loader, not JS heap alone or an estimated sum.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const root = process.cwd();
let dist = path.resolve(process.env.BG_MEMORY_DIST || 'scratch/bg-memory/dist');
const variants = process.env.BG_MEMORY_BASELINE_DIST ? [{ label: 'baseline', dist: path.resolve(process.env.BG_MEMORY_BASELINE_DIST) }, { label: 'candidate', dist }] : [{ label: 'profile', dist }];
const out = path.resolve(process.env.BG_MEMORY_OUTPUT || '/tmp/bg-memory');
const repetitions = Number(process.env.BG_MEMORY_REPETITIONS || 3);
assert.ok(Number.isSafeInteger(repetitions) && repetitions > 0, 'BG_MEMORY_REPETITIONS must be a positive integer');
await fs.mkdir(out, { recursive: true });
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost'), route = decodeURIComponent(url.pathname);
    const base = route.startsWith('/vendor/') ? path.join(root, 'public') : dist;
    const file = path.resolve(base, '.' + (route === '/' ? '/index.html' : route));
    if (!file.startsWith(base + path.sep)) { response.writeHead(403).end(); return; }
    const stat = await fs.stat(file); if (!stat.isFile()) throw new Error('not a file');
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.wasm': 'application/wasm' }[path.extname(file)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
    const stream = createReadStream(file); stream.pipe(response); response.on('close', () => stream.destroy());
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function processMemory(parent) {
  const { stdout } = await exec('ps', ['-e', '-o', 'pid=,ppid=']);
  const records = stdout.trim().split('\n').map(line => { const [pid, ppid] = line.trim().split(/\s+/).map(Number); return { pid, ppid }; });
  const ids = new Set([parent]); let changed = true;
  while (changed) { changed = false; for (const item of records) if (item && ids.has(item.ppid) && !ids.has(item.pid)) { ids.add(item.pid); changed = true; } }
  let pss = 0, rss = 0; const unreadable = [];
  for (const pid of ids) try {
    const text = await fs.readFile(`/proc/${pid}/smaps_rollup`, 'utf8');
    pss += Number(text.match(/^Pss:\s+(\d+)/m)?.[1] || 0) * 1024;
    rss += Number(text.match(/^Rss:\s+(\d+)/m)?.[1] || 0) * 1024;
  } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) unreadable.push({ pid, code: error.code }); }
  return { pss, rss, processes: ids.size, unreadable };
}
const facts = [];
try {
  for (let round = 1; round <= repetitions; round++) for (const cache of ['cold', 'warm']) for (const variant of variants) {
    dist = variant.dist;
    const launcher = await chromium.launchServer({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    const browser = await chromium.connect(launcher.wsEndpoint());
    try {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base); await page.waitForFunction(() => window.ready);
      if (cache === 'warm') await page.evaluate(() => window.seed());
      const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
      const samples = []; let stopped = false;
      const sample = async () => {
        const [heap, process] = await Promise.all([cdp.send('Runtime.getHeapUsage'), processMemory(launcher.process().pid)]);
        assert.deepEqual(process.unreadable, [], 'PSS must be readable for every live Chrome process');
        assert.ok(Number.isFinite(heap.backingStorageSize), 'CDP must report ArrayBuffer backing storage');
        samples.push({ at: performance.now(), usedSize: heap.usedSize, backingStorageSize: heap.backingStorageSize, ...process });
      };
      await sample(); const started = performance.now();
      const sampler = (async () => { while (!stopped) { await sample(); await new Promise(resolve => setTimeout(resolve, 25)); } })();
      let run;
      try { run = await page.evaluate(() => window.runAssets()); } finally { stopped = true; await sampler; }
      await sample(); const milliseconds = performance.now() - started;
      const verification = await page.evaluate(() => window.check());
      assert.deepEqual(errors, []); assert.equal(run.cacheFailures, 0); assert.equal(run.bytes, 127232270);
      assert.ok(run.assets.every(asset => asset.source === (cache === 'cold' ? 'network' : 'cache')));
      const peak = { pss: Math.max(...samples.map(s => s.pss)), rss: Math.max(...samples.map(s => s.rss)), backingStorageSize: Math.max(...samples.map(s => s.backingStorageSize)), usedSize: Math.max(...samples.map(s => s.usedSize)) };
      const result = { variant: variant.label, round, cache, chrome: browser.version(), dist, milliseconds, sampleCount: samples.length, baseline: samples[0], peak, run, verification, errors, samples };
      facts.push(result); await fs.writeFile(path.join(out, `${variant.label}-${cache}-${round}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ variant: variant.label, round, cache, peak, milliseconds, sampleCount: samples.length }));
    } finally { await browser.close(); await launcher.close(); }
  }
} finally { await fs.writeFile(path.join(out, 'facts.json'), JSON.stringify(facts, null, 2)); await new Promise(resolve => server.close(resolve)); }
assert.equal(facts.length, repetitions * 2 * variants.length);
