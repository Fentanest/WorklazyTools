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
const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-video-hybrid-benchmark"));
const small = process.argv.includes("--small");
const concat = process.argv.includes("--concat");
const debugDirect = process.argv.includes("--debug-direct");
const width = small ? 640 : 3840;
const height = small ? 360 : 2160;
const durationSeconds = small ? 6 : 60;
const timeoutMs = 600_000;
const fixturePath = path.join(outputDirectory, `hybrid-fixture-${width}x${height}-${durationSeconds}s.mp4`);
const outputPath = path.join(outputDirectory, `hybrid-output-${width}x${height}-${concat ? durationSeconds * 2 : durationSeconds}s${concat ? "-concat" : ""}.mp4`);
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const fixtureArguments = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=30:duration=${durationSeconds}`,
  "-f", "lavfi", "-i", `sine=frequency=997:sample_rate=48000:duration=${durationSeconds}`,
  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-g", "60", "-bf", "2", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", fixturePath,
];

await fs.mkdir(outputDirectory, { recursive: true });
await execFileAsync("ffmpeg", fixtureArguments, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
const fixtureBytes = await fs.readFile(fixturePath);
const fixtureSha256 = sha256(fixtureBytes);

const server = await createServer({
  root: projectRoot,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "video-hybrid-benchmark",
    configureServer(viteServer) {
      viteServer.middlewares.use((request, response, next) => {
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        if (request.url === "/__video-hybrid-benchmark") {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(harnessHtml({ width, height, durationSeconds, small, concat, debugDirect }));
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
  protocolTimeout: timeoutMs + 30_000,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
page.setDefaultTimeout(timeoutMs);
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

let browserResult;
try {
  await page.goto(`http://127.0.0.1:${address.port}/__video-hybrid-benchmark`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.runHybridBenchmark === "function");
  await (await page.$("#fixture")).uploadFile(fixturePath);
  browserResult = await withTimeout(page.evaluate(() => window.runHybridBenchmark()), timeoutMs, "Hybrid browser run timed out");
  if (browserResult.route !== "hybrid") throw new Error(`Hybrid route was not selected: ${JSON.stringify(browserResult)}`);
  if (!browserResult.playback || browserResult.outputSize <= 0) throw new Error(`Browser playback failed: ${JSON.stringify(browserResult)}`);
  if (small && (browserResult.cancellation?.idleBranch !== "idle" || browserResult.cancellation?.audioBranch !== "forced"
    || !browserResult.cancellation?.videoAbortObserved || browserResult.cancellation?.partialResultFiles !== 0)) {
    throw new Error(`Hybrid cancellation contract failed: ${JSON.stringify(browserResult.cancellation)}`);
  }
  await downloadOutput(page, outputDirectory, outputPath);
} finally {
  await page.evaluate(() => window.cleanupHybridBenchmark?.()).catch(() => undefined);
  await browser.close().catch(() => undefined);
  await server.close().catch(() => undefined);
}

const probe = await ffprobe(outputPath);
const video = probe.streams.find((stream) => stream.codec_type === "video");
const audio = probe.streams.find((stream) => stream.codec_type === "audio");
if (!video || !audio || video.codec_name !== "h264" || audio.codec_name !== "aac") throw new Error("Output is not H.264 + AAC");
const videoPackets = probe.packets.filter((packet) => packet.stream_index === video.index);
const audioPackets = probe.packets.filter((packet) => packet.stream_index === audio.index);
const sync = syncMetrics(videoPackets, audioPackets, Number(audio.sample_rate));
if (Math.abs(sync.deltaStartSeconds) > 0.05) throw new Error(`Δstart exceeds 50ms: ${sync.deltaStartSeconds}`);
if (Math.abs(sync.deltaEndSeconds - sync.deltaStartSeconds) > sync.driftLimitSeconds + 1e-9) {
  throw new Error(`A/V drift exceeds one AAC frame: ${JSON.stringify(sync)}`);
}
if (!monotonicDts(videoPackets) || !monotonicDts(audioPackets)) throw new Error("Packet DTS is not monotonic");
await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", outputPath, "-f", "null", "-"], { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 });
const outputBytes = await fs.readFile(outputPath);
const oomOccurred = [...pageErrors, ...consoleErrors].some((message) => /out of memory|memory access out of bounds|oom/i.test(message));
if (oomOccurred) throw new Error(`OOM was reported: ${JSON.stringify({ pageErrors, consoleErrors })}`);

const report = {
  environment: {
    browser: await executableVersion(chromePath),
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model || "unknown"} (${os.cpus().length} logical CPUs)`,
    ramBytes: os.totalmem(),
  },
  fixture: {
    path: fixturePath,
    bytes: fixtureBytes.byteLength,
    sha256: fixtureSha256,
    width,
    height,
    frameRate: 30,
    durationSeconds,
    videoCodec: "H.264",
    audio: "AAC 48kHz stereo 192kbps",
    generationCommand: ["ffmpeg", ...fixtureArguments],
  },
  procedure: {
    command: ["node", "scripts/benchmark-video-hybrid.mjs", ...process.argv.slice(2)],
    browserTimeoutMs: timeoutMs,
    task: "H.264 target 8Mbps + AAC 192kbps",
  },
  route: browserResult,
  output: {
    path: outputPath,
    bytes: outputBytes.byteLength,
    sha256: sha256(outputBytes),
    fullDecodeExitCode: 0,
    browserPlayback: browserResult.playback,
    packetDtsMonotonic: true,
    oomOccurred,
    sync,
    video,
    audio,
  },
  pageErrors,
  consoleErrors,
};
const reportPath = path.join(outputDirectory, "video-hybrid-benchmark.json");
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, fixture: report.fixture, route: report.route, output: report.output }, null, 2));

function harnessHtml(config) {
  return `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:"><input id="fixture" type="file"><script type="module">
    import { preflightVideoProcessingRoutes, runVideoProcessingTask } from "/src/features/video-studio/videoProcessingClient.ts";
    import { runVideoHybridJob } from "/src/features/video-studio/videoStreamWorkerClient.ts";
    import { cleanupPartialVideoResults, createVideoResultStorageSession, openVideoResultSessionDirectory, releaseVideoResultStorageSession, resolveVideoResultFile } from "/src/features/video-studio/videoResultStorage.ts";
    import { runHybridAudioFfmpeg } from "/src/features/video-studio/videoHybridAudioClient.ts";
    const config = ${JSON.stringify(config)};
    let retained;
    const task = { kind: "encode", container: "mp4", codec: "h264", resolution: "source", aspect: "source", crf: 23,
      bitrate: "8M", audioMode: "encode", audioBitrate: "192k", audioSampleRate: 48000, rotation: 0, flipHorizontal: false };
    window.runHybridBenchmark = async () => {
      const file = document.querySelector("#fixture").files[0];
      const session = await createVideoResultStorageSession();
      if (session.mode !== "opfs") throw new Error("Temporary result storage is unavailable");
      const oneInput = { fileName: file.name, file, fileSize: file.size, duration: config.durationSeconds, width: config.width, height: config.height, frameRate: 30, start: 0, end: config.durationSeconds };
      const request = { mode: "batch", jobs: [{ name: "hybrid", mode: config.concat ? "concat" : "individual", inputs: config.concat ? [oneInput, oneInput] : [oneInput] }],
        task, resultStorage: session };
      const preflight = await preflightVideoProcessingRoutes(request);
      const route = preflight.jobs[0];
      const progress = [];
      let output;
      const startedAt = performance.now();
      if (config.debugDirect) {
        const audio = await runHybridAudioFfmpeg(request.jobs[0], task, 100000000, undefined, undefined, "en");
        await runVideoHybridJob(request.jobs[0], task, audio.buffer, session, route.estimatedOutputBytes,
          undefined, (value) => { output = value; }, undefined, "en");
      } else {
        await runVideoProcessingTask(request, (value) => progress.push(value), (value) => { output = value; }, undefined, "en", preflight);
      }
      const elapsedMs = performance.now() - startedAt;
      const resultFile = await resolveVideoResultFile(output);
      const url = URL.createObjectURL(resultFile);
      const video = document.createElement("video"); video.muted = true; video.src = url; document.body.append(video);
      await video.play();
      const deadline = performance.now() + 5000;
      while (video.currentTime <= 0 && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
      retained = { session, url };
      window.__hybridOutput = { url, file: resultFile };
      let cancellation;
      if (config.small) {
        const idleController = new AbortController(); idleController.abort();
        let idleBranch;
        try { await runHybridAudioFfmpeg(request.jobs[0], task, 1000000, undefined, idleController.signal, "en"); }
        catch (error) { idleBranch = error.cancelBranch; }
        const audioController = new AbortController();
        let audioBranch;
        try {
          await runHybridAudioFfmpeg(request.jobs[0], task, 1000000, (completed, total) => {
            if (completed / total >= 0.01) audioController.abort();
          }, audioController.signal, "en");
        } catch (error) { audioBranch = error.cancelBranch; }
        const cancelSession = await createVideoResultStorageSession();
        const cancelRequest = { ...request, resultStorage: cancelSession };
        const cancelPreflight = await preflightVideoProcessingRoutes(cancelRequest);
        const videoController = new AbortController();
        let videoAbortObserved = false;
        try {
          await runVideoProcessingTask(cancelRequest, (value) => { if (value >= 20) videoController.abort(); }, undefined, videoController.signal, "en", cancelPreflight);
        } catch (error) { videoAbortObserved = error instanceof DOMException && error.name === "AbortError"; }
        await cleanupPartialVideoResults(cancelSession);
        const directory = await openVideoResultSessionDirectory(cancelSession);
        let partialResultFiles = 0;
        if (directory.entries) for await (const [name] of directory.entries()) if (name.startsWith("result-")) partialResultFiles += 1;
        await releaseVideoResultStorageSession(cancelSession);
        cancellation = { idleBranch, audioBranch, videoAbortObserved, partialResultFiles };
      }
      return { route: route.decision.route, reasonCode: route.decision.reasonCode, probeDetails: route.probeDetails,
        estimatedOutputBytes: route.estimatedOutputBytes, elapsedMs, outputSize: resultFile.size, playback: video.currentTime > 0,
        progressMonotonic: progress.every((value, index) => index === 0 || value >= progress[index - 1]), finalProgress: progress.at(-1), cancellation };
    };
    window.downloadHybridOutput = (name) => { const anchor = document.createElement("a"); anchor.href = window.__hybridOutput.url; anchor.download = name; anchor.click(); };
    window.cleanupHybridBenchmark = async () => { if (!retained) return; URL.revokeObjectURL(retained.url); await releaseVideoResultStorageSession(retained.session); retained = undefined; };
  </script>`;
}

async function downloadOutput(page, directory, destination) {
  await fs.rm(destination, { force: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory, eventsEnabled: true });
  await page.evaluate((name) => window.downloadHybridOutput(name), path.basename(destination));
  const deadline = Date.now() + 120_000;
  let prior = -1;
  let stable = 0;
  while (Date.now() < deadline) {
    const size = await fs.stat(destination).then((stat) => stat.size, () => -1);
    stable = size > 0 && size === prior ? stable + 1 : 0;
    if (stable >= 3) break;
    prior = size;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await cdp.detach();
  if (stable < 3) throw new Error("Timed out downloading hybrid output");
}

async function ffprobe(filePath) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_packets",
    "-show_entries", "stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,duration:packet=stream_index,dts_time,pts_time,duration_time,flags",
    "-of", "json", filePath], { timeout: timeoutMs, maxBuffer: 128 * 1024 * 1024 });
  return JSON.parse(stdout);
}

function syncMetrics(videoPackets, audioPackets, sampleRate) {
  if (!videoPackets.length || !audioPackets.length || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Incomplete packet data");
  const firstVideo = videoPackets[0];
  const firstAudio = audioPackets[0];
  const lastVideo = videoPackets.at(-1);
  const lastAudio = audioPackets.at(-1);
  const deltaStartSeconds = Number(firstAudio.pts_time) - Number(firstVideo.pts_time);
  const deltaEndSeconds = Number(lastAudio.pts_time) + Number(lastAudio.duration_time) - Number(lastVideo.pts_time) - Number(lastVideo.duration_time);
  return { deltaStartSeconds, deltaEndSeconds, driftSeconds: deltaEndSeconds - deltaStartSeconds, driftLimitSeconds: 1024 / sampleRate, sampleRate };
}

function monotonicDts(packets) {
  return packets.every((packet, index) => index === 0 || Number(packet.dts_time) >= Number(packets[index - 1].dts_time));
}

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function withTimeout(promise, timeout, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeout); })])
    .finally(() => clearTimeout(timer));
}
async function executableVersion(executable) { return (await execFileAsync(executable, ["--version"])).stdout.trim(); }
