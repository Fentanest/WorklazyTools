import type { ImageOutputFormat } from '../types';
/** Commits are PNG; Send-to additionally honors its explicit raster format. */
export async function encodeSendImage(blob: Blob, format: ImageOutputFormat): Promise<Blob> {
  if (format === 'png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  try {
    const context = canvas.getContext('2d'); if (!context) throw new Error('export-failed');
    if (format === 'jpeg') { context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); }
    context.drawImage(bitmap,0,0);
    const type = `image/${format}`;
    const encoded = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('export-failed')),type,format==='jpeg'?.95:.92));
    if (encoded.type !== type) throw new Error('export-failed');
    return encoded;
  } finally { bitmap.close(); canvas.width=1; canvas.height=1; }
}
