import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import initRhwp, { HwpDocument } from "@rhwp/core";
import puppeteer from "puppeteer-core";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
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
    page.on("pageerror", (error) => { pageErrors.push(error.message); console.error("[page error]", error.message); });
    page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("ERR_CONNECTION_REFUSED")) console.error("[browser]", message.text()); });
    page.on("requestfailed", (request) => { if (!request.url().includes("googlesyndication.com")) console.error("[request failed]", request.url(), request.failure()?.errorText); });

    if (process.env.TEST_ONLY_VIDEO !== "1") {
      console.log("[1/3] HWP editor");
      await testHwpEditor(page, fixtures.blankHwp);
      console.log("[2/3] Image studio");
      await testImageStudio(page, fixtures.images);
    }
    console.log("[3/3] Video studio");
    await testVideoStudio(page, fixtures.videos, fixtures.largeVideo);

    if (pageErrors.length) throw new Error(`Browser errors:\n${pageErrors.join("\n")}`);
  } finally {
    await browser.close();
  }
  console.log("New tool smoke tests passed: HWP editor, image clipboard/batch/collage preview, video group timelines and grouped output.");
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

async function testHwpEditor(page, hwpPath) {
  await page.goto(`${baseUrl}/tools/hwp-compare`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rhwp-version-notice");
  const compareVersion = await page.$eval(".rhwp-version-notice", (element) => element.textContent || "");
  if (!compareVersion.includes("rhwp 0.8.4") || !compareVersion.includes("@rhwp/core WebAssembly")) {
    throw new Error(`HWP comparison version notice is incomplete: ${compareVersion}`);
  }

  const forbiddenRhwpRequests = [];
  const recordRhwpRequest = (request) => {
    if (/edwardkim\.github\.io|cdn\.jsdelivr\.net/i.test(request.url())) forbiddenRhwpRequests.push(request.url());
  };
  page.on("request", recordRhwpRequest);
  await page.goto(`${baseUrl}/tools/hwp-editor`, { waitUntil: "domcontentloaded" });
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
  await (await page.$(".hwp-tool-page input[type=file]")).uploadFile(hwpPath);
  await page.waitForSelector(".hwp-tool-page.hwp-editor-focus");
  const editorDescription = await page.$eval(".hwp-editor-section", (element) => element.textContent || "");
  if (!editorDescription.includes("1페이지")) throw new Error(`HWP page count is incorrect: ${editorDescription}`);
  const focusLayout = await page.evaluate(() => {
    const focus = document.querySelector(".hwp-editor-focus")?.getBoundingClientRect();
    const sidebar = document.querySelector(".sidebar")?.getBoundingClientRect();
    const shell = document.querySelector(".rhwp-editor-shell")?.getBoundingClientRect();
    return focus && sidebar && shell ? { focus: { left: focus.left, right: focus.right, top: focus.top, bottom: focus.bottom }, sidebar: { right: sidebar.right }, shellHeight: shell.height, hasPageHeader: Boolean(document.querySelector(".hwp-tool-page .page-header")) } : null;
  });
  if (!focusLayout || focusLayout.focus.left < focusLayout.sidebar.right || focusLayout.focus.right < 1435 || focusLayout.focus.top > 10 || focusLayout.focus.bottom < 895 || focusLayout.shellHeight < 795 || focusLayout.hasPageHeader) {
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
  await page.goto(`${baseUrl}/tools/image-studio`, { waitUntil: "domcontentloaded" });
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
    throw new Error(`Single editor controls are incomplete: ${JSON.stringify(editorControls)}`);
  }
  await page.click('.image-background-options.compact button[role="switch"]');
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".fabric-stage .lower-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    return canvas.getContext("2d")?.getImageData(1, 1, 1, 1).data[3] === 0;
  });
  await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll(".editor-tool-group")).find((item) => item.querySelector("strong")?.textContent === "도형");
    group?.querySelector("button")?.click();
  });
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
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("Delete");
  await page.waitForFunction(() => document.querySelector(".shape-style-controls")?.classList.contains("is-disabled"));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const deletedCanvas = await page.$eval(".fabric-stage .lower-canvas", (canvas) => canvas.toDataURL());
  if (!styledCanvas || styledCanvas === deletedCanvas) throw new Error("Delete did not remove the selected Fabric layer");
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
      canvas.width = 96 + index * 24;
      canvas.height = 72 + index * 36;
      const context = canvas.getContext("2d");
      context.fillStyle = values[index];
      context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
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

async function testVideoStudio(page, videoPaths, largeVideoPath) {
  await page.goto(`${baseUrl}/tools/video-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".video-studio-page input[type=file]");
  await page.evaluate(() => {
    const nativeRead = FileReader.prototype.readAsArrayBuffer;
    window.__videoFileReadState = { arrayBufferReads: 0 };
    FileReader.prototype.readAsArrayBuffer = function trackUnexpectedVideoCopy(blob) {
      window.__videoFileReadState.arrayBufferReads += 1;
      return nativeRead.call(this, blob);
    };
  });
  await (await page.$(".video-studio-page input[type=file]")).uploadFile(...videoPaths);
  await page.waitForFunction(() => document.querySelectorAll(".video-trim-lane").length === 2 && document.querySelectorAll(".video-sync-group").length === 1);
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
  const rangeState = await page.$eval(".video-range-control", (element) => ({
    handles: element.querySelectorAll('input[type="range"]').length,
    start: element.style.getPropertyValue("--range-start"),
    end: element.style.getPropertyValue("--range-end"),
  }));
  if (rangeState.handles !== 2 || !rangeState.start || rangeState.start === "0%" || !rangeState.end) throw new Error(`Combined range track was not updated: ${JSON.stringify(rangeState)}`);
  const passthroughOption = await page.$eval('.encoding-grid label:nth-child(4) select', (select) => ({ value: select.value, text: select.selectedOptions[0]?.textContent }));
  if (passthroughOption.value !== "copy" || !passthroughOption.text?.includes("패스스루")) throw new Error(`Pass-through trim was not selected: ${JSON.stringify(passthroughOption)}`);
  await page.evaluate(() => document.querySelector(".video-studio-page .section-actions .primary-button")?.click());
  await page.waitForSelector(".operation-progress.status-running");
  await waitForTerminalStatus(page);
  if (await page.$(".operation-progress.status-error")) throw new Error(await page.$eval(".operation-current-message", (element) => element.textContent || "Video error"));
  const progressFontSizes = await page.evaluate(() => ({
    message: Number.parseFloat(getComputedStyle(document.querySelector(".operation-current-message")).fontSize),
    log: Number.parseFloat(getComputedStyle(document.querySelector(".operation-log li")).fontSize),
  }));
  if (progressFontSizes.message < 10 || progressFontSizes.log < 9) {
    throw new Error(`Progress and error guidance fonts are still too small: ${JSON.stringify(progressFontSizes)}`);
  }
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
  const groupedResult = await page.$eval(".inline-success", (element) => element.textContent || "");
  if (!groupedResult.includes("worklazy-비디오-결과-2개.zip")) throw new Error(`Grouped concat did not create a ZIP: ${groupedResult}`);

  await (await page.$(".video-studio-page input[type=file]")).uploadFile(largeVideoPath);
  await page.waitForFunction(() => document.querySelector(".inline-success")?.textContent?.includes("메모리에 통째로 복사하지 않고 연결했습니다"));
  const largeReadState = await page.evaluate(() => window.__videoFileReadState);
  if (largeReadState.arrayBufferReads !== 0) throw new Error(`A 3824MB source triggered a contiguous ArrayBuffer read: ${JSON.stringify(largeReadState)}`);
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
  try {
    await fs.writeFile(blankHwp, document.exportHwp());
  } finally {
    document.free();
  }

  const imageOne = path.join(directory, "one.png");
  const imageTwo = path.join(directory, "two.png");
  await Promise.all([
    execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x159bd7:s=320x200", "-frames:v", "1", imageOne]),
    execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0xff375f:s=240x320", "-frames:v", "1", imageTwo]),
  ]);

  const video = path.join(directory, "sample.mp4");
  const videoTwo = path.join(directory, "sample-two.mp4");
  const largeVideo = path.join(directory, "2026_0618_070732_001396F.MP4");
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x159bd7:s=320x180:d=1.5",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video,
  ]);
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0xff375f:s=240x320:d=1",
    "-f", "lavfi", "-i", "sine=frequency=660:duration=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", videoTwo,
  ]);
  const largeHandle = await fs.open(largeVideo, "w");
  try {
    await largeHandle.truncate(3824 * 1024 * 1024);
  } finally {
    await largeHandle.close();
  }
  return { blankHwp, images: [imageOne, imageTwo], videos: [video, videoTwo], largeVideo };
}
