import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { assertPinnedQrPdf, createQrFontScenarioServer, qrFontFixture, qrFontScenarios } from "./qr-font-scenarios.mjs";
import puppeteer from "puppeteer-core";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);
const port = Number.parseInt(process.env.QR_BULK_TEST_PORT || "4176", 10);
const externalBaseUrl = process.env.TEST_BASE_URL;
let baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const downloadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-qr-bulk-"));
let server;
let fontServer;
let browser;

const fixtures = [
  { type: "text", csv: "Primary\n한글 원문", transparent: true },
  { type: "email", csv: "Primary,Subject,Body\nteam+qr@example.com,회의 & 점검,한글 본문", templates: { subject: "{{Subject}}", body: "{{Body}}" } },
  { type: "tel", csv: "Primary\n+82-10-1234-5678" },
  { type: "sms", csv: "Primary,Message\n+821012345678,한글:본문", templates: { message: "{{Message}}" } },
  { type: "wifi", csv: "Primary,Password\n워크레이지 와이파이,비밀;암호", templates: { password: "{{Password}}" } },
  { type: "vcard", csv: "Primary,Family,Given,Org,Phone,Email,Url\n김한글,김,한글,워크레이지,+82-10-1234-5678,qr@example.com,https://worklazy.net/", templates: { familyName: "{{Family}}", givenName: "{{Given}}", organization: "{{Org}}", phone: "{{Phone}}", email: "{{Email}}", url: "{{Url}}" } },
  { type: "url", csv: "Primary\nhttps://worklazy.net/ko/tools/qr-studio/bulk\nhttps://worklazy.net/en/tools/qr-studio/bulk", logo: true, title: "한글 라벨 제목", outputs: 2 },
];

try {
  if (!externalBaseUrl) server = await startServer();
  fontServer = await createQrFontScenarioServer({ upstream: baseUrl,
    subsetPath: path.join(repositoryRoot, "dist/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf") });
  baseUrl = fontServer.url;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(90_000);
  await page.setViewport({ width: 1365, height: 900 });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDirectory });
  const pageErrors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const allowed = url.origin === new URL(baseUrl).origin || ["blob:", "data:"].includes(url.protocol);
    if (!allowed) externalRequests.push(url.href);
    void (allowed ? request.continue() : request.abort("blockedbyclient"));
  });

  await page.goto(`${baseUrl}/ko/tools/qr-studio/bulk`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.setItem("worklazy_privacy_consent", "denied");
    localStorage.setItem("worklazy_lang", "ko");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="qr-bulk-page"]');
  const cancellationCsv = `Primary\n${Array.from({ length: 250 }, (_, index) => `취소 검사 ${index + 1}`).join("\n")}`;
  await uploadCsv(page, cancellationCsv, "cancel.csv");
  await page.waitForSelector('[data-testid="qr-payload-type"]');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="qr-bulk-generate"] button');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.click('[data-testid="qr-bulk-generate"] button');
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("생성 취소")));
  await clickButtonByText(page, "생성 취소");
  await page.waitForFunction(() => document.body.textContent?.includes("부분 결과를 정리했습니다"));
  if (await page.$('[data-testid="qr-bulk-results"]')) throw new Error("Canceled QR job retained partial results.");
  await uploadCsv(page, "Primary\n취소 뒤 재실행", "rerun.csv");
  await page.waitForSelector('[data-testid="qr-payload-type"]');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="qr-bulk-generate"] button');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.click('[data-testid="qr-bulk-generate"] button');
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-bulk-results"]')?.textContent?.includes("성공 1개 · 실패 0개"));

  for (const fixture of fixtures) {
    await page.goto(`${baseUrl}/ko/tools/qr-studio/bulk`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      localStorage.setItem("worklazy_privacy_consent", "denied");
      localStorage.setItem("worklazy_lang", "ko");
    });
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="qr-bulk-page"]');
    await uploadCsv(page, fixture.csv, `${fixture.type}.csv`);
    await page.waitForSelector('[data-testid="qr-payload-type"]');
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="qr-bulk-generate"] button');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    await selectValue(page, '[data-testid="qr-payload-type"]', fixture.type);
    for (const [key, value] of Object.entries(fixture.templates ?? {})) await setInput(page, `[data-testid="qr-payload-${key}"]`, value);
    if (fixture.title) await setInput(page, '[data-testid="qr-mapping-title-template"]', fixture.title);
    if (fixture.transparent) await page.click('[data-testid="qr-bulk-transparent"] button[role="switch"]');
    if (fixture.logo) await uploadLogo(page);
    await page.click('[data-testid="qr-bulk-generate"] button');
    await page.waitForSelector('[data-testid="qr-bulk-results"]', { visible: true });
    const expected = fixture.outputs ?? 1;
    await page.waitForFunction((count) => document.querySelector('[data-testid="qr-bulk-results"]')?.textContent?.includes(`성공 ${count}개 · 실패 0개`), {}, expected);
    const result = await page.$eval('[data-testid="qr-bulk-results"]', (element) => ({ text: element.textContent || "", pngButtons: Array.from(element.querySelectorAll("button"), (button) => button.textContent?.trim()).filter((text) => text === "PNG").length }));
    if (result.pngButtons !== expected || !result.text.includes("목록·실패 보고서")) throw new Error(`${fixture.type} result contract failed: ${JSON.stringify(result)}`);
  }

  await clickButtonByText(page, "PNG ZIP 다운로드");
  await waitForDownload("worklazy-qr-bulk.zip");
  await clickButtonByText(page, "목록·실패 보고서");
  await waitForDownload("worklazy-qr-manifest.xlsx");
  const zip = await JSZip.loadAsync(await fs.readFile(path.join(downloadDirectory, "worklazy-qr-bulk.zip")));
  if (Object.keys(zip.files).filter((name) => name.endsWith(".png")).length !== 2) throw new Error("Incremental QR ZIP does not contain both PNG results.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(path.join(downloadDirectory, "worklazy-qr-manifest.xlsx")));
  if (workbook.worksheets.length !== 2 || workbook.worksheets[0].rowCount !== 3 || workbook.worksheets[1].rowCount !== 1) throw new Error("QR manifest or failed-row sheet is inconsistent.");
  // Each navigation creates a fresh panel loader; disabled HTTP cache also
  // guarantees the corrupt case reaches the test server after the subset case.
  await page.setCacheEnabled(false);
  const fontReports = [];
  for (const scenario of Object.keys(qrFontScenarios)) {
    fontServer.setScenario(scenario);
    await page.goto(`${baseUrl}/ko/tools/qr-studio/bulk`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="qr-bulk-page"]');
    const fixture = qrFontFixture(scenario, 25);
    await uploadCsv(page, fixture.csv, `label-boundary-${scenario}.csv`);
    await page.waitForSelector('[data-testid="qr-payload-type"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="qr-bulk-generate"] button')?.disabled);
    await setInput(page, '[data-testid="qr-mapping-title-template"]', fixture.titleTemplate);
    await page.click('[data-testid="qr-bulk-generate"] button');
    await page.waitForFunction(() => document.querySelector('[data-testid="qr-bulk-results"]')?.textContent?.includes("성공 25개 · 실패 0개"));
    await page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find((candidate) => candidate.textContent?.includes("라벨 PDF 다운로드"));
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    const pdfPath = path.join(downloadDirectory, "worklazy-qr-labels-a4.pdf");
    // Never mistake the previous scenario's same filename for this download.
    await fs.rm(pdfPath, { force: true });
    await clickButtonByText(page, "라벨 PDF 다운로드");
    await waitForDownload("worklazy-qr-labels-a4.pdf", 120_000);
    const result = await assertPinnedQrPdf(await fs.readFile(pdfPath), qrFontScenarios[scenario].font, 2);
    fontReports.push({ scenario, ...result });
  }
  if (fontServer.injected.length !== 1) throw new Error("Expected exactly one corrupt subset HTTP response.");
  if (pageErrors.length) throw new Error(`QR bulk browser errors: ${pageErrors.join(" | ")}`);
  if (externalRequests.length) throw new Error(`QR bulk made external requests: ${externalRequests.join(" | ")}`);
  console.log(`QR bulk smoke passed: cancel/cleanup/rerun, 7 payload types, transparent/logo read-back, 2 PNG ZIP entries, 2-sheet manifest, 25-label/2-page ${JSON.stringify(fontReports)} Korean PDFs, external requests 0.`);
} finally {
  await browser?.close();
  await fontServer?.close();
  if (server) await stopServer(server);
  await fs.rm(downloadDirectory, { recursive: true, force: true });
}

async function uploadCsv(page, csv, name) {
  await page.evaluate(({ csv, name }) => {
    const input = document.querySelector('[data-ui-component="file-drop-zone"] input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("Spreadsheet input is missing.");
    const transfer = new DataTransfer();
    transfer.items.add(new File([csv], name, { type: "text/csv" }));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { csv, name });
}

async function uploadLogo(page) {
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext("2d");
    context.fillStyle = "#0879d9"; context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#ffffff"; context.fillRect(20, 20, 24, 24);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const input = document.querySelector('[data-testid="qr-bulk-logo"]');
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], "logo.png", { type: "image/png" }));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function setInput(page, selector, value) {
  await page.$eval(selector, (input, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function selectValue(page, selector, value) {
  await page.select(selector, value);
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((label) => {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Unable to click ${text}.`);
}

async function waitForDownload(name, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const stats = await fs.stat(path.join(downloadDirectory, name));
      if (stats.size > 0) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${name}.`);
}

async function startServer() {
  const child = spawn(process.execPath, [path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: repositoryRoot, env: { ...process.env, BROWSER: "none" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early: ${output.join("")}`);
    try { if ((await fetch(baseUrl)).ok) return child; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
