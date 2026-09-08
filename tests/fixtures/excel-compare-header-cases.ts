import type { ExcelCompareHeaderSuggestion } from "../../src/features/excel-compare/types.ts";

export interface ExcelCompareHeaderCase {
  name: string;
  rows: unknown[][];
  merges: string[];
  intendedHeaderRow: number | null;
  expected: ExcelCompareHeaderSuggestion;
  semanticFalseSuggestion?: true;
}

export const EXCEL_COMPARE_HEADER_CASES: ExcelCompareHeaderCase[] = [
  { name: "merged-title", rows: [[], ["Title", "Title", "Title"], ["ID", "Name", "Amount"], [1, "a", 10], [2, "b", 20]], merges: ["A2:C2"], intendedHeaderRow: 3, expected: { row: 3, reason: "suggested" } },
  { name: "two-level-vertical", rows: [["ID", "Sales", "Sales"], ["ID", "Q1", "Q2"], [1, 10, 20], [2, 30, 40]], merges: ["A1:A2", "B1:C1"], intendedHeaderRow: 2, expected: { row: null, reason: "uncertain" } },
  { name: "three-level-vertical", rows: [["ID", "2026", "2026"], ["ID", "Sales", "Sales"], ["ID", "Q1", "Q2"], [1, 10, 20], [2, 30, 40]], merges: ["A1:A3", "B1:C1", "B2:C2"], intendedHeaderRow: 3, expected: { row: null, reason: "uncertain" } },
  { name: "left-empty-column", rows: [[null, "ID", "Amount"], [null, "A", 10], [null, "B", 20]], merges: [], intendedHeaderRow: 1, expected: { row: 1, reason: "suggested" } },
  { name: "numeric-header-after-title", rows: [["Sales", null, null], [2024, 2025, 2026], [10, 20, 30], [40, 50, 60]], merges: [], intendedHeaderRow: 2, expected: { row: null, reason: "uncertain" } },
  { name: "header-reappears", rows: [["ID", "Name"], ["A", "Alice"], ["ID", "Name"], ["B", "Bob"]], merges: [], intendedHeaderRow: 1, expected: { row: 1, reason: "suggested" } },
  { name: "filter-row", rows: [["Region", "Seoul"], ["ID", "Name", "Amount"], ["A", "Alice", 10], ["B", "Bob", 20]], merges: [], intendedHeaderRow: 2, expected: { row: 1, reason: "suggested" }, semanticFalseSuggestion: true },
  { name: "description-row", rows: [["Please review", "Do not edit", "Updated weekly"], ["ID", "Name", "Amount"], ["A", "Alice", 10], ["B", "Bob", 20]], merges: [], intendedHeaderRow: 2, expected: { row: 1, reason: "suggested" }, semanticFalseSuggestion: true },
  { name: "summary-block", rows: [["Metric", "Value", "Unit"], ["Count", 100, "rows"], ["Total", 200, "USD"], [], ["ID", "Name", "Amount"], ["A", "Alice", 10], ["B", "Bob", 20]], merges: [], intendedHeaderRow: 5, expected: { row: 1, reason: "suggested" }, semanticFalseSuggestion: true },
  { name: "empty", rows: [], merges: [], intendedHeaderRow: null, expected: { row: null, reason: "none" } },
  { name: "real-row1", rows: [["ID", "Name", "Amount"], ["A", "Alice", 10], ["B", "Bob", 20]], merges: [], intendedHeaderRow: 1, expected: { row: 1, reason: "suggested" } },
  { name: "single-column-title", rows: [["Contacts"], ["Name"], ["Alice"], ["Bob"]], merges: [], intendedHeaderRow: 2, expected: { row: null, reason: "uncertain" } },
  { name: "single-column-row1", rows: [["Name"], ["Alice"], ["Bob"]], merges: [], intendedHeaderRow: 1, expected: { row: null, reason: "uncertain" } },
  { name: "sparse-header-dense-text-body", rows: [["Name", null, "City"], ["Alice", "Engineering", "Seoul"], ["Bob", "Design", "Busan"]], merges: [], intendedHeaderRow: 1, expected: { row: 1, reason: "suggested" } },
  { name: "unmerged-title-one-column", rows: [["Title"], ["ID", "Name", "City"], ["A", "Alice", "Seoul"], ["B", "Bob", "Busan"]], merges: [], intendedHeaderRow: 2, expected: { row: 2, reason: "suggested" } },
  { name: "note-merge-outside-table", rows: [["ID", "Name", "Amount", null, null, "Note", "Note"], ["A", "Alice", 10], ["B", "Bob", 20]], merges: ["F1:G1"], intendedHeaderRow: 1, expected: { row: null, reason: "uncertain" } },
  { name: "header-at-row21", rows: [...Array.from({ length: 20 }, () => []), ["ID", "Name"], ["A", "Alice"], ["B", "Bob"]], merges: [], intendedHeaderRow: 21, expected: { row: null, reason: "none" } },
  { name: "same-word-in-other-column", rows: [["Name", "Status"], ["Status", "Open"], ["Alice", "Done"]], merges: [], intendedHeaderRow: 1, expected: { row: 1, reason: "suggested" } },
  { name: "no-header-all-text", rows: [["Alice", "Seoul"], ["Bob", "Busan"], ["Carol", "Incheon"]], merges: [], intendedHeaderRow: null, expected: { row: 1, reason: "suggested" }, semanticFalseSuggestion: true },
  { name: "header-only", rows: [["ID", "Name", "Amount"]], merges: [], intendedHeaderRow: 1, expected: { row: null, reason: "uncertain" } },
  { name: "dense-numeric-header", rows: [["ID", 2025, 2026], ["a", 10, 20], ["b", 30, 40]], merges: [], intendedHeaderRow: 1, expected: { row: null, reason: "uncertain" } },
  { name: "three-level-no-vertical", rows: [["Sales", "Sales"], ["North", "South"], ["Q1", "Q2"], [10, 20], [30, 40]], merges: ["A1:B1"], intendedHeaderRow: 3, expected: { row: 2, reason: "suggested" }, semanticFalseSuggestion: true },
  { name: "vertical-prefix", rows: [["Title"], ["Title"], ["ID", "Name"], ["A", "Alice"], ["B", "Bob"]], merges: ["A1:A2"], intendedHeaderRow: 3, expected: { row: null, reason: "uncertain" } },
];
