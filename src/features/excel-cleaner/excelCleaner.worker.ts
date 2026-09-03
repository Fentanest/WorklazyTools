/// <reference lib="webworker" />

import { parseSpreadsheetInput, spreadsheetHeaders } from "../spreadsheet-core/inputAdapter.ts";
import { runExcelCleanerPipeline } from "./engine.ts";
import { createCleanerSheetModels, ExcelCleanerError, preflightExcelCleaner } from "./model.ts";
import { buildExcelCleanerOutputs } from "./output.ts";
import { validateExcelCleanerPipeline } from "./schema.ts";
import { EXCEL_CLEANER_HARD_CELL_LIMIT, EXCEL_CLEANER_SOFT_CELL_LIMIT, type ExcelCleanerInspection, type ExcelCleanerOptions, type ExcelCleanerResult } from "./types.ts";

const worker = self as unknown as DedicatedWorkerGlobalScope;

type Request = {
  type: "inspect";
  fileName: string;
  buffer: ArrayBuffer;
  headerRows?: number[];
} | {
  type: "preview" | "run";
  fileName: string;
  buffer: ArrayBuffer;
  language: "ko" | "en";
  options: ExcelCleanerOptions;
};

worker.onmessage = (event: MessageEvent<Request>) => { void handle(event.data).finally(() => worker.close()); };

async function handle(request: Request) {
  try {
    progress(2, "READING");
    const book = await parseSpreadsheetInput(request.fileName, request.buffer);
    request.buffer = new ArrayBuffer(0);
    if (request.type === "inspect") {
      const cellCount = book.sheets.reduce((sum, sheet) => sum + sheet.rowCount * sheet.columnCount, 0);
      const result: ExcelCleanerInspection = {
        fileName: request.fileName,
        format: book.format,
        cellCount,
        softLimitExceeded: cellCount > EXCEL_CLEANER_SOFT_CELL_LIMIT,
        hardLimitExceeded: cellCount > EXCEL_CLEANER_HARD_CELL_LIMIT,
        sheets: book.sheets.map((sheet) => ({
          name: sheet.name,
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
          headerRows: (request.headerRows?.length ? request.headerRows : [1]).filter((row) => row >= 1 && row <= Math.max(1, sheet.rowCount)).map((row) => ({ row, values: spreadsheetHeaders(sheet, row).map((header) => header.name) })),
        })),
      };
      progress(100, "READY");
      worker.postMessage({ type: "result", result });
      return;
    }
    const pipeline = validateExcelCleanerPipeline(request.options.pipeline);
    const preflight = preflightExcelCleaner(book, request.options.selections, pipeline);
    if (preflight.downgradeFormulas && !request.options.confirmFormulaDowngrade) throw new ExcelCleanerError("FORMULA_CONFIRMATION_REQUIRED", preflight.warnings);
    progress(14, "PREFLIGHT");
    const date1904 = book.date1904;
    const format = book.format;
    const models = createCleanerSheetModels(book, request.options.selections, preflight.downgradeFormulas, {
      consumeSource: true,
      unmergePlanned: pipeline.rules.some((rule) => rule.type === "unmerge-cells" || rule.type === "unmerge-fill-down"),
    });
    book.sheets.length = 0;
    book.definedNames.length = 0;
    const engine = runExcelCleanerPipeline(models, pipeline, {
      previewRows: request.options.previewRows,
      date1904,
      onRuleStart: (rule, index, count) => worker.postMessage({ type: "rule-start", ruleId: rule.id, phase: rule.type, progress: 15 + Math.round(index / Math.max(1, count) * 55) }),
      onProgress: (rule, index, count) => progress(15 + Math.round((index + 1) / Math.max(1, count) * 55), rule.type, rule.id),
    });
    engine.warnings.push(...preflight.warnings);
    const outputs = request.type === "run" ? await buildExcelCleanerOutputs(engine, { fileName: request.fileName, language: request.language, pipeline, csvSafeMode: request.options.csvSafeMode }, request.options.output) : [];
    progress(request.type === "run" ? 96 : 90, request.type === "run" ? "WRITING_OUTPUT" : "PREVIEW_READY");
    const result: ExcelCleanerResult = { fileName: request.fileName, format, warnings: engine.warnings, summary: engine.summary, stages: engine.stages, outputs };
    engine.sheets = [];
    engine.errors = [];
    engine.excluded = [];
    const transfers = outputs.map((output) => output.buffer);
    progress(100, "COMPLETE");
    worker.postMessage({ type: "result", result }, transfers);
  } catch (error) {
    const typed = error as Error & { code?: string; details?: string[]; ruleId?: string; path?: string };
    const code = typed.code ?? (/^[A-Z0-9_]+$/u.test(typed.message) ? typed.message : "PROCESSING_FAILED");
    worker.postMessage({ type: "error", code, details: typed.details ?? (typed.path ? [typed.path] : undefined), ruleId: typed.ruleId });
  }
}

function progress(value: number, phase: string, ruleId?: string) { worker.postMessage({ type: "progress", progress: value, phase, ruleId }); }

export {};
