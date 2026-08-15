/// <reference lib="webworker" />

import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import officeCrypto from "officecrypto-tool";
import process from "process";
import * as XLSX from "xlsx";

import { readCsvWorkbook } from "./csvImport";
import { hasIncomingSheetReference } from "./sheetReferences";
import { buildWordReport } from "./wordReport";
import type {
  ExcelInputPayload,
  ExcelInspectionResult,
  ExcelMergeOptions,
  ExcelMergeResult,
  MergeMode,
  SheetNameRule,
  WordCompareResult,
} from "./types";

// Some stream-based ExcelJS CSV paths expect the complete browser process shim.
Object.assign(globalThis, { Buffer, process });

interface ParsedInput {
  fileName: string;
  workbook: ExcelJS.Workbook;
  selectedWorksheets?: ExcelJS.Worksheet[];
}

interface SheetBounds {
  rows: number;
  columns: number;
}

interface SheetPlan {
  fileIndex: number;
  source: ExcelJS.Worksheet;
  target: ExcelJS.Worksheet;
  rowOffset: number;
  columnOffset: number;
  bounds: SheetBounds;
  skipRows: number;
}

interface SheetTrimStats {
  rows: number;
  columns: number;
}

class ExcelWorkerError extends Error {
  code?: string;
  fileName?: string;

  constructor(message: string, code?: string, fileName?: string) {
    super(message);
    this.code = code;
    this.fileName = fileName;
  }
}

const worker = self as unknown as DedicatedWorkerGlobalScope;
let currentLanguage: "ko" | "en" = "ko";

function local(ko: string, en: string) {
  return currentLanguage === "en" ? en : ko;
}

worker.onmessage = async (event: MessageEvent) => {
  try {
    currentLanguage = event.data.language === "en" ? "en" : "ko";
    if (event.data.type === "inspect") {
      const result = await inspectFiles(event.data.files as ExcelInputPayload[]);
      worker.postMessage({ type: "result", result });
      return;
    }

    if (event.data.type === "merge") {
      const result = await mergeFiles(
        event.data.files as ExcelInputPayload[],
        event.data.options as ExcelMergeOptions,
      );
      worker.postMessage({ type: "result", result }, [result.buffer]);
      return;
    }

    if (event.data.type === "word-report") {
      const buffer = await buildWordReport(event.data.result as WordCompareResult, currentLanguage, progress);
      worker.postMessage({ type: "result", result: buffer }, [buffer]);
      return;
    }

    if (event.data.type === "word-reports") {
      const results = event.data.results as WordCompareResult[];
      const buffers: ArrayBuffer[] = [];
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const segmentStart = (index / Math.max(1, results.length)) * 100;
        const segmentSize = 100 / Math.max(1, results.length);
        buffers.push(await buildWordReport(result, currentLanguage, (value, message) => {
          progress(
            Math.round(segmentStart + (value / 100) * segmentSize),
            `[${index + 1}/${results.length}] ${result.beforeName} ↔ ${result.afterName} · ${message}`,
          );
        }));
      }
      worker.postMessage({ type: "result", result: buffers }, buffers);
      return;
    }

    throw new ExcelWorkerError(local("지원하지 않는 작업 요청입니다.", "Unsupported operation request."), "UNSUPPORTED_REQUEST");
  } catch (error) {
    const normalized = normalizeError(error);
    worker.postMessage({ type: "error", error: normalized });
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: value, message });
}

async function inspectFiles(files: ExcelInputPayload[]): Promise<ExcelInspectionResult[]> {
  return Promise.all(files.map(async (file) => {
    const encrypted = isEncryptedFile(file.name, new Uint8Array(file.buffer));
    if (encrypted && !file.password) return { id: file.id, encrypted: true, sheetNames: [] };
    try {
      const parsed = await parseInput(file);
      return {
        id: file.id,
        encrypted,
        sheetNames: parsed.workbook.worksheets.map((sheet) => sheet.name),
      };
    } catch (error) {
      return {
        id: file.id,
        encrypted,
        sheetNames: [],
        error: error instanceof Error ? error.message : local("시트 목록을 읽지 못했습니다.", "Could not read the sheet list."),
      };
    }
  }));
}

async function mergeFiles(files: ExcelInputPayload[], options: ExcelMergeOptions): Promise<ExcelMergeResult> {
  if (!files.length) throw new ExcelWorkerError(local("병합할 파일이 없습니다.", "There are no files to merge."), "NO_FILES");

  const warnings = new Set<string>();
  if (files.some((file) => ["xls", "xlsb", "xlsm"].includes(getExtension(file.name)))) {
    warnings.add(local("XLS·XLSB·XLSM 입력은 값과 기본 시트 구조를 XLSX로 변환합니다. 수식과 서식은 XLSX 입력에서만 보존됩니다.", "XLS, XLSB and XLSM inputs are converted to XLSX with values and basic sheet structure. Formulas and formatting are preserved only for XLSX inputs."));
  }
  if (files.some((file) => getExtension(file.name) === "xlsm")) {
    warnings.add(local("XLSM의 매크로는 XLSX 출력 파일에 보존되지 않습니다.", "XLSM macros are not preserved in the XLSX output."));
  }
  const inputs: ParsedInput[] = [];
  progress(2, local(`${files.length}개 입력 파일을 안전한 작업 공간으로 전달했습니다.`, `Moved ${files.length} input files into the processing workspace.`));

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    progress(5 + Math.round((index / files.length) * 35), local(`[${index + 1}/${files.length}] ${file.name} 읽는 중…`, `[${index + 1}/${files.length}] Reading ${file.name}…`));
    const parsed = await parseInput(file);
    const selectedSheetNames = file.selectedSheetNames ?? parsed.workbook.worksheets.map((sheet) => sheet.name);
    parsed.selectedWorksheets = selectedSheetNames
      .map((sheetName) => parsed.workbook.getWorksheet(sheetName))
      .filter((sheet): sheet is ExcelJS.Worksheet => Boolean(sheet));
    if (!parsed.selectedWorksheets.length) {
      throw new ExcelWorkerError(local(`${file.name}에서 병합할 시트를 선택해 주세요.`, `Select at least one sheet from ${file.name}.`), "NO_SHEETS", file.name);
    }
    inputs.push(parsed);
    progress(5 + Math.round(((index + 1) / files.length) * 35), local(`[${index + 1}/${files.length}] ${file.name} · ${parsed.selectedWorksheets.length}개 시트 선택`, `[${index + 1}/${files.length}] ${file.name} · ${parsed.selectedWorksheets.length} sheets selected`));
  }

  progress(43, local("입력 분석 완료 · 출력 시트 구성을 시작합니다.", "Input analysis complete · Building the output sheets."));
  const output = new ExcelJS.Workbook();
  output.creator = "Worklazy Tools";
  output.created = new Date();
  output.modified = new Date();
  output.calcProperties.fullCalcOnLoad = true;

  const usedNames = new Set<string>();
  const plans: SheetPlan[] = [];
  let inputSheetCount = 0;

  if (options.mergeMode === "sheets") {
    inputs.forEach((input, fileIndex) => {
      (input.selectedWorksheets ?? []).forEach((source) => {
        inputSheetCount += 1;
        const referencedByAnotherSheet = options.trimEmptyEdges && hasIncomingSheetReference(input.workbook, source);
        if (referencedByAnotherSheet) warnings.add(local(`'${source.name}' 시트는 다른 시트 수식에서 참조하므로 끝의 빈 영역 정리를 건너뛰었습니다.`, `Skipped ending-empty-area trim in '${source.name}' because another sheet formula references it.`));
        const targetName = createSheetName(input.fileName, source.name, options.sheetNameRule, usedNames);
        const target = output.addWorksheet(targetName, {
          properties: cloneData(source.properties),
          pageSetup: cloneData(source.pageSetup),
          views: cloneData(source.views),
        });
        target.state = source.state;
        plans.push({
          fileIndex,
          source,
          target,
          rowOffset: 0,
          columnOffset: 0,
          bounds: getSheetBounds(source, options.trimEmptyEdges && !referencedByAnotherSheet),
          skipRows: 0,
        });
      });
    });
  } else {
    const target = output.addWorksheet(local("병합 결과", "Merged Result"));
    let rowOffset = 0;
    let columnOffset = 0;

    inputs.forEach((input, fileIndex) => {
      (input.selectedWorksheets ?? []).forEach((source) => {
        inputSheetCount += 1;
        const sourceBounds = getSheetBounds(source, options.trimEmptyEdges);
        const skipRows = options.mergeMode === "vertical" && plans.length > 0 ? Math.min(sourceBounds.rows, Math.max(0, Math.floor(options.skipHeaderRows || 0))) : 0;
        const bounds = { rows: Math.max(0, sourceBounds.rows - skipRows), columns: sourceBounds.columns };
        plans.push({ fileIndex, source, target, rowOffset, columnOffset, bounds, skipRows });
        if (options.mergeMode === "vertical") rowOffset += bounds.rows;
        if (options.mergeMode === "horizontal") columnOffset += bounds.columns;
      });
    });
  }

  const planLookup = new Map<string, SheetPlan>();
  plans.forEach((plan) => planLookup.set(planKey(plan.fileIndex, plan.source.name), plan));
  progress(45, local(`${plans.length}개 시트의 복사 위치를 계산했습니다.`, `Calculated output positions for ${plans.length} sheets.`));

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    progress(47 + Math.round((index / Math.max(1, plans.length)) * 37), local(`[${index + 1}/${plans.length}] ${plan.source.name} 셀·수식·서식 복사 중…`, `[${index + 1}/${plans.length}] Copying cells, formulas and formatting from ${plan.source.name}…`));
    copyWorksheet(plan, planLookup, options, warnings);
  }

  if (options.sheetTrimRows || options.sheetTrimColumns) {
    progress(86, local(`${plans.length}개 시트 복사 완료 · 연속 빈 행·열을 검사합니다.`, `Copied ${plans.length} sheets · Checking consecutive empty rows and columns.`));
    const trimStats = performSheetTrim(output, options, warnings);
    progress(89, local(`연속 빈 행·열 정리 완료 · 빈 행 ${trimStats.rows}개, 빈 열 ${trimStats.columns}개를 정리했습니다.`, `Empty-area cleanup complete · Removed ${trimStats.rows} rows and ${trimStats.columns} columns.`));
  } else {
    progress(86, local(`${plans.length}개 시트 복사 완료`, `Copied ${plans.length} sheets`));
  }

  progress(90, local("XLSX 구조를 저장합니다.", "Writing the XLSX structure."));
  const plainBuffer = toArrayBuffer(await output.xlsx.writeBuffer());
  let finalBuffer = plainBuffer;

  if (options.outputPassword) {
    progress(93, local("XLSX 저장 완료 · 출력 파일 암호화 중…", "XLSX written · Encrypting the output file…"));
    const encrypted = officeCrypto.encrypt(Buffer.from(plainBuffer), { password: options.outputPassword });
    finalBuffer = toArrayBuffer(encrypted);
  }

  progress(100, local("병합 파일 생성 완료", "Merged file created"));
  return {
    buffer: finalBuffer,
    fileCount: files.length,
    sheetCount: inputSheetCount,
    outputSheetCount: output.worksheets.length,
    encrypted: Boolean(options.outputPassword),
    warnings: Array.from(warnings),
  };
}

async function parseInput(file: ExcelInputPayload): Promise<ParsedInput> {
  const extension = getExtension(file.name);
  let data = new Uint8Array(file.buffer);
  const encrypted = isEncryptedFile(file.name, data);

  if (encrypted) {
    if (!file.password) {
      throw new ExcelWorkerError(local(`${file.name}의 비밀번호를 입력해 주세요.`, `Enter the password for ${file.name}.`), "PASSWORD_REQUIRED", file.name);
    }
    try {
      data = new Uint8Array(await officeCrypto.decrypt(Buffer.from(data), { password: file.password }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/password|incorrect|verify/i.test(message)) {
        throw new ExcelWorkerError(local(`${file.name}의 비밀번호가 올바르지 않습니다.`, `The password for ${file.name} is incorrect.`), "WRONG_PASSWORD", file.name);
      }
      throw new ExcelWorkerError(local(`${file.name}의 암호 방식을 지원하지 않거나 파일을 해제하지 못했습니다.`, `The encryption method for ${file.name} is unsupported or the file could not be decrypted.`), "DECRYPT_FAILED", file.name);
    }
  }

  try {
    if (extension === "csv") return { fileName: file.name, workbook: await readCsv(file.name, data, file.csvEncoding) };
    if (["xls", "xlsb", "xlsm"].includes(extension)) {
      return { fileName: file.name, workbook: readConvertedWorkbook(data) };
    }
    if (extension === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(data));
      return { fileName: file.name, workbook };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/password|encrypted|EncryptionInfo/i.test(detail)) {
      throw new ExcelWorkerError(local(`${file.name}은 암호로 보호되어 있습니다. 비밀번호를 입력해 주세요.`, `${file.name} is password-protected. Enter its password.`), "PASSWORD_REQUIRED", file.name);
    }
    throw new ExcelWorkerError(local(`${file.name}을 읽지 못했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다. (${detail})`, `Could not read ${file.name}. The file may be damaged or use an unsupported format. (${detail})`), "READ_FAILED", file.name);
  }

  throw new ExcelWorkerError(local(`${extension || "알 수 없는"} 형식은 지원하지 않습니다.`, `${extension || "Unknown"} format is not supported.`), "UNSUPPORTED_FORMAT", file.name);
}

async function readCsv(fileName: string, data: Uint8Array, encoding: ExcelInputPayload["csvEncoding"] = "auto") {
  const sheetName = createSafeUniqueName(stripExtension(fileName) || "CSV", new Set());
  return readCsvWorkbook(decodeCsv(data, encoding), sheetName);
}

function readConvertedWorkbook(data: Uint8Array) {
  const source = XLSX.read(data, {
    type: "array",
    cellDates: true,
    cellFormula: true,
    cellNF: true,
    cellStyles: true,
  });
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  source.SheetNames.forEach((name) => {
    const sourceSheet = source.Sheets[name];
    const worksheet = workbook.addWorksheet(createSafeUniqueName(name, usedNames));
    if (!sourceSheet["!ref"]) return;

    const range = XLSX.utils.decode_range(sourceSheet["!ref"]);
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const sourceCell = sourceSheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (!sourceCell) continue;
        const targetCell = worksheet.getCell(row + 1, column + 1);

        targetCell.value = sourceCell.f
          ? { formula: sourceCell.f, result: normalizeSheetJsValue(sourceCell.v) } as ExcelJS.CellFormulaValue
          : normalizeSheetJsValue(sourceCell.v) as ExcelJS.CellValue;
        if (sourceCell.z) targetCell.numFmt = sourceCell.z;
      }
    }

    const merges = sourceSheet["!merges"] || [];
    merges.forEach((merge) => worksheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1));

    const columns = sourceSheet["!cols"] || [];
    columns.forEach((column, index) => {
      if (column?.wch) worksheet.getColumn(index + 1).width = column.wch;
      if (column?.hidden) worksheet.getColumn(index + 1).hidden = true;
    });
    const rows = sourceSheet["!rows"] || [];
    rows.forEach((row, index) => {
      if (row?.hpt) worksheet.getRow(index + 1).height = row.hpt;
      if (row?.hidden) worksheet.getRow(index + 1).hidden = true;
    });
  });

  return workbook;
}

function normalizeSheetJsValue(value: unknown) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date || ["string", "number", "boolean"].includes(typeof value)) return value;
  return String(value);
}

function copyWorksheet(
  plan: SheetPlan,
  planLookup: Map<string, SheetPlan>,
  options: ExcelMergeOptions,
  warnings: Set<string>,
) {
  const { source, target, rowOffset, columnOffset, bounds, skipRows } = plan;
  if (!bounds.rows || !bounds.columns) return;

  for (let columnIndex = 1; columnIndex <= bounds.columns; columnIndex += 1) {
    const sourceColumn = source.getColumn(columnIndex);
    const targetColumn = target.getColumn(columnIndex + columnOffset);
    if (sourceColumn.width && (!targetColumn.width || sourceColumn.width > targetColumn.width)) targetColumn.width = sourceColumn.width;
    if (sourceColumn.hidden && options.mergeMode !== "vertical") targetColumn.hidden = true;
    if (sourceColumn.outlineLevel) targetColumn.outlineLevel = sourceColumn.outlineLevel;
  }

  for (let outputRowIndex = 1; outputRowIndex <= bounds.rows; outputRowIndex += 1) {
    const rowIndex = outputRowIndex + skipRows;
    const sourceRow = source.getRow(rowIndex);
    const targetRow = target.getRow(outputRowIndex + rowOffset);
    if (sourceRow.height && (!targetRow.height || sourceRow.height > targetRow.height)) targetRow.height = sourceRow.height;
    if (sourceRow.hidden && options.mergeMode !== "horizontal") targetRow.hidden = true;
    if (sourceRow.outlineLevel) targetRow.outlineLevel = sourceRow.outlineLevel;

    for (let columnIndex = 1; columnIndex <= bounds.columns; columnIndex += 1) {
      const sourceCell = source.getCell(rowIndex, columnIndex);
      if (sourceCell.type === ExcelJS.ValueType.Merge) continue;
      if (sourceCell.value === null && !hasCellStyle(sourceCell)) continue;

      const targetCell = target.getCell(outputRowIndex + rowOffset, columnIndex + columnOffset);
      copyCell(sourceCell, targetCell, plan, planLookup, options, warnings);
    }
  }

  for (const mergeRange of source.model.merges || []) {
    const merge = XLSX.utils.decode_range(mergeRange);
    if (merge.e.r < skipRows || merge.s.r < skipRows || merge.s.r - skipRows >= bounds.rows || merge.s.c >= bounds.columns) continue;
    target.mergeCells(
      merge.s.r + 1 - skipRows + rowOffset,
      merge.s.c + 1 + columnOffset,
      Math.min(merge.e.r + 1 - skipRows, bounds.rows) + rowOffset,
      Math.min(merge.e.c + 1, bounds.columns) + columnOffset,
    );
  }

  if (source.getImages().length) warnings.add(local("셀 위에 배치된 이미지는 현재 브라우저 병합 결과에서 제외됩니다.", "Images placed over cells are excluded from the current browser-generated result."));
  if (source.getTables().length) warnings.add(local("Excel 표 개체는 일반 셀과 서식으로 복사되며 표 기능 자체는 유지되지 않을 수 있습니다.", "Excel table objects are copied as regular cells and formatting; table behavior may not be retained."));
}

function copyCell(
  source: ExcelJS.Cell,
  target: ExcelJS.Cell,
  plan: SheetPlan,
  planLookup: Map<string, SheetPlan>,
  options: ExcelMergeOptions,
  warnings: Set<string>,
) {
  if (source.type === ExcelJS.ValueType.Formula) {
    if (options.onlyValues) {
      target.value = cloneCellValue(source.result ?? source.text ?? null);
    } else {
      target.value = {
        formula: translateFormula(source.formula, plan, planLookup, options.mergeMode, warnings),
        result: cloneCellValue(source.result),
      } as ExcelJS.CellFormulaValue;
    }
  } else {
    target.value = cloneCellValue(source.value);
  }

  if (source.style && Object.keys(source.style).length) target.style = cloneData(source.style);
  if (source.dataValidation && Object.keys(source.dataValidation).length) target.dataValidation = cloneData(source.dataValidation);
  if (source.note) target.note = cloneData(source.note);
  if (source.protection) target.protection = cloneData(source.protection);
}

function translateFormula(
  formula: string,
  currentPlan: SheetPlan,
  planLookup: Map<string, SheetPlan>,
  mode: MergeMode,
  warnings: Set<string>,
) {
  const parts = formula.split(/("(?:[^"]|"")*")/g);
  const qualifier = "(?:(?:'((?:[^']|'')+)'|([A-Za-z_가-힣][A-Za-z0-9_.가-힣]*))!)?";
  const cell = "(\\$?)([A-Z]{1,3})(\\$?)(\\d+)";
  const referencePattern = new RegExp(`(?<![A-Za-z0-9_.])${qualifier}${cell}(?:\\s*:\\s*${qualifier}${cell})?(?![A-Za-z0-9_(])`, "g");

  return parts.map((part, index) => {
    if (index % 2 === 1) return part;
    return part.replace(referencePattern, (match, quotedSheet, plainSheet, absoluteColumn, letters, absoluteRow, digits, quotedSheet2, plainSheet2, absoluteColumn2, letters2, absoluteRow2, digits2) => {
      const firstSheet = (quotedSheet || plainSheet)?.replace(/''/g, "'");
      const first = translateReference({ absoluteColumn, letters, absoluteRow, digits, referencedSheet: firstSheet }, currentPlan, planLookup, mode, warnings);
      if (!first || !letters2) return first || match;
      const secondSheet = (quotedSheet2 || plainSheet2)?.replace(/''/g, "'") || firstSheet;
      const second = translateReference({ absoluteColumn: absoluteColumn2, letters: letters2, absoluteRow: absoluteRow2, digits: digits2, referencedSheet: secondSheet, omitInheritedQualifier: !quotedSheet2 && !plainSheet2 }, currentPlan, planLookup, mode, warnings);
      return second ? `${first}:${second}` : match;
    });
  }).join("");
}

function translateReference(reference: { absoluteColumn: string; letters: string; absoluteRow: string; digits: string; referencedSheet?: string; omitInheritedQualifier?: boolean }, currentPlan: SheetPlan, planLookup: Map<string, SheetPlan>, mode: MergeMode, warnings: Set<string>) {
  let referencePlan = currentPlan;
  if (reference.referencedSheet) {
    const found = findPlan(planLookup, currentPlan.fileIndex, reference.referencedSheet);
    if (!found) {
      warnings.add(local(`병합에서 제외된 '${reference.referencedSheet}' 시트를 참조하는 수식은 원래 참조를 유지했습니다.`, `A formula referencing excluded sheet '${reference.referencedSheet}' kept its original reference.`));
      return undefined;
    }
    referencePlan = found;
  }
  const rowOffset = mode === "sheets" ? 0 : referencePlan.rowOffset - referencePlan.skipRows;
  const columnOffset = mode === "sheets" ? 0 : referencePlan.columnOffset;
  const row = Number(reference.digits) + rowOffset;
  const column = columnLettersToNumber(reference.letters) + columnOffset;
  const sheetQualifier = reference.referencedSheet && !reference.omitInheritedQualifier ? `${quoteSheetName(referencePlan.target.name)}!` : "";
  return `${sheetQualifier}${reference.absoluteColumn}${columnNumberToLetters(column)}${reference.absoluteRow}${row}`;
}

function findPlan(planLookup: Map<string, SheetPlan>, fileIndex: number, sheetName: string) {
  const exact = planLookup.get(planKey(fileIndex, sheetName));
  if (exact) return exact;
  for (const plan of planLookup.values()) {
    if (plan.fileIndex === fileIndex && plan.source.name.toLowerCase() === sheetName.toLowerCase()) return plan;
  }
  return undefined;
}

function getSheetBounds(sheet: ExcelJS.Worksheet, trim: boolean): SheetBounds {
  if (!trim) return { rows: sheet.rowCount, columns: sheet.columnCount };
  let rows = 0;
  let columns = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      if (cell.value !== null && cell.value !== "") {
        rows = Math.max(rows, rowNumber);
        columns = Math.max(columns, columnNumber);
      }
    });
  });

  for (const mergeRange of sheet.model.merges || []) {
    const merge = XLSX.utils.decode_range(mergeRange);
    rows = Math.max(rows, merge.e.r + 1);
    columns = Math.max(columns, merge.e.c + 1);
  }
  return { rows, columns };
}

function performSheetTrim(workbook: ExcelJS.Workbook, options: ExcelMergeOptions, warnings: Set<string>): SheetTrimStats {
  const threshold = Math.max(1, Math.floor(Number(options.sheetTrimThreshold) || 1));
  const stats: SheetTrimStats = { rows: 0, columns: 0 };

  workbook.worksheets.forEach((worksheet) => {
    let hasFormula = false;
    const nonEmptyRows = new Set<number>();
    const nonEmptyColumns = new Set<number>();
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      if (!isSheetTrimValueEmpty(cell.value)) { nonEmptyRows.add(rowNumber); nonEmptyColumns.add(columnNumber); }
      if (cell.type === ExcelJS.ValueType.Formula) hasFormula = true;
    }));
    if (hasFormula || (worksheet.model.merges?.length ?? 0) > 0) {
      warnings.add(local(`'${worksheet.name}' 시트에는 수식 또는 병합 셀이 있어 중간 빈 행·열 정리를 건너뛰었습니다.`, `Skipped middle empty-row/column cleanup in '${worksheet.name}' because it contains formulas or merged cells.`));
      return;
    }
    if (options.sheetTrimRows) {
      const lastRow = worksheet.rowCount;
      const emptyRows = Array.from({ length: lastRow }, (_, index) => index + 1).filter((row) => !nonEmptyRows.has(row));
      const blocks = buildSheetTrimBlocks(emptyRows, threshold);
      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const [start, count] = blocks[index];
        worksheet.spliceRows(start, count);
        stats.rows += count;
      }
    }

    if (options.sheetTrimColumns) {
      const lastColumn = worksheet.columnCount;
      const emptyColumns = Array.from({ length: lastColumn }, (_, index) => index + 1).filter((column) => !nonEmptyColumns.has(column));
      const blocks = buildSheetTrimBlocks(emptyColumns, threshold);
      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const [start, count] = blocks[index];
        worksheet.spliceColumns(start, count);
        stats.columns += count;
      }
    }
  });

  return stats;
}

function isSheetTrimValueEmpty(value: ExcelJS.CellValue) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function decodeCsv(data: Uint8Array, encoding: ExcelInputPayload["csvEncoding"]) {
  if (encoding && encoding !== "auto") return new TextDecoder(encoding, { fatal: true }).decode(data);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(data); }
  catch { return new TextDecoder("euc-kr", { fatal: true }).decode(data); }
}

function buildSheetTrimBlocks(indexes: number[], threshold: number): Array<[number, number]> {
  if (!indexes.length) return [];
  const blocks: Array<[number, number]> = [];
  let start = indexes[0];
  let previous = indexes[0];

  for (let index = 1; index < indexes.length; index += 1) {
    const current = indexes[index];
    if (current !== previous + 1) {
      const count = previous - start + 1;
      if (count >= threshold) blocks.push([start, count]);
      start = current;
    }
    previous = current;
  }

  const count = previous - start + 1;
  if (count >= threshold) blocks.push([start, count]);
  return blocks;
}

function hasCellStyle(cell: ExcelJS.Cell) {
  return Boolean(cell.style && Object.keys(cell.style).length);
}

function cloneCellValue(value: ExcelJS.CellValue | undefined): ExcelJS.CellValue {
  if (value === undefined || value === null) return null;
  return cloneData(value);
}

function cloneData<T>(value: T): T {
  return structuredClone(value);
}

function isEncryptedFile(fileName: string, data: Uint8Array) {
  const extension = getExtension(fileName);
  if (extension === "csv") return false;
  const isCompoundFile = data.length >= 8
    && data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0
    && data[4] === 0xa1 && data[5] === 0xb1 && data[6] === 0x1a && data[7] === 0xe1;
  if (["xlsx", "xlsb", "xlsm"].includes(extension)) return isCompoundFile;
  if (extension === "xls" && isCompoundFile) return officeCrypto.isEncrypted(Buffer.from(data));
  return false;
}

function createSheetName(fileName: string, sheetName: string, rule: SheetNameRule, used: Set<string>) {
  const baseFileName = stripExtension(fileName);
  const candidate = rule === "file-sheet"
    ? `${baseFileName}_${sheetName}`
    : rule === "sheet-file"
      ? `${sheetName}_${baseFileName}`
      : sheetName;
  return createSafeUniqueName(candidate, used);
}

function createSafeUniqueName(candidate: string, used: Set<string>) {
  let sanitized = candidate.replace(/[\\/*?:[\]]/g, "_").replace(/^'+|'+$/g, "").trim() || "Sheet";
  if (sanitized.toLowerCase() === "history") sanitized = "History_";
  let name = sanitized.slice(0, 31);
  let suffix = 2;
  while (used.has(name.toLowerCase())) {
    const postfix = ` (${suffix})`;
    name = `${sanitized.slice(0, 31 - postfix.length)}${postfix}`;
    suffix += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function columnLettersToNumber(letters: string) {
  return letters.split("").reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

function columnNumberToLetters(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function planKey(fileIndex: number, sheetName: string) {
  return `${fileIndex}:${sheetName}`;
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function toArrayBuffer(value: Uint8Array | ArrayBuffer) {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function normalizeError(error: unknown) {
  if (error instanceof ExcelWorkerError) {
    return { message: error.message, code: error.code, fileName: error.fileName };
  }
  return { message: error instanceof Error ? error.message : local("파일 처리 중 오류가 발생했습니다.", "An error occurred while processing the file.") };
}

export {};
