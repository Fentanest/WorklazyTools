import { spawn } from "node:child_process";
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
  await page.evaluateOnNewDocument(() => localStorage.setItem("worklazy_privacy_consent", "denied"));
  await page.goto(new URL("/ko/tools/excel-compare", baseUrl).href, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="excel-compare-page"]', { visible: true });
  const injectedStyle = await page.addStyleTag({ content: ".main-content { padding-bottom: 0 !important; }" });

  let detectedFailure;
  try {
    await assertMobileBottomLayout(page, {
      bottomTargetSelector: ".excel-compare-page > :last-child",
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
    bottomTargetSelector: ".excel-compare-page > :last-child",
    scenarioId: "negative-control-restored",
  });
  console.log(JSON.stringify({ detectedFailure, restoredMetrics }, null, 2));
  console.log("Mobile bottom negative control passed: reduced padding failed and the restored page passed.");
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

async function startPreviewServer() {
  const viteBin = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none", TZ: "UTC" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  child.unref();
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Vite exited with code ${child.exitCode}.`);
      try {
        const response = await fetch(baseUrl);
        if (response.ok) return child;
      } catch {
        // The local preview is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${baseUrl}.`);
  } catch (error) {
    await stopServer(child);
    throw new Error(`${error.message}\n${output.join("").trim()}`);
  }
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
