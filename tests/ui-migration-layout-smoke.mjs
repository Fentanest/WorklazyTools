import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const artifactDirectory = path.join(testDirectory, "visual-artifacts", "p2-b3", "diagnostics");
const port = Number.parseInt(process.env.UI_MIGRATION_TEST_PORT || "4176", 10);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
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

  const page = await browser.newPage();
  const externalRequests = [];
  const pageErrors = [];
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1365, height: 900, deviceScaleFactor: 1 });
  await page.setBypassServiceWorker(true);
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: "light" },
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("worklazy_privacy_consent", "granted");
    localStorage.setItem("worklazy_lang", "ko");
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== new URL(baseUrl).origin && !["data:", "blob:"].includes(requestUrl.protocol)) {
      externalRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/ko/tools/document-compare`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-ui-component="toggle-row"] [data-ui-part="toggle-switch"]', { visible: true });
  await page.waitForSelector('[data-testid="document-action-bar"] [data-ui-component="primary-button"]', { visible: true });
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}" });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

  const switches = await page.$$eval('[data-ui-component="toggle-row"] [data-ui-part="toggle-switch"]', (elements) => elements.map((element) => {
    const thumb = element.querySelector('[data-slot="switch-thumb"]');
    const trackRect = element.getBoundingClientRect();
    const thumbRect = thumb?.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      checked: element.getAttribute("aria-checked"),
      track: { width: trackRect.width, height: trackRect.height, radius: style.borderRadius },
      thumb: thumbRect ? {
        width: thumbRect.width,
        height: thumbRect.height,
        leftInset: thumbRect.left - trackRect.left,
        rightInset: trackRect.right - thumbRect.right,
        verticalCenterDelta: Math.abs((thumbRect.top + thumbRect.bottom) / 2 - (trackRect.top + trackRect.bottom) / 2),
      } : null,
    };
  }));

  if (switches.length !== 7) throw new Error(`Expected seven document option switches, received ${switches.length}.`);
  for (const [index, item] of switches.entries()) {
    if (Math.abs(item.track.width - 43) > 0.5 || Math.abs(item.track.height - 25) > 0.5 || Number.parseFloat(item.track.radius) < 12.5) {
      throw new Error(`Switch ${index + 1} is not a 43x25 capsule: ${JSON.stringify(item)}`);
    }
    if (!item.thumb || Math.abs(item.thumb.width - 21) > 0.5 || Math.abs(item.thumb.height - 21) > 0.5
      || item.thumb.leftInset < 1.5 || item.thumb.rightInset < 1.5 || item.thumb.verticalCenterDelta > 0.5) {
      throw new Error(`Switch ${index + 1} thumb left its track or sagged: ${JSON.stringify(item)}`);
    }
  }

  const legacyMatches = await page.$$eval('[data-tool-page="document-compare"]', (roots) => {
    const selectors = [".ios-switch", ".compare-file-grid", ".word-options-grid", ".compact-settings", ".tool-action-bar", ".comparison-prepare-note", ".word-batch-results"];
    return selectors.filter((selector) => roots[0]?.querySelector(selector));
  });
  if (legacyMatches.length) throw new Error(`Document compare emitted legacy classes: ${legacyMatches.join(", ")}`);

  const switchPanel = await page.$('[data-testid="document-options-grid"]');
  await switchPanel.screenshot({ path: path.join(artifactDirectory, "document-compare__ko__light__desktop-switches.png") });

  await page.$eval('[data-testid="document-action-bar"]', (element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const actionBar = await page.$eval('[data-testid="document-action-bar"]', (element) => {
    const button = element.querySelector('[data-ui-component="primary-button"]');
    const copy = element.querySelector('[data-testid="document-action-copy"]');
    const strong = copy?.querySelector("strong");
    const small = copy?.querySelector("small");
    const buttonRect = button?.getBoundingClientRect();
    const copyRect = copy?.getBoundingClientRect();
    const strongRect = strong?.getBoundingClientRect();
    const smallRect = small?.getBoundingClientRect();
    return {
      button: buttonRect ? { width: buttonRect.width, height: buttonRect.height, className: button.className } : null,
      copy: copyRect ? { width: copyRect.width, height: copyRect.height, writingMode: getComputedStyle(copy).writingMode } : null,
      strong: strongRect ? { width: strongRect.width, height: strongRect.height, writingMode: getComputedStyle(strong).writingMode } : null,
      small: smallRect ? { width: smallRect.width, height: smallRect.height, writingMode: getComputedStyle(small).writingMode } : null,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  if (!actionBar.button || Math.abs(actionBar.button.width - 190) > 0.5 || actionBar.button.className.split(/\s+/).includes("w-full")) {
    throw new Error(`Document action button expanded beyond 190px: ${JSON.stringify(actionBar)}`);
  }
  if (!actionBar.copy || actionBar.copy.width < 300 || actionBar.copy.writingMode !== "horizontal-tb"
    || !actionBar.strong || actionBar.strong.width < 250 || actionBar.strong.height > 44 || actionBar.strong.writingMode !== "horizontal-tb"
    || !actionBar.small || actionBar.small.width < 250 || actionBar.small.height > 44 || actionBar.small.writingMode !== "horizontal-tb"
    || actionBar.pageOverflow > 1) {
    throw new Error(`Document action copy collapsed into vertical text: ${JSON.stringify(actionBar)}`);
  }

  const actionPanel = await page.$('[data-testid="document-action-bar"]');
  await actionPanel.screenshot({ path: path.join(artifactDirectory, "document-compare__ko__light__desktop-action-bar.png") });

  await new Promise((resolve) => setTimeout(resolve, 250));
  const tracking = await page.evaluate(() => ({
    google: document.querySelectorAll("script[data-worklazy-google-analytics]").length,
    naver: document.querySelectorAll("script[data-worklazy-naver-analytics]").length,
    adsense: document.querySelectorAll("script[data-worklazy-adsense]").length,
  }));
  if (tracking.google || tracking.naver || tracking.adsense || externalRequests.length) {
    throw new Error(`Local QA build emitted tracking: ${JSON.stringify({ tracking, externalRequests })}`);
  }
  if (pageErrors.length) throw new Error(`Document compare emitted page errors: ${pageErrors.join(" | ")}`);

  const report = {
    url: `${baseUrl}/ko/tools/document-compare`,
    viewport: { width: 1365, height: 900, deviceScaleFactor: 1 },
    switches,
    actionBar,
    legacyMatches,
    tracking,
    externalRequests,
  };
  await fs.writeFile(path.join(artifactDirectory, "document-compare-computed-styles.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`UI migration layout smoke passed: ${switches.length} switches contained, action button ${actionBar.button.width}px, horizontal action copy, legacy matches 0, tracking 0.`);
  console.log(`Evidence: ${artifactDirectory}`);
} finally {
  await browser?.close();
  if (server) await stopServer(server);
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
