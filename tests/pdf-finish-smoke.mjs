import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createCanvas } from "@napi-rs/canvas";
import { chromium } from "playwright";
import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";
import { PNG } from "pngjs";

const execFileAsync = promisify(execFile);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number(process.env.PDF_FINISH_TEST_PORT ?? "4183");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const shots = path.resolve(process.env.PDF_FINISH_SHOTS || "/tmp/worklazy-u4-3/shots");
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-pdf-finish-"));
let server;
let browser;

try {
  await fs.mkdir(shots, { recursive: true });
  const fixture = await createFixture();
  const inlineImageFixture = await createInlineImageFixture();
  const boundaryCropFixture = await createBoundaryCropFixture();
  const smallFixture = await createSmallFixture();
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  const directEntries = [];
  for (const language of ["ko", "en"]) {
    for (const route of ["finish", "page-numbers", "header-footer", "watermark"]) {
      for (const viewport of [{ id: "desktop", width: 1365, height: 900 }, { id: "mobile", width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block" });
        await context.addInitScript(() => {
          localStorage.setItem("worklazy_privacy_consent", "granted");
          if (!location.pathname.includes("/tools/pdf-editor/")) return;
          const pathname = location.pathname.replace(/\/+$/, "") || "/";
          const target = `${pathname}${location.search}`;
          sessionStorage.setItem(`worklazy_tool_reload:${JSON.stringify([pathname, target])}`, "pending");
        });
        const page = await context.newPage();
        const documentNavigations = [];
        page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) documentNavigations.push(frame.url()); });
        await page.goto(`${baseUrl}/${language}/tools/pdf-editor/${route}/`, { waitUntil: "networkidle" });
        const expectedTab = route === "header-footer" ? "header-footer" : route === "watermark" ? "watermark" : "page-numbers";
        await page.locator(`[data-testid='pdf-finish-ready'][data-pdf-finish-tab='${expectedTab}']`).waitFor();
        await page.waitForFunction(() => !document.querySelector(".tool-route-loading") && !Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:")));
        assert.equal(await page.locator(".pdf-tool-navigation [data-pdf-nav-mode]").count(), 5);
        assert.equal(await page.locator(".pdf-tool-navigation [data-pdf-nav-mode='finish'][data-active='true']").count(), 1);
        assert.ok(documentNavigations.filter((url) => url.startsWith(baseUrl)).length <= 2, `${language}/${route}/${viewport.id} exceeded the one-reload recovery budget`);
        assert.equal(await page.locator("[data-route-error]").count(), 0);
        await page.screenshot({ path: path.join(shots, `${language}-${route}-${viewport.id}.png`), fullPage: false });
        directEntries.push(`${language}:${route}:${viewport.id}`);
        await context.close();
      }
    }
  }
  assert.equal(directEntries.length, 16);

  await testChunkRecovery(browser);
  await testNavigation(browser);
  await testUploadErrors(browser);
  await testPreviewGeometry(browser, fixture);
  await testPreflightGuidance(browser, fixture, smallFixture);
  await testPreflightReselection(browser, fixture);
  await testPreflightRawInputAndTabChanges(browser, fixture);
  await testOutputNameDownloads(browser, fixture);
  await testFinishWorkflow(browser, fixture);
  await testWatermarkWorkflow(browser, fixture, inlineImageFixture);
  await testBoundaryCropRendering(browser, boundaryCropFixture);
  await assertLazyChunks();
  console.log(`PDF finish smoke passed: ${directEntries.length} direct entries, one-reload chunk recovery, protected/corrupt upload errors, input recovery, preflight guidance, 6 preflight reselection/change combinations, 8 raw numeric representation changes, 2 equal-settings tab changes, 10 fresh PDF outputs for those changes, 4 localized edge-name downloads, 48 preview placements, watermark text/image/tile/risk confirmation, four-rotation boundary CropBox pixels, output, cancel and retry.`);
  console.log(`PDF finish screenshots: ${shots}`);
} finally {
  await browser?.close();
  if (server) await stopServer(server);
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

async function testChunkRecovery(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  const documentRequests = [];
  let injectedFailures = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame() && request.url().startsWith(baseUrl)) documentRequests.push(request.url());
  });
  await page.route("**/assets/PdfFinishPanel-*.js", async (route) => {
    if (injectedFailures === 0) {
      injectedFailures += 1;
      await route.fulfill({ status: 404, contentType: "text/javascript", headers: { "cache-control": "no-store" }, body: "Unavailable" });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish`, { waitUntil: "domcontentloaded" });
  } catch (reason) {
    if (!(reason instanceof Error) || !/ERR_ABORTED/u.test(reason.message)) throw reason;
  }
  await page.locator("[data-testid='pdf-finish-ready']").waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => !Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:")));
  assert.equal(injectedFailures, 1, "finish recovery must inject exactly one chunk failure");
  assert.equal(documentRequests.length, 2, `finish chunk failure must spend exactly one automatic reload: ${JSON.stringify(documentRequests)}`);
  assert.equal(await page.locator("[data-route-error]").count(), 0);
  await context.close();
}

async function testNavigation(browserInstance) {
  for (const width of [320, 390, 820, 821]) {
    const context = await browserInstance.newContext({ viewport: { width, height: 844 }, locale: "en-US", serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready']").waitFor();
    const metrics = await page.locator(".pdf-tool-navigation").evaluate((navigation) => {
      const active = navigation.querySelector("[data-pdf-nav-mode='finish']");
      const navRect = navigation.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        count: navigation.querySelectorAll("[data-pdf-nav-mode]").length,
        overflow: navigation.scrollWidth > navigation.clientWidth,
        activeVisible: activeRect.left >= navRect.left - 1 && activeRect.right <= navRect.right + 1,
        cue: navigation.parentElement?.getAttribute("data-scroll-cue"),
        labelsFit: [...navigation.querySelectorAll("[data-pdf-nav-mode]")].every((link) => link.scrollWidth <= link.clientWidth + 1),
      };
    });
    const finishTabs = await page.locator("[data-testid='pdf-finish-ready'] [role='tablist']").evaluate((tablist) => {
      const listRect = tablist.getBoundingClientRect();
      const tabs = [...tablist.querySelectorAll("[role='tab']")];
      const rects = tabs.map((tab) => tab.getBoundingClientRect());
      return {
        inside: rects.every((rect) => rect.left >= listRect.left - 1 && rect.right <= listRect.right + 1),
        separated: rects.every((rect, index) => index === 0 || rect.left >= rects[index - 1].right - 1),
        contentFits: tabs.every((tab) => {
          const content = tab.querySelector("[data-finish-tab-content]");
          if (!(content instanceof HTMLElement)) return false;
          const tabRect = tab.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();
          return contentRect.left >= tabRect.left - 1 && contentRect.right <= tabRect.right + 1;
        }),
      };
    });
    assert.equal(metrics.count, 5);
    assert.ok(metrics.activeVisible, `active finish navigation is clipped at ${width}px`);
    if (width <= 390) {
      assert.equal(metrics.overflow, true);
      assert.notEqual(metrics.cue, "none");
      assert.deepEqual(finishTabs, { inside: true, separated: true, contentFits: true }, `finish tabs overlap at ${width}px`);
    }
    if (width === 821) {
      assert.equal(metrics.overflow, true, "the 821px shell must keep scrolling when the sidebar reduces available width");
      assert.notEqual(metrics.cue, "none", "the 821px overflow must retain a visible scroll cue");
      assert.equal(metrics.labelsFit, true, "English navigation labels must not overlap or clip at 821px");
    }
    await context.close();
  }

  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/en/tools/pdf-editor/`, { waitUntil: "networkidle" });
  await page.locator(".pdf-tool-navigation [data-pdf-nav-mode='finish']").click();
  await page.locator("[data-testid='pdf-finish-ready'][data-pdf-finish-tab='page-numbers']").waitFor();
  assert.equal(new URL(page.url()).pathname, "/en/tools/pdf-editor/finish");
  const pathBeforeTab = new URL(page.url()).pathname;
  await page.locator("[data-finish-tab='header-footer']").click();
  await page.locator("[data-testid='pdf-finish-ready'][data-pdf-finish-tab='header-footer']").waitFor();
  assert.equal(new URL(page.url()).pathname, pathBeforeTab, "finish tab switches must not mutate the route");
  await context.close();
}

async function testUploadErrors(browserInstance) {
  const protectedFixtures = [
    "encrypted-r2-open.pdf",
    "encrypted-r2-restricted.pdf",
    "encrypted-r6-open.pdf",
    "encrypted-r6-restricted.pdf",
  ];
  for (const language of ["ko", "en"]) {
    const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    await page.goto(`${baseUrl}/${language}/tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
    const input = page.locator("[data-testid='pdf-finish-ready'] input[type='file']");
    for (const name of protectedFixtures) {
      await input.setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/encrypted", name));
      const message = await page.locator("[data-testid='pdf-error']").innerText();
      assert.match(message, language === "ko" ? /보호.*편집할 수 없/u : /protected.*cannot be edited/iu, `${language}/${name} did not expose the protected-document guidance`);
      assert.equal(await page.locator("[data-route-error]").count(), 0);
      assert.equal(await input.count(), 1, "a rejected PDF must leave the upload control available");
    }
    await input.setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/damage/truncated-half.pdf"));
    const damagedMessage = await page.locator("[data-testid='pdf-error']").innerText();
    assert.match(damagedMessage, language === "ko" ? /읽지 못했습니다/u : /could not be read/iu);
    assert.equal(await page.locator("[data-route-error]").count(), 0);
    await context.close();
  }
}

async function testPreviewGeometry(browserInstance, fixture) {
  let placements = 0;
  for (const language of ["ko", "en"]) {
    for (const colorScheme of ["light", "dark"]) {
      const context = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, locale: language === "ko" ? "ko-KR" : "en-US", colorScheme, serviceWorkers: "block" });
      await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
      const page = await context.newPage();
      await page.goto(`${baseUrl}/${language}/tools/pdf-editor/header-footer/`, { waitUntil: "networkidle" });
      await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: "preview-geometry.pdf", mimeType: "application/pdf", buffer: fixture });
      await page.locator("[data-testid='pdf-finish-template']").fill("first line\ngypqj");
      const multiline = await page.locator("[data-testid='pdf-finish-overlay']").evaluate((overlay) => {
        const style = getComputedStyle(overlay);
        return { whiteSpace: style.whiteSpace, lineHeight: Number.parseFloat(style.lineHeight), height: overlay.getBoundingClientRect().height };
      });
      assert.equal(multiline.whiteSpace, "pre-wrap");
      assert.ok(multiline.height >= multiline.lineHeight * 1.9, `${language}/${colorScheme} collapsed the F1 multiline preview: ${JSON.stringify(multiline)}`);
      const range = page.locator("[data-testid='pdf-finish-range']");
      for (const [rangeValue, landscape] of [["1", false], ["2", true]]) {
        await range.fill(rangeValue);
        await page.waitForFunction((expectLandscape) => {
          const canvas = document.querySelector("[data-testid='pdf-finish-canvas-area'] canvas");
          if (!(canvas instanceof HTMLCanvasElement) || !canvas.width || !canvas.height) return false;
          return (canvas.width > canvas.height) === expectLandscape;
        }, landscape);
        for (const region of ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]) {
          await page.locator(`[data-finish-region='${region}']`).click();
          const metrics = await page.locator("[data-testid='pdf-finish-canvas-area']").evaluate((area, selectedRegion) => {
            const canvas = area.querySelector("canvas");
            const overlay = area.querySelector("[data-testid='pdf-finish-overlay']");
            if (!(canvas instanceof HTMLCanvasElement) || !(overlay instanceof HTMLElement)) throw new Error("preview geometry is unavailable");
            const areaRect = area.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const overlayRect = overlay.getBoundingClientRect();
            const horizontal = String(selectedRegion).split("-")[1];
            return {
              aspectError: Math.abs(canvasRect.width / canvasRect.height - canvas.width / canvas.height),
              areaMatchesCanvas: Math.abs(areaRect.width - canvasRect.width) <= 1 && Math.abs(areaRect.height - canvasRect.height) <= 1,
              overlayInside: overlayRect.left >= canvasRect.left - 1 && overlayRect.right <= canvasRect.right + 1 && overlayRect.top >= canvasRect.top - 1 && overlayRect.bottom <= canvasRect.bottom + 1,
              centerError: horizontal === "center" ? Math.abs((overlayRect.left + overlayRect.right) / 2 - (canvasRect.left + canvasRect.right) / 2) : 0,
            };
          }, region);
          assert.ok(metrics.aspectError <= 0.002, `${language}/${colorScheme}/${rangeValue}/${region} distorted the canvas aspect ratio: ${metrics.aspectError}`);
          assert.equal(metrics.areaMatchesCanvas, true, `${language}/${colorScheme}/${rangeValue}/${region} did not anchor the overlay to the canvas area`);
          assert.equal(metrics.overlayInside, true, `${language}/${colorScheme}/${rangeValue}/${region} placed the overlay outside the canvas`);
          assert.ok(metrics.centerError <= 1, `${language}/${colorScheme}/${rangeValue}/${region} missed the canvas center by ${metrics.centerError}px`);
          placements += 1;
        }
      }
      await context.close();
    }
  }
  assert.equal(placements, 48);
}

async function testPreflightGuidance(browserInstance, fixture, smallFixture) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  await page.goto(`${baseUrl}/en/tools/pdf-editor/header-footer/`, { waitUntil: "networkidle" });
  const input = page.locator("[data-testid='pdf-finish-ready'] input[type='file']");
  await input.setInputFiles({ name: "preflight.pdf", mimeType: "application/pdf", buffer: fixture });
  const template = page.locator("[data-testid='pdf-finish-template']");
  const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");

  for (const [value, code, position] of [
    ["A😀Z", "missing-glyph", /line 1, column 2/iu],
    ["ok\nABC\u0001DEF", "control-character", /line 2, column 4/iu],
    ["line\n{date:foo}", "date-format", /line 2, column 1/iu],
  ]) {
    await template.fill(value);
    const error = page.locator(`[data-testid='pdf-finish-preflight-error'][data-error-code='${code}']`);
    await error.waitFor();
    assert.match(await error.innerText(), position);
    assert.equal(await action.isDisabled(), true);
  }

  await template.fill("A".repeat(300));
  await template.press("End");
  await template.press("A");
  await page.waitForFunction(() => [...document.querySelectorAll("[role='alert']")].some((element) => element.textContent?.includes("300")));
  assert.match(await page.locator("[data-testid='pdf-finish-template-count']").innerText(), /^300/u);
  assert.match(await page.locator("[data-testid='pdf-finish-template']").getAttribute("aria-describedby"), /template-error/u);
  assert.match(await page.locator("[data-testid='pdf-finish-template']").locator("xpath=following-sibling::*[@role='alert'][1]").innerText(), /300/u);

  for (const [value, warning] of [
    ["{mystery}", "unknown-token"],
    ["W".repeat(200), "horizontal-overflow"],
    [Array.from({ length: 75 }, (_, index) => `line ${index}`).join("\n"), "vertical-overflow"],
    ["Русский", "embedded-font"],
  ]) {
    await template.fill(value);
    const notice = page.locator(`[data-testid='pdf-finish-preflight-warnings'] [data-warning-code='${warning}']`);
    await notice.waitFor();
    if (warning === "embedded-font") assert.match(await notice.innerText(), /3\.8\s*MB/iu);
    await action.waitFor({ state: "visible" });
    assert.equal(await action.isEnabled(), true, `${warning} guidance must not block valid output`);
  }

  const fontSize = page.locator("[data-testid='pdf-finish-font-size']");
  const margin = page.locator("[data-testid='pdf-finish-margin']");
  await fontSize.fill("73");
  assert.equal(await action.isDisabled(), true, "font sizes above 72pt must be rejected instead of clamped");
  await fontSize.fill("72");
  await margin.fill("145");
  assert.equal(await action.isDisabled(), true, "margins above 144pt must be rejected instead of clamped");
  await margin.fill("144");
  await template.fill("W");
  await page.locator("[data-testid='pdf-finish-preflight-error'][data-error-code='narrow-region']").waitFor();
  assert.equal(await action.isDisabled(), true);

  await fontSize.fill("10");
  await margin.fill("24");
  await template.fill("A");
  await input.setInputFiles({ name: "small.pdf", mimeType: "application/pdf", buffer: smallFixture });
  await margin.fill("100");
  await page.locator("[data-testid='pdf-finish-preflight-error'][data-error-code='invalid-margin']").waitFor();
  assert.equal(await action.isDisabled(), true);
  await context.close();
}

async function testPreflightReselection(browserInstance, fixture) {
  let combinations = 0;
  for (const language of ["ko", "en"]) {
    const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    await page.goto(`${baseUrl}/${language}/tools/pdf-editor/page-numbers/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: "reselection.pdf", mimeType: "application/pdf", buffer: fixture });
    await page.locator("[data-testid='pdf-finish-template']").fill("short");
    await waitForReadyPreflight(page);
    const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");

    await page.locator("[data-finish-tab='page-numbers']").click();
    await page.waitForTimeout(1_500);
    await assertReadyPreflight(page, action, `${language}/same-tab`);
    combinations += 1;

    await page.locator("[data-finish-region='bottom-center']").click();
    await page.waitForTimeout(1_500);
    await assertReadyPreflight(page, action, `${language}/same-region`);
    combinations += 1;

    const transition = page.evaluate(() => new Promise((resolve, reject) => {
      const panel = document.querySelector("[data-testid='pdf-finish-ready']");
      if (!(panel instanceof HTMLElement)) {
        reject(new Error("finish panel is unavailable"));
        return;
      }
      let sawIdle = panel.dataset.preflightStatus === "idle";
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("changed input did not schedule preflight"));
      }, 5_000);
      const observer = new MutationObserver(() => {
        const status = panel.dataset.preflightStatus;
        if (status === "idle") sawIdle = true;
        if (status === "checking") {
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve({ sawIdle, status });
        }
      });
      observer.observe(panel, { attributes: true, attributeFilter: ["data-preflight-status"] });
    }));
    await page.locator("[data-finish-region='top-left']").click();
    assert.deepEqual(await transition, { sawIdle: true, status: "checking" }, `${language}/changed-region must leave idle by scheduling a new preflight`);
    await waitForReadyPreflight(page);
    await assertReadyPreflight(page, action, `${language}/changed-region`);
    combinations += 1;

    await action.click();
    await page.locator("[data-testid='pdf-download']").waitFor();
    assert.equal(await page.locator("[data-route-error]").count(), 0);
    await context.close();
  }
  assert.equal(combinations, 6);
}

async function testPreflightRawInputAndTabChanges(browserInstance, fixture) {
  let numericCases = 0;
  let tabCases = 0;
  let generatedOutputs = 0;
  for (const language of ["ko", "en"]) {
    const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block", acceptDownloads: false });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    await page.goto(`${baseUrl}/${language}/tools/pdf-editor/page-numbers/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: "raw-preflight.pdf", mimeType: "application/pdf", buffer: fixture });
    await page.locator("[data-testid='pdf-finish-template']").fill("same settings");
    await waitForReadyPreflight(page);
    const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");

    for (const { testId, value, id } of [
      { testId: "pdf-finish-font-size", value: "10.0", id: "font-size-10.0" },
      { testId: "pdf-finish-margin", value: "24.0", id: "margin-24.0" },
      { testId: "pdf-finish-start-number", value: "01", id: "start-number-01" },
      { testId: "pdf-finish-start-page", value: "01", id: "start-page-01" },
    ]) {
      const label = `${language}/${id}`;
      const transition = observeScheduledPreflight(page);
      const input = page.locator(`[data-testid='${testId}']`);
      await input.fill(value);
      assert.equal(await input.inputValue(), value, `${label} did not preserve the raw numeric representation`);
      assert.deepEqual(await transition, { sawIdle: true, status: "checking" }, `${label} did not schedule a new preflight after entering idle`);
      await waitForReadyPreflight(page);
      await assertReadyPreflight(page, action, label);
      generatedOutputs += await createFreshPdfResult(page, action, label);
      console.log(`[preflight raw] PASS ${label}: idle -> checking -> ready; create enabled; fresh PDF generated`);
      numericCases += 1;
    }

    const template = page.locator("[data-testid='pdf-finish-template']");
    await template.fill("A".repeat(300));
    await template.press("End");
    await template.press("A");
    const limitAlert = template.locator("xpath=following-sibling::*[@role='alert'][1]");
    await limitAlert.waitFor();
    assert.equal((await template.inputValue()).length, 300, `${language}/template-limit must keep the applied value within 300 characters`);
    assert.match(await limitAlert.innerText(), language === "ko" ? /일부만 반영되었습니다/u : /was not applied/iu, `${language}/template-limit must describe the rejected input attempt instead of an over-limit current count`);
    await template.fill("same settings");

    await page.locator("[data-finish-tab='header-footer']").click();
    await page.locator("[data-testid='pdf-finish-template']").fill("same settings");
    await page.locator("[data-testid='pdf-finish-font-size']").fill("10.0");
    await page.locator("[data-testid='pdf-finish-margin']").fill("24.0");
    await page.locator("[data-finish-region='bottom-center']").click();
    await waitForReadyPreflight(page);
    assert.equal(await page.locator("[data-testid='pdf-download']").count(), 0, `${language}/equal-settings-tab setup retained a stale output`);

    const transition = observeScheduledPreflight(page);
    await page.locator("[data-finish-tab='page-numbers']").click();
    assert.deepEqual(await transition, { sawIdle: true, status: "checking" }, `${language}/equal-settings-tab did not schedule a new preflight after entering idle`);
    await waitForReadyPreflight(page);
    await assertReadyPreflight(page, action, `${language}/equal-settings-tab`);
    generatedOutputs += await createFreshPdfResult(page, action, `${language}/equal-settings-tab`);
    console.log(`[preflight tab] PASS ${language}/equal-settings-tab: idle -> checking -> ready; create enabled; fresh PDF generated`);
    tabCases += 1;

    await context.close();
  }
  assert.equal(numericCases, 8);
  assert.equal(tabCases, 2);
  assert.equal(generatedOutputs, 10);
}

function observeScheduledPreflight(page) {
  return page.locator("[data-testid='pdf-finish-ready']").evaluate((panel) => new Promise((resolve, reject) => {
    let sawIdle = panel.getAttribute("data-preflight-status") === "idle";
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("changed input did not schedule preflight"));
    }, 5_000);
    const observer = new MutationObserver(() => {
      const status = panel.getAttribute("data-preflight-status");
      if (status === "idle") sawIdle = true;
      if (status === "checking") {
        window.clearTimeout(timeout);
        observer.disconnect();
        resolve({ sawIdle, status });
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ["data-preflight-status"] });
  }));
}

async function createFreshPdfResult(page, action, label) {
  await page.locator("[data-testid='pdf-download']").waitFor({ state: "detached" });
  await action.click();
  const download = page.locator("[data-testid='pdf-download']");
  await download.waitFor();
  assert.match(await download.getAttribute("download"), /\.pdf$/iu, `${label} did not create a PDF result`);
  assert.equal(await page.locator("[data-route-error]").count(), 0, `${label} escaped the finish route during generation`);
  return 1;
}

async function testOutputNameDownloads(browserInstance, fixture) {
  const cases = [
    { language: "ko", source: "  report.pdf  ", expected: "report-마무리.pdf" },
    { language: "ko", source: " .pdf ", expected: "Worklazy-PDF-마무리.pdf" },
    { language: "en", source: "  report.pdf  ", expected: "report-finished.pdf" },
    { language: "en", source: " .pdf ", expected: "Worklazy-PDF-finished.pdf" },
  ];
  for (const { language, source, expected } of cases) {
    const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block", acceptDownloads: false });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    await page.goto(`${baseUrl}/${language}/tools/pdf-editor/page-numbers/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: source, mimeType: "application/pdf", buffer: fixture });
    await waitForReadyPreflight(page);
    const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");
    assert.equal(await action.isEnabled(), true, `${language}/${JSON.stringify(source)} must be executable`);
    await action.click();
    const download = page.locator("[data-testid='pdf-download']");
    await download.waitFor();
    assert.equal(await download.getAttribute("download"), expected);
    await context.close();
  }
}

async function waitForReadyPreflight(page) {
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready" && !document.querySelector("[data-testid='pdf-finish-preflight-error']"));
}

async function assertReadyPreflight(page, action, label) {
  const snapshot = await page.locator("[data-testid='pdf-finish-ready']").evaluate((panel) => ({
    status: panel.getAttribute("data-preflight-status"),
    alerts: [...panel.querySelectorAll("[role='alert']")].map((element) => element.textContent?.trim()).filter(Boolean),
    routeErrors: document.querySelectorAll("[data-route-error]").length,
  }));
  assert.equal(snapshot.status, "ready", `${label} left preflight without a scheduled result`);
  assert.equal(await action.isEnabled(), true, `${label} left the create action disabled`);
  assert.deepEqual(snapshot.alerts, [], `${label} exposed an unexpected alert`);
  assert.equal(snapshot.routeErrors, 0, `${label} escaped the finish route`);
}

async function testFinishWorkflow(browserInstance, fixture) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block", acceptDownloads: false });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${baseUrl}/en/tools/pdf-editor/page-numbers/`, { waitUntil: "networkidle" });
  await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: "finish-browser.pdf", mimeType: "application/pdf", buffer: fixture });
  await page.locator("[data-testid='pdf-finish-overlay']").waitFor();
  assert.equal(await page.locator("[data-testid='pdf-finish-thumbnails'] .pdf-page-card").count(), 3);

  const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");
  const startPage = page.locator("[data-testid='pdf-finish-start-page']");
  for (const invalid of ["", "0", "-1", "1.5"]) {
    await startPage.fill(invalid);
    await page.locator("[data-testid='pdf-finish-start-page-error']").waitFor();
    assert.equal(await action.isDisabled(), true, `starting page ${JSON.stringify(invalid)} must disable execution`);
    assert.equal(await page.locator("[data-route-error]").count(), 0, `starting page ${JSON.stringify(invalid)} escaped the form boundary`);
    assert.equal(await page.locator("[data-testid='pdf-finish-ready']").count(), 1, "the finish form must survive an invalid starting page");
  }
  await startPage.fill("1");
  await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-finish-start-page-error']"));
  await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor({ state: "attached" });
  await page.locator("[data-testid='pdf-finish-font-size']").fill("2");
  assert.equal(await action.isDisabled(), true, "invalid font size must disable execution");
  assert.match(await page.locator("[role='alert']").last().innerText(), /6|font size/iu);
  await page.locator("[data-testid='pdf-finish-font-size']").fill("10");

  const range = page.locator("[data-testid='pdf-finish-range']");
  await range.fill("1");
  await range.blur();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='pdf-finish-thumbnails'] input[type='checkbox']:checked").length === 1);
  const checks = page.locator("[data-testid='pdf-finish-thumbnails'] input[type='checkbox']");
  await checks.nth(1).click();
  assert.equal(await range.inputValue(), "1-2");
  assert.equal(await page.locator("[data-testid='pdf-finish-parity']").inputValue(), "all");
  await checks.nth(0).click();
  assert.equal(await range.inputValue(), "2");

  await page.locator("[data-testid='pdf-finish-start-page']").fill("2");
  assert.equal(await checks.nth(0).isDisabled(), true, "pages below the numbering anchor must be disabled");
  await page.locator("[data-testid='pdf-finish-start-page']").fill("1");
  await range.fill("");
  assert.equal(await action.isDisabled(), true, "an empty exact page set must disable execution");

  await range.fill("2");
  await page.locator("[data-testid='pdf-finish-start-page']").fill("2");
  await page.locator("[data-testid='pdf-finish-start-number']").fill("5");
  await page.locator("[data-testid='pdf-finish-template']").fill("P{page}/{pages} {date:YYYY-MM-DD}");
  await page.locator("[data-finish-region='bottom-right']").click();
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready" && !document.querySelector("[data-testid='pdf-finish-preflight-error']"));
  await action.click();
  const download = page.locator("[data-testid='pdf-download']");
  await download.waitFor({ timeout: 120_000 });
  assert.equal(await download.getAttribute("download"), "finish-browser-finished.pdf");
  const output = Buffer.from(await download.evaluate(async (link) => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer()))));
  const outputPath = path.join(tempDirectory, "finished.pdf");
  await fs.writeFile(outputPath, output);
  const document = await PDFDocument.load(output);
  assert.equal(document.getPageCount(), 3);
  assert.equal(document.getPage(1).getRotation().angle, 90);
  assert.deepEqual(document.getPage(1).getCropBox(), { x: 20, y: 30, width: 300, height: 400 });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(output) });
  try {
    const parsed = await loadingTask.promise;
    const pageText = [];
    for (let index = 1; index <= parsed.numPages; index += 1) {
      const content = await (await parsed.getPage(index)).getTextContent();
      pageText.push(content.items.map((item) => item.str ?? "").join(" "));
    }
    assert.equal(pageText.filter((text) => /P5\/3/u.test(text)).length, 1);
    assert.match(pageText[1], /P5\/3/u);
  } finally {
    await loadingTask.destroy();
  }
  const { stdout } = await execFileAsync("pdftotext", [outputPath, "-"]);
  assert.match(stdout, /P5\/3/u, "Poppler text oracle did not find the decoration");

  await range.fill("1-3");
  await page.locator("[data-testid='pdf-finish-start-page']").fill("1");
  await page.locator("[data-testid='pdf-finish-template']").fill("취소 확인 {page}");
  const cancelWhenRendered = page.evaluate(() => new Promise((resolve) => {
    const clickCancel = () => {
      const button = document.querySelector("[data-testid='pdf-finish-cancel']");
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      resolve(true);
      return true;
    };
    if (clickCancel()) return;
    const observer = new MutationObserver(() => { if (clickCancel()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }));
  await action.click();
  await cancelWhenRendered;
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-error']")?.textContent?.match(/cancel|취소/i));
  assert.equal(await page.locator("[data-testid='pdf-download']").count(), 0, "canceled work must not register a stale result");
  await page.locator("[data-testid='pdf-finish-template']").fill("Retry {page}");
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready" && !document.querySelector("[data-testid='pdf-finish-preflight-error']"));
  await action.click();
  await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120_000 });
  assert.equal(await page.locator("[data-route-error]").count(), 0);
  await context.close();
}

async function testWatermarkWorkflow(browserInstance, fixture, inlineImageFixture) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  await page.goto(`${baseUrl}/en/tools/pdf-editor/watermark/`, { waitUntil: "networkidle" });
  const pdfInput = page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']");
  await pdfInput.setInputFiles({ name: "watermark-browser.pdf", mimeType: "application/pdf", buffer: fixture });
  await page.locator("[data-testid='pdf-finish-overlay']").waitFor();
  await page.locator("[data-testid='pdf-watermark-pattern']").selectOption("tile");
  await page.locator("[data-testid='pdf-watermark-layer']").selectOption("background");
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-overlay']")?.getAttribute("data-watermark-pattern") === "tile");
  await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor();
  const initialTiles = await page.locator("[data-testid='pdf-finish-overlay']").evaluate((overlay) => ({ count: Number(overlay.getAttribute("data-placement-count")), width: overlay.querySelector("[data-watermark-placement]")?.getBoundingClientRect().width ?? 0 }));
  await page.locator("[data-testid='pdf-watermark-size']").fill("30");
  await page.waitForFunction((previous) => {
    const overlay = document.querySelector("[data-testid='pdf-finish-overlay']");
    const placement = overlay?.querySelector("[data-watermark-placement]");
    return Number(overlay?.getAttribute("data-placement-count")) !== previous.count && placement instanceof HTMLElement && Math.abs(placement.getBoundingClientRect().width - previous.width) > 2;
  }, initialTiles);
  const resizedTiles = await page.locator("[data-testid='pdf-finish-overlay']").evaluate((overlay) => ({ count: Number(overlay.getAttribute("data-placement-count")), width: overlay.querySelector("[data-watermark-placement]")?.getBoundingClientRect().width ?? 0 }));
  assert.notEqual(resizedTiles.count, 18, "tile preview must not use the former fixed 18-item grid");
  assert.ok(resizedTiles.width < initialTiles.width, `tile size did not change the preview geometry: ${JSON.stringify({ initialTiles, resizedTiles })}`);

  await page.locator("[data-testid='pdf-watermark-offset-x']").fill("2000");
  const emptyPlacement = page.locator("[data-testid='pdf-finish-preflight-error'][data-error-code='empty-placement']");
  await emptyPlacement.waitFor();
  assert.match(await emptyPlacement.innerText(), /No watermark would appear/iu);
  const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");
  assert.equal(await action.isDisabled(), true, "zero watermark placements must block result creation");
  await page.locator("[data-testid='pdf-watermark-offset-x']").fill("24");
  await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor();

  const png = new PNG({ width: 32, height: 16 });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 190; png.data[index + 1] = 30; png.data[index + 2] = 55; png.data[index + 3] = 255;
  }
  await page.locator("[data-testid='pdf-watermark-content-image']").click();
  await page.locator("[data-testid='pdf-watermark-image']").setInputFiles({ name: "mark.png", mimeType: "image/png", buffer: PNG.sync.write(png) });
  await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor();
  const image = page.locator("[data-testid='pdf-finish-overlay'] img").first();
  await image.waitFor();
  const ratio = await image.evaluate((node) => node.naturalWidth / node.naturalHeight);
  assert.ok(Math.abs(ratio - 2) < 0.1, `watermark preview did not preserve the image ratio: ${ratio}`);

  await action.click();
  await page.locator("[data-testid='pdf-download']").waitFor();
  assert.equal(await page.locator("[data-route-error]").count(), 0);

  await page.locator("[data-testid='pdf-watermark-content-text']").click();
  await pdfInput.setInputFiles({ name: "valid-inline-image.pdf", mimeType: "application/pdf", buffer: inlineImageFixture });
  await page.locator("[data-testid='pdf-watermark-layer']").selectOption("foreground");
  await page.locator("[data-testid='pdf-finish-font-size']").fill("6");
  await page.locator("[data-testid='pdf-watermark-size']").fill("10");
  await page.locator("[data-testid='pdf-watermark-gap']").fill("10");
  await page.locator("[data-testid='pdf-watermark-offset-x']").fill("0");
  await page.locator("[data-testid='pdf-watermark-offset-y']").fill("0");
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-testid='pdf-finish-ready']");
    const button = panel?.querySelector("[data-ui-component='primary-button']");
    return panel?.getAttribute("data-preflight-status") === "ready" && button instanceof HTMLButtonElement && !button.disabled;
  });
  assert.equal(await page.locator("[data-warning-code='risky-graphics-state']").count(), 0, "a normal inline image must not be blanket-warned as risky");
  await action.click();
  const cancel = page.locator("[data-testid='pdf-finish-cancel']");
  await cancel.waitFor();
  await cancel.click();
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-error']")?.textContent?.match(/cancel/i));
  assert.equal(await page.locator("[data-testid='pdf-download']").count(), 0, "cancelled inline-image work exposed a result");
  await action.click();
  await page.locator("[data-testid='pdf-download']").waitFor();

  await pdfInput.setInputFiles(path.join(repositoryRoot, "tests/fixtures/pdf-finish/risk/graphics-state-imbalance.pdf"));
  await page.locator("[data-testid='pdf-watermark-risk-confirmation']").waitFor();
  assert.equal(await action.isDisabled(), true, "a risky document must wait for explicit consent");
  await page.locator("[data-testid='pdf-watermark-risk-confirmation'] button[role='switch']").click();
  assert.equal(await action.isEnabled(), true, "risk consent must allow the warned operation");
  await context.close();
}

async function testBoundaryCropRendering(browserInstance, fixture) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  await page.goto(`${baseUrl}/en/tools/pdf-editor/page-numbers/`, { waitUntil: "networkidle" });
  await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: "outside-crop.pdf", mimeType: "application/pdf", buffer: fixture });
  await page.locator("[data-testid='pdf-finish-template']").fill("BOUNDARY");
  await page.locator("[data-testid='pdf-finish-color']").fill("#ff0000");
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready" && !document.querySelector("[data-testid='pdf-finish-preflight-error']"));
  await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
  const download = page.locator("[data-testid='pdf-download']");
  await download.waitFor();
  const output = Buffer.from(await download.evaluate(async (link) => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer()))));
  const outputPath = path.join(tempDirectory, "outside-crop-finished.pdf");
  const prefix = path.join(tempDirectory, "outside-crop-poppler");
  await fs.writeFile(outputPath, output);
  await execFileAsync("pdftoppm", ["-cropbox", "-r", "72", "-png", outputPath, prefix]);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(output) });
  try {
    const document = await task.promise;
    assert.equal(document.numPages, 4);
    for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
      const renderedPage = await document.getPage(pageNumber);
      const viewport = renderedPage.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await renderedPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const pdfjsPixels = redPixelCount(PNG.sync.read(canvas.toBuffer("image/png")));
      const popplerPixels = redPixelCount(PNG.sync.read(await fs.readFile(`${prefix}-${pageNumber}.png`)));
      assert.ok(pdfjsPixels > 0, `PDF.js rendered zero decoration pixels for outside CropBox rotation page ${pageNumber}`);
      assert.ok(popplerPixels > 0, `Poppler rendered zero decoration pixels for outside CropBox rotation page ${pageNumber}`);
      const text = await renderedPage.getTextContent();
      const mark = text.items.find((item) => item.str === "BOUNDARY");
      assert.ok(mark, `page ${pageNumber} is missing the boundary decoration text`);
      const transform = pdfjs.Util.transform(viewport.transform, mark.transform);
      assert.ok(transform[0] > 0 && Math.abs(transform[1]) < 1e-6, `page ${pageNumber} decoration is not upright`);
    }
  } finally {
    await task.destroy();
  }
  await context.close();
}

function redPixelCount(image) {
  let count = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index] > 160 && image.data[index + 1] < 110 && image.data[index + 2] < 110) count += 1;
  }
  return count;
}

async function createFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([400, 600]);
  first.drawText("Original first page", { x: 40, y: 520, size: 14, font });
  const second = document.addPage([500, 700]);
  second.setCropBox(20, 30, 300, 400);
  second.setRotation(degrees(90));
  second.drawText("Original second page", { x: 60, y: 350, size: 14, font });
  const third = document.addPage([400, 600]);
  third.drawText("Original third page", { x: 40, y: 520, size: 14, font });
  return Buffer.from(await document.save());
}

async function createBoundaryCropFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const rotation of [0, 90, 180, 270]) {
    const page = document.addPage([400, 600]);
    page.setCropBox(-50, -80, 600, 850);
    page.setRotation(degrees(rotation));
    page.drawText(`Original ${rotation}`, { x: 40, y: 520, size: 14, font });
  }
  return Buffer.from(await document.save());
}

async function createSmallFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  document.addPage([200, 200]);
  return Buffer.from(await document.save());
}

async function createInlineImageFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const page = document.addPage([200, 200]);
  page.node.set(PDFName.of("Contents"), document.context.register(document.context.flateStream("q\n80 0 0 80 60 60 cm\nBI /W 1 /H 1 /BPC 8 /CS /G ID\n)\nEI\nQ")));
  return Buffer.from(await document.save());
}

async function assertLazyChunks() {
  const assets = await fs.readdir(path.join(repositoryRoot, "dist/assets"));
  assert.ok(assets.some((name) => /^PdfFinishPanel-.+\.js$/u.test(name)), "PdfFinishPanel must be a distinct lazy chunk");
  assert.ok(assets.some((name) => /^pdfFontEmbed-.+\.js$/u.test(name)), "finish and QR must share the pdfFontEmbed lazy chunk");
}

async function startPreview() {
  const { spawn } = await import("node:child_process");
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early (${child.exitCode}): ${output.join("")}`);
    try { if ((await fetch(baseUrl)).ok) return child; } catch { /* Preview is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
