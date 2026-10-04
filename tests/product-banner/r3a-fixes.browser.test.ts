import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { chromium, type Browser, type Page, type Frame } from "playwright";
import { startRecoveryServer } from "../recovery-server.mjs";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS, type DesignId } from "../../src/features/product-banner/stateTypes.ts";
import { uiMessages } from "../../src/features/product-banner/uiMessages.ts";
import { inputErrorMessages } from "../../src/features/product-banner/inputErrorMessages.ts";

const shots = process.env.PB_R3A_SHOT_DIR || "docs/jobs/todo/product-banner/work/shots-R3afix";
const captures: string[] = [], results: object[] = [];
const bitmap = new PNG({ width: 200, height: 140 });
for (let y = 0; y < 140; y++) for (let x = 0; x < 200; x++) {
  bitmap.data.set((x - 100) ** 2 + (y - 64) ** 2 < 28 ** 2 ? [255, 255, 255, 255] : [186, 218, 238, 255], (y * 200 + x) * 4);
}
const image = PNG.sync.write(bitmap);
let server: Awaited<ReturnType<typeof startRecoveryServer>>, browser: Browser, affiliateAttempts = 0;
before(async () => {
  await mkdir(shots, { recursive: false });
  server = await startRecoveryServer({ root: "dist", port: 0 });
  browser = await chromium.launch({ executablePath: process.env.PB_R3A_BROWSER === "system" ? "/usr/bin/google-chrome" : undefined, args: ["--no-sandbox"] });
});
after(async () => {
  await browser?.close(); await server?.close();
  await writeFile(`${shots}/MANIFEST.sha256`, (await Promise.all(captures.map(async (name) => `${createHash("sha256").update(await readFile(`${shots}/${name}`)).digest("hex")}  ${name}\n`))).join(""));
  await writeFile(`${shots}/RESULTS.json`, JSON.stringify({ results, affiliateAttempts, externalRequestsSent: 0 }, null, 2));
  assert.equal(affiliateAttempts, 0, "no affiliate destinations may be requested");
});
async function pageFor(language: "ko" | "en" = "en", width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.addInitScript(() => {
    (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true;
    (window as any).__imageEvents = [];
    for (const event of ["load", "error"]) document.addEventListener(event, (e) => {
      if (e.target instanceof HTMLImageElement && e.target.closest("[data-wlpb-root]"))
        (window as any).__imageEvents.push({ event, index: e.target.closest("li")?.dataset.wlpbIndex });
    }, true);
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === server.url) return route.continue();
    if (url.hostname === "example.com" && /^\/img\//u.test(url.pathname)) return route.fulfill(url.pathname.includes("missing")
      ? { status: 404, contentType: "text/plain", body: "Unavailable", headers: { "cross-origin-resource-policy": "cross-origin" } }
      : { contentType: "image/png", body: image, headers: { "cross-origin-resource-policy": "cross-origin" } });
    if (url.hostname.toLowerCase() === "example.com") affiliateAttempts++;
    return route.abort();
  });
  await page.goto(`${server.url}/${language}/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor(); return page;
}
async function load(page: Page, language: "ko" | "en", design: DesignId, missing = false, count = 8) {
  const project = stateWith(count).project;
  await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson({
    ...project, settings: { ...createDefaultSettings(language, design), autoPlay: false },
    products: project.products.map((p, i) => ({ ...p, name: `Synthetic product ${i + 1}`, imageUrl: missing && i === 1 ? "https://example.com/img/missing.jpg" : p.imageUrl })),
  })) });
  await page.locator('[data-testid="banner-preview"]').waitFor();
}
async function banner(page: Page, format: string): Promise<Frame> {
  const outer = await (await page.locator('[data-testid="banner-preview"]').elementHandle())!.contentFrame(); assert.ok(outer);
  if (format === "html") return outer;
  const nested = outer.locator("iframe[data-wlpb-frame]"); await nested.waitFor();
  await nested.contentFrame().locator("[data-wlpb-ready]").waitFor();
  const inner = await (await nested.elementHandle())!.contentFrame(); assert.ok(inner); return inner;
}
async function active(frame: Frame, missing: boolean) {
  await frame.locator("[data-wlpb-ready]").waitFor();
  await frame.waitForFunction((hasMissing) => [...document.querySelectorAll<HTMLLIElement>("li:not([hidden])")].every((li) => {
    const img = li.querySelector("img")!, fallback = li.querySelector<HTMLElement>(".wlpb-v1-fallback")!;
    return hasMissing && li.dataset.wlpbIndex === "1" ? img.complete && img.naturalWidth === 0 && img.hidden && !fallback.hidden
      : img.complete && img.naturalWidth > 0 && !img.hidden && fallback.hidden;
  }), missing, { timeout: 5000 });
  const observed = await frame.locator("li:not([hidden])").evaluateAll((items) => items.map((li) => {
    const img = li.querySelector("img")!;
    return { index: Number((li as HTMLElement).dataset.wlpbIndex), naturalWidth: img.naturalWidth, hidden: img.hidden, loading: img.loading };
  }));
  if (missing && observed.some((i) => i.index === 1)) assert.ok(await frame.evaluate(() => (window as any).__imageEvents.some((e: any) => e.index === "1" && e.event === "error")));
  return observed;
}
async function capture(page: Page, name: string, fullPage = false) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/${name}`, fullPage }); captures.push(name);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}

for (const design of DESIGN_IDS) for (const format of ["html", "iframe"]) for (const missing of [false, true]) {
  test(`R3a-F01 ${design}/${format} ${missing ? "failed and normal" : "normal"}: first load, offscreen/on-screen, reinsertion, every active product`, async (t) => {
    const page = await pageFor(); t.after(() => page.close());
    await page.getByLabel("Preview", { exact: true }).selectOption(format);
    await page.setViewportSize({ width: 1440, height: 200 });
    await load(page, "en", design, missing);
    await page.evaluate(() => scrollTo(0, 0));
    const preview = page.locator('[data-testid="banner-preview"]');
    assert.ok(await preview.evaluate((el) => el.getBoundingClientRect().top >= innerHeight), "initial preview must be outside viewport");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await preview.scrollIntoViewIfNeeded();
    const frame = await banner(page, format);
    const first = await active(frame, missing), seen = new Set(first.map((i) => i.index));
    for (let i = 0; i < 8 && seen.size < 8; i++) {
      await frame.getByRole("button", { name: "Next products", exact: true }).click();
      for (const item of await active(frame, missing)) seen.add(item.index);
    }
    assert.equal(seen.size, 8, "all products, including failed images, must be activated and inspected");
    await page.evaluate(() => scrollTo(0, 0)); await preview.scrollIntoViewIfNeeded(); await active(frame, missing);
    const code = await page.getByLabel("Export code", { exact: true }).inputValue();
    assert.ok((await preview.getAttribute("srcdoc"))!.includes(code), "inspect the real exporter output");
    const previousKey = await frame.locator("[data-wlpb-key]").getAttribute("data-wlpb-key");
    const oldDocument = await preview.getAttribute("srcdoc");
    await page.getByLabel("Embed width", { exact: true }).fill("960");
    await page.waitForFunction((old) => document.querySelector<HTMLIFrameElement>('[data-testid="banner-preview"]')?.srcdoc !== old, oldDocument);
    const replaced = await banner(page, format); await replaced.waitForFunction(() => document.querySelector<HTMLElement>("[data-wlpb-ready]")?.style.getPropertyValue("--wlpb-width") === "960px");
    await preview.scrollIntoViewIfNeeded(); const reinserted = await active(replaced, missing);
    results.push({ design, format, missing, first, seen: [...seen], previousKey, reinserted });
  });
}
for (const language of ["ko", "en"] as const) for (const width of [1440, 375]) test(`R3a-F01 data capture ${language}/${width}`, async (t) => {
  const page = await pageFor(language, width); t.after(() => page.close());
  await load(page, language, "photo-strip", false, 3);
  await page.locator('[data-testid="banner-preview"]').scrollIntoViewIfNeeded();
  await active(await banner(page, "html"), false);
  await capture(page, `data-${language}-${width}.png`, true);
  await capture(page, `visible-preview-${language}-${width}.png`);
  if (language === "en" && width === 1440) {
    await capture(page, "preview-html-1440.png");
    await page.getByLabel(uiMessages[language].preview, { exact: true }).selectOption("iframe");
    await active(await banner(page, "iframe"), false);
    await page.locator('[data-testid="banner-preview"]').scrollIntoViewIfNeeded();
    await capture(page, "preview-iframe-1440.png");
  }
});
for (const language of ["ko", "en"] as const) test(`R3a-F02 ${language}: release optional/required mappings then import; JSON-specific errors`, async (t) => {
  const page = await pageFor(language); t.after(() => page.close()); const text = uiMessages[language];
  const csv = "Image Url,Promotion Url,Product Desc\nhttps://example.com/img/1.jpg,https://example.com/p/1,Synthetic name";
  let workers = 0; page.on("worker", () => workers++);
  await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByText(text.mapping, { exact: true }).click();
  const mapping = page.locator("details").filter({ has: page.getByText(text.mapping, { exact: true }) });
  const select = (field: "name" | "imageUrl" | "promotionUrl") => mapping.locator("label").filter({ has: page.getByText(text.fields[field], { exact: true }) }).locator("select");
  await select("name").selectOption("");
  const initialWorkers = workers;
  for (const field of ["imageUrl", "promotionUrl"] as const) {
    await select(field).selectOption("");
    await page.getByRole("button", { name: text.confirmImport }).click();
    await page.getByText(inputErrorMessages[language].MAPPING_REQUIRED, { exact: true }).waitFor();
    assert.equal(workers, initialWorkers, "required release must be confirmed before starting extraction");
    assert.equal(await page.locator('[data-testid="banner-product"]').count(), 0);
    await select(field).selectOption(field === "imageUrl" ? "0" : "1");
  }
  await page.getByRole("button", { name: text.confirmImport }).click();
  await page.locator('[data-testid="banner-product"]').waitFor();
  assert.equal(await page.getByLabel(text.name, { exact: true }).inputValue(), "");
  assert.ok(!(await page.getByLabel(text.export, { exact: true }).inputValue()).includes("Synthetic name"));
  page.on("dialog", (dialog) => dialog.accept());
  for (const content of ["{", '{"version":999}', '{"version":1,"products":"invalid"}']) {
    await page.locator('input[accept=".json"]').setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(content) });
    await page.getByText(text.jsonError, { exact: true }).waitFor();
    assert.equal(await page.getByText(text.inputError, { exact: true }).count(), 0);
  }
  results.push({ language, optionalNameReleased: true, requiredReleaseBlockedBeforeWorker: true, jsonErrors: 3 });
});
