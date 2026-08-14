/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";

import type { AudioClipboardData, AudioProcessorRequest, AudioProcessorResult } from "./types";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const runtimeBaseURL = new URL(`${import.meta.env.BASE_URL}tools/video-studio/runtime/`, worker.location.origin);
const coreURL = new URL("single/ffmpeg-core.js", runtimeBaseURL).href;
const wasmURL = new URL("single/ffmpeg-core.wasm", runtimeBaseURL).href;
const classWorkerURL = new URL("ffmpeg-worker.js", runtimeBaseURL).href;

worker.onmessage = async (event: MessageEvent<AudioProcessorRequest>) => {
  try {
    const request = event.data;
    validateDocument(request);
    progress(5, describeCommand(request.command));
    const result = await processRequest(request);
    const transfer: Transferable[] = [];
    result.channels?.forEach((channel) => transfer.push(channel.buffer));
    result.clipboard?.channels.forEach((channel) => transfer.push(channel.buffer));
    if (result.output) transfer.push(result.output.buffer);
    progress(100, "오디오 작업 완료");
    worker.postMessage({ type: "result", result }, transfer);
  } catch (error) {
    worker.postMessage({ type: "error", error: normalizeError(error) });
  } finally {
    worker.close();
  }
};

async function processRequest(request: AudioProcessorRequest): Promise<AudioProcessorResult> {
  const { document, command } = request;
  if (command === "COPY") {
    const [start, end] = selectionSamples(request);
    const clipboard = createClipboard(document.channels, document.sampleRate, start, end);
    return { clipboard, length: document.length, duration: document.length / document.sampleRate };
  }

  if (command === "EXPORT_WAV" || command === "EXPORT_MP3") {
    progress(18, command === "EXPORT_WAV" ? "WAV 데이터를 인코딩하는 중…" : "MP3 인코딩 입력을 준비하는 중…");
    const wav = encodeWav(document.channels, document.sampleRate);
    if (command === "EXPORT_WAV") {
      const buffer = exactBuffer(wav);
      return {
        length: document.length,
        duration: document.length / document.sampleRate,
        output: { buffer, fileName: request.fileName || "worklazy-audio.wav", mimeType: "audio/wav" },
      };
    }
    return encodeMp3(wav, document.length, document.sampleRate, request.fileName || "worklazy-audio.mp3", request.bitrate || 192);
  }

  if (command === "PREVIEW") {
    progress(35, "파형 재생용 WAV를 만드는 중…");
    const previewBlob = new Blob([encodeWav(document.channels, document.sampleRate)], { type: "audio/wav" });
    return { length: document.length, duration: document.length / document.sampleRate, previewBlob };
  }

  const [start, end] = command === "PASTE" ? [0, 0] : selectionSamples(request);
  let channels: Float32Array[];
  let clipboard: AudioClipboardData | undefined;

  if (command === "MUTE") {
    channels = document.channels.map((channel) => {
      const next = channel.slice();
      next.fill(0, start, end);
      return next;
    });
  } else if (command === "DELETE") {
    channels = document.channels.map((channel) => removeSamples(channel, start, end));
  } else if (command === "CUT") {
    clipboard = createClipboard(document.channels, document.sampleRate, start, end);
    channels = document.channels.map((channel) => removeSamples(channel, start, end));
  } else {
    if (!request.clipboard?.channels.length || request.clipboard.sampleRate !== document.sampleRate) {
      throw new Error("붙여넣을 오디오 클립이 없거나 샘플레이트가 다릅니다.");
    }
    const cursor = clampSample(request.cursor ?? 0, document.length, document.sampleRate);
    channels = document.channels.map((channel, channelIndex) => insertSamples(
      channel,
      request.clipboard?.channels[channelIndex] || request.clipboard?.channels[0],
      cursor,
    ));
  }

  const length = channels[0]?.length || 0;
  if (!length) throw new Error("오디오 전체를 삭제할 수 없습니다. 최소 한 개 이상의 샘플을 남겨 주세요.");
  progress(62, "편집 결과와 파형 미리보기를 만드는 중…");
  const previewBlob = new Blob([encodeWav(channels, document.sampleRate)], { type: "audio/wav" });
  return { channels, clipboard, length, duration: length / document.sampleRate, previewBlob };
}

async function encodeMp3(wav: Uint8Array, length: number, sampleRate: number, fileName: string, bitrate: number): Promise<AudioProcessorResult> {
  const ffmpeg = new FFmpeg();
  const inputName = "worklazy-audio-input.wav";
  const outputName = "worklazy-audio-output.mp3";
  ffmpeg.on("progress", ({ progress: ratio }) => {
    const normalized = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    progress(35 + Math.round(normalized * 55), `MP3로 인코딩하는 중… ${Math.round(normalized * 100)}%`);
  });
  try {
    progress(24, "자체 호스팅 MP3 인코더를 불러오는 중…");
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
    await ffmpeg.writeFile(inputName, wav);
    progress(35, "MP3로 인코딩하는 중…");
    const exitCode = await ffmpeg.exec(["-i", inputName, "-vn", "-c:a", "libmp3lame", "-b:a", `${bitrate}k`, outputName]);
    if (exitCode !== 0) throw new Error("MP3 인코더가 결과를 만들지 못했습니다.");
    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") throw new Error("MP3 결과가 올바른 바이너리 형식이 아닙니다.");
    const output = data.slice();
    return {
      length,
      duration: length / sampleRate,
      output: { buffer: exactBuffer(output), fileName, mimeType: "audio/mpeg" },
    };
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    ffmpeg.terminate();
  }
}

function selectionSamples(request: AudioProcessorRequest) {
  const start = clampSample(request.start ?? 0, request.document.length, request.document.sampleRate);
  const end = clampSample(request.end ?? 0, request.document.length, request.document.sampleRate);
  if (end <= start) throw new Error("파형에서 편집할 구간을 먼저 드래그해 선택해 주세요.");
  return [start, end] as const;
}

function clampSample(seconds: number, length: number, sampleRate: number) {
  return Math.max(0, Math.min(length, Math.round(seconds * sampleRate)));
}

function createClipboard(channels: Float32Array[], sampleRate: number, start: number, end: number): AudioClipboardData {
  const copied = channels.map((channel) => channel.slice(start, end));
  return { channels: copied, sampleRate, length: end - start, duration: (end - start) / sampleRate };
}

function removeSamples(channel: Float32Array, start: number, end: number) {
  const output = new Float32Array(channel.length - (end - start));
  output.set(channel.subarray(0, start));
  output.set(channel.subarray(end), start);
  return output;
}

function insertSamples(channel: Float32Array, clip: Float32Array | undefined, cursor: number) {
  if (!clip) throw new Error("붙여넣을 채널 데이터가 없습니다.");
  const output = new Float32Array(channel.length + clip.length);
  output.set(channel.subarray(0, cursor));
  output.set(clip, cursor);
  output.set(channel.subarray(cursor), cursor + clip.length);
  return output;
}

function encodeWav(channels: Float32Array[], sampleRate: number) {
  const channelCount = channels.length;
  const sampleCount = channels[0]?.length || 0;
  const dataBytes = sampleCount * channelCount * 2;
  if (dataBytes > 0xfffffff0) throw new Error("WAV 4GB 형식 한도를 넘습니다. 오디오 길이를 줄여 주세요.");
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex][sampleIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function exactBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function validateDocument(request: AudioProcessorRequest) {
  const { document } = request;
  if (!document.channels.length || !document.length || !Number.isFinite(document.sampleRate) || document.sampleRate <= 0) throw new Error("처리할 오디오 샘플이 없습니다.");
  if (document.channels.some((channel) => !(channel instanceof Float32Array) || channel.length !== document.length)) throw new Error("오디오 채널 길이가 서로 다릅니다.");
}

function describeCommand(command: AudioProcessorRequest["command"]) {
  return ({
    MUTE: "선택 구간을 음소거하는 중…",
    CUT: "선택 구간을 잘라내는 중…",
    COPY: "선택 구간을 메모리 클립보드에 복사하는 중…",
    PASTE: "재생 커서 위치에 오디오를 붙여넣는 중…",
    DELETE: "선택 구간을 삭제하는 중…",
    PREVIEW: "파형 미리보기를 준비하는 중…",
    EXPORT_WAV: "WAV 내보내기를 준비하는 중…",
    EXPORT_MP3: "MP3 내보내기를 준비하는 중…",
  } satisfies Record<AudioProcessorRequest["command"], string>)[command];
}

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/memory|allocation|out of bounds/i.test(message)) return "브라우저 메모리가 부족합니다. 더 짧은 오디오 파일이나 선택 구간으로 다시 시도해 주세요.";
  if (/decode|codec|format/i.test(message)) return `${message} 브라우저가 이 오디오 코덱을 지원하지 않을 수 있습니다.`;
  return message || "오디오 처리 중 오류가 발생했습니다.";
}

export {};
