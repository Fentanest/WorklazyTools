/// <reference lib="webworker" />

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import classWorkerURL from "@ffmpeg/ffmpeg/worker?worker&url";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<{ file: File }>) => {
  const ffmpeg = new FFmpeg();
  const lines: string[] = [];
  const mountPoint = "/worklazy-probe";
  try {
    const file = event.data.file;
    if (!(file instanceof File) || !file.size) throw new Error("영상 파일을 읽을 수 없습니다.");
    ffmpeg.on("log", ({ message }) => lines.push(message));
    worker.postMessage({ type: "progress", message: "브라우저 미리보기를 열 수 없어 영상 정보를 직접 확인하는 중…" });
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
    await ffmpeg.createDir(mountPoint);
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "video";
    const sourceName = `source.${extension}`;
    const mounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: sourceName, data: file }] }, mountPoint);
    if (!mounted) throw new Error("영상 파일을 분석 엔진에 연결하지 못했습니다.");
    await ffmpeg.exec(["-hide_banner", "-i", `${mountPoint}/${sourceName}`]);
    const metadata = parseMetadata(lines);
    worker.postMessage({ type: "result", result: metadata });
  } catch (error) {
    worker.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  } finally {
    await ffmpeg.unmount(mountPoint).catch(() => undefined);
    await ffmpeg.deleteDir(mountPoint).catch(() => undefined);
    ffmpeg.terminate();
    worker.close();
  }
};

function parseMetadata(lines: string[]) {
  const log = lines.join("\n");
  const durationMatch = log.match(/Duration:\s*(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  const videoLine = lines.find((line) => /Video:/i.test(line));
  const sizeMatch = videoLine?.match(/(?:^|[^\d])(\d{2,5})x(\d{2,5})(?:[^\d]|$)/);
  if (!durationMatch || !sizeMatch) throw new Error("이 영상의 재생 시간과 화면 크기를 확인하지 못했습니다. MP4·MOV·WebM으로 변환한 뒤 다시 시도해 주세요.");
  const duration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  const width = Number(sizeMatch[1]);
  const height = Number(sizeMatch[2]);
  if (!Number.isFinite(duration) || duration <= 0 || !width || !height) throw new Error("영상 정보가 올바르지 않습니다.");
  return { duration, width, height };
}

export {};
