import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { buildBannerRuntime } from "../../scripts/product-banner-runtime.mjs";
import { DESIGN_IDS } from "../../src/features/product-banner/stateTypes.ts";
import { startHost, shotDir } from "./render-host.ts";

let browser: Browser, host: Awaited<ReturnType<typeof startHost>>, runtime: string;
before(async () => { runtime = await buildBannerRuntime(); host = await startHost(runtime); browser = await chromium.launch({ headless: true }); await mkdir(shotDir, { recursive: true }); });
after(async () => { await browser?.close(); if (host) await new Promise<void>((resolve) => host.server.close(() => resolve())); });
async function pageFor(t: test.TestContext, query = "", options = {}, clock = false) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 }, ...options });
  t.after(() => context.close()); const page = await context.newPage(), external: string[] = [], errors: string[] = [];
  if (clock) await page.clock.install();
  await context.route("**/*", (route) => { if (new URL(route.request().url()).origin !== host.url) { external.push(route.request().resourceType()); return route.abort(); } return route.continue(); });
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto(`${host.url}/${query}`); await page.mouse.move(1090, 1);
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(external, [], "external network attempts"); });
  return page;
}
const visible = (page: Page, root = 0) => page.locator("[data-wlpb-root]").nth(root).locator("li:not([hidden])").evaluateAll((items) => items.map((i) => Number((i as HTMLElement).dataset.wlpbIndex) + 1));
const playing = (page: Page, value: boolean) => page.waitForFunction((v) => document.querySelector<HTMLElement>("[data-wlpb-root]")?.dataset.wlpbPlaying === String(v), value);

test("five designs at wide/narrow widths, dark samples, container layout, footer geometry and local images", async (t) => {
  const page = await pageFor(t);
  for (const width of [960, 320]) {
    await page.locator(".host").evaluateAll((nodes, w) => nodes.forEach((n) => (n as HTMLElement).style.width = `${w}px`), width);
    for (const [i, design] of DESIGN_IDS.entries()) {
      const root = page.locator("[data-wlpb-root]").nth(i); await root.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll("[data-wlpb-root]")].every((r) => r.getAttribute("data-wlpb-ready") === "true"));
      const geometry = await root.evaluate((r) => {
        const b = r.getBoundingClientRect(), footer = r.querySelector("footer")!.getBoundingClientRect(), list = r.querySelector("ul")!.getBoundingClientRect(), source = r.querySelector(".wlpb-v1-source")!;
        return { overflow: r.scrollWidth > r.clientWidth + 1, separate: footer.top >= list.bottom, sourceSize: getComputedStyle(source).fontSize, fits: source.getBoundingClientRect().right <= b.right + 1 };
      });
      assert.deepEqual(geometry, { overflow: false, separate: true, sourceSize: "12px", fits: true });
      const n = (await visible(page, i)).length;
      assert.equal(n, width === 960 ? [4, 3, 1, 4, 4][i] : [1, 1, 1, 4, 2][i]);
      assert.equal(await root.locator("img:not([hidden])").evaluateAll((imgs) => imgs.filter((img) => (img as HTMLImageElement).complete && !(img as HTMLImageElement).naturalWidth).length), 0);
      await root.screenshot({ path: `${shotDir}/${design}-${width}-light.png` });
    }
  }
  for (const i of [1, 4]) { const root = page.locator("[data-wlpb-root]").nth(i); await root.evaluate((r) => r.setAttribute("data-wlpb-theme", "dark")); await root.screenshot({ path: `${shotDir}/${DESIGN_IDS[i]}-320-dark.png` }); }
});
test("no-JS retains every original product/link in all layouts; no fake slots for small product counts", async (t) => {
  const page = await pageFor(t, "?count=2", { javaScriptEnabled: false });
  for (let i = 0; i < 5; i++) { assert.deepEqual(await visible(page, i), [1, 2]); assert.equal(await page.locator("[data-wlpb-root]").nth(i).locator(".wlpb-v1-controls").isVisible(), false); }
  const active = await pageFor(t, "?count=1&auto=true");
  assert.equal(await active.locator(".wlpb-v1-controls").first().isVisible(), false); await playing(active, false);
});
test("wrapped rotation 1..4 through 9,10,1,2; hidden originals are inert and no clones exist", async (t) => {
  const page = await pageFor(t, "?designs=photo-strip"); assert.deepEqual(await visible(page), [1, 2, 3, 4]);
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "다음 상품" }).click();
  assert.deepEqual(await visible(page), [9, 10, 1, 2]); assert.equal(await page.locator("li").count(), 10);
  assert.equal(await page.locator("li[hidden]").evaluateAll((items) => items.every((p) => (p as HTMLElement).inert)), true);
  await page.getByRole("button", { name: "이전 상품" }).focus(); await page.keyboard.press("Enter"); assert.deepEqual(await visible(page), [8, 9, 10, 1]);
});
test("autoplay, hover/focus gates and explicit pause survive transient events; reduced motion permits manual movement", async (t) => {
  const page = await pageFor(t, "?designs=photo-strip&auto=true", {}, true); await playing(page, true);
  await page.clock.runFor(2100); assert.deepEqual(await visible(page), [2, 3, 4, 5]);
  await page.locator("li:not([hidden])").first().hover(); await playing(page, false); await page.clock.runFor(5000); assert.deepEqual(await visible(page), [2, 3, 4, 5]);
  await page.mouse.move(1090, 1); await playing(page, true);
  await page.locator("li:not([hidden]) a").first().focus(); await playing(page, false); await page.clock.runFor(5000); assert.deepEqual(await visible(page), [2, 3, 4, 5]);
  await page.getByRole("button", { name: "일시정지", exact: true }).click(); await page.locator("button").first().blur(); await page.mouse.move(1090, 1); await page.clock.runFor(5000); await playing(page, false);
  const reduced = await pageFor(t, "?designs=slim&auto=true", { reducedMotion: "reduce" }); await playing(reduced, false);
  await reduced.getByRole("button", { name: "다음 상품" }).click(); assert.deepEqual(await visible(reduced), [2]);
});
test("offscreen and background gates stop; removal/recreation frees timers/listeners/observers and duplicate init is harmless", async (t) => {
  const page = await pageFor(t, "?designs=photo-strip&auto=true"); await playing(page, true);
  await page.locator(".host").evaluate((h) => h.style.marginTop = "2000px"); await playing(page, false);
  await page.locator(".host").evaluate((h) => h.style.marginTop = "0px"); await playing(page, true);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); }); await playing(page, false);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); }); await playing(page, true);
  const key = await page.locator("[data-wlpb-root]").getAttribute("data-wlpb-key"); await page.addScriptTag({ content: runtime });
  assert.equal(await page.locator("[data-wlpb-root]").getAttribute("data-wlpb-key"), key);
  await page.locator("[data-wlpb-root]").evaluate((r) => { (window as any).oldBanner = r; r.remove(); });
  await page.waitForFunction(() => (window as any).WorklazyProductBannerV1.instances.size === 0 && !(window as any).WorklazyProductBannerV1.observer);
  await page.evaluate(() => { document.querySelector(".host")!.append((window as any).oldBanner); (window as any).WorklazyProductBannerV1.init(); });
  assert.notEqual(await page.locator("[data-wlpb-root]").getAttribute("data-wlpb-key"), key);
});
test("same markup twice plus three different designs initialize independently and preserve untouched neighbors", async (t) => {
  const page = await pageFor(t, "?designs=photo-strip,photo-strip,product-card,slim,grid");
  const before = await Promise.all([0, 1, 2, 3, 4].map((i) => visible(page, i)));
  assert.equal(new Set(await page.locator("[data-wlpb-root]").evaluateAll((roots) => roots.map((r) => (r as HTMLElement).dataset.wlpbKey))).size, 5);
  await page.locator("[data-wlpb-root]").first().getByRole("button", { name: "다음 상품" }).click();
  assert.deepEqual(await visible(page), [2, 3, 4, 5]); for (let i = 1; i < 5; i++) assert.deepEqual(await visible(page, i), before[i]);
});
test("per-product image failure fallback, drag suppresses click, 200% view keeps footer and controls inside root", async (t) => {
  const page = await pageFor(t, "?designs=product-card");
  await page.locator("img").first().evaluate((img) => (img as HTMLImageElement).src = "/missing");
  await page.locator(".wlpb-v1-fallback").first().waitFor({ state: "visible" }); assert.equal(await page.locator("img").nth(1).isVisible(), true);
  const link = page.locator("li:not([hidden]) a").first(); const box = (await link.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down(); await page.mouse.move(box.x + 90, box.y + 30); await page.mouse.up();
  assert.equal(page.context().pages().length, 1);
  assert.equal(await link.evaluate((a) => a === document.activeElement), true, "drag must preserve focused link");
  await link.blur();
  await page.locator(".host").evaluate((h) => { h.style.width = "160px"; h.style.zoom = "2"; });
  await page.waitForFunction(() => document.querySelectorAll("li:not([hidden])").length === 1);
  await page.locator("[data-wlpb-root]").screenshot({ path: `${shotDir}/product-card-320-zoom200.png` });
  assert.equal(await page.locator("[data-wlpb-root]").evaluate((r) => r.scrollWidth <= r.clientWidth + 1), true);
});
