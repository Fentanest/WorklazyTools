/** Small, bounded header inspection; never retain or log EXIF contents. */
export interface ImageMetadata {
  mime: 'image/jpeg' | 'image/png'; width: number; height: number;
  orientation?: number; malformedExif?: boolean; directJpeg: boolean;
}
export type ImageStage = 'read' | 'metadata' | 'decode' | 'thumbnail' | 'orientation' | 'embed' | 'save';
export class ImageInputError extends Error {
  stage: ImageStage;
  constructor(stage: ImageStage, cause: unknown) {
    super(`Image ${stage} failed`, { cause }); this.name = 'ImageInputError'; this.stage = stage;
  }
}
const invalid = () => new ImageInputError('metadata', new Error('Invalid JPEG/PNG header'));
function orientationInExif(bytes: Uint8Array): number | undefined {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  if (!little && !(bytes[0] === 0x4d && bytes[1] === 0x4d)) throw invalid();
  if (v.getUint16(2, little) !== 42) throw invalid();
  const offset = v.getUint32(4, little);
  if (offset < 8 || offset + 2 > bytes.length) throw invalid();
  const count = v.getUint16(offset, little);
  if (offset + 2 + count * 12 + 4 > bytes.length) throw invalid();
  let orientation: number | undefined;
  for (let i = 0; i < count; i++) {
    const at = offset + 2 + i * 12;
    if (v.getUint16(at, little) !== 0x112) continue;
    if (orientation !== undefined || v.getUint16(at + 2, little) !== 3 || v.getUint32(at + 4, little) !== 1) throw invalid();
    orientation = v.getUint16(at + 8, little);
    if (orientation < 1 || orientation > 8) throw invalid();
  }
  return orientation;
}
export function inspectImage(buffer: ArrayBuffer): ImageMetadata {
  const b = new Uint8Array(buffer), v = new DataView(buffer);
  if ([137,80,78,71,13,10,26,10].every((n,i) => b[i] === n)) {
    if (b.length < 33 || v.getUint32(8) !== 13 || v.getUint32(12) !== 0x49484452) throw invalid();
    const width = v.getUint32(16), height = v.getUint32(20);
    if (!width || !height) throw invalid();
    return { mime: 'image/png', width, height, directJpeg: false };
  }
  if (b[0] !== 255 || b[1] !== 216) throw invalid();
  let at = 2, width = 0, height = 0, orientation: number | undefined;
  let malformedExif = false, profile = false, supportedFrame = false, sawExif = false, scanStart = -1;
  while (at < b.length) {
    if (b[at++] !== 255) throw invalid();
    while (b[at] === 255) at++;
    const marker = b[at++];
    if (marker === 217) break;
    if (marker === 216 || marker === 0 || marker === undefined) throw invalid();
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (at + 2 > b.length) throw invalid();
    const length = v.getUint16(at), end = at + length;
    if (length < 2 || end > b.length) throw invalid();
    const start = at + 2;
    if (marker === 225 && b[start] === 69 && b[start+1] === 120 && b[start+2] === 105 && b[start+3] === 102) {
      try {
        if (sawExif || b[start+4] !== 0 || b[start+5] !== 0) throw invalid();
        orientation = orientationInExif(b.subarray(start+6,end));
      } catch { malformedExif = true; }
      sawExif = true;
    }
    // ICC and Adobe colour transforms take the browser's colour-managed path.
    if (marker === 226 || marker === 238) profile = true;
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
      if (length < 8) throw invalid();
      height = v.getUint16(start+1); width = v.getUint16(start+3);
      const components = b[start+5];
      if (length < 8 + 3 * components) throw invalid();
      supportedFrame = [192,194].includes(marker) && b[start] === 8 && [1,3].includes(components);
    }
    if (marker === 218) { scanStart = end; break; }
    at = end;
  }
  if (scanStart < 0) throw invalid();
  let eoi = b.length - 2;
  while (eoi >= scanStart && !(b[eoi] === 255 && b[eoi+1] === 217)) eoi--;
  if (!width || !height || scanStart < 0 || eoi < scanStart) throw invalid();
  // Missing orientation means the stored pixel order (1); uncertain metadata is normalized.
  return { mime: 'image/jpeg', width, height, orientation, malformedExif,
    directJpeg: supportedFrame && !profile && !malformedExif && (orientation === undefined || orientation === 1) };
}
export function checkImageAbort(signal?: AbortSignal) { signal?.throwIfAborted(); }
export async function ownImage(source: File, signal?: AbortSignal) {
  checkImageAbort(signal);
  let buffer: ArrayBuffer;
  try { buffer = await source.arrayBuffer(); } catch (cause) { throw new ImageInputError('read', cause); }
  checkImageAbort(signal);
  const metadata = inspectImage(buffer);
  const file = new File([buffer], source.name, { type: metadata.mime, lastModified: source.lastModified });
  return { file, metadata };
}
