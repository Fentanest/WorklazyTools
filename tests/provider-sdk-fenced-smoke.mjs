import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { startRecoveryServer } from "./recovery-server.mjs";

// Read the current SDK bytes but never permit the browser to send analytics,
// advertising or affiliate traffic. The only secret in this test is synthetic.
const sdkUrls = {
  google: "https://www.googletagmanager.com/gtag/js?id=G-CFSK50SX9R",
  naver: "https://wcs.pstatic.net/wcslog.js",
};
const sdk = new Map();
const sdkIdentity = {};
for (const [name, url] of Object.entries(sdkUrls)) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${name} SDK must be retrievable`);
  const body = Buffer.from(await response.arrayBuffer());
  const headers = Object.fromEntries(["access-control-allow-origin", "cross-origin-resource-policy"]
    .map((key) => [key, response.headers.get(key)]).filter(([, value]) => value));
  sdk.set(url, { body, headers });
  sdkIdentity[name] = { url, bytes: body.length, sha256: createHash("sha256").update(body).digest("hex"), headers };
  console.log(`${name} SDK: ${body.length} bytes, sha256 ${sdkIdentity[name].sha256}`);
}

const server = await startRecoveryServer({ root: "dist", port: Number(process.env.PROVIDER_SDK_TEST_PORT || 4189) });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
  const egress = [];
  const captureRoute = async (route) => {
    const request = route.request();
    const url = request.url();
    if (new URL(url).origin === new URL(server.url).origin) return route.continue();
    if (sdk.has(url)) {
      const captured = sdk.get(url);
      return route.fulfill({ status: 200, contentType: "text/javascript", headers: captured.headers, body: captured.body });
    }
    egress.push({ url, method: request.method(), headers: request.headers(), body: request.postData() ?? "" });
    return route.abort();
  };
  await context.route("**/*", captureRoute);
  const page = await context.newPage();
  try {
    await page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector('script[data-worklazy-google-analytics][data-loaded="true"]') && typeof window.wcs_do === "function");
    await page.waitForLoadState("networkidle");
    const sentinel = "WL_SYNTHETIC_FILENAME_PASSWORD_CONTENT_4f52";
    const search = page.locator(".wl-topbar .wl-search input");
    await search.fill(sentinel);
    await search.press("Enter");
    await page.waitForFunction((token) => location.pathname.replace(/\/+$/, "") === "/ko/tools" && !location.search && document.querySelector('[data-testid="tools-search-input"]')?.value === token, sentinel);
    await page.waitForLoadState("networkidle");
    await search.fill("");
    await search.press("Enter");
    await page.waitForFunction(() => !document.querySelector('[data-testid="tools-search-input"]')?.value);
    await page.locator('.tool-category-filter button[aria-label^="이미지·오디오"]').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("category") === "media" && document.querySelectorAll(".tool-category-section").length === 1);
    await search.fill("PDF");
    await search.press("Enter");
    await page.waitForFunction(() => !location.search && document.querySelector('[data-testid="tools-search-input"]')?.value === "PDF" && document.querySelector('a.ui-tool-card[href="/ko/tools/pdf-editor"]'));
    await page.waitForLoadState("networkidle");
    const redactor = await context.newPage();
    await redactor.goto(`${server.url}/ko/tools/document-redactor/`, { waitUntil: "domcontentloaded" });
    await redactor.waitForFunction(() => document.querySelector('script[data-worklazy-google-analytics][data-loaded="true"]') && typeof window.wcs_do === "function");
    await redactor.waitForLoadState("networkidle");
    const redactorState = await redactor.evaluate(() => ({
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? "",
      isolated: crossOriginIsolated,
      route: location.pathname,
    }));
    assert.match(redactorState.csp, /script-src 'self'/);
    assert.equal(redactorState.route, "/ko/tools/document-redactor/");
    const legacySearch = await context.newPage();
    await legacySearch.goto(`${server.url}/ko/tools/?q=${encodeURIComponent(sentinel)}`, { waitUntil: "domcontentloaded" });
    await legacySearch.waitForFunction((token) => !location.search && document.querySelector('[data-testid="tools-search-input"]')?.value === token, sentinel);
    await legacySearch.waitForLoadState("networkidle");
    const isolatedPages = [];
    for (const workspace of ["office-editor/app", "excel-merger/xls-preserve"]) {
      const isolatedContext = await browser.newContext({ serviceWorkers: "allow" });
      await isolatedContext.addInitScript(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
      await isolatedContext.route("**/*", captureRoute);
      try {
        const isolatedPage = await isolatedContext.newPage();
        await isolatedPage.goto(`${server.url}/ko/tools/${workspace}/`, { waitUntil: "domcontentloaded" });
        await isolatedPage.waitForFunction(() => crossOriginIsolated && document.querySelector('script[data-worklazy-google-analytics][data-loaded="true"]') && typeof window.wcs_do === "function", null, { timeout: 60_000 });
        await isolatedPage.waitForLoadState("networkidle");
        isolatedPages.push(await isolatedPage.evaluate(() => ({
          route: location.pathname, isolated: crossOriginIsolated,
          controller: navigator.serviceWorker.controller?.scriptURL ?? "",
        })));
      } finally {
        await isolatedContext.close();
      }
    }
    const leaked = egress.filter((entry) => JSON.stringify(entry).includes(sentinel));
    const evidenceDirectory = path.resolve("tests/visual-artifacts/provider-sdk-fenced");
    await fs.mkdir(evidenceDirectory, { recursive: true });
    await fs.writeFile(path.join(evidenceDirectory, "result.json"), JSON.stringify({
      sdkIdentity, browser: await browser.version(), networkRule: "only local dist and exact SDK bytes; all other external requests aborted",
      routes: ["/ko/tools/text-merger/ -> /ko/tools (synthetic query in router state only)", "/ko/tools?category=media -> /ko/tools (new search resets category)", "/ko/tools/?q=<synthetic> -> /ko/tools/ (legacy URL migration)", "/ko/tools/document-redactor/ (direct CSP document)", ...isolatedPages.map((entry) => entry.route)],
      redactorState,
      isolatedPages,
      syntheticToken: sentinel, egress, leakedCount: leaked.length,
    }, null, 2));
    assert.equal(leaked.length, 0, `synthetic user text reached ${leaked.length} blocked supplier requests`);
    const supplierAttempts = egress.filter((entry) => /google|naver|pstatic/.test(new URL(entry.url).hostname));
    console.log(`PASS real SDK fenced: ${egress.length} external requests aborted, ${supplierAttempts.length} analytics attempts, synthetic text in 0 URLs/bodies/headers; redactor CSP and Office/XLS COEP documents loaded both SDKs`);
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
