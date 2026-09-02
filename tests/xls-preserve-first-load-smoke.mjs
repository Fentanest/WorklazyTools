import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ExcelJS from "exceljs";
import puppeteer from "puppeteer-core";

const run = promisify(execFile);
const distributionRoot = path.resolve("dist");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-xls-first-load-"));
const serverRequests = [];
const fixturePaths = [];
const videoFixturePath = path.join(temporaryDirectory, "credentialless-worker-check.mp4");

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const resolvedPath = path.resolve(distributionRoot, `.${requestedPath}`);
    const withinDistribution = resolvedPath === distributionRoot || resolvedPath.startsWith(`${distributionRoot}${path.sep}`);
    let filePath = withinDistribution ? resolvedPath : "";
    let status = 200;
    let fallback = false;

    if (!filePath || !(await isFile(filePath))) {
      filePath = path.join(distributionRoot, "404.html");
      status = 404;
      fallback = true;
    }

    const body = await fs.readFile(filePath);
    serverRequests.push({ method: request.method, pathname, status, fallback });
    response.writeHead(status, {
      "Content-Length": body.length,
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Static test server error");
    console.error(error);
  }
});

try {
  for (let index = 1; index <= 4; index += 1) {
    const filePath = path.join(temporaryDirectory, `first-load-${index}.xlsx`);
    await createFixture(filePath, index);
    fixturePaths.push(filePath);
  }
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x159bd7:s=160x90:d=1",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", videoFixturePath,
  ]);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Plain static server did not expose a TCP port.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const fallbackResponse = await fetch(`${baseUrl}/production-fallback-check/`);
  const fallbackProbe = {
    status: fallbackResponse.status,
    body: await fallbackResponse.text(),
    coep: fallbackResponse.headers.get("cross-origin-embedder-policy") || "",
    coop: fallbackResponse.headers.get("cross-origin-opener-policy") || "",
    corp: fallbackResponse.headers.get("cross-origin-resource-policy") || "",
  };
  if (fallbackProbe.status !== 404 || !fallbackProbe.body.includes('name="robots" content="noindex, nofollow"')
    || fallbackProbe.coep || fallbackProbe.coop || fallbackProbe.corp) {
    throw new Error(`The headerless GitHub Pages-style 404 fallback is incomplete: ${JSON.stringify(fallbackProbe)}`);
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    const responseTrace = [];
    const requestFailures = [];
    const pageErrors = [];

    await page.evaluateOnNewDocument(() => {
      const snapshot = (event) => {
        const timeline = JSON.parse(localStorage.getItem("worklazy_xls_coi_timeline") || "[]");
        timeline.push({
          event,
          href: location.href,
          isolated: window.crossOriginIsolated,
          controller: navigator.serviceWorker?.controller?.scriptURL || "",
          time: Date.now(),
        });
        localStorage.setItem("worklazy_xls_coi_timeline", JSON.stringify(timeline.slice(-80)));
      };
      snapshot("document-start");
      document.addEventListener("DOMContentLoaded", () => snapshot("dom-content-loaded"), { once: true });
      window.addEventListener("load", () => snapshot("load"), { once: true });
      navigator.serviceWorker?.addEventListener("controllerchange", () => snapshot("controller-change"));
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => requestFailures.push({
      url: request.url(),
      resourceType: request.resourceType(),
      error: request.failure()?.errorText || "unknown",
    }));
    page.on("response", (response) => {
      const responseUrl = new URL(response.url());
      if (response.request().isNavigationRequest()
        || responseUrl.pathname.endsWith("service-worker.js")
        || responseUrl.pathname.endsWith("coi-serviceworker.js")
        || /\/assets\/excel\.worker-[^/]+\.js$/.test(responseUrl.pathname)
        || /\/tools\/video-studio\/workers\/video-probe\.worker-[^/]+\.js$/.test(responseUrl.pathname)) {
        const headers = response.headers();
        responseTrace.push({
          url: response.url(),
          resourceType: response.request().resourceType(),
          status: response.status(),
          fromServiceWorker: response.fromServiceWorker(),
          coep: headers["cross-origin-embedder-policy"] || "",
          coop: headers["cross-origin-opener-policy"] || "",
          corp: headers["cross-origin-resource-policy"] || "",
        });
      }
    });

    await page.goto(`${baseUrl}/ko/tools/excel-merger/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.ios-switch[aria-label="XLS 수식 보존"]');
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/service-worker.js"));

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click('.ios-switch[aria-label="XLS 수식 보존"]'),
    ]);
    await page.waitForFunction(() => location.pathname === "/ko/tools/excel-merger/xls-preserve/");
    await page.waitForSelector('input[type="file"]');
    const firstEntry = await browserState(page);

    await (await page.$('input[type="file"]')).uploadFile(...fixturePaths);
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll(".excel-file-item")];
      return cards.length === 4 && cards.every((card) => !card.querySelector(".file-security-status.checking"));
    });
    const firstAttempt = await inspectionState(page);
    let afterManualReload = null;

    if (firstAttempt.ready !== 4) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('input[type="file"]');
      await (await page.$('input[type="file"]')).uploadFile(...fixturePaths);
      await page.waitForFunction(() => {
        const cards = [...document.querySelectorAll(".excel-file-item")];
        return cards.length === 4 && cards.every((card) => !card.querySelector(".file-security-status.checking"));
      });
      afterManualReload = {
        browser: await browserState(page),
        inspection: await inspectionState(page),
      };
    }

    let videoCompatibility = null;
    let directEntry = null;
    if (firstAttempt.ready === 4) {
      await page.goto(`${baseUrl}/ko/tools/video-studio/`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.crossOriginIsolated === true);
      await page.waitForSelector(".video-studio-page input[type=file]");
      const probeResponsePromise = page.waitForResponse((response) => response.url().includes("video-probe.worker-"));
      await (await page.$(".video-studio-page input[type=file]")).uploadFile(videoFixturePath);
      await probeResponsePromise;
      await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 1);
      const videoDocumentResponse = [...responseTrace].reverse().find((item) => item.resourceType === "document" && item.url.includes("/tools/video-studio/"));
      const videoWorkerResponse = [...responseTrace].reverse().find((item) => item.url.includes("video-probe.worker-"));
      videoCompatibility = {
        isolated: await page.evaluate(() => window.crossOriginIsolated),
        controller: await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || ""),
        document: videoDocumentResponse,
        worker: videoWorkerResponse,
      };

      const directContext = await browser.createBrowserContext();
      try {
        const directPage = await directContext.newPage();
        directPage.setDefaultTimeout(60_000);
        const requestOffset = serverRequests.length;
        await directPage.goto(`${baseUrl}/en/tools/excel-merger/xls-preserve/?formula=1&format=0`, { waitUntil: "domcontentloaded" });
        await directPage.waitForFunction(() => window.crossOriginIsolated === true
          && navigator.serviceWorker.controller?.scriptURL.endsWith("/coi-serviceworker.js"));
        await directPage.waitForSelector('input[type="file"]');
        directEntry = {
          browser: await browserState(directPage),
          documentRequests: serverRequests.slice(requestOffset).filter((item) => item.pathname === "/en/tools/excel-merger/xls-preserve/"),
        };
      } finally {
        await directContext.close();
      }
    }

    const timeline = await page.evaluate(() => JSON.parse(localStorage.getItem("worklazy_xls_coi_timeline") || "[]"));
    const evidence = {
      fallbackProbe: { ...fallbackProbe, body: "404.html" },
      firstEntry,
      firstAttempt,
      afterManualReload,
      videoCompatibility,
      directEntry,
      serverRequests: serverRequests.filter((item) => item.pathname.includes("xls-preserve") || item.pathname.includes("excel.worker") || item.pathname.includes("video-probe.worker")),
      responseTrace,
      requestFailures,
      pageErrors,
      timeline,
    };
    console.log(`XLS first-load evidence: ${JSON.stringify(evidence, null, 2)}`);

    if (firstEntry.path !== "/ko/tools/excel-merger/xls-preserve/" || firstEntry.status !== "noindex, nofollow") {
      throw new Error(`The generated XLS preservation document was not served: ${JSON.stringify(firstEntry)}`);
    }
    if (firstAttempt.ready !== 4 || firstAttempt.errors.length || firstAttempt.banner) {
      throw new Error(`XLS files did not pass inspection on the first entry without a manual reload: ${JSON.stringify(evidence)}`);
    }
    if (!videoCompatibility?.isolated
      || videoCompatibility.document?.coep !== "credentialless"
      || videoCompatibility.worker?.coep !== "require-corp"
      || videoCompatibility.worker?.corp !== "same-origin") {
      throw new Error(`The credentialless video document could not start its same-origin worker with the hardened response: ${JSON.stringify(videoCompatibility)}`);
    }
    if (!directEntry?.browser.isolated
      || !directEntry.browser.controller.endsWith("/coi-serviceworker.js")
      || directEntry.documentRequests.length !== 2) {
      throw new Error(`Direct XLS preservation entry did not recover with exactly one automatic reload: ${JSON.stringify(directEntry)}`);
    }
    if (requestFailures.length || pageErrors.length) {
      throw new Error(`XLS first-load browser errors: ${JSON.stringify({ requestFailures, pageErrors })}`);
    }
    console.log("XLS preservation first-load smoke passed: four synthetic workbooks inspected without a manual reload on a headerless static server.");
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
  }[extension] || "application/octet-stream";
}

async function createFixture(filePath, index) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Sheet ${index}`);
  sheet.getCell("A1").value = index;
  sheet.getCell("A2").value = index + 1;
  sheet.getCell("A3").value = { formula: "SUM(A1:A2)", result: index * 2 + 1 };
  await workbook.xlsx.writeFile(filePath);
}

async function browserState(page) {
  return page.evaluate(() => ({
    path: location.pathname,
    isolated: crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    controller: navigator.serviceWorker.controller?.scriptURL || "",
    marker: Boolean(document.querySelector('meta[name="worklazy-excel-preserve-isolation"]')),
    status: document.querySelector('meta[name="robots"]')?.content || "",
  }));
}

async function inspectionState(page) {
  return page.evaluate(() => ({
    ready: document.querySelectorAll(".excel-file-item .file-security-status.ready").length,
    errors: [...document.querySelectorAll(".excel-file-item .file-item-error")].map((item) => item.textContent || ""),
    banner: document.querySelector(".error-banner")?.textContent || "",
  }));
}
