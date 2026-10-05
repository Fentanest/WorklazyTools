import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { JSDOM } from "jsdom";
import { startRecoveryServer } from "../recovery-server.mjs";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson, loadProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { createDefaultSettings, SETTING_RANGES } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS, type BannerLanguage, type DesignId } from "../../src/features/product-banner/stateTypes.ts";
import { uiMessages } from "../../src/features/product-banner/uiMessages.ts";

const job = path.resolve(process.env.PB_JOB_ROOT || "docs/jobs/todo/aliexpress-banner-editor");
const run = process.env.PB_REPAIR_RESULT_DIR ? path.resolve(process.env.PB_REPAIR_RESULT_DIR) : path.join(job, "runs", `editor-repair-${Date.now()}`);
const evidence: object[] = [], shots: string[] = [];
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
let context: BrowserContext, server: Awaited<ReturnType<typeof startRecoveryServer>>;
let blocked = 0, affiliateAttempts = 0;
before(async () => {
  assert.equal(process.env.TMPDIR, path.join(job, "tmp"));
  await mkdir(run, { recursive: true });
  server = await startRecoveryServer({ root: process.env.PB_DIST || "dist", port: 0 });
  context = await chromium.launchPersistentContext(path.join(run, "profile"), {
    headless: true, executablePath: process.env.PB_UI_CHROMIUM_PATH, downloadsPath: path.join(job, "tmp"), args: ["--no-sandbox"],
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === server.url || !/^https?:$/u.test(url.protocol)) return route.continue();
    if (url.hostname.toLowerCase() === "example.com" && url.pathname.startsWith("/img/"))
      return route.fulfill({ contentType: "image/svg+xml", body: image });
    if (url.pathname.includes("/p/") || url.hostname.includes("aliexpress")) affiliateAttempts++;
    blocked++; return route.abort();
  });
  await context.addInitScript(() => { (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true; });
  console.log(`Browser ${context.browser()!.version()}; owned run ${run}`);
});
after(async () => {
  await context?.close(); await server?.close();
  const screenshots = await Promise.all(shots.map(async (file) => ({ path: file, sha256: createHash("sha256").update(await readFile(file)).digest("hex") })));
  await writeFile(path.join(run, "results.json"), JSON.stringify({ evidence, screenshots, blocked, affiliateAttempts, externalRequestsSent: 0 }, null, 2));
  console.log(`Evidence ${run}/results.json; screenshots=${shots.length}; affiliate attempts=${affiliateAttempts}; external requests sent=0`);
  assert.equal(affiliateAttempts, 0);
});
async function open(language: BannerLanguage = "en", width = 1440, theme = "light-coral") {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 1000 }); page.setDefaultTimeout(10000);
  await page.addInitScript((theme) => localStorage.setItem("worklazy-theme", theme), theme);
  await page.goto(`${server.url}/${language}/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor();
  assert.equal(await page.locator("h1").textContent(), uiMessages[language].title);
  return page;
}
async function load(page: Page, language: BannerLanguage, design: DesignId = "photo-strip", off = false) {
  const project = stateWith(3).project;
  const settings = { ...createDefaultSettings(language, design), ...(off ? { showName: false, showPrice: false, showDiscount: false, showButton: false, autoHeight: false, autoPlay: false } : {}) };
  await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic-product-banner.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson({ ...project, settings })) });
  await page.locator('[data-testid="banner-product"]').first().waitFor();
  return { ...project, settings };
}
async function editingFile(page: Page, language: BannerLanguage) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: uiMessages[language].saveJson, exact: true }).click();
  const file = await download; assert.equal(file.suggestedFilename(), "product-banner.json");
  return loadProjectJson(await readFile((await file.path())!, "utf8"));
}
async function standalone(page: Page, language: BannerLanguage) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: uiMessages[language].saveHtml, exact: true }).click();
  const file = await download; assert.equal(file.suggestedFilename(), "product-banner.html");
  return readFile((await file.path())!, "utf8");
}
async function bannerFrame(page: Page, format: "html" | "iframe") {
  const host = await (await page.getByTestId("banner-preview").elementHandle())!.contentFrame();
  const banner = format === "iframe" ? await (await host!.locator("iframe[data-wlpb-frame]").elementHandle())!.contentFrame() : host;
  await banner!.locator('[data-wlpb-ready="true"]').waitFor(); return banner!;
}
async function advanced(page: Page, language: BannerLanguage) {
  await page.getByText(uiMessages[language].advanced, { exact: true }).click();
}

for (const language of ["ko", "en"] as const) test(`keyboard drafts, bounds, blur, undo and saved/exported height: ${language}`, async () => {
  const page = await open(language), text = uiMessages[language]; await load(page, language); await advanced(page, language);
  await page.getByLabel(text.autoHeight, { exact: true }).uncheck();
  await page.getByLabel(text.preview, { exact: true }).selectOption("iframe");
  const height = page.getByLabel(text.height, { exact: true });
  const before = await page.getByLabel(text.export, { exact: true }).inputValue();
  await height.focus(); await height.press("ControlOrMeta+A"); await height.press("Backspace");
  assert.equal(await height.inputValue(), ""); assert.equal(await height.getAttribute("aria-invalid"), "true");
  for (const [key, expected] of [["1", "1"], ["2", "12"], ["3", "123"], ["4", "1234"]]) {
    await height.pressSequentially(key); assert.equal(await height.inputValue(), expected);
    if (expected.length < 3) assert.equal(await page.getByLabel(text.export, { exact: true }).inputValue(), before, "invalid prefixes never change exported settings");
  }
  assert.equal(await height.getAttribute("aria-invalid"), "false"); await height.press("Tab");
  const saved = await editingFile(page, language); assert.equal(saved.settings.iframeHeight, 1234); assert.equal(saved.settings.autoHeight, false);
  const outer = new JSDOM(await page.getByLabel(text.export, { exact: true }).inputValue());
  assert.equal(outer.window.document.querySelector("iframe")!.getAttribute("height"), "1234"); outer.window.close();
  await height.focus(); await height.press("ControlOrMeta+A"); await height.pressSequentially("99");
  assert.equal(await height.inputValue(), "99"); assert.equal(await height.getAttribute("aria-invalid"), "true");
  const hint = await height.getAttribute("aria-describedby"); assert.ok(hint); assert.ok(await page.locator(`[id="${hint}"]`).textContent());
  await height.press("Tab"); assert.equal(await height.inputValue(), "1234");
  await height.focus(); await height.press("ControlOrMeta+A"); await height.press("Backspace"); assert.equal(await height.inputValue(), "");
  await height.press("Tab"); assert.equal(await height.inputValue(), "1234");
  // All controls with the same former prefix rejection must accept real sequential keyboard input.
  await page.getByLabel(text.controls.gridPreset, { exact: true }).selectOption("custom");
  for (const [key, value] of [["width", 1280], ["imageHeight", 180], ["visibleCount", 6], ["intervalSeconds", 12], ["gridColumns", 3], ["gridRows", 4]] as const) {
    const field = page.getByLabel(key === "width" ? text.width : text.controls[key], { exact: true });
    await field.focus(); await field.press("ControlOrMeta+A"); await field.press("Backspace"); assert.equal(await field.inputValue(), "");
    await field.pressSequentially(String(value)); assert.equal(await field.inputValue(), String(value)); await field.press("Tab");
    assert.equal((await editingFile(page, language)).settings[key], value);
  }
  // Programmatic replacement via Undo must also update local numeric drafts.
  await height.focus(); await height.press("ControlOrMeta+A"); await height.pressSequentially("1300"); await height.press("Tab");
  await page.getByRole("button", { name: text.undo, exact: true }).click(); assert.equal(await height.inputValue(), "130");
  assert.equal((await editingFile(page, language)).settings.iframeHeight, 130);
  for (const value of SETTING_RANGES.iframeHeight) { await height.fill(String(value)); await height.press("Tab"); assert.equal((await editingFile(page, language)).settings.iframeHeight, value); }
  await height.fill("2401"); assert.equal(await height.inputValue(), "2401"); await height.press("Tab"); assert.equal(await height.inputValue(), "2400");
  await height.fill("119"); await height.press("Tab"); assert.equal(await height.inputValue(), "2400");
  await height.fill("120.5"); await height.press("Tab"); assert.equal(await height.inputValue(), "2400");
  evidence.push({ test: "keyboard", language, prefixes: ["", "1", "12", "123", "1234"], savedHeight: 1234, exportedHeight: 1234, otherNumericFields: 6, bounds: [120, 2400], invalid: [99, 119, 2401, 120.5] });
  await page.close();
});

test("new defaults, saved false and mixed display choices survive design switches and JSON reload", async () => {
  const page = await open(); const text = uiMessages.en; await advanced(page, "en");
  for (const key of ["showName", "showPrice", "showDiscount", "showButton"] as const) assert.equal(await page.getByLabel(text.controls[key], { exact: true }).isChecked(), true);
  assert.equal(await page.getByLabel(text.autoHeight, { exact: true }).isChecked(), true); assert.equal(await page.getByLabel(text.play, { exact: true }).isChecked(), true);
  await load(page, "en", "photo-strip", true);
  for (const design of DESIGN_IDS) {
    await page.getByLabel(text.design, { exact: true }).selectOption(design);
    for (const key of ["showName", "showPrice", "showDiscount", "showButton"] as const) assert.equal(await page.getByLabel(text.controls[key], { exact: true }).isChecked(), false);
    assert.equal(await page.getByLabel(text.autoHeight, { exact: true }).isChecked(), false);
    assert.equal(await page.getByLabel(text.play, { exact: true }).isDisabled(), design === "vertical" || design === "grid");
  }
  await page.getByLabel(text.controls.showName, { exact: true }).check(); await page.getByLabel(text.controls.showButton, { exact: true }).check();
  for (const design of [...DESIGN_IDS].reverse()) {
    await page.getByLabel(text.design, { exact: true }).selectOption(design);
    for (const [key, expected] of [["showName", true], ["showPrice", false], ["showDiscount", false], ["showButton", true]] as const) assert.equal(await page.getByLabel(text.controls[key], { exact: true }).isChecked(), expected);
  }
  const saved = await editingFile(page, "en"); assert.equal(saved.settings.showName, true); assert.equal(saved.settings.showPrice, false); assert.equal(saved.settings.showButton, true);
  assert.deepEqual(saved.products.map((p) => p.promotionUrl), stateWith(3).project.products.map((p) => p.promotionUrl));
  await page.getByLabel(text.controls.showPrice, { exact: true }).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[accept=".json"]').setInputFiles({ name: "saved.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson(saved)) });
  await page.waitForFunction((label) => [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((input) => input.closest("label")?.textContent?.trim() === label)?.checked === false, text.controls.showPrice);
  assert.equal(await page.getByLabel(text.controls.showPrice, { exact: true }).isChecked(), false);
  evidence.push({ test: "defaults-and-saved-choices", designs: 5, mixed: saved.settings }); await page.close();
});

// Always open the English UI: saved banner language, not route language, controls every export's builder URL.
for (const language of ["ko", "en"] as const) for (const design of DESIGN_IDS) test(`English UI exports ${language} ${design}: HTML, iframe and standalone actual localized builder links`, async () => {
  const page = await open("en"), project = await load(page, language, design);
  assert.equal(await page.getByLabel(uiMessages.en.language, { exact: true }).inputValue(), language);
  const expected = `https://worklazy.net/${language}/tools/product-banner/`;
  for (const format of ["html", "iframe"] as const) {
    await page.getByLabel(uiMessages.en.preview, { exact: true }).selectOption(format);
    const frame = await bannerFrame(page, format);
    assert.equal(await frame.locator('.wlpb-v1-source').getAttribute("href"), expected);
    assert.equal(await frame.locator('.wlpb-v1-source').getAttribute("rel"), "nofollow noopener");
    assert.equal(await frame.locator('.wlpb-v1-source').getAttribute("target"), "_blank");
    assert.equal(await frame.locator('.wlpb-v1-ad').textContent(), language === "ko" ? "광고" : "Ad");
    assert.equal(await frame.locator('.wlpb-v1-name').count(), 3); assert.equal(await frame.locator('.wlpb-v1-prices').count(), 3);
    assert.equal(await frame.locator('.wlpb-v1-discount').count(), 3); assert.equal(await frame.locator('[data-wlpb-cta]').count(), 3);
    for (const selector of ['li a:not([data-wlpb-cta])', 'li a[data-wlpb-cta]'])
      assert.deepEqual(await frame.locator(selector).evaluateAll((links) => links.map((a) => a.getAttribute("href"))), project.products.map((p) => p.promotionUrl));
  }
  const downloaded = await standalone(page, "en"), dom = new JSDOM(downloaded);
  assert.equal(dom.window.document.documentElement.lang, language); assert.equal(dom.window.document.title, uiMessages[language].title);
  assert.equal(dom.window.document.querySelector('.wlpb-v1-source')!.getAttribute("href"), expected);
  dom.window.close();
  // Execute the downloaded standalone bytes locally, with the same network firewall.
  const standalonePage = await context.newPage(); await standalonePage.setContent(downloaded);
  await standalonePage.locator('[data-wlpb-ready="true"]').waitFor(); assert.equal(await standalonePage.locator('.wlpb-v1-source').getAttribute("href"), expected);
  await standalonePage.close();
  evidence.push({ test: "localized-output", ui: "en", language, design, formats: ["html", "iframe", "standalone"], expected, productLinksPreserved: true }); await page.close();
});

for (const language of ["ko", "en"] as const) for (const width of [1440, 375]) for (const theme of ["light-coral", "dark-coral"]) test(`local layout and visible keyboard focus: ${language} ${width} ${theme}`, async () => {
  const page = await open(language, width, theme); await load(page, language); await advanced(page, language);
  const left = page.getByTestId("settings-column"), right = page.getByTestId("preview-column");
  assert.deepEqual(await left.locator("h2").allTextContents(), [uiMessages[language].import, uiMessages[language].products, uiMessages[language].settings, uiMessages[language].export]);
  assert.deepEqual(await right.locator("h2").allTextContents(), [uiMessages[language].preview]);
  const geometry = await page.evaluate(() => {
    const left = document.querySelector('[data-testid="settings-column"]')!, right = document.querySelector('[data-testid="preview-column"]')!;
    const l = left.getBoundingClientRect(), r = right.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, left: { top: l.top, bottom: l.bottom, x: l.x, right: l.right }, right: { top: r.top, x: r.x, right: r.right }, leftPosition: getComputedStyle(left).position, rightPosition: getComputedStyle(right).position, display: getComputedStyle(left.parentElement!).display, alignItems: getComputedStyle(left.parentElement!).alignItems };
  });
  assert.equal(geometry.overflow, false); assert.equal(geometry.display, "grid"); assert.equal(geometry.alignItems, "flex-start"); assert.equal(geometry.leftPosition, "static");
  if (width === 1440) {
    assert.equal(geometry.rightPosition, "sticky"); assert.ok(geometry.right.x >= geometry.left.right);
    await left.getByRole("button", { name: uiMessages[language].saveJson, exact: true }).scrollIntoViewIfNeeded();
    const position = await right.boundingBox(); assert.ok(position!.y >= 90 && position!.y < 150, "desktop preview remains sticky while reaching export");
  } else { assert.equal(geometry.rightPosition, "static"); assert.ok(geometry.right.top >= geometry.left.bottom); }
  const field = page.getByLabel(uiMessages[language].height, { exact: true }); await field.focus();
  const focus = await field.evaluate((element) => ({ active: document.activeElement === element, shadow: getComputedStyle(element).boxShadow }));
  assert.equal(focus.active, true); assert.notEqual(focus.shadow, "none");
  for (const element of await page.locator('[data-tool-page="product-banner"] button, [data-tool-page="product-banner"] input:not([type="file"]), [data-tool-page="product-banner"] select').all()) {
    if (!await element.isVisible()) continue;
    const box = await element.boundingBox(); assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, "visible control must fit viewport");
  }
  await page.evaluate(() => scrollTo(0, 0)); const file = path.join(run, `${language}-${width}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: true }); shots.push(file);
  evidence.push({ test: "layout", language, width, theme, geometry, focus }); await page.close();
});

for (const language of ["ko", "en"] as const) test(`built static SEO and FAQ use exact AliExpress name: ${language}`, async () => {
  const html = await readFile(path.join(process.env.PB_DIST || "dist", language, "tools/product-banner/index.html"), "utf8");
  const dom = new JSDOM(html), document = dom.window.document;
  assert.ok(document.title.startsWith(uiMessages[language].title));
  assert.ok(document.querySelector('meta[property="og:title"]')!.getAttribute("content")!.startsWith(uiMessages[language].title));
  assert.match(document.querySelector('meta[name="description"]')!.getAttribute("content")!, language === "ko" ? /알리익스프레스.*HTML.*iframe/u : /AliExpress.*HTML.*iframe/u);
  assert.equal(document.querySelector('link[rel="canonical"]')!.getAttribute("href"), `https://worklazy.net/${language}/tools/product-banner/`);
  assert.match(html, /FAQPage/u); assert.ok(html.includes(language === "ko" ? "알리익스프레스 상품 정보" : "AliExpress product information")); dom.window.close();
});
