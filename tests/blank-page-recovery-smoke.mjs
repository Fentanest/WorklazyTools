import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, devices } from "playwright";
import puppeteer from "puppeteer-core";
import { availableToolRoutes } from "./tool-registry-routes.mjs";
import { startRecoveryServer } from "./recovery-server.mjs";

const output = path.resolve(process.env.RECOVERY_OUTPUT || "/tmp/worklazy-s0/recovery");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const server = await startRecoveryServer({ root: process.env.RECOVERY_DIST || "dist" });
const results = [];
const profiles = process.env.RECOVERY_PROFILE ? [process.env.RECOVERY_PROFILE] : ["desktop", "android"];
const only = process.env.RECOVERY_ONLY;
const rawMarker = "RAW_CONSTRUCTOR_SECRET";
const distributionRoot = server.state.root;

async function attempt(name, profile, action, { storageThrows = false } = {}) {
  if (process.env.RECOVERY_CASE && !name.includes(process.env.RECOVERY_CASE)) return;
  server.state.fault = ""; server.state.asset = "AudioStudioPage-"; server.state.remaining = Infinity;
  server.state.root = distributionRoot;
  server.state.delay = 0; server.state.transform = null; server.state.htmlRoot = null;
  const requestStart = server.state.requests.length;
  const context = await browser.newContext({ ...(profile === "android" ? devices["Pixel 7"] : { viewport: { width: 1365, height: 900 } }), locale: "en-US", serviceWorkers: "allow" });
  const record = { name, profile, start: new Date().toISOString(), network: [], storage: [], navigations: [], errors: [], external: [], helpShown: [] };
  await context.exposeBinding("recordRecovery", (_, event) => { (record[event.kind] ||= []).push(event); });
  await context.addInitScript(({ storageThrows }) => {
    localStorage.setItem("worklazy_privacy_consent", "denied");
    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      const result = originalSet.call(this, key, value);
      if (/^worklazy_(tool_reload|coi_reload):/.test(key)) window.recordRecovery({ kind: "storage", action: "set", key, value, time: Date.now(), ready: Boolean(document.querySelector("[data-tool-page]")), loading: Boolean(document.querySelector(".tool-route-loading")), isolated: crossOriginIsolated && typeof SharedArrayBuffer !== "undefined" });
      return result;
    };
    Storage.prototype.removeItem = function (key) {
      if (/^worklazy_(tool_reload|coi_reload):/.test(key) && this.getItem(key)) window.recordRecovery({ kind: "storage", action: "remove", key, time: Date.now(), ready: Boolean(document.querySelector("[data-tool-page]")), loading: Boolean(document.querySelector(".tool-route-loading")), isolated: crossOriginIsolated && typeof SharedArrayBuffer !== "undefined" });
      return originalRemove.call(this, key);
    };
    if (storageThrows) Object.defineProperty(window, "sessionStorage", { get() { throw new Error("RAW_STORAGE_SECRET"); } });
    new MutationObserver(() => {
      const help = document.querySelector("#startup-help:not([hidden])");
      if (help && !help.dataset.observed) { help.dataset.observed = "true"; window.recordRecovery({ kind: "helpShown", time: Date.now() }); }
    }).observe(document, { subtree: true, attributes: true, childList: true });
  }, { storageThrows });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => record.errors.push(String(error)));
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) record.navigations.push({ url: frame.url(), time: Date.now() }); });
  page.on("request", (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== server.url) record.external.push(request.url()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
      const mainFrameId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
  cdp.on("Network.responseReceived", ({ response, type, timestamp, frameId }) => record.network.push({ url: response.url, status: response.status, type, mainDocument: type === "Document" && frameId === mainFrameId, timestamp, time: Date.now(), fromDiskCache: response.fromDiskCache || false, fromServiceWorker: response.fromServiceWorker || false, fromPrefetchCache: response.fromPrefetchCache || false, age: response.headers.Age ?? response.headers.age ?? null }));
  cdp.on("Network.requestServedFromCache", ({ requestId }) => record.network.push({ requestId, servedFromCache: true, time: Date.now() }));
  cdp.on("Network.loadingFailed", (event) => record.network.push({ ...event, time: Date.now() }));
  try {
    await action({ page, context, cdp, record });
    record.dom = await page.locator("body").innerText();
    assert.ok(record.dom.trim().length, "empty body");
    await page.screenshot({ path: path.join(output, `${profile}-${name}.png`), fullPage: false });
    record.pass = true;
  } catch (error) {
    record.pass = false; record.failure = String(error);
    await page.screenshot({ path: path.join(output, `${profile}-${name}-failed.png`) }).catch(() => {});
    throw error;
  } finally {
    record.end = new Date().toISOString(); record.server = server.state.requests.slice(requestStart);
    results.push(record);
    await fs.writeFile(path.join(output, `${profile}-${name}.json`), JSON.stringify(record, null, 2));
    await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(results.map(({ name, profile, pass, failure, start, end }) => ({ name, profile, pass, failure, start, end })), null, 2));
    await context.close();
    console.log(`${record.pass ? "PASS" : "FAIL"} ${profile} ${name}`);
  }
}

async function home(page, language = "en") {
  await page.goto(`${server.url}/${language}/`);
  await page.locator(".home-page").waitFor();
}
async function navigate(page, target) {
  await page.evaluate((target) => { history.pushState({}, "", target); window.dispatchEvent(new PopStateEvent("popstate")); }, target);
}
async function assertBoundary(page) {
  await page.locator("[data-route-error]").waitFor();
  assert.doesNotMatch(await page.locator("[data-route-error]").innerText(), /RAW_|Worker|worker|chunk|청크|런타임|runtime|Error:|TypeError|stack/);
  assert.equal(await page.locator("[data-route-error]").getAttribute("role"), "alert");
  await page.waitForFunction(() => document.activeElement?.matches("[data-route-error]"));
}
const automaticReloads = (record) => record.network.filter((item) => item.mainDocument).length - 1;

try {
  for (const profile of profiles) {
    if (!only || only === "A") {
      for (const fault of ["404", "disconnect"]) await attempt(`A-repeat-${fault}`, profile, async ({ page, record }) => {
        await home(page); server.state.fault = fault; server.state.delay = fault === "disconnect" ? 750 : 0;
        await navigate(page, "/en/tools/audio-studio/"); await assertBoundary(page);
        await page.waitForTimeout(1000);
        assert.equal(automaticReloads(record), 1, "(a) repeated failure reloads exactly once");
        assert.equal(record.storage.filter((item) => item.action === "set").length, 1);
        assert.equal(record.storage.filter((item) => item.action === "remove").length, 0, "(b) no clearing before success");
        assert.ok(await page.evaluate(() => Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:"))), "guard remains on (d) retry failure");
        record.boundaryDom = await page.locator("[data-route-error]").innerText();
        await page.screenshot({ path: path.join(output, `${profile}-A-repeat-${fault}-boundary.png`) });
        await navigate(page, "/en/tools/text-tools/"); await page.locator('[data-tool-page="text-tools"]').waitFor();
        assert.equal(await page.locator("[data-route-error]").count(), 0, "route navigation resets boundary");
      });
      await attempt("A-storage-throws", profile, async ({ page, record }) => {
        await home(page); server.state.fault = "404";
        await navigate(page, "/en/tools/audio-studio/"); await assertBoundary(page);
        assert.equal(automaticReloads(record), 0, "(c) unavailable storage must not reload");
      }, { storageThrows: true });
      await attempt("A-cached-404", profile, async ({ page, record }) => {
        await home(page); server.state.fault = "404"; server.state.remaining = 1; server.state.delay = 500;
        await navigate(page, "/en/tools/audio-studio/"); await assertBoundary(page);
        assert.equal(automaticReloads(record), 1);
        assert.ok(record.network.some((item) => item.status === 404 && item.fromDiskCache), "negative response remains cached");
        assert.equal(record.storage.filter((item) => item.action === "remove").length, 0);
      });
      await attempt("A-success-clears-only-after-ready", profile, async ({ page, record }) => {
        await home(page);
        await page.evaluate(() => sessionStorage.setItem('worklazy_tool_reload:["/en/tools/audio-studio","/en/tools/audio-studio"]', "pending"));
        server.state.delay = 2000;
        await navigate(page, "/en/tools/audio-studio/");
        await page.locator(".tool-route-loading").waitFor();
        assert.ok(await page.evaluate(() => Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:"))));
        await page.locator('[data-tool-page="audio-studio"]').waitFor();
        await page.waitForFunction(() => !Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:")));
        const removed = record.storage.filter((item) => item.action === "remove");
        assert.equal(removed.length, 1); assert.ok(removed[0].ready); assert.equal(removed[0].loading, false);
      });
      await attempt("A-manual-retry", profile, async ({ page, record }) => {
        await home(page); server.state.fault = "404";
        await navigate(page, "/en/tools/audio-studio/"); await assertBoundary(page);
        server.state.fault = "";
        await page.locator("[data-route-error] button").click();
        await assertBoundary(page);
        assert.equal(automaticReloads(record), 2, "one automatic plus explicit button reload");
      });
    }
    if (!only || only === "B") {
      if (process.env.RECOVERY_STALE_NEW) await attempt("B-stale-html", profile, async ({ page, record }) => {
        server.state.root = path.resolve(process.env.RECOVERY_STALE_NEW);
        server.state.htmlRoot = distributionRoot;
        await page.goto(`${server.url}/en/tools/audio-studio/`);
        await page.locator("#startup-help:not([hidden])").waitFor();
        assert.equal(await page.locator(".app-shell").count(), 0);
        assert.ok(record.network.some((item) => item.status === 404 && /\/assets\/index-.*\.js$/.test(item.url)));
        assert.equal(record.external.length, 0);
      });
      for (const language of ["ko", "en"]) await attempt(`B-entry-${language}`, profile, async ({ page, record }) => {
        server.state.fault = "404"; server.state.asset = "/assets/index-";
        await page.goto(`${server.url}/${language}/tools/audio-studio/`);
        await page.locator("#startup-help:not([hidden])").waitFor();
        assert.equal(await page.locator(".app-shell").count(), 0);
        assert.equal(record.external.length, 0);
        assert.equal(await page.locator(`#startup-help [lang="${language}"]:visible`).count(), 2);
        assert.equal(await page.locator(`#startup-help [lang="${language === "ko" ? "en" : "ko"}"]:visible`).count(), 0);
        record.buttonLabel = await page.locator("#startup-help button").innerText();
        assert.equal(record.buttonLabel, language === "ko" ? "새로고침" : "Refresh");
        assert.equal(await page.locator("#startup-help [data-startup-separator]").isVisible(), false);
        record.detectionMs = record.helpShown[0]?.time - record.network.find((item) => item.status === 404)?.time;
        assert.ok(record.detectionMs >= 0 && record.detectionMs < 2000);
      });
      await attempt("B-slow-normal", profile, async ({ page, record }) => {
        server.state.asset = "/assets/index-"; server.state.delay = 15_000;
        await page.goto(`${server.url}/en/tools/audio-studio/`);
        await page.locator('[data-tool-page="audio-studio"]').waitFor();
        assert.equal(record.helpShown.length, 0, "a slow successful module never displays failure help");
        assert.equal(await page.locator("#startup-help").count(), 0);
      });
      await attempt("B-landing-bilingual", profile, async ({ page, record }) => {
        server.state.fault = "404"; server.state.asset = "/assets/index-";
        await page.goto(server.url);
        await page.locator("#startup-help:not([hidden])").waitFor();
        assert.equal(await page.locator('#startup-help [lang="ko"]:visible').count(), 2);
        assert.equal(await page.locator('#startup-help [lang="en"]:visible').count(), 2);
        record.buttonLabel = await page.locator("#startup-help button").innerText();
        assert.equal(record.buttonLabel, "새로고침 · Refresh");
        assert.equal(await page.locator("#startup-help [data-startup-separator]").isVisible(), true);
        assert.equal(record.external.length, 0);
      });
    }
    if (!only || only === "C") {
      for (const stage of ["regions", "timeline", "waveform"]) await attempt(`C-audio-${stage}`, profile, async ({ page }) => {
        let injected = false;
        server.state.transform = (url, text, bytes) => {
          if (!url.includes("AudioStudioPage-")) return bytes;
          const patterns = { regions: /\b\w+\.create\(\)(?=,\w+=\w+\.create\(\{height:28)/, timeline: /\b\w+\.create\(\{height:28/, waveform: /\b\w+\.create\(\{container:/ };
          assert.ok(patterns[stage].test(text), `missing ${stage} constructor injection site`);
          injected = true;
          return text.replace(patterns[stage], (match) => stage === "regions" ? `(()=>{throw new Error("${rawMarker}")})()` : match.replace(".create(", `.create((()=>{throw new Error("${rawMarker}")})(),`));
        };
        await page.goto(`${server.url}/en/tools/audio-studio/`);
        await page.locator('input[type="file"]').setInputFiles({ name: "recovery.wav", mimeType: "audio/wav", buffer: waveFixture() });
        await assertBoundary(page); assert.ok(injected);
      });
      await attempt("C-image-constructor", profile, async ({ page }) => {
        await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => { throw new Error("RAW_CONSTRUCTOR_SECRET"); }; });
        await page.goto(`${server.url}/en/tools/image-studio/`); await assertBoundary(page);
      });
      for (const tool of ["data-converter", "text-tools", "text-formatter"]) {
        for (const failure of ["constructor", "error", "messageerror"]) await attempt(`C-${tool}-${failure}`, profile, async ({ page }) => {
          await page.addInitScript(({ failure }) => {
            window.Worker = class extends EventTarget {
              constructor() { super(); if (failure === "constructor") throw new Error("RAW_CONSTRUCTOR_SECRET"); }
              postMessage() { setTimeout(() => this[`on${failure}`]?.({ message: "RAW_CONSTRUCTOR_SECRET" }), 50); }
              terminate() {}
            };
          }, { failure });
          await page.goto(`${server.url}/en/tools/${tool}/`);
          const input = tool === "text-formatter" ? "formatter-input" : `${tool}-input`;
          await page.getByTestId(input).fill(tool === "text-formatter" ? '{"a":1}' : "a,b\n1,2");
          if (tool === "text-tools") await page.getByTestId("text-actions").locator("button").first().click();
          else await page.getByRole("button", { name: tool === "data-converter" ? "Convert table data" : "Format with indentation", exact: true }).click();
          if (failure === "constructor") await assertBoundary(page);
          else {
            await page.getByText("This task could not be completed. Try again or refresh the page.", { exact: true }).first().waitFor();
            assert.doesNotMatch(await page.locator("#main-content").innerText(), /RAW_CONSTRUCTOR_SECRET/);
          }
        });
      }
      await attempt("C-audio-handoff", profile, async ({ page }) => {
        await page.addInitScript(() => { window.BroadcastChannel = class { constructor() { throw new Error("RAW_CONSTRUCTOR_SECRET"); } }; });
        await page.goto(`${server.url}/en/tools/audio-studio/?handoff=12345678`);
        await page.locator('[data-tool-page="audio-studio"]').waitFor();
        await page.getByText("The file could not be transferred. Download it and open it here.", { exact: true }).first().waitFor();
        assert.doesNotMatch(await page.locator("#main-content").innerText(), /RAW_CONSTRUCTOR_SECRET/);
      });
      const videoFile = path.join(output, "recovery.mp4");
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=160x90:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", videoFile]);
      for (const stage of ["probe", "processor"]) await attempt(`C-video-${stage}`, profile, async ({ page }) => {
        let injected = false;
        server.state.transform = (url, text, bytes) => {
          if (!url.includes(stage === "probe" ? "video-probe.worker-" : "/video.worker-")) return bytes;
          const pattern = /try\{(\w+)=new (\w+)([;,])/;
          assert.ok(pattern.test(text), "FFmpeg constructor injection site missing");
          injected = true;
          return text.replace(pattern, `try{$1=(()=>{throw new Error("${rawMarker}")})()$3`);
        };
        await page.goto(`${server.url}/en/tools/video-studio/`);
        await page.waitForFunction(() => crossOriginIsolated);
        await page.locator('input[type="file"]').setInputFiles(stage === "probe" ? { name: "broken.mp4", mimeType: "video/mp4", buffer: Buffer.from("broken-video-for-probe") } : videoFile);
        if (stage === "probe") {
          await page.getByText("Unable to read video details.", { exact: false }).first().waitFor();
        } else {
          await page.locator(".video-output-format-grid select").selectOption("gif");
          await page.locator('[data-testid="video-output-actions"] [data-ui-component="primary-button"]').click();
          await page.locator(".ui-operation-progress.ui-status-error").waitFor();
        }
        assert.ok(injected); assert.doesNotMatch(await page.locator("#main-content").innerText(), /RAW_CONSTRUCTOR_SECRET/);
        assert.equal(await page.locator('[data-tool-page="video-studio"]').count(), 1);
      });
      await attempt("C-video-handoff", profile, async ({ page }) => {
        await page.addInitScript(() => { window.BroadcastChannel = class { constructor() { throw new Error("RAW_CONSTRUCTOR_SECRET"); } }; });
        await page.goto(`${server.url}/en/tools/video-studio/`);
        await page.waitForFunction(() => crossOriginIsolated);
        await page.locator('input[type="file"]').setInputFiles(videoFile);
        await page.locator(".video-output-format-grid select").selectOption("mp3");
        await page.locator('[data-testid="video-output-actions"] [data-ui-component="primary-button"]').click();
        await page.locator(".audio-handoff-button").click();
        await page.waitForFunction(() => document.querySelector(".audio-handoff-button")?.disabled);
        await page.getByText("This browser cannot transfer files between tools in memory. Download the file and open it manually in Audio Studio.", { exact: true }).first().waitFor();
        assert.doesNotMatch(await page.locator("#main-content").innerText(), /RAW_CONSTRUCTOR_SECRET/);
      });
    }
    if (!only || only === "normal") {
      for (const language of ["ko", "en"]) for (const tool of availableToolRoutes) await attempt(`normal-${language}-${tool.toolId}`, profile, async ({ page, record }) => {
        await page.goto(`${server.url}/${language}${tool.path.replace(/\/$/, "")}/`);
        if (language === "en" && tool.toolId === "hwp-editor") await page.locator(".tools-index-page").waitFor();
        else if (tool.toolId === "excel-merger") await page.locator(".ui-page-header").waitFor();
        else await page.locator(`[data-tool-page="${tool.toolId}"]`).waitFor();
        assert.equal(await page.locator("[data-route-error]").count(), 0);
        assert.equal(record.helpShown.length, 0);
      });
    }
    if (!only || only === "isolation") {
      for (const tool of ["office-editor/app", "excel-merger/xls-preserve"]) {
        await attempt(`isolation-${tool.replaceAll("/", "-")}`, profile, async ({ page, record }) => {
          await page.goto(`${server.url}/en/tools/${tool}/?sample=1`);
          await page.waitForFunction(() => crossOriginIsolated && typeof SharedArrayBuffer !== "undefined");
          await page.waitForFunction(() => !Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_coi_reload:")));
          assert.equal(automaticReloads(record), 1);
          assert.ok(record.storage.some((item) => item.action === "set" && item.value.endsWith("?sample=1")));
          assert.ok(record.storage.some((item) => item.action === "remove" && item.isolated));
          assert.equal(record.storage.filter((item) => item.key.startsWith("worklazy_tool_reload:")).length, 0);
          assert.equal(record.external.length, 0);
        });
        await attempt(`isolation-storage-${tool.replaceAll("/", "-")}`, profile, async ({ page, record }) => {
          await page.goto(`${server.url}/en/tools/${tool}/`);
          await page.locator(tool === "office-editor/app" ? '[data-tool-page="office-editor-app"]' : ".app-shell .ui-page-header").waitFor();
          await page.waitForTimeout(1000);
          assert.equal(automaticReloads(record), 0);
          assert.equal(record.errors.length, 0);
        }, { storageThrows: true });
      }
      await attempt("isolation-lazy-failure", profile, async ({ page, record }) => {
        server.state.fault = "404"; server.state.asset = "OfficeEditorAppPage-";
        await page.goto(`${server.url}/en/tools/office-editor/app/`);
        await page.waitForFunction(() => crossOriginIsolated);
        await assertBoundary(page);
        assert.equal(automaticReloads(record), 1, "only the document preparation owner reloads");
        assert.equal(record.storage.filter((item) => item.key.startsWith("worklazy_tool_reload:")).length, 0);
        assert.equal(record.external.length, 0);
      });
    }
    if ((!only || only === "crash") && profile === "desktop") await testCrashRestore();
    if (!only || only === "offline") await attempt("offline-full-reload", profile, async ({ page, context, record }) => {
      await home(page);
      // This target document has never been fetched. Offline reload cannot get
      // the HTML containing either the app or its static recovery instructions.
      await page.evaluate(() => history.pushState({}, "", "/en/tools/audio-studio/"));
      await context.setOffline(true);
      const failure = await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 }).then(() => "", (error) => String(error));
      record.offlineFailure = failure;
      record.scope = "HTML unavailable on a fully offline reload: outside the recovery guarantee";
      assert.match(failure, /ERR_INTERNET_DISCONNECTED/);
      await context.setOffline(false);
      // Capture the browser failure separately, then return to an available
      // document so the generic screenshot/DOM collector remains usable.
      await page.screenshot({ path: path.join(output, `${profile}-offline-browser.png`) }).catch(() => {});
      await page.goto(`${server.url}/en/`);
      await page.locator(".home-page").waitFor();
    });
  }
} finally {
  await browser.close(); await server.close();
}
console.log(`Recovery smoke passed: ${results.length} cases. Artifacts: ${output}`);

function waveFixture() {
  const samples = 8000;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 440 / 8000) * 10000), 44 + i * 2);
  return bytes;
}

async function testCrashRestore() {
  // Playwright 1.63 retains its crashed-page state after CDP restoration. The
  // existing Puppeteer dependency can exercise the actual reload and new DOM.
  server.state.root = distributionRoot; server.state.fault = ""; server.state.transform = null;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const record = { name: "crash-restore", profile: "desktop", driver: "puppeteer", start: new Date().toISOString() };
  try {
    const page = await browser.newPage();
    await page.goto(`${server.url}/en/tools/audio-studio/`);
    await page.waitForSelector('[data-tool-page="audio-studio"]');
    const cdp = await page.createCDPSession();
    const crashed = new Promise((resolve) => page.once("error", resolve));
    void cdp.send("Page.crash").catch((error) => { record.crashCommand = String(error); });
    assert.match(String(await crashed), /Page crashed/); record.crashConfirmed = true;
    record.reloadStarted = Date.now();
    await page.reload();
    await page.waitForSelector('[data-tool-page="audio-studio"]');
    record.restoredAt = Date.now(); record.dom = await page.$eval('[data-tool-page="audio-studio"]', (element) => element.innerText);
    assert.ok(record.dom.length > 0);
    await page.screenshot({ path: path.join(output, "desktop-crash-restore.png") });
    record.pass = true;
    console.log("PASS desktop crash-restore (Puppeteer CDP, explicit page.reload)");
  } finally {
    record.end = new Date().toISOString(); results.push(record);
    await fs.writeFile(path.join(output, "desktop-crash-restore.json"), JSON.stringify(record, null, 2));
    await browser.close();
  }
}
