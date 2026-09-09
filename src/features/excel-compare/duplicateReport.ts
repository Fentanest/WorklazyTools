import type { ExcelCompareDuplicateRecord } from "./types.ts";

export const DUPLICATE_REPORT_CELL_LIMIT = 32_767;
export const DUPLICATE_REPORT_LIST_CELL_LIMIT = 16_000;
export const DUPLICATE_REPORT_MULTILINE_KEY_LIMIT = 16_000;
export const DUPLICATE_KEY_TOO_LONG = "DUPLICATE_KEY_TOO_LONG";
export const DUPLICATE_REPORT_LAYOUT = "independent-side-chunks-v1";
export const DUPLICATE_REPORT_ROW_NOTATION = "r [i/n] means part i of n of source row r. Repeated r is not another source row. Left and right lists are independent, not matched.";

interface SideChunk {
  rows: string;
  values: string;
}

export interface DuplicateReportRow {
  record: ExcelCompareDuplicateRecord;
  leftRows: string;
  rightRows: string;
  leftValues: string;
  rightValues: string;
}

export interface DuplicateReportGroupRange {
  group: number;
  startRow: number;
  endRow: number;
}

export interface DuplicateReportLayoutResult {
  rows: DuplicateReportRow[];
  ranges: DuplicateReportGroupRange[];
  splitGroupCount: number;
}

export function formatDuplicateReportRows(
  records: ExcelCompareDuplicateRecord[],
  checkCanceled: () => void = () => undefined,
): DuplicateReportLayoutResult {
  const rows: DuplicateReportRow[] = [];
  const ranges: DuplicateReportGroupRange[] = [];
  const sourceRowsProcessed = { value: 0 };
  let splitGroupCount = 0;

  records.forEach((record, recordIndex) => {
    assertDuplicateRecord(record);
    assertDuplicateDisplayKeyLength(record.displayKey);
    const left = splitSide(record.leftRows, record.leftValues, checkCanceled, sourceRowsProcessed);
    const right = splitSide(record.rightRows, record.rightValues, checkCanceled, sourceRowsProcessed);
    const reportRowCount = Math.max(left.length, right.length);
    const startRow = rows.length + 2;
    if (reportRowCount > 1) splitGroupCount += 1;
    for (let index = 0; index < reportRowCount; index += 1) {
      rows.push({
        record,
        leftRows: left[index]?.rows ?? "",
        rightRows: right[index]?.rows ?? "",
        leftValues: left[index]?.values ?? "",
        rightValues: right[index]?.values ?? "",
      });
    }
    ranges.push({ group: recordIndex + 1, startRow, endRow: rows.length + 1 });
  });

  return { rows, ranges, splitGroupCount };
}

export function duplicateReportParameters(
  applicable: boolean,
  layout: DuplicateReportLayoutResult,
): Array<[string, string]> {
  if (!applicable) {
    return [
      ["duplicateCountUnit", "UNUSED"],
      ["duplicateReportSplit", "UNUSED"],
      ["duplicateReportSplitGroupCount", "UNUSED"],
      ["duplicateReportDataRows", "UNUSED"],
      ["duplicateReportCellLimit", "UNUSED"],
      ["duplicateReportListCellLimit", "UNUSED"],
      ["duplicateReportMultilineKeyLimit", "UNUSED"],
      ["duplicateReportLayout", "UNUSED"],
      ["duplicateReportRowNotation", "UNUSED"],
    ];
  }
  return [
    ["duplicateCountUnit", "key-group"],
    ["duplicateReportSplit", String(layout.splitGroupCount > 0)],
    ["duplicateReportSplitGroupCount", String(layout.splitGroupCount)],
    ["duplicateReportDataRows", String(layout.rows.length)],
    ["duplicateReportCellLimit", String(DUPLICATE_REPORT_CELL_LIMIT)],
    ["duplicateReportListCellLimit", String(DUPLICATE_REPORT_LIST_CELL_LIMIT)],
    ["duplicateReportMultilineKeyLimit", String(DUPLICATE_REPORT_MULTILINE_KEY_LIMIT)],
    ["duplicateReportLayout", DUPLICATE_REPORT_LAYOUT],
    ["duplicateReportRowNotation", DUPLICATE_REPORT_ROW_NOTATION],
    ...layout.ranges.map((range) => [
      `duplicateReportGroup.${range.group}`,
      `Duplicates!${range.startRow}:${range.endRow}`,
    ] as [string, string]),
  ];
}

function splitSide(
  rows: number[],
  values: string[],
  checkCanceled: () => void,
  processed: { value: number },
): SideChunk[] {
  if (!rows.length) return [];
  const chunks: SideChunk[] = [];
  let currentRows: string[] = [];
  let currentValues: string[] = [];
  let currentRowsLength = 0;
  let currentValuesLength = 0;

  const flush = () => {
    if (!currentRows.length) return;
    chunks.push({ rows: currentRows.join(", "), values: currentValues.join("\n") });
    currentRows = [];
    currentValues = [];
    currentRowsLength = 0;
    currentValuesLength = 0;
  };

  rows.forEach((row, index) => {
    const value = values[index];
    const rowText = String(row);
    const valuePrefix = `${row}: `;
    const valueText = `${valuePrefix}${value}`;
    if (valueText.length > DUPLICATE_REPORT_LIST_CELL_LIMIT) {
      flush();
      const parts = splitLongValue(value, DUPLICATE_REPORT_LIST_CELL_LIMIT - valuePrefix.length, checkCanceled);
      parts.forEach((part, partIndex) => {
        chunks.push({
          rows: `${row} [${partIndex + 1}/${parts.length}]`,
          values: `${valuePrefix}${part}`,
        });
      });
      processed.value += 1;
      return;
    }

    const nextRowsLength = currentRowsLength + (currentRows.length ? 2 : 0) + rowText.length;
    const nextValuesLength = currentValuesLength + (currentValues.length ? 1 : 0) + valueText.length;
    if (currentRows.length && (nextRowsLength > DUPLICATE_REPORT_LIST_CELL_LIMIT || nextValuesLength > DUPLICATE_REPORT_LIST_CELL_LIMIT)) {
      flush();
    }
    currentRows.push(rowText);
    currentValues.push(valueText);
    currentRowsLength += (currentRows.length > 1 ? 2 : 0) + rowText.length;
    currentValuesLength += (currentValues.length > 1 ? 1 : 0) + valueText.length;
    if ((processed.value += 1) % 4096 === 0) checkCanceled();
  });
  flush();
  return chunks;
}

function splitLongValue(value: string, maximumPartLength: number, checkCanceled: () => void) {
  const parts: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(value.length, start + maximumPartLength);
    if (end < value.length && isHighSurrogate(value.charCodeAt(end - 1)) && isLowSurrogate(value.charCodeAt(end))) end -= 1;
    if (end < value.length && value.charCodeAt(end - 1) === 0x0d && value.charCodeAt(end) === 0x0a) end -= 1;
    if (end <= start) throw reportIntegrityError();
    parts.push(value.slice(start, end));
    start = end;
    checkCanceled();
  }
  return parts;
}

function assertDuplicateRecord(record: ExcelCompareDuplicateRecord) {
  if (
    (!record.leftRows.length && !record.rightRows.length)
    || record.leftRows.length !== record.leftValues.length
    || record.rightRows.length !== record.rightValues.length
  ) {
    throw reportIntegrityError();
  }
}

function assertDuplicateDisplayKeyLength(displayKey: string) {
  const maximum = /[\r\n]/u.test(displayKey)
    ? DUPLICATE_REPORT_MULTILINE_KEY_LIMIT
    : DUPLICATE_REPORT_CELL_LIMIT;
  if (displayKey.length <= maximum) return;
  const error = new Error(DUPLICATE_KEY_TOO_LONG) as Error & { code: string };
  error.code = DUPLICATE_KEY_TOO_LONG;
  throw error;
}

function reportIntegrityError() {
  const error = new Error("REPORT_INTEGRITY_FAILED") as Error & { code: string };
  error.code = "REPORT_INTEGRITY_FAILED";
  return error;
}

function isHighSurrogate(codeUnit: number) {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number) {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}
