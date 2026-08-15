/// <reference lib="webworker" />

import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const runtimeLanguage = worker.location.pathname.match(new RegExp(`^${import.meta.env.BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(ko|en)(?:/|$)`))?.[1];
const runtimeBaseURL = new URL(`${import.meta.env.BASE_URL}${runtimeLanguage ? `${runtimeLanguage}/` : ""}tools/video-studio/runtime/`, worker.location.origin);
const classWorkerURL = new URL("ffmpeg-worker.js", runtimeBaseURL).href;
const coreURL = new URL("single/ffmpeg-core.js", runtimeBaseURL).href;
const wasmURL = new URL("single/ffmpeg-core.wasm", runtimeBaseURL).href;

worker.onmessage = async (event: MessageEvent<{ file: File; language?: "ko" | "en" }>) => {
  const language = event.data.language === "en" ? "en" : "ko";
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const ffmpeg = new FFmpeg();
  const lines: string[] = [];
  const mountPoint = "/worklazy-probe";
  try {
    const file = event.data.file;
    if (!(file instanceof File) || !file.size) throw new Error(L("영상 파일을 읽을 수 없습니다.", "Unable to read the video file."));
    ffmpeg.on("log", ({ message }) => lines.push(message));
    worker.postMessage({ type: "progress", message: L("브라우저 미리보기를 열 수 없어 영상 정보를 직접 확인하는 중…", "Browser preview is unavailable; inspecting video metadata directly…") });
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
    await ffmpeg.createDir(mountPoint);
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "video";
    const sourceName = `source.${extension}`;
    const mounted = await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: sourceName, data: file }] }, mountPoint);
    if (!mounted) throw new Error(L("영상 파일을 분석 엔진에 연결하지 못했습니다.", "Unable to attach the video file to the analysis engine."));
    await ffmpeg.exec(["-hide_banner", "-i", `${mountPoint}/${sourceName}`]);
    const metadata = parseMetadata(lines, language);
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

function parseMetadata(lines: string[], language: "ko" | "en") {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const log = lines.join("\n");
  const durationMatch = log.match(/Duration:\s*(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  const videoLine = lines.find((line) => /Video:/i.test(line) && !/(?:attached pic|cover art)/i.test(line));
  const sizeMatch = videoLine?.match(/(?:^|[^\d])(\d{2,5})x(\d{2,5})(?:[^\d]|$)/);
  if (!durationMatch || !sizeMatch) throw new Error(L("이 영상의 재생 시간과 화면 크기를 확인하지 못했습니다. MP4·MOV·WebM으로 변환한 뒤 다시 시도해 주세요.", "Unable to read this video's duration and dimensions. Convert it to MP4, MOV, or WebM and try again."));
  const duration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  let width = Number(sizeMatch[1]);
  let height = Number(sizeMatch[2]);
  const rotationMatch = log.match(/rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i) || log.match(/rotate\s*:\s*(-?\d+(?:\.\d+)?)/i);
  const rotation = rotationMatch ? ((Math.round(Number(rotationMatch[1]) / 90) * 90) % 360 + 360) % 360 : 0;
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];
  if (!Number.isFinite(duration) || duration <= 0 || !width || !height) throw new Error(L("영상 정보가 올바르지 않습니다.", "The video metadata is invalid."));
  const frameRateMatch = videoLine?.match(/(\d+(?:\.\d+)?)\s*fps/i) || videoLine?.match(/(\d+(?:\.\d+)?)\s*tbr/i);
  const frameRate = frameRateMatch ? Number(frameRateMatch[1]) : 0;
  return { duration, width, height, rotation, frameRate: Number.isFinite(frameRate) ? frameRate : 0 };
}

export {};
