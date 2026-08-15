import type { VideoCodec } from "./types";

export function appendVideoRateControl(args: string[], codec: VideoCodec, bitrate: string, crf: number) {
  if (codec === "vp9") {
    args.push("-b:v", bitrate || "0", "-crf", String(crf), "-row-mt", "1");
    return;
  }
  args.push("-preset", "veryfast");
  if (bitrate === "0") {
    args.push("-crf", String(crf));
    return;
  }
  args.push("-b:v", bitrate, "-maxrate", bitrate, "-bufsize", doubleBitrate(bitrate));
}

export function resolveAudioSampleRate(sampleRate: "source" | number, codec: "aac" | "mp3" | "opus") {
  if (sampleRate === "source") return sampleRate;
  if (codec === "opus") return nearest(sampleRate, [8_000, 12_000, 16_000, 24_000, 48_000]);
  if (codec === "mp3") return Math.min(48_000, sampleRate);
  return sampleRate;
}

export function outputDimensionsForSource(
  width: number,
  height: number,
  aspect: "source" | "9:16" | "1:1" | "16:9",
  resolution: "source" | "1080" | "720" | "480",
) {
  const sourceShortSide = Math.min(width, height);
  const shortSide = even(resolution === "source" ? sourceShortSide : Math.min(sourceShortSide, Number(resolution)));
  if (aspect === "9:16") return [shortSide, even(shortSide * 16 / 9)] as const;
  if (aspect === "1:1") return [shortSide, shortSide] as const;
  if (aspect === "16:9") return [even(shortSide * 16 / 9), shortSide] as const;
  if (width <= height) return [shortSide, even(shortSide * height / width)] as const;
  return [even(shortSide * width / height), shortSide] as const;
}

export function even(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function doubleBitrate(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)([kKmM])$/);
  return match ? `${Number(match[1]) * 2}${match[2].toUpperCase()}` : value;
}

function nearest(value: number, candidates: number[]) {
  return candidates.reduce((best, candidate) => Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best);
}
