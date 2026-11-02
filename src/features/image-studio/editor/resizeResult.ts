import type { PixelSize } from './d6Policy';
/** Resize only the flattened PNG supplied by the fork's forced-raster commit. */
export async function resizeResult(blob: Blob, target?: PixelSize): Promise<Blob> {
  if (!target) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width === target.width && bitmap.height === target.height) return blob;
    const canvas = document.createElement('canvas'); canvas.width = target.width; canvas.height = target.height;
    try {
      const context = canvas.getContext('2d'); if (!context) throw new Error('export-failed');
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('export-failed')), 'image/png'));
    } finally { canvas.width = 1; canvas.height = 1; }
  } finally { bitmap.close(); }
}
