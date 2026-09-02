import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createFile } from "mp4box";
import { Muxer, StreamTarget } from "mp4-muxer";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-stream-copy-benchmark"));
const skipLarge = process.argv.includes("--skip-large");
const sourcePath = path.join(projectRoot, "tests/fixtures/video-vp9-benchmark.mp4");
const TWO_GIB = 2 * 1024 * 1024 * 1024;
const FRAME_DURATION_SECONDS = 1 / 30;

await fs.mkdir(outputDirectory, { recursive: true });
const fixtures = await createFixtures();
const server = await createBenchmarkServer();
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-precise-memory-info"],
});
const page = await browser.newPage();
page.setDefaultTimeout(15 * 60_000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.error(`[browser] ${message.text()}`);
});

let report;
try {
  await page.goto(`${baseUrl}/__video-stream-copy-benchmark`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.runVideoStreamCopyBenchmark === "function");
  const storage = await page.evaluate(() => window.videoStreamCopyStorageEstimate());
  if (storage.mode !== "opfs") throw new Error("Browser temporary-file storage is unavailable");

  const routes = {};
  routes.h264Mp4 = await routeFiles([sourcePath], routeOptions({ durations: [6], ends: [6] }));
  routes.h264Mov = await routeFiles([fixtures.mov], routeOptions({ durations: [6], ends: [6] }));
  routes.hevcMp4 = await routeFiles([fixtures.hevc], routeOptions({ codec: "hevc", durations: [4], ends: [4] }));
  routes.vp9Webm = await routeFiles([fixtures.webm], routeOptions({ container: "webm", codec: "vp9", durations: [4], ends: [4] }));
  routes.mkv = await routeFiles([fixtures.mkv], routeOptions({ durations: [6], ends: [6] }));
  routes.concatCompatible = await routeFiles(
    [sourcePath, sourcePath],
    routeOptions({ mode: "concat", durations: [6, 6], starts: [0, 2.2], ends: [2, 4.5], widths: [640, 640], heights: [360, 360] }),
  );
  routes.concatMismatch = await routeFiles(
    [sourcePath, fixtures.mismatch],
    routeOptions({ mode: "concat", durations: [6, 4], ends: [6, 4], widths: [640, 320], heights: [360, 180] }),
  );

  assertRoute(routes.h264Mp4, "stream-copy", "H.264 + AAC MP4");
  assertRoute(routes.h264Mov, "stream-copy", "H.264 + AAC MOV");
  assertRoute(routes.hevcMp4, "stream-copy", "HEVC MP4");
  assertRoute(routes.vp9Webm, "ffmpeg", "VP9 WebM");
  assertRoute(routes.mkv, "ffmpeg", "MKV input");
  assertRoute(routes.concatCompatible, "stream-copy", "compatible concat");
  assertRoute(routes.concatMismatch, "ffmpeg", "mismatched concat");

  const trimStart = 1.65;
  const trimEnd = 4.45;
  const ffmpegBaseline = path.join(outputDirectory, "trim-ffmpeg-copy.mp4");
  await runFfmpeg([
    "-ss", trimStart.toFixed(3), "-i", sourcePath,
    "-t", (trimEnd - trimStart).toFixed(3),
    "-map", "0:v:0", "-c:v", "copy", "-map", "0:a:0?", "-c:a", "copy",
    "-avoid_negative_ts", "make_zero", ffmpegBaseline,
  ]);
  const trimRun = await streamFile(sourcePath, routeOptions({ starts: [trimStart], ends: [trimEnd], durations: [6] }));
  const streamTrimPath = path.join(outputDirectory, "trim-stream-copy.mp4");
  await downloadLastOutput(streamTrimPath);
  const trimValidation = await validateTrim(sourcePath, ffmpegBaseline, streamTrimPath, trimRun.metrics, trimStart);

  const hevcRun = await streamFile(fixtures.hevc, routeOptions({ codec: "hevc", durations: [4], ends: [4] }));
  const streamHevcPath = path.join(outputDirectory, "hevc-stream-copy.mp4");
  await downloadLastOutput(streamHevcPath);
  const hevcProbe = await ffprobe(streamHevcPath, ["-show_entries", "stream=index,codec_name,codec_tag_string,duration", "-show_format"]);

  const concatOptions = routeOptions({
    mode: "concat", durations: [6, 6], starts: [0, 2.2], ends: [2, 4.5], widths: [640, 640], heights: [360, 360],
  });
  const concatRun = await streamFiles([sourcePath, sourcePath], concatOptions);
  const streamConcatPath = path.join(outputDirectory, "concat-stream-copy.mp4");
  await downloadLastOutput(streamConcatPath);
  const concatProbe = await ffprobe(streamConcatPath, [
    "-show_entries", "stream=index,codec_name,codec_tag_string,start_time,duration",
    "-show_entries", "packet=stream_index,pts_time,dts_time,duration_time,flags",
    "-show_packets", "-show_format",
  ]);
  const concatPacketTimestamps = validatePacketTimestamps(concatProbe.packets || []);

  let largeValidation = { skipped: true };
  if (!skipLarge) {
    const largeMetadata = await generateLargeFixture(fixtures.large);
    const largeOptions = routeOptions({
      audioMode: "remove",
      durations: [largeMetadata.durationSeconds],
      ends: [largeMetadata.durationSeconds],
      fileSizes: [largeMetadata.fileSize],
    });
    const largeRoute = await routeFiles([fixtures.large], largeOptions);
    assertRoute(largeRoute, "stream-copy", "2 GiB fixture");
    const cancellation = await cancelStream(fixtures.large, largeOptions);
    if (!cancellation.abortObserved || cancellation.partialResultFiles !== 0) {
      throw new Error(`Cancellation left a partial result: ${JSON.stringify(cancellation)}`);
    }
    const largeRun = await streamFile(fixtures.large, largeOptions);
    const streamLargePath = path.join(outputDirectory, "large-stream-copy.mp4");
    await downloadLastOutput(streamLargePath, 20 * 60_000);
    const largeStat = await fs.stat(streamLargePath);
    const largeProbe = await ffprobe(streamLargePath, [
      "-show_entries", "stream=index,codec_name,codec_tag_string,start_time,duration,nb_frames",
      "-show_entries", "packet=stream_index,pts_time,dts_time,duration_time,flags",
      "-show_packets", "-show_format",
    ]);
    const packetTimestamps = validatePacketTimestamps(largeProbe.packets || []);
    const metrics = largeRun.metrics;
    if (largeStat.size <= TWO_GIB || metrics.outputFileSize <= TWO_GIB) throw new Error("The measured output did not exceed 2 GiB");
    if (metrics.inputWholeArrayBufferCalls !== 0) throw new Error("A whole input arrayBuffer() read was observed");
    if (!metrics.outputCumulativeBytesMonotonic) throw new Error("Output cumulative writes were not monotonic");
    if (metrics.maxInputSliceBytes > 8 * 1024 * 1024) throw new Error("An input read exceeded the 8 MiB window");
    largeValidation = {
      skipped: false,
      inputFileSize: largeMetadata.fileSize,
      outputFileSize: largeStat.size,
      outputExceeds2GiBBy: largeStat.size - TWO_GIB,
      metrics,
      cancellation,
      packetTimestamps,
      stream: largeProbe.streams?.[0],
      format: largeProbe.format,
    };
  }

  report = {
    environment: {
      browser: await browser.version(),
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
      ramBytes: os.totalmem(),
      storage,
    },
    procedure: {
      command: ["node", "scripts/benchmark-video-stream-copy.mjs", ...process.argv.slice(2)],
      trimStart,
      trimEnd,
      ffmpegCopyArguments: ["-ss", trimStart.toFixed(3), "-i", "INPUT", "-t", (trimEnd - trimStart).toFixed(3), "-c:v", "copy", "-c:a", "copy", "-avoid_negative_ts", "make_zero"],
    },
    routes,
    trim: { run: trimRun, validation: trimValidation },
    hevc: { run: hevcRun, probe: hevcProbe },
    concat: { run: concatRun, probe: concatProbe, packetTimestamps: concatPacketTimestamps },
    large: largeValidation,
    pageErrors,
  };
  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(" | ")}`);
} finally {
  await page.evaluate(() => window.cleanupVideoStreamCopyBenchmark?.()).catch(() => undefined);
  await browser.close().catch(() => undefined);
  await server.close().catch(() => undefined);
}

const reportPath = path.join(outputDirectory, "video-stream-copy-benchmark.json");
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, routes: report.routes, trim: report.trim.validation, large: report.large }, null, 2));

async function routeFiles(filePaths, options) {
  const input = await page.$("#benchmark-files");
  await input.uploadFile(...filePaths);
  return page.evaluate((value) => window.routeVideoStreamCopyBenchmark(value), options);
}

async function streamFile(filePath, options) {
  return streamFiles([filePath], options);
}

async function streamFiles(filePaths, options) {
  const input = await page.$("#benchmark-files");
  await input.uploadFile(...filePaths);
  return page.evaluate((value) => window.runVideoStreamCopyBenchmark(value), options);
}

async function cancelStream(filePath, options) {
  const input = await page.$("#benchmark-files");
  await input.uploadFile(filePath);
  return page.evaluate((value) => window.cancelVideoStreamCopyBenchmark(value), options);
}

async function downloadLastOutput(destination, timeout = 5 * 60_000) {
  await fs.rm(destination, { force: true });
  const downloadName = path.basename(destination);
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: outputDirectory, eventsEnabled: true });
  await page.evaluate((name) => window.downloadVideoStreamCopyBenchmark(name), downloadName);
  await waitForStableFile(destination, timeout);
  await cdp.detach();
}

async function waitForStableFile(filePath, timeout) {
  const started = Date.now();
  let previousSize = -1;
  let stableChecks = 0;
  while (Date.now() - started < timeout) {
    const size = await fs.stat(filePath).then((stat) => stat.size, () => -1);
    if (size > 0 && size === previousSize) stableChecks += 1;
    else stableChecks = 0;
    if (stableChecks >= 3) return;
    previousSize = size;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

function routeOptions(overrides = {}) {
  const durations = overrides.durations || [6];
  return {
    mode: overrides.mode || "individual",
    container: overrides.container || "mp4",
    codec: overrides.codec || "h264",
    audioMode: overrides.audioMode || "copy",
    starts: overrides.starts || durations.map(() => 0),
    ends: overrides.ends || durations,
    durations,
    widths: overrides.widths || durations.map(() => 640),
    heights: overrides.heights || durations.map(() => 360),
    fileSizes: overrides.fileSizes,
  };
}

function assertRoute(result, expected, label) {
  const route = result.jobs?.[0]?.decision?.route;
  if (route !== expected) throw new Error(`${label} routed to ${route}, expected ${expected}: ${JSON.stringify(result)}`);
}

async function createFixtures() {
  const hevc = path.join(outputDirectory, "route-hevc.mp4");
  const webm = path.join(outputDirectory, "route-vp9.webm");
  const mkv = path.join(outputDirectory, "route-vp9.mkv");
  const mov = path.join(outputDirectory, "route-h264.mov");
  const mismatch = path.join(outputDirectory, "route-mismatch.mp4");
  await runFfmpeg(["-i", sourcePath, "-t", "4", "-c:v", "libx265", "-preset", "ultrafast", "-x265-params", "log-level=error:keyint=30:min-keyint=30:scenecut=0", "-tag:v", "hvc1", "-c:a", "copy", hevc]);
  await runFfmpeg(["-i", sourcePath, "-t", "4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", webm]);
  await runFfmpeg(["-i", webm, "-c", "copy", mkv]);
  await runFfmpeg(["-i", sourcePath, "-c", "copy", mov]);
  await runFfmpeg(["-i", sourcePath, "-t", "4", "-vf", "scale=320:180", "-c:v", "libx264", "-preset", "ultrafast", "-g", "30", "-c:a", "copy", mismatch]);
  return { hevc, webm, mkv, mov, mismatch, large: path.join(outputDirectory, "source-over-2gib.mp4") };
}

async function runFfmpeg(argumentsList) {
  await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argumentsList], { maxBuffer: 8 * 1024 * 1024 });
}

async function generateLargeFixture(outputPath) {
  const source = fsSync.readFileSync(sourcePath);
  const parsed = parseMp4(source);
  const videoTrack = parsed.info.videoTracks[0];
  const sample = parsed.file.getTrackSamplesInfo(videoTrack.id)[0];
  const entry = sample.description;
  const configuration = source.subarray(entry.avcC.start + entry.avcC.hdr_size, entry.avcC.start + entry.avcC.size);
  const sourceSample = source.subarray(sample.offset, sample.offset + sample.size);
  const sampleBytes = 1024 * 1024;
  const paddedSample = Buffer.alloc(sampleBytes, 0xff);
  sourceSample.copy(paddedSample, 0);
  const fillerPayloadBytes = sampleBytes - sourceSample.length - 4;
  paddedSample.writeUInt32BE(fillerPayloadBytes, sourceSample.length);
  paddedSample[sourceSample.length + 4] = 0x0c;
  paddedSample[paddedSample.length - 1] = 0x80;
  const targetBytes = TWO_GIB + 64 * 1024 * 1024;
  const frameCount = Math.ceil(targetBytes / sampleBytes);
  const descriptor = exactArrayBuffer(configuration);
  const fileDescriptor = fsSync.openSync(outputPath, "w");
  try {
    const target = new StreamTarget({
      chunked: true,
      chunkSize: 1024 * 1024,
      onData(data, position) {
        let written = 0;
        while (written < data.byteLength) written += fsSync.writeSync(fileDescriptor, data, written, data.byteLength - written, position + written);
      },
    });
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width: videoTrack.video.width, height: videoTrack.video.height },
      fastStart: false,
    });
    const metadata = {
      decoderConfig: {
        codec: videoTrack.codec,
        codedWidth: videoTrack.video.width,
        codedHeight: videoTrack.video.height,
        description: descriptor,
      },
    };
    for (let index = 0; index < frameCount; index += 1) {
      muxer.addVideoChunkRaw(paddedSample, "key", Math.round(index * 1_000_000 / 30), Math.round(1_000_000 / 30), index ? undefined : metadata);
    }
    muxer.finalize();
  } finally {
    fsSync.closeSync(fileDescriptor);
  }
  const fileSize = (await fs.stat(outputPath)).size;
  if (fileSize <= TWO_GIB) throw new Error(`Generated large fixture is only ${fileSize} bytes`);
  return { fileSize, frameCount, durationSeconds: frameCount / 30 };
}

function parseMp4(bytes) {
  const file = createFile(false);
  let info;
  file.onReady = (value) => { info = value; };
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  buffer.fileStart = 0;
  file.appendBuffer(buffer, true);
  file.flush();
  if (!info) throw new Error("Unable to parse fixture metadata");
  return { file, info };
}

async function validateTrim(source, ffmpegOutput, streamOutput, metrics, requestedStart) {
  const [sourceProbe, ffmpegProbe, streamProbe] = await Promise.all([
    ffprobe(source, ["-show_packets", "-show_entries", "packet=stream_index,pts_time,dts_time,duration_time,pos,size,flags", "-show_streams", "-show_format"]),
    ffprobe(ffmpegOutput, ["-show_packets", "-show_entries", "packet=stream_index,pts_time,dts_time,duration_time,pos,size,flags", "-show_streams", "-show_format"]),
    ffprobe(streamOutput, ["-show_packets", "-show_entries", "packet=stream_index,pts_time,dts_time,duration_time,pos,size,flags", "-show_streams", "-show_format"]),
  ]);
  const sourceVideoIndex = sourceProbe.streams.find((stream) => stream.codec_type === "video").index;
  const ffmpegVideoIndex = ffmpegProbe.streams.find((stream) => stream.codec_type === "video").index;
  const streamVideoIndex = streamProbe.streams.find((stream) => stream.codec_type === "video").index;
  const sourceKeyframes = sourceProbe.packets.filter((packet) => packet.stream_index === sourceVideoIndex && packet.flags?.includes("K"));
  const expectedKeyframe = sourceKeyframes.filter((packet) => Number(packet.pts_time) <= requestedStart + 1e-9).at(-1) || sourceKeyframes[0];
  const ffmpegFirstVideo = ffmpegProbe.packets.find((packet) => packet.stream_index === ffmpegVideoIndex);
  const streamFirstVideo = streamProbe.packets.find((packet) => packet.stream_index === streamVideoIndex);
  const hashes = {
    source: await packetHash(source, expectedKeyframe),
    ffmpeg: await packetHash(ffmpegOutput, ffmpegFirstVideo),
    stream: await packetHash(streamOutput, streamFirstVideo),
  };
  if (hashes.source !== hashes.ffmpeg || hashes.source !== hashes.stream) throw new Error(`First copied keyframe differs: ${JSON.stringify(hashes)}`);
  const snappedPresentationSeconds = metrics.segments[0].snappedPresentationSeconds;
  const keyframeSnapErrorMs = Math.abs(snappedPresentationSeconds - Number(expectedKeyframe.pts_time)) * 1000;
  if (keyframeSnapErrorMs > 1) throw new Error(`Keyframe snap differs by ${keyframeSnapErrorMs} ms`);
  const ffmpegVideoDuration = Number(ffmpegProbe.streams.find((stream) => stream.codec_type === "video").duration);
  const streamVideoDuration = Number(streamProbe.streams.find((stream) => stream.codec_type === "video").duration);
  const durationErrorSeconds = Math.abs(ffmpegVideoDuration - streamVideoDuration);
  if (durationErrorSeconds > FRAME_DURATION_SECONDS + 1e-6) throw new Error(`Trim duration differs by ${durationErrorSeconds} seconds`);
  const firstVideoDts = Number(streamFirstVideo.dts_time);
  const firstAudioDts = Number(streamProbe.packets.find((packet) => packet.stream_index !== streamVideoIndex)?.dts_time);
  const avFirstSampleAlignmentMs = Math.abs(firstVideoDts - firstAudioDts) * 1000;
  if (!Number.isFinite(avFirstSampleAlignmentMs) || avFirstSampleAlignmentMs > 50) throw new Error(`A/V starts differ by ${avFirstSampleAlignmentMs} ms`);
  return {
    expectedSourceKeyframePtsSeconds: Number(expectedKeyframe.pts_time),
    snappedPresentationSeconds,
    keyframeSnapErrorMs,
    hashes,
    ffmpegVideoDurationSeconds: ffmpegVideoDuration,
    streamVideoDurationSeconds: streamVideoDuration,
    durationErrorSeconds,
    frameDurationSeconds: FRAME_DURATION_SECONDS,
    firstVideoDtsSeconds: firstVideoDts,
    firstAudioDtsSeconds: firstAudioDts,
    avFirstSampleAlignmentMs,
    streamPacketTimestamps: validatePacketTimestamps(streamProbe.packets),
  };
}

async function packetHash(filePath, packet) {
  if (!packet || !Number.isSafeInteger(Number(packet.pos)) || !Number.isSafeInteger(Number(packet.size))) throw new Error("Packet offsets are unavailable");
  const handle = await fs.open(filePath, "r");
  try {
    const bytes = Buffer.alloc(Number(packet.size));
    await handle.read(bytes, 0, bytes.length, Number(packet.pos));
    return crypto.createHash("sha256").update(bytes).digest("hex");
  } finally {
    await handle.close();
  }
}

function validatePacketTimestamps(packets) {
  const lastByStream = new Map();
  let monotonic = true;
  for (const packet of packets) {
    const dts = Number(packet.dts_time);
    if (!Number.isFinite(dts)) continue;
    const previous = lastByStream.get(packet.stream_index);
    if (Number.isFinite(previous) && dts + 1e-9 < previous) monotonic = false;
    lastByStream.set(packet.stream_index, dts);
  }
  if (!monotonic) throw new Error("Packet decode timestamps are not monotonic");
  return { monotonic, packetCount: packets.length, streamsChecked: lastByStream.size };
}

async function ffprobe(filePath, extraArguments) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", ...extraArguments, "-of", "json", filePath], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function createBenchmarkServer() {
  return createServer({
    root: projectRoot,
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "video-stream-copy-benchmark",
      configureServer(viteServer) {
        viteServer.middlewares.use((request, response, next) => {
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          if (request.url === "/__video-stream-copy-benchmark") {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(benchmarkHtml());
            return;
          }
          next();
        });
      },
    }],
  });
}

function benchmarkHtml() {
  return `<!doctype html><meta charset="utf-8"><input id="benchmark-files" type="file" multiple><script type="module">
    import {
      cleanupPartialVideoResults,
      createVideoResultStorageSession,
      openVideoResultSessionDirectory,
      releaseVideoResultStorageSession,
      resolveVideoResultFile,
    } from "/src/features/video-studio/videoResultStorage.ts";
    import { preflightVideoProcessingRoutes } from "/src/features/video-studio/videoProcessingClient.ts";
    import { runVideoStreamCopyJob } from "/src/features/video-studio/videoStreamWorkerClient.ts";

    const input = document.querySelector("#benchmark-files");
    let retained;
    const task = (options) => ({
      kind: "encode", container: options.container, codec: options.codec,
      resolution: "source", aspect: "source", crf: 23, bitrate: "copy",
      audioMode: options.audioMode, audioBitrate: "192k", audioSampleRate: "source",
      rotation: 0, flipHorizontal: false,
    });
    const request = (options, session) => {
      const files = [...input.files];
      const inputs = files.map((file, index) => ({
        fileName: file.name, file, fileSize: options.fileSizes?.[index] || file.size,
        duration: options.durations[index], width: options.widths[index], height: options.heights[index],
        frameRate: 30, start: options.starts[index], end: options.ends[index],
      }));
      return {
        mode: "batch",
        jobs: [{ name: "benchmark", mode: options.mode, inputs }],
        task: task(options), resultStorage: session,
      };
    };
    const releaseRetained = async () => {
      if (!retained) return;
      URL.revokeObjectURL(retained.url);
      await releaseVideoResultStorageSession(retained.session);
      retained = undefined;
    };
    window.videoStreamCopyStorageEstimate = async () => {
      const session = await createVideoResultStorageSession();
      const estimate = await navigator.storage.estimate();
      const result = { mode: session.mode, usage: estimate.usage, quota: estimate.quota };
      await releaseVideoResultStorageSession(session);
      return result;
    };
    window.routeVideoStreamCopyBenchmark = async (options) => {
      const session = await createVideoResultStorageSession();
      try { return await preflightVideoProcessingRoutes(request(options, session)); }
      finally { await releaseVideoResultStorageSession(session); }
    };
    window.runVideoStreamCopyBenchmark = async (options) => {
      await releaseRetained();
      const session = await createVideoResultStorageSession();
      if (session.mode !== "opfs") throw new Error("Persistent result storage is unavailable");
      const currentRequest = request(options, session);
      let output;
      const result = await runVideoStreamCopyJob(
        currentRequest.jobs[0], currentRequest.task, session,
        currentRequest.jobs[0].inputs.reduce((sum, item) => sum + item.fileSize * ((item.end - item.start) / item.duration), 0),
        undefined, (value) => { output = value; }, undefined, "en", { collectMetrics: true },
      );
      if (!output || output.data.kind !== "opfs") throw new Error("The output was not stored as a temporary file");
      const file = await resolveVideoResultFile(output);
      const url = URL.createObjectURL(file);
      retained = { session, output, file, url };
      return { outputSize: output.size, metrics: result.metrics, outputName: output.fileName };
    };
    window.cancelVideoStreamCopyBenchmark = async (options) => {
      await releaseRetained();
      const session = await createVideoResultStorageSession();
      const currentRequest = request(options, session);
      const controller = new AbortController();
      let abortObserved = false;
      try {
        await runVideoStreamCopyJob(
          currentRequest.jobs[0], currentRequest.task, session,
          currentRequest.jobs[0].inputs.reduce((sum, item) => sum + item.fileSize, 0),
          (stage, completed) => { if (stage === "write" && completed >= 1024 * 1024) controller.abort(); },
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
    window.downloadVideoStreamCopyBenchmark = (name) => {
      if (!retained) throw new Error("No output is retained");
      const anchor = document.createElement("a");
      anchor.href = retained.url;
      anchor.download = name;
      anchor.click();
    };
    window.cleanupVideoStreamCopyBenchmark = releaseRetained;
  </script>`;
}

function exactArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
