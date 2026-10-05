import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { exportBanner } from "../../src/features/product-banner/exporter.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime, buildHeightParentRuntime } from "../../scripts/product-banner-runtime.mjs";
import { chromium, firefox, webkit, type Browser, type Frame } from "playwright";

const work = process.env.PB_LATE_RESULT_DIR || "docs/jobs/todo/product-banner/work/late-image";
const observations: object[] = [];
const pending = new Map<string, { response: ServerResponse; tail: string }>();
const requests = new Map<string, number>();
let browser: Browser, server: ReturnType<typeof createServer>, origin: string;
let runtime: { banner: string; heightParent: string };
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
function output(mode: string, token: string) {
  const project = stateWith(8).project;
  return exportBanner({ ...project, settings: { ...createDefaultSettings("en", "slim"), visibleCount: 1, autoPlay: false },
    products: project.products.map((p, i) => ({ ...p, imageUrl: `https://example.com/img/${token}/${mode}/${i}.svg` })),
  }, runtime);
}
function split(document: string) {
  const at = document.lastIndexOf("<script>"); assert.ok(at > 0);
  return { head: document.slice(0, at), tail: document.slice(at) };
}
before(async () => {
  await mkdir(work, { recursive: false });
  runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
  server = createServer((req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1");
    const token = url.searchParams.get("token")!, mode = url.searchParams.get("mode")!;
    const format = url.searchParams.get("format")!;
    const exported = output(mode, token);
    const document = format === "standalone" ? exported.standalone
      : `<!doctype html><html><head><meta charset="utf-8"></head><body>${exported[format as "html" | "iframe"]}</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (mode === "late" && format !== "iframe") {
      const chunks = split(document); pending.set(token, { response: res, tail: chunks.tail });
      res.write(chunks.head);
    } else res.end(document);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const engine = process.env.PB_IMAGE_ENGINE || "chromium";
  assert.ok(["chromium", "firefox", "webkit"].includes(engine));
  browser = await ({ chromium, firefox, webkit })[engine as "chromium"].launch(); console.log(`Browser ${browser.version()}`);
});
after(async () => {
  for (const { response } of pending.values()) response.end();
  await browser?.close(); if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await writeFile(`${work}/RESULTS.json`, JSON.stringify({ browser: browser?.version(), observations }, null, 2));
});
async function snapshot(frame: Frame, index = 0) {
  return frame.locator(".wlpb-v1-item").filter({ has: frame.locator(`img[src$="/${index}.svg"]`) }).evaluate((li) => {
    const img = li.querySelector("img")!, fallback = li.querySelector<HTMLElement>(".wlpb-v1-fallback")!;
    return { complete: img.complete, naturalWidth: img.naturalWidth, currentSrc: img.currentSrc,
      imageHidden: img.hidden, fallbackHidden: fallback.hidden, loading: img.loading,
      events: (window as any).__lateEvents };
  });
}
for (const format of ["html", "iframe", "standalone"]) for (const mode of ["late", "lazy", "after"]) {
  test(`R3afix-F01 ${format}: ${mode === "late" ? "error before attachment" : mode === "lazy" ? "unrequested lazy then enter viewport" : "error after attachment"}`, async (t) => {
    const token = `${format}-${mode}`, context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    context.setDefaultTimeout(5000);
    t.after(() => context.close());
    await context.addInitScript(() => {
      (window as any).__lateEvents = [];
      for (const name of ["load", "error"]) document.addEventListener(name, (event) => {
        if (event.target instanceof HTMLImageElement) (window as any).__lateEvents.push({
          event: name, index: event.target.src.split("/").at(-1), ready: !!document.querySelector("[data-wlpb-ready]"),
          complete: event.target.complete, naturalWidth: event.target.naturalWidth, currentSrc: event.target.currentSrc,
        });
      }, true);
    });
    let releaseImage: (() => void) | undefined;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      assert.equal(url.hostname, "example.com"); assert.ok(url.pathname.startsWith(`/img/${token}/`), "affiliate/provider requests forbidden");
      requests.set(url.pathname, (requests.get(url.pathname) || 0) + 1);
      const missing = mode !== "lazy" && url.pathname.endsWith("/0.svg");
      if (mode === "after" && missing) await new Promise<void>((resolve) => { releaseImage = resolve; });
      await route.fulfill(missing ? { status: 404, body: "Missing", contentType: "text/plain" }
        : { body: image, contentType: "image/svg+xml" });
    });
    const page = await context.newPage();
    await page.goto(`${origin}/?token=${token}&mode=${mode}&format=${format}`, { waitUntil: "commit" });
    let frame: Frame = page.mainFrame();
    if (format === "iframe") {
      const iframe = page.locator("iframe[data-wlpb-frame]"); await iframe.waitFor();
      frame = (await (await iframe.elementHandle())!.contentFrame())!;
      assert.ok(frame);
      if (mode === "late") {
        // srcdoc is atomic. Reparse its exact exported bytes in two writes so the
        // sandboxed iframe exercises the same attachment boundary as HTTP chunks.
        const document = await iframe.getAttribute("srcdoc"); assert.ok(document);
        const chunks = split(document);
        await frame.evaluate((head) => {
          document.open(); (window as any).__lateEvents = [];
          document.addEventListener("error", (event) => {
            if (event.target instanceof HTMLImageElement) (window as any).__lateEvents.push({ event: "error", ready: !!document.querySelector("[data-wlpb-ready]") });
          }, true);
          document.write(head);
        }, chunks.head);
        await frame.waitForFunction(() => (window as any).__lateEvents.some((e: any) => e.event === "error" && !e.ready));
        const before = await snapshot(frame); observations.push({ token, before });
        assert.equal(before.imageHidden, false); assert.equal(before.fallbackHidden, true);
        assert.equal(before.complete, true); assert.ok(before.currentSrc); assert.equal(before.naturalWidth, 0);
        await frame.evaluate((tail) => { document.write(tail); document.close(); }, chunks.tail);
      }
    }
    if (mode === "late" && format !== "iframe") {
      // WebKit waits for document completion before requesting lazy images.
      // Make the first host image eager to force a real error before the tail.
      await frame.locator(".wlpb-v1-img").first().evaluate((img) => { (img as HTMLImageElement).loading = "eager"; });
      await frame.waitForFunction(() => (window as any).__lateEvents.some((e: any) => e.event === "error" && !e.ready));
      const before = await snapshot(frame); observations.push({ token, before });
      assert.equal(before.imageHidden, false); assert.equal(before.fallbackHidden, true);
      assert.equal(before.complete, true); assert.ok(before.currentSrc); assert.equal(before.naturalWidth, 0);
      const chunk = pending.get(token)!; pending.delete(token); chunk.response.end(chunk.tail);
    }
    await frame.locator("[data-wlpb-ready]").waitFor();
    if (mode === "lazy") {
      // Slide 7 is neither active nor preloaded next. It has no image request.
      const before = await snapshot(frame, 7); observations.push({ token, before });
      assert.equal(requests.get(`/img/${token}/${mode}/7.svg`) || 0, 0);
      assert.equal(Boolean(before.currentSrc && before.complete && !before.naturalWidth), false);
      assert.equal(before.naturalWidth, 0); // WebKit selects currentSrc before requesting.
      assert.equal(before.imageHidden, false); assert.equal(before.fallbackHidden, true);
      assert.equal(before.loading, "lazy");
      // The host reveals this original node outside the banner, far offscreen.
      // This avoids a banner resize hiding it again or navigation making it eager.
      await frame.locator('[data-wlpb-index="7"]').evaluate((li) => {
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;top:20000px;left:0;width:600px";
        document.body.append(host); host.append(li);
        (li as HTMLElement).hidden = false; (li as HTMLElement).inert = false;
      });
      await page.waitForTimeout(150);
      assert.equal(requests.get(`/img/${token}/${mode}/7.svg`) || 0, 0);
      await frame.locator('img[src$="/7.svg"]').scrollIntoViewIfNeeded();
      await frame.waitForFunction(() => document.querySelector<HTMLImageElement>('img[src$="/7.svg"]')!.naturalWidth > 0);
      const after = await snapshot(frame, 7); observations.push({ token, after });
      assert.equal(after.loading, "lazy"); assert.equal(after.imageHidden, false); assert.equal(after.fallbackHidden, true);
      assert.ok((requests.get(`/img/${token}/${mode}/7.svg`) || 0) > 0);
    } else {
      if (mode === "after") {
        await page.waitForFunction(() => !!document.querySelector("iframe[data-wlpb-frame]") || !!document.querySelector("[data-wlpb-ready]"));
        assert.equal((await snapshot(frame)).fallbackHidden, true);
        // Wait for the intercepted image request; release only after mount.
        for (let i = 0; !releaseImage && i < 100; i++) await page.waitForTimeout(10);
        assert.ok(releaseImage); releaseImage();
      }
      await frame.waitForFunction(() => document.querySelector<HTMLImageElement>(".wlpb-v1-img")!.hidden);
      const after = await snapshot(frame); observations.push({ token, after });
      assert.equal(after.fallbackHidden, false); assert.equal(after.naturalWidth, 0);
      assert.ok(after.events.some((e: any) => e.event === "error" && e.ready === (mode === "after")));
    }
  });
}
