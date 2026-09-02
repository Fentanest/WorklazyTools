import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

import { appendVideoRateControl } from "../src/features/video-studio/videoEncoding.ts";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const fixtureRelativePath = "tests/fixtures/video-vp9-benchmark.mp4";
const fixturePath = path.join(projectRoot, fixtureRelativePath);
const expectedFixtureSha256 = "15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5";
const label = argumentValue("--label") || "benchmark";
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-vp9-benchmark"));
const measuredRuns = Number(argumentValue("--runs") || 3);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";

if (!Number.isInteger(measuredRuns) || measuredRuns < 3) throw new Error("--runs must be an integer of at least 3");
const fixtureBytes = await fs.readFile(fixturePath);
const fixtureSha256 = sha256(fixtureBytes);
if (fixtureSha256 !== expectedFixtureSha256) {
  throw new Error(`Fixture SHA-256 mismatch: expected ${expectedFixtureSha256}, got ${fixtureSha256}`);
}

await fs.mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, `${safeLabel(label)}.webm`);
const browserEnvironment = await inspectBrowserEnvironment();
const ffmpegVersion = (await execFileAsync("ffmpeg", ["-version"], { maxBuffer: 2 * 1024 * 1024 })).stdout.split("\n")[0];
const rateControlArgs = [];
appendVideoRateControl(rateControlArgs, "vp9", "0", 30);
const ffmpegArgs = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", fixturePath,
  "-map", "0:v:0", "-c:v", "libvpx-vp9",
  ...rateControlArgs,
  "-threads", "4", "-an", outputPath,
];

await encodeOnce();
const timingsMs = [];
for (let index = 0; index < measuredRuns; index += 1) {
  const startedAt = performance.now();
  await encodeOnce();
  timingsMs.push(performance.now() - startedAt);
}

const outputBytes = await fs.readFile(outputPath);
await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", outputPath, "-f", "null", "-"], { maxBuffer: 10 * 1024 * 1024 });
const probe = JSON.parse((await execFileAsync("ffprobe", [
  "-v", "error",
  "-show_entries", "format=duration,size:stream=index,codec_name,codec_tag_string,width,height,r_frame_rate,avg_frame_rate",
  "-of", "json",
  outputPath,
], { maxBuffer: 10 * 1024 * 1024 })).stdout);
const [ssim, psnr] = await Promise.all([
  qualityMetric("ssim", /SSIM[^\n]*All:([0-9.]+)/),
  qualityMetric("psnr", /PSNR[^\n]*average:([0-9.]+)/),
]);

console.log(JSON.stringify({
  label,
  fixture: {
    path: fixtureRelativePath,
    bytes: fixtureBytes.byteLength,
    sha256: fixtureSha256,
    durationSeconds: 6,
    width: 640,
    height: 360,
    frameRate: 30,
  },
  environment: {
    ...browserEnvironment,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
    ramBytes: os.totalmem(),
    ffmpeg: ffmpegVersion,
  },
  procedure: {
    encoder: "host FFmpeg using the production rate-control argument builder",
    warmupRuns: 1,
    measuredRuns,
    medianRule: "middle value after ascending sort",
    task: "VP9/libvpx-vp9, CRF 30, source resolution, audio removed, 4 threads",
    ffmpegArgs,
    browserWasmLimitation: "FFmpeg.wasm 0.12.10 libvpx-vp9 aborted after frame 1 with an out-of-memory allocation error even at 128x72 and -threads 1; the native benchmark isolates the requested argument change.",
  },
  timingsMs,
  medianMs: median(timingsMs),
  output: {
    path: outputPath,
    bytes: outputBytes.byteLength,
    sha256: sha256(outputBytes),
    mimeType: "video/webm",
    decodeExitCode: 0,
    probe,
    ssim,
    psnrDb: psnr,
  },
}, null, 2));

async function inspectBrowserEnvironment() {
  const server = await createServer({
    root: projectRoot,
    logLevel: "error",
    plugins: [{
      name: "video-vp9-benchmark-page",
      configureServer(viteServer) {
        viteServer.middlewares.use("/__video-vp9-benchmark", (_request, response) => {
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          response.end("<!doctype html><html><head><meta charset=\"UTF-8\"><title>VP9 benchmark</title></head><body></body></html>");
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/__video-vp9-benchmark`, { waitUntil: "domcontentloaded" });
    const pageEnvironment = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      browserHardwareConcurrency: navigator.hardwareConcurrency,
      browserDeviceMemoryGiB: navigator.deviceMemory ?? null,
      crossOriginIsolated: window.crossOriginIsolated,
    }));
    return { browser: await browser.version(), ...pageEnvironment };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function encodeOnce() {
  await execFileAsync("ffmpeg", ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });
}

async function qualityMetric(filter, pattern) {
  try {
    const { stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner", "-i", fixturePath, "-i", outputPath,
      "-lavfi", filter, "-an", "-f", "null", "-",
    ], { maxBuffer: 20 * 1024 * 1024 });
    const match = stderr.match(pattern);
    if (!match) throw new Error(`${filter} summary was not found`);
    return Number(match[1]);
  } catch (error) {
    const stderr = error?.stderr || "";
    const match = stderr.match(pattern);
    if (match) return Number(match[1]);
    throw error;
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeLabel(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "benchmark";
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
