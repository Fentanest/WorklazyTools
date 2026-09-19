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

// Case status vocabulary (PLAN §8): "pass" / "not-applicable" / "unverified" /
// "not-reproduced" / "recorded" / "fail". Only "fail" fails the run; the other
// non-pass states are reported separately and never summed as passes.
async function runCase(name, fn) {
  const started = now();
  try {
    const detail = await fn();
    const status = detail.status ?? "pass";
    console.log(`${status.toUpperCase()} ${name}`);
    return { name, status, started, ended: now(), ...detail };
  } catch (error) {
    console.log(`FAIL ${name}: ${String(error).split("\n")[0]}`);
    return { name, status: "fail", started, ended: now(), failure: String(error).slice(0, 2000) };
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
        lang: "ko", status: "pass", note: "route-error, script 0, stub 0",
        scripts: obs.scripts, counters: counterSnapshot(tracked.counters),
        docCommits: tracked.docCommits.map((entry) => ({ ...entry })), reloads: Math.max(0, tracked.docCommits.length - 1),
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
        lang: "ko", status: "recorded",
        note: "observation only — expected behavior vs defect candidate is Claude's adjudication",
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
  // PLAN 4-2/S5 option (2): inject a flag-gated throw into the RENDER output
  // of the not-yet-loaded QrBulkPanel chunk via state.transform, then trigger
  // its load+render with the bulk tab click. Fetch (200) and module
  // evaluation both succeed, so no vite:preloadError and no chunkRecovery
  // reload intervene: RouteErrorBoundary is reached in the SAME document at
  // the SAME URL with the pre-existing ad script tag still present.
  // This is an INJECTED reproduction, explicitly not a real internal import
  // failure (measured: real chunk fetch/eval failures reload the document).
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
      await tracked.page.goto(`${server.url}/ko/tools/qr-studio/`, { waitUntil: "domcontentloaded" });
      await waitReady(tracked.page);
      const settled = await tracked.page.waitForSelector('[data-testid="qr-preview"][data-ready="true"]', { timeout: 20_000 }).then(() => true).catch(() => false);
      if (!settled) await sleep(3000);
      const before = await observe(tracked.page);
      assert.equal(before.scripts, 1, "S5: ad script must be present before the error");
      assert.equal(before.loads, 1, "S5: stub must be loaded once before the error");
      assert.equal(tracked.counters.attempt, 1, "S5: exactly one ad attempt before the error");
      assert.equal(tracked.docCommits.length, 1, "S5: single initial document");
      const preBulk = server.state.requests.slice(mark).filter((e) => e.pathname.includes(CHUNK_PREFIX)).length;
      assert.equal(preBulk, 0, "S5: bulk chunk must not load before the click");
      const urlBefore = before.url;
      const stubBefore = tracked.counters.stub;
      // Arm the transform BEFORE the chunk is fetched: the served module
      // evaluates cleanly (the flag is only read at render, not at import).
      server.state.asset = CHUNK_PREFIX;
      server.state.transform = (pathname, text) => (
        pathname.includes(CHUNK_PREFIX) ? text.split(ANCHOR).join(`"data-testid":${THROW_EXPR}`) : text
      );
      await tracked.page.evaluate(() => { window.__wlForceRenderError = true; });
      await tracked.page.locator('[data-testid="qr-mode"] button').nth(1).click();
      try {
        await waitRouteError(tracked.page);
      } catch (error) {
        // Genuinely unreachable: record diagnostics, do not count as pass.
        const diag = await tracked.page.evaluate(() => ({
          routeError: document.querySelectorAll("[data-route-error]").length,
          loading: document.querySelectorAll(".tool-route-loading").length,
          pressed: [...document.querySelectorAll('[data-testid="qr-mode"] button')].map((b) => `${b.getAttribute("aria-pressed")}:${b.getAttribute("data-tg-value")}`),
          flag: Boolean(window.__wlForceRenderError),
        })).catch(() => ({}));
        diag.pageErrors = tracked.errors.slice(0, 5);
        diag.bulkRequests = server.state.requests.slice(mark).filter((e) => e.pathname.includes(CHUNK_PREFIX)).map((e) => `${e.pathname} ${e.status} ${e.bytes ?? ""}`);
        diag.counters = counterSnapshot(tracked.counters);
        diag.docCommits = [...tracked.docCommits];
        return {
          lang: "ko", status: "not-reproduced",
          reason: `boundary unreachable: ${String(error).split("\n")[0]}`,
          method: "state.transform render-error injection into QrBulkPanel chunk (attempted)",
          diag, counters: counterSnapshot(tracked.counters),
          docCommits: [...tracked.docCommits],
          serverRequests: summarizeServerRequests(server.state.requests.slice(mark)),
        };
      }
      const after = await observe(tracked.page);
      assert.equal(after.url, urlBefore, "S5: URL must be unchanged");
      assert.equal(tracked.docCommits.length, 1, "S5: no new document (same-document boundary)");
      assert.ok(after.routeError >= 1, "S5: error boundary must be shown");
      assert.equal(tracked.counters.stub - stubBefore, 0, "S5: no new stub load (total stays 1)");
      assert.equal(after.loads, 1, "S5: cumulative stub loads stay 1");
      assertNoRealNetwork(tracked.counters, "S5");
      await sleep(900);
      const shotAfter = await screenshot(tracked.page, "S5-error");
      return {
        lang: "ko", status: "pass",
        method: "state.transform render-error injection into QrBulkPanel chunk + bulk tab click (INJECTED reproduction, not a real internal import failure)",
        injection: {
          chunk, anchor: ANCHOR, anchorOccurrences: built.split(ANCHOR).length - 1, cleanBytes: built.length,
          servedRequests: server.state.requests.slice(mark).filter((e) => e.pathname.includes(CHUNK_PREFIX)).map((e) => ({ pathname: e.pathname, status: e.status, bytes: e.bytes ?? null })),
        },
        urlUnchanged: after.url === urlBefore,
        scripts: after.scripts, loads: after.loads, stubAdded: tracked.counters.stub - stubBefore,
        residualScriptTags: after.scripts,
        residualScriptNote: after.scripts >= 1
          ? "pre-existing ad script tag REMAINS after the same-document error (no removal policy) — residual risk confirmed, not a fix target per §4-3"
          : "pre-existing ad script tag is gone (unexpected; boundary or cleanup removed it)",
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
      let obs = null;
      try {
        await tracked.page.goto(`${server.url}/ko/tools/text-merger/`, { waitUntil: "domcontentloaded" });
        await waitReady(tracked.page);
        obs = await observe(tracked.page);
        assert.equal(tracked.counters.stub, 1, "S2-discrimination: stub expected (should fail with stub disabled)");
        assertNoRealNetwork(tracked.counters, "S2-discrimination");
        detail = { scripts: obs.scripts, loads: obs.loads, counters: counterSnapshot(tracked.counters) };
      } catch (error) {
        // Only the exact stub-expectation assertion proves discrimination;
        // timeouts or other harness errors must not count as success.
        if (!obs) obs = await observe(tracked.page).catch(() => null);
        const message = String(error).split("\n")[0];
        checkerFailed = /stub expected/.test(message);
        detail = {
          expectedFailure: message,
          scripts: obs?.scripts ?? null,
          loads: obs?.loads ?? null,
          counters: counterSnapshot(tracked.counters),
        };
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
    const byStatus = {};
    for (const entry of scenarios) byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
    const failed = scenarios.filter((entry) => entry.status === "fail");
    const results = {
      meta: {
        job: "adsense-recheck-20260919",
        unit: "WU2",
        build: "npm run build with VITE_LOCAL_QA unset",
        dist: "reused c40c2eb build (no product change since; rebuild not required)",
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
