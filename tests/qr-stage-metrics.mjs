import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { readNetLogResponses, attachTransferBytes } from "./qr-network-metrics.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = process.env.QR_METRICS_OUTPUT || "/tmp/worklazy-qr-stage-metrics";
const port = Number(process.env.QR_METRICS_PORT || 4180);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const stages = ["entry", "file-selected", "generated-manifest", "pdf-complete"];
const rows = new Map();
const networkEvents = [];
const workerTargets = [];
const errors = [];
const setupTasks = [];
let stage = stages[0];
let lastActivity = Date.now();
let browser;
let server;
let commandId = 0;
const commands = new Map();

// The page session observes the initial worker script; attached worker sessions
// observe worker imports/fetches. IDs are session-scoped, so no URL dedup hides
// repeated transfers. Auto-attach pauses workers until Network is enabled.
function networkEvent(sessionId, scope, method, params) {
  if (!method.startsWith("Network.")) return;
  networkEvents.push({ sessionId, scope, method, params });
  lastActivity = Date.now();
  const key = `${sessionId}:${params.requestId}`;
  if (method === "Network.requestWillBeSent") {
    const previous = rows.get(key);
    if (previous && params.redirectResponse) rows.set(`${key}:redirect:${rows.size}`, { ...previous, status: params.redirectResponse.status, transferBytes: params.redirectResponse.encodedDataLength, complete: true });
    rows.set(key, { sessionId, requestId: params.requestId, scope, stage, url: params.request.url,
      type: params.type, initiator: params.initiator.type, transferBytes: 0,
      fromDiskCache: false, fromServiceWorker: false, servedFromCache: false, complete: false });
  }
  // Chromium hands a dedicated worker's initial script request from the page
  // to its target session: response/finish may arrive only on the worker.
  const matches = [...rows.values()].filter((row) => row.requestId === params.requestId && !row.complete);
  const row = rows.get(key) ?? (matches.length === 1 ? matches[0] : undefined);
  if (!row) return;
  if (scope === "worker") { row.scope = "worker"; row.completionSessionId = sessionId; }
  if (method === "Network.responseReceived") Object.assign(row, {
    status: params.response.status, mimeType: params.response.mimeType,
    fromDiskCache: params.response.fromDiskCache ?? false,
    fromServiceWorker: params.response.fromServiceWorker ?? false,
    contentEncoding: params.response.headers["Content-Encoding"] ?? params.response.headers["content-encoding"] ?? "identity",
  });
  if (method === "Network.requestServedFromCache") row.servedFromCache = true;
  if (method === "Network.loadingFinished") Object.assign(row, { transferBytes: params.encodedDataLength, complete: true });
  if (method === "Network.loadingFailed") Object.assign(row, { complete: true, failure: params.errorText });
}

async function settle() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await Promise.all(setupTasks);
    if (Date.now() - lastActivity >= 700 && [...rows.values()].every(({ complete }) => complete)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Unsettled network: ${JSON.stringify([...rows.values()].filter(({ complete }) => !complete))}`);
}

try {
  await fs.mkdir(outputDirectory, { recursive: true });
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, [path.join(repositoryRoot, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"] });
    const output = []; server.stdout.on("data", (chunk) => output.push(String(chunk))); server.stderr.on("data", (chunk) => output.push(String(chunk)));
    const deadline = Date.now() + 30_000;
    while (true) {
      if (server.exitCode !== null || Date.now() > deadline) throw new Error(`Preview unavailable: ${output.join("")}`);
      try { if ((await fetch(baseUrl)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", `--log-net-log=${path.resolve(outputDirectory, "netlog.json")}`, "--net-log-capture-mode=Default"] });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light", serviceWorkers: "block", acceptDownloads: true });
  await context.addInitScript(() => {
    localStorage.setItem("worklazy_privacy_consent", "granted");
    localStorage.setItem("worklazy_lang", "ko");
  });
  const responseTasks = [];
  context.on("requestfinished", (request) => {
    const task = (async () => {
      const sizes = await request.sizes();
      const response = await request.response();
      // Playwright's internal early target attachment retains the initial
      // worker response which a later public CDP session may not receive.
      const candidates = [...rows.values()].filter((row) => row.url === request.url() && !row.complete);
      if (candidates.length === 1 && workerTargets.some(({ url }) => url === request.url())) {
        const row = candidates[0];
        Object.assign(row, { scope: "worker", complete: true,
          status: response.status(), transferBytes: sizes.responseBodySize + sizes.responseHeadersSize,
          transferSource: "Playwright Request.sizes (Chromium initial worker response)",
          responseBodyBytes: sizes.responseBodySize, responseHeaderBytes: sizes.responseHeadersSize,
          fromServiceWorker: response.fromServiceWorker(),
          mimeType: (await response.allHeaders())["content-type"],
        });
      }
      lastActivity = Date.now();
    })();
    responseTasks.push(task);
    task.catch((error) => errors.push(error.message));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (error) => errors.push(error.message));
  const session = await context.newCDPSession(page);
  const workerCommand = async (sessionId, method, params = {}) => {
    const id = ++commandId;
    const result = new Promise((resolve, reject) => commands.set(id, { resolve, reject }));
    await session.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) });
    return result;
  };
  for (const method of ["requestWillBeSent", "responseReceived", "requestServedFromCache", "loadingFinished", "loadingFailed"]) {
    session.on(`Network.${method}`, (params) => networkEvent("page", "page", `Network.${method}`, params));
  }
  session.on("Target.receivedMessageFromTarget", ({ sessionId, message }) => {
    const event = JSON.parse(message);
    if (event.id) {
      const command = commands.get(event.id);
      commands.delete(event.id);
      if (event.error) command?.reject(new Error(event.error.message)); else command?.resolve(event.result);
    } else networkEvent(sessionId, "worker", event.method, event.params);
  });
  session.on("Target.attachedToTarget", ({ sessionId, targetInfo }) => {
    workerTargets.push({ sessionId, type: targetInfo.type, url: targetInfo.url, stage });
    const setup = (async () => {
      await workerCommand(sessionId, "Network.enable");
      await workerCommand(sessionId, "Network.setCacheDisabled", { cacheDisabled: true });
      await workerCommand(sessionId, "Runtime.runIfWaitingForDebugger");
    })();
    setupTasks.push(setup);
    setup.catch((error) => errors.push(error.message));
  });
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: false });

  await page.goto(`${baseUrl}/ko/tools/qr-studio/bulk`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="qr-bulk-page"]').waitFor();
  await settle();

  stage = stages[1];
  const csv = "Primary\n한글 라벨 첫째\n한글 라벨 둘째";
  await page.locator('[data-ui-component="file-drop-zone"] input[type="file"]').setInputFiles({ name: "한글-QR.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator('[data-testid="qr-payload-type"]').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="qr-bulk-generate"] button')?.disabled);
  await page.locator('[data-testid="qr-mapping-title-template"]').fill("한글 라벨 제목");
  await settle();

  stage = stages[2];
  await page.locator('[data-testid="qr-bulk-generate"] button').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="qr-bulk-results"]')?.textContent?.includes("성공 2개 · 실패 0개"));
  const manifestPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "목록·실패 보고서", exact: true }).click();
  const manifestDownload = await manifestPromise;
  const manifestPath = path.join(outputDirectory, manifestDownload.suggestedFilename());
  await manifestDownload.saveAs(manifestPath);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(manifestPath);
  assert.equal(workbook.worksheets.length, 2); assert.equal(workbook.worksheets[0].rowCount, 3);
  await settle();

  stage = stages[3];
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "라벨 PDF 다운로드", exact: true }).click();
  const pdfDownload = await pdfPromise;
  const pdfPath = path.join(outputDirectory, pdfDownload.suggestedFilename());
  await pdfDownload.saveAs(pdfPath);
  const pdf = await PDFDocument.load(await fs.readFile(pdfPath)); assert.equal(pdf.getPageCount(), 1);
  await settle();

  await Promise.all(responseTasks);
  const browserVersion = await browser.version();
  await browser.close(); // Flush NetLog before reading the encoded worker body.
  browser = undefined;
  const requests = [...rows.values()];
  attachTransferBytes(requests, readNetLogResponses(JSON.parse(await fs.readFile(path.join(outputDirectory, "netlog.json"), "utf8"))));
  for (const row of requests) {
    const url = new URL(row.url);
    row.cache = row.fromDiskCache || row.fromServiceWorker || row.servedFromCache || row.netlogCacheRead ? "cache" : "network";
    row.workerScript = workerTargets.some((target) => target.url === row.url);
    row.jsGzipBytes = 0;
    if (url.origin === new URL(baseUrl).origin && url.pathname.endsWith(".js")) {
      // Gzip equivalence is separate from actual encoded transfer and headers.
      const asset = path.resolve(repositoryRoot, "dist", `.${decodeURIComponent(url.pathname)}`);
      assert.ok(asset.startsWith(path.join(repositoryRoot, "dist") + path.sep));
      row.jsGzipBytes = gzipSync(await fs.readFile(asset)).length;
    }
  }
  const externalRequests = requests.filter(({ url }) => new URL(url).origin !== new URL(baseUrl).origin && !/^(blob|data):/.test(url));
  const table = []; let cumulativeTransferBytes = 0; let cumulativeJsGzipBytes = 0;
  for (const stage of stages) {
    const selected = requests.filter((row) => row.stage === stage);
    const transferBytes = selected.reduce((sum, row) => sum + row.transferBytes, 0);
    const jsGzipBytes = selected.reduce((sum, row) => sum + row.jsGzipBytes, 0);
    cumulativeTransferBytes += transferBytes; cumulativeJsGzipBytes += jsGzipBytes;
    table.push({ stage, requests: selected.length, transferBytes, jsGzipBytes, cumulativeTransferBytes, cumulativeJsGzipBytes });
  }
  const topChunks = requests.filter(({ jsGzipBytes }) => jsGzipBytes > 0).sort((a, b) => b.jsGzipBytes - a.jsGzipBytes).slice(0, 10);
  const fontRequests = requests.filter(({ url }) => /\.(otf|ttf|woff2?)(\?|$)/.test(url));
  const report = { measuredAt: new Date().toISOString(), conditions: {
    build: "VITE_LOCAL_QA=1 production", browser: browserVersion, viewport: { width: 1365, height: 900 },
    context: "fresh", serviceWorkers: "blocked", cache: "CDP disabled for page and each paused worker; no page.route interception",
    throttling: "none; local preview", transferBytes: "NetLog encoded response body + HTTP headers for all requests; excludes HTTP chunk framing; CDP values retained separately (initial worker CDP can contain only headers)",
    jsGzipBytes: "gzipSync of served dist JS bytes, per request; separate from actual HTTP transfer",
    stageAttribution: "request start; every stage waits for completion + 700ms quiet before advancing",
    input: { name: "한글-QR.csv", csv, rows: 2 },
    excelJs: "inputAdapter.ts:2 static import; loaded during file selection, before generation/manifest",
  }, table, topChunks, fontRequests, workerTargets, requests, externalRequests, errors };
  await fs.writeFile(path.join(outputDirectory, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = ["| Stage | Requests | Transfer B | JS gzip B | Cumulative transfer B | Cumulative JS gzip B |", "|---|---:|---:|---:|---:|---:|",
    ...table.map((row) => `| ${Object.values(row).join(" | ")} |`), "", "| Stage | Scope | Chunk | JS gzip B | Transfer B |", "|---|---|---|---:|---:|",
    ...topChunks.map((row) => `| ${row.stage} | ${row.workerScript ? "worker script" : row.scope} | ${new URL(row.url).pathname} | ${row.jsGzipBytes} | ${row.transferBytes} |`),
    "", "ExcelJS: file selection (inputAdapter.ts:2 static import). JS gzip is a separately computed equivalence, not the preview server's actual transfer encoding."];
  await fs.writeFile(path.join(outputDirectory, "tables.md"), `${markdown.join("\n")}\n`);
  console.log(markdown.join("\n"));
  console.log(`QR metrics: ${outputDirectory}/metrics.json; worker targets=${workerTargets.length}; font requests=${fontRequests.length}`);
  assert.equal(externalRequests.length, 0); assert.deepEqual(errors, []);
  assert.ok(workerTargets.some(({ type }) => type === "worker"), "QR generation worker was not observed");
  for (const target of workerTargets) assert.ok(requests.some(({ url }) => url === target.url), `Missing worker script request ${target.url}`);
  assert.ok(fontRequests.some(({ stage, url }) => stage === "pdf-complete" && url.endsWith(".otf")), "PDF font request missing");
  assert.ok(requests.some(({ stage, url }) => stage === "file-selected" && /exceljs/i.test(url)), "ExcelJS stage attribution changed");
  assert.ok(requests.every(({ complete, failure, fromServiceWorker }) => complete && !failure && !fromServiceWorker));
} finally {
  await fs.writeFile(path.join(outputDirectory, "network-events.json"), JSON.stringify({ workerTargets, rows: [...rows.values()], networkEvents }, null, 2));
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
