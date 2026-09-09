import * as XLSX from "xlsx";

import type { SpreadsheetCellData, SpreadsheetSheetData } from "../spreadsheet-core/inputAdapter.ts";
import type { ExcelCompareHeaderSuggestion } from "./types.ts";

const HEADER_CANDIDATE_MAX_ROW = 20;
const HEADER_SUPPORT_ROW_COUNT = 5;

/**
 * Suggests one conservative header row from the bounded physical-row prefix.
 * A non-suggested result deliberately carries no row so callers fall back to
 * their user-editable default instead of treating an uncertain row as final.
 */
export function detectExcelCompareHeader(sheet: SpreadsheetSheetData): ExcelCompareHeaderSuggestion {
  const sampledRows = new Map<number, SpreadsheetCellData[]>();
  const sampleLastRow = HEADER_CANDIDATE_MAX_ROW + HEADER_SUPPORT_ROW_COUNT;
  for (const cell of sheet.cells) {
    if (cell.row > sampleLastRow || cell.value === null || String(cell.value).trim() === "") continue;
    const row = sampledRows.get(cell.row);
    if (row) row.push(cell);
    else sampledRows.set(cell.row, [cell]);
  }

  const horizontalMergedRows = new Set<number>();
  const verticalMergedRows = new Set<number>();
  for (const encodedRange of sheet.merges) {
    const range = XLSX.utils.decode_range(encodedRange);
    for (let row = Math.max(1, range.s.r + 1); row <= Math.min(HEADER_CANDIDATE_MAX_ROW, range.e.r + 1); row += 1) {
      if (range.e.c > range.s.c) horizontalMergedRows.add(row);
      if (range.e.r > range.s.r) verticalMergedRows.add(row);
    }
  }

  const lastCandidateRow = Math.min(HEADER_CANDIDATE_MAX_ROW, sheet.rowCount);
  for (let row = 1; row <= lastCandidateRow; row += 1) {
    const cells = sampledRows.get(row) ?? [];
    if (cells.length === 0 || horizontalMergedRows.has(row)) continue;

    const rowsBelow = Array.from(
      { length: Math.min(HEADER_SUPPORT_ROW_COUNT, sheet.rowCount - row) },
      (_value, index) => sampledRows.get(row + index + 1) ?? [],
    ).filter((candidate) => candidate.length > 0);

    if (!verticalMergedRows.has(row) && cells.length === 1 && rowsBelow.some((candidate) => candidate.length >= 2)) continue;

    const candidateColumns = new Set(cells.map((cell) => cell.column));
    const minimumSupportCells = Math.ceil(cells.length * 0.4);
    const supportingRows = rowsBelow.filter((candidate) => (
      candidate.filter((cell) => candidateColumns.has(cell.column)).length >= minimumSupportCells
    ));
    const plainStringCells = cells.filter((cell) => cell.type === "string" && !cell.formula);
    const hasUniqueValues = new Set(cells.map((cell) => String(cell.value).trim())).size === cells.length;

    if (
      cells.length >= 2
      && plainStringCells.length / cells.length >= 0.5
      && hasUniqueValues
      && supportingRows.length >= 2
      && !verticalMergedRows.has(row)
    ) {
      return { row, reason: "suggested" };
    }
    return { row: null, reason: "uncertain" };
  }

  return { row: null, reason: "none" };
}
