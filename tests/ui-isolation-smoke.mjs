// W1b drawer isolation: controlled rejection, focusable counts, dynamic
// removal, disabled changes, nested Escape/Tab, body overflow restore,
// unmount cleanup, drag/pointer-cancel behavior, and the AppShell drawer's
// route/resize ownership. Dev-only fixture, never ships.
// Usage: node tests/ui-isolation-smoke.mjs --out out.json
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number(process.env.UI_ISOLATION_PORT ?? "4232");
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
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: "en-US" });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/tests/ui-primitives-fixture.html`, { waitUntil: "networkidle" });

    // Controlled rejection keeps the dialog open.
    await page.locator("[data-testid='sheet-reject-toggle']").click();
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-testid='sheet-dialog']").count(), 1);
    passed.push("controlled rejection keeps the dialog open on Escape");
    // The modal correctly covers background controls; toggle rejection off
    // with a direct dispatch.
    await page.locator("[data-testid='sheet-reject-toggle']").evaluate((element) => element.click());
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    passed.push("accepted close removes the dialog");

    // Focus trap wraps both directions; body scroll lock restores overflow clip.
    await page.evaluate(() => { document.body.style.overflow = "clip"; });
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "sheet-close-button");
    passed.push("initial focus lands on the close button");
    // The content ships its own close plus the default one: tabbing past
    // both wraps back to the first item, and shift-tab wraps to the last.
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), null);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-slot")), "sheet-close");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "sheet-item-one");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-slot")), "sheet-close");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), null);
    passed.push("Tab wraps forward and backward");
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "clip");
    passed.push("close restores the previous body overflow value");

    // Disabled change removes the item from the Tab order (before removal).
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    await page.locator("[data-testid='sheet-disable-second']").click();
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.locator("[data-testid='sheet-item-one']").focus();
    await page.keyboard.press("ArrowRight");
    const afterDisabledArrow = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    assert.equal(afterDisabledArrow, "sheet-item-three");
    passed.push("disabled items leave the roving order");
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    await page.locator("[data-testid='sheet-disable-second']").click();

    // Dynamic removal of the focused item recovers focus nearby.
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.locator("[data-testid='sheet-item-two']").focus();
    await page.locator("[data-testid='sheet-remove-two']").evaluate((element) => element.click());
    await page.locator("[data-testid='sheet-item-two']").waitFor({ state: "detached" });
    const recovered = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    assert.ok(recovered === "sheet-item-one" || recovered === "sheet-item-three", `focus recovered nearby, got ${recovered}`);
    passed.push("removing the focused item recovers focus nearby");
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });

    // Nested Escape closes only the topmost dialog.
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.locator("[data-testid='sheet-open-nested']").click();
    await page.locator("[data-testid='sheet-nested-dialog']").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-nested-dialog']").waitFor({ state: "detached" });
    assert.equal(await page.locator("[data-testid='sheet-dialog']").count(), 1);
    passed.push("nested Escape closes only the topmost dialog");
    await page.keyboard.press("Tab");
    const nestedTab = await page.evaluate(() => document.activeElement?.closest("[data-testid='sheet-dialog']") !== null);
    assert.ok(nestedTab, "focus stays trapped in the parent dialog");
    passed.push("parent trap holds while nested content is gone");

    // Inside-started drag ending outside does not close; pointer cancel resets.
    // The left panel caps at sm:max-w-sm, so start well inside it.
    await page.mouse.move(200, 450);
    await page.mouse.down();
    await page.mouse.move(1200, 450, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.locator("[data-testid='sheet-dialog']").count(), 1);
    passed.push("inside-to-outside drag does not close");
    // Outside down+up on the overlay closes.
    await page.mouse.click(1200, 450);
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    passed.push("outside down and up closes");
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });

    // Unmount while open cleans up without leaking locks.
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.locator("[data-testid='sheet-mount-toggle']").evaluate((element) => element.click());
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "clip");
    await page.locator("[data-testid='sheet-mount-toggle']").click();
    // Remount restores the preserved open state, so the dialog is back;
    // close it before continuing.
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    passed.push("unmount while open cleans up locks");

    // Trigger removal returns focus without stranding it.
    await page.locator("[data-testid='sheet-open-trigger']").click();
    await page.locator("[data-testid='sheet-dialog']").waitFor();
    await page.locator("[data-testid='sheet-trigger-toggle']").evaluate((element) => element.click());
    await page.keyboard.press("Escape");
    await page.locator("[data-testid='sheet-dialog']").waitFor({ state: "detached" });
    const stranded = await page.evaluate(() => document.activeElement === document.body);
    assert.equal(stranded, false);
    passed.push("removed trigger still returns focus somewhere usable");
    assert.deepEqual(errors, []);
    await context.close();

    // AppShell drawer: route change and 820->821 crossing close it.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
    const app = await mobile.newPage();
    app.setDefaultTimeout(30_000);
    await app.goto(`${baseUrl}/ko/tools/`, { waitUntil: "networkidle" });
    await app.locator("#mobile-navigation-trigger").click();
    await app.locator("[data-slot='sheet-content']").waitFor();
    await app.setViewportSize({ width: 1365, height: 900 });
    await app.locator("[data-slot='sheet-content']").waitFor({ state: "detached" });
    passed.push("821 crossing closes the AppShell drawer");
    await app.setViewportSize({ width: 390, height: 844 });
    await app.locator("#mobile-navigation-trigger").click();
    await app.locator("[data-slot='sheet-content']").waitFor();
    await app.locator(".sheet-tool-list a[href*='/tools/']").first().click();
    await app.locator("[data-slot='sheet-content']").waitFor({ state: "detached" });
    passed.push("route navigation closes the AppShell drawer");
    await mobile.close();

    console.log(`Drawer isolation passed: ${passed.length} checks.`);
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
