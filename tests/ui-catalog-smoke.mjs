// U1/U2: real localized home -> task links -> catalog; no production suppliers.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5430";
const output = process.env.UC_OUTPUT || "/tmp/sol-uc/screenshots";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  for (const language of ["ko", "en"]) for (const width of [390, 1280]) for (const theme of ["light-coral", "dark-mint"]) {
    if (process.env.UC_STAGE !== "U2") await test(`U1 ${language} ${width} ${theme}: task links, tagline and home preserved`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
      await context.addInitScript((theme) => localStorage.setItem("worklazy-theme", theme), theme);
      await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      const page = await context.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(20_000);
      try {
        await page.goto(`${base}/${language}/`, { waitUntil: "networkidle" });
        const nav = page.locator(".home-scenarios"); await nav.waitFor();
        const locale = JSON.parse(await fs.readFile(`src/locales/${language}/tools.json`, "utf8"));
        const common = JSON.parse(await fs.readFile(`src/locales/${language}/common.json`, "utf8"));
        assert.equal(await page.locator(".wl-hero-badge").innerText(), common.home.kicker);
        assert.equal(await page.locator(".wl-hero-copy > p").innerText(), common.home.description);
        assert.equal(await page.getByTestId("home-dropzone").count(), 1);
        assert.equal(await page.locator(".home-how-grid > div").count(), 3);
        assert.equal(await page.locator(".tool-grid a.ui-tool-card").count(), language === "ko" ? 12 : 13);
        const links = nav.locator("a"); assert.equal(await links.count(), 7);
        for (const link of await links.all()) {
          const id = await link.getAttribute("data-scenario-id");
          assert.equal(await link.innerText(), locale.scenarios[id].label);
          assert.equal(await link.getAttribute("href"), `/${language}/tools?category=${id}`);
          assert.ok((await link.boundingBox()).height >= 44);
        }
        for (const card of await page.locator(".home-page [data-ui-component='tool-card']").all()) {
          const id = (await card.getAttribute("href")).split("/").at(-1);
          assert.equal(await card.getByTestId("tool-tagline").innerText(), locale.items[id].tagline);
        }
        await nav.evaluate((node) => window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 140, behavior: "instant" }));
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `home-${language}-${width}-${theme}.png`) });
        // All seven destinations in each language; one representative on other profiles.
        const ids = width === 1280 && theme === "light-coral" ? Object.keys(locale.scenarios) : ["spreadsheets"];
        for (const id of ids) {
          await page.locator(`[data-scenario-id='${id}']`).click();
          await page.locator(".tool-category-groups [data-ui-component='tool-card']").first().waitFor();
          assert.equal(new URL(page.url()).searchParams.get("category"), id);
          assert.equal(await page.locator(".tool-category-section").count(), 1);
          await page.goto(`${base}/${language}/`, { waitUntil: "networkidle" });
          await nav.waitFor();
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
    if (process.env.UC_STAGE !== "U1") await test(`U2 ${language} ${width} ${theme}: compact list, filters, view persistence`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
      await context.addInitScript((theme) => localStorage.setItem("worklazy-theme", theme), theme);
      await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      const page = await context.newPage(), errors = []; page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.goto(`${base}/${language}/tools/`, { waitUntil: "networkidle" });
        const rows = page.locator(".tool-list-row"); await rows.first().waitFor();
        const hrefs = await rows.evaluateAll((items) => items.map((item) => item.getAttribute("href")));
        assert.ok(hrefs.length >= 20); assert.equal(await page.getByTestId("tools-view-list").getAttribute("aria-pressed"), "true");
        assert.ok((await rows.first().boundingBox()).height <= 110, "default rows remain compact");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(output, `tools-${language}-${width}-${theme}.png`) });
        await page.getByTestId("tools-view-grid").focus(); await page.keyboard.press("Enter");
        assert.deepEqual(await page.locator(".tool-category-groups [data-ui-component='tool-card']").evaluateAll((items) => items.map((item) => item.getAttribute("href"))), hrefs);
        await page.reload({ waitUntil: "networkidle" });
        await page.locator("[data-view='grid']").first().waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem("worklazy:tools-view")), "grid");
        await page.getByTestId("tools-view-list").click();
        await page.getByTestId("tools-from-filter").selectOption("spreadsheet");
        await page.getByTestId("tools-do-filter").selectOption("merge");
        await page.locator(".tool-category-filter button").nth(1).click();
        assert.equal(new URL(page.url()).search, "?category=spreadsheets&from=spreadsheet&do=merge");
        await page.waitForFunction(() => document.querySelectorAll(".tool-list-row").length === 1 && document.querySelector(".tool-list-row")?.getAttribute("href")?.endsWith("/excel-merger"));
        assert.equal(await rows.count(), 1); assert.ok((await rows.first().getAttribute("href")).endsWith("/excel-merger"));
        await page.getByTestId("tools-search-input").fill(language === "ko" ? "엑셀" : "excel");
        assert.equal(await rows.count(), 1); assert.ok(!page.url().includes("q="));
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
} finally { await browser.close(); }
