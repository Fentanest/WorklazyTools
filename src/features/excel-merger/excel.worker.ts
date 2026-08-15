/// <reference lib="webworker" />

import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import officeCrypto from "officecrypto-tool";
import process from "process";
import { Readable } from "readable-stream";
import * as XLSX from "xlsx";

import { preserveCsvValue } from "./csvImport";
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
      const buffer = await buildWordReport(event.data.result as WordCompareResult);
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
        buffers.push(await buildWordReport(result, (value, message) => {
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
          bounds: getSheetBounds(source, options.trimEmptyEdges),
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
        const bounds = getSheetBounds(source, options.trimEmptyEdges);
        plans.push({ fileIndex, source, target, rowOffset, columnOffset, bounds });
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
    const trimStats = performSheetTrim(output, options);
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
    if (extension === "csv") return { fileName: file.name, workbook: await readCsv(file.name, data) };
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

async function readCsv(fileName: string, data: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  const stream = new Readable({ read() {} });
  stream.push(Buffer.from(data));
  stream.push(null);
  await workbook.csv.read(stream, {
    sheetName: stripExtension(fileName) || "CSV",
    map: preserveCsvValue,
  });
  return workbook;
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

        targetCell.value = normalizeSheetJsValue(sourceCell.v) as ExcelJS.CellValue;
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
  const { source, target, rowOffset, columnOffset, bounds } = plan;
  if (!bounds.rows || !bounds.columns) return;

  for (let columnIndex = 1; columnIndex <= bounds.columns; columnIndex += 1) {
    const sourceColumn = source.getColumn(columnIndex);
    const targetColumn = target.getColumn(columnIndex + columnOffset);
    if (sourceColumn.width && (!targetColumn.width || sourceColumn.width > targetColumn.width)) targetColumn.width = sourceColumn.width;
    if (sourceColumn.hidden) targetColumn.hidden = true;
    if (sourceColumn.outlineLevel) targetColumn.outlineLevel = sourceColumn.outlineLevel;
  }

  for (let rowIndex = 1; rowIndex <= bounds.rows; rowIndex += 1) {
    const sourceRow = source.getRow(rowIndex);
    const targetRow = target.getRow(rowIndex + rowOffset);
    if (sourceRow.height && (!targetRow.height || sourceRow.height > targetRow.height)) targetRow.height = sourceRow.height;
    if (sourceRow.hidden) targetRow.hidden = true;
    if (sourceRow.outlineLevel) targetRow.outlineLevel = sourceRow.outlineLevel;

    for (let columnIndex = 1; columnIndex <= bounds.columns; columnIndex += 1) {
      const sourceCell = source.getCell(rowIndex, columnIndex);
      if (sourceCell.type === ExcelJS.ValueType.Merge) continue;
      if (sourceCell.value === null && !hasCellStyle(sourceCell)) continue;

      const targetCell = target.getCell(rowIndex + rowOffset, columnIndex + columnOffset);
      copyCell(sourceCell, targetCell, plan, planLookup, options);
    }
  }

  for (const mergeRange of source.model.merges || []) {
    const merge = XLSX.utils.decode_range(mergeRange);
    if (merge.s.r >= bounds.rows || merge.s.c >= bounds.columns) continue;
    target.mergeCells(
      merge.s.r + 1 + rowOffset,
      merge.s.c + 1 + columnOffset,
      Math.min(merge.e.r + 1, bounds.rows) + rowOffset,
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
) {
  if (source.type === ExcelJS.ValueType.Formula) {
    if (options.onlyValues) {
      target.value = cloneCellValue(source.result ?? source.text ?? null);
    } else {
      target.value = {
        formula: translateFormula(source.formula, plan, planLookup, options.mergeMode),
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
) {
  const parts = formula.split(/("(?:[^"]|"")*")/g);
  const referencePattern = /(?<![A-Za-z0-9_.])(?:(?:'((?:[^']|'')+)'|([A-Za-z_가-힣][A-Za-z0-9_.가-힣]*))!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g;

  return parts.map((part, index) => {
    if (index % 2 === 1) return part;
    return part.replace(referencePattern, (match, quotedSheet, plainSheet, absoluteColumn, letters, absoluteRow, digits) => {
      const referencedSheet = (quotedSheet || plainSheet)?.replace(/''/g, "'");
      let referencePlan = currentPlan;

      if (referencedSheet) {
        referencePlan = findPlan(planLookup, currentPlan.fileIndex, referencedSheet) || currentPlan;
        if (referencePlan === currentPlan && referencedSheet.toLowerCase() !== currentPlan.source.name.toLowerCase()) return match;
      }

      const rowOffset = mode === "sheets" ? 0 : referencePlan.rowOffset;
      const columnOffset = mode === "sheets" ? 0 : referencePlan.columnOffset;
      const row = Number(digits) + rowOffset;
      const column = columnLettersToNumber(letters) + columnOffset;
      const qualifier = referencedSheet ? `${quoteSheetName(referencePlan.target.name)}!` : "";
      return `${qualifier}${absoluteColumn}${columnNumberToLetters(column)}${absoluteRow}${row}`;
    });
  }).join("");
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

function performSheetTrim(workbook: ExcelJS.Workbook, options: ExcelMergeOptions): SheetTrimStats {
  const threshold = Math.max(1, Math.floor(Number(options.sheetTrimThreshold) || 1));
  const stats: SheetTrimStats = { rows: 0, columns: 0 };

  workbook.worksheets.forEach((worksheet) => {
    if (options.sheetTrimRows) {
      const emptyRows: number[] = [];
      const lastRow = worksheet.rowCount;
      const lastColumn = worksheet.columnCount;
      for (let row = 1; row <= lastRow; row += 1) {
        if (isSheetTrimRowEmpty(worksheet, row, lastColumn)) emptyRows.push(row);
      }
      const blocks = buildSheetTrimBlocks(emptyRows, threshold);
      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const [start, count] = blocks[index];
        worksheet.spliceRows(start, count);
        stats.rows += count;
      }
    }

    if (options.sheetTrimColumns) {
      const emptyColumns: number[] = [];
      const lastRow = worksheet.rowCount;
      const lastColumn = worksheet.columnCount;
      for (let column = 1; column <= lastColumn; column += 1) {
        if (isSheetTrimColumnEmpty(worksheet, column, lastRow)) emptyColumns.push(column);
      }
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

function isSheetTrimRowEmpty(worksheet: ExcelJS.Worksheet, row: number, lastColumn: number) {
  for (let column = 1; column <= lastColumn; column += 1) {
    if (!isSheetTrimValueEmpty(worksheet.getCell(row, column).value)) return false;
  }
  return true;
}

function isSheetTrimColumnEmpty(worksheet: ExcelJS.Worksheet, column: number, lastRow: number) {
  for (let row = 1; row <= lastRow; row += 1) {
    if (!isSheetTrimValueEmpty(worksheet.getCell(row, column).value)) return false;
  }
  return true;
}

function isSheetTrimValueEmpty(value: ExcelJS.CellValue) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
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
  const sanitized = candidate.replace(/[\\/*?:[\]]/g, "_").replace(/^'+|'+$/g, "").trim() || "Sheet";
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

async function buildWordReport(result: WordCompareResult, reportProgress = progress) {
  reportProgress(10, local("보고서 생성을 시작했습니다.", "Starting report generation."));
  reportProgress(20, local("요약 시트를 구성하고 있습니다.", "Building the summary sheet."));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Worklazy Tools";
  const summary = workbook.addWorksheet(local("요약", "Summary"));
  summary.columns = [
    { header: local("항목", "Item"), key: "label", width: 24 },
    { header: local("내용", "Value"), key: "value", width: 54 },
  ];
  summary.addRows([
    { label: local("수정 전", "Before"), value: result.beforeName },
    { label: local("수정 후", "After"), value: result.afterName },
    { label: local("추가", "Added"), value: result.summary.added },
    { label: local("삭제", "Deleted"), value: result.summary.deleted },
    { label: local("내용 변경", "Content changed"), value: result.summary.changed },
    { label: local("서식 변경", "Formatting changed"), value: result.summary.format },
  ]);
  styleHeader(summary.getRow(1), "D3D3D3", "FF1D1D1F");
  summary.getCell("B8").value = {
    richText: [{ text: local("파란색 취소선", "Blue strikethrough"), font: { color: { argb: "FF0000FF" }, strike: true } }],
  };
  summary.getCell("A8").value = local("삭제 표시", "Deletion mark");
  summary.getCell("B9").value = {
    richText: [{ text: local("빨간색 굵게", "Bold red"), font: { color: { argb: "FFFF0000" }, bold: true } }],
  };
  summary.getCell("A9").value = local("삽입 표시", "Insertion mark");

  const generalChanges = result.changes.filter((change) => change.section !== "table");
  const changes = workbook.addWorksheet(local("변경 내용", "Changes"));
  reportProgress(40, local(`${generalChanges.length}개 일반 변경 내용을 보고서에 기록합니다.`, `Writing ${generalChanges.length} general changes to the report.`));
  changes.columns = [
    { header: local("구분", "Section"), key: "section", width: 13 },
    { header: local("위치", "Location"), key: "location", width: 24 },
    { header: local("수정 전", "Before"), key: "before", width: 55 },
    { header: local("수정 후", "After"), key: "after", width: 55 },
    { header: local("변경 유형", "Change type"), key: "kind", width: 14 },
  ];
  generalChanges.forEach((change) => {
    const row = changes.addRow({
      section: sectionLabel(change.section),
      location: change.location,
      kind: changeKindLabel(change.kind),
    });
    row.getCell(3).value = wordDiffRichText(change, "before");
    row.getCell(4).value = wordDiffRichText(change, "after");
  });
  styleHeader(changes.getRow(1), "D3D3D3", "FF1D1D1F");
  changes.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.height = 38;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD8D8DC" } },
        left: { style: "thin", color: { argb: "FFD8D8DC" } },
        bottom: { style: "thin", color: { argb: "FFD8D8DC" } },
        right: { style: "thin", color: { argb: "FFD8D8DC" } },
      };
    });
    const kind = row.getCell(5).value;
    if (kind === local("추가", "Added")) row.getCell(5).font = { color: { argb: "FFFF0000" }, bold: true };
    if (kind === local("삭제", "Deleted")) row.getCell(5).font = { color: { argb: "FF0000FF" }, bold: true };
    if (kind === local("서식 변경", "Formatting changed")) row.getCell(5).font = { color: { argb: "FF7C3AED" }, bold: true };
  });
  changes.views = [{ state: "frozen", ySplit: 1 }];
  changes.autoFilter = "A1:E1";

  reportProgress(62, local(`${result.tables?.length ?? 0}개 표의 전후 비교 시트를 구성합니다.`, `Building before-and-after sheets for ${result.tables?.length ?? 0} tables.`));
  buildWordTableSheets(workbook, result);

  reportProgress(85, local("보고서 서식 적용 완료 · Excel 파일 저장 중…", "Report formatting complete · Saving the Excel file…"));
  return toArrayBuffer(await workbook.xlsx.writeBuffer());
}

function buildWordTableSheets(workbook: ExcelJS.Workbook, result: WordCompareResult) {
  const beforeChanges = new Map(result.changes.filter((change) => change.section === "table" && change.beforeLocation)
    .map((change) => [change.beforeLocation, change]));
  const afterChanges = new Map(result.changes.filter((change) => change.section === "table" && change.afterLocation)
    .map((change) => [change.afterLocation, change]));

  (result.tables ?? []).forEach((table) => {
    const suffix = table.beforeIndex === null ? local(" (수정 후만)", " (after only)") : table.afterIndex === null ? local(" (수정 전만)", " (before only)") : "";
    const sheet = workbook.addWorksheet(local(`표 ${table.index + 1}${suffix}`, `Table ${table.index + 1}${suffix}`).slice(0, 31));
    const beforeWidth = Math.max(1, ...table.before.map((row) => row.length));
    const afterWidth = Math.max(1, ...table.after.map((row) => row.length));
    const afterStartColumn = beforeWidth + 2;
    const tableStartRow = 3;

    styleWordTableHeader(sheet, 1, 1, beforeWidth, table.beforeIndex === null ? local("수정 전 없음", "No before table") : local("수정 전", "Before"));
    styleWordTableHeader(sheet, 1, afterStartColumn, afterWidth, table.afterIndex === null ? local("수정 후 없음", "No after table") : local("수정 후", "After"));
    if (table.beforeIndex === null) sheet.getCell(2, afterStartColumn).value = local("이 표는 수정 후 문서에만 있습니다.", "This table exists only in the after document.");
    if (table.afterIndex === null) sheet.getCell(2, 1).value = local("이 표는 수정 전 문서에만 있습니다.", "This table exists only in the before document.");

    table.before.forEach((row, rowIndex) => row.forEach((sourceCell, columnIndex) => {
      const kind = table.beforeKinds[rowIndex]?.[columnIndex] ?? "deleted";
      const cell = sheet.getCell(tableStartRow + rowIndex, 1 + columnIndex);
      styleWordTableCell(cell, sourceCell.text, kind, "before", beforeChanges.get(sourceCell.location));
    }));
    table.after.forEach((row, rowIndex) => row.forEach((sourceCell, columnIndex) => {
      const kind = table.afterKinds[rowIndex]?.[columnIndex] ?? "added";
      const cell = sheet.getCell(tableStartRow + rowIndex, afterStartColumn + columnIndex);
      styleWordTableCell(cell, sourceCell.text, kind, "after", afterChanges.get(sourceCell.location));
    }));

    for (let column = 1; column <= beforeWidth; column += 1) sheet.getColumn(column).width = 18;
    sheet.getColumn(beforeWidth + 1).width = 3;
    for (let column = afterStartColumn; column < afterStartColumn + afterWidth; column += 1) sheet.getColumn(column).width = 18;
    sheet.views = [{ state: "frozen", ySplit: 2 }];
  });
}

function styleWordTableHeader(sheet: ExcelJS.Worksheet, row: number, startColumn: number, width: number, label: string) {
  if (width > 1) sheet.mergeCells(row, startColumn, row, startColumn + width - 1);
  const cell = sheet.getCell(row, startColumn);
  cell.value = label;
  cell.font = { bold: true, color: { argb: "FF1D1D1F" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = wordTableBorder();
}

function styleWordTableCell(
  cell: ExcelJS.Cell,
  text: string,
  kind: string,
  side: "before" | "after",
  change?: WordCompareResult["changes"][number],
) {
  if (change && (kind === "changed" || kind === "deleted" || kind === "added")) {
    cell.value = wordDiffRichText(change, side);
  } else {
    cell.value = text;
  }
  cell.alignment = { vertical: "top", wrapText: true };
  cell.border = wordTableBorder();
  if (kind === "deleted") cell.font = { color: { argb: "FF0000FF" }, strike: true };
  if (kind === "added") cell.font = { color: { argb: "FFFF0000" }, bold: true };
  if (kind === "format") {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
    cell.font = { color: { argb: "FF6D28D9" } };
  }
}

function wordTableBorder(): Partial<ExcelJS.Borders> {
  const edge = { style: "thin" as const, color: { argb: "FFBFC0C5" } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function wordDiffRichText(change: WordCompareResult["changes"][number], side: "before" | "after"): ExcelJS.CellRichTextValue {
  const allowedType = side === "before" ? "deleted" : "added";
  const segments = change.segments.filter((segment) => segment.type === "equal" || segment.type === allowedType);
  const fallbackText = side === "before" ? change.before : change.after;
  const richText = (segments.length ? segments : [{ type: allowedType, text: fallbackText }]).map((segment) => {
    if (segment.type === "deleted") {
      return { text: segment.text, font: { color: { argb: "FF0000FF" }, strike: true } };
    }
    if (segment.type === "added") {
      return { text: segment.text, font: { color: { argb: "FFFF0000" }, bold: true } };
    }
    return { text: segment.text };
  });
  return { richText };
}

function styleHeader(row: ExcelJS.Row, color: string, fontColor = "FFFFFFFF") {
  row.font = { bold: true, color: { argb: fontColor } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color.toUpperCase()}` } };
  row.alignment = { vertical: "middle" };
  row.height = 24;
}

function sectionLabel(section: string) {
  if (section === "body") return local("본문", "Body");
  if (section === "table") return local("표", "Table");
  if (section === "headerFooter") return local("머리말·꼬리말", "Header/Footer");
  if (section === "comment") return local("메모", "Comment");
  return local("각주·미주", "Footnote/Endnote");
}

function changeKindLabel(kind: string) {
  return kind === "added" ? local("추가", "Added") : kind === "deleted" ? local("삭제", "Deleted") : kind === "format" ? local("서식 변경", "Formatting changed") : local("내용 변경", "Content changed");
}

function normalizeError(error: unknown) {
  if (error instanceof ExcelWorkerError) {
    return { message: error.message, code: error.code, fileName: error.fileName };
  }
  return { message: error instanceof Error ? error.message : local("파일 처리 중 오류가 발생했습니다.", "An error occurred while processing the file.") };
}

export {};
