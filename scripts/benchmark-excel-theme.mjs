import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import puppeteer from "puppeteer-core";

const distributionRoot = path.resolve("dist");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-excel-theme-benchmark-"));
const fixturePath = path.join(temporaryDirectory, "theme-style-heavy.xlsx");
const rows = Number(process.env.EXCEL_BENCHMARK_ROWS || 150);
const columns = Number(process.env.EXCEL_BENCHMARK_COLUMNS || 80);
const runs = Number(process.env.EXCEL_BENCHMARK_RUNS || 3);

await createFixture(fixturePath, rows, columns);

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const resolvedPath = path.resolve(distributionRoot, `.${requestedPath}`);
    const withinDistribution = resolvedPath === distributionRoot || resolvedPath.startsWith(`${distributionRoot}${path.sep}`);
    const filePath = withinDistribution && await isFile(resolvedPath)
      ? resolvedPath
      : path.join(distributionRoot, "404.html");
    const body = await fs.readFile(filePath);
    response.writeHead(filePath === resolvedPath ? 200 : 404, {
      "Content-Length": body.length,
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Static test server error");
    console.error(error);
  }
});

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Benchmark server did not expose a TCP port.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const samples = [];
    for (let run = 0; run < runs; run += 1) {
      const page = await browser.newPage();
      page.setDefaultTimeout(180_000);
      await page.goto(`${baseUrl}/ko/tools/excel-merger/`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('input[type="file"]');
      await (await page.$('input[type="file"]')).uploadFile(fixturePath);
      await page.waitForFunction(() => document.querySelector(".file-security-status.ready"));
      await page.waitForFunction(() => !document.querySelector(".summary-card .primary-button")?.disabled);
      const started = performance.now();
      await page.click(".summary-card .primary-button");
      await page.waitForSelector(".result-download");
      samples.push(Math.round((performance.now() - started) * 100) / 100);
      await page.close();
    }
    const sorted = [...samples].sort((left, right) => left - right);
    const medianMs = sorted[Math.floor(sorted.length / 2)] ?? 0;
    console.log(JSON.stringify({ cells: rows * columns, rows, columns, runs, samplesMs: samples, medianMs }, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

async function createFixture(filePath, rowCount, columnCount) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Theme styles");
  const fills = [
    { type: "pattern", pattern: "solid", fgColor: { theme: 4, tint: -0.25 }, bgColor: { indexed: 64 } },
    { type: "pattern", pattern: "solid", fgColor: { theme: 5 }, bgColor: { indexed: 64 } },
    { type: "pattern", pattern: "solid", fgColor: { theme: 7, tint: 0.7999816888943144 }, bgColor: { indexed: 64 } },
  ];
  for (let row = 1; row <= rowCount; row += 1) {
    for (let column = 1; column <= columnCount; column += 1) {
      const cell = sheet.getCell(row, column);
      cell.value = row * column;
      cell.fill = fills[(row + column) % fills.length];
      cell.font = { color: { theme: (row + column) % 2 }, bold: row % 7 === 0 };
      cell.border = { bottom: { style: "thin", color: { theme: 3, tint: 0.25 } } };
    }
  }
  await workbook.xlsx.writeFile(filePath);
}

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function contentType(filePath) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}
