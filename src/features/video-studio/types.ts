export type VideoContainer = "mp4" | "mkv" | "webm";
export type VideoOutputFormat = VideoContainer | "gif" | "mp3" | "aac";
export type VideoCodec = "h264" | "hevc" | "vp9";
export type VideoResolution = "source" | "1080" | "720" | "480";
export type VideoAspect = "source" | "9:16" | "1:1" | "16:9";
export type VideoBitrate = "copy" | "0" | "2M" | "5M" | "8M" | "custom";
export type VideoAudioMode = "copy" | "remove" | "encode";
export type VideoAudioBitrate = "128k" | "192k" | "256k" | "320k" | "custom";
export type VideoAudioSampleRate = "source" | "44100" | "48000" | "custom";
export type ResolvedAudioSampleRate = "source" | number;
export type VideoRotation = 0 | 90 | 180 | 270;
export type VideoGroupId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type GroupOutputMode = "individual" | "concat";
export type VideoFrameRateProbeStatus = "running" | "done" | "failed";

export interface VideoItem {
  id: string;
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
  start: number;
  end: number;
  group: VideoGroupId;
  metadataSource?: "browser" | "ffmpeg";
  metadataError?: string;
  probing?: boolean;
  frameRate?: number;
  frameRateProbeStatus?: VideoFrameRateProbeStatus;
}

export interface VideoGroupSettings {
  sync: boolean;
  outputMode: GroupOutputMode;
  audioItemId?: string;
}

export const VIDEO_GROUP_IDS: VideoGroupId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MAX_VIDEO_GROUP = VIDEO_GROUP_IDS[VIDEO_GROUP_IDS.length - 1];

export type VideoTask =
  | { kind: "gif"; fps: number; width: 480 | 720 | 1080 }
  | {
      kind: "audio";
      format: "mp3" | "aac";
      bitrate: string;
      sampleRate: ResolvedAudioSampleRate;
    }
  | {
      kind: "encode";
      container: VideoContainer;
      codec: VideoCodec;
      resolution: VideoResolution;
      aspect: VideoAspect;
      crf: number;
      bitrate: string;
      audioMode: VideoAudioMode;
      audioBitrate: string;
      audioSampleRate: ResolvedAudioSampleRate;
      rotation: VideoRotation;
      flipHorizontal: boolean;
    };

export interface VideoWorkerInput {
  fileName: string;
  file: File;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  frameRate?: number;
  start: number;
  end: number;
}

export interface VideoOutputJob {
  name: string;
  mode: "individual" | "concat";
  inputs: VideoWorkerInput[];
  /** Selects an audio rescue mode for this job without changing the rest of a batch. */
  audioModeOverride?: "remove" | "encode";
}

export interface VideoWorkerRequest {
  mode: "batch";
  jobs: VideoOutputJob[];
  task: VideoTask;
  resultStorage?: VideoResultStorageSession;
}

export interface VideoResultStorageSession {
  mode: "memory" | "opfs";
  rootDirectoryName: string;
  sessionDirectoryName: string;
  sessionId: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
}

export interface VideoOpfsResultReference {
  kind: "opfs";
  rootDirectoryName: string;
  sessionDirectoryName: string;
  sessionId: string;
  ownerId: string;
  entryName: string;
}

export type VideoResultData =
  | { kind: "buffer"; buffer: ArrayBuffer }
  | { kind: "file"; file: File }
  | VideoOpfsResultReference;

export interface VideoWorkerOutput {
  data: VideoResultData;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface VideoWorkerResult {
  outputCount: number;
  warnings: string[];
}

export type VideoWorkerProgress = (progress: number, message: string, stageKey?: string) => void;
export type VideoWorkerOutputHandler = (output: VideoWorkerOutput) => void | Promise<void>;
