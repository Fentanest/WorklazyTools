import type { AudioDocumentData } from "./types";

export function audioBufferToDocument(buffer: AudioBuffer, sourceName: string): AudioDocumentData {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice());
  return {
    channels,
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    duration: buffer.duration,
    sourceName,
  };
}

export function formatAudioTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(wholeSeconds, 2)}.${pad(milliseconds, 3)}`;
}

export function createAudioFileName(sourceName: string, extension: "wav" | "mp3") {
  const base = sourceName.replace(/\.[^.]+$/, "").trim().replace(/[\\/:*?"<>|]+/g, "-") || "worklazy-audio";
  return `${base}-편집.${extension}`;
}

export function audioHistoryLimit(document: AudioDocumentData) {
  const bytesPerState = document.channels.reduce((sum, channel) => sum + channel.byteLength, 0);
  const memoryBudget = 256 * 1024 * 1024;
  return Math.max(1, Math.min(12, Math.floor(memoryBudget / Math.max(bytesPerState, 1))));
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}
