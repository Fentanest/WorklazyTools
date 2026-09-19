import assert from "node:assert/strict";
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
const QR_BULK_CHUNK = "QrBulkPanel-";

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

async function newTrackedContext(browser, server, { consent = "granted", stub = true, viewport = null, serviceWorkers = "allow" } = {}) {
  const counters = createCounters();
  const docs = [];
  const dialogs = [];
  const errors = [];
  const context = await browser.newContext({
    locale: "ko-KR",
    serviceWorkers,
    ...(viewport ? { viewport } : { viewport: { width: 1365, height: 900 } }),
  });
  await installAdFirewall(context, server.url, counters, { stub });
  await context.addInitScript((preset) => {
    window.__wlNav = { push: 0, replace: 0 };
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
  // not be used for the S6 "exactly one new document" count.
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
        docCommits.push({ url: frame.url, loaderId: String(frame.loaderId).slice(-6), time: now() });
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
  page.on("dialog", (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), time: now() });
    dialog.dismiss().catch(() => {});
  });
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 500)));
  return { context, page, cdp, counters, docs, docCommits, dialogs, errors };
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

async function runCase(name, fn) {
  const started = now();
  try {
    const detail = await fn();
    console.log(`PASS ${name}`);
    return { name, pass: true, started, ended: now(), ...detail };
  } catch (error) {
    console.log(`FAIL ${name}: ${String(error).split("\n")[0]}`);
    return { name, pass: false, started, ended: now(), failure: String(error).slice(0, 2000) };
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
        return { lang: "ko", url: obs.url, status: "script 0, stub 0", scripts: obs.scripts, counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits, serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shot };
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
    const shot = await screenshot(tracked.page, `S2-${lang}`);
    return { lang, url: obs.url, status: "script 1, stub 1, real 0", scripts: obs.scripts, loads: obs.loads, counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits, externalLog: tracked.counters.log, serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shot };
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
        lang: "ko", status: "loading observed, then script 1",
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
      await waitRouteError(tracked.page);
      const obs = await observe(tracked.page);
      assert.ok(obs.routeError >= 1, "S4: route error boundary must be shown");
      assert.equal(obs.scripts, 0, "S4: no ad script in the error document");
      assert.equal(obs.loads, 0, "S4: stub must not load");
      assert.equal(tracked.counters.stub, 0, "S4: no stub served");
      assertNoRealNetwork(tracked.counters, "S4");
      const requests = server.state.requests.slice(mark);
      const chunk404 = requests.filter((entry) => entry.pathname.includes(TEXT_MERGER_CHUNK) && entry.status === 404).length;
      assert.ok(chunk404 >= 2, `S4: chunk must fail on initial load and after the single recovery reload (got ${chunk404})`);
      const shot = await screenshot(tracked.page, "S4-error");
      return {
        lang: "ko", status: "route-error, script 0, stub 0",
        scripts: obs.scripts, counters: counterSnapshot(tracked.counters),
        docCommits: tracked.docCommits, reloads: Math.max(0, tracked.docCommits.length - 1),
        chunk404Count: chunk404, serverRequests: summarizeServerRequests(requests), evidence: shot,
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
  const movedDocs = tracked.docCommits.slice(commitsBefore);
  assert.equal(movedDocs.length, 1, `${tag}: exactly one new document commit (initial entry excluded), got ${JSON.stringify(movedDocs)}`);
  assert.equal(after.scripts, 0, `${tag}: no ad script in the new document`);
  assert.equal(tracked.counters.stub - stubBefore, 0, `${tag}: no additional stub load`);
  const stableDocs = tracked.docCommits.length;
  await sleep(5000);
  assert.equal(tracked.docCommits.length, stableDocs, `${tag}: no further document swaps during stabilization`);
  assertNoRealNetwork(tracked.counters, tag);
  const requests = server.state.requests.slice(mark);
  const redirects = requests.filter((entry) => entry.status === 301).map((entry) => entry.pathname);
  return {
    tracked, before, after, movedDocs, redirects,
    detail: {
      lang, from: before.url, to: after.url, status: "1 document commit, script 0, +0 stub",
      scripts: after.scripts, stubAdded: tracked.counters.stub - stubBefore,
      docCommits: tracked.docCommits, spaMoves: after.nav, serverRedirects301: redirects,
      counters: counterSnapshot(tracked.counters), serverRequests: summarizeServerRequests(requests),
    },
  };
}

async function scenarioS6S7(browser, server) {
  const results = [];
  const moves = [
    { lang: "ko", target: "/tools/hwp-editor", tag: "S6-ko-hwp" },
    { lang: "ko", target: "/tools/document-compare", tag: "S6-ko-doccompare" },
    { lang: "en", target: "/tools/document-compare", tag: "S6-en-doccompare" },
  ];
  // /tools/pdf-editor/merge has no SPA link in the app (sidebar catalog,
  // /{lang}/tools/ index, text-merger page, and the pdf-editor internal nav
  // all lack it), so the click-to-move variant cannot run for merge. Direct
  // entry to merge is covered by S8 in both languages.
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
      return {
        lang: "ko",
        status: "NOT APPLICABLE — no SPA link to /tools/pdf-editor/merge (covered by S8 direct entry)",
        mergeLinksOnAllowedPage: onTool, mergeLinksOnToolsIndex: onIndex,
        counters: counterSnapshot(tracked.counters), docCommits: tracked.docCommits,
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
    if (!outcome.pass && s7Session) {
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
        lang: "ko", status: "script 1 re-inserted, tags <= 1",
        scripts: obs.scripts, loads: obs.loads,
        docCommits: docCommits, newCommits: docCommits.length - docsBefore,
        spaMoves: obs.nav, counters: counterSnapshot(counters), evidence: shot,
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
          path: entry.path, finalUrl: obs.url, status: entry.expiredMarker ? "expired notice, script 0" : "script 0, stub 0",
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

async function scenarioS9(browser, server) {
  return [await runCase("S9-file-then-move", async () => {
    resetServer(server);
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    const mark = server.state.requests.length;
    try {
      await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
      await waitReady(tracked.page);
      const sampleFile = path.join(ARTIFACT_DIR, "wu2-sample.txt");
      await fs.writeFile(sampleFile, "wu2 synthetic line one\nwu2 synthetic line two\n");
      await tracked.page.locator('input[type="file"]').setInputFiles(sampleFile);
      await tracked.page.waitForFunction(
        () => document.querySelectorAll('[data-testid="text-merger-item"]').length >= 2,
        { timeout: 15_000 },
      );
      const itemsBefore = await tracked.page.locator('[data-testid="text-merger-item"]').count();
      const sourcesBefore = await tracked.page.locator('[data-testid="text-merger-source"]').allInnerTexts();
      const dialogsBefore = tracked.dialogs.length;
      const moveLink = tracked.page.locator('.sidebar a[href="/ko/tools/document-compare"]').first();
      await moveLink.scrollIntoViewIfNeeded();
      await moveLink.click();
      await tracked.page.waitForURL((url) => !url.pathname.includes("/tools/text-merger"), { timeout: 30_000 });
      await tracked.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
      await sleep(2000);
      const after = await observe(tracked.page);
      const itemsAfter = await tracked.page.locator('[data-testid="text-merger-item"]').count();
      assert.equal(after.scripts, 0, "S9: no ad script after the move");
      assertNoRealNetwork(tracked.counters, "S9");
      const shot = await screenshot(tracked.page, "S9-after-move");
      return {
        lang: "ko",
        status: "recorded for Claude adjudication (expected behavior vs defect candidate)",
        itemsBefore, sourcesBefore, itemsAfter,
        dialogsDuringMove: tracked.dialogs.slice(dialogsBefore),
        stateLost: itemsAfter < itemsBefore,
        newUrl: after.url, scripts: after.scripts,
        counters: counterSnapshot(tracked.counters), docs: tracked.docs, docCommits: tracked.docCommits,
        serverRequests: summarizeServerRequests(server.state.requests.slice(mark)), evidence: shot,
      };
    } finally {
      await tracked.context.close();
    }
  })];
}

async function scenarioS5(browser, server) {
  // PLAN 4-2/S5 option (1): the user-action-triggered lazy import is the
  // QrBulkPanel chunk (bulk mode tab). Measured product behavior: a failing
  // chunk import fires vite:preloadError and chunkRecovery reloads the
  // document, which wipes the in-memory mode trigger — so a same-document
  // healthy->error transition via click is not reachable. The boundary IS
  // reachable at the same URL via the /bulk route (trigger in the URL).
  return [await runCase("S5-same-url-error", async () => {
    // (1a) Click path on the create page: documents the designed recovery.
    resetServer(server);
    const attempt1a = { reloadObserved: false, urlUnchanged: false, boundaryShown: false, stubTotal: 0 };
    {
      const tracked = await newTrackedContext(browser, server, { consent: "granted" });
      try {
        await tracked.page.goto(`${server.url}/ko/tools/qr-studio/`, { waitUntil: "domcontentloaded" });
        await waitReady(tracked.page);
        const settled = await tracked.page.waitForSelector('[data-testid="qr-preview"][data-ready="true"]', { timeout: 20_000 }).then(() => true).catch(() => false);
        if (!settled) await sleep(3000);
        const before = await observe(tracked.page);
        assert.equal(before.scripts, 1, "S5-1a: ad script must be present before the error");
        server.state.asset = QR_BULK_CHUNK;
        server.state.fault = "404";
        server.state.remaining = Infinity;
        await tracked.page.locator('[data-testid="qr-mode"] button').nth(1).click();
        const deadline = Date.now() + 45_000;
        while (tracked.docCommits.length < 2 && Date.now() < deadline) await sleep(250);
        await sleep(4000);
        const after = await observe(tracked.page);
        attempt1a.reloadObserved = tracked.docCommits.length === 2;
        attempt1a.urlUnchanged = after.url === before.url;
        attempt1a.boundaryShown = after.routeError >= 1;
        attempt1a.stubTotal = tracked.counters.stub;
        attempt1a.scriptsAfter = after.scripts;
        attempt1a.bulk404s = server.state.requests.filter((e) => e.pathname.includes(QR_BULK_CHUNK) && e.status === 404).length;
        assert.equal(tracked.docCommits.length, 2, "S5-1a: exactly one recovery reload is expected");
        assert.equal(after.url, before.url, "S5-1a: URL string must be unchanged");
      } finally {
        resetServer(server);
        await tracked.context.close();
      }
    }
    // (1b) Bulk route (trigger preserved in URL): boundary must be reached.
    resetServer(server);
    server.state.asset = QR_BULK_CHUNK;
    server.state.fault = "404";
    server.state.remaining = Infinity;
    const tracked = await newTrackedContext(browser, server, { consent: "granted" });
    const mark = server.state.requests.length;
    try {
      const bulkUrl = `${server.url}/ko/tools/qr-studio/bulk/`;
      await tracked.page.goto(bulkUrl, { waitUntil: "domcontentloaded" });
      await waitRouteError(tracked.page, 60_000);
      const after = await observe(tracked.page);
      assert.equal(after.url, bulkUrl, "S5-1b: URL must be unchanged");
      assert.ok(after.routeError >= 1, "S5-1b: error boundary must be shown");
      assert.equal(tracked.docCommits.length, 2, "S5-1b: initial load + exactly one recovery reload");
      assert.equal(after.scripts, 0, "S5-1b: no ad script in the error document");
      assert.equal(tracked.counters.stub, 0, "S5-1b: no stub served (script never reached insert)");
      assertNoRealNetwork(tracked.counters, "S5-1b");
      const requests = server.state.requests.slice(mark);
      const bulk404s = requests.filter((e) => e.pathname.includes(QR_BULK_CHUNK) && e.status === 404).length;
      assert.ok(bulk404s >= 1, "S5-1b: the bulk chunk must have failed");
      const stable = tracked.docCommits.length;
      await sleep(3000);
      assert.equal(tracked.docCommits.length, stable, "S5-1b: no further reloads (no reload loop)");
      const shotAfter = await screenshot(tracked.page, "S5-error");
      return {
        lang: "ko",
        status: "boundary reached at same URL via bulk route (real 404 fault on user-triggered lazy chunk); same-document click transition is replaced by the designed recovery reload — see attempt1a",
        attempt1a,
        attempt1b: {
          urlUnchanged: after.url === bulkUrl, scripts: after.scripts, stubTotal: tracked.counters.stub,
          docCommits: tracked.docCommits, bulk404s,
        },
        residualScriptNote: "no residual ad tag is observable: the recovery reload replaces the document before any boundary renders (residual risk only applies to a hypothetical same-document transition, which the reload precludes)",
        counters: counterSnapshot(tracked.counters), docCommits: tracked.docCommits, pageErrors: tracked.errors.slice(0, 3),
        serverRequests: summarizeServerRequests(requests), evidence: shotAfter,
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
        status: "UNVERIFIED — real ad overlay required (stub renders no overlay)",
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

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
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
      let checkerFailed = false;
      let detail = {};
      try {
        await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
        await waitReady(tracked.page);
        const obs = await observe(tracked.page);
        assert.equal(tracked.counters.stub, 1, "S2-discrimination: stub expected (should fail with stub disabled)");
        detail = { scripts: obs.scripts, loads: obs.loads, counters: counterSnapshot(tracked.counters) };
      } catch (error) {
        checkerFailed = true;
        detail = { expectedFailure: String(error).split("\n")[0] };
      } finally {
        await tracked.context.close();
      }
      await fs.writeFile(DISCRIMINATION_FILE, `${JSON.stringify({ name: "S2-discrimination", stubDisabled: true, blockingKept: true, discriminated: checkerFailed, ...detail }, null, 2)}\n`);
      console.log(checkerFailed ? "DISCRIMINATION OK (checker fails without stub)" : "DISCRIMINATION BROKEN (checker passed without stub)");
      process.exitCode = checkerFailed ? 0 : 1;
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
      { key: "S10", run: () => scenarioS10(browser, server) },
    ];
    const scenarios = [];
    for (const job of jobs) {
      if (ONLY && !job.key.includes(ONLY)) continue;
      const out = await job.run();
      scenarios.push(...(Array.isArray(out) ? out : [out]));
    }
    const failed = scenarios.filter((entry) => !entry.pass);
    const results = {
      meta: {
        job: "adsense-recheck-20260919",
        unit: "WU2",
        build: "npm run build with VITE_LOCAL_QA unset",
        server: `tests/recovery-server.mjs RECOVERY_TEST_PORT=${PORT}`,
        browser: "playwright 1.63 + /usr/bin/google-chrome",
        adsenseStubUrl: ADSENSE_SCRIPT_URL,
        started: scenarios[0]?.started ?? now(),
        ended: now(),
      },
      scenarios,
    };
    await fs.writeFile(RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`results: ${RESULTS_FILE}`);
    console.log(`pass ${scenarios.length - failed.length}/${scenarios.length}`);
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
