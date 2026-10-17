import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { exportBanner, assertExportRuntime, OUTPUT_LIMITS, BANNER_SANDBOX } from "../../src/features/product-banner/exporter.ts";
import { scriptJson, utf8Bytes } from "../../src/features/product-banner/serialization.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS } from "../../src/features/product-banner/stateTypes.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime, buildHeightParentRuntime, productBannerRuntimePlugin } from "../../scripts/product-banner-runtime.mjs";
import { parsePrice } from "../../src/features/product-banner/inputMapping.ts";
import { loadProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { pricePairs } from "../fixtures/product-banner/price-pairs.ts";
const runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
for (const pair of pricePairs) test(`exact price equality in HTML, iframe and standalone: ${pair.name}`, () => {
  const project = stateWith(1).project;
  const product = { ...project.products[0],
    originPrice: parsePrice({ text: pair.original, kind: "string" }),
    discountPrice: parsePrice({ text: pair.sale, kind: "string" }),
    discount: { raw: "0%", percent: 0 },
  };
  const p = { ...project, products: [product], settings: { ...project.settings, showPrice: true, showDiscount: true } };
  const output = exportBanner(p, runtime), outer = new JSDOM(output.iframe);
  assert.deepEqual(loadProjectJson(output.json), p);
  for (const html of [output.html, outer.window.document.querySelector("iframe")!.getAttribute("srcdoc")!, output.standalone]) {
    const dom = new JSDOM(html), d = dom.window.document;
    assert.equal(d.querySelector(".wlpb-v1-original")?.textContent, pair.same ? undefined : pair.original);
    assert.equal(d.querySelector(".wlpb-v1-prices strong")?.textContent, pair.sale);
    assert.equal(d.querySelectorAll(".wlpb-v1-discount").length, 0);
    dom.window.close();
  }
  outer.window.close();
});
for (const design of DESIGN_IDS) test(`export ${design}: four outputs, exact links, sandbox and byte counts`, () => {
  const p = { ...stateWith(7).project, settings: createDefaultSettings("ko", design) }, output = exportBanner(p, runtime);
  const outer = new JSDOM(output.iframe), frame = outer.window.document.querySelector("iframe")!;
  assert.equal(frame.getAttribute("sandbox"), BANNER_SANDBOX);
  assert.equal(frame.getAttribute("height"), String(output.height));
  assert.equal(frame.getAttribute("width"), "100%"); assert.equal(frame.getAttribute("loading"), "lazy");
  assert.equal(frame.style.border, "0px"); assert.equal(frame.title, "알리익스프레스 광고 배너 만들기");
  for (const html of [output.html, frame.getAttribute("srcdoc")!, output.standalone]) {
    const dom = new JSDOM(html), d = dom.window.document;
    assert.equal(d.querySelector("[data-wlpb-root]")!.getAttribute("lang"), p.settings.language);
    assert.deepEqual([...d.querySelectorAll("li a:not([data-wlpb-cta])")].map((a) => a.getAttribute("href")), p.products.map((p) => p.promotionUrl));
    assert.deepEqual([...d.querySelectorAll("li a[data-wlpb-cta]")].map((a) => a.getAttribute("href")), p.products.map((p) => p.promotionUrl));
    assert.equal(d.querySelectorAll("footer .wlpb-v1-source").length, 1);
    assert.equal(d.querySelector("footer a")!.getAttribute("rel"), "nofollow noopener");
    assert.doesNotMatch(html, /react|xlsx|gtag|googletagmanager|adsbygoogle|coupang|naver[\s._-]*wcs|<script\b[^>]*\bsrc\s*=|blob:/iu);
    dom.window.close();
  }
  assert.equal(JSON.parse(output.json).products[0].promotionUrl, p.products[0].promotionUrl);
  for (const key of ["html", "iframe", "standalone", "json"] as const) assert.equal(output.bytes[key], Buffer.byteLength(output[key]));
  assert.equal(output.productCount, 7); assert.equal(output.largeOutput, false); outer.window.close();
});
test("every serialization context keeps hostile strings as data", () => {
  const bad = `"' & < > 한글 😀\n</script><!--\u2028\u2029<img onerror="window.escaped=1"> javascript:alert(1)`;
  const p = stateWith(1).project, output = exportBanner({ ...p, products: p.products.map((p) => ({ ...p, name: bad })), settings: { ...p.settings, showName: true, affiliateNotice: bad, autoHeight: true } }, runtime);
  const outer = new JSDOM(output.iframe), dom = new JSDOM(outer.window.document.querySelector("iframe")!.getAttribute("srcdoc")!);
  assert.equal(dom.window.document.querySelector(".wlpb-v1-name")!.textContent, bad);
  assert.equal(dom.window.document.querySelector(".wlpb-v1-notice")!.textContent, bad);
  assert.equal(dom.window.document.querySelectorAll("[onerror]").length, 0);
  assert.equal(dom.window.document.querySelectorAll("script").length, 2);
  assert.doesNotMatch(scriptJson({ bad }), /[<>&\u2028\u2029]/u); assert.deepEqual(JSON.parse(scriptJson({ bad })), { bad });
  assert.equal(utf8Bytes("한글😀"), 10);
  outer.window.close(); dom.window.close();
});
test("invalid URL/CSS/height/origin/runtime is rejected rather than rewritten", () => {
  const p = stateWith(1).project;
  for (const promotionUrl of ["javascript:alert(1)", "blob:https://example.com/id", "https://user:pass@example.com/p"]) assert.throws(() => exportBanner({ ...p, products: [{ ...p.products[0], promotionUrl }] }, runtime));
  assert.throws(() => exportBanner({ ...p, settings: { ...p.settings, colors: { ...p.settings.colors, accent: "red;position:fixed" } } }, runtime));
  for (const height of [119, 2401, NaN, 1.5]) assert.throws(() => exportBanner(p, runtime, { height }));
  assert.equal(exportBanner(p, runtime, { height: 777 }).height, 777);
  for (const parentOrigin of ["null", "https://example.com/path", "http://example.com", 'https://example.com/"</script>']) assert.throws(() => exportBanner(p, runtime, { parentOrigin }));
  for (const source of ["React", "xlsx", "gtag()", "googletagmanager", "adsbygoogle", "coupang", "naver.wcs", "blob:", "</script>", "fetch('/')", "eval('x')"]) assert.throws(() => assertExportRuntime(source));
});
test("1000 products remain present; large-output reason and hard byte limit never truncate", () => {
  const p = stateWith(1000).project, output = exportBanner(p, runtime);
  assert.equal(output.productCount, 1000); assert.ok(output.largeOutput); assert.ok(output.help.large);
  assert.equal(new JSDOM(output.html).window.document.querySelectorAll("li").length, 1000);
  assert.ok(output.bytes.iframe < OUTPUT_LIMITS.bytes);
  const large = { ...p, products: p.products.map((p) => ({ ...p, name: '"'.repeat(4096) })) };
  assert.throws(() => exportBanner(large, runtime), /EXPORT_SIZE_LIMIT/u);
});
test("helper builder is deterministic and available through the Vite virtual-module supplier", async () => {
  assert.equal(await buildHeightParentRuntime(), runtime.heightParent);
  const plugin = productBannerRuntimePlugin(), id = plugin.resolveId("virtual:product-banner-height-parent");
  const source = await plugin.load.call({ addWatchFile() {} }, id);
  assert.equal(source, `export default ${JSON.stringify(runtime.heightParent)};`);
});

for (const design of ["vertical", "grid"] as const) test(`export ${design} default enables autoplay and transparent iframe document`, () => {
  const p = { ...stateWith(7).project, settings: createDefaultSettings("ko", design) };
  assert.equal(p.settings.autoPlay, true);
  const output = exportBanner(p, runtime);
  for (const html of [output.html, output.standalone]) assert.ok(html.includes('data-wlpb-auto="true"'), `${design} markup must enable autoplay`);
  const outer = new JSDOM(output.iframe), srcdoc = outer.window.document.querySelector("iframe")!.getAttribute("srcdoc")!;
  assert.ok(srcdoc.includes('data-wlpb-auto="true"'), `${design} srcdoc must enable autoplay`);
  for (const document of [srcdoc, output.standalone]) {
    assert.ok(document.includes('<meta name="color-scheme" content="light dark">'), `${design} document must declare dual color-scheme`);
    assert.ok(document.includes("html,body{background:transparent}"), `${design} document background must stay transparent`);
  }
  outer.window.close();
});
for (const language of ["ko", "en"] as const) for (const autoHeight of [true, false]) test(`iframe ${language}/${autoHeight}: only frame and optional height helper, no visitor instructions`, () => {
  const project = stateWith(2).project;
  const output = exportBanner({ ...project, settings: { ...project.settings, language, autoHeight } }, runtime);
  const dom = new JSDOM(output.iframe), d = dom.window.document;
  assert.equal(d.querySelectorAll("[data-wlpb-embed] > iframe").length, 1);
  assert.equal(d.querySelector("[data-wlpb-embed]")!.children.length, 1);
  assert.equal(d.querySelector("iframe")!.textContent, "");
  assert.equal(d.querySelectorAll("small").length, 0);
  assert.equal(d.querySelectorAll("body > script").length, autoHeight ? 1 : 0);
  assert.equal(d.querySelectorAll("body > script")[0]?.textContent, autoHeight ? runtime.heightParent : undefined);
  assert.ok(output.help.auto.length > 0);
  dom.window.close();
});
