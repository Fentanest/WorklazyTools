import type { VideoItem } from "./types";

export function hasUsableVideoRange(item: Pick<VideoItem, "duration" | "start" | "end">) {
  return item.duration > 0 && item.end > item.start;
}

export function shouldProbeVideoMetadata(item: Pick<VideoItem, "duration" | "frameRate" | "frameRateProbeStatus">) {
  if (item.frameRateProbeStatus === "running" || item.frameRateProbeStatus === "done" || item.frameRateProbeStatus === "failed") return false;
  return !(Number.isFinite(item.duration) && item.duration > 0 && Number.isFinite(item.frameRate) && (item.frameRate ?? 0) > 0);
}
