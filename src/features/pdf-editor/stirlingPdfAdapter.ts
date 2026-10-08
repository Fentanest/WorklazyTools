import type { PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getPdfWorkerOptions } from "./pdfConfig";
import type { FontInfo, Frame, Glyph, PageData, Picture } from "./stirlingLayout";

/** PDF.js replacement for Stirling's PDFBox PageReader/GlyphCollector.
 * A PDF.js viewport applies CropBox, UserUnit and page rotation before all
 * coordinates are passed to the Stirling slide and HWPX writers. */
export async function readStirlingPages(file: File, sourcePageIndexes: readonly number[], progress?: (index: number) => void): Promise<PageData[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: "",
    ...getPdfWorkerOptions(), isOffscreenCanvasSupported: true, isImageDecoderSupported: false,
    useWorkerFetch: false, disableFontFace: true });
  try {
    const pdf = await task.promise;
    const pages: PageData[] = [];
    for (const [index, sourceIndex] of sourcePageIndexes.entries()) {
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= pdf.numPages) throw new Error("Invalid selected PDF page");
      pages.push(await readStirlingPage(await pdf.getPage(sourceIndex + 1), sourceIndex));
      progress?.(index);
    }
    return pages;
  } finally { await task.destroy(); }
}

export async function readStirlingPage(page: PDFPageProxy, sourceIndex: number): Promise<PageData> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const glyphs: Glyph[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const [a, b, c, d, e, f] = item.transform.map(Number);
    const [x, baseline] = viewport.convertToViewportPoint(e, f);
    const [rightX, rightY] = viewport.convertToViewportPoint(e + item.width, f);
    const style = content.styles[item.fontName];
    const size = Math.max(1, Math.hypot(a, b));
    const rotation = Math.atan2(rightY - baseline, rightX - x) * 180 / Math.PI;
    const fontFamily = style?.fontFamily || "Arial";
    const font: FontInfo = { family: fontFamily, bold: /bold|black|heavy/i.test(fontFamily),
      italic: /italic|oblique/i.test(fontFamily), serif: /serif|times|batang|명조/i.test(fontFamily), mono: /mono|courier/i.test(fontFamily) };
    const count = Math.max(1, Array.from(item.str).length);
    const width = Math.max(0.1, Math.hypot(rightX - x, rightY - baseline));
    glyphs.push({ text: item.str, x: Math.min(x, rightX), width, baseline,
      size, ascent: Math.max(0.1, (style?.ascent ?? 0.8) * size), descent: Math.max(0.1, Math.abs(style?.descent ?? -0.2) * size),
      font, rgb: 0x222222, seq: glyphs.length, spaceWidth: Math.max(size * 0.25, width / count), invisible: false, rotation });
  }
  const pictures = await extractPlacedImages(page, viewport);
  const annotations = (await page.getAnnotations({ intent: "display" })).length;
  return { index: sourceIndex, width: viewport.width, height: viewport.height, direction: page.rotate,
    glyphs, hidden: [], rotated: glyphs.filter(g => Math.abs(g.rotation) > 2), pictures, annotations };
}

interface DecodedImage { width: number; height: number; kind?: number; bitmap?: ImageBitmap; data?: Uint8Array | Uint8ClampedArray }
type ImagePlacement = { frame: Frame; picture: Picture; order: number };

async function extractPlacedImages(page: PDFPageProxy, viewport: ReturnType<PDFPageProxy["getViewport"]>): Promise<ImagePlacement[]> {
  const { OPS } = await import("pdfjs-dist");
  const list = await page.getOperatorList();
  const result: ImagePlacement[] = [];
  const stack: number[][] = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let totalPixels = 0;
  for (let index = 0; index < list.fnArray.length; index++) {
    const op = list.fnArray[index];
    if (op === OPS.save) { stack.push([...matrix]); continue; }
    if (op === OPS.restore) { matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0]; continue; }
    if (op === OPS.transform) { matrix = multiply(matrix, list.argsArray[index] as number[]); continue; }
    if (op !== OPS.paintImageXObject && op !== OPS.paintInlineImageXObject) continue;
    const decoded: DecodedImage | null = op === OPS.paintInlineImageXObject
      ? list.argsArray[index][0]
      : await new Promise(resolve => {
        const id = list.argsArray[index][0] as string;
        (id.startsWith("g_") ? page.commonObjs : page.objs).get(id, resolve);
      });
    if (!decoded) throw new Error(`PDF image decode failed on page ${page.pageNumber}`);
    totalPixels += decoded.width * decoded.height;
    if (totalPixels > 48_000_000 || result.length >= 64) throw new Error(`PDF page ${page.pageNumber} image budget exceeded`);
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => {
      const pdfX = matrix[0] * u + matrix[2] * v + matrix[4];
      const pdfY = matrix[1] * u + matrix[3] * v + matrix[5];
      return viewport.convertToViewportPoint(pdfX, pdfY);
    });
    const x = Math.min(...corners.map(p => p[0])), y = Math.min(...corners.map(p => p[1]));
    const width = Math.max(...corners.map(p => p[0])) - x, height = Math.max(...corners.map(p => p[1])) - y;
    if (width < 0.5 || height < 0.5) continue;
    const blob = await encodeImage(decoded);
    const picture: Picture = { blob, width, height, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0,
      rotation: Math.round(Math.atan2(corners[1][1] - corners[0][1], corners[1][0] - corners[0][0]) * 180 / Math.PI),
      description: `PDF page ${page.pageNumber} image` };
    result.push({ frame: { x, y, width, height, rotation: picture.rotation }, picture, order: index });
  }
  return result;
}

function multiply(m: number[], n: number[]) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

async function encodeImage(image: DecodedImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.width = image.width; canvas.height = image.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas unavailable");
    if (image.bitmap) context.drawImage(image.bitmap, 0, 0);
    else if (image.data) {
      const rgba = context.createImageData(image.width, image.height);
      for (let pixel = 0; pixel < image.width * image.height; pixel++) {
        const offset = pixel * 4;
        if (image.kind === 3) rgba.data.set(image.data.subarray(offset, offset + 4), offset);
        else if (image.kind === 2) rgba.data.set([image.data[pixel * 3], image.data[pixel * 3 + 1], image.data[pixel * 3 + 2], 255], offset);
        else if (image.kind === 1) {
          const value = image.data[Math.floor(pixel / image.width) * Math.ceil(image.width / 8) + ((pixel % image.width) >> 3)] & (128 >> ((pixel % image.width) & 7)) ? 255 : 0;
          rgba.data.set([value, value, value, 255], offset);
        } else throw new Error("Unsupported PDF image encoding");
      }
      context.putImageData(rgba, 0, 0);
    } else throw new Error("PDF image pixels missing");
    return await canvas.convertToBlob({ type: "image/png" });
  } finally { canvas.width = 1; canvas.height = 1; }
}
