import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import initRhwp, { HwpDocument } from "@rhwp/core";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";
import { createFile as createMp4BoxFile } from "mp4box";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const koBaseUrl = `${baseUrl}/ko`;
const onlyVideo = process.env.TEST_ONLY_VIDEO === "1";
const onlyAudio = process.env.TEST_ONLY_AUDIO === "1";
const onlyImageSizing = process.env.TEST_ONLY_IMAGE_SIZING === "1";
const onlyImageMobile = process.env.TEST_ONLY_IMAGE_MOBILE === "1";
const onlyImageAccessibility = process.env.TEST_ONLY_IMAGE_ACCESSIBILITY === "1";
const onlyImage = process.env.TEST_ONLY_IMAGE === "1" || onlyImageSizing || onlyImageMobile || onlyImageAccessibility;
const onlyHwp = process.env.TEST_ONLY_HWP === "1";
const HWP_ROUNDTRIP_SENTINEL = "WL_RHWP_086_SENTINEL";
const HWP_FIXTURE_SHA256 = "35c590e316c18e7310bb7b2f954b87d32f1d45416179466aee2bebb99d7e706f";
let rhwpInitialization;
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-new-tools-"));

try {
  const fixtures = onlyHwp ? await createHwpFixtures(tempDirectory) : await createFixtures(tempDirectory);
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    protocolTimeout: 300_000,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    page.setDefaultTimeout(300_000);
    const pageErrors = [];
    const requestFailures = [];
    page.on("pageerror", (error) => { pageErrors.push(error.message); console.error("[page error]", error.message); });
    page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("ERR_CONNECTION_REFUSED")) console.error("[browser]", message.text()); });
    page.on("requestfailed", (request) => {
      if (request.url().includes("googlesyndication.com")) return;
      if (request.url().startsWith("blob:") && request.failure()?.errorText === "net::ERR_ABORTED") return;
      if (new URL(request.url()).origin !== new URL(baseUrl).origin) return;
      requestFailures.push(`${request.url()} ${request.failure()?.errorText || "unknown error"}`);
      console.error("[request failed]", request.url(), request.failure()?.errorText);
    });

    if (onlyHwp) {
      console.log("[1/1] HWP editor and comparison");
      await testHwpEditor(page, fixtures.hwpFiles, fixtures.wordDocx);
    } else if (onlyImageMobile) {
      console.log("[1/1] Image studio mobile interactions");
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await testImageStudioMobile(page);
    } else if (onlyImageAccessibility) {
      console.log("[1/1] Image studio accessibility alternatives");
      await testImageStudioAccessibility(page);
    } else if (onlyImageSizing) {
      console.log("[1/1] Image studio sizing and panel");
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
      await testImageStudioSizingAndPanel(page);
    } else if (!onlyVideo && !onlyAudio) {
      if (!onlyImage) {
        console.log("[1/4] HWP editor");
        await testHwpEditor(page, fixtures.hwpFiles, fixtures.wordDocx);
      }
    console.log("[2/4] Image studio");
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await testImageStudio(page, fixtures.images);
    await testImageStudioLayersAndSelection(page);
    await testImageStudioRegionInteractions(page);
    await testImageStudioCropBoxEditing(page);
    const cropMatrix = [];
    for (const transformed of [false, true]) {
      for (const zoom of [1, 2]) {
        for (const erased of [false, true]) {
          console.log(`  image: probing P4 crop matrix transformed=${transformed} zoom=${zoom} erased=${erased}`);
          cropMatrix.push(await testImageStudioCropOverlayMatrix(page, { transformed, zoom, erased }));
        }
      }
    }
    console.log(`  image: P4 crop overlay matrix ${JSON.stringify(cropMatrix)}`);
    await testImageStudioSizingAndPanel(page);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await testImageStudioMobile(page);
    for (const deviceScaleFactor of [2, 1]) {
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor });
      for (const zoom of [1, 2]) await testImageStudioEffectStrength(page, deviceScaleFactor, zoom);
    }
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    }
    if (!onlyHwp && !onlyVideo && !onlyImage) {
      console.log("[3/4] Audio studio");
      await testAudioStudio(page, fixtures.audio);
    }
    if (!onlyHwp && !onlyAudio && !onlyImage) {
      console.log("[4/4] Video studio");
      await testVideoStudio(
        page,
        fixtures.videos,
        fixtures.largeVideo,
        fixtures.largePassThroughVideos,
        fixtures.largeAudioIncompatibleVideo,
        fixtures.targetAudioIncompatibleVideo,
        fixtures.videoIncompatibleVideo,
        fixtures.dolbyVisionVideo,
      );
    }

    if (pageErrors.length) throw new Error(`Browser errors:\n${pageErrors.join("\n")}`);
    if (requestFailures.length) throw new Error(`Same-origin request failures:\n${requestFailures.join("\n")}`);
  } finally {
    await browser.close();
  }
  console.log(process.env.TEST_ONLY_HWP === "1"
    ? "HWP editor and unified document comparison smoke tests passed."
    : "New tool smoke tests passed: HWP editor, image clipboard/batch/collage preview, audio waveform editing/export, video group timelines and grouped output.");
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

async function testHwpEditor(page, hwpPaths, wordDocx) {
  await page.goto(`${koBaseUrl}/tools/document-compare`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-slot='rhwp-version-notice']");
  const compareVersion = await page.$eval("[data-slot='rhwp-version-notice']", (element) => element.textContent || "");
  if (!compareVersion.includes("rhwp 0.8.6") || !compareVersion.includes("공식 비교 파일")) {
    throw new Error(`HWP comparison version notice is incomplete: ${compareVersion}`);
  }
  let compareInputs = await page.$$("[data-tool-page='document-compare'] input[type=file]");
  await compareInputs[0].uploadFile(hwpPaths[0]);
  await page.waitForFunction(() => document.querySelectorAll("[data-testid^='document-file-list-']")[0]?.children.length === 1);
  compareInputs = await page.$$("[data-tool-page='document-compare'] input[type=file]");
  await compareInputs[1].uploadFile(wordDocx);
  await page.waitForFunction(() => document.querySelectorAll("[data-testid^='document-file-list-']")[1]?.children.length === 1);
  await page.$eval("[data-testid='document-action-bar'] [data-ui-component='primary-button']", (button) => button.click());
  await page.waitForFunction(() => document.querySelector("[data-tool-page='document-compare'] [role='alert']")?.textContent?.includes("Word 문서와 HWP 문서는 서로 비교할 수 없습니다"));
  await page.evaluate(() => {
    const lists = document.querySelectorAll("[data-testid^='document-file-list-']");
    const remove = lists[1]?.querySelector("[data-testid='document-file-item'] button:last-child");
    if (!(remove instanceof HTMLButtonElement)) throw new Error("Cross-family test file remove button was not found.");
    remove.click();
  });
  await page.waitForFunction(() => document.querySelectorAll("[data-testid^='document-file-list-']").length === 1);
  compareInputs = await page.$$("[data-tool-page='document-compare'] input[type=file]");
  await compareInputs[0].uploadFile(hwpPaths[1]);
  await page.waitForFunction(() => document.querySelectorAll("[data-testid^='document-file-list-']")[0]?.children.length === 2);
  const hwpAddButton = await page.$eval("[data-tool-page='document-compare'] [data-ui-part=drop-target] [data-slot=button]", (button) => button.textContent || "");
  if (!hwpAddButton.includes("더 추가")) throw new Error(`HWP comparison does not expose incremental file addition: ${hwpAddButton}`);
  await page.$eval("[data-testid='document-file-item'] button[title]", (button) => button.click());
  await page.waitForFunction(() => {
    const lists = document.querySelectorAll("[data-testid^='document-file-list-']");
    return lists.length === 2 && lists[0].children.length === 1 && lists[1].children.length === 1;
  });
  await page.$eval("[data-testid='document-action-bar'] [data-ui-component='primary-button']", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-success") || document.querySelector("[data-tool-page='document-compare'] [role='alert']"), { timeout: 120_000 });
  const compareError = await page.$eval("[data-tool-page='document-compare'] [role='alert']", (element) => element.textContent || "").catch(() => "");
  if (compareError) throw new Error(`Unified HWP comparison failed: ${compareError}`);
  if (await page.$$('[data-testid="document-result-card"]').then((items) => items.length) !== 1
    || await page.$$('[data-testid="document-result-card"] [data-testid="document-excel-download"]').then((items) => items.length) !== 1
    || await page.$$('[data-testid="document-result-card"] [data-testid="document-tracked-download"]').then((items) => items.length) !== 0) {
    throw new Error("Unified HWP comparison outputs do not match the selected formats.");
  }
  await page.$eval("[data-testid='document-result-card'] [data-testid='document-view-result']", (button) => button.click());
  await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/1") && document.querySelector("[data-testid='document-result-summary']"));

  const forbiddenRhwpRequests = [];
  const recordRhwpRequest = (request) => {
    if (/edwardkim\.github\.io|cdn\.jsdelivr\.net/i.test(request.url())) forbiddenRhwpRequests.push(request.url());
  };
  page.on("request", recordRhwpRequest);
  await page.goto(`${koBaseUrl}/tools/hwp-editor`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='hwp-editor-shell'] iframe");
  await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-success")?.textContent?.includes("편집기를 사용할 수 있습니다"));
  const runtime = await page.$eval("[data-testid='hwp-editor-shell'] iframe", (iframe) => {
    const url = new URL(iframe.src);
    const csp = iframe.contentDocument?.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") || "";
    const version = iframe.contentDocument?.querySelector('meta[name="rhwp-version"]')?.getAttribute("content") || "";
    return { sameOrigin: url.origin === location.origin, path: url.pathname, csp, version };
  });
  if (!runtime.sameOrigin || !runtime.path.includes("/vendor/rhwp-studio/0.8.6/") || runtime.version !== "0.8.6"
    || !runtime.csp.includes("connect-src 'self'") || !runtime.csp.includes("font-src 'self'")) {
    throw new Error(`HWP editor is not using the isolated self-hosted runtime: ${JSON.stringify(runtime)}`);
  }
  await page.waitForSelector("[data-tool-page='hwp-editor'] input[type=file]");
  await (await page.$("[data-tool-page='hwp-editor'] input[type=file]")).uploadFile(hwpPaths[0]);
  await page.waitForSelector("[data-testid='hwp-focus-toolbar']");
  const editorDescription = await page.$eval("[data-ui-component='section-card']:has([data-testid='hwp-editor-shell'])", (element) => element.textContent || "");
  if (!editorDescription.includes("1페이지")) throw new Error(`HWP page count is incorrect: ${editorDescription}`);
  const focusLayout = await page.evaluate(() => {
    const focus = document.querySelector("[data-tool-page='hwp-editor']")?.getBoundingClientRect();
    const sidebar = document.querySelector(".sidebar")?.getBoundingClientRect();
    const shell = document.querySelector("[data-testid='hwp-editor-shell']")?.getBoundingClientRect();
    return focus && sidebar && shell ? { focus: { left: focus.left, right: focus.right, top: focus.top, bottom: focus.bottom }, sidebar: { right: sidebar.right }, shellHeight: shell.height, hasPageHeader: Boolean(document.querySelector("[data-tool-page='hwp-editor'] .ui-page-header")) } : null;
  });
  if (!focusLayout || focusLayout.focus.left < focusLayout.sidebar.right || focusLayout.focus.right < 1435 || focusLayout.focus.top > 10 || focusLayout.focus.bottom < 895 || focusLayout.shellHeight < focusLayout.focus.bottom - focusLayout.focus.top - 130 || focusLayout.hasPageHeader) {
    throw new Error(`HWP focus layout did not fill the area outside the sidebar: ${JSON.stringify(focusLayout)}`);
  }
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid='hwp-save']");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const editorVersion = await page.$eval("[data-slot='rhwp-version-notice'][data-compact='true']", (element) => element.textContent || "");
  if (!editorVersion.includes("rhwp 0.8.6") || !editorVersion.includes("이 사이트에 포함")) {
    throw new Error(`HWP editor version notice is incomplete: ${editorVersion}`);
  }

  const sourceStructure = await inspectHwpBytes(await fs.readFile(hwpPaths[0]));
  await page.evaluate(() => {
    window.__worklazyOriginalCreateObjectURL = URL.createObjectURL.bind(URL);
    window.__worklazyCapturedHwpBlob = undefined;
    URL.createObjectURL = (value) => {
      if (value instanceof Blob && value.type === "application/x-hwp") window.__worklazyCapturedHwpBlob = value;
      return window.__worklazyOriginalCreateObjectURL(value);
    };
  });
  const studioIframe = await page.$("[data-testid='hwp-editor-shell'] iframe");
  const studioFrame = await studioIframe?.contentFrame();
  if (!studioFrame) throw new Error("HWP Studio iframe was not available for round-trip editing.");
  await studioFrame.waitForSelector(".document-page-canvas");
  await studioFrame.click(".document-page-canvas", { offset: { x: 130, y: 130 } });
  await page.keyboard.type(HWP_ROUNDTRIP_SENTINEL, { delay: 10 });
  await page.click("[data-testid='hwp-save']");
  await page.waitForFunction(() => window.__worklazyCapturedHwpBlob instanceof Blob
    && document.querySelector("[data-testid='hwp-save']") instanceof HTMLButtonElement
    && !document.querySelector("[data-testid='hwp-save']").disabled);
  const roundTripBytes = Uint8Array.from(await page.evaluate(async () => Array.from(
    new Uint8Array(await window.__worklazyCapturedHwpBlob.arrayBuffer()),
  )));
  await page.evaluate(() => {
    URL.createObjectURL = window.__worklazyOriginalCreateObjectURL;
    delete window.__worklazyOriginalCreateObjectURL;
    delete window.__worklazyCapturedHwpBlob;
  });
  const roundTripStructure = await inspectHwpBytes(roundTripBytes);
  if (!roundTripStructure.text.includes(HWP_ROUNDTRIP_SENTINEL)
    || roundTripStructure.pageCount !== sourceStructure.pageCount
    || roundTripStructure.sectionCount !== sourceStructure.sectionCount
    || roundTripStructure.paragraphCount < sourceStructure.paragraphCount) {
    throw new Error(`HWP round-trip parse verification failed: ${JSON.stringify({ sourceStructure, roundTripStructure })}`);
  }
  const reopenedName = "rhwp-roundtrip-reopened.hwp";
  const reopenedPath = path.join(path.dirname(hwpPaths[0]), reopenedName);
  await fs.writeFile(reopenedPath, roundTripBytes);
  await (await page.$("[data-testid='hwp-focus-open']")).uploadFile(reopenedPath);
  await page.waitForFunction((expectedName) => document.querySelector("[data-testid='hwp-focus-document'] strong")?.textContent === expectedName
    && document.querySelector("[data-testid='hwp-focus-document'] small")?.textContent?.includes("1페이지"), {}, reopenedName);
  console.log(`  hwp: round-trip ${roundTripBytes.byteLength} bytes, ${roundTripStructure.pageCount} page, sentinel parsed and Studio reopened`);

  page.off("request", recordRhwpRequest);
  if (forbiddenRhwpRequests.length) throw new Error(`HWP editor requested external rhwp resources: ${forbiddenRhwpRequests.join(", ")}`);
}

async function testImageStudio(page, imagePaths) {
  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".studio-tabs button").length === 4 && document.querySelector(".studio-tabs button")?.textContent?.includes("이미지 편집"));
  const tabStates = await page.$$eval(".studio-tabs button", (buttons) => buttons.map((button) => button.getAttribute("aria-pressed")));
  if (tabStates.filter((state) => state === "true").length !== 1 || tabStates.filter((state) => state === "false").length !== 3) throw new Error(`Image Studio modes do not expose their current state: ${JSON.stringify(tabStates)}`);
  await page.waitForSelector(".fabric-stage");
  await dropCanvasImages(page, ".fabric-stage", ["#159bd7"]);
  await page.waitForSelector(".fabric-stage .canvas-container");
  await page.waitForFunction(() => document.querySelector(".image-studio-page [data-ui-part=drop-target] strong")?.textContent?.includes("1개 파일 선택됨"));
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .lower-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const pixel = canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return pixel && pixel[2] > 150;
  });
  const editorControls = await page.evaluate(() => ({
    hasVerticalFlip: Boolean(document.querySelector('button[aria-label="상하 반전"]')),
    toolbarPanels: document.querySelectorAll('.image-editor-panel-tabs [data-testid^="image-editor-panel-"]').length,
    hasPanelToggle: Boolean(document.querySelector('[data-testid="image-editor-panel-toggle"]')),
    jpgNotice: document.querySelector(".image-format-control small")?.textContent || "",
  }));
  if (!editorControls.hasVerticalFlip || editorControls.toolbarPanels !== 10 || !editorControls.hasPanelToggle || !editorControls.jpgNotice.includes("JPG") || !editorControls.jpgNotice.includes("흰색")) {
    throw new Error(`Unified editor controls are incomplete: ${JSON.stringify(editorControls)}`);
  }
  await page.click('[data-testid="image-editor-panel-canvas"]');
  await page.click('[data-testid="image-editor-options-panel"][data-panel="canvas"] .image-background-options button[role="switch"]');
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .lower-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    return canvas.getContext("2d")?.getImageData(1, 1, 1, 1).data[3] === 0;
  });
  const expandedShapeKinds = ["rounded-rect", "triangle", "star", "hexagon", "speech-bubble", "arrow", "double-arrow", "highlighter"];
  await page.click('[data-testid="image-editor-panel-shapes"]');
  for (const kind of expandedShapeKinds) {
    console.log(`  image: probing shape ${kind}`);
    await page.$eval(`[data-testid="image-editor-shape-${kind}"]`, (button) => button.click());
    const panelAfterShapeInsert = await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.getAttribute("data-panel"));
    if (panelAfterShapeInsert !== "shapes") throw new Error(`${kind} insertion closed its tool panel: ${panelAfterShapeInsert}`);
    await page.$eval('[data-testid="image-editor-panel-select"]', (button) => button.click());
    await page.waitForFunction((expectedKind) => document.querySelector('[data-testid="image-editor-selection-controls"]')?.getAttribute("data-shape-kind") === expectedKind, {}, kind);
    const beforeStyle = await page.$eval('[data-testid="image-editor-selection-controls"]', (controls) => ({
      geometry: controls.getAttribute("data-shape-geometry"),
      opacity: controls.getAttribute("data-shape-opacity"),
      width: controls.getAttribute("data-shape-width"),
      hasStroke: Boolean(controls.querySelector('[data-testid="image-editor-select-stroke"]')),
      widthDisabled: controls.querySelector('[data-testid="image-editor-select-width"]')?.disabled,
    }));
    await page.evaluate((shapeKind) => {
      const setValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const fill = document.querySelector('[data-testid="image-editor-select-color"]');
      const stroke = document.querySelector('[data-testid="image-editor-select-stroke"]');
      const width = document.querySelector('[data-testid="image-editor-select-width"]');
      if (!(fill instanceof HTMLInputElement) || !(width instanceof HTMLInputElement)) throw new Error(`${shapeKind} style controls are unavailable`);
      setValue(fill, "#00aa55");
      if (stroke instanceof HTMLInputElement) setValue(stroke, "#112233");
      setValue(width, "12");
    }, kind);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const afterStyle = await page.$eval('[data-testid="image-editor-selection-controls"]', (controls) => ({
      geometry: controls.getAttribute("data-shape-geometry"),
      opacity: controls.getAttribute("data-shape-opacity"),
      color: controls.getAttribute("data-shape-color"),
      stroke: controls.getAttribute("data-shape-stroke"),
      width: controls.getAttribute("data-shape-width"),
    }));
    if (afterStyle.color !== "#00aa55") throw new Error(`${kind} ignored an applicable fill change: ${JSON.stringify(afterStyle)}`);
    if (kind === "highlighter") {
      if (beforeStyle.hasStroke || !beforeStyle.widthDisabled || afterStyle.stroke !== "#ffffff" || afterStyle.width !== "0" || afterStyle.opacity !== "0.45") {
        throw new Error(`Highlighter accepted a non-applicable border style or lost fixed opacity: ${JSON.stringify({ beforeStyle, afterStyle })}`);
      }
    } else if (afterStyle.stroke !== "#112233" || afterStyle.width !== "12") {
      throw new Error(`${kind} ignored an applicable border style: ${JSON.stringify(afterStyle)}`);
    }
    if ((kind === "arrow" || kind === "double-arrow") && afterStyle.geometry !== beforeStyle.geometry) {
      throw new Error(`${kind} border width rewrote fixed points/width/height: ${JSON.stringify({ before: beforeStyle.geometry, after: afterStyle.geometry })}`);
    }
    await page.$eval('[data-testid="image-editor-delete"]', (button) => button.click());
    await page.$eval('[data-testid="image-editor-panel-shapes"]', (button) => button.click());
  }
  console.log("  image: expanded single-object shape matrix and fixed arrow geometry verified");
  await page.$eval('[data-testid="image-editor-shape-rounded-rect"]', (button) => button.click());
  await page.waitForSelector('[data-testid="image-editor-minibar"]');
  const panelAfterInsert = await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.getAttribute("data-panel"));
  if (panelAfterInsert !== "shapes") throw new Error(`Shape insertion closed its tool panel: ${panelAfterInsert}`);
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => window.scrollTo({ top: canvas.getBoundingClientRect().top + scrollY - 180, behavior: "instant" }));
  const minibarBeforeMove = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  const objectCanvas = await page.$(".fabric-stage .upper-canvas");
  const objectCanvasBox = await objectCanvas?.boundingBox();
  if (!objectCanvasBox) throw new Error("Image canvas is unavailable for the minibar movement test");
  const objectScale = objectCanvasBox.width / 900;
  await page.mouse.move(objectCanvasBox.x + 120 * objectScale, objectCanvasBox.y + 120 * objectScale);
  await page.mouse.down();
  await page.mouse.move(objectCanvasBox.x + 220 * objectScale, objectCanvasBox.y + 190 * objectScale, { steps: 8 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const minibarAfterMove = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  if (Math.hypot(minibarAfterMove.left - minibarBeforeMove.left, minibarAfterMove.top - minibarBeforeMove.top) < 20) throw new Error(`Floating minibar did not follow the moved object: ${JSON.stringify({ minibarBeforeMove, minibarAfterMove })}`);
  await page.click('[data-testid="image-editor-panel-select"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-selection-controls"]')?.classList.contains("is-disabled"));
  await page.evaluate(() => {
    const setValue = (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const fill = document.querySelector('[data-testid="image-editor-select-color"]');
    const stroke = document.querySelector('[data-testid="image-editor-select-stroke"]');
    const width = document.querySelector('[data-testid="image-editor-select-width"]');
    if (!(fill instanceof HTMLInputElement) || !(stroke instanceof HTMLInputElement) || !(width instanceof HTMLInputElement)) throw new Error("Shape controls are unavailable");
    setValue(fill, "#00ff00");
    setValue(stroke, "#000000");
    setValue(width, "8");
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const styledCanvas = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  await page.evaluate(() => {
    window.__worklazyExportDataUrl = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function captureImageExport() {
      if (this.href.startsWith("data:image/")) {
        window.__worklazyExportDataUrl = this.href;
        return;
      }
      return originalClick.call(this);
    };
  });
  const identityExports = {};
  for (const format of ["PNG", "JPG", "WebP"]) identityExports[format] = await captureImageEditorExport(page, format);
  const jpegGreenBounds = await page.evaluate(async () => {
    const dataUrl = window.__worklazyExportDataUrl;
    if (!dataUrl) throw new Error("JPEG export was not captured");
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let maxX = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if (pixels[offset] < 30 && pixels[offset + 1] > 220 && pixels[offset + 2] < 40) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }
    const samples = [[150, 150], [250, 200], [300, 240]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    return { width: canvas.width, height: canvas.height, greenWidth: maxX >= minX ? maxX - minX + 1 : 0, samples, source: window.__imageStudioTestSource };
  });
  if (jpegGreenBounds.source?.width !== 1800 || jpegGreenBounds.source?.height !== 1200
    || jpegGreenBounds.width < 1900 || jpegGreenBounds.width > 1950
    || jpegGreenBounds.height < 1270 || jpegGreenBounds.height > 1300
    || jpegGreenBounds.greenWidth < 430 || jpegGreenBounds.greenWidth > 510) {
    throw new Error(`High-resolution JPEG export is cropped, blurred, or scaled incorrectly: ${JSON.stringify(jpegGreenBounds)}`);
  }
  console.log("  image: high-resolution export verified");
  const viewportCanvas = await page.$(".fabric-stage .upper-canvas");
  const viewportCanvasBox = await viewportCanvas?.boundingBox();
  if (!viewportCanvasBox) throw new Error("Image canvas is unavailable for zoom and pan");
  await page.mouse.move(viewportCanvasBox.x + viewportCanvasBox.width / 2, viewportCanvasBox.y + viewportCanvasBox.height / 2);
  await page.mouse.wheel({ deltaY: -400 });
  await page.waitForFunction(() => parseInt(document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent || "0", 10) > 100);
  await page.click('[data-testid="image-editor-fit"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "100%");
  const minibarBeforeViewportChange = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "200%");
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const panCanvasBox = await (await page.$(".fabric-stage .upper-canvas"))?.boundingBox();
  if (!panCanvasBox) throw new Error("Image canvas is unavailable for Space pan");
  await page.mouse.move(panCanvasBox.x + panCanvasBox.width / 2, panCanvasBox.y + panCanvasBox.height / 2);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(panCanvasBox.x + panCanvasBox.width / 2 + 38, panCanvasBox.y + panCanvasBox.height / 2 + 24, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const minibarAfterViewportChange = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  if (Math.hypot(minibarAfterViewportChange.left - minibarBeforeViewportChange.left, minibarAfterViewportChange.top - minibarBeforeViewportChange.top) < 20) {
    throw new Error(`Floating minibar did not follow zoom and pan: ${JSON.stringify({ minibarBeforeViewportChange, minibarAfterViewportChange })}`);
  }
  for (const format of ["PNG", "JPG", "WebP"]) {
    const transformedViewExport = await captureImageEditorExport(page, format);
    if (transformedViewExport !== identityExports[format]) throw new Error(`${format} export changed with user zoom or pan`);
  }
  console.log("  image: wheel zoom, Space pan, minibar tracking, and view-independent raster exports verified");
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("Delete");
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-selection-controls"]')?.classList.contains("is-disabled"));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const deletedCanvas = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (!styledCanvas || styledCanvas === deletedCanvas) throw new Error("Delete did not remove the selected Fabric layer");
  await page.click('[data-testid="image-editor-panel-shapes"]');
  await page.$eval('[data-testid="image-editor-shape-rounded-rect"]', (button) => button.click());
  await page.click('[data-testid="image-editor-panel-select"]');
  const centeredShapeCanvas = await page.$(".fabric-stage .upper-canvas");
  const centeredShapeBox = await centeredShapeCanvas?.boundingBox();
  if (!centeredShapeBox) throw new Error("Image canvas is unavailable for centered view tracking");
  const centeredShapeScale = centeredShapeBox.width / 900;
  await page.mouse.move(centeredShapeBox.x + 230 * centeredShapeScale, centeredShapeBox.y + 190 * centeredShapeScale);
  await page.mouse.down();
  await page.mouse.move(centeredShapeBox.x + 450 * centeredShapeScale, centeredShapeBox.y + 300 * centeredShapeScale, { steps: 8 });
  await page.mouse.up();
  await page.evaluate(() => {
    const setValue = (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const fill = document.querySelector('[data-testid="image-editor-select-color"]');
    if (!(fill instanceof HTMLInputElement)) throw new Error("Shape fill control is unavailable for the region-effect test");
    setValue(fill, "#ff375f");
  });
  await new Promise((resolve) => setTimeout(resolve, 160));
  const beforeRegionEffect = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  const disabledNativeCanvasBlur = await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "CanvasRenderingContext2D");
    if (!descriptor?.configurable) return false;
    window.__canvasContextConstructorDescriptor = descriptor;
    Object.defineProperty(window, "CanvasRenderingContext2D", { configurable: true, writable: true, value: undefined });
    return true;
  });
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.$$eval('[data-testid="image-editor-effect-options"] button', (buttons) => {
    const blur = buttons.find((button) => button.textContent?.trim() === "블러");
    if (!(blur instanceof HTMLButtonElement)) throw new Error("Blur region effect is unavailable");
    blur.click();
  });
  await page.$eval('[data-testid="image-editor-effect-strength"]', (input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "10");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('input[aria-label="효과 강도"]')?.value === "10");
  await page.waitForSelector(".fabric-stage.is-effect-mode");
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const effectCanvas = await page.$(".fabric-stage .upper-canvas");
  const effectBox = await effectCanvas?.boundingBox();
  if (!effectBox) throw new Error("Region-effect canvas is unavailable");
  await page.mouse.move(effectBox.x + effectBox.width * 0.02, effectBox.y + effectBox.height * 0.02);
  await page.mouse.down();
  await page.mouse.move(effectBox.x + effectBox.width * 0.42, effectBox.y + effectBox.height * 0.36, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector('[data-testid="image-editor-effect-selection"]');
  await page.click('[data-testid="image-editor-effect-selection-apply"]');
  await page.waitForFunction(() => !document.querySelector(".fabric-stage.is-effect-mode") && !document.querySelector('[data-testid="image-editor-effect-selection"]'));
  if (disabledNativeCanvasBlur) {
    await page.evaluate(() => Object.defineProperty(window, "CanvasRenderingContext2D", window.__canvasContextConstructorDescriptor));
  }
  const afterRegionEffect = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  console.log("  image: legacy canvas blur fallback verified");
  if (beforeRegionEffect === afterRegionEffect) throw new Error("Blur did not change the selected image region");
  const blurredEdgeAlpha = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.getContext("2d").getImageData(Math.floor(canvas.width * 0.04), Math.floor(canvas.height * 0.04), 1, 1).data[3]);
  if (blurredEdgeAlpha < 250) throw new Error(`Blur introduced transparency at the source-image edge: ${blurredEdgeAlpha}`);
  await page.$eval('[data-testid="image-editor-undo"]', (button) => button.click());
  await page.waitForFunction((effected) => document.querySelector(".fabric-stage .lower-canvas")?.toDataURL() !== effected, {}, afterRegionEffect);
  const undoneRegionEffect = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent) !== "200%") throw new Error("Dimension-preserving undo reset the canvas view");
  console.log("  image: region effect undo verified");
  await page.$eval('[data-testid="image-editor-redo"]', (button) => button.click());
  await page.waitForFunction((undone) => document.querySelector(".fabric-stage .lower-canvas")?.toDataURL() !== undone, {}, undoneRegionEffect);
  if (await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent) !== "200%") throw new Error("Dimension-preserving redo reset the canvas view");
  console.log("  image: region effect redo verified");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.click('button[aria-label="원본 사진 잠금"]');
  await page.click('[data-testid="image-editor-panel-select"]');
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const transformedBaseCanvas = await page.$(".fabric-stage .upper-canvas");
  const transformedBaseBox = await transformedBaseCanvas?.boundingBox();
  if (!transformedBaseBox) throw new Error("Base canvas is unavailable for transform history");
  await page.mouse.click(transformedBaseBox.x + transformedBaseBox.width * 0.8, transformedBaseBox.y + transformedBaseBox.height * 0.8);
  await page.waitForSelector('[data-testid="image-editor-minibar"]');
  const beforeBaseTransform = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  await page.mouse.move(transformedBaseBox.x + transformedBaseBox.width * 0.8, transformedBaseBox.y + transformedBaseBox.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(transformedBaseBox.x + transformedBaseBox.width * 0.8 + 28, transformedBaseBox.y + transformedBaseBox.height * 0.8 + 18, { steps: 6 });
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 160));
  const afterBaseTransform = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (afterBaseTransform === beforeBaseTransform) throw new Error("Moving the base image did not move its anchored effect block");
  await page.$eval('[data-testid="image-editor-undo"]', (button) => button.click());
  await page.waitForFunction((expected) => document.querySelector(".fabric-stage .lower-canvas")?.toDataURL() === expected, {}, beforeBaseTransform);
  if (await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent) !== "200%") throw new Error("Base-transform undo reset a dimension-preserving view");
  await page.$eval('[data-testid="image-editor-redo"]', (button) => button.click());
  await page.waitForFunction((expected) => document.querySelector(".fabric-stage .lower-canvas")?.toDataURL() === expected, {}, afterBaseTransform);
  if (await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent) !== "200%") throw new Error("Base-transform redo reset a dimension-preserving view");
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.click('button[aria-label="원본 사진 잠금"]');
  console.log("  image: anchored effect alignment and dimension-preserving transform history verified");
  await page.click('[data-testid="image-editor-panel-canvas"]');
  await page.click('[data-testid="image-editor-clear-layers"]');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.$eval(".fabric-stage .lower-canvas", (canvas) => {
    window.__protectedEffectBeforeLayerMove = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  });
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.click('button[aria-label="원본 사진 잠금"]');
  await page.click('[data-testid="image-editor-panel-select"]');
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const baseCanvas = await page.$(".fabric-stage .upper-canvas");
  const baseBox = await baseCanvas?.boundingBox();
  if (!baseBox) throw new Error("Image base canvas is unavailable for the layer-order test");
  await page.mouse.click(baseBox.x + baseBox.width * 0.8, baseBox.y + baseBox.height * 0.8);
  await page.waitForSelector('[data-testid="image-editor-minibar"]');
  const baseMinibarState = await page.evaluate(() => ({
    duplicateDisabled: document.querySelector('[data-testid="image-editor-minibar-duplicate"]')?.disabled,
    deleteDisabled: document.querySelector('[data-testid="image-editor-minibar-delete"]')?.disabled,
  }));
  if (!baseMinibarState.duplicateDisabled || !baseMinibarState.deleteDisabled) throw new Error(`Base image duplication/deletion is not disabled: ${JSON.stringify(baseMinibarState)}`);
  await page.click('button[aria-label="맨 앞으로"]');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const protectedEffectDifference = await page.$eval(".fabric-stage .lower-canvas", (canvas) => {
    const before = window.__protectedEffectBeforeLayerMove;
    const after = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let changedPixels = 0;
    let totalDelta = 0;
    for (let index = 0; index < after.length; index += 4) {
      const delta = Math.abs(after[index] - before[index]) + Math.abs(after[index + 1] - before[index + 1]) + Math.abs(after[index + 2] - before[index + 2]) + Math.abs(after[index + 3] - before[index + 3]);
      if (delta > 8) changedPixels += 1;
      totalDelta += delta;
    }
    return { changedRatio: changedPixels / (after.length / 4), meanChannelDelta: totalDelta / after.length };
  });
  if (protectedEffectDifference.changedRatio > 0.02 || protectedEffectDifference.meanChannelDelta > 3) throw new Error(`Bringing the base image forward exposed pixels concealed by a region effect: ${JSON.stringify(protectedEffectDifference)}`);
  console.log("  image: protected effect layer order verified");
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const overlayCanvas = await page.$(".fabric-stage .upper-canvas");
  const overlayBox = await overlayCanvas?.boundingBox();
  if (!overlayBox) throw new Error("Region overlay export canvas is unavailable");
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.18, overlayBox.y + overlayBox.height * 0.18);
  await page.mouse.down();
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.34, overlayBox.y + overlayBox.height * 0.32, { steps: 6 });
  await page.mouse.up();
  await page.waitForSelector('[data-testid="image-editor-effect-selection"]');
  await page.click('[data-testid="image-editor-export-action"] button');
  const exportWithSelection = await page.evaluate(() => window.__worklazyExportDataUrl);
  await page.click('[data-testid="image-editor-effect-selection-cancel"]');
  await page.click('[data-testid="image-editor-export-action"] button');
  const exportWithoutSelection = await page.evaluate(() => window.__worklazyExportDataUrl);
  if (!exportWithSelection || exportWithSelection !== exportWithoutSelection) throw new Error("The region-selection overlay contaminated the raster export");
  console.log("  image: region overlay export verified");
  await page.click('[data-testid="image-editor-panel-crop"]');
  const portraitPresets = await page.$$eval('[data-testid="image-editor-crop-presets"] button', (buttons) => buttons.map((button) => button.textContent?.trim()).filter(Boolean));
  if (!portraitPresets.includes("3:4") || !portraitPresets.includes("9:16") || !portraitPresets.includes("자유") || portraitPresets.length !== 6) throw new Error(`Crop presets are incomplete: ${JSON.stringify(portraitPresets)}`);
  await dragImageEditorRegion(page, 1);
  const ratioBefore = await readImageEditorRegionGeometry(page, "crop");
  await page.$$eval('[data-testid="image-editor-crop-presets"] button', (buttons) => {
    const ratio = buttons.find((button) => button.textContent?.trim() === "4:3");
    if (!(ratio instanceof HTMLButtonElement)) throw new Error("4:3 crop preset is unavailable");
    ratio.click();
  });
  const ratioAfter = await readImageEditorRegionGeometry(page, "crop");
  const ratioCanvasSize = await page.$eval(".fabric-stage .lower-canvas", (canvas) => ({ width: canvas.width / devicePixelRatio, height: canvas.height / devicePixelRatio }));
  const expectedRatioWidth = Math.min(ratioBefore.selection.width, ratioBefore.selection.height * 4 / 3);
  if (ratioCanvasSize.width !== 900 || ratioCanvasSize.height !== 600 || Math.abs(ratioAfter.selection.width - expectedRatioWidth) > 1 || Math.abs(ratioAfter.selection.width - ratioAfter.selection.height * 4 / 3) > 1) {
    throw new Error(`4:3 preset changed the canvas instead of the crop box: ${JSON.stringify({ ratioCanvasSize, ratioBefore, ratioAfter, expectedRatioWidth })}`);
  }
  console.log("  image: ratio preset changes the crop box without resizing the canvas");
  await page.click('[data-testid="image-editor-panel-crop"]');
  await page.$$eval('[data-testid="image-editor-crop-presets"] button', (buttons) => {
    const free = buttons.find((button) => button.textContent?.trim() === "자유");
    if (!(free instanceof HTMLButtonElement)) throw new Error("Free crop option is unavailable");
    free.click();
  });
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.waitForSelector(".fabric-stage.is-crop-mode");
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .upper-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const bounds = canvas.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  });
  const cropCanvas = await page.$(".fabric-stage .upper-canvas");
  const cropBox = await cropCanvas?.boundingBox();
  if (!cropBox) throw new Error("Free crop canvas is unavailable");
  await page.mouse.move(cropBox.x + cropBox.width * 0.15, cropBox.y + cropBox.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(cropBox.x + cropBox.width * 0.8, cropBox.y + cropBox.height * 0.8, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="image-editor-crop-selection-apply"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const freeCropGeometry = await readImageEditorRegionGeometry(page, "crop");
  await page.click('[data-testid="image-editor-crop-selection-apply"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-crop-selection"]'));
  if (await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent) !== "100%") throw new Error("Free crop did not reset the canvas view");
  const croppedSize = await page.$eval(".fabric-stage .lower-canvas", (canvas) => ({ width: canvas.width / devicePixelRatio, height: canvas.height / devicePixelRatio }));
  if (croppedSize.width !== Math.round(freeCropGeometry.selection.width) || croppedSize.height !== Math.round(freeCropGeometry.selection.height)) {
    throw new Error(`Free crop did not resize the canvas as selected: ${JSON.stringify({ croppedSize, selection: freeCropGeometry.selection })}`);
  }
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await dropCanvasImages(page, ".fabric-stage", ["#34c759"]);
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "100%");
  const replacedSize = await page.$eval(".fabric-stage .lower-canvas", (canvas) => ({ width: canvas.width / devicePixelRatio, height: canvas.height / devicePixelRatio }));
  if (replacedSize.width !== 900 || replacedSize.height !== 600) throw new Error(`Replacing a file did not restore the fitted canvas: ${JSON.stringify(replacedSize)}`);
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  page.once("dialog", (dialog) => void dialog.accept());
  await page.click(".editor-source-actions button");
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "100%");
  console.log("  image: free crop, file replacement, and blank-canvas view reset verified");
  await page.click('[data-testid="image-editor-panel-stickers"]');
  const stickerPicker = await page.evaluate(() => ({
    count: document.querySelectorAll('[data-testid="image-editor-stickers"] button').length,
    categories: document.querySelectorAll('[data-testid="image-editor-sticker-categories"] button').length,
    urls: Array.from(document.querySelectorAll('[data-testid="image-editor-stickers"] img'), (image) => image.getAttribute("src")),
  }));
  if (stickerPicker.count !== 16 || stickerPicker.categories !== 7 || stickerPicker.urls.some((url) => !url?.includes("/vendor/emoji/17.0.3/") || !url.endsWith(".svg"))) {
    throw new Error(`Sticker picker did not use its categorized static SVG URLs: ${JSON.stringify(stickerPicker)}`);
  }
  const beforeSticker = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  await page.$eval('[data-testid="image-editor-sticker-search"]', (input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "로켓");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="image-editor-stickers"] button').length === 1
    && document.querySelector('[data-testid="image-editor-stickers"] button')?.getAttribute("data-codepoint") === "1f680");
  await page.$eval('[data-testid="image-editor-stickers"] button[data-codepoint="1f680"]', (button) => button.click());
  await page.waitForSelector('[data-testid="image-editor-minibar"]');
  const stickerInsert = await page.evaluate(() => ({
    panel: document.querySelector('[data-testid="image-editor-options-panel"]')?.getAttribute("data-panel"),
    kind: document.querySelector('[data-testid="image-editor-minibar"]') ? "selected" : "missing",
  }));
  const afterSticker = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  const stickerExport = await captureImageEditorExport(page, "PNG");
  if (stickerInsert.panel !== "stickers" || stickerInsert.kind !== "selected" || beforeSticker === afterSticker || stickerExport.length < 1_000) {
    throw new Error(`SVG sticker insertion or export failed: ${JSON.stringify({ stickerInsert, canvasChanged: beforeSticker !== afterSticker, exportLength: stickerExport.length })}`);
  }
  console.log("  image: categorized sticker search, SVG insertion, and export verified");
  await page.click(".studio-tabs button:nth-child(2)");
  await pasteCanvasImages(page, ["#159bd7", "#ff375f"]);
  await page.waitForFunction(() => document.querySelectorAll(".image-studio-page :is(.file-row, [data-ui-component=file-list] > li)").length === 2);
  await page.waitForFunction(() => !document.querySelector("[data-testid='image-batch-action'] button")?.disabled);
  await page.$eval("[data-testid='image-batch-action'] button", (button) => button.scrollIntoView({ block: "center", behavior: "instant" }));
  const batchHitTarget = await page.$eval("[data-testid='image-batch-action'] button", (button) => {
    const bounds = button.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return { inside: hit === button || Boolean(hit && button.contains(hit)), hit: hit?.outerHTML.slice(0, 240) || "", bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } };
  });
  if (!batchHitTarget.inside) throw new Error(`Image batch action is covered: ${JSON.stringify(batchHitTarget)}`);
  await page.click("[data-testid='image-batch-action'] button");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Image error"));
  await page.click(".studio-tabs button:nth-child(3)");
  await pasteCanvasImages(page, ["#159bd7", "#ff375f"]);
  await page.waitForFunction(() => document.querySelectorAll(".image-studio-page :is(.file-row, [data-ui-component=file-list] > li)").length === 2);
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll(".image-settings-grid label"));
    const layout = labels.find((label) => label.querySelector("span")?.textContent === "배치")?.querySelector("select");
    const gap = labels.find((label) => label.querySelector("span")?.textContent === "간격 px")?.querySelector("input");
    if (!(layout instanceof HTMLSelectElement) || !(gap instanceof HTMLInputElement)) throw new Error("Collage settings are unavailable");
    layout.value = "grid";
    layout.dispatchEvent(new Event("change", { bubbles: true }));
    gap.value = "0";
    gap.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".collage-preview-stage canvas");
    const gap = Array.from(document.querySelectorAll(".image-settings-grid label")).find((label) => label.querySelector("span")?.textContent === "간격 px")?.querySelector("input");
    return canvas instanceof HTMLCanvasElement && canvas.width > 1 && canvas.height > 1 && gap?.value === "0";
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".collage-preview-stage canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const context = canvas.getContext("2d");
    return context && context.getImageData(Math.floor(canvas.width * 0.55), Math.floor(canvas.height * 0.5), 1, 1).data[3] > 0;
  });
  const gridPixel = await page.$eval(".collage-preview-stage canvas", (canvas) => {
    const context = canvas.getContext("2d");
    return Array.from(context.getImageData(Math.floor(canvas.width * 0.55), Math.floor(canvas.height * 0.5), 1, 1).data);
  });
  if (gridPixel[0] < 200 || gridPixel[1] > 140 || gridPixel[2] > 170) throw new Error(`Grid still contains implicit image padding: ${gridPixel.join(",")}`);
  await page.evaluate(() => {
    const gap = Array.from(document.querySelectorAll(".image-settings-grid label")).find((label) => label.querySelector("span")?.textContent === "간격 px")?.querySelector("input");
    if (!(gap instanceof HTMLInputElement)) throw new Error("Collage gap control is unavailable");
    gap.value = "12";
    gap.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.click('.image-background-options button[role="switch"]');
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".collage-preview-stage canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const alpha = canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3];
    return alpha === 0;
  });
  await dropCanvasImages(page, ".collage-preview-stage", ["#34c759"]);
  await page.waitForFunction(() => document.querySelectorAll(".image-studio-page :is(.file-row, [data-ui-component=file-list] > li)").length === 3);
  await page.click(".studio-tabs button:nth-child(4)");
  await pasteCanvasImages(page, ["#159bd7", "#ff375f"]);
  await page.waitForFunction(() => document.querySelectorAll(".gif-frame-row").length === 2 && document.querySelectorAll(".gif-frame-drag-handle").length === 2);
  const gifActionLabels = await page.$$eval(".gif-frame-row", (rows) => rows.map((row) => ({
    name: row.querySelector("span > span")?.textContent || "",
    labels: Array.from(row.querySelectorAll("button"), (button) => button.getAttribute("aria-label") || ""),
  })));
  if (gifActionLabels.some(({ name, labels }, index) => !name || labels.some((label) => !label.includes(name) || !label.includes(String(index + 1))))) {
    throw new Error(`GIF actions do not identify their target frame: ${JSON.stringify(gifActionLabels)}`);
  }
  const initialFrameOrder = await page.$$eval(".gif-frame-row", (rows) => rows.map((row) => row.textContent || ""));
  const firstHandle = await page.$(".gif-frame-row:first-child .gif-frame-drag-handle");
  const secondRow = await page.$(".gif-frame-row:nth-child(2)");
  const firstHandleBox = await firstHandle?.boundingBox();
  const secondRowBox = await secondRow?.boundingBox();
  if (!firstHandleBox || !secondRowBox) throw new Error("GIF frame drag handles are unavailable");
  await page.mouse.move(firstHandleBox.x + firstHandleBox.width / 2, firstHandleBox.y + firstHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondRowBox.x + secondRowBox.width / 2, secondRowBox.y + secondRowBox.height * 0.8, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction((before) => {
    const current = Array.from(document.querySelectorAll(".gif-frame-row"), (row) => row.textContent || "");
    return JSON.stringify(current) !== JSON.stringify(before);
  }, {}, initialFrameOrder);
}

async function testImageStudioLayersAndSelection(page) {
  console.log("  image: probing P3 layers, multi-selection, and context menu");
  await loadSyntheticImageEditor(page);
  await installImageEditorExportCapture(page);
  await readImageEditorP3State(page);

  // Use the public effect workflow so every layer-order assertion includes the fixed base+effect block.
  await page.click('[data-testid="image-editor-panel-effect"]');
  await dragImageEditorRegion(page, 1);
  await page.click('[data-testid="image-editor-effect-selection-apply"]');
  await page.waitForFunction(() => !document.querySelector(".fabric-stage.is-effect-mode"));
  await page.waitForFunction(async () => (await window.__readImageEditorP3State?.())?.objects.some((object) => object.role === "region-effect"));

  await page.click('[data-testid="image-editor-panel-text"]');
  await page.click('[data-testid="image-editor-add-text"]');
  await page.click('[data-testid="image-editor-panel-shapes"]');
  await page.click('[data-testid="image-editor-shape-rounded-rect"]');
  await page.click('[data-testid="image-editor-shape-triangle"]');
  await configureImageEditorP3Geometry(page, true);

  await page.click('[data-testid="image-editor-panel-layers"]');
  await page.waitForFunction(() => document.querySelectorAll(".image-editor-layer-row").length === 4);
  let state = await readImageEditorP3State(page);
  const initialKinds = state.additional.map((object) => object.kind);
  if (!state.blockValid || state.effects.length !== 1 || initialKinds.join(",") !== "text,rounded-rect,triangle"
    || state.layerRows.map((row) => row.kind).join(",") !== "shape,shape,text,base" || !state.layerRows.at(-1)?.base
    || state.layerRows.at(-1)?.movable || !state.layerRows.at(-1)?.deleteDisabled) {
    throw new Error(`Layer panel did not expose the fixed base block and top-to-bottom additional order: ${JSON.stringify(state)}`);
  }
  const layerActionLabels = await page.$$eval(".image-editor-layer-row", (rows) => rows.map((row, index) => ({
    index: index + 1,
    labels: Array.from(row.querySelectorAll("button"), (button) => button.getAttribute("aria-label") || ""),
  })));
  if (layerActionLabels.some(({ index, labels }) => labels.some((label) => !label.includes(String(index))))) throw new Error(`Layer actions do not identify their target row: ${JSON.stringify(layerActionLabels)}`);

  const firstMovableId = await page.$eval(".image-editor-layer-row.is-movable", (row) => row.getAttribute("data-layer-id"));
  const rowOrderBeforeKeyboard = state.layerRows.map((row) => row.id).join(",");
  await page.focus(`.image-editor-layer-row[data-layer-id="${firstMovableId}"] .image-editor-layer-select`);
  await page.keyboard.down("Alt");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Alt");
  await page.waitForFunction((before) => Array.from(document.querySelectorAll(".image-editor-layer-row"), (row) => row.getAttribute("data-layer-id")).join(",") !== before, {}, rowOrderBeforeKeyboard);
  await page.focus(`.image-editor-layer-row[data-layer-id="${firstMovableId}"] .image-editor-layer-select`);
  await page.keyboard.down("Alt");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Alt");
  await page.waitForFunction((expected) => Array.from(document.querySelectorAll(".image-editor-layer-row"), (row) => row.getAttribute("data-layer-id")).join(",") === expected, {}, rowOrderBeforeKeyboard);

  // A panel row owns selection without forcing the tool sheet back to Select.
  await page.click('.image-editor-layer-row[data-layer-kind="text"] .image-editor-layer-select');
  await page.waitForFunction(() => document.querySelector('.image-editor-layer-row[data-layer-kind="text"]')?.classList.contains("is-active"));
  const panelSelection = await page.evaluate(() => ({
    panel: document.querySelector('[data-testid="image-editor-options-panel"]')?.getAttribute("data-panel"),
    activeRows: document.querySelectorAll(".image-editor-layer-row.is-active").length,
  }));
  if (panelSelection.panel !== "layers" || panelSelection.activeRows !== 1) throw new Error(`Layer selection did not retain the panel: ${JSON.stringify(panelSelection)}`);

  // Base selection keeps all four destructive/order minibar actions visible but disabled.
  await page.click('.image-editor-layer-row[data-layer-base="true"] .image-editor-layer-select');
  await page.waitForSelector('[data-testid="image-editor-minibar"][data-selection-kind="base"]');
  const baseActions = await page.evaluate(() => ({
    front: document.querySelector('[data-testid="image-editor-minibar-front"]')?.disabled,
    back: document.querySelector('[data-testid="image-editor-minibar-back"]')?.disabled,
    duplicate: document.querySelector('[data-testid="image-editor-minibar-duplicate"]')?.disabled,
    remove: document.querySelector('[data-testid="image-editor-minibar-delete"]')?.disabled,
    toolbarDelete: document.querySelector('[data-testid="image-editor-delete"]')?.disabled,
  }));
  if (Object.values(baseActions).some((value) => value !== true)) throw new Error(`Base actions are not uniformly disabled: ${JSON.stringify(baseActions)}`);
  const beforeBaseKeyboardDelete = (await readImageEditorP3State(page)).objects.length;
  await page.keyboard.press("Delete");
  if ((await readImageEditorP3State(page)).objects.length !== beforeBaseKeyboardDelete) throw new Error("Keyboard Delete removed the base layer");

  // Unlock only for the shift-click and base/effect context-target probes below.
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.click('button[aria-label="원본 사진 잠금"]');
  await page.click('[data-testid="image-editor-panel-layers"]');

  // Hiding the active additional layer clears selection, excludes it from export, and is fully restorable.
  await page.click('.image-editor-layer-row[data-layer-kind="text"] .image-editor-layer-select');
  const visibleExport = await captureImageEditorExport(page, "PNG");
  await page.click('.image-editor-layer-row[data-layer-kind="text"] .image-editor-layer-visibility');
  await page.waitForFunction(() => document.querySelector('.image-editor-layer-row[data-layer-kind="text"]')?.getAttribute("data-layer-visible") === "false");
  state = await readImageEditorP3State(page);
  if (state.activeCount !== 0 || state.additional.find((object) => object.kind === "text")?.visible !== false) throw new Error(`Hiding an active layer left a stale selection: ${JSON.stringify(state)}`);
  const hiddenExport = await captureImageEditorExport(page, "PNG");
  if (hiddenExport === visibleExport) throw new Error("Hidden layer remained in the image export");
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(() => document.querySelector('.image-editor-layer-row[data-layer-kind="text"]')?.getAttribute("data-layer-visible") === "true");
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction(() => document.querySelector('.image-editor-layer-row[data-layer-kind="text"]')?.getAttribute("data-layer-visible") === "false");
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(() => document.querySelector('.image-editor-layer-row[data-layer-kind="text"]')?.getAttribute("data-layer-visible") === "true");

  // Base visibility is atomic with every region effect, including undo and redo.
  await page.click('.image-editor-layer-row[data-layer-base="true"] .image-editor-layer-select');
  await page.click('.image-editor-layer-row[data-layer-base="true"] .image-editor-layer-visibility');
  state = await readImageEditorP3State(page);
  if (state.base?.visible !== false || state.effects.some((effect) => effect.visible) || state.activeCount !== 0) throw new Error(`Base/effect visibility was not coupled: ${JSON.stringify(state)}`);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(async () => { const value = await window.__readImageEditorP3State?.(); return value?.base?.visible && value.effects.every((effect) => effect.visible) && document.querySelector('.image-editor-layer-row[data-layer-base="true"]')?.getAttribute("data-layer-visible") === "true"; });
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction(async () => { const value = await window.__readImageEditorP3State?.(); return value?.base?.visible === false && value.effects.every((effect) => !effect.visible) && document.querySelector('.image-editor-layer-row[data-layer-base="true"]')?.getAttribute("data-layer-visible") === "false"; });
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(async () => (await window.__readImageEditorP3State?.())?.base?.visible === true && document.querySelector('.image-editor-layer-row[data-layer-base="true"]')?.getAttribute("data-layer-visible") === "true");
  console.log("  image: P3 visibility/history verified");

  // Minibar and context menu share the same block-aware back clamp.
  await page.click('.image-editor-layer-row:first-child .image-editor-layer-select');
  await page.waitForSelector('[data-testid="image-editor-minibar-back"]');
  await page.$eval('[data-testid="image-editor-minibar-back"]', (button) => button.click());
  state = await readImageEditorP3State(page);
  if (!state.blockValid || state.additional[0]?.kind !== "triangle") throw new Error(`Minibar back crossed or missed the base block: ${JSON.stringify(state)}`);
  await assertImageEditorUndoRedoOrder(page, "triangle,text,rounded-rect", "text,rounded-rect,triangle", "minibar reorder");
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(async () => (await window.__readImageEditorP3State?.())?.additional.map((object) => object.kind).join(",") === "text,rounded-rect,triangle");
  console.log("  image: P3 three-route z-order clamp verified");

  let triangle = (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle");
  await openImageEditorContextMenu(page, triangle);
  await page.$eval('[data-testid="image-editor-context-back"]', (button) => button.click());
  state = await readImageEditorP3State(page);
  if (!state.blockValid || state.additional[0]?.kind !== "triangle") throw new Error(`Context-menu back crossed or missed the base block: ${JSON.stringify(state)}`);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(async () => (await window.__readImageEditorP3State?.())?.additional.map((object) => object.kind).join(",") === "text,rounded-rect,triangle");
  console.log("  image: P3 context clamp verified");

  // Sortable only exposes handles on additional rows and must produce the same clamp and snapshot.
  const dragRows = await page.$$(".image-editor-layer-row.is-movable");
  const dragHandle = await dragRows[0]?.$(".image-editor-layer-drag");
  const dragTarget = dragRows.at(-1);
  const dragBox = await dragHandle?.boundingBox();
  const targetBox = await dragTarget?.boundingBox();
  if (!dragBox || !targetBox) throw new Error("Layer reorder handles are unavailable");
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * 0.8, { steps: 12 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 180)));
  state = await readImageEditorP3State(page);
  if (!state.blockValid || state.additional.map((object) => object.kind).join(",") === "text,rounded-rect,triangle" || state.layerRows.at(-1)?.kind !== "base") {
    throw new Error(`Panel drag broke or missed the fixed base block: ${JSON.stringify(state)}`);
  }
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(async () => (await window.__readImageEditorP3State?.())?.additional.map((object) => object.kind).join(",") === "text,rounded-rect,triangle");

  // Rubber-band selection includes the unlocked base as a candidate, then the selection hook removes it.
  await configureImageEditorP3Geometry(page, true);
  await setImageEditorBaseHitTesting(page, false);
  const rubberMapping = await getImageEditorSceneMapping(page, 1);
  const rubberStart = mapImageEditorScenePoint(rubberMapping, { x: 30, y: 25 });
  const rubberEnd = mapImageEditorScenePoint(rubberMapping, { x: 790, y: 530 });
  await page.mouse.move(rubberStart.x, rubberStart.y);
  await page.mouse.down();
  await page.mouse.move(rubberEnd.x, rubberEnd.y, { steps: 10 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  state = await readImageEditorP3State(page);
  if (state.activeType !== "activeselection" || state.activeKinds.includes("base") || state.activeCount !== 3 || state.layerRows.filter((row) => row.active).length !== 3) {
    throw new Error(`Rubber-band selection did not exclude the base: ${JSON.stringify(state)}`);
  }
  await cacheImageEditorActiveSelectionConstructor(page);
  await setImageEditorBaseHitTesting(page, true);

  // Base-first Shift selection degrades to one additional object, then upgrades to a base-free pair.
  await discardImageEditorSelection(page);
  state = await readImageEditorP3State(page);
  await clickImageEditorScenePoint(page, { x: 500, y: 480 });
  const textObject = state.additional.find((object) => object.kind === "text");
  const rectObject = state.additional.find((object) => object.kind === "rounded-rect");
  await clickImageEditorObject(page, textObject, ["Shift"]);
  state = await readImageEditorP3State(page);
  if (state.activeCount !== 1 || state.activeKinds.join(",") !== "text") throw new Error(`Base-first Shift selection was not degraded: ${JSON.stringify(state)}`);
  await clickImageEditorObject(page, rectObject, ["Shift"]);
  state = await readImageEditorP3State(page);
  if (state.activeType !== "activeselection" || state.activeKinds.join(",") !== "text,rounded-rect") throw new Error(`Shift multi-selection retained the base or lost an object: ${JSON.stringify(state)}`);
  console.log("  image: P3 rubber-band and Shift base exclusion verified");

  // Six scene-bbox alignments must remain invariant under object transforms and VPT zoom.
  const alignments = ["left", "center-horizontal", "right", "top", "center-vertical", "bottom"];
  for (const zoom of [1, 2]) {
    await page.click('[data-testid="image-editor-fit"]');
    if (zoom === 2) for (let index = 0; index < 3; index += 1) await page.click('[data-testid="image-editor-zoom-in"]');
    await page.waitForFunction((expected) => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === `${expected * 100}%`, {}, zoom);
    for (const alignment of alignments) {
      await configureImageEditorP3Geometry(page, true, ["text", "rounded-rect", "triangle"]);
      await page.$eval(`[data-testid="image-editor-align-${alignment}"]`, (button) => button.click());
      state = await readImageEditorP3State(page);
      assertImageEditorAlignment(state.activeObjects, alignment, `zoom ${zoom * 100}%`);
    }
  }
  const alignedState = await readImageEditorP3State(page);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-redo"]')?.disabled === false);
  const undoneAlignment = await readImageEditorP3State(page);
  if (JSON.stringify(undoneAlignment.additional.map((object) => object.bounds)) === JSON.stringify(alignedState.additional.map((object) => object.bounds))) {
    throw new Error("Alignment undo did not restore the preceding geometry");
  }
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-redo"]')?.disabled === true);
  assertImageEditorAlignment((await readImageEditorP3State(page)).additional, "bottom", "alignment redo");
  await page.click('[data-testid="image-editor-fit"]');
  console.log("  image: P3 six-way scene alignment at 100/200% verified");

  // Multiple clone is per-object, translated as a set, and preserves the originals' relative z-order.
  await configureImageEditorP3Geometry(page, true, ["text", "rounded-rect"]);
  state = await readImageEditorP3State(page);
  const beforeCloneCount = state.additional.length;
  const beforeCloneKinds = state.activeKinds.join(",");
  await page.$eval('[data-testid="image-editor-minibar-duplicate"]', (button) => button.click());
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count + 2), {}, beforeCloneCount);
  state = await readImageEditorP3State(page);
  if (!state.blockValid || state.additional.length !== beforeCloneCount + 2 || state.activeCount !== 2 || state.activeKinds.join(",") !== beforeCloneKinds) {
    throw new Error(`Multi-clone did not preserve relative z-order: ${JSON.stringify(state)}`);
  }
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count), {}, beforeCloneCount);
  console.log("  image: P3 multi-clone relative order/history verified");
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count + 2), {}, beforeCloneCount);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count), {}, beforeCloneCount);

  // Multiple context policy: duplicate/delete/alignment only; delete is independently undoable.
  await configureImageEditorP3Geometry(page, false, ["text", "rounded-rect"]);
  state = await readImageEditorP3State(page);
  await openImageEditorContextMenu(page, state.activeObjects[0]);
  const multipleMenu = await page.$eval('[data-testid="image-editor-context-menu"]', (menu) => ({
    target: menu.getAttribute("data-context-target"),
    duplicate: Boolean(menu.querySelector('[data-testid="image-editor-context-duplicate"]')),
    remove: Boolean(menu.querySelector('[data-testid="image-editor-context-delete"]')),
    align: menu.querySelectorAll('[data-testid^="image-editor-context-align-"]').length,
    front: Boolean(menu.querySelector('[data-testid="image-editor-context-front"]')),
    back: Boolean(menu.querySelector('[data-testid="image-editor-context-back"]')),
    edit: Boolean(menu.querySelector('[data-testid="image-editor-context-edit-text"]')),
  }));
  if (multipleMenu.target !== "multiple" || !multipleMenu.duplicate || !multipleMenu.remove || multipleMenu.align !== 6 || multipleMenu.front || multipleMenu.back || multipleMenu.edit) {
    throw new Error(`ActiveSelection context policy is invalid: ${JSON.stringify(multipleMenu)}`);
  }
  await page.$eval('[data-testid="image-editor-context-delete"]', (button) => button.click());
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count - 2), {}, beforeCloneCount);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count), {}, beforeCloneCount);

  // Every normal-object menu command receives an actual right-click path.
  state = await readImageEditorP3State(page);
  triangle = state.additional.find((object) => object.kind === "triangle");
  await openImageEditorContextMenu(page, triangle);
  await page.$eval('[data-testid="image-editor-context-duplicate"]', (button) => button.click());
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count + 1), {}, beforeCloneCount);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count), {}, beforeCloneCount);
  triangle = (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle");
  await openImageEditorContextMenu(page, triangle);
  await page.$eval('[data-testid="image-editor-context-front"]', (button) => button.click());
  if ((await readImageEditorP3State(page)).additional.at(-1)?.kind !== "triangle") throw new Error("Context-menu front did not move the object to the additional-layer front");
  await page.click('[data-testid="image-editor-undo"]');
  triangle = (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle");
  await openImageEditorContextMenu(page, triangle);
  await page.$eval('[data-testid="image-editor-context-back"]', (button) => button.click());
  if ((await readImageEditorP3State(page)).additional[0]?.kind !== "triangle") throw new Error("Context-menu back did not clamp above the fixed block");
  await page.click('[data-testid="image-editor-undo"]');
  triangle = (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle");
  await openImageEditorContextMenu(page, triangle);
  await page.$eval('[data-testid="image-editor-context-delete"]', (button) => button.click());
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count - 1), {}, beforeCloneCount);
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction((count) => window.__readImageEditorP3State?.().then((value) => value.additional.length === count), {}, beforeCloneCount);
  const textLayer = (await readImageEditorP3State(page)).additional.find((object) => object.kind === "text");
  await openImageEditorContextMenu(page, textLayer);
  await page.$eval('[data-testid="image-editor-context-edit-text"]', (button) => button.click());
  if (!(await readImageEditorP3State(page)).additional.find((object) => object.kind === "text")?.editing) throw new Error("IText context action did not enter editing mode");
  await page.keyboard.press("Escape");
  console.log("  image: P3 target-specific context actions verified");

  // Menu suppression is scoped to the Fabric canvas; all closing paths are explicit.
  await installContextMenuDefaultProbe(page);
  state = await readImageEditorP3State(page);
  await openImageEditorContextMenu(page, state.additional.find((object) => object.kind === "triangle"));
  await page.keyboard.press("Escape");
  if (await page.$('[data-testid="image-editor-context-menu"]')) throw new Error("Escape did not close the object menu");
  await openImageEditorContextMenu(page, (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle"));
  await page.click('[data-testid="image-editor-panel-layers"]');
  if (await page.$('[data-testid="image-editor-context-menu"]')) throw new Error("Outside click did not close the object menu");
  await openImageEditorContextMenu(page, (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle"));
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-context-menu"]'));
  await openImageEditorContextMenu(page, (await readImageEditorP3State(page)).additional.find((object) => object.kind === "triangle"));
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-context-menu"]'));

  const base = (await readImageEditorP3State(page)).base;
  await rightClickImageEditorObject(page, base);
  if (await page.$('[data-testid="image-editor-context-menu"]')) throw new Error("Base right-click opened an object menu");
  const effect = (await readImageEditorP3State(page)).effects[0];
  await rightClickImageEditorObject(page, effect);
  if (await page.$('[data-testid="image-editor-context-menu"]')) throw new Error("Effect right-click opened an object menu");
  await setImageEditorAllCanvasObjectsHitTesting(page, false);
  const blankPoint = mapImageEditorScenePoint(await getImageEditorSceneMapping(page, 1), { x: 850, y: 550 });
  await page.mouse.click(blankPoint.x, blankPoint.y, { button: "right" });
  if (await page.$('[data-testid="image-editor-context-menu"]')) throw new Error("Blank canvas right-click opened an object menu");
  await setImageEditorAllCanvasObjectsHitTesting(page, true);
  await page.click('[data-testid="image-editor-panel-layers"]', { button: "right" });
  const defaults = await page.evaluate(() => window.__imageEditorContextDefaults || []);
  if (defaults.filter((entry) => entry.inside).some((entry) => !entry.prevented) || !defaults.some((entry) => !entry.inside && !entry.prevented)) {
    throw new Error(`Context-menu default suppression escaped the Fabric canvas: ${JSON.stringify(defaults)}`);
  }

  // Space pan wins over group selection, while crop owns drag and never creates an ActiveSelection.
  await discardImageEditorSelection(page);
  for (let index = 0; index < 3; index += 1) await page.click('[data-testid="image-editor-zoom-in"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "200%");
  const beforePanState = await readImageEditorP3State(page);
  const beforePan = beforePanState.viewport;
  const panMapping = await getImageEditorSceneMapping(page, beforePanState.zoom);
  const panStart = mapImageEditorScenePoint(panMapping, { x: 500, y: 350 });
  await page.mouse.move(panStart.x, panStart.y);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(panStart.x + 46, panStart.y + 28, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  state = await readImageEditorP3State(page);
  if (JSON.stringify(state.viewport) === JSON.stringify(beforePan) || state.activeType === "activeselection") throw new Error(`Space pan lost input priority: ${JSON.stringify(state)}`);
  await page.click('[data-testid="image-editor-fit"]');
  await page.click('[data-testid="image-editor-panel-crop"]');
  await dragImageEditorRegion(page, 1);
  state = await readImageEditorP3State(page);
  if (state.activeType === "activeselection" || !state.objects.some((object) => object.role === "crop-overlay")) throw new Error(`Crop drag lost ownership to rubber-band selection: ${JSON.stringify(state)}`);
  await page.keyboard.press("Escape");
  console.log("  image: P3 context suppression/closing and input priority verified");

  // English labels are rendered from the same target policy, with no clipboard/paste command.
  await page.goto(`${baseUrl}/en/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="image-editor-panel-text"]');
  await page.click('[data-testid="image-editor-panel-text"]');
  await page.click('[data-testid="image-editor-add-text"]');
  await configureImageEditorP3Geometry(page, false);
  const englishText = (await readImageEditorP3State(page)).additional.find((object) => object.kind === "text");
  await openImageEditorContextMenu(page, englishText);
  const englishMenu = await page.$eval('[data-testid="image-editor-context-menu"]', (menu) => ({
    text: menu.textContent || "",
    items: Array.from(menu.querySelectorAll('[role="menuitem"]'), (item) => item.textContent?.trim() || item.getAttribute("aria-label") || ""),
  }));
  const englishLayers = await page.$eval('[data-testid="image-editor-panel-layers"]', (button) => button.textContent || button.getAttribute("aria-label") || "");
  if (!["Duplicate", "Delete", "Bring to front", "Send to back", "Edit text"].every((label) => englishMenu.text.includes(label))
    || englishMenu.text.toLowerCase().includes("paste") || !englishLayers.includes("Layers")) {
    throw new Error(`English P3 labels are incomplete: ${JSON.stringify({ englishMenu, englishLayers })}`);
  }
  console.log("  image: P3 layer invariants, visibility/export/history, base guards, selection, alignments, cloning, menus, and input priority verified");
}

async function testImageStudioRegionInteractions(page) {
  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  const emptyCropState = await page.$eval('[data-testid="image-editor-crop-selection"]', (status) => {
    const apply = status.querySelector('[data-testid="image-editor-crop-selection-apply"]');
    const reasonId = apply?.getAttribute("aria-describedby") || "";
    const reason = reasonId ? document.getElementById(reasonId) : null;
    return {
      applyExists: apply instanceof HTMLButtonElement,
      disabled: apply instanceof HTMLButtonElement ? apply.disabled : false,
      accent: apply?.getAttribute("data-tone") === "sky",
      reason: reason?.textContent || "",
      reasonVisible: reason instanceof HTMLElement && reason.getBoundingClientRect().height > 0,
    };
  });
  if (!emptyCropState.applyExists || !emptyCropState.disabled || !emptyCropState.accent || !emptyCropState.reasonVisible || !emptyCropState.reason.includes("먼저 드래그")) {
    throw new Error(`Crop apply button does not expose its disabled reason: ${JSON.stringify(emptyCropState)}`);
  }

  const liveDrag = await getImageEditorRegionDrag(page, 1);
  await page.mouse.move(liveDrag.start.x, liveDrag.start.y);
  await page.mouse.down();
  await page.mouse.move((liveDrag.start.x + liveDrag.end.x) / 2, (liveDrag.start.y + liveDrag.end.y) / 2, { steps: 4 });
  await page.waitForSelector('[data-testid="image-editor-region-size-label"]');
  const firstSize = await page.$eval('[data-testid="image-editor-region-size-label"]', (label) => label.textContent || "");
  await page.mouse.move(liveDrag.end.x, liveDrag.end.y, { steps: 4 });
  await page.waitForFunction((previous) => document.querySelector('[data-testid="image-editor-region-size-label"]')?.textContent !== previous, {}, firstSize);
  const liveCropState = await page.$eval('[data-testid="image-editor-crop-selection"]', (status) => {
    const apply = status.querySelector('[data-testid="image-editor-crop-selection-apply"]');
    return { text: status.querySelector("span")?.textContent || "", disabled: apply instanceof HTMLButtonElement ? apply.disabled : true, tone: apply?.getAttribute("data-tone") || "" };
  });
  if (liveCropState.disabled || !liveCropState.text.includes("×") || liveCropState.tone !== "sky") {
    throw new Error(`Live crop size or active accent is missing: ${JSON.stringify(liveCropState)}`);
  }
  await page.mouse.up();
  const cropGeometry = await readImageEditorRegionGeometry(page, "crop");
  if (cropGeometry.error !== 0 || cropGeometry.originX !== "left" || cropGeometry.originY !== "top") throw new Error(`Crop overlay geometry is misaligned: ${JSON.stringify(cropGeometry)}`);
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  await assertRegionModeRetained(page, "crop", "crop cancel");

  await dragImageEditorRegion(page, 1);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.keyboard.press("Escape");
  await assertRegionModeRetained(page, "crop", "crop Escape");

  await dragImageEditorRegion(page, 1);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.keyboard.press("Enter");
  await assertCropAppliedToSelect(page, "crop Enter");

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  await dragImageEditorRegion(page, 1);
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="image-editor-crop-selection-apply"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.click('[data-testid="image-editor-crop-selection-apply"]');
  await assertCropAppliedToSelect(page, "crop button");

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-effect"]');
  const effectDrag = await getImageEditorRegionDrag(page, 1);
  await page.mouse.move(effectDrag.start.x, effectDrag.start.y);
  await page.mouse.down();
  await page.mouse.move((effectDrag.start.x + effectDrag.end.x) / 2, (effectDrag.start.y + effectDrag.end.y) / 2, { steps: 4 });
  await page.waitForSelector('[data-testid="image-editor-region-size-label"]');
  const firstEffectSize = await page.$eval('[data-testid="image-editor-region-size-label"]', (label) => label.textContent || "");
  await page.mouse.move(effectDrag.end.x, effectDrag.end.y, { steps: 4 });
  await page.waitForFunction((previous) => document.querySelector('[data-testid="image-editor-region-size-label"]')?.textContent !== previous, {}, firstEffectSize);
  await page.mouse.up();
  const effectGeometry = await readImageEditorRegionGeometry(page, "effect");
  if (effectGeometry.error !== 0 || effectGeometry.originX !== "left" || effectGeometry.originY !== "top" || effectGeometry.selectable || effectGeometry.evented || !effectGeometry.excludeFromExport) {
    throw new Error(`Effect overlay contract is invalid: ${JSON.stringify(effectGeometry)}`);
  }
  const effectLabelMode = await page.$eval('[data-testid="image-editor-region-size-label"]', (label) => label.getAttribute("data-region-mode"));
  if (effectLabelMode !== "effect") throw new Error(`Effect size label is not attached to the effect box: ${effectLabelMode}`);
  await page.click('[data-testid="image-editor-effect-selection-cancel"]');
  await assertRegionModeRetained(page, "effect", "effect cancel");
  await dragImageEditorRegion(page, 1);
  await page.keyboard.press("Escape");
  await assertRegionModeRetained(page, "effect", "effect Escape");

  await page.goto(`${baseUrl}/en/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="image-editor-panel-crop"]');
  await page.click('[data-testid="image-editor-panel-crop"]');
  const englishReason = await page.$eval('[data-testid="image-editor-crop-selection-apply"]', (button) => {
    const description = button.getAttribute("aria-describedby");
    return { disabled: button.disabled, reason: description ? document.getElementById(description)?.textContent || "" : "" };
  });
  if (!englishReason.disabled || englishReason.reason !== "Drag an area on the canvas first.") throw new Error(`English crop disabled reason is invalid: ${JSON.stringify(englishReason)}`);
  console.log(`  image: P4 crop/effect actions and live labels verified (crop error ${cropGeometry.error}px, effect error ${effectGeometry.error}px)`);
}

async function testImageStudioAccessibility(page) {
  await loadSyntheticImageEditor(page);
  const tabStates = await page.$$eval(".studio-tabs button", (buttons) => buttons.map((button) => button.getAttribute("aria-pressed")));
  if (tabStates.filter((state) => state === "true").length !== 1 || tabStates.filter((state) => state === "false").length !== 3) throw new Error(`Image Studio modes do not expose their current state: ${JSON.stringify(tabStates)}`);
  await page.click('[data-testid="image-editor-panel-crop"]');
  const stageSemantics = await page.$eval('[data-testid="image-editor-canvas-stage"]', (stage) => {
    const describedBy = stage.getAttribute("aria-describedby") || "";
    const help = describedBy ? document.getElementById(describedBy) : null;
    return { role: stage.getAttribute("role"), tabIndex: stage.getAttribute("tabindex"), label: stage.getAttribute("aria-label"), help: help?.textContent || "", helpVisible: help instanceof HTMLElement && help.getBoundingClientRect().height > 0 };
  });
  if (stageSemantics.role !== "region" || stageSemantics.tabIndex !== "0" || !stageSemantics.label || !stageSemantics.helpVisible || !stageSemantics.help.includes("Enter")) throw new Error(`Canvas keyboard semantics are incomplete: ${JSON.stringify(stageSemantics)}`);
  await page.focus('[data-testid="image-editor-canvas-stage"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-region-size-label"][data-region-mode="crop"]'));
  const keyboardRegionStart = await readImageEditorRegionGeometry(page, "crop");
  await page.keyboard.press("ArrowRight");
  const keyboardRegionMoved = await readImageEditorRegionGeometry(page, "crop");
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  const keyboardRegionResized = await readImageEditorRegionGeometry(page, "crop");
  if (keyboardRegionMoved.selection.left <= keyboardRegionStart.selection.left || keyboardRegionResized.selection.height <= keyboardRegionMoved.selection.height) throw new Error(`Crop keyboard alternative did not move and resize the region: ${JSON.stringify({ keyboardRegionStart, keyboardRegionMoved, keyboardRegionResized })}`);
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  await assertRegionModeRetained(page, "crop", "keyboard crop cancel");
  console.log("  image: keyboard crop create, move, resize, and cancel verified");
}

async function testImageStudioCropBoxEditing(page) {
  await loadSyntheticImageEditor(page);
  await installImageEditorExportCapture(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  await dragImageEditorRegion(page, 1);
  let crop = await readImageEditorCropDebug(page);
  if (!crop || crop.controls.join(",") !== "bl,br,mb,ml,mr,mt,tl,tr" || crop.hasRotation || !crop.lockScalingFlip || crop.canvasUniformScaling !== true
    || crop.minibar || !crop.selectionControlsDisabled || !crop.selectionDeleteDisabled || !crop.undoDisabled || !crop.excludeFromExport || crop.count !== 1) {
    throw new Error(`Editable crop box controls or isolation are invalid: ${JSON.stringify(crop)}`);
  }
  await page.keyboard.press("Delete");
  const afterDeleteShortcut = await readImageEditorCropDebug(page);
  if (!afterDeleteShortcut || afterDeleteShortcut.count !== 1 || !sameSelection(afterDeleteShortcut.selection, crop.selection) || !afterDeleteShortcut.undoDisabled) {
    throw new Error(`General delete/history handling captured the crop box: ${JSON.stringify({ crop, afterDeleteShortcut })}`);
  }
  crop = afterDeleteShortcut;
  await installCropTransformCounters(page);
  const beforeScale = crop.selection;
  const beforeScaleLabel = await page.$eval('[data-testid="image-editor-region-size-label"]', (label) => label.textContent || "");
  await page.mouse.move(crop.controlClients.br.x, crop.controlClients.br.y);
  await page.mouse.down();
  await page.mouse.move(crop.controlClients.br.x + 72, crop.controlClients.br.y + 44, { steps: 8 });
  const liveScale = await readImageEditorCropDebug(page);
  const liveScaleLabel = await page.$eval('[data-testid="image-editor-region-size-label"]', (label) => label.textContent || "");
  if (!liveScale || (Math.abs(liveScale.scaleX - 1) < 0.001 && Math.abs(liveScale.scaleY - 1) < 0.001) || liveScaleLabel === beforeScaleLabel) {
    throw new Error(`Crop handle did not update scale and labels live: ${JSON.stringify({ beforeScaleLabel, liveScaleLabel, liveScale })}`);
  }
  await page.mouse.up();
  crop = await readImageEditorCropDebug(page);
  const transformCounts = await page.evaluate(() => window.__worklazyCropTransformCounts);
  if (!crop || crop.scaleX !== 1 || crop.scaleY !== 1 || crop.selection.width <= beforeScale.width || crop.selection.height <= beforeScale.height
    || transformCounts.modified !== 1 || transformCounts.scaling < 1 || !crop.undoDisabled || crop.minibar || !crop.selectionControlsDisabled) {
    throw new Error(`Crop scale normalization or history isolation failed: ${JSON.stringify({ crop, transformCounts, beforeScale })}`);
  }
  const appliedSelection = crop.selection;
  await page.click('[data-testid="image-editor-crop-selection-apply"]');
  const appliedDimensions = await page.$eval(".fabric-stage .lower-canvas", (canvas) => ({ width: canvas.width / devicePixelRatio, height: canvas.height / devicePixelRatio }));
  const appliedPixels = await readImageRasterStats(page, await captureImageEditorExport(page, "PNG"));
  if (appliedDimensions.width !== Math.round(appliedSelection.width) || appliedDimensions.height !== Math.round(appliedSelection.height) || appliedPixels.control < 1_700) {
    throw new Error(`Handle-edited crop was not applied pixel-accurately: ${JSON.stringify({ appliedSelection, appliedDimensions, appliedPixels })}`);
  }

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  await dragImageEditorRegion(page, 1);
  crop = await readImageEditorCropDebug(page);
  const originalBranchSelection = crop.selection;
  const mapping = await getImageEditorSceneMapping(page, 1);
  const center = mapImageEditorScenePoint(mapping, {
    x: crop.selection.left + crop.selection.width / 2,
    y: crop.selection.top + crop.selection.height / 2,
  });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(mapping.bounds.x + mapping.bounds.width + 80, mapping.bounds.y + mapping.bounds.height + 50, { steps: 10 });
  const movingCrop = await readImageEditorCropDebug(page);
  if (movingCrop.selection.left < -0.001 || movingCrop.selection.top < -0.001
    || movingCrop.selection.left + movingCrop.selection.width > movingCrop.canvas.width + 0.001
    || movingCrop.selection.top + movingCrop.selection.height > movingCrop.canvas.height + 0.001) {
    throw new Error(`Crop move escaped the canvas during movement: ${JSON.stringify(movingCrop)}`);
  }
  await page.mouse.up();
  const movedCrop = await readImageEditorCropDebug(page);
  if (movedCrop.count !== 1 || movedCrop.selection.width !== originalBranchSelection.width || movedCrop.selection.height !== originalBranchSelection.height) {
    throw new Error(`Dragging on the crop box created a replacement instead of moving it: ${JSON.stringify({ originalBranchSelection, movedCrop })}`);
  }
  const movedSnapshot = movedCrop.selection;
  const movedCenter = mapImageEditorScenePoint(mapping, { x: movedSnapshot.left + movedSnapshot.width / 2, y: movedSnapshot.top + movedSnapshot.height / 2 });
  const outside = mapImageEditorScenePoint(mapping, { x: 80, y: 80 });
  await page.mouse.click(movedCenter.x, movedCenter.y, { button: "right" });
  await page.mouse.click(outside.x, outside.y, { button: "right" });
  const afterRightClicks = await readImageEditorCropDebug(page);
  if (!sameSelection(afterRightClicks.selection, movedSnapshot) || afterRightClicks.count !== 1) throw new Error(`Right click changed the crop box: ${JSON.stringify({ movedSnapshot, afterRightClicks })}`);
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.down();
  await page.mouse.move(outside.x + 95, outside.y + 70, { steps: 6 });
  await page.mouse.up();
  const replacedCrop = await readImageEditorCropDebug(page);
  if (replacedCrop.count !== 1 || sameSelection(replacedCrop.selection, movedSnapshot) || replacedCrop.selection.left > 90 || replacedCrop.selection.top > 90) {
    throw new Error(`Left drag outside the crop box did not create one replacement box: ${JSON.stringify({ movedSnapshot, replacedCrop })}`);
  }
  await page.mouse.move(replacedCrop.controlClients.br.x, replacedCrop.controlClients.br.y);
  await page.mouse.down();
  await page.mouse.move(replacedCrop.canvasBounds.left + replacedCrop.canvasBounds.width + 100, replacedCrop.canvasBounds.top + replacedCrop.canvasBounds.height + 80, { steps: 8 });
  const scaledAtBoundary = await readImageEditorCropDebug(page);
  if (scaledAtBoundary.selection.left < -0.001 || scaledAtBoundary.selection.top < -0.001
    || scaledAtBoundary.selection.left + scaledAtBoundary.selection.width > scaledAtBoundary.canvas.width + 0.001
    || scaledAtBoundary.selection.top + scaledAtBoundary.selection.height > scaledAtBoundary.canvas.height + 0.001) {
    throw new Error(`Crop scale escaped the canvas during scaling: ${JSON.stringify(scaledAtBoundary)}`);
  }
  await page.mouse.up();

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  const presetButtons = await page.$$eval('[data-testid="image-editor-crop-presets"] button', (buttons) => buttons.map((button) => button.textContent?.trim() || ""));
  if (JSON.stringify(presetButtons) !== JSON.stringify(["1:1", "4:3", "3:4", "16:9", "9:16", "자유"])) throw new Error(`Crop ratio order is invalid: ${JSON.stringify(presetButtons)}`);
  const ratioCases = [["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["16:9", 16 / 9], ["9:16", 9 / 16]];
  for (const [label, ratio] of ratioCases) {
    const status = await page.$('[data-testid="image-editor-crop-selection-cancel"]');
    if (status && !(await status.evaluate((button) => button.disabled))) await status.click();
    await clickCropRatio(page, "자유");
    await dragImageEditorRegion(page, 1);
    const before = (await readImageEditorCropDebug(page)).selection;
    await clickCropRatio(page, label);
    const after = await readImageEditorCropDebug(page);
    const expectedWidth = Math.min(before.width, before.height * ratio);
    if (Math.abs(after.selection.width - after.selection.height * ratio) > 1 || Math.abs(after.selection.width - expectedWidth) > 1
      || after.controls.join(",") !== "bl,br,tl,tr" || after.scaleX !== 1 || after.scaleY !== 1 || after.activeRatio !== label) {
      throw new Error(`Crop ratio ${label} did not use the shrink-first formula or locked controls: ${JSON.stringify({ before, after, expectedWidth })}`);
    }
    const lockedBefore = after.selection;
    await page.mouse.move(after.controlClients.br.x, after.controlClients.br.y);
    await page.mouse.down();
    await page.mouse.move(after.controlClients.br.x + 75, after.controlClients.br.y + 12, { steps: 7 });
    await page.mouse.up();
    const lockedAfter = await readImageEditorCropDebug(page);
    if (Math.abs(lockedAfter.selection.width - lockedAfter.selection.height * ratio) > 1 || sameSelection(lockedAfter.selection, lockedBefore)) {
      throw new Error(`Crop ratio ${label} was not retained by its corner handle: ${JSON.stringify({ lockedBefore, lockedAfter })}`);
    }
  }
  await clickCropRatio(page, "자유");
  crop = await readImageEditorCropDebug(page);
  if (crop.controls.join(",") !== "bl,br,mb,ml,mr,mt,tl,tr" || crop.activeRatio !== "자유") throw new Error(`Free crop did not restore eight handles: ${JSON.stringify(crop)}`);
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  await clickCropRatio(page, "16:9");
  await dragImageEditorRegion(page, 1);
  crop = await readImageEditorCropDebug(page);
  if (Math.abs(crop.selection.width - crop.selection.height * 16 / 9) > 1) throw new Error(`A preset did not lock a new drag: ${JSON.stringify(crop)}`);
  await page.click('[data-testid="image-editor-crop-selection-apply"]');
  await page.click('[data-testid="image-editor-panel-crop"]');
  const retainedRatio = await page.$eval('[data-testid="image-editor-crop-presets"] button.active', (button) => button.textContent?.trim() || "");
  if (retainedRatio !== "16:9") throw new Error(`Applied crop did not retain its ratio state: ${retainedRatio}`);

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  await clickCropRatio(page, "9:16");
  const edgeMapping = await getImageEditorSceneMapping(page, 1);
  const edgeStart = mapImageEditorScenePoint(edgeMapping, { x: 899, y: 599 });
  const edgeEnd = mapImageEditorScenePoint(edgeMapping, { x: 895, y: 591 });
  await page.mouse.move(edgeStart.x, edgeStart.y);
  await page.mouse.down();
  await page.mouse.move(edgeEnd.x, edgeEnd.y, { steps: 3 });
  await page.mouse.up();
  crop = await readImageEditorCropDebug(page);
  if (crop.selection.width !== 10 || crop.selection.height !== 18 || Math.abs(crop.selection.width - crop.selection.height * 9 / 16) > 1
    || crop.selection.left + crop.selection.width > 900 || crop.selection.top + crop.selection.height > 600
    || 900 - (crop.selection.left + crop.selection.width) > 2 || 600 - (crop.selection.top + crop.selection.height) > 2) {
    throw new Error(`9:16 minimum-size boundary clamp or rounding failed: ${JSON.stringify(crop)}`);
  }

  await clickCropRatio(page, "자유");
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  const squareStart = mapImageEditorScenePoint(edgeMapping, { x: 100, y: 100 });
  const squareEnd = mapImageEditorScenePoint(edgeMapping, { x: 110, y: 110 });
  await page.mouse.move(squareStart.x, squareStart.y);
  await page.mouse.down();
  await page.mouse.move(squareEnd.x, squareEnd.y, { steps: 3 });
  await page.mouse.up();
  await page.click('[data-testid="image-editor-crop-selection-apply"]');
  await page.click('[data-testid="image-editor-panel-crop"]');
  const extremePreset = await page.$$eval('[data-testid="image-editor-crop-presets"] button', (buttons) => {
    const preset = buttons.find((button) => button.textContent?.trim() === "9:16");
    return preset instanceof HTMLButtonElement ? { disabled: preset.disabled, title: preset.title } : undefined;
  });
  if (!extremePreset?.disabled || !extremePreset.title.includes("최소 10px")) throw new Error(`Extreme preset was not disabled with a reason: ${JSON.stringify(extremePreset)}`);

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  const modifierMapping = await getImageEditorSceneMapping(page, 1);
  const modifierStart = mapImageEditorScenePoint(modifierMapping, { x: 220, y: 160 });
  const modifierEnd = mapImageEditorScenePoint(modifierMapping, { x: 430, y: 300 });
  await page.keyboard.down("Shift");
  await page.mouse.move(modifierStart.x, modifierStart.y);
  await page.mouse.down();
  await page.mouse.move(modifierEnd.x, modifierEnd.y, { steps: 7 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  crop = await readImageEditorCropDebug(page);
  if (Math.abs(crop.selection.width - crop.selection.height) > 1) throw new Error(`Shift did not lock a free drag to 1:1: ${JSON.stringify(crop)}`);
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  const altMapping = await getImageEditorSceneMapping(page, 1);
  const altStart = mapImageEditorScenePoint(altMapping, { x: 450, y: 300 });
  const altEnd = mapImageEditorScenePoint(altMapping, { x: 560, y: 370 });
  await page.keyboard.down("Alt");
  await page.mouse.move(altStart.x, altStart.y);
  await page.mouse.down();
  await page.mouse.move(altEnd.x, altEnd.y, { steps: 7 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  crop = await readImageEditorCropDebug(page);
  const altCenter = { x: crop.selection.left + crop.selection.width / 2, y: crop.selection.top + crop.selection.height / 2 };
  if (Math.abs(altCenter.x - 450) > 2 || Math.abs(altCenter.y - 300) > 2) throw new Error(`Alt did not expand a free drag from its center: ${JSON.stringify({ crop, altCenter })}`);
  const handleCenterBefore = altCenter;
  await page.keyboard.down("Alt");
  await page.mouse.move(crop.controlClients.br.x, crop.controlClients.br.y);
  await page.mouse.down();
  await page.mouse.move(crop.controlClients.br.x + 45, crop.controlClients.br.y + 30, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  crop = await readImageEditorCropDebug(page);
  const handleCenterAfter = { x: crop.selection.left + crop.selection.width / 2, y: crop.selection.top + crop.selection.height / 2 };
  if (Math.abs(handleCenterAfter.x - handleCenterBefore.x) > 1 || Math.abs(handleCenterAfter.y - handleCenterBefore.y) > 1) {
    throw new Error(`Alt crop handle did not preserve the center: ${JSON.stringify({ handleCenterBefore, handleCenterAfter, crop })}`);
  }
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  await dragImageEditorRegion(page, 1);
  crop = await readImageEditorCropDebug(page);
  await page.keyboard.down("Shift");
  await page.mouse.move(crop.controlClients.br.x, crop.controlClients.br.y);
  await page.mouse.down();
  await page.mouse.move(crop.controlClients.br.x + 68, crop.controlClients.br.y + 8, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  crop = await readImageEditorCropDebug(page);
  if (Math.abs(crop.selection.width - crop.selection.height) > 1) throw new Error(`Shift did not lock a free crop handle to 1:1: ${JSON.stringify(crop)}`);

  const controlBeforeViewport = crop.controlClients.br;
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  let viewportCrop = await readImageEditorCropDebug(page);
  if (Math.hypot(viewportCrop.controlClients.br.x - controlBeforeViewport.x, viewportCrop.controlClients.br.y - controlBeforeViewport.y) < 20) {
    throw new Error(`Crop handles did not follow zoom: ${JSON.stringify({ controlBeforeViewport, viewportCrop })}`);
  }
  const zoomedHandleBefore = viewportCrop.selection;
  await page.mouse.move(viewportCrop.controlClients.br.x, viewportCrop.controlClients.br.y);
  await page.mouse.down();
  await page.mouse.move(viewportCrop.controlClients.br.x - 30, viewportCrop.controlClients.br.y - 24, { steps: 5 });
  await page.mouse.up();
  viewportCrop = await readImageEditorCropDebug(page);
  if (sameSelection(viewportCrop.selection, zoomedHandleBefore)) throw new Error(`Crop handle coordinates missed after zoom: ${JSON.stringify({ zoomedHandleBefore, viewportCrop })}`);
  const beforePanControl = viewportCrop.controlClients.br;
  const panStart = { x: viewportCrop.canvasBounds.left + viewportCrop.canvasBounds.width / 2, y: viewportCrop.canvasBounds.top + viewportCrop.canvasBounds.height / 2 };
  await page.keyboard.down("Space");
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  await page.mouse.move(panStart.x + 36, panStart.y + 24, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  viewportCrop = await readImageEditorCropDebug(page);
  if (Math.hypot(viewportCrop.controlClients.br.x - beforePanControl.x, viewportCrop.controlClients.br.y - beforePanControl.y) < 20) {
    throw new Error(`Crop handles did not follow pan: ${JSON.stringify({ beforePanControl, viewportCrop })}`);
  }

  const beforePinch = viewportCrop.selection;
  const touchClient = await page.createCDPSession();
  const touchCenter = viewportCrop.centerClient;
  const firstTouch = { x: touchCenter.x, y: touchCenter.y, id: 31, radiusX: 5, radiusY: 5, force: 1 };
  const secondTouch = { x: touchCenter.x + 55, y: touchCenter.y + 8, id: 32, radiusX: 5, radiusY: 5, force: 1 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [firstTouch] });
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [firstTouch, secondTouch] });
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...firstTouch, x: firstTouch.x - 18 }, { ...secondTouch, x: secondTouch.x + 24 }] });
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const afterPinch = await readImageEditorCropDebug(page);
  if (!afterPinch || afterPinch.count !== 1 || !sameSelection(afterPinch.selection, beforePinch)) throw new Error(`Pinch removed or changed the crop box: ${JSON.stringify({ beforePinch, afterPinch })}`);
  await installImageEditorExportCapture(page);
  const exportWithCrop = await captureImageEditorExport(page, "PNG");
  const afterCropExport = await readImageEditorCropDebug(page);
  await page.click('[data-testid="image-editor-crop-selection-cancel"]');
  const exportWithoutCrop = await captureImageEditorExport(page, "PNG");
  if (!exportWithCrop || exportWithCrop !== exportWithoutCrop || !afterCropExport || afterCropExport.count !== 1 || !afterCropExport.active) {
    throw new Error(`Crop overlay contaminated export or lost editability: ${JSON.stringify({ exportMatch: exportWithCrop === exportWithoutCrop, afterCropExport })}`);
  }

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  await dragImageEditorRegion(page, 1);
  await page.click('[data-testid="image-editor-panel-effect"]');
  let overlays = await readImageEditorOverlayCounts(page);
  if (overlays.crop !== 0 || overlays.effect !== 0) throw new Error(`Crop overlay leaked into effect mode: ${JSON.stringify(overlays)}`);
  await dragImageEditorRegion(page, 1);
  overlays = await readImageEditorOverlayCounts(page);
  if (overlays.crop !== 0 || overlays.effect !== 1) throw new Error(`Effect overlay ownership is invalid: ${JSON.stringify(overlays)}`);
  await page.click('[data-testid="image-editor-panel-crop"]');
  overlays = await readImageEditorOverlayCounts(page);
  if (overlays.crop !== 0 || overlays.effect !== 0) throw new Error(`Effect overlay leaked into crop mode: ${JSON.stringify(overlays)}`);

  await loadSyntheticImageEditor(page);
  await page.click('[data-testid="image-editor-panel-crop"]');
  const touchMapping = await getImageEditorSceneMapping(page, 1);
  const touchStartClient = mapImageEditorScenePoint(touchMapping, { x: 250, y: 170 });
  const touchEndClient = mapImageEditorScenePoint(touchMapping, { x: 520, y: 360 });
  const singleTouch = await page.createCDPSession();
  const touchPoint = { x: touchStartClient.x, y: touchStartClient.y, id: 41, radiusX: 5, radiusY: 5, force: 1 };
  await singleTouch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint] });
  await singleTouch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...touchPoint, x: touchEndClient.x, y: touchEndClient.y }] });
  await singleTouch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  crop = await readImageEditorCropDebug(page);
  if (!crop || crop.count !== 1 || crop.selection.width < 100 || crop.selection.height < 100) throw new Error(`Touch-safe crop creation failed: ${JSON.stringify(crop)}`);
  console.log("  image: editable crop box, ratio boundaries, modifiers, input branches, viewport gestures, ownership, history, and export isolation verified");
}

async function testImageStudioSizingAndPanel(page) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await loadSyntheticImageEditor(page, { width: 1800, height: 1200 });
  await installImageEditorExportCapture(page);

  await page.click('[data-testid="image-editor-panel-effect"]');
  await dragImageEditorRegion(page, 1);
  await page.click('[data-testid="image-editor-effect-selection-apply"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-effect-selection"]'));
  await page.click('[data-testid="image-editor-panel-shapes"]');
  await page.click('[data-testid="image-editor-shape-rounded-rect"]');
  await page.click('[data-testid="image-editor-panel-select"]');
  await page.$eval('button[aria-label="오른쪽으로 90도 회전"]', (button) => button.click());
  await new Promise((resolve) => setTimeout(resolve, 180));
  const beforeResample = await readImageEditorSizingDebug(page);
  if (!beforeResample.base || !beforeResample.effect || !beforeResample.shape || beforeResample.shape.angle !== 90) {
    throw new Error(`Sizing fixture is incomplete: ${JSON.stringify(beforeResample)}`);
  }

  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-panel-size"]');
  await setImageEditorNumber(page, "image-editor-resample-width", 1200);
  let sizeInputs = await readDimensionFields(page, "image-editor-resample");
  if (sizeInputs.width !== 1200 || sizeInputs.height !== 800) throw new Error(`Resample ratio lock did not calculate height: ${JSON.stringify(sizeInputs)}`);
  await setImageEditorNumber(page, "image-editor-resample-width", 5000);
  sizeInputs = await readDimensionFields(page, "image-editor-resample");
  if (sizeInputs.width !== 4096 || sizeInputs.height !== 2731) throw new Error(`Resample dimensions exceeded the 4096px cap: ${JSON.stringify(sizeInputs)}`);
  await setImageEditorNumber(page, "image-editor-resample-width", 1200);
  await page.click(".image-size-toggle button[role=switch]");
  await setImageEditorNumber(page, "image-editor-resample-height", 720);
  sizeInputs = await readDimensionFields(page, "image-editor-resample");
  if (sizeInputs.width !== 1200 || sizeInputs.height !== 720) throw new Error(`Unlocked resample dimensions did not remain independent: ${JSON.stringify(sizeInputs)}`);
  await page.click('[data-testid="image-editor-resample-apply"]');
  await page.waitForFunction(() => {
    const fields = document.querySelector('[data-testid="image-editor-resample"]');
    return fields?.getAttribute("data-width") === "1200" && fields?.getAttribute("data-height") === "720"
      && document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "100%";
  });
  const afterResample = await readImageEditorSizingDebug(page);
  const scaleTransform = [1200 / 900, 0, 0, 720 / 600, 0, 0];
  assertMatrixClose(afterResample.base.matrix, multiplyEditorMatrices(scaleTransform, beforeResample.base.matrix), "resampled base");
  assertMatrixClose(afterResample.shape.matrix, multiplyEditorMatrices(scaleTransform, beforeResample.shape.matrix), "resampled rotated shape");
  assertAnchoredEffect(afterResample.base, afterResample.effect, "resampled effect");
  if (afterResample.width !== 1200 || afterResample.height !== 720 || afterResample.count !== beforeResample.count || afterResample.zoom !== 1) {
    throw new Error(`Resample did not preserve content count, dimensions, or view reset: ${JSON.stringify({ beforeResample, afterResample })}`);
  }

  const historyProbe = await mutatePreviousImageEditorMultiplierSnapshot(page, 1);
  if (!historyProbe.everySnapshotStoredMultiplier || historyProbe.previous.width !== 900 || historyProbe.previous.height !== 600) {
    throw new Error(`Output multiplier was not stored in each history snapshot: ${JSON.stringify(historyProbe)}`);
  }
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-export-result"]')?.getAttribute("data-width") === "900");
  const undoneResample = await readImageEditorSizingDebug(page);
  assertMatrixClose(undoneResample.base.matrix, beforeResample.base.matrix, "resample undo base");
  assertMatrixClose(undoneResample.shape.matrix, beforeResample.shape.matrix, "resample undo shape");
  if (undoneResample.width !== 900 || undoneResample.height !== 600 || undoneResample.zoom !== 1) throw new Error(`Resample undo did not restore dimensions and view: ${JSON.stringify(undoneResample)}`);
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="image-editor-export-result"]')?.getAttribute("data-width")) > 2500);
  const redoneResample = await readImageEditorSizingDebug(page);
  assertMatrixClose(redoneResample.base.matrix, afterResample.base.matrix, "resample redo base");
  if (redoneResample.width !== 1200 || redoneResample.height !== 720 || redoneResample.zoom !== 1) throw new Error(`Resample redo did not restore dimensions and view: ${JSON.stringify(redoneResample)}`);

  await page.click('[data-testid="image-editor-panel-size"]');
  await setImageEditorNumber(page, "image-editor-canvas-resize-width", 400);
  await setImageEditorNumber(page, "image-editor-canvas-resize-height", 300);
  await page.click('[data-testid="image-editor-canvas-resize-apply"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-resample"]')?.getAttribute("data-width") === "400");
  const afterCanvasResize = await readImageEditorSizingDebug(page);
  const translateTransform = [1, 0, 0, 1, (400 - 1200) / 2, (300 - 720) / 2];
  assertMatrixClose(afterCanvasResize.base.matrix, multiplyEditorMatrices(translateTransform, redoneResample.base.matrix), "canvas-resized base");
  assertMatrixClose(afterCanvasResize.shape.matrix, multiplyEditorMatrices(translateTransform, redoneResample.shape.matrix), "canvas-resized shape");
  assertAnchoredEffect(afterCanvasResize.base, afterCanvasResize.effect, "canvas-resized effect");
  const hasClippedObject = afterCanvasResize.objects.some((object) => object.bounds.left < 0 || object.bounds.top < 0 || object.bounds.left + object.bounds.width > 400 || object.bounds.top + object.bounds.height > 300);
  if (afterCanvasResize.count !== redoneResample.count || !hasClippedObject || afterCanvasResize.zoom !== 1) {
    throw new Error(`Canvas resize deleted clipped content or missed its view reset: ${JSON.stringify(afterCanvasResize)}`);
  }
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-resample"]')?.getAttribute("data-width") === "1200");
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-resample"]')?.getAttribute("data-width") === "400");
  if (await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent) !== "100%") throw new Error("Canvas dimension redo did not reset the view");

  await page.click('[data-testid="image-editor-panel-size"]');
  await setImageEditorNumber(page, "image-editor-canvas-resize-width", 5000);
  await setImageEditorNumber(page, "image-editor-canvas-resize-height", 600);
  const cappedCanvasInputs = await readDimensionFields(page, "image-editor-canvas-resize");
  if (cappedCanvasInputs.width !== 4096 || cappedCanvasInputs.height !== 600) throw new Error(`Canvas size exceeded the 4096px cap: ${JSON.stringify(cappedCanvasInputs)}`);
  await page.click('[data-testid="image-editor-canvas-resize-apply"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-export-result"]')?.getAttribute("data-limited") === "true");
  const limitedOriginal = await page.$eval('[data-testid="image-editor-export-result"]', (result) => ({
    width: Number(result.getAttribute("data-width")),
    height: Number(result.getAttribute("data-height")),
    text: result.textContent || "",
  }));
  if (limitedOriginal.width !== 8192 || limitedOriginal.height > 8192 || !limitedOriginal.text.includes("자동 조정")) {
    throw new Error(`Original-quality export did not apply the 8192px cap with result guidance: ${JSON.stringify(limitedOriginal)}`);
  }
  console.log("  image: resample matrices, anchored effects, ratio/caps, canvas centering, non-deletion, history, and view reset verified");

  await loadSyntheticImageEditor(page, { width: 1800, height: 1200 });
  await installImageEditorExportCapture(page);
  await clickImageEditorOption(page, ".image-export-size-control .ui-segmented-control", "크기 지정");
  await setImageEditorNumber(page, "image-editor-export-size-width", 600);
  let exportSize = await readDimensionFields(page, "image-editor-export-size");
  if (exportSize.width !== 600 || exportSize.height !== 400) throw new Error(`Locked custom export did not preserve ratio: ${JSON.stringify(exportSize)}`);
  const lockedIdentityExport = await captureImageEditorExport(page, "PNG");
  const lockedBounds = await readGreenExportBounds(page, lockedIdentityExport);
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  await page.click('[data-testid="image-editor-zoom-in"]');
  const lockedZoomExport = await captureImageEditorExport(page, "PNG");
  if (lockedZoomExport !== lockedIdentityExport) throw new Error("Custom-size export changed with the canvas view transform");
  await page.click('[data-testid="image-editor-fit"]');
  await page.click(".image-export-ratio-toggle button[role=switch]");
  await setImageEditorNumber(page, "image-editor-export-size-height", 600);
  const stretchedExport = await captureImageEditorExport(page, "PNG");
  const stretchedBounds = await readGreenExportBounds(page, stretchedExport);
  if (lockedBounds.width !== 600 || lockedBounds.height !== 400 || stretchedBounds.width !== 600 || stretchedBounds.height !== 600
    || Math.abs(stretchedBounds.greenWidth - lockedBounds.greenWidth) > 2 || stretchedBounds.greenHeight < lockedBounds.greenHeight * 1.4) {
    throw new Error(`Custom export uniform/stretch paths are incorrect: ${JSON.stringify({ lockedBounds, stretchedBounds })}`);
  }
  await setImageEditorNumber(page, "image-editor-export-size-width", 9000);
  exportSize = await readDimensionFields(page, "image-editor-export-size");
  if (exportSize.width !== 8192 || exportSize.height !== 600) throw new Error(`Custom export exceeded the 8192px cap: ${JSON.stringify(exportSize)}`);
  console.log("  image: destination-canvas export verified for locked, stretched, capped, and view-independent output");

  await page.evaluate(() => sessionStorage.removeItem("worklazy:image-editor-panel-collapsed"));
  await loadSyntheticImageEditor(page);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.$eval('[data-testid="image-editor-panel-shapes"]', (button) => button.click());
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-options-panel"]')?.getAttribute("data-panel") === "shapes");
  await page.$eval('[data-testid="image-editor-shape-rounded-rect"]', (button) => button.click());
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-selection-controls"]')?.classList.contains("is-disabled"));
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!await page.$('[data-testid="image-editor-minibar"]')) {
    await page.click('[data-testid="image-editor-panel-select"]');
    const selectionMapping = await getImageEditorSceneMapping(page, 1);
    const shapeCenter = mapImageEditorScenePoint(selectionMapping, { x: 120, y: 120 });
    await page.mouse.click(shapeCenter.x, shapeCenter.y);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (!await page.$('[data-testid="image-editor-minibar"]')) throw new Error(`Minibar fixture could not be selected: ${JSON.stringify(await readImageEditorSizingDebug(page))}`);
  const minibarMapping = await getImageEditorSceneMapping(page, 1);
  const minibarStart = mapImageEditorScenePoint(minibarMapping, { x: 120, y: 120 });
  const minibarEnd = mapImageEditorScenePoint(minibarMapping, { x: 450, y: 300 });
  await page.mouse.move(minibarStart.x, minibarStart.y);
  await page.mouse.down();
  await page.mouse.move(minibarEnd.x, minibarEnd.y, { steps: 7 });
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 180));
  let minibarRecalculated = false;
  for (const width of [821, 1020, 1440]) {
    console.log(`  image: probing collapsible panel at ${width}px`);
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "false");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const before = await readImageEditorPanelLayout(page);
    await page.$eval('[data-testid="image-editor-panel-toggle"]', (button) => button.click());
    await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "true");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await readImageEditorPanelLayout(page);
    if (before.panelDisplay === "none" || after.panelDisplay !== "none" || after.stageWidth < before.stageWidth + 100 || after.canvasWidth <= before.canvasWidth
      || before.canvasSticky !== "sticky" || after.canvasSticky !== "sticky" || after.toggleExpanded !== "false") {
      throw new Error(`Collapsible panel did not expand the ${width}px canvas workspace: ${JSON.stringify({ width, before, after })}`);
    }
    if (before.minibar && after.minibar && Math.hypot(after.minibar.left - before.minibar.left, after.minibar.top - before.minibar.top) > 5) minibarRecalculated = true;
    await page.$eval('[data-testid="image-editor-panel-toggle"]', (button) => button.click());
    await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "false");
  }
  if (!minibarRecalculated) throw new Error("The floating minibar did not recalculate after the panel width changed");

  await page.setViewport({ width: 1020, height: 900, deviceScaleFactor: 1 });
  console.log("  image: probing collapsible panel session and mobile overrides");
  await page.$eval('[data-testid="image-editor-panel-toggle"]', (button) => button.click());
  await page.waitForFunction(() => sessionStorage.getItem("worklazy:image-editor-panel-collapsed") === "1");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "true");
  await page.setViewport({ width: 820, height: 900, deviceScaleFactor: 1 });
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "false");
  let mobilePanel = await readImageEditorPanelLayout(page);
  if (mobilePanel.panelDisplay === "none" || !mobilePanel.toggleDisabled || mobilePanel.panelPosition !== "relative") throw new Error(`820px panel did not remain a forced sheet: ${JSON.stringify(mobilePanel)}`);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "false");
  mobilePanel = await readImageEditorPanelLayout(page);
  if (mobilePanel.panelDisplay === "none" || !mobilePanel.toggleDisabled) throw new Error(`390px panel did not remain visible: ${JSON.stringify(mobilePanel)}`);
  await page.setViewport({ width: 821, height: 900, deviceScaleFactor: 1 });
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-workspace"]')?.getAttribute("data-panel-collapsed") === "true");
  await page.$eval('[data-testid="image-editor-panel-toggle"]', (button) => button.click());
  await page.waitForFunction(() => sessionStorage.getItem("worklazy:image-editor-panel-collapsed") === "0");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/en/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="image-editor-panel-size"]');
  const englishLabels = await page.evaluate(() => ({
    size: document.querySelector('[data-testid="image-editor-panel-size"]')?.textContent?.trim(),
    toggle: document.querySelector('[data-testid="image-editor-panel-toggle"]')?.getAttribute("aria-label"),
  }));
  if (englishLabels.size !== "Resize" || englishLabels.toggle !== "Collapse options panel") throw new Error(`English size/collapse labels are incomplete: ${JSON.stringify(englishLabels)}`);
  console.log("  image: collapsible panel verified at 821/1020/1440px with fit, minibar, session memory, mobile sheet, and ko/en controls");
}

async function testImageStudioCropOverlayMatrix(page, { transformed, zoom, erased }) {
  await loadSyntheticImageEditor(page);
  await installImageEditorExportCapture(page);
  await drawImageEditorStroke(page, "pencil", "#ff00ff", 22, [{ x: 330, y: 235 }, { x: 380, y: 220 }, { x: 440, y: 255 }, { x: 510, y: 230 }, { x: 550, y: 250 }]);
  if (erased) await drawImageEditorStroke(page, "erase", "#ff00ff", 8, [{ x: 405, y: 225 }, { x: 440, y: 255 }, { x: 475, y: 230 }]);
  if (transformed) await transformImageEditorBase(page);
  if (zoom === 2) {
    await page.click('[data-testid="image-editor-zoom-in"]');
    await page.click('[data-testid="image-editor-zoom-in"]');
    await page.click('[data-testid="image-editor-zoom-in"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "200%");
  }
  const before = await readImageRasterStats(page, await captureImageEditorExport(page, "PNG"));
  await page.click('[data-testid="image-editor-panel-crop"]');
  await dragImageEditorRegion(page, zoom);
  await setImageEditorCropSelection(page, { left: 280, top: 180, width: 340, height: 240 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="image-editor-crop-selection-apply"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const geometry = await readImageEditorRegionGeometry(page, "crop");
  if (geometry.error !== 0 || geometry.originX !== "left" || geometry.originY !== "top" || !geometry.inkInside) {
    throw new Error(`Crop matrix overlay does not match its stored region: ${JSON.stringify({ transformed, zoom, erased, geometry })}`);
  }
  await page.click('[data-testid="image-editor-crop-selection-apply"]');
  await assertCropAppliedToSelect(page, `matrix ${transformed}/${zoom}/${erased}`);
  const dimensions = await page.$eval(".fabric-stage .lower-canvas", (canvas) => ({ width: canvas.width / devicePixelRatio, height: canvas.height / devicePixelRatio }));
  const savedError = Math.max(Math.abs(dimensions.width - Math.round(geometry.selection.width)), Math.abs(dimensions.height - Math.round(geometry.selection.height)));
  const after = await readImageRasterStats(page, await captureImageEditorExport(page, "PNG"));
  const inkDeltaRatio = Math.abs(after.ink - before.ink) / Math.max(1, before.ink);
  const controlDeltaRatio = Math.abs(after.control - before.control) / Math.max(1, before.control);
  const erasedDeltaRatio = Math.abs(after.erased - before.erased) / Math.max(1, before.erased);
  if (before.ink < 100 || after.ink < 100 || inkDeltaRatio > 0.03 || before.control < 500 || after.control < 500 || controlDeltaRatio > 0.03
    || (erased && (before.erased < 10 || after.erased < 10 || erasedDeltaRatio > 0.05)) || (!erased && (before.erased !== 0 || after.erased !== 0)) || savedError !== 0) {
    throw new Error(`Crop matrix did not preserve in-box drawing/control pixels: ${JSON.stringify({ transformed, zoom, erased, geometry, dimensions, before, after, inkDeltaRatio, controlDeltaRatio, erasedDeltaRatio, savedError })}`);
  }
  return {
    transform: transformed ? "move+rotate+flip" : "none",
    zoom: `${zoom * 100}%`,
    eraser: erased,
    geometryError: geometry.error,
    savedError,
    ink: `${before.ink}->${after.ink}`,
    erasedPixels: `${before.erased}->${after.erased}`,
    control: `${before.control}->${after.control}`,
  };
}

async function loadSyntheticImageEditor(page, dimensions = { width: 600, height: 400 }) {
  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".fabric-stage .upper-canvas");
  await page.evaluate(async (sourceDimensions) => {
    const canvas = document.createElement("canvas");
    canvas.width = sourceDimensions.width;
    canvas.height = sourceDimensions.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#d1d1d6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#34c759";
    context.fillRect(Math.round(canvas.width * 0.45), Math.round(canvas.height * 0.45), Math.round(canvas.width * 0.1), Math.round(canvas.height * 0.1));
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "synthetic-crop-fixture.png", { type: "image/png" }));
    const stage = document.querySelector(".fabric-stage");
    if (!(stage instanceof HTMLElement)) throw new Error("Image editor stage is unavailable");
    stage.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    canvas.width = 1;
    canvas.height = 1;
  }, dimensions);
  await page.waitForFunction(() => document.querySelector(".image-studio-page [data-ui-part=drop-target] strong")?.textContent?.includes("1개 파일 선택됨"));
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .lower-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const pixel = canvas.getContext("2d")?.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return pixel && pixel[1] > 150;
  });
}

async function readImageEditorP3State(page) {
  return page.evaluate(async () => {
    window.__readImageEditorP3State = async () => {
      const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
      if (!(stage instanceof HTMLElement)) throw new Error("Image editor stage is unavailable");
      const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
      let fiber = fiberKey ? stage[fiberKey] : null;
      let fabricCanvas;
      while (fiber && !fabricCanvas) {
        let hook = fiber.memoizedState;
        while (hook) {
          const candidate = hook.memoizedState?.current;
          if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
            fabricCanvas = candidate;
            break;
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      if (!fabricCanvas) throw new Error("Fabric canvas is unavailable");
      window.__imageEditorFabricCanvas = fabricCanvas;
      const activeMembers = fabricCanvas.getActiveObjects();
      const objectDetails = fabricCanvas.getObjects().map((object, index) => {
        const bounds = object.getBoundingRect();
        const role = object.worklazyRole || "";
        const shapeKind = object.worklazyShapeKind || "";
        const type = String(object.type || object.constructor?.type || "");
        const normalizedType = type.toLowerCase().replace(/[^a-z]/g, "");
        const kind = role === "base" || role === "region-effect" || role === "crop-overlay"
          ? role
          : shapeKind || (normalizedType === "itext" ? "text" : role === "sticker" ? "sticker" : normalizedType === "path" ? "drawing" : type.toLowerCase());
        return {
          index,
          role,
          shapeKind,
          kind,
          type,
          visible: object.visible,
          evented: object.evented,
          selectable: object.selectable,
          editing: Boolean(object.isEditing),
          left: object.left,
          top: object.top,
          angle: object.angle,
          scaleX: object.scaleX,
          scaleY: object.scaleY,
          bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
        };
      });
      const base = objectDetails.find((object) => object.role === "base");
      const effects = objectDetails.filter((object) => object.role === "region-effect");
      const overlays = objectDetails.filter((object) => object.role === "crop-overlay");
      const additional = objectDetails.filter((object) => !object.role || !["base", "region-effect", "crop-overlay"].includes(object.role));
      const fixedCount = (base ? 1 : 0) + effects.length;
      const blockValid = (!base || base.index === 0)
        && effects.every((object, index) => object.index === index + (base ? 1 : 0))
        && additional.every((object) => object.index >= fixedCount)
        && overlays.every((object) => object.index >= fixedCount + additional.length);
      const activeObjects = activeMembers
        .map((object) => objectDetails[fabricCanvas.getObjects().indexOf(object)])
        .filter(Boolean)
        .sort((left, right) => left.index - right.index);
      const active = fabricCanvas.getActiveObject();
      return {
        width: fabricCanvas.getWidth(),
        height: fabricCanvas.getHeight(),
        zoom: fabricCanvas.getZoom(),
        viewport: [...fabricCanvas.viewportTransform],
        selection: fabricCanvas.selection,
        selectionKey: fabricCanvas.selectionKey,
        objects: objectDetails,
        base,
        effects,
        overlays,
        additional,
        blockValid,
        activeType: String(active?.type || active?.constructor?.type || "").toLowerCase(),
        activeCount: activeObjects.length,
        activeKinds: activeObjects.map((object) => object.kind),
        activeObjects,
        layerRows: Array.from(document.querySelectorAll(".image-editor-layer-row"), (row) => ({
          id: row.getAttribute("data-layer-id") || "",
          kind: row.getAttribute("data-layer-kind") || "",
          visible: row.getAttribute("data-layer-visible") === "true",
          base: row.getAttribute("data-layer-base") === "true",
          active: row.classList.contains("is-active"),
          movable: row.classList.contains("is-movable"),
          deleteDisabled: row.querySelector(".image-editor-layer-delete")?.disabled === true,
        })),
      };
    };
    return window.__readImageEditorP3State();
  });
}

async function configureImageEditorP3Geometry(page, recordSnapshot, selectedKinds) {
  await readImageEditorP3State(page);
  await page.evaluate((record, requestedKinds) => {
    const canvas = window.__imageEditorFabricCanvas;
    if (!canvas) throw new Error("Fabric canvas is unavailable for P3 geometry");
    const active = canvas.getActiveObject();
    if (String(active?.type || active?.constructor?.type || "").toLowerCase() === "activeselection") window.__imageEditorActiveSelection = active.constructor;
    canvas.discardActiveObject();
    const objects = canvas.getObjects();
    const text = objects.find((object) => String(object.type || object.constructor?.type || "").toLowerCase().replace(/[^a-z]/g, "") === "itext");
    const rounded = objects.find((object) => object.worklazyShapeKind === "rounded-rect");
    const triangle = objects.find((object) => object.worklazyShapeKind === "triangle");
    if (text) text.set({ left: 120, top: 90, angle: -8, scaleX: 1.1, scaleY: 0.9, fill: "#ff2d55" });
    if (rounded) rounded.set({ left: 370, top: 220, angle: 23, scaleX: 1.15, scaleY: 0.8, fill: "#0a84ff" });
    if (triangle) triangle.set({ left: 650, top: 370, angle: -17, scaleX: 0.9, scaleY: 1.25, fill: "#34c759" });
    [text, rounded, triangle].filter(Boolean).forEach((object) => object.setCoords());
    const findKind = (kind) => kind === "text" ? text : kind === "rounded-rect" ? rounded : kind === "triangle" ? triangle : undefined;
    if (record && (triangle || rounded || text)) canvas.fire("object:modified", { target: triangle || rounded || text });
    const selected = Array.isArray(requestedKinds) ? requestedKinds.map(findKind).filter(Boolean) : [];
    if (selected.length > 1) {
      const ActiveSelectionConstructor = window.__imageEditorActiveSelection;
      if (!ActiveSelectionConstructor) throw new Error("ActiveSelection constructor was not cached");
      canvas.setActiveObject(new ActiveSelectionConstructor(selected, { canvas }));
    } else if (selected.length === 1) canvas.setActiveObject(selected[0]);
    else if (triangle || rounded || text) canvas.setActiveObject(triangle || rounded || text);
    canvas.requestRenderAll();
  }, recordSnapshot, selectedKinds);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 140)));
}

async function cacheImageEditorActiveSelectionConstructor(page) {
  await readImageEditorP3State(page);
  await page.evaluate(() => {
    const active = window.__imageEditorFabricCanvas?.getActiveObject();
    if (String(active?.type || active?.constructor?.type || "").toLowerCase() !== "activeselection") throw new Error("ActiveSelection is unavailable");
    window.__imageEditorActiveSelection = active.constructor;
  });
}

async function discardImageEditorSelection(page) {
  await readImageEditorP3State(page);
  await page.evaluate(() => {
    const canvas = window.__imageEditorFabricCanvas;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function setImageEditorBaseHitTesting(page, evented) {
  await readImageEditorP3State(page);
  await page.evaluate((enabled) => {
    const canvas = window.__imageEditorFabricCanvas;
    const base = canvas?.getObjects().find((object) => object.worklazyRole === "base");
    if (!canvas || !base) throw new Error("Image editor base is unavailable");
    base.set({ selectable: true, evented: enabled });
    base.setCoords();
    canvas.requestRenderAll();
  }, evented);
}

async function setImageEditorAllCanvasObjectsHitTesting(page, enabled) {
  await readImageEditorP3State(page);
  await page.evaluate((nextEnabled) => {
    const canvas = window.__imageEditorFabricCanvas;
    if (!canvas) throw new Error("Fabric canvas is unavailable");
    if (!window.__imageEditorHitTesting) window.__imageEditorHitTesting = new WeakMap();
    canvas.getObjects().forEach((object) => {
      if (!nextEnabled) {
        window.__imageEditorHitTesting.set(object, { selectable: object.selectable, evented: object.evented });
        object.set({ selectable: false, evented: false });
      } else {
        const previous = window.__imageEditorHitTesting.get(object);
        if (previous) object.set(previous);
      }
      object.setCoords();
    });
    canvas.requestRenderAll();
  }, enabled);
}

async function clickImageEditorObject(page, object, modifiers = []) {
  if (!object?.bounds) throw new Error("Image editor object bounds are unavailable");
  const state = await readImageEditorP3State(page);
  const mapping = await getImageEditorSceneMapping(page, state.zoom);
  const point = mapImageEditorScenePoint(mapping, {
    x: object.bounds.left + object.bounds.width / 2,
    y: object.bounds.top + object.bounds.height / 2,
  });
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  await page.mouse.click(point.x, point.y);
  for (const modifier of [...modifiers].reverse()) await page.keyboard.up(modifier);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function clickImageEditorScenePoint(page, scenePoint, modifiers = []) {
  const state = await readImageEditorP3State(page);
  const point = mapImageEditorScenePoint(await getImageEditorSceneMapping(page, state.zoom), scenePoint);
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  await page.mouse.click(point.x, point.y);
  for (const modifier of [...modifiers].reverse()) await page.keyboard.up(modifier);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function rightClickImageEditorObject(page, object) {
  if (!object?.bounds) throw new Error("Image editor context target bounds are unavailable");
  const state = await readImageEditorP3State(page);
  await page.evaluate(() => {
    window.__imageEditorLastFabricContext = null;
    window.__imageEditorFabricCanvas?.once("contextmenu", (event) => {
      window.__imageEditorLastFabricContext = {
        target: event.target?.worklazyShapeKind || event.target?.worklazyRole || event.target?.type || "",
        x: event.e?.clientX,
        y: event.e?.clientY,
      };
    });
  });
  const mapping = await getImageEditorSceneMapping(page, state.zoom);
  const point = mapImageEditorScenePoint(mapping, {
    x: object.bounds.left + object.bounds.width / 2,
    y: object.bounds.top + object.bounds.height / 2,
  });
  // getImageEditorSceneMapping intentionally scrolls the canvas into view; let that
  // scroll event settle before asserting the product's scroll-to-close contract.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  await page.mouse.click(point.x, point.y, { button: "right" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openImageEditorContextMenu(page, object) {
  await rightClickImageEditorObject(page, object);
  try {
    await page.waitForSelector('[data-testid="image-editor-context-menu"]', { timeout: 3_000 });
  } catch {
    const fabricEvent = await page.evaluate(() => window.__imageEditorLastFabricContext);
    throw new Error(`Image editor context menu did not open: ${JSON.stringify({ target: object, fabricEvent, state: await readImageEditorP3State(page) })}`);
  }
}

async function assertImageEditorUndoRedoOrder(page, afterOrder, beforeOrder, label) {
  await page.click('[data-testid="image-editor-undo"]');
  await page.waitForFunction((order) => window.__readImageEditorP3State?.().then((value) => value.additional.map((object) => object.kind).join(",") === order), {}, beforeOrder);
  if (!(await readImageEditorP3State(page)).blockValid) throw new Error(`${label} undo broke the base block`);
  await page.click('[data-testid="image-editor-redo"]');
  await page.waitForFunction((order) => window.__readImageEditorP3State?.().then((value) => value.additional.map((object) => object.kind).join(",") === order), {}, afterOrder);
  if (!(await readImageEditorP3State(page)).blockValid) throw new Error(`${label} redo broke the base block`);
}

function assertImageEditorAlignment(objects, alignment, label) {
  if (objects.length < 2) throw new Error(`${label} ${alignment} has no ActiveSelection`);
  const values = alignment === "left"
    ? objects.map((object) => object.bounds.left)
    : alignment === "center-horizontal" ? objects.map((object) => object.bounds.left + object.bounds.width / 2)
      : alignment === "right" ? objects.map((object) => object.bounds.left + object.bounds.width)
        : alignment === "top" ? objects.map((object) => object.bounds.top)
          : alignment === "center-vertical" ? objects.map((object) => object.bounds.top + object.bounds.height / 2)
            : objects.map((object) => object.bounds.top + object.bounds.height);
  if (Math.max(...values) - Math.min(...values) > 0.75) throw new Error(`${label} ${alignment} did not use scene bboxes: ${JSON.stringify(values)}`);
}

async function installContextMenuDefaultProbe(page) {
  await page.evaluate(() => {
    window.__imageEditorContextDefaults = [];
    document.addEventListener("contextmenu", (event) => {
      window.__imageEditorContextDefaults.push({
        inside: event.target instanceof Element && Boolean(event.target.closest(".fabric-stage .upper-canvas")),
        prevented: event.defaultPrevented,
      });
    });
  });
}

async function setImageEditorNumber(page, testId, value) {
  await page.$eval(`[data-testid="${testId}"]`, (input, nextValue) => {
    if (!(input instanceof HTMLInputElement)) throw new Error("Image editor number field is unavailable");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

async function readDimensionFields(page, testId) {
  return page.$eval(`[data-testid="${testId}"]`, (fields) => ({
    width: Number(fields.getAttribute("data-width")),
    height: Number(fields.getAttribute("data-height")),
  }));
}

async function clickImageEditorOption(page, containerSelector, label) {
  await page.$$eval(`${containerSelector} button`, (buttons, expected) => {
    const option = buttons.find((button) => button.textContent?.trim() === expected);
    if (!(option instanceof HTMLButtonElement)) throw new Error(`Image editor option ${expected} is unavailable`);
    option.click();
  }, label);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

async function readImageEditorSizingDebug(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    if (!(stage instanceof HTMLElement)) throw new Error("Image editor stage is unavailable");
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let fabricCanvas;
    while (fiber && !fabricCanvas) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
          fabricCanvas = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    if (!fabricCanvas) throw new Error("Fabric canvas is unavailable");
    const objects = fabricCanvas.getObjects().map((object, index) => {
      const bounds = object.getBoundingRect();
      return {
        index,
        role: object.worklazyRole || "",
        shapeKind: object.worklazyShapeKind || "",
        type: object.type,
        angle: object.angle,
        anchorX: object.worklazyAnchorX,
        anchorY: object.worklazyAnchorY,
        matrix: object.calcTransformMatrix().map(Number),
        bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      };
    });
    return {
      width: fabricCanvas.getWidth(),
      height: fabricCanvas.getHeight(),
      zoom: fabricCanvas.getZoom(),
      count: objects.length,
      objects,
      base: objects.find((object) => object.role === "base"),
      effect: objects.find((object) => object.role === "region-effect"),
      shape: objects.find((object) => object.shapeKind === "rounded-rect"),
      active: (() => {
        const active = fabricCanvas.getActiveObject();
        return active ? { role: active.worklazyRole || "", shapeKind: active.worklazyShapeKind || "", type: active.type } : null;
      })(),
    };
  });
}

function multiplyEditorMatrices(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function assertMatrixClose(actual, expected, label, tolerance = 1e-4) {
  if (!actual || !expected || actual.length !== 6 || Math.max(...actual.map((value, index) => Math.abs(value - expected[index]))) > tolerance) {
    throw new Error(`${label} matrix differs: ${JSON.stringify({ actual, expected })}`);
  }
}

function assertAnchoredEffect(base, effect, label) {
  if (!base || !effect || !Number.isFinite(effect.anchorX) || !Number.isFinite(effect.anchorY)) throw new Error(`${label} anchor is unavailable`);
  const [a, b, c, d, tx, ty] = base.matrix;
  assertMatrixClose(effect.matrix, [a, b, c, d, tx + a * effect.anchorX + c * effect.anchorY, ty + b * effect.anchorX + d * effect.anchorY], label);
}

async function mutatePreviousImageEditorMultiplierSnapshot(page, nextMultiplier) {
  return page.evaluate((multiplier) => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    if (!(stage instanceof HTMLElement)) throw new Error("Image editor stage is unavailable");
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let history;
    while (fiber && !history) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (Array.isArray(candidate) && candidate.length >= 2 && candidate.every((entry) => typeof entry === "string" && entry.includes('"canvas"') && entry.includes('"width"'))) {
          history = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    if (!history) throw new Error("Image editor history snapshots are unavailable");
    const parsed = history.map((entry) => JSON.parse(entry));
    const previous = parsed.at(-2);
    previous.outputMultiplier = multiplier;
    history[history.length - 2] = JSON.stringify(previous);
    return {
      length: history.length,
      everySnapshotStoredMultiplier: parsed.every((snapshot) => Number.isFinite(snapshot.outputMultiplier)),
      previous: { width: previous.width, height: previous.height, outputMultiplier: previous.outputMultiplier },
      current: { width: parsed.at(-1).width, height: parsed.at(-1).height, outputMultiplier: parsed.at(-1).outputMultiplier },
    };
  }, nextMultiplier);
}

async function readGreenExportBounds(page, dataUrl) {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        if (green > 140 && green > red * 1.35 && green > blue * 1.35) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const result = { width: canvas.width, height: canvas.height, greenWidth: maxX >= minX ? maxX - minX + 1 : 0, greenHeight: maxY >= minY ? maxY - minY + 1 : 0 };
    canvas.width = 1;
    canvas.height = 1;
    return result;
  }, dataUrl);
}

async function readImageEditorPanelLayout(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    const panel = document.querySelector('[data-testid="image-editor-options-panel"]');
    const canvas = document.querySelector(".fabric-stage .upper-canvas");
    const canvasColumn = document.querySelector(".image-editor-canvas-column");
    const toggle = document.querySelector('[data-testid="image-editor-panel-toggle"]');
    const minibar = document.querySelector('[data-testid="image-editor-minibar"]')?.getBoundingClientRect();
    if (!(stage instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || !(canvasColumn instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) {
      throw new Error("Image editor panel layout is unavailable");
    }
    const stageBounds = stage.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const panelStyle = getComputedStyle(panel);
    return {
      stageWidth: stageBounds.width,
      canvasWidth: canvasBounds.width,
      panelDisplay: panelStyle.display,
      panelPosition: panelStyle.position,
      canvasSticky: getComputedStyle(canvasColumn).position,
      toggleDisabled: toggle.disabled,
      toggleExpanded: toggle.getAttribute("aria-expanded"),
      minibar: minibar ? { left: minibar.left, top: minibar.top } : null,
    };
  });
}

async function installImageEditorExportCapture(page) {
  await page.evaluate(() => {
    window.__worklazyExportDataUrl = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function captureImageExport() {
      if (this.href.startsWith("data:image/")) {
        window.__worklazyExportDataUrl = this.href;
        return;
      }
      return originalClick.call(this);
    };
  });
}

async function drawImageEditorStroke(page, tool, color, width, points) {
  await page.click('[data-testid="image-editor-panel-draw"]');
  await page.click(`[data-testid="image-editor-draw-${tool}"]`);
  await page.evaluate((nextColor, nextWidth) => {
    const setValue = (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const colorInput = document.querySelector('[data-testid="image-editor-draw-color"]');
    const widthInput = document.querySelector('[data-testid="image-editor-draw-width"]');
    if (!(colorInput instanceof HTMLInputElement) || !(widthInput instanceof HTMLInputElement)) throw new Error("Drawing controls are unavailable");
    setValue(colorInput, nextColor);
    setValue(widthInput, String(nextWidth));
  }, color, width);
  const mapping = await getImageEditorSceneMapping(page, 1);
  const clientPoints = points.map((point) => mapImageEditorScenePoint(mapping, point));
  await page.mouse.move(clientPoints[0].x, clientPoints[0].y);
  await page.mouse.down();
  for (const point of clientPoints.slice(1)) await page.mouse.move(point.x, point.y, { steps: 3 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function transformImageEditorBase(page) {
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.click('button[aria-label="원본 사진 잠금"]');
  await page.click('[data-testid="image-editor-panel-select"]');
  const mapping = await getImageEditorSceneMapping(page, 1);
  const start = mapImageEditorScenePoint(mapping, { x: 690, y: 180 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 30 * mapping.scaleX, start.y + 20 * mapping.scaleY, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-selection-controls"]')?.classList.contains("is-disabled"));
  await page.$eval('button[aria-label="오른쪽으로 90도 회전"]', (button) => button.click());
  await page.click('button[aria-label="좌우 반전"]');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const transform = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    if (!(stage instanceof HTMLElement)) return null;
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let fabricCanvas;
    while (fiber && !fabricCanvas) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
          fabricCanvas = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    const base = fabricCanvas?.getObjects().find((object) => object.worklazyRole === "base");
    return base ? { left: base.left, top: base.top, angle: base.angle, flipX: base.flipX } : null;
  });
  if (!transform || Math.abs(transform.left - 450) < 10 || Math.abs(transform.top - 300) < 10 || transform.angle !== 90 || !transform.flipX) {
    throw new Error(`Synthetic matrix base transform was not applied: ${JSON.stringify(transform)}`);
  }
}

async function getImageEditorSceneMapping(page, zoom) {
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const bounds = await page.$eval(".fabric-stage .upper-canvas", (canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  });
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error("Image editor canvas is unavailable");
  const logical = await page.$eval(".fabric-stage .lower-canvas", (element) => ({ width: element.width / devicePixelRatio, height: element.height / devicePixelRatio }));
  return { bounds, logical, zoom, scaleX: bounds.width / logical.width, scaleY: bounds.height / logical.height };
}

function mapImageEditorScenePoint(mapping, point) {
  return {
    x: mapping.bounds.x + (point.x * mapping.zoom + (1 - mapping.zoom) * mapping.logical.width / 2) * mapping.scaleX,
    y: mapping.bounds.y + (point.y * mapping.zoom + (1 - mapping.zoom) * mapping.logical.height / 2) * mapping.scaleY,
  };
}

async function getImageEditorRegionDrag(page, zoom) {
  const mapping = await getImageEditorSceneMapping(page, zoom);
  return {
    start: mapImageEditorScenePoint(mapping, { x: 280, y: 180 }),
    end: mapImageEditorScenePoint(mapping, { x: 620, y: 420 }),
  };
}

async function dragImageEditorRegion(page, zoom) {
  const drag = await getImageEditorRegionDrag(page, zoom);
  await page.mouse.move(drag.start.x, drag.start.y);
  await page.mouse.down();
  await page.mouse.move(drag.end.x, drag.end.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector('[data-testid="image-editor-region-size-label"]');
}

async function setImageEditorCropSelection(page, selection) {
  await readImageEditorP3State(page);
  await page.evaluate((nextSelection) => {
    const canvas = window.__imageEditorFabricCanvas;
    const overlay = canvas?.getObjects().find((object) => object.worklazyRole === "crop-overlay");
    if (!canvas || !overlay) throw new Error("Crop overlay is unavailable for the exact pixel matrix");
    overlay.set({ ...nextSelection, scaleX: 1, scaleY: 1 });
    overlay.setCoords();
    canvas.fire("object:modified", { target: overlay });
    canvas.requestRenderAll();
  }, selection);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertRegionModeRetained(page, mode, action) {
  await page.waitForFunction((expectedMode) => {
    const panel = document.querySelector('[data-testid="image-editor-options-panel"]');
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    const toolbar = document.querySelector(`[data-testid="image-editor-panel-${expectedMode}"]`);
    const selection = document.querySelector(`[data-testid="image-editor-${expectedMode === "crop" ? "crop" : "effect"}-selection"]`);
    const hasSelection = expectedMode === "crop"
      ? selection?.querySelector('[data-testid="image-editor-crop-selection-apply"]') instanceof HTMLButtonElement && !selection.querySelector('[data-testid="image-editor-crop-selection-apply"]').disabled
      : Boolean(selection);
    return panel?.getAttribute("data-panel") === expectedMode && stage?.classList.contains(`is-${expectedMode}-mode`) && toolbar?.getAttribute("aria-pressed") === "true"
      && !hasSelection && !document.querySelector('[data-testid="image-editor-region-size-label"]');
  }, {}, mode);
  const state = await page.evaluate((expectedMode) => ({
    panel: document.querySelector('[data-testid="image-editor-options-panel"]')?.getAttribute("data-panel"),
    mode: document.querySelector('[data-testid="image-editor-canvas-stage"]')?.classList.contains(`is-${expectedMode}-mode`),
  }), mode);
  if (state.panel !== mode || !state.mode) throw new Error(`${action} left its region mode: ${JSON.stringify(state)}`);
}

async function assertCropAppliedToSelect(page, action) {
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-options-panel"]')?.getAttribute("data-panel") === "select"
    && document.querySelector('[data-testid="image-editor-panel-select"]')?.getAttribute("aria-pressed") === "true"
    && !document.querySelector('[data-testid="image-editor-canvas-stage"]')?.classList.contains("is-crop-mode"));
  const state = await page.evaluate(() => ({
    panel: document.querySelector('[data-testid="image-editor-options-panel"]')?.getAttribute("data-panel"),
    selectPressed: document.querySelector('[data-testid="image-editor-panel-select"]')?.getAttribute("aria-pressed"),
    cropMode: document.querySelector('[data-testid="image-editor-canvas-stage"]')?.classList.contains("is-crop-mode"),
  }));
  if (state.panel !== "select" || state.selectPressed !== "true" || state.cropMode) throw new Error(`${action} did not synchronize panel and mode: ${JSON.stringify(state)}`);
}

async function readImageEditorRegionGeometry(page, mode) {
  return page.evaluate((expectedMode) => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    const label = document.querySelector('[data-testid="image-editor-region-size-label"]');
    if (!(stage instanceof HTMLElement) || !(label instanceof HTMLElement)) throw new Error("Region geometry UI is unavailable");
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let fabricCanvas;
    while (fiber && !fabricCanvas) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
          fabricCanvas = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    if (!fabricCanvas) throw new Error("Fabric canvas was not found from the editor component");
    const expectedStroke = expectedMode === "crop" ? "#0a84ff" : "#af52de";
    const overlay = fabricCanvas.getObjects().find((object) => object.type === "rect" && object.stroke === expectedStroke && object.excludeFromExport);
    if (!overlay) throw new Error(`${expectedMode} overlay was not found`);
    const selection = {
      left: Number(label.dataset.selectionLeft),
      top: Number(label.dataset.selectionTop),
      width: Number(label.dataset.selectionWidth),
      height: Number(label.dataset.selectionHeight),
    };
    const topLeft = typeof overlay.getPointByOrigin === "function" ? overlay.getPointByOrigin("left", "top") : { x: overlay.left, y: overlay.top };
    const visual = { left: topLeft.x, top: topLeft.y, width: overlay.width * Math.abs(overlay.scaleX || 1), height: overlay.height * Math.abs(overlay.scaleY || 1) };
    const rawError = Math.max(
      Math.abs(visual.left - selection.left),
      Math.abs(visual.top - selection.top),
      Math.abs(visual.width - selection.width),
      Math.abs(visual.height - selection.height),
    );
    const error = rawError < 1e-9 ? 0 : rawError;
    const ink = fabricCanvas.getObjects().find((object) => object.type === "path" && object.globalCompositeOperation !== "destination-out" && String(object.stroke).toLowerCase() === "#ff00ff");
    const inkBounds = ink?.getBoundingRect();
    const inkInside = !inkBounds || (inkBounds.left >= selection.left && inkBounds.top >= selection.top
      && inkBounds.left + inkBounds.width <= selection.left + selection.width && inkBounds.top + inkBounds.height <= selection.top + selection.height);
    return {
      originX: overlay.originX,
      originY: overlay.originY,
      selectable: overlay.selectable,
      evented: overlay.evented,
      excludeFromExport: overlay.excludeFromExport,
      selection,
      visual,
      error,
      inkBounds: inkBounds && { left: inkBounds.left, top: inkBounds.top, width: inkBounds.width, height: inkBounds.height },
      inkInside,
    };
  }, mode);
}

async function readImageEditorCropDebug(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    if (!(stage instanceof HTMLElement)) return null;
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let fabricCanvas;
    while (fiber && !fabricCanvas) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
          fabricCanvas = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    if (!fabricCanvas) return null;
    const crops = fabricCanvas.getObjects().filter((object) => object.worklazyRole === "crop-overlay");
    const overlay = crops[0];
    if (!overlay) return null;
    const topLeft = overlay.getPointByOrigin("left", "top");
    const selection = {
      left: topLeft.x,
      top: topLeft.y,
      width: Math.abs(overlay.width * overlay.scaleX),
      height: Math.abs(overlay.height * overlay.scaleY),
    };
    const bounds = fabricCanvas.upperCanvasEl.getBoundingClientRect();
    const scaleX = bounds.width / fabricCanvas.getWidth();
    const scaleY = bounds.height / fabricCanvas.getHeight();
    const controlClients = Object.fromEntries(Object.entries(overlay.oCoords || {}).map(([name, point]) => [name, {
      x: bounds.left + point.x * scaleX,
      y: bounds.top + point.y * scaleY,
    }]));
    const [zoomX, , , zoomY, panX, panY] = fabricCanvas.viewportTransform;
    const centerX = selection.left + selection.width / 2;
    const centerY = selection.top + selection.height / 2;
    const activeRatio = Array.from(document.querySelectorAll('[data-testid="image-editor-crop-presets"] button')).find((button) => button.classList.contains("active"))?.textContent?.trim() || "";
    return {
      count: crops.length,
      selection,
      scaleX: overlay.scaleX,
      scaleY: overlay.scaleY,
      controls: Object.keys(overlay.controls).sort(),
      controlClients,
      centerClient: { x: bounds.left + (centerX * zoomX + panX) * scaleX, y: bounds.top + (centerY * zoomY + panY) * scaleY },
      hasRotation: "mtr" in overlay.controls || overlay.angle !== 0 || overlay.skewX !== 0 || overlay.skewY !== 0,
      lockScalingFlip: overlay.lockScalingFlip,
      excludeFromExport: overlay.excludeFromExport,
      active: fabricCanvas.getActiveObject() === overlay,
      canvasUniformScaling: fabricCanvas.uniformScaling,
      canvas: { width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight() },
      canvasBounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      zoom: fabricCanvas.getZoom(),
      activeRatio,
      minibar: Boolean(document.querySelector('[data-testid="image-editor-minibar"]')),
      selectionControlsDisabled: !document.querySelector('[data-testid="image-editor-selection-controls"]') || document.querySelector('[data-testid="image-editor-selection-controls"]')?.classList.contains("is-disabled"),
      selectionDeleteDisabled: document.querySelector('[data-testid="image-editor-delete"]')?.disabled ?? false,
      undoDisabled: document.querySelector('[data-testid="image-editor-undo"]')?.disabled ?? false,
    };
  });
}

async function installCropTransformCounters(page) {
  await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    if (!(stage instanceof HTMLElement)) throw new Error("Image editor stage is unavailable");
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let fabricCanvas;
    while (fiber && !fabricCanvas) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
          fabricCanvas = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    if (!fabricCanvas) throw new Error("Fabric canvas is unavailable");
    window.__worklazyCropTransformCounts = { scaling: 0, modified: 0 };
    fabricCanvas.on("object:scaling", (event) => { if (event.target?.worklazyRole === "crop-overlay") window.__worklazyCropTransformCounts.scaling += 1; });
    fabricCanvas.on("object:modified", (event) => { if (event.target?.worklazyRole === "crop-overlay") window.__worklazyCropTransformCounts.modified += 1; });
  });
}

async function readImageEditorOverlayCounts(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    if (!(stage instanceof HTMLElement)) throw new Error("Image editor stage is unavailable");
    const fiberKey = Object.keys(stage).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? stage[fiberKey] : null;
    let fabricCanvas;
    while (fiber && !fabricCanvas) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.getObjects === "function" && candidate.upperCanvasEl instanceof HTMLCanvasElement) {
          fabricCanvas = candidate;
          break;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    const objects = fabricCanvas?.getObjects() || [];
    return {
      crop: objects.filter((object) => object.worklazyRole === "crop-overlay").length,
      effect: objects.filter((object) => object.type === "rect" && object.stroke === "#af52de" && object.excludeFromExport).length,
    };
  });
}

async function clickCropRatio(page, label) {
  await page.$$eval('[data-testid="image-editor-crop-presets"] button', (buttons, expected) => {
    const button = buttons.find((candidate) => candidate.textContent?.trim() === expected);
    if (!(button instanceof HTMLButtonElement) || button.disabled) throw new Error(`Crop ratio ${expected} is unavailable`);
    button.click();
  }, label);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function sameSelection(first, second, tolerance = 1e-6) {
  return Math.max(
    Math.abs(first.left - second.left),
    Math.abs(first.top - second.top),
    Math.abs(first.width - second.width),
    Math.abs(first.height - second.height),
  ) <= tolerance;
}

async function readImageRasterStats(page, dataUrl) {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    let erased = 0;
    let control = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3];
      if (red > 210 && green < 90 && blue > 180 && alpha > 180) ink += 1;
      if (red < 110 && green > 150 && green > red * 1.7 && blue < 150 && alpha > 200) control += 1;
      if (alpha < 32) erased += 1;
    }
    const result = { width: canvas.width, height: canvas.height, ink, erased, control };
    canvas.width = 1;
    canvas.height = 1;
    return result;
  }, dataUrl);
}

async function captureImageEditorExport(page, format) {
  await page.$$eval(".image-format-control button", (buttons, label) => {
    const option = buttons.find((button) => button.textContent?.trim() === label);
    if (!(option instanceof HTMLButtonElement)) throw new Error(`${label} export option is unavailable`);
    option.click();
  }, format);
  await page.evaluate(() => { window.__worklazyExportDataUrl = ""; });
  await page.click('[data-testid="image-editor-export-action"] button');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dataUrl = await page.evaluate(() => window.__worklazyExportDataUrl);
  if (!dataUrl) {
    const state = await page.evaluate(() => ({
      error: document.querySelector('[role="alert"]')?.textContent || "",
      button: document.querySelector('[data-testid="image-editor-export-action"] button')?.outerHTML || "",
      format: Array.from(document.querySelectorAll(".image-format-control button"), (button) => ({ text: button.textContent?.trim(), pressed: button.getAttribute("aria-pressed") })),
    }));
    throw new Error(`${format} export was not captured: ${JSON.stringify(state)}`);
  }
  return dataUrl;
}

async function testImageStudioEffectStrength(page, deviceScaleFactor, zoom) {
  console.log(`  image: probing DPR ${deviceScaleFactor}, zoom ${zoom * 100}% effect strength`);
  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".fabric-stage .upper-canvas");
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(1, "#ffffff");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "gradient.png", { type: "image/png" }));
    const stage = document.querySelector(".fabric-stage");
    stage.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    canvas.width = 1;
    canvas.height = 1;
  });
  await page.waitForFunction(() => document.querySelector(".image-studio-page [data-ui-part=drop-target] strong")?.textContent?.includes("1개 파일 선택됨"), { timeout: 15_000 });
  await page.evaluate(() => {
    window.__worklazyExportDataUrl = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function captureImageExport() {
      if (this.href.startsWith("data:image/")) {
        window.__worklazyExportDataUrl = this.href;
        return;
      }
      return originalClick.call(this);
    };
  });
  if (zoom === 2) {
    await page.click('[data-testid="image-editor-zoom-in"]');
    await page.click('[data-testid="image-editor-zoom-in"]');
    await page.click('[data-testid="image-editor-zoom-in"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "200%");
  }
  await page.click('[data-testid="image-editor-panel-effect"]');
  await page.waitForSelector(".fabric-stage.is-effect-mode");
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const canvas = await page.$(".fabric-stage .upper-canvas");
  const bounds = await canvas?.boundingBox();
  if (!bounds) throw new Error("Gradient canvas is unavailable for the effect-strength matrix");
  const leftRatio = zoom === 1 ? 0.28 : 0.2;
  const rightRatio = zoom === 1 ? 0.72 : 0.8;
  await page.mouse.move(bounds.x + bounds.width * leftRatio, bounds.y + bounds.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * rightRatio, bounds.y + bounds.height * 0.65, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector('[data-testid="image-editor-effect-selection"]', { timeout: 15_000 });
  await page.click('[data-testid="image-editor-effect-selection-apply"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="image-editor-effect-selection"]'));
  const dataUrl = await captureImageEditorExport(page, "PNG");
  const medianRun = await page.evaluate(async (source, matrixZoom) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const output = document.createElement("canvas");
    output.width = image.naturalWidth;
    output.height = image.naturalHeight;
    const context = output.getContext("2d");
    context.drawImage(image, 0, 0);
    const start = matrixZoom === 1 ? 310 : 350;
    const end = matrixZoom === 1 ? 590 : 550;
    const row = context.getImageData(start, 300, end - start, 1).data;
    const runs = [];
    let length = 1;
    for (let offset = 4; offset < row.length; offset += 4) {
      if (row[offset] === row[offset - 4] && row[offset + 1] === row[offset - 3] && row[offset + 2] === row[offset - 2]) length += 1;
      else {
        if (length >= 4 && length <= 40) runs.push(length);
        length = 1;
      }
    }
    if (length >= 4 && length <= 40) runs.push(length);
    runs.sort((a, b) => a - b);
    output.width = 1;
    output.height = 1;
    return runs.length ? runs[Math.floor(runs.length / 2)] : 0;
  }, dataUrl, zoom);
  const expected = zoom === 1 ? 16 : 8;
  if (Math.abs(medianRun - expected) > 2) throw new Error(`Effect strength changed across DPR/zoom: ${JSON.stringify({ deviceScaleFactor, zoom, medianRun, expected })}`);
  console.log(`  image: DPR ${deviceScaleFactor}, zoom ${zoom * 100}% effect strength verified (${medianRun}px)`);
}

async function testImageStudioMobile(page) {
  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="image-editor-canvas-stage"] .upper-canvas');
  const layout = await page.evaluate(() => {
    const workspace = document.querySelector('[data-testid="image-editor-workspace"]');
    const canvasColumn = workspace?.querySelector(".image-editor-canvas-column");
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    const panel = document.querySelector('[data-testid="image-editor-options-panel"]');
    if (!(workspace instanceof HTMLElement) || !(canvasColumn instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
    const workspaceStyle = getComputedStyle(workspace);
    const panelStyle = getComputedStyle(panel);
    const stageBounds = stage.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    return {
      columns: workspaceStyle.gridTemplateColumns,
      stageTop: stageBounds.top,
      panelTop: panelBounds.top,
      stageWidth: stageBounds.width,
      panelWidth: panelBounds.width,
      sticky: getComputedStyle(canvasColumn).position,
      workspacePosition: workspaceStyle.position,
      panelPosition: panelStyle.position,
      stagePosition: getComputedStyle(stage).position,
      panelRadius: parseFloat(panelStyle.borderTopLeftRadius),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      toolbarTargetMin: Math.min(...Array.from(document.querySelectorAll(".image-editor-panel-tabs button"), (button) => button.getBoundingClientRect().height)),
    };
  });
  if (!layout || layout.columns.split(" ").length !== 1 || layout.stageTop >= layout.panelTop || Math.abs(layout.stageWidth - layout.panelWidth) > 1 || layout.sticky !== "sticky"
    || layout.workspacePosition === "fixed" || layout.panelPosition === "fixed" || layout.stagePosition === "fixed" || layout.panelRadius < 18
    || layout.documentWidth > layout.viewportWidth || layout.toolbarTargetMin < 44) {
    throw new Error(`Mobile image editor is not a sticky canvas with a bottom sheet: ${JSON.stringify(layout)}`);
  }

  await page.$eval('[data-testid="image-editor-panel-stickers"]', (button) => button.click());
  await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.scrollIntoView({ block: "center", behavior: "instant" }));
  const mobileStickerPicker = await page.evaluate(() => ({
    categoryTargets: Array.from(document.querySelectorAll('[data-testid="image-editor-sticker-categories"] button'), (button) => button.getBoundingClientRect().height),
    stickerTargets: Array.from(document.querySelectorAll('[data-testid="image-editor-stickers"] button'), (button) => button.getBoundingClientRect().height),
    searchHeight: document.querySelector('[data-testid="image-editor-sticker-search"]')?.getBoundingClientRect().height,
  }));
  if (!mobileStickerPicker.categoryTargets.length || Math.min(...mobileStickerPicker.categoryTargets) < 44
    || !mobileStickerPicker.stickerTargets.length || Math.min(...mobileStickerPicker.stickerTargets) < 44
    || (mobileStickerPicker.searchHeight || 0) < 44) {
    throw new Error(`Mobile sticker picker targets are too small: ${JSON.stringify(mobileStickerPicker)}`);
  }
  await page.$eval('[data-testid="image-editor-sticker-search"]', (input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "로켓");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector('[data-testid="image-editor-stickers"] button[data-codepoint="1f680"]');
  await page.click('[data-testid="image-editor-stickers"] button[data-codepoint="1f680"]');
  await page.waitForSelector('[data-testid="image-editor-minibar"]');
  if (await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.getAttribute("data-panel")) !== "stickers") throw new Error("Mobile sticker insertion closed the bottom-sheet picker");
  await page.click('[data-testid="image-editor-panel-layers"]');
  await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForSelector(".image-editor-layer-row.is-movable");
  const mobileLayerState = await readImageEditorP3State(page);
  const mobileLayers = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    const panel = document.querySelector('[data-testid="image-editor-options-panel"]');
    const row = document.querySelector(".image-editor-layer-row");
    if (!(stage instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(row instanceof HTMLElement)) return null;
    const stageBounds = stage.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    return {
      panel: panel.getAttribute("data-panel"),
      panelBelowStage: panelBounds.top > stageBounds.top,
      rowHeight: row.getBoundingClientRect().height,
      actionHeights: Array.from(row.querySelectorAll("button"), (button) => button.getBoundingClientRect().height),
      hasDragHandle: Boolean(row.querySelector(".image-editor-layer-drag")),
    };
  });
  if (!mobileLayers || mobileLayers.panel !== "layers" || !mobileLayers.panelBelowStage || mobileLayers.rowHeight < 44
    || Math.min(...mobileLayers.actionHeights) < 44 || !mobileLayers.hasDragHandle || mobileLayerState.selection || mobileLayerState.selectionKey !== null) {
    throw new Error(`Mobile layers sheet or desktop-only selection guard is invalid: ${JSON.stringify({ mobileLayers, mobileLayerState })}`);
  }
  await page.click(".image-editor-layer-row .image-editor-layer-select");
  if (await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.getAttribute("data-panel")) !== "layers") throw new Error("Mobile layer selection closed the layers sheet");
  console.log("  image: mobile 390x844 layers sheet verified");
  await page.$eval(".image-editor-layer-row .image-editor-layer-delete", (button) => button.click());
  try {
    await page.waitForFunction(() => document.querySelectorAll(".image-editor-layer-row").length === 0, { timeout: 3_000 });
  } catch {
    throw new Error(`Mobile layer delete did not update the sheet: ${JSON.stringify(await readImageEditorP3State(page))}`);
  }
  console.log("  image: mobile layer deletion synchronized");

  await page.$eval('[data-testid="image-editor-panel-draw"]', (button) => button.click());
  await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.click('[data-testid="image-editor-draw-brush"]');
  await page.evaluate(() => {
    const color = document.querySelector('[data-testid="image-editor-draw-color"]');
    const width = document.querySelector('[data-testid="image-editor-draw-width"]');
    if (!(color instanceof HTMLInputElement) || !(width instanceof HTMLInputElement)) throw new Error("Mobile drawing controls are unavailable");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(color, "#123456");
    color.dispatchEvent(new Event("input", { bubbles: true }));
    color.dispatchEvent(new Event("change", { bubbles: true }));
    setter.call(width, "13");
    width.dispatchEvent(new Event("input", { bubbles: true }));
    width.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.$eval('[data-testid="image-editor-panel-canvas"]', (button) => button.click());
  await page.$eval('[data-testid="image-editor-panel-draw"]', (button) => button.click());
  const restoredDraw = await page.evaluate(() => ({
    brush: document.querySelector('[data-testid="image-editor-draw-brush"]')?.getAttribute("aria-pressed"),
    color: document.querySelector('[data-testid="image-editor-draw-color"]')?.value,
    width: document.querySelector('[data-testid="image-editor-draw-width"]')?.value,
  }));
  if (restoredDraw.brush !== "true" || restoredDraw.color !== "#123456" || restoredDraw.width !== "13") throw new Error(`Drawing options were not restored after panel re-entry: ${JSON.stringify(restoredDraw)}`);

  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const touchClient = await page.createCDPSession();
  let touchCanvasBounds = await (await page.$(".fabric-stage .upper-canvas"))?.boundingBox();
  if (!touchCanvasBounds) throw new Error("Mobile canvas is unavailable for touch gesture arbitration");
  const blankBeforeGesture = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  const drawStart = { x: touchCanvasBounds.x + touchCanvasBounds.width * 0.35, y: touchCanvasBounds.y + touchCanvasBounds.height * 0.45, id: 1, radiusX: 6, radiusY: 6, force: 1 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [drawStart] });
  const drawMove = { ...drawStart, x: drawStart.x + 12, y: drawStart.y + 8 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [drawMove] });
  const drawSecond = { x: drawStart.x + 70, y: drawStart.y + 10, id: 2, radiusX: 6, radiusY: 6, force: 1 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [drawMove, drawSecond] });
  await touchClient.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...drawMove, x: drawMove.x - 30, y: drawMove.y - 12 }, { ...drawSecond, x: drawSecond.x + 40, y: drawSecond.y + 18 }],
  });
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(() => parseInt(document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent || "0", 10) > 150);
  await page.$eval('[data-testid="image-editor-fit"]', (button) => button.click());
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "100%");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const blankAfterGesture = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (blankAfterGesture !== blankBeforeGesture) throw new Error("Starting a two-finger gesture committed the in-progress drawing stroke");

  await page.$eval('[data-testid="image-editor-panel-shapes"]', (button) => button.click());
  await page.$eval('[data-testid="image-editor-options-panel"]', (panel) => panel.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.$eval('[data-testid="image-editor-shape-rounded-rect"]', (button) => button.click());
  await page.waitForSelector('[data-testid="image-editor-minibar"]');
  const mobileControls = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="image-editor-options-panel"]');
    const stage = document.querySelector('[data-testid="image-editor-canvas-stage"]');
    const minibar = document.querySelector('[data-testid="image-editor-minibar"]');
    if (!(panel instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(minibar instanceof HTMLElement)) return null;
    const stageBounds = stage.getBoundingClientRect();
    const minibarBounds = minibar.getBoundingClientRect();
    return {
      activePanel: panel.getAttribute("data-panel"),
      panelButtonMin: Math.min(...Array.from(panel.querySelectorAll("button"), (button) => button.getBoundingClientRect().height)),
      minibarButtonMin: Math.min(...Array.from(minibar.querySelectorAll("button"), (button) => button.getBoundingClientRect().height)),
      minibarInsideStage: minibarBounds.left >= stageBounds.left && minibarBounds.right <= stageBounds.right,
    };
  });
  if (!mobileControls || mobileControls.activePanel !== "shapes" || mobileControls.panelButtonMin < 44 || mobileControls.minibarButtonMin < 44 || !mobileControls.minibarInsideStage) {
    throw new Error(`Mobile bottom sheet or floating minibar targets are invalid: ${JSON.stringify(mobileControls)}`);
  }
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  touchCanvasBounds = await (await page.$(".fabric-stage .upper-canvas"))?.boundingBox();
  if (!touchCanvasBounds) throw new Error("Mobile canvas is unavailable for one-finger object movement");
  const minibarBeforeSingleTouch = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  const inspectBlueShape = (canvas) => {
    const context = canvas.getContext("2d");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width; let minY = canvas.height; let maxX = -1; let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if (pixels[offset] < 40 && pixels[offset + 1] > 80 && pixels[offset + 2] > 200) {
          minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    return { dataUrl: canvas.toDataURL(), width: canvas.width, height: canvas.height, bounds: { minX, minY, maxX, maxY } };
  };
  const canvasBeforeSingleTouch = await page.$eval(".fabric-stage .lower-canvas", inspectBlueShape);
  const movementCandidateClients = [0.75, 0.5, 0.25].flatMap((yRatio) => [0.5, 0.25, 0.75].map((xRatio) => ({
    x: touchCanvasBounds.x + (canvasBeforeSingleTouch.bounds.minX + (canvasBeforeSingleTouch.bounds.maxX - canvasBeforeSingleTouch.bounds.minX) * xRatio) / canvasBeforeSingleTouch.width * touchCanvasBounds.width,
    y: touchCanvasBounds.y + (canvasBeforeSingleTouch.bounds.minY + (canvasBeforeSingleTouch.bounds.maxY - canvasBeforeSingleTouch.bounds.minY) * yRatio) / canvasBeforeSingleTouch.height * touchCanvasBounds.height,
  })));
  const movementStart = await page.evaluate((candidates) => candidates.find(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("upper-canvas")), movementCandidateClients);
  if (!movementStart) throw new Error(`Selected object has no unobscured canvas point for one-finger movement: ${JSON.stringify({ bounds: canvasBeforeSingleTouch.bounds, touchCanvasBounds })}`);
  const objectStart = {
    ...movementStart,
    id: 3,
    radiusX: 6,
    radiusY: 6,
    force: 1,
  };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [objectStart] });
  const objectMoved = { ...objectStart, x: objectStart.x + 40 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [objectMoved] });
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const minibarAfterSingleTouch = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  const canvasAfterSingleTouch = await page.$eval(".fabric-stage .lower-canvas", inspectBlueShape);
  const oneFingerChangedObject = JSON.stringify(canvasBeforeSingleTouch.bounds) !== JSON.stringify(canvasAfterSingleTouch.bounds);
  const oneFingerZoom = await page.$eval('[data-testid="image-editor-zoom-level"]', (level) => level.textContent);
  if (!oneFingerChangedObject || oneFingerZoom !== "100%") {
    throw new Error(`One-finger object movement was intercepted by stage gestures: ${JSON.stringify({ minibarBeforeSingleTouch, minibarAfterSingleTouch, canvasChanged: canvasBeforeSingleTouch.dataUrl !== canvasAfterSingleTouch.dataUrl, beforeBounds: canvasBeforeSingleTouch.bounds, afterBounds: canvasAfterSingleTouch.bounds, objectStart, touchCanvasBounds })}`);
  }

  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  touchCanvasBounds = await (await page.$(".fabric-stage .upper-canvas"))?.boundingBox();
  if (!touchCanvasBounds) throw new Error("Mobile canvas is unavailable for object-to-pinch arbitration");
  const blueBounds = canvasAfterSingleTouch.bounds;
  const candidatePixels = [0.5, 0.25, 0.75].flatMap((yRatio) => [0.5, 0.25, 0.75].map((xRatio) => ({
    x: blueBounds.minX + (blueBounds.maxX - blueBounds.minX) * xRatio,
    y: blueBounds.minY + (blueBounds.maxY - blueBounds.minY) * yRatio,
  })));
  const candidateClients = candidatePixels.map((point) => ({
    x: touchCanvasBounds.x + point.x / canvasAfterSingleTouch.width * touchCanvasBounds.width,
    y: touchCanvasBounds.y + point.y / canvasAfterSingleTouch.height * touchCanvasBounds.height,
  }));
  const visibleObjectPoint = await page.evaluate((candidates) => candidates.find(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("upper-canvas")), candidateClients);
  if (!visibleObjectPoint) throw new Error(`Selected object has no visible canvas point for pinch arbitration: ${JSON.stringify({ blueBounds, touchCanvasBounds })}`);
  const transformStart = {
    ...visibleObjectPoint,
    id: 4,
    radiusX: 6,
    radiusY: 6,
    force: 1,
  };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [transformStart] });
  const transformMove = { ...transformStart, x: transformStart.x + 10, y: transformStart.y + 6 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [transformMove] });
  const transformSecond = { x: transformStart.x + 70, y: transformStart.y, id: 5, radiusX: 6, radiusY: 6, force: 1 };
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [transformMove, transformSecond] });
  await touchClient.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...transformMove, x: transformMove.x - 30, y: transformMove.y - 12 }, { ...transformSecond, x: transformSecond.x + 44, y: transformSecond.y + 18 }],
  });
  await touchClient.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(() => parseInt(document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent || "0", 10) > 150, { timeout: 15_000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.$eval('[data-testid="image-editor-fit"]', (button) => button.click());
  await page.waitForFunction(() => document.querySelector('[data-testid="image-editor-zoom-level"]')?.textContent === "100%");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const minibarAfterPinchReset = await page.$eval('[data-testid="image-editor-minibar"]', (bar) => ({ left: bar.getBoundingClientRect().left, top: bar.getBoundingClientRect().top }));
  const canvasAfterPinchReset = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (canvasAfterPinchReset !== canvasAfterSingleTouch.dataUrl) {
    throw new Error(`Two-finger gesture changed the selected object instead of only the view: ${JSON.stringify({ minibarAfterSingleTouch, minibarAfterPinchReset, beforeBounds: canvasAfterSingleTouch.bounds })}`);
  }
  await touchClient.detach();
  console.log("  image: 390x844 bottom sheet, one-finger objects, two-finger drawing arbitration, pinch/pan, and floating minibar verified");
}

async function pasteCanvasImages(page, colors) {
  await page.evaluate(async (values) => {
    const transfer = new DataTransfer();
    for (let index = 0; index < values.length; index += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = 96 + index * 24;
      canvas.height = 72 + index * 36;
      const context = canvas.getContext("2d");
      context.fillStyle = values[index];
      context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      transfer.items.add(new File([blob], `clipboard-${index + 1}.png`, { type: "image/png" }));
      canvas.width = 1;
      canvas.height = 1;
    }
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    document.dispatchEvent(event);
  }, colors);
}

async function dropCanvasImages(page, selector, colors) {
  await page.evaluate(async (targetSelector, values) => {
    const transfer = new DataTransfer();
    for (let index = 0; index < values.length; index += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = targetSelector === ".fabric-stage" ? 1800 : 96 + index * 24;
      canvas.height = targetSelector === ".fabric-stage" ? 1200 : 72 + index * 36;
      const context = canvas.getContext("2d");
      context.fillStyle = values[index];
      context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (targetSelector === ".fabric-stage") window.__imageStudioTestSource = { width: canvas.width, height: canvas.height, size: blob.size };
      transfer.items.add(new File([blob], `preview-drop-${index + 1}.png`, { type: "image/png" }));
      canvas.width = 1;
      canvas.height = 1;
    }
    const target = document.querySelector(targetSelector);
    if (!(target instanceof HTMLElement)) throw new Error(`Drop target is unavailable: ${targetSelector}`);
    target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, selector, colors);
}

async function testAudioStudio(page, audioPath) {
  await page.goto(`${koBaseUrl}/tools/audio-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".audio-studio-page input[type=file]");
  await (await page.$(".audio-studio-page input[type=file]")).uploadFile(audioPath);
  await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-success")?.textContent?.includes("파형 준비 완료"), { timeout: 60_000 });
  await page.waitForFunction(() => {
    const host = document.querySelector(".audio-waveform");
    return Boolean(host?.firstElementChild?.shadowRoot?.querySelector("canvas"));
  });
  const summary = await page.$eval(".audio-file-summary", (element) => element.textContent || "");
  if (!summary.includes("2채널") || !summary.includes("48,000Hz")) throw new Error(`Audio metadata is incomplete: ${summary}`);
  const initialEnd = await page.$eval('.audio-selection-panel label:last-child input', (input) => Number(input.value));
  if (!(initialEnd > 0 && initialEnd < 2.5)) throw new Error(`Audio selection was not initialized: ${initialEnd}`);

  const zoomBefore = await page.$eval(".audio-waveform-toolbar small", (element) => element.textContent || "");
  await page.click('.audio-waveform-toolbar button[aria-label="파형 확대"]');
  const zoomAfter = await page.$eval(".audio-waveform-toolbar small", (element) => element.textContent || "");
  if (zoomBefore === zoomAfter) throw new Error("Audio waveform zoom did not change.");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector(".audio-play-button")?.getAttribute("aria-label") === "일시정지");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector(".audio-play-button")?.getAttribute("aria-label") === "재생");
  await page.click('.audio-loop-control [role="switch"]');
  const loopEnabled = await page.$eval('.audio-loop-control [role="switch"]', (button) => button.getAttribute("aria-checked"));
  if (loopEnabled !== "true") throw new Error("Audio selection loop toggle did not activate.");

  const voicePresets = await page.$$eval(".audio-voice-presets button", (buttons) => buttons.map((button) => button.textContent?.trim()));
  if (voicePresets.join("|") !== "낮은 톤|높은 톤|어린 목소리|로봇|직접 조절") throw new Error(`Voice-effect presets are incomplete: ${JSON.stringify(voicePresets)}`);
  const durationBeforeEffect = await page.$eval(".audio-timecode small", (element) => element.textContent || "");
  await page.$eval(".audio-voice-presets button:nth-child(2)", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".audio-voice-presets button:nth-child(2)")?.getAttribute("aria-checked") === "true");
  await page.click(".audio-effect-preview-button");
  await waitForAudioSuccess(page, "미리 듣기 준비 완료", 120_000);
  const effectPreview = await page.$eval(".audio-effect-preview audio", async (audio) => {
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await (await fetch(audio.src)).arrayBuffer());
      const samples = decoded.getChannelData(0);
      let upwardCrossings = 0;
      for (let index = 1; index < samples.length; index += 1) {
        if (samples[index - 1] <= 0 && samples[index] > 0) upwardCrossings += 1;
      }
      return { src: audio.src, duration: decoded.duration, frequency: upwardCrossings / decoded.duration };
    } finally {
      await context.close();
    }
  });
  if (!effectPreview.src.startsWith("blob:") || effectPreview.frequency < 620 || effectPreview.frequency > 700) {
    throw new Error(`Pitch preview was not shifted by about four semitones: ${JSON.stringify(effectPreview)}`);
  }
  await page.click(".audio-voice-effect-actions [data-ui-component=primary-button]");
  await waitForAudioSuccess(page, "음성 효과 적용 완료", 120_000);
  const durationAfterEffect = await page.$eval(".audio-timecode small", (element) => element.textContent || "");
  if (durationAfterEffect !== durationBeforeEffect) throw new Error(`Pitch effect changed the document duration: ${durationBeforeEffect} -> ${durationAfterEffect}`);
  await page.$eval(".audio-voice-presets button:nth-child(4)", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".audio-voice-presets button:nth-child(4)")?.getAttribute("aria-checked") === "true");
  await page.click(".audio-effect-preview-button");
  await waitForAudioSuccess(page, "미리 듣기 준비 완료");
  if (!(await page.$eval(".audio-effect-preview audio", (audio) => audio.src.startsWith("blob:")))) throw new Error("Robot voice preview was not created.");

  await clickAudioAction(page, "복사");
  await page.waitForFunction(() => document.querySelector(".audio-clipboard-status[data-has-clip='true']")?.textContent?.includes("오디오 클립보드"));
  await clickAudioAction(page, "구간 음소거");
  await waitForAudioSuccess(page, "음소거 중 완료");
  const undoEnabled = await page.$$eval(".audio-edit-toolbar button", (buttons) => {
    const undo = buttons.find((button) => button.textContent?.includes("실행 취소"));
    return undo instanceof HTMLButtonElement && !undo.disabled;
  });
  if (!undoEnabled) throw new Error("Audio undo history was not created.");
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");
  await waitForAudioSuccess(page, "실행 취소 완료");
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".audio-edit-toolbar button")).some((button) => button.textContent?.includes("다시 실행") && !button.disabled));
  await page.keyboard.down("Control");
  await page.keyboard.down("Shift");
  await page.keyboard.press("z");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Control");
  await waitForAudioSuccess(page, "다시 실행 완료");

  const durationBeforeCut = await page.$eval(".audio-timecode small", (element) => element.textContent || "");
  await clickAudioAction(page, "잘라내기");
  await waitForAudioSuccess(page, "잘라내는 중 완료");
  const durationAfterCut = await page.$eval(".audio-timecode small", (element) => element.textContent || "");
  if (durationBeforeCut === durationAfterCut) throw new Error("Audio cut did not shorten the timeline.");
  await clickAudioAction(page, "커서에 붙여넣기");
  await waitForAudioSuccess(page, "붙여넣는 중 완료");
  await clickAudioAction(page, "구간 삭제");
  await waitForAudioSuccess(page, "삭제 중 완료");

  await page.evaluate(() => {
    window.__audioDownloads = [];
    window.__audioOriginalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function captureAudioDownload() {
      if (this.download) {
        window.__audioDownloads.push({ fileName: this.download, href: this.href });
        return;
      }
      return window.__audioOriginalAnchorClick.call(this);
    };
  });
  await page.evaluate(() => document.querySelector("[data-testid='audio-export-actions'] [data-ui-component='primary-button']")?.click());
  await page.waitForFunction(() => document.querySelector("[data-testid='audio-result']")?.textContent?.includes(".wav"), { timeout: 60_000 });
  await page.evaluate(() => document.querySelector('.audio-export-settings .ui-segmented-control button:nth-child(2)')?.click());
  await page.evaluate(() => document.querySelector("[data-testid='audio-export-actions'] [data-ui-component='primary-button']")?.click());
  await page.waitForFunction(() => document.querySelector("[data-testid='audio-result']")?.textContent?.includes(".mp3"), { timeout: 120_000 });
  const downloads = await page.evaluate(() => {
    const captured = window.__audioDownloads;
    HTMLAnchorElement.prototype.click = window.__audioOriginalAnchorClick;
    return captured;
  });
  if (downloads.length !== 2 || !downloads.some((item) => item.fileName.endsWith(".wav")) || !downloads.some((item) => item.fileName.endsWith(".mp3")) || downloads.some((item) => !item.href.startsWith("blob:"))) {
    throw new Error(`Audio exports are incomplete: ${JSON.stringify(downloads)}`);
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const mobileLayout = await page.$eval(".audio-edit-toolbar", (element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  if (mobileLayout.columns !== 2 || mobileLayout.pageWidth > mobileLayout.viewportWidth + 1) throw new Error(`Audio mobile layout overflows: ${JSON.stringify(mobileLayout)}`);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
}

async function clickAudioAction(page, label) {
  await page.evaluate((text) => {
    const button = Array.from(document.querySelectorAll(".audio-edit-toolbar button")).find((candidate) => candidate.textContent?.includes(text));
    if (!(button instanceof HTMLButtonElement) || button.disabled) throw new Error(`Audio action is unavailable: ${text}`);
    button.click();
  }, label);
}

async function waitForAudioSuccess(page, text, timeout = 60_000) {
  await page.waitForFunction((expected) => document.querySelector(".ui-operation-progress.ui-status-success")?.textContent?.includes(expected), { timeout }, text);
}

async function testVideoStudio(page, videoPaths, largeVideoPath, largePassThroughPaths, largeAudioIncompatibleVideo, targetAudioIncompatibleVideo, videoIncompatibleVideo, dolbyVisionVideo) {
  if (new URL(page.url()).origin !== new URL(baseUrl).origin) {
    await page.goto(`${koBaseUrl}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const videoAdRequests = [];
  const videoZipWorkerRequests = [];
  const videoStreamWorkerRequests = [];
  const captureVideoRequests = (request) => {
    if (request.url().includes("pagead2.googlesyndication.com")) videoAdRequests.push(request.url());
    if (request.url().includes("video-zip.worker-")) videoZipWorkerRequests.push(request.url());
    if (request.url().includes("videoStream.worker-")) videoStreamWorkerRequests.push(request.url());
  };
  page.on("request", captureVideoRequests);
  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  const isolation = await page.evaluate(() => ({
    marker: Boolean(document.querySelector('meta[name="worklazy-video-isolation"]')),
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    googleAnalytics: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
    naverAnalytics: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
    googlePageViewQueued: (window.dataLayer || []).some((item) => Object.prototype.toString.call(item) === "[object Arguments]" && item[0] === "event" && item[1] === "page_view"),
    engine: document.querySelector("[data-testid=video-runtime-status]")?.textContent || "",
    guideEyebrow: document.querySelector("[data-ui-component=tool-guide] .ui-tool-guide-heading > div > p")?.textContent || "",
  }));
  if (!isolation.marker || isolation.ads || !isolation.googleAnalytics || !isolation.naverAnalytics || !isolation.googlePageViewQueued
    || !isolation.engine.includes("멀티스레드") || isolation.engine.includes("광고") || isolation.engine.includes("실행 문서")
    || isolation.guideEyebrow !== "안내" || videoAdRequests.length) {
    throw new Error(`Video isolation or ad exclusion failed: ${JSON.stringify({ isolation, videoAdRequests })}`);
  }
  await page.evaluate(() => {
    const nativeRead = FileReader.prototype.readAsArrayBuffer;
    window.__videoFileReadState = { arrayBufferReads: 0 };
    FileReader.prototype.readAsArrayBuffer = function trackUnexpectedVideoCopy(blob) {
      window.__videoFileReadState.arrayBufferReads += 1;
      return nativeRead.call(this, blob);
    };
  });
  await page.setRequestInterception(true);
  const delayVideoProbe = (request) => {
    if (request.url().includes("video-probe.worker")) setTimeout(() => request.continue(), 2_000);
    else void request.continue();
  };
  page.on("request", delayVideoProbe);
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(videoPaths[0]);
  await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 1);
  await page.waitForFunction(() => document.querySelector(".video-card-footer")?.textContent?.includes("FPS 확인 중"));
  const exportDuringFpsProbe = await page.$eval("[data-testid=video-output-actions] [data-ui-component=primary-button]", (button) => ({ disabled: button.disabled, text: button.textContent || "" }));
  if (exportDuringFpsProbe.disabled) throw new Error(`Supplemental FPS probing still blocks export: ${JSON.stringify(exportDuringFpsProbe)}`);
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.video-boundary-stepper button')).every((button) => button.getAttribute("aria-label")?.includes("1프레임")));
  page.off("request", delayVideoProbe);
  await page.setRequestInterception(false);
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(videoPaths[1]);
  await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 2 && document.querySelectorAll(".video-sync-group").length === 1);
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.video-boundary-stepper button')).every((button) => button.getAttribute("aria-label")?.includes("1프레임")));
  const previewState = await page.evaluate(() => ({
    fallbackCount: document.querySelectorAll(".multi-video-grid .video-preview-fallback").length,
    playableCount: Array.from(document.querySelectorAll(".multi-video-grid video")).filter((video) => video.readyState >= 1).length,
  }));
  if (previewState.fallbackCount || previewState.playableCount !== 2) throw new Error(`Browser video previews were covered after FFmpeg metadata probing: ${JSON.stringify(previewState)}`);
  const addButton = await page.$eval(".video-studio-page [data-ui-part=drop-target] [data-slot=button]", (button) => button.textContent || "");
  if (!addButton.includes("더 추가")) throw new Error(`Video studio does not expose incremental file addition: ${addButton}`);
  const outputLimit = await page.$eval(".video-output-limit", (element) => element.textContent || "");
  if (!outputLimit.includes("1GB 이하") || !outputLimit.includes("1.5GB")) throw new Error(`Video output limit is not explicit: ${outputLimit}`);
  const readState = await page.evaluate(() => window.__videoFileReadState);
  if (readState.arrayBufferReads !== 0) {
    throw new Error(`Video selection copied a source into one contiguous ArrayBuffer: ${JSON.stringify(readState)}`);
  }
  if (videoStreamWorkerRequests.length !== 0) throw new Error(`The direct-copy worker loaded before export: ${JSON.stringify(videoStreamWorkerRequests)}`);
  await page.evaluate(() => {
    const player = document.querySelector(".multi-video-grid video");
    if (!(player instanceof HTMLVideoElement)) throw new Error("Video player is unavailable");
    player.currentTime = Math.min(0.4, player.duration / 2);
  });
  await page.evaluate(() => document.querySelector(".video-trim-lane .trim-play-buttons button:nth-child(1)")?.click());
  const startValue = await page.$eval('.video-trim-lane label:first-of-type input[type="number"]', (input) => Number(input.value));
  if (startValue <= 0) throw new Error("The current player position was not applied as the start time.");
  const initialFineTrim = await page.evaluate(() => {
    const lane = document.querySelector(".video-trim-lane");
    return {
      start: Number(lane?.querySelector('[data-trim-boundary="start"] input[type="number"]')?.value),
      end: Number(lane?.querySelector('[data-trim-boundary="end"] input[type="number"]')?.value),
      steppers: lane?.querySelectorAll(".video-boundary-stepper button").length || 0,
      stepLabel: lane?.querySelector('.video-boundary-stepper button')?.getAttribute("aria-label") || "",
    };
  });
  await page.focus('.video-trim-lane');
  await page.keyboard.down("Alt");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Alt");
  await page.waitForFunction((start) => Number(document.querySelector('.video-trim-lane [data-trim-boundary="start"] input[type="number"]')?.value) > start, {}, initialFineTrim.start);
  await page.keyboard.down("Alt");
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Alt");
  await page.waitForFunction((end) => Number(document.querySelector('.video-trim-lane [data-trim-boundary="end"] input[type="number"]')?.value) < end, {}, initialFineTrim.end);
  const adjustedFineTrim = await page.evaluate(() => ({
    start: Number(document.querySelector('.video-trim-lane [data-trim-boundary="start"] input[type="number"]')?.value),
    end: Number(document.querySelector('.video-trim-lane [data-trim-boundary="end"] input[type="number"]')?.value),
  }));
  const startDelta = adjustedFineTrim.start - initialFineTrim.start;
  const endDelta = initialFineTrim.end - adjustedFineTrim.end;
  if (initialFineTrim.steppers !== 4 || !/1프레임|0\.1/.test(initialFineTrim.stepLabel)
    || startDelta <= 0 || startDelta > 0.11 || endDelta <= 0 || endDelta > 0.11) {
    throw new Error(`Video fine-trim buttons or keyboard shortcuts failed: ${JSON.stringify({ initialFineTrim, adjustedFineTrim })}`);
  }
  await page.focus('.video-trim-lane [data-trim-boundary="start"] input[type="number"]');
  await page.keyboard.down("Alt");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.up("Alt");
  await page.focus('.video-trim-lane [data-trim-boundary="end"] input[type="number"]');
  await page.waitForFunction((start) => Number(document.querySelector('.video-trim-lane [data-trim-boundary="start"] input[type="number"]')?.value) < start, {}, adjustedFineTrim.start);
  const rangeState = await page.$eval(".video-range-control", (element) => ({
    handles: element.querySelectorAll('input[type="range"]').length,
    start: element.querySelector(".video-range-selection")?.style.left || "",
    end: element.querySelector(".video-range-selection")?.style.right || "",
  }));
  if (rangeState.handles !== 2 || !rangeState.start || rangeState.start === "0%" || !rangeState.end) throw new Error(`Combined range track was not updated: ${JSON.stringify(rangeState)}`);
  const passthroughOption = await page.$eval('.video-bitrate-control select', (select) => ({ value: select.value, text: select.selectedOptions[0]?.textContent }));
  if (passthroughOption.value !== "copy" || !passthroughOption.text?.includes("패스스루")) throw new Error(`Pass-through trim was not selected: ${JSON.stringify(passthroughOption)}`);
  const encodingOptions = await page.evaluate(() => ({
    video: Array.from(document.querySelectorAll('.video-bitrate-control option')).map((option) => option.textContent),
    audioModes: Array.from(document.querySelectorAll('.video-audio-settings .ui-segmented-control button')).map((button) => button.textContent),
  }));
  if (!encodingOptions.video.some((label) => label?.includes("직접입력")) || encodingOptions.audioModes.join("|") !== "원본 음성 복사|음성 제거|호환 형식 변환") {
    throw new Error(`Video/audio encoding controls are incomplete: ${JSON.stringify(encodingOptions)}`);
  }
  await page.evaluate(() => {
    const output = document.querySelector(".video-output-format-grid select");
    if (!(output instanceof HTMLSelectElement)) throw new Error("Output format selector is unavailable");
    output.value = "webm";
    output.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const webmWarning = await page.$eval(".webm-passthrough-warning", (element) => element.textContent || "");
  if (!webmWarning.includes("일반적인 MP4") || !webmWarning.includes("H.264") || !webmWarning.includes("AAC") || !webmWarning.includes("Opus")) {
    throw new Error(`WebM pass-through warning is incomplete: ${webmWarning}`);
  }
  await page.evaluate(() => {
    const output = document.querySelector(".video-output-format-grid select");
    output.value = "mp4";
    output.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => {
    const select = document.querySelector('.video-bitrate-control select');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Video bitrate selector is unavailable");
    select.value = "custom";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector('input[aria-label="영상 비트레이트 직접입력"]');
  await page.$eval('input[aria-label="영상 비트레이트 직접입력"]', (input) => { input.value = "12.5"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  const customVideoBitrate = await page.$eval('input[aria-label="영상 비트레이트 직접입력"]', (input) => input.value);
  if (customVideoBitrate !== "12.5") throw new Error(`Custom video bitrate was not accepted: ${customVideoBitrate}`);
  await page.evaluate(() => {
    const select = document.querySelector('.video-bitrate-control select');
    select.value = "copy";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Video error"));
  const firstResultState = await page.$$eval(".video-result-item", (elements) => elements.map((element) => ({
    text: element.textContent || "",
    href: element.querySelector("a")?.getAttribute("href") || "",
    download: element.querySelector("a")?.getAttribute("download") || "",
  })));
  if (firstResultState.length !== 2 || firstResultState.some((result) => !result.href.startsWith("blob:") || !result.download)) {
    throw new Error(`Video outputs were not exposed as individual downloads: ${JSON.stringify(firstResultState)}`);
  }
  if (videoStreamWorkerRequests.length < 4) throw new Error(`The direct-copy worker was not loaded on demand for preflight and output: ${JSON.stringify(videoStreamWorkerRequests)}`);
  if (await page.$(".audio-handoff-button")) throw new Error("Audio studio handoff was shown for a video result.");
  const progressFontSizes = await page.evaluate(() => ({
    message: Number.parseFloat(getComputedStyle(document.querySelector(".ui-operation-current-message")).fontSize),
    log: Number.parseFloat(getComputedStyle(document.querySelector(".ui-operation-log li")).fontSize),
  }));
  if (progressFontSizes.message < 10 || progressFontSizes.log < 9) {
    throw new Error(`Progress and error guidance fonts are still too small: ${JSON.stringify(progressFontSizes)}`);
  }

  const streamRequestsBeforeEncoding = videoStreamWorkerRequests.length;
  await page.evaluate(() => {
    const selects = document.querySelectorAll("[data-testid=video-encoding-settings] select");
    const audioRemove = document.querySelector(".video-audio-settings .ui-segmented-control button:nth-child(2)");
    const flip = document.querySelector("[data-testid=video-encoding-settings] button[role=switch]");
    if (!(selects[0] instanceof HTMLSelectElement) || !(selects[1] instanceof HTMLSelectElement) || !(selects[3] instanceof HTMLSelectElement)
      || !(selects[4] instanceof HTMLSelectElement) || !(audioRemove instanceof HTMLButtonElement)
      || !(flip instanceof HTMLButtonElement)) throw new Error("Streaming encoding controls are unavailable");
    selects[0].value = "2M";
    selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    selects[1].value = "h264";
    selects[1].dispatchEvent(new Event("change", { bubbles: true }));
    selects[3].value = "1:1";
    selects[3].dispatchEvent(new Event("change", { bubbles: true }));
    selects[4].value = "90";
    selects[4].dispatchEvent(new Event("change", { bubbles: true }));
    if (flip.getAttribute("aria-checked") !== "true") flip.click();
    audioRemove.click();
  });
  await page.evaluate(() => {
    window.__videoProgressHistory = [];
    window.__videoProgressObserver?.disconnect();
    window.__videoProgressObserver = new MutationObserver(() => {
      const value = Number(document.querySelector('.ui-operation-progress [role="progressbar"]')?.getAttribute("aria-valuenow"));
      if (Number.isFinite(value) && window.__videoProgressHistory.at(-1) !== value) window.__videoProgressHistory.push(value);
    });
    window.__videoProgressObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-valuenow"] });
  });
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Streaming video encoding error"));
  const encodedVideoState = await page.evaluate(async () => {
    const anchors = Array.from(document.querySelectorAll(".video-result-item a"));
    const dimensions = [];
    for (const anchor of anchors) {
      const video = document.createElement("video");
      video.muted = true;
      video.src = anchor.href;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error("Encoded result metadata could not be loaded"));
      });
      dimensions.push([video.videoWidth, video.videoHeight]);
      video.removeAttribute("src");
      video.load();
    }
    window.__videoProgressObserver?.disconnect();
    const progress = Array.from(document.querySelectorAll(".ui-operation-log li"), (item) => Number((item.textContent || "").match(/(\d+)%/)?.[1])).filter(Number.isFinite);
    const history = window.__videoProgressHistory || [];
    return {
      count: anchors.length,
      dimensions,
      finalProgress: document.querySelector('.ui-operation-progress [role="progressbar"]')?.getAttribute("aria-valuenow"),
      progressRows: progress,
      progressHistory: history,
      progressMonotonic: history.length > 0 && history.every((value, index) => index === 0 || value >= history[index - 1]),
    };
  });
  if (encodedVideoState.count !== 2 || JSON.stringify(encodedVideoState.dimensions) !== JSON.stringify([[180, 180], [240, 240]])
    || encodedVideoState.finalProgress !== "100" || !encodedVideoState.progressMonotonic
    || encodedVideoState.progressRows.length === 0 || encodedVideoState.progressRows.length > 14
    || encodedVideoState.progressRows.some((value) => value < 0 || value > 100)
    || videoStreamWorkerRequests.length < streamRequestsBeforeEncoding + 4) {
    throw new Error(`Target-bitrate streaming encode did not preserve transform/output contracts: ${JSON.stringify({ encodedVideoState, videoStreamWorkerRequests })}`);
  }
  await page.evaluate(() => {
    const bitrate = document.querySelector(".video-bitrate-control select");
    const audioCopy = document.querySelector(".video-audio-settings .ui-segmented-control button:nth-child(1)");
    if (!(bitrate instanceof HTMLSelectElement) || !(audioCopy instanceof HTMLButtonElement)) throw new Error("Video reset controls are unavailable");
    bitrate.value = "copy";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    audioCopy.click();
  });

  await page.evaluate(() => {
    const output = document.querySelector(".video-output-format-grid select");
    if (!(output instanceof HTMLSelectElement)) throw new Error("Output format selector is unavailable");
    output.value = "mp3";
    output.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector("[data-testid=video-audio-encoding-fields]");
  await page.evaluate(() => {
    const selects = document.querySelectorAll("[data-testid=video-audio-encoding-fields] select");
    const bitrate = selects[0];
    const sampleRate = selects[1];
    if (!(bitrate instanceof HTMLSelectElement) || !(sampleRate instanceof HTMLSelectElement)) throw new Error("Audio encoding selects are unavailable");
    bitrate.value = "custom";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    sampleRate.value = "custom";
    sampleRate.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector('input[aria-label="오디오 비트레이트 직접입력"]');
  await page.$eval('input[aria-label="오디오 비트레이트 직접입력"]', (input) => { input.value = "160"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.$eval('input[aria-label="오디오 샘플레이트 직접입력"]', (input) => { input.value = "44100"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  const customAudioState = await page.evaluate(() => ({
    bitrate: document.querySelector('input[aria-label="오디오 비트레이트 직접입력"]')?.value,
    sampleRate: document.querySelector('input[aria-label="오디오 샘플레이트 직접입력"]')?.value,
    disabled: document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.disabled,
  }));
  if (customAudioState.bitrate !== "160" || customAudioState.sampleRate !== "44100" || customAudioState.disabled) throw new Error(`Custom audio settings were not accepted: ${JSON.stringify(customAudioState)}`);
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Audio extraction error"));
  const rawVideoMessages = await page.$$eval(".video-studio-page *", (elements) => elements
    .filter((element) => element.children.length === 0 && element.textContent?.includes("__worklazy_i18n__:"))
    .map((element) => element.textContent).slice(0, 5));
  if (rawVideoMessages.length) throw new Error(`A raw i18n worker token was exposed in video progress UI: ${JSON.stringify(rawVideoMessages)}`);
  const internalVideoMessages = await page.$$eval(".video-studio-page *", (elements) => elements
    .filter((element) => element.children.length === 0 && /\b(?:OPFS|SyncAccessHandle|zip\.js|mp4box(?:\.js)?|mp4-muxer|WebCodecs?|VideoEncoder|VideoDecoder|AudioEncoder|AudioDecoder|OffscreenCanvas|remux|worker)\b/i.test(element.textContent || ""))
    .map((element) => element.textContent).slice(0, 5));
  if (internalVideoMessages.length) throw new Error(`Internal video storage names were exposed in the UI: ${JSON.stringify(internalVideoMessages)}`);
  const audioResults = await page.$$eval(".video-result-item", (elements) => elements.map((element) => ({
    fileName: element.querySelector("a")?.getAttribute("download") || "",
    handoff: element.querySelector(".audio-handoff-button")?.textContent || "",
  })));
  if (audioResults.length !== 2 || audioResults.some((result) => !result.fileName.endsWith(".mp3") || !result.handoff.includes("오디오 스튜디오에서 계속 편집"))) {
    throw new Error(`Audio results or handoff buttons are incomplete: ${JSON.stringify(audioResults)}`);
  }

  const existingPages = new Set(await page.browser().pages());
  await page.click(".audio-handoff-button");
  const audioPage = await waitForNewPage(page.browser(), existingPages);
  audioPage.setDefaultTimeout(120_000);
  await audioPage.waitForSelector(".audio-studio-page");
  await audioPage.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-success, .ui-operation-progress.ui-status-error"));
  if (await audioPage.$(".ui-operation-progress.ui-status-error")) throw new Error(await audioPage.$eval(".ui-operation-current-message", (element) => element.textContent || "Audio handoff error"));
  const handoffState = await audioPage.evaluate(() => ({
    summary: document.querySelector(".audio-file-summary")?.textContent || "",
    search: location.search,
  }));
  if (!handoffState.summary.includes(audioResults[0].fileName) || handoffState.search.includes("handoff=")) throw new Error(`Audio handoff did not load and consume the result: ${JSON.stringify(handoffState)}`);
  await audioPage.close();
  await page.bringToFront();
  await page.evaluate(() => {
    const output = document.querySelector(".video-output-format-grid select");
    if (!(output instanceof HTMLSelectElement)) throw new Error("Output format selector is unavailable");
    output.value = "mp4";
    output.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector(".video-audio-settings");
  await page.evaluate(() => {
    const bitrate = document.querySelector('.video-bitrate-control select');
    const reencode = document.querySelector('.video-audio-settings .ui-segmented-control button:nth-child(3)');
    if (!(bitrate instanceof HTMLSelectElement) || !(reencode instanceof HTMLButtonElement)) throw new Error("Video audio re-encoding controls are unavailable");
    bitrate.value = "copy";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    reencode.click();
  });
  await page.waitForSelector(".video-audio-settings [data-testid=video-audio-encoding-fields]");
  await page.evaluate(() => {
    const select = document.querySelectorAll(".video-group-select select")[1];
    if (!(select instanceof HTMLSelectElement)) throw new Error("Second video group selector is unavailable");
    select.value = "2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll(".video-sync-group").length === 2);
  await page.evaluate(() => document.querySelectorAll('.video-group-output-mode .ui-segmented-control button:nth-child(2)').forEach((button) => button.click()));
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Video concat error"));
  const groupedResults = await page.$$eval(".video-result-item", (elements) => elements.map((element) => element.textContent || ""));
  if (groupedResults.length !== 2) throw new Error(`Grouped concat did not expose two individual results: ${JSON.stringify(groupedResults)}`);
  const resultStorageState = await inspectVideoResultStorage(page);
  if (resultStorageState.mode !== "opfs" || resultStorageState.resultFiles.length !== 2 || resultStorageState.resultFiles.some((file) => file.size <= 0)) {
    throw new Error(`Video outputs were not retained as browser temporary files: ${JSON.stringify(resultStorageState)}`);
  }
  const resultActions = await page.$eval(".video-result-actions", (element) => element.textContent || "");
  if (!resultActions.includes("전체 개별 다운로드") || !resultActions.includes("ZIP으로 묶기")) throw new Error(`Video result actions are incomplete: ${resultActions}`);
  const downloadGuidance = await page.$eval(".video-download-guidance", (element) => element.textContent || "");
  if (!downloadGuidance.includes("결과를 한 개씩 읽어 임시 파일로") || downloadGuidance.includes("원본 결과와 ZIP을 함께 메모리에")) {
    throw new Error(`Video ZIP memory guidance is stale: ${downloadGuidance}`);
  }
  if (videoZipWorkerRequests.length !== 0) {
    throw new Error(`Video ZIP worker loaded before ZIP creation: ${JSON.stringify(videoZipWorkerRequests)}`);
  }
  await page.evaluate(() => Array.from(document.querySelectorAll(".video-result-actions button")).find((button) => button.textContent?.includes("ZIP으로 묶기"))?.click());
  await page.waitForFunction(() => document.querySelector("[data-testid=video-result-status]")?.textContent?.includes("worklazy-비디오-결과-2개.zip"), { timeout: 60_000 });
  page.off("request", captureVideoRequests);
  if (videoZipWorkerRequests.length !== 1) {
    throw new Error(`Video ZIP worker request count is not one: ${JSON.stringify(videoZipWorkerRequests)}`);
  }
  const zipStorageState = await inspectVideoResultStorage(page);
  const zipFile = zipStorageState.resultFiles.find((file) => file.name.endsWith(".zip"));
  if (!zipFile?.zip64Eocd || !zipFile.zip64Locator || !zipFile.classicEocd) {
    throw new Error(`The browser ZIP result is not forced ZIP64: ${JSON.stringify(zipStorageState)}`);
  }

  await (await page.$(".video-studio-page input[type=file]")).uploadFile(...videoPaths.slice(2));
  await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 7);
  const groupOptionCount = await page.$eval(".video-group-select select", (select) => select.options.length);
  if (groupOptionCount !== 10) throw new Error(`Video group limit is not 10: ${groupOptionCount}`);
  const rangeGroupFiles = await page.$$eval(".video-card-footer strong", (elements) => elements.map((element) => (element.textContent || "").replace(/^\d+\.\s*/, "")));
  const moveVideoByName = async (fileName, group) => {
    await page.evaluate(({ fileName, group }) => {
      const article = Array.from(document.querySelectorAll(".multi-video-grid article")).find((candidate) => candidate.querySelector(".video-card-footer strong")?.textContent?.endsWith(fileName));
      const select = article?.querySelector(".video-group-select select");
      if (!(select instanceof HTMLSelectElement)) throw new Error(`Group selector for ${fileName} is unavailable`);
      select.value = String(group);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, { fileName, group });
    await page.waitForFunction(({ fileName, group }) => {
      const article = Array.from(document.querySelectorAll(".multi-video-grid article")).find((candidate) => candidate.querySelector(".video-card-footer strong")?.textContent?.endsWith(fileName));
      return article?.querySelector(".video-group-select select")?.value === String(group);
    }, {}, { fileName, group });
  };
  await moveVideoByName(rangeGroupFiles[6], 10);
  for (let index = 0; index < 6; index += 1) await moveVideoByName(rangeGroupFiles[index], Math.floor(index / 2) + 1);
  await page.waitForFunction(() => {
    const sizes = Array.from(document.querySelectorAll(".video-sync-group")).map((section) => ({
      group: section.querySelector(".video-group-title strong")?.textContent,
      count: section.querySelectorAll(".multi-video-grid article").length,
    }));
    return [1, 2, 3].every((group) => sizes.some((entry) => entry.group === `그룹 ${group}` && entry.count === 2));
  });

  await page.waitForFunction(() => Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1")?.querySelectorAll("video")[1]?.readyState >= 1);
  await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1");
    const player = group?.querySelectorAll("video")[1];
    if (!(player instanceof HTMLVideoElement)) throw new Error("The second Group 1 player is unavailable");
    player.currentTime = player.duration * 0.2;
    player.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
  });
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1")?.querySelectorAll(".multi-video-grid article")[1]?.getAttribute("data-active") === "true");
  await page.waitForFunction(() => {
    const group = Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1");
    const player = group?.querySelectorAll("video")[1];
    const playhead = group?.querySelector(".video-group-master-controls input");
    const label = group?.querySelector(".video-group-master-controls b");
    return player instanceof HTMLVideoElement && playhead instanceof HTMLInputElement
      && player.currentTime > 0.05 && Math.abs(Number(playhead.value) - player.currentTime) < 0.05
      && label?.textContent !== "00:00:00.00";
  });
  await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1");
    const button = Array.from(group?.querySelectorAll(".video-group-actions button") || []).find((candidate) => candidate.textContent?.includes("분할 전체화면"));
    if (!(button instanceof HTMLButtonElement)) throw new Error("Group 1 split fullscreen button is unavailable");
    button.click();
  });
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.evaluate(() => {
    const group = document.fullscreenElement;
    const player = group?.querySelectorAll("video")[1];
    const buttons = group?.querySelectorAll(".video-fullscreen-trim-actions button");
    if (!(player instanceof HTMLVideoElement) || !buttons?.length) throw new Error("Fullscreen range controls are unavailable");
    player.currentTime = player.duration * 0.2;
    buttons[0].click();
    player.currentTime = player.duration * 0.7;
    buttons[1].click();
  });
  await page.waitForFunction(() => {
    const lanes = document.fullscreenElement?.querySelectorAll(".video-trim-lane");
    const start = Number(lanes?.[1]?.querySelector('[data-trim-boundary="start"] input')?.value);
    const end = Number(lanes?.[1]?.querySelector('[data-trim-boundary="end"] input')?.value);
    return start > 0 && end > start;
  });
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);

  await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1");
    const button = group?.querySelector(".video-copy-group-ranges");
    if (!(button instanceof HTMLButtonElement)) throw new Error("Cross-group range button is unavailable");
    button.click();
  });
  await page.waitForSelector(".video-group-range-copy");
  await page.evaluate(() => {
    const panel = document.querySelector(".video-group-range-copy");
    const group10 = Array.from(panel?.querySelectorAll(".video-group-range-targets label") || []).find((label) => label.textContent?.trim() === "그룹 10");
    const checkbox = group10?.querySelector("input");
    if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) throw new Error("Group 10 range target is unavailable");
    checkbox.click();
    const apply = panel?.querySelector("[data-testid=video-apply-group-ranges]");
    if (!(apply instanceof HTMLButtonElement)) throw new Error("Apply ranges button is unavailable");
    const style = getComputedStyle(apply);
    if (apply.disabled || apply.dataset.slot !== "button" || style.backgroundColor === "rgba(0, 0, 0, 0)" || apply.getBoundingClientRect().height < 34 || Number(style.opacity) < 0.9) {
      throw new Error(`Apply ranges button does not look active: ${JSON.stringify({ disabled: apply.disabled, slot: apply.dataset.slot, background: style.backgroundColor, height: apply.getBoundingClientRect().height, opacity: style.opacity })}`);
    }
    apply.click();
  });
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".video-range-notice")).some((element) => element.textContent?.includes("2개 그룹의 4개 영상에 적용했습니다")));
  const copiedRangeState = await page.evaluate(() => {
    const ranges = new Map(Array.from(document.querySelectorAll(".video-sync-group"), (section) => [
      section.querySelector(".video-group-title strong")?.textContent,
      Array.from(section.querySelectorAll(".video-trim-lane"), (lane) => ({
        start: Number(lane.querySelector('[data-trim-boundary="start"] input')?.value),
        end: Number(lane.querySelector('[data-trim-boundary="end"] input')?.value),
      })),
    ]));
    return { source: ranges.get("그룹 1"), second: ranges.get("그룹 2"), third: ranges.get("그룹 3") };
  });
  if (!copiedRangeState.source || !copiedRangeState.second || !copiedRangeState.third
    || copiedRangeState.source.length !== 2 || copiedRangeState.second.length !== 2 || copiedRangeState.third.length !== 2
    || JSON.stringify(copiedRangeState.second) !== JSON.stringify(copiedRangeState.source)
    || JSON.stringify(copiedRangeState.third) !== JSON.stringify(copiedRangeState.source)) {
    throw new Error(`Cross-group range copy did not preserve card positions: ${JSON.stringify(copiedRangeState)}`);
  }
  await page.evaluate(() => {
    const select = document.querySelectorAll(".video-group-select select")[6];
    if (!(select instanceof HTMLSelectElement)) throw new Error("Seventh video group selector is unavailable");
    select.value = "10";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".video-group-title strong")).some((element) => element.textContent === "그룹 10"));

  await (await page.$(".video-studio-page input[type=file]")).uploadFile(largeVideoPath);
  await page.waitForFunction(() => document.querySelector("[data-testid=video-result-status]")?.textContent?.includes("메모리에 통째로 복사하지 않고 연결했습니다"));
  const largeReadState = await page.evaluate(() => window.__videoFileReadState);
  if (largeReadState.arrayBufferReads !== 0) throw new Error(`A 3824MB source triggered a contiguous ArrayBuffer read: ${JSON.stringify(largeReadState)}`);

  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await installVideoTransferProbe(page);
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(largePassThroughPaths[0]);
  await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 1);
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(largePassThroughPaths[1]);
  await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 2);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.evaluate(() => {
    window.__videoActiveStageEvidence = { spinner: false, nonFinalRow: false };
    window.__videoActiveStageObserver?.disconnect();
    window.__videoActiveStageObserver = new MutationObserver(() => {
      const log = document.querySelector(".ui-operation-log");
      const current = log?.querySelector("li.ui-current");
      if (current?.querySelector("svg.animate-spin")) {
        window.__videoActiveStageEvidence.spinner = true;
        if (current !== log.lastElementChild) window.__videoActiveStageEvidence.nonFinalRow = true;
      }
    });
    window.__videoActiveStageObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Large pass-through error"));
  const largePassThroughState = await page.evaluate(() => {
    window.__videoActiveStageObserver?.disconnect();
    return {
      outputs: document.querySelectorAll(".video-result-item").length,
      transfer: window.__videoWorkerTransferState,
      logs: Array.from(document.querySelectorAll(".ui-operation-log li")).map((item) => item.textContent || ""),
      activeStage: window.__videoActiveStageEvidence,
      progressSlot: document.querySelector('.ui-operation-progress [role="progressbar"]')?.getAttribute("data-slot"),
    };
  });
  if (largePassThroughState.outputs !== 2
    || largePassThroughState.transfer.startContainsFile
    || largePassThroughState.transfer.inputFileSizes.length !== 4
    || !largePassThroughState.activeStage?.spinner
    || !largePassThroughState.activeStage?.nonFinalRow
    || largePassThroughState.progressSlot !== "progress"
    || largePassThroughState.logs.length > 14
    || largePassThroughState.logs.some((message) => !/(?:^|\D)\d+%(?:\D|$)/.test(message))
    || !largePassThroughState.logs.some((message) => message.includes("원본 화질"))
    || !largePassThroughState.logs.some((message) => message.includes("호환됩니다"))) {
    throw new Error(`Large pass-through did not use incremental worker input: ${JSON.stringify(largePassThroughState)}`);
  }
  console.log(`  video: 512MiB×2 total 1GiB sparse integration smoke, ${largePassThroughState.logs.length} bounded progress rows with percentages, active non-final stage spinner observed`);

  await testVideoCopyGuidance(page, largeAudioIncompatibleVideo, targetAudioIncompatibleVideo, videoIncompatibleVideo);
  await testDolbyVisionGuidance(page, dolbyVisionVideo);

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(videoPaths[0]);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const mobilePassthroughDefaults = await page.evaluate(() => {
    const selects = document.querySelectorAll("[data-testid=video-encoding-settings] select");
    return {
      bitrate: document.querySelector(".video-bitrate-control select")?.value,
      resolution: selects[2]?.value,
      aspect: selects[3]?.value,
      rotation: selects[4]?.value,
      actionDisabled: document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.disabled,
      notice: Array.from(document.querySelectorAll(".video-studio-page [data-slot=notice]"), (element) => element.textContent || "").find((text) => text.includes("모바일")) || "",
    };
  });
  if (mobilePassthroughDefaults.bitrate !== "copy" || mobilePassthroughDefaults.resolution !== "source" || mobilePassthroughDefaults.aspect !== "source"
    || mobilePassthroughDefaults.rotation !== "0" || mobilePassthroughDefaults.actionDisabled
    || !mobilePassthroughDefaults.notice.includes("패스스루") || !mobilePassthroughDefaults.notice.includes("원본 해상도") || !mobilePassthroughDefaults.notice.includes("회전 없음")
    || !mobilePassthroughDefaults.notice.includes("GIF") || mobilePassthroughDefaults.notice.includes("1080p")) {
    throw new Error(`Mobile pass-through defaults are invalid: ${JSON.stringify(mobilePassthroughDefaults)}`);
  }
  await page.evaluate(() => {
    const selects = document.querySelectorAll("[data-testid=video-encoding-settings] select");
    const bitrate = document.querySelector(".video-bitrate-control select");
    if (!(bitrate instanceof HTMLSelectElement) || !(selects[2] instanceof HTMLSelectElement) || !(selects[3] instanceof HTMLSelectElement) || !(selects[4] instanceof HTMLSelectElement)) throw new Error("Mobile encoding controls are unavailable");
    bitrate.value = "0";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    selects[2].value = "1080";
    selects[2].dispatchEvent(new Event("change", { bubbles: true }));
    selects[3].value = "9:16";
    selects[3].dispatchEvent(new Event("change", { bubbles: true }));
    selects[4].value = "90";
    selects[4].dispatchEvent(new Event("change", { bubbles: true }));
    bitrate.value = "copy";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const selects = document.querySelectorAll("[data-testid=video-encoding-settings] select");
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return selects[2]?.value === "source" && selects[3]?.value === "source" && selects[4]?.value === "0" && button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
}

async function testVideoCopyGuidance(page, largeAudioIncompatibleVideo, targetAudioIncompatibleVideo, videoIncompatibleVideo) {
  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(largeAudioIncompatibleVideo);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".video-audio-mode-suggestion[data-removal-only=true]", { timeout: 60_000 });
  const suggestion = await page.$eval(".video-audio-mode-suggestion[data-removal-only=true]", (element) => element.textContent || "");
  if (!suggestion.includes("음향 형식") || !suggestion.includes("음향 제외") || suggestion.includes("변환")) {
    throw new Error(`Audio-only copy guidance is incorrect: ${suggestion}`);
  }
  await page.click(".video-audio-mode-suggestion[data-removal-only=true] [data-testid=video-audio-remove-suggestion]");
  await page.waitForFunction(() => document.querySelector("[data-testid=video-result-status]")?.textContent?.includes("음향 제외를 적용했습니다"));
  page.once("dialog", (dialog) => void dialog.accept());
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) {
    throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Large audio-removal copy error"));
  }
  const audioRemovalResult = await page.evaluate(() => ({
    outputs: document.querySelectorAll(".video-result-item").length,
    suggestion: Boolean(document.querySelector(".video-audio-mode-suggestion[data-removal-only=true]")),
    log: Array.from(document.querySelectorAll(".ui-operation-log li"), (item) => item.textContent || ""),
  }));
  if (audioRemovalResult.outputs !== 1 || audioRemovalResult.suggestion
    || !audioRemovalResult.log.some((message) => message.includes("원본 화질"))) {
    throw new Error(`A 2GB+ audio-removal job did not use direct copy: ${JSON.stringify(audioRemovalResult)}`);
  }

  for (const mode of ["encode", "remove"]) {
    await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
    await page.waitForSelector(".video-studio-page input[type=file]");
    await (await page.$(".video-studio-page input[type=file]")).uploadFile(targetAudioIncompatibleVideo);
    await page.waitForFunction(() => {
      const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    await page.select(".video-bitrate-control select", "2M");
    await page.click("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    await page.waitForSelector(".video-audio-mode-suggestion", { timeout: 60_000 });
    const targetSuggestion = await page.$eval(".video-audio-mode-suggestion", (element) => ({
      text: element.textContent || "",
      primary: element.querySelector("[data-testid=video-audio-encode-suggestion]")?.textContent || "",
      secondary: element.querySelector("[data-testid=video-audio-remove-suggestion]")?.textContent || "",
    }));
    if (!targetSuggestion.text.includes("음향 형식") || !targetSuggestion.primary.includes("음향 변환") || !targetSuggestion.secondary.includes("음향 제외")) {
      throw new Error(`Target E-AC-3 CTA is incomplete: ${JSON.stringify(targetSuggestion)}`);
    }
    await page.click(mode === "encode" ? "[data-testid=video-audio-encode-suggestion]" : "[data-testid=video-audio-remove-suggestion]");
    await page.waitForFunction((expected) => document.querySelector("[data-testid=video-result-status]")?.textContent?.includes(expected), {}, mode === "encode" ? "음향 변환을 적용했습니다" : "음향 제외를 적용했습니다");
    await page.click("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    await page.waitForSelector(".ui-operation-progress.ui-status-running");
    await waitForTerminalStatus(page);
    if (await page.$(".ui-operation-progress.ui-status-error")) {
      throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Target E-AC-3 processing error"));
    }
    if (await page.$$eval(".video-result-item", (elements) => elements.length) !== 1) {
      throw new Error(`Target E-AC-3 ${mode} mode did not create one result`);
    }
  }

  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(videoIncompatibleVideo);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.select(".video-bitrate-control select", "custom");
  await page.waitForSelector('input[aria-label="영상 비트레이트 직접입력"]');
  await page.$eval('input[aria-label="영상 비트레이트 직접입력"]', (input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "200");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await page.waitForSelector(".ui-operation-progress.ui-status-error", { timeout: 60_000 });
  const videoGuidance = await page.$eval(".ui-operation-current-message", (element) => element.textContent || "");
  if (!videoGuidance.includes("원본 화면 형식") || !videoGuidance.includes("1.5GB") || await page.$(".video-audio-mode-suggestion[data-removal-only=true]")) {
    throw new Error(`Video-codec copy guidance was not kept separate: ${videoGuidance}`);
  }
  console.log("  video: 2GB+ E-AC-3 remove-audio route and target-encode dvhe capacity guidance verified");
}

async function testDolbyVisionGuidance(page, dolbyVisionVideo) {
  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(dolbyVisionVideo);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.click("[data-testid=video-output-actions] [data-ui-component=primary-button]");
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) {
    throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Dolby Vision copy isolation error"));
  }
  const copyIsolation = await page.evaluate(() => ({
    outputs: document.querySelectorAll(".video-result-item").length,
    suggestion: Boolean(document.querySelector(".video-audio-mode-suggestion")),
    guidance: Array.from(document.querySelectorAll(".video-route-guidance"), (element) => element.textContent || "").join(" "),
  }));
  if (copyIsolation.outputs !== 1 || copyIsolation.suggestion || !copyIsolation.guidance.includes("원본 화면 형식")) {
    throw new Error(`Dolby Vision stream-copy isolation failed: ${JSON.stringify(copyIsolation)}`);
  }

  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(dolbyVisionVideo);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.evaluate(() => {
    const bitrate = document.querySelector(".video-bitrate-control select");
    const codec = document.querySelectorAll("[data-testid=video-encoding-settings] select")[1];
    const audioCopy = document.querySelector(".video-audio-settings .ui-segmented-control button:nth-child(1)");
    if (!(bitrate instanceof HTMLSelectElement) || !(codec instanceof HTMLSelectElement) || !(audioCopy instanceof HTMLButtonElement)) {
      throw new Error("Dolby Vision target controls are unavailable");
    }
    bitrate.value = "2M";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    codec.value = "h264";
    codec.dispatchEvent(new Event("change", { bubbles: true }));
    audioCopy.click();
  });
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  const firstOutcome = await Promise.race([
    page.waitForSelector(".video-audio-mode-suggestion", { timeout: 60_000 }).then(() => "suggestion"),
    waitForTerminalStatus(page).then(() => "terminal"),
  ]);
  const suggestionAvailable = await page.$(".video-audio-mode-suggestion");
  if (firstOutcome === "terminal" && !suggestionAvailable) {
    await waitForTerminalStatus(page);
    if (await page.$(".ui-operation-progress.ui-status-error")) {
      throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Dolby Vision fallback error"));
    }
    const notice = await page.$$eval(".video-route-guidance", (elements) => elements.map((element) => element.textContent || "").join(" "));
    const fallbackOutputs = await page.$$eval(".video-result-item", (elements) => elements.length);
    if (!notice.includes("HDR10") || !notice.includes("돌비비전 효과") || fallbackOutputs !== 1) {
      throw new Error(`Dolby Vision fallback guidance is incomplete: ${notice}`);
    }
    console.log("  video: Dolby Vision base-layer streaming smoke skipped because this Chrome host exposed no compatible route; deterministic capability units and fallback result guidance passed");
    return;
  }

  await page.waitForSelector(".video-audio-mode-suggestion", { timeout: 60_000 });
  const suggestion = await page.$eval(".video-audio-mode-suggestion", (element) => ({
    text: element.textContent || "",
    primary: element.querySelector("[data-testid=video-audio-encode-suggestion]")?.textContent || "",
    secondary: element.querySelector("[data-testid=video-audio-remove-suggestion]")?.textContent || "",
  }));
  if (!suggestion.text.includes("음향 형식") || !suggestion.primary.includes("음향 변환") || !suggestion.secondary.includes("음향 제외")) {
    throw new Error(`Dolby Vision E-AC-3 target CTA is incomplete: ${JSON.stringify(suggestion)}`);
  }
  await page.click("[data-testid=video-audio-encode-suggestion]");
  await page.waitForFunction(() => document.querySelector("[data-testid=video-result-status]")?.textContent?.includes("음향 변환을 적용했습니다"));
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Dolby Vision encode error"));
  const encoded = await page.evaluate(() => ({
    outputs: document.querySelectorAll(".video-result-item").length,
    guidance: Array.from(document.querySelectorAll(".video-route-result-guidance"), (element) => element.textContent || "").join(" "),
  }));
  if (encoded.outputs !== 1 || !encoded.guidance.includes("HDR10") || !encoded.guidance.includes("돌비비전 효과")) {
    throw new Error(`Dolby Vision base-layer result guidance is incomplete: ${JSON.stringify(encoded)}`);
  }

  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(dolbyVisionVideo);
  await page.waitForFunction(() => {
    const button = document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.evaluate(() => {
    const bitrate = document.querySelector(".video-bitrate-control select");
    const audioRemove = document.querySelector(".video-audio-settings .ui-segmented-control button:nth-child(2)");
    if (!(bitrate instanceof HTMLSelectElement) || !(audioRemove instanceof HTMLButtonElement)) throw new Error("Dolby Vision remove controls are unavailable");
    bitrate.value = "2M";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    audioRemove.click();
  });
  await page.evaluate(() => document.querySelector("[data-testid=video-output-actions] [data-ui-component=primary-button]")?.click());
  await waitForTerminalStatus(page);
  if (await page.$(".ui-operation-progress.ui-status-error")) throw new Error(await page.$eval(".ui-operation-current-message", (element) => element.textContent || "Dolby Vision remove error"));
  console.log("  video: Dolby Vision base-layer target H.264 encode with E-AC-3 conversion CTA and remove mode verified");
}

async function installVideoTransferProbe(page) {
  await page.evaluate(() => {
    const nativePostMessage = Worker.prototype.postMessage;
    window.__videoWorkerTransferState = { startContainsFile: false, inputFileSizes: [] };
    const containsFile = (value, seen = new WeakSet()) => {
      if (value instanceof File) return true;
      if (!value || typeof value !== "object" || seen.has(value)) return false;
      seen.add(value);
      return Object.values(value).some((child) => containsFile(child, seen));
    };
    Worker.prototype.postMessage = function trackVideoWorkerTransfer(message) {
      if (message?.type === "start") window.__videoWorkerTransferState.startContainsFile ||= containsFile(message.request);
      if (message?.type === "input-file" && message.file instanceof File) window.__videoWorkerTransferState.inputFileSizes.push(message.file.size);
      return Reflect.apply(nativePostMessage, this, arguments);
    };
  });
}

async function inspectVideoResultStorage(page) {
  return page.evaluate(async () => {
    if (!navigator.storage?.getDirectory) return { mode: "memory", resultFiles: [] };
    try {
      const storageRoot = await navigator.storage.getDirectory();
      const root = await storageRoot.getDirectoryHandle("worklazy-video-results-v1");
      const sessions = [];
      for await (const [sessionName, sessionHandle] of root.entries()) {
        if (sessionHandle.kind !== "directory") continue;
        const resultFiles = [];
        for await (const [name, handle] of sessionHandle.entries()) {
          if (handle.kind !== "file" || !name.startsWith("result-")) continue;
          const file = await handle.getFile();
          const signatures = name.endsWith(".zip") ? new Uint8Array(await file.arrayBuffer()) : undefined;
          const includes = (signature) => {
            if (!signatures) return false;
            outer: for (let index = 0; index <= signatures.length - signature.length; index += 1) {
              for (let offset = 0; offset < signature.length; offset += 1) if (signatures[index + offset] !== signature[offset]) continue outer;
              return true;
            }
            return false;
          };
          resultFiles.push({
            name,
            size: file.size,
            zip64Eocd: includes([0x50, 0x4b, 0x06, 0x06]),
            zip64Locator: includes([0x50, 0x4b, 0x06, 0x07]),
            classicEocd: includes([0x50, 0x4b, 0x05, 0x06]),
          });
        }
        sessions.push({ sessionName, resultFiles });
      }
      const current = sessions.sort((left, right) => right.resultFiles.length - left.resultFiles.length)[0];
      return { mode: "opfs", resultFiles: current?.resultFiles || [], sessions: sessions.length };
    } catch (error) {
      return { mode: "error", resultFiles: [], error: error instanceof Error ? error.name : String(error) };
    }
  });
}

async function waitForNewPage(browser, existingPages) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const next = (await browser.pages()).find((candidate) => !existingPages.has(candidate));
    if (next) return next;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Audio studio handoff did not open a new tab.");
}

async function waitForTerminalStatus(page) {
  try {
    await page.waitForFunction(() => document.querySelector(".ui-operation-progress.ui-status-success, .ui-operation-progress.ui-status-error"), { timeout: 60_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      progressClass: document.querySelector(".ui-operation-progress")?.className,
      message: document.querySelector(".ui-operation-current-message")?.textContent,
      logs: Array.from(document.querySelectorAll(".ui-operation-log li")).map((item) => item.textContent),
      page: document.querySelector(".video-studio-page")?.textContent?.slice(0, 200),
      document: document.documentElement.outerHTML.slice(0, 500),
    }));
    throw new Error(`${error.message}\nUI state: ${JSON.stringify(state)}`);
  }
}

async function createFixtures(directory) {
  const hwpFixtures = await createHwpFixtures(directory);

  const imageOne = path.join(directory, "one.png");
  const imageTwo = path.join(directory, "two.png");
  await Promise.all([
    execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x159bd7:s=320x200", "-frames:v", "1", imageOne]),
    execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0xff375f:s=240x320", "-frames:v", "1", imageTwo]),
  ]);

  const video = path.join(directory, "sample.mp4");
  const videoTwo = path.join(directory, "sample-two.mp4");
  const largeVideo = path.join(directory, "2026_0618_070732_001396F.MP4");
  const largePassThroughVideos = [path.join(directory, "large-pass-through-one.mp4"), path.join(directory, "large-pass-through-two.mp4")];
  const largeAudioIncompatibleVideo = path.join(directory, "large-eac3-source.mp4");
  const targetAudioIncompatibleVideo = path.join(directory, "target-eac3-source.mp4");
  const videoIncompatibleVideo = path.join(directory, "dolby-vision-entry.mov");
  const dolbyVisionBase = path.join(directory, "dolby-vision-hvc1-base.mp4");
  const dolbyVisionLimitBase = path.join(directory, "dolby-vision-limit-hvc1-base.mp4");
  const dolbyVisionMatrix = [];
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x159bd7:s=320x180:d=1.5",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video,
  ]);
  const audio = path.join(directory, "sample-audio.wav");
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=523:duration=2.4:sample_rate=48000",
    "-filter_complex", "[0:a]asplit=2[left][right];[left][right]amerge=inputs=2[a]",
    "-map", "[a]", "-c:a", "pcm_s16le", audio,
  ]);
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0xff375f:s=240x320:r=60:d=1",
    "-f", "lavfi", "-i", "sine=frequency=660:duration=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", videoTwo,
  ]);
  const videoCopies = Array.from({ length: 5 }, (_, index) => path.join(directory, `sample-${index + 3}.mp4`));
  await Promise.all(videoCopies.map((target) => fs.copyFile(video, target)));
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x2266aa:s=320x180:r=30:d=2",
    "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=48000:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "eac3", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", largeAudioIncompatibleVideo,
  ]);
  await fs.copyFile(largeAudioIncompatibleVideo, targetAudioIncompatibleVideo);
  const audioIncompatibleHandle = await fs.open(largeAudioIncompatibleVideo, "r+");
  try {
    await audioIncompatibleHandle.truncate(2 * 1024 * 1024 * 1024 + 1);
  } finally {
    await audioIncompatibleHandle.close();
  }
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0xaa4422:s=320x180:r=30:d=1",
    "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=48000:duration=1",
    "-c:v", "libx265", "-preset", "ultrafast", "-x265-params", "log-level=error",
    "-tag:v", "hvc1", "-c:a", "eac3", "-b:a", "192k", "-shortest",
    "-movflags", "+faststart", "-write_btrt", "1", dolbyVisionBase,
  ]);
  for (const sampleEntry of ["dvh1", "dvhe"]) {
    for (const configBox of ["dvcC", "dvvC"]) {
      const fixture = path.join(directory, `dolby-vision-${sampleEntry}-${configBox}.mp4`);
      await injectDolbyVisionConfiguration(dolbyVisionBase, fixture, { sampleEntry, configBox, compatibilityId: 1 });
      await validateDolbyVisionFixture(fixture, sampleEntry, configBox);
      dolbyVisionMatrix.push(fixture);
    }
  }
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x663399:s=320x180:r=1:d=70",
    "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=48000:duration=70",
    "-c:v", "libx265", "-preset", "ultrafast", "-x265-params", "log-level=error",
    "-tag:v", "hvc1", "-c:a", "eac3", "-b:a", "192k", "-shortest",
    "-movflags", "+faststart", "-write_btrt", "1", dolbyVisionLimitBase,
  ]);
  await injectDolbyVisionConfiguration(dolbyVisionLimitBase, videoIncompatibleVideo, {
    sampleEntry: "dvhe",
    configBox: "dvcC",
    compatibilityId: 0,
  });
  await validateDolbyVisionFixture(videoIncompatibleVideo, "dvhe", "dvcC");
  await Promise.all(largePassThroughVideos.map(async (target) => {
    await fs.copyFile(video, target);
    const handle = await fs.open(target, "r+");
    try {
      await handle.truncate(512 * 1024 * 1024);
    } finally {
      await handle.close();
    }
  }));
  const largeHandle = await fs.open(largeVideo, "w");
  try {
    await largeHandle.truncate(3824 * 1024 * 1024);
  } finally {
    await largeHandle.close();
  }
  return {
    ...hwpFixtures,
    images: [imageOne, imageTwo],
    audio,
    videos: [video, videoTwo, ...videoCopies],
    largeVideo,
    largePassThroughVideos,
    largeAudioIncompatibleVideo,
    targetAudioIncompatibleVideo,
    videoIncompatibleVideo,
    dolbyVisionVideo: dolbyVisionMatrix[0],
  };
}

async function createHwpFixtures(directory) {
  const encoded = await fs.readFile(new URL("./fixtures/rhwp-roundtrip-empty.hwp.b64", import.meta.url), "utf8");
  const bytes = Buffer.from(encoded.replace(/\s/g, ""), "base64");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== HWP_FIXTURE_SHA256) throw new Error(`Pinned HWP fixture hash mismatch: ${sha256}`);
  const blankHwp = path.join(directory, "rhwp-roundtrip-empty.hwp");
  const blankHwpTwo = path.join(directory, "rhwp-roundtrip-empty-copy.hwp");
  const wordDocx = path.join(directory, "word-family.docx");
  await Promise.all([
    fs.writeFile(blankHwp, bytes),
    fs.writeFile(blankHwpTwo, bytes),
    fs.writeFile(wordDocx, await createMinimalDocx()),
  ]);
  return { hwpFiles: [blankHwp, blankHwpTwo], wordDocx };
}

async function inspectHwpBytes(bytes) {
  if (!rhwpInitialization) {
    const wasm = await fs.readFile(new URL("../node_modules/@rhwp/core/rhwp_bg.wasm", import.meta.url));
    globalThis.measureTextWidth = (_font, text) => Array.from(text).length * 8;
    rhwpInitialization = initRhwp({ module_or_path: wasm });
  }
  await rhwpInitialization;
  const document = new HwpDocument(new Uint8Array(bytes));
  try {
    const paragraphs = [];
    let paragraphCount = 0;
    for (let section = 0; section < document.getSectionCount(); section += 1) {
      const sectionParagraphCount = document.getParagraphCount(section);
      paragraphCount += sectionParagraphCount;
      for (let paragraph = 0; paragraph < sectionParagraphCount; paragraph += 1) {
        paragraphs.push(document.getTextRange(section, paragraph, 0, document.getParagraphLength(section, paragraph)));
      }
    }
    return {
      pageCount: document.pageCount(),
      sectionCount: document.getSectionCount(),
      paragraphCount,
      text: paragraphs.join("\n"),
    };
  } finally {
    document.free();
  }
}

async function injectDolbyVisionConfiguration(source, target, { sampleEntry, configBox, compatibilityId }) {
  const bytes = await fs.readFile(source);
  const sampleEntryOffset = bytes.indexOf("hvc1");
  const bitrateBoxOffset = bytes.indexOf("btrt");
  if (sampleEntryOffset < 4 || bitrateBoxOffset < 4 || bytes.readUInt32BE(bitrateBoxOffset - 4) !== 20) {
    throw new Error("Dolby Vision fixture requires one hvc1 entry and a 20-byte btrt box");
  }
  bytes.write(sampleEntry, sampleEntryOffset, 4, "ascii");
  bytes.write(configBox, bitrateBoxOffset, 4, "ascii");
  const level = 9;
  Buffer.from([1, 0, (8 << 1) | (level >>> 5), ((level & 0x1f) << 3) | 0b101, compatibilityId << 4])
    .copy(bytes, bitrateBoxOffset + 4);
  await fs.writeFile(target, bytes);
}

async function validateDolbyVisionFixture(filePath, sampleEntry, configBox) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,codec_tag_string", "-of", "json", filePath,
  ]);
  const stream = JSON.parse(stdout).streams?.[0];
  if (stream?.codec_name !== "hevc" || stream?.codec_tag_string !== sampleEntry) {
    throw new Error(`Dolby Vision ffprobe validation failed: ${stdout}`);
  }
  await execFileAsync("ffmpeg", ["-v", "error", "-i", filePath, "-f", "null", "-"]);
  const bytes = await fs.readFile(filePath);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  buffer.fileStart = 0;
  const parser = createMp4BoxFile(false);
  let info;
  parser.onReady = (value) => { info = value; };
  parser.appendBuffer(buffer, true);
  parser.flush();
  const track = info?.videoTracks?.[0] && parser.getTrackById(info.videoTracks[0].id);
  const entry = track?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  if (entry?.type !== sampleEntry || !entry.hvcC || !entry[configBox]) {
    throw new Error(`Dolby Vision MP4Box validation failed for ${sampleEntry}/${configBox}`);
  }
}

async function createMinimalDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word family verification file.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
