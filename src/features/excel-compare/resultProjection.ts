import type { ExcelCompareEngineResult } from "./compareEngine.ts";
import type { ExcelCompareRecord, ExcelCompareStatus } from "./types.ts";

/** A view only selects/reorders authoritative record IDs; it never matches cells. */
export function projectCompareRecords(records: readonly ExcelCompareRecord[], options: {
  statuses?: ReadonlySet<ExcelCompareStatus>;
  hiddenLeftRows?: ReadonlySet<number>;
  hiddenRightRows?: ReadonlySet<number>;
  hiddenLeftColumns?: ReadonlySet<number>;
  hiddenRightColumns?: ReadonlySet<number>;
  search?: string;
  descending?: boolean;
} = {}) {
  const query = options.search?.trim().toLocaleLowerCase();
  const visible = records.filter((record) => {
    if (options.statuses && !options.statuses.has(record.status)) return false;
    const sourceRows = record.status === "duplicate" ? { left: record.leftRows, right: record.rightRows } : record.sourceRows;
    if (sourceRows?.left.some((row) => options.hiddenLeftRows?.has(row)) || sourceRows?.right.some((row) => options.hiddenRightRows?.has(row))) return false;
    if (record.leftRow !== null && options.hiddenLeftRows?.has(record.leftRow)) return false;
    if (record.rightRow !== null && options.hiddenRightRows?.has(record.rightRow)) return false;
    if (record.leftColumn !== null && options.hiddenLeftColumns?.has(record.leftColumn)) return false;
    if (record.rightColumn !== null && options.hiddenRightColumns?.has(record.rightColumn)) return false;
    return !query || [record.leftValue, record.rightValue, record.displayKey, record.reason].some((value) => value.toLocaleLowerCase().includes(query));
  });
  return options.descending ? [...visible].reverse() : visible;
}

export function selectCompareResult(result: ExcelCompareEngineResult, recordIds: ReadonlySet<string>): ExcelCompareEngineResult {
  const records = result.records.filter((item) => item.recordId && recordIds.has(item.recordId));
  const summary = { matched: 0, changed: 0, added: 0, removed: 0, duplicate: 0, ambiguous: 0, unmatched: 0, error: 0 };
  records.forEach((item) => { summary[item.status] += 1; });
  return { ...result, records, summary, parameters: [...result.parameters, ["exportScope", "visible-records"], ["exportRecordIds", JSON.stringify(records.map((item) => item.recordId))]] };
}
