/// <reference lib="webworker" />

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import classWorkerURL from "@ffmpeg/ffmpeg/worker?worker&url";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import JSZip from "jszip";

import type {
  VideoOutputJob,
  VideoTask,
  VideoWorkerInput,
  VideoWorkerRequest,
  VideoWorkerResult,
} from "./types";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<VideoWorkerRequest>) => {
  const ffmpeg = new FFmpeg();
  const temporaryFiles = new Set<string>();
  const mountedDirectories = new Set<string>();
  let progressStage = { start: 28, end: 90, duration: 1, label: "처리 중" };
  let lastProgress = -1;
  let lastProgressAt = 0;
  const startedAt = performance.now();

  try {
    const request = event.data;
    validateRequest(request);
    ffmpeg.on("progress", ({ progress: rawProgress, time }) => {
      const timeProgress = progressStage.duration > 0 ? time / 1_000_000 / progressStage.duration : 0;
      const ratio = clamp(Math.max(rawProgress || 0, timeProgress), 0, 1);
      const value = Math.round(progressStage.start + ratio * (progressStage.end - progressStage.start));
      const now = performance.now();
      if (value === lastProgress || (now - lastProgressAt < 250 && value < progressStage.end)) return;
      lastProgress = value;
      lastProgressAt = now;
      const elapsed = now - startedAt;
      const remaining = ratio > 0.02 ? Math.max(0, elapsed / ratio - elapsed) : 0;
      progress(value, `${progressStage.label}… ${Math.round(ratio * 100)}%${remaining ? ` · 남은 시간 약 ${formatDuration(remaining / 1000)}` : ""}`);
    });

    progress(3, "비디오 처리 엔진을 불러오는 중… (첫 실행은 시간이 걸릴 수 있어요)");
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
    progress(20, "그룹별 출력 작업을 준비하는 중…");

    const outputs: Array<{ name: string; bytes: Uint8Array }> = [];
    for (let jobIndex = 0; jobIndex < request.jobs.length; jobIndex += 1) {
      const job = request.jobs[jobIndex];
      const jobStart = 23 + (jobIndex / request.jobs.length) * 67;
      const jobEnd = 23 + ((jobIndex + 1) / request.jobs.length) * 67;
      const result = await processJob(ffmpeg, job, request.task, jobIndex, temporaryFiles, mountedDirectories, (ratioStart, ratioEnd, duration, label) => {
        progressStage = {
          start: jobStart + (jobEnd - jobStart) * ratioStart,
          end: jobStart + (jobEnd - jobStart) * ratioEnd,
          duration,
          label,
        };
        lastProgress = -1;
      });
      outputs.push(result);
    }

    progress(92, outputs.length > 1 ? `${outputs.length}개 결과를 ZIP으로 묶는 중…` : "결과 파일을 브라우저로 옮기는 중…");
    const result = await packageOutputs(outputs, request);
    progress(100, `${result.fileName} 생성 완료`);
    worker.postMessage({ type: "result", result }, [result.buffer]);
  } catch (error) {
    worker.postMessage({ type: "error", error: normalizeError(error) });
  } finally {
    for (const name of temporaryFiles) await ffmpeg.deleteFile(name).catch(() => undefined);
    for (const directory of mountedDirectories) {
      await ffmpeg.unmount(directory).catch(() => undefined);
      await ffmpeg.deleteDir(directory).catch(() => undefined);
    }
    ffmpeg.terminate();
    worker.close();
  }
};

async function processJob(
  ffmpeg: FFmpeg,
  job: VideoOutputJob,
  task: VideoTask,
  jobIndex: number,
  temporaryFiles: Set<string>,
  mountedDirectories: Set<string>,
  setStage: (start: number, end: number, duration: number, label: string) => void,
) {
  const inputNames: string[] = [];
  for (let inputIndex = 0; inputIndex < job.inputs.length; inputIndex += 1) {
    const input = job.inputs[inputIndex];
    const sourceName = `input.${sanitizeExtension(getExtension(input.fileName) || "mp4")}`;
    const mountPoint = `/worklazy-input-${jobIndex}-${inputIndex}`;
    const inputName = `${mountPoint}/${sourceName}`;
    await ffmpeg.createDir(mountPoint);
    const mounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: sourceName, data: input.file }] }, mountPoint);
    if (!mounted) throw new Error("이 브라우저의 영상 처리 엔진에서 대용량 파일 연결 기능을 사용할 수 없습니다.");
    mountedDirectories.add(mountPoint);
    inputNames.push(inputName);
  }

  if (job.mode === "individual") {
    const input = job.inputs[0];
    const outputName = createOutputName(job.name || input.fileName, task, false);
    temporaryFiles.add(outputName);
    setStage(0.08, 0.92, input.end - input.start, `[${job.name}] ${describeTask(task)}`);
    const exitCode = await ffmpeg.exec(createSingleArguments(input, inputNames[0], outputName, task));
    if (exitCode !== 0) throw new Error(`${job.name} 파일을 ${describeTask(task)} 방식으로 처리하지 못했습니다.`);
    const bytes = await readBytes(ffmpeg, outputName);
    return { name: outputName, bytes };
  }

  return processConcatJob(ffmpeg, job, task, jobIndex, inputNames, temporaryFiles, setStage);
}

async function processConcatJob(
  ffmpeg: FFmpeg,
  job: VideoOutputJob,
  task: VideoTask,
  jobIndex: number,
  inputNames: string[],
  temporaryFiles: Set<string>,
  setStage: (start: number, end: number, duration: number, label: string) => void,
) {
  const segmentNames: string[] = [];
  const concatDimensions = task.kind === "encode" ? outputDimensions(job.inputs[0], task) : undefined;
  const segmentWeight = 0.72 / job.inputs.length;
  for (let inputIndex = 0; inputIndex < job.inputs.length; inputIndex += 1) {
    const input = job.inputs[inputIndex];
    const segmentName = `job-${jobIndex}-segment-${inputIndex}.${segmentExtension(task)}`;
    segmentNames.push(segmentName);
    temporaryFiles.add(segmentName);
    setStage(
      0.04 + inputIndex * segmentWeight,
      0.04 + (inputIndex + 1) * segmentWeight,
      input.end - input.start,
      `[${job.name} · ${inputIndex + 1}/${job.inputs.length}] 선택 구간 준비 중`,
    );
    const exitCode = await ffmpeg.exec(createConcatSegmentArguments(input, inputNames[inputIndex], segmentName, task, concatDimensions));
    if (exitCode !== 0) throw new Error(`${job.name}의 ${inputIndex + 1}번째 영상 구간을 준비하지 못했습니다.`);
  }

  const listName = `job-${jobIndex}-concat.txt`;
  temporaryFiles.add(listName);
  await ffmpeg.writeFile(listName, segmentNames.map((name) => `file '${name}'`).join("\n"));
  const totalDuration = job.inputs.reduce((sum, input) => sum + input.end - input.start, 0);

  if (task.kind === "gif") {
    const joinedName = `job-${jobIndex}-joined.mp4`;
    temporaryFiles.add(joinedName);
    setStage(0.76, 0.84, totalDuration, `[${job.name}] 영상 순서대로 연결 중`);
    const concatCode = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy", joinedName]);
    if (concatCode !== 0) throw new Error(`${job.name}의 GIF용 영상 구간을 연결하지 못했습니다.`);
    const outputName = createOutputName(job.name, task, true);
    temporaryFiles.add(outputName);
    setStage(0.84, 0.96, totalDuration, `[${job.name}] GIF 생성 중`);
    const filter = gifFilter(task);
    const gifCode = await ffmpeg.exec(["-i", joinedName, "-filter_complex", filter, "-loop", "0", outputName]);
    if (gifCode !== 0) throw new Error(`${job.name} GIF를 생성하지 못했습니다.`);
    return { name: outputName, bytes: await readBytes(ffmpeg, outputName) };
  }

  const outputName = createOutputName(job.name, task, true);
  temporaryFiles.add(outputName);
  setStage(0.76, 0.96, totalDuration, `[${job.name}] 순서대로 이어붙이는 중`);
  const concatArgs = ["-f", "concat", "-safe", "0", "-i", listName, "-c", "copy"];
  if (task.kind === "encode" && task.container === "mp4") concatArgs.push("-movflags", "+faststart");
  concatArgs.push(outputName);
  const concatCode = await ffmpeg.exec(concatArgs);
  if (concatCode !== 0) {
    if (task.kind === "encode" && task.bitrate === "copy") {
      throw new Error(`${job.name} 영상의 코덱·해상도·스트림 구성이 달라 패스스루로 이어붙일 수 없습니다. CRF 자동 또는 지정 비트레이트를 선택해 주세요.`);
    }
    throw new Error(`${job.name}의 선택 구간을 최종 파일로 연결하지 못했습니다.`);
  }
  return { name: outputName, bytes: await readBytes(ffmpeg, outputName) };
}

function createSingleArguments(input: VideoWorkerInput, inputName: string, outputName: string, task: VideoTask) {
  const prefix = trimPrefix(input, inputName);
  if (task.kind === "gif") return [...prefix, "-filter_complex", gifFilter(task), "-loop", "0", outputName];
  if (task.kind === "audio") return [...prefix, "-vn", "-c:a", task.format === "mp3" ? "libmp3lame" : "aac", "-b:a", task.bitrate, outputName];
  if (task.bitrate === "copy") {
    return [...prefix, "-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero", ...(task.container === "mp4" ? ["-movflags", "+faststart"] : []), outputName];
  }
  return createEncodeArguments(prefix, task, outputName, false);
}

function createConcatSegmentArguments(input: VideoWorkerInput, inputName: string, outputName: string, task: VideoTask, concatDimensions?: readonly [number, number]) {
  const prefix = trimPrefix(input, inputName);
  if (task.kind === "audio") {
    return [...prefix, "-vn", "-c:a", task.format === "mp3" ? "libmp3lame" : "aac", "-b:a", task.bitrate, outputName];
  }
  if (task.kind === "gif") {
    const height = even(Math.round(task.width * 9 / 16));
    const filter = `fps=${task.fps},scale=${task.width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${task.width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    return [...prefix, "-an", "-vf", filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", outputName];
  }
  if (task.bitrate === "copy") return [...prefix, "-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero", outputName];
  return createEncodeArguments(prefix, task, outputName, true, concatDimensions);
}

function createEncodeArguments(prefix: string[], task: Extract<VideoTask, { kind: "encode" }>, outputName: string, normalizeForConcat: boolean, concatDimensions?: readonly [number, number]) {
  const args = [...prefix, "-map", "0:v:0", "-map", "0:a:0?"];
  const filter = createVideoFilter(task, normalizeForConcat, concatDimensions);
  if (filter) args.push("-vf", filter);
  args.push("-c:v", codecName(task.codec));
  if (task.codec === "vp9") args.push("-b:v", task.bitrate || "0", "-crf", String(task.crf), "-row-mt", "0");
  else args.push("-preset", "veryfast", "-crf", String(task.crf), "-b:v", task.bitrate || "0");
  if (task.codec === "hevc" && task.container === "mp4") args.push("-tag:v", "hvc1");
  args.push("-c:a", task.container === "webm" ? "libopus" : "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2");
  if (task.container === "mp4") args.push("-movflags", "+faststart");
  args.push(outputName);
  return args;
}

function createVideoFilter(task: Extract<VideoTask, { kind: "encode" }>, normalizeForConcat: boolean, concatDimensions?: readonly [number, number]) {
  if (task.aspect !== "source") {
    const [width, height] = aspectDimensions(task.aspect, task.resolution);
    return `crop=min(iw\,ih*${width}/${height}):min(ih\,iw*${height}/${width}),scale=${width}:${height}:flags=lanczos,setsar=1${normalizeForConcat ? ",fps=30" : ""}`;
  }
  if (normalizeForConcat) {
    const [width, height] = concatDimensions || landscapeDimensions(task.resolution);
    return `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`;
  }
  if (task.resolution !== "source") return `scale=-2:${task.resolution}:flags=lanczos`;
  return "";
}

function trimPrefix(input: VideoWorkerInput, inputName: string) {
  return ["-ss", input.start.toFixed(3), "-i", inputName, "-t", Math.max(0.05, input.end - input.start).toFixed(3)];
}

function gifFilter(task: Extract<VideoTask, { kind: "gif" }>) {
  return `fps=${task.fps},scale=min(${task.width}\,iw):-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=sierra2_4a`;
}

async function packageOutputs(outputs: Array<{ name: string; bytes: Uint8Array }>, request: VideoWorkerRequest) {
  const warnings = createWarnings(request);
  if (outputs.length === 1) {
    return {
      buffer: outputs[0].bytes.buffer,
      fileName: outputs[0].name,
      mimeType: getMimeType(outputs[0].name),
      warnings,
    } satisfies VideoWorkerResult;
  }
  const zip = new JSZip();
  outputs.forEach((output) => zip.file(output.name, output.bytes));
  const archive = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return {
    buffer: archive.buffer,
    fileName: `worklazy-비디오-결과-${outputs.length}개.zip`,
    mimeType: "application/zip",
    warnings,
  } satisfies VideoWorkerResult;
}

function validateRequest(request: VideoWorkerRequest) {
  if (request.mode !== "batch" || !request.jobs.length) throw new Error("출력할 영상 그룹이 없습니다.");
  for (const job of request.jobs) {
    if (!job.inputs.length) throw new Error(`${job.name} 그룹이 비어 있습니다.`);
    if (job.mode === "individual" && job.inputs.length !== 1) throw new Error("개별 출력 작업에는 영상 하나만 포함할 수 있습니다.");
    job.inputs.forEach(validateInput);
  }
  if (request.task.kind === "encode") {
    if (request.task.container === "webm" && request.task.codec !== "vp9" && request.task.bitrate !== "copy") throw new Error("WebM은 VP9 코덱으로 출력해 주세요.");
    if (request.task.bitrate === "copy" && (request.task.resolution !== "source" || request.task.aspect !== "source")) {
      throw new Error("패스스루는 해상도와 화면 비율을 원본으로 유지할 때만 사용할 수 있습니다.");
    }
  }
}

function validateInput(input: VideoWorkerInput) {
  if (!(input.file instanceof File) || !input.file.size) throw new Error("비디오 파일이 비어 있거나 브라우저의 파일 접근 권한이 해제되었습니다.");
  if (!Number.isFinite(input.duration) || input.duration <= 0) throw new Error("비디오 재생 시간을 확인하지 못했습니다.");
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) throw new Error("비디오 화면 크기를 확인하지 못했습니다.");
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.start < 0 || input.end <= input.start || input.end > input.duration + 0.25) {
    throw new Error("시작 시간과 종료 시간을 다시 확인해 주세요.");
  }
}

async function readBytes(ffmpeg: FFmpeg, outputName: string) {
  const data = await ffmpeg.readFile(outputName);
  if (typeof data === "string") throw new Error("결과 파일이 올바른 바이너리 형식이 아닙니다.");
  return data.slice();
}

function createOutputName(name: string, task: VideoTask, concat: boolean) {
  const base = sanitizeFileName(name.replace(/\.[^.]+$/, "")) || "worklazy-video";
  const suffix = concat ? "이어붙임" : task.kind === "encode" && task.bitrate === "copy" ? "패스스루" : "변환";
  if (task.kind === "gif") return `${base}-${concat ? "이어붙임-" : ""}움짤.gif`;
  if (task.kind === "audio") return `${base}-${concat ? "이어붙임-" : ""}오디오.${task.format === "aac" ? "m4a" : "mp3"}`;
  return `${base}-${suffix}.${task.container}`;
}

function segmentExtension(task: VideoTask) {
  if (task.kind === "gif") return "mp4";
  if (task.kind === "audio") return task.format === "aac" ? "m4a" : "mp3";
  return task.container;
}

function describeTask(task: VideoTask) {
  if (task.kind === "gif") return "GIF 변환";
  if (task.kind === "audio") return `${task.format.toUpperCase()} 음원 추출`;
  return task.bitrate === "copy" ? "재인코딩 없는 패스스루" : `${task.container.toUpperCase()} 인코딩`;
}

function createWarnings(request: VideoWorkerRequest) {
  const warnings = [`그룹 설정에 따라 ${request.jobs.length}개 출력 작업을 처리했습니다.`];
  if (request.task.kind === "encode" && request.task.bitrate === "copy") warnings.push("패스스루 자르기는 키프레임 경계에 따라 시작 시각이 조금 앞당겨질 수 있습니다.");
  if (request.task.kind === "encode" && request.task.codec === "hevc") warnings.push("HEVC는 기기와 플레이어에 따라 재생되지 않을 수 있습니다.");
  return warnings;
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

function outputDimensions(input: VideoWorkerInput, task: Extract<VideoTask, { kind: "encode" }>) {
  if (task.aspect !== "source") return aspectDimensions(task.aspect, task.resolution);
  if (task.resolution === "source") return [even(input.width), even(input.height)] as const;
  const height = Number(task.resolution);
  return [even(height * input.width / input.height), even(height)] as const;
}

function codecName(codec: "h264" | "hevc" | "vp9") {
  return codec === "h264" ? "libx264" : codec === "hevc" ? "libx265" : "libvpx-vp9";
}

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/memory|allocation|out of bounds/i.test(message)) return { message: "브라우저 메모리가 부족합니다. 더 짧은 구간이나 작은 파일 수로 다시 시도해 주세요.", code: "OUT_OF_MEMORY" };
  if (/libx265|encoder.*not found|unknown encoder/i.test(message)) return { message: "현재 브라우저용 인코딩 엔진에서 선택한 코덱을 지원하지 않습니다. H.264 또는 VP9을 선택해 주세요.", code: "CODEC_UNAVAILABLE" };
  return { message: `${message} 입력 형식이나 코덱이 현재 브라우저 엔진에서 지원되지 않을 수 있습니다.`, code: "VIDEO_PROCESSING_ERROR" };
}

function getExtension(name: string) { return name.split(".").pop()?.toLowerCase() || ""; }
function sanitizeExtension(value: string) { return value.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "mp4"; }
function sanitizeFileName(value: string) { return value.trim().replace(/[\\/:*?"<>|]+/g, "-"); }
function getMimeType(name: string) {
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}
function even(value: number) { return Math.max(2, Math.round(value / 2) * 2); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}초`;
  return `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;
}

export {};
