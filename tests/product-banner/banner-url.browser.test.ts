import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { chromium, type Browser, type Page } from "playwright";
import { startRecoveryServer } from "../recovery-server.mjs";
import { BANNER_URL_PREVIEW_SANDBOX, bannerUrlMessages as messages, exportBannerUrl } from "../../src/features/product-banner/bannerUrl.ts";
import { uiMessages } from "../../src/features/product-banner/uiMessages.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { loadProjectJson, saveProjectJson } from "../../src/features/product-banner/projectJson.ts";

const example = "https://s.click.aliexpress.com/e/_c3Gv8KKN?bz=300*250";
const evidence = process.env.PB_URL_EVIDENCE || "docs/jobs/todo/banner-url-20261017/evidence/url-browser";
const sourceHashAtStart = createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex");
let browser: Browser, app: Awaited<ReturnType<typeof startRecoveryServer>>, hostOrigin: string;
const documents = new Map<string, string>(), observations: object[] = [];
const host = createServer((req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(documents.get(req.url!) || "<!doctype html><body>Host</body>"); });
const synthetic = '<!doctype html><html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;background:#dbeafe;color:#14213d;font:20px sans-serif"><p>Synthetic banner · 300 × 250</p></body></html>';
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
before(async () => {
  await mkdir(evidence, { recursive: true });
  app = await startRecoveryServer({ root: process.env.PB_DIST || "dist", port: 0 });
  await new Promise<void>((resolve) => host.listen(0, "127.0.0.1", resolve));
  hostOrigin = `http://127.0.0.1:${(host.address() as { port: number }).port}`;
  browser = await chromium.launch({ executablePath: process.env.PB_UI_CHROMIUM_PATH });
});
after(async () => {
  await browser?.close(); await app?.close();
  host.closeAllConnections(); await new Promise<void>((resolve) => host.close(() => resolve()));
  const sourceHashAtEnd = createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex");
  assert.equal(sourceHashAtEnd, sourceHashAtStart);
  await writeFile(`${evidence}/RESULTS.json`, JSON.stringify({ externalRequestsSent: 0, sourceHashAtStart, sourceHashAtEnd, sourceUnchanged: sourceHashAtStart === sourceHashAtEnd, observations }, null, 2));
});
async function setup(language: "ko" | "en" = "en", width = 1000, theme = "light") {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: "block" });
  const calls: string[] = [], blocked: string[] = [];
  // Context routes also cover the first popup request. Every nonlocal request is fulfilled or aborted.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if ([app.url, hostOrigin].includes(url.origin)) return route.continue();
    if (url.origin === "https://s.click.aliexpress.com") { calls.push(url.href); return route.fulfill({ contentType: "text/html", body: synthetic }); }
    if (url.hostname === "example.com" && route.request().resourceType() === "image") return route.fulfill({ contentType: "image/svg+xml", body: image });
    blocked.push(url.href); return route.abort();
  });
  await context.addInitScript((theme) => {
    localStorage.setItem("worklazy-theme", `${theme}-coral`);
    (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as any).__copied = text; } } });
  }, theme);
  const page = await context.newPage();
  await page.goto(`${app.url}/${language}/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor();
  return { context, page, calls, blocked };
}
async function urlMode(page: Page, language: "ko" | "en" = "en") { await page.getByRole("button", { name: messages[language].url, exact: true }).click(); }
async function input(page: Page, src = example, language: "ko" | "en" = "en") { await page.getByLabel(messages[language].input, { exact: true }).fill(src); }
async function settle() { await new Promise((resolve) => setTimeout(resolve, 100)); }
async function noPreview(page: Page) { assert.equal(await page.locator('[data-testid="banner-url-preview"]').count(), 0); }

test("banner URL modes create and copy localized code without automatic external requests", async () => {
  for (const language of ["ko", "en"] as const) {
    const { page, context, calls } = await setup(language);
    const t = messages[language];
    await urlMode(page, language);
    assert.equal(await page.getByRole("button", { name: t.copy, exact: true }).count(), 0);
    assert.equal(await page.getByLabel(t.export, { exact: true }).count(), 0);
    await input(page, example + "&tracking=~%20", language);
    assert.equal(await page.getByLabel(t.width, { exact: true }).inputValue(), "300");
    assert.equal(await page.getByLabel(t.height, { exact: true }).inputValue(), "250");
    await page.getByLabel(t.width, { exact: true }).fill("728");
    const code = await page.getByLabel(t.export, { exact: true }).inputValue();
    assert.equal(code, exportBannerUrl(example + "&tracking=~%20", 728, 250, language).code);
    await page.getByRole("button", { name: t.copy, exact: true }).click();
    assert.equal(await page.evaluate(() => (window as any).__copied), code);
    await page.getByLabel(t.notice, { exact: true }).uncheck();
    assert.equal(await page.getByLabel(t.export, { exact: true }).inputValue(), exportBannerUrl(example + "&tracking=~%20", 728, 250, language, false).code);
    await settle(); assert.equal(calls.length, 0); await noPreview(page);
    await input(page, "https://s.click.aliexpress.com.evil.example/e/token", language);
    assert.ok(await page.getByText(t.origin, { exact: true }).count());
    assert.equal(await page.getByLabel(t.export, { exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: t.copy, exact: true }).count(), 0);
    await context.close();
  }
});
test("banner URL manual size is required for missing duplicate or invalid bz and preserves src", async () => {
  const { page, context, calls } = await setup(); await urlMode(page);
  for (const suffix of ["", "?bz=bad", "?bz=300*250&bz=300*250"]) {
    const src = example.split("?")[0] + suffix;
    await input(page, src);
    assert.equal(await page.getByLabel(messages.en.export, { exact: true }).count(), 0);
    assert.ok(await page.getByText(messages.en.size, { exact: true }).count());
    await page.getByLabel(messages.en.width, { exact: true }).fill("300");
    await page.getByLabel(messages.en.height, { exact: true }).fill("250");
    assert.equal(await page.getByLabel(messages.en.export, { exact: true }).inputValue(), exportBannerUrl(src, 300, 250, "en").code);
    await page.getByLabel(messages.en.width, { exact: true }).fill("4097");
    assert.equal(await page.getByLabel(messages.en.export, { exact: true }).count(), 0);
  }
  assert.equal(calls.length, 0); await context.close();
});
test("banner URL preview requires a fresh click after URL changes invalidation or leaving mode", async () => {
  const { page, context, calls } = await setup(); await urlMode(page); await input(page);
  await settle(); assert.equal(calls.length, 0); await noPreview(page);
  const load = () => page.getByRole("button", { name: messages.en.load, exact: true }).click();
  await load();
  const frame = page.locator('[data-testid="banner-url-preview"]');
  await page.frameLocator('[data-testid="banner-url-preview"]').getByText("Synthetic banner · 300 × 250", { exact: true }).waitFor();
  await settle(); assert.equal(calls.length, 1);
  assert.equal(await frame.getAttribute("src"), example);
  assert.equal(await frame.getAttribute("sandbox"), BANNER_URL_PREVIEW_SANDBOX);
  assert.equal(await frame.getAttribute("referrerpolicy"), "strict-origin-when-cross-origin");
  assert.equal(await page.getByText(messages.en.previewHelp, { exact: true }).count(), 1);
  await input(page, example + "&next=1"); await noPreview(page); await settle(); assert.equal(calls.length, 1);
  await load(); await settle(); assert.equal(calls.length, 2);
  await input(page, "javascript:alert(1)"); await noPreview(page);
  await input(page); await settle(); assert.equal(calls.length, 2);
  await load(); await settle(); assert.equal(calls.length, 3);
  await page.getByRole("button", { name: messages.en.file, exact: true }).click(); await noPreview(page);
  await urlMode(page); await noPreview(page); assert.equal(calls.length, 3);
  observations.push({ test: "preview authorization", syntheticBannerRequests: calls.length });
  await context.close();
});
test("banner URL file round trip preserves products settings pending mapping and v1 JSON", async () => {
  const { page, context } = await setup();
  const project = stateWith(2).project;
  await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson(project)) });
  await page.locator('[data-testid="banner-product"]').first().waitFor();
  await page.getByLabel(uiMessages.en.width, { exact: true }).fill("777"); await page.getByLabel(uiMessages.en.width, { exact: true }).press("Tab");
  const file = page.locator('input[accept=".xls,.xlsx,.csv"]');
  await file.setInputFiles({ name: "pending.csv", mimeType: "text/csv", buffer: Buffer.from('Image URL,Promotion URL,Product Name\nhttps://example.com/img/1.svg,https://example.com/item/1,Pending\n') });
  const extract = page.getByRole("button", { name: uiMessages.en.confirmImport, exact: true }); await extract.waitFor();
  await page.getByText(uiMessages.en.mapping, { exact: true }).click();
  const mapping = page.locator("details label").filter({ has: page.getByText(uiMessages.en.fields.name, { exact: true }) }).locator("select"); await mapping.selectOption("");
  await urlMode(page); await input(page);
  await page.getByRole("button", { name: messages.en.file, exact: true }).click();
  assert.equal(await mapping.inputValue(), "");
  assert.equal(await page.getByLabel(uiMessages.en.width, { exact: true }).inputValue(), "777");
  assert.equal(await page.locator('[data-testid="banner-product"]').count(), 2);
  assert.equal(await page.getByText("pending.csv", { exact: false }).count(), 1);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: uiMessages.en.saveJson, exact: true }).click();
  const saved = await download; const raw = await readFile((await saved.path())!, "utf8");
  const restored = loadProjectJson(raw);
  assert.equal(restored.schemaVersion, 1); assert.equal(restored.products.length, 2); assert.equal(restored.settings.width, 777);
  assert.ok(!raw.includes("_c3Gv8KKN"));
  await context.close();
});
test("banner URL mode stays locked during Excel inspection and extraction then imports normally", async () => {
  const { page, context } = await setup();
  // Delay worker delivery rather than bypassing the real parser or real Excel flow.
  await page.evaluate(() => {
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker { postMessage(message: any, transfer: Transferable[]) { setTimeout(() => super.postMessage(message, transfer), 200); } } as typeof Worker;
  });
  const XLSX = await import("xlsx"); const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Image URL", "Promotion URL", "Product Name"], ["https://example.com/img/1.svg", "https://example.com/item/1", "Synthetic Excel"]]), "Products");
  await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "synthetic.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
  const mode = page.getByRole("button", { name: messages.en.url, exact: true }); assert.equal(await mode.isDisabled(), true);
  const extract = page.getByRole("button", { name: uiMessages.en.confirmImport, exact: true }); await extract.waitFor();
  await extract.click(); assert.equal(await mode.isDisabled(), true);
  await page.locator('[data-testid="banner-product"]').waitFor();
  assert.equal(await page.getByLabel(uiMessages.en.name, { exact: true }).inputValue(), "Synthetic Excel");
  assert.equal(await mode.isEnabled(), true);
  await context.close();
});
for (const width of [1000, 390]) for (const theme of ["light", "dark"]) test(`banner URL static host paste and UI capture ${width}px ${theme}`, async () => {
  for (const language of ["ko", "en"] as const) {
    const { page, context, calls } = await setup(language, width, theme);
    await urlMode(page, language); await input(page, example, language);
    await page.getByLabel(messages[language].input, { exact: true }).blur();
    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: `${evidence}/ui-${language}-${width}-${theme}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(calls.length, 0);
    const code = await page.getByLabel(messages[language].export, { exact: true }).inputValue();
    const path = `/${language}-${width}-${theme}`;
    documents.set(path, `<!doctype html><html lang="${language}"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:16px;background:${theme === "dark" ? "#101827" : "#f1f5f9"};color:${theme === "dark" ? "#f1f5f9" : "#101827"};font:16px sans-serif">${code}</body></html>`);
    const hostPage = await context.newPage(); await hostPage.goto(hostOrigin + path);
    const iframe = hostPage.locator("iframe"); const box = await iframe.boundingBox();
    assert.equal(box!.width, 300); assert.equal(box!.height, 250); assert.equal(await iframe.getAttribute("src"), example);
    assert.equal(await hostPage.locator("p").textContent(), messages[language].disclosure);
    await hostPage.frameLocator("iframe").getByText("Synthetic banner · 300 × 250", { exact: true }).waitFor();
    assert.equal(calls.length, 1);
    await hostPage.screenshot({ path: `${evidence}/host-${language}-${width}-${theme}.png`, fullPage: true });
    observations.push({ language, width, theme, frameWidth: box!.width, frameHeight: box!.height, syntheticBannerRequests: calls.length });
    await context.close();
  }
});
