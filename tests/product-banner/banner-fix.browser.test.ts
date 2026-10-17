import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium, type Browser } from "playwright";
import { exportBanner } from "../../src/features/product-banner/exporter.ts";
import { DESIGN_IDS } from "../../src/features/product-banner/stateTypes.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime, buildHeightParentRuntime } from "../../scripts/product-banner-runtime.mjs";

const dir = process.env.PB_FIX_SHOTS || "docs/jobs/todo/banner-fix-20261017/evidence/synthetic";
let browser: Browser, origin: string;
const documents = new Map<string, string>();
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(documents.get(req.url!) || "<!doctype html><body></body>");
});
const runtime = { banner: await buildBannerRuntime(), heightParent: await buildHeightParentRuntime() };
const image = await readFile(new URL("../fixtures/product-banner/local-image.svg", import.meta.url));
before(async () => {
  await mkdir(dir, { recursive: true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
for (const width of [1000, 390]) for (const theme of ["light", "dark"] as const) test(`banner fixes: five designs, ko/en, HTML/iframe at ${width}px ${theme}`, async () => {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue()
    : route.request().resourceType() === "image" ? route.fulfill({ body: image, contentType: "image/svg+xml" }) : route.abort());
  try {
    for (const language of ["ko", "en"] as const) for (const design of DESIGN_IDS) {
      const project = stateWith(3).project;
      const products = project.products.map((p, i) => i === 0 ? { ...p,
        originPrice: { raw: "USD 16.990", amount: 16.99, currency: "USD" },
        discountPrice: { raw: "USD 16.99", amount: 16.99, currency: "USD" }, discount: { raw: "0%", percent: 0 },
      } : p);
      const output = exportBanner({ ...project, products, settings: { ...createDefaultSettings(language, design), theme, width: 1000, showName: true, showPrice: true, showDiscount: true, showButton: true, autoHeight: true } }, runtime, { height: 2400 });
      for (const format of ["html", "iframe"] as const) {
        const path = `/${width}-${theme}-${language}-${design}-${format}`;
        documents.set(path, `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:12px;background:${theme === "dark" ? "#101827" : "#f1f5f9"}">${output[format]}</body></html>`);
        await page.goto(`${origin}${path}`);
        const frame = format === "html" ? page.mainFrame() : (await (await page.locator("iframe").elementHandle())!.contentFrame())!;
        await frame.locator('[data-wlpb-ready="true"]').waitFor();
        if (format === "iframe") {
          await page.waitForFunction(() => Number(document.querySelector("iframe")!.height) < 2400);
          assert.equal(await page.locator("small").count(), 0);
          assert.equal(await page.locator("[data-wlpb-embed]").evaluate((el) => el.children.length), 1);
        }
        assert.equal(await frame.locator('[data-wlpb-index="0"] .wlpb-v1-discount').count(), 0);
        assert.equal(await frame.locator('[data-wlpb-index="0"] .wlpb-v1-original').count(), 0);
        assert.equal(await frame.locator('[data-wlpb-index="0"] .wlpb-v1-prices').textContent(), "USD 16.99");
        assert.equal(await frame.locator(".wlpb-v1-photo > .wlpb-v1-discount").count(), 2);
        assert.equal(await frame.locator(".wlpb-v1-disclosures > .wlpb-v1-notice").count(), 2);
        const cta = frame.locator("[data-wlpb-cta]").first();
        await cta.focus();
        const styles = await cta.evaluate((el) => {
          const s = getComputedStyle(el), rgb = (color: string) => color.match(/\d+/gu)!.slice(0,3).map(Number).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v+.055)/1.055)**2.4; });
          const lum = (color: string) => rgb(color).reduce((n,v,i) => n+v*[.2126,.7152,.0722][i],0);
          const a=lum(s.color), b=lum(s.backgroundColor);
          return { contrast: (Math.max(a,b)+.05)/(Math.min(a,b)+.05), underline: s.textDecorationLine, height: el.getBoundingClientRect().height, outline: s.outlineStyle };
        });
        assert.ok(styles.contrast >= 4.5, "CTA text contrast");
        assert.ok(styles.height >= 44, "CTA touch target");
        assert.equal(styles.underline, "none"); assert.equal(styles.outline, "solid");
        assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "export fits host");
        assert.ok(await frame.locator(".wlpb-v1-footer").evaluate((el) => [...el.querySelectorAll("span,a")].every((child) => { const r=child.getBoundingClientRect(), p=el.getBoundingClientRect(); return r.left >= p.left && r.right <= p.right + 1; })), "disclosures fit footer");
        await page.screenshot({ path: `${dir}/${language}-${design}-${format}-${width}-${theme}.png`, fullPage: true });
      }
    }
  } finally { await page.close(); }
});
