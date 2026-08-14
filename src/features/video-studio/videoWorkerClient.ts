import type { VideoWorkerOutput, VideoWorkerOutputHandler, VideoWorkerProgress, VideoWorkerRequest, VideoWorkerResult } from "./types";

type VideoWorkerInputDescriptor = Omit<VideoWorkerRequest["jobs"][number]["inputs"][number], "file"> & { fileId: string };
interface VideoWorkerStartRequest {
  mode: "batch";
  jobs: Array<{ name: string; mode: "individual" | "concat"; inputs: VideoWorkerInputDescriptor[] }>;
  task: VideoWorkerRequest["task"];
}

export interface VideoProbeResult {
  duration: number;
  width: number;
  height: number;
}

export function probeVideoMetadata(file: File, signal?: AbortSignal) {
  const worker = new Worker(new URL("./video-probe.worker.ts", import.meta.url), { type: "module" });
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
      reject(new DOMException("영상 정보 확인을 취소했습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") return;
      if (!finish()) return;
      if (event.data.type === "result") resolve(event.data.result as VideoProbeResult);
      else reject(new Error(event.data.error || "영상 정보를 확인하지 못했습니다."));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || "영상 정보 확인을 시작하지 못했습니다."));
    };
    worker.postMessage({ file });
  });
}

export function runVideoTask(
  request: VideoWorkerRequest,
  onProgress?: VideoWorkerProgress,
  onOutput?: VideoWorkerOutputHandler,
  signal?: AbortSignal,
) {
  const worker = new Worker(new URL("./video.worker.ts", import.meta.url), { type: "module" });
  const inputFiles = new Map<string, File>();
  const startRequest: VideoWorkerStartRequest = {
    mode: request.mode,
    task: request.task,
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
      reject(new DOMException("비디오 작업이 취소되었습니다.", "AbortError"));
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
        onProgress?.(1, "비디오 처리 공간 준비 완료 · 작업 목록을 전달하는 중…");
        window.setTimeout(() => {
          if (settled) return;
          try {
            worker.postMessage({ type: "start", request: startRequest });
          } catch (error) {
            if (finish()) reject(error instanceof Error ? error : new Error("비디오 작업 목록을 Worker에 전달하지 못했습니다."));
          }
        }, 0);
        return;
      }
      if (data.type === "request-input-file") {
        const file = data.fileId ? inputFiles.get(data.fileId) : undefined;
        if (!file) {
          if (finish()) reject(new Error(`${data.fileName || "원본 영상"}의 브라우저 파일 참조를 찾지 못했습니다. 파일을 다시 선택해 주세요.`));
          return;
        }
        try {
          worker.postMessage({ type: "input-file", fileId: data.fileId, file });
        } catch (error) {
          if (finish()) reject(error instanceof Error ? error : new Error(`${file.name} 파일 참조를 Worker에 전달하지 못했습니다.`));
        }
        return;
      }
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? "비디오 처리 중…");
        return;
      }
      if (data.type === "output") {
        if (data.output) onOutput?.(data.output);
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoWorkerResult);
      else reject(Object.assign(new Error(data.error?.message || "비디오 처리 중 오류가 발생했습니다."), { code: data.error?.code }));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || "비디오 작업을 시작하지 못했습니다."));
    };
    startupTimer = window.setTimeout(() => {
      if (!finish()) return;
      reject(new Error("비디오 처리 공간이 30초 안에 시작되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."));
    }, 30_000);
  });
}
