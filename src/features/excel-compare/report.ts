import {writeSourceFaithfulXlsxReport} from "../comparison-report/sourceXlsxText.ts";
import { type XlsxReportSheet } from "../../utils/xlsxReport.ts";
import type { ExcelCompareEngineResult } from "./compareEngine.ts";
import { duplicateReportParameters, formatDuplicateReportRows } from "./duplicateReport.ts";
import type { ExcelCompareRecord, ExcelCompareStandardRecord } from "./types.ts";

// Per-record provenance rows (record id -> report sheet and rows) are written for every record up to
// this many records. A larger comparison keeps only the rows that carry information the record
// sheets do not (the source rows of grouped reconciliations) plus one marker row: the other ids
// follow the order of each record sheet.
export const RECORD_PROVENANCE_LIMIT = 10_000;
const REPORT_SHEETS = ["Summary", "Parameters", "Matched", "Changed", "Added", "Removed", "Duplicates", "Ambiguous", "Errors"] as const;
const RECORD_HEADERS = ["Left file", "Right file", "Left sheet", "Right sheet", "Left row", "Right row", "Left column", "Right column", "Key", "Left value", "Right value", "Change", "Reason"];

export async function buildExcelCompareReport(
  result: ExcelCompareEngineResult,
  context: { leftName: string; rightName: string; leftSheet: string; rightSheet: string },
  checkCanceled: () => void = () => undefined,
) {
  const duplicateLayout = formatDuplicateReportRows(
    result.records.filter((item) => item.status === "duplicate"),
    checkCanceled,
  );
  const parameterMap = new Map(result.parameters);
  const duplicateMetadata = duplicateReportParameters(
    parameterMap.get("mode") === "key" && parameterMap.get("duplicateKeyPolicy") === "error",
    duplicateLayout,
  );
  const sheets: XlsxReportSheet[] = [
    {
      name: "Summary",
      headers: ["Status", "Count"],
      rows: Object.entries(result.summary).map(([status, count]) => [status, String(count)]),
    },
    {
      name: "Parameters",
      headers: ["Parameter", "Value"],
      rows: [
        ["leftFile", context.leftName],
        ["rightFile", context.rightName],
        ...result.parameters,
        ...duplicateMetadata,
        ...reportProvenance(result.records, duplicateLayout.rows, result.records.length <= RECORD_PROVENANCE_LIMIT),
        ...result.warnings.map((warning) => ["warning", warning] as [string, string]),
      ],
    },
    recordSheet("Matched", standardRecords(result.records, "matched"), context),
    recordSheet("Changed", standardRecords(result.records, "changed"), context),
    recordSheet("Added", standardRecords(result.records, "added"), context),
    recordSheet("Removed", standardRecords(result.records, "removed"), context),
    {
      name: "Duplicates",
      headers: RECORD_HEADERS,
      rows: duplicateLayout.rows.map((item) => [
        context.leftName,
        context.rightName,
        context.leftSheet,
        context.rightSheet,
        item.leftRows,
        item.rightRows,
        "",
        "",
        item.record.displayKey,
        item.leftValues,
        item.rightValues,
        item.record.change,
        item.record.reason,
      ]),
    },
    recordSheet("Ambiguous", standardRecords(result.records, "ambiguous"), context),
    recordSheet("Errors", standardRecords(result.records, "error", "unmatched"), context),
  ];
  if (sheets.map((sheet) => sheet.name).join("|") !== REPORT_SHEETS.join("|")) throw new Error("REPORT_TOPOLOGY_INVALID");
  return writeSourceFaithfulXlsxReport({ creator: "Worklazy Tools", sheets });
}

function standardRecords(
  records: ExcelCompareRecord[],
  ...statuses: ExcelCompareStandardRecord["status"][]
) {
  return records.filter((item): item is ExcelCompareStandardRecord => item.status !== "duplicate" && statuses.includes(item.status));
}

function recordSheet(name: string, records: ExcelCompareStandardRecord[], context: { leftName: string; rightName: string; leftSheet: string; rightSheet: string }): XlsxReportSheet {
  return {
    name,
    headers: RECORD_HEADERS,
    rows: records.map((item) => [
      context.leftName,
      context.rightName,
      context.leftSheet,
      context.rightSheet,
      item.leftRow ?? "",
      item.rightRow ?? "",
      item.leftColumn ?? "",
      item.rightColumn ?? "",
      item.displayKey,
      item.leftValue,
      item.rightValue,
      item.change,
      item.reason,
    ]),
  };
}

function reportProvenance(records: ExcelCompareRecord[], duplicateRows: Array<{ record: ExcelCompareRecord }>, everyRecord: boolean): Array<[string, string]> {
  const nextRows = new Map<string, number>();
  const duplicateRanges = new Map<ExcelCompareRecord, [number, number]>();
  duplicateRows.forEach((item, i) => {
    const existing = duplicateRanges.get(item.record);
    duplicateRanges.set(item.record, [existing?.[0] ?? i + 2, i + 2]);
  });
  let omitted = 0;
  const rows = records.flatMap((record): Array<[string, string]> => {
    if (!record.recordId) return [];
    const sheet = record.status === "duplicate" ? "Duplicates" : record.status === "unmatched" || record.status === "error" ? "Errors" : `${record.status[0].toUpperCase()}${record.status.slice(1)}`;
    const rows = record.status === "duplicate" ? duplicateRanges.get(record) ?? [] : [(nextRows.get(sheet) ?? 1) + 1];
    if (record.status !== "duplicate") nextRows.set(sheet, rows[0]);
    if (!everyRecord && (record.status === "duplicate" || !record.sourceRows)) { omitted++; return []; }
    return [[`record:${record.recordId}`, JSON.stringify({ sheet, startRow: rows[0], endRow: rows.at(-1), status: record.status, matchingReason: record.matchingReason, reason: record.reason, leftRow: record.leftRow, rightRow: record.rightRow, leftColumn: record.leftColumn, rightColumn: record.rightColumn, sourceRows: record.status === "duplicate" ? undefined : record.sourceRows })]];
  });
  if (omitted) rows.push(["recordProvenance", `${omitted} of ${records.length} records listed by record sheet order (over ${RECORD_PROVENANCE_LIMIT}); grouped source rows kept`]);
  return rows;
}
