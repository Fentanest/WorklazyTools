import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { saveProjectJson } from "../../src/features/product-banner/projectJson.ts";
import { startRecoveryServer } from "../recovery-server.mjs";
import { BANNER_SANDBOX } from "../../src/features/product-banner/exporter.ts";

let base = process.env.TEST_BASE_URL || "";
let server: Awaited<ReturnType<typeof startRecoveryServer>> | undefined;
const shots = process.env.PB_T5_SHOT_DIR || "docs/jobs/todo/product-banner/work/shots-T5";
const captures: string[] = [];
const bitmap = new PNG({ width: 200, height: 140 });
for (let y = 0; y < 140; y++) for (let x = 0; x < 200; x++) {
  const i = (y * 200 + x) * 4, circle = (x - 100) ** 2 + (y - 64) ** 2 < 28 ** 2;
  bitmap.data.set(circle ? [255, 255, 255, 255] : [186, 218, 238, 255], i);
}
const image = PNG.sync.write(bitmap);
let browser: Browser;
let externalAttempts = 0;
before(async () => {
  await mkdir(shots, { recursive: false });
  if (!base) { server = await startRecoveryServer({ root: "dist", port: 0 }); base = server.url; }
  browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
});
after(async () => {
  await browser?.close();
  await server?.close();
  await writeFile(`${shots}/MANIFEST.sha256`, (await Promise.all(captures.map(async (name) => `${createHash("sha256").update(await readFile(`${shots}/${name}`)).digest("hex")}  ${name}\n`))).join(""));
  console.log(`Captured ${captures.length} synthetic screens; external HTTP requests sent: 0; intercepted: ${externalAttempts}`);
});
async function pageFor(language: string, width = 1440, theme = "light-coral") {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.addInitScript((theme) => { localStorage.setItem("worklazy-theme", theme); (window as any).__WORKLAZY_MOCK_PROVIDERS__ = true; }, theme);
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || !/^https?:/u.test(url)) return route.continue();
    externalAttempts++;
    if (/https:\/\/example.com\/(?:img|demo)/u.test(url)) return route.fulfill({ contentType: "image/png", body: image, headers: { "cross-origin-resource-policy": "cross-origin" } });
    return route.abort();
  });
  await page.goto(`${base}/${language}/tools/product-banner/`);
  await page.locator('[data-tool-page="product-banner"]').waitFor();
  return page;
}
async function shot(page: Page, name: string) {
  if (await page.locator('[data-testid="banner-preview"]').count()) await page.locator('[data-testid="banner-preview"]').scrollIntoViewIfNeeded(); await page.evaluate(() => scrollTo(0, 0));
  for (const frame of page.frames()) await frame.waitForFunction(() => Array.from(document.querySelectorAll("img")).filter((image) => !image.closest("li")?.hidden).every((image) => image.complete), undefined, { timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: `${shots}/${name}`, fullPage: true }); captures.push(name);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "page must fit its viewport");
}
async function loadProject(page: Page) {
  const project = stateWith().project;
  const products = project.products.map((p, i) => ({ ...p, name: `Synthetic product ${i + 1}`, productIdNeedsReview: i === 0 }));
  await page.locator('input[accept=".json"]').setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(saveProjectJson({ ...project, products })) });
  await page.locator('[data-testid="banner-product"]').first().waitFor();
}

test("localized empty/data screens at desktop/mobile widths and light/dark themes", async () => {
  for (const language of ["ko", "en"]) for (const width of [1440, 375]) for (const theme of ["light-coral", "dark-coral"]) {
    const page = await pageFor(language, width, theme);
    await page.reload(); await page.locator('[data-tool-page="product-banner"]').waitFor();
    assert.equal(await page.locator("h1").textContent(), language === "ko" ? "상품 배너 만들기" : "Product Banner Builder");
    await shot(page, `${language}-${theme}-${width}-empty.png`);
    await loadProject(page);
    assert.equal(await page.locator('[data-testid="product-id-warning"]').count(), 1);
    await shot(page, `${language}-${theme}-${width}-data.png`);
    await page.close();
  }
});
test("five designs × two previews use the chosen real export, with matching products", async () => {
  const page = await pageFor("en"); await loadProject(page);
  const failures: unknown[] = [];
  for (const design of ["photo-strip", "product-card", "slim", "vertical", "grid"]) {
    await page.getByLabel("Design", { exact: true }).selectOption(design);
    for (const format of ["html", "iframe"]) {
      await page.getByLabel("Preview", { exact: true }).selectOption(format);
      const code = await page.getByLabel("Export code", { exact: true }).inputValue();
      const preview = page.locator('[data-testid="banner-preview"]');
      assert.equal(await preview.getAttribute("sandbox"), BANNER_SANDBOX);
      assert.ok((await preview.getAttribute("srcdoc"))?.includes(code));
      await page.waitForFunction(() => Array.from(document.querySelectorAll('iframe[data-testid="banner-preview"]')).every((e) => (e as HTMLIFrameElement).contentWindow));
      assert.ok(code.includes("Synthetic product 1"));
      assert.ok(code.includes("sponsored noopener"));
      const host = await (await preview.elementHandle())!.contentFrame();
      const banner = format === "iframe" ? await host!.locator("iframe[data-wlpb-frame]").elementHandle().then((element) => element!.contentFrame()) : host;
      await banner!.locator("[data-wlpb-ready]").waitFor();
      assert.equal(await banner!.locator('a[rel="sponsored noopener"]').count(), 3);
      await banner!.waitForFunction(() => Array.from(document.querySelectorAll("img")).filter((image) => !image.closest("li")?.hidden).every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: 2000 }).catch(async () => failures.push({ design, format, images: await banner!.locator("img").evaluateAll((images) => images.map((image) => ({ width: (image as HTMLImageElement).naturalWidth, hidden: (image as HTMLImageElement).hidden }))) }));
      assert.equal(await banner!.locator('a[rel="nofollow noopener"]').getAttribute("href"), "https://worklazy.net/ko/tools/product-banner/");
    }
  }
  await page.getByLabel("Export code", { exact: true }).scrollIntoViewIfNeeded(); await shot(page, "en-export.png");
  await writeFile(`${shots}/preview-image-results.json`, JSON.stringify(failures, null, 2));
  assert.deepEqual(failures, [], "all active product images must load in every real export preview");
  await page.close();
});
test("file mapping, worker import, edits, exclusion, undo and failed export", async () => {
  const page = await pageFor("en");
  const csv = "Image Url,Promotion Url,Product Desc\nhttps://example.com/demo.svg,https://example.com/p/1,Test product";
  await page.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByText("Review column mapping", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Import products in selected order" }).click();
  await page.locator('[data-testid="banner-product"]').waitFor();
  await page.getByLabel("Product name", { exact: true }).fill("Changed name");
  assert.ok((await page.getByLabel("Export code", { exact: true }).inputValue()).includes("Changed name"));
  await page.getByLabel("Image URL", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("alert").waitFor(); await shot(page, "en-error.png");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.ok((await page.getByLabel("Export code", { exact: true }).inputValue()).includes("Changed name"));
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  assert.equal(await page.locator('[data-testid="banner-product"]').count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator('[data-testid="banner-product"]').count(), 1);
  await page.close();
});
test("catalog search, language switch and navigation work protection", async () => {
  const home = await browser.newPage();
  const loaded: string[] = [];
  await home.route("**/*", (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  home.on("request", (request) => loaded.push(request.url()));
  await home.goto(`${base}/en/`); await home.locator(".home-page").waitFor();
  assert.ok(!loaded.some((url) => /ProductBannerPage|input\.worker/u.test(url)), "home must not load banner or parser chunks");
  await home.close();
  const page = await pageFor("ko");
  await page.locator('.wl-topbar select[data-ui-component="language-switcher"]').selectOption("en");
  await page.waitForURL(/\/en\/tools\/product-banner/u);
  await loadProject(page);
  let protectedWork = false;
  page.on("dialog", async (dialog) => { protectedWork = true; await dialog.dismiss(); });
  await page.locator('a[href="/en/tools"]').first().click();
  await page.waitForTimeout(100);
  assert.ok(protectedWork || await page.getByRole("alertdialog").count() > 0);
  assert.ok(page.url().includes("product-banner"));
  await page.close();
  const search = await pageFor("en");
  await search.goto(`${base}/en/tools/`); await search.locator(".all-tools-grid .ui-tool-card").first().waitFor(); await search.locator('[data-testid="tools-search-input"]').fill("affiliate");
  await search.locator('.ui-tool-card[href="/en/tools/product-banner"]').waitFor();
  assert.equal(await search.locator(".ui-tool-card").count(), 1);
  await search.close();
});


test("Korean errors and export, copy fallback and editing-file warning round trip", async () => {
  const page = await pageFor("ko", 375, "dark-coral");
  await loadProject(page);
  await page.getByLabel("이미지 주소", { exact: true }).first().fill("file:///blocked");
  await page.getByRole("alert").waitFor(); await shot(page, "ko-error.png");
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await page.getByRole("button", { name: "HTML 코드 복사", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "편집용 파일 저장", exact: true }).click();
  const file = await download;
  const content = JSON.parse(await readFile((await file.path())!, "utf8"));
  assert.equal(content.products[0].productIdNeedsReview, true);
  assert.equal(content.products[0].productId, "0001");
  await shot(page, "ko-export.png");
  assert.equal(await page.getByText("상품 정보도 자동 갱신되나요?", { exact: true }).count(), 1);
  await page.close();
});
