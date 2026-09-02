import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const outputCount = Number(argumentValue("--outputs") || 4);
const bytesPerOutput = Number(argumentValue("--bytes-per-output") || 64 * 1024 * 1024);
const runs = Number(argumentValue("--runs") || 3);
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-result-storage-benchmark"));

if (!Number.isInteger(outputCount) || outputCount < 2) throw new Error("--outputs must be an integer of at least 2");
if (!Number.isInteger(bytesPerOutput) || bytesPerOutput < 1024 * 1024) throw new Error("--bytes-per-output must be at least 1 MiB");
if (!Number.isInteger(runs) || runs < 3) throw new Error("--runs must be an integer of at least 3");

await fs.mkdir(outputDirectory, { recursive: true });
const server = await createBenchmarkServer();
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-precise-memory-info", "--js-flags=--expose-gc"],
});
const browserVersion = await browser.version();
const measurements = [];

try {
  for (let run = 0; run < runs; run += 1) {
    const page = await browser.newPage();
    const cdp = await page.createCDPSession();
    await page.goto(`${baseUrl}/__video-result-storage-benchmark`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.runVideoResultStorageBenchmark === "function");
    await cdp.send("HeapProfiler.collectGarbage");
    const before = await cdp.send("Runtime.getHeapUsage");
    const result = await page.evaluate(
      ({ outputCount, bytesPerOutput }) => window.runVideoResultStorageBenchmark({ outputCount, bytesPerOutput }),
      { outputCount, bytesPerOutput },
    );
    await cdp.send("HeapProfiler.collectGarbage");
    const after = await cdp.send("Runtime.getHeapUsage");
    measurements.push({
      run: run + 1,
      ...result,
      mainHeapBeforeBytes: before.usedSize,
      mainHeapAfterBytes: after.usedSize,
      mainHeapDeltaBytes: after.usedSize - before.usedSize,
    });
    await page.evaluate(() => window.cleanupVideoResultStorageBenchmark());
    await page.close();
  }
} finally {
  await browser.close().catch(() => undefined);
  await server.close().catch(() => undefined);
}

const medianHeapDeltaBytes = median(measurements.map((result) => result.mainHeapDeltaBytes));
const totalOutputBytes = outputCount * bytesPerOutput;
const report = {
  environment: {
    browser: browserVersion,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
    ramBytes: os.totalmem(),
  },
  procedure: {
    command: ["node", "scripts/benchmark-video-result-storage.mjs", ...process.argv.slice(2)],
    outputs: outputCount,
    bytesPerOutput,
    totalOutputBytes,
    runs,
    measurement: "Chrome Runtime.getHeapUsage after forced garbage collection; the page retains File wrappers and object URLs for every output",
  },
  measurements,
  summary: {
    medianMainHeapDeltaBytes: medianHeapDeltaBytes,
    outputBytesPerMainHeapByte: medianHeapDeltaBytes > 0 ? totalOutputBytes / medianHeapDeltaBytes : null,
    medianHeapShareOfOutput: medianHeapDeltaBytes > 0 ? medianHeapDeltaBytes / totalOutputBytes : 0,
  },
};
const reportPath = path.join(outputDirectory, "video-result-storage-benchmark.json");
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, ...report }, null, 2));

async function createBenchmarkServer() {
  return createServer({
    root: projectRoot,
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "video-result-storage-benchmark",
      configureServer(viteServer) {
        viteServer.middlewares.use((request, response, next) => {
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          if (request.url === "/__video-result-storage-benchmark") {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(`<!doctype html><meta charset="utf-8"><script type="module">
              import {
                createVideoResultStorageSession,
                releaseVideoResultStorageSession,
                resolveVideoResultFile,
              } from "/src/features/video-studio/videoResultStorage.ts";

              let currentSession;
              let currentUrls = [];
              window.runVideoResultStorageBenchmark = async ({ outputCount, bytesPerOutput }) => {
                currentSession = await createVideoResultStorageSession();
                if (currentSession.mode !== "opfs") throw new Error("Browser temporary-file storage is unavailable");
                const worker = new Worker("/__video-result-storage-worker.js", { type: "module" });
                const outputs = await new Promise((resolve, reject) => {
                  worker.onmessage = (event) => event.data.type === "result" ? resolve(event.data.outputs) : reject(new Error(event.data.error));
                  worker.onerror = (event) => reject(new Error(event.message));
                  worker.postMessage({ session: currentSession, outputCount, bytesPerOutput });
                });
                worker.terminate();
                const retained = [];
                for (const output of outputs) {
                  if (output.data.kind !== "opfs") throw new Error("A synthetic output fell back to memory");
                  const file = await resolveVideoResultFile(output);
                  const url = URL.createObjectURL(file);
                  currentUrls.push(url);
                  retained.push({ output, file, url });
                }
                window.__videoResultStorageRetained = retained;
                return {
                  mode: currentSession.mode,
                  outputCount: retained.length,
                  retainedFileBytes: retained.reduce((sum, item) => sum + item.file.size, 0),
                  transferredArrayBuffers: outputs.filter((output) => output.data.kind === "buffer").length,
                };
              };
              window.cleanupVideoResultStorageBenchmark = async () => {
                currentUrls.forEach((url) => URL.revokeObjectURL(url));
                currentUrls = [];
                window.__videoResultStorageRetained = undefined;
                if (currentSession) await releaseVideoResultStorageSession(currentSession);
                currentSession = undefined;
              };
            </script>`);
            return;
          }
          if (request.url === "/__video-result-storage-worker.js") {
            response.setHeader("Content-Type", "text/javascript; charset=utf-8");
            response.end(`
              import { persistVideoWorkerResult } from "/src/features/video-studio/videoResultStorage.worker.ts";
              self.onmessage = async (event) => {
                try {
                  const { session, outputCount, bytesPerOutput } = event.data;
                  const outputs = [];
                  for (let index = 0; index < outputCount; index += 1) {
                    const bytes = new Uint8Array(bytesPerOutput);
                    for (let offset = 0; offset < bytes.length; offset += 4096) bytes[offset] = (index * 37 + offset) & 0xff;
                    const stored = await persistVideoWorkerResult(bytes, "result-" + (index + 1) + ".mp4", "video/mp4", session);
                    outputs.push(stored.output);
                  }
                  self.postMessage({ type: "result", outputs });
                } catch (error) {
                  self.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
                }
              };
            `);
            return;
          }
          next();
        });
      },
    }],
  });
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}
