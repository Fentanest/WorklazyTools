import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import { startRecoveryServer } from "./recovery-server.mjs";
import {
  ADSENSE_SCRIPT_URL,
  assertNoRealNetwork,
  createCounters,
  installAdFirewall,
} from "./helpers/ad-stub.mjs";

// WU2 (adsense-recheck-20260919): AdSense eligibility state-transition smoke.
// Fail-closed: every external HTTP(S) request except the exact production
// AdSense script URL is aborted. The exact URL is answered with a local stub.
// Real ad requests / clicks never happen; "allowedExternal" must stay 0.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_DIR = path.join(REPO_ROOT, "tests", "visual-artifacts", "adsense-recheck");
const RESULTS_FILE = path.join(ARTIFACT_DIR, "ad-smoke-results.json");
const DISCRIMINATION_FILE = path.join(ARTIFACT_DIR, "ad-smoke-discrimination.json");
const PORT = Number(process.env.RECOVERY_TEST_PORT || "4182");
const CHROME = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const DISCRIMINATE = process.argv.includes("--discriminate");
const ONLY = (process.argv.find((arg) => arg.startsWith("--only=")) ?? "").slice("--only=".length);
const TEXT_MERGER_CHUNK = "TextMergerPage-";
const unexpectedDialogEvents = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();

function resetServer(server) {
  server.state.fault = "";
  server.state.asset = "AudioStudioPage-";
  server.state.remaining = Infinity;
  server.state.delay = 0;
  server.state.transform = null;
}

function summarizeServerRequests(requests) {
  return requests.map((entry) => ({
    pathname: entry.pathname,
    status: entry.status,
    destination: entry.destination ?? null,
  }));
}

async function newTrackedContext(browser, server, {
  consent = "granted",
  stub = true,
  viewport = null,
  serviceWorkers = "allow",
  dialogPolicy = null,
} = {}) {
  const counters = createCounters();
  const docs = [];
  const dialogs = [];
  const unexpectedDialogs = [];
  const guardEvents = [];
  const pagehideEvents = [];
  const errors = [];
  const context = await browser.newContext({
    locale: "ko-KR",
    serviceWorkers,
    ...(viewport ? { viewport } : { viewport: { width: 1365, height: 900 } }),
  });
  await installAdFirewall(context, server.url, counters, { stub });
  await context.addInitScript((preset) => {
    window.__wlNav = { push: 0, replace: 0 };
    window.__wlSmokeDocumentToken = crypto.randomUUID();
    try {
      const priorPagehide = window.sessionStorage.getItem("__wlSmokePriorPagehide");
      if (priorPagehide) {
        console.debug(`__WL_SMOKE_PAGEHIDE__${priorPagehide}`);
        window.sessionStorage.removeItem("__wlSmokePriorPagehide");
      }
    } catch { /* Console delivery from the source document remains the fallback. */ }
    const originalShowModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function (...args) {
      if (this.dataset.testid === "unsaved-work-dialog") {
        console.debug(`__WL_SMOKE_GUARD__${JSON.stringify({
          documentToken: window.__wlSmokeDocumentToken,
          url: window.location.href,
        })}`);
      }
      return Reflect.apply(originalShowModal, this, args);
    };
    window.addEventListener("pagehide", (event) => {
      const detail = JSON.stringify({
        documentToken: window.__wlSmokeDocumentToken,
        url: window.location.href,
        persisted: event.persisted,
      });
      try {
        window.sessionStorage.setItem("__wlSmokePriorPagehide", detail);
      } catch { /* The live console event remains the fallback. */ }
      console.debug(`__WL_SMOKE_PAGEHIDE__${detail}`);
    });
    for (const name of ["pushState", "replaceState"]) {
      const original = window.history[name].bind(window.history);
      window.history[name] = (...args) => {
        window.__wlNav[name === "pushState" ? "push" : "replace"] += 1;
        return original(...args);
      };
    }
    if (preset !== "unset") {
      try {
        window.localStorage.setItem("worklazy_privacy_consent", preset);
      } catch { /* Storage may be unavailable; consent stays unset. */ }
    }
  }, consent);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  // Document commits: CDP loaderId changes on the main frame. Playwright's
  // framenavigated also fires for same-document history updates, so it must
  // not be used for the S6 "exactly one new document" count. Full loaderIds
  // are compared; only the display is shortened.
  const docCommits = [];
  let mainFrameId = "";
  let cdp = null;
  try {
    cdp = await context.newCDPSession(page);
    await cdp.send("Page.enable");
    mainFrameId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
    cdp.on("Page.frameNavigated", (event) => {
      const frame = event.frame;
      if (frame.id !== mainFrameId) return;
      if (!/^https?:/.test(frame.url)) return;
      const last = docCommits[docCommits.length - 1];
      if (!last || last.loaderId !== frame.loaderId) {
        docCommits.push({ url: frame.url, loaderId: frame.loaderId, loaderShort: String(frame.loaderId).slice(-6), time: now() });
      }
    });
  } catch {
    cdp = null;
  }
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      const url = frame.url();
      if (/^https?:/.test(url)) docs.push({ url, time: now() });
    }
  });
  page.on("console", (message) => {
    const text = message.text();
    for (const [prefix, sink] of [["__WL_SMOKE_GUARD__", guardEvents], ["__WL_SMOKE_PAGEHIDE__", pagehideEvents]]) {
      if (!text.startsWith(prefix)) continue;
      try {
        const parsed = JSON.parse(text.slice(prefix.length));
        if (prefix === "__WL_SMOKE_GUARD__" || !sink.some((entry) => entry.documentToken === parsed.documentToken && entry.url === parsed.url)) {
          sink.push({ ...parsed, time: now() });
        }
      } catch {
        errors.push(`invalid smoke event: ${prefix}`);
      }
    }
  });
  page.on("dialog", async (dialog) => {
    const observed = { type: dialog.type(), message: dialog.message(), time: now() };
    const decision = dialogPolicy?.({ ...observed, index: dialogs.length }) ?? {};
    const expected = decision.expected === true;
    const handling = decision.action === "accept" ? "accept" : "dismiss";
    const entry = { ...observed, expected, handling };
    dialogs.push(entry);
    if (!expected) {
      unexpectedDialogs.push(entry);
      unexpectedDialogEvents.push(entry);
    }
    try {
      if (handling === "accept") await dialog.accept();
      else await dialog.dismiss();
    } catch (error) {
      entry.handlingError = String(error).slice(0, 500);
    }
  });
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 500)));
  return { context, page, cdp, counters, docs, docCommits, dialogs, unexpectedDialogs, guardEvents, pagehideEvents, errors };
}

async function observe(page) {
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    scripts: await page.locator("script[data-worklazy-adsense]").count(),
    loads: await page.evaluate(() => window.__wlAdStub?.loads ?? 0).catch(() => 0),
    routeError: await page.locator("[data-route-error]").count(),
    loading: await page.locator(".tool-route-loading").count(),
    nav: await page.evaluate(() => ({ ...(window.__wlNav ?? { push: 0, replace: 0 }) })).catch(() => ({ push: 0, replace: 0 })),
  };
}

async function waitReady(page, timeout = 30_000) {
  await page.waitForFunction(
    () => !document.querySelector(".tool-route-loading") && !document.querySelector("[data-route-error]"),
    { timeout },
  );
}

async function waitRouteError(page, timeout = 40_000) {
  await page.waitForSelector("[data-route-error]", { timeout });
}

async function screenshot(page, name) {
  const file = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  return path.relative(REPO_ROOT, file);
}

function counterSnapshot(counters) {
  return {
    attempt: counters.attempt,
    stub: counters.stub,
    blocked: counters.blocked,
    blockedAnalytics: counters.blockedAnalytics,
    allowedExternal: counters.allowedExternal,
  };
}

// Runtime provenance recorded with results (plain record, no further claim).
async function buildProvenance() {
  let runHead = "unknown";
  try {
    runHead = execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim() || "unknown";
  } catch {
    // runHead stays "unknown"; recorded as-is.
  }
  let distMtime = "unknown";
  try {
    distMtime = (await fs.stat(path.join(REPO_ROOT, "dist", "index.html"))).mtime.toISOString();
  } catch {
    // distMtime stays "unknown"; recorded as-is.
  }
  return { runHead, distMtime };
}

// Case status vocabulary (PLAN §8): "pass" / "not-applicable" / "unverified" /
// "not-reproduced" / "recorded" / "fail". Only "fail" fails the run; the other
// non-pass states are reported separately and never summed as passes.
async function runCase(name, fn) {
  const started = now();
  const unexpectedStart = unexpectedDialogEvents.length;
  try {
    const detail = await fn();
    const unexpectedDialogs = unexpectedDialogEvents.slice(unexpectedStart);
    assert.equal(unexpectedDialogs.length, 0, `${name}: unexpected native dialogs ${JSON.stringify(unexpectedDialogs)}`);
    const status = detail.status ?? "pass";
    console.log(`${status.toUpperCase()} ${name}`);
    return { name, status, started, ended: now(), ...detail };
  } catch (error) {
    console.log(`FAIL ${name}: ${String(error).split("\n")[0]}`);
    const failureCounters = error && typeof error === "object" && "counters" in error
      ? error.counters
      : undefined;
    return {
      name, status: "fail", started, ended: now(),
      ...(failureCounters !== undefined ? { counters: failureCounters } : {}),
      unexpectedDialogs: unexpectedDialogEvents.slice(unexpectedStart),
      failure: String(error).slice(0, 2000),
    };
  }
}

async function scenarioS1(browser, server) {
  // No/unset or denied consent on an allowed path: no script, no stub.
  const cases = [];
  for (const consent of ["unset", "denied"]) {
    cases.push(await runCase(`S1-${consent}`, async () => {
      resetServer(server);
      const tracked = await newTrackedContext(browser, server, { consent });
      const mark = server.state.requests.length;
      try {
        await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
        await waitReady(tracked.page);
        const obs = await observe(tracked.page);
        assert.equal(obs.scripts, 0, `S1-${consent}: ad script must be absent`);
        assert.equal(obs.loads, 0, `S1-${consent}: stub must not load`);
        assert.equal(tracked.counters.attempt, 0, `S1-${consent}: no ad request attempt`);
        assertNoRealNetwork(tracked.counters, `S1-${consent}`);
        const shot = await screenshot(tracked.page, `S1-${consent}`);
        return { lang: "ko", url: obs.url, status: "pass", note: "script 0, stub 0", scripts: obs.scripts, counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits, serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shot };
      } finally {
        await tracked.context.close();
      }
    }));
  }
  return cases;
}

async function checkS2(browser, server, lang) {
  resetServer(server);
  const tracked = await newTrackedContext(browser, server, { consent: "granted" });
  const mark = server.state.requests.length;
  try {
    await tracked.page.goto(`${server.url}/${lang}/tools/text-merger/`, { waitUntil: "domcontentloaded" });
    await waitReady(tracked.page);
    const obs = await observe(tracked.page);
    assert.equal(obs.scripts, 1, `S2-${lang}: exactly one ad script tag`);
    assert.equal(tracked.counters.attempt, 1, `S2-${lang}: exactly one ad request attempt`);
    assert.equal(tracked.counters.stub, 1, `S2-${lang}: attempt answered by stub`);
    assert.equal(obs.loads, 1, `S2-${lang}: stub loaded once`);
    assertNoRealNetwork(tracked.counters, `S2-${lang}`);
    // Let the .page-enter 0.42s entrance animation finish before capture.
    await sleep(900);
    const shot = await screenshot(tracked.page, `S2-${lang}`);
    return { lang, url: obs.url, status: "pass", note: "script 1, stub 1, real 0", scripts: obs.scripts, loads: obs.loads, counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits, externalLog: tracked.counters.log, serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shot };
  } finally {
    await tracked.context.close();
  }
}

async function scenarioS3(browser, server) {
  return [await runCase("S3-delay", async () => {
    resetServer(server);
    server.state.asset = TEXT_MERGER_CHUNK;
    server.state.delay = 2000;
    server.state.remaining = Infinity;
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    const mark = server.state.requests.length;
    try {
      const t0 = Date.now();
      await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await tracked.page.waitForSelector(".tool-route-loading", { timeout: 15_000 });
      const tLoading = Date.now();
      const during = await observe(tracked.page);
      assert.equal(during.scripts, 0, "S3: no ad script while route is pending");
      await waitReady(tracked.page, 40_000);
      const tReady = Date.now();
      const obs = await observe(tracked.page);
      assert.equal(obs.scripts, 1, "S3: ad script present after load");
      assert.equal(obs.loads, 1, "S3: stub loaded once after load");
      assert.ok(tReady - t0 >= 1800, `S3: injected delay must be observable (ready after ${tReady - t0}ms)`);
      assertNoRealNetwork(tracked.counters, "S3");
      const shot = await screenshot(tracked.page, "S3-ready");
      return {
        lang: "ko", status: "pass", note: "loading observed, then script 1",
        loadingObservedMs: tLoading - t0, readyAfterMs: tReady - t0,
        scriptsDuringLoading: during.scripts, scripts: obs.scripts, loads: obs.loads,
        counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits,
        serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shot,
      };
    } finally {
      resetServer(server);
      await tracked.context.close();
    }
  })];
}

async function scenarioS4(browser, server) {
  return [await runCase("S4-chunk-failure", async () => {
    resetServer(server);
    server.state.asset = TEXT_MERGER_CHUNK;
    server.state.fault = "404";
    server.state.remaining = Infinity;
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    const mark = server.state.requests.length;
    try {
      await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      // S4: After chunk fails → recovery reload fails → error boundary navigates to /error
      // Wait for either: [data-route-error] on same page OR URL change to /error page
      try {
        await Promise.race([
          tracked.page.waitForSelector("[data-route-error]", { timeout: 40_000 }),
          tracked.page.waitForURL((url) => url.pathname === "/ko/error/" || url.pathname === "/ko/error", { timeout: 40_000 }),
        ]);
      } catch (error) {
        return {
          lang: "ko", status: "fail",
          reason: "did not reach error boundary (in-place or /error page)",
          method: "chunk 404 injection + recovery + error boundary",
          docCommits: [...tracked.docCommits],
          serverRequests: summarizeServerRequests(server.state.requests.slice(mark)),
          counters: counterSnapshot(tracked.counters),
        };
      }
      const obs = await observe(tracked.page);
      // Contract: final document must have 0 ad scripts and 0 stubs (regardless of whether error is in-place or on /error)
      assert.equal(obs.scripts, 0, "S4: no ad script in the error document");
      assert.equal(obs.loads, 0, "S4: stub must not load");
      assert.equal(tracked.counters.stub, 0, "S4: no stub served");
      assertNoRealNetwork(tracked.counters, "S4");
      const requests = server.state.requests.slice(mark);
      const chunk404 = requests.filter((entry) => entry.pathname.includes(TEXT_MERGER_CHUNK) && entry.status === 404).length;
      // Contract: chunk must fail on initial load AND after the single recovery reload
      assert.ok(chunk404 >= 2, `S4: chunk must fail on initial load and after the single recovery reload (got ${chunk404})`);
      // Verify recovery reload happened (docCommits shows document reloads)
      const docCount = tracked.docCommits.length;
      const shot = await screenshot(tracked.page, "S4-error");
      return {
        lang: "ko", status: "pass", note: "chunk 404 → recovery reload → error page",
        scripts: obs.scripts, counters: counterSnapshot(tracked.counters),
        docCommits: tracked.docCommits.map((entry) => ({ ...entry })),
        reloads: Math.max(0, docCount - 1),
        chunk404Count: chunk404,
        finalUrl: obs.url,
        serverRequests: summarizeServerRequests(requests),
        evidence: shot,
      };
    } finally {
      resetServer(server);
      await tracked.context.close();
    }
  })];
}

async function moveToExcluded(browser, server, { lang, target, tag }) {
  // Returns the tracked session left open on the excluded page (caller closes).
  resetServer(server);
  const tracked = await newTrackedContext(browser, server, { consent: "granted" });
  const from = `${server.url}/${lang}/tools/text-merger/`;
  await tracked.page.goto(from, { waitUntil: "domcontentloaded" });
  await waitReady(tracked.page);
  const before = await observe(tracked.page);
  assert.equal(before.scripts, 1, `${tag}: ad script must be present before the move`);
  const stubBefore = tracked.counters.stub;
  const commitsBefore = tracked.docCommits.length;
  const mark = server.state.requests.length;
  const href = `/${lang}${target}`;
  const link = tracked.page.locator(`.sidebar a[href="${href}"]`).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
  // Wait for exactly the new document commit (CDP loaderId change).
  const deadline = Date.now() + 30_000;
  while (tracked.docCommits.length < commitsBefore + 1 && Date.now() < deadline) {
    await sleep(250);
  }
  await tracked.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  await tracked.page.waitForFunction(
    () => !document.querySelector(".tool-route-loading") || Boolean(document.querySelector("[data-route-error]")),
    { timeout: 30_000 },
  ).catch(() => {});
  await sleep(1000);
  const after = await observe(tracked.page);
  const movedDocs = tracked.docCommits.slice(commitsBefore).map((entry) => ({ ...entry }));
  assert.equal(movedDocs.length, 1, `${tag}: exactly one new document commit (initial entry excluded), got ${JSON.stringify(movedDocs)}`);
  assert.equal(after.scripts, 0, `${tag}: no ad script in the new document`);
  assert.equal(tracked.counters.stub - stubBefore, 0, `${tag}: no additional stub load`);
  const stableDocs = tracked.docCommits.length;
  await sleep(5000);
  assert.equal(tracked.docCommits.length, stableDocs, `${tag}: no further document swaps during stabilization`);
  const stabilized = await observe(tracked.page);
  assertNoRealNetwork(tracked.counters, tag);
  const requests = server.state.requests.slice(mark);
  const redirects = requests.filter((entry) => entry.status === 301).map((entry) => entry.pathname);
  return {
    tracked, before, after, movedDocs, redirects,
    detail: {
      lang, from: before.url, to: after.url, status: "pass",
      scripts: after.scripts, stubAdded: tracked.counters.stub - stubBefore,
      docCommits: tracked.docCommits.map((entry) => ({ ...entry })),
      // SPA history events are snapshotted per stage: the source document's
      // counters (pre-click), the new document's, and post-stabilization.
      // The click's own pushState may fall on either side of the document
      // swap depending on timing, so no single field claims the whole move.
      spaBeforeClick: { ...before.nav },
      spaNewDoc: { ...after.nav },
      spaStabilized: { ...stabilized.nav },
      serverRedirects301: redirects,
      counters: counterSnapshot(tracked.counters), serverRequests: summarizeServerRequests(requests),
    },
  };
}

async function scenarioS6S7(browser, server) {
  const results = [];
  const moves = [
    { lang: "ko", target: "/tools/hwp-editor", tag: "S6-ko-hwp" },
    { lang: "ko", target: "/tools/document-compare", tag: "S6-ko-doccompare" },
    { lang: "ko", target: "/tools/pdf-editor", tag: "S6-ko-pdf-root" },
    { lang: "en", target: "/tools/document-compare", tag: "S6-en-doccompare" },
    { lang: "en", target: "/tools/pdf-editor", tag: "S6-en-pdf-root" },
  ];
  // Only the exact /tools/pdf-editor/merge route lacks an SPA link (sidebar
  // catalog, /{lang}/tools/ index, text-merger page, and the pdf-editor
  // internal nav all lack it). The PDF path family IS reachable via the
  // /tools/pdf-editor root NavLink, covered by S6-ko/en-pdf-root below.
  // Direct entry is covered by S8 (KO root/ocr, EN merge).
  results.push(await runCase("S6-ko-merge", async () => {
    resetServer(server);
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    try {
      await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await waitReady(tracked.page);
      const onTool = await tracked.page.locator('a[href$="/tools/pdf-editor/merge"]').count();
      await tracked.page.goto(`${server.url}/ko/tools/`, { waitUntil: "domcontentloaded" });
      await sleep(2000);
      const onIndex = await tracked.page.locator('a[href$="/tools/pdf-editor/merge"]').count();
      assert.equal(onTool + onIndex, 0, "S6-ko-merge: no SPA link to the merge route is expected");
      assertNoRealNetwork(tracked.counters, "S6-ko-merge");
      return {
        lang: "ko",
        status: "not-applicable",
        reason: "no SPA link to the exact /tools/pdf-editor/merge route (PDF family move covered by S6-ko/en-pdf-root; direct entry by S8)",
        mergeLinksOnAllowedPage: onTool, mergeLinksOnToolsIndex: onIndex,
        counters: counterSnapshot(tracked.counters), docCommits: [...tracked.docCommits],
      };
    } finally {
      await tracked.context.close();
    }
  }));
  let s7Session = null;
  for (const move of moves) {
    const outcome = await runCase(move.tag, async () => {
      const { tracked, detail } = await moveToExcluded(browser, server, move);
      const shot = await screenshot(tracked.page, move.tag);
      if (move.tag === "S6-ko-hwp") s7Session = tracked;
      else await tracked.context.close();
      return { ...detail, evidence: shot };
    });
    results.push(outcome);
    if (outcome.status === "fail" && s7Session) {
      await s7Session.context.close().catch(() => {});
      s7Session = null;
    }
  }
  // S7: back navigation from the excluded document to the allowed path.
  results.push(await runCase("S7-back", async () => {
    assert.ok(s7Session, "S7 requires the S6-ko-hwp session");
    const { page, counters, docCommits } = s7Session;
    const docsBefore = docCommits.length;
    try {
      await page.goBack({ timeout: 30_000 });
      await page.waitForURL(/\/tools\/text-merger/, { timeout: 30_000 });
      await waitReady(page, 30_000);
      const obs = await observe(page);
      assert.equal(obs.scripts, 1, "S7: ad script is re-inserted on return (policy)");
      assert.ok(obs.scripts <= 1, "S7: no duplicate ad script tags");
      assertNoRealNetwork(counters, "S7");
      const shot = await screenshot(page, "S7-back");
      return {
        lang: "ko", status: "pass",
        scripts: obs.scripts, loads: obs.loads,
        docCommits: docCommits.map((entry) => ({ ...entry })), newCommits: docCommits.length - docsBefore,
        spaMoves: { ...obs.nav }, counters: counterSnapshot(counters), evidence: shot,
      };
    } finally {
      await s7Session.context.close();
    }
  }));
  return results;
}

const S8_ENTRIES = [
  { path: "/ko/tools/pdf-editor/" },
  { path: "/ko/tools/pdf-editor/ocr/" },
  { path: "/ko/tools/hwp-editor/" },
  { path: "/ko/tools/document-compare/" },
  { path: "/ko/tools/document-compare/results/1/", expiredMarker: '[data-testid="document-expired-result"]' },
  { path: "/ko/tools/pdf-compare/" },
  { path: "/ko/tools/office-editor/app/" },
  { path: "/ko/tools/excel-merger/xls-preserve/" },
  { path: "/ko/tools/video-studio/" },
  { path: "/ko/tools/video-studio/trim/" },
  { path: "/ko/tools/document-redactor/" },
  { path: "/en/tools/pdf-editor/merge/" },
  { path: "/en/tools/document-compare/" },
];

async function scenarioS8(browser, server) {
  const results = [];
  for (const entry of S8_ENTRIES) {
    const tag = `S8-${entry.path.replaceAll("/", "_")}`;
    results.push(await runCase(tag, async () => {
      resetServer(server);
      const tracked = await newTrackedContext(browser, server, { consent: "granted" });
      const mark = server.state.requests.length;
      try {
        await tracked.page.goto(`${server.url}${entry.path}`, { waitUntil: "domcontentloaded" });
        await tracked.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
        await sleep(4000);
        const obs = await observe(tracked.page);
        const isolation = await tracked.page.evaluate(() => ({
          video: Boolean(document.querySelector('meta[name="worklazy-video-isolation"]')),
          office: Boolean(document.querySelector('meta[name="worklazy-office-isolation"]')),
          excel: Boolean(document.querySelector('meta[name="worklazy-excel-preserve-isolation"]')),
          redactor: Boolean(document.querySelector('meta[name="worklazy-redactor-isolation"]')),
          coi: window.crossOriginIsolated ?? null,
          swController: navigator.serviceWorker?.controller?.scriptURL ?? null,
        })).catch(() => ({}));
        const bodyText = await tracked.page.locator("body").innerText().catch(() => "");
        const is404Title = /^Page not found/i.test(obs.title);
        const expired = entry.expiredMarker ? await tracked.page.locator(entry.expiredMarker).count() : 0;
        assert.equal(obs.scripts, 0, `${tag}: no ad script`);
        assert.equal(tracked.counters.attempt, 0, `${tag}: no ad request attempt`);
        assert.equal(tracked.counters.stub, 0, `${tag}: no stub served`);
        assert.ok(!is404Title, `${tag}: the app must boot (got 404 document title)`);
        if (entry.expiredMarker) {
          assert.ok(expired >= 1, `${tag}: session-expired notice must be shown`);
        } else {
          const booted = bodyText.trim().length > 200 || obs.loading > 0 || obs.routeError > 0;
          assert.ok(booted, `${tag}: empty screen must not count as success`);
        }
        assertNoRealNetwork(tracked.counters, tag);
        const shot = await screenshot(tracked.page, tag);
        return {
          path: entry.path, finalUrl: obs.url, status: "pass", note: entry.expiredMarker ? "expired notice, script 0" : "script 0, stub 0",
          scripts: obs.scripts, expiredMarkerCount: expired, isolation,
          loading: obs.loading, routeError: obs.routeError, bodyChars: bodyText.trim().length,
          counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits,
          dialogs: tracked.dialogs, pageErrors: tracked.errors.slice(0, 3),
          serverRequests: summarizeServerRequests(server.state.requests.slice(mark)).slice(0, 12), evidence: shot,
        };
      } finally {
        await tracked.context.close();
      }
    }));
  }
  return results;
}

async function readS9State(tracked) {
  return tracked.page.evaluate(() => ({
    url: window.location.href,
    documentToken: window.__wlSmokeDocumentToken ?? null,
    items: document.querySelectorAll('[data-testid="text-merger-item"]').length,
    scripts: document.querySelectorAll("script[data-worklazy-adsense]").length,
    stubLoads: window.__wlAdStub?.loads ?? 0,
  }));
}

async function setupS9Source(tracked, server, { work = true, ads = true } = {}) {
  resetServer(server);
  const requestMark = server.state.requests.length;
  await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
  await waitReady(tracked.page);
  const initial = await readS9State(tracked);
  assert.equal(initial.scripts, ads ? 1 : 0, "S9 setup: source ad script policy");
  assert.equal(tracked.counters.stub, ads ? 1 : 0, "S9 setup: source stub policy");
  if (work) {
    await tracked.page.locator('input[type="file"]').setInputFiles({
      name: "synthetic.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("synthetic content\n", "utf8"),
    });
    await tracked.page.waitForFunction(
      () => document.querySelectorAll('[data-testid="text-merger-item"]').length === 2,
      { timeout: 15_000 },
    );
    const fileItem = tracked.page.locator('[data-testid="text-merger-item"]').last();
    await fileItem.locator('[data-testid="text-merger-preview"]').click();
    const fileEditor = fileItem.locator('[data-testid="text-merger-editor"] textarea');
    await fileEditor.fill("synthetic revised content");
    await fileItem.locator('[data-testid="text-merger-meta"] b').waitFor({ state: "visible" });
  }
  return {
    requestMark,
    state: await readS9State(tracked),
    commitCount: tracked.docCommits.length,
    guardCount: tracked.guardEvents.length,
    stubCount: tracked.counters.stub,
  };
}

async function openS9Guard(tracked, href = "/ko/tools/pdf-editor") {
  const link = tracked.page.locator(`a[href="${href}"]`).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
  const dialog = tracked.page.locator('[data-testid="unsaved-work-dialog"][open]');
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  await tracked.page.locator('[data-testid="unsaved-stay"]').waitFor({ state: "visible" });
  await tracked.page.locator('[data-testid="unsaved-leave"]').waitFor({ state: "visible" });
  return dialog;
}

function destinationDocumentRequests(server, requestMark, pathPrefix = "/ko/tools/pdf-editor") {
  return server.state.requests.slice(requestMark).filter((entry) => (
    entry.destination === "document" && entry.pathname.startsWith(pathPrefix)
  ));
}

async function waitForS9Destination(tracked, pathname, priorCommitCount) {
  await tracked.page.waitForURL((url) => url.pathname === pathname || url.pathname === `${pathname}/`, { timeout: 30_000 });
  const deadline = Date.now() + 30_000;
  while (tracked.docCommits.length < priorCommitCount + 1 && Date.now() < deadline) {
    await sleep(100);
  }
  assert.ok(tracked.docCommits.length >= priorCommitCount + 1, `S9: destination did not commit a new document for ${pathname}`);
  await tracked.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  await waitReady(tracked.page);
}

async function scenarioS9(browser, server) {
  const results = [];

  results.push(await runCase("S9-T1-stay", async () => {
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    try {
      const before = await setupS9Source(tracked, server);
      await openS9Guard(tracked);
      assert.equal(tracked.guardEvents.length - before.guardCount, 1, "T1: confirmation opens exactly once");
      await tracked.page.locator('[data-testid="unsaved-stay"]').click();
      await sleep(300);
      const after = await readS9State(tracked);
      assert.equal(after.url, before.state.url, "T1: stay preserves URL");
      assert.equal(after.documentToken, before.state.documentToken, "T1: stay preserves document");
      assert.equal(tracked.docCommits.length, before.commitCount, "T1: stay creates no document commit");
      assert.equal(after.items, before.state.items, "T1: stay preserves text items");
      assert.equal(destinationDocumentRequests(server, before.requestMark).length, 0, "T1: no destination document request");
      assert.equal(tracked.unexpectedDialogs.length, 0, "T1: no unexpected native dialog");
      assertNoRealNetwork(tracked.counters, "S9-T1");
      return { status: "pass", confirmations: 1, items: after.items, docCommits: [...tracked.docCommits], dialogs: tracked.dialogs };
    } finally {
      await tracked.context.close();
    }
  }));

  results.push(await runCase("S9-T2-escape", async () => {
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    try {
      const before = await setupS9Source(tracked, server);
      await openS9Guard(tracked);
      await tracked.page.keyboard.press("Escape");
      await tracked.page.locator('[data-testid="unsaved-work-dialog"][open]').waitFor({ state: "hidden" });
      const after = await readS9State(tracked);
      assert.equal(tracked.guardEvents.length - before.guardCount, 1, "T2: confirmation opens exactly once");
      assert.equal(after.url, before.state.url, "T2: Escape preserves URL");
      assert.equal(after.documentToken, before.state.documentToken, "T2: Escape preserves document");
      assert.equal(tracked.docCommits.length, before.commitCount, "T2: Escape creates no document commit");
      assert.equal(after.items, before.state.items, "T2: Escape preserves text items");
      assert.equal(destinationDocumentRequests(server, before.requestMark).length, 0, "T2: no destination document request");
      assert.equal(tracked.unexpectedDialogs.length, 0, "T2: no unexpected native dialog");
      assertNoRealNetwork(tracked.counters, "S9-T2");
      return { status: "pass", confirmations: 1, items: after.items, docCommits: [...tracked.docCommits], dialogs: tracked.dialogs };
    } finally {
      await tracked.context.close();
    }
  }));

  results.push(await runCase("S9-T3-leave", async () => {
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    try {
      const before = await setupS9Source(tracked, server);
      await openS9Guard(tracked);
      await tracked.page.locator('[data-testid="unsaved-leave"]').click();
      await waitForS9Destination(tracked, "/ko/tools/pdf-editor", before.commitCount);
      await tracked.page.locator('[data-testid="pdf-navigation-shell"]').waitFor({ state: "visible" });
      const after = await readS9State(tracked);
      const newCommits = tracked.docCommits.slice(before.commitCount);
      assert.equal(tracked.guardEvents.length - before.guardCount, 1, "T3: confirmation opens exactly once");
      assert.equal(tracked.unexpectedDialogs.length, 0, "T3: approved leave has no native dialog");
      assert.equal(newCommits.length, 1, "T3: exactly one new main-frame document");
      assert.notEqual(after.documentToken, before.state.documentToken, "T3: destination has a new document token");
      assert.equal(tracked.pagehideEvents.length, 1, "T3: source document emitted pagehide");
      assert.equal(after.scripts, 0, "T3: destination has no ad script");
      assert.equal(after.stubLoads, 0, "T3: destination document did not execute the source stub");
      assert.equal(tracked.counters.stub - before.stubCount, 0, "T3: no destination stub request");
      assert.equal(await tracked.page.locator("[data-route-error], .tool-route-loading").count(), 0, "T3: destination is ready, not error/loading UI");
      assert.ok(destinationDocumentRequests(server, before.requestMark).length >= 1, "T3: destination document was requested");
      assertNoRealNetwork(tracked.counters, "S9-T3");
      const shot = await screenshot(tracked.page, "S9-T3-leave");
      return {
        status: "pass", confirmations: 1, nativeDialogs: tracked.dialogs,
        pagehide: tracked.pagehideEvents, sourceDocumentToken: before.state.documentToken,
        destinationDocumentToken: after.documentToken, newCommits, scripts: after.scripts,
        stubAdded: tracked.counters.stub - before.stubCount, evidence: shot,
      };
    } finally {
      await tracked.context.close();
    }
  }));

  results.push(await runCase("S9-T4-no-work", async () => {
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    try {
      const before = await setupS9Source(tracked, server, { work: false });
      await tracked.page.locator('a[href="/ko/tools/pdf-editor"]').first().click();
      await waitForS9Destination(tracked, "/ko/tools/pdf-editor", before.commitCount);
      const after = await readS9State(tracked);
      assert.equal(tracked.guardEvents.length - before.guardCount, 0, "T4: no confirmation without work");
      assert.equal(tracked.docCommits.length - before.commitCount, 1, "T4: exactly one required new document");
      assert.equal(after.scripts, 0, "T4: destination has no ad script");
      assert.equal(tracked.unexpectedDialogs.length, 0, "T4: no unexpected native dialog");
      assertNoRealNetwork(tracked.counters, "S9-T4");
      return { status: "pass", confirmations: 0, newCommits: tracked.docCommits.slice(before.commitCount), scripts: after.scripts };
    } finally {
      await tracked.context.close();
    }
  }));

  results.push(await runCase("S9-T5-no-consent", async () => {
    const tracked = await newTrackedContext(browser, server, { consent: "unset" });
    try {
      const before = await setupS9Source(tracked, server, { ads: false });
      await openS9Guard(tracked);
      await tracked.page.locator('[data-testid="unsaved-leave"]').click();
      await waitForS9Destination(tracked, "/ko/tools/pdf-editor", before.commitCount);
      const after = await readS9State(tracked);
      assert.equal(tracked.guardEvents.length - before.guardCount, 1, "T5: confirmation is independent of consent");
      assert.equal(tracked.docCommits.length - before.commitCount, 1, "T5: excluded path keeps full-document policy");
      assert.equal(after.scripts, 0, "T5: destination has no ad script");
      assert.equal(tracked.unexpectedDialogs.length, 0, "T5: no unexpected native dialog");
      assertNoRealNetwork(tracked.counters, "S9-T5");
      return { status: "pass", confirmations: 1, newCommits: tracked.docCommits.slice(before.commitCount), scripts: after.scripts };
    } finally {
      await tracked.context.close();
    }
  }));

  results.push(await runCase("S9-T6-retry-double-click", async () => {
    const retry = await newTrackedContext(browser, server, { consent: "granted" });
    let retryDetail;
    try {
      const before = await setupS9Source(retry, server);
      await openS9Guard(retry, "/ko/tools/pdf-editor");
      await retry.page.locator('[data-testid="unsaved-stay"]').click();
      await openS9Guard(retry, "/ko/tools/document-compare");
      await retry.page.locator('[data-testid="unsaved-leave"]').click();
      await waitForS9Destination(retry, "/ko/tools/document-compare", before.commitCount);
      assert.equal(retry.guardEvents.length - before.guardCount, 2, "T6 retry: each intent opens one confirmation");
      assert.equal(retry.docCommits.length - before.commitCount, 1, "T6 retry: only approved retry navigates");
      assert.ok(retry.page.url().includes("/tools/document-compare"), "T6 retry: stale PDF target is not used");
      assert.equal(retry.unexpectedDialogs.length, 0, "T6 retry: no unexpected native dialog");
      retryDetail = { target: new URL(retry.page.url()).pathname, newCommits: retry.docCommits.slice(before.commitCount) };
      assertNoRealNetwork(retry.counters, "S9-T6-retry");
    } finally {
      await retry.context.close();
    }

    const doubled = await newTrackedContext(browser, server, { consent: "granted" });
    try {
      const before = await setupS9Source(doubled, server);
      await openS9Guard(doubled);
      await doubled.page.locator('[data-testid="unsaved-leave"]').evaluate((button) => {
        button.click();
        button.click();
      });
      await waitForS9Destination(doubled, "/ko/tools/pdf-editor", before.commitCount);
      await sleep(500);
      assert.equal(doubled.docCommits.length - before.commitCount, 1, "T6 double click: one document navigation");
      assert.ok(doubled.page.url().includes("/tools/pdf-editor"), "T6 double click: approved target is retained");
      assert.equal(doubled.unexpectedDialogs.length, 0, "T6 double click: no unexpected native dialog");
      assertNoRealNetwork(doubled.counters, "S9-T6-double");
      return { status: "pass", retry: retryDetail, doubleClickCommits: doubled.docCommits.slice(before.commitCount), dialogs: doubled.dialogs };
    } finally {
      await doubled.context.close();
    }
  }));

  results.push(await runCase("S9-T7-unapproved-reload", async () => {
    const tracked = await newTrackedContext(browser, server, {
      consent: "granted",
      dialogPolicy: ({ type, index }) => ({
        expected: type === "beforeunload" && index < 2,
        action: index === 0 ? "dismiss" : "accept",
      }),
    });
    try {
      const before = await setupS9Source(tracked, server);
      await tracked.page.reload({ waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => null);
      await sleep(300);
      const stayed = await readS9State(tracked);
      assert.equal(tracked.dialogs.length, 1, "T7: dismiss observes one beforeunload dialog");
      assert.equal(tracked.dialogs[0].type, "beforeunload", "T7: reload guard is beforeunload");
      assert.equal(stayed.documentToken, before.state.documentToken, "T7: dismiss preserves document");
      assert.equal(stayed.items, before.state.items, "T7: dismiss preserves work");
      assert.equal(tracked.docCommits.length, before.commitCount, "T7: dismiss cancels reload");

      await tracked.page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      await waitReady(tracked.page);
      const reloaded = await readS9State(tracked);
      assert.equal(tracked.dialogs.length, 2, "T7: accept observes a second beforeunload dialog");
      assert.equal(tracked.dialogs[1].type, "beforeunload", "T7: accepted reload is protected");
      assert.notEqual(reloaded.documentToken, before.state.documentToken, "T7: accept reloads the document");
      assert.equal(tracked.docCommits.length - before.commitCount, 1, "T7: accept creates one reload commit");
      assert.equal(tracked.unexpectedDialogs.length, 0, "T7: explicitly expected dialogs only");
      assertNoRealNetwork(tracked.counters, "S9-T7");
      return { status: "pass", dialogs: tracked.dialogs, dismissedTokenPreserved: true, newCommits: tracked.docCommits.slice(before.commitCount) };
    } finally {
      await tracked.context.close();
    }
  }));

  return results;
}

async function scenarioS5(browser, server) {
  // S5: Render error in an already-initialized ad context (same-document error).
  // Contract: Route to dedicated /error page (ad-free, RouteErrorBoundary-free).
  // Verification:
  // - Error triggers navigation to /ko/error (new document, not same-document)
  // - Final document has 0 ad scripts (no AdSenseLoader in error page)
  // - Navigation occurs exactly once (sessionStorage marker prevents loop)
  const CHUNK_PREFIX = "QrBulkPanel-";
  const ANCHOR = '"data-testid":"qr-bulk-page"';
  const THROW_EXPR = '(window.__wlForceRenderError?(()=>{throw new Error("WU2-S5-INJECTED-RENDER")})():"qr-bulk-page")';
  return [await runCase("S5-same-url-error", async () => {
    resetServer(server);
    const distAssets = await fs.readdir(path.join(REPO_ROOT, "dist", "assets"));
    const chunk = distAssets.find((f) => f.startsWith(CHUNK_PREFIX) && f.endsWith(".js"));
    assert.ok(chunk, "S5: QrBulkPanel chunk missing in dist");
    const built = await fs.readFile(path.join(REPO_ROOT, "dist", "assets", chunk), "utf8");
    assert.ok(built.split(ANCHOR).length - 1 >= 1, "S5: injection anchor missing in built chunk");
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    const mark = server.state.requests.length;
    try {
      // Start at qr-studio to initialize ads, then trigger error.
      await tracked.page.goto(`${server.url}/ko/tools/qr-studio/`, { waitUntil: "domcontentloaded" });
      await waitReady(tracked.page);
      const settled = await tracked.page.waitForSelector('[data-testid="qr-preview"][data-ready="true"]', { timeout: 20_000 }).then(() => true).catch(() => false);
      if (!settled) await sleep(3000);
      const before = await observe(tracked.page);
      assert.equal(before.scripts, 1, "S5-setup: ad script must be present");
      assert.equal(before.loads, 1, "S5-setup: stub loaded once");
      assert.equal(tracked.docCommits.length, 1, "S5-setup: single initial document");

      // Inject render error into QrBulkPanel chunk.
      server.state.asset = CHUNK_PREFIX;
      server.state.transform = (pathname, text) => (
        pathname.includes(CHUNK_PREFIX) ? text.split(ANCHOR).join(`"data-testid":${THROW_EXPR}`) : text
      );
      await tracked.page.evaluate(() => { window.__wlForceRenderError = true; });
      await tracked.page.locator('[data-testid="qr-mode"] button').nth(1).click();

      // Wait for automatic navigation to /error page.
      try {
        await tracked.page.waitForURL((url) => url.pathname === "/ko/error/" || url.pathname === "/ko/error", { timeout: 30_000 });
      } catch (error) {
        const diag = await tracked.page.evaluate(() => ({
          url: window.location.href,
          pathname: window.location.pathname,
          docCommits: "not-available",
          errorMarker: document.querySelector("[data-route-error]")?.textContent?.slice(0, 50),
        })).catch(() => ({}));
        return {
          lang: "ko", status: "fail",
          reason: "did not navigate to /error after render error",
          method: "render-error injection + auto-navigation (attempted)",
          diag,
          counters: counterSnapshot(tracked.counters),
          docCommits: [...tracked.docCommits],
          serverRequests: summarizeServerRequests(server.state.requests.slice(mark)),
        };
      }

      // Verify final state.
      await tracked.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
      await sleep(500);

      const after = await observe(tracked.page);
      assertNoRealNetwork(tracked.counters, "S5");

      // Contract verification:
      // 1. New document (URL changed to /error)
      assert.ok(after.url.includes("/ko/error"), "S5: must navigate to /error");
      // 2. Two document commits (original + error page)
      assert.equal(tracked.docCommits.length, 2, "S5: must have 2 documents (tool + error page)");
      // 3. No ad scripts on the final page
      assert.equal(after.scripts, 0, "S5-contract: final document must have 0 ad scripts");
      // 4. No new stub loads (ad not initialized on error page)
      const stubAdded = tracked.counters.stub - 1; // 1 from initial qr-studio load
      assert.equal(stubAdded, 0, "S5: no new stub loads after navigation");

      await sleep(500);
      const shotAfter = await screenshot(tracked.page, "S5-error");
      return {
        lang: "ko", status: "pass",
        method: "render-error injection into QrBulkPanel chunk + auto-navigation to /error",
        contract: {
          requirement: "render error in initialized ad context → navigate to ad-free error page → final scripts = 0",
          urlChanged: `qr-studio → ${after.url}`,
          documentNavigations: tracked.docCommits.length,
          finalScripts: after.scripts,
        },
        counters: counterSnapshot(tracked.counters), docs: [...tracked.docs], docCommits: [...tracked.docCommits],
        pageErrors: tracked.errors.slice(0, 3),
        serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shotAfter,
      };
    } finally {
      resetServer(server);
      await tracked.context.close();
    }
  })];
}

async function scenarioD4(browser, server) {
  // D4: Loop guard - verify error navigation happens exactly once (no infinite loop)
  // Test: first render error → /error page → confirm no repeat navigation
  const CHUNK_PREFIX = "QrBulkPanel-";
  const ANCHOR = '"data-testid":"qr-bulk-page"';  // Must match actual chunk content
  const THROW_EXPR = '(window.__wlForceRenderError?(()=>{throw new Error("D4-LOOP-GUARD-TEST")})():"qr-bulk-page")';
  return [await runCase("D4-loop-guard", async () => {
    resetServer(server);
    const distAssets = await fs.readdir(path.join(REPO_ROOT, "dist", "assets"));
    const chunk = distAssets.find((f) => f.startsWith(CHUNK_PREFIX) && f.endsWith(".js"));
    assert.ok(chunk, "D4: QrBulkPanel chunk missing in dist");
    const built = await fs.readFile(path.join(REPO_ROOT, "dist", "assets", chunk), "utf8");
    assert.ok(built.split(ANCHOR).length - 1 >= 1, "D4: injection anchor missing in built chunk");
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    const mark = server.state.requests.length;
    try {
      // Initialize: navigate to qr-studio with working chunks
      await tracked.page.goto(`${server.url}/ko/tools/qr-studio/`, { waitUntil: "domcontentloaded" });
      await waitReady(tracked.page);
      const settled = await tracked.page.waitForSelector('[data-testid="qr-preview"][data-ready="true"]', { timeout: 20_000 }).then(() => true).catch(() => false);
      if (!settled) await sleep(3000);
      const initialDocs = tracked.docCommits.length;

      // Inject render error into QrBulkPanel chunk
      server.state.asset = CHUNK_PREFIX;
      server.state.transform = (pathname, text) => (
        pathname.includes(CHUNK_PREFIX) ? text.split(ANCHOR).join(`"data-testid":${THROW_EXPR}`) : text
      );

      // Trigger first render error
      await tracked.page.evaluate(() => { window.__wlForceRenderError = true; });
      await tracked.page.locator('[data-testid="qr-mode"] button').nth(1).click();

      // Wait for automatic navigation to /error page
      try {
        await tracked.page.waitForURL((url) => url.pathname === "/ko/error/" || url.pathname === "/ko/error", { timeout: 30_000 });
      } catch (error) {
        return {
          lang: "ko", status: "fail",
          reason: "did not navigate to /error after render error",
          method: "render error injection + loop guard verification",
          docCommits: [...tracked.docCommits],
          serverRequests: summarizeServerRequests(server.state.requests.slice(mark)),
        };
      }

      const docsAfterFirstError = tracked.docCommits.length;
      const firstNavCount = docsAfterFirstError - initialDocs;
      assert.ok(firstNavCount >= 1, `D4: first error should navigate to /error (got ${firstNavCount})`);

      // CRITICAL: Wait to ensure NO ADDITIONAL NAVIGATIONS (loop guard verification)
      // If loop guard fails, will see repeated reloads/navigations
      await sleep(2000);
      const docsAfterWait = tracked.docCommits.length;
      assert.equal(docsAfterWait, docsAfterFirstError, "D4: loop guard - no repeat navigation after error");

      // Verify final state
      await tracked.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
      const obs = await observe(tracked.page);
      assert.equal(obs.scripts, 0, "D4: /error page must have 0 ad scripts");
      assert.equal(obs.loads, 0, "D4: /error page must have 0 stub loads");
      assertNoRealNetwork(tracked.counters, "D4");

      const shot = await screenshot(tracked.page, "D4-loop-guard");
      return {
        lang: "ko", status: "pass", note: "first error → /error, loop guard prevents repeat navigation",
        firstNavCount, finalUrl: obs.url,
        docCommits: tracked.docCommits.map((entry) => ({ ...entry })),
        scripts: obs.scripts, counters: counterSnapshot(tracked.counters),
        serverRequests: summarizeServerRequests(server.state.requests.slice(mark)),
        evidence: shot,
      };
    } finally {
      resetServer(server);
      await tracked.context.close();
    }
  })];
}

async function scenarioS10(browser, server) {
  return [await runCase("S10-mobile-overlay", async () => {
    resetServer(server);
    const tracked = await newTrackedContext(browser, server, {
      consent: "granted",
      viewport: devices["Pixel 7"].viewport,
    });
    try {
      await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await waitReady(tracked.page);
      const buttons = await tracked.page.locator("main button").allInnerTexts();
      const obs = await observe(tracked.page);
      assertNoRealNetwork(tracked.counters, "S10");
      const shot = await screenshot(tracked.page, "S10-mobile");
      return {
        status: "unverified",
        note: "real ad overlay required (stub renders no overlay) — overlap cannot be verified",
        viewport: devices["Pixel 7"].viewport,
        scripts: obs.scripts, loads: obs.loads,
        counters: counterSnapshot(tracked.counters),
        docs: tracked.docs, docCommits: tracked.docCommits,
        mainButtons: buttons.map((text) => text.trim().slice(0, 40)).filter(Boolean).slice(0, 12),
        evidence: shot,
      };
    } finally {
      await tracked.context.close();
    }
  })];
}

const STUB_EXPECTATION_MESSAGE = "S2-discrimination: stub expected (should fail with stub disabled)";

function isExpectedStubFailure(error) {
  return Boolean(error)
    && (error instanceof assert.AssertionError || error?.name === "AssertionError")
    && error?.code === "ERR_ASSERTION"
    && String(error.message ?? "").includes(STUB_EXPECTATION_MESSAGE);
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const { runHead, distMtime } = await buildProvenance();
  const server = await startRecoveryServer({ root: "dist", port: PORT });
  console.log(`server: ${server.url}`);
  console.log(`adsense stub: ${ADSENSE_SCRIPT_URL}`);
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    if (DISCRIMINATE) {
      // Checker self-validation: with the stub disabled (blocking kept), the
      // S2 expectation (stub 1) must FAIL. A failure here proves discrimination.
      resetServer(server);
      const tracked = await newTrackedContext(browser, server, { consent: "granted", stub: false });
      let discriminated = false;
      let detail = {};
      let obs = null;
      try {
        await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
        await waitReady(tracked.page);
        obs = await observe(tracked.page);
        try {
          assert.equal(tracked.counters.stub, 1, STUB_EXPECTATION_MESSAGE);
          detail = {
            unexpectedPass: "stub assertion passed with the stub disabled",
            scripts: obs?.scripts ?? null,
            loads: obs?.loads ?? null,
          };
        } catch (error) {
          // Only the exact stub-expectation assertion proves discrimination;
          // timeouts or other harness errors must not count as success.
          discriminated = isExpectedStubFailure(error);
          detail = {
            expectedFailure: String(error).split("\n")[0],
            ...(discriminated ? {} : { unexpectedFailureShape: String(error).slice(0, 500) }),
            scripts: obs?.scripts ?? null,
            loads: obs?.loads ?? null,
          };
        }
      } catch (error) {
        // Navigation/readiness/observe harness failure: never discrimination.
        if (!obs) obs = await observe(tracked.page).catch(() => null);
        discriminated = false;
        detail = {
          harnessFailure: String(error).split("\n")[0],
          scripts: obs?.scripts ?? null,
          loads: obs?.loads ?? null,
        };
      } finally {
        await tracked.context.close();
      }
      // Independent of the expected failure: the firewall must still have
      // allowed no real network. A network failure here never counts as
      // discrimination success.
      let networkFailure = null;
      try {
        assertNoRealNetwork(tracked.counters, "S2-discrimination");
      } catch (error) {
        networkFailure = String(error).split("\n")[0];
      }
      const counters4 = {
        attempt: tracked.counters.attempt,
        stub: tracked.counters.stub,
        blocked: tracked.counters.blocked,
        allowedExternal: tracked.counters.allowedExternal,
      };
      discriminated = discriminated && networkFailure === null;
      await fs.writeFile(DISCRIMINATION_FILE, `${JSON.stringify({ name: "S2-discrimination", stubDisabled: true, blockingKept: true, discriminated, networkFailure, runHead, ...detail, counters: counters4 }, null, 2)}\n`);
      console.log(discriminated ? "DISCRIMINATION OK (checker fails without stub)" : "DISCRIMINATION BROKEN (checker passed without stub)");
      process.exitCode = discriminated ? 0 : 1;
      return;
    }
    const jobs = [
      { key: "S1", run: () => scenarioS1(browser, server) },
      { key: "S2-ko", run: () => runCase("S2-ko", () => checkS2(browser, server, "ko")) },
      { key: "S2-en", run: () => runCase("S2-en", () => checkS2(browser, server, "en")) },
      { key: "S3", run: () => scenarioS3(browser, server) },
      { key: "S4", run: () => scenarioS4(browser, server) },
      { key: "S6S7", run: () => scenarioS6S7(browser, server) },
      { key: "S8", run: () => scenarioS8(browser, server) },
      { key: "S9", run: () => scenarioS9(browser, server) },
      { key: "S5", run: () => scenarioS5(browser, server) },
      { key: "D4", run: () => scenarioD4(browser, server) },
      { key: "S10", run: () => scenarioS10(browser, server) },
    ];
    const scenarios = [];
    for (const job of jobs) {
      if (ONLY && !job.key.includes(ONLY)) continue;
      const out = await job.run();
      scenarios.push(...(Array.isArray(out) ? out : [out]));
    }
    const byStatus = {};
    for (const entry of scenarios) byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
    const failed = scenarios.filter((entry) => entry.status === "fail");
    const results = {
      meta: {
        job: "adsense-recheck-20260919",
        unit: "WU2",
        build: "npm run build with VITE_LOCAL_QA unset",
        runHead,
        distMtime,
        server: `tests/recovery-server.mjs RECOVERY_TEST_PORT=${PORT}`,
        browser: "playwright 1.63 + /usr/bin/google-chrome",
        adsenseStubUrl: ADSENSE_SCRIPT_URL,
        statusLegend: "pass / not-applicable / unverified / not-reproduced / recorded / fail — only fail fails the run; other non-pass states are never summed as passes",
        started: scenarios[0]?.started ?? now(),
        ended: now(),
      },
      summary: byStatus,
      scenarios,
    };
    await fs.writeFile(RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`results: ${RESULTS_FILE}`);
    console.log(`status ${JSON.stringify(byStatus)}`);
    for (const entry of scenarios) {
      if (entry.status !== "pass") console.log(`${entry.status.toUpperCase()} ${entry.name}`);
    }
    if (failed.length) {
      for (const entry of failed) console.log(`FAILED ${entry.name}: ${entry.failure?.split("\n")[0]}`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
