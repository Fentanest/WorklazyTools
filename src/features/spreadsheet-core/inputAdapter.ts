import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  expandSpreadsheetMlCdata,
  hasOleCompoundSignatureBytes,
  hasSpreadsheetMlSignature,
} from "./signatures.ts";
import { bakeThemeColorsInStyle, parseThemePalette, type ExcelThemePalette } from "./themeColors.ts";

export type SpreadsheetInputFormat = "xlsx" | "xlsm" | "xls" | "xlsb" | "spreadsheetml" | "csv";
export type SpreadsheetCellType = "blank" | "string" | "number" | "boolean" | "date" | "error";
export type SpreadsheetScalar = string | number | boolean | Date | null;

export interface SpreadsheetCellData {
  row: number;
  column: number;
  address: string;
  type: SpreadsheetCellType;
  value: SpreadsheetScalar;
  formula?: string;
  cachedValue?: SpreadsheetScalar;
  displayValue?: string;
  numberFormat?: string;
  style?: SpreadsheetComparableStyle;
}

export interface SpreadsheetComparableStyle {
  numFmt?: string;
  font?: unknown;
  fill?: unknown;
  border?: unknown;
  alignment?: unknown;
  protection?: unknown;
}

export interface SpreadsheetSheetData {
  name: string;
  rowCount: number;
  columnCount: number;
  cells: SpreadsheetCellData[];
  merges: string[];
}

export interface SpreadsheetBookData {
  format: SpreadsheetInputFormat;
  date1904: boolean;
  supportsStyleComparison: boolean;
  themePalette?: ExcelThemePalette;
  sheets: SpreadsheetSheetData[];
}

export interface SpreadsheetSheetSelection {
  sheetName: string;
  headerRow: number;
}

export class SpreadsheetInputError extends Error {
  readonly code: "UNSUPPORTED_FORMAT" | "ENCRYPTED_FILE" | "DAMAGED_FILE" | "CSV_PARSE_ERROR";

  constructor(code: "UNSUPPORTED_FORMAT" | "ENCRYPTED_FILE" | "DAMAGED_FILE" | "CSV_PARSE_ERROR") {
    super(code);
    this.code = code;
    this.name = "SpreadsheetInputError";
  }
}

export async function classifySpreadsheetInput(fileName: string, data: Uint8Array): Promise<SpreadsheetInputFormat> {
  if (hasSpreadsheetMlSignature(data)) return "spreadsheetml";
  if (isZip(data)) {
    try {
      const archive = await JSZip.loadAsync(data);
      if (archive.file("xl/workbook.bin")) return "xlsb";
      if (archive.file("xl/workbook.xml")) {
        const contentTypes = await archive.file("[Content_Types].xml")?.async("string");
        return /application\/vnd\.ms-excel\.sheet\.macroEnabled\.main\+xml/i.test(contentTypes ?? "") ? "xlsm" : "xlsx";
      }
    } catch {
      throw new SpreadsheetInputError("DAMAGED_FILE");
    }
    throw new SpreadsheetInputError("UNSUPPORTED_FORMAT");
  }
  if (hasOleCompoundSignatureBytes(data)) {
    const extension = fileExtension(fileName);
    if (["xlsx", "xlsm", "xlsb"].includes(extension)) throw new SpreadsheetInputError("ENCRYPTED_FILE");
    return "xls";
  }
  if (fileExtension(fileName) === "csv") return "csv";
  throw new SpreadsheetInputError("UNSUPPORTED_FORMAT");
}

export async function parseSpreadsheetInput(
  fileName: string,
  buffer: ArrayBuffer,
  options: { csvEncoding?: "auto" | "utf-8" | "euc-kr"; signal?: AbortSignal } = {},
): Promise<SpreadsheetBookData> {
  throwIfAborted(options.signal);
  const data = new Uint8Array(buffer);
  const format = await classifySpreadsheetInput(fileName, data);
  throwIfAborted(options.signal);
  if (format === "csv") return parseCsv(data, options.csvEncoding, options.signal);
  if (format === "xlsx" || format === "xlsm") return parseOoxml(data, format, options.signal);
  return parseSheetJs(data, format, options.signal);
}

export function validateSpreadsheetSelection(book: SpreadsheetBookData, selection: SpreadsheetSheetSelection) {
  const sheet = book.sheets.find((candidate) => candidate.name === selection.sheetName);
  if (!sheet) return false;
  return Number.isInteger(selection.headerRow) && selection.headerRow >= 1 && selection.headerRow <= Math.max(1, sheet.rowCount);
}

export function spreadsheetHeaders(sheet: SpreadsheetSheetData, headerRow: number) {
  const cells = new Map(sheet.cells.filter((cell) => cell.row === headerRow).map((cell) => [cell.column, cell]));
  return Array.from({ length: sheet.columnCount }, (_, index) => {
    const column = index + 1;
    const text = cells.get(column)?.displayValue ?? scalarText(cells.get(column)?.value ?? null);
    return { column, name: text || XLSX.utils.encode_col(index) };
  });
}

async function parseOoxml(data: Uint8Array, format: "xlsx" | "xlsm", signal?: AbortSignal): Promise<SpreadsheetBookData> {
  const archive = await JSZip.loadAsync(data);
  const [themeXml, workbookXml] = await Promise.all([
    archive.file("xl/theme/theme1.xml")?.async("string"),
    archive.file("xl/workbook.xml")?.async("string"),
  ]);
  const themePalette = themeXml ? parseThemePalette(themeXml) : undefined;
  throwIfAborted(signal);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(data));
  // ExcelJS 4.4 applies the 1904 offset inconsistently and does not surface the
  // workbook flag after loading. Read the OOXML flag directly, then compensate
  // only when ExcelJS did not report that it already handled the date system.
  const date1904 = /\bdate1904\s*=\s*["'](?:1|true)["']/iu.test(workbookXml ?? "");
  const adjustExcelJsDate = date1904 && workbook.properties.date1904 !== true;
  const sheets = workbook.worksheets.map((worksheet) => {
    const cells: SpreadsheetCellData[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const formula = cell.formula || undefined;
        const cachedValue = formula ? normalizeExcelJsValue(cell.result, adjustExcelJsDate) : undefined;
        const value = formula ? cachedValue ?? null : normalizeExcelJsValue(cell.value, adjustExcelJsDate);
        const numberFormat = cell.numFmt || undefined;
        cells.push({
          row: rowNumber,
          column: columnNumber,
          address: cell.address,
          type: scalarType(value),
          value,
          formula,
          cachedValue,
          displayValue: formatDisplayValue(value, numberFormat, date1904),
          numberFormat,
          style: comparableStyle(cell.style, themePalette),
        });
      });
      throwIfAborted(signal);
    });
    return {
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      cells,
      merges: [...(worksheet.model.merges ?? [])],
    };
  });
  return { format, date1904, supportsStyleComparison: true, themePalette, sheets };
}

function parseSheetJs(
  data: Uint8Array,
  format: "xls" | "xlsb" | "spreadsheetml",
  signal?: AbortSignal,
): SpreadsheetBookData {
  const source = XLSX.read(
    format === "spreadsheetml" ? expandSpreadsheetMlCdata(new TextDecoder("utf-8").decode(data)) : data,
    {
      type: format === "spreadsheetml" ? "string" : "array",
      cellDates: true,
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
    },
  );
  const date1904 = source.Workbook?.WBProps?.date1904 === true;
  const sheets = source.SheetNames.map((name) => {
    const worksheet = source.Sheets[name];
    const cells: SpreadsheetCellData[] = [];
    const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : undefined;
    if (range) {
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let column = range.s.c; column <= range.e.c; column += 1) {
          const address = XLSX.utils.encode_cell({ r: row, c: column });
          const cell = worksheet[address];
          if (!cell) continue;
          const value = normalizeSheetJsValue(cell.v);
          cells.push({
            row: row + 1,
            column: column + 1,
            address,
            type: scalarType(value, cell.t === "e"),
            value,
            formula: cell.f === undefined ? undefined : String(cell.f),
            cachedValue: cell.f ? value : undefined,
            displayValue: cell.w ?? formatDisplayValue(value, cell.z, date1904),
            numberFormat: cell.z || undefined,
          });
        }
        if ((row & 255) === 0) throwIfAborted(signal);
      }
    }
    return {
      name,
      rowCount: range ? range.e.r + 1 : 0,
      columnCount: range ? range.e.c + 1 : 0,
      cells,
      merges: (worksheet["!merges"] ?? []).map((merge) => XLSX.utils.encode_range(merge)),
    };
  });
  return { format, date1904, supportsStyleComparison: false, sheets };
}

function parseCsv(data: Uint8Array, encoding: "auto" | "utf-8" | "euc-kr" = "auto", signal?: AbortSignal): SpreadsheetBookData {
  const text = decodeCsv(data, encoding);
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  if (result.errors.some((error) => error.type === "Quotes")) throw new SpreadsheetInputError("CSV_PARSE_ERROR");
  const cells: SpreadsheetCellData[] = [];
  let columnCount = 0;
  result.data.forEach((row, rowIndex) => {
    throwIfAborted(signal);
    columnCount = Math.max(columnCount, row.length);
    row.forEach((value, columnIndex) => {
      if (value === "") return;
      cells.push({
        row: rowIndex + 1,
        column: columnIndex + 1,
        address: XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex }),
        type: "string",
        value,
        displayValue: value,
      });
    });
  });
  return {
    format: "csv",
    date1904: false,
    supportsStyleComparison: false,
    sheets: [{ name: "CSV", rowCount: result.data.length, columnCount, cells, merges: [] }],
  };
}

function comparableStyle(style: Partial<ExcelJS.Style>, palette?: ExcelThemePalette): SpreadsheetComparableStyle | undefined {
  if (!style || !Object.keys(style).length) return undefined;
  const cloned = bakeThemeColorsInStyle(structuredClone(style), palette);
  return {
    numFmt: cloned.numFmt || undefined,
    font: cloned.font ? structuredClone(cloned.font) : undefined,
    fill: cloned.fill ? structuredClone(cloned.fill) : undefined,
    border: cloned.border ? structuredClone(cloned.border) : undefined,
    alignment: cloned.alignment ? structuredClone(cloned.alignment) : undefined,
    protection: cloned.protection ? structuredClone(cloned.protection) : undefined,
  };
}

function normalizeExcelJsValue(value: ExcelJS.CellValue | undefined, adjustDate1904 = false): SpreadsheetScalar {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return adjustDate1904 ? new Date(value.getTime() + 1_462 * 86_400_000) : value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if ("error" in value) return value.error;
  if ("text" in value) return value.text;
  if ("richText" in value) return value.richText.map((run) => run.text).join("");
  if ("formula" in value) return normalizeExcelJsValue(value.result, adjustDate1904);
  return String(value);
}

function normalizeSheetJsValue(value: unknown): SpreadsheetScalar {
  if (value === undefined || value === null) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function scalarType(value: SpreadsheetScalar, error = false): SpreadsheetCellType {
  if (error) return "error";
  if (value === null) return "blank";
  if (value instanceof Date) return "date";
  return typeof value as "string" | "number" | "boolean";
}

function formatDisplayValue(value: SpreadsheetScalar, numberFormat: string | undefined, date1904: boolean) {
  if (value === null) return "";
  if (!numberFormat) return scalarText(value);
  try {
    const input = value instanceof Date ? dateToExcelSerial(value, date1904) : value;
    return XLSX.SSF.format(numberFormat, input, { date1904 });
  } catch {
    return scalarText(value);
  }
}

function dateToExcelSerial(value: Date, date1904: boolean) {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return (value.getTime() - epoch) / 86_400_000;
}

function scalarText(value: SpreadsheetScalar) {
  return value instanceof Date ? value.toISOString() : value === null ? "" : String(value);
}

function decodeCsv(data: Uint8Array, encoding: "auto" | "utf-8" | "euc-kr") {
  if (encoding !== "auto") return new TextDecoder(encoding, { fatal: true }).decode(data);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(data); }
  catch { return new TextDecoder("euc-kr", { fatal: true }).decode(data); }
}

function isZip(data: Uint8Array) {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b
    && ((data[2] === 0x03 && data[3] === 0x04) || (data[2] === 0x05 && data[3] === 0x06) || (data[2] === 0x07 && data[3] === 0x08));
}

function fileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
}
