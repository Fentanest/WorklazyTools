import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-concat-memory"));
const measuredRuns = Number(argumentValue("--runs") || 3);
const fixtureDurationSeconds = Number(argumentValue("--fixture-duration") || 14);
const selectedDurationSeconds = Number(argumentValue("--selected-duration") || 4.5);
const comparisonInputCount = Number(argumentValue("--comparison-inputs") || 8);
const boundaryHighInputCount = Number(argumentValue("--boundary-high") || 24);
const caseTimeoutMs = Number(argumentValue("--case-timeout-ms") || 12 * 60 * 1000);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";

if (!Number.isInteger(measuredRuns) || measuredRuns < 3) throw new Error("--runs must be an integer of at least 3");
if (!Number.isFinite(fixtureDurationSeconds) || fixtureDurationSeconds <= 0) throw new Error("--fixture-duration must be positive");
if (!Number.isFinite(selectedDurationSeconds) || selectedDurationSeconds <= 0 || selectedDurationSeconds > fixtureDurationSeconds) throw new Error("--selected-duration must be within the fixture duration");
if (!Number.isInteger(comparisonInputCount) || comparisonInputCount < 2) throw new Error("--comparison-inputs must be an integer of at least 2");
if (!Number.isInteger(boundaryHighInputCount) || boundaryHighInputCount <= comparisonInputCount) throw new Error("--boundary-high must exceed --comparison-inputs");

await fs.mkdir(outputDirectory, { recursive: true });
const fixturePath = path.join(outputDirectory, "concat-memory-fixture.mp4");
const fixtureArguments = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", `nullsrc=s=640x360:r=30:d=${fixtureDurationSeconds},geq=random(1)*255:128:128`,
  "-map", "0:v:0", "-an", "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0",
  "-g", "30", "-bf", "0", "-pix_fmt", "yuv420p", "-threads", "1",
  "-fflags", "+bitexact", "-flags:v", "+bitexact", "-map_metadata", "-1",
  fixturePath,
];
await execFileAsync("ffmpeg", fixtureArguments, { maxBuffer: 20 * 1024 * 1024 });
const fixtureStat = await fs.stat(fixturePath);
const fixtureSha256 = await sha256File(fixturePath);
const aggregateFixtureBytes = fixtureStat.size * comparisonInputCount;
const maximumSafeOutputBytes = 1.5 * 1024 * 1024 * 1024;
const estimatedSelectedBytesPerInput = fixtureStat.size * selectedDurationSeconds / fixtureDurationSeconds;
const maximumEligibleInputCount = Math.floor(maximumSafeOutputBytes / estimatedSelectedBytesPerInput);
if (aggregateFixtureBytes < 1_000_000_000) {
  throw new Error(`The aggregate comparison fixture is below 1 GB: ${aggregateFixtureBytes} bytes`);
}
if (boundaryHighInputCount < maximumEligibleInputCount) {
  throw new Error(`--boundary-high must be at least the product-eligible maximum ${maximumEligibleInputCount}`);
}

const server = await createBenchmarkServer(fixturePath, fixtureStat.size);
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
const baseUrl = `http://127.0.0.1:${address.port}`;

let browserVersion = "unknown";
let browserEnvironment;
const warmup = await runBrowserCase({ variant: "offloaded", inputCount: 2, cleanupSmoke: false });
if (warmup.status !== "success") throw new Error(`Concat benchmark warm-up failed: ${JSON.stringify(warmup)}`);
browserVersion = warmup.browserVersion;
browserEnvironment = warmup.environment;
const expectedSegmentBytes = warmup.segmentBytes[0];
if (!expectedSegmentBytes || warmup.segmentBytes.some((size) => size !== expectedSegmentBytes)) {
  throw new Error(`Warm-up segments were not deterministic: ${JSON.stringify(warmup.segmentBytes)}`);
}

const comparisonResults = [];
for (const variant of ["legacy", "offloaded"]) {
  for (let run = 1; run <= measuredRuns; run += 1) {
    process.stderr.write(`comparison ${variant} run=${run}/${measuredRuns} inputs=${comparisonInputCount}\n`);
    const result = await runBrowserCase({
      variant,
      inputCount: comparisonInputCount,
      expectedSegmentBytes,
      cleanupSmoke: variant === "offloaded" && run === 1,
    });
    comparisonResults.push({ variant, run, ...result });
    if (result.status !== "success") throw new Error(`Required 1 GB comparison failed: ${JSON.stringify(result)}`);
  }
}

const legacyHashes = comparisonResults.filter((result) => result.variant === "legacy").map((result) => result.outputSha256);
const offloadedHashes = comparisonResults.filter((result) => result.variant === "offloaded").map((result) => result.outputSha256);
const allHashes = [...legacyHashes, ...offloadedHashes];
if (new Set(allHashes).size !== 1) throw new Error(`Before/after output SHA-256 mismatch: ${JSON.stringify(allHashes)}`);

const boundaryResults = [];
await writeCheckpoint("comparison-complete");
const maximumSuccessfulInput = {};
for (const variant of ["legacy", "offloaded"]) {
  const maximum = await findMaximumSuccessfulInput(variant, expectedSegmentBytes);
  maximumSuccessfulInput[variant] = maximum;
}

const ffmpegVersion = (await execFileAsync("ffmpeg", ["-version"], { maxBuffer: 2 * 1024 * 1024 })).stdout.split("\n")[0];
const summary = {
  fixture: {
    path: fixturePath,
    bytes: fixtureStat.size,
    sha256: fixtureSha256,
    durationSeconds: fixtureDurationSeconds,
    selectedDurationSeconds,
    comparisonInputCount,
    aggregateInputBytes: aggregateFixtureBytes,
    estimatedSelectedBytesPerInput,
    maximumEligibleInputCount,
    maximumSafeOutputBytes,
  },
  environment: {
    browser: browserVersion,
    ...browserEnvironment,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
    ramBytes: os.totalmem(),
    ffmpeg: ffmpegVersion,
  },
  procedure: {
    command: ["node", "scripts/benchmark-video-concat-memory.mjs", ...process.argv.slice(2)],
    browserCore: "production @ffmpeg/core-mt 0.12.10 runtime with its fixed 1 GiB wasm heap",
    warmupRuns: 1,
    measuredRuns,
    medianRule: "middle value after ascending sort",
    before: "retain every generated segment in MEMFS and join from relative MEMFS paths",
    after: "read each generated segment, construct a Blob, delete the MEMFS file, mount all Blobs through WORKERFS, and join from absolute paths",
    browserProcessMemory: "peak total RSS of the isolated Chrome root process and every descendant, sampled from ps every 100 ms",
    memfsMetric: "sum of known generated files in MEMFS; WORKERFS source and segment Blob sizes are excluded",
    upperBoundSearch: `test the product-eligible maximum of ${maximumEligibleInputCount} whole logical input files, then binary search downward if the browser cannot complete it; ${maximumEligibleInputCount + 1} files exceed the existing 1.5 GiB pass-through guard`,
  },
  comparison: summarizeComparison(comparisonResults),
  comparisonRuns: comparisonResults,
  outputSha256: allHashes[0],
  shaIdentical: true,
  cleanupSmoke: comparisonResults.find((result) => result.variant === "offloaded" && result.run === 1)?.cleanupSmoke,
  maximumSuccessfulInput,
  boundaryResults,
};
const resultPath = path.join(outputDirectory, "concat-memory-results.json");
await fs.writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ resultPath, ...summary }, null, 2));
await server.close();

async function findMaximumSuccessfulInput(variant, expectedSegmentBytes) {
  const knownComparison = comparisonResults.find((result) => result.variant === variant && result.status === "success");
  if (!knownComparison) throw new Error(`No successful comparison result exists for ${variant}`);
  let low = comparisonInputCount;
  let high = maximumEligibleInputCount;
  process.stderr.write(`boundary ${variant} inputs=${high}\n`);
  const highResult = await runBrowserCase({ variant, inputCount: high, expectedSegmentBytes, cleanupSmoke: false });
  boundaryResults.push({ variant, inputCount: high, ...highResult });
  await writeCheckpoint(`boundary-${variant}-${high}`);
  if (highResult.status === "success") {
    return {
      inputCount: high,
      aggregateInputBytes: fixtureStat.size * high,
      estimatedSelectedInputBytes: estimatedSelectedBytesPerInput * high,
      selectedOutputBytes: highResult.outputBytes,
      memfsPeakBytes: highResult.memfsPeakBytes,
      firstFailingInputCount: null,
      firstFailingAggregateInputBytes: null,
      nextInputCountBlockedByProductGuard: high + 1,
    };
  }
  while (low + 1 < high) {
    const candidate = Math.floor((low + high) / 2);
    process.stderr.write(`boundary ${variant} inputs=${candidate}\n`);
    const result = await runBrowserCase({ variant, inputCount: candidate, expectedSegmentBytes, cleanupSmoke: false });
    boundaryResults.push({ variant, inputCount: candidate, ...result });
    await writeCheckpoint(`boundary-${variant}-${candidate}`);
    if (result.status === "success") low = candidate;
    else high = candidate;
  }
  const successfulResult = boundaryResults.find((result) => result.variant === variant && result.inputCount === low)
    || { ...knownComparison, inputCount: comparisonInputCount };
  return {
    inputCount: low,
    aggregateInputBytes: fixtureStat.size * low,
    estimatedSelectedInputBytes: estimatedSelectedBytesPerInput * low,
    selectedOutputBytes: successfulResult.outputBytes,
    memfsPeakBytes: successfulResult.memfsPeakBytes,
    firstFailingInputCount: high,
    firstFailingAggregateInputBytes: fixtureStat.size * high,
    nextInputCountBlockedByProductGuard: maximumEligibleInputCount + 1,
  };
}

async function writeCheckpoint(stage) {
  await fs.writeFile(path.join(outputDirectory, "concat-memory-checkpoint.json"), `${JSON.stringify({
    stage,
    fixture: { bytes: fixtureStat.size, sha256: fixtureSha256, aggregateFixtureBytes },
    comparisonResults,
    boundaryResults,
  }, null, 2)}\n`);
}

async function runBrowserCase({ variant, inputCount, expectedSegmentBytes = 0, cleanupSmoke }) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    protocolTimeout: caseTimeoutMs + 60_000,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--js-flags=--expose-gc"],
  });
  const rootPid = browser.process()?.pid;
  const page = await browser.newPage();
  page.setDefaultTimeout(caseTimeoutMs);
  let sampling = true;
  const samples = [];
  const samplingPromise = sampleChromeRss(rootPid, samples, () => sampling);
  try {
    await page.goto(`${baseUrl}/__video-concat-memory`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => typeof window.runConcatMemoryBenchmark === "function", { timeout: 60_000 });
    const environment = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGiB: navigator.deviceMemory ?? null,
      crossOriginIsolated: window.crossOriginIsolated,
      sharedArrayBufferAvailable: typeof SharedArrayBuffer !== "undefined",
    }));
    if (!environment.crossOriginIsolated || !environment.sharedArrayBufferAvailable) {
      throw new Error("The benchmark page did not establish the production multi-thread prerequisites");
    }
    const startedAt = Date.now();
    const evaluation = page.evaluate(
      (options) => window.runConcatMemoryBenchmark(options),
      { variant, inputCount, selectedDurationSeconds, expectedSegmentBytes, cleanupSmoke },
    );
    const result = await Promise.race([
      evaluation,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`case timed out after ${caseTimeoutMs}ms`)), caseTimeoutMs)),
    ]);
    sampling = false;
    await samplingPromise;
    return {
      ...result,
      elapsedMs: Date.now() - startedAt,
      aggregateInputBytes: fixtureStat.size * inputCount,
      browserPeakRssBytes: Math.max(0, ...samples.map((sample) => sample.rssBytes)),
      browserBaselineRssBytes: samples[0]?.rssBytes || 0,
      browserRssSamples: samples.length,
      browserVersion: await browser.version(),
      environment,
    };
  } catch (error) {
    sampling = false;
    await samplingPromise;
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      aggregateInputBytes: fixtureStat.size * inputCount,
      browserPeakRssBytes: Math.max(0, ...samples.map((sample) => sample.rssBytes)),
      browserBaselineRssBytes: samples[0]?.rssBytes || 0,
      browserRssSamples: samples.length,
      browserVersion: await browser.version().catch(() => "unavailable"),
    };
  } finally {
    sampling = false;
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function sampleChromeRss(rootPid, samples, keepSampling) {
  while (keepSampling()) {
    const rssBytes = await processTreeRssBytes(rootPid).catch(() => 0);
    samples.push({ elapsedMs: samples.length * 100, rssBytes });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function processTreeRssBytes(rootPid) {
  if (!rootPid) return 0;
  const { stdout } = await execFileAsync("ps", ["-e", "-o", "pid=,ppid=,rss="], { maxBuffer: 10 * 1024 * 1024 });
  const rows = stdout.trim().split("\n").map((line) => line.trim().split(/\s+/).map(Number));
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parentPid] of rows) {
      if (descendants.has(parentPid) && !descendants.has(pid)) {
        descendants.add(pid);
        changed = true;
      }
    }
  }
  return rows.reduce((sum, [pid, _parentPid, rssKiB]) => sum + (descendants.has(pid) ? rssKiB * 1024 : 0), 0);
}

function summarizeComparison(results) {
  return Object.fromEntries(["legacy", "offloaded"].map((variant) => {
    const successful = results.filter((result) => result.variant === variant && result.status === "success");
    return [variant, {
      runs: successful.length,
      medianElapsedMs: median(successful.map((result) => result.elapsedMs)),
      medianMemfsPeakBytes: median(successful.map((result) => result.memfsPeakBytes)),
      medianBrowserPeakRssBytes: median(successful.map((result) => result.browserPeakRssBytes)),
      medianBrowserBaselineRssBytes: median(successful.map((result) => result.browserBaselineRssBytes)),
      outputBytes: successful[0]?.outputBytes,
      outputSha256: successful[0]?.outputSha256,
    }];
  }));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function createBenchmarkServer(servedFixturePath, fixtureBytes) {
  const ffmpegModulePath = `/@fs${path.join(projectRoot, "node_modules/@ffmpeg/ffmpeg/dist/esm/index.js")}`;
  const helperModulePath = "/src/features/video-studio/videoConcatSegments.ts";
  const benchmarkModule = `
    import { FFmpeg, FFFSType } from ${JSON.stringify(ffmpegModulePath)};
    import { offloadConcatSegment, withMountedConcatSegments } from ${JSON.stringify(helperModulePath)};

    window.runConcatMemoryBenchmark = async ({ variant, inputCount, selectedDurationSeconds, expectedSegmentBytes, cleanupSmoke }) => {
      const ffmpeg = new FFmpeg();
      const logs = [];
      const inputMountPoint = "/concat-input";
      const segmentMountPoint = "/concat-segments";
      const segmentBlobs = [];
      const segmentBytes = [];
      const segmentNames = [];
      const outputName = "/joined.mp4";
      const listName = "/concat.txt";
      let inputMounted = false;
      let inputDirectoryCreated = false;
      let memfsCurrentBytes = 0;
      let memfsPeakBytes = 0;
      let phase = "load";
      ffmpeg.on("log", ({ message }) => {
        logs.push(message);
        if (logs.length > 100) logs.splice(0, logs.length - 100);
      });
      try {
        await ffmpeg.load({
          coreURL: "/tools/video-studio/runtime/multi/ffmpeg-core.js",
          wasmURL: "/tools/video-studio/runtime/multi/ffmpeg-core.wasm",
          workerURL: "/tools/video-studio/runtime/multi/ffmpeg-core.worker.js",
          classWorkerURL: "/tools/video-studio/runtime/ffmpeg-worker.js",
        });
        phase = "fixture";
        const response = await fetch("/__video-concat-memory-fixture.mp4");
        if (!response.ok) throw new Error("Fixture request failed with HTTP " + response.status);
        const fixtureBlob = await response.blob();
        if (fixtureBlob.size !== ${fixtureBytes}) throw new Error("Fixture size mismatch: " + fixtureBlob.size);
        const inputFiles = Array.from({ length: inputCount }, (_, index) => ({
          name: "fixture-" + index + ".mp4",
          data: new File([fixtureBlob], "fixture-" + index + ".mp4", { type: "video/mp4" }),
        }));
        inputDirectoryCreated = await ffmpeg.createDir(inputMountPoint);
        if (!inputDirectoryCreated) throw new Error("Unable to create input mount directory");
        inputMounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: inputFiles }, inputMountPoint);
        if (!inputMounted) throw new Error("Unable to mount input fixture files");

        for (let index = 0; index < inputCount; index += 1) {
          phase = "segment-" + index;
          const segmentName = "segment-" + index + ".mp4";
          const exitCode = await ffmpeg.exec([
            "-ss", "0.000", "-i", inputMountPoint + "/fixture-" + index + ".mp4",
            "-t", selectedDurationSeconds.toFixed(3), "-map", "0:v:0", "-c:v", "copy",
            "-an", "-avoid_negative_ts", "make_zero", segmentName,
          ]);
          if (exitCode !== 0) throw new Error("Segment " + index + " failed with exit " + exitCode);
          if (variant === "offloaded") {
            const segment = await offloadConcatSegment(ffmpeg, segmentName);
            segmentBlobs.push(segment);
            segmentBytes.push(segment.data.size);
            memfsPeakBytes = Math.max(memfsPeakBytes, segment.data.size);
          } else {
            if (!expectedSegmentBytes) throw new Error("Legacy measurement requires a known segment size");
            segmentNames.push(segmentName);
            segmentBytes.push(expectedSegmentBytes);
            memfsCurrentBytes += expectedSegmentBytes;
            memfsPeakBytes = Math.max(memfsPeakBytes, memfsCurrentBytes);
          }
        }

        phase = "join";
        let output;
        let listBytes = 0;
        if (variant === "offloaded") {
          output = await withMountedConcatSegments(ffmpeg, segmentMountPoint, segmentBlobs, async (absoluteNames) => {
            const list = absoluteNames.map((name) => "file '" + name + "'").join("\\n");
            listBytes = new TextEncoder().encode(list).byteLength;
            await ffmpeg.writeFile(listName, list);
            memfsCurrentBytes = listBytes;
            memfsPeakBytes = Math.max(memfsPeakBytes, memfsCurrentBytes);
            const exitCode = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", "-movflags", "+faststart", outputName]);
            if (exitCode !== 0) throw new Error("WORKERFS concat failed with exit " + exitCode);
            const bytes = await ffmpeg.readFile(outputName);
            if (typeof bytes === "string") throw new Error("Concat output was text");
            memfsCurrentBytes += bytes.byteLength;
            memfsPeakBytes = Math.max(memfsPeakBytes, memfsCurrentBytes);
            return bytes;
          });
        } else {
          const list = segmentNames.map((name) => "file '" + name + "'").join("\\n");
          listBytes = new TextEncoder().encode(list).byteLength;
          await ffmpeg.writeFile(listName, list);
          memfsCurrentBytes += listBytes;
          memfsPeakBytes = Math.max(memfsPeakBytes, memfsCurrentBytes);
          const exitCode = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", "-movflags", "+faststart", outputName]);
          if (exitCode !== 0) throw new Error("MEMFS concat failed with exit " + exitCode);
          output = await ffmpeg.readFile(outputName);
          if (typeof output === "string") throw new Error("Concat output was text");
          memfsCurrentBytes += output.byteLength;
          memfsPeakBytes = Math.max(memfsPeakBytes, memfsCurrentBytes);
        }
        phase = "digest";
        const outputSha256 = await digest(output);
        const decodeExitCode = await ffmpeg.exec(["-hide_banner", "-loglevel", "error", "-i", outputName, "-map", "0:v:0", "-f", "null", "-"]);
        if (decodeExitCode !== 0) throw new Error("Joined output decode failed with exit " + decodeExitCode);

        let cleanupResult;
        if (cleanupSmoke) cleanupResult = await runCleanupSmoke(ffmpeg, segmentBlobs);
        return {
          status: "success",
          variant,
          inputCount,
          segmentBytes,
          segmentTotalBytes: segmentBytes.reduce((sum, value) => sum + value, 0),
          listBytes,
          outputBytes: output.byteLength,
          outputSha256,
          decodeExitCode,
          memfsPeakBytes,
          cleanupSmoke: cleanupResult,
        };
      } catch (error) {
        return {
          status: "failed",
          variant,
          inputCount,
          failedPhase: phase,
          error: error instanceof Error ? error.message : String(error),
          diagnostics: logs.slice(-40),
          segmentBytes,
          memfsPeakBytes,
        };
      } finally {
        await ffmpeg.deleteFile(outputName).catch(() => undefined);
        await ffmpeg.deleteFile(listName).catch(() => undefined);
        for (let index = 0; index < inputCount; index += 1) await ffmpeg.deleteFile("segment-" + index + ".mp4").catch(() => undefined);
        if (inputMounted) await ffmpeg.unmount(inputMountPoint).catch(() => undefined);
        if (inputDirectoryCreated) await ffmpeg.deleteDir(inputMountPoint).catch(() => undefined);
        ffmpeg.terminate();
      }
    };

    async function runCleanupSmoke(ffmpeg, segmentBlobs) {
      const scenarios = [];
      for (const scenario of ["failure", "cancel"]) {
        const mountPoint = "/cleanup-" + scenario;
        let caught;
        try {
          await withMountedConcatSegments(ffmpeg, mountPoint, segmentBlobs.slice(0, 1), async () => {
            if (scenario === "cancel") throw new DOMException("benchmark cancellation", "AbortError");
            throw new Error("benchmark join failure");
          });
        } catch (error) {
          caught = { name: error?.name || "Error", message: error instanceof Error ? error.message : String(error) };
        }
        const rootNames = (await ffmpeg.listDir("/")).map(({ name }) => name);
        scenarios.push({ scenario, caught, residue: rootNames.filter((name) => name === mountPoint.slice(1)) });
      }
      if (scenarios.some(({ residue }) => residue.length)) throw new Error("Concat cleanup smoke left a mount directory");
      return scenarios;
    }

    async function digest(bytes) {
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }
  `;

  return createServer({
    root: projectRoot,
    logLevel: "error",
    plugins: [{
      name: "video-concat-memory-benchmark-page",
      configureServer(viteServer) {
        viteServer.middlewares.use((request, response, next) => {
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
          if (pathname === "/__video-concat-memory") {
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end('<!doctype html><html><head><meta charset="UTF-8"><title>Video concat memory benchmark</title></head><body><script type="module" src="/__video-concat-memory.js"></script></body></html>');
            return;
          }
          if (pathname === "/__video-concat-memory.js") {
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/javascript; charset=utf-8");
            response.end(benchmarkModule);
            return;
          }
          if (pathname === "/__video-concat-memory-fixture.mp4") {
            response.statusCode = 200;
            response.setHeader("Content-Type", "video/mp4");
            response.setHeader("Content-Length", String(fixtureBytes));
            createReadStream(servedFixturePath).pipe(response);
            return;
          }
          next();
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
}
