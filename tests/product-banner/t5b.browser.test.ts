import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium, type Browser, type Page, type Frame } from "playwright";
import { PNG } from "pngjs";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { inputErrorMessages } from "../../src/features/product-banner/inputErrorMessages.ts";
import { uiMessages } from "../../src/features/product-banner/uiMessages.ts";
import { DESIGN_IDS, PROJECT_LIMITS } from "../../src/features/product-banner/stateTypes.ts";
import { startRecoveryServer } from "../recovery-server.mjs";
import { createCounters, installAdFirewall, assertNoRealNetwork } from "../helpers/ad-stub.mjs";

const XLSX = createRequire(import.meta.url)("xlsx");
const shots = process.env.PB_T5B_SHOT_DIR || "docs/jobs/todo/product-banner/work/shots-T5b";
const captures: string[] = [], measurements: object[] = [];
const png = new PNG({ width: 16, height: 16 }); png.data.fill(200);
const image = PNG.sync.write(png);
let server: Awaited<ReturnType<typeof startRecoveryServer>>, browser: Browser;
let affiliateAttempts = 0, blockedExternal = 0;
const pages = new Set<Page>();
before(async () => {
  const root = path.dirname(process.env.TMPDIR!);
  assert.ok(root === process.env.PB_JOB_ROOT || root.endsWith("/work/tmp/T5b"), "explicit job temporary directory required");
  const ready = JSON.parse(await readFile(`${root}/build-ready.json`, "utf8"));
  assert.equal(process.env.PB_T5B_DIST, ready.outDir);
  for (const [name, hash] of Object.entries(ready.hashes)) assert.equal(createHash("sha256").update(await readFile(`${ready.outDir}/assets/${name}`)).digest("hex"), hash, "completed build is unchanged");
  await mkdir(shots, { recursive: false });
  server = await startRecoveryServer({ root: ready.outDir, port: 0 });
  const profile = await mkdir(`${root}/profiles/${path.basename(shots)}`, { recursive: false }).then(() => `${root}/profiles/${path.basename(shots)}`);
  browser = (await chromium.launchPersistentContext(profile, { headless: true, args: ["--no-sandbox"], downloadsPath: `${root}/tmp` })).browser()!;
  console.log(`Build ready ${ready.completedAt}; server ${server.url}; profile ${profile}`);
  console.log(`Installed Chromium ${browser.version()}; system Chrome not used`);
});
beforeEach((t) => console.log(`CASE START ${new Date().toISOString()} ${t.name}`));
afterEach(async (t) => {
  console.log(`CASE END ${new Date().toISOString()} ${t.name}`);
  for (const page of pages) if (!page.isClosed()) await page.close();
  pages.clear();
});
after(async () => {
  await browser?.close(); await server?.close();
  await writeFile(`${shots}/MANIFEST.sha256`, (await Promise.all(captures.map(async (name) => `${createHash("sha256").update(await readFile(`${shots}/${name}`)).digest("hex")}  ${name}\n`))).join(""));
  await writeFile(`${shots}/RESULTS.json`, JSON.stringify({ measurements, affiliateAttempts, blockedExternal, externalRequestsSent: 0 }, null, 2));
  assert.equal(affiliateAttempts, 0, "no affiliate destination requested");
});
async function pageFor(language: "ko" | "en" = "en", width = 1440, theme = "light-coral") {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  pages.add(page);
  page.setDefaultTimeout(6000);
  await page.addInitScript((theme) => {
    if (window === window.top) localStorage.setItem("worklazy-theme", theme);
    (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true;
  }, theme);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === server.url || !/^https?:$/u.test(url.protocol)) return route.continue();
    if (url.hostname === "example.com" && url.pathname.startsWith("/img/")) return route.fulfill({ contentType: "image/png", body: image, headers: { "cross-origin-resource-policy": "cross-origin" } });
    if (url.hostname.toLowerCase() === "example.com") affiliateAttempts++;
    blockedExternal++; return route.abort();
  });
  await page.goto(`${server.url}/${language}/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor(); return page;
}
const rows = (page: Page) => page.locator('[data-testid="banner-product"]');
async function names(page: Page) { return page.getByLabel("Product name", { exact: true }).evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)); }
async function load(page: Page, count = 3) {
  const project = stateWith(count).project;
  await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson(project)) });
  await rows(page).first().waitFor(); return project;
}
async function frameFor(page: Page, selector = '[data-testid="banner-preview"]'): Promise<Frame> {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const frame = await (await page.locator(selector).elementHandle())!.contentFrame(); assert.ok(frame);
  if (await frame.locator("iframe[data-wlpb-frame]").count()) {
    const inner = await (await frame.locator("iframe[data-wlpb-frame]").elementHandle())!.contentFrame(); assert.ok(inner);
    await inner.locator("[data-wlpb-ready]").waitFor(); return inner;
  }
  await frame.locator("[data-wlpb-ready]").waitFor(); return frame;
}
async function capture(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: `${shots}/${name}`, fullPage }); captures.push(name);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "viewport fits");
}
async function download(page: Page, label: string) {
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: label, exact: true }).click();
  const file = await pending; return readFile((await file.path())!, "utf8");
}
function csv(name: string) { return { name: `${name}.csv`, mimeType: "text/csv", buffer: Buffer.from(`Image Url,Promotion Url,Product Desc\nhttps://example.com/img/${name}.png,https://example.com/p/${name},${name}`) }; }
function workbook() {
  const book = XLSX.utils.book_new();
  for (const name of ["Sheet A", "Sheet B"]) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Image Url", "Promotion Url", "Product Desc"], ["https://example.com/img/a.png", "https://example.com/p/a", name]]), name);
  return { name: "multi.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" })) };
}
const input = (page: Page) => page.locator('input[accept=".xls,.xlsx,.csv"]');
const importButton = (page: Page) => page.getByRole("button", { name: "Import products in selected order", exact: true });

test("M02 sample: ko/en, light/dark, 1440/375; five designs, local images and preserved work", async (t) => {
  for (const lang of ["ko", "en"] as const) for (const width of [1440, 375]) for (const theme of ["light-coral", "dark-coral"]) {
    const page = await pageFor(lang, width, theme); t.after(() => page.close()); const text = uiMessages[lang];
    await page.getByRole("button", { name: text.sample, exact: true }).click();
    assert.equal(await rows(page).count(), 0);
    assert.equal(await page.getByRole("button", { name: text.copyHtml, exact: true }).isEnabled(), false);
    assert.match(await page.getByTestId("preview-data-label").innerText(), /개발용 샘플|Development sample/u);
    for (const design of DESIGN_IDS) {
      await page.getByLabel(text.design, { exact: true }).selectOption(design);
      const frame = await frameFor(page, '[data-testid="sample-preview"]');
      await frame.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>("li:not([hidden]) img")].every((img) => img.complete && img.naturalWidth > 0));
      assert.equal(await frame.locator("[data-wlpb-design]").getAttribute("data-wlpb-design"), design);
      const sources = await frame.locator("img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")));
      assert.ok(sources.every((src) => src?.startsWith(`${server.url}/product-banner-samples/`)));
      assert.deepEqual(await frame.locator('a[rel="sponsored noopener"]').evaluateAll((links) => links.map((a) => a.getAttribute("href"))), [1, 2, 3].map((n) => `https://example.com/#sample-${n}`));
      await capture(page, `${lang}-${theme}-${width}-${design}-sample.png`, true);
    }
    const project = await load(page);
    assert.equal(await page.getByRole("button", { name: text.saveHtml, exact: true }).isEnabled(), false);
    await page.getByRole("button", { name: text.realData, exact: true }).click();
    assert.match(await page.getByTestId("preview-data-label").innerText(), /내가 가져온|My imported/u);
    const saved = JSON.parse(await download(page, text.saveJson));
    assert.deepEqual(saved, project, "sample never replaces imported products or settings");
    await page.getByRole("button", { name: text.sample, exact: true }).click();
    await page.getByLabel(text.design, { exact: true }).selectOption("slim");
    await page.getByRole("button", { name: text.realData, exact: true }).click();
    assert.deepEqual(JSON.parse(await download(page, text.saveJson)), project);
    await frameFor(page); await capture(page, `${lang}-${theme}-${width}-real.png`, true);
    await page.close();
  }
});

test("M02 sample width changes without changing imported settings", async (t) => {
  const page = await pageFor(); t.after(() => page.close()); const project = await load(page);
  await page.getByRole("button", { name: uiMessages.en.sample, exact: true }).click();
  await page.getByLabel(uiMessages.en.width, { exact: true }).fill("480");
  assert.equal(await page.getByTestId("sample-preview").evaluate((el) => (el as HTMLIFrameElement).getBoundingClientRect().width), 480);
  await page.getByRole("button", { name: uiMessages.en.realData, exact: true }).click();
  assert.deepEqual(JSON.parse(await download(page, uiMessages.en.saveJson)), project);
});

test("M03 control: iframe updates versus replacement and joint history", async (t) => {
  const control: object[] = [];
  for (const nested of [false, true]) for (const replace of [false, true]) {
    const page = await browser.newPage(); t.after(() => page.close());
    await page.route(`${server.url}/history-control`, (route) => route.fulfill({ contentType: "text/html", body: '<iframe sandbox="allow-scripts" srcdoc="initial"></iframe>' }));
    await page.goto(`${server.url}/history-control`);
    await page.evaluate(() => { (window as any).__pops = 0; addEventListener("popstate", () => (window as any).__pops++); history.pushState({ guard: true }, ""); });
    for (let n = 0; n < 3; n++) {
      const loaded = page.waitForEvent("framenavigated", { predicate: (frame) => frame !== page.mainFrame() });
      await page.evaluate(({ replace, nested, n }) => {
        const old = document.querySelector("iframe")!;
        const html = nested ? `<iframe srcdoc="${n}"></iframe>` : String(n);
        if (replace) { const next = document.createElement("iframe"); next.sandbox.add("allow-scripts"); next.srcdoc = html; old.replaceWith(next); }
        else old.srcdoc = html;
      }, { replace, nested, n }); await loaded;
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => history.back()); await page.waitForTimeout(300);
    const result = await page.evaluate(() => ({ pops: (window as any).__pops, guarded: !!history.state?.guard, historyLength: history.length }));
    assert.equal(result.pops, replace ? 1 : 0); assert.equal(result.guarded, !replace);
    control.push({ nested, replace, ...result }); await page.close();
  }
  measurements.push({ jointHistoryControl: control });
});

test("M03 multi-file/sheet UI: selection, displayed order, file reorder, partial issues, replacement refusal", async (t) => {
  const page = await pageFor(); t.after(() => page.close());
  await load(page, 1); await page.getByLabel("Product name", { exact: true }).fill("Retained edit");
  await input(page).setInputFiles([workbook(), csv("Last"), { name: "partial.csv", mimeType: "text/csv", buffer: Buffer.from("Product Desc\nMissing columns") }, { name: "empty.csv", mimeType: "text/csv", buffer: Buffer.alloc(0) }]);
  await page.getByText("3. partial.csv", { exact: true }).waitFor();
  await page.getByText(inputErrorMessages.en.EMPTY_FILE, { exact: true }).waitFor();
  const pending = page.getByText("2. Last.csv", { exact: true }).locator("..");
  await pending.getByRole("button", { name: "Move up", exact: true }).click();
  assert.equal(await page.getByText("1. Last.csv", { exact: true }).count(), 1);
  const sheetB = page.getByText("2. Sheet B", { exact: true });
  await sheetB.locator("input").uncheck(); await sheetB.locator("input").check();
  await page.getByLabel("Import files", { exact: true }).selectOption("replace");
  page.once("dialog", (dialog) => dialog.dismiss()); await importButton(page).click();
  await page.waitForFunction(() => !document.querySelector('input[accept=".xls,.xlsx,.csv"]')?.hasAttribute("disabled"));
  assert.equal(await page.getByText("1. Last.csv", { exact: true }).count(), 1);
  assert.deepEqual(await names(page), ["Retained edit"]);
  await page.getByLabel("Import files", { exact: true }).selectOption("append"); await importButton(page).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="banner-product"]').length === 4);
  assert.deepEqual(await names(page), ["Retained edit", "Last", "Sheet A", "Sheet B"]);
  assert.match(await page.locator('[role="status"]').allTextContents().then((s) => s.join(" ")), /column|mapping|image|link/iu);
  assert.equal(await page.getByText("1. Last.csv", { exact: true }).count(), 0);
});

test("M03 cancellation during inspect/extract and same-file reinput", async (t) => {
  const page = await pageFor(); t.after(() => page.close());
  let delay = true;
  await page.context().route("**/input.worker-*.js", async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue().catch(() => {});
  });
  await input(page).setInputFiles(csv("Again"));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await importButton(page).waitFor(); assert.equal(await importButton(page).isEnabled(), false);
  delay = false; await input(page).setInputFiles(csv("Again"));
  await page.getByText("1. Again.csv", { exact: true }).waitFor();
  delay = true; await importButton(page).click(); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await importButton(page).waitFor(); assert.equal(await rows(page).count(), 0);
  assert.equal(await page.getByText("1. Again.csv", { exact: true }).count(), 1);
  delay = false; await importButton(page).click(); await rows(page).first().waitFor();
  assert.deepEqual(await names(page), ["Again"]);
});

test("M03 pages retain selection and order through buttons, keyboard and drag", async (t) => {
  const page = await pageFor(); t.after(() => page.close()); await load(page, 22);
  assert.equal(await rows(page).nth(19).getByText("Image not checked", { exact: true }).count(), 1);
  await rows(page).nth(19).getByRole("checkbox").first().check();
  await rows(page).nth(19).getByRole("button", { name: "Move down", exact: true }).click();
  await page.getByRole("button", { name: "Next products", exact: true }).click();
  assert.equal(await rows(page).first().getByRole("checkbox").first().isChecked(), true);
  assert.deepEqual(await names(page), ["합성 상품 20", "합성 상품 22"]);
  await rows(page).first().getByRole("button", { name: "Move down", exact: true }).focus(); await page.keyboard.press("Enter");
  assert.deepEqual(await names(page), ["합성 상품 22", "합성 상품 20"]);
  await rows(page).nth(1).locator("[draggable]").dragTo(rows(page).first());
  assert.deepEqual(await names(page), ["합성 상품 20", "합성 상품 22"]);
  await rows(page).first().getByRole("button", { name: "Move up", exact: true }).focus(); await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Previous products", exact: true }).click();
  assert.equal(await rows(page).nth(19).getByRole("checkbox").first().isChecked(), true);
  assert.equal((await names(page))[19], "합성 상품 20");
});

test("M03 initial checking, failure, retry and stale image callbacks", async (t) => {
  const page = await pageFor(); t.after(() => page.close());
  let release!: () => void, seen!: () => void;
  const requested = new Promise<void>((resolve) => { seen = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("https://example.com/img/1.jpg", async (route) => { seen(); await held; await route.fulfill({ status: 404, body: "Unavailable" }).catch(() => {}); });
  await load(page, 1); await rows(page).first().locator("img").scrollIntoViewIfNeeded(); await requested;
  try { await rows(page).first().getByText("Checking image", { exact: true }).waitFor(); }
  finally { release(); }
  await rows(page).first().getByText(uiMessages.en.imageStates.failure, { exact: true }).waitFor();
  await page.unroute("https://example.com/img/1.jpg");
  await rows(page).first().getByRole("button", { name: "Retry image", exact: true }).click();
  await rows(page).first().getByText("Image loaded", { exact: true }).waitFor();
  await page.getByLabel("Image URL", { exact: true }).fill("javascript:blocked");
  assert.equal(await rows(page).first().getByText("Image not checked", { exact: true }).count(), 1);
  let releaseOld!: () => void, oldSeen!: () => void;
  const oldRequested = new Promise<void>((resolve) => { oldSeen = resolve; });
  const oldHeld = new Promise<void>((resolve) => { releaseOld = resolve; });
  await page.route("https://example.com/img/stale.png", async (route) => { oldSeen(); await oldHeld; await route.fulfill({ status: 404, body: "Old failure" }).catch(() => {}); });
  await page.getByLabel("Image URL", { exact: true }).fill("https://example.com/img/stale.png"); await oldRequested;
  try {
    await page.getByLabel("Image URL", { exact: true }).fill("https://example.com/img/replacement.png");
    await rows(page).first().getByText("Image loaded", { exact: true }).waitFor();
  } finally { releaseOld(); }
  await page.waitForTimeout(150);
  assert.equal(await rows(page).first().getByText("Image loaded", { exact: true }).count(), 1);
});

test("M03 forced clipboard failure, standalone download and editing JSON restore/rejection", async (t) => {
  const page = await pageFor(); t.after(() => page.close()); const project = await load(page);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("synthetic failure")) }, configurable: true }));
  for (const name of ["Copy HTML code", "Copy iframe code"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByText(uiMessages.en.copyFailed, { exact: true }).waitFor();
    const code = page.getByLabel("Export code", { exact: true }); await code.focus();
    assert.ok(await code.evaluate((el) => (el as HTMLTextAreaElement).selectionEnd === (el as HTMLTextAreaElement).value.length));
  }
  await page.getByLabel("Export code", { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, "en-clipboard-failure.png");
  const html = await download(page, "Save HTML file"); assert.ok(html.startsWith("<!doctype html>"));
  const host = await browser.newPage(); t.after(() => host.close());
  await host.route("**/*", (route) => route.request().url().startsWith("https://example.com/img/") ? route.fulfill({ contentType: "image/png", body: image }) : route.abort());
  await host.setContent(html); await host.locator("[data-wlpb-ready]").waitFor();
  assert.equal(await host.locator('a[rel="sponsored noopener"]').count(), project.products.length);
  assert.equal(await host.locator("script[src]").count(), 0);
  const saved = await download(page, "Save editing file"); assert.deepEqual(JSON.parse(saved), project);
  await page.getByLabel("Product name", { exact: true }).first().fill("Unsaved edit");
  const payload = { name: "restore.json", mimeType: "application/json", buffer: Buffer.from(saved) };
  page.once("dialog", (dialog) => dialog.dismiss()); await page.locator('input[accept=".json"]').setInputFiles(payload);
  assert.equal((await names(page))[0], "Unsaved edit");
  page.once("dialog", (dialog) => dialog.accept()); await page.locator('input[accept=".json"]').setInputFiles(payload);
  await page.waitForFunction(() => (document.querySelector('[data-testid="banner-product"] input[type="text"]') as HTMLInputElement)?.value !== "Unsaved edit");
  assert.deepEqual(JSON.parse(await download(page, "Save editing file")), project);
  page.once("dialog", (dialog) => dialog.accept()); await page.locator('input[accept=".json"]').setInputFiles({ ...payload, buffer: Buffer.from('{"schemaVersion":999}') });
  await page.getByText(uiMessages.en.jsonError, { exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await download(page, "Save editing file")), project);
  for (const buffer of [Buffer.from("{"), Buffer.alloc(PROJECT_LIMITS.bytes + 1)]) {
    page.once("dialog", (dialog) => dialog.accept()); await page.locator('input[accept=".json"]').setInputFiles({ ...payload, buffer });
    await page.getByText(buffer.length > PROJECT_LIMITS.bytes ? uiMessages.en.limitError : uiMessages.en.jsonError, { exact: true }).waitFor();
    assert.deepEqual(JSON.parse(await download(page, "Save editing file")), project);
  }
});

// The gate forces the observer callback to happen after the action result, without a timing delay.
async function heldReviewImage(page: Page, outcome: "success" | "failure" = "success") {
  let release!: () => void, seen!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requested = new Promise<void>((resolve) => { seen = resolve; });
  await page.route("https://example.com/img/1.jpg", async (route) => {
    seen(); await held;
    await (outcome === "success"
      ? route.fulfill({ contentType: "image/png", body: image, headers: { "cross-origin-resource-policy": "cross-origin" } })
      : route.fulfill({ status: 404, body: "Synthetic image failure" })).catch(() => {});
  });
  return { release, requested };
}
async function assertSelectedCode(page: Page, expected: string) {
  const code = page.getByLabel("Export code", { exact: true });
  // Blur first: focus selection must also work after a passive rerender.
  await code.evaluate((el) => (el as HTMLTextAreaElement).blur()); await code.focus();
  assert.deepEqual(await code.evaluate((el) => {
    const area = el as HTMLTextAreaElement;
    return { readOnly: area.readOnly, value: area.value, start: area.selectionStart, end: area.selectionEnd };
  }), { readOnly: true, value: expected, start: 0, end: expected.length });
}
for (const format of ["html", "iframe"] as const) {
  test(`T6afix ${format} copy failure survives held image completion`, async (t) => {
    const page = await pageFor(); t.after(() => page.close());
    const gate = await heldReviewImage(page); t.after(gate.release);
    await load(page, 1);
    const row = rows(page).first(); await row.locator("img").scrollIntoViewIfNeeded(); await gate.requested;
    await row.getByText(uiMessages.en.imageStates.checking, { exact: true }).waitFor();
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("synthetic failure")) }, configurable: true }));
    await page.getByRole("button", { name: format === "html" ? uiMessages.en.copyHtml : uiMessages.en.copyIframe, exact: true }).click();
    const notice = page.getByText(uiMessages.en.copyFailed, { exact: true }); await notice.waitFor();
    const code = await page.getByLabel("Export code", { exact: true }).inputValue();
    assert.ok(code.length > 0); await assertSelectedCode(page, code);
    gate.release(); await row.getByText(uiMessages.en.imageStates.success, { exact: true }).waitFor();
    assert.equal(await notice.count(), 1, "image completion must preserve the copy failure notice");
    await assertSelectedCode(page, code);
    measurements.push({ regression: `T6afix-${format}-copy-failure`, heldImageRequested: true, noticeBefore: true, imageCompleted: true, noticeAfter: true, selectableCodeUnchanged: true });
    // A new editor action clears the old result even when the project itself is unchanged.
    await row.getByRole("checkbox").first().check(); assert.equal(await notice.count(), 0);
  });
}
test("T6afix copy success, save and JSON error survive observations and expire on project changes", async (t) => {
  for (const action of ["copy-html", "copy-iframe", "save", "json-error"] as const) {
    const page = await pageFor(); t.after(() => page.close()); page.on("dialog", (dialog) => dialog.accept());
    const gate = await heldReviewImage(page, "failure"); t.after(gate.release);
    await load(page, 1);
    const row = rows(page).first(); await row.locator("img").scrollIntoViewIfNeeded(); await gate.requested;
    await row.getByText(uiMessages.en.imageStates.checking, { exact: true }).waitFor();
    let expected = uiMessages.en.copied;
    if (action.startsWith("copy-")) {
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { (window as any).__copiedCode = value; } }, configurable: true }));
      await page.getByRole("button", { name: action === "copy-html" ? uiMessages.en.copyHtml : uiMessages.en.copyIframe, exact: true }).click();
      assert.equal(await page.evaluate(() => (window as any).__copiedCode), await page.getByLabel("Export code", { exact: true }).inputValue());
    } else if (action === "save") {
      expected = uiMessages.en.saved;
      assert.equal(JSON.parse(await download(page, uiMessages.en.saveJson)).products.length, 1);
    } else {
      expected = uiMessages.en.jsonError;
      await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic-invalid.json", mimeType: "application/json", buffer: Buffer.from("{") });
    }
    const notice = page.getByText(expected, { exact: true }); await notice.waitFor();
    gate.release(); await row.getByText(uiMessages.en.imageStates.failure, { exact: true }).waitFor();
    assert.equal(await notice.count(), 1, `${action} notice survives the image error callback`);
    measurements.push({ regression: `T6afix-${action}`, noticeBefore: true, imageFailed: true, noticeAfter: true });
    // Copy replaces the previous result, and editing clears it.
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true }));
    await page.getByRole("button", { name: uiMessages.en.copyHtml, exact: true }).click();
    await page.getByText(uiMessages.en.copied, { exact: true }).waitFor();
    if (expected !== uiMessages.en.copied) assert.equal(await notice.count(), 0);
    await page.getByLabel("Product name", { exact: true }).fill("New user edit");
    assert.equal(await page.getByText(uiMessages.en.copied, { exact: true }).count(), 0);
    await page.close();
  }
});

test("M03 resource measurements: worker cancellation/exit, downloads, repeated previews and runtime removal", async (t) => {
  const page = await pageFor(); t.after(() => page.close());
  await page.addInitScript(() => {
    const w = window as any, counts = { workers: 0, workerStarts: 0, workerStops: 0, urls: 0, urlCreates: 0, urlRevokes: 0 };
    const observers = new Set<object>(), timers = new Set<number>();
    for (const name of ["MutationObserver", "ResizeObserver", "IntersectionObserver"]) {
      const Original = w[name];
      w[name] = class extends Original {
        observe(...args: any[]) { if (args[0] instanceof Element && (args[0].matches("[data-wlpb-root]") || args[0].closest('[data-testid="banner-product"]') || (name === "MutationObserver" && args[0] === document.documentElement && document.querySelector("[data-wlpb-root],iframe[data-wlpb-frame]")))) observers.add(this); return super.observe(...args); }
        disconnect() { observers.delete(this); return super.disconnect(); }
      };
    }
    const set = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window);
    w.setTimeout = (callback: Function, ms: number, ...args: any[]) => {
      const id = set(() => { timers.delete(id); callback(...args); }, ms); timers.add(id); return id;
    };
    w.clearTimeout = (id: number) => { timers.delete(id); clear(id); };
    const WorkerClass = Worker;
    w.Worker = class extends WorkerClass {
      stopped = false;
      constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); counts.workers++; counts.workerStarts++; }
      terminate() { if (!this.stopped) { counts.workers--; counts.workerStops++; this.stopped = true; } super.terminate(); }
    };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), urls = new Set<string>();
    URL.createObjectURL = (blob) => { const url = create(blob); urls.add(url); counts.urls = urls.size; counts.urlCreates++; return url; };
    URL.revokeObjectURL = (url) => { if (urls.delete(url)) counts.urlRevokes++; counts.urls = urls.size; revoke(url); };
    w.__resources = () => ({ ...counts, observers: observers.size, timers: timers.size });
  });
  await page.reload(); await page.locator('[data-tool-page="product-banner"]').waitFor();
  const resource = () => page.evaluate(() => (window as any).__resources());
  const baseline = await resource();
  await page.context().route("**/input.worker-*.js", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1000)); await route.continue().catch(() => {}); });
  await input(page).setInputFiles(csv("Cancel"));
  await page.waitForFunction(() => (window as any).__resources().workers === 1);
  const during = await resource(); assert.ok(during.timers > baseline.timers);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForFunction(() => (window as any).__resources().workers === 0);
  const canceled = await resource(); assert.equal(canceled.workerStarts, canceled.workerStops);
  await page.context().unroute("**/input.worker-*.js"); await load(page, 8);
  await download(page, "Save HTML file"); await download(page, "Save editing file");
  await page.waitForFunction(() => (window as any).__resources().urls === 0);
  const saved = await resource(); assert.equal(saved.urlCreates, 2); assert.equal(saved.urlRevokes, 2);
  await page.getByText("Advanced settings", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Automatic height — includes a helper script", exact: true }).check();
  const live: object[] = [];
  for (let n = 0; n < 8; n++) {
    await page.getByLabel("Design", { exact: true }).selectOption(n % 2 ? "slim" : "photo-strip");
    const format = n % 2 ? "iframe" : "html";
    await page.getByLabel("Preview", { exact: true }).selectOption(format);
    const frame = await frameFor(page);
    await frame.waitForFunction(() => typeof (window as any).__resources === "function");
    const counts = await frame.evaluate(() => (window as any).__resources());
    assert.equal(counts.observers, format === "iframe" ? 4 : 3, "banner and optional height observers are bounded");
    assert.ok(counts.timers <= (format === "iframe" ? 2 : 1), "rotation and optional height timers are bounded");
    assert.equal(page.frames().length, format === "iframe" ? 3 : 2, "no accumulating preview documents"); live.push({ format, ...counts });
  }
  const outer = await (await page.getByTestId("banner-preview").elementHandle())!.contentFrame(); assert.ok(outer);
  assert.equal(await outer.evaluate(() => (window as any).__resources().observers), 1, "height helper observer is measured");
  await outer.locator("iframe[data-wlpb-frame]").evaluate((el) => el.remove());
  await outer.waitForFunction(() => (window as any).__resources().observers === 0);
  await page.getByLabel("Preview", { exact: true }).selectOption("html");
  const frame = await frameFor(page);
  const beforeRemoval = await frame.evaluate(() => (window as any).__resources()); assert.equal(beforeRemoval.observers, 3);
  await frame.locator("[data-wlpb-root]").evaluate((root) => root.remove());
  await frame.waitForFunction(() => (window as any).__resources().observers === 0 && (window as any).__resources().timers === 0);
  const removed = await frame.evaluate(() => (window as any).__resources());
  // Pending import belongs to the tool: leaving through the actual app guard aborts its Worker.
  await input(page).setInputFiles(csv("Exit")); await page.getByText("1. Exit.csv", { exact: true }).waitFor();
  await page.context().route("**/input.worker-*.js", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1200)); await route.continue().catch(() => {}); });
  await importButton(page).click(); await page.waitForFunction(() => (window as any).__resources().workers === 1);
  const exitEvents: string[] = [];
  page.on("framenavigated", (frame) => { exitEvents.push(frame === page.mainFrame() ? new URL(page.url()).pathname : `child:${frame.url()}`); });
  page.on("dialog", (dialog) => dialog.accept());
  await page.evaluate(() => {
    const w = window as any; w.__historyTrace = [];
    for (const name of ["pushState", "replaceState", "back"] as const) {
      const original = history[name].bind(history);
      (history as any)[name] = (...args: any[]) => { w.__historyTrace.push({ name, path: location.pathname, guard: !!history.state?.worklazyUnsavedGuard }); return (original as Function)(...args); };
    }
    addEventListener("popstate", () => w.__historyTrace.push({ name: "popstate", path: location.pathname, guard: !!history.state?.worklazyUnsavedGuard }));
  });
  const cdp = await page.context().newCDPSession(page);
  const historyBefore = await cdp.send("Page.getNavigationHistory");
  await page.locator('a[href="/en/tools"]').first().click();
  await page.getByRole("alertdialog").waitFor();
  await page.getByTestId("unsaved-leave").click();
  await page.waitForURL((url) => /^\/en\/tools\/?$/u.test(url.pathname), { waitUntil: "domcontentloaded" }).catch(async (error) => { measurements.push({ baseline, during, canceled, saved, live, beforeRemoval, removed, exitEvents, historyBefore, historyAfter: await cdp.send("Page.getNavigationHistory"), historyTrace: await page.evaluate(() => (window as any).__historyTrace), exitFailurePath: new URL(page.url()).pathname, resources: await resource() }); throw error; });
  await page.waitForFunction(() => { const r = (window as any).__resources(); return r.workers === 0 && r.urls === 0 && r.observers === 0 && r.timers === 0; });
  const exited = await resource(); assert.equal(exited.workerStarts, exited.workerStops);
  const providerFrames = await page.locator(".coupang-banner iframe").count();
  const previewDocumentsAfterExit = await page.locator('[data-testid="banner-preview"],[data-testid="sample-preview"]').count();
  measurements.push({ baseline, during, canceled, saved, live, beforeRemoval, removed, exited, providerFrames, frameUrlsAfterExit: page.frames().map((f) => f.url()), historyBefore, historyAfter: await cdp.send("Page.getNavigationHistory"), previewDocumentsAfterExit });
  assert.equal(previewDocumentsAfterExit, 0);
  // The provider can remove its failed frame between frames() and frameElement().
  // Inspect current DOM owners atomically; every remaining iframe must be a provider.
  assert.ok(await page.locator("iframe").evaluateAll((frames) => frames.every((el) => !!el.closest(".coupang-banner"))), "remaining child documents belong to the existing provider");
});

test("D18 new route provider loading/ready/error and QA-blocked samples", async (t) => {
  for (const mode of ["loading-ready", "error", "qa-blocked"]) {
    const counters = createCounters(), context = await browser.newContext(); t.after(() => context.close());
    await installAdFirewall(context, server.url, counters);
    const providerStubs = { google: 0, naver: 0, coupang: 0 };
    const stub = async (route: any, kind: keyof typeof providerStubs, body: string) => { providerStubs[kind]++; await route.fulfill({ contentType: "application/javascript", body, headers: { "Access-Control-Allow-Origin": "*" } }); };
    await context.route("https://www.googletagmanager.com/gtag/js?id=*", (route) => stub(route, "google", "window.__googleStubLoaded=true;"));
    await context.route("https://wcs.pstatic.net/wcslog.js", (route) => stub(route, "naver", "window.wcs_do=function(){};window.wcs={event:function(){}};"));
    await context.route("https://ads-partners.coupang.com/g.js", (route) => stub(route, "coupang", "window.PartnersCoupang={G:function(){}};"));
    if (mode !== "qa-blocked") await context.addInitScript(() => { (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true; });
    const page = await context.newPage();
    if (mode !== "qa-blocked") await page.route("**/ProductBannerPage-*.js", async (route) => {
      if (mode === "error") {
        assert.deepEqual(providerStubs, { google: 0, naver: 0, coupang: 0 }); assert.equal(counters.stub, 0);
        measurements.push({ mode: "error-before-document-transition", providerStubs: { ...providerStubs }, stub: counters.stub });
        return route.fulfill({ status: 404, body: "Unavailable" });
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); return route.continue();
    });
    await page.goto(`${server.url}/en/tools/product-banner/`, { waitUntil: "domcontentloaded" });
    if (mode === "loading-ready") {
      await page.locator(".tool-route-loading").waitFor();
      assert.equal(counters.stub, 0); assert.deepEqual(providerStubs, { google: 0, naver: 0, coupang: 0 }); assert.equal(await page.locator("script[data-worklazy-adsense]").count(), 0);
      await page.locator('[data-tool-page="product-banner"]').waitFor();
      await page.waitForFunction(() => (window as any).__wlAdStub?.loads === 1);
      assert.equal(counters.stub, 1);
      await page.locator(".coupang-banner iframe").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('script[data-worklazy-google-analytics][data-loaded="true"]') && typeof (window as any).wcs_do === "function");
      assert.deepEqual(providerStubs, { google: 1, naver: 1, coupang: 1 });
      await load(page, 1); const frame = await frameFor(page);
      assert.equal(await frame.locator("script[src]").count(), 0);
      assert.equal(await frame.locator("script[data-worklazy-adsense]").count(), 0);
      assert.equal(counters.stub, 1, "export preview creates no provider request");
      assert.deepEqual(providerStubs, { google: 1, naver: 1, coupang: 1 }, "export preview creates no analytics/widget request");
    } else if (mode === "error") {
      // Chunk recovery can start a reload that the error-document transition
      // cancels. A navigation waiter rejects that intermediate ERR_ABORTED;
      // observe the required terminal document and its providers together.
      await page.waitForFunction(() => /^\/en\/error\/?$/u.test(location.pathname)
        && document.querySelector('script[data-worklazy-google-analytics][data-loaded="true"]') && typeof (window as any).wcs_do === "function");
      assert.equal(counters.stub, 0); assert.equal(await page.locator("script[data-worklazy-adsense]").count(), 0);
      assert.deepEqual(providerStubs, { google: 1, naver: 1, coupang: 0 }, "existing error document permits safe analytics without advertising");
    } else {
      await page.locator('[data-tool-page="product-banner"]').waitFor(); await page.waitForTimeout(500);
      assert.equal(counters.stub, 0); assert.equal(await page.locator("script[data-worklazy-adsense]").count(), 0);
    }
    if (mode === "qa-blocked") assert.deepEqual(providerStubs, { google: 0, naver: 0, coupang: 0 });
    assertNoRealNetwork(counters, mode);
    measurements.push({ mode, providerStubs, stub: counters.stub, attempts: counters.attempt, blockedAnalytics: counters.blockedAnalytics, finalPath: new URL(page.url()).pathname });
    await capture(page, `provider-${mode}.png`); await context.close();
  }
});
