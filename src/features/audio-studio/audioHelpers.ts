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

export function createAudioFileName(sourceName: string, extension: "wav" | "mp3", suffix: string) {
  const base = sourceName.replace(/\.[^.]+$/, "").trim().replace(/[\\/:*?"<>|]+/g, "-") || "worklazy-audio";
  return `${base}-${suffix}.${extension}`;
}

export function audioHistoryLimit(document: AudioDocumentData) {
  const bytesPerState = document.channels.reduce((sum, channel) => sum + channel.byteLength, 0);
  // Undo and redo share this document budget; each stack must not independently
  // reserve the full 256 MB.
  const memoryBudget = 128 * 1024 * 1024;
  return Math.max(1, Math.min(12, Math.floor(memoryBudget / Math.max(bytesPerState, 1))));
}

export function sniffAudioSampleRate(bytes: ArrayBuffer, fileName = "") {
  const view = new DataView(bytes);
  if (view.byteLength >= 28 && ascii(view, 0, 4) === "RIFF" && ascii(view, 8, 4) === "WAVE") {
    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const id = ascii(view, offset, 4);
      const length = view.getUint32(offset + 4, true);
      if (id === "fmt " && length >= 16 && offset + 16 <= view.byteLength) return validSampleRate(view.getUint32(offset + 12, true));
      offset += 8 + length + (length % 2);
    }
  }

  if (/\.mp3$/i.test(fileName) || looksLikeMp3(view)) {
    let offset = id3Size(view);
    while (offset + 4 <= view.byteLength) {
      const header = view.getUint32(offset, false);
      if ((header >>> 21) === 0x7ff) {
        const versionBits = (header >>> 19) & 0b11;
        const layerBits = (header >>> 17) & 0b11;
        const sampleIndex = (header >>> 10) & 0b11;
        if (versionBits !== 0b01 && layerBits !== 0 && sampleIndex < 3) {
          const rates = versionBits === 0b11 ? [44_100, 48_000, 32_000] : versionBits === 0b10 ? [22_050, 24_000, 16_000] : [11_025, 12_000, 8_000];
          return rates[sampleIndex];
        }
      }
      offset += 1;
    }
  }
  return undefined;
}

function ascii(view: DataView, offset: number, length: number) {
  if (offset + length > view.byteLength) return "";
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
}

function validSampleRate(value: number) {
  return Number.isInteger(value) && value >= 3_000 && value <= 384_000 ? value : undefined;
}

function looksLikeMp3(view: DataView) {
  return view.byteLength >= 3 && (ascii(view, 0, 3) === "ID3" || (view.getUint16(0, false) & 0xffe0) === 0xffe0);
}

function id3Size(view: DataView) {
  if (view.byteLength < 10 || ascii(view, 0, 3) !== "ID3") return 0;
  return 10 + ((view.getUint8(6) & 0x7f) << 21) + ((view.getUint8(7) & 0x7f) << 14) + ((view.getUint8(8) & 0x7f) << 7) + (view.getUint8(9) & 0x7f);
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}
