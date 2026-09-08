import { spreadsheetHeaders, type SpreadsheetBookData } from "../spreadsheet-core/inputAdapter.ts";
import { detectExcelCompareHeader } from "./headerDetection.ts";
import type { ExcelCompareInspection } from "./types.ts";

export function buildExcelCompareInspection(
  fileName: string,
  book: SpreadsheetBookData,
  requestedHeaderRows: number[] = [1],
  detectHeader = true,
): ExcelCompareInspection {
  return {
    fileName,
    format: book.format,
    supportsStyleComparison: book.supportsStyleComparison,
    sheets: book.sheets.map((sheet) => {
      const headerSuggestion = detectHeader ? detectExcelCompareHeader(sheet) : undefined;
      const rows = new Set(requestedHeaderRows.length > 0 ? requestedHeaderRows : [1]);
      const suggestedRow = headerSuggestion?.row;
      if (headerSuggestion?.reason === "suggested" && suggestedRow !== null && suggestedRow !== undefined) rows.add(suggestedRow);
      const maximumRow = Math.max(1, sheet.rowCount);
      return {
        name: sheet.name,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        headerRows: [...rows]
          .filter((row) => Number.isInteger(row) && row >= 1 && row <= maximumRow)
          .map((row) => ({ row, values: spreadsheetHeaders(sheet, row).map((header) => header.name) })),
        ...(headerSuggestion ? { headerSuggestion } : {}),
      };
    }),
  };
}
