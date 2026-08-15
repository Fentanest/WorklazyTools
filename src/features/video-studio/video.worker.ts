/// <reference lib="webworker" />

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";

import type {
  VideoTask,
  VideoWorkerInput,
} from "./types";
import { appendVideoRateControl, even, outputDimensionsForSource, resolveAudioSampleRate } from "./videoEncoding";

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
}
type VideoWorkerCommand =
  | { type: "start"; request: VideoWorkerStartRequest }
  | { type: "input-file"; fileId: string; file: File };

const pendingInputFiles = new Map<string, { resolve: (file: File) => void; reject: (error: Error) => void }>();
let processing = false;
let currentLanguage: "ko" | "en" = "ko";
const L = (ko: string, en: string) => currentLanguage === "ko" ? ko : en;

worker.onmessage = (event: MessageEvent<VideoWorkerCommand>) => {
  const command = event.data;
  if (command.type === "input-file") {
    const pending = pendingInputFiles.get(command.fileId);
    if (!pending) return;
    pendingInputFiles.delete(command.fileId);
    if (command.file instanceof File && command.file.size > 0) pending.resolve(command.file);
    else pending.reject(new Error(L("원본 영상 파일이 비어 있거나 브라우저의 파일 접근 권한이 해제되었습니다.", "The source video is empty or browser file access permission has been revoked.")));
    return;
  }
  if (command.type === "start") {
    currentLanguage = command.request.language === "en" ? "en" : "ko";
    if (processing) {
      worker.postMessage({ type: "error", error: { message: L("이미 비디오 작업을 처리하고 있습니다.", "A video job is already running."), code: "VIDEO_WORKER_BUSY" } });
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
  let progressStage = createProgressStage(28, 90, 1, L("처리 중", "Processing"));
  let lastProgress = -1;
  let lastProgressAt = 0;

  const reportFfmpegProgress = ({ progress: rawProgress, time }: { progress: number; time: number }) => {
    const timeProgress = progressStage.duration > 0 && time > 0 ? time / 1_000_000 / progressStage.duration : 0;
    const ratio = clamp(timeProgress > 0 ? timeProgress : rawProgress || 0, 0, 1);
    const value = Math.round(progressStage.start + ratio * (progressStage.end - progressStage.start));
    const now = performance.now();
    if (value === lastProgress || (now - lastProgressAt < 250 && value < progressStage.end)) return;
    lastProgress = value;
    lastProgressAt = now;
    const remaining = estimateStageRemaining(progressStage, ratio, now);
    const eta = remaining === undefined ? (ratio >= 0.04 ? L(" · 남은 시간 계산 중", " · estimating time remaining") : "") : L(` · 현재 단계 약 ${formatDuration(remaining)}`, ` · about ${formatDuration(remaining)} for this stage`);
    progress(value, `${progressStage.label}… ${Math.round(ratio * 100)}%${eta}`);
  };
  ffmpeg.on("progress", reportFfmpegProgress);

  try {
    validateRequest(request);
    progress(3, L("비디오 처리 엔진을 불러오는 중… (첫 실행은 시간이 걸릴 수 있어요)", "Loading the video engine… (the first run may take a while)"));
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
        progress(7, L("멀티스레드 엔진을 시작하지 못해 호환 모드로 전환하는 중…", "Multi-thread startup failed; switching to compatibility mode…"));
        await ffmpeg.load({ coreURL: singleCoreURL, wasmURL: singleWasmURL, classWorkerURL });
      }
    } else {
      await ffmpeg.load({ coreURL: singleCoreURL, wasmURL: singleWasmURL, classWorkerURL });
    }
    progress(20, L(`${multiThreaded ? "멀티스레드" : "단일 스레드 호환"} 엔진 준비 완료 · 그룹별 출력 작업을 준비하는 중…`, `${multiThreaded ? "Multi-thread" : "Single-thread compatibility"} engine ready · preparing group outputs…`));

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
        progress(progressStage.start, L(`${label}… 준비 중`, `${label}… preparing`));
      });
      completedJobDuration += jobDurations[jobIndex];
      const buffer = result.bytes.buffer as ArrayBuffer;
      worker.postMessage({
        type: "output",
        output: { buffer, fileName: result.name, mimeType: getMimeType(result.name) },
      }, [buffer]);
      progress(
        23 + (completedJobDuration / totalJobDuration) * 67,
        L(`${jobIndex + 1}/${request.jobs.length} 결과 준비 완료 · 다음 작업을 확인하는 중…`, `${jobIndex + 1}/${request.jobs.length} result ready · checking the next job…`),
      );
    }

    const result = { outputCount: request.jobs.length, warnings: createWarnings(request) };
    progress(100, L(`${result.outputCount}개 결과 생성 완료`, `${result.outputCount} results created`));
    worker.postMessage({ type: "result", result });
  } catch (error) {
    worker.postMessage({ type: "error", error: normalizeError(error) });
  } finally {
    pendingInputFiles.forEach(({ reject }) => reject(new Error(L("비디오 작업이 종료되어 원본 파일 연결을 취소했습니다.", "Source file attachment was canceled because the video job ended."))));
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
      setStage(connectionStart, connectionEnd, 1, L(`[${job.name}] ${inputIndex + 1}/${job.inputs.length} 원본 파일 연결 중`, `[${job.name}] ${inputIndex + 1}/${job.inputs.length} attaching source file`));
      const file = await requestInputFile(input.fileId, input.fileName);
      await ffmpeg.createDir(mountPoint);
      const mounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: sourceName, data: file }] }, mountPoint);
      if (!mounted) throw new Error(L("이 브라우저의 영상 처리 엔진에서 대용량 파일 연결 기능을 사용할 수 없습니다.", "This browser's video engine cannot attach large files."));
      mountedDirectories.add(mountPoint);
      inputNames.push(inputName);
    }

    if (job.mode === "individual") {
      const input = job.inputs[0];
      const outputName = createOutputName(job.name || input.fileName, task, false);
      temporaryFiles.add(outputName);
      setStage(0.08, 0.92, input.end - input.start, `[${job.name}] ${describeTask(task)}`);
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
      L(`[${job.name} · ${inputIndex + 1}/${job.inputs.length}] 선택 구간 준비 중`, `[${job.name} · ${inputIndex + 1}/${job.inputs.length}] preparing selected range`),
    );
    const exitCode = await ffmpeg.exec(createConcatSegmentArguments(input, inputNames[inputIndex], segmentName, task, concatDimensions));
    if (exitCode !== 0) throw new Error(processingFailureMessage(L(`${job.name}의 ${inputIndex + 1}번째 영상`, `video ${inputIndex + 1} in ${job.name}`), task));
    completedDuration += inputDuration;
  }

  const listName = `job-${jobIndex}-concat.txt`;
  temporaryFiles.add(listName);
  await ffmpeg.writeFile(listName, segmentNames.map((name) => `file '${name}'`).join("\n"));
  if (task.kind === "gif") {
    const joinedName = `job-${jobIndex}-joined.mp4`;
    temporaryFiles.add(joinedName);
    setStage(0.76, 0.84, totalDuration, L(`[${job.name}] 영상 순서대로 연결 중`, `[${job.name}] concatenating videos in order`));
    const concatCode = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", joinedName]);
    if (concatCode !== 0) throw new Error(L(`${job.name}의 GIF용 영상 구간을 연결하지 못했습니다.`, `Unable to concatenate GIF segments for ${job.name}.`));
    const outputName = createOutputName(job.name, task, true);
    temporaryFiles.add(outputName);
    setStage(0.84, 0.96, totalDuration, L(`[${job.name}] GIF 생성 중`, `[${job.name}] creating GIF`));
    const filter = gifFilter(task, concatDimensions);
    const gifCode = await ffmpeg.exec(["-i", joinedName, "-filter_complex", filter, "-loop", "0", outputName]);
    if (gifCode !== 0) throw new Error(L(`${job.name} GIF를 생성하지 못했습니다.`, `Unable to create the ${job.name} GIF.`));
    return { name: outputName, bytes: await readBytes(ffmpeg, outputName) };
  }

  const outputName = createOutputName(job.name, task, true);
  temporaryFiles.add(outputName);
  setStage(0.9, 0.96, totalDuration, L(`[${job.name}] 순서대로 이어붙이는 중`, `[${job.name}] concatenating in order`));
  const concatArgs = ["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy"];
  if (task.kind === "encode" && task.container === "mp4") concatArgs.push("-movflags", "+faststart");
  concatArgs.push(outputName);
  const concatCode = await ffmpeg.exec(concatArgs);
  if (concatCode !== 0) {
    if (task.kind === "encode" && (task.bitrate === "copy" || task.audioMode === "copy")) {
      throw new Error(L(`${job.name} 영상의 코덱·해상도·오디오 스트림 구성이 달라 원본 유지 방식으로 이어붙일 수 없습니다. 영상은 CRF 자동 또는 지정 비트레이트를, 오디오는 재인코딩 또는 제거를 선택해 주세요.`, `${job.name} contains incompatible codecs, dimensions, or audio streams and cannot concatenate via passthrough. Choose CRF/target-bitrate video encoding and convert or remove audio.`));
    }
    throw new Error(L(`${job.name}의 선택 구간을 최종 파일로 연결하지 못했습니다.`, `Unable to combine the selected ranges for ${job.name} into the final file.`));
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

function createConcatSegmentArguments(input: VideoWorkerInputDescriptor, inputName: string, outputName: string, task: VideoTask, concatDimensions?: readonly [number, number]) {
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
  return createEncodeArguments(prefix, task, outputName, true, concatDimensions);
}

function createEncodeArguments(prefix: string[], task: Extract<VideoTask, { kind: "encode" }>, outputName: string, normalizeForConcat: boolean, concatDimensions?: readonly [number, number], inputFileSize = 0) {
  const args = [...prefix, "-map", "0:v:0"];
  const filter = createVideoFilter(task, normalizeForConcat, concatDimensions);
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

function createVideoFilter(task: Extract<VideoTask, { kind: "encode" }>, normalizeForConcat: boolean, concatDimensions?: readonly [number, number]) {
  if (task.aspect !== "source") {
    const [width, height] = concatDimensions || aspectDimensions(task.aspect, task.resolution);
    return appendTransformFilters(`crop=min(iw\,ih*${width}/${height}):min(ih\,iw*${height}/${width}),scale=${width}:${height}:flags=lanczos,setsar=1`, task);
  }
  if (normalizeForConcat) {
    const [width, height] = concatDimensions || landscapeDimensions(task.resolution);
    return appendTransformFilters(`scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`, task);
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
  if (request.mode !== "batch" || !request.jobs.length) throw new Error(L("출력할 영상 그룹이 없습니다.", "There are no video groups to export."));
  for (const job of request.jobs) {
    if (!job.inputs.length) throw new Error(L(`${job.name} 그룹이 비어 있습니다.`, `${job.name} is empty.`));
    if (job.mode === "individual" && job.inputs.length !== 1) throw new Error(L("개별 출력 작업에는 영상 하나만 포함할 수 있습니다.", "An individual output job must contain exactly one video."));
    job.inputs.forEach(validateInput);
  }
  if (request.task.kind === "encode") {
    if (request.task.container === "webm" && request.task.codec !== "vp9" && request.task.bitrate !== "copy") throw new Error(L("WebM은 VP9 코덱으로 출력해 주세요.", "Export WebM with the VP9 codec."));
    if (request.task.bitrate === "copy" && (request.task.resolution !== "source" || request.task.aspect !== "source" || request.task.rotation !== 0 || request.task.flipHorizontal)) {
      throw new Error(L("패스스루는 해상도와 화면 비율을 원본으로 유지할 때만 사용할 수 있습니다.", "Passthrough requires source resolution and aspect ratio."));
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
    throw new Error(L("영상 비트레이트는 0.1~200 Mbps 범위로 입력해 주세요.", "Enter a video bitrate between 0.1 and 200 Mbps."));
  }
}

function validateAudioBitrate(value: string) {
  const numeric = Number(value.replace(/k$/i, ""));
  if (!/^\d+k$/i.test(value) || !Number.isFinite(numeric) || numeric < 32 || numeric > 512) {
    throw new Error(L("오디오 비트레이트는 32~512 kbps 범위로 입력해 주세요.", "Enter an audio bitrate between 32 and 512 kbps."));
  }
}

function validateSampleRate(value: "source" | number, codec: "aac" | "mp3" | "opus") {
  if (value === "source") return;
  const maximum = codec === "aac" ? 96_000 : 48_000;
  if (!Number.isInteger(value) || value < 8_000 || value > maximum) {
    throw new Error(L(`선택한 오디오 코덱의 샘플레이트는 8,000~${maximum.toLocaleString()} Hz 범위로 입력해 주세요.`, `Enter a sample rate between 8,000 and ${maximum.toLocaleString()} Hz for the selected audio codec.`));
  }
}

function validateInput(input: VideoWorkerInputDescriptor) {
  if (!input.fileId || !input.fileName) throw new Error(L("비디오 파일 참조 정보가 올바르지 않습니다.", "The video file reference is invalid."));
  if (!Number.isFinite(input.duration) || input.duration <= 0) throw new Error(L("비디오 재생 시간을 확인하지 못했습니다.", "Unable to determine video duration."));
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) throw new Error(L("비디오 화면 크기를 확인하지 못했습니다.", "Unable to determine video dimensions."));
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.start < 0 || input.end <= input.start || input.end > input.duration + 0.25) {
    throw new Error(L("시작 시간과 종료 시간을 다시 확인해 주세요.", "Check the start and end times."));
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
  if (typeof data === "string") throw new Error(L("결과 파일이 올바른 바이너리 형식이 아닙니다.", "The output file is not valid binary data."));
  return data;
}

function createOutputName(name: string, task: VideoTask, concat: boolean) {
  const base = sanitizeFileName(name.replace(/\.[^.]+$/, "")) || "worklazy-video";
  const suffix = concat ? L("이어붙임", "concatenated") : task.kind === "encode" && task.bitrate === "copy" ? L("패스스루", "passthrough") : L("변환", "converted");
  if (task.kind === "gif") return `${base}-${concat ? `${L("이어붙임", "concatenated")}-` : ""}${L("움짤", "animation")}.gif`;
  if (task.kind === "audio") return `${base}-${concat ? `${L("이어붙임", "concatenated")}-` : ""}${L("오디오", "audio")}.${task.format === "aac" ? "m4a" : "mp3"}`;
  return `${base}-${suffix}.${task.container}`;
}

function segmentExtension(task: VideoTask) {
  if (task.kind === "gif") return "mp4";
  if (task.kind === "audio") return task.format === "aac" ? "m4a" : "mp3";
  return task.container;
}

function describeTask(task: VideoTask) {
  if (task.kind === "gif") return L("GIF 변환", "GIF conversion");
  if (task.kind === "audio") return L(`${task.format.toUpperCase()} 음원 추출`, `${task.format.toUpperCase()} audio extraction`);
  return task.bitrate === "copy" ? L("재인코딩 없는 패스스루", "passthrough without re-encoding") : L(`${task.container.toUpperCase()} 인코딩`, `${task.container.toUpperCase()} encoding`);
}

function processingFailureMessage(name: string, task: VideoTask) {
  if (task.kind === "encode" && task.audioMode === "copy") {
    return L(`${name}의 첫 번째 오디오 트랙을 선택한 컨테이너에 원본 그대로 넣을 수 없습니다. 오디오 재인코딩 또는 오디오 트랙 제거를 선택해 주세요.`, `The first audio track in ${name} cannot be copied directly into the selected container. Convert or remove the audio track.`);
  }
  if (task.kind === "audio") return L(`${name}에서 첫 번째 오디오 트랙을 ${task.format.toUpperCase()}로 추출하지 못했습니다.`, `Unable to extract the first audio track from ${name} as ${task.format.toUpperCase()}.`);
  return L(`${name} 파일을 ${describeTask(task)} 방식으로 처리하지 못했습니다.`, `Unable to process ${name} using ${describeTask(task)}.`);
}

function createWarnings(request: VideoWorkerStartRequest) {
  const warnings = [L(`그룹 설정에 따라 ${request.jobs.length}개 출력 작업을 처리했습니다.`, `Processed ${request.jobs.length} output jobs according to group settings.`)];
  if (request.task.kind === "encode" && request.task.bitrate === "copy") warnings.push(L("패스스루 자르기는 키프레임 경계에 따라 시작 시각이 조금 앞당겨질 수 있습니다.", "Passthrough trimming may start slightly earlier at a keyframe boundary."));
  if (request.task.kind === "encode" && request.task.audioMode === "copy") warnings.push(L("첫 번째 오디오 트랙을 재인코딩 없이 원본 그대로 유지했습니다.", "The first audio track was preserved without re-encoding."));
  if (request.task.kind === "encode" && request.task.audioMode === "remove") warnings.push(L("출력 영상에서 오디오 트랙을 제거했습니다.", "The audio track was removed from the output video."));
  if (request.task.kind === "encode" && request.task.codec === "hevc") warnings.push(L("HEVC는 기기와 플레이어에 따라 재생되지 않을 수 있습니다.", "HEVC may not play on every device or player."));
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

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/memory|allocation|out of bounds/i.test(message)) return { message: L("브라우저 메모리가 부족합니다. 더 짧은 구간이나 작은 파일 수로 다시 시도해 주세요.", "The browser ran out of memory. Try a shorter range or fewer files."), code: "OUT_OF_MEMORY" };
  if (/libx265|encoder.*not found|unknown encoder/i.test(message)) return { message: L("현재 브라우저용 인코딩 엔진에서 선택한 코덱을 지원하지 않습니다. H.264 또는 VP9을 선택해 주세요.", "The browser encoding engine does not support the selected codec. Choose H.264 or VP9."), code: "CODEC_UNAVAILABLE" };
  return { message: L(`${message} 입력 형식이나 코덱이 현재 브라우저 엔진에서 지원되지 않을 수 있습니다.`, `${message} The input format or codec may not be supported by this browser engine.`), code: "VIDEO_PROCESSING_ERROR" };
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
  if (seconds < 60) return L(`${Math.max(1, Math.round(seconds))}초`, `${Math.max(1, Math.round(seconds))} sec`);
  return L(`${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`, `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} sec`);
}

export {};
