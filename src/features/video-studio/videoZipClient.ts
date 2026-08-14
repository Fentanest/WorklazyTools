import type { VideoWorkerProgress } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import videoZipWorkerUrl from "./video-zip.worker.ts?worker&url";

export interface VideoZipSource {
  fileName: string;
  blob: Blob;
}

export interface VideoZipResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

function localizedWorkerUrl(source: URL) {
  const language = window.location.pathname.match(/^\/(ko|en)(?:\/|$)/)?.[1];
  if (language && source.pathname.includes("/tools/video-studio/workers/") && !source.pathname.includes(`/${language}/tools/video-studio/workers/`)) {
    source.pathname = source.pathname.replace("/tools/video-studio/workers/", `/${language}/tools/video-studio/workers/`);
  }
  return source;
}

export function createVideoZip(files: VideoZipSource[], onProgress?: VideoWorkerProgress, signal?: AbortSignal, language: AppLanguage = "ko") {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const worker = new Worker(localizedWorkerUrl(new URL(videoZipWorkerUrl, window.location.origin)), { type: "module" });
  return new Promise<VideoZipResult>((resolve, reject) => {
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
      reject(new DOMException(L("ZIP 만들기를 취소했습니다.", "ZIP creation was canceled."), "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "progress" | "result" | "error";
        progress?: number;
        message?: string;
        result?: VideoZipResult;
        error?: string;
      };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? L("ZIP 파일 만드는 중…", "Creating ZIP file…"));
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoZipResult);
      else reject(new Error(data.error || L("ZIP 파일을 만들지 못했습니다.", "Unable to create the ZIP file.")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || L("ZIP Worker를 시작하지 못했습니다.", "Unable to start the ZIP worker.")));
    };
    worker.postMessage({ files, language });
  });
}
