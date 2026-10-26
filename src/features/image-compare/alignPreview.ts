import { inspectImageHeader } from "./input.ts";
import type { Size } from "./manualAlign.ts";
import { IMAGE_LIMITS } from "./types.ts";

/** Previews for the on-screen alignment editor are reduced to this longest side; geometry stays in original pixels. */
export const ALIGN_PREVIEW_SIDE = 1600;
export interface AlignPreview { size: Size; canvas: HTMLCanvasElement; bytes: number }
export interface AlignPreviews { left: AlignPreview; right: AlignPreview }

/** Bytes a preview load may hold at its peak: the browser decode and resize (8 bytes per source pixel) plus the
 * kept canvas. Checked against the shared budget with everything else the page keeps. */
export function alignPreviewPeakBytes(width: number, height: number) {
  const scale = Math.min(1, ALIGN_PREVIEW_SIDE / Math.max(width, height));
  return width * height * 8 + Math.max(1, Math.round(width * scale)) * Math.max(1, Math.round(height * scale)) * 4;
}
/** The original's header is validated (type, file size, dimensions) before any decode, the decode must fit beside
 * retained work, and only a reduced canvas is kept. */
export async function loadAlignPreview(file: File, retainedBytes: number): Promise<AlignPreview> {
  const buffer = await file.arrayBuffer(), meta = inspectImageHeader(file.name, buffer);
  const swap = meta.exifOrientation >= 5, width = swap ? meta.height : meta.width, height = swap ? meta.width : meta.height;
  const scale = Math.min(1, ALIGN_PREVIEW_SIDE / Math.max(width, height)), previewWidth = Math.max(1, Math.round(width * scale)), previewHeight = Math.max(1, Math.round(height * scale));
  if (alignPreviewPeakBytes(width, height) + retainedBytes > IMAGE_LIMITS.memoryBytes) throw new Error("IMAGE_MEMORY_LIMIT");
  const bitmap = await createImageBitmap(new Blob([buffer], { type: meta.mime }), { imageOrientation: "from-image", resizeWidth: previewWidth, resizeHeight: previewHeight, resizeQuality: "medium" });
  try {
    const canvas = document.createElement("canvas"); canvas.width = previewWidth; canvas.height = previewHeight;
    const context = canvas.getContext("2d"); if (!context) { canvas.width = 0; throw new Error("IMAGE_DECODE_FAILED"); }
    context.drawImage(bitmap, 0, 0); return { size: { width, height }, canvas, bytes: previewWidth * previewHeight * 4 };
  } finally { bitmap.close(); }
}
export function releaseAlignPreview(preview: AlignPreview | undefined) { if (preview) { preview.canvas.width = 0; preview.canvas.height = 0; preview.canvas.remove(); } }
export const alignPreviewErrorKey = (error: unknown) => { const code = error instanceof Error ? error.message : ""; return code === "IMAGE_FILE_LIMIT" ? "fileLimit" : code === "IMAGE_SIZE_LIMIT" ? "dimensionLimit" : code === "IMAGE_MEMORY_LIMIT" ? "memoryLimit" : "manual.previewFailed"; };
