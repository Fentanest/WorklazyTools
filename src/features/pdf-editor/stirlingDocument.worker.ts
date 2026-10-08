/// <reference lib="webworker" />
import PptxGenJS from "pptxgenjs";
import initRhwp, { HwpDocument } from "@rhwp/core";
import rhwpWasmUrl from "@rhwp/core/rhwp_bg.wasm?url";
import { stirlingPageFit } from "./stirlingPageFit";
import { buildStirlingSlide, type PageData, type SlideShape } from "./stirlingLayout";
import { readStirlingPages } from "./stirlingPdfAdapter";

type ImagePage = { sourceIndex: number; blob: Blob; width: number; height: number };
type Request = { id: number; format: "pptx" | "hwpx"; name: string; language: "ko" | "en";
  pages: PageData[]; imagePages?: ImagePage[]; source?: File; sourcePageIndexes?: number[] };
const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.source && request.sourcePageIndexes) {
      request.pages = await readStirlingPages(request.source, request.sourcePageIndexes,
        index => progress(request.id, 5 + 40 * (index + 1) / request.sourcePageIndexes!.length));
    }
    const bytes = request.format === "pptx" ? await writePptx(request) : await writeHwpx(request);
    worker.postMessage({ id: request.id, type: "result", buffer: bytes,
      imagePreservedSourceIndexes: request.pages.filter(page => page.fallback || !page.glyphs.length && (page.pictures.length || page.graphicsBackground)).map(page => page.index),
      pageFallbacks: request.pages.filter(page => page.fallback).map(page => ({ sourceIndex: page.index, reason: page.fallback!.reason })),
      graphicsFlattenedSourceIndexes: request.pages.filter(page => page.graphicsBackground).map(page => page.index),
      hasAnnotations: request.pages.some(page => page.annotations > 0) }, [bytes]);
  } catch (error) {
    worker.postMessage({ id: request.id, type: "error", message: error instanceof Error ? error.stack || error.message : String(error) });
  }
};

function progress(id: number, value: number) { worker.postMessage({ id, type: "progress", value }); }

async function writePptx(request: Request): Promise<ArrayBuffer> {
  const pages = request.imagePages ?? request.pages.map(page => ({ sourceIndex: page.index, width: page.width, height: page.height, blob: new Blob() }));
  const slideWidth = Math.max(...pages.map(page => page.width));
  const slideHeight = Math.max(...pages.map(page => page.height));
  if (!Number.isFinite(slideWidth) || !Number.isFinite(slideHeight) || slideWidth <= 0 || slideHeight <= 0) throw new Error("Invalid PDF page geometry");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PdfStirling", width: slideWidth / 72, height: slideHeight / 72 });
  pptx.layout = "PdfStirling";
  pptx.author = "Worklazy Tools";
  pptx.title = request.name;
  for (const [index, page] of pages.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const fit = stirlingPageFit(page, slideWidth, slideHeight);
    if (request.imagePages) {
      const data = await blobDataUrl(page.blob);
      slide.addImage({ data, x: fit.dx / 72, y: fit.dy / 72, w: page.width * fit.scale / 72,
        h: page.height * fit.scale / 72, altText: `PDF page ${page.sourceIndex + 1}` });
    } else {
      const model = buildStirlingSlide(request.pages[index]);
      for (const shape of model.shapes) await addShape(slide, shape, fit);
    }
    progress(request.id, 50 + (index + 1) / pages.length * 40);
  }
  const output = await pptx.write({ outputType: "arraybuffer" });
  return output as ArrayBuffer;
}

async function addShape(slide: ReturnType<PptxGenJS["addSlide"]>, shape: SlideShape, fit: ReturnType<typeof stirlingPageFit>) {
  const frame = shape.frame;
  const x = (fit.dx + frame.x * fit.scale) / 72, y = (fit.dy + frame.y * fit.scale) / 72;
  const w = Math.max(0.02, frame.width * fit.scale / 72), h = Math.max(0.02, frame.height * fit.scale / 72);
  if (shape.kind === "text") {
    slide.addText(shape.text, { x, y, w: w + 0.08, h: h + 0.03, fontFace: shape.style.font,
      fontSize: shape.style.size * fit.scale, bold: shape.style.bold, italic: shape.style.italic,
      color: shape.style.rgb.toString(16).padStart(6, "0"), margin: 0, breakLine: false,
      fit: "none", wrap: false, valign: "middle", rotate: Math.round(frame.rotation) });
  } else {
    slide.addImage({ data: await blobDataUrl(shape.picture.blob), x, y, w, h,
      altText: shape.picture.description });
  }
}

let rhwpReady: Promise<unknown> | undefined;
async function writeHwpx(request: Request): Promise<ArrayBuffer> {
  rhwpReady ??= initRhwp({ module_or_path: rhwpWasmUrl });
  await rhwpReady;
  const hwp = HwpDocument.createEmpty();
  try {
    const blank = JSON.parse(hwp.createBlankDocument());
    if (blank.sectionCount !== 1) throw new Error("HWPX blank document failed");
    const pages = request.imagePages ?? request.pages;
    const paperWidth = Math.max(...pages.map(page => page.width));
    const paperHeight = Math.max(...pages.map(page => page.height));
    const margin = 18;
    const pageDef = JSON.parse(hwp.setPageDef(0, JSON.stringify({ width: Math.round(paperWidth * 100),
      height: Math.round(paperHeight * 100), marginLeft: margin * 100, marginRight: margin * 100,
      marginTop: margin * 100, marginBottom: margin * 100, marginHeader: 0, marginFooter: 0, marginGutter: 0 })));
    if (!pageDef.ok) throw new Error("HWPX page geometry failed");
    let paragraph = 0;
    for (const [pageIndex, page] of pages.entries()) {
      if (pageIndex) {
        paragraph = hwp.getParagraphCount(0);
        hwp.insertParagraph(0, paragraph);
        paragraph = JSON.parse(hwp.insertPageBreak(0, paragraph, hwp.getParagraphLength(0, paragraph))).paraIdx;
      }
      const pageStartParagraph = paragraph;
      if (request.imagePages || "fallback" in page && page.fallback) {
        const fallbackPage = page as PageData;
        const image = request.imagePages?.[pageIndex] ?? { sourceIndex: fallbackPage.index,
          blob: fallbackPage.fallback!.blob, width: fallbackPage.width, height: fallbackPage.height };
        const scale = Math.min((paperWidth - 2 * margin) / image.width,
          (paperHeight - 2 * margin - 36) / image.height);
        await insertPicture(hwp, paragraph, image.blob, image.width * scale, image.height * scale,
          image.width, image.height, `PDF page ${image.sourceIndex + 1}`);
        hwp.insertText(0, paragraph, 0, " ");
      } else {
        const model = buildStirlingSlide(request.pages[pageIndex]);
        const text = model.shapes.filter(shape => shape.kind === "text").sort((a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x);
        const pageFit = Math.min((paperWidth - 2 * margin) / request.pages[pageIndex].width,
          (paperHeight - 2 * margin - 36) / request.pages[pageIndex].height);
        const background = request.pages[pageIndex].graphicsBackground;
        if (background) {
          await insertPicture(hwp, pageStartParagraph, background, request.pages[pageIndex].width * pageFit,
            request.pages[pageIndex].height * pageFit, request.pages[pageIndex].width,
            request.pages[pageIndex].height, `PDF page ${request.pages[pageIndex].index + 1} graphics`, { x: margin, y: margin });
        }
        for (const shape of text) {
          if (shape.kind !== "text") continue;
          const left = margin + shape.frame.x * pageFit - 3;
          const top = margin + shape.frame.y * pageFit - 3;
          const fontPoints = shape.style.size * pageFit;
          const textAdvance = Array.from(shape.text).reduce((sum, char) => sum + fontPoints * (/[^\u0000-\u024f]/u.test(char) ? 1 : 0.68), 0);
          const textWidth = Math.min(paperWidth - margin - left,
            Math.max(shape.frame.width * pageFit + 12, textAdvance + 12));
          const textbox = JSON.parse(hwp.createShapeControl(JSON.stringify({ sectionIdx: 0,
            paraIdx: pageStartParagraph, charOffset: 0, shapeType: "textbox", treatAsChar: false,
            textWrap: "InFrontOfText", width: Math.max(800, Math.round(textWidth * 100)),
            height: Math.max(800, Math.round(Math.max(shape.frame.height * pageFit + 12, fontPoints * 1.6 + 8) * 100)),
            horzOffset: Math.max(0, Math.round(left * 100)), vertOffset: Math.max(0, Math.round(top * 100)) })));
          if (!textbox.ok) throw new Error("HWPX text box insertion failed");
          const shapeResult = JSON.parse(hwp.setShapeProperties(0, pageStartParagraph, textbox.controlIdx,
            JSON.stringify({ fillType: "none", fillAlpha: 255, lineType: 0, borderWidth: 0 })));
          if (!shapeResult.ok) throw new Error("HWPX text box style failed");
          const inserted = JSON.parse(hwp.insertTextInCell(0, pageStartParagraph, textbox.controlIdx, 0, 0, 0, shape.text));
          if (!inserted.ok) throw new Error("HWPX text box content failed");
          hwp.applyCharFormatInCell(0, pageStartParagraph, textbox.controlIdx, 0, 0, 0,
            Array.from(shape.text).length, JSON.stringify({ fontSize: Math.max(600, Math.round(shape.style.size * pageFit * 100)) }));
        }
        for (const shape of model.shapes) {
          if (shape.kind !== "picture") continue;
          await insertPicture(hwp, pageStartParagraph, shape.picture.blob, shape.frame.width * pageFit,
            shape.frame.height * pageFit, shape.frame.width, shape.frame.height, shape.picture.description,
            { x: margin + shape.frame.x * pageFit, y: margin + shape.frame.y * pageFit });
        }
        hwp.insertText(0, pageStartParagraph, 0, " ");
      }
      progress(request.id, 50 + (pageIndex + 1) / pages.length * 40);
    }
    const bytes = hwp.exportHwpx();
    const reopened = new HwpDocument(bytes);
    const pageCount = reopened.pageCount();
    reopened.free();
    if (pageCount < pages.length) throw new Error(`HWPX omitted a source page (${pageCount}/${pages.length})`);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } finally { hwp.free(); }
}

async function insertPicture(hwp: HwpDocument, paragraph: number, blob: Blob, width: number, height: number,
  naturalWidth: number, naturalHeight: number, description: string, position?: { x: number; y: number }) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = JSON.parse(hwp.insertPicture(0, paragraph, 0, "[]", bytes,
    Math.max(1, Math.round(width * 100)), Math.max(1, Math.round(height * 100)),
    Math.max(1, Math.round(naturalWidth)), Math.max(1, Math.round(naturalHeight)),
    blob.type === "image/jpeg" ? "jpg" : "png", description));
  if (!result.ok) throw new Error("HWPX picture insertion failed");
  const properties = position ? { treatAsChar: false, textWrap: "BehindText", allowOverlap: true,
    vertRelTo: "Paper", horzRelTo: "Paper", vertAlign: "Top", horzAlign: "Left",
    horzOffset: Math.round(position.x * 100), vertOffset: Math.round(position.y * 100) } : { treatAsChar: true };
  const placed = JSON.parse(hwp.setPictureProperties(0, paragraph, result.controlIdx, JSON.stringify(properties)));
  if (!placed.ok) throw new Error("HWPX picture placement failed");
}

async function blobDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}
