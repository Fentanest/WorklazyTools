import { startOwnedPreview, stopOwnedPreview } from "./helpers/owned-preview.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

import { assertMobileBottomLayout } from "./mobile-bottom-assertion.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number.parseInt(process.env.VISUAL_BOTTOM_TEST_PORT || "4176", 10);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

try {
  if (!process.env.TEST_BASE_URL) server = await startPreviewServer();
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1", "--lang=ko-KR"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent_v2", "denied"));
  await page.goto(new URL("/ko/tools/excel-compare", baseUrl).href, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="excel-compare-page"]', { visible: true });
  const injectedStyle = await page.addStyleTag({ content: ".main-content { padding-bottom: 0 !important; }" });

  let detectedFailure;
  try {
    await assertMobileBottomLayout(page, {
      bottomTargetSelector: "[data-testid='excel-compare-page'] > :last-child",
      scenarioId: "negative-control-reduced-padding",
    });
  } catch (error) {
    detectedFailure = error instanceof Error ? error.message : String(error);
  }
  if (!detectedFailure?.includes("main bottom padding")) {
    throw new Error(`Reduced padding was not rejected by the shared assertion: ${detectedFailure || "no failure"}`);
  }

  await injectedStyle.evaluate((element) => element.remove());
  const restoredMetrics = await assertMobileBottomLayout(page, {
    bottomTargetSelector: "[data-testid='excel-compare-page'] > :last-child",
    scenarioId: "negative-control-restored",
  });
  console.log(JSON.stringify({ detectedFailure, restoredMetrics }, null, 2));
  console.log("Mobile bottom negative control passed: reduced padding failed and the restored page passed.");
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

async function startPreviewServer() {
  return startOwnedPreview({ repositoryRoot, port, env: { TZ: "UTC" } });
}

async function stopServer(child) {
  await stopOwnedPreview(child);
}
