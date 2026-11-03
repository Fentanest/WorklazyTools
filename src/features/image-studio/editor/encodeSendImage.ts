import { hasCanvasTransparency } from '@ascentsparksoftware/react-image-editor';
import type { ImageOutputFormat } from '../types';
/** Native commits are lossless PNG; footer results and Send-to use the chosen raster format. */
export async function encodeSendImage(blob: Blob, format: ImageOutputFormat, onJpegTransparency?: (hasTransparency: boolean) => void): Promise<Blob> {
  if (format === 'png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: format === 'jpeg' && !!onJpegTransparency }); if (!context) throw new Error('export-failed');
    context.drawImage(bitmap,0,0);
    if (format === 'jpeg') {
      onJpegTransparency?.(hasCanvasTransparency(canvas));
      context.globalCompositeOperation = 'destination-over'; context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height);
    }
    const type = `image/${format}`;
    const encoded = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('export-failed')),type,format==='jpeg'?.95:.92));
    if (encoded.type !== type) throw new Error('export-format-unsupported');
    return encoded;
  } finally { bitmap.close(); canvas.width=1; canvas.height=1; }
}
