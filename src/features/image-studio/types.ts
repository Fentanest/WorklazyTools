export type ImageOutputFormat = "png" | "jpeg" | "webp";
export type WatermarkPosition = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";

export interface ImageWorkerInput {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

export interface ImageWorkerResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  warnings: string[];
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
  qualityColors: number;
}

export type ImageWorkerProgress = (progress: number, message: string) => void;

