import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfExtractedImage } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import { waitWithAbort } from "../../utils/pdfOwnedDocument";
import { throwIfAborted } from "../../utils/cooperativeCancel";

interface DecodedImage {
  width: number;
  height: number;
  kind?: number;
  bitmap?: ImageBitmap;
  data?: Uint8Array | Uint8ClampedArray;
}

/** Extract bitmap assets, not a screenshot of the PDF page. Vector shapes and masks
 * are deliberately not represented as editable drawings. Placement is rebuilt. */
export async function extractPdfImages(page: PDFPageProxy, ops: Record<string, number>, language: AppLanguage, signal?: AbortSignal): Promise<PdfExtractedImage[]> {
  const list = await waitWithAbort(page.getOperatorList(), signal);
  const images: PdfExtractedImage[] = [];
  const seen = new Set<string>();
  let pixels = 0;
  for (let index = 0; index < list.fnArray.length; index++) {
    throwIfAborted(signal);
    const operation = list.fnArray[index];
    let decoded: DecodedImage;
    if (operation === ops.paintImageXObject || operation === ops.paintImageXObjectRepeat) {
      const id = list.argsArray[index][0] as string;
      if (seen.has(id)) continue;
      seen.add(id);
      const objects = id.startsWith("g_") ? page.commonObjs : page.objs;
      decoded = await waitWithAbort(new Promise<DecodedImage>(resolve => objects.get(id, resolve)), signal);
    } else if (operation === ops.paintInlineImageXObject) {
      decoded = list.argsArray[index][0];
    } else continue;
    if (!decoded) continue;
    pixels += decoded.width * decoded.height;
    if (decoded.width * decoded.height > 12_000_000 || pixels > 24_000_000 || images.length >= 32) {
      throw new Error(language === "ko" ? "한 페이지의 이미지가 너무 큽니다. 페이지 범위를 줄이거나 TXT·DOCX로 텍스트를 추출해 주세요." : "A page contains too much image data. Reduce the page range or extract text as TXT / DOCX.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image canvas unavailable");
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
          } else throw new Error("Unsupported decoded PDF image");
        }
        context.putImageData(rgba, 0, 0);
      } else throw new Error("PDF image data unavailable");
      images.push({ data: canvas.toDataURL("image/png"), width: decoded.width, height: decoded.height });
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  return images;
}
