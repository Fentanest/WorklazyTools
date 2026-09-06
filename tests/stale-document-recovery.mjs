import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { startRecoveryServer } from "./recovery-server.mjs";

const outgoing = path.resolve(process.env.STALE_OLD || "/tmp/worklazy-s0/s0-original");
const incoming = path.resolve(process.env.STALE_NEW || "/tmp/worklazy-s0/variant-source/dist");
const output = path.resolve(process.env.STALE_OUTPUT || "/tmp/worklazy-s0/stale");
const control = process.env.STALE_CONTROL === "1";
const storageThrows = process.env.STALE_STORAGE_THROWS === "1";
const persistent = process.env.STALE_PERSISTENT === "1";
const tools = (process.env.STALE_TOOLS || "hwp-editor,audio-studio,image-studio,data-converter,document-compare").split(",");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const server = await startRecoveryServer({ root: outgoing });
const expectedEntry = (await fs.readFile(path.join(incoming, "en/index.html"), "utf8")).match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
assert.ok(expectedEntry, "incoming build entry identifier");
const summary = [];
try {
  for (const tool of tools) for (const language of ["ko", "en"]) {
    const repetitions = Number(process.env.STALE_REPEATS || (control || persistent || storageThrows ? 1 : ["hwp-editor", "audio-studio"].includes(tool) ? 5 : 3));
    for (let run = 1; run <= repetitions; run++) {
      const name = `${tool}-${language}-${run}`;
      server.state.root = outgoing; server.state.fault = ""; server.state.requests.length = 0;
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: `${language}-${language === "ko" ? "KR" : "US"}`, serviceWorkers: "allow" });
      const record = { tool, language, run, control, storageThrows, persistent, expectedEntry, responses: [], cacheEvents: [], requests: [], storage: [], errors: [] };
      await context.exposeBinding("staleStorage", (_, data) => record.storage.push(data));
      await context.addInitScript(({ storageThrows }) => {
        localStorage.setItem("worklazy_privacy_consent", "denied");
        const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
        Storage.prototype.setItem = function (key, value) {
          const result = set.call(this, key, value);
          if (key.startsWith("worklazy_tool_reload:")) window.staleStorage({ action: "set", key, time: Date.now(), ready: Boolean(document.querySelector("[data-tool-page]")) });
          return result;
        };
        Storage.prototype.removeItem = function (key) {
          if (key.startsWith("worklazy_tool_reload:") && this.getItem(key)) window.staleStorage({ action: "remove", key, time: Date.now(), ready: Boolean(document.querySelector("[data-tool-page]")), loading: Boolean(document.querySelector(".tool-route-loading")) });
          return remove.call(this, key);
        };
        if (storageThrows) Object.defineProperty(window, "sessionStorage", { get() { throw Error("RAW_STORAGE_SECRET"); } });
      }, { storageThrows });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      const mainFrameId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
      // No interception, cache clearing, cache disabling, or manual reload here.
      cdp.on("Network.requestWillBeSent", (event) => record.requests.push({ id: event.requestId, url: event.request.url, type: event.type, time: Date.now(), headers: event.request.headers }));
      cdp.on("Network.responseReceived", ({ requestId, response, type, timestamp, frameId }) => record.responses.push({ requestId, url: response.url, status: response.status, type, mainDocument: type === "Document" && frameId === mainFrameId, timestamp, time: Date.now(), fromDiskCache: response.fromDiskCache || false, fromServiceWorker: response.fromServiceWorker || false, fromPrefetchCache: response.fromPrefetchCache || false, age: response.headers.Age ?? response.headers.age ?? null, cacheControl: response.headers["Cache-Control"] ?? response.headers["cache-control"] }));
      cdp.on("Network.requestServedFromCache", (event) => record.cacheEvents.push({ ...event, time: Date.now() }));
      page.on("pageerror", (error) => record.errors.push(String(error)));
      try {
        await page.goto(`${server.url}/${language}/`);
        await page.locator(".home-page").waitFor();
        // Preserve a real SW/controller when ready, plus existing HTTP and storage state.
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 }).catch(() => {});
        record.before = await page.evaluate(() => ({ entry: document.querySelector('script[type="module"][src]')?.getAttribute("src"), controller: navigator.serviceWorker.controller?.scriptURL }));
        assert.notEqual(record.before.entry, expectedEntry, "two genuinely different build hashes");
        server.state.root = incoming;
        if (persistent) { server.state.fault = "404"; server.state.asset = ({ "audio-studio": "AudioStudioPage-", "hwp-editor": "HwpEditorPage-", "image-studio": "ImageStudioPage-", "data-converter": "DataConverterPage-", "document-compare": "DocumentComparePage-" })[tool]; }
        record.swappedAt = Date.now();
        await page.evaluate((target) => { history.pushState({}, "", target); window.dispatchEvent(new PopStateEvent("popstate")); }, `/${language}/tools/${tool}/`);
        const redirected = language === "en" && tool === "hwp-editor";
        if (control && !redirected) {
          await page.waitForFunction(() => document.querySelector("#root")?.childElementCount === 0, { timeout: 20000 });
          record.outcome = "blank-no-auto-recovery";
        } else {
          await page.waitForFunction(({ tool, redirected }) => Boolean(document.querySelector("[data-route-error], #startup-help:not([hidden])")) || Boolean(document.querySelector(redirected ? ".tools-index-page" : `[data-tool-page="${tool}"]`)), { tool, redirected }, { timeout: 600000 });
          record.outcome = await page.evaluate(({ tool, redirected, expectedEntry }) => {
            if (document.querySelector("[data-route-error]")) return "route-guidance";
            if (document.querySelector("#startup-help:not([hidden])")) return "entry-guidance";
            if (redirected) return "expected-language-redirect";
            return document.querySelector('script[type="module"][src]')?.getAttribute("src") === expectedEntry && document.querySelector(`[data-tool-page="${tool}"]`) ? "latest-tool-ready" : "old-document";
          }, { tool, redirected, expectedEntry });
        }
        record.finishedAt = Date.now();
        await page.waitForTimeout(1000);
        record.reloads = record.responses.filter((item) => item.mainDocument).length - 1;
        record.seconds = (record.finishedAt - record.swappedAt) / 1000;
        record.final = await page.evaluate(() => ({ entry: document.querySelector('script[type="module"][src]')?.getAttribute("src"), build: document.documentElement.dataset.recoveryBuild, rootChildren: document.querySelector("#root")?.childElementCount, mainText: document.querySelector("#main-content")?.innerText || "", text: document.body.innerText, controller: navigator.serviceWorker.controller?.scriptURL, isolated: crossOriginIsolated, caches: null }));
        record.final.caches = await page.evaluate(() => caches.keys());
        assert.ok(record.seconds <= 600); assert.ok(record.reloads <= 1);
        if (!redirected) assert.ok(record.responses.some((item) => item.status === 404 && item.url.endsWith(".js")), "old lazy hash really returned 404");
        if (control && !redirected) { assert.equal(record.reloads, 0); assert.equal(record.final.rootChildren, 0); }
        else if (!redirected) {
          assert.ok(["latest-tool-ready", "route-guidance", "entry-guidance"].includes(record.outcome));
          if (storageThrows || persistent) assert.equal(record.outcome, "route-guidance");
          if (storageThrows) assert.equal(record.reloads, 0);
          if (record.outcome === "latest-tool-ready") {
            const removed = record.storage.filter((item) => item.action === "remove");
            assert.equal(removed.length, 1); assert.ok(removed[0].ready); assert.equal(removed[0].loading, false);
          } else assert.equal(record.storage.filter((item) => item.action === "remove").length, 0);
          assert.ok(record.final.mainText.length > 0 || record.outcome === "entry-guidance");
        }
        await page.screenshot({ path: path.join(output, `${name}.png`) });
        record.pass = true;
      } catch (error) { record.pass = false; record.failure = String(error); throw error; }
      finally {
        record.server = [...server.state.requests];
        await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(record, null, 2));
        const row = { tool, language, run, outcome: record.outcome, reloads: record.reloads, seconds: record.seconds, pass: record.pass, diskCacheResponses: record.responses.filter((item) => item.fromDiskCache).length, serviceWorkerResponses: record.responses.filter((item) => item.fromServiceWorker).length, cacheEvents: record.cacheEvents.length };
        summary.push(row); await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(row)); await context.close();
      }
    }
  }
} finally { await browser.close(); await server.close(); }
