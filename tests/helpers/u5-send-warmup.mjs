import { writeFile } from 'node:fs/promises';

/** Keep dev dependency optimization outside the unchanged smoke case deadlines. */
export async function warmupU5Routes(browser, { base, routes, reportPath, timeout = 180000 }) {
  if (!routes.length) throw new Error('U5 warmup requires at least one route');
  const results = [];
  let context;
  try {
    context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    for (const { path, selector, prepare } of routes) {
      const started = performance.now();
      let stage = 'navigation';
      console.log(`U5 warmup starting: ${path}`);
      try {
        const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout });
        if (!response?.ok()) throw new Error('Warmup navigation failed');
        stage = 'readiness';
        await page.locator(selector).first().waitFor({ state: 'attached', timeout });
        stage = 'preparation';
        if (prepare) await prepare(page, timeout);
        stage = 'settling';
        await page.waitForLoadState('networkidle', { timeout });
        results.push({ path, status: 'passed', durationMs: Math.round(performance.now() - started) });
      } catch (error) {
        results.push({ path, status: 'failed', durationMs: Math.round(performance.now() - started), stage, errorType: error.name });
      }
      console.log(`U5 warmup ${results.at(-1).status}: ${path} (${results.at(-1).durationMs}ms)`);
    }
  } catch (error) {
    results.push({ status: 'failed', stage: 'setup', errorType: error.name });
  } finally {
    await context?.close().catch(error => results.push({ status: 'failed', stage: 'cleanup', errorType: error.name }));
  }
  const failed = results.some(result => result.status !== 'passed');
  await writeFile(reportPath, JSON.stringify({ phase: 'warmup', status: failed ? 'failed' : 'passed', timeout, routes: results }, null, 2) + '\n');
  console.log(`U5 warmup: ${results.filter(result => result.status === 'passed').length}/${routes.length} ready; report ${reportPath}`);
  if (failed) throw new Error(`U5 warmup failed; smoke cases were not started. See ${reportPath}`);
  return results;
}
