import { writeXlsxReport, type XlsxReportSheet } from "../../utils/xlsxReport.ts";
import type { ExcelCompareEngineResult } from "./compareEngine.ts";
import type { ExcelCompareRecord } from "./types.ts";

const REPORT_SHEETS = ["Summary", "Parameters", "Matched", "Changed", "Added", "Removed", "Duplicates", "Ambiguous", "Errors"] as const;
const RECORD_HEADERS = ["Left file", "Right file", "Left sheet", "Right sheet", "Left row", "Right row", "Left column", "Right column", "Key", "Left value", "Right value", "Change", "Reason"];

export async function buildExcelCompareReport(
  result: ExcelCompareEngineResult,
  context: { leftName: string; rightName: string; leftSheet: string; rightSheet: string },
) {
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
        ...result.warnings.map((warning) => ["warning", warning] as [string, string]),
      ],
    },
    recordSheet("Matched", result.records.filter((item) => item.status === "matched"), context),
    recordSheet("Changed", result.records.filter((item) => item.status === "changed"), context),
    recordSheet("Added", result.records.filter((item) => item.status === "added"), context),
    recordSheet("Removed", result.records.filter((item) => item.status === "removed"), context),
    recordSheet("Duplicates", result.records.filter((item) => item.status === "duplicate"), context),
    recordSheet("Ambiguous", result.records.filter((item) => item.status === "ambiguous"), context),
    recordSheet("Errors", result.records.filter((item) => item.status === "error" || item.status === "unmatched"), context),
  ];
  if (sheets.map((sheet) => sheet.name).join("|") !== REPORT_SHEETS.join("|")) throw new Error("REPORT_TOPOLOGY_INVALID");
  return writeXlsxReport({ creator: "Worklazy Tools", sheets });
}

function recordSheet(name: string, records: ExcelCompareRecord[], context: { leftName: string; rightName: string; leftSheet: string; rightSheet: string }): XlsxReportSheet {
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
