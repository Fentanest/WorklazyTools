import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium, type Browser, type Frame, type Page } from "playwright";
import { exportBanner, BANNER_SANDBOX } from "../../src/features/product-banner/exporter.ts";
import { loadProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS, type DesignId } from "../../src/features/product-banner/stateTypes.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime, buildHeightParentRuntime } from "../../scripts/product-banner-runtime.mjs";

const work = "docs/jobs/todo/product-banner/work", shots = process.env.PB_T4_SHOT_DIR || `${work}/shots-T4`;
const cases: string[] = JSON.parse(await readFile(new URL("./export-cases.json", import.meta.url), "utf8"));
const results = new Map(cases.map((id) => [id, { status: "NOT_RUN", details: {} as object }]));
const captures: string[] = [], linkRecords: object[] = [];
const runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
let browser: Browser;
before(async () => { browser = await chromium.launch(); await mkdir(shots, { recursive: false }); });
after(async () => {
  await browser?.close();
  await writeFile(`${shots}/MANIFEST.sha256`, (await Promise.all(captures.map(async (name) => `${createHash("sha256").update(await readFile(`${shots}/${name}`)).digest("hex")}  ${name}\n`))).join(""));
  await writeFile(`${shots}/RESULTS.json`, JSON.stringify({ cases: Object.fromEntries(results), linkRecords,
    passed: [...results.values()].filter((r) => r.status === "PASS").length,
    failed: [...results.values()].filter((r) => r.status === "FAIL").length,
    notRun: [...results.values()].filter((r) => r.status === "NOT_RUN").length }, null, 2));
  assert.equal(new Set(cases).size, cases.length, "duplicate required case IDs");
  assert.ok([...results.values()].every((r) => r.status === "PASS"), "required case failed or missing");
});
function run(id: string, fn: (t: test.TestContext) => Promise<object | void>) {
  test(id, async (t) => {
    assert.ok(results.has(id), "undeclared case");
    try { const details = await fn(t); results.set(id, { status: "PASS", details: details || {} }); }
    catch (error) { results.set(id, { status: "FAIL", details: { error: String(error) } }); throw error; }
  });
}
function project(design: DesignId = "photo-strip", autoHeight = false) {
  return { ...stateWith(10).project, settings: { ...createDefaultSettings("ko", design), autoHeight } };
}
function host(content: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>T4 external host</title><style>body{margin:0;font-family:system-ui}main{width:100%;max-width:1030px}iframe{display:block}small{display:block}</style></head><body><div id="parent-secret">host only</div><main>${content}</main></body></html>`;
}
async function open(t: test.TestContext, content: string, options: { scriptBlocked?: boolean; file?: string; clock?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  t.after(() => context.close());
  let fulfilledImages = 0, fulfilledDestinations = 0, fulfilledHosts = 0, blocked = 0;
  const errors: string[] = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "file:") return route.continue();
    if (url.origin === "https://host.example.com") { fulfilledHosts++; return route.fulfill({ contentType: "text/html", body: host(content), headers: options.scriptBlocked ? { "Content-Security-Policy": "script-src 'none'" } : {} }); }
    if (url.hostname === "example.com" && url.pathname.startsWith("/img/")) { fulfilledImages++; return route.fulfill({ contentType: "image/svg+xml", body: image }); }
    if (url.hostname === "example.com" && url.pathname.startsWith("/p/")) { fulfilledDestinations++; return route.fulfill({ contentType: "text/html", body: '<title>Local synthetic destination</title><script>localStorage.setItem("popup-ok","yes")</script><p>Non-revenue fixture</p>' }); }
    blocked++; return route.abort();
  });
  const page = await context.newPage(); page.on("pageerror", (e) => errors.push(e.message));
  if (options.clock) await page.clock.install();
  await page.goto(options.file ? pathToFileURL(resolve(options.file)).href : "https://host.example.com/");
  t.after(() => {
    try { assert.deepEqual(errors, []); assert.equal(blocked, 0); }
    catch (error) { results.set(t.name, { status: "FAIL", details: { error: String(error) } }); throw error; }
  });
  return { page, stats: () => ({ fulfilledImages, fulfilledDestinations, fulfilledHosts, unexpectedExternalAttempts: blocked, errors }) };
}
async function child(page: Page, index = 0): Promise<Frame> {
  const iframe = page.locator("iframe").nth(index); await iframe.scrollIntoViewIfNeeded();
  const frame = await (await iframe.elementHandle())!.contentFrame(); assert.ok(frame); return frame;
}
async function verify(frame: Page | Frame, p = project()) {
  await frame.locator('[data-wlpb-ready="true"]').waitFor();
  const data = await frame.locator("[data-wlpb-root]").evaluate((root) => ({
    indices: [...root.querySelectorAll("li")].map((p) => p.getAttribute("data-wlpb-index")),
    links: [...root.querySelectorAll<HTMLAnchorElement>("li a")].map((a) => ({ raw: a.getAttribute("href"), normalized: a.href, target: a.target, rel: a.rel })),
    source: [...root.querySelectorAll<HTMLAnchorElement>("footer a")].map((a) => ({ raw: a.getAttribute("href"), target: a.target, rel: a.rel })),
  }));
  assert.deepEqual(data.indices, p.products.map((_, i) => String(i)));
  assert.deepEqual(data.links.map((a) => a.raw), p.products.map((p) => p.promotionUrl.trim()));
  assert.ok(data.links.every((a) => a.target === "_blank" && a.rel === "sponsored noopener"));
  assert.deepEqual(data.source, [{ raw: "https://worklazy.net/ko/tools/product-banner/", target: "_blank", rel: "nofollow noopener" }]);
  linkRecords.push(data); return data;
}
for (const design of DESIGN_IDS) for (const method of ["html", "iframe"] as const) run(`PB-EXPORT-${design}-${method}`, async (t) => {
  const p = project(design), output = exportBanner(p, runtime), { page, stats } = await open(t, output[method]);
  const target = method === "html" ? page : await child(page); await verify(target, p);
  await target.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>("li:not([hidden]) img")].every((i) => i.complete && i.naturalWidth > 0));
  const heights: object[] = [];
  for (const width of [1100, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await target.waitForTimeout(200);
    if (method === "iframe") {
      const contentHeight = await target.locator("[data-wlpb-root]").evaluate((r) => r.getBoundingClientRect().height);
      assert.ok(contentHeight <= output.height, `${design} default height clips at ${width}`); heights.push({ width, contentHeight, defaultHeight: output.height });
    }
  }
  await page.screenshot({ path: `${shots}/${design}-${method}-320.png`, fullPage: true }); captures.push(`${design}-${method}-320.png`);
  return { ...stats(), heights };
});
run("PB-EXPORT-multi-2-identical-3-different", async (t) => {
  const designs: DesignId[] = ["photo-strip", "photo-strip", "product-card", "slim", "grid"];
  const content = designs.map((d, i) => exportBanner({ ...project(d), settings: { ...project(d).settings, colors: { ...project(d).settings.colors, accent: i < 2 ? "#2563eb" : "#123456" } } }, runtime).html).join("");
  const { page, stats } = await open(t, content, { clock: true });
  await page.waitForFunction(() => window.WorklazyProductBannerV1?.instances.size === 5);
  const roots = page.locator("[data-wlpb-root]"), before = await roots.locator(".wlpb-v1-status").allTextContents();
  await roots.nth(0).locator('[data-wlpb-action="next"]').click();
  const after = await roots.locator(".wlpb-v1-status").allTextContents(); assert.notEqual(before[0], after[0]); assert.deepEqual(before.slice(1), after.slice(1));
  assert.equal(new Set(await roots.evaluateAll((rs) => rs.map((r) => (r as HTMLElement).dataset.wlpbKey))).size, 5);
  assert.deepEqual(await roots.evaluateAll((rs) => rs.map((r) => getComputedStyle(r).getPropertyValue("--wlpb-accent"))), ["#2563eb", "#2563eb", "#123456", "#123456", "#123456"]);
  await roots.nth(0).locator('[data-wlpb-action="pause"]').click(); assert.equal(await roots.nth(1).locator('[data-wlpb-action="pause"]').getAttribute("aria-pressed"), "false");
  await roots.nth(1).scrollIntoViewIfNeeded(); await page.mouse.move(1099, 1); await page.waitForFunction(() => document.querySelectorAll<HTMLElement>("[data-wlpb-root]")[1].dataset.wlpbPlaying === "true");
  await page.clock.fastForward(5100); assert.notEqual(await roots.nth(1).locator(".wlpb-v1-status").textContent(), after[1]); assert.equal(await roots.nth(0).locator(".wlpb-v1-status").textContent(), after[0]);
  await page.screenshot({ path: `${shots}/multi.png`, fullPage: true }); captures.push("multi.png"); return stats();
});
run("PB-EXPORT-standalone-file", async (t) => {
  const output = exportBanner(project(), runtime), file = `${work}/T4-standalone.html`; await writeFile(file, output.standalone);
  const { page, stats } = await open(t, "", { file }); await verify(page); assert.ok(page.url().startsWith("file:")); return stats();
});
run("PB-EXPORT-json-roundtrip", async () => {
  const p = project("product-card"), a = exportBanner(p, runtime), loaded = loadProjectJson(a.json), b = exportBanner(loaded, runtime);
  assert.deepEqual(loaded, p); assert.deepEqual(a, b); return { products: loaded.products.length };
});
run("PB-EXPORT-sandbox-popup", async (t) => {
  const { page, stats } = await open(t, exportBanner(project(), runtime).iframe), frame = await child(page); await verify(frame);
  assert.equal(await page.locator("iframe").getAttribute("sandbox"), BANNER_SANDBOX);
  await frame.waitForFunction(() => document.querySelector<HTMLElement>("[data-wlpb-root]")!.dataset.wlpbPlaying === "true");
  const access = await frame.evaluate(() => {
    const fails = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };
    return { dom: fails(() => parent.document.getElementById("parent-secret")), parentStorage: fails(() => parent.localStorage), ownStorage: fails(() => localStorage.setItem("bad", "yes")) };
  }); assert.deepEqual(access, { dom: true, parentStorage: true, ownStorage: true });
  const popupPromise = page.waitForEvent("popup"); await frame.locator("li:not([hidden]) a").first().click(); const popup = await popupPromise; await popup.waitForLoadState();
  assert.equal(await popup.title(), "Local synthetic destination"); assert.equal(await popup.evaluate(() => localStorage.getItem("popup-ok")), "yes"); assert.equal(await popup.evaluate(() => window.opener), null);
  const sandboxWithout = (flag: string) => exportBanner(project(), runtime).iframe.replace(BANNER_SANDBOX, BANNER_SANDBOX.split(" ").filter((s) => s !== flag).join(" "));
  const noScripts = await open(t, sandboxWithout("allow-scripts")), inert = await child(noScripts.page);
  assert.equal(await inert.locator("[data-wlpb-ready]").count(), 0); assert.equal(await inert.locator("li").count(), 10);
  const noPopups = await open(t, sandboxWithout("allow-popups")), blockedFrame = await child(noPopups.page); await verify(blockedFrame);
  await blockedFrame.locator("li:not([hidden]) a").first().click(); await noPopups.page.waitForTimeout(250); assert.equal(noPopups.page.context().pages().length, 1);
  const noEscape = await open(t, sandboxWithout("allow-popups-to-escape-sandbox")), limited = await child(noEscape.page); await verify(limited);
  const limitedPopup = noEscape.page.waitForEvent("popup"); await limited.locator("li:not([hidden]) a").first().click(); const destination = await limitedPopup; await destination.waitForLoadState();
  assert.equal(await destination.evaluate(() => { try { localStorage.setItem("probe", "yes"); return false; } catch { return true; } }), true);
  return { ...stats(), access, ablations: { scriptsRequired: true, popupsRequired: true, escapeRequired: true } };
});
run("PB-EXPORT-height-validation", async (t) => {
  const output = exportBanner(project("product-card", true), runtime, { parentOrigin: "https://host.example.com" });
  const { page, stats } = await open(t, output.iframe + output.iframe), first = await child(page), second = await child(page, 1);
  await first.locator('[data-wlpb-ready="true"]').waitFor(); await second.locator('[data-wlpb-ready="true"]').waitFor();
  await page.waitForFunction((h) => [...document.querySelectorAll("iframe")].every((f) => Number(f.height) !== h), output.height);
  // Capture a fresh legitimate handshake inside each opaque frame without bypassing sender validation.
  for (const f of [first, second]) await f.evaluate(() => addEventListener("message", (e) => { if (e.data.kind === "wlpb-v1-init") (window as any).testId = e.data.id; }));
  await page.locator("iframe").evaluateAll((fs) => fs.forEach((f) => f.dispatchEvent(new Event("load"))));
  await first.waitForFunction(() => (window as any).testId); await second.waitForFunction(() => (window as any).testId);
  const ids = [await first.evaluate(() => (window as any).testId), await second.evaluate(() => (window as any).testId)]; assert.notEqual(ids[0], ids[1]);
  await page.waitForTimeout(250); const baseline = await page.locator("iframe").evaluateAll((fs) => fs.map((f) => f.height));
  await page.evaluate((id) => postMessage({ kind: "wlpb-v1-height", id, height: 777 }, "*"), ids[0]);
  await first.evaluate((other) => {
    for (const height of ["777", null, NaN, Infinity, 119, 2401, -10, 123.5, {}, []]) parent.postMessage({ kind: "wlpb-v1-height", id: (window as any).testId, height }, "*");
    parent.postMessage({ kind: "wlpb-v1-height", id: other, height: 777 }, "*");
    parent.postMessage({ kind: "wrong", id: (window as any).testId, height: 777 }, "*");
  }, ids[1]);
  await page.waitForTimeout(250); assert.deepEqual(await page.locator("iframe").evaluateAll((fs) => fs.map((f) => f.height)), baseline);
  await first.evaluate(() => {
    parent.postMessage({ kind: "wlpb-v1-height", id: (window as any).testId, height: 777 }, "*");
    for (let n = 0; n < 100; n++) parent.postMessage({ kind: "wlpb-v1-height", id: (window as any).testId, height: 888 }, "*");
  }); await page.waitForFunction(() => document.querySelector("iframe")!.height === "777");
  await page.waitForTimeout(150); assert.equal(await page.locator("iframe").first().getAttribute("height"), "777");
  await first.evaluate(() => { const root = document.querySelector<HTMLElement>("[data-wlpb-root]")!; root.style.paddingBottom = "100px"; });
  await page.waitForFunction((old) => document.querySelector("iframe")!.height !== old, baseline[0]);
  assert.equal(await page.locator("iframe").nth(1).getAttribute("height"), baseline[1]); return { ...stats(), distinctIds: true, rejectedHeights: 10 };
});
run("PB-EXPORT-height-cleanup", async (t) => {
  const { page, stats } = await open(t, exportBanner(project("product-card", true), runtime).iframe); const frame = await child(page); await verify(frame, project("product-card"));
  const active = await page.evaluate(() => {
    const w = window as any, receive = w.addEventListener.bind(w), remove = w.removeEventListener.bind(w); w.testRemoved = 0;
    w.removeEventListener = (type: string, ...args: any[]) => { if (type === "message") w.testRemoved++; return remove(type, ...args); }; return typeof receive;
  }); assert.equal(active, "function"); await page.locator("iframe").evaluate((f) => f.remove());
  await page.waitForFunction(() => (window as any).testRemoved === 1); return stats();
});
run("PB-EXPORT-script-blocked", async (t) => {
  const output = exportBanner(project("grid", true), runtime), { page, stats } = await open(t, output.iframe, { scriptBlocked: true }), frame = await child(page);
  assert.equal(await page.locator("iframe").getAttribute("height"), String(output.height)); assert.ok(await page.locator("small").textContent());
  assert.equal(await frame.locator("li").count(), 10); assert.equal(await frame.locator("[data-wlpb-ready]").count(), 0); return stats();
});
run("PB-EXPORT-srcdoc-blocked", async (t) => {
  const output = exportBanner(project(), runtime), { page, stats } = await open(t, output.iframe.replace(/ srcdoc="[^"]*"/u, ""));
  assert.ok((await page.locator("small").textContent())!.includes("srcdoc")); assert.equal(await page.locator("iframe").getAttribute("height"), String(output.height)); return stats();
});
run("PB-EXPORT-security-strings", async (t) => {
  const bad = `"' & < > 한글 😀\n</script><!--\u2028\u2029<img onerror="window.escaped=1"> javascript:alert(1)`, p = project("product-card");
  const output = exportBanner({ ...p, products: p.products.map((p) => ({ ...p, name: bad })), settings: { ...p.settings, affiliateNotice: bad, autoHeight: true } }, runtime);
  const { page, stats } = await open(t, output.html + output.iframe), frame = await child(page);
  const file = `${work}/T4-security-standalone.html`; await writeFile(file, output.standalone); const standalone = await open(t, "", { file });
  for (const target of [page, frame, standalone.page]) { await target.locator('[data-wlpb-ready="true"]').waitFor(); assert.equal(await target.locator(".wlpb-v1-name").first().textContent(), bad); assert.equal(await target.locator("[onerror]").count(), 0); assert.equal(await target.evaluate(() => (window as any).escaped), undefined); }
  assert.equal(await page.locator("#parent-secret").textContent(), "host only"); return stats();
});
