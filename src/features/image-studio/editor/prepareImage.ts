import type { PixelSize } from './d6Policy';
export interface PreparedImage { file: File; original: PixelSize; decoded: PixelSize }
/** Normalize orientation and measure the actual import, including the bounded resample. */
export async function prepareImage(file: File, maxEdge: number): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const original = { width: bitmap.width, height: bitmap.height };
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return { file, original, decoded: original };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('load-failed');
      context.imageSmoothingQuality = 'high'; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const decoded = { width: canvas.width, height: canvas.height };
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('load-failed')), 'image/png'));
      return { file: new File([blob], file.name, { type: 'image/png' }), original, decoded };
    } finally { canvas.width = 1; canvas.height = 1; }
  } finally { bitmap.close(); }
}
