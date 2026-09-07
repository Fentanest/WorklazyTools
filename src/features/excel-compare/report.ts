import { writeXlsxReport, type XlsxReportSheet } from "../../utils/xlsxReport.ts";
import type { ExcelCompareEngineResult } from "./compareEngine.ts";
import { duplicateReportParameters, formatDuplicateReportRows } from "./duplicateReport.ts";
import type { ExcelCompareRecord, ExcelCompareStandardRecord } from "./types.ts";

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
  return writeXlsxReport({ creator: "Worklazy Tools", sheets });
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
      item.key,
      item.leftValue,
      item.rightValue,
      item.change,
      item.reason,
    ]),
  };
}
