import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderBanner, bannerLabels } from "../../src/features/product-banner/render.ts";
import { createDisplayModel } from "../../src/features/product-banner/displayModel.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS } from "../../src/features/product-banner/stateTypes.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { advanceIndex, canPlay, windowIndices, type Playback } from "../../src/features/product-banner/rotation.ts";
import { buildBannerRuntime, productBannerRuntimePlugin } from "../../scripts/product-banner-runtime.mjs";
import { createServer, build } from "vite";

for (const design of DESIGN_IDS) test(`${design}: all ordered products, distinct layout, safe links, footer and validated settings`, () => {
  const project = stateWith(7).project, settings = createDefaultSettings("ko", design);
  const model = createDisplayModel({ ...project, settings }), { markup, css } = renderBanner(model);
  const dom = new JSDOM(markup), d = dom.window.document;
  assert.equal(d.querySelectorAll("li").length, 7);
  assert.deepEqual([...d.querySelectorAll("li")].map((p) => p.getAttribute("data-wlpb-index")), ["0", "1", "2", "3", "4", "5", "6"]);
  assert.ok(d.querySelector(`.wlpb-v1-${design}`));
  for (const [i, item] of [...d.querySelectorAll("li")].entries()) {
    assert.equal(item.querySelector("img")!.getAttribute("src"), model.products[i].imageUrl);
    assert.equal(item.querySelector("a")!.getAttribute("href"), model.products[i].promotionUrl);
    assert.equal(item.querySelector("a")!.getAttribute("target"), "_blank");
    assert.equal(item.querySelector("a")!.getAttribute("rel"), "sponsored noopener");
    assert.equal(item.querySelector("img")!.hasAttribute("crossorigin"), false);
  }
  const source = d.querySelector("footer a")!;
  assert.equal(source.getAttribute("href"), "https://worklazy.net/ko/tools/product-banner/");
  assert.equal(source.getAttribute("rel"), "nofollow noopener"); assert.equal(source.getAttribute("target"), "_blank");
  assert.equal(source.textContent, bannerLabels.ko.source); assert.equal(source.getAttribute("title"), bannerLabels.ko.credit);
  assert.equal(d.querySelector(".wlpb-v1-ad")!.textContent, "광고");
  assert.equal(d.querySelector(".wlpb-v1-notice")!.textContent, settings.affiliateNotice);
  assert.equal(d.querySelectorAll("[id], a a, script, iframe, .wlpb-v1-prices").length, 0);
  assert.equal(d.querySelectorAll(".wlpb-v1-name").length, design === "photo-strip" ? 0 : 7);
  assert.ok(css.includes("object-fit:contain")); assert.ok(css.includes("@container"));
  assert.doesNotMatch(css, /(?:^|[},])\s*(?:body|a|img|button)[\s{,:]/u);
  dom.window.close();
});
test("text/attribute injection remains text; price, discount, optional CTA and English credit stay separate", () => {
  const project = stateWith(2).project, settings = { ...createDefaultSettings("en", "product-card"), showPrice: true, showDiscount: true, showButton: true, affiliateNotice: '</style><script>alert("x")</script>' };
  const model = createDisplayModel({ ...project, settings, products: project.products.map((p) => ({ ...p, name: '<img onerror="alert(1)"> & 😀' })) });
  const dom = new JSDOM(renderBanner(model).markup), d = dom.window.document;
  assert.equal(d.querySelectorAll("script, [onerror], a a").length, 0);
  assert.equal(d.querySelectorAll(".wlpb-v1-name")[0].textContent, model.products[0].name);
  assert.equal(d.querySelectorAll("[data-wlpb-cta]").length, 2);
  assert.equal(d.querySelectorAll(".wlpb-v1-prices").length, 2); assert.equal(d.querySelectorAll(".wlpb-v1-discount").length, 2);
  assert.equal(d.querySelector(".wlpb-v1-source")!.getAttribute("href"), "https://worklazy.net/en/tools/product-banner/");
  assert.equal(d.querySelector(".wlpb-v1-ad")!.textContent, "Ad"); dom.window.close();
});
test("renderer rejects invalid settings/URLs and never adds empty or duplicate products", () => {
  const model = createDisplayModel(stateWith(1).project);
  assert.throws(() => renderBanner({ ...model, settings: { ...model.settings, intervalSeconds: 0 } }));
  assert.throws(() => renderBanner({ ...model, products: [{ ...model.products[0], promotionUrl: "javascript:alert(1)" }] }));
  for (const n of [0, 1, 2, 3, 4, 5, 7, 10]) {
    const dom = new JSDOM(renderBanner(createDisplayModel(stateWith(n).project)).markup);
    assert.equal(dom.window.document.querySelectorAll("li").length, n); dom.window.close();
  }
});
for (const language of ["ko", "en"] as const) test(`price markup preserves source decimal digits: ${language}`, () => {
  const project = stateWith(1).project;
  const dom = new JSDOM(renderBanner(createDisplayModel({ ...project, settings: { ...project.settings, language, showPrice: true } })).markup);
  assert.equal(dom.window.document.querySelector(".wlpb-v1-prices strong")!.textContent, "USD 206.50");
  assert.equal(dom.window.document.querySelector(".wlpb-v1-prices span")!.textContent, "USD 282.87");
  dom.window.close();
});
test("one-step and page-step wrap retain source order with no padding/duplicates", () => {
  assert.deepEqual(windowIndices(10, 4, 0), [0, 1, 2, 3]);
  for (let start = 0; start < 10; start++) assert.deepEqual(windowIndices(10, 4, start), [0, 1, 2, 3].map((i) => (start + i) % 10));
  assert.deepEqual(windowIndices(10, 4, 8), [8, 9, 0, 1]); assert.equal(advanceIndex(10, 8, 4), 2);
  assert.equal(advanceIndex(10, 0, -1), 9); assert.deepEqual(windowIndices(2, 4, 1), [1, 0]); assert.deepEqual(windowIndices(0, 4, 0), []);
});
test("playback requires every transient gate; clearing gates preserves explicit pause and reduced motion", () => {
  const active: Playback = { enabled: true, paused: false, reduced: false, hover: false, focus: false, visible: true, background: false };
  assert.equal(canPlay(active, 10, 4), true); assert.equal(canPlay(active, 4, 4), false); assert.equal(canPlay(active, 0, 4), false);
  for (const patch of [{ enabled: false }, { paused: true }, { reduced: true }, { hover: true }, { focus: true }, { visible: false }, { background: true }]) assert.equal(canPlay({ ...active, ...patch }, 10, 4), false);
  assert.equal(canPlay({ ...active, paused: true, hover: false, focus: false }, 10, 4), false);
});
test("one deterministic IIFE builder supplies Vite dev/build and Node without forbidden runtime dependencies", async () => {
  const runtime = await buildBannerRuntime(), plugin = productBannerRuntimePlugin();
  assert.equal(runtime, await buildBannerRuntime()); assert.ok(runtime.startsWith("(()=>{"));
  assert.doesNotMatch(runtime, /react|xlsx|gtag|adsbygoogle|coupang|import\s*\(|\bimport\s|https?:|fetch\s*\(|XMLHttpRequest|sendBeacon/iu);
  const id = plugin.resolveId("virtual:product-banner-runtime"), watched: string[] = [];
  const module = await plugin.load.call({ addWatchFile: (path: string) => watched.push(path) }, id);
  assert.equal(module, `export default ${JSON.stringify(runtime)};`); assert.equal(watched.length, 3);
});
test("actual Vite dev transform and production bundle supply the same runtime bytes as Node", async () => {
  const plugin = productBannerRuntimePlugin(), source = await buildBannerRuntime();
  const server = await createServer({ cacheDir: process.env.XDG_CACHE_HOME ? `${process.env.XDG_CACHE_HOME}/vite-unit` : undefined, configFile: false, plugins: [plugin], server: { middlewareMode: true }, logLevel: "silent" });
  try {
    const dev = await server.transformRequest("virtual:product-banner-runtime");
    assert.ok(dev?.code.includes(JSON.stringify(source)));
  } finally { await server.close(); }
  const result: any = await build({ cacheDir: process.env.XDG_CACHE_HOME ? `${process.env.XDG_CACHE_HOME}/vite-unit` : undefined, configFile: false, plugins: [plugin], logLevel: "silent", build: { write: false, minify: false,
    rollupOptions: { input: "virtual:product-banner-runtime", preserveEntrySignatures: "strict" } } });
  const module = await import(`data:text/javascript,${encodeURIComponent(result.output[0].code)}`);
  assert.equal(module.default, source);
});
