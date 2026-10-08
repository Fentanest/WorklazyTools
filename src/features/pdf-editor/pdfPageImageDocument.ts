import type { AppLanguage } from "../../i18n/languages";
import { renderPdfPageForDocument } from "./pdfPreview";
import type { WorkerProgress } from "./types";
import { ensurePdfExtension } from "./pdfShared";
import { convertPageImagesWithBento } from "./bentoPdfClient";
import { convertStirlingImagePages } from "./stirlingDocumentClient";

type Format = "docx" | "pptx" | "hwpx";
interface ImagePage { sourceIndex: number; blob: Blob; width: number; height: number }
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwpx: "application/hwp+zip",
};

export async function createPageImageDocument(file: File, pageIndexes: number[], format: Format, name: string, language: AppLanguage, progress?: WorkerProgress, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string; mimeType: string; warnings: string[] }> {
  const pages: ImagePage[] = [];
  let bytes = 0;
  for (const [index, sourceIndex] of pageIndexes.entries()) {
    if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    const rendered = await renderPdfPageForDocument(file, sourceIndex, language, signal);
    bytes += rendered.blob.size;
    if (bytes > 128 * 1024 ** 2) throw new Error("BATCH_IMAGE_LIMIT");
    pages.push({ sourceIndex, ...rendered });
    progress?.(5 + 70 * (index + 1) / pageIndexes.length, language === "ko" ? "PDF 페이지 모양을 저장하는 중" : "Preserving PDF page appearance");
  }
  if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  if (format === "docx") {
    const converted = await convertPageImagesWithBento(pages, signal, value => progress?.(75 + value * .23, language === "ko" ? "페이지 문서 작성 중" : "Writing page document"));
    return { blob: converted.blob, fileName: ensurePdfExtension(name, "docx"), mimeType: MIME.docx, warnings: [language === "ko" ? "페이지 이미지를 원본 비율로 보존했습니다. 이미지 속 글자는 편집할 수 없습니다." : "Pages are preserved as proportionally fitted images. Text inside the images is not editable."] };
  }
  return convertStirlingImagePages(pages, format, name, language, progress, signal);
}
