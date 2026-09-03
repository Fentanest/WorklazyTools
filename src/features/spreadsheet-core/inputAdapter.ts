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
export type SpreadsheetFormulaType = "normal" | "shared" | "array";
export type SpreadsheetFormulaCacheState = "present" | "missing";

export interface SpreadsheetRowLineage {
  id: string;
  sourceRow: number;
}

export interface SpreadsheetColumnLineage {
  id: string;
  sourceColumn: number;
}

export interface SpreadsheetCellData {
  row: number;
  column: number;
  address: string;
  type: SpreadsheetCellType;
  value: SpreadsheetScalar;
  formula?: string;
  cachedValue?: SpreadsheetScalar;
  cacheState?: SpreadsheetFormulaCacheState;
  formulaType?: SpreadsheetFormulaType;
  formulaRef?: string;
  sharedFormulaMaster?: string;
  sourceRow: number;
  sourceColumn: number;
  rowLineageId: string;
  columnLineageId: string;
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
  rowLineage: SpreadsheetRowLineage[];
  columnLineage: SpreadsheetColumnLineage[];
  tables: SpreadsheetTableData[];
}

export interface SpreadsheetDefinedNameData {
  name: string;
  ranges: string[];
  formula?: string;
  localSheetId?: number;
  hidden?: boolean;
}

export interface SpreadsheetTableData {
  name: string;
  displayName: string;
  ref: string;
  columns: string[];
}

export interface SpreadsheetBookData {
  format: SpreadsheetInputFormat;
  date1904: boolean;
  supportsStyleComparison: boolean;
  themePalette?: ExcelThemePalette;
  definedNames: SpreadsheetDefinedNameData[];
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
  const [formulaCacheStates, rawDefinedNames] = await Promise.all([
    readOoxmlFormulaCacheStates(archive, workbookXml ?? ""),
    Promise.resolve(readOoxmlDefinedNames(workbookXml ?? "")),
  ]);
  throwIfAborted(signal);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(data));
  // ExcelJS 4.4 applies the 1904 offset inconsistently and does not surface the
  // workbook flag after loading. Read the OOXML flag directly, then compensate
  // only when ExcelJS did not report that it already handled the date system.
  const date1904 = /\bdate1904\s*=\s*["'](?:1|true)["']/iu.test(workbookXml ?? "");
  const adjustExcelJsDate = date1904 && workbook.properties.date1904 !== true;
  const sheets = workbook.worksheets.map((worksheet, sheetIndex) => {
    const cells: SpreadsheetCellData[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const formula = cell.formula || undefined;
        const rawModel = cell.model as ExcelJS.CellModel & { shareType?: "shared" | "array"; ref?: string };
        const cacheState = formula ? formulaCacheStates[sheetIndex]?.get(cell.address) ?? (cell.result === undefined ? "missing" : "present") : undefined;
        const cachedValue = formula && cacheState === "present"
          ? cell.result === undefined ? "" : normalizeExcelJsValue(cell.result, adjustExcelJsDate)
          : undefined;
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
          cacheState,
          formulaType: formula ? formulaType(rawModel) : undefined,
          formulaRef: rawModel.ref,
          sharedFormulaMaster: rawModel.sharedFormula,
          sourceRow: rowNumber,
          sourceColumn: columnNumber,
          rowLineageId: rowLineageId(rowNumber),
          columnLineageId: columnLineageId(columnNumber),
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
      rowLineage: createRowLineage(worksheet.rowCount),
      columnLineage: createColumnLineage(worksheet.columnCount),
      tables: (worksheet.getTables() as unknown as Array<{ model: ExcelJS.TableProperties & { tableRef?: string } }>).map(({ model }) => ({
        name: model.name,
        displayName: model.displayName ?? model.name,
        ref: model.tableRef ?? model.ref,
        columns: model.columns.map((column) => column.name),
      })),
    };
  });
  return {
    format,
    date1904,
    supportsStyleComparison: true,
    themePalette,
    definedNames: mergeDefinedNames(workbook.definedNames.model, rawDefinedNames),
    sheets,
  };
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
            cacheState: cell.f ? (cell.v === undefined ? "missing" : "present") : undefined,
            formulaType: cell.f ? "normal" : undefined,
            sourceRow: row + 1,
            sourceColumn: column + 1,
            rowLineageId: rowLineageId(row + 1),
            columnLineageId: columnLineageId(column + 1),
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
      rowLineage: createRowLineage(range ? range.e.r + 1 : 0),
      columnLineage: createColumnLineage(range ? range.e.c + 1 : 0),
      tables: [],
    };
  });
  return { format, date1904, supportsStyleComparison: false, definedNames: [], sheets };
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
        sourceRow: rowIndex + 1,
        sourceColumn: columnIndex + 1,
        rowLineageId: rowLineageId(rowIndex + 1),
        columnLineageId: columnLineageId(columnIndex + 1),
        displayValue: value,
      });
    });
  });
  return {
    format: "csv",
    date1904: false,
    supportsStyleComparison: false,
    definedNames: [],
    sheets: [{
      name: "CSV",
      rowCount: result.data.length,
      columnCount,
      cells,
      merges: [],
      rowLineage: createRowLineage(result.data.length),
      columnLineage: createColumnLineage(columnCount),
      tables: [],
    }],
  };
}

function formulaType(model: ExcelJS.CellModel & { shareType?: "shared" | "array" }): SpreadsheetFormulaType {
  if (model.shareType === "array") return "array";
  if (model.shareType === "shared" || model.sharedFormula) return "shared";
  return "normal";
}

async function readOoxmlFormulaCacheStates(archive: JSZip, workbookXml: string) {
  const relationshipXml = await archive.file("xl/_rels/workbook.xml.rels")?.async("string") ?? "";
  const targets = new Map<string, string>();
  for (const match of relationshipXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/giu)) {
    const id = xmlAttribute(match[1], "Id");
    const target = xmlAttribute(match[1], "Target");
    if (id && target) targets.set(id, target);
  }
  const paths = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/giu)].map((match, index) => {
    const relationId = xmlAttribute(match[1], "r:id");
    const target = relationId ? targets.get(relationId) : undefined;
    if (!target) return `xl/worksheets/sheet${index + 1}.xml`;
    const normalized = target.replace(/^\/+|\.\.\//gu, "");
    return normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
  });
  return Promise.all(paths.map(async (path) => {
    const states = new Map<string, SpreadsheetFormulaCacheState>();
    const xml = await archive.file(path)?.async("string") ?? "";
    for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/giu)) {
      if (!/<f(?:\s[^>]*)?>/iu.test(match[2])) continue;
      const address = xmlAttribute(match[1], "r");
      if (address) states.set(address, /<v(?:\s[^>]*)?>/iu.test(match[2]) ? "present" : "missing");
    }
    return states;
  }));
}

function readOoxmlDefinedNames(workbookXml: string): SpreadsheetDefinedNameData[] {
  return [...workbookXml.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/giu)].map((match) => ({
    name: decodeXmlText(xmlAttribute(match[1], "name") ?? ""),
    ranges: [],
    formula: decodeXmlText(match[2]),
    localSheetId: optionalInteger(xmlAttribute(match[1], "localSheetId")),
    hidden: /^(?:1|true)$/iu.test(xmlAttribute(match[1], "hidden") ?? ""),
  })).filter((item) => item.name.length > 0);
}

function mergeDefinedNames(excelNames: ExcelJS.DefinedNamesModel, rawNames: SpreadsheetDefinedNameData[]) {
  const remaining = [...rawNames];
  const result = excelNames.map((item) => {
    const index = remaining.findIndex((raw) => raw.name === item.name);
    const raw = index >= 0 ? remaining.splice(index, 1)[0] : undefined;
    return { ...raw, name: item.name, ranges: [...item.ranges] };
  });
  return [...result, ...remaining];
}

function xmlAttribute(attributes: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return attributes.match(new RegExp(`(?:^|\\s)${escaped}=["']([^"']*)["']`, "iu"))?.[1];
}

function decodeXmlText(value: string) {
  return value.replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&amp;/gu, "&");
}

function optionalInteger(value: string | undefined) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function rowLineageId(row: number) { return `row:${row}`; }
function columnLineageId(column: number) { return `column:${column}`; }
function createRowLineage(count: number): SpreadsheetRowLineage[] {
  return Array.from({ length: count }, (_, index) => ({ id: rowLineageId(index + 1), sourceRow: index + 1 }));
}
function createColumnLineage(count: number): SpreadsheetColumnLineage[] {
  return Array.from({ length: count }, (_, index) => ({ id: columnLineageId(index + 1), sourceColumn: index + 1 }));
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
