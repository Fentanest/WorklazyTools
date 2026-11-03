import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { startRecoveryServer } from "./recovery-server.mjs";

const output = process.env.TZMAP_OUTPUT || await fs.mkdtemp("/tmp/worklazy-tzmap-smoke-");
const names = {
  ko: { toronto: "토론토", paris: "파리", zoom: "지도 확대", zoomOut: "지도 축소" },
  en: { toronto: "Toronto", paris: "Paris", zoom: "Zoom in", zoomOut: "Zoom out" },
};
const selected = ["seoul", "tokyo", "new-york", "toronto", "london", "paris"];
let browser, server, base;
before(async () => {
  await fs.mkdir(output, { recursive: true });
  if (!process.env.TEST_BASE_URL) server = await startRecoveryServer({ root: "dist" });
  base = process.env.TEST_BASE_URL || server.url;
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
});
after(async () => { await browser?.close(); await server?.close(); console.log(`Timezone map evidence: ${output}`); });

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function pin(page, id) {
  const ids = { seoul: ["서울", "Seoul"], tokyo: ["도쿄", "Tokyo"], "new-york": ["뉴욕", "New York"], toronto: ["토론토", "Toronto"], london: ["런던", "London"], paris: ["파리", "Paris"] };
  return page.getByTestId("timezone-map-pin").and(page.getByRole("button", { name: new RegExp(`^(?:${ids[id].join("|")}),`) }));
}
async function boxes(page) {
  return page.evaluate((ids) => {
    const svg = document.querySelector('[data-testid="timezone-world-map"] svg[role="img"]');
    const r = svg.getBoundingClientRect();
    const rect = e => { const b = e.getBoundingClientRect(); return { x: b.x - r.x, y: b.y - r.y, w: b.width, h: b.height }; };
    const aliases = { seoul: "서울|Seoul", tokyo: "도쿄|Tokyo", "new-york": "뉴욕|New York", toronto: "토론토|Toronto", london: "런던|London", paris: "파리|Paris" };
    return { viewport: { w: r.width, h: r.height }, labels: ids.map(id => {
      const fixed = document.querySelector(`[data-testid="timezone-map-label"][data-city="${id}"]`);
      const original = [...document.querySelectorAll('[data-testid="timezone-map-pin"]')].find(e => new RegExp(`^(?:${aliases[id]}),`).test(e.getAttribute("aria-label"))).querySelector("text");
      const el = fixed || original;
      return { id, text: el.textContent, ...rect(el) };
    }) };
  }, selected);
}
function assertLayout(result) {
  for (const r of result.labels) {
    assert.ok(r.w > 0 && r.h > 0, `Label is measurable: ${r.id}`);
    assert.ok(r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= result.viewport.w + 0.5 && r.y + r.h <= result.viewport.h + 0.5, `Label stays inside map: ${JSON.stringify(r)}`);
  }
  for (let i = 0; i < result.labels.length; i++) for (let j = i + 1; j < result.labels.length; j++) {
    const a = result.labels[i], b = result.labels[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `Labels overlap: ${a.id} / ${b.id}`);
  }
}

for (const lang of ["ko", "en"]) for (const width of [1440, 620, 390, 320]) test(`${lang} ${width}px nearby labels, pointer, keyboard and zoom`, async t => {
  const context = await browser.newContext({ viewport: { width, height: width > 620 ? 900 : 844 }, colorScheme: "light", reducedMotion: "reduce" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return ["data:", "blob:"].includes(u.protocol) || u.origin === new URL(base).origin ? route.continue() : route.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const prefix = path.join(output, `${lang}-${width}`);
  try {
    await page.goto(`${base}/${lang}/tools/timezone-calculator/`);
    await page.getByTestId("timezone-map-pin").first().waitFor();
    assert.equal(await page.getByTestId("timezone-map-pin").count(), 44);
    await page.locator('input[type=date]').fill("2026-01-15");
    await page.locator('input[type=time]').fill("18:00");
    for (const name of [names[lang].toronto, names[lang].paris]) {
      const target = page.getByRole("button", { name: new RegExp(`^${name},`) }); await target.focus(); await target.press("Enter");
    }
    await page.getByTestId("timezone-world-map").scrollIntoViewIfNeeded(); await settle(page);
    await t.test("New York toggles through a real pointer, not Toronto", async () => {
      const ny = await pin(page, "new-york"), toronto = await pin(page, "toronto");
      const point = await ny.evaluate(el => { const p = new DOMPoint(0, -8).matrixTransform(el.getScreenCTM()); return { x: p.x, y: p.y }; });
      await page.mouse.click(point.x, point.y);
      const actual = { ny: await ny.getAttribute("aria-pressed"), toronto: await toronto.getAttribute("aria-pressed") };
      await fs.writeFile(prefix + "-pointer.json", JSON.stringify({ point, actual }, null, 2));
      assert.deepEqual(actual, { ny: "false", toronto: "true" });
      await page.mouse.click(point.x, point.y); assert.equal(await ny.getAttribute("aria-pressed"), "true");
    });
    // Restore any selection changed by the negative-control pointer case.
    for (const id of selected) { const target = await pin(page, id); if (await target.getAttribute("aria-pressed") !== "true") { await target.focus(); await target.press("Enter"); } }
    await t.test("Space and Enter preserve keyboard selection", async () => {
      const ny = await pin(page, "new-york"); await ny.focus(); await ny.press("Space"); assert.equal(await ny.getAttribute("aria-pressed"), "false"); await ny.press("Enter"); assert.equal(await ny.getAttribute("aria-pressed"), "true");
    });
    for (const zoom of [1, 1.5, 3]) await t.test(`nonintersecting in-bounds labels at ${zoom * 100}%`, async () => {
      if (zoom === 1.5) await page.getByRole("button", { name: names[lang].zoom, exact: true }).click();
      if (zoom === 3) for (let i = 0; i < 3; i++) await page.getByRole("button", { name: names[lang].zoom, exact: true }).click();
      await page.getByTestId("timezone-world-map").scrollIntoViewIfNeeded(); await settle(page); await page.mouse.move(0, 0);
      const result = await boxes(page); await fs.writeFile(prefix + `-${zoom}.json`, JSON.stringify(result, null, 2));
      await page.screenshot({ path: prefix + `-${zoom}.png` }); assertLayout(result);
    });
    await t.test("a partly clipped New York pin still accepts its visible edge", async () => {
      const svg = page.getByTestId("timezone-world-map").locator('svg[role="img"]'), r = await svg.boundingBox();
      const ny = await pin(page, "new-york"), toronto = await pin(page, "toronto");
      const current = await ny.evaluate(el => { const m = el.transform.baseVal.consolidate().matrix; return { x: m.e, y: m.f }; });
      const start = { x: r.x + r.width * .1, y: r.y + r.height * .25 };
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(start.x + (-4 - current.x) * r.width / 960, start.y + (60 - current.y) * r.height / 500, { steps: 10 }); await page.mouse.up(); await settle(page);
      const position = await ny.evaluate(el => { const m = el.transform.baseVal.consolidate().matrix; return { x: m.e, y: m.f }; });
      assert.ok(Math.abs(position.x + 4) < 1 && Math.abs(position.y - 60) < 1, "The pin must actually straddle the clip edge");
      const visible = await svg.boundingBox();
      const hit = { x: visible.x + 5 * visible.width / 960, y: visible.y + 52 * visible.height / 500 };
      await page.waitForFunction(p => /^(뉴욕|New York),/.test(document.elementFromPoint(p.x, p.y)?.closest('[data-testid="timezone-map-pin"]')?.getAttribute("aria-label") || ""), hit);
      const target = await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.closest('[data-testid="timezone-map-pin"]')?.getAttribute("aria-label"), hit);
      const stack = await page.evaluate(p => document.elementsFromPoint(p.x, p.y).slice(0, 5).map(e => ({ tag: e.tagName, test: e.getAttribute('data-testid'), role: e.getAttribute('role'), class: e.getAttribute('class') })), hit);
      await page.screenshot({ path: prefix + "-edge.png" });
      await fs.writeFile(prefix + "-edge-pointer.json", JSON.stringify({ position, viewport: visible, hit, target, stack }, null, 2));
      assert.match(target || "", /^(뉴욕|New York),/, "Click point must be on New York's visible hit area");
      await page.mouse.click(hit.x, hit.y);
      assert.equal(await ny.getAttribute("aria-pressed"), "false"); assert.equal(await toronto.getAttribute("aria-pressed"), "true");
      await ny.focus(); await ny.press("Enter");
    });
    await t.test("panning keeps selected labels in bounds", async () => {
      const svg = page.getByTestId("timezone-world-map").locator('svg[role="img"]'), r = await svg.boundingBox();
      const before = await svg.locator('g[transform]').first().getAttribute("transform");
      await page.mouse.move(r.x + r.width * .15, r.y + r.height * .8); await page.mouse.down(); await page.mouse.move(r.x + r.width * .3, r.y + r.height * .75, { steps: 10 }); await page.mouse.up(); await settle(page);
      assert.notEqual(await svg.locator('g[transform]').first().getAttribute("transform"), before, "Drag must actually move the map");
      assertLayout(await boxes(page));
    });
    await t.test("responsive resize and zooming back out remeasure labels", async () => {
      await page.setViewportSize({ width: width > 620 ? 390 : 1440, height: 900 });
      for (let i = 0; i < 4; i++) await page.getByRole("button", { name: names[lang].zoomOut, exact: true }).click();
      assert.equal(await page.getByTestId("timezone-map-controls").locator("output").innerText(), "100%");
      await page.getByTestId("timezone-world-map").scrollIntoViewIfNeeded(); await settle(page); assertLayout(await boxes(page));
    });
  } finally { await context.close(); }
});
