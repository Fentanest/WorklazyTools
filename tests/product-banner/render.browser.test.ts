import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { buildBannerRuntime } from "../../scripts/product-banner-runtime.mjs";
import { DESIGN_IDS } from "../../src/features/product-banner/stateTypes.ts";
import { startHost, shotDir } from "./render-host.ts";

let browser: Browser, host: Awaited<ReturnType<typeof startHost>>, runtime: string;
const optionGeometry: unknown[] = [];
before(async () => { runtime = await buildBannerRuntime(); host = await startHost(runtime); browser = await chromium.launch({ headless: true }); await mkdir(shotDir, { recursive: true }); });
after(async () => { await writeFile(process.env.PB_RENDER_RESULT_PATH || "docs/jobs/todo/product-banner/work/R2a-option-geometry.json", JSON.stringify(optionGeometry, null, 2)); await browser?.close(); if (host) await new Promise<void>((resolve) => host.server.close(() => resolve())); });
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

for (const language of ["ko", "en"]) for (const design of ["photo-strip", "slim"]) test(`R2afix2 price and page ranges: ${language} ${design}`, async (t) => {
  const page = await pageFor(t, `?designs=${design}&language=${language}&showPrice=true`);
  const status = page.getByRole("status"), next = page.getByRole("button", { name: language === "en" ? "Next products" : "다음 상품", exact: true });
  assert.equal(await page.locator(".wlpb-v1-prices strong").first().textContent(), "USD 206.50");
  assert.equal(await status.textContent(), design === "slim" ? "1 / 10" : "1–4 / 10");
  assert.equal(await status.getAttribute("aria-label"), language === "en"
    ? `Showing products ${design === "slim" ? "1" : "1 through 4"} out of 10`
    : `전체 10개 상품 중 ${design === "slim" ? "1번" : "1번부터 4번까지"} 표시`);
  if (design === "photo-strip") {
    for (let i = 0; i < 8; i++) await next.click();
    assert.equal(await status.textContent(), "9–10, 1–2 / 10");
    assert.equal(await status.getAttribute("aria-label"), language === "en" ? "Showing products 9 through 10, then 1 through 2 out of 10" : "전체 10개 상품 중 9번부터 10번까지, 이어서 1번부터 2번까지 표시");
    await next.click(); assert.equal(await status.textContent(), "10, 1–3 / 10");
  } else {
    await next.click(); assert.equal(await status.textContent(), "2 / 10");
  }
});

for (const javaScriptEnabled of [true, false]) for (const width of [960, 320]) for (let mask = 0; mask < 8; mask++) {
  const showButton = Boolean(mask & 1), showName = Boolean(mask & 2), showPrice = Boolean(mask & 4);
  test(`R2a photo options: JS=${javaScriptEnabled} width=${width} button=${showButton} name=${showName} price=${showPrice}`, async (t) => {
    const page = await pageFor(t, `?designs=photo-strip&count=${javaScriptEnabled ? 10 : 2}&showButton=${showButton}&showName=${showName}&showPrice=${showPrice}&showDiscount=${mask === 7}`, { javaScriptEnabled });
    await page.locator(".host").evaluate((h, w) => h.style.width = `${w}px`, width);
    const root = page.locator("[data-wlpb-root]");
    if (javaScriptEnabled) await page.waitForFunction((n) => document.querySelectorAll("li:not([hidden])").length === n, width === 960 ? 4 : 1);
    assert.equal(await root.locator("a a").count(), 0);
    assert.equal(await root.locator(".wlpb-v1-name").count(), showName ? (javaScriptEnabled ? 10 : 2) : 0);
    assert.equal(await root.locator(".wlpb-v1-prices").count(), showPrice ? (javaScriptEnabled ? 10 : 2) : 0);
    assert.equal(await root.locator("[data-wlpb-cta]").count(), showButton ? (javaScriptEnabled ? 10 : 2) : 0);
    // In no-JS mode, scroll each original into the list's client area before checking it.
    const items = root.locator("li:not([hidden])");
    for (let i = 0; i < await items.count(); i++) {
      const item = items.nth(i); await item.scrollIntoViewIfNeeded();
      const geometry = await item.evaluate((li) => {
        const r = li.closest<HTMLElement>("[data-wlpb-root]")!, ul = li.parentElement!, footer = r.querySelector("footer")!, source = r.querySelector(".wlpb-v1-source")!;
        const client = (el: HTMLElement) => { const b = el.getBoundingClientRect(); return { left: b.left + el.clientLeft, top: b.top + el.clientTop, right: b.left + el.clientLeft + el.clientWidth, bottom: b.top + el.clientTop + el.clientHeight }; };
        const rootBox = client(r), listBox = client(ul), footerTop = footer.getBoundingClientRect().top, sourceTop = source.getBoundingClientRect().top;
        const nodes = [...li.querySelectorAll<HTMLElement>(".wlpb-v1-photo,.wlpb-v1-name,.wlpb-v1-prices > *, .wlpb-v1-discount,[data-wlpb-cta]")].map((el) => {
          const b = el.getBoundingClientRect(), inside = (box: typeof rootBox) => b.left >= box.left - 1 && b.top >= box.top - 1 && b.right <= box.right + 1 && b.bottom <= box.bottom + 1;
          return { kind: el.className, top: b.top, bottom: b.bottom, insideRoot: inside(rootBox), insideList: inside(listBox), aboveFooter: b.bottom <= footerTop && b.bottom <= sourceTop,
            hit: !el.hasAttribute("data-wlpb-cta") || el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) };
        });
        return { rootBox, listBox, footerTop, sourceTop, clientHeight: ul.clientHeight, scrollHeight: ul.scrollHeight, nodes };
      });
      optionGeometry.push({ javaScriptEnabled, width, mask, item: i, ...geometry });
      for (const node of geometry.nodes) assert.ok(node.insideRoot && node.insideList && node.aboveFooter && node.hit, JSON.stringify({ javaScriptEnabled, width, mask, item: i, ...geometry }));
      if (showButton) {
        const cta = item.locator("[data-wlpb-cta]");
        if (javaScriptEnabled) {
          // Prevent navigation while verifying a real pointer click reaches this sibling anchor.
          await cta.evaluate((a) => a.addEventListener("click", (event) => { event.preventDefault(); a.setAttribute("data-test-clicked", "true"); }));
          await cta.click(); assert.equal(await cta.getAttribute("data-test-clicked"), "true");
        } else {
          // No-JS cannot execute an event probe. Fulfill the synthetic destination locally.
          const destination = new URL((await cta.getAttribute("href"))!).href;
          await page.context().route(destination, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic product</title>" }));
          const opened = page.waitForEvent("popup"); await cta.click(); const popup = await opened;
          await popup.waitForLoadState(); assert.equal(popup.url(), destination);
          await popup.close(); await page.context().unroute(destination);
        }
      }
    }
    if (javaScriptEnabled && mask === 7) await root.screenshot({ path: `${shotDir}/photo-strip-${width}-options-on.png` });
  });
}

for (const design of ["photo-strip", "product-card", "slim"]) for (const width of [960, 320]) {
  test(`R2a autoplay capture: ${design} width=${width}`, async (t) => {
    const page = await pageFor(t, `?designs=${design}&auto=true`, {}, true);
    await page.locator(".host").evaluate((h, w) => h.style.width = `${w}px`, width);
    const root = page.locator("[data-wlpb-root]"); await playing(page, true);
    const pause = root.getByRole("button", { name: "일시정지", exact: true }); assert.equal(await pause.isVisible(), true);
    const initial = await visible(page); await page.clock.runFor(2100);
    assert.notDeepEqual(await visible(page), initial); await playing(page, true);
    assert.equal(await pause.isVisible(), true);
    await root.screenshot({ path: `${shotDir}/${design}-${width}-autoplay-on.png` });
  });
}

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
