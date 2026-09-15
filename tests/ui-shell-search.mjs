// W2 shell search/select contract: topbar combobox behavior, native language
// select routing with query/hash preservation, and sidebar display groups.
// Dev-server fixture-free: drives the real AppShell. Never ships to dist.
// Usage: node tests/ui-shell-search.mjs --out out.json
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number(process.env.UI_SHELL_PORT ?? "4233");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex === -1 ? undefined : args[outIndex + 1];
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
    for (const language of ["ko", "en"]) {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: language === "ko" ? "ko-KR" : "en-US" });
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/${language}/tools/`, { waitUntil: "networkidle" });

      // Topbar landmarks and scoped test ids.
      assert.equal(await page.locator("[data-testid='app-topbar']").count(), 1);
      assert.equal(await page.locator("[data-testid='desktop-sidebar']").count(), 1);
      assert.equal(await page.locator("[data-testid='global-tool-search']").count(), 1);
      passed.push(`${language} topbar landmarks are unique`);

      // Combobox opens the full catalog with ArrowDown, moves, and navigates.
      const search = page.locator("[data-testid='global-tool-search'] input[role='combobox']");
      await search.focus();
      await page.keyboard.press("ArrowDown");
      await page.locator("[data-testid='global-tool-search'] [role='listbox']").waitFor();
      const optionCount = await page.locator("[data-testid='global-tool-search'] [role='option']").count();
      assert.ok(optionCount >= 20, `catalog opens with all tools, got ${optionCount}`);
      await page.keyboard.press("ArrowDown");
      const activeId = await search.getAttribute("aria-activedescendant");
      assert.ok(activeId && activeId.startsWith("global-search-option-"));
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.querySelector("[data-testid='global-tool-search'] [role='listbox']"));
      assert.ok(!new URL(page.url()).pathname.endsWith("/tools/"), "Enter navigates to the active tool");
      passed.push(`${language} combobox keyboard flow navigates`);

      // Chosung query narrows; Escape keeps query and focus.
      await page.goto(`${baseUrl}/${language}/tools/`, { waitUntil: "networkidle" });
      await page.locator("[data-testid='global-tool-search'] input[role='combobox']").fill(language === "ko" ? "ㅇㅅ" : "qr");
      await page.locator("[data-testid='global-tool-search'] [role='listbox']").waitFor();
      const narrowed = await page.locator("[data-testid='global-tool-search'] [role='option']").count();
      assert.ok(narrowed >= 1 && narrowed < optionCount, `query narrows ${optionCount} to ${narrowed}`);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("[data-testid='global-tool-search'] [role='listbox']").count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "combobox");
      passed.push(`${language} query narrows and Escape preserves query and focus`);

      // Empty result keeps a count status without a list live region.
      await page.locator("[data-testid='global-tool-search'] input[role='combobox']").fill("zzz-no-such-tool-zzz");
      const status = await page.locator("[data-testid='global-tool-search'] [role='status']").innerText();
      assert.ok(status.length > 0, "empty query keeps a count status");
      assert.equal(await page.locator("[data-testid='global-tool-search'] [role='listbox'] [aria-live]").count(), 0);
      passed.push(`${language} empty query keeps a non-live count status`);

      // Native language select preserves search/hash and normalizes HWP.
      await page.goto(`${baseUrl}/ko/tools/hwp-editor/?category=documents&q=pdf#sample`, { waitUntil: "networkidle" });
      await page.selectOption("[data-testid='desktop-sidebar'] select[data-ui-component='language-switcher'], [data-testid='app-topbar'] select[data-ui-component='language-switcher']", "en");
      assert.equal(new URL(page.url()).pathname, "/en/tools");
      assert.ok(page.url().includes("category=documents") && page.url().includes("q=pdf") && page.url().includes("#sample"));
      passed.push(`${language} HWP english fallback normalizes slash and preserves search/hash`);

      // Sidebar display groups list real tools, never a category=other link.
      await page.goto(`${baseUrl}/${language}/tools/`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("[data-testid='desktop-sidebar'] [data-display-group]").count(), 3);
      assert.equal(await page.locator("[data-testid='desktop-sidebar'] a[href*='category=other']").count(), 0);
      const groupLinks = await page.locator("[data-testid='desktop-sidebar'] [data-display-group] a").count();
      assert.ok(groupLinks >= 20, `display groups list real tools, got ${groupLinks}`);
      assert.deepEqual(errors, []);
      await context.close();
    }

    // Mobile drawer keeps menu semantics and tool hrefs.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
    const app = await mobile.newPage();
    app.setDefaultTimeout(30_000);
    await app.goto(`${baseUrl}/ko/tools/`, { waitUntil: "networkidle" });
    assert.ok((await app.locator(".app-topbar").boundingBox()).height >= 100, "mobile topbar uses two rows");
    await app.locator("#mobile-navigation-trigger").click();
    await app.locator("[data-slot='sheet-content']").waitFor();
    const drawerLinks = await app.locator(".sheet-tool-list a[href*='/ko/tools/']").count();
    assert.ok(drawerLinks >= 20, `drawer lists tool links, got ${drawerLinks}`);
    assert.equal(await app.locator(".sheet-tool-list [role='menuitem']").count(), 0, "drawer links stay plain links, not menuitems");
    await mobile.close();
    passed.push("mobile drawer keeps menu semantics and tool hrefs");

    console.log(`Shell search contract passed: ${passed.length} checks.`);
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
    try { if ((await fetch(baseUrl)).ok) return child; } catch { /* Dev server is still starting. */ }
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
