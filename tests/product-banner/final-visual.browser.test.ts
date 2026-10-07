import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { buildBannerRuntime } from "../../scripts/product-banner-runtime.mjs";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { startRecoveryServer } from "../recovery-server.mjs";
import { startHost } from "./render-host.ts";

test("T6b final generator ko/en and duplicate/autoplay captures", async () => {
  const dir = process.env.PB_FINAL_SHOTS!, captures: string[] = [];
  const server = await startRecoveryServer({ root: process.env.PB_DIST, port: 0 });
  const host = await startHost(await buildBannerRuntime()), browser = await chromium.launch();
  const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
  async function shot(page: any, name: string) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${dir}/${name}`, fullPage: true }); captures.push(name);
  }
  try {
    for (const lang of ["ko", "en"]) for (const width of [375, 1440]) for (const theme of ["light-coral", "dark-coral"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript((theme) => { if (window === window.top) localStorage.setItem("worklazy-theme", theme); (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true; }, theme);
      await context.route("**/*", (route) => new URL(route.request().url()).origin === server.url ? route.continue()
        : route.request().resourceType() === "image" ? route.fulfill({ body: image, contentType: "image/svg+xml" }) : route.abort());
      try {
        const page = await context.newPage(); await page.goto(`${server.url}/${lang}/tools/product-banner/`);
        await page.locator('[data-tool-page="product-banner"]').waitFor();
        await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson(stateWith(5).project)) });
        await page.locator('[data-testid="banner-product"]').first().waitFor();
        const preview = page.locator('[data-testid="banner-preview"]');
        await preview.scrollIntoViewIfNeeded();
        assert.ok(await preview.evaluate((el) => el.getBoundingClientRect().width <= el.parentElement!.clientWidth + 1), "preview fits its parent without horizontal scrolling");
        const frame = (await (await preview.elementHandle())!.contentFrame())!;
        await frame.waitForFunction(() => document.querySelector('[data-wlpb-root]')?.getAttribute("data-wlpb-ready") === "true");
        await frame.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>("li:not([hidden]) img")].every((img) => img.complete && img.naturalWidth > 0));
        assert.ok(await frame.locator('.wlpb-v1-source').evaluate((el) => el.getBoundingClientRect().right <= innerWidth + 1));
        const viewportName = `generator-preview-${lang}-${width}-${theme}.png`;
        await page.screenshot({ path: `${dir}/${viewportName}` }); captures.push(viewportName);
        await page.evaluate(() => scrollTo(0, 0));
        await shot(page, `generator-${lang}-${width}-${theme}.png`);
      } finally { await context.close(); }
    }
    const page = await browser.newPage({ viewport: { width: 1472, height: 1000 } });
    await page.route("**/*", (r) => new URL(r.request().url()).origin === host.url ? r.continue() : r.abort());
    await page.goto(`${host.url}/?designs=photo-strip,photo-strip,product-card,slim,grid`);
    await page.waitForFunction(() => document.querySelectorAll('[data-wlpb-ready="true"]').length === 5);
    await shot(page, "identical2-different3.png");
    for (const design of ["photo-strip", "product-card", "slim"]) for (const width of [320, 1440]) {
      await page.goto(`${host.url}/?designs=${design}&auto=true`);
      await page.locator(".host").evaluate((h, w) => h.style.width = `${w}px`, width);
      await page.mouse.move(1471, 1);
      await page.waitForFunction(() => document.querySelector('[data-wlpb-root]')?.getAttribute("data-wlpb-playing") === "true");
      await shot(page, `${design}-${width}-autoplay-on.png`);
    }
  } finally {
    await browser.close(); await server.close(); await new Promise<void>((resolve) => host.server.close(() => resolve()));
    await writeFile(`${dir}/visual-MANIFEST.sha256`, (await Promise.all(captures.map(async (name) => `${createHash("sha256").update(await readFile(`${dir}/${name}`)).digest("hex")}  ${name}\n`))).join(""));
  }
});
