import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import puppeteer from "puppeteer-core";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { configureVisualClock } from "../../visual-regression-clock.mjs";
import { visualRegressionConfig as config } from "../../visual-regression.config.mjs";

const output = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4296";
const hostTimes = ["2026-09-05T14:59:59.999Z", "2026-09-06T15:00:00.000Z", "2027-01-01T00:00:00.000Z"];
const results = [];
for (const locale of ["ko", "en"]) {
  const environment = config.environment.locales[locale];
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8", LANGUAGE: environment.browserLocale, TZ: "UTC" },
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--force-device-scale-factor=1", "--font-render-hinting=none", "--disable-lcd-text", `--lang=${environment.browserLocale}`],
  });
  try {
    for (const toolId of Object.keys(config.environment.clock.toolReasons)) {
      const snapshots = new Map();
      for (const hostTime of hostTimes) {
        const page = await browser.newPage();
        try {
          await page.setViewport(config.viewports[0]);
          await page.emulateTimezone("UTC");
          await page.setExtraHTTPHeaders({ "Accept-Language": environment.acceptLanguage });
          await (await page.createCDPSession()).send("Emulation.setLocaleOverride", { locale: environment.browserLocale });
          await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
          await page.evaluateOnNewDocument((host, language) => {
            const NativeDate = Date;
            globalThis.Date = class HostDate extends NativeDate {
              constructor(...args) { super(...(args.length ? args : [NativeDate.parse(host)])); }
              static now() { return NativeDate.parse(host); }
            };
            globalThis.clockProbeHostTime = Date.now();
            localStorage.setItem("worklazy_privacy_consent", "denied");
            localStorage.setItem("worklazy_lang", language);
          }, hostTime, locale);
          await configureVisualClock(page, { toolId }, config.environment.clock);
          await page.goto(`${baseUrl}/${locale}/tools/${toolId}`, { waitUntil: "networkidle0" });
          const root = `[data-tool-page='${toolId}']`;
          await page.waitForSelector(root);
          await page.addStyleTag({ content: `
            @font-face { font-family: "${config.environment.fontFamily}"; src: url("${config.environment.fontUrl}") format("opentype"); font-weight: 100 900; }
            :root { font-family: "${config.environment.fontFamily}", sans-serif !important; }
            *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
            .global-footer > span:first-child { visibility: hidden !important; }
          ` });
          const state = await page.evaluate(async (font) => {
            await document.fonts.load(`16px "${font}"`, "Worklazy 시각 기준");
            await document.fonts.ready;
            const before = performance.now();
            await new Promise((resolve) => setTimeout(() => requestAnimationFrame(resolve), 30));
            return { host: globalThis.clockProbeHostTime, now: Date.now(), constructed: new Date().getTime(), timerAdvanced: performance.now() > before };
          }, config.environment.fontFamily);
          assert.equal(state.host, Date.parse(hostTime));
          assert.equal(state.now, Date.parse(config.environment.clock.isoTime));
          assert.equal(state.constructed, state.now);
          assert.equal(state.timerAdvanced, true);
          for (const phase of ["initial", "interaction"]) {
            if (phase === "interaction") {
              if (toolId === "timezone-calculator") {
                await page.$eval(`${root} input[type='date']`, (input) => {
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "2000-01-01");
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                });
                await page.waitForFunction((selector) => document.querySelector(selector).value === "2000-01-01", {}, `${root} input[type='date']`);
                await page.click(`${root} button:has(svg.lucide-locate-fixed)`);
              } else {
                const selector = toolId === "work-calculator" ? "work-mode" : "payroll-mode";
                await page.$$eval(`[data-testid='${selector}'] [data-ui-component='segmented-control'] button`, (buttons, index) => buttons[index].click(), toolId === "work-calculator" ? 1 : 2);
              }
            }
            await page.evaluate(() => new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 200)));
            const values = await page.$$eval(`${root} input[type='date'], ${root} input[type='time']`, (inputs) => inputs.map((input) => input.value));
            const expected = toolId === "timezone-calculator" ? ["2026-09-05", "12:00"]
              : toolId === "work-calculator" ? [phase === "initial" ? "2026-09-05" : "2025-01-01", "2026-09-05"]
                : phase === "initial" ? [] : ["2023-01-01", "2026-09-05"];
            assert.deepEqual(values, expected);
            const buffer = await page.screenshot({ type: "png", captureBeyondViewport: false });
            const actual = PNG.sync.read(buffer);
            let diffPixels = 0;
            if (snapshots.has(phase)) {
              const previous = snapshots.get(phase);
              diffPixels = pixelmatch(previous.data, actual.data, null, actual.width, actual.height, { threshold: 0.1, includeAA: false });
              assert.equal(diffPixels, 0, `${toolId}/${locale}/${phase}/${hostTime}`);
            } else {
              snapshots.set(phase, actual);
              await fs.writeFile(path.join(output, `${toolId}-${locale}-${phase}.png`), buffer);
            }
            results.push({ toolId, locale, hostTime, phase, values, ...state, diffPixels });
          }
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
}
await fs.writeFile(path.join(output, "rollover-results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`Clock rollover probe passed: ${results.length} states, 3 host dates spanning day/year rollover, KO/EN, current-time action and annual-leave/severance dates; all 24 repeat comparisons differ by 0 pixels; native timer/RAF/performance advanced.`);
