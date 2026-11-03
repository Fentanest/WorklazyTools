export type ImageOutputFormat = "png" | "jpeg" | "webp";
export type WatermarkPosition = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";

export interface ImageWorkerInput {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

/** Encoded output shared with the ZIP; never a preview or a re-encode. */
export interface BatchImageResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ImageWorkerResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  warnings: string[];
  images?: BatchImageResult[];
}

export interface BatchImageOptions {
  mode: "fit-width" | "contain" | "cover" | "original";
  width: number;
  height: number;
  format: ImageOutputFormat;
  quality: number;
  background: string;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkOpacity: number;
  watermarkImage?: ImageWorkerInput;
}

export interface CollageOptions {
  layout: "vertical" | "horizontal" | "grid";
  columns: number;
  width: number;
  gap: number;
  background: string;
  format: ImageOutputFormat;
  quality: number;
}

export interface GifOptions {
  width: number;
  delay: number;
  delays?: number[];
  qualityColors: number;
}

export type ImageWorkerProgress = (progress: number, message: string) => void;

export type ImageWorkerRequest =
  | { type: "batch"; inputs: ImageWorkerInput[]; options: BatchImageOptions; archiveName: string; language?: string }
  | { type: "collage"; inputs: ImageWorkerInput[]; options: CollageOptions; fileName: string; language?: string }
  | { type: "gif"; inputs: ImageWorkerInput[]; options: GifOptions; fileName: string; language?: string };

export type ImageWorkerResponse =
  | { type: "progress"; progress: number; message: string }
  | { type: "result"; result: ImageWorkerResult }
  | { type: "error"; error: { code: string; message?: string } };
