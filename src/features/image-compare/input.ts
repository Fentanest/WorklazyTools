import { IMAGE_LIMITS, type ImageMetadata } from "./types.ts";
import { validateDimensions } from "./geometry.ts";

/** Header validation bounds decompression before a bitmap allocation. PNG/JPEG/WebP only. */
export function inspectImageHeader(name: string, buffer: ArrayBuffer): ImageMetadata {
  if (!buffer.byteLength || buffer.byteLength > IMAGE_LIMITS.fileBytes) throw new Error("IMAGE_FILE_LIMIT");
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let width = 0, height = 0, bitDepth = 8, exifOrientation = 1, mime = "";
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) && view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452) {
    width = view.getUint32(16); height = view.getUint32(20); bitDepth = bytes[24]; mime = "image/png";
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mime = "image/jpeg";
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1]; if (marker === 0xda || marker === 0xd9) break;
      const length = view.getUint16(offset + 2); if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) { bitDepth = bytes[offset + 4]; height = view.getUint16(offset + 5); width = view.getUint16(offset + 7); }
      if (marker === 0xe1 && length >= 16 && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10, end = offset + length + 2, little = view.getUint16(tiff) === 0x4949;
        if (tiff + 8 <= end && view.getUint16(tiff + 2, little) === 42) {
          const directory = tiff + view.getUint32(tiff + 4, little);
          if (directory >= tiff && directory + 2 <= end) for (let i = 0, count = Math.min(view.getUint16(directory, little), 1024); i < count; i++) {
            const entry = directory + 2 + i * 12; if (entry + 12 > end) break;
            if (view.getUint16(entry, little) === 0x0112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) exifOrientation = view.getUint16(entry + 8, little);
          }
        }
      }
      offset += length + 2;
    }
  } else if (bytes.length >= 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    mime = "image/webp";
    const tag = view.getUint32(12);
    if (tag === 0x56503858) { width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536; height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536; }
    else if (tag === 0x56503820 && view.getUint32(23) >>> 8 === 0x9d012a) { width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff; }
    else if (tag === 0x5650384c && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; }
  }
  if (!mime || !width || !height || exifOrientation < 1 || exifOrientation > 8) throw new Error("IMAGE_FORMAT_UNSUPPORTED");
  validateDimensions(width, height);
  return { name, bytes: buffer.byteLength, mime, width, height, bitDepth, exifOrientation, decodeOrientation: "from-image", workingColorSpace: "8-bit sRGB" };
}
