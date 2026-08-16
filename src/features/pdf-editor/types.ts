export type PdfToolMode = "organize" | "image-to-pdf" | "pdf-to-image" | "convert";

export interface PdfSourceFile {
  id: string;
  file: File;
  pageCount: number;
}

export interface PdfPageItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourcePageIndex: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface PdfWorkerInput {
  id: string;
  name: string;
  mimeType?: string;
  buffer: ArrayBuffer;
}

export interface PdfPagePlan {
  sourceId: string;
  pageIndex: number;
  rotation: number;
}

export interface PdfOutputOptions {
  watermarkText?: string;
  pageNumbers?: boolean;
  imagesAlreadyNormalized?: boolean;
}

export interface PdfTextCell {
  text: string;
  x: number;
}

export interface PdfTextLine {
  text: string;
  cells: PdfTextCell[];
}

export interface PdfTextPage {
  pageNumber: number;
  lines: PdfTextLine[];
}

export interface PdfTextDocument {
  sourceName: string;
  pages: PdfTextPage[];
  characterCount: number;
}

export interface PdfWorkerResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  warnings: string[];
}

export type WorkerProgress = (progress: number, message: string) => void;

export function createLocalId(prefix: string) {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return `${prefix}-${randomUuid.call(globalThis.crypto)}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
