import type { VideoWorkerOutput, VideoWorkerOutputHandler, VideoWorkerProgress, VideoWorkerRequest, VideoWorkerResult } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import videoProbeWorkerUrl from "./video-probe.worker.ts?worker&url";
import videoProcessorWorkerUrl from "./video.worker.ts?worker&url";
import { localizedVideoWorkerUrl } from "./localizedWorkerUrl";

type VideoWorkerInputDescriptor = Omit<VideoWorkerRequest["jobs"][number]["inputs"][number], "file"> & { fileId: string };
interface VideoWorkerStartRequest {
  mode: "batch";
  jobs: Array<{ name: string; mode: "individual" | "concat"; inputs: VideoWorkerInputDescriptor[] }>;
  task: VideoWorkerRequest["task"];
  language: AppLanguage;
}

export interface VideoProbeResult {
  duration: number;
  width: number;
  height: number;
  rotation?: number;
  frameRate?: number;
}

export function probeVideoMetadata(file: File, signal?: AbortSignal, language: AppLanguage = "ko") {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const worker = new Worker(localizedVideoWorkerUrl(videoProbeWorkerUrl), { type: "module" });
  return new Promise<VideoProbeResult>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException(L("영상 정보 확인을 취소했습니다.", "Video metadata inspection was canceled."), "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") return;
      if (!finish()) return;
      if (event.data.type === "result") resolve(event.data.result as VideoProbeResult);
      else reject(new Error(event.data.error || L("영상 정보를 확인하지 못했습니다.", "Unable to read video metadata.")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || L("영상 정보 확인을 시작하지 못했습니다.", "Unable to start video metadata inspection.")));
    };
    worker.postMessage({ file, language });
  });
}

export function runVideoTask(
  request: VideoWorkerRequest,
  onProgress?: VideoWorkerProgress,
  onOutput?: VideoWorkerOutputHandler,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
) {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const worker = new Worker(localizedVideoWorkerUrl(videoProcessorWorkerUrl), { type: "module" });
  const inputFiles = new Map<string, File>();
  const startRequest: VideoWorkerStartRequest = {
    mode: request.mode,
    task: request.task,
    language,
    jobs: request.jobs.map((job, jobIndex) => ({
      name: job.name,
      mode: job.mode,
      inputs: job.inputs.map(({ file, ...input }, inputIndex) => {
        const fileId = `${jobIndex}-${inputIndex}`;
        inputFiles.set(fileId, file);
        return { ...input, fileId };
      }),
    })),
  };
  return new Promise<VideoWorkerResult>((resolve, reject) => {
    let settled = false;
    let started = false;
    let startupTimer: number | undefined;
    const finish = () => {
      if (settled) return false;
      settled = true;
      if (startupTimer !== undefined) window.clearTimeout(startupTimer);
      signal?.removeEventListener("abort", abort);
      inputFiles.clear();
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException(L("비디오 작업이 취소되었습니다.", "Video processing was canceled."), "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "ready" | "request-input-file" | "progress" | "output" | "result" | "error";
        fileId?: string;
        fileName?: string;
        progress?: number;
        message?: string;
        output?: VideoWorkerOutput;
        result?: VideoWorkerResult;
        error?: { message?: string; code?: string };
      };
      if (data.type === "ready") {
        if (started || settled) return;
        started = true;
        if (startupTimer !== undefined) window.clearTimeout(startupTimer);
        onProgress?.(1, L("비디오 처리 공간 준비 완료 · 작업 목록을 전달하는 중…", "Video workspace ready · sending the job list…"));
        window.setTimeout(() => {
          if (settled) return;
          try {
            worker.postMessage({ type: "start", request: startRequest });
          } catch (error) {
            if (finish()) reject(error instanceof Error ? error : new Error(L("비디오 작업 목록을 Worker에 전달하지 못했습니다.", "Unable to send the video job list to the worker.")));
          }
        }, 0);
        return;
      }
      if (data.type === "request-input-file") {
        const file = data.fileId ? inputFiles.get(data.fileId) : undefined;
        if (!file) {
          if (finish()) reject(new Error(L(`${data.fileName || "원본 영상"}의 브라우저 파일 참조를 찾지 못했습니다. 파일을 다시 선택해 주세요.`, `The browser file reference for ${data.fileName || "the source video"} is unavailable. Select the file again.`)));
          return;
        }
        try {
          worker.postMessage({ type: "input-file", fileId: data.fileId, file });
        } catch (error) {
          if (finish()) reject(error instanceof Error ? error : new Error(L(`${file.name} 파일 참조를 Worker에 전달하지 못했습니다.`, `Unable to send the ${file.name} file reference to the worker.`)));
        }
        return;
      }
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? L("비디오 처리 중…", "Processing video…"));
        return;
      }
      if (data.type === "output") {
        if (data.output) onOutput?.(data.output);
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoWorkerResult);
      else reject(Object.assign(new Error(data.error?.message || L("비디오 처리 중 오류가 발생했습니다.", "An error occurred while processing the video.")), { code: data.error?.code }));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || L("비디오 작업을 시작하지 못했습니다.", "Unable to start video processing.")));
    };
    startupTimer = window.setTimeout(() => {
      if (!finish()) return;
      reject(new Error(L("비디오 처리 공간이 30초 안에 시작되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.", "The video workspace did not start within 30 seconds. Refresh the page and try again.")));
    }, 30_000);
  });
}
