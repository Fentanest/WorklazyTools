// W0 theme surfaces: the same selector must resolve identically across OS
// brightness levels, and every theme must expose a data-theme root.
// Usage: TEST_BASE_URL=... node tests/ui-theme-surfaces.mjs --matrix tests/ui-theme-surfaces.json --out out.json
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
const get = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const matrix = JSON.parse(await fs.readFile(get("--matrix", "tests/ui-theme-surfaces.json"), "utf8"));
const out = get("--out", undefined);
const THEMES = ["light-coral", "dark-coral", "light-mint", "dark-mint"];
const VIEWPORTS = { desktop: { width: 1365, height: 900 }, mobile: { width: 390, height: 844 } };
let server;
const rows = [];

try {
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  try {
    for (const entry of matrix) {
      for (const locale of entry.locales) {
        for (const viewport of entry.viewports) {
          const byOs = {};
          for (const colorScheme of ["light", "dark"]) {
            const context = await browser.newContext({
              viewport: VIEWPORTS[viewport],
              locale: locale === "ko" ? "ko-KR" : "en-US",
              colorScheme,
            });
            const values = {};
            for (const theme of THEMES) {
              const page = await context.newPage();
              await page.addInitScript((seed) => localStorage.setItem("worklazy-theme", seed), theme);
              await page.goto(`${baseUrl}/${locale}${entry.route}`, { waitUntil: "networkidle" });
              const actual = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
              assert.equal(actual, theme);
              const count = await page.locator(entry.selector).count();
              assert.ok(count > 0, `${entry.id}: selector matched 0 elements`);
              values[theme] = await page.locator(entry.selector).first().evaluate((element, properties) => {
                const style = getComputedStyle(element);
                return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
              }, entry.properties);
              await page.close();
            }
            await context.close();
            byOs[colorScheme] = values;
          }
          assert.deepEqual(byOs.dark, byOs.light, `${entry.id} ${locale} ${viewport}: OS brightness must not change specified properties`);
          rows.push({ id: entry.id, locale, viewport, themes: THEMES.length, osPairs: 2 });
        }
      }
    }
    console.log(`Theme surfaces passed: ${rows.length} rows across ${THEMES.length} themes and 2 OS brightness levels.`);
    if (out) await fs.writeFile(out, `${JSON.stringify({ rows }, null, 1)}\n`);
  } finally {
    await browser.close();
  }
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
