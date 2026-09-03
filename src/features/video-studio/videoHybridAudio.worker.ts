/// <reference lib="webworker" />

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { createHybridAudioFfmpegArguments, estimateHybridAudioBytes, parseHybridAudioBitrate } from "./videoHybridAudio.ts";
import type { VideoTask, VideoWorkerInput } from "./types.ts";

const scope = self as DedicatedWorkerGlobalScope;
const runtimeLanguage = scope.location.pathname.match(new RegExp(`^${import.meta.env.BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(ko|en)(?:/|$)`))?.[1];
const runtimeBaseURL = new URL(`${import.meta.env.BASE_URL}${runtimeLanguage ? `${runtimeLanguage}/` : ""}tools/video-studio/runtime/`, scope.location.origin);
const classWorkerURL = new URL("ffmpeg-worker.js", runtimeBaseURL).href;
const singleCoreURL = new URL("single/ffmpeg-core.js", runtimeBaseURL).href;
const singleWasmURL = new URL("single/ffmpeg-core.wasm", runtimeBaseURL).href;
const multiCoreURL = new URL("multi/ffmpeg-core.js", runtimeBaseURL).href;
const multiWasmURL = new URL("multi/ffmpeg-core.wasm", runtimeBaseURL).href;
const multiWorkerURL = new URL("multi/ffmpeg-core.worker.js", runtimeBaseURL).href;

type InputDescriptor = Omit<VideoWorkerInput, "file"> & { fileId: string };
interface StartRequest {
  job: { inputs: InputDescriptor[] };
  task: Extract<VideoTask, { kind: "encode" }>;
  expectedBytes: number;
}

const pendingFiles = new Map<string, (file: File) => void>();
let ffmpeg: FFmpeg | undefined;
let activeFfmpegWork = false;
let terminated = false;
let cancelRequested = false;
const mountedDirectories: string[] = [];
const temporaryFiles = new Set<string>();

scope.onmessage = (event: MessageEvent) => {
  if (event.data?.type === "input-file") {
    const resolve = pendingFiles.get(event.data.fileId);
    if (resolve && event.data.file instanceof File) {
      pendingFiles.delete(event.data.fileId);
      resolve(event.data.file);
    }
    return;
  }
  if (event.data?.type === "cancel") {
    cancelRequested = true;
    if (activeFfmpegWork && ffmpeg) {
      // Forced cancellation destroys the worker and its filesystem. Never call FS APIs afterward.
      ffmpeg?.terminate();
      terminated = true;
      ffmpeg = undefined;
      activeFfmpegWork = false;
      mountedDirectories.length = 0;
      temporaryFiles.clear();
      scope.postMessage({ type: "canceled", branch: "forced" });
      scope.close();
    } else {
      void cleanupIdle().then(() => {
        scope.postMessage({ type: "canceled", branch: "idle" });
        scope.close();
      });
    }
    return;
  }
  if (event.data?.type === "start") void start(event.data.request as StartRequest);
};

scope.postMessage({ type: "ready" });

async function start(request: StartRequest) {
  const outputName = "hybrid-audio.m4a";
  activeFfmpegWork = true;
  try {
    ffmpeg = await loadFfmpeg();
    const inputNames: string[] = [];
    for (let index = 0; index < request.job.inputs.length; index += 1) {
      throwIfCanceled();
      const input = request.job.inputs[index];
      const file = await requestFile(input.fileId, input.fileName);
      const directory = `/worklazy-hybrid-audio-${index}`;
      const fileName = `input-${index}.${sanitizeExtension(input.fileName)}`;
      await ffmpeg.createDir(directory);
      if (!await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: fileName, data: file }] }, directory)) throw new Error("attach-failed");
      mountedDirectories.push(directory);
      inputNames.push(`${directory}/${fileName}`);
    }
    temporaryFiles.add(outputName);
    ffmpeg.on("progress", ({ progress, time }) => {
      const duration = request.job.inputs.reduce((sum, input) => sum + Math.max(0.05, input.end - input.start), 0);
      const timeRatio = time > 0 ? time / 1_000_000 / duration : 0;
      scope.postMessage({ type: "progress", completedUnits: Math.min(1, Math.max(0, timeRatio || progress || 0)), totalUnits: 1 });
    });
    const exitCode = await ffmpeg.exec(createHybridAudioFfmpegArguments(request.job.inputs, inputNames, request.task, outputName));
    throwIfCanceled();
    if (exitCode !== 0) throw new Error("audio-encode-failed");
    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") throw new Error("invalid-audio-output");
    const buffer = data.slice().buffer;
    const calculatedLimit = estimateHybridAudioBytes(
      parseHybridAudioBitrate(request.task.audioBitrate),
      request.job.inputs.reduce((sum, input) => sum + Math.max(0.05, input.end - input.start), 0),
    );
    if (buffer.byteLength > Math.max(request.expectedBytes, calculatedLimit) + 64 * 1024) throw new Error("audio-output-too-large");
    await cleanupIdle();
    scope.postMessage({ type: "result", buffer }, [buffer]);
  } catch (error) {
    if (!terminated) await cleanupIdle();
    if (!cancelRequested) scope.postMessage({ type: "error" });
  } finally {
    activeFfmpegWork = false;
    scope.close();
  }
}

async function loadFfmpeg() {
  let instance = new FFmpeg();
  if (scope.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined" && scope.navigator.hardwareConcurrency > 1) {
    try {
      await instance.load({ coreURL: multiCoreURL, wasmURL: multiWasmURL, workerURL: multiWorkerURL, classWorkerURL });
      return instance;
    } catch {
      instance.terminate();
      instance = new FFmpeg();
    }
  }
  await instance.load({ coreURL: singleCoreURL, wasmURL: singleWasmURL, classWorkerURL });
  return instance;
}

async function cleanupIdle() {
  const instance = ffmpeg;
  if (!instance || terminated) return;
  for (const name of temporaryFiles) await instance.deleteFile(name).catch(() => undefined);
  temporaryFiles.clear();
  for (const directory of mountedDirectories) {
    await instance.unmount(directory).catch(() => undefined);
    await instance.deleteDir(directory).catch(() => undefined);
  }
  mountedDirectories.length = 0;
  instance.terminate();
  terminated = true;
  ffmpeg = undefined;
}

function requestFile(fileId: string, fileName: string) {
  return new Promise<File>((resolve) => {
    pendingFiles.set(fileId, resolve);
    scope.postMessage({ type: "request-input-file", fileId, fileName });
  });
}

function throwIfCanceled() {
  if (cancelRequested) throw new DOMException("Canceled", "AbortError");
}

function sanitizeExtension(name: string) {
  return name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "mp4";
}

export {};
