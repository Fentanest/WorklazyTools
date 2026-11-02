// U0: exercise the mounted AppShell search form -> useToolCatalog -> matcher
// -> ToolsPage cards. The pre-U0 W2 fixture expected an unmounted combobox
// and sidebar data attributes; those are not present in baseline 47f0678.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.UI_SHELL_PORT ?? "5390");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const outIndex = process.argv.indexOf("--out");
const out = outIndex === -1 ? undefined : process.argv[outIndex + 1];
const captureDirectory = process.env.UI_SHELL_CAPTURE_DIR;
const passed = [];
let server;
if (captureDirectory) await fs.mkdir(captureDirectory, { recursive: true });
try {
  if (!process.env.TEST_BASE_URL) server = await startDevServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"] });
  try {
    for (const language of ["ko", "en"]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
      // Fail closed: automation cannot call production providers.
      await context.addInitScript(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
      await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseUrl).origin ? route.continue() : route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      const errors = [], requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      context.on("request", (request) => requests.push({ url: request.url(), body: request.postData() }));
      const cards = page.locator(".tool-category-groups [data-ui-component='tool-card']");
      const search = page.getByTestId("tools-search-input");
      await page.goto(`${baseUrl}/${language}/tools/`, { waitUntil: "networkidle" });
      await cards.first().waitFor();
      const allHrefs = await cards.evaluateAll((items) => items.map((item) => item.getAttribute("href")));
      assert.ok(allHrefs.length >= 20);
      passed.push(`${language} localized catalog renders`);
      const queries = language === "ko"
        ? [["얼굴 모자이크", "image-studio"], ["엑셀 대사", "excel-compare"], ["ㅇㅅ", "excel-merger"], ["XLSB", "excel-cleaner"], ["병합 엑셀", "excel-merger"]]
        : [["image resizer", "image-studio"], ["mp3 cutter", "audio-studio"], ["HWP VIEWER", "hwp-editor"], ["JPEG", "image-studio"], ["diff checker", "text-compare"]];
      for (const [query, expected] of queries) {
        await search.fill(query);
        await page.locator(`.tool-category-groups a[href='/${language}/tools/${expected}']`).waitFor();
        assert.equal(new URL(page.url()).search, "");
        passed.push(`${language} alias/format/AND search: ${query}`);
      }
      await search.fill("");
      assert.deepEqual(await cards.evaluateAll((items) => items.map((item) => item.getAttribute("href"))), allHrefs);
      await search.fill("zzz-no-such-tool-zzz");
      await page.locator(".empty-search").waitFor();
      assert.equal(await cards.count(), 0);
      passed.push(`${language} blank restores order; unknown gives zero`);

      // Search text stays local, including the actual topbar submit path.
      const sentinel = `private-u0-${language}-secret`;
      const eventsBefore = await page.evaluate(() => JSON.stringify(window.dataLayer ?? []));
      const start = requests.length;
      await search.fill(sentinel);
      await page.locator(".wl-search input").fill(sentinel);
      await page.locator(".wl-search input").press("Enter");
      await page.waitForFunction((value) => document.querySelector("[data-testid='tools-search-input']")?.value === value, sentinel);
      await page.waitForTimeout(300);
      assert.equal(new URL(page.url()).search, "");
      assert.ok(!JSON.stringify(requests.slice(start)).includes(sentinel));
      assert.ok(!(await page.evaluate(() => JSON.stringify(window.dataLayer ?? []))).includes(sentinel));
      // Existing topbar tool_open may be recorded, but its payload must be fixed.
      assert.ok(!eventsBefore.includes(sentinel));
      passed.push(`${language} topbar submit keeps private query out of URL/requests/events`);

      await page.goto(`${baseUrl}/${language}/tools/?q=${encodeURIComponent(queries[0][0])}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => !new URL(location.href).searchParams.has("q"));
      assert.equal(await search.inputValue(), queries[0][0]);
      await page.locator(`.tool-category-groups a[href='/${language}/tools/${queries[0][1]}']`).waitFor();
      await page.locator(".tool-category-filter button").nth(3).click();
      assert.equal(new URL(page.url()).searchParams.get("category"), "media");
      assert.equal(await search.inputValue(), queries[0][0]);
      await page.reload({ waitUntil: "networkidle" });
      await search.waitFor();
      assert.equal(await search.inputValue(), queries[0][0]);
      passed.push(`${language} legacy q migration/category/reload preserves local query`);

      if (captureDirectory) for (const width of [390, 1280]) {
        await page.goto(`${baseUrl}/${language}/tools/`, { waitUntil: "networkidle" });
        await page.setViewportSize({ width, height: 900 });
        await search.fill(queries[0][0]);
        await page.locator(`.tool-category-groups a[href='/${language}/tools/${queries[0][1]}']`).waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(captureDirectory, `${language}-${width}.png`), fullPage: true });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`Shell search contract passed: ${passed.length} checks.`);
    console.log(`# tests ${passed.length}`);
    if (out) await fs.writeFile(out, `${JSON.stringify({ passed }, null, 2)}\n`);
  } finally { await browser.close(); }
} finally { if (server) await stopServer(server); }

async function startDevServer() {
  const child = spawn(process.execPath, [path.join(repositoryRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: repositoryRoot, env: { ...process.env, BROWSER: "none" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited (${child.exitCode}): ${output.join("")}`);
    try { if ((await fetch(baseUrl)).ok) return child; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${output.join("")}`);
}
async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
