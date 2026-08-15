/// <reference lib="webworker" />

import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import process from "process";

import type { PdfTextDocument, PdfWorkerResult } from "./types";
import { ensurePdfExtension as ensureExtension, pdfBinaryResult as binaryResult } from "./pdfShared";
import { workerMessage as featureMessage } from "../../i18n/workerMessages";

Object.assign(globalThis, { Buffer, process });

const worker = self as unknown as DedicatedWorkerGlobalScope;
let currentLanguage: "ko" | "en" = "ko";

worker.onmessage = async (event: MessageEvent) => {
  try {
    currentLanguage = event.data.language === "en" ? "en" : "ko";
    if (event.data.type !== "text-to-office") throw new Error(featureMessage(currentLanguage, "pdf.messages.pdfOffice.unsupportedDocumentConversionOperation"));
    const result = await buildOfficeFile(event.data);
    worker.postMessage({ type: "result", result }, [result.buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : featureMessage(currentLanguage, "pdf.messages.pdfOffice.anErrorOccurredWhileConvertingTheDocument");
    worker.postMessage({ type: "error", error: { message, code: "OFFICE_CONVERSION_ERROR" } });
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

async function buildOfficeFile(data: {
  document: PdfTextDocument;
  format: "docx" | "xlsx" | "txt";
  fileName: string;
  copy: PdfOfficeCopy;
}): Promise<PdfWorkerResult> {
  const warnings = [
    featureMessage(currentLanguage, "pdf.messages.pdfOffice.pdfsOftenOmitParagraphAndTableStructureSo"),
    featureMessage(currentLanguage, "pdf.messages.pdfOffice.complexTablesColumnsFootnotesShapesAndOriginalFormatting"),
  ];
  if (data.format === "txt") {
    const text = data.document.pages.map((page, index) => [data.copy.textPageTitles[index], ...page.lines.map((line) => line.text)].join("\n")).join("\n\n");
    return binaryResult(new TextEncoder().encode(`\uFEFF${text}`), ensureExtension(data.fileName, "txt"), "text/plain;charset=utf-8", warnings.slice(0, 1));
  }
  if (data.format === "xlsx") {
    progress(12, featureMessage(currentLanguage, "pdf.messages.pdfOffice.creatingOneWorksheetPerPage"));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Worklazy Tools";
    data.document.pages.forEach((page, pageIndex) => {
      const sheet = workbook.addWorksheet(uniqueSheetName(workbook, data.copy.pageTitles[pageIndex]));
      const columnPositions = clusterColumnPositions(page.lines.flatMap((line) => line.cells.map((cell) => cell.x)));
      page.lines.forEach((line) => {
        if (!line.cells.length || !columnPositions.length) { sheet.addRow([line.text]); return; }
        const values = Array<string>(columnPositions.length).fill("");
        line.cells.forEach((cell) => { values[nearestColumn(columnPositions, cell.x)] = cell.text; });
        sheet.addRow(values);
      });
      const maxColumns = Math.max(1, columnPositions.length);
      for (let column = 1; column <= maxColumns; column += 1) sheet.getColumn(column).width = 24;
      progress(15 + ((pageIndex + 1) / data.document.pages.length) * 72, featureMessage(currentLanguage, "pdf.messages.pdfOffice.worksheetCreated", { p0: pageIndex + 1, p1: data.document.pages.length }));
    });
    return binaryResult(await workbook.xlsx.writeBuffer(), ensureExtension(data.fileName, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", warnings);
  }
  progress(12, featureMessage(currentLanguage, "pdf.messages.pdfOffice.buildingTheWordDocumentStructure"));
  return binaryResult(await createDocx(data.document, data.copy), ensureExtension(data.fileName, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", warnings);
}

interface PdfOfficeCopy {
  textPageTitles: string[];
  pageTitles: string[];
  normalStyle: string;
  pageHeadingStyle: string;
  noRecognizedText: string;
}

async function createDocx(document: PdfTextDocument, copy: PdfOfficeCopy) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("word")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="${escapeXml(copy.normalStyle)}"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="맑은 고딕"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="PageHeading"><w:name w:val="${escapeXml(copy.pageHeadingStyle)}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`);
  const body = document.pages.map((page, index) => {
    const lines = page.lines.length ? page.lines.map((line) => paragraphXml(line.text)).join("") : paragraphXml(copy.noRecognizedText);
    progress(15 + ((index + 1) / document.pages.length) * 70, featureMessage(currentLanguage, "pdf.messages.pdfOffice.paragraphsCreated", { p0: index + 1, p1: document.pages.length }));
    return paragraphXml(copy.pageTitles[index], "PageHeading") + lines + (index < document.pages.length - 1 ? `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` : "");
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
