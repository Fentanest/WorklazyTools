import { WorksheetGrid } from "./WorksheetGrid.tsx";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { buildExcelCompareReport } from "./report.ts";
import { assertGeneratedXlsxReport } from "./reportIntegrity.ts";
import { projectCompareRecords, selectCompareResult } from "./resultProjection.ts";
import type { ExcelComparePairResult, ExcelCompareRecord, ExcelCompareStatus } from "./types.ts";
import type { SpreadsheetCellData, SpreadsheetSheetData } from "../spreadsheet-core/inputAdapter.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;
const LAYOUTS = ["split", "threeColumns"] as const;

/** Presentation of compareSpreadsheetPair records. No view operation performs matching. */
export function ComparisonGrid({ result, statuses, search, t }: { result: ExcelComparePairResult; statuses: ReadonlySet<ExcelCompareStatus>; search: string; t: Translate }) {
  const [layout, setLayout] = useState<typeof LAYOUTS[number]>("split");
  const [hideSide, setHideSide] = useState<"left" | "right">("left");
  const [hidden, setHidden] = useState({ left: { rows: "", columns: "" }, right: { rows: "", columns: "" } });
  const hiddenIds = useMemo(() => ({ left: { rows: sourceIds(hidden.left.rows), columns: sourceIds(hidden.left.columns) }, right: { rows: sourceIds(hidden.right.rows), columns: sourceIds(hidden.right.columns) } }), [hidden]);
  const updateHidden = (axis: "rows" | "columns", value: string) => { setHidden((current) => ({ ...current, [hideSide]: { ...current[hideSide], [axis]: value } })); setLimit(100); };
  const [descending, setDescending] = useState(false);
  const [limit, setLimit] = useState(100);
  const [exportError, setExportError] = useState(false);
  const original = result.originalSheets;
  const indexes = useMemo(() => ({ left: indexCells(original?.left), right: indexCells(original?.right) }), [original]);
  const visible = useMemo(() => projectCompareRecords(result.records, {
    statuses, search, descending, hiddenLeftRows: hiddenIds.left.rows, hiddenLeftColumns: hiddenIds.left.columns, hiddenRightRows: hiddenIds.right.rows, hiddenRightColumns: hiddenIds.right.columns,
  }), [result.records, statuses, search, descending, hiddenIds]);
  if (!original) return null;
  const exportVisible = async () => {
    setExportError(false);
    try {
      const selected = selectCompareResult({ runId: result.runId, records: result.records, summary: result.summary, warnings: result.warnings, parameters: result.parameters ?? [] }, new Set(visible.flatMap((item) => item.recordId ? [item.recordId] : [])));
      const bytes = await buildExcelCompareReport(selected, { leftName: result.leftName, rightName: result.rightName, leftSheet: original.left.name, rightSheet: original.right.name });
      const buffer = Uint8Array.from(new Uint8Array(bytes)).buffer;
      await assertGeneratedXlsxReport(buffer);
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "visible-report.xlsx"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError(true); }
  };
  return <details className="mt-4 rounded-xl border border-border p-3" data-testid="excel-comparison-grid" data-run-id={result.runId} aria-label={t("features:excelCompare.grid.title")}>
    <summary className="cursor-pointer font-medium">{t("features:excelCompare.grid.title")}</summary>
    <p className="text-xs text-muted-foreground">{t("features:excelCompare.grid.description")}</p>
    <div className="my-2 flex flex-wrap gap-2">
      <label>{t("features:excelCompare.grid.layout")} <select className="rounded border border-input bg-background p-2" value={layout} onChange={(event) => setLayout(event.target.value as typeof layout)}>{LAYOUTS.map((item) => <option key={item} value={item}>{t(`features:excelCompare.grid.layouts.${item}`)}</option>)}</select></label>
      <label>{t("features:excelCompare.grid.hideSide")} <select className="rounded border border-input bg-background p-2" value={hideSide} onChange={(event) => setHideSide(event.target.value as "left" | "right")}>{(["left", "right"] as const).map((side) => <option key={side} value={side}>{t(`features:excelCompare.grid.${side}`)}</option>)}</select></label>
      <label>{t("features:excelCompare.grid.hideRows")} <input className="w-28 rounded border border-input bg-background p-2" value={hidden[hideSide].rows} onChange={(event) => updateHidden("rows", event.target.value)} placeholder="4,7" /></label>
      <label>{t("features:excelCompare.grid.hideColumns")} <input className="w-28 rounded border border-input bg-background p-2" value={hidden[hideSide].columns} onChange={(event) => updateHidden("columns", event.target.value)} placeholder="1,2,3" /></label>
      <Button variant="secondary" type="button" aria-pressed={descending} onClick={() => setDescending((value) => !value)}>{t("features:excelCompare.grid.reverse")}</Button>
      <Button variant="secondary" type="button" disabled={!visible.length} onClick={() => void exportVisible()}>{t("features:excelCompare.grid.exportVisible", { count: visible.length })}</Button>
    </div>
    {exportError && <p role="alert">{t("features:excelCompare.error.PROCESSING_FAILED")}</p>}
    <p className="text-xs text-muted-foreground">{t("features:excelCompare.grid.visibleCount", { count: visible.length, total: result.records.length })}</p>
    <p className="my-2 text-xs text-muted-foreground">{t("features:excelCompare.grid.matrixDescription")}</p>
    <div className={`grid items-start gap-3 ${layout === "threeColumns" ? "min-[1100px]:grid-cols-3" : "min-[900px]:grid-cols-2"}`} data-testid="excel-sheet-layout" data-layout={layout}>
      {(["left", "right"] as const).map((side) => <WorksheetGrid key={side} sheet={original[side]} cells={indexes[side]} records={result.records} side={side} hiddenRows={hiddenIds[side].rows} hiddenColumns={hiddenIds[side].columns} descending={descending} runId={result.runId} t={t} />)}
      {layout === "threeColumns" && <section className="min-w-0 rounded-xl border border-border p-2" data-testid="excel-grid-change-column"><h4 className="font-medium">{t("features:excelCompare.grid.changes")}</h4><div className="max-h-[600px] overflow-auto">{visible.slice(0, limit).map((record) => <p className="my-2 break-words rounded border border-border p-2 text-xs" data-change-record-id={record.recordId} key={record.recordId}><strong>{t(`features:excelCompare.status.${record.status}`)}</strong> · {record.leftRow ?? "—"}:{record.leftColumn ?? "—"} → {record.rightRow ?? "—"}:{record.rightColumn ?? "—"}<br />{record.reason.split("+").map((code) => t(`features:excelCompare.reason.${code}`, { defaultValue: t("features:excelCompare.reason.generic") })).join(" · ")}</p>)}</div></section>}
    </div>
    <details className="mt-3 rounded border border-border p-2"><summary className="cursor-pointer font-medium">{t("features:excelCompare.grid.recordDetails")}</summary><div className="max-h-[600px] overflow-auto" tabIndex={0} role="region" aria-label={t("features:excelCompare.grid.title")}>
      {visible.slice(0, limit).map((record) => <div className="my-2 grid min-w-[480px] grid-cols-2 gap-2 rounded border border-border p-2" key={record.recordId} data-record-id={record.recordId} data-status={record.status}>
        <CellPreview side="left" record={record} cells={indexes.left} t={t} />
        <CellPreview side="right" record={record} cells={indexes.right} t={t} />
        <div className="col-span-2"><strong>{t("features:excelCompare.grid.changes")}</strong><p>{t(`features:excelCompare.status.${record.status}`)} · {record.reason.split("+").map((code) => t(`features:excelCompare.reason.${code}`, { defaultValue: t("features:excelCompare.reason.generic") })).join(" · ")}</p></div>
      </div>)}
    </div></details>
    {visible.length > limit && <Button variant="secondary" type="button" onClick={() => setLimit((value) => value + 100)}>{t("features:excelCompare.results.showMore", { remaining: visible.length - limit })}</Button>}
  </details>;
}

function CellPreview({ side, record, cells, t }: { side: "left" | "right"; record: ExcelCompareRecord; cells: Map<string, SpreadsheetCellData>; t: Translate }) {
  const row = record[`${side}Row`]; const column = record[`${side}Column`];
  const cell = row !== null && column !== null ? cells.get(`${row}:${column}`) : undefined;
  const value = record[`${side}Value`];
  return <div className="min-w-0 break-words" data-side={side} data-source-address={cell?.address}>
    <strong>{t(`features:excelCompare.grid.${side}`)} {cell?.address ?? (row === null ? "—" : String(row))}</strong>
    <p className="whitespace-pre-wrap">{value}</p>
    {record.status === "duplicate" && <p>{record[`${side}Rows`].join(", ")}: {record[`${side}Values`].join(" | ")}</p>}
    {record.sourceRows && <p>{record.sourceRows[side].join(", ")}</p>}
    {record.dateNormalization && <p className="text-xs">{record.dateNormalization[side].normalizedDate?.replace(/^(?:date|datetime):/u, "") ?? t("features:excelCompare.reason.STRING_DATE_PARSE_FAILED")}</p>}
    {cell && <details><summary>{t("features:excelCompare.grid.cellDetails")}</summary><dl className="text-xs">
      {Object.entries({ address: cell.address, raw: cell.value instanceof Date ? cell.value.toISOString() : String(cell.value ?? ""), display: cell.displayValue, formula: cell.formula, cacheState: cell.cacheState, cachedValue: cell.cachedValue instanceof Date ? cell.cachedValue.toISOString() : cell.cachedValue, numberFormat: cell.numberFormat, style: cell.style ? JSON.stringify(cell.style) : undefined }).map(([key, content]) => content !== undefined && <div key={key}><dt className="font-medium">{t(`features:excelCompare.grid.fields.${key}`)}</dt><dd className="whitespace-pre-wrap">{String(content)}</dd></div>)}
    </dl></details>}
  </div>;
}
function sourceIds(input: string) { return new Set(input.split(",").map((item) => Number(item.trim())).filter((value) => Number.isInteger(value) && value > 0)); }
function indexCells(sheet?: SpreadsheetSheetData) { return new Map(sheet?.cells.map((cell) => [`${cell.row}:${cell.column}`, cell])); }
