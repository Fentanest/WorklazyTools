import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium, type Browser } from "playwright";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { exportBanner } from "../../src/features/product-banner/exporter.ts";
import { buildBannerRuntime, buildHeightParentRuntime } from "../../scripts/product-banner-runtime.mjs";
import { startRecoveryServer } from "../recovery-server.mjs";

const dir = process.env.PB_PERF_RESULT_DIR!;
const rows: object[] = [];
const runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
let browser: Browser, server: Awaited<ReturnType<typeof startRecoveryServer>>;
before(async () => { server = await startRecoveryServer({ root: process.env.PB_DIST, port: 0 }); browser = await chromium.launch(); });
after(async () => {
  await writeFile(`${dir}/performance.json`, JSON.stringify({ browser: browser?.version(),
    method: "One cold CSV-to-mapping and import per size, real UI edit-to-export latency; five synchronous exporter samples; five runtime mount/move/remove cycles. Durations include automation/DOM wait where stated; no speed threshold.", rows }, null, 2));
  await browser?.close(); await server?.close();
});
// Track live resources, rather than the cumulative number ever created.
function instrumentation() {
  const w = window as any, timers = new Set<number>(), workers = new Set<Worker>();
  const listeners: { target: EventTarget; name: string; fn: any; capture: boolean }[] = [];
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  const capture = (options: any) => typeof options === "boolean" ? options : Boolean(options?.capture);
  EventTarget.prototype.addEventListener = function (name: string, fn: any, options: any) {
    if (fn && !listeners.some((l) => l.target === this && l.name === name && l.fn === fn && l.capture === capture(options)))
      listeners.push({ target: this, name, fn, capture: capture(options) });
    return add.call(this, name, fn, options);
  };
  EventTarget.prototype.removeEventListener = function (name: string, fn: any, options: any) {
    const i = listeners.findIndex((l) => l.target === this && l.name === name && l.fn === fn && l.capture === capture(options));
    if (i >= 0) listeners.splice(i, 1); return remove.call(this, name, fn, options);
  };
  const set = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window);
  w.setTimeout = (fn: Function, ms: number, ...args: any[]) => {
    const id = set(() => { timers.delete(id); fn(...args); }, ms); timers.add(id); return id;
  };
  w.clearTimeout = (id: number) => { timers.delete(id); clear(id); };
  const OriginalWorker = Worker;
  w.Worker = class extends OriginalWorker {
    constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); workers.add(this); }
    terminate() { workers.delete(this); return super.terminate(); }
  };
  w.__resources = () => ({ timers: timers.size, listeners: listeners.length, workers: workers.size,
    instances: w.WorklazyProductBannerV1?.instances.size || 0 });
  w.__listenerDetails = () => listeners.map((l) => ({ name: l.name, target: l.target.constructor.name }));
  w.__WORKLAZY_MOCK_PROVIDERS__ = true;
}
for (const count of [3, 100, 1000]) test(`T6b performance ${count}`, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(instrumentation);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === server.url && url.pathname === "/perf-host") return route.fulfill({ contentType: "text/html", body: '<!doctype html><body><button id="probe">Probe</button></body>' });
    if (url.origin === server.url) return route.continue();
    if (route.request().resourceType() === "image") return route.fulfill({ body: image, contentType: "image/svg+xml" });
    return route.abort();
  });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${server.url}/en/tools/product-banner/`);
    await page.locator('[data-tool-page="product-banner"]').waitFor();
    const csv = "Image Url,Promotion Url,Product Desc\n" + Array.from({ length: count }, (_, i) => `https://example.com/img/${i}.svg,https://example.com/p/${i},Product ${i}`).join("\n");
    const start = performance.now();
    await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByText("Review column mapping", { exact: true }).waitFor();
    const fileToMappingMs = performance.now() - start;
    const imported = performance.now();
    await page.getByRole("button", { name: "Import products in selected order", exact: true }).click();
    await page.locator('[data-testid="banner-product"]').first().waitFor();
    await page.waitForFunction(() => (window as any).__resources().workers === 0);
    const importMs = performance.now() - imported;
    const edit = performance.now(), editedName = `Edited ${count}`;
    await page.getByLabel("Product name", { exact: true }).first().fill(editedName);
    await page.waitForFunction((name) => [...document.querySelectorAll("textarea")].some((el) => el.value.includes(name)), editedName);
    const editToExportMs = performance.now() - edit;
    const uiDom = await page.evaluate(() => ({ elements: document.querySelectorAll("*").length,
      images: document.images.length, editorRows: document.querySelectorAll('[data-testid="banner-product"]').length,
      resources: (window as any).__resources() }));
    assert.equal(uiDom.editorRows, Math.min(20, count)); assert.equal(uiDom.resources.workers, 0);
    const project = stateWith(count).project, generationMs: number[] = [];
    let output = exportBanner(project, runtime);
    for (let i = 0; i < 5; i++) { const t = performance.now(); output = exportBanner(project, runtime); generationMs.push(performance.now() - t); }
    const outputPage = await context.newPage(); await outputPage.goto(`${server.url}/perf-host`);
    // Calibrate Playwright's global pointer interception before mounting any
    // product code. Keep this document: document.open silently clears native
    // listeners without invoking the instrumented removeEventListener method.
    await outputPage.locator("#probe").click();
    await outputPage.locator("#probe").evaluate((el) => el.remove());
    const baseline = await outputPage.evaluate(() => (window as any).__resources());
    const live: object[] = [], removed: object[] = [];
    const record = { count, csvBytes: Buffer.byteLength(csv), fileToMappingMs, importMs, editToExportMs,
      generationMs, outputBytes: output.bytes, uiDom, baseline, live, removed, residualDetails: [] as object[] };
    rows.push(record);
    for (let i = 0; i < 5; i++) {
      await outputPage.evaluate((html) => {
        const host = document.createElement("div"); host.id = "perf-banner";
        host.innerHTML = html; document.body.append(host);
        const original = host.querySelector("script")!, script = document.createElement("script");
        script.textContent = original.textContent; original.replaceWith(script);
      }, output.html);
      await outputPage.waitForFunction(() => (window as any).WorklazyProductBannerV1?.instances.size === 1);
      await outputPage.mouse.move(1439, 1);
      const next = outputPage.getByRole("button", { name: "다음 상품", exact: true });
      if (await next.isVisible()) await next.click();
      live.push(await outputPage.evaluate(() => ({ ...(window as any).__resources(), elements: document.querySelectorAll("*").length, images: document.images.length })));
      await outputPage.locator("#perf-banner").evaluate((host) => host.remove());
      await outputPage.waitForFunction(() => !(window as any).WorklazyProductBannerV1.instances.size && !(window as any).WorklazyProductBannerV1.observer);
      const resources = await outputPage.evaluate(() => (window as any).__resources()); removed.push(resources);
      record.residualDetails.push(await outputPage.evaluate(() => (window as any).__listenerDetails()));
      assert.deepEqual(resources, baseline, "timers/listeners/Workers return to baseline after every removal");
    }
  } finally { await context.close(); }
});
