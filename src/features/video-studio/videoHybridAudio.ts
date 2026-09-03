import type { VideoTask, VideoWorkerInput } from "./types.ts";
import { resolveAudioSampleRate } from "./videoEncoding.ts";

export const HYBRID_AUDIO_SIZE_HEADROOM = 1.2;

export function estimateHybridAudioBytes(audioBitrateBps: number, durationSeconds: number) {
  return (audioBitrateBps / 8) * durationSeconds * HYBRID_AUDIO_SIZE_HEADROOM;
}

export function parseHybridAudioBitrate(value: string) {
  const match = /^(\d+)k$/i.exec(value);
  if (!match) throw new Error("Invalid audio bitrate");
  return Number(match[1]) * 1_000;
}

export function createHybridAudioFfmpegArguments(
  inputs: readonly Pick<VideoWorkerInput, "start" | "end">[],
  inputNames: readonly string[],
  task: Extract<VideoTask, { kind: "encode" }>,
  outputName: string,
) {
  if (!inputs.length || inputs.length !== inputNames.length) throw new Error("Invalid audio input list");
  const concat = inputs.length > 1;
  const requestedRate = resolveAudioSampleRate(task.audioSampleRate, "aac");
  const outputRate = requestedRate === "source" ? (concat ? 48_000 : undefined) : requestedRate;
  const args = inputNames.flatMap((name) => ["-i", name]);
  const filters = inputs.map((input, index) => {
    const chain = [
      `atrim=start=${input.start.toFixed(6)}:end=${input.end.toFixed(6)}`,
      "asetpts=PTS-STARTPTS",
    ];
    if (concat) {
      const rate = outputRate || 48_000;
      chain.push(`aresample=${rate}`, `aformat=sample_fmts=fltp:sample_rates=${rate}:channel_layouts=stereo`);
    } else if (outputRate) {
      chain.push(`aresample=${outputRate}`, `aformat=sample_fmts=fltp:sample_rates=${outputRate}`);
    } else {
      chain.push("aresample=async=0:first_pts=0", "aformat=sample_fmts=fltp");
    }
    return `[${index}:a:0]${chain.join(",")}[a${index}]`;
  });
  const outputLabel = concat ? "hybrid-audio" : "a0";
  if (concat) filters.push(`${inputs.map((_, index) => `[a${index}]`).join("")}concat=n=${inputs.length}:v=0:a=1[${outputLabel}]`);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", `[${outputLabel}]`,
    "-vn", "-c:a", "aac", "-b:a", task.audioBitrate,
    "-movflags", "+faststart", outputName,
  );
  return args;
}
