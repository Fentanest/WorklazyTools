import type { PdfWorkerResult } from "./types";

export function movePdfItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function normalizePdfRotation(value: number): 0 | 90 | 180 | 270 {
  return (((value % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

export function pdfBinaryResult(bytes: Uint8Array | ArrayBuffer, fileName: string, mimeType: string, warnings: string[]): PdfWorkerResult {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { buffer, fileName, mimeType, warnings };
}

export function ensurePdfExtension(name: string, extension: string) {
  const base = name.trim().replace(/\.[^.]+$/, "") || "worklazy-result";
  return `${base}.${extension}`;
}

export function sanitizePdfFileName(name: string, fallback: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-") || fallback;
}
