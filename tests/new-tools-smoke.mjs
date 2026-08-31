import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import initRhwp, { HwpDocument } from "@rhwp/core";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const koBaseUrl = `${baseUrl}/ko`;
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-new-tools-"));

try {
  const fixtures = await createFixtures(tempDirectory);
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
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

    const onlyVideo = process.env.TEST_ONLY_VIDEO === "1";
    const onlyAudio = process.env.TEST_ONLY_AUDIO === "1";
    const onlyImage = process.env.TEST_ONLY_IMAGE === "1";
    const onlyHwp = process.env.TEST_ONLY_HWP === "1";
    if (onlyHwp) {
      console.log("[1/1] HWP editor and comparison");
      await testHwpEditor(page, fixtures.hwpFiles, fixtures.wordDocx);
    } else if (!onlyVideo && !onlyAudio) {
      if (!onlyImage) {
        console.log("[1/4] HWP editor");
        await testHwpEditor(page, fixtures.hwpFiles, fixtures.wordDocx);
      }
      console.log("[2/4] Image studio");
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
      await testImageStudio(page, fixtures.images);
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    }
    if (!onlyHwp && !onlyVideo && !onlyImage) {
      console.log("[3/4] Audio studio");
      await testAudioStudio(page, fixtures.audio);
    }
    if (!onlyHwp && !onlyAudio && !onlyImage) {
      console.log("[4/4] Video studio");
      await testVideoStudio(page, fixtures.videos, fixtures.largeVideo, fixtures.largePassThroughVideos);
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
  await page.waitForSelector(".rhwp-version-notice");
  const compareVersion = await page.$eval(".rhwp-version-notice", (element) => element.textContent || "");
  if (!compareVersion.includes("rhwp 0.8.4") || !compareVersion.includes("공식 비교 파일")) {
    throw new Error(`HWP comparison version notice is incomplete: ${compareVersion}`);
  }
  let compareInputs = await page.$$(".hwp-compare-page input[type=file]");
  await compareInputs[0].uploadFile(hwpPaths[0]);
  await page.waitForFunction(() => document.querySelectorAll(".hwp-sortable-files")[0]?.children.length === 1);
  compareInputs = await page.$$(".hwp-compare-page input[type=file]");
  await compareInputs[1].uploadFile(wordDocx);
  await page.waitForFunction(() => document.querySelectorAll(".hwp-sortable-files")[1]?.children.length === 1);
  await page.$eval(".tool-action-bar .primary-button", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".error-banner")?.textContent?.includes("Word 문서와 HWP 문서는 서로 비교할 수 없습니다"));
  await page.evaluate(() => {
    const lists = document.querySelectorAll(".hwp-sortable-files");
    const remove = lists[1]?.querySelector(".sortable-file-actions button:last-child");
    if (!(remove instanceof HTMLButtonElement)) throw new Error("Cross-family test file remove button was not found.");
    remove.click();
  });
  await page.waitForFunction(() => document.querySelectorAll(".hwp-sortable-files").length === 1);
  compareInputs = await page.$$(".hwp-compare-page input[type=file]");
  await compareInputs[0].uploadFile(hwpPaths[1]);
  await page.waitForFunction(() => document.querySelectorAll(".hwp-sortable-files")[0]?.children.length === 2);
  const hwpAddButton = await page.$eval(".hwp-compare-page .drop-zone .secondary-button", (button) => button.textContent || "");
  if (!hwpAddButton.includes("더 추가")) throw new Error(`HWP comparison does not expose incremental file addition: ${hwpAddButton}`);
  await page.$eval(".hwp-sortable-files .move-across-button", (button) => button.click());
  await page.waitForFunction(() => {
    const lists = document.querySelectorAll(".hwp-sortable-files");
    return lists.length === 2 && lists[0].children.length === 1 && lists[1].children.length === 1;
  });
  await page.$eval(".tool-action-bar .primary-button", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".operation-progress.status-success") || document.querySelector(".error-banner"), { timeout: 120_000 });
  const compareError = await page.$eval(".error-banner", (element) => element.textContent || "").catch(() => "");
  if (compareError) throw new Error(`Unified HWP comparison failed: ${compareError}`);
  if (await page.$$(".word-pair-result-card").then((items) => items.length) !== 1
    || await page.$$(".word-pair-result-card .blue-download").then((items) => items.length) !== 1
    || await page.$$(".word-pair-result-card .tracked-download").then((items) => items.length) !== 0) {
    throw new Error("Unified HWP comparison outputs do not match the selected formats.");
  }
  await page.$eval(".word-pair-result-card .secondary-button", (button) => button.click());
  await page.waitForFunction(() => location.pathname.endsWith("/tools/document-compare/results/1") && document.querySelector(".comparison-summary"));

  const forbiddenRhwpRequests = [];
  const recordRhwpRequest = (request) => {
    if (/edwardkim\.github\.io|cdn\.jsdelivr\.net/i.test(request.url())) forbiddenRhwpRequests.push(request.url());
  };
  page.on("request", recordRhwpRequest);
  await page.goto(`${koBaseUrl}/tools/hwp-editor`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rhwp-editor-shell iframe");
  await page.waitForFunction(() => document.querySelector(".operation-progress.status-success")?.textContent?.includes("편집기를 사용할 수 있습니다"));
  const runtime = await page.$eval(".rhwp-editor-shell iframe", (iframe) => {
    const url = new URL(iframe.src);
    const csp = iframe.contentDocument?.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") || "";
    const version = iframe.contentDocument?.querySelector('meta[name="rhwp-version"]')?.getAttribute("content") || "";
    return { sameOrigin: url.origin === location.origin, path: url.pathname, csp, version };
  });
  if (!runtime.sameOrigin || !runtime.path.includes("/vendor/rhwp-studio/0.8.4/") || runtime.version !== "0.8.4"
    || !runtime.csp.includes("connect-src 'self'") || !runtime.csp.includes("font-src 'self'")) {
    throw new Error(`HWP editor is not using the isolated self-hosted runtime: ${JSON.stringify(runtime)}`);
  }
  await page.waitForSelector(".hwp-tool-page input[type=file]");
  await (await page.$(".hwp-tool-page input[type=file]")).uploadFile(hwpPaths[0]);
  await page.waitForSelector(".hwp-tool-page.hwp-editor-focus");
  const editorDescription = await page.$eval(".hwp-editor-section", (element) => element.textContent || "");
  if (!editorDescription.includes("1페이지")) throw new Error(`HWP page count is incorrect: ${editorDescription}`);
  const focusLayout = await page.evaluate(() => {
    const focus = document.querySelector(".hwp-editor-focus")?.getBoundingClientRect();
    const sidebar = document.querySelector(".sidebar")?.getBoundingClientRect();
    const shell = document.querySelector(".rhwp-editor-shell")?.getBoundingClientRect();
    return focus && sidebar && shell ? { focus: { left: focus.left, right: focus.right, top: focus.top, bottom: focus.bottom }, sidebar: { right: sidebar.right }, shellHeight: shell.height, hasPageHeader: Boolean(document.querySelector(".hwp-tool-page .page-header")) } : null;
  });
  if (!focusLayout || focusLayout.focus.left < focusLayout.sidebar.right || focusLayout.focus.right < 1435 || focusLayout.focus.top > 10 || focusLayout.focus.bottom < 895 || focusLayout.shellHeight < focusLayout.focus.bottom - focusLayout.focus.top - 130 || focusLayout.hasPageHeader) {
    throw new Error(`HWP focus layout did not fill the area outside the sidebar: ${JSON.stringify(focusLayout)}`);
  }
  await page.waitForFunction(() => {
    const button = document.querySelector(".hwp-focus-actions .primary-button");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const editorVersion = await page.$eval(".rhwp-version-notice.compact", (element) => element.textContent || "");
  if (!editorVersion.includes("rhwp 0.8.4") || !editorVersion.includes("이 사이트에 포함")) {
    throw new Error(`HWP editor version notice is incomplete: ${editorVersion}`);
  }
  page.off("request", recordRhwpRequest);
  if (forbiddenRhwpRequests.length) throw new Error(`HWP editor requested external rhwp resources: ${forbiddenRhwpRequests.join(", ")}`);
}

async function testImageStudio(page, imagePaths) {
  await page.goto(`${koBaseUrl}/tools/image-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".studio-tabs button").length === 4 && document.querySelector(".studio-tabs button")?.textContent?.includes("이미지 편집"));
  await page.waitForSelector(".fabric-stage");
  await dropCanvasImages(page, ".fabric-stage", ["#159bd7"]);
  await page.waitForSelector(".fabric-stage .canvas-container");
  await page.waitForFunction(() => document.querySelector(".image-studio-page .drop-zone strong")?.textContent?.includes("1개 파일 선택됨"));
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .lower-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const pixel = canvas.getContext("2d")?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return pixel && pixel[2] > 150;
  });
  const editorControls = await page.evaluate(() => ({
    hasRectangleLabel: Boolean(document.querySelector('button[aria-label="사각형 추가"]')),
    hasVerticalFlip: Boolean(document.querySelector('button[aria-label="상하 반전"]')),
    jpgNotice: document.querySelector(".image-format-control small")?.textContent || "",
  }));
  if (!editorControls.hasRectangleLabel || !editorControls.hasVerticalFlip || !editorControls.jpgNotice.includes("JPG") || !editorControls.jpgNotice.includes("흰색")) {
    throw new Error(`Unified editor controls are incomplete: ${JSON.stringify(editorControls)}`);
  }
  await page.click('.image-background-options.compact button[role="switch"]');
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .lower-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    return canvas.getContext("2d")?.getImageData(1, 1, 1, 1).data[3] === 0;
  });
  await page.click('button[aria-label="사각형 추가"]');
  await page.waitForFunction(() => !document.querySelector(".shape-style-controls")?.classList.contains("is-disabled"));
  await page.evaluate(() => {
    const controls = document.querySelector(".shape-style-controls");
    const colors = controls?.querySelectorAll("input[type=color]");
    const width = controls?.querySelector("input[type=range]");
    if (!(colors?.[0] instanceof HTMLInputElement) || !(colors?.[1] instanceof HTMLInputElement) || !(width instanceof HTMLInputElement)) throw new Error("Shape controls are unavailable");
    colors[0].value = "#00ff00";
    colors[0].dispatchEvent(new Event("change", { bubbles: true }));
    colors[1].value = "#000000";
    colors[1].dispatchEvent(new Event("change", { bubbles: true }));
    width.value = "8";
    width.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const styledCanvas = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  await page.evaluate(() => {
    window.__worklazyExportDataUrl = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function captureImageExport() {
      if (this.href.startsWith("data:image/jpeg")) {
        window.__worklazyExportDataUrl = this.href;
        return;
      }
      return originalClick.call(this);
    };
  });
  await page.$$eval(".image-format-control button", (buttons) => {
    const jpg = buttons.find((button) => button.textContent?.trim() === "JPG");
    if (!(jpg instanceof HTMLButtonElement)) throw new Error("JPG export option is unavailable");
    jpg.click();
  });
  await page.click(".export-row .primary-button");
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
        if (pixels[offset] < 18 && pixels[offset + 1] > 110 && pixels[offset + 1] < 150 && pixels[offset + 2] > 238) {
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
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("Delete");
  await page.waitForFunction(() => document.querySelector(".shape-style-controls")?.classList.contains("is-disabled"));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const deletedCanvas = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (!styledCanvas || styledCanvas === deletedCanvas) throw new Error("Delete did not remove the selected Fabric layer");
  await page.click('button[aria-label="사각형 추가"]');
  await page.evaluate(() => {
    const fill = document.querySelector('.shape-style-controls input[aria-label="도형 채움색"]');
    if (!(fill instanceof HTMLInputElement)) throw new Error("Shape fill control is unavailable for the region-effect test");
    fill.value = "#ff375f";
    fill.dispatchEvent(new Event("change", { bubbles: true }));
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
  await page.click('button[aria-label="영역 효과"]');
  await page.$$eval(".region-effect-options button", (buttons) => {
    const blur = buttons.find((button) => button.textContent?.trim() === "블러");
    if (!(blur instanceof HTMLButtonElement)) throw new Error("Blur region effect is unavailable");
    blur.click();
  });
  await page.$eval('input[aria-label="효과 강도"]', (input) => {
    input.value = "10";
    input.dispatchEvent(new Event("input", { bubbles: true }));
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
  await page.waitForSelector(".region-effect-selection");
  await page.click(".region-effect-selection .primary-button");
  await page.waitForFunction(() => !document.querySelector(".fabric-stage.is-effect-mode") && !document.querySelector(".region-effect-selection"));
  if (disabledNativeCanvasBlur) {
    await page.evaluate(() => Object.defineProperty(window, "CanvasRenderingContext2D", window.__canvasContextConstructorDescriptor));
  }
  const afterRegionEffect = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  console.log("  image: legacy canvas blur fallback verified");
  if (beforeRegionEffect === afterRegionEffect) throw new Error("Blur did not change the selected image region");
  const blurredEdgeAlpha = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.getContext("2d").getImageData(Math.floor(canvas.width * 0.04), Math.floor(canvas.height * 0.04), 1, 1).data[3]);
  if (blurredEdgeAlpha < 250) throw new Error(`Blur introduced transparency at the source-image edge: ${blurredEdgeAlpha}`);
  await page.click('.editor-history-actions button[aria-label="실행 취소"]');
  await page.waitForFunction((effected) => document.querySelector(".fabric-stage .lower-canvas")?.toDataURL() !== effected, {}, afterRegionEffect);
  const undoneRegionEffect = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  await page.click('.editor-history-actions button[aria-label="다시 실행"]');
  await page.waitForFunction((undone) => document.querySelector(".fabric-stage .lower-canvas")?.toDataURL() !== undone, {}, undoneRegionEffect);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {
    const clearLayers = Array.from(document.querySelectorAll(".image-editor-controls button")).find((button) => button.textContent?.includes("추가 레이어 모두 지우기"));
    if (!(clearLayers instanceof HTMLButtonElement)) throw new Error("Clear-added-layers control is unavailable");
    clearLayers.click();
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.$eval(".fabric-stage .lower-canvas", (canvas) => {
    window.__protectedEffectBeforeLayerMove = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  });
  await page.click('button[aria-label="원본 사진 잠금"]');
  const baseCanvas = await page.$(".fabric-stage .upper-canvas");
  const baseBox = await baseCanvas?.boundingBox();
  if (!baseBox) throw new Error("Image base canvas is unavailable for the layer-order test");
  await page.mouse.click(baseBox.x + baseBox.width * 0.8, baseBox.y + baseBox.height * 0.8);
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
  await page.click('button[aria-label="영역 효과"]');
  await page.$eval(".fabric-stage .upper-canvas", (canvas) => canvas.scrollIntoView({ block: "center", behavior: "instant" }));
  const overlayCanvas = await page.$(".fabric-stage .upper-canvas");
  const overlayBox = await overlayCanvas?.boundingBox();
  if (!overlayBox) throw new Error("Region overlay export canvas is unavailable");
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.18, overlayBox.y + overlayBox.height * 0.18);
  await page.mouse.down();
  await page.mouse.move(overlayBox.x + overlayBox.width * 0.34, overlayBox.y + overlayBox.height * 0.32, { steps: 6 });
  await page.mouse.up();
  await page.waitForSelector(".region-effect-selection");
  await page.click(".export-row .primary-button");
  const exportWithSelection = await page.evaluate(() => window.__worklazyExportDataUrl);
  await page.click(".region-effect-selection .secondary-button");
  await page.click(".export-row .primary-button");
  const exportWithoutSelection = await page.evaluate(() => window.__worklazyExportDataUrl);
  if (!exportWithSelection || exportWithSelection !== exportWithoutSelection) throw new Error("The region-selection overlay contaminated the raster export");
  console.log("  image: region overlay export verified");
  const portraitPresets = await page.$$eval(".image-editor-controls .button-grid button", (buttons) => buttons.map((button) => button.textContent?.trim()).filter(Boolean));
  if (!portraitPresets.includes("3:4") || !portraitPresets.includes("9:16")) throw new Error("Portrait crop presets are unavailable");
  await page.$$eval(".editor-draw-tools button", (buttons) => {
    const crop = buttons.find((button) => button.textContent?.includes("범위 자르기"));
    if (!(crop instanceof HTMLButtonElement)) throw new Error("Free crop tool is unavailable");
    crop.click();
  });
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
  await page.waitForSelector(".image-crop-selection-status");
  await page.click(".image-crop-selection-status .primary-button");
  await page.waitForFunction(() => !document.querySelector(".image-crop-selection-status"));
  const croppedSize = await page.$eval(".fabric-stage .lower-canvas", (canvas) => ({ width: canvas.width / devicePixelRatio, height: canvas.height / devicePixelRatio }));
  if (croppedSize.width >= 850 || croppedSize.height >= 570 || croppedSize.width < 450 || croppedSize.height < 280) {
    throw new Error(`Free crop did not resize the canvas as selected: ${JSON.stringify(croppedSize)}`);
  }
  await page.click(".studio-tabs button:nth-child(2)");
  await pasteCanvasImages(page, ["#159bd7", "#ff375f"]);
  await page.waitForFunction(() => document.querySelectorAll(".image-studio-page .file-row").length === 2);
  await page.waitForFunction(() => !document.querySelector(".image-studio-page .section-actions .primary-button")?.disabled);
  await page.click(".image-studio-page .section-actions .primary-button");
  await waitForTerminalStatus(page);
  if (await page.$(".operation-progress.status-error")) throw new Error(await page.$eval(".operation-current-message", (element) => element.textContent || "Image error"));
  await page.click(".studio-tabs button:nth-child(3)");
  await pasteCanvasImages(page, ["#159bd7", "#ff375f"]);
  await page.waitForFunction(() => document.querySelectorAll(".image-studio-page .file-row").length === 2);
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
  await page.waitForFunction(() => document.querySelectorAll(".image-studio-page .file-row").length === 3);
  await page.click(".studio-tabs button:nth-child(4)");
  await pasteCanvasImages(page, ["#159bd7", "#ff375f"]);
  await page.waitForFunction(() => document.querySelectorAll(".gif-frame-row").length === 2 && document.querySelectorAll(".gif-frame-drag-handle").length === 2);
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
  await page.waitForFunction(() => document.querySelector(".operation-progress.status-success")?.textContent?.includes("파형 준비 완료"), { timeout: 60_000 });
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
  await page.click(".audio-voice-effect-actions .secondary-button");
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
  await page.click(".audio-voice-effect-actions .primary-button");
  await waitForAudioSuccess(page, "음성 효과 적용 완료", 120_000);
  const durationAfterEffect = await page.$eval(".audio-timecode small", (element) => element.textContent || "");
  if (durationAfterEffect !== durationBeforeEffect) throw new Error(`Pitch effect changed the document duration: ${durationBeforeEffect} -> ${durationAfterEffect}`);
  await page.$eval(".audio-voice-presets button:nth-child(4)", (button) => button.click());
  await page.waitForFunction(() => document.querySelector(".audio-voice-presets button:nth-child(4)")?.getAttribute("aria-checked") === "true");
  await page.click(".audio-voice-effect-actions .secondary-button");
  await waitForAudioSuccess(page, "미리 듣기 준비 완료");
  if (!(await page.$eval(".audio-effect-preview audio", (audio) => audio.src.startsWith("blob:")))) throw new Error("Robot voice preview was not created.");

  await clickAudioAction(page, "복사");
  await page.waitForFunction(() => document.querySelector(".audio-clipboard-status.has-clip")?.textContent?.includes("오디오 클립보드"));
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
  await page.evaluate(() => document.querySelector(".audio-studio-page .section-actions .primary-button")?.click());
  await page.waitForFunction(() => document.querySelector(".inline-success")?.textContent?.includes(".wav"), { timeout: 60_000 });
  await page.evaluate(() => document.querySelector('.audio-export-settings .segmented-control button:nth-child(2)')?.click());
  await page.evaluate(() => document.querySelector(".audio-studio-page .section-actions .primary-button")?.click());
  await page.waitForFunction(() => document.querySelector(".inline-success")?.textContent?.includes(".mp3"), { timeout: 120_000 });
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
  await page.waitForFunction((expected) => document.querySelector(".operation-progress.status-success")?.textContent?.includes(expected), { timeout }, text);
}

async function testVideoStudio(page, videoPaths, largeVideoPath, largePassThroughPaths) {
  if (new URL(page.url()).origin !== new URL(baseUrl).origin) {
    await page.goto(`${koBaseUrl}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const videoAdRequests = [];
  const captureVideoRequests = (request) => {
    if (request.url().includes("pagead2.googlesyndication.com")) videoAdRequests.push(request.url());
  };
  page.on("request", captureVideoRequests);
  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  page.off("request", captureVideoRequests);
  const isolation = await page.evaluate(() => ({
    marker: Boolean(document.querySelector('meta[name="worklazy-video-isolation"]')),
    ads: Boolean(document.querySelector("script[data-worklazy-adsense]")),
    googleAnalytics: Boolean(document.querySelector("script[data-worklazy-google-analytics]")),
    naverAnalytics: Boolean(document.querySelector("script[data-worklazy-naver-analytics]")),
    googlePageViewQueued: (window.dataLayer || []).some((item) => Object.prototype.toString.call(item) === "[object Arguments]" && item[0] === "event" && item[1] === "page_view"),
    engine: document.querySelector(".video-engine-status")?.textContent || "",
  }));
  if (!isolation.marker || isolation.ads || !isolation.googleAnalytics || !isolation.naverAnalytics || !isolation.googlePageViewQueued
    || !isolation.engine.includes("멀티스레드") || isolation.engine.includes("광고") || isolation.engine.includes("실행 문서") || videoAdRequests.length) {
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
  const exportDuringFpsProbe = await page.$eval(".video-studio-page .section-actions .primary-button", (button) => ({ disabled: button.disabled, text: button.textContent || "" }));
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
  const addButton = await page.$eval(".video-studio-page .drop-zone .secondary-button", (button) => button.textContent || "");
  if (!addButton.includes("더 추가")) throw new Error(`Video studio does not expose incremental file addition: ${addButton}`);
  const outputLimit = await page.$eval(".video-output-limit", (element) => element.textContent || "");
  if (!outputLimit.includes("1GB 이하") || !outputLimit.includes("1.5GB")) throw new Error(`Video output limit is not explicit: ${outputLimit}`);
  const readState = await page.evaluate(() => window.__videoFileReadState);
  if (readState.arrayBufferReads !== 0) {
    throw new Error(`Video selection copied a source into one contiguous ArrayBuffer: ${JSON.stringify(readState)}`);
  }
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
    start: element.style.getPropertyValue("--range-start"),
    end: element.style.getPropertyValue("--range-end"),
  }));
  if (rangeState.handles !== 2 || !rangeState.start || rangeState.start === "0%" || !rangeState.end) throw new Error(`Combined range track was not updated: ${JSON.stringify(rangeState)}`);
  const passthroughOption = await page.$eval('.video-bitrate-control select', (select) => ({ value: select.value, text: select.selectedOptions[0]?.textContent }));
  if (passthroughOption.value !== "copy" || !passthroughOption.text?.includes("패스스루")) throw new Error(`Pass-through trim was not selected: ${JSON.stringify(passthroughOption)}`);
  const encodingOptions = await page.evaluate(() => ({
    video: Array.from(document.querySelectorAll('.video-bitrate-control option')).map((option) => option.textContent),
    audioModes: Array.from(document.querySelectorAll('.video-audio-settings .segmented-control button')).map((button) => button.textContent),
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
  await page.evaluate(() => document.querySelector(".video-studio-page .section-actions .primary-button")?.click());
  await page.waitForSelector(".operation-progress.status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".operation-progress.status-error")) throw new Error(await page.$eval(".operation-current-message", (element) => element.textContent || "Video error"));
  const firstResultState = await page.$$eval(".video-result-item", (elements) => elements.map((element) => ({
    text: element.textContent || "",
    href: element.querySelector("a")?.getAttribute("href") || "",
    download: element.querySelector("a")?.getAttribute("download") || "",
  })));
  if (firstResultState.length !== 2 || firstResultState.some((result) => !result.href.startsWith("blob:") || !result.download)) {
    throw new Error(`Video outputs were not exposed as individual downloads: ${JSON.stringify(firstResultState)}`);
  }
  if (await page.$(".audio-handoff-button")) throw new Error("Audio studio handoff was shown for a video result.");
  const progressFontSizes = await page.evaluate(() => ({
    message: Number.parseFloat(getComputedStyle(document.querySelector(".operation-current-message")).fontSize),
    log: Number.parseFloat(getComputedStyle(document.querySelector(".operation-log li")).fontSize),
  }));
  if (progressFontSizes.message < 10 || progressFontSizes.log < 9) {
    throw new Error(`Progress and error guidance fonts are still too small: ${JSON.stringify(progressFontSizes)}`);
  }

  await page.evaluate(() => {
    const output = document.querySelector(".video-output-format-grid select");
    if (!(output instanceof HTMLSelectElement)) throw new Error("Output format selector is unavailable");
    output.value = "mp3";
    output.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector(".audio-encoding-fields");
  await page.evaluate(() => {
    const selects = document.querySelectorAll(".audio-encoding-fields select");
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
    disabled: document.querySelector(".video-studio-page .section-actions .primary-button")?.disabled,
  }));
  if (customAudioState.bitrate !== "160" || customAudioState.sampleRate !== "44100" || customAudioState.disabled) throw new Error(`Custom audio settings were not accepted: ${JSON.stringify(customAudioState)}`);
  await page.evaluate(() => document.querySelector(".video-studio-page .section-actions .primary-button")?.click());
  await page.waitForSelector(".operation-progress.status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".operation-progress.status-error")) throw new Error(await page.$eval(".operation-current-message", (element) => element.textContent || "Audio extraction error"));
  const rawVideoMessages = await page.$$eval(".video-studio-page *", (elements) => elements
    .filter((element) => element.children.length === 0 && element.textContent?.includes("__worklazy_i18n__:"))
    .map((element) => element.textContent).slice(0, 5));
  if (rawVideoMessages.length) throw new Error(`A raw i18n worker token was exposed in video progress UI: ${JSON.stringify(rawVideoMessages)}`);
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
  await audioPage.waitForFunction(() => document.querySelector(".operation-progress.status-success, .operation-progress.status-error"));
  if (await audioPage.$(".operation-progress.status-error")) throw new Error(await audioPage.$eval(".operation-current-message", (element) => element.textContent || "Audio handoff error"));
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
    const reencode = document.querySelector('.video-audio-settings .segmented-control button:nth-child(3)');
    if (!(bitrate instanceof HTMLSelectElement) || !(reencode instanceof HTMLButtonElement)) throw new Error("Video audio re-encoding controls are unavailable");
    bitrate.value = "copy";
    bitrate.dispatchEvent(new Event("change", { bubbles: true }));
    reencode.click();
  });
  await page.waitForSelector(".video-audio-settings .audio-encoding-fields");
  await page.evaluate(() => {
    const select = document.querySelectorAll(".video-group-select select")[1];
    if (!(select instanceof HTMLSelectElement)) throw new Error("Second video group selector is unavailable");
    select.value = "2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll(".video-sync-group").length === 2);
  await page.evaluate(() => document.querySelectorAll('.video-group-output-mode .segmented-control button:nth-child(2)').forEach((button) => button.click()));
  await page.evaluate(() => document.querySelector(".video-studio-page .section-actions .primary-button")?.click());
  await page.waitForSelector(".operation-progress.status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".operation-progress.status-error")) throw new Error(await page.$eval(".operation-current-message", (element) => element.textContent || "Video concat error"));
  const groupedResults = await page.$$eval(".video-result-item", (elements) => elements.map((element) => element.textContent || ""));
  if (groupedResults.length !== 2) throw new Error(`Grouped concat did not expose two individual results: ${JSON.stringify(groupedResults)}`);
  const resultActions = await page.$eval(".video-result-actions", (element) => element.textContent || "");
  if (!resultActions.includes("전체 개별 다운로드") || !resultActions.includes("ZIP으로 묶기")) throw new Error(`Video result actions are incomplete: ${resultActions}`);
  await page.evaluate(() => Array.from(document.querySelectorAll(".video-result-actions button")).find((button) => button.textContent?.includes("ZIP으로 묶기"))?.click());
  await page.waitForFunction(() => document.querySelector(".inline-success")?.textContent?.includes("worklazy-비디오-결과-2개.zip"), { timeout: 60_000 });

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
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".video-sync-group")).find((section) => section.querySelector(".video-group-title strong")?.textContent === "그룹 1")?.querySelectorAll(".multi-video-grid article")[1]?.classList.contains("active"));
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
    const apply = panel?.querySelector(".video-group-range-copy-actions .primary-button");
    if (!(apply instanceof HTMLButtonElement)) throw new Error("Apply ranges button is unavailable");
    const style = getComputedStyle(apply);
    if (apply.disabled || !style.backgroundImage.includes("linear-gradient") || Number(style.opacity) < 0.9) {
      throw new Error(`Apply ranges button does not look active: ${JSON.stringify({ disabled: apply.disabled, background: style.backgroundImage, opacity: style.opacity })}`);
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
  await page.waitForFunction(() => document.querySelector(".inline-success")?.textContent?.includes("메모리에 통째로 복사하지 않고 연결했습니다"));
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
    const button = document.querySelector(".video-studio-page .section-actions .primary-button");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.evaluate(() => document.querySelector(".video-studio-page .section-actions .primary-button")?.click());
  await page.waitForSelector(".operation-progress.status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".operation-progress.status-error")) throw new Error(await page.$eval(".operation-current-message", (element) => element.textContent || "Large pass-through error"));
  const largePassThroughState = await page.evaluate(() => ({
    outputs: document.querySelectorAll(".video-result-item").length,
    transfer: window.__videoWorkerTransferState,
    logs: Array.from(document.querySelectorAll(".operation-log li")).map((item) => item.textContent || ""),
  }));
  if (largePassThroughState.outputs !== 2
    || largePassThroughState.transfer.startContainsFile
    || largePassThroughState.transfer.inputFileSizes.length !== 2
    || !largePassThroughState.logs.some((message) => message.includes("영상 처리 준비 완료"))
    || !largePassThroughState.logs.some((message) => message.includes("영상 불러오는 중"))) {
    throw new Error(`Large pass-through did not use incremental worker input: ${JSON.stringify(largePassThroughState)}`);
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${koBaseUrl}/tools/video-studio/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.crossOriginIsolated === true, { timeout: 60_000 });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(videoPaths[0]);
  await page.waitForFunction(() => {
    const button = document.querySelector(".video-studio-page .section-actions .primary-button");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const mobilePassthroughDefaults = await page.evaluate(() => {
    const selects = document.querySelectorAll(".encoding-grid select");
    return {
      bitrate: document.querySelector(".video-bitrate-control select")?.value,
      resolution: selects[2]?.value,
      aspect: selects[3]?.value,
      rotation: selects[4]?.value,
      actionDisabled: document.querySelector(".video-studio-page .section-actions .primary-button")?.disabled,
      notice: Array.from(document.querySelectorAll(".video-studio-page .inline-notice"), (element) => element.textContent || "").find((text) => text.includes("모바일")) || "",
    };
  });
  if (mobilePassthroughDefaults.bitrate !== "copy" || mobilePassthroughDefaults.resolution !== "source" || mobilePassthroughDefaults.aspect !== "source"
    || mobilePassthroughDefaults.rotation !== "0" || mobilePassthroughDefaults.actionDisabled
    || !mobilePassthroughDefaults.notice.includes("패스스루") || !mobilePassthroughDefaults.notice.includes("원본 해상도") || !mobilePassthroughDefaults.notice.includes("회전 없음")
    || !mobilePassthroughDefaults.notice.includes("GIF") || mobilePassthroughDefaults.notice.includes("1080p")) {
    throw new Error(`Mobile pass-through defaults are invalid: ${JSON.stringify(mobilePassthroughDefaults)}`);
  }
  await page.evaluate(() => {
    const selects = document.querySelectorAll(".encoding-grid select");
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
    const selects = document.querySelectorAll(".encoding-grid select");
    const button = document.querySelector(".video-studio-page .section-actions .primary-button");
    return selects[2]?.value === "source" && selects[3]?.value === "source" && selects[4]?.value === "0" && button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
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
    await page.waitForFunction(() => document.querySelector(".operation-progress.status-success, .operation-progress.status-error"), { timeout: 60_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      progressClass: document.querySelector(".operation-progress")?.className,
      message: document.querySelector(".operation-current-message")?.textContent,
      logs: Array.from(document.querySelectorAll(".operation-log li")).map((item) => item.textContent),
      page: document.querySelector(".video-studio-page")?.textContent?.slice(0, 200),
      document: document.documentElement.outerHTML.slice(0, 500),
    }));
    throw new Error(`${error.message}\nUI state: ${JSON.stringify(state)}`);
  }
}

async function createFixtures(directory) {
  const wasm = await fs.readFile(new URL("../node_modules/@rhwp/core/rhwp_bg.wasm", import.meta.url));
  globalThis.measureTextWidth = (_font, text) => Array.from(text).length * 8;
  await initRhwp({ module_or_path: wasm });
  const document = HwpDocument.createEmpty();
  const blankHwp = path.join(directory, "blank.hwp");
  const blankHwpTwo = path.join(directory, "blank-two.hwp");
  const wordDocx = path.join(directory, "word-family.docx");
  try {
    const bytes = document.exportHwp();
    await Promise.all([fs.writeFile(blankHwp, bytes), fs.writeFile(blankHwpTwo, bytes)]);
  } finally {
    document.free();
  }
  await fs.writeFile(wordDocx, await createMinimalDocx());

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
  return { hwpFiles: [blankHwp, blankHwpTwo], wordDocx, images: [imageOne, imageTwo], audio, videos: [video, videoTwo, ...videoCopies], largeVideo, largePassThroughVideos };
}

async function createMinimalDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word family verification file.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
