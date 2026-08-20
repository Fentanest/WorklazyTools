/// <reference lib="webworker" />

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";

import type {
  VideoTask,
  VideoWorkerInput,
} from "./types";
import { appendVideoRateControl, even, outputDimensionsForSource, resolveAudioSampleRate, resolveConcatFrameRate } from "./videoEncoding";
import { classifyVideoProcessingFailure } from "./videoErrors";
import { workerMessage as featureMessage } from "../../i18n/workerMessages";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const runtimeLanguage = worker.location.pathname.match(new RegExp(`^${import.meta.env.BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(ko|en)(?:/|$)`))?.[1];
const runtimeBaseURL = new URL(`${import.meta.env.BASE_URL}${runtimeLanguage ? `${runtimeLanguage}/` : ""}tools/video-studio/runtime/`, worker.location.origin);
const classWorkerURL = new URL("ffmpeg-worker.js", runtimeBaseURL).href;
const singleCoreURL = new URL("single/ffmpeg-core.js", runtimeBaseURL).href;
const singleWasmURL = new URL("single/ffmpeg-core.wasm", runtimeBaseURL).href;
const multiCoreURL = new URL("multi/ffmpeg-core.js", runtimeBaseURL).href;
const multiWasmURL = new URL("multi/ffmpeg-core.wasm", runtimeBaseURL).href;
const multiWorkerURL = new URL("multi/ffmpeg-core.worker.js", runtimeBaseURL).href;

interface ProgressStage {
  start: number;
  end: number;
  duration: number;
  label: string;
  startedAt: number;
  lastRatio: number;
  lastSampleAt: number;
  smoothedRate: number;
  sampleCount: number;
}

type VideoWorkerInputDescriptor = Omit<VideoWorkerInput, "file"> & { fileId: string };
interface VideoWorkerOutputJobDescriptor {
  name: string;
  mode: "individual" | "concat";
  inputs: VideoWorkerInputDescriptor[];
}
interface VideoWorkerStartRequest {
  mode: "batch";
  jobs: VideoWorkerOutputJobDescriptor[];
  task: VideoTask;
  language: "ko" | "en";
  fileLabels: VideoFileLabels;
}
interface VideoFileLabels { concatenated: string; passthrough: string; converted: string; animation: string; audio: string }
type VideoWorkerCommand =
  | { type: "start"; request: VideoWorkerStartRequest }
  | { type: "input-file"; fileId: string; file: File };

const pendingInputFiles = new Map<string, { resolve: (file: File) => void; reject: (error: Error) => void }>();
let processing = false;
let currentLanguage: "ko" | "en" = "ko";
let currentFileLabels: VideoFileLabels = { concatenated: "concatenated", passthrough: "passthrough", converted: "converted", animation: "animation", audio: "audio" };

worker.onmessage = (event: MessageEvent<VideoWorkerCommand>) => {
  const command = event.data;
  if (command.type === "input-file") {
    const pending = pendingInputFiles.get(command.fileId);
    if (!pending) return;
    pendingInputFiles.delete(command.fileId);
    if (command.file instanceof File && command.file.size > 0) pending.resolve(command.file);
    else pending.reject(new Error(featureMessage(currentLanguage, "video.messages.video.theSourceVideoIsEmptyOrBrowserFile")));
    return;
  }
  if (command.type === "start") {
    currentLanguage = command.request.language === "en" ? "en" : "ko";
    currentFileLabels = command.request.fileLabels;
    if (processing) {
      worker.postMessage({ type: "error", error: { message: featureMessage(currentLanguage, "video.messages.video.aVideoJobIsAlreadyRunning"), code: "VIDEO_WORKER_BUSY" } });
      return;
    }
    processing = true;
    void processRequest(command.request);
  }
};

worker.postMessage({ type: "ready" });

async function processRequest(request: VideoWorkerStartRequest) {
  let ffmpeg = new FFmpeg();
  const temporaryFiles = new Set<string>();
  const mountedDirectories = new Set<string>();
  let progressStage = createProgressStage(28, 90, 1, featureMessage(currentLanguage, "video.messages.video.processing"));
  let lastProgress = -1;
  let lastProgressAt = 0;
  const ffmpegDiagnostics: string[] = [];

  const reportFfmpegProgress = ({ progress: rawProgress, time }: { progress: number; time: number }) => {
    const timeProgress = progressStage.duration > 0 && time > 0 ? time / 1_000_000 / progressStage.duration : 0;
    const ratio = clamp(timeProgress > 0 ? timeProgress : rawProgress || 0, 0, 1);
    const value = Math.round(progressStage.start + ratio * (progressStage.end - progressStage.start));
    const now = performance.now();
    if (value === lastProgress || (now - lastProgressAt < 250 && value < progressStage.end)) return;
    lastProgress = value;
    lastProgressAt = now;
    const remaining = estimateStageRemaining(progressStage, ratio, now);
    const eta = remaining === undefined ? (ratio >= 0.04 ? featureMessage(currentLanguage, "video.messages.video.estimatingTimeRemaining") : "") : featureMessage(currentLanguage, "video.messages.video.aboutForThisStage", { p0: formatDuration(remaining) });
    progress(value, featureMessage(currentLanguage, "video.messages.video.progressWithEta", {
      p0: progressStage.label,
      p1: Math.round(ratio * 100),
      p2: eta,
    }));
  };
  const collectFfmpegDiagnostic = ({ message }: { message: string }) => {
    if (!message) return;
    ffmpegDiagnostics.push(message);
    if (ffmpegDiagnostics.length > 80) ffmpegDiagnostics.splice(0, ffmpegDiagnostics.length - 80);
  };
  ffmpeg.on("progress", reportFfmpegProgress);
  ffmpeg.on("log", collectFfmpegDiagnostic);

  try {
    validateRequest(request);
    progress(3, featureMessage(currentLanguage, "video.messages.video.loadingTheVideoEngineTheFirstRunMay"));
    const multiThreadCandidate = worker.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined" && worker.navigator.hardwareConcurrency > 1;
    let multiThreaded = false;
    if (multiThreadCandidate) {
      try {
        await ffmpeg.load({ coreURL: multiCoreURL, wasmURL: multiWasmURL, workerURL: multiWorkerURL, classWorkerURL });
        multiThreaded = true;
      } catch {
        ffmpeg.terminate();
        ffmpeg = new FFmpeg();
        ffmpeg.on("progress", reportFfmpegProgress);
        ffmpeg.on("log", collectFfmpegDiagnostic);
        progress(7, featureMessage(currentLanguage, "video.messages.video.multiThreadStartupFailedSwitchingToCompatibilityMode"));
        await ffmpeg.load({ coreURL: singleCoreURL, wasmURL: singleWasmURL, classWorkerURL });
      }
    } else {
      await ffmpeg.load({ coreURL: singleCoreURL, wasmURL: singleWasmURL, classWorkerURL });
    }
    progress(20, featureMessage(currentLanguage, "video.messages.video.engineReadyPreparingGroupOutputs", { p0: featureMessage(currentLanguage, multiThreaded ? "video.messages.video.engineMultiThreaded" : "video.messages.video.engineSingleThreaded") }));

    const jobDurations = request.jobs.map(jobDuration);
    const totalJobDuration = jobDurations.reduce((sum, duration) => sum + duration, 0);
    let completedJobDuration = 0;
    for (let jobIndex = 0; jobIndex < request.jobs.length; jobIndex += 1) {
      const job = request.jobs[jobIndex];
      const jobStart = 23 + (completedJobDuration / totalJobDuration) * 67;
      const jobEnd = 23 + ((completedJobDuration + jobDurations[jobIndex]) / totalJobDuration) * 67;
      const result = await processJob(ffmpeg, job, request.task, jobIndex, temporaryFiles, mountedDirectories, (ratioStart, ratioEnd, duration, label) => {
        progressStage = createProgressStage(
          jobStart + (jobEnd - jobStart) * ratioStart,
          jobStart + (jobEnd - jobStart) * ratioEnd,
          duration,
          label,
        );
        lastProgress = -1;
        progress(progressStage.start, featureMessage(currentLanguage, "video.messages.video.preparing", { p0: label }));
      });
      completedJobDuration += jobDurations[jobIndex];
      const buffer = result.bytes.buffer as ArrayBuffer;
      worker.postMessage({
        type: "output",
        output: { buffer, fileName: result.name, mimeType: getMimeType(result.name) },
      }, [buffer]);
      progress(
        23 + (completedJobDuration / totalJobDuration) * 67,
        featureMessage(currentLanguage, "video.messages.video.resultReadyCheckingTheNextJob", { p0: jobIndex + 1, p1: request.jobs.length }),
      );
    }

    const result = { outputCount: request.jobs.length, warnings: createWarnings(request) };
    progress(100, featureMessage(currentLanguage, "video.messages.video.resultsCreated", { p0: result.outputCount }));
    worker.postMessage({ type: "result", result });
  } catch (error) {
    worker.postMessage({ type: "error", error: normalizeError(error, ffmpegDiagnostics) });
  } finally {
    pendingInputFiles.forEach(({ reject }) => reject(new Error(featureMessage(currentLanguage, "video.messages.video.sourceFileAttachmentWasCanceledBecauseTheVideo"))));
    pendingInputFiles.clear();
    for (const name of temporaryFiles) await ffmpeg.deleteFile(name).catch(() => undefined);
    for (const directory of mountedDirectories) {
      await ffmpeg.unmount(directory).catch(() => undefined);
      await ffmpeg.deleteDir(directory).catch(() => undefined);
    }
    ffmpeg.terminate();
    worker.close();
  }
}

async function processJob(
  ffmpeg: FFmpeg,
  job: VideoWorkerOutputJobDescriptor,
  task: VideoTask,
  jobIndex: number,
  temporaryFiles: Set<string>,
  mountedDirectories: Set<string>,
  setStage: (start: number, end: number, duration: number, label: string) => void,
) {
  const inputNames: string[] = [];
  const jobDirectories: string[] = [];
  const existingTemporaryFiles = new Set(temporaryFiles);
  try {
    for (let inputIndex = 0; inputIndex < job.inputs.length; inputIndex += 1) {
      const input = job.inputs[inputIndex];
      const sourceName = `input.${sanitizeExtension(getExtension(input.fileName) || "mp4")}`;
      const mountPoint = `/worklazy-input-${jobIndex}-${inputIndex}`;
      const inputName = `${mountPoint}/${sourceName}`;
      jobDirectories.push(mountPoint);
      const connectionStart = 0.01 + (inputIndex / job.inputs.length) * 0.04;
      const connectionEnd = 0.01 + ((inputIndex + 1) / job.inputs.length) * 0.04;
      setStage(connectionStart, connectionEnd, 1, featureMessage(currentLanguage, "video.messages.video.attachingSourceFile", { p0: job.name, p1: inputIndex + 1, p2: job.inputs.length }));
      const file = await requestInputFile(input.fileId, input.fileName);
      await ffmpeg.createDir(mountPoint);
      const mounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: sourceName, data: file }] }, mountPoint);
      if (!mounted) throw new Error(featureMessage(currentLanguage, "video.messages.video.thisBrowserSVideoEngineCannotAttachLarge"));
      mountedDirectories.add(mountPoint);
      inputNames.push(inputName);
    }

    if (job.mode === "individual") {
      const input = job.inputs[0];
      const outputName = createOutputName(job.name || input.fileName, task, false);
      temporaryFiles.add(outputName);
      setStage(0.08, 0.92, input.end - input.start, featureMessage(currentLanguage, "video.messages.video.jobTask", { p0: job.name, p1: describeTask(task) }));
      const exitCode = await ffmpeg.exec(createSingleArguments(input, inputNames[0], outputName, task));
      if (exitCode !== 0) throw new Error(processingFailureMessage(job.name, task));
      const bytes = await readBytes(ffmpeg, outputName);
      return { name: outputName, bytes };
    }

    return await processConcatJob(ffmpeg, job, task, jobIndex, inputNames, temporaryFiles, setStage);
  } finally {
    for (const name of [...temporaryFiles]) {
      if (existingTemporaryFiles.has(name)) continue;
      await ffmpeg.deleteFile(name).catch(() => undefined);
      temporaryFiles.delete(name);
    }
    for (const directory of jobDirectories) {
      await ffmpeg.unmount(directory).catch(() => undefined);
      await ffmpeg.deleteDir(directory).catch(() => undefined);
      mountedDirectories.delete(directory);
    }
  }
}

async function processConcatJob(
  ffmpeg: FFmpeg,
  job: VideoWorkerOutputJobDescriptor,
  task: VideoTask,
  jobIndex: number,
  inputNames: string[],
  temporaryFiles: Set<string>,
  setStage: (start: number, end: number, duration: number, label: string) => void,
) {
  const segmentNames: string[] = [];
  const concatDimensions = task.kind === "encode"
    ? outputDimensions(job.inputs[0], task)
    : task.kind === "gif"
      ? gifDimensions(job.inputs[0], task.width)
      : undefined;
  const concatFrameRate = task.kind === "encode" && task.bitrate !== "copy"
    ? resolveConcatFrameRate(job.inputs.map((input) => input.frameRate))
    : undefined;
  const totalDuration = jobDuration(job);
  const segmentEnd = task.kind === "gif" ? 0.76 : 0.9;
  const segmentBudget = segmentEnd - 0.04;
  let completedDuration = 0;
  for (let inputIndex = 0; inputIndex < job.inputs.length; inputIndex += 1) {
    const input = job.inputs[inputIndex];
    const inputDuration = Math.max(0.05, input.end - input.start);
    const segmentName = `job-${jobIndex}-segment-${inputIndex}.${segmentExtension(task)}`;
    segmentNames.push(segmentName);
    temporaryFiles.add(segmentName);
    setStage(
      0.04 + (completedDuration / totalDuration) * segmentBudget,
      0.04 + ((completedDuration + inputDuration) / totalDuration) * segmentBudget,
      inputDuration,
      featureMessage(currentLanguage, "video.messages.video.preparingSelectedRange", { p0: job.name, p1: inputIndex + 1, p2: job.inputs.length }),
    );
    const exitCode = await ffmpeg.exec(createConcatSegmentArguments(input, inputNames[inputIndex], segmentName, task, concatDimensions, concatFrameRate));
    if (exitCode !== 0) throw new Error(processingFailureMessage(featureMessage(currentLanguage, "video.messages.video.videoIn", { p0: job.name, p1: inputIndex + 1 }), task));
    completedDuration += inputDuration;
  }

  const listName = `job-${jobIndex}-concat.txt`;
  temporaryFiles.add(listName);
  await ffmpeg.writeFile(listName, segmentNames.map((name) => `file '${name}'`).join("\n"));
  if (task.kind === "gif") {
    const joinedName = `job-${jobIndex}-joined.mp4`;
    temporaryFiles.add(joinedName);
    setStage(0.76, 0.84, totalDuration, featureMessage(currentLanguage, "video.messages.video.concatenatingVideosInOrder", { p0: job.name }));
    const concatCode = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", joinedName]);
    if (concatCode !== 0) throw new Error(featureMessage(currentLanguage, "video.messages.video.unableToConcatenateGifSegmentsFor", { p0: job.name }));
    const outputName = createOutputName(job.name, task, true);
    temporaryFiles.add(outputName);
    setStage(0.84, 0.96, totalDuration, featureMessage(currentLanguage, "video.messages.video.creatingGif", { p0: job.name }));
    const filter = gifFilter(task, concatDimensions);
    const gifCode = await ffmpeg.exec(["-i", joinedName, "-filter_complex", filter, "-loop", "0", outputName]);
    if (gifCode !== 0) throw new Error(featureMessage(currentLanguage, "video.messages.video.unableToCreateTheGif", { p0: job.name }));
    return { name: outputName, bytes: await readBytes(ffmpeg, outputName) };
  }

  const outputName = createOutputName(job.name, task, true);
  temporaryFiles.add(outputName);
  setStage(0.9, 0.96, totalDuration, featureMessage(currentLanguage, "video.messages.video.concatenatingInOrder", { p0: job.name }));
  const concatArgs = ["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy"];
  if (task.kind === "encode" && task.container === "mp4") concatArgs.push("-movflags", "+faststart");
  concatArgs.push(outputName);
  const concatCode = await ffmpeg.exec(concatArgs);
  if (concatCode !== 0) {
    if (task.kind === "encode" && (task.bitrate === "copy" || task.audioMode === "copy")) {
      throw new Error(featureMessage(currentLanguage, "video.messages.video.containsIncompatibleCodecsDimensionsOrAudioStreamsAnd", { p0: job.name }));
    }
    throw new Error(featureMessage(currentLanguage, "video.messages.video.unableToCombineTheSelectedRangesForInto", { p0: job.name }));
  }
  return { name: outputName, bytes: await readBytes(ffmpeg, outputName) };
}

function createSingleArguments(input: VideoWorkerInputDescriptor, inputName: string, outputName: string, task: VideoTask) {
  const prefix = trimPrefix(input, inputName);
  if (task.kind === "gif") return [...prefix, "-filter_complex", gifFilter(task), "-loop", "0", outputName];
  if (task.kind === "audio") return createAudioOnlyArguments(prefix, task, outputName);
  if (task.bitrate === "copy") {
    const args = [...prefix, "-map", "0:v:0", "-c:v", "copy"];
    appendVideoAudioArguments(args, task);
    args.push("-avoid_negative_ts", "make_zero");
    if (task.container === "mp4" && input.fileSize < 512 * 1024 * 1024) args.push("-movflags", "+faststart");
    args.push(outputName);
    return args;
  }
  return createEncodeArguments(prefix, task, outputName, false, outputDimensions(input, task), input.fileSize);
}

function createConcatSegmentArguments(input: VideoWorkerInputDescriptor, inputName: string, outputName: string, task: VideoTask, concatDimensions?: readonly [number, number], concatFrameRate?: number) {
  const prefix = trimPrefix(input, inputName);
  if (task.kind === "audio") {
    return createAudioOnlyArguments(prefix, task, outputName);
  }
  if (task.kind === "gif") {
    const [width, height] = concatDimensions || gifDimensions(input, task.width);
    const filter = `fps=${task.fps},scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    return [...prefix, "-an", "-vf", filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", outputName];
  }
  if (task.bitrate === "copy") {
    const args = [...prefix, "-map", "0:v:0", "-c:v", "copy"];
    appendVideoAudioArguments(args, task);
    args.push("-avoid_negative_ts", "make_zero", outputName);
    return args;
  }
  return createEncodeArguments(prefix, task, outputName, true, concatDimensions, 0, concatFrameRate);
}

function createEncodeArguments(prefix: string[], task: Extract<VideoTask, { kind: "encode" }>, outputName: string, normalizeForConcat: boolean, concatDimensions?: readonly [number, number], inputFileSize = 0, concatFrameRate?: number) {
  const args = [...prefix, "-map", "0:v:0"];
  const filter = createVideoFilter(task, normalizeForConcat, concatDimensions, concatFrameRate);
  if (filter) args.push("-vf", filter);
  args.push("-c:v", codecName(task.codec));
  appendVideoRateControl(args, task.codec, task.bitrate, task.crf);
  args.push("-threads", String(encodingThreadCount()));
  if (task.codec === "hevc" && task.container === "mp4") args.push("-tag:v", "hvc1");
  appendVideoAudioArguments(args, task, normalizeForConcat);
  if (task.container === "mp4" && !normalizeForConcat && inputFileSize < 512 * 1024 * 1024) args.push("-movflags", "+faststart");
  args.push(outputName);
  return args;
}

function createAudioOnlyArguments(prefix: string[], task: Extract<VideoTask, { kind: "audio" }>, outputName: string) {
  const args = [...prefix, "-map", "0:a:0", "-vn", "-c:a", task.format === "mp3" ? "libmp3lame" : "aac", "-b:a", task.bitrate];
  appendSampleRate(args, task.sampleRate, task.format === "mp3" ? "mp3" : "aac");
  args.push(outputName);
  return args;
}

function appendVideoAudioArguments(args: string[], task: Extract<VideoTask, { kind: "encode" }>, normalizeForConcat = false) {
  if (task.audioMode === "remove") {
    args.push("-an");
    return;
  }
  args.push("-map", "0:a:0?");
  if (task.audioMode === "copy") {
    args.push("-c:a", "copy");
    return;
  }
  const audioCodec = task.container === "webm" ? "opus" : "aac";
  args.push("-c:a", audioCodec === "opus" ? "libopus" : "aac", "-b:a", task.audioBitrate);
  appendSampleRate(args, task.audioSampleRate, audioCodec);
  if (normalizeForConcat) args.push("-ar", "48000", "-ac", "2");
}

function appendSampleRate(args: string[], sampleRate: "source" | number, codec: "aac" | "mp3" | "opus") {
  const resolved = resolveAudioSampleRate(sampleRate, codec);
  if (resolved !== "source") args.push("-ar", String(resolved));
}

function createVideoFilter(task: Extract<VideoTask, { kind: "encode" }>, normalizeForConcat: boolean, concatDimensions?: readonly [number, number], concatFrameRate?: number) {
  const frameRateFilter = normalizeForConcat && concatFrameRate ? `fps=${concatFrameRate},` : "";
  if (task.aspect !== "source") {
    const [width, height] = concatDimensions || aspectDimensions(task.aspect, task.resolution);
    return appendTransformFilters(`${frameRateFilter}crop=min(iw\,ih*${width}/${height}):min(ih\,iw*${height}/${width}),scale=${width}:${height}:flags=lanczos,setsar=1`, task);
  }
  if (normalizeForConcat) {
    const [width, height] = concatDimensions || landscapeDimensions(task.resolution);
    return appendTransformFilters(`${frameRateFilter}scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`, task);
  }
  const resize = task.resolution !== "source"
    ? `scale=w='if(lte(iw\,ih)\,min(iw\,${task.resolution})\,-2)':h='if(gt(iw\,ih)\,min(ih\,${task.resolution})\,-2)':flags=lanczos`
    : "";
  return appendTransformFilters(resize, task);
}

function trimPrefix(input: VideoWorkerInputDescriptor, inputName: string) {
  return ["-ss", input.start.toFixed(3), "-i", inputName, "-t", Math.max(0.05, input.end - input.start).toFixed(3)];
}

function gifFilter(task: Extract<VideoTask, { kind: "gif" }>, dimensions?: readonly [number, number]) {
  const scale = dimensions ? `scale=${dimensions[0]}:${dimensions[1]}:flags=lanczos` : `scale=min(${task.width}\,iw):-2:flags=lanczos`;
  return `fps=${task.fps},${scale},split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=sierra2_4a`;
}

function validateRequest(request: VideoWorkerStartRequest) {
  if (request.mode !== "batch" || !request.jobs.length) throw new Error(featureMessage(currentLanguage, "video.messages.video.thereAreNoVideoGroupsToExport"));
  for (const job of request.jobs) {
    if (!job.inputs.length) throw new Error(featureMessage(currentLanguage, "video.messages.video.isEmpty", { p0: job.name }));
    if (job.mode === "individual" && job.inputs.length !== 1) throw new Error(featureMessage(currentLanguage, "video.messages.video.anIndividualOutputJobMustContainExactlyOne"));
    job.inputs.forEach(validateInput);
  }
  if (request.task.kind === "encode") {
    if (request.task.container === "webm" && request.task.codec !== "vp9" && request.task.bitrate !== "copy") throw new Error(featureMessage(currentLanguage, "video.messages.video.exportWebmWithTheVp9Codec"));
    if (request.task.bitrate === "copy" && (request.task.resolution !== "source" || request.task.aspect !== "source" || request.task.rotation !== 0 || request.task.flipHorizontal)) {
      throw new Error(featureMessage(currentLanguage, "video.messages.video.passthroughRequiresSourceResolutionAndAspectRatio"));
    }
    validateVideoBitrate(request.task.bitrate);
    if (request.task.audioMode === "encode") {
      validateAudioBitrate(request.task.audioBitrate);
      validateSampleRate(request.task.audioSampleRate, request.task.container === "webm" ? "opus" : "aac");
    }
  }
  if (request.task.kind === "audio") {
    validateAudioBitrate(request.task.bitrate);
    validateSampleRate(request.task.sampleRate, request.task.format === "mp3" ? "mp3" : "aac");
  }
}

function validateVideoBitrate(value: string) {
  if (value === "copy" || value === "0") return;
  const numeric = Number(value.replace(/M$/i, ""));
  if (!/^\d+(\.\d+)?M$/i.test(value) || !Number.isFinite(numeric) || numeric < 0.1 || numeric > 200) {
    throw new Error(featureMessage(currentLanguage, "video.messages.video.enterAVideoBitrateBetween01And"));
  }
}

function validateAudioBitrate(value: string) {
  const numeric = Number(value.replace(/k$/i, ""));
  if (!/^\d+k$/i.test(value) || !Number.isFinite(numeric) || numeric < 32 || numeric > 512) {
    throw new Error(featureMessage(currentLanguage, "video.messages.video.enterAnAudioBitrateBetween32And512"));
  }
}

function validateSampleRate(value: "source" | number, codec: "aac" | "mp3" | "opus") {
  if (value === "source") return;
  const maximum = codec === "aac" ? 96_000 : 48_000;
  if (!Number.isInteger(value) || value < 8_000 || value > maximum) {
    throw new Error(featureMessage(currentLanguage, "video.messages.video.enterASampleRateBetween8000And", { p0: maximum.toLocaleString() }));
  }
}

function validateInput(input: VideoWorkerInputDescriptor) {
  if (!input.fileId || !input.fileName) throw new Error(featureMessage(currentLanguage, "video.messages.video.theVideoFileReferenceIsInvalid"));
  if (!Number.isFinite(input.duration) || input.duration <= 0) throw new Error(featureMessage(currentLanguage, "video.messages.video.unableToDetermineVideoDuration"));
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) throw new Error(featureMessage(currentLanguage, "video.messages.video.unableToDetermineVideoDimensions"));
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.start < 0 || input.end <= input.start || input.end > input.duration + 0.25) {
    throw new Error(featureMessage(currentLanguage, "video.messages.video.checkTheStartAndEndTimes"));
  }
}

function requestInputFile(fileId: string, fileName: string) {
  return new Promise<File>((resolve, reject) => {
    pendingInputFiles.set(fileId, { resolve, reject });
    worker.postMessage({ type: "request-input-file", fileId, fileName });
  });
}

async function readBytes(ffmpeg: FFmpeg, outputName: string) {
  const data = await ffmpeg.readFile(outputName);
  if (typeof data === "string") throw new Error(featureMessage(currentLanguage, "video.messages.video.theOutputFileIsNotValidBinaryData"));
  return data;
}

function createOutputName(name: string, task: VideoTask, concat: boolean) {
  const base = sanitizeFileName(name.replace(/\.[^.]+$/, "")) || "worklazy-video";
  const suffix = concat ? currentFileLabels.concatenated : task.kind === "encode" && task.bitrate === "copy" ? currentFileLabels.passthrough : currentFileLabels.converted;
  if (task.kind === "gif") return `${base}-${concat ? `${currentFileLabels.concatenated}-` : ""}${currentFileLabels.animation}.gif`;
  if (task.kind === "audio") return `${base}-${concat ? `${currentFileLabels.concatenated}-` : ""}${currentFileLabels.audio}.${task.format === "aac" ? "m4a" : "mp3"}`;
  return `${base}-${suffix}.${task.container}`;
}

function segmentExtension(task: VideoTask) {
  if (task.kind === "gif") return "mp4";
  if (task.kind === "audio") return task.format === "aac" ? "m4a" : "mp3";
  return task.container;
}

function describeTask(task: VideoTask) {
  if (task.kind === "gif") return featureMessage(currentLanguage, "video.messages.video.gifConversion");
  if (task.kind === "audio") return featureMessage(currentLanguage, "video.messages.video.audioExtraction", { p0: task.format.toUpperCase() });
  return task.bitrate === "copy" ? featureMessage(currentLanguage, "video.messages.video.passthroughWithoutReEncoding") : featureMessage(currentLanguage, "video.messages.video.encoding", { p0: task.container.toUpperCase() });
}

function processingFailureMessage(name: string, task: VideoTask) {
  if (task.kind === "encode" && task.audioMode === "copy") {
    return featureMessage(currentLanguage, "video.messages.video.theFirstAudioTrackInCannotBeCopied", { p0: name });
  }
  if (task.kind === "audio") return featureMessage(currentLanguage, "video.messages.video.unableToExtractTheFirstAudioTrackFrom", { p0: name, p1: task.format.toUpperCase() });
  return featureMessage(currentLanguage, "video.messages.video.unableToProcessUsing", { p0: name, p1: describeTask(task) });
}

function createWarnings(request: VideoWorkerStartRequest) {
  const warnings = [featureMessage(currentLanguage, "video.messages.video.processedOutputJobsAccordingToGroupSettings", { p0: request.jobs.length })];
  if (request.task.kind === "encode" && request.task.bitrate === "copy") warnings.push(featureMessage(currentLanguage, "video.messages.video.passthroughTrimmingMayStartSlightlyEarlierAtA"));
  if (request.task.kind === "encode" && request.task.audioMode === "copy") warnings.push(featureMessage(currentLanguage, "video.messages.video.theFirstAudioTrackWasPreservedWithoutRe"));
  if (request.task.kind === "encode" && request.task.audioMode === "remove") warnings.push(featureMessage(currentLanguage, "video.messages.video.theAudioTrackWasRemovedFromTheOutput"));
  if (request.task.kind === "encode" && request.task.codec === "hevc") warnings.push(featureMessage(currentLanguage, "video.messages.video.hevcMayNotPlayOnEveryDeviceOr"));
  return warnings;
}

function createProgressStage(start: number, end: number, duration: number, label: string): ProgressStage {
  const now = performance.now();
  return {
    start,
    end,
    duration: Math.max(0.05, duration),
    label,
    startedAt: now,
    lastRatio: 0,
    lastSampleAt: now,
    smoothedRate: 0,
    sampleCount: 0,
  };
}

function estimateStageRemaining(stage: ProgressStage, ratio: number, now: number) {
  if (ratio > stage.lastRatio) {
    const elapsed = (now - stage.lastSampleAt) / 1000;
    const advanced = ratio - stage.lastRatio;
    if (elapsed >= 0.15 && advanced > 0) {
      const rate = advanced / elapsed;
      if (Number.isFinite(rate) && rate > 0) {
        stage.smoothedRate = stage.smoothedRate > 0 ? stage.smoothedRate * 0.72 + rate * 0.28 : rate;
        stage.sampleCount += 1;
      }
      stage.lastRatio = ratio;
      stage.lastSampleAt = now;
    }
  }

  const elapsed = (now - stage.startedAt) / 1000;
  if (elapsed < 5 || ratio < 0.04 || ratio >= 1 || stage.sampleCount < 3 || stage.smoothedRate <= 0) return undefined;
  const remaining = (1 - ratio) / stage.smoothedRate;
  return Number.isFinite(remaining) && remaining >= 0 ? remaining : undefined;
}

function jobDuration(job: VideoWorkerOutputJobDescriptor) {
  return Math.max(0.05, job.inputs.reduce((sum, input) => sum + Math.max(0.05, input.end - input.start), 0));
}

function aspectDimensions(aspect: "9:16" | "1:1" | "16:9", resolution: "source" | "1080" | "720" | "480") {
  const shortSide = resolution === "source" ? 1080 : Number(resolution);
  if (aspect === "9:16") return [even(shortSide), even(shortSide * 16 / 9)] as const;
  if (aspect === "1:1") return [even(shortSide), even(shortSide)] as const;
  return [even(shortSide * 16 / 9), even(shortSide)] as const;
}

function landscapeDimensions(resolution: "source" | "1080" | "720" | "480") {
  const height = resolution === "source" ? 720 : Number(resolution);
  return [even(height * 16 / 9), even(height)] as const;
}

function outputDimensions(input: VideoWorkerInputDescriptor, task: Extract<VideoTask, { kind: "encode" }>) {
  return outputDimensionsForSource(input.width, input.height, task.aspect, task.resolution);
}

function gifDimensions(input: VideoWorkerInputDescriptor, maximumWidth: number) {
  const width = even(Math.min(maximumWidth, input.width));
  return [width, even(width * input.height / input.width)] as const;
}

function appendTransformFilters(base: string, task: Extract<VideoTask, { kind: "encode" }>) {
  const filters = base ? [base] : [];
  if (task.rotation === 90) filters.push("transpose=1");
  if (task.rotation === 180) filters.push("hflip", "vflip");
  if (task.rotation === 270) filters.push("transpose=2");
  if (task.flipHorizontal) filters.push("hflip");
  return filters.join(",");
}

function codecName(codec: "h264" | "hevc" | "vp9") {
  return codec === "h264" ? "libx264" : codec === "hevc" ? "libx265" : "libvpx-vp9";
}

function encodingThreadCount() {
  return Math.min(4, Math.max(1, worker.navigator.hardwareConcurrency || 2));
}

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

function normalizeError(error: unknown, diagnosticMessages: readonly string[] = []) {
  const code = classifyVideoProcessingFailure(error, diagnosticMessages);
  if (code === "OUT_OF_MEMORY") return { message: featureMessage(currentLanguage, "video.messages.video.theBrowserRanOutOfMemoryTryA"), code };
  if (code === "CODEC_UNAVAILABLE") return { message: featureMessage(currentLanguage, "video.messages.video.theBrowserEncodingEngineDoesNotSupportThe"), code };
  return { message: featureMessage(currentLanguage, "video.messages.video.theInputFormatOrCodecMayNotBe"), code: "VIDEO_PROCESSING_ERROR" };
}

function getExtension(name: string) { return name.split(".").pop()?.toLowerCase() || ""; }
function sanitizeExtension(value: string) { return value.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "mp4"; }
function sanitizeFileName(value: string) { return value.trim().replace(/[\\/:*?"<>|]+/g, "-"); }
function getMimeType(name: string) {
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function formatDuration(seconds: number) {
  if (seconds < 60) return featureMessage(currentLanguage, "video.messages.video.sec", { p0: Math.max(1, Math.round(seconds)) });
  return featureMessage(currentLanguage, "video.messages.video.minSec", { p0: Math.floor(seconds / 60), p1: Math.round(seconds % 60) });
}

export {};
