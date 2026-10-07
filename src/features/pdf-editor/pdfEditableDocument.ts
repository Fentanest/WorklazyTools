import type { PdfTextDocument, PdfWorkerResult, WorkerProgress } from "./types";
import PptxGenJS from "pptxgenjs";
import initRhwp, { HwpDocument } from "@rhwp/core";
import rhwpWasmUrl from "@rhwp/core/rhwp_bg.wasm?url";
import type { AppLanguage } from "../../i18n/languages";
import { ensurePdfExtension, pdfBinaryResult } from "./pdfShared";

/** Basic, reflowed documents: text objects and independent bitmap assets.
 * No page screenshot is substituted for editable text. */
export async function createEditableDocument(document: PdfTextDocument, format: "pptx" | "hwpx", name: string, language: AppLanguage, progress: WorkerProgress): Promise<PdfWorkerResult> {
  const warnings = [language === "ko"
    ? "추출한 글자를 편집 가능한 문단·텍스트 상자로, 비트맵 이미지를 별도 개체로 배치했습니다. 원본 배치·표 구조·수식·벡터 도형은 복원하지 않습니다. 긴 내용은 추가 페이지·슬라이드로 이어집니다. 스캔 이미지는 그림이며 OCR 글자는 별도로 편집할 수 있습니다."
    : "Extracted text becomes editable paragraphs / text boxes; bitmap images are separate objects. Original layout, table structure, formulas and vector shapes are not restored. Long content continues on extra pages / slides. Scan images remain pictures; OCR text is separately editable."];
  if (format === "pptx") {
    const presentation = new PptxGenJS();
    presentation.layout = "LAYOUT_4x3";
    presentation.author = "Worklazy Tools";
    presentation.subject = warnings[0];
    presentation.title = document.sourceName;
    const wrapLine = createSlideTextWrapper();
    const lineHeight = 28 / 72; // points to inches; reserve the same height we advance
    for (const [pageIndex, page] of document.pages.entries()) {
      let slide = presentation.addSlide();
      let y = 0.6;
      const nextSlide = () => { slide = presentation.addSlide(); y = 0.6; };
      for (const line of page.lines) {
        // Each box holds exactly one pre-wrapped line, including after reopening.
        const parts = wrapLine(line.text);
        for (const part of parts) {
          if (y + lineHeight > 6.9) nextSlide();
          slide.addText(part, { x: 0.5, y, w: 9, h: lineHeight, fontFace: "Malgun Gothic", fontSize: 14, margin: 0, wrap: false, fit: "none", breakLine: false, valign: "top", color: "222222" });
          y += lineHeight;
        }
        y += 0.08;
      }
      for (const image of page.images ?? []) {
        const ratio = Math.min(9 / image.width, 4.5 / image.height, 1 / 72);
        const width = image.width * ratio, height = image.height * ratio;
        if (y + height > 6.9) nextSlide();
        slide.addImage({ data: image.data, x: 0.5, y, w: width, h: height, altText: `PDF page ${page.pageNumber} bitmap` });
        y += height + 0.2;
      }
      progress(15 + (pageIndex + 1) / document.pages.length * 70, language === "ko" ? "편집 가능한 슬라이드 생성 중" : "Creating editable slides");
    }
    const bytes = await presentation.write({ outputType: "arraybuffer" });
    return pdfBinaryResult(bytes as ArrayBuffer, ensurePdfExtension(name, "pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation", warnings);
  }
  await initRhwp({ module_or_path: rhwpWasmUrl });
  const hwp = HwpDocument.createEmpty();
  try {
    const blank = JSON.parse(hwp.createBlankDocument());
    if (blank.sectionCount !== 1) throw new Error(JSON.stringify(blank));
    let paragraph = 0;
    const style = () => {
      // The official blank template supplies font/style tables; formatting APIs
      // register concrete style references before HWPX serialization.
      // fontSize uses 1/100 pt (1100 = 11 pt), not CSS points.
      hwp.applyCharFormat(0, paragraph, 0, hwp.getParagraphLength(0, paragraph), JSON.stringify({ fontSize: 1100 }));
      hwp.applyParaFormat(0, paragraph, JSON.stringify({ alignment: "left", lineSpacing: 160, lineSpacingType: "Percent" }));
    };
    const appendParagraph = () => { paragraph = hwp.getParagraphCount(0); hwp.insertParagraph(0, paragraph); };
    for (const [pageIndex, page] of document.pages.entries()) {
      if (pageIndex) {
        // Break after the image paragraph; offset 0 would move its object forward.
        appendParagraph();
        paragraph = JSON.parse(hwp.insertPageBreak(0, paragraph, hwp.getParagraphLength(0, paragraph))).paraIdx;
      }
      for (const [lineIndex, line] of page.lines.entries()) {
        if (lineIndex) appendParagraph();
        hwp.insertText(0, paragraph, 0, line.text);
        style();
      }
      for (const image of page.images ?? []) {
        appendParagraph();
        style();
        const bytes = Uint8Array.from(atob(image.data.split(",")[1]), value => value.charCodeAt(0));
        const scale = Math.min(450 / image.width, 360 / image.height, 1);
        const picture = JSON.parse(hwp.insertPicture(0, paragraph, 0, "[]", bytes, Math.round(image.width * scale * 100), Math.round(image.height * scale * 100), image.width, image.height, "png", `PDF page ${page.pageNumber} bitmap`));
        if (!picture.ok) throw new Error(JSON.stringify(picture));
        hwp.setPictureProperties(0, paragraph, picture.controlIdx, JSON.stringify({ treatAsChar: true }));
        // rhwp 0.8.7 omits an inline picture in a completely empty paragraph
        // after HWPX reload. A real space supplies its text-flow anchor.
        hwp.insertText(0, paragraph, 0, " ");
      }
      style();
      progress(15 + (pageIndex + 1) / document.pages.length * 70, language === "ko" ? "편집 가능한 HWPX 생성 중" : "Creating editable HWPX");
    }
    const bytes = hwp.exportHwpx();
    // Validate the same official reader accepts the serialized style references.
    const reopened = new HwpDocument(bytes);
    reopened.free();
    return pdfBinaryResult(bytes, ensurePdfExtension(name, "hwpx"), "application/hwp+zip", warnings);
  } finally { hwp.free(); }
}

function createSlideTextWrapper() {
  const fontSize = 14;
  // Canvas CSS pixels use 96 dpi; slide geometry uses 72 points per inch.
  const context = typeof OffscreenCanvas === "undefined" ? null : new OffscreenCanvas(1, 1).getContext("2d");
  if (context) context.font = `${fontSize * 96 / 72}px "Malgun Gothic", sans-serif`;
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  // Reserve two ems for viewer font substitution. A one-em minimum per grapheme
  // also covers wide Latin / CJK glyphs when the browser measures a narrow font.
  const maxWidth = 9 * 72 - 2 * fontSize;
  return (text: string) => {
    const parts: string[] = [];
    let part = "", width = 0;
    for (const { segment } of segments.segment(text)) {
      if (/^[\r\n]+$/.test(segment)) { parts.push(part); part = ""; width = 0; continue; }
      const advance = Math.max(fontSize, (context?.measureText(segment).width ?? 0) * 72 / 96);
      if (part && width + advance > maxWidth) { parts.push(part); part = ""; width = 0; }
      part += segment; width += advance;
    }
    if (part) parts.push(part);
    return parts;
  };
}
