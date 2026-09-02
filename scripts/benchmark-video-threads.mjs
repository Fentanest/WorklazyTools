import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

import { resolveVideoEncodingThreadCount } from "../src/features/video-studio/videoEncoding.ts";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const sourceFixtureRelativePath = "tests/fixtures/video-vp9-benchmark.mp4";
const sourceFixturePath = path.join(projectRoot, sourceFixtureRelativePath);
const expectedSourceFixtureSha256 = "15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5";
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-thread-benchmark"));
const measuredRuns = Number(argumentValue("--runs") || 3);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const browserTimeoutMs = Number(argumentValue("--browser-timeout-ms") || 10 * 60 * 1000);
const vp9TimeoutMs = Number(argumentValue("--vp9-timeout-ms") || 45 * 1000);
const resume = process.argv.includes("--resume");
const hostOnly = process.argv.includes("--host-only");
const fixtureFrameCount = 24;
const resolutions = [
  { name: "1080p", width: 1920, height: 1080, endpoint: "/__video-thread-fixture-1080p.mp4" },
  { name: "4K", width: 3840, height: 2160, endpoint: "/__video-thread-fixture-4k.mp4" },
];
const codecs = ["h264", "hevc", "vp9"];

if (!Number.isInteger(measuredRuns) || measuredRuns < 3) throw new Error("--runs must be an integer of at least 3");
if (!Number.isFinite(browserTimeoutMs) || browserTimeoutMs <= 0) throw new Error("--browser-timeout-ms must be positive");
if (!Number.isFinite(vp9TimeoutMs) || vp9TimeoutMs <= 0) throw new Error("--vp9-timeout-ms must be positive");

const sourceFixtureBytes = await fs.readFile(sourceFixturePath);
const sourceFixtureSha256 = sha256(sourceFixtureBytes);
if (sourceFixtureSha256 !== expectedSourceFixtureSha256) {
  throw new Error(`Fixture SHA-256 mismatch: expected ${expectedSourceFixtureSha256}, got ${sourceFixtureSha256}`);
}

await fs.mkdir(outputDirectory, { recursive: true });
const browserCheckpointPath = path.join(outputDirectory, "browser-checkpoint.json");
const fixtureRecords = [];
for (const resolution of resolutions) {
  const fixturePath = path.join(outputDirectory, `thread-benchmark-${resolution.name.toLowerCase()}.mp4`);
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourceFixturePath,
    "-map", "0:v:0", "-frames:v", String(fixtureFrameCount),
    "-vf", `scale=${resolution.width}:${resolution.height}:flags=lanczos`,
    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-threads", "1", "-x264-params", "threads=1:lookahead_threads=1",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-map_metadata", "-1",
    fixturePath,
  ];
  await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
  const bytes = await fs.readFile(fixturePath);
  fixtureRecords.push({
    ...resolution,
    path: fixturePath,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    generationCommand: ["ffmpeg", ...args],
  });
}

const multiCorePath = path.join(projectRoot, "public/tools/video-studio/runtime/multi/ffmpeg-core.js");
const multiWasmPath = path.join(projectRoot, "public/tools/video-studio/runtime/multi/ffmpeg-core.wasm");
const multiWorkerPath = path.join(projectRoot, "public/tools/video-studio/runtime/multi/ffmpeg-core.worker.js");
const [multiCoreBytes, multiWasmBytes, multiWorkerBytes] = await Promise.all([
  fs.readFile(multiCorePath),
  fs.readFile(multiWasmPath),
  fs.readFile(multiWorkerPath),
]);
const multiCoreSource = multiCoreBytes.toString("utf8");
if (!multiCoreSource.includes('INITIAL_MEMORY=Module["INITIAL_MEMORY"]||1073741824')) {
  throw new Error("The browser MT core no longer declares the expected fixed 1 GiB initial heap");
}

const server = await createBenchmarkServer(fixtureRecords);
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  protocolTimeout: browserTimeoutMs * (measuredRuns + 3),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const browserVersion = await browser.version();

let browserEnvironment;
const browserResults = resume ? await readJsonArray(browserCheckpointPath) : [];
if (!resume) await fs.writeFile(browserCheckpointPath, "[]\n");
try {
  const environmentPage = await browser.newPage();
  await environmentPage.goto(`${baseUrl}/__video-thread-benchmark`, { waitUntil: "domcontentloaded" });
  await environmentPage.waitForFunction(() => typeof window.runVideoThreadBenchmark === "function");
  browserEnvironment = await environmentPage.evaluate(() => ({
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGiB: navigator.deviceMemory ?? null,
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBufferAvailable: typeof SharedArrayBuffer !== "undefined",
  }));
  await environmentPage.close();
  if (!browserEnvironment.crossOriginIsolated || !browserEnvironment.sharedArrayBufferAvailable) {
    throw new Error("The benchmark page did not establish the production multi-thread prerequisites");
  }

  const currentThreads = resolveVideoEncodingThreadCount(browserEnvironment.hardwareConcurrency, false);
  const candidateThreads = Math.min(8, Math.max(4, browserEnvironment.hardwareConcurrency - 1));
  const threadVariants = [
    { label: "current", threads: currentThreads },
    { label: "candidate", threads: candidateThreads },
  ].filter((variant, index, variants) => variants.findIndex((candidate) => candidate.threads === variant.threads) === index);

  for (const fixture of hostOnly ? [] : fixtureRecords) {
    for (const codec of codecs) {
      for (const variant of threadVariants) {
        const existingResultIndex = browserResults.findIndex((result) => result.codec === codec && result.resolution === fixture.name && result.threadCount === variant.threads);
        if (existingResultIndex >= 0 && browserResults[existingResultIndex].status === "success") {
          process.stderr.write(`browser resume-skip ${codec} ${fixture.name} threads=${variant.threads}\n`);
          continue;
        }
        if (existingResultIndex >= 0) browserResults.splice(existingResultIndex, 1);
        process.stderr.write(`browser ${codec} ${fixture.name} threads=${variant.threads}\n`);
        const page = await browser.newPage();
        const caseTimeoutMs = codec === "vp9" ? vp9TimeoutMs : browserTimeoutMs;
        page.setDefaultTimeout(caseTimeoutMs);
        try {
          await page.goto(`${baseUrl}/__video-thread-benchmark`, { waitUntil: "domcontentloaded", timeout: caseTimeoutMs });
          await page.waitForFunction(() => typeof window.runVideoThreadBenchmark === "function", { timeout: caseTimeoutMs });
          const result = await page.evaluate(
            ({ codec, fixtureEndpoint, measuredRuns, threadCount, timeoutMs }) => window.runVideoThreadBenchmark({ codec, fixtureEndpoint, measuredRuns, threadCount, timeoutMs }),
            { codec, fixtureEndpoint: fixture.endpoint, measuredRuns, threadCount: variant.threads, timeoutMs: caseTimeoutMs },
          );
          browserResults.push({ codec, resolution: fixture.name, variant: variant.label, threadCount: variant.threads, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          browserResults.push({
            codec,
            resolution: fixture.name,
            variant: variant.label,
            threadCount: variant.threads,
            status: "failed",
            oom: isOomText(message),
            error: message,
            timingsMs: [],
          });
        } finally {
          await fs.writeFile(browserCheckpointPath, `${JSON.stringify(browserResults, null, 2)}\n`);
          await page.close().catch(() => undefined);
        }
      }
    }
  }
} finally {
  await browser.close().catch(() => undefined);
  await server.close().catch(() => undefined);
}

const hostFallbackResults = [];
const fallbackPairs = new Set(
  hostOnly
    ? fixtureRecords.flatMap((fixture) => codecs.map((codec) => `${codec}:${fixture.name}`))
    : browserResults.filter((result) => result.status !== "success").map((result) => `${result.codec}:${result.resolution}`),
);
const hostThreadVariants = [
  { label: "current", threads: resolveVideoEncodingThreadCount(browserEnvironment.hardwareConcurrency, false) },
  { label: "candidate", threads: Math.min(8, Math.max(4, browserEnvironment.hardwareConcurrency - 1)) },
];
for (const fixture of fixtureRecords) {
  for (const codec of codecs) {
    if (!fallbackPairs.has(`${codec}:${fixture.name}`)) continue;
    for (const variant of hostThreadVariants) {
      process.stderr.write(`host-fallback ${codec} ${fixture.name} threads=${variant.threads}\n`);
      hostFallbackResults.push(await runHostFallback(codec, fixture, variant.label, variant.threads));
    }
  }
}

const ffmpegVersion = (await execFileAsync("ffmpeg", ["-version"], { maxBuffer: 2 * 1024 * 1024 })).stdout.split("\n")[0];
const result = {
  fixtureSource: {
    path: sourceFixtureRelativePath,
    bytes: sourceFixtureBytes.byteLength,
    sha256: sourceFixtureSha256,
  },
  fixtures: fixtureRecords.map(({ endpoint, ...fixture }) => fixture),
  environment: {
    browser: browserVersion,
    ...browserEnvironment,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
    ramBytes: os.totalmem(),
    ffmpeg: ffmpegVersion,
    mtRuntime: {
      fixedHeapBytes: 1024 * 1024 * 1024,
      core: { path: path.relative(projectRoot, multiCorePath), bytes: multiCoreBytes.byteLength, sha256: sha256(multiCoreBytes) },
      wasm: { path: path.relative(projectRoot, multiWasmPath), bytes: multiWasmBytes.byteLength, sha256: sha256(multiWasmBytes) },
      pthreadWorker: { path: path.relative(projectRoot, multiWorkerPath), bytes: multiWorkerBytes.byteLength, sha256: sha256(multiWorkerBytes) },
    },
  },
  procedure: {
    command: ["node", "--experimental-strip-types", "scripts/benchmark-video-threads.mjs", ...process.argv.slice(2)],
    browserCore: "production @ffmpeg/core-mt 0.12.10 runtime served with COOP same-origin and COEP require-corp",
    warmupRuns: 1,
    measuredRuns,
    medianRule: "middle value after ascending sort",
    threadCounts: {
      current: resolveVideoEncodingThreadCount(browserEnvironment.hardwareConcurrency, false),
      candidate: Math.min(8, Math.max(4, browserEnvironment.hardwareConcurrency - 1)),
    },
    inputFrames: fixtureFrameCount,
    perEncodeTimeoutMs: browserTimeoutMs,
    vp9PerEncodeTimeoutMs: vp9TimeoutMs,
    audio: "removed",
    outputDecodeCheck: "the final successful output is decoded in the same browser FFmpeg core",
    hostFallback: "only browser-unavailable combinations are repeated in isolated host FFmpeg processes; /usr/bin/time -v records peak RSS",
  },
  browserResults,
  hostFallbackResults,
};
const resultPath = path.join(outputDirectory, "thread-benchmark-results.json");
await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ resultPath, ...result }, null, 2));

async function createBenchmarkServer(fixtures) {
  const ffmpegModulePath = `/@fs${path.join(projectRoot, "node_modules/@ffmpeg/ffmpeg/dist/esm/index.js")}`;
  const benchmarkModule = `
    import { FFmpeg, FFFSType } from ${JSON.stringify(ffmpegModulePath)};

    const codecArguments = {
      h264: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "30"],
      hevc: ["-c:v", "libx265", "-preset", "veryfast", "-crf", "30", "-tag:v", "hvc1"],
      vp9: ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4"],
    };
    const codecExtensions = { h264: "mp4", hevc: "mp4", vp9: "webm" };
    const oomPattern = /out of memory|memory access out of bounds|failed to allocate|cannot enlarge memory|oom|abort\\(/i;

    window.runVideoThreadBenchmark = async ({ codec, fixtureEndpoint, measuredRuns, threadCount, timeoutMs }) => {
      const ffmpeg = new FFmpeg();
      const logs = [];
      ffmpeg.on("log", ({ message }) => {
        logs.push(message);
        if (logs.length > 300) logs.splice(0, logs.length - 300);
      });
      const outputName = "/thread-output." + codecExtensions[codec];
      const timingsMs = [];
      const outputSizes = [];
      const outputSha256 = [];
      let phase = "load";
      let mounted = false;
      let cleanable = false;
      try {
        await withTimeout(ffmpeg.load({
          coreURL: "/tools/video-studio/runtime/multi/ffmpeg-core.js",
          wasmURL: "/tools/video-studio/runtime/multi/ffmpeg-core.wasm",
          workerURL: "/tools/video-studio/runtime/multi/ffmpeg-core.worker.js",
          classWorkerURL: "/tools/video-studio/runtime/ffmpeg-worker.js",
        }), timeoutMs, "core load");
        phase = "fixture";
        const response = await fetch(fixtureEndpoint);
        if (!response.ok) throw new Error("Fixture request failed with HTTP " + response.status);
        const fixtureFile = new File([await response.blob()], "fixture.mp4", { type: "video/mp4" });
        await ffmpeg.createDir("/thread-input");
        mounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: "fixture.mp4", data: fixtureFile }] }, "/thread-input");
        if (!mounted) throw new Error("WORKERFS fixture mount failed");
        const args = [
          "-hide_banner", "-loglevel", "error", "-y",
          "-i", "/thread-input/fixture.mp4", "-map", "0:v:0",
          ...codecArguments[codec],
          "-threads", String(threadCount), "-an", outputName,
        ];
        for (let runIndex = -1; runIndex < measuredRuns; runIndex += 1) {
          phase = runIndex < 0 ? "warmup" : "measured-" + (runIndex + 1);
          const logStart = logs.length;
          const startedAt = performance.now();
          const exitCode = await withTimeout(ffmpeg.exec(args), timeoutMs, phase);
          const elapsedMs = performance.now() - startedAt;
          if (exitCode !== 0) throw new Error("FFmpeg exit " + exitCode + " during " + phase + ": " + logs.slice(logStart).join("\\n"));
          const output = await ffmpeg.readFile(outputName);
          if (typeof output === "string") throw new Error("FFmpeg returned text output");
          if (runIndex >= 0) {
            timingsMs.push(elapsedMs);
            outputSizes.push(output.byteLength);
            outputSha256.push(await digest(output));
          }
          if (runIndex < measuredRuns - 1) await ffmpeg.deleteFile(outputName);
        }
        phase = "decode-check";
        const decodeExitCode = await withTimeout(ffmpeg.exec(["-hide_banner", "-loglevel", "error", "-i", outputName, "-map", "0:v:0", "-f", "null", "-"]), timeoutMs, phase);
        if (decodeExitCode !== 0) throw new Error("Output decode failed with exit " + decodeExitCode);
        cleanable = true;
        return {
          status: "success",
          oom: false,
          timingsMs,
          medianMs: median(timingsMs),
          outputSizes,
          medianOutputBytes: median(outputSizes),
          outputSha256,
          decodeExitCode,
          args,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const diagnostic = [message, ...logs.slice(-80)].join("\\n");
        return {
          status: "failed",
          oom: oomPattern.test(diagnostic),
          failedPhase: phase,
          error: message,
          diagnostics: logs.slice(-80),
          timingsMs,
          outputSizes,
        };
      } finally {
        if (cleanable) {
          await withTimeout(ffmpeg.deleteFile(outputName), 5_000, "output cleanup").catch(() => undefined);
          if (mounted) await withTimeout(ffmpeg.unmount("/thread-input"), 5_000, "fixture unmount").catch(() => undefined);
          await withTimeout(ffmpeg.deleteDir("/thread-input"), 5_000, "fixture cleanup").catch(() => undefined);
        }
        ffmpeg.terminate();
      }
    };

    function median(values) {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)];
    }

    async function digest(bytes) {
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }

    function withTimeout(promise, timeoutMs, label) {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label + " timed out after " + timeoutMs + "ms")), timeoutMs)),
      ]);
    }
  `;
  return createServer({
    root: projectRoot,
    logLevel: "error",
    plugins: [{
      name: "video-thread-benchmark-page",
      configureServer(viteServer) {
        viteServer.middlewares.use(async (request, response, next) => {
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
          if (pathname === "/__video-thread-benchmark") {
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end('<!doctype html><html><head><meta charset="UTF-8"><title>Video thread benchmark</title></head><body><script type="module" src="/__video-thread-benchmark.js"></script></body></html>');
            return;
          }
          if (pathname === "/__video-thread-benchmark.js") {
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/javascript; charset=utf-8");
            response.end(benchmarkModule);
            return;
          }
          const fixture = fixtures.find((candidate) => candidate.endpoint === pathname);
          if (fixture) {
            const bytes = await fs.readFile(fixture.path);
            response.statusCode = 200;
            response.setHeader("Content-Type", "video/mp4");
            response.setHeader("Content-Length", String(bytes.byteLength));
            response.end(bytes);
            return;
          }
          next();
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
}

async function runHostFallback(codec, fixture, variant, threadCount) {
  const codecArgs = {
    h264: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "30"],
    hevc: ["-c:v", "libx265", "-preset", "veryfast", "-crf", "30", "-tag:v", "hvc1"],
    vp9: ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4"],
  }[codec];
  const extension = codec === "vp9" ? "webm" : "mp4";
  const outputPath = path.join(outputDirectory, `host-${codec}-${fixture.name.toLowerCase()}-${variant}-${threadCount}.${extension}`);
  const args = [
    "-hide_banner", "-loglevel", "error", "-y", "-i", fixture.path,
    "-map", "0:v:0", ...codecArgs,
    "-threads", String(threadCount), "-an", outputPath,
  ];
  await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
  const timingsMs = [];
  const peakRssKiB = [];
  let status = "success";
  let error;
  for (let runIndex = 0; runIndex < measuredRuns; runIndex += 1) {
    const startedAt = performance.now();
    try {
      const { stderr } = await execFileAsync("/usr/bin/time", ["-v", "ffmpeg", ...args], { maxBuffer: 20 * 1024 * 1024 });
      timingsMs.push(performance.now() - startedAt);
      const rssMatch = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
      peakRssKiB.push(rssMatch ? Number(rssMatch[1]) : null);
    } catch (caught) {
      status = "failed";
      error = caught instanceof Error ? caught.message : String(caught);
      break;
    }
  }
  if (status !== "success") {
    return { codec, resolution: fixture.name, variant, threadCount, status, oom: isOomText(error), error, timingsMs, peakRssKiB, args };
  }
  const outputBytes = await fs.readFile(outputPath);
  await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", outputPath, "-map", "0:v:0", "-f", "null", "-"], { maxBuffer: 20 * 1024 * 1024 });
  return {
    codec,
    resolution: fixture.name,
    variant,
    threadCount,
    status,
    oom: false,
    timingsMs,
    medianMs: median(timingsMs),
    peakRssKiB,
    medianPeakRssKiB: median(peakRssKiB.filter((value) => value !== null)),
    outputBytes: outputBytes.byteLength,
    outputSha256: sha256(outputBytes),
    decodeExitCode: 0,
    args,
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isOomText(value) {
  return /out of memory|memory access out of bounds|failed to allocate|cannot enlarge memory|oom|abort\(/i.test(value || "");
}

async function readJsonArray(filePath) {
  try {
    const value = JSON.parse(await fs.readFile(filePath, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
