import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Browser } from "playwright";
import { PNG } from "pngjs";
import { exportBanner } from "../../src/features/product-banner/exporter.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import type { DesignId } from "../../src/features/product-banner/stateTypes.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime, buildHeightParentRuntime } from "../../scripts/product-banner-runtime.mjs";

const shots = process.env.PB_BANNERAUTO_SHOT_DIR || "docs/jobs/todo/banner-auto-20261018/shots-browser";
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
const runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
let browser: Browser;
before(async () => { browser = await chromium.launch(); await mkdir(shots, { recursive: true }); });
after(async () => { await browser?.close(); });

async function hosted(t: test.TestContext, html: string, colorScheme: "light" | "dark" = "light") {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 }, colorScheme });
  t.after(() => context.close());
  const external: string[] = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "example.com" && url.pathname.startsWith("/img/")) return route.fulfill({ contentType: "image/svg+xml", body: image });
    if (route.request().url().startsWith("about:")) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setContent(html);
  await page.mouse.move(1099, 1);
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(external, [], "external network attempts"); });
  return page;
}

test("vertical/grid autoplay advances one screen and pause stops it", async (t) => {
  const details: object[] = [];
  for (const design of ["vertical", "grid"] as const satisfies DesignId[]) {
    const project = { ...stateWith(8).project, settings: { ...createDefaultSettings("ko", design), intervalSeconds: 2, autoHeight: false } };
    assert.equal(project.settings.autoPlay, true);
    const output = exportBanner(project, runtime);
    assert.ok(output.html.includes('data-wlpb-auto="true"'));
    const page = await hosted(t, `<!doctype html><html><head><meta charset="utf-8"></head><body>${output.iframe}</body></html>`);
    const frame = await (await page.locator("iframe[data-wlpb-frame]").elementHandle())!.contentFrame();
    assert.ok(frame);
    await frame!.locator('[data-wlpb-ready="true"]').waitFor();
    const root = frame!.locator("[data-wlpb-root]");
    assert.equal(await root.getAttribute("data-wlpb-auto"), "true");
    // Poll instead of waitForFunction: the srcdoc commit can race a fresh wait.
    const waitPlaying = async (value: string) => {
      for (let i = 0; i < 70; i++) {
        const playing = await root.evaluate((r) => (r as HTMLElement).dataset.wlpbPlaying).catch(() => undefined);
        if (playing === value) return;
        await frame!.waitForTimeout(500);
      }
      throw new Error(`playing never settled ${value}`);
    };
    await waitPlaying("true");
    const pause = root.getByRole("button", { name: "일시정지", exact: true });
    assert.equal(await pause.isVisible(), true);
    const before = await root.locator(".wlpb-v1-status").textContent();
    await frame!.waitForFunction((previous) => (document.querySelector(".wlpb-v1-status")?.textContent ?? previous) !== previous, before, { timeout: 8000 });
    const after = await root.locator(".wlpb-v1-status").textContent();
    assert.notEqual(after, before);
    await pause.click();
    const paused = root.locator('[data-wlpb-action="pause"]');
    assert.equal(await paused.getAttribute("aria-pressed"), "true");
    await waitPlaying("false");
    const frozen = await root.locator(".wlpb-v1-status").textContent();
    await frame!.waitForTimeout(2600);
    assert.equal(await root.locator(".wlpb-v1-status").textContent(), frozen);
    details.push({ design, before, after, frozen });
    await page.close();
  }
  await writeFile(`${shots}/autoplay.json`, JSON.stringify(details, null, 2));
});

test("exported iframe corners stay transparent on light and dark parents", async (t) => {
  const parents = [
    { scheme: "dark", background: "#0e1526" },
    { scheme: "light", background: "#dbe4f0" },
  ] as const;
  const details: object[] = [];
  for (const parent of parents) for (const theme of ["auto", "light", "dark"] as const) {
    const project = { ...stateWith(4).project,
      settings: { ...createDefaultSettings("ko", "vertical"), theme, autoPlay: false, autoHeight: false, intervalSeconds: 60 } };
    const output = exportBanner(project, runtime);
    const page = await hosted(t,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><style>:root{color-scheme:${parent.scheme}}html,body{margin:0;background:${parent.background}}body{padding:40px}</style></head><body>${output.iframe}</body></html>`,
      parent.scheme);
    const frame = await (await page.locator("iframe[data-wlpb-frame]").elementHandle())!.contentFrame();
    assert.ok(frame);
    await frame!.locator('[data-wlpb-ready="true"]').waitFor();
    await frame!.waitForTimeout(300);
    const shot = await page.locator("iframe[data-wlpb-frame]").screenshot();
    const png = PNG.sync.read(shot);
    const at = (x: number, y: number) => { const i = (y * png.width + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
    const expected = [1, 3, 5].map((i) => parseInt(parent.background.slice(i, i + 2), 16));
    const corner = at(2, 2);
    const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 8);
    await writeFile(`${shots}/corner-${parent.scheme}-${theme}.png`, shot);
    assert.ok(!near(corner, [255, 255, 255]), `${parent.scheme}/${theme}: corner must not be opaque white, got rgb(${corner})`);
    assert.ok(near(corner, expected), `${parent.scheme}/${theme}: corner rgb(${corner}) must match parent ${parent.background}`);
    details.push({ parent: parent.scheme, theme, corner, expected });
    await page.close();
  }
  await writeFile(`${shots}/corners.json`, JSON.stringify(details, null, 2));
});
