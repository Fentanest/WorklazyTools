import * as XLSX from "xlsx";
import Papa from "papaparse";
import { INPUT_LIMITS, ProductBannerInputError, type CellValue, type InputBook, type InputFormat, type InputSheet } from "./inputTypes.ts";

const cfbMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const isHtmlDocument = (text: string) => /^[\s\uFEFF]*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|html\b|head\b|body\b|table\b|script\b)/iu.test(text);
export function sniffInputFormat(bytes: Uint8Array): InputFormat {
  if (!bytes.length) throw new ProductBannerInputError("EMPTY_FILE");
  if (bytes.length > INPUT_LIMITS.fileBytes) throw new ProductBannerInputError("FILE_TOO_LARGE");
  if (cfbMagic.every((value, i) => bytes[i] === value)) return "xls";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4) return "xlsx";
  if (bytes[0] === 9 && [0, 2, 4, 8].includes(bytes[1]) && bytes.length >= 4) return "xls";
  let prefix: string;
  try { prefix = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 4096)), { stream: true }); }
  catch { throw new ProductBannerInputError("UNSUPPORTED_FORMAT"); }
  if (isHtmlDocument(prefix)) throw new ProductBannerInputError("HTML_XLS_UNSUPPORTED");
  if (/^[\s\uFEFF]*</u.test(prefix) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(prefix)) throw new ProductBannerInputError("UNSUPPORTED_FORMAT");
  return "csv";
}

// Internal exceptions are inspected only to classify them; never returned or logged.
export function classifyInputError(error: unknown): ProductBannerInputError {
  if (error instanceof ProductBannerInputError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new ProductBannerInputError("CANCELED");
  const message = error instanceof Error ? error.message : "";
  return new ProductBannerInputError(/password|encrypt|FilePass/iu.test(message) ? "ENCRYPTED_FILE" : "DAMAGED_FILE");
}

function sheetCells(sheet: XLSX.WorkSheet, name: string, budget: { cells: number }): InputSheet {
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  if (!range) return { name, rows: [], rowCount: 0, columnCount: 0 };
  const rowCount = range.e.r + 1, columnCount = range.e.c + 1;
  budget.cells += rowCount * columnCount;
  if (!Number.isSafeInteger(budget.cells) || budget.cells > INPUT_LIMITS.worksheetCells) throw new ProductBannerInputError("CELL_LIMIT");
  const rows: InputSheet["rows"] = [];
  for (let r = 0; r < rowCount; r++) {
    const cells: (CellValue | null)[] = [];
    for (let c = 0; c < columnCount; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell || (cell.v == null && !cell.f)) { cells.push(null); continue; }
      const kind = cell.t === "n" ? "number" : cell.t === "b" ? "boolean" : cell.t === "e" ? "error" : "string";
      cells.push({ text: cell.v == null ? "" : String(cell.v), kind, display: cell.w,
        hyperlink: cell.l?.Target, formula: Boolean(cell.f), cacheMissing: Boolean(cell.f && cell.v == null),
        unsafeInteger: kind === "number" && Number.isInteger(cell.v) && !Number.isSafeInteger(cell.v) });
    }
    if (cells.some((cell) => cell && (cell.text.trim() || cell.formula))) rows.push({ rowNumber: r + 1, cells });
  }
  return { name, rows, rowCount, columnCount };
}

export function parseInputBytes(buffer: ArrayBuffer): InputBook {
  const bytes = new Uint8Array(buffer), format = sniffInputFormat(bytes);
  if (format === "csv") {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new ProductBannerInputError("CSV_INVALID"); }
    if (!text.trim()) throw new ProductBannerInputError("EMPTY_FILE");
    if (isHtmlDocument(text)) throw new ProductBannerInputError("HTML_XLS_UNSUPPORTED");
    const parsed = Papa.parse<string[]>(text, { dynamicTyping: false, skipEmptyLines: false, delimiter: "," });
    if (parsed.errors.length) throw new ProductBannerInputError("CSV_INVALID");
    const columnCount = parsed.data.reduce((max, row) => Math.max(max, row.length), 0);
    if (parsed.data.length * columnCount > INPUT_LIMITS.worksheetCells) throw new ProductBannerInputError("CELL_LIMIT");
    // Keep physical record positions including empty records for header selection/provenance.
    const records = parsed.data;
    return { format, sheets: [{ name: "CSV", columnCount, rowCount: records.length,
      rows: records.flatMap((row, i) => row.some((value) => value.trim()) ? [{ rowNumber: i + 1, cells: row.map((value) => ({ text: value, kind: "string" as const })) }] : []) }] };
  }
  try {
    const book = XLSX.read(bytes, { type: "array", cellFormula: true, cellText: true, cellHTML: false, bookVBA: false, WTF: true });
    if (format === "xlsx" && book.bookType !== "xlsx") throw new ProductBannerInputError("UNSUPPORTED_FORMAT");
    if (!book.SheetNames.length) throw new ProductBannerInputError("DAMAGED_FILE");
    if (book.SheetNames.length > INPUT_LIMITS.sheets) throw new ProductBannerInputError("SHEET_LIMIT");
    const budget = { cells: 0 };
    return { format, sheets: book.SheetNames.map((name) => sheetCells(book.Sheets[name], name, budget)) };
  } catch (error) { throw classifyInputError(error); }
}
