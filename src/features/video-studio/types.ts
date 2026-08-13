export type VideoContainer = "mp4" | "mkv" | "webm";
export type VideoOutputFormat = VideoContainer | "gif" | "mp3" | "aac";
export type VideoCodec = "h264" | "hevc" | "vp9";
export type VideoResolution = "source" | "1080" | "720" | "480";
export type VideoAspect = "source" | "9:16" | "1:1" | "16:9";
export type VideoBitrate = "copy" | "0" | "2M" | "5M" | "8M";
export type VideoAudioBitrate = "128k" | "192k" | "256k" | "320k";

export type VideoTask =
  | { kind: "gif"; fps: number; width: 480 | 720 | 1080 }
  | { kind: "audio"; format: "mp3" | "aac"; bitrate: VideoAudioBitrate }
  | {
      kind: "encode";
      container: VideoContainer;
      codec: VideoCodec;
      resolution: VideoResolution;
      aspect: VideoAspect;
      crf: number;
      bitrate: VideoBitrate;
    };

export interface VideoWorkerInput {
  fileName: string;
  buffer: ArrayBuffer;
  duration: number;
  width: number;
  height: number;
  start: number;
  end: number;
}

export interface VideoOutputJob {
  name: string;
  mode: "individual" | "concat";
  inputs: VideoWorkerInput[];
}

export interface VideoWorkerRequest {
  mode: "batch";
  jobs: VideoOutputJob[];
  task: VideoTask;
}

export interface VideoWorkerResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  warnings: string[];
}

export type VideoWorkerProgress = (progress: number, message: string) => void;
