import type { PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getPdfWorkerOptions } from "./pdfConfig";
import type { FontInfo, Frame, Glyph, PageData, Picture } from "./stirlingLayout";

class OffscreenCanvasFactory {
  create(width: number, height: number) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("PDF image canvas unavailable");
    return { canvas, context };
  }
  reset(entry: { canvas: OffscreenCanvas }, width: number, height: number) { entry.canvas.width = width; entry.canvas.height = height; }
  destroy(entry: { canvas: OffscreenCanvas | null; context: OffscreenCanvasRenderingContext2D | null }) {
    if (entry.canvas) entry.canvas.width = entry.canvas.height = 1;
    entry.canvas = null; entry.context = null;
  }
}

/** PDF.js replacement for Stirling's PDFBox PageReader/GlyphCollector.
 * A PDF.js viewport applies CropBox, UserUnit and page rotation before all
 * coordinates are passed to the Stirling slide and HWPX writers. */
export async function readStirlingPages(file: File, sourcePageIndexes: readonly number[], progress?: (index: number) => void): Promise<PageData[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const fontSet = (self as unknown as DedicatedWorkerGlobalScope).fonts;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: "",
    ...getPdfWorkerOptions(), isOffscreenCanvasSupported: true, isImageDecoderSupported: false,
    useWorkerFetch: false, disableFontFace: !fontSet,
    ownerDocument: fontSet ? { fonts: fontSet } as unknown as Document : undefined,
    CanvasFactory: OffscreenCanvasFactory });
  try {
    const pdf = await task.promise;
    const pages: PageData[] = [];
    let retainedBytes = 0;
    for (const [index, sourceIndex] of sourcePageIndexes.entries()) {
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= pdf.numPages) throw new Error("Invalid selected PDF page");
      const page = await readStirlingPage(await pdf.getPage(sourceIndex + 1), sourceIndex);
      retainedBytes += page.fallback?.blob.size ?? (page.graphicsBackground?.size ?? 0)
        + page.pictures.reduce((sum, picture) => sum + picture.picture.blob.size, 0);
      // Encoded image bytes expand again in PptxGenJS. Keep an independent
      // document-wide budget in addition to the per-page render pixel limit.
      if (retainedBytes > 96 * 1024 ** 2) throw new Error("Editable document image budget exceeded");
      pages.push(page);
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
    const direction = Math.hypot(a, b) || 1;
    const [rightX, rightY] = viewport.convertToViewportPoint(e + item.width * a / direction, f + item.width * b / direction);
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
  const graphics = await extractPlacedImages(page, viewport);
  const annotationData = await page.getAnnotations({ intent: "display" });
  const annotations = annotationData.length;
  const reasons = [...graphics.unsupported];
  if (annotations) reasons.push("annotations");
  if (page.rotate % 360 !== 0 && (glyphs.length || graphics.imageFrames.length)) reasons.push("page rotation");
  if (graphics.invisibleTextOperators && graphics.imageFrames.length) reasons.push("existing invisible OCR layer");
  if (glyphs.some(glyph => Math.abs(glyph.rotation) > 2)) reasons.push("rotated text");
  if (graphics.imageFrames.some(frame => glyphs.some(glyph => overlaps(frame, {
    x: glyph.x, y: glyph.baseline - glyph.ascent, width: glyph.width, height: glyph.ascent + glyph.descent,
  })))) reasons.push("overlapping text and picture paint order");
  if (graphics.filledAfterTextFrames.some(frame => glyphs.some(glyph => overlaps(frame, {
    x: glyph.x, y: glyph.baseline - glyph.ascent, width: glyph.width, height: glyph.ascent + glyph.descent,
  })))) reasons.push("opaque vector overpaint");
  // Vector table rules and decorations can be flattened into a text-free
  // backdrop while the PDF.js text runs stay editable at source positions.
  const uniqueReasons = [...new Set(reasons)];
  const backgroundGraphics = uniqueReasons.length === 1 && uniqueReasons[0] === "vector artwork or table rules";
  const graphicsBackground = backgroundGraphics ? await renderPageFallback(page, annotationData, true) : undefined;
  if (backgroundGraphics) reasons.length = 0;
  // Image and text item indices come from different PDF.js streams. They can
  // share a slide only if their visible bounds are disjoint.
  const fallback = reasons.length ? { blob: await renderPageFallback(page, annotationData), reason: [...new Set(reasons)].join(", ") } : undefined;
  return { index: sourceIndex, width: viewport.width, height: viewport.height, direction: page.rotate,
    glyphs: fallback ? [] : glyphs, hidden: [],
    rotated: fallback ? [] : glyphs.filter(g => Math.abs(g.rotation) > 2),
    pictures: fallback || graphicsBackground ? [] : graphics.pictures, annotations, fallback, graphicsBackground };
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5
    && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
}

interface DecodedImage { width: number; height: number; kind?: number; bitmap?: ImageBitmap; data?: Uint8Array | Uint8ClampedArray }
type ImagePlacement = { frame: Frame; picture: Picture; order: number };

async function extractPlacedImages(page: PDFPageProxy, viewport: ReturnType<PDFPageProxy["getViewport"]>) {
  const { OPS } = await import("pdfjs-dist");
  const list = await page.getOperatorList();
  const result: ImagePlacement[] = [];
  const imageFrames: Frame[] = [];
  const filledAfterTextFrames: Frame[] = [];
  const stack: number[][] = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let totalPixels = 0;
  let textMode = 0, invisibleTextOperators = 0, visibleTextOperators = 0;
  let visibleTextPainted = false;
  const unsupported = new Set<string>();
  let clipped = false;
  const vectorPaint = new Set([OPS.constructPath, OPS.stroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke,
    OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke, OPS.shadingFill]);
  for (let index = 0; index < list.fnArray.length; index++) {
    const op = list.fnArray[index];
    if (vectorPaint.has(op)) {
      unsupported.add("vector artwork or table rules");
      if (op === OPS.constructPath && visibleTextPainted) {
        const args = list.argsArray[index];
        const paint = args?.[0] as number | undefined;
        const bounds = args?.[2] as ArrayLike<number> | undefined;
        if ((paint === OPS.fill || paint === OPS.eoFill || paint === OPS.fillStroke || paint === OPS.eoFillStroke)
          && bounds?.length === 4 && Array.from(bounds).every(Number.isFinite)) {
          const corners = [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[3]]]
            .map(([u, v]) => viewport.convertToViewportPoint(matrix[0] * u + matrix[2] * v + matrix[4],
              matrix[1] * u + matrix[3] * v + matrix[5]));
          const x = Math.min(...corners.map(point => point[0])), y = Math.min(...corners.map(point => point[1]));
          filledAfterTextFrames.push({ x, y, width: Math.max(0, Math.max(...corners.map(point => point[0])) - x),
            height: Math.max(0, Math.max(...corners.map(point => point[1])) - y), rotation: 0 });
        }
      }
    }
    if (op === OPS.clip || op === OPS.eoClip) clipped = true;
    if (op === OPS.beginGroup || op === OPS.paintImageXObjectRepeat || op === OPS.paintImageMaskXObject
      || op === OPS.paintImageMaskXObjectRepeat || op === OPS.paintInlineImageXObjectGroup
      || op === OPS.paintImageMaskXObjectGroup || op === OPS.paintSolidColorImageMask) unsupported.add("unsupported image or transparency operation");
    if (op === OPS.setTextRenderingMode) { textMode = Number(list.argsArray[index][0]); continue; }
    if (op === OPS.showText || op === OPS.showSpacedText || op === OPS.nextLineShowText || op === OPS.nextLineSetSpacingShowText) {
      if (textMode === 3 || textMode === 7) invisibleTextOperators++;
      else { visibleTextOperators++; visibleTextPainted = true; }
    }
    if (op === OPS.save) { stack.push([...matrix]); continue; }
    if (op === OPS.restore) { matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0]; continue; }
    if (op === OPS.transform) { matrix = multiply(matrix, list.argsArray[index] as number[]); continue; }
    if (op !== OPS.paintImageXObject && op !== OPS.paintInlineImageXObject) continue;
    if (clipped) unsupported.add("clipped image");
    if (Math.abs(matrix[1]) > 0.01 || Math.abs(matrix[2]) > 0.01
      || matrix[0] < -0.01 || matrix[3] < -0.01 || matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0) {
      unsupported.add("rotated or reflected image");
    }
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => {
      const pdfX = matrix[0] * u + matrix[2] * v + matrix[4];
      const pdfY = matrix[1] * u + matrix[3] * v + matrix[5];
      return viewport.convertToViewportPoint(pdfX, pdfY);
    });
    const x = Math.min(...corners.map(p => p[0])), y = Math.min(...corners.map(p => p[1]));
    const width = Math.max(...corners.map(p => p[0])) - x, height = Math.max(...corners.map(p => p[1])) - y;
    if (width >= 0.5 && height >= 0.5) imageFrames.push({ x, y, width, height, rotation: 0 });
    const decoded: DecodedImage | null = op === OPS.paintInlineImageXObject
      ? list.argsArray[index][0]
      : await new Promise(resolve => {
        const id = list.argsArray[index][0] as string;
        (id.startsWith("g_") ? page.commonObjs : page.objs).get(id, resolve);
      });
    if (!decoded) throw new Error(`PDF image decode failed on page ${page.pageNumber}`);
    totalPixels += decoded.width * decoded.height;
    if (decoded.width * decoded.height > 12_000_000 || totalPixels > 24_000_000 || result.length >= 64) {
      unsupported.add("high-resolution image extraction"); continue;
    }
    if (width < 0.5 || height < 0.5) continue;
    if (unsupported.size) continue;
    const blob = await encodeImage(decoded);
    const picture: Picture = { blob, width, height, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0,
      rotation: Math.round(Math.atan2(corners[1][1] - corners[0][1], corners[1][0] - corners[0][0]) * 180 / Math.PI),
      description: `PDF page ${page.pageNumber} image` };
    result.push({ frame: { x, y, width, height, rotation: picture.rotation }, picture, order: index });
  }
  return { pictures: result, imageFrames, filledAfterTextFrames,
    invisibleTextOperators, visibleTextOperators, unsupported: [...unsupported] };
}

async function renderPageFallback(page: PDFPageProxy, annotations: Array<{ annotationType?: number; subtype?: string; rect?: number[] }>, omitText = false): Promise<Blob> {
  const { OPS } = await import("pdfjs-dist");
  const list = omitText ? await page.getOperatorList() : undefined;
  const textOps = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
  const natural = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.sqrt(12_000_000 / (natural.width * natural.height)));
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  try {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("PDF page render canvas unavailable");
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport, background: "#ffffff",
      operationsFilter: list ? index => !textOps.has(list.fnArray[index]) : undefined }).promise;
    await drawAnnotationMarkers(context, viewport, annotations);
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  } finally { canvas.width = 1; canvas.height = 1; }
}

async function drawAnnotationMarkers(context: OffscreenCanvasRenderingContext2D, viewport: ReturnType<PDFPageProxy["getViewport"]>,
  annotations: Array<{ annotationType?: number; subtype?: string; rect?: number[] }>) {
  const notes = annotations.filter(item => item.annotationType === 1 || item.subtype === "Text");
  if (!notes.length) return;
  // Port the rectangles from pdfjs-dist/web/images/annotation-note.svg. PDF.js
  // displays text-note icons in its DOM annotation layer, outside page.render.
  for (const note of notes) {
    if (!note.rect || note.rect.length < 4) continue;
    const [x1, y1] = viewport.convertToViewportPoint(note.rect[0], note.rect[1]);
    const [x2, y2] = viewport.convertToViewportPoint(note.rect[2], note.rect[3]);
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const width = Math.max(12, Math.abs(x2 - x1)), height = Math.max(12, Math.abs(y2 - y1));
    context.save();
    context.fillStyle = "#ffff00";
    context.strokeStyle = "#000000";
    context.lineWidth = Math.max(1, width / 32);
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.fillStyle = "#000000";
    for (const ratio of [0.23, 0.43, 0.63, 0.82]) context.fillRect(x + width * 0.12, y + height * ratio, width * 0.76, Math.max(1, height / 32));
    context.restore();
  }
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
