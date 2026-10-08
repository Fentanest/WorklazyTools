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
      imagePreservedSourceIndexes: request.pages.filter(page => !page.glyphs.length && page.pictures.length).map(page => page.index),
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
    let paragraph = 0;
    const pages = request.imagePages ?? request.pages;
    for (const [pageIndex, page] of pages.entries()) {
      if (pageIndex) {
        paragraph = hwp.getParagraphCount(0);
        hwp.insertParagraph(0, paragraph);
        paragraph = JSON.parse(hwp.insertPageBreak(0, paragraph, hwp.getParagraphLength(0, paragraph))).paraIdx;
      }
      if (request.imagePages) {
        const image = request.imagePages[pageIndex];
        // rhwp's blank A4 section uses 7200 HU/100 pt. Keep a page inset and
        // preserve each source page's aspect ratio, including rotated CropBox.
        const scale = Math.min(480 / image.width, 680 / image.height);
        await insertPicture(hwp, paragraph, image.blob, image.width * scale, image.height * scale,
          image.width, image.height, `PDF page ${image.sourceIndex + 1}`);
        hwp.insertText(0, paragraph, 0, " ");
      } else {
        const model = buildStirlingSlide(request.pages[pageIndex]);
        const text = model.shapes.filter(shape => shape.kind === "text").sort((a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x);
        const pageFit = Math.min(480 / request.pages[pageIndex].width, 680 / request.pages[pageIndex].height);
        let previousBottom = 0;
        for (const [lineIndex, shape] of text.entries()) {
          if (shape.kind !== "text") continue;
          if (lineIndex) { paragraph = hwp.getParagraphCount(0); hwp.insertParagraph(0, paragraph); }
          hwp.insertText(0, paragraph, 0, shape.text);
          hwp.applyCharFormat(0, paragraph, 0, hwp.getParagraphLength(0, paragraph), JSON.stringify({ fontSize: Math.max(600, Math.round(shape.style.size * pageFit * 100)) }));
          hwp.applyParaFormat(0, paragraph, JSON.stringify({ alignment: "left", lineSpacing: 100,
            marginLeft: Math.max(0, Math.round(shape.frame.x * pageFit * 200)),
            spacingBefore: Math.max(0, Math.round((shape.frame.y - previousBottom) * pageFit * 200)) }));
          previousBottom = Math.max(previousBottom, shape.frame.y + shape.frame.height);
        }
        for (const shape of model.shapes) {
          if (shape.kind !== "picture") continue;
          paragraph = hwp.getParagraphCount(0); hwp.insertParagraph(0, paragraph);
          await insertPicture(hwp, paragraph, shape.picture.blob, shape.frame.width * pageFit,
            shape.frame.height * pageFit, shape.frame.width, shape.frame.height, shape.picture.description,
            { x: 50 + shape.frame.x * pageFit, y: 60 + shape.frame.y * pageFit });
          hwp.insertText(0, paragraph, 0, " ");
        }
        if (!text.length && !model.shapes.some(shape => shape.kind === "picture")) hwp.insertText(0, paragraph, 0, " ");
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
