/// <reference lib="webworker" />

import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import process from "process";

import type { PdfTextDocument, PdfWorkerResult } from "./types";
import { ensurePdfExtension as ensureExtension, pdfBinaryResult as binaryResult } from "./pdfShared";

Object.assign(globalThis, { Buffer, process });

const worker = self as unknown as DedicatedWorkerGlobalScope;
let currentLanguage: "ko" | "en" = "ko";
const L = (ko: string, en: string) => currentLanguage === "ko" ? ko : en;

worker.onmessage = async (event: MessageEvent) => {
  try {
    currentLanguage = event.data.language === "en" ? "en" : "ko";
    if (event.data.type !== "text-to-office") throw new Error(L("지원하지 않는 문서 변환 작업입니다.", "Unsupported document conversion operation."));
    const result = await buildOfficeFile(event.data);
    worker.postMessage({ type: "result", result }, [result.buffer]);
  } catch (error) {
    worker.postMessage({ type: "error", error: { message: error instanceof Error ? error.message : L("문서 변환 중 오류가 발생했습니다.", "An error occurred while converting the document."), code: "OFFICE_CONVERSION_ERROR" } });
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
    L("PDF는 문단·표 구조를 저장하지 않는 경우가 많아 읽기 순서와 셀 구분은 좌표를 바탕으로 추정합니다.", "PDFs often omit paragraph and table structure, so reading order and cell boundaries are estimated from coordinates."),
    L("복잡한 표, 다단 편집, 각주, 도형과 원본 서식은 동일하게 재현되지 않을 수 있습니다.", "Complex tables, columns, footnotes, shapes, and original formatting may not be reproduced exactly."),
  ];
  if (data.format === "txt") {
    const text = data.document.pages.map((page) => [L(`[페이지 ${page.pageNumber}]`, `[Page ${page.pageNumber}]`), ...page.lines.map((line) => line.text)].join("\n")).join("\n\n");
    return binaryResult(new TextEncoder().encode(`\uFEFF${text}`), ensureExtension(data.fileName, "txt"), "text/plain;charset=utf-8", warnings.slice(0, 1));
  }
  if (data.format === "xlsx") {
    progress(12, L("페이지별 워크시트를 만드는 중…", "Creating one worksheet per page…"));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Worklazy Tools";
    data.document.pages.forEach((page, pageIndex) => {
      const sheet = workbook.addWorksheet(uniqueSheetName(workbook, L(`페이지 ${page.pageNumber}`, `Page ${page.pageNumber}`)));
      const columnPositions = clusterColumnPositions(page.lines.flatMap((line) => line.cells.map((cell) => cell.x)));
      page.lines.forEach((line) => {
        if (!line.cells.length || !columnPositions.length) { sheet.addRow([line.text]); return; }
        const values = Array<string>(columnPositions.length).fill("");
        line.cells.forEach((cell) => { values[nearestColumn(columnPositions, cell.x)] = cell.text; });
        sheet.addRow(values);
      });
      const maxColumns = Math.max(1, columnPositions.length);
      for (let column = 1; column <= maxColumns; column += 1) sheet.getColumn(column).width = 24;
      progress(15 + ((pageIndex + 1) / data.document.pages.length) * 72, L(`[${pageIndex + 1}/${data.document.pages.length}] 워크시트 작성 완료`, `[${pageIndex + 1}/${data.document.pages.length}] Worksheet created`));
    });
    return binaryResult(await workbook.xlsx.writeBuffer(), ensureExtension(data.fileName, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", warnings);
  }
  progress(12, L("Word 문서 구조를 만드는 중…", "Building the Word document structure…"));
  return binaryResult(await createDocx(data.document), ensureExtension(data.fileName, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", warnings);
}

async function createDocx(document: PdfTextDocument) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("word")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="${L("표준", "Normal")}"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="맑은 고딕"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="PageHeading"><w:name w:val="${L("페이지 제목", "Page Heading")}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`);
  const body = document.pages.map((page, index) => {
    const lines = page.lines.length ? page.lines.map((line) => paragraphXml(line.text)).join("") : paragraphXml(L("(인식된 텍스트 없음)", "(No recognized text)"));
    progress(15 + ((index + 1) / document.pages.length) * 70, L(`[${index + 1}/${document.pages.length}] 문단 작성 완료`, `[${index + 1}/${document.pages.length}] Paragraphs created`));
    return paragraphXml(L(`페이지 ${page.pageNumber}`, `Page ${page.pageNumber}`), "PageHeading") + lines + (index < document.pages.length - 1 ? `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` : "");
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

function escapeXml(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function clusterColumnPositions(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  const clusters: number[][] = [];
  sorted.forEach((value) => {
    const cluster = clusters.find((candidate) => Math.abs(candidate.reduce((sum, item) => sum + item, 0) / candidate.length - value) <= 18);
    if (cluster) cluster.push(value);
    else clusters.push([value]);
  });
  return clusters.map((cluster) => cluster.reduce((sum, value) => sum + value, 0) / cluster.length).sort((left, right) => left - right);
}

function nearestColumn(columns: number[], value: number) {
  let nearest = 0;
  for (let index = 1; index < columns.length; index += 1) if (Math.abs(columns[index] - value) < Math.abs(columns[nearest] - value)) nearest = index;
  return nearest;
}

export {};
