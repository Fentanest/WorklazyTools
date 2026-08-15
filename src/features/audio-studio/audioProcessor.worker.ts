/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";

import { workerMessage } from "../../i18n/workerMessages";
import type { AudioClipboardData, AudioProcessorRequest, AudioProcessorResult, AudioVoiceEffectSettings } from "./types";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const runtimeBaseURL = new URL(`${import.meta.env.BASE_URL}tools/video-studio/runtime/`, worker.location.origin);
const coreURL = new URL("single/ffmpeg-core.js", runtimeBaseURL).href;
const wasmURL = new URL("single/ffmpeg-core.wasm", runtimeBaseURL).href;
const classWorkerURL = new URL("ffmpeg-worker.js", runtimeBaseURL).href;
let currentRequestId = "";
let sharedFfmpeg: FFmpeg | undefined;
let ffmpegLoadPromise: Promise<FFmpeg> | undefined;

worker.onmessage = async (event: MessageEvent<AudioProcessorRequest & { requestId?: string }>) => {
  try {
    const request = event.data;
    currentRequestId = request.requestId || "";
    validateDocument(request);
    progressKey(5, commandProgressKey(request.command));
    const result = await processRequest(request);
    const transfer: Transferable[] = [];
    result.channels?.forEach((channel) => transfer.push(channel.buffer));
    result.clipboard?.channels.forEach((channel) => transfer.push(channel.buffer));
    if (result.output) transfer.push(result.output.buffer);
    progress(100, message("done"));
    worker.postMessage({ type: "result", requestId: currentRequestId, result }, transfer);
  } catch (error) {
    worker.postMessage({ type: "error", requestId: currentRequestId, error: normalizeError(error) });
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
    progress(18, message(command === "EXPORT_WAV" ? "encodeWav" : "prepareMp3"));
    const exportChannels = request.exportSelection
      ? (() => { const [start, end] = selectionSamples(request); return document.channels.map((channel) => channel.slice(start, end)); })()
      : document.channels;
    const exportLength = exportChannels[0]?.length || 0;
    const wav = encodeWav(exportChannels, document.sampleRate);
    if (command === "EXPORT_WAV") {
      return {
        length: exportLength,
        duration: exportLength / document.sampleRate,
        output: { buffer: wav.buffer, fileName: request.fileName || "worklazy-audio.wav", mimeType: "audio/wav" },
      };
    }
    return encodeMp3(wav, exportLength, document.sampleRate, request.fileName || "worklazy-audio.mp3", request.bitrate || 192, exportChannels.length);
  }

  if (command === "PREVIEW") {
    progress(35, message("previewWav"));
    const previewBlob = new Blob([encodeWav(document.channels, document.sampleRate)], { type: "audio/wav" });
    return { length: document.length, duration: document.length / document.sampleRate, previewBlob };
  }

  if (command === "PREVIEW_VOICE_EFFECT" || command === "APPLY_VOICE_EFFECT") {
    const [start, end] = selectionSamples(request);
    if (!request.voiceEffect) throw new Error(message("voiceSettings"));
    const selectedChannels = document.channels.map((channel) => channel.slice(start, end));
    const effectedChannels = await createVoiceEffect(selectedChannels, document.sampleRate, request.voiceEffect);
    if (command === "PREVIEW_VOICE_EFFECT") {
      progress(86, message("voicePreview"));
      return {
        length: end - start,
        duration: (end - start) / document.sampleRate,
        previewBlob: new Blob([encodeWav(effectedChannels, document.sampleRate)], { type: "audio/wav" }),
      };
    }
    progress(82, message("voiceBlend"));
    const channels = document.channels.map((channel, channelIndex) => replaceWithCrossfade(
      channel,
      effectedChannels[channelIndex] || effectedChannels[0],
      start,
      end,
      document.sampleRate,
    ));
    const previewBlob = new Blob([encodeWav(channels, document.sampleRate)], { type: "audio/wav" });
    return { channels, length: document.length, duration: document.length / document.sampleRate, previewBlob };
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
  } else if (command === "PASTE") {
    if (!request.clipboard?.channels.length || request.clipboard.sampleRate !== document.sampleRate) {
      throw new Error(message("clipboardMismatch"));
    }
    const cursor = clampSample(request.cursor ?? 0, document.length, document.sampleRate);
    channels = document.channels.map((channel, channelIndex) => insertSamples(
      channel,
      request.clipboard?.channels[channelIndex] || request.clipboard?.channels[0],
      cursor,
    ));
  } else if (command === "TRIM") {
    channels = document.channels.map((channel) => channel.slice(start, end));
  } else if (command === "FADE_IN" || command === "FADE_OUT") {
    channels = document.channels.map((channel) => applyGainRamp(channel, start, end, command === "FADE_IN"));
  } else if (command === "GAIN") {
    const gain = Number.isFinite(request.gain) ? Math.max(0, Math.min(4, request.gain || 0)) : 1;
    channels = document.channels.map((channel) => applyGain(channel, start, end, gain));
  } else if (command === "NORMALIZE") {
    let peak = 0;
    document.channels.forEach((channel) => { for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(channel[index] || 0)); });
    const gain = peak > 0 ? Math.min(16, 0.98 / peak) : 1;
    channels = document.channels.map((channel) => applyGain(channel, start, end, gain));
  } else {
    throw new Error(message("unsupportedCommand"));
  }

  const length = channels[0]?.length || 0;
  if (!length) throw new Error(message("deleteAll"));
  progress(62, message("editPreview"));
  const previewBlob = new Blob([encodeWav(channels, document.sampleRate)], { type: "audio/wav" });
  return { channels, clipboard, length, duration: length / document.sampleRate, previewBlob };
}

async function createVoiceEffect(channels: Float32Array[], sampleRate: number, effect: AudioVoiceEffectSettings) {
  if (effect.mode === "robot") {
    progress(35, message("robot"));
    return channels.map((channel) => applyRobotEffect(channel, sampleRate));
  }
  const semitones = Math.max(-12, Math.min(12, Number.isFinite(effect.semitones) ? effect.semitones : 0));
  if (Math.abs(semitones) < 0.01) return channels.map((channel) => channel.slice());
  return pitchShiftWithFfmpeg(channels, sampleRate, semitones);
}

async function pitchShiftWithFfmpeg(channels: Float32Array[], sampleRate: number, semitones: number) {
  const ffmpeg = await getFfmpeg();
  const inputName = "worklazy-voice-input.f32le";
  const outputName = "worklazy-voice-output.f32le";
  const ratio = 2 ** (semitones / 12);
  const shiftedRate = Math.max(1, Math.round(sampleRate * ratio));
  const tempo = 1 / ratio;
  try {
    await ffmpeg.writeFile(inputName, interleaveFloat32(channels));
    const filter = `asetrate=${shiftedRate},aresample=${sampleRate},atempo=${tempo.toFixed(8)}`;
    const exitCode = await ffmpeg.exec([
      "-f", "f32le", "-ar", String(sampleRate), "-ac", String(channels.length), "-i", inputName,
      "-af", filter,
      "-ac", String(channels.length),
      "-ar", String(sampleRate),
      "-c:a", "pcm_f32le",
      "-f", "f32le",
      outputName,
    ]);
    if (exitCode !== 0) throw new Error(message("pitchFailed"));
    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") throw new Error(message("pitchBinary"));
    const decoded = decodeInterleavedFloat32(data, channels.length);
    return decoded.map((channel) => fitChannelLength(channel, channels[0].length));
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}

function decodeInterleavedFloat32(bytes: Uint8Array, channelCount: number) {
  const frameCount = Math.floor(bytes.byteLength / 4 / channelCount);
  if (!frameCount) throw new Error(message("emptyVoice"));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
  const view = new DataView(bytes.buffer, bytes.byteOffset, frameCount * channelCount * 4);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      channels[channel][frame] = view.getFloat32((frame * channelCount + channel) * 4, true);
    }
  }
  return channels;
}

function fitChannelLength(channel: Float32Array, targetLength: number) {
  if (channel.length === targetLength) return channel;
  const output = new Float32Array(targetLength);
  if (channel.length === 1) {
    output.fill(channel[0]);
    return output;
  }
  const scale = (channel.length - 1) / Math.max(1, targetLength - 1);
  for (let index = 0; index < targetLength; index += 1) {
    const position = index * scale;
    const left = Math.floor(position);
    const right = Math.min(channel.length - 1, left + 1);
    const fraction = position - left;
    output[index] = channel[left] * (1 - fraction) + channel[right] * fraction;
  }
  return output;
}

function applyRobotEffect(channel: Float32Array, sampleRate: number) {
  const output = new Float32Array(channel.length);
  const carrierHz = 55;
  for (let index = 0; index < channel.length; index += 1) {
    const carrier = Math.sin(2 * Math.PI * carrierHz * index / sampleRate);
    output[index] = Math.max(-1, Math.min(1, channel[index] * (0.18 + carrier * 0.82)));
  }
  return output;
}

function replaceWithCrossfade(source: Float32Array, effect: Float32Array, start: number, end: number, sampleRate: number) {
  const output = source.slice();
  const length = end - start;
  const fadeLength = Math.min(Math.round(sampleRate * 0.01), Math.floor(length / 2));
  for (let index = 0; index < length; index += 1) {
    let wet = 1;
    if (fadeLength > 0 && index < fadeLength) wet = index / fadeLength;
    if (fadeLength > 0 && index >= length - fadeLength) wet = Math.min(wet, (length - 1 - index) / fadeLength);
    output[start + index] = source[start + index] * (1 - Math.max(0, wet)) + (effect[index] || 0) * Math.max(0, wet);
  }
  return output;
}

async function encodeMp3(wav: Uint8Array, length: number, sampleRate: number, fileName: string, bitrate: number, channelCount: number): Promise<AudioProcessorResult> {
  const ffmpeg = await getFfmpeg();
  const inputName = "worklazy-audio-input.wav";
  const outputName = "worklazy-audio-output.mp3";
  try {
    await ffmpeg.writeFile(inputName, wav);
    progress(35, message("encodeMp3"));
    const exitCode = await ffmpeg.exec(["-i", inputName, "-vn", "-ac", String(Math.min(2, channelCount)), "-c:a", "libmp3lame", "-b:a", `${bitrate}k`, outputName]);
    if (exitCode !== 0) throw new Error(message("mp3Failed"));
    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") throw new Error(message("mp3Binary"));
    const output = data.slice();
    return {
      length,
      duration: length / sampleRate,
      output: { buffer: exactBuffer(output), fileName, mimeType: "audio/mpeg" },
    };
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}

function getFfmpeg() {
  if (sharedFfmpeg) return Promise.resolve(sharedFfmpeg);
  if (!ffmpegLoadPromise) {
    progress(18, message("loadingEngine"));
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress: ratio }) => {
      const normalized = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
      progress(35 + Math.round(normalized * 45), message("converting", { percent: Math.round(normalized * 100) }));
    });
    ffmpegLoadPromise = ffmpeg.load({ coreURL, wasmURL, classWorkerURL }).then(() => {
      sharedFfmpeg = ffmpeg;
      return ffmpeg;
    }).catch((error) => {
      ffmpeg.terminate();
      ffmpegLoadPromise = undefined;
      throw error;
    });
  }
  return ffmpegLoadPromise;
}

function selectionSamples(request: AudioProcessorRequest) {
  const start = clampSample(request.start ?? 0, request.document.length, request.document.sampleRate);
  const end = clampSample(request.end ?? 0, request.document.length, request.document.sampleRate);
  if (end <= start) throw new Error(message("selectRegion"));
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
  if (!clip) throw new Error(message("missingPasteChannels"));
  const output = new Float32Array(channel.length + clip.length);
  output.set(channel.subarray(0, cursor));
  output.set(clip, cursor);
  output.set(channel.subarray(cursor), cursor + clip.length);
  return output;
}

function applyGain(channel: Float32Array, start: number, end: number, gain: number) {
  const output = channel.slice();
  for (let index = start; index < end; index += 1) output[index] = Math.max(-1, Math.min(1, output[index] * gain));
  return output;
}

function applyGainRamp(channel: Float32Array, start: number, end: number, fadeIn: boolean) {
  const output = channel.slice();
  const denominator = Math.max(1, end - start - 1);
  for (let index = start; index < end; index += 1) {
    const ratio = (index - start) / denominator;
    output[index] *= fadeIn ? ratio : 1 - ratio;
  }
  return output;
}

function interleaveFloat32(channels: Float32Array[]) {
  const frameCount = channels[0]?.length || 0;
  const interleaved = new Float32Array(frameCount * channels.length);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) interleaved[frame * channels.length + channel] = channels[channel][frame] || 0;
  }
  return new Uint8Array(interleaved.buffer);
}

function encodeWav(channels: Float32Array[], sampleRate: number) {
  const channelCount = channels.length;
  const sampleCount = channels[0]?.length || 0;
  const dataBytes = sampleCount * channelCount * 2;
  if (dataBytes > 0xffffffff - 44) throw new Error(message("wavLimit"));
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
  if (!document.channels.length || !document.length || !Number.isFinite(document.sampleRate) || document.sampleRate <= 0) throw new Error(message("noSamples"));
  if (document.channels.some((channel) => !(channel instanceof Float32Array) || channel.length !== document.length)) throw new Error(message("channelMismatch"));
}

function commandProgressKey(command: AudioProcessorRequest["command"]) {
  if (command === "PREVIEW_VOICE_EFFECT") return "audio.voice.status.previewing";
  if (command === "APPLY_VOICE_EFFECT") return "audio.voice.status.applying";
  if (command === "EXPORT_WAV" || command === "EXPORT_MP3") return "audio.status.exportPrepare";
  return `audio.edit.${command}`;
}

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", requestId: currentRequestId, progress: Math.round(value), message });
}

function progressKey(value: number, messageKey: string) {
  worker.postMessage({ type: "progress", requestId: currentRequestId, progress: Math.round(value), messageKey });
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/memory|allocation|out of bounds/i.test(message)) return workerMessage(undefined, "audio.worker.memory");
  if (/decode|codec|format/i.test(message)) return workerMessage(undefined, "audio.worker.codec", { error: message });
  return message || workerMessage(undefined, "audio.worker.generic");
}

function message(key: string, values: Record<string, unknown> = {}) {
  return workerMessage(undefined, `audio.worker.${key}`, values);
}

export {};
