// W1a primitive contract verification against the real public components.
// Dev-only fixture (tests/ui-primitives-fixture.html) served by vite dev;
// never ships to dist. Matrix: 4 themes x ko/en x desktop/mobile.
// Usage: node tests/ui-primitives-browser.mjs [--out out.json]
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number(process.env.UI_PRIMITIVES_PORT ?? "4231");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex === -1 ? undefined : args[outIndex + 1];
const THEMES = ["light-coral", "dark-coral", "light-mint", "dark-mint"];
const LOCALES = ["ko", "en"];
const VIEWPORTS = { desktop: { width: 1365, height: 900 }, mobile: { width: 390, height: 844 } };
let server;
const passed = [];

try {
  if (!process.env.TEST_BASE_URL) server = await startDevServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  try {
    for (const theme of THEMES) {
      for (const locale of LOCALES) {
        for (const viewport of Object.keys(VIEWPORTS)) {
          const tag = `${theme}/${locale}/${viewport}`;
          const context = await browser.newContext({ viewport: VIEWPORTS[viewport], locale: locale === "ko" ? "ko-KR" : "en-US" });
          await context.addInitScript((seed) => localStorage.setItem("worklazy-theme", seed), theme);
          const page = await context.newPage();
          page.setDefaultTimeout(30_000);
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto(`${baseUrl}/tests/ui-primitives-fixture.html`, { waitUntil: "networkidle" });
          assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), theme);

          // Button: single activation, no keydown double-fire.
          assert.equal(await page.locator("[data-testid='button-basic']").innerText(), "Click");
          assert.equal(await page.locator("[data-testid='tg-a']").innerText(), "A");
          assert.equal(await page.locator("[data-testid='tg-b']").innerText(), "B");
          await page.locator("[data-testid='button-basic']").click();
          assert.equal(await page.locator("[data-testid='button-count']").innerText(), "1");
          await page.locator("[data-testid='button-basic']").focus();
          await page.keyboard.press("Enter");
          await page.keyboard.press("Space");
          assert.equal(await page.locator("[data-testid='button-count']").innerText(), "3");
          passed.push(`${tag} button activates once per click/Enter/Space`);
          // Busy keeps label, exposes aria-busy, blocks activation.
          assert.equal(await page.locator("[data-testid='button-busy']").getAttribute("aria-busy"), "true");
          assert.ok((await page.locator("[data-testid='button-busy']").innerText()).includes("Busy"));
          assert.equal(await page.locator("[data-testid='button-busy'] svg[aria-hidden='true']").count(), 1);
          await page.locator("[data-testid='button-busy']").dispatchEvent("click");
          assert.equal(await page.locator("[data-testid='button-count']").innerText(), "3");
          passed.push(`${tag} busy blocks with label and hidden spinner`);
          // Disabled blocks; anchor keeps destination; disabled anchor drops it.
          await page.locator("[data-testid='button-disabled']").dispatchEvent("click");
          assert.equal(await page.locator("[data-testid='button-count']").innerText(), "3");
          const anchor = page.locator("[data-testid='button-anchor']");
          assert.equal(await anchor.evaluate((node) => node.tagName.toLowerCase()), "a");
          assert.equal(await anchor.getAttribute("href"), "https://example.com/page");
          assert.equal(await anchor.getAttribute("target"), "_blank");
          const blocked = page.locator("[data-testid='button-anchor-disabled']");
          assert.equal(await blocked.getAttribute("href"), null);
          assert.equal(await blocked.getAttribute("aria-disabled"), "true");
          assert.equal(await blocked.getAttribute("tabindex"), "-1");
          passed.push(`${tag} disabled and anchor contracts hold`);
          assert.equal(await page.locator("[data-testid='button-submit']").getAttribute("type"), "submit");
          assert.equal(await page.locator("button button").count(), 0);
          // Switch: uncontrolled toggle, controlled rejection, readonly, disabled.
          await page.locator("[data-testid='switch-uncontrolled']").click();
          assert.equal(await page.locator("[data-testid='switch-uncontrolled-state']").innerText(), "on");
          assert.equal(await page.locator("[data-testid='switch-uncontrolled']").getAttribute("aria-checked"), "true");
          await page.locator("[data-testid='switch-controlled']").click();
          assert.equal(await page.locator("[data-testid='switch-controlled']").getAttribute("aria-checked"), "false");
          passed.push(`${tag} switch toggles uncontrolled and honors controlled rejection`);
          await page.locator("[data-testid='switch-readonly']").focus();
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "switch-readonly");
          await page.keyboard.press("Space");
          assert.equal(await page.locator("[data-testid='switch-readonly']").getAttribute("aria-checked"), "false");
          assert.equal(await page.locator("[data-testid='switch-readonly']").getAttribute("aria-readonly"), "true");
          await page.locator("[data-testid='switch-disabled']").dispatchEvent("click");
          assert.equal(await page.locator("[data-testid='switch-disabled']").getAttribute("aria-checked"), "false");
          passed.push(`${tag} switch readonly/disabled contracts hold`);
          // Switch geometry from the contract table.
          for (const [id, track, thumb] of [["switch-uncontrolled", [43, 25], 21], ["switch-sm", [36, 22], 18]]) {
            const box = await page.locator(`[data-testid='${id}']`).boundingBox();
            const thumbBox = await page.locator(`[data-testid='${id}'] [data-slot='switch-thumb']`).boundingBox();
            assert.ok(Math.abs(box.width - track[0]) <= 1 && Math.abs(box.height - track[1]) <= 1, `${tag} ${id} track geometry`);
            assert.ok(Math.abs(thumbBox.width - thumb) <= 1 && Math.abs(thumbBox.height - thumb) <= 1, `${tag} ${id} thumb geometry`);
            const centerY = Math.abs((thumbBox.y + thumbBox.height / 2) - (box.y + box.height / 2));
            assert.ok(centerY <= 0.5, `${tag} ${id} thumb vertical center`);
          }
          passed.push(`${tag} switch geometry matches the contract table`);
          // Toggle + single group: selection moves, reselect requests empty.
          await page.locator("[data-testid='tg-b']").click();
          assert.equal(await page.locator("[data-testid='tg-b']").getAttribute("aria-pressed"), "true");
          assert.equal(await page.locator("[data-testid='tg-a']").getAttribute("aria-pressed"), "false");
          await page.locator("[data-testid='tg-b']").click();
          assert.equal(await page.locator("[data-testid='tg-b']").getAttribute("aria-pressed"), "false");
          passed.push(`${tag} single group moves selection and allows empty reselect`);
          // Roving tabindex: A is the initial stop; arrows move focus only.
          assert.equal(await page.locator("[data-testid='tg-a']").getAttribute("tabindex"), "0");
          assert.equal(await page.locator("[data-testid='tg-b']").getAttribute("tabindex"), "-1");
          await page.locator("[data-testid='tg-a']").focus();
          await page.keyboard.press("ArrowRight");
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "tg-b");
          assert.equal(await page.locator("[data-testid='tg-a']").getAttribute("aria-pressed"), "false");
          await page.keyboard.press("Space");
          assert.equal(await page.locator("[data-testid='tg-b']").getAttribute("aria-pressed"), "true");
          await page.keyboard.press("ArrowRight");
          assert.equal(await page.locator("[data-testid='tg-a']").getAttribute("tabindex"), "0");
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "tg-a");
          passed.push(`${tag} roving tabindex skips disabled and wraps`);
          // Multiple group toggles independently.
          await page.locator("[data-testid='tgm-b']").click();
          assert.equal(await page.locator("[data-testid='tgm-a']").getAttribute("aria-pressed"), "true");
          assert.equal(await page.locator("[data-testid='tgm-b']").getAttribute("aria-pressed"), "true");
          await page.locator("[data-testid='tgm-a']").click();
          assert.equal(await page.locator("[data-testid='tgm-a']").getAttribute("aria-pressed"), "false");
          assert.equal(await page.locator("[data-testid='tgm-b']").getAttribute("aria-pressed"), "true");
          passed.push(`${tag} multiple group toggles independently`);
          // Progress ARIA normalization.
          assert.equal(await page.locator("[data-testid='progress-40']").getAttribute("aria-valuenow"), "40");
          assert.equal(await page.locator("[data-testid='progress-null']").getAttribute("aria-valuenow"), null);
          assert.equal(await page.locator("[data-testid='progress-clamp']").getAttribute("aria-valuenow"), "80");
          assert.equal(await page.locator("[data-testid='progress-nan']").getAttribute("aria-valuenow"), null);
          assert.equal(await page.locator("[data-testid='progress-labeled']").getAttribute("aria-label"), "loading files");
          assert.equal(await page.locator("[data-testid='progress-labeled']").getAttribute("aria-labelledby"), null);
          const labelledBy = await page.locator("[data-testid='progress-with-label']").getAttribute("aria-labelledby");
          assert.ok(labelledBy && (await page.locator(`#${labelledBy}`).innerText()).includes("Files"));
          passed.push(`${tag} progress ARIA normalization holds`);
          // Card keeps structure without forced interaction.
          assert.equal(await page.locator("[data-testid='card-basic']").getAttribute("tabindex"), null);
          assert.equal(await page.locator("[data-testid='card-basic']").getAttribute("role"), null);
          passed.push(`${tag} card stays non-interactive`);
          assert.deepEqual(errors, []);
          await context.close();
        }
      }
    }
    console.log(`Primitive contract passed: ${passed.length} checks across 16 conditions.`);
    if (out) await fs.writeFile(out, `${JSON.stringify({ passed }, null, 1)}\n`);
  } finally {
    await browser.close();
  }
} finally {
  if (server) await stopServer(server);
}

async function startDevServer() {
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite dev exited early (${child.exitCode}): ${output.join("")}`);
    try { if ((await fetch(`${baseUrl}/tests/ui-primitives-fixture.html`)).ok) return child; } catch { /* Dev server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
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
