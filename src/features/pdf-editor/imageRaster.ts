import { checkImageAbort, ImageInputError, type ImageMetadata } from './imageInput.ts';

// A module-wide queue also serializes a canceled, non-abortable decode with its retry.
let rasterTail: Promise<unknown> = Promise.resolve();
export function rasterImage(file: File, metadata: ImageMetadata, thumbnail: boolean, signal?: AbortSignal): Promise<Blob> {
  const run = rasterTail.catch(() => {}).then(async () => {
    checkImageAbort(signal);
    let bitmap: ImageBitmap | undefined, image: HTMLImageElement | undefined;
    let url = '', canvas: HTMLCanvasElement | undefined;
    let stage: 'decode' | 'thumbnail' | 'orientation' = 'decode';
    try {
      const swapped = (metadata.orientation ?? 1) >= 5;
      const w = swapped ? metadata.height : metadata.width, h = swapped ? metadata.width : metadata.height;
      const scale = thumbnail ? Math.min(1, 400 / Math.max(w,h)) : 1;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image', ...(thumbnail ? {
          resizeWidth: Math.max(1,Math.round(w*scale)), resizeHeight: Math.max(1,Math.round(h*scale)), resizeQuality: 'high' as const,
        } : {}) });
      } catch {
        checkImageAbort(signal);
        image = new Image(); url = URL.createObjectURL(file); image.src = url;
        await image.decode();
      }
      checkImageAbort(signal);
      const source = bitmap ?? image!;
      const width = bitmap?.width ?? image!.naturalWidth, height = bitmap?.height ?? image!.naturalHeight;
      if (!width || !height) throw new Error('Empty decoded image');
      stage = thumbnail ? 'thumbnail' : 'orientation';
      const finalScale = thumbnail ? Math.min(1, 400 / Math.max(width,height)) : 1;
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(width*finalScale)); canvas.height = Math.max(1,Math.round(height*finalScale));
      const context = canvas.getContext('2d', { alpha: metadata.mime === 'image/png' });
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve,reject) => canvas!.toBlob(
        value => value ? resolve(value) : reject(new Error('Image encoding failed')),
        metadata.mime, thumbnail ? 0.82 : 0.96,
      ));
      checkImageAbort(signal);
      return blob;
    } catch (cause) {
      checkImageAbort(signal);
      throw new ImageInputError(stage, cause);
    } finally {
      bitmap?.close();
      if (image) { image.onload = null; image.onerror = null; image.removeAttribute('src'); }
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (url) URL.revokeObjectURL(url);
    }
  });
  rasterTail = run.then(() => {}, () => {});
  return run;
}
