import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const fixturePath = path.join(projectRoot, "tests/fixtures/video-vp9-benchmark.mp4");
const expectedFixtureSha256 = "15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5";
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-webcodecs-benchmark"));
const measuredRuns = Number(argumentValue("--runs") || 3);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";

if (!Number.isInteger(measuredRuns) || measuredRuns < 3) throw new Error("--runs must be at least 3");
await fs.mkdir(outputDirectory, { recursive: true });
const fixture = await fs.readFile(fixturePath);
const fixtureSha256 = sha256(fixture);
if (fixtureSha256 !== expectedFixtureSha256) throw new Error(`Fixture SHA-256 mismatch: ${fixtureSha256}`);

const server = await createServer({
  root: projectRoot,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "video-webcodecs-benchmark",
    configureServer(viteServer) {
      viteServer.middlewares.use((request, response, next) => {
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        if (request.url === "/__video-webcodecs-benchmark") {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(benchmarkHtml());
          return;
        }
        next();
      });
    },
  }],
});
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
page.setDefaultTimeout(10 * 60_000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") console.error(`[browser] ${message.text()}`); });

let report;
try {
  await page.goto(`http://127.0.0.1:${address.port}/__video-webcodecs-benchmark`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.runVideoEncodingBenchmark === "function");
  const input = await page.$("#benchmark-files");
  await input.uploadFile(fixturePath);
  const support = await page.evaluate(() => window.inspectVideoEncodingSupport());
  if (support.route !== "webcodecs") throw new Error(`Target bitrate did not select the streaming encoder: ${JSON.stringify(support)}`);

  await page.evaluate(() => window.runVideoEncodingBenchmark("webcodecs", false));
  const webCodecsRuns = [];
  for (let index = 0; index < measuredRuns; index += 1) {
    webCodecsRuns.push(await page.evaluate(() => window.runVideoEncodingBenchmark("webcodecs", false)));
  }
  await page.evaluate(() => window.runVideoEncodingBenchmark("ffmpeg", false));
  const ffmpegRuns = [];
  for (let index = 0; index < measuredRuns; index += 1) {
    ffmpegRuns.push(await page.evaluate(() => window.runVideoEncodingBenchmark("ffmpeg", false)));
  }
  const metrics = await page.evaluate(() => window.runVideoEncodingMetrics());
  const transformConcat = await page.evaluate(() => window.runVideoTransformConcat());
  if (transformConcat.route !== "webcodecs" || transformConcat.width !== 640 || transformConcat.height !== 360
    || Math.abs(transformConcat.duration - 12) > 1 / 30 + 0.01 || !transformConcat.playback) {
    throw new Error(`Transform concat validation failed: ${JSON.stringify(transformConcat)}`);
  }
  const cancellation = await page.evaluate(() => window.cancelVideoEncodingBenchmark());
  if (!cancellation.abortObserved || cancellation.partialResultFiles !== 0) {
    throw new Error(`Cancellation cleanup failed: ${JSON.stringify(cancellation)}`);
  }

  await page.evaluate(() => window.runVideoEncodingBenchmark("webcodecs", true));
  const outputPath = path.join(outputDirectory, "webcodecs-h264-aac.mp4");
  await downloadRetainedOutput(page, outputDirectory, outputPath);
  const outputBytes = await fs.readFile(outputPath);
  const boxOrder = {
    mdat: outputBytes.indexOf(Buffer.from("mdat")),
    moov: outputBytes.indexOf(Buffer.from("moov")),
  };
  if (boxOrder.mdat < 0 || boxOrder.moov < boxOrder.mdat) throw new Error(`MP4 metadata was not written after media data: ${JSON.stringify(boxOrder)}`);
  const probe = await ffprobe(outputPath);
  await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", outputPath, "-f", "null", "-"], { maxBuffer: 16 * 1024 * 1024 });
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const firstVideo = probe.packets.find((packet) => packet.stream_index === video?.index);
  const firstAudio = probe.packets.find((packet) => packet.stream_index === audio?.index);
  const fullRangeAvSyncMs = Math.abs(Number(firstVideo?.dts_time) - Number(firstAudio?.dts_time)) * 1000;
  if (!Number.isFinite(fullRangeAvSyncMs) || fullRangeAvSyncMs > 50) throw new Error(`Full-range A/V sync is ${fullRangeAvSyncMs}ms`);
  if (video?.codec_name !== "h264" || audio?.codec_name !== "aac") throw new Error("Output codecs differ from H.264/AAC");

  const trimRun = await page.evaluate(() => window.runVideoTrimEncoding());
  const trimOutputPath = path.join(outputDirectory, "webcodecs-h264-aac-trim.mp4");
  await downloadRetainedOutput(page, outputDirectory, trimOutputPath);
  const trimProbe = await ffprobe(trimOutputPath);
  await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", trimOutputPath, "-f", "null", "-"], { maxBuffer: 16 * 1024 * 1024 });
  const trimVideo = trimProbe.streams.find((stream) => stream.codec_type === "video");
  const trimAudio = trimProbe.streams.find((stream) => stream.codec_type === "audio");
  const trimFirstVideo = trimProbe.packets.find((packet) => packet.stream_index === trimVideo?.index);
  const trimFirstAudio = trimProbe.packets.find((packet) => packet.stream_index === trimAudio?.index);
  const avSyncMs = Math.abs(Number(trimFirstVideo?.dts_time) - Number(trimFirstAudio?.dts_time)) * 1000;
  if (!Number.isFinite(avSyncMs) || avSyncMs > 50) throw new Error(`Trimmed A/V sync is ${avSyncMs}ms`);

  const webCodecsMedianMs = median(webCodecsRuns.map((run) => run.elapsedMs));
  const ffmpegMedianMs = median(ffmpegRuns.map((run) => run.elapsedMs));
  report = {
    environment: {
      browser: await browser.version(),
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
      ramBytes: os.totalmem(),
      crossOriginIsolated: support.crossOriginIsolated,
      hardwareAccelerationRequired: false,
    },
    fixture: {
      path: "tests/fixtures/video-vp9-benchmark.mp4",
      bytes: fixture.byteLength,
      sha256: fixtureSha256,
      durationSeconds: 6,
      width: 640,
      height: 360,
      frameRate: 30,
    },
    procedure: {
      command: ["node", "scripts/benchmark-video-webcodecs.mjs", ...process.argv.slice(2)],
      warmupRuns: 1,
      measuredRuns,
      task: "H.264 2Mbps + AAC encoded-sample passthrough, source dimensions, 30fps",
      timingBoundary: "product worker execution after route preflight through result completion",
    },
    support,
    timings: {
      webCodecsMs: webCodecsRuns.map((run) => run.elapsedMs),
      ffmpegWasmMs: ffmpegRuns.map((run) => run.elapsedMs),
      webCodecsMedianMs,
      ffmpegWasmMedianMs: ffmpegMedianMs,
      speedup: ffmpegMedianMs / webCodecsMedianMs,
      webCodecsToFfmpegRatio: webCodecsMedianMs / ffmpegMedianMs,
    },
    metrics,
    transformConcat,
    cancellation,
    output: {
      path: outputPath,
      bytes: outputBytes.byteLength,
      sha256: sha256(outputBytes),
      fastStart: false,
      boxOrder,
      fullDecodeExitCode: 0,
      browserPlayback: webCodecsRuns.every((run) => run.playback),
      avSyncMs: fullRangeAvSyncMs,
      video,
      audio,
    },
    trim: {
      requestedStartSeconds: 1.65,
      requestedEndSeconds: 4.45,
      path: trimOutputPath,
      bytes: (await fs.stat(trimOutputPath)).size,
      fullDecodeExitCode: 0,
      browserPlayback: trimRun.playback,
      avSyncMs,
      videoDurationSeconds: Number(trimVideo?.duration),
      audioDurationSeconds: Number(trimAudio?.duration),
    },
    pageErrors,
  };
  if (!report.output.browserPlayback) throw new Error("Browser playback did not advance in every measured run");
  if (!webCodecsRuns.every((run) => run.progressMonotonic) || !ffmpegRuns.every((run) => run.progressMonotonic)) {
    throw new Error("Progress regressed during a measured run");
  }
  if (!webCodecsRuns.every((run) => run.finalProgress === 100) || !ffmpegRuns.every((run) => run.finalProgress === 100)) {
    throw new Error("A measured run did not finish at 100% progress");
  }
  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(" | ")}`);
} finally {
  await page.evaluate(() => window.cleanupVideoEncodingBenchmark?.()).catch(() => undefined);
  await browser.close().catch(() => undefined);
  await server.close().catch(() => undefined);
}

const reportPath = path.join(outputDirectory, "video-webcodecs-benchmark.json");
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, timings: report.timings, metrics: report.metrics, transformConcat: report.transformConcat, cancellation: report.cancellation, output: report.output }, null, 2));

function benchmarkHtml() {
  return `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:"><input id="benchmark-files" type="file" multiple><script type="module">
    import { preflightVideoProcessingRoutes, runVideoProcessingTask } from "/src/features/video-studio/videoProcessingClient.ts";
    import { preflightVideoWebCodecsJob, runVideoWebCodecsJob } from "/src/features/video-studio/videoStreamWorkerClient.ts";
    import { decideFfmpegOnlyRoute } from "/src/features/video-studio/videoRouting.ts";
    import {
      cleanupPartialVideoResults, createVideoResultStorageSession, openVideoResultSessionDirectory,
      releaseVideoResultStorageSession, resolveVideoResultFile,
    } from "/src/features/video-studio/videoResultStorage.ts";

    const input = document.querySelector("#benchmark-files");
    let retained;
    const task = (overrides = {}) => ({
      kind: "encode", container: "mp4", codec: "h264", resolution: "source", aspect: "source",
      crf: 23, bitrate: "2M", audioMode: "copy", audioBitrate: "192k", audioSampleRate: "source",
      rotation: 0, flipHorizontal: false, ...overrides,
    });
    const makeRequest = (session, overrides = {}) => {
      const files = [...input.files];
      const inputs = files.map((file) => ({
        fileName: file.name, file, fileSize: file.size, duration: 6, width: 640, height: 360,
        frameRate: 30, start: overrides.start ?? 0, end: overrides.end ?? 6,
      }));
      return {
        mode: "batch",
        jobs: [{ name: "benchmark", mode: overrides.mode || "individual", inputs: overrides.mode === "concat" ? [inputs[0], inputs[0]] : [inputs[0]] }],
        task: task(overrides.task), resultStorage: session,
      };
    };
    const release = async () => {
      if (!retained) return;
      URL.revokeObjectURL(retained.url);
      await releaseVideoResultStorageSession(retained.session);
      retained = undefined;
    };
    const prepare = async (overrides) => {
      await release();
      const session = await createVideoResultStorageSession();
      if (session.mode !== "opfs") throw new Error("Temporary file storage is unavailable");
      return { session, request: makeRequest(session, overrides) };
    };
    const retainOutput = async (session, output) => {
      const file = await resolveVideoResultFile(output);
      const url = URL.createObjectURL(file);
      retained = { session, output, file, url };
      return { file, url };
    };
    const inspectPlayback = async (url) => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = url;
      document.body.append(video);
      try {
        await video.play();
        const deadline = performance.now() + 5000;
        while (video.currentTime <= 0 && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
        return { playback: video.currentTime > 0, width: video.videoWidth, height: video.videoHeight, duration: video.duration };
      } finally {
        video.pause();
        video.remove();
      }
    };
    window.inspectVideoEncodingSupport = async () => {
      const { session, request } = await prepare();
      try {
        const preflight = await preflightVideoProcessingRoutes(request);
        const capability = await preflightVideoWebCodecsJob(request.jobs[0], request.task, undefined, "en");
        const audioEncodeRequest = makeRequest(session, { task: { audioMode: "encode" } });
        const audioEncodePreflight = await preflightVideoProcessingRoutes(audioEncodeRequest);
        const audioEncodeCapability = await preflightVideoWebCodecsJob(
          audioEncodeRequest.jobs[0], audioEncodeRequest.task, undefined, "en",
        );
        return {
          route: preflight.jobs[0].decision.route,
          reasonCode: preflight.jobs[0].decision.reasonCode,
          capability,
          audioEncodeFallback: {
            route: audioEncodePreflight.jobs[0].decision.route,
            reasonCode: audioEncodePreflight.jobs[0].decision.reasonCode,
            capability: audioEncodeCapability,
          },
          videoEncoder: typeof VideoEncoder !== "undefined",
          audioEncoder: typeof AudioEncoder !== "undefined",
          crossOriginIsolated,
        };
      } finally { await releaseVideoResultStorageSession(session); }
    };
    window.runVideoEncodingBenchmark = async (mode, keep) => {
      const { session, request } = await prepare();
      const actual = await preflightVideoProcessingRoutes(request);
      if (actual.jobs[0].decision.route !== "webcodecs") throw new Error("Streaming encoder route is unavailable");
      const preflight = mode === "webcodecs" ? actual : { jobs: actual.jobs.map((job) => ({ ...job, decision: decideFfmpegOnlyRoute(job.estimatedOutputBytes) })) };
      const progress = [];
      let output;
      const startedAt = performance.now();
      await runVideoProcessingTask(request, (value) => progress.push(value), (value) => { output = value; }, undefined, "en", preflight);
      const elapsedMs = performance.now() - startedAt;
      if (!output) throw new Error("No output was produced");
      const { url } = await retainOutput(session, output);
      const playbackInfo = await inspectPlayback(url);
      const progressMonotonic = progress.every((value, index) => index === 0 || value >= progress[index - 1]);
      const result = { elapsedMs, outputSize: output.size, playback: playbackInfo.playback, progressMonotonic, finalProgress: progress.at(-1) };
      if (!keep) await release();
      return result;
    };
    window.runVideoEncodingMetrics = async () => {
      const { session, request } = await prepare();
      let output;
      const result = await runVideoWebCodecsJob(
        request.jobs[0], request.task, session, request.jobs[0].inputs[0].fileSize,
        undefined, (value) => { output = value; }, undefined, "en", { collectMetrics: true },
      );
      if (!output) throw new Error("No metrics output was produced");
      await releaseVideoResultStorageSession(session);
      return result.metrics;
    };
    window.runVideoTrimEncoding = async () => {
      const { session, request } = await prepare({ start: 1.65, end: 4.45 });
      const route = await preflightVideoProcessingRoutes(request);
      if (route.jobs[0].decision.route !== "webcodecs") throw new Error("Trim route is unavailable");
      let output;
      await runVideoProcessingTask(request, undefined, (value) => { output = value; }, undefined, "en", route);
      if (!output) throw new Error("No trim output was produced");
      const { url } = await retainOutput(session, output);
      const playback = await inspectPlayback(url);
      return { outputSize: output.size, ...playback };
    };
    window.runVideoTransformConcat = async () => {
      const { session, request } = await prepare({ mode: "concat", task: { aspect: "9:16", rotation: 90, flipHorizontal: true, audioMode: "remove" } });
      const route = await preflightVideoProcessingRoutes(request);
      let output;
      await runVideoProcessingTask(request, undefined, (value) => { output = value; }, undefined, "en", route);
      if (!output) throw new Error("No transform concat output was produced");
      const file = await resolveVideoResultFile(output);
      const url = URL.createObjectURL(file);
      const playback = await inspectPlayback(url);
      URL.revokeObjectURL(url);
      const result = { route: route.jobs[0].decision.route, size: file.size, type: file.type, ...playback };
      await releaseVideoResultStorageSession(session);
      return result;
    };
    window.cancelVideoEncodingBenchmark = async () => {
      const { session, request } = await prepare();
      const controller = new AbortController();
      let abortObserved = false;
      try {
        await runVideoWebCodecsJob(
          request.jobs[0], request.task, session, request.jobs[0].inputs[0].fileSize,
          (stage, completed, total) => { if (stage === "encode" && completed / total >= 0.15) controller.abort(); },
          undefined, controller.signal, "en", { collectMetrics: true },
        );
      } catch (error) {
        abortObserved = error instanceof DOMException && error.name === "AbortError";
        if (!abortObserved) throw error;
      }
      await cleanupPartialVideoResults(session);
      const directory = await openVideoResultSessionDirectory(session);
      let partialResultFiles = 0;
      if (directory.entries) for await (const [name] of directory.entries()) if (name.startsWith("result-")) partialResultFiles += 1;
      await releaseVideoResultStorageSession(session);
      return { abortObserved, partialResultFiles };
    };
    window.downloadVideoEncodingBenchmark = (name) => {
      if (!retained) throw new Error("No retained output");
      const anchor = document.createElement("a");
      anchor.href = retained.url;
      anchor.download = name;
      anchor.click();
    };
    window.cleanupVideoEncodingBenchmark = release;
  </script>`;
}

async function downloadRetainedOutput(page, directory, destination) {
  await fs.rm(destination, { force: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory, eventsEnabled: true });
  await page.evaluate((name) => window.downloadVideoEncodingBenchmark(name), path.basename(destination));
  const deadline = Date.now() + 120_000;
  let previous = -1;
  let stable = 0;
  while (Date.now() < deadline) {
    const size = await fs.stat(destination).then((item) => item.size, () => -1);
    stable = size > 0 && size === previous ? stable + 1 : 0;
    if (stable >= 3) break;
    previous = size;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await cdp.detach();
  if (stable < 3) throw new Error("Timed out downloading the benchmark output");
}

async function ffprobe(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_streams", "-show_packets",
    "-show_entries", "stream=index,codec_type,codec_name,codec_tag_string,width,height,r_frame_rate,duration:packet=stream_index,dts_time,pts_time,duration_time,flags",
    "-of", "json", filePath,
  ], { maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
}

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
