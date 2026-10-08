import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfExtractedImage } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import { waitWithAbort } from "../../utils/pdfOwnedDocument";
import { throwIfAborted } from "../../utils/cooperativeCancel";
import { PdfConversionError } from "./pdfConversionErrors";

interface DecodedImage {
  width: number;
  height: number;
  kind?: number;
  bitmap?: ImageBitmap;
  data?: Uint8Array | Uint8ClampedArray;
}

/** Fast integrity check for a conversion that otherwise uses a different PDF
 * engine. PDF.js reports failed JPEG objects as null while rendering can still
 * complete, so render success alone cannot prove all pictures survived. */
export async function validatePdfImageObjects(page: PDFPageProxy, ops: Record<string, number>, signal?: AbortSignal) {
  const list = await waitWithAbort(page.getOperatorList(), signal);
  const seen = new Set<string>();
  for (let index = 0; index < list.fnArray.length; index++) {
    throwIfAborted(signal);
    const operation = list.fnArray[index];
    let decoded: DecodedImage | null;
    if (operation === ops.paintImageXObject || operation === ops.paintImageXObjectRepeat) {
      const id = list.argsArray[index][0] as string;
      if (seen.has(id)) continue;
      seen.add(id);
      decoded = await waitWithAbort(new Promise<DecodedImage | null>(resolve => (id.startsWith("g_") ? page.commonObjs : page.objs).get(id, resolve)), signal);
    } else if (operation === ops.paintInlineImageXObject) decoded = list.argsArray[index][0];
    else continue;
    if (!decoded || !decoded.width || !decoded.height || (!decoded.data && !decoded.bitmap)) throw new PdfConversionError("IMAGE_DECODE", { page: page.pageNumber });
  }
}

/** Extract bitmap assets, not a screenshot of the PDF page. Vector shapes and masks
 * are deliberately not represented as editable drawings. Placement is rebuilt. */
export async function extractPdfImages(page: PDFPageProxy, ops: Record<string, number>, _language: AppLanguage, signal?: AbortSignal): Promise<PdfExtractedImage[]> {
  try {
    const list = await waitWithAbort(page.getOperatorList(), signal);
    const images: PdfExtractedImage[] = [];
    const seen = new Set<string>();
    let pixels = 0;
    for (let index = 0; index < list.fnArray.length; index++) {
      throwIfAborted(signal);
      const operation = list.fnArray[index];
      let decoded: DecodedImage | null;
      if (operation === ops.paintImageXObject || operation === ops.paintImageXObjectRepeat) {
        const id = list.argsArray[index][0] as string;
        if (seen.has(id)) continue;
        seen.add(id);
        const objects = id.startsWith("g_") ? page.commonObjs : page.objs;
        decoded = await waitWithAbort(new Promise<DecodedImage | null>(resolve => objects.get(id, resolve)), signal);
      } else if (operation === ops.paintInlineImageXObject) {
        decoded = list.argsArray[index][0];
      } else continue;
      // PDF.js resolves a failed JPEG decode to null instead of rejecting get().
      // Never present a document missing one of its bitmaps as a normal success.
      if (!decoded) throw new PdfConversionError("IMAGE_DECODE", { page: page.pageNumber });
      pixels += decoded.width * decoded.height;
      if (decoded.width * decoded.height > 12_000_000 || pixels > 24_000_000 || images.length >= 32) {
        throw new PdfConversionError("IMAGE_LIMIT");
      }
      const canvas = document.createElement("canvas");
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      try {
        const context = canvas.getContext("2d");
        if (!context) throw new PdfConversionError("IMAGE_PREPARE", { page: page.pageNumber });
        if (decoded.bitmap) context.drawImage(decoded.bitmap, 0, 0);
        else if (decoded.data) {
          const rgba = context.createImageData(decoded.width, decoded.height);
          for (let pixel = 0; pixel < decoded.width * decoded.height; pixel++) {
            const offset = pixel * 4;
            if (decoded.kind === 3) rgba.data.set(decoded.data.subarray(offset, offset + 4), offset);
            else if (decoded.kind === 2) rgba.data.set([decoded.data[pixel * 3], decoded.data[pixel * 3 + 1], decoded.data[pixel * 3 + 2], 255], offset);
            else if (decoded.kind === 1) {
              const x = pixel % decoded.width, y = Math.floor(pixel / decoded.width);
              const value = decoded.data[y * Math.ceil(decoded.width / 8) + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0;
              rgba.data.set([value, value, value, 255], offset);
            } else throw new PdfConversionError("IMAGE_PREPARE", { page: page.pageNumber });
          }
          context.putImageData(rgba, 0, 0);
        } else throw new PdfConversionError("IMAGE_PREPARE", { page: page.pageNumber });
        images.push({ data: canvas.toDataURL("image/png"), width: decoded.width, height: decoded.height });
      } finally { canvas.width = 1; canvas.height = 1; }
    }
    return images;
  } catch (error) {
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError" || error instanceof PdfConversionError) throw error;
    throw new PdfConversionError("IMAGE_PREPARE", { page: page.pageNumber });
  }
}
