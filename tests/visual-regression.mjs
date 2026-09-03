import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

import { visualRegressionConfig as config } from "./visual-regression.config.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const baselineDirectory = path.join(testDirectory, "visual-baselines");
const artifactDirectory = process.env.VISUAL_ARTIFACT_DIR
  ? path.resolve(process.env.VISUAL_ARTIFACT_DIR)
  : path.join(os.tmpdir(), "worklazytools-visual-regression");
const captureDirectory = process.env.VISUAL_CAPTURE_DIR
  ? path.resolve(process.env.VISUAL_CAPTURE_DIR)
  : undefined;
const updateBaselines = process.env.UPDATE_VISUAL_BASELINES === "1";
const externallyManagedBaseUrl = process.env.TEST_BASE_URL;
const port = Number.parseInt(process.env.VISUAL_TEST_PORT || "4174", 10);
const baseUrl = externallyManagedBaseUrl || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`VISUAL_TEST_PORT must be a valid TCP port, received ${process.env.VISUAL_TEST_PORT}.`);
}

const expectedNames = buildCaptureMatrix().map(({ name }) => name);
let server;
let browser;

try {
  await fs.mkdir(baselineDirectory, { recursive: true });
  await fs.rm(artifactDirectory, { recursive: true, force: true });
  await fs.mkdir(artifactDirectory, { recursive: true });
  if (captureDirectory) {
    if (!captureDirectory.startsWith(`${path.join(repositoryRoot, "tests", "visual-artifacts")}${path.sep}`)) {
      throw new Error("VISUAL_CAPTURE_DIR must be a child of tests/visual-artifacts.");
    }
    await fs.rm(captureDirectory, { recursive: true, force: true });
    await fs.mkdir(captureDirectory, { recursive: true });
  }
  if (updateBaselines) await removeUnexpectedBaselines(expectedNames);
  if (!externallyManagedBaseUrl) server = await startPreviewServer();

  browser = await puppeteer.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
    ],
  });

  const failures = [];
  const captures = buildCaptureMatrix();
  for (const [index, capture] of captures.entries()) {
    const result = await captureAndCompare(capture);
    if (result) failures.push(result);
    console.log(`[${index + 1}/${captures.length}] ${capture.name}`);
  }

  await assertBaselineSet(expectedNames);
  const browserVersion = await browser.version();
  const mode = updateBaselines ? "updated" : "matched";
  if (failures.length) {
    throw new Error(`Visual regression failed (${failures.length}/${expectedNames.length}):\n${failures.join("\n")}\nArtifacts: ${artifactDirectory}`);
  }
  console.log(`Visual regression ${mode}: ${expectedNames.length} captures, ${browserVersion}.`);
  console.log(`Threshold: <= ${(config.diff.maxDiffPixelRatio * 100).toFixed(3)}% differing pixels at per-pixel threshold ${config.diff.perPixelThreshold}; antialiasing ignored.`);
  console.log(`Allowed regions: ${config.allowedRegions.map(({ selector }) => selector).join(", ")}.`);
  if (captureDirectory) console.log(`Tool QA captures: ${expectedNames.filter((name) => !name.startsWith("home-default__") && !name.startsWith("tools-media-filter__")).length} in ${captureDirectory}.`);
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

function buildCaptureMatrix() {
  const viewports = new Map(config.viewports.map((viewport) => [viewport.id, viewport]));
  return config.routes.flatMap((route) => route.profiles.map((profile) => {
    const viewport = viewports.get(profile.viewport);
    if (!viewport) throw new Error(`Unknown visual viewport ${profile.viewport} for ${route.id}.`);
    return {
      route,
      locale: profile.locale,
      theme: profile.theme,
      viewport,
      name: `${route.id}__${profile.locale}__${profile.theme}__${viewport.id}.png`,
    };
  }));
}

async function captureAndCompare(capture) {
  const page = await browser.newPage();
  const pageErrors = [];
  try {
    page.setDefaultTimeout(60_000);
    await page.setBypassServiceWorker(true);
    await page.setViewport(capture.viewport);
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: capture.theme },
      { name: "prefers-reduced-motion", value: config.animation.prefersReducedMotion },
    ]);
    await page.evaluateOnNewDocument((locale) => {
      localStorage.setItem("worklazy_privacy_consent", "denied");
      localStorage.setItem("worklazy_lang", locale);
    }, capture.locale);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      const allowed = url.origin === new URL(baseUrl).origin || ["data:", "blob:"].includes(url.protocol);
      void (allowed ? request.continue() : request.abort("blockedbyclient"));
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const captureUrl = new URL(`/${capture.locale}${capture.route.path}`, baseUrl);
    await page.goto(captureUrl.href, { waitUntil: "networkidle0" });
    await page.waitForSelector(capture.route.readySelector, { visible: true });
    await stabilizeRepresentativeState(page, capture.route);
    await page.addStyleTag({ content: buildStabilityCss() });
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(" | ")}`);

    const actualBuffer = await page.screenshot({ type: "png", captureBeyondViewport: false });
    if (captureDirectory && capture.route.kind === "tool") {
      await fs.writeFile(path.join(captureDirectory, capture.name), actualBuffer);
    }
    const baselinePath = path.join(baselineDirectory, capture.name);
    if (updateBaselines) {
      await fs.writeFile(baselinePath, actualBuffer);
      return undefined;
    }

    let baselineBuffer;
    try {
      baselineBuffer = await fs.readFile(baselinePath);
    } catch (error) {
      if (error?.code === "ENOENT") return `${capture.name}: baseline is missing (run UPDATE_VISUAL_BASELINES=1 npm run test:visual).`;
      throw error;
    }
    const expected = PNG.sync.read(baselineBuffer);
    const actual = PNG.sync.read(actualBuffer);
    if (expected.width !== actual.width || expected.height !== actual.height) {
      await fs.writeFile(path.join(artifactDirectory, capture.name.replace(".png", ".actual.png")), actualBuffer);
      return `${capture.name}: dimensions changed from ${expected.width}x${expected.height} to ${actual.width}x${actual.height}.`;
    }

    const diff = new PNG({ width: expected.width, height: expected.height });
    const diffPixels = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
      threshold: config.diff.perPixelThreshold,
      includeAA: config.diff.includeAntialiasing,
    });
    const ratio = diffPixels / (expected.width * expected.height);
    if (ratio <= config.diff.maxDiffPixelRatio) return undefined;

    const stem = capture.name.replace(/\.png$/, "");
    await Promise.all([
      fs.writeFile(path.join(artifactDirectory, `${stem}.actual.png`), actualBuffer),
      fs.writeFile(path.join(artifactDirectory, `${stem}.diff.png`), PNG.sync.write(diff)),
    ]);
    return `${capture.name}: ${diffPixels} pixels differ (${(ratio * 100).toFixed(4)}% > ${(config.diff.maxDiffPixelRatio * 100).toFixed(3)}%).`;
  } finally {
    await page.close();
  }
}

async function stabilizeRepresentativeState(page, route) {
  if (route.toolId !== "security-tools") return;
  await page.$eval(".password-output input", (input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Worklazy2!Safe#Tool9");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector(".password-output input")?.value === "Worklazy2!Safe#Tool9");
}

async function removeUnexpectedBaselines(expected) {
  const expectedSet = new Set(expected);
  const actual = (await fs.readdir(baselineDirectory)).filter((name) => name.endsWith(".png"));
  await Promise.all(actual
    .filter((name) => !expectedSet.has(name))
    .map((name) => fs.unlink(path.join(baselineDirectory, name))));
}

function buildStabilityCss() {
  const allowedSelectors = config.allowedRegions.map(({ selector }) => selector).join(",\n");
  return `
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      caret-color: transparent !important;
      scroll-behavior: auto !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
    }
    ${allowedSelectors} { visibility: hidden !important; }
  `;
}

async function assertBaselineSet(expected) {
  const actual = (await fs.readdir(baselineDirectory)).filter((name) => name.endsWith(".png")).sort();
  const expectedSorted = [...expected].sort();
  const missing = expectedSorted.filter((name) => !actual.includes(name));
  const unexpected = actual.filter((name) => !expectedSorted.includes(name));
  if (missing.length || unexpected.length) {
    throw new Error(`Visual baseline set is not reproducible. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`);
  }
}

async function startPreviewServer() {
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
  try {
    await waitForServer(child);
    return child;
  } catch (error) {
    await stopServer(child);
    throw new Error(`${error.message}\n${output.join("").trim()}`);
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited with code ${child.exitCode} before becoming ready.`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The fixed local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${baseUrl}.`);
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
