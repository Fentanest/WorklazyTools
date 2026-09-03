/// <reference lib="webworker" />

import { parseSpreadsheetInput, spreadsheetHeaders } from "../spreadsheet-core/inputAdapter.ts";
import { compareSpreadsheetPair } from "./compareEngine.ts";
import { buildExcelCompareReport } from "./report.ts";
import { assertGeneratedXlsxReport } from "./reportIntegrity.ts";
import type { ExcelCompareInspection, ExcelComparePairOptions, ExcelComparePairResult } from "./types.ts";

const worker = self as unknown as DedicatedWorkerGlobalScope;

type Request = {
  type: "inspect";
  fileName: string;
  buffer: ArrayBuffer;
  csvEncoding?: "auto" | "utf-8" | "euc-kr";
  headerRows?: number[];
} | {
  type: "compare";
  leftName: string;
  rightName: string;
  leftBuffer: ArrayBuffer;
  rightBuffer: ArrayBuffer;
  options: ExcelComparePairOptions;
};

worker.onmessage = (event: MessageEvent<Request>) => {
  void handle(event.data).finally(() => worker.close());
};

async function handle(request: Request) {
  try {
    if (request.type === "inspect") {
      progress(5, "READING");
      const book = await parseSpreadsheetInput(request.fileName, request.buffer, { csvEncoding: request.csvEncoding });
      const result: ExcelCompareInspection = {
        fileName: request.fileName,
        format: book.format,
        supportsStyleComparison: book.supportsStyleComparison,
        sheets: book.sheets.map((sheet) => ({
          name: sheet.name,
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
          headerRows: (request.headerRows?.length ? request.headerRows : [1])
            .filter((row) => row >= 1 && row <= Math.max(1, sheet.rowCount))
            .map((row) => ({ row, values: spreadsheetHeaders(sheet, row).map((header) => header.name) })),
        })),
      };
      progress(100, "READY");
      worker.postMessage({ type: "result", result });
      return;
    }
    progress(4, "READING_LEFT");
    let leftBook = await parseSpreadsheetInput(request.leftName, request.leftBuffer);
    progress(24, "READING_RIGHT");
    let rightBook = await parseSpreadsheetInput(request.rightName, request.rightBuffer);
    progress(46, "COMPARING");
    const compared = compareSpreadsheetPair(leftBook, rightBook, request.options);
    progress(80, "WRITING_REPORT");
    const reportBytes = await buildExcelCompareReport(compared, {
      leftName: request.leftName,
      rightName: request.rightName,
      leftSheet: request.options.left.sheetName,
      rightSheet: request.options.right.sheetName,
    });
    const reportBuffer = transferableArrayBuffer(reportBytes);
    assertGeneratedXlsxReport(reportBuffer);
    const reportByteLength = reportBuffer.byteLength;
    const result: ExcelComparePairResult = {
      leftName: request.leftName,
      rightName: request.rightName,
      leftFormat: leftBook.format,
      rightFormat: rightBook.format,
      summary: compared.summary,
      records: compared.records,
      warnings: compared.warnings,
      reportBuffer,
      reportByteLength,
      reportName: "report.xlsx",
    };
    leftBook = undefined as unknown as typeof leftBook;
    rightBook = undefined as unknown as typeof rightBook;
    progress(100, "COMPLETE");
    worker.postMessage({ type: "result", result }, [reportBuffer]);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message) ? error.message : "PROCESSING_FAILED";
    worker.postMessage({ type: "error", code });
  }
}

function progress(value: number, phase: string) {
  worker.postMessage({ type: "progress", progress: value, phase });
}

function transferableArrayBuffer(value: unknown) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return bytes.slice().buffer;
  }
  throw new Error("REPORT_BUFFER_INVALID");
}

export {};
