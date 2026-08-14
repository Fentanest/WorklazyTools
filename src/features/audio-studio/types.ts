export interface AudioDocumentData {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
  duration: number;
  sourceName: string;
}

export interface AudioClipboardData {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
  duration: number;
}

export type AudioEditCommand = "MUTE" | "CUT" | "COPY" | "PASTE" | "DELETE" | "PREVIEW";
export type AudioExportCommand = "EXPORT_WAV" | "EXPORT_MP3";

export interface AudioProcessorRequest {
  language?: "ko" | "en";
  command: AudioEditCommand | AudioExportCommand;
  document: Pick<AudioDocumentData, "channels" | "sampleRate" | "length">;
  start?: number;
  end?: number;
  cursor?: number;
  clipboard?: AudioClipboardData;
  fileName?: string;
  bitrate?: 128 | 192 | 256 | 320;
}

export interface AudioProcessorResult {
  channels?: Float32Array[];
  clipboard?: AudioClipboardData;
  length: number;
  duration: number;
  previewBlob?: Blob;
  output?: {
    buffer: ArrayBuffer;
    fileName: string;
    mimeType: string;
  };
}

export type AudioProcessorProgress = (progress: number, message: string) => void;
