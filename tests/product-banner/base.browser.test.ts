import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const job = process.env.PB_JOB_ROOT!;
const results: object[] = [];
for (const base of ["/", "/worklazytools/"]) test(`T6b built base ${base}`, async () => {
  const dir = base === "/" ? process.env.PB_DIST! : `${job}/base-sub/dist`;
  // Serve the real output at its deployment mount, without rewriting HTML/assets.
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    if (!url.pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    let relative = url.pathname.slice(base.length);
    if (!relative || relative.endsWith("/")) relative += "index.html";
    const file = path.resolve(dir, relative);
    if (!file.startsWith(`${dir}/`)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      const type = ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2" } as Record<string, string>)[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`, browser = await chromium.launch();
  const context = await browser.newContext(), bad: string[] = [], loaded: string[] = [];
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(() => { (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true; });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("response", (r) => { if (new URL(r.url()).origin === origin) { loaded.push(new URL(r.url()).pathname); if (r.status() >= 400) bad.push(new URL(r.url()).pathname); } });
    const sitemap = await readFile(`${dir}/sitemap.xml`, "utf8");
    assert.ok(sitemap.includes("https://worklazy.net/ko/tools/product-banner/"));
    assert.ok(sitemap.includes("https://worklazy.net/en/tools/product-banner/"));
    const staticPages: object[] = [];
    for (const lang of ["ko", "en"]) {
      const html = await readFile(`${dir}/${lang}/tools/product-banner/index.html`, "utf8");
      assert.ok(html.includes(`https://worklazy.net/${lang}/tools/product-banner/`));
      assert.ok(html.includes("seo-static-fallback"));
      for (const asset of [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/gu)].map((m) => m[1]))
        assert.ok(asset.startsWith(base), "static asset honors build base");
      await page.goto(`${origin}${base}${lang}/tools/product-banner/`);
      await page.locator('[data-tool-page="product-banner"]').waitFor();
      staticPages.push({ lang, route: new URL(page.url()).pathname, staticPresent: true });
    }
    const csv = "Image Url,Promotion Url,Product Desc\nhttps://example.com/img/local.svg,https://example.com/p/local,Base product";
    await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByText("Review column mapping", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Import products in selected order", exact: true }).click();
    await page.locator('[data-testid="banner-product"]').waitFor();
    const workers = loaded.filter((url) => /input\.worker-.*\.js$/u.test(url));
    assert.ok(workers.length > 0 && workers.every((url) => url.startsWith(`${base}assets/`)));
    const code = await page.getByLabel("Export code", { exact: true }).inputValue();
    assert.ok(code.includes("https://worklazy.net/en/tools/product-banner/"));
    assert.deepEqual(bad, [], "every requested local asset/Worker loads");
    results.push({ base, dir, staticPages, sitemap: "operational absolute ko/en", workers, bad, assets: (await readdir(`${dir}/assets`)).length, source: "operational absolute en" });
  } finally {
    await browser.close(); await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
    await writeFile(`${job}/base-results.json`, JSON.stringify(results, null, 2));
  }
});
