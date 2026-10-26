import type { ExcelComparePairOptions, ExcelCompareRecord } from "./types.ts";

/** Each record's id and matching reason: a function of the run id, its position and the options,
 * so the worker posts records without them and the page restores them (excelCompareClient.ts). */
export function restoreRecordIdentity(records: ExcelCompareRecord[], runId: string, options: ExcelComparePairOptions) {
  const columns = options.columnMapping?.length ? "manual-columns" : "auto-columns";
  records.forEach((item, index) => {
    item.recordId = `${runId}:${index}`;
    item.matchingReason = options.mode === "reconcile" ? `RECONCILIATION:${item.reason}` : options.mode === "key" ? `KEY:${options.key?.duplicatePolicy ?? "invalid"}:${columns}` : `POSITION:${columns}`;
  });
}
