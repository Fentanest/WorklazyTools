import { useMemo } from "react";
import { Button } from "../../components/ui/button";
import type { ExcelComparePreviewCell as SpreadsheetCellData, ExcelComparePreviewSheet as SpreadsheetSheetData } from "./types.ts";
import { cellText } from "./normalization.ts";
import { columnAddress, worksheetAxisWindow, worksheetRecordIndex } from "./worksheetProjection.ts";
import type { ExcelCompareRecord, ExcelCompareStatus } from "./types.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;
const PAGE_ROWS = 40, PAGE_COLUMNS = 12;
const PRIORITY: ExcelCompareStatus[] = ["error", "ambiguous", "duplicate", "changed", "added", "removed", "unmatched", "matched"];
const HIGHLIGHTS: Record<ExcelCompareStatus, string> = {
  error: "bg-rose-500/15", ambiguous: "bg-fuchsia-500/15", duplicate: "bg-fuchsia-500/15",
  changed: "bg-amber-500/20", added: "bg-emerald-500/15", removed: "bg-rose-500/15",
  unmatched: "bg-muted", matched: "",
};

export interface WorksheetGridView {rowOffset:number;columnOffset:number;selected?:{row:number;column:number}}
export function WorksheetGrid({view,onViewChange,viewportHeight=480, sheet, cells, records, side, hiddenRows, hiddenColumns, descending, runId, t }: {
  view:WorksheetGridView;onViewChange:(update:Partial<WorksheetGridView>)=>void;viewportHeight?:number;
  sheet: SpreadsheetSheetData; cells: ReadonlyMap<string, SpreadsheetCellData>; records: readonly ExcelCompareRecord[]; side: "left" | "right";
  hiddenRows: ReadonlySet<number>; hiddenColumns: ReadonlySet<number>; descending: boolean; runId?: string; t: Translate;
}) {
  const {rowOffset,columnOffset,selected}=view;
  const setRowOffset=(value:number|((previous:number)=>number))=>onViewChange({rowOffset:typeof value==='function'?value(rowOffset):value});
  const setColumnOffset=(value:number)=>onViewChange({columnOffset:value});
  const setSelected=(value:{row:number;column:number})=>onViewChange({selected:value});
  const decisions = useMemo(() => worksheetRecordIndex(records, side), [records, side]);
  const rows = worksheetAxisWindow(sheet.rowCount, rowOffset, PAGE_ROWS, hiddenRows, descending);
  const columns = worksheetAxisWindow(sheet.columnCount, columnOffset, PAGE_COLUMNS, hiddenColumns);
  const selectedCell = selected ? cells.get(`${selected.row}:${selected.column}`) : undefined;
  const selectedRecords = selected ? [...decisions.cells.get(`${selected.row}:${selected.column}`) ?? [], ...decisions.rows.get(selected.row) ?? []] : [];
  const first = rows[0], last = rows.at(-1);
  const nextOffset = last === undefined ? sheet.rowCount + 1 : descending ? sheet.rowCount - last + 2 : last + 1;
  const hasNext = nextOffset <= sheet.rowCount && worksheetAxisWindow(sheet.rowCount, nextOffset, 1, hiddenRows, descending).length > 0;
  return <section className="min-w-0 rounded-xl border border-border p-2" data-testid="excel-worksheet-grid" data-side={side} data-run-id={runId}>
    <h4 className="font-medium">{t(`features:excelCompare.grid.${side}`)} · {sheet.name}</h4>
    <p className="my-1 text-xs text-muted-foreground">{t("features:excelCompare.grid.sheetWindow", { first: first ?? "—", last: last ?? "—", total: sheet.rowCount, columns: sheet.columnCount })}</p>
    <div className="my-2 grid grid-cols-2 gap-2">
      <label className="text-xs">{t("features:excelCompare.grid.rowOffset")}<input data-axis="row" className="mt-1 w-full rounded border border-input bg-background p-2" type="number" min={1} max={Math.max(1, sheet.rowCount)} value={rowOffset} onChange={(event) => setRowOffset(Math.max(1, Number(event.target.value) || 1))} /></label>
      <label className="text-xs">{t("features:excelCompare.grid.columnOffset")}<input data-axis="column" className="mt-1 w-full rounded border border-input bg-background p-2" type="number" min={1} max={Math.max(1, sheet.columnCount)} value={columnOffset} onChange={(event) => setColumnOffset(Math.max(1, Number(event.target.value) || 1))} /></label>
    </div>
    <div className="overflow-auto rounded border border-border" style={{maxHeight:viewportHeight}} tabIndex={0} role="region" aria-label={`${t(`features:excelCompare.grid.${side}`)} ${sheet.name}`}>
      <table className="w-full border-collapse text-xs" data-testid="excel-original-matrix"><thead className="sticky top-0 z-10 bg-muted"><tr><th className="border border-border p-2" scope="col">#</th>{columns.map((column) => <th className="min-w-28 border border-border p-2" scope="col" key={column} data-source-column={column}>{columnAddress(column)}</th>)}</tr></thead><tbody>
        {rows.map((row) => <tr key={row} data-source-row={row}><th className="sticky left-0 border border-border bg-muted p-2" scope="row">{row}</th>{columns.map((column) => {
          const cell = cells.get(`${row}:${column}`), address = cell?.address ?? `${columnAddress(column)}${row}`;
          const related = [...decisions.cells.get(`${row}:${column}`) ?? [], ...decisions.rows.get(row) ?? []];
          const status = PRIORITY.find((value) => related.some((record) => record.status === value));
          return <td className={`max-w-56 border border-border ${status ? HIGHLIGHTS[status] : ""}`} key={column} data-source-address={address} data-status={status} data-record-ids={related.flatMap((record) => record.recordId ? [record.recordId] : []).join(" ")}>
            <button type="button" className="block min-h-10 w-full border-0 bg-transparent text-foreground overflow-hidden text-ellipsis whitespace-nowrap p-2 text-left focus-visible:outline-2 focus-visible:outline-ring" title={address} aria-label={`${address}: ${status ? t(`features:excelCompare.status.${status}`) : t("features:excelCompare.grid.uncompared")}`} onClick={() => setSelected({ row, column })}>{cellText(cell) || "\u00a0"}</button>
          </td>;
        })}</tr>)}
      </tbody></table>
    </div>
    <div className="my-2 flex flex-wrap gap-2">
      <Button variant="secondary" type="button" disabled={rowOffset <= 1} onClick={() => setRowOffset((value) => Math.max(1, value - PAGE_ROWS))}>{t("features:excelCompare.grid.previousRows")}</Button>
      <Button variant="secondary" type="button" disabled={!hasNext} onClick={() => setRowOffset(nextOffset)}>{t("features:excelCompare.grid.nextRows")}</Button>
    </div>
    {selected && <div className="rounded border border-border p-2" data-testid="excel-matrix-cell-details"><strong>{sheet.name}!{selectedCell?.address ?? `${columnAddress(selected.column)}${selected.row}`}</strong><CellDetails cell={selectedCell} t={t} />{selectedRecords.map((record, i) => <p className="text-xs" key={`${record.recordId}-${i}`} data-source-record-id={record.recordId}>{t(`features:excelCompare.status.${record.status}`)} · {record.reason.split("+").map((code) => t(`features:excelCompare.reason.${code}`, { defaultValue: t("features:excelCompare.reason.generic") })).join(" · ")}</p>)}</div>}
  </section>;
}
function CellDetails({ cell, t }: { cell?: SpreadsheetCellData; t: Translate }) {
  if (!cell) return <p>{t("features:excelCompare.results.emptyValue")}</p>;
  const text = (value: unknown) => value instanceof Date ? value.toISOString() : typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return <dl className="max-h-56 overflow-auto text-xs">{Object.entries({ raw: cell.value, display: cell.displayValue, formula: cell.formula, cacheState: cell.cacheState, cachedValue: cell.cachedValue, numberFormat: cell.numberFormat, style: cell.style }).map(([key, value]) => value !== undefined && <div className="break-words" key={key}><dt className="font-medium">{t(`features:excelCompare.grid.fields.${key}`)}</dt><dd className="whitespace-pre-wrap">{text(value)}</dd></div>)}</dl>;
}
