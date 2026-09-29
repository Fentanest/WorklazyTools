import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { startRecoveryServer } from "./recovery-server.mjs";

// All supplier endpoints are mocked: this test must not create production
// analytics events, ad impressions, affiliate clicks or conversions.
const server = await startRecoveryServer({ root: "dist", port: Number(process.env.ANALYTICS_TEST_PORT || 4186) });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

async function contextWithConsent(consent = "granted", delayed = false, serviceWorkers = "block") {
  const context = await browser.newContext({ serviceWorkers });
  await context.addInitScript((value) => {
    if (value !== "unset") localStorage.setItem("worklazy_privacy_consent_v2", value);
    window.__naverViews = [];
  }, consent);
  let release;
  const held = delayed ? new Promise((resolve) => { release = resolve; }) : null;
  const external = [];
  const supplierHeaders = { "access-control-allow-origin": "*", "cross-origin-resource-policy": "cross-origin" };
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === new URL(server.url).origin) return route.continue();
    external.push(url);
    if (url.startsWith("https://www.googletagmanager.com/gtag/js")) {
      if (held) await held;
      return route.fulfill({ status: 200, contentType: "text/javascript", headers: supplierHeaders, body: "window.__mockGoogleLoaded=true" });
    }
    if (url === "https://wcs.pstatic.net/wcslog.js") {
      if (held) await held;
      return route.fulfill({ status: 200, contentType: "text/javascript", headers: supplierHeaders, body: "window.wcs={event:()=>{}};window.wcs_do=()=>window.__naverViews.push(location.pathname)" });
    }
    if (url.startsWith("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", headers: supplierHeaders, body: "window.adsbygoogle={loaded:true}" });
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  return { context, page, external, release };
}

async function counts(page) {
  return page.evaluate(() => ({
    google: (window.dataLayer || []).filter((entry) => entry[0] === "event" && entry[1] === "page_view").length,
    naver: window.__naverViews.length,
    googleScripts: document.querySelectorAll("script[data-worklazy-google-analytics]").length,
    naverScripts: document.querySelectorAll("script[data-worklazy-naver-analytics]").length,
    adScripts: document.querySelectorAll("script[data-worklazy-adsense]").length,
    views: (window.dataLayer || []).filter((entry) => entry[0] === "event" && entry[1] === "page_view").map((entry) => entry[2]),
  }));
}

try {
  {
    const { context, page, external } = await contextWithConsent();
    try {
      await page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__naverViews.length === 1 && (window.dataLayer || []).some((entry) => entry[0] === "event" && entry[1] === "page_view"));
      assert.deepEqual({ ...await counts(page), views: undefined }, { google: 1, naver: 1, googleScripts: 1, naverScripts: 1, adScripts: 1, views: undefined });
      await page.locator('.sidebar a[href="/ko/tools/pdf-editor"]').click();
      await page.waitForFunction(() => window.__naverViews.length === 2);
      assert.equal((await counts(page)).google, 2);
      await page.goBack();
      await page.waitForFunction(() => window.__naverViews.length === 3);
      assert.equal((await counts(page)).google, 3);
      await page.getByRole("button", { name: "분석·광고 설정" }).click();
      await page.getByRole("button", { name: "필수 기능만 사용" }).click();
      await page.locator('.sidebar a[href="/ko/tools/pdf-editor"]').click();
      await page.waitForURL(/\/ko\/tools\/pdf-editor\/?$/);
      assert.equal((await counts(page)).google, 3);
      assert.equal((await counts(page)).naver, 3);
      await page.getByRole("button", { name: "분석·광고 설정" }).click();
      await page.getByTestId("privacy-consent-accept").click();
      await page.waitForFunction(() => window.__naverViews.length === 4);
      assert.equal((await counts(page)).google, 4);
      const views = (await counts(page)).views;
      assert.ok(views.every((view) => !JSON.stringify(view).includes("secret")));
      assert.equal(external.filter((url) => url.includes("googletagmanager.com/gtag/js")).length, 1);
      assert.equal(external.filter((url) => url.includes("wcs.pstatic.net/wcslog.js")).length, 1);
      console.log("PASS analytics initial, SPA, back, revoke, regrant: GA/Naver 4 views and one script each");
    } finally { await context.close(); }
  }

  {
    const { context, page, external } = await contextWithConsent();
    try {
      const sentinel = "secret-file-and-password-123";
      await page.goto(`${server.url}/ko/tools/pdf-editor/?file=${sentinel}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-tool-page="pdf-editor"]');
      assert.equal((await counts(page)).googleScripts, 0);
      assert.equal((await counts(page)).naverScripts, 0);
      assert.equal((await counts(page)).adScripts, 0);
      assert.ok(external.every((url) => !url.includes(sentinel)));
      console.log("PASS unsafe query: no provider scripts or sentinel in supplier URLs");
    } finally { await context.close(); }
  }

  {
    const { context, page, release } = await contextWithConsent("granted", true);
    try {
      await page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("script[data-worklazy-google-analytics]", { state: "attached" });
      await page.getByRole("button", { name: "분석·광고 설정" }).click();
      await page.getByRole("button", { name: "필수 기능만 사용" }).click();
      release();
      await page.waitForFunction(() => window.__mockGoogleLoaded && window.wcs_do);
      assert.equal((await counts(page)).google, 0);
      assert.equal((await counts(page)).naver, 0);
      assert.equal(await page.evaluate(() => (window.dataLayer || []).filter((entry) => entry[0] === "consent" && entry[1] === "update" && entry[2]?.analytics_storage === "granted").length), 0);
      assert.equal(await page.evaluate(() => (window.dataLayer || []).filter((entry) => entry[0] === "config").length), 0);
      console.log("PASS delayed supplier load after consent withdrawal: zero page views");
    } finally { release(); await context.close(); }
  }

  {
    const { context, page } = await contextWithConsent("unset");
    try {
      await page.addInitScript(() => {
        const read = Storage.prototype.getItem;
        const write = Storage.prototype.setItem;
        Storage.prototype.getItem = function (key) {
          if (String(key).startsWith("worklazy_privacy_consent")) throw new DOMException("Storage denied", "SecurityError");
          return read.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          if (String(key).startsWith("worklazy_privacy_consent")) throw new DOMException("Storage denied", "SecurityError");
          return write.call(this, key, value);
        };
      });
      await page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("privacy-consent-accept").click();
      await page.waitForFunction(() => window.__naverViews?.length === 1 && (window.dataLayer || []).some((entry) => entry[0] === "event" && entry[1] === "page_view"));
      assert.equal((await counts(page)).google, 1);
      console.log("PASS restricted storage: volatile consent enables current screen without crashing");
    } finally { await context.close(); }
  }

  for (const workspace of ["office-editor/app", "excel-merger/xls-preserve"]) {
    const { context, page, external } = await contextWithConsent("granted", false, "allow");
    const documents = [];
    page.on("domcontentloaded", () => { documents.push(page.url()); });
    try {
      await page.goto(`${server.url}/ko/tools/${workspace}/`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.crossOriginIsolated && window.__naverViews?.length === 1 && (window.dataLayer || []).some((entry) => entry[0] === "event" && entry[1] === "page_view"), null, { timeout: 60_000 }).catch(async (error) => {
        console.error("ISOLATED DIAGNOSTIC", workspace, {
          documents,
          external,
          state: await page.evaluate(() => ({
            url: location.href, isolated: crossOriginIsolated, controller: navigator.serviceWorker?.controller?.scriptURL,
            markers: [...document.querySelectorAll("meta[name*=isolation]")].map((node) => node.getAttribute("name")),
            loading: document.querySelectorAll(".tool-route-loading").length,
            google: document.querySelectorAll("script[data-worklazy-google-analytics]").length,
            naver: document.querySelectorAll("script[data-worklazy-naver-analytics]").length,
            dataLayer: (window.dataLayer || []).length, naverViews: window.__naverViews?.length,
          })).catch(() => null),
        });
        throw error;
      });
      const result = await counts(page);
      assert.equal(result.google, 1);
      assert.equal(result.naver, 1);
      assert.equal(result.adScripts, 1);
      assert.equal(external.filter((url) => url.includes("googletagmanager.com/gtag/js")).length, 1);
      assert.equal(external.filter((url) => url.includes("wcs.pstatic.net/wcslog.js")).length, 1);
      assert.ok(documents.length <= 2, `${workspace}: at most one bootstrap reload; documents=${JSON.stringify(documents)}`);
      console.log(`PASS ${workspace}: final isolated document, one GA/Naver page view, one supplier init`);
    } finally { await context.close(); }
  }

  {
    const { context, page } = await contextWithConsent("granted", false, "allow");
    try {
      await page.goto(`${server.url}/ko/tools/excel-merger/`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/service-worker.js"));
      await page.waitForSelector('[data-ui-part="toggle-switch"][aria-label="XLS 수식 보존"]');
      await page.click('[data-ui-part="toggle-switch"][aria-label="XLS 수식 보존"]');
      await page.waitForURL(/\/ko\/tools\/excel-merger\/xls-preserve\//);
      await page.waitForFunction(() => window.crossOriginIsolated && navigator.serviceWorker.controller?.scriptURL.endsWith("/service-worker.js")
        && window.__naverViews?.length === 1 && (window.dataLayer || []).some((entry) => entry[0] === "event" && entry[1] === "page_view"));
      assert.equal((await counts(page)).google, 1);
      assert.equal((await counts(page)).naver, 1);
      console.log("PASS XLS standard-to-preserve: root-worker isolated final document sends one GA/Naver view");
    } finally { await context.close(); }
  }

  {
    const { context, page } = await contextWithConsent();
    try {
      await page.goto(`${server.url}/ko/tools/document-redactor/`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__naverViews?.length === 1 && (window.dataLayer || []).some((entry) => entry[0] === "event" && entry[1] === "page_view"));
      assert.equal((await counts(page)).adScripts, 1);
      assert.equal((await counts(page)).google, 1);
      assert.equal((await counts(page)).naver, 1);
      console.log("PASS redactor CSP document: one GA/Naver page view and AdSense loader");
    } finally { await context.close(); }
  }

  const hwpBytes = Buffer.from((await fs.readFile("tests/fixtures/rhwp-roundtrip-empty.hwp.b64", "utf8")).trim(), "base64");
  for (const [width, height, theme] of [[1365, 900, "light-coral"], [390, 844, "dark-coral"]]) {
    const { context, page } = await contextWithConsent();
    try {
      await page.setViewportSize({ width, height });
      await page.addInitScript((value) => localStorage.setItem("worklazy-theme", value), theme);
      await page.goto(`${server.url}/ko/tools/hwp-editor/`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-tool-page="hwp-editor"] input[type=file]').setInputFiles({ name: "synthetic-hwp.hwp", mimeType: "application/x-hwp", buffer: hwpBytes });
      await page.waitForSelector('[data-testid="hwp-focus-toolbar"]', { timeout: 60_000 });
      await page.waitForSelector(".coupang-banner");
      const layout = await page.evaluate(() => {
        const banner = document.querySelector(".coupang-banner")?.getBoundingClientRect();
        const editor = document.querySelector('[data-tool-page="hwp-editor"]')?.getBoundingClientRect();
        const footer = document.querySelector(".global-footer")?.getBoundingClientRect();
        const frame = document.querySelector(".coupang-banner-frame");
        return { bannerTop: banner?.top, bannerBottom: banner?.bottom, editorBottom: editor?.bottom, footerTop: footer?.top, frameWidth: frame?.getAttribute("width"), disclosure: document.querySelector(".coupang-banner-disclosure")?.textContent };
      });
      assert.ok(layout.bannerTop >= layout.editorBottom - 1 && layout.footerTop >= layout.bannerBottom - 1, JSON.stringify(layout));
      assert.equal(layout.frameWidth, width < 1076 ? "280" : "740");
      assert.equal(layout.disclosure, "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.");
      console.log(`PASS HWP focus ${theme} ${width}px: footer banner outside editor and exact disclosure`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
}
