import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const root = process.cwd();
const require = createRequire(`${root}/package.json`);
const { chromium } = require("playwright");
const { preview } = await import("vite");
const JSZip = require("jszip");
const ExcelJS = require("exceljs");
const { PDFDocument } = require("pdf-lib");
const out = process.env.PDF_COMPARE_UI_EVIDENCE || await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-u8-ui-"));
const corpus = path.join(out, "corpus");
const fixtureRun = spawnSync(process.execPath, ["tests/helpers/pdf-compare-fixtures.mjs", corpus], { cwd: root, encoding: "utf8" });
if (fixtureRun.status !== 0) throw new Error(fixtureRun.stderr || "Synthetic fixture generation failed");
const longPdf = await PDFDocument.create(); for (let index = 0; index < 200; index++) longPdf.addPage([600, 800]); await fs.writeFile(path.join(corpus, "fixtures/long.pdf"), await longPdf.save());
const server = await preview({ root, build: { outDir: process.env.PDF_COMPARE_UI_DIST || "dist" }, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const baseUrl = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1 });
const external = []; const pageErrors = [];
const dismissConsent = async language => { const button = page.getByRole("button", { name: language === "ko" ? "필수 기능만 사용" : "Use essential features only" }); if (await button.count()) await button.click(); assert.equal(await page.locator(".privacy-consent").count(), 0); };
page.on("pageerror", error => pageErrors.push(error.message));
await page.route("**/*", route => { const url = new URL(route.request().url()); if (url.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(url.hostname)) { external.push(url.href); return route.abort("blockedbyclient"); } return route.continue(); });
try {
  if (process.env.PDF_COMPARE_UI_SCOPE === "lifecycle") {
    const { runPdfCompareUiLifecycle } = await import("./helpers/pdf-compare-ui-lifecycle.mjs");
    await runPdfCompareUiLifecycle({ page, root, out, corpus, baseUrl });
    assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
  } else {
  await page.goto(`${baseUrl}/en/tools/pdf-compare/`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-tool-page="pdf-compare"] input[type="file"]');
  let inputs = await page.locator('[data-tool-page="pdf-compare"] input[type="file"]').all();
  await inputs[0].setInputFiles(path.join(corpus, "fixtures/normal-ascii.pdf"));
  await inputs[1].setInputFiles(path.join(corpus, "fixtures/changed-word.pdf"));
  await page.getByRole("button", { name: "Add comparison pair" }).click();
  inputs = await page.locator('[data-tool-page="pdf-compare"] input[type="file"]').all();
  await inputs[2].setInputFiles(path.join(corpus, "fixtures/normal-number.pdf"));
  await inputs[3].setInputFiles(path.join(corpus, "fixtures/changed-number.pdf"));
  await page.getByRole("button", { name: "Start comparison" }).click();
  await page.getByRole("heading", { name: "Comparison results" }).waitFor({ timeout: 120_000 });
  const pageButton = page.getByRole("button", { name: /1 ↔ 1 · Changed/ }).first();
  assert.equal(await pageButton.count(), 1);
  await pageButton.click();
  await page.locator('[data-tool-page="pdf-compare"] canvas').first().waitFor({ timeout: 120_000 });
  await page.getByText("Difference overlay", { exact: true }).click();
  assert.equal(await page.getByLabel("Overlay opacity").count(), 1);
  await page.screenshot({ path: path.join(out, "en-desktop-overlay.png"), fullPage: true });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  const download = await downloadPromise; const zipPath = path.join(out, "ui-reports.zip"); await download.saveAs(zipPath);
  const archive = await JSZip.loadAsync(await fs.readFile(zipPath)); const entries = Object.values(archive.files).filter(entry => !entry.dir); assert.equal(entries.length, 2);
  for (const entry of entries) { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await entry.async("nodebuffer")); assert.ok(workbook.worksheets[0].rowCount >= 2); }
  await page.screenshot({ path: path.join(out, "en-desktop-result.png"), fullPage: true });
  const firstInput = page.locator('[data-tool-page="pdf-compare"] input[type="file"]').first();
  await firstInput.setInputFiles(path.join(corpus, "fixtures/blank.pdf"));
  assert.equal(await page.getByRole("heading", { name: "Comparison results" }).count(), 0, "file replacement must invalidate results immediately");
  await page.getByRole("button", { name: "Start comparison" }).click();
  await page.getByRole("heading", { name: "Comparison results" }).waitFor({ timeout: 120_000 });
  await page.getByRole("button", { name: /Manual matching/ }).first().click();
  const mappingSelects = page.getByRole("combobox", { name: "Before PDF" });
  assert.ok(await mappingSelects.count() >= 1);
  await page.screenshot({ path: path.join(out, "en-desktop-mapping.png"), fullPage: true });
  await mappingSelects.first().selectOption("");
  await page.getByRole("button", { name: "Apply mapping and compare again" }).first().click();
  assert.equal(await page.getByRole("heading", { name: "Comparison results" }).count(), 0, "mapping edits must invalidate results immediately");
  await page.getByRole("button", { name: "Start comparison" }).click();
  await page.getByRole("heading", { name: "Comparison results" }).waitFor({ timeout: 120_000 });
  inputs = await page.locator('[data-tool-page="pdf-compare"] input[type="file"]').all();
  await inputs[0].setInputFiles(path.join(corpus, "fixtures/long.pdf")); await inputs[1].setInputFiles(path.join(corpus, "fixtures/long.pdf"));
  await page.getByRole("button", { name: "Start comparison" }).click(); await page.getByRole("button", { name: "Cancel comparison" }).waitFor(); await page.getByRole("button", { name: "Cancel comparison" }).click();
  await page.getByRole("heading", { name: "Comparison results" }).waitFor({ timeout: 120_000 }); assert.ok(await page.getByText(/partial result/).count());
  await page.screenshot({ path: path.join(out, "en-desktop-canceled-bottom.png"), fullPage: true });
  const initialProfiles = [
    ["ko", "light", 320, "ko-mobile-320-initial.png"], ["en", "dark", 390, "en-mobile-390-dark-initial.png"],
    ["ko", "dark", 820, "ko-820-dark-initial.png"], ["en", "light", 821, "en-821-light-initial.png"], ["ko", "light", 1365, "ko-desktop-light-initial.png"],
    ["en", "light", 320, "en-320-light-boundary.png"], ["en", "light", 999, "en-999-light-boundary.png"], ["en", "light", 1000, "en-1000-light-boundary.png"],
  ];
  for (const [language, theme, width, fileName] of initialProfiles) {
    await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ colorScheme: theme }); await page.goto(`${baseUrl}/${language}/tools/pdf-compare/`, { waitUntil: "networkidle" });
    await dismissConsent(language);
    await page.waitForSelector('[data-tool-page="pdf-compare"] input[type="file"]');
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, dark: matchMedia("(prefers-color-scheme: dark)").matches, background: getComputedStyle(document.body).backgroundColor })); assert.ok(metrics.overflow <= 1); assert.equal(metrics.dark, theme === "dark"); assert.ok(metrics.background);
    if (language === "ko") { assert.match(metrics.text, /PDF 파일 비교/); assert.match(metrics.text, /화면 배율, 기기와 글꼴 환경/); } else assert.match(metrics.text, /Pixel differences can vary/);
    if (language === "en" && [320, 821, 999, 1000].includes(width)) { const overlaps = await page.locator('[data-testid="pdf-pair"] [data-ui-part="drop-target"]').evaluateAll(targets => targets.map(target => { const text = target.querySelector("strong")?.getBoundingClientRect(); const button = target.querySelector("button")?.getBoundingClientRect(); return Boolean(text && button && text.left < button.right && text.right > button.left && text.top < button.bottom && text.bottom > button.top); })); assert.deepEqual(overlaps, [false, false]); }
    await page.screenshot({ path: path.join(out, fileName), fullPage: true });
  }
  const mobileShots = [];
  for (const profile of [{ language: "ko", theme: "light", width: 320 }, { language: "en", theme: "dark", width: 390 }]) {
    await page.setViewportSize({ width: profile.width, height: 844 }); await page.emulateMedia({ colorScheme: profile.theme }); await page.goto(`${baseUrl}/${profile.language}/tools/pdf-compare/`, { waitUntil: "networkidle" });
    await dismissConsent(profile.language);
    const mobileInputs = await page.locator('[data-tool-page="pdf-compare"] input[type="file"]').all(); await mobileInputs[0].setInputFiles(path.join(corpus, "fixtures/normal-ascii.pdf")); await mobileInputs[1].setInputFiles(path.join(corpus, "fixtures/changed-word.pdf"));
    const runButton = page.getByRole("button", { name: profile.language === "ko" ? "비교 시작" : "Start comparison" }); await runButton.focus(); await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: profile.language === "ko" ? "비교 결과" : "Comparison results" }).waitFor({ timeout: 120_000 });
    await page.getByRole("button", { name: /1 ↔ 1/ }).last().focus(); await page.keyboard.press("Enter"); await page.locator('[data-tool-page="pdf-compare"] canvas').first().waitFor({ timeout: 120_000 });
    await page.locator('[data-tool-page="pdf-compare"] canvas').first().scrollIntoViewIfNeeded();
    const resultName = `${profile.language}-mobile-${profile.width}-${profile.theme}-selected.png`; await page.screenshot({ path: path.join(out, resultName) }); mobileShots.push(resultName);
    const mappingButton = page.getByRole("button", { name: /Manual matching|수동 대응/ }).first(); await mappingButton.scrollIntoViewIfNeeded(); await mappingButton.click();
    const mappingName = `${profile.language}-mobile-${profile.width}-${profile.theme}-mapping.png`; await page.screenshot({ path: path.join(out, mappingName) }); mobileShots.push(mappingName);
    if (profile.language === "en") { await page.getByText("Difference overlay", { exact: true }).click(); await page.locator('[data-tool-page="pdf-compare"] canvas').first().scrollIntoViewIfNeeded(); const overlayName = "en-mobile-390-dark-overlay.png"; await page.screenshot({ path: path.join(out, overlayName) }); mobileShots.push(overlayName); }
    const mobileMetrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, focused: document.activeElement?.tagName, dark: matchMedia("(prefers-color-scheme: dark)").matches, background: getComputedStyle(document.body).backgroundColor })); assert.ok(mobileMetrics.scrollWidth - mobileMetrics.clientWidth <= 1); assert.equal(mobileMetrics.focused, "BUTTON"); assert.equal(mobileMetrics.dark, profile.theme === "dark"); assert.ok(mobileMetrics.background);
  }
  await page.goto(`${baseUrl}/en/tools/pdf-compare/`, { waitUntil: "networkidle" }); inputs = await page.locator('[data-tool-page="pdf-compare"] input[type="file"]').all(); await inputs[0].setInputFiles(path.join(corpus, "fixtures/normal-ascii.pdf")); await inputs[1].setInputFiles(path.join(corpus, "fixtures/changed-word.pdf")); await page.getByRole("button", { name: "Start comparison" }).click(); await page.getByRole("heading", { name: "Comparison results" }).waitFor({ timeout: 120_000 }); await page.getByRole("button", { name: "Add comparison pair" }).click(); assert.equal(await page.getByRole("heading", { name: "Comparison results" }).count(), 0, "adding a pair must invalidate results immediately");
  assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
  const screenshots = ["en-desktop-result.png", "en-desktop-overlay.png", "en-desktop-mapping.png", "en-desktop-canceled-bottom.png", ...initialProfiles.map(profile => profile[3]), ...mobileShots];
  const sourceFiles = ["dist/index.html", "src/features/pdf-compare/PdfComparePage.tsx", "src/app/App.tsx", "src/app/toolRegistry.ts", "src/app/seo.ts"];
  const sourceHash = createHash("sha256"); for (const file of sourceFiles) sourceHash.update(file).update(await fs.readFile(path.join(root, file)));
  const manifestItems = []; for (const file of screenshots) { const bytes = await fs.readFile(path.join(out, file)); manifestItems.push({ file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }); }
  const sizeSHA = createHash("sha256").update(JSON.stringify(manifestItems.map(({ file, bytes }) => [file, bytes]))).digest("hex");
  const manifest = { sourceBuildSHA: sourceHash.digest("hex"), sizeSHA, items: manifestItems }; await fs.writeFile(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(out, "result.json"), `${JSON.stringify({ baseUrl, external, pageErrors, screenshots, sourceBuildSHA: manifest.sourceBuildSHA, sizeSHA }, null, 2)}\n`);
  console.log(`PDF compare UI smoke passed; evidence=${out}`);
  }
} finally { await browser.close(); await server.close(); }
