import type { ExcelComparePreviewSheet as SpreadsheetSheetData } from "./types.ts";
import type { ExcelCompareRecord } from "./types.ts";

export function columnAddress(column: number) {
  let result = "";
  for (let value = column; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result;
  return result;
}

/** Bounded source-ID permutation; hidden IDs never renumber the remaining rows or columns. */
export function worksheetAxisWindow(total: number, offset: number, limit: number, hidden: ReadonlySet<number>, descending = false) {
  const ids: number[] = [];
  const first = Math.max(1, Math.min(total || 1, Math.floor(offset) || 1));
  for (let position = first; position <= total && ids.length < limit; position++) {
    const id = descending ? total - position + 1 : position;
    if (!hidden.has(id)) ids.push(id);
  }
  return ids;
}

/** An index over engine decisions, never a second cell matcher. Row-only decisions cover source rows. */
export function worksheetRecordIndex(records: readonly ExcelCompareRecord[], side: "left" | "right") {
  const cells = new Map<string, ExcelCompareRecord[]>(), rows = new Map<number, ExcelCompareRecord[]>();
  const append = <K>(map: Map<K, ExcelCompareRecord[]>, key: K, record: ExcelCompareRecord) => {
    const previous = map.get(key); if (previous) previous.push(record); else map.set(key, [record]);
  };
  for (const record of records) {
    const row = record[`${side}Row`], column = record[`${side}Column`];
    if (row !== null && column !== null) append(cells, `${row}:${column}`, record);
    else {
      const sourceRows = record.status === "duplicate" ? record[`${side}Rows`] : record.sourceRows?.[side] ?? (row === null ? [] : [row]);
      for (const sourceRow of sourceRows) append(rows, sourceRow, record);
    }
  }
  return { cells, rows };
}

export function worksheetCellIndex(sheet: SpreadsheetSheetData) {
  return new Map(sheet.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
}
