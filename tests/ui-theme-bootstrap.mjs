// W0 theme bootstrap contract: pre-paint init, 4-theme cycle order, storage
// persistence, invalid-value fallback, write-failure behavior.
// Usage: TEST_BASE_URL=http://127.0.0.1:4230 node tests/ui-theme-bootstrap.mjs [--out out.json]
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const distDirectory = path.resolve(process.env.UI_THEME_DIST_DIR || path.join(repositoryRoot, "dist"));
const port = Number(process.env.UI_THEME_TEST_PORT ?? "4230");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex === -1 ? undefined : args[outIndex + 1];
let server;
const checks = [];
const check = (name) => { checks.push(name); console.log("PASS", name); };

try {
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  try {
    // Pre-paint init from storage seed without remount markers.
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: "ko-KR" });
    await context.addInitScript(() => localStorage.setItem("worklazy-theme", "dark-mint"));
    const page = await context.newPage();
    await page.goto(`${baseUrl}/ko/tools/`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark-mint");
    assert.equal(await page.evaluate(() => document.documentElement.style.colorScheme), "dark");
    check("storage seed applies before paint");
    await context.close();

    // Cycle order through all four themes and back.
    const context2 = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: "en-US" });
    const page2 = await context2.newPage();
    await page2.goto(`${baseUrl}/en/tools/`, { waitUntil: "networkidle" });
    const seen = [await page2.evaluate(() => document.documentElement.getAttribute("data-theme"))];
    for (let step = 0; step < 4; step += 1) {
      await page2.locator(".theme-cycle").first().click();
      seen.push(await page2.evaluate(() => document.documentElement.getAttribute("data-theme")));
    }
    assert.deepEqual(seen, ["light-coral", "dark-coral", "light-mint", "dark-mint", "light-coral"]);
    check("four-theme cycle order wraps around");
    const label = await page2.locator(".theme-cycle").first().getAttribute("aria-label");
    assert.ok(label && label.length > 0, "cycle button exposes the next theme name");
    check("cycle button labels the next theme");

    // Persistence across reload.
    await page2.locator(".theme-cycle").first().click();
    await page2.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page2.evaluate(() => document.documentElement.getAttribute("data-theme")), "dark-coral");
    check("selected theme persists across reload");
    await context2.close();

    // Invalid stored value falls back to the default theme.
    const context3 = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: "ko-KR" });
    await context3.addInitScript(() => localStorage.setItem("worklazy-theme", "midnight-neon"));
    const page3 = await context3.newPage();
    await page3.goto(`${baseUrl}/ko/tools/`, { waitUntil: "domcontentloaded" });
    assert.equal(await page3.evaluate(() => document.documentElement.getAttribute("data-theme")), "light-coral");
    check("invalid stored value falls back to light-coral");
    await context3.close();

    // Blocked storage keeps the current tab theme.
    const context4 = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: "ko-KR" });
    await context4.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException("denied", "SecurityError"); };
    });
    const page4 = await context4.newPage();
    await page4.goto(`${baseUrl}/ko/tools/`, { waitUntil: "networkidle" });
    const before = await page4.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await page4.locator(".theme-cycle").first().click();
    const after = await page4.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert.notEqual(after, before);
    check("blocked storage keeps the current tab theme");
    await context4.close();
  } finally {
    await browser.close();
  }
  console.log(`Theme bootstrap contract passed: ${checks.length} checks.`);
  if (out) await fs.writeFile(out, `${JSON.stringify({ checks }, null, 1)}\n`);
} finally {
  if (server) await stopServer(server);
}

async function startPreview() {
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--outDir", distDirectory, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
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
