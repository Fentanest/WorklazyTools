import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, firefox, webkit, type Browser, type Frame } from "playwright";
import { exportBanner } from "../../src/features/product-banner/exporter.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS } from "../../src/features/product-banner/stateTypes.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime, buildHeightParentRuntime } from "../../scripts/product-banner-runtime.mjs";
import { startRecoveryServer } from "../recovery-server.mjs";

const engine = process.env.PB_MATRIX_ENGINE || "chromium";
const dir = process.env.PB_MATRIX_RESULT_DIR!;
const captures: string[] = [], measurements: object[] = [];
let browser: Browser, server: Awaited<ReturnType<typeof startRecoveryServer>>;
const runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
before(async () => {
  assert.ok(dir?.startsWith(process.env.PB_JOB_ROOT!));
  await mkdir(`${dir}/shots`, { recursive: false });
  server = await startRecoveryServer({ root: process.env.PB_DIST, port: 0 });
  browser = await ({ chromium, firefox, webkit }[engine]!).launch();
  console.log(`Matrix engine ${engine} ${browser.version()}`);
});
after(async () => {
  await browser?.close(); await server?.close();
  await writeFile(`${dir}/geometry.json`, JSON.stringify({ engine, measurements }, null, 2));
  await writeFile(`${dir}/shots/MANIFEST.sha256`, (await Promise.all(captures.map(async (name) =>
    `${createHash("sha256").update(await readFile(`${dir}/shots/${name}`)).digest("hex")}  ${name}\n`))).join(""));
});
async function checkGeometry(frame: Frame) {
  return frame.locator("[data-wlpb-root]").evaluate((root) => {
    const r = root.getBoundingClientRect(), list = root.querySelector("ul")?.getBoundingClientRect();
    const footer = root.querySelector("footer")?.getBoundingClientRect();
    const source = root.querySelector(".wlpb-v1-source")?.getBoundingClientRect();
    return { overflow: root.scrollWidth > root.clientWidth + 1,
      footerSeparate: !list || !footer || footer.top >= list.bottom - 1,
      footerFits: !footer || (footer.left >= r.left - 1 && footer.right <= r.right + 1 && footer.bottom <= r.bottom + 1),
      sourceFits: !source || (source.left >= r.left - 1 && source.right <= r.right + 1 && source.bottom <= r.bottom + 1) };
  });
}
// Chromium covers all 640 count/width/theme/output cells. Installed secondary
// engines cover all ten outputs at mobile/wide widths, both themes and all counts.
const widths = engine === "chromium" ? [320, 375, 768, 1440] : [320, 1440];
for (const design of DESIGN_IDS) for (const format of ["html", "iframe"] as const)
for (const width of widths) for (const theme of ["light", "dark"] as const) {
  test(`T6b matrix ${design} ${format} ${width} ${theme}`, async () => {
    const context = await browser.newContext({ viewport: { width: width + 32, height: 1100 } });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors: string[] = [], denied: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === server.url) return route.continue();
      if (url.hostname === "example.com" && url.pathname.startsWith("/img/"))
        return route.fulfill({ body: image, contentType: "image/svg+xml" });
      denied.push(route.request().resourceType()); return route.abort();
    });
    try {
      await page.goto(server.url);
      for (const count of [0, 1, 2, 3, 4, 5, 7, 10]) {
        const project = stateWith(count).project;
        project.settings = { ...createDefaultSettings("en", design), theme, autoPlay: false, moveBy: "page" };
        const output = exportBanner(project, runtime);
        await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;background:${theme === "dark" ? "#172033" : "#e7ebf0"}}.host{width:${width}px}</style><div class="host">${output[format]}</div>`);
        const frame = format === "html" ? page.mainFrame() : (await (await page.locator("iframe[data-wlpb-frame]").elementHandle())!.contentFrame())!;
        const root = frame.locator("[data-wlpb-root]"); await root.waitFor();
        await frame.waitForFunction(() => document.querySelector("[data-wlpb-root]")?.getAttribute("data-wlpb-ready") === "true");
        assert.equal(await root.locator("li").count(), count);
        const rawLinks = await root.locator("li").evaluateAll((nodes) => nodes.map((node) => node.querySelector("a")?.getAttribute("href")));
        assert.deepEqual(rawLinks, project.products.map((p) => p.promotionUrl));
        assert.equal(await root.locator('.wlpb-v1-source').getAttribute("href"), "https://worklazy.net/en/tools/product-banner/");
        const geometry = await checkGeometry(frame);
        measurements.push({ design, format, width, theme, count, ...geometry });
        assert.deepEqual(geometry, { overflow: false, footerSeparate: true, footerFits: true, sourceFits: true });
        const accessed = new Set<string>();
        for (let i = 0; i <= count; i++) {
          for (const index of await root.locator("li:not([hidden])").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-wlpb-index")!))) accessed.add(index);
          const next = root.getByRole("button", { name: "Next products", exact: true });
          if (await next.isVisible()) await next.click(); else break;
        }
        assert.equal(accessed.size, count, "every product reachable, including page-step remainder");
        if (engine === "chromium" && format === "html" && count === 5) {
          const name = `${design}-${width}-${theme}.png`;
          await root.screenshot({ path: `${dir}/shots/${name}` }); captures.push(name);
        }
      }
      assert.deepEqual(errors, []); assert.deepEqual(denied, [], "no non-image external attempt");
    } finally { await context.close(); }
  });
}
for (const design of DESIGN_IDS) for (const format of ["html", "iframe"] as const)
test(`T6b zoom200 ${design} ${format}`, async () => {
  const context = await browser.newContext({ viewport: { width: 640, height: 1600 } });
  try {
    await context.route("**/*", (r) => r.request().resourceType() === "image"
      ? r.fulfill({ body: image, contentType: "image/svg+xml" }) : r.abort());
    const page = await context.newPage(), project = stateWith(5).project;
    project.settings = { ...createDefaultSettings("en", design), autoPlay: false };
    await page.setContent(`<style>body{margin:0}.host{width:320px;zoom:2}</style><div class="host">${exportBanner(project, runtime)[format]}</div>`);
    const frame = format === "html" ? page.mainFrame() : (await (await page.locator("iframe").elementHandle())!.contentFrame())!;
    await frame.waitForFunction(() => document.querySelector("[data-wlpb-root]")?.getAttribute("data-wlpb-ready") === "true");
    assert.deepEqual(await checkGeometry(frame), { overflow: false, footerSeparate: true, footerFits: true, sourceFits: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const name = `${design}-${format}-zoom200.png`; await page.screenshot({ path: `${dir}/shots/${name}`, fullPage: true }); captures.push(name);
  } finally { await context.close(); }
});
