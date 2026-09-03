import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-excel-cleaner-heap"));
const rowCount = Number(argumentValue("--rows") || 100_000);
const columnCount = 10;
const heapLimitBytes = 1_200 * 1024 * 1024;
if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 100_000) throw new Error("--rows must be an integer from 1 through 100000.");
await fs.mkdir(outputDirectory, { recursive: true });

const server = await createServer({
  root: process.cwd(),
  logLevel: "error",
  plugins: [{
    name: "excel-cleaner-heap-benchmark",
    configureServer(viteServer) {
      viteServer.middlewares.use("/__excel-cleaner-heap", (_request, response) => {
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(`<!doctype html><meta charset="utf-8"><script type="module">
          import { runExcelCleanerPipeline } from "/src/features/excel-cleaner/engine.ts";
          import { createCleanerSheetModels, preflightExcelCleaner } from "/src/features/excel-cleaner/model.ts";
          import { buildExcelCleanerOutputs } from "/src/features/excel-cleaner/output.ts";
          import { parseSpreadsheetInput } from "/src/features/spreadsheet-core/inputAdapter.ts";

          const uuid = (suffix) => \`00000000-0000-4000-8000-\${String(suffix).padStart(12, "0")}\`;
          const heap = (phase, samples) => samples.push({ phase, bytes: performance.memory?.usedJSHeapSize ?? 0 });
          window.runExcelCleanerHeapBenchmark = async ({ rowCount, columnCount }) => {
            const samples = [];
            heap("baseline", samples);
            const header = Array.from({ length: columnCount }, (_, index) => \`Column \${index + 1}\`).join(",");
            const dataRow = ["not-a-date", "remove", ...Array.from({ length: columnCount - 2 }, (_, index) => \`value-\${index + 3}\`)].join(",");
            let source = \`\${header}\\n\${Array.from({ length: rowCount }, () => dataRow).join("\\n")}\`;
            let inputBuffer = new TextEncoder().encode(source).buffer;
            source = "";
            heap("input-buffer", samples);
            const book = await parseSpreadsheetInput("heap.csv", inputBuffer);
            inputBuffer = new ArrayBuffer(0);
            heap("parsed", samples);
            const pipeline = { version: 1, rules: [
              { type: "unify-date-format", id: uuid(1), columnIds: ["column:1"], outputFormat: "yyyy-mm-dd", inputHint: "text" },
              { type: "filter-rows", id: uuid(2), mode: "delete", columnId: "column:2", operator: "equals", value: "remove", caseSensitive: true },
            ] };
            const selections = [{ sheetName: "CSV", headerRow: 1 }];
            const preflight = preflightExcelCleaner(book, selections, pipeline);
            const models = createCleanerSheetModels(book, selections, preflight.downgradeFormulas, { consumeSource: true });
            book.sheets.length = 0;
            book.definedNames.length = 0;
            heap("projected", samples);
            const result = runExcelCleanerPipeline(models, pipeline, { previewRows: 20, date1904: false });
            heap("engine-complete", samples);
            const counts = { errors: result.errors.length, excluded: result.excluded.length, errorTruncated: result.summary.errorRowsTruncated, excludedTruncated: result.summary.excludedRowsTruncated };
            const outputs = await buildExcelCleanerOutputs(result, { fileName: "heap.csv", language: "en", pipeline, csvSafeMode: false }, "xlsx");
            heap("report-serialized", samples);
            const outputBytes = outputs.reduce((sum, item) => sum + item.byteLength, 0);
            result.sheets.length = 0;
            result.errors.length = 0;
            result.excluded.length = 0;
            outputs.forEach((item) => { item.buffer = new ArrayBuffer(0); });
            if (typeof window.gc === "function") window.gc();
            heap("released", samples);
            return { rowCount, columnCount, cells: rowCount * columnCount, counts, outputBytes, samples };
          };
          window.benchmarkReady = true;
        </script>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port: 0 },
});

await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Benchmark server did not bind a TCP port.");
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-precise-memory-info", "--js-flags=--expose-gc --max-old-space-size=2048"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(1_200_000);
  const client = await page.createCDPSession();
  await client.send("Performance.enable");
  await page.goto(`http://127.0.0.1:${address.port}/__excel-cleaner-heap`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.benchmarkReady === true);
  const polled = [];
  let polling = false;
  const timer = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const metrics = await client.send("Performance.getMetrics");
      const heap = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value;
      if (typeof heap === "number") polled.push(heap);
    } finally { polling = false; }
  }, 50);
  let result;
  try { result = await page.evaluate(({ rowCount, columnCount }) => window.runExcelCleanerHeapBenchmark({ rowCount, columnCount }), { rowCount, columnCount }); }
  finally { clearInterval(timer); }
  const peakObservedHeapBytes = Math.max(...polled, ...result.samples.map((sample) => sample.bytes));
  const report = {
    name: "excel-cleaner-100k-x-10-heap-gate",
    generatedAt: new Date().toISOString(),
    browser: await browser.version(),
    preciseMemoryInfo: true,
    heapLimitBytes,
    peakObservedHeapBytes,
    passed: peakObservedHeapBytes <= heapLimitBytes,
    ...result,
  };
  if (rowCount === 100_000 && (result.counts.errors !== 100_000 || result.counts.excluded !== 100_000 || result.counts.errorTruncated !== 0 || result.counts.excludedTruncated !== 0)) {
    throw new Error(`Worst-case report buffers did not reach their exact caps: ${JSON.stringify(result.counts)}`);
  }
  if (peakObservedHeapBytes > heapLimitBytes) throw new Error(`Excel Cleaner heap gate exceeded 1200 MiB: ${peakObservedHeapBytes} bytes.`);
  const reportPath = path.join(outputDirectory, `excel-cleaner-heap-${rowCount}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify({ ...report, reportPath }, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
} finally {
  await browser.close();
  await server.close();
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
