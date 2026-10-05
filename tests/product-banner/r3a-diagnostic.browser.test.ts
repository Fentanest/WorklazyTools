import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import { createServer as createProxy } from "node:http";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { buildBannerRuntime } from "../../scripts/product-banner-runtime.mjs";
import { PNG } from "pngjs";
import { startRecoveryServer } from "../recovery-server.mjs";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson } from "../../src/features/product-banner/projectJson.ts";

test("R3a-F01 initial UI srcdoc: event/state timeline and loading-transition controls", async (t) => {
  const server = await startRecoveryServer({ root: "dist", port: 0 });
  t.after(() => server.close());
  const network = process.env.PB_R3A_LOCAL_IMAGE_NETWORK === "1", served: object[] = [];
  let proxy: ReturnType<typeof createProxy> | undefined, proxyPort = 0;
  const tunnels = new Set<Socket>();
  let imageServer: ReturnType<typeof createServer> | undefined;
  if (network) {
    const directory = await mkdtemp(join(tmpdir(), "pb-sol-r3a-tls-"));
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", `${directory}/key.pem`, "-out", `${directory}/cert.pem`, "-subj", "/CN=example.com", "-addext", "subjectAltName=DNS:example.com", "-days", "1"], { stdio: "ignore" });
    imageServer = createServer({ key: await readFile(`${directory}/key.pem`), cert: await readFile(`${directory}/cert.pem`) }, (req, res) => {
      served.push({ time: Date.now(), index: /img\/(\d+)/u.exec(req.url || "")?.[1], status: 200 });
      const png = new PNG({ width: 200, height: 140 }); png.data.fill(255);
      res.writeHead(200, { "content-type": "image/png", "cross-origin-resource-policy": "cross-origin" }); res.end(PNG.sync.write(png));
    });
    await new Promise<void>((resolve, reject) => { imageServer!.once("error", reject); imageServer!.listen(0, "127.0.0.1", resolve); });
    t.after(() => { imageServer!.closeAllConnections(); return new Promise<void>((resolve) => imageServer!.close(() => resolve())); });
    const tlsPort = (imageServer.address() as { port: number }).port;
    // A local CONNECT tunnel preserves the exact https://example.com URLs without privileged ports.
    proxy = createProxy((_req, res) => res.writeHead(502).end());
    proxy.on("connect", (req, socket, head) => {
      if (req.url !== "example.com:443") { socket.destroy(); return; }
      const upstream = connect(tlsPort, "127.0.0.1");
      tunnels.add(socket); tunnels.add(upstream);
      for (const connection of [socket, upstream]) { connection.on("error", () => { socket.destroy(); upstream.destroy(); }); connection.on("close", () => tunnels.delete(connection)); }
      upstream.on("connect", () => { socket.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head.length) upstream.write(head); socket.pipe(upstream); upstream.pipe(socket); });
    });
    await new Promise<void>((resolve, reject) => { proxy!.once("error", reject); proxy!.listen(0, "127.0.0.1", resolve); });
    proxyPort = (proxy.address() as { port: number }).port;
    t.after(() => { for (const socket of tunnels) socket.destroy(); proxy!.closeAllConnections(); return new Promise<void>((resolve) => proxy!.close(() => resolve())); });
  }
  const browser = await chromium.launch({ executablePath: process.env.PB_R3A_BROWSER === "bundled" ? undefined : "/usr/bin/google-chrome", args: ["--no-sandbox", ...(network ? [`--proxy-server=http://127.0.0.1:${proxyPort}`, "--ignore-certificate-errors"] : [])] });
  const bitmap = new PNG({ width: 200, height: 140 }); bitmap.data.fill(255);
  console.log(`Browser ${browser.version()}`);
  const results: any[] = [];
  const original = execFileSync("git", ["show", "151b1f1f2f241335deea4f6da66627da1b2638c0:src/features/product-banner/runtime.ts"], { encoding: "utf8" }), baseline = await buildBannerRuntime();
  const variants = {
    baseline: original,
    noInitialCheck: original.replace("if (img.complete && !img.naturalWidth) failed();", ""),
    noReorder: original.replace(/    ordered.forEach[^\n]+/u, ""),
    guardInFlight: original.replace("if (img) img.loading", "if (img && (img.complete || !img.currentSrc)) img.loading"),
    afterParsing: original.replace("if (img) img.loading", 'if (img && document.readyState !== "loading") img.loading').replace("if (img.complete && !img.naturalWidth) failed();", "").replace("  resize();\n  return", '  listen(document, "DOMContentLoaded", resize);\n  resize();\n  return'),
    nextFrameOnly: original.replace(/    items.forEach\(\(item, i\) => \{ const img[^\n]+/u, (line) => `    requestAnimationFrame(() => { ${line.trim()} });`),
    nextFrame: original.replace(/    items.forEach\(\(item, i\) => \{ const img[^\n]+/u, (line) => `    requestAnimationFrame(() => { ${line.trim()} });`).replace("if (img.complete && !img.naturalWidth) failed();", ""),
    keepLazy: original.replace(/    items.forEach\(\(item, i\) => \{ const img[^\n]+/u, ""),
  };
  try {
    for (const [variant, contents] of Object.entries(variants)) {
      const compiled = await build({ stdin: { contents, resolveDir: "src/features/product-banner", loader: "ts" }, bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none" });
      const replacement = compiled.outputFiles[0].text;
      let replaced = false;
      server.state.transform = (path: string, body: string) => {
        if (!path.includes("ProductBannerPage-")) return body;
        return body.replace(/'(?:\\.|[^'\\])*'/gu, (literal) => {
          if (!literal.includes("WorklazyProductBannerV1")) return literal;
          assert.equal(runInNewContext(literal), baseline, "replace only the unchanged bundled banner runtime");
          replaced = true; return JSON.stringify(replacement);
        });
      };
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const requests: object[] = [];
      await context.addInitScript(() => {
        if ((window as any).__imageTimeline) return;
        (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true;
        const events: object[] = [], errors = new WeakSet<HTMLImageElement>();
        (window as any).__imageTimeline = events;
        const record = (img: HTMLImageElement, event: string, extra = {}) => {
          if (!img.closest("[data-wlpb-root]")) return;
          events.push({ time: performance.timeOrigin + performance.now(), index: img.closest("li")?.dataset.wlpbIndex,
            event, complete: img.complete, naturalWidth: img.naturalWidth, readyState: document.readyState, loading: img.loading, hidden: img.hidden, hasCurrentSrc: !!img.currentSrc, ...extra });
        };
        for (const event of ["load", "error"]) document.addEventListener(event, (e) => {
          if (e.target instanceof HTMLImageElement) { if (event === "error") errors.add(e.target); record(e.target, event); }
        }, true);
        const hidden = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hidden")!;
        Object.defineProperty(HTMLElement.prototype, "hidden", { ...hidden, set(value) {
          if (this instanceof HTMLImageElement) {
            const blocked = false;
            record(this, "hidden-set", { requestedHidden: value, blocked });
            if (blocked) return;
          }
          hidden.set!.call(this, value);
        } });
        const loading = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "loading")!;
        Object.defineProperty(HTMLImageElement.prototype, "loading", { ...loading, set(value) {
          record(this, "loading-set", { requestedLoading: value }); loading.set!.call(this, value);
        } });
        new MutationObserver((records) => {
          for (const r of records) if (r.target instanceof HTMLImageElement) record(r.target, `attribute-${r.attributeName}`);
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ["hidden", "loading"] });
      });
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(server.url)) return route.continue();
        if (url.startsWith("https://example.com/img/")) {
          requests.push({ time: Date.now(), event: "request", index: /img\/(\d+)/u.exec(url)?.[1], resourceType: route.request().resourceType(), context: route.request().frame().parentFrame() ? "srcdoc" : "page" });
          if (network) return route.continue();
          return route.fulfill({ contentType: "image/png", body: PNG.sync.write(bitmap), headers: { "cross-origin-resource-policy": "cross-origin" } });
        }
        return route.abort();
      });
      const page = await context.newPage();
      page.on("requestfailed", (r) => requests.push({ time: Date.now(), event: "requestfailed", reason: r.failure()?.errorText, resourceType: r.resourceType() }));
      page.on("response", (r) => { if (r.request().resourceType() === "image") requests.push({ time: Date.now(), event: "response", status: r.status(), index: /img\/(\d+)/u.exec(r.url())?.[1], context: r.request().frame().parentFrame() ? "srcdoc" : "page" }); });
      await page.goto(`${server.url}/en/tools/product-banner/`);
      await page.locator('[data-tool-page="product-banner"]').waitFor();
      await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson(stateWith().project)) });
      const preview = page.locator('[data-testid="banner-preview"]'); await preview.waitFor();
      const frame = await (await preview.elementHandle())!.contentFrame(); assert.ok(frame);
      await frame.locator("[data-wlpb-ready]").waitFor();
      await page.waitForTimeout(1200);
      const timeline = await frame.evaluate(() => (window as any).__imageTimeline as any[]);
      const images = await frame.locator("img").evaluateAll((images) => images.map((i) => ({ complete: i.complete, naturalWidth: i.naturalWidth, loading: i.loading, hidden: i.hidden })));
      results.push({ variant, replaced, network, served: [...served], requests, timeline, images });
      assert.ok(replaced, "variant must replace the actual UI's bundled runtime");
      await context.close();
    }
    for (const name of ["nextFrameOnly", "nextFrame"]) assert.ok(results.find((r) => r.variant === name).images.every((i: any) => i.naturalWidth === 200 && !i.hidden), name);
    if (!network && process.env.PB_R3A_BROWSER !== "bundled") assert.ok(results.find((r) => r.variant === "noInitialCheck").images.some((i: any) => !i.naturalWidth && i.hidden), "removing the initial check alone does not repair this reproduction");
    if (network || process.env.PB_R3A_BROWSER === "bundled") assert.ok(results[0].images.every((i: any) => i.naturalWidth === 200 && !i.hidden), "baseline loads when the fixture response is guaranteed");
    else assert.ok(results[0].images.some((i: any) => i.hidden && !i.naturalWidth), "baseline reproduces");
  } finally {
    await writeFile(process.env.PB_R3A_DIAGNOSTIC_PATH || "docs/jobs/todo/product-banner/work/R3a-image-cause-latest.json", JSON.stringify(results, null, 2));
    await browser.close(); await server.close();

  }
});
