import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

import { assertMobileBottomLayout, assertScrollAtBottom } from "./mobile-bottom-assertion.mjs";
import { qaCaptureScenarios, qrBulkQaScenarios, visualRegressionConfig as config } from "./visual-regression.config.mjs";
import {
  buildVisualStateDistribution,
  filterVisualScenarios,
  parseVisualOnly,
  resolveVisualConcurrency,
} from "./visual-regression-options.mjs";

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
const qrBulkCaptureOnly = process.env.VISUAL_QR_BULK_CAPTURE_ONLY === "1";
const qaCaptureOnly = process.env.VISUAL_QA_CAPTURE_ONLY === "1";
const qrBulkBaselinesOnly = process.env.VISUAL_QR_BULK_BASELINES_ONLY === "1";
const captureOnly = qrBulkCaptureOnly || qaCaptureOnly;
const consentValue = process.env.VISUAL_CONSENT_GRANTED === "1" ? "granted" : "denied";
const externallyManagedBaseUrl = process.env.TEST_BASE_URL;
const port = Number.parseInt(process.env.VISUAL_TEST_PORT || "4174", 10);
const baseUrl = externallyManagedBaseUrl || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const concurrency = resolveVisualConcurrency(process.env.VISUAL_CONCURRENCY, os.availableParallelism());
const visualOnly = parseVisualOnly(process.env.VISUAL_ONLY);
const runStartedAt = performance.now();

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`VISUAL_TEST_PORT must be a valid TCP port, received ${process.env.VISUAL_TEST_PORT}.`);
}

if (captureOnly && !captureDirectory) throw new Error("Visual capture-only mode requires VISUAL_CAPTURE_DIR.");
if (captureOnly && updateBaselines) throw new Error("QA captures cannot update the scenario baseline set.");
if (qrBulkBaselinesOnly && !updateBaselines) throw new Error("VISUAL_QR_BULK_BASELINES_ONLY is available only while updating baselines.");
if (captureOnly && qrBulkBaselinesOnly) throw new Error("Capture-only and baseline-only modes cannot be combined.");
if (qrBulkCaptureOnly && qaCaptureOnly) throw new Error("QR bulk and bundle QA capture-only modes cannot be combined.");
if (qaCaptureOnly && visualOnly.length === 0) throw new Error("Bundle QA capture-only mode requires VISUAL_ONLY to identify the reviewed routes or tools.");

const baselineNames = buildCaptureMatrix(config.scenarios).map(({ name }) => name);
const availableCaptureScenarios = qrBulkCaptureOnly
  ? qrBulkQaScenarios
  : qaCaptureOnly
    ? qaCaptureScenarios
  : qrBulkBaselinesOnly
    ? config.scenarios.filter(({ toolId, stateType }) => toolId === "qr-studio" && stateType === "interaction")
    : config.scenarios;
const captureScenarios = filterVisualScenarios(availableCaptureScenarios, visualOnly);
const stateDistribution = buildVisualStateDistribution(captureScenarios);
if (qaCaptureOnly) {
  const missingStateTypes = ["initial", "bottom", "interaction"].filter((stateType) => !stateDistribution.stateTypes[stateType]);
  if (missingStateTypes.length > 0) {
    throw new Error(`Bundle QA capture selection is missing required state types: ${missingStateTypes.join(", ")}.`);
  }
}
const captures = buildCaptureMatrix(captureScenarios);
const expectedNames = captures.map(({ name }) => name);
const captureBatches = buildCaptureBatches(captures, config.environment.maxCapturesPerBrowser);
const effectiveConcurrency = Math.min(concurrency.value, captureBatches.length);
let server;
let serverOutput = [];
const browsers = new Set();
const completedIndexes = new Set();
let completed = 0;
let runError;

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
  if (updateBaselines) await removeUnexpectedBaselines(baselineNames);
  if (!externallyManagedBaseUrl) server = await startPreviewServer();

  const failures = new Map();
  const infrastructureFailures = [];
  const browserVersions = new Set();
  await runWithConcurrency(captureBatches, concurrency.value, async (batch) => {
    let browser;
    try {
      browser = await launchLocaleBrowser(batch.locale);
      browsers.add(browser);
      browserVersions.add(await browser.version());
      for (const { capture, index } of batch.entries) {
        try {
          const result = await captureAndCompare(capture, browser);
          if (result) failures.set(index, result);
        } catch (error) {
          failures.set(index, error instanceof Error ? error.message : String(error));
        } finally {
          completedIndexes.add(index);
          completed = completedIndexes.size;
          console.log(`[${completed}/${captures.length}] ${capture.name}`);
        }
      }
    } catch (error) {
      for (const { capture, index } of batch.entries) {
        if (completedIndexes.has(index)) continue;
        failures.set(index, `${capture.name}: locale browser failed: ${error instanceof Error ? error.message : String(error)}`);
        completedIndexes.add(index);
        completed = completedIndexes.size;
        console.log(`[${completed}/${captures.length}] ${capture.name}`);
      }
    } finally {
      if (browser) {
        browsers.delete(browser);
        try {
          await browser.close();
        } catch (error) {
          infrastructureFailures.push(`Locale browser cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  });

  const mode = updateBaselines ? "updated" : "matched";
  if (failures.size || infrastructureFailures.length) {
    const orderedFailures = [...failures].sort(([left], [right]) => left - right).map(([, failure]) => failure);
    throw new Error(`Visual regression failed (${failures.size}/${expectedNames.length} captures, ${infrastructureFailures.length} infrastructure errors):\n${[...orderedFailures, ...infrastructureFailures].join("\n")}\nArtifacts: ${artifactDirectory}`);
  }
  if (!captureOnly) await assertBaselineSet(baselineNames);
  const browserVersion = [...browserVersions].join(", ") || "unknown browser";
  console.log(captureOnly
    ? `${qaCaptureOnly ? "Bundle" : "Bulk QR"} local QA captured: ${expectedNames.length} captures, ${browserVersion}.`
    : `Visual regression ${mode}: ${expectedNames.length} captures, ${browserVersion}.`);
  console.log(`Threshold: <= ${(config.diff.maxDiffPixelRatio * 100).toFixed(3)}% differing pixels at per-pixel threshold ${config.diff.perPixelThreshold}; antialiasing ignored.`);
  console.log(`Allowed regions: ${config.allowedRegions.map(({ selector }) => selector).join(", ")}.`);
  console.log(`Environment: locale-specific browser workers (${Object.values(config.environment.locales).map(({ browserLocale }) => browserLocale).join(", ")}), recycled every ${config.environment.maxCapturesPerBrowser} captures; Accept-Language and navigator locale fixed, timezone ${config.environment.timezone}, DPR 1, font ${config.environment.fontFamily}, ${config.environment.settleTimeMs} ms paint settle.`);
  if (qaCaptureOnly) {
    console.log(`QA state distribution: ${Object.entries(stateDistribution.stateTypes).map(([state, count]) => `${state}=${count}`).join(", ")}.`);
    console.log(`QA stateId distribution: ${Object.entries(stateDistribution.stateIds).map(([state, count]) => `${state}=${count}`).join(", ")}.`);
  }
  if (captureDirectory) console.log(`QA captures: ${expectedNames.length} in ${captureDirectory}.`);
} catch (error) {
  if (server?.exitCode !== null && server?.exitCode !== undefined) {
    runError = new Error(`${error instanceof Error ? error.message : String(error)}\nVite preview exited with code ${server.exitCode}.\n${serverOutput.join("").trim()}`, { cause: error });
  } else {
    runError = error;
  }
} finally {
  const cleanupResults = await Promise.allSettled([...browsers].map((browser) => browser.close()));
  const cleanupFailure = cleanupResults.find(({ status }) => status === "rejected");
  if (server) {
    try {
      await stopServer(server);
    } catch (error) {
      if (!runError) runError = error;
    }
  }
  if (!runError && cleanupFailure?.status === "rejected") runError = cleanupFailure.reason;
}

if (runError) {
  console.error(runError instanceof Error ? runError.stack : runError);
  process.exitCode = 1;
}
console.log(buildRunReport({
  completed,
  concurrency,
  durationMs: performance.now() - runStartedAt,
  effectiveConcurrency,
  filterTerms: visualOnly,
  total: captures.length,
}));

function buildCaptureMatrix(scenarios) {
  const viewports = new Map(config.viewports.map((viewport) => [viewport.id, viewport]));
  const matrix = scenarios.flatMap((scenarioDefinition) => scenarioDefinition.profiles.map((profile) => {
    const viewport = viewports.get(profile.viewport);
    if (!viewport) throw new Error(`Unknown visual viewport ${profile.viewport} for ${scenarioDefinition.scenarioId}.`);
    return {
      scenario: scenarioDefinition,
      locale: profile.locale,
      theme: profile.theme,
      viewport,
      name: `${scenarioDefinition.routeId}__${scenarioDefinition.stateId}__${profile.locale}__${profile.theme}__${viewport.id}.png`,
    };
  }));
  const names = matrix.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new Error("Visual scenario matrix produced duplicate capture names; stateId values must be unique per route.");
  return matrix;
}

function buildCaptureBatches(matrix, maxCapturesPerBrowser) {
  const localeEntries = new Map();
  matrix.forEach((capture, index) => {
    if (!localeEntries.has(capture.locale)) localeEntries.set(capture.locale, []);
    localeEntries.get(capture.locale).push({ capture, index });
  });
  const batchesByLocale = [...localeEntries].map(([locale, entries]) => {
    const batches = [];
    for (let offset = 0; offset < entries.length; offset += maxCapturesPerBrowser) {
      batches.push({ locale, entries: entries.slice(offset, offset + maxCapturesPerBrowser) });
    }
    return batches;
  });
  const batches = [];
  while (batchesByLocale.some((localeBatches) => localeBatches.length > 0)) {
    for (const localeBatches of batchesByLocale) {
      const batch = localeBatches.shift();
      if (batch) batches.push(batch);
    }
  }
  return batches;
}

async function runWithConcurrency(items, limit, task) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index]);
    }
  });
  await Promise.all(workers);
}

function buildRunReport({ completed: completedCaptures, concurrency: resolvedConcurrency, durationMs, effectiveConcurrency: activeConcurrency, filterTerms, total }) {
  const durationSeconds = durationMs / 1_000;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds - minutes * 60;
  const filter = filterTerms.length > 0 ? filterTerms.join(",") : "all";
  const concurrencySource = resolvedConcurrency.source === "cpu-default"
    ? `CPU default from ${resolvedConcurrency.availableCpuCount} cores`
    : "VISUAL_CONCURRENCY";
  return `Visual run report: duration=${minutes}m ${seconds.toFixed(2)}s; captures=${completedCaptures}/${total}; concurrency=${resolvedConcurrency.value} (${concurrencySource}, effective ${activeConcurrency}); filter=${filter}.`;
}

async function launchLocaleBrowser(locale) {
  const localeEnvironment = config.environment.locales[locale];
  if (!localeEnvironment) throw new Error(`No deterministic browser locale configuration exists for ${locale}.`);
  return puppeteer.launch({
    executablePath: chromeExecutable,
    headless: true,
    env: {
      ...process.env,
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      LANGUAGE: localeEnvironment.browserLocale,
      TZ: config.environment.timezone,
    },
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      `--lang=${localeEnvironment.browserLocale}`,
    ],
  });
}

async function captureAndCompare(capture, browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  const externalRequests = [];
  try {
    const localeEnvironment = config.environment.locales[capture.locale];
    page.setDefaultTimeout(60_000);
    await page.setBypassServiceWorker(true);
    await page.setViewport(capture.viewport);
    await page.emulateTimezone(config.environment.timezone);
    await page.setExtraHTTPHeaders({ "Accept-Language": localeEnvironment.acceptLanguage });
    const client = await page.createCDPSession();
    await client.send("Emulation.setLocaleOverride", { locale: localeEnvironment.browserLocale });
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: capture.theme },
      { name: "prefers-reduced-motion", value: config.animation.prefersReducedMotion },
    ]);
    await page.evaluateOnNewDocument((locale, consent) => {
      localStorage.setItem("worklazy_privacy_consent", consent);
      localStorage.setItem("worklazy_lang", locale);
    }, capture.locale, consentValue);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      const allowed = url.origin === new URL(baseUrl).origin || ["data:", "blob:"].includes(url.protocol);
      if (!allowed) externalRequests.push(request.url());
      void (allowed ? request.continue() : request.abort("blockedbyclient"));
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const captureUrl = new URL(`/${capture.locale}${capture.scenario.path}`, baseUrl);
    await page.goto(captureUrl.href, { waitUntil: "networkidle0" });
    await page.waitForSelector(capture.scenario.readySelector, { visible: true });
    await applyScenarioFixture(page, capture.scenario.fixture);
    await performScenarioActions(page, capture.scenario.actions, capture.scenario.fixture);
    await page.waitForSelector(capture.scenario.assertSelector, { visible: true });
    await page.addStyleTag({ content: buildStabilityCss() });
    const environment = await page.evaluate(async (fontFamily) => {
      const loadedFaces = document.fonts ? await document.fonts.load(`16px "${fontFamily}"`, "Worklazy 시각 기준") : [];
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        language: navigator.language,
        languages: navigator.languages,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fontLoaded: loadedFaces.length > 0,
      };
    }, config.environment.fontFamily);
    if (environment.language.toLowerCase() !== localeEnvironment.browserLocale.toLowerCase()) {
      throw new Error(`navigator.language is ${environment.language}; expected ${localeEnvironment.browserLocale}.`);
    }
    if (environment.timezone !== config.environment.timezone) {
      throw new Error(`Browser timezone is ${environment.timezone}; expected ${config.environment.timezone}.`);
    }
    if (!environment.fontLoaded) throw new Error(`Deterministic visual font ${config.environment.fontFamily} did not load.`);
    await page.evaluate((settleTimeMs) => new Promise((resolve) => {
      window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), settleTimeMs);
    }), config.environment.settleTimeMs);
    let bottomMetrics;
    if (capture.scenario.stateType === "bottom") {
      bottomMetrics = await assertScrollAtBottom(page, { scenarioId: capture.scenario.scenarioId });
      if (capture.viewport.id === "mobile") {
        bottomMetrics = {
          ...bottomMetrics,
          mobileLayout: await assertMobileBottomLayout(page, {
            bottomTargetSelector: capture.scenario.bottomTargetSelector,
            scenarioId: capture.scenario.scenarioId,
          }),
        };
      }
    } else if (!capture.scenario.actions.some(({ type }) => type === "scroll-into-view")) {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(" | ")}`);
    if (externalRequests.length) throw new Error(`External requests attempted: ${externalRequests.join(" | ")}`);

    const actualBuffer = await page.screenshot({ type: "png", captureBeyondViewport: false });
    if (captureDirectory) {
      await fs.writeFile(path.join(captureDirectory, capture.name), actualBuffer);
    }
    if (captureOnly) return undefined;
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
    return `${capture.name}: ${diffPixels} pixels differ (${(ratio * 100).toFixed(4)}% > ${(config.diff.maxDiffPixelRatio * 100).toFixed(3)}%).${bottomMetrics ? ` Bottom metrics: ${JSON.stringify(bottomMetrics)}.` : ""}`;
  } catch (error) {
    const details = [
      `${capture.name}: ${error instanceof Error ? error.message : String(error)}`,
      pageErrors.length ? `Page errors: ${pageErrors.join(" | ")}` : null,
      externalRequests.length ? `External requests: ${externalRequests.join(" | ")}` : null,
      `URL: ${page.url()}`,
    ].filter(Boolean);
    throw new Error(details.join("\n"), { cause: error });
  } finally {
    await page.close();
  }
}

async function applyScenarioFixture(page, fixture) {
  if (!fixture) return;
  if (fixture.kind === "deterministic-password") {
    await page.$eval("[data-testid='password-output'] input", (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, fixture.value);
    await page.waitForFunction((value) => document.querySelector("[data-testid='password-output'] input")?.value === value, {}, fixture.value);
  }
}

async function performScenarioActions(page, actions, fixture) {
  for (const action of actions) {
    if (action.type === "click") {
      if (Number.isInteger(action.elementIndex)) {
        await page.$$eval(action.selector, (elements, index) => {
          const element = elements[index];
          if (!(element instanceof HTMLElement)) throw new Error(`Clickable element ${index} is missing.`);
          element.click();
        }, action.elementIndex);
      } else {
        await page.click(action.selector);
      }
    } else if (action.type === "click-option") {
      await page.$eval(action.selector, (root, optionIndex) => {
        const option = root.querySelectorAll("button")[optionIndex];
        if (!(option instanceof HTMLButtonElement)) throw new Error(`Option ${optionIndex} is missing.`);
        option.click();
      }, action.optionIndex);
    } else if (action.type === "select") {
      const selected = await page.select(action.selector, action.value);
      if (!selected.includes(action.value)) throw new Error(`${action.selector} could not select ${action.value}.`);
    } else if (action.type === "select-index") {
      await page.$eval(action.selector, (select, optionIndex) => {
        if (!(select instanceof HTMLSelectElement) || !select.options[optionIndex]) throw new Error(`Select option ${optionIndex} is missing.`);
        select.value = select.options[optionIndex].value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }, action.optionIndex);
    } else if (action.type === "replace-text") {
      await page.$eval(action.selector, (element, value) => {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) throw new Error("Text replacement target is not an input or textarea.");
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (!setter) throw new Error("Text replacement setter is unavailable.");
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, action.value);
    } else if (action.type === "upload") {
      await uploadScenarioFixture(page, action.selector, fixture);
    } else if (action.type === "wait") {
      await page.waitForSelector(action.selector, { visible: true });
    } else if (action.type === "wait-enabled") {
      await page.waitForFunction((selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLButtonElement && !element.disabled;
      }, {}, action.selector);
    } else if (action.type === "wait-value-includes") {
      await page.waitForFunction((selector, value) => {
        const element = document.querySelector(selector);
        return (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value.includes(value);
      }, {}, action.selector, action.value);
    } else if (action.type === "wait-shadow-canvas") {
      await page.waitForFunction((selector) => {
        const container = document.querySelector(selector);
        const host = container?.firstElementChild;
        const canvases = host?.shadowRoot ? [...host.shadowRoot.querySelectorAll("canvas")] : [];
        return canvases.length > 0 && canvases.every((canvas) => canvas.width > 0 && canvas.height > 0);
      }, {}, action.selector);
    } else if (action.type === "scroll-into-view") {
      await page.$eval(action.selector, (element, offset) => {
        element.scrollIntoView({ block: "start" });
        window.scrollBy(0, offset);
      }, action.offset ?? 0);
    } else if (action.type === "scroll-bottom") {
      await page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTo(0, (document.scrollingElement ?? document.documentElement).scrollHeight));
    } else if (action.type === "assert-path") {
      const actualPath = new URL(page.url()).pathname.replace(/\/$/, "");
      if (actualPath !== action.pathname) throw new Error(`Expected redirect to ${action.pathname}, received ${actualPath}.`);
    } else {
      throw new Error(`Unsupported visual scenario action ${action.type}.`);
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}

async function uploadScenarioFixture(page, selector, fixture) {
  if (!fixture) throw new Error(`Upload action for ${selector} has no fixture.`);
  if (fixture.kind === "file") {
    const input = await page.$(selector);
    if (!input) throw new Error(`Upload input ${selector} is missing.`);
    await input.uploadFile(path.resolve(testDirectory, fixture.path));
    return;
  }
  let bytes;
  if (fixture.kind === "base64-file") bytes = Buffer.from((await fs.readFile(path.resolve(testDirectory, fixture.path), "utf8")).trim(), "base64");
  else if (fixture.kind === "inline-file") bytes = Buffer.from(fixture.contents, "utf8");
  else if (fixture.kind === "generated-wav") bytes = createVisualWav(fixture);
  else if (fixture.kind === "generated-png") bytes = createVisualPng(fixture);
  else throw new Error(`Fixture kind ${fixture.kind} cannot be uploaded.`);
  await page.$eval(selector, (input, payload) => {
    if (!(input instanceof HTMLInputElement)) throw new Error("Visual fixture upload target is not an input.");
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(payload.bytes)], payload.fileName, { type: payload.mimeType }));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, {
    bytes: [...bytes],
    fileName: fixture.fileName,
    mimeType: fixture.mimeType ?? (fixture.kind === "generated-png" ? "image/png" : "audio/wav"),
  });
}

function createVisualPng({ width, height }) {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = 21;
    png.data[offset + 1] = 155;
    png.data[offset + 2] = 215;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
}

function createVisualWav({ durationSeconds, sampleRate }) {
  const sampleCount = Math.round(durationSeconds * sampleRate);
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 8_000), 44 + index * 2);
  }
  return buffer;
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
    @font-face {
      font-family: "${config.environment.fontFamily}";
      src: url("${config.environment.fontUrl}") format("opentype");
      font-display: block;
      font-style: normal;
      font-weight: 100 900;
    }
    :root { font-family: "${config.environment.fontFamily}", sans-serif !important; }
    input[type="file"], input[type="file"]::file-selector-button { font-family: "${config.environment.fontFamily}", sans-serif !important; }
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
    env: { ...process.env, BROWSER: "none", TZ: config.environment.timezone },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverOutput = [];
  child.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
  child.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));
  child.unref();
  try {
    await waitForServer(child);
    return child;
  } catch (error) {
    await stopServer(child);
    throw new Error(`${error.message}\n${serverOutput.join("").trim()}`);
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 30_000;
  const expectedServerAddress = `http://127.0.0.1:${port}/`;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited with code ${child.exitCode} before becoming ready.`);
    if (!serverOutput.join("").includes(expectedServerAddress)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok && child.exitCode === null) return;
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
