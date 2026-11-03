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

for (const lang of ["ko", "en"]) for (const width of [1440, 390]) test(`P3 ${lang} ${width}px pin gestures and focus modality`, async t => {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "light", reducedMotion: "reduce" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return ["data:", "blob:"].includes(u.protocol) || u.origin === new URL(base).origin ? route.continue() : route.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const recordRuntime = watchRuntime(page, path.join(output, `p3-${lang}-${width}`));
  try {
    await page.goto(`${base}/${lang}/tools/timezone-calculator/`, { waitUntil: "domcontentloaded" });
    const lagos = page.getByTestId("timezone-map-pin").and(page.getByRole("button", { name: /^(라고스|Lagos),/ }));
    await lagos.waitFor();
    await page.locator('input[type=date]').fill("2026-01-15"); await page.locator('input[type=time]').fill("18:00");
    const svg = page.getByTestId("timezone-world-map").locator('svg[role="img"]');
    const transform = () => svg.locator('g[transform]').first().getAttribute("transform");
    const center = () => lagos.evaluate(el => { const p = new DOMPoint(0, -8).matrixTransform(el.getScreenCTM()); return { x: p.x, y: p.y }; });
    for (const zoom of [1, 3]) {
      if (zoom === 3) for (let i = 0; i < 4; i++) await page.getByRole("button", { name: names[lang].zoom, exact: true }).click();
      await svg.scrollIntoViewIfNeeded(); await settle(page);
      await t.test(`${zoom * 100}% pin drag out and back does not click; pin drag pans`, async () => {
        const start = await center(), initialPan = await transform(), initialSelection = await lagos.getAttribute("aria-pressed");
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        let middlePan;
        try {
          await page.mouse.move(start.x + 80, start.y + 15, { steps: 12 }); await settle(page);
          middlePan = await transform();
          await page.mouse.move(start.x, start.y, { steps: 12 });
        } finally { await page.mouse.up(); }
        await settle(page);
        if (zoom > 1) assert.notEqual(middlePan, initialPan, "Dragging from a pin must pan once the threshold is exceeded");
        assert.equal(await lagos.getAttribute("aria-pressed"), initialSelection, "An out-and-back drag must not toggle its starting pin");
        assert.equal(await transform(), initialPan);
        await page.screenshot({ path: path.join(output, `p3-${lang}-${width}-${zoom}-drag.png`) });
      });
      if (await lagos.getAttribute("aria-pressed") === "true") await lagos.dispatchEvent("click", { bubbles: true, detail: 0 });
      await t.test(`${zoom * 100}% following tap and sub-threshold motion still select`, async () => {
        const start = await center(); await page.mouse.click(start.x, start.y);
        assert.equal(await lagos.getAttribute("aria-pressed"), "true", "A previous drag must not swallow the next tap");
        await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 2, start.y + 1); await page.mouse.up();
        assert.equal(await lagos.getAttribute("aria-pressed"), "false", "Small hand movement is still a click");
      });
      await t.test(`${zoom * 100}% pointer focus clears its label; keyboard focus retains it`, async () => {
        const label = page.getByTestId("timezone-map-label").filter({ hasText: /^(라고스|Lagos) / });
        await page.mouse.move(0, 0); await label.waitFor({ state: "hidden" });
        assert.equal(await lagos.evaluate(el => el.matches(":focus-visible")), false);
        await lagos.press("Tab"); await page.keyboard.press("Shift+Tab"); await label.waitFor();
        assert.equal(await lagos.evaluate(el => el.matches(":focus-visible")), true);
        await lagos.press("Enter"); await lagos.press("Space"); assert.equal(await lagos.getAttribute("aria-pressed"), "false");
        await lagos.dispatchEvent("click", { bubbles: true, detail: 0 }); assert.equal(await lagos.getAttribute("aria-pressed"), "true");
        await lagos.dispatchEvent("click", { bubbles: true, detail: 0 }); assert.equal(await lagos.getAttribute("aria-pressed"), "false");
        await page.screenshot({ path: path.join(output, `p3-${lang}-${width}-${zoom}-keyboard.png`) });
      });
    }
    for (const [cluster, baseCity, ids] of [
      ["europe", "london", ["london", "paris", "berlin", "amsterdam", "madrid", "rome"]],
      ["east-asia", "seoul", ["seoul", "tokyo", "beijing", "hong-kong", "taipei", "manila"]],
    ]) await t.test(`dense ${cluster}: no leader-pin or leader-leader intersections`, async () => {
      await page.getByTestId("timezone-map-controls").getByRole("button").last().click();
      await page.getByTestId("timezone-base-city").selectOption(baseCity);
      for (const p of await page.getByTestId("timezone-map-pin").all()) {
        if (await p.getAttribute("aria-pressed") === "true" && !ids.includes(await p.getAttribute("data-city"))) { await p.focus(); await p.press("Enter"); }
      }
      for (const id of ids) { const p = page.getByTestId("timezone-map-pin").and(page.locator(`[data-city="${id}"]`)); if (await p.getAttribute("aria-pressed") !== "true") { await p.focus(); await p.press("Enter"); } }
      for (const zoom of [1, 1.5, 3]) {
        if (zoom === 1.5) await page.getByRole("button", { name: names[lang].zoom, exact: true }).click();
        if (zoom === 3) for (let i = 0; i < 3; i++) await page.getByRole("button", { name: names[lang].zoom, exact: true }).click();
        await svg.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); await settle(page);
        const geometry = await leaderGeometry(page);
        const stem = `leaders-${cluster}-${lang}-${width}-${zoom}`;
        await fs.writeFile(path.join(output, stem + ".json"), JSON.stringify(geometry, null, 2));
        await page.screenshot({ path: path.join(output, stem + ".png") });
        assert.equal(geometry.labels.length, 6); assertLayout(geometry);
        if (process.env.TZMAP_MEASURE_ONLY !== "1") {
          assert.equal(geometry.pinIntersections, 0, "Every visible leader segment avoids every other pin, including its start");
          assert.equal(geometry.leaderIntersections, 0, "Leader paths do not cross or touch each other");
        }
      }
    });
  } finally { await recordRuntime(); await context.close(); }
});
after(async () => { await browser?.close(); await server?.close(); console.log(`Timezone map evidence: ${output}`); });

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function watchRuntime(page, prefix) {
  const errors = [];
  page.on("pageerror", error => errors.push({ error: error.message }));
  page.on("requestfailed", request => { if (request.url().startsWith(base)) errors.push({ url: request.url(), error: request.failure() }); });
  return async () => {
    const pins = await page.getByTestId("timezone-map-pin").count();
    await fs.writeFile(prefix + "-runtime.json", JSON.stringify({ url: page.url(), pins, errors }, null, 2));
    if (!pins || errors.length) await page.screenshot({ path: prefix + "-runtime.png" });
  };
}
async function leaderGeometry(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="timezone-world-map"] svg[role="img"]'), bounds = svg.getBoundingClientRect();
    const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
    const distance = (p, a, b) => { const dx = b.x-a.x, dy = b.y-a.y, t = dx || dy ? Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))) : 0; return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2; };
    const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const intersects = (a,b,c,d) => cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0 || Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))<1e-8;
    const clip = (a,b) => {
      let lo=0,hi=1; const dx=b.x-a.x,dy=b.y-a.y;
      for (const [p,q] of [[-dx,a.x],[dx,w-a.x],[-dy,a.y],[dy,h-a.y]]) { if (!p) { if(q<0)return null;continue; } const t=q/p; if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t); if(lo>hi)return null; }
      return [{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}];
    };
    const pins = [...svg.querySelectorAll('[data-testid="timezone-map-pin"]')].map(el => { const m=el.transform.baseVal.consolidate().matrix;return {id:el.getAttribute("data-city"),x:m.e,y:m.f-10}; });
    const labels=[],routes=[];
    for(const el of svg.querySelectorAll('[data-testid="timezone-map-label"]')) {
      const id=el.getAttribute("data-city"),r=el.getBoundingClientRect(),shape=el.parentElement.querySelector("polyline,line");
      const points=shape.tagName.toLowerCase()==="line" ? [{x:Number(shape.getAttribute("x1")),y:Number(shape.getAttribute("y1"))},{x:Number(shape.getAttribute("x2")),y:Number(shape.getAttribute("y2"))}] : [...shape.points].map(p=>({x:p.x,y:p.y}));
      const segments=points.slice(1).map((p,i)=>clip(points[i],p)).filter(s=>s && Math.hypot(s[0].x-s[1].x,s[0].y-s[1].y)>.01);
      routes.push({id,points,segments}); labels.push({id,x:r.x-bounds.x,y:r.y-bounds.y,w:r.width,h:r.height});
    }
    const pinHits=[],lineHits=[];
    for(const route of routes)for(const pin of pins)if(pin.id!==route.id && route.segments.some(([a,b])=>distance(pin,a,b)<81-1e-6))pinHits.push([route.id,pin.id]);
    for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)if(routes[i].segments.some(([a,b])=>routes[j].segments.some(([c,d])=>intersects(a,b,c,d))))lineHits.push([routes[i].id,routes[j].id]);
    return {viewport:{w:bounds.width,h:bounds.height},labels,routes,pinIntersections:pinHits.length,leaderIntersections:lineHits.length,pinHits,lineHits};
  });
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
  const recordRuntime = watchRuntime(page, prefix);
  try {
    await page.goto(`${base}/${lang}/tools/timezone-calculator/`, { waitUntil: "domcontentloaded" });
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
  } finally { await recordRuntime(); await context.close(); }
});
