import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const artifactDirectory = path.join(testDirectory, "visual-artifacts", "p2-b3", "diagnostics");
const reportPath = path.join(artifactDirectory, "control-geometry.json");
const port = Number.parseInt(process.env.CONTROL_GEOMETRY_TEST_PORT || "4177", 10);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const profiles = [
  { locale: "ko", theme: "light" },
  { locale: "ko", theme: "dark" },
  { locale: "en", theme: "light" },
  { locale: "en", theme: "dark" },
];
const legacySelectors = [
  ".ios-switch", ".mode-switch", ".sub-segment", ".formatter-toolbar", ".toggle-card-grid",
  ".compare-file-grid", ".word-options-grid", ".compact-settings", ".tool-action-bar",
  ".comparison-summary", ".document-content-toggle", ".document-page-view",
];
let server;
let browser;

try {
  await fs.mkdir(artifactDirectory, { recursive: true });
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  browser = await puppeteer.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--force-device-scale-factor=1"],
  });

  const samples = [];
  const pageReports = [];
  for (const profile of profiles) {
    for (const tool of ["security-tools", "work-calculator", "payroll-calculator", "text-formatter", "document-compare"]) {
      const page = await browser.newPage();
      const externalRequests = [];
      const pageErrors = [];
      try {
        page.setDefaultTimeout(60_000);
        await page.setBypassServiceWorker(true);
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
        await page.emulateMediaFeatures([
          { name: "prefers-color-scheme", value: profile.theme },
          { name: "prefers-reduced-motion", value: "reduce" },
        ]);
        await page.evaluateOnNewDocument((locale) => {
          localStorage.setItem("worklazy_privacy_consent", "granted");
          localStorage.setItem("worklazy_lang", locale);
        }, profile.locale);
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          const url = new URL(request.url());
          const allowed = url.origin === new URL(baseUrl).origin || ["data:", "blob:"].includes(url.protocol);
          if (!allowed) externalRequests.push(request.url());
          void (allowed ? request.continue() : request.abort("blockedbyclient"));
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await page.goto(`${baseUrl}/${profile.locale}/tools/${tool}`, { waitUntil: "networkidle0" });
        await page.waitForSelector(`[data-tool-page='${tool}']`, { visible: true });
        await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}" });
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });

        const sampleBase = { tool, locale: profile.locale, theme: profile.theme, viewport: "mobile" };
        if (tool === "security-tools") {
          const checked = await measureSwitches(page, "[data-testid='password-options'] [data-slot='switch']");
          if (checked.length !== 4 || checked.some(({ checked: value }) => !value)) {
            throw new Error(`Expected four checked security switches, received ${JSON.stringify(checked)}.`);
          }
          samples.push(...checked.map((sample) => ({ ...sampleBase, control: "password-option", state: "checked", ...sample })));
          await page.$eval("[data-testid='password-options'] [data-slot='switch']", (element) => element.click());
          await page.waitForFunction(() => document.querySelector("[data-testid='password-options'] [data-slot='switch']")?.getAttribute("aria-checked") === "false");
          const unchecked = await measureSwitches(page, "[data-testid='password-options'] [data-slot='switch']");
          samples.push({ ...sampleBase, control: "password-option", state: "unchecked", ...unchecked[0] });
        } else if (tool === "work-calculator") {
          samples.push(...await measureSegmentOptions(page, "[data-testid='work-mode'] [data-ui-component='segmented-control']", { ...sampleBase, control: "work-mode" }));
          await page.waitForSelector("[data-testid='leave-method'] [data-ui-component='segmented-control']", { visible: true });
          samples.push(...await measureSegmentOptions(page, "[data-testid='leave-method'] [data-ui-component='segmented-control']", { ...sampleBase, control: "leave-method" }));
        } else if (tool === "payroll-calculator") {
          samples.push(...await measureSegmentOptions(page, "[data-testid='payroll-mode'] [data-ui-component='segmented-control']", { ...sampleBase, control: "payroll-mode" }));
        } else if (tool === "text-formatter") {
          samples.push(...await measureSegmentOptions(page, "[data-testid='formatter-settings'] [data-ui-component='segmented-control']", { ...sampleBase, control: "format-kind" }));
        } else {
          const selector = "[data-tool-page='document-compare'] [data-ui-part='toggle-switch']";
          const initial = await measureSwitches(page, selector);
          if (initial.length !== 7) throw new Error(`Expected seven document switches, received ${initial.length}.`);
          samples.push(...initial.map((sample) => ({ ...sampleBase, control: "document-option", state: sample.checked ? "checked" : "unchecked", ...sample })));
          await page.$$eval(selector, (tracks) => tracks[0]?.click());
          await page.waitForFunction((trackSelector, previous) => document.querySelector(trackSelector)?.getAttribute("aria-checked") !== previous, {}, selector, String(initial[0].checked));
          const toggled = await measureSwitches(page, selector);
          samples.push({ ...sampleBase, control: "document-option", state: toggled[0].checked ? "checked" : "unchecked", ...toggled[0] });
        }

        const pageContract = await page.$eval(`[data-tool-page='${tool}']`, (root, selectors) => ({
          legacyMatches: selectors.filter((selector) => root.querySelector(selector)).sort(),
          tracking: {
            google: document.querySelectorAll("script[data-worklazy-google-analytics]").length,
            naver: document.querySelectorAll("script[data-worklazy-naver-analytics]").length,
            adsense: document.querySelectorAll("script[data-worklazy-adsense]").length,
          },
        }), legacySelectors);
        if (pageContract.legacyMatches.length > 0) throw new Error(`${tool} emitted legacy control classes: ${pageContract.legacyMatches.join(", ")}.`);
        if (Object.values(pageContract.tracking).some(Boolean) || externalRequests.length > 0) {
          throw new Error(`${tool} local QA emitted tracking: ${JSON.stringify({ ...pageContract.tracking, externalRequests })}.`);
        }
        if (pageErrors.length > 0) throw new Error(`${tool} emitted page errors: ${pageErrors.join(" | ")}.`);
        pageReports.push({ ...sampleBase, ...pageContract, externalRequests, pageErrors });
      } finally {
        await page.close();
      }
    }
  }

  for (const sample of samples) {
    if (Object.values(sample.overflowPx).some((value) => value > 0.5) || sample.verticalCenterErrorPx > 0.5) {
      throw new Error(`Control geometry escaped its track: ${JSON.stringify(sample)}.`);
    }
  }
  const summaries = Object.fromEntries(["security-tools", "work-calculator", "payroll-calculator", "text-formatter", "document-compare"].map((tool) => {
    const toolSamples = samples.filter((sample) => sample.tool === tool);
    const maxOf = (selector) => Math.max(...toolSamples.map(selector));
    return [tool, {
      samples: toolSamples.length,
      trackSizes: [...new Set(toolSamples.map(({ trackRect }) => `${trackRect.width}x${trackRect.height}`))].sort(),
      indicatorSizes: [...new Set(toolSamples.map(({ indicatorRect }) => `${indicatorRect.width}x${indicatorRect.height}`))].sort(),
      maxOverflowPx: {
        top: maxOf(({ overflowPx }) => overflowPx.top),
        bottom: maxOf(({ overflowPx }) => overflowPx.bottom),
        left: maxOf(({ overflowPx }) => overflowPx.left),
        right: maxOf(({ overflowPx }) => overflowPx.right),
      },
      maxVerticalCenterErrorPx: maxOf(({ verticalCenterErrorPx }) => verticalCenterErrorPx),
      minInsetPx: {
        top: Math.min(...toolSamples.map(({ insetPx }) => insetPx.top)),
        bottom: Math.min(...toolSamples.map(({ insetPx }) => insetPx.bottom)),
        left: Math.min(...toolSamples.map(({ insetPx }) => insetPx.left)),
        right: Math.min(...toolSamples.map(({ insetPx }) => insetPx.right)),
      },
    }];
  }));
  const report = {
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
    profiles,
    legacySelectors,
    summaries,
    samples,
    pages: pageReports,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Control geometry smoke passed: ${samples.length} samples across ${pageReports.length} mobile pages; tracking and legacy control matches 0.`);
  console.log(JSON.stringify(summaries, null, 2));
  console.log(`Evidence: ${reportPath}`);
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

async function measureSwitches(page, selector) {
  return page.$$eval(selector, (tracks) => tracks.map((track) => {
    const indicator = track.querySelector("[data-slot='switch-thumb']");
    if (!(indicator instanceof HTMLElement)) throw new Error("Switch thumb is missing.");
    return {
      label: track.getAttribute("aria-label") || "",
      checked: track.getAttribute("aria-checked") === "true",
      kind: "switch-thumb",
      ...geometry(track, indicator),
    };

    function geometry(trackElement, indicatorElement) {
      const trackRect = trackElement.getBoundingClientRect();
      const indicatorRect = indicatorElement.getBoundingClientRect();
      const round = (value) => Number(value.toFixed(3));
      return {
        trackRect: { x: round(trackRect.x), y: round(trackRect.y), width: round(trackRect.width), height: round(trackRect.height) },
        indicatorRect: { x: round(indicatorRect.x), y: round(indicatorRect.y), width: round(indicatorRect.width), height: round(indicatorRect.height) },
        insetPx: {
          top: round(indicatorRect.top - trackRect.top),
          bottom: round(trackRect.bottom - indicatorRect.bottom),
          left: round(indicatorRect.left - trackRect.left),
          right: round(trackRect.right - indicatorRect.right),
        },
        overflowPx: {
          top: round(Math.max(0, trackRect.top - indicatorRect.top)),
          bottom: round(Math.max(0, indicatorRect.bottom - trackRect.bottom)),
          left: round(Math.max(0, trackRect.left - indicatorRect.left)),
          right: round(Math.max(0, indicatorRect.right - trackRect.right)),
        },
        verticalCenterErrorPx: round(Math.abs((indicatorRect.top + indicatorRect.bottom - trackRect.top - trackRect.bottom) / 2)),
      };
    }
  }));
}

async function measureSegmentOptions(page, trackSelector, base) {
  const optionCount = await page.$$eval(`${trackSelector} > button`, (buttons) => buttons.length);
  const samples = [];
  for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
    await page.$$eval(`${trackSelector} > button`, (buttons, index) => buttons[index]?.click(), optionIndex);
    await page.waitForFunction((selector, index) => document.querySelectorAll(`${selector} > button`)[index]?.getAttribute("aria-pressed") === "true", {}, trackSelector, optionIndex);
    samples.push(await page.$eval(trackSelector, (track, index) => {
      const indicator = track.querySelectorAll(":scope > button")[index];
      if (!(indicator instanceof HTMLElement)) throw new Error(`Selected segment ${index} is missing.`);
      const trackRect = track.getBoundingClientRect();
      const indicatorRect = indicator.getBoundingClientRect();
      const round = (value) => Number(value.toFixed(3));
      return {
        option: indicator.textContent?.trim() || String(index),
        optionIndex: index,
        kind: "selected-segment",
        trackRect: { x: round(trackRect.x), y: round(trackRect.y), width: round(trackRect.width), height: round(trackRect.height) },
        indicatorRect: { x: round(indicatorRect.x), y: round(indicatorRect.y), width: round(indicatorRect.width), height: round(indicatorRect.height) },
        insetPx: {
          top: round(indicatorRect.top - trackRect.top),
          bottom: round(trackRect.bottom - indicatorRect.bottom),
          left: round(indicatorRect.left - trackRect.left),
          right: round(trackRect.right - indicatorRect.right),
        },
        overflowPx: {
          top: round(Math.max(0, trackRect.top - indicatorRect.top)),
          bottom: round(Math.max(0, indicatorRect.bottom - trackRect.bottom)),
          left: round(Math.max(0, trackRect.left - indicatorRect.left)),
          right: round(Math.max(0, indicatorRect.right - trackRect.right)),
        },
        verticalCenterErrorPx: round(Math.abs((indicatorRect.top + indicatorRect.bottom - trackRect.top - trackRect.bottom) / 2)),
      };
    }, optionIndex));
    Object.assign(samples.at(-1), base);
  }
  return samples;
}

async function startPreview() {
  const viteBin = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early (${child.exitCode}): ${output.join("")}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return child;
    } catch {
      // Preview is still starting.
    }
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
