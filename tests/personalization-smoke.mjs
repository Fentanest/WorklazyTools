// U6 synthetic browser checks. Supplier requests are intercepted, never delivered.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { startRecoveryServer } from "./recovery-server.mjs";

const output = process.env.U6_OUTPUT || "/tmp/sol-u6/browser";
await fs.mkdir(output, { recursive: true });
const server = await startRecoveryServer({ root: process.env.U6_DIST || "dist", port: 0 });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const measurements = [];
const recentKey = "worklazy:recent-tools", favoriteKey = "worklazy:favorite-tools";
async function setup({ language = "ko", width = 1280, theme = "light-coral", seed = {}, fault = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 940 }, serviceWorkers: "block", reducedMotion: "reduce" });
  await context.addInitScript(({ seed, theme, fault, origin }) => {
    if (location.origin !== origin) return;
    window.__WORKLAZY_MOCK_PROVIDERS__ = true;
    if (!sessionStorage.getItem("u6-seeded")) {
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
      localStorage.setItem("worklazy-theme", theme);
      sessionStorage.setItem("u6-seeded", "1");
    }
    window.__u6Shifts = [];
    window.__u6Geometry = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__u6Shifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput, time: entry.startTime, sources: entry.sources.map(source => source.node?.className ?? source.node?.nodeName ?? "removed") });
    }).observe({ type: "layout-shift", buffered: true });
    const observer = new MutationObserver(() => {
      const panel = document.querySelector('[data-testid="home-personalization"]');
      if (!panel || window.__u6Geometry.length) return;
      const frame = () => {
        const rect = panel.getBoundingClientRect();
        // Existing page-in uses translateY(9px); compositor animation is not CLS.
        // Remove only that known transform, preserving all document-flow movement.
        const transform = getComputedStyle(panel.closest(".page-enter")).transform;
        const enterTranslateY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
        window.__u6Geometry.push({ y: rect.y + scrollY - enterTranslateY, visualY: rect.y + scrollY, enterTranslateY, height: rect.height });
        if (window.__u6Geometry.length < 12) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    observer.observe(document, { childList: true, subtree: true });
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (fault === "read" && key.startsWith("worklazy:") && key.endsWith("tools")) throw new DOMException("Blocked", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (fault === "quota" && key.startsWith("worklazy:") && key.endsWith("tools")) throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  }, { seed, theme, fault, origin: new URL(server.url).origin });
  const external = [], errors = [];
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(server.url).origin) return route.continue();
    external.push({ url: route.request().url(), body: route.request().postData() });
    return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(30_000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${server.url}/${language}/`, { waitUntil: "networkidle" });
  await page.locator(".wl-hero").waitFor();
  return { context, page, external, errors };
}
try {
  for (const language of ["ko", "en"]) for (const width of [390, 1280]) for (const theme of ["light-coral", "dark-mint"]) {
    await test(`U6 ${language} ${width} ${theme}: first-paint lists, stable geometry and keyboard toggles`, async () => {
      const { context, page, errors, external } = await setup({ language, width, theme, seed: {
        [recentKey]: JSON.stringify(["text-tools", "qr-studio"]), [favoriteKey]: JSON.stringify(["excel-merger"]),
      } });
      try {
        assert.equal(await page.locator('[data-personalization="recent"] a').count(), 2);
        assert.equal(await page.locator('[data-personalization="favorites"] a').count(), 1);
        await page.waitForFunction(() => window.__u6Geometry.length === 12);
        const geometry = await page.evaluate(() => ({ frames: window.__u6Geometry, shifts: window.__u6Shifts, overflow: document.documentElement.scrollWidth > innerWidth }));
        assert.equal(geometry.overflow, false);
        assert.equal(geometry.shifts.filter(shift => !shift.hadRecentInput).reduce((total, shift) => total + shift.value, 0), 0, "initial CLS must remain zero");
        assert.ok(geometry.frames.every(frame => Math.abs(frame.y - geometry.frames[0].y) < 1 && Math.abs(frame.height - geometry.frames[0].height) < 1), JSON.stringify(geometry));
        measurements.push({ language, width, theme, ...geometry });
        const toggle = page.locator('[data-favorite-tool="excel-merger"]').first();
        const href = page.url(); await toggle.focus(); await page.keyboard.press("Enter");
        assert.equal(page.url(), href); assert.equal(await toggle.getAttribute("aria-pressed"), "false");
        await page.keyboard.press("Space"); assert.equal(await toggle.getAttribute("aria-pressed"), "true");
        await page.locator('[data-testid="home-personalization"]').scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${output}/home-${language}-${width}-${theme}.png`, fullPage: true });
        await page.getByTestId("home-personalization").screenshot({ path: `${output}/personalization-${language}-${width}-${theme}.png` });
        await page.goto(`${server.url}/${language}/tools/`, { waitUntil: "networkidle" });
        const listToggle = page.locator('[data-favorite-tool="excel-merger"]');
        assert.equal(await listToggle.getAttribute("aria-pressed"), "true");
        const before = page.url(); await listToggle.click(); assert.equal(page.url(), before);
        assert.equal(await listToggle.getAttribute("aria-pressed"), "false");
        await page.getByTestId("tools-view-grid").click();
        await page.locator('[data-favorite-tool="excel-merger"]').click();
        assert.equal(await page.locator('[data-favorite-tool="excel-merger"]').getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator('a button').count(), 0);
        await page.screenshot({ path: `${output}/catalog-${language}-${width}-${theme}.png`, fullPage: true });
        await page.locator(".tool-category-groups").first().screenshot({ path: `${output}/catalog-controls-${language}-${width}-${theme}.png` });
        assert.deepEqual(errors, []);
        assert.ok(!JSON.stringify(external).includes("worklazy:favorite-tools"));
      } finally { await context.close(); }
    });
  }
  await test("U6 actual tool visits retain six IDs across reload and clear from home/policy", async () => {
    const { context, page, errors } = await setup();
    try {
      for (const id of ["text-tools", "text-formatter", "text-merger", "qr-studio", "data-converter", "timezone-calculator", "work-calculator", "text-tools"]) {
        await page.goto(`${server.url}/ko/tools/${id}/?file=private-u6.pdf&q=private-u6-query`, { waitUntil: "networkidle" });
        await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key) || '[]')[0] === id, [recentKey, id]);
      }
      const recent = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), recentKey);
      assert.deepEqual(recent, ["text-tools", "work-calculator", "timezone-calculator", "data-converter", "qr-studio", "text-merger"]);
      await page.goto(`${server.url}/en/`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-personalization="recent"] a').count(), 6);
      await page.locator('[data-favorite-tool="excel-merger"]').click();
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-personalization="favorites"] a').count(), 1);
      const rectBefore = await page.getByTestId("home-personalization").boundingBox();
      await page.getByTestId("home-personalization").getByRole("button", { name: "Clear", exact: true }).nth(1).click();
      assert.equal(await page.evaluate(key => localStorage.getItem(key), recentKey), null);
      const rectAfter = await page.getByTestId("home-personalization").boundingBox();
      assert.equal(rectBefore.height, rectAfter.height);
      await page.goto(`${server.url}/en/privacy/`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Clear all favorites", exact: true }).click();
      assert.equal(await page.evaluate(key => localStorage.getItem(key), favoriteKey), null);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
  for (const fault of ["corrupt", "quota", "read"]) await test(`U6 ${fault}: stored bytes preserved and normal screen remains usable`, async () => {
    const raw = "{broken-private-u6.pdf";
    const { context, page, errors } = await setup({ fault, seed: fault === "corrupt" ? { [recentKey]: raw, [favoriteKey]: raw } : {} });
    try {
      assert.equal(await page.getByTestId("home-dropzone").count(), 1);
      const toggle = page.locator('[data-favorite-tool="excel-merger"]');
      if (fault === "quota") await toggle.click();
      assert.equal(await toggle.isDisabled(), true);
      if (fault === "corrupt") assert.deepEqual(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [recentKey, favoriteKey]), [raw, raw]);
      await page.locator(".wl-cta").click(); await page.getByTestId("tools-search-input").fill("excel");
      assert.ok(await page.locator(".tool-list-row").count() > 0);
      if (fault === "quota") {
        await page.goto(`${server.url}/ko/tools/text-tools/`, { waitUntil: "networkidle" });
        assert.ok(await page.locator(".wl-topbar").count() > 0);
        assert.equal(await page.evaluate(key => localStorage.getItem(key), recentKey), null);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
  await test("U6 static HTML contains policy disclosure and no personalized home lists", async () => {
    for (const language of ["ko", "en"]) {
      const home = await (await fetch(`${server.url}/${language}/`)).text();
      const privacy = await (await fetch(`${server.url}/${language}/privacy/`)).text();
      assert.ok(!home.includes('data-personalization='));
      assert.ok(!home.includes('data-favorite-tool='));
      assert.ok(privacy.includes(recentKey) && privacy.includes(favoriteKey));
    }
  });
} finally {
  await fs.writeFile(`${output}/layout-measurements.json`, JSON.stringify(measurements, null, 2));
  await browser.close(); await server.close();
}
