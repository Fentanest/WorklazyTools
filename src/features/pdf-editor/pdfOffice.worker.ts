/// <reference lib="webworker" />

import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import process from "process";

import type { PdfTextDocument, PdfWorkerResult } from "./types";

Object.assign(globalThis, { Buffer, process });

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent) => {
  try {
    if (event.data.type !== "text-to-office") throw new Error("지원하지 않는 문서 변환 작업입니다.");
    const result = await buildOfficeFile(event.data);
    worker.postMessage({ type: "result", result }, [result.buffer]);
  } catch (error) {
    worker.postMessage({ type: "error", error: { message: error instanceof Error ? error.message : "문서 변환 중 오류가 발생했습니다.", code: "OFFICE_CONVERSION_ERROR" } });
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

async function buildOfficeFile(data: {
  document: PdfTextDocument;
  format: "docx" | "xlsx" | "txt";
  fileName: string;
}): Promise<PdfWorkerResult> {
  const warnings = [
    "PDF는 문단·표 구조를 저장하지 않는 경우가 많아 읽기 순서와 셀 구분은 좌표를 바탕으로 추정합니다.",
    "복잡한 표, 다단 편집, 각주, 도형과 원본 서식은 동일하게 재현되지 않을 수 있습니다.",
  ];
  if (data.format === "txt") {
    const text = data.document.pages.map((page) => [`[페이지 ${page.pageNumber}]`, ...page.lines.map((line) => line.text)].join("\n")).join("\n\n");
    return binaryResult(new TextEncoder().encode(`\uFEFF${text}`), ensureExtension(data.fileName, "txt"), "text/plain;charset=utf-8", warnings.slice(0, 1));
  }
  if (data.format === "xlsx") {
    progress(12, "페이지별 워크시트를 만드는 중…");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Worklazy Tools";
    data.document.pages.forEach((page, pageIndex) => {
      const sheet = workbook.addWorksheet(uniqueSheetName(workbook, `페이지 ${page.pageNumber}`));
      page.lines.forEach((line) => sheet.addRow(line.cells.length ? line.cells.map((cell) => cell.text) : [line.text]));
      const maxColumns = Math.max(1, ...page.lines.map((line) => line.cells.length));
      for (let column = 1; column <= maxColumns; column += 1) sheet.getColumn(column).width = 24;
      progress(15 + ((pageIndex + 1) / data.document.pages.length) * 72, `[${pageIndex + 1}/${data.document.pages.length}] 워크시트 작성 완료`);
    });
    return binaryResult(await workbook.xlsx.writeBuffer(), ensureExtension(data.fileName, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", warnings);
  }
  progress(12, "Word 문서 구조를 만드는 중…");
  return binaryResult(await createDocx(data.document), ensureExtension(data.fileName, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", warnings);
}

async function createDocx(document: PdfTextDocument) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("word")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="표준"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="맑은 고딕"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="PageHeading"><w:name w:val="페이지 제목"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`);
  const body = document.pages.map((page, index) => {
    const lines = page.lines.length ? page.lines.map((line) => paragraphXml(line.text)).join("") : paragraphXml("(인식된 텍스트 없음)");
    progress(15 + ((index + 1) / document.pages.length) * 70, `[${index + 1}/${document.pages.length}] 문단 작성 완료`);
    return paragraphXml(`페이지 ${page.pageNumber}`, "PageHeading") + lines + (index < document.pages.length - 1 ? `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` : "");
  }).join("");
  zip.folder("word")?.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function paragraphXml(text: string, style?: string) {
  const properties = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${properties}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function uniqueSheetName(workbook: ExcelJS.Workbook, requested: string) {
  let name = requested.slice(0, 31);
  let suffix = 2;
  while (workbook.getWorksheet(name)) {
    const tail = ` (${suffix++})`;
    name = `${requested.slice(0, 31 - tail.length)}${tail}`;
  }
  return name;
}

function binaryResult(bytes: Uint8Array | ArrayBuffer, fileName: string, mimeType: string, warnings: string[]): PdfWorkerResult {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { buffer, fileName, mimeType, warnings };
}

function ensureExtension(name: string, extension: string) {
  const base = name.trim().replace(/\.[^.]+$/, "") || "worklazy-result";
  return `${base}.${extension}`;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export {};
