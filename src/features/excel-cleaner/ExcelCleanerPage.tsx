import { BlobWriter } from "@zip.js/zip.js";
import { AlertCircle, ArrowDown, ArrowUp, Download, FileSpreadsheet, GripVertical, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { createUniqueSafeFileName, SafeFileNameRegistry, type SafeFileName } from "../../utils/fileNameSafety.ts";
import { writeZipArchive } from "../../utils/zipArchive.ts";
import { inspectExcelCleanerFile, runExcelCleanerFile } from "./excelCleanerClient.ts";
import { validatePipelineColumnLineage } from "./model.ts";
import { validateExcelCleanerPipeline } from "./schema.ts";
import { EXCEL_CLEANER_RULE_TYPES, type ExcelCleanerInspection, type ExcelCleanerOutput, type ExcelCleanerPipeline, type ExcelCleanerResult, type ExcelCleanerRule, type ExcelCleanerRuleType } from "./types.ts";

const ACCEPT = ".xlsx,.xlsm,.xls,.xlsb,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
type LooseT = (key: string, options?: Record<string, unknown>) => string;

interface FileItem {
  id: string;
  file: File;
  inspection?: ExcelCleanerInspection;
  inspecting: boolean;
  error?: string;
  selectedSheets: string[];
  headerRows: Record<string, number>;
}

interface RuleDraft { key: string; text: string; }
interface DownloadItem { fileId: string; fileName: SafeFileName; blob: Blob; url: string; kind: "xlsx" | "csv"; csvRiskCount: number; }
interface FailedItem { fileName: string; message: string; }

export function ExcelCleanerPage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const translate = t as unknown as LooseT;
  const language = i18n.language.startsWith("en") ? "en" : "ko";
  const operation = useOperationProgress();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const previewControllerRef = useRef<AbortController | undefined>(undefined);
  const previewGeneration = useRef(0);
  const dragRuleIndex = useRef<number | undefined>(undefined);
  const urls = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<FileItem[]>([]);
  const [drafts, setDrafts] = useState<RuleDraft[]>([]);
  const [addType, setAddType] = useState<ExcelCleanerRuleType>("trim-whitespace");
  const [output, setOutput] = useState<"xlsx" | "csv" | "both">("xlsx");
  const [csvSafeMode, setCsvSafeMode] = useState(false);
  const [confirmFormulaDowngrade, setConfirmFormulaDowngrade] = useState(false);
  const [preview, setPreview] = useState<ExcelCleanerResult>();
  const [previewStale, setPreviewStale] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [failures, setFailures] = useState<FailedItem[]>([]);
  const [zip, setZip] = useState<{ fileName: SafeFileName; url: string; size: number }>();
  const [importText, setImportText] = useState("");
  const [pipelineMessage, setPipelineMessage] = useState<string>();

  useEffect(() => () => {
    controllerRef.current?.abort();
    previewControllerRef.current?.abort();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const parsedPipeline = useMemo(() => parseDrafts(drafts), [drafts]);
  const firstReady = items.find((item) => item.inspection && !item.error && item.selectedSheets.length);
  const firstSelectedSheet = firstReady?.inspection?.sheets.find((sheet) => sheet.name === firstReady.selectedSheets[0]);
  const columns = (firstSelectedSheet?.headerRows.find((row) => row.row === (firstReady && firstReady.headerRows[firstReady.selectedSheets[0]] || 1))?.values ?? [])
    .map((name, index) => ({ id: `column:${index + 1}`, name }));
  const activeColumns = useMemo(() => {
    if (!parsedPipeline.pipeline) return columns;
    try {
      const ids = validatePipelineColumnLineage(columns, parsedPipeline.pipeline);
      return ids.map((id) => ({ id, name: columnLabel(id, columns, parsedPipeline.pipeline!) }));
    } catch { return columns; }
  }, [columns, parsedPipeline.pipeline]);
  const readyItems = items.filter((item) => item.inspection && !item.error && item.selectedSheets.length && !item.inspection.hardLimitExceeded);
  const busy = operation.status === "running";

  const replaceFiles = async (files: File[]) => {
    const current = new Map(items.map((item) => [item.file, item]));
    const next = files.map((file) => current.get(file) ?? { id: crypto.randomUUID(), file, inspecting: true, selectedSheets: [], headerRows: {} });
    setItems(next);
    for (const item of next) if (!item.inspection && !item.error) await inspectItem(item);
    markPreviewStale();
  };

  const inspectItem = async (item: FileItem, headerRows = [1]) => {
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, inspecting: true } : candidate));
    try {
      const inspection = await inspectExcelCleanerFile(item.file, language, undefined, headerRows);
      setItems((current) => current.map((candidate) => {
        if (candidate.id !== item.id) return candidate;
        const first = candidate.selectedSheets[0] ?? inspection.sheets[0]?.name;
        const selectedSheets = candidate.selectedSheets.filter((name) => inspection.sheets.some((sheet) => sheet.name === name));
        if (!selectedSheets.length && first) selectedSheets.push(first);
        const nextHeaders = { ...candidate.headerRows };
        inspection.sheets.forEach((sheet) => { nextHeaders[sheet.name] ??= 1; });
        return { ...candidate, inspection, inspecting: false, error: undefined, selectedSheets, headerRows: nextHeaders };
      }));
    } catch (error) {
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, inspecting: false, error: safeError(error, translate) } : candidate));
    }
  };

  const updateSelection = (id: string, sheet: string, selected: boolean) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, selectedSheets: selected ? [...item.selectedSheets, sheet] : item.selectedSheets.filter((name) => name !== sheet) } : item));
    markPreviewStale();
  };
  const updateHeader = (id: string, sheet: string, value: number) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, headerRows: { ...item.headerRows, [sheet]: Math.max(1, value || 1) } } : item));
    markPreviewStale();
  };
  const refreshHeader = async (id: string, sheet: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    await inspectItem(item, [1, item.headerRows[sheet] ?? 1]);
  };

  const addRule = () => {
    try {
      const rule = defaultRule(addType, activeColumns);
      setDrafts((current) => [...current, { key: rule.id, text: JSON.stringify(rule, null, 2) }]);
      markPreviewStale();
      setPipelineMessage(undefined);
    } catch {
      setPipelineMessage(t("features:excelCleaner.pipeline.columnsRequired"));
    }
  };
  const updateDraft = (index: number, text: string) => { setDrafts((current) => current.map((draft, position) => position === index ? { ...draft, text } : draft)); markPreviewStale(); };
  const moveRule = (from: number, to: number) => {
    if (to < 0 || to >= drafts.length || from === to) return;
    setDrafts((current) => { const next = [...current]; const [rule] = next.splice(from, 1); next.splice(to, 0, rule); return next; });
    markPreviewStale();
  };
  const removeRule = (index: number) => { setDrafts((current) => current.filter((_draft, position) => position !== index)); markPreviewStale(); };

  const applyImport = () => {
    try {
      const pipeline = validateExcelCleanerPipeline(importText);
      setDrafts(pipeline.rules.map((rule) => ({ key: rule.id, text: JSON.stringify(rule, null, 2) })));
      setPipelineMessage(t("features:excelCleaner.pipeline.imported"));
      markPreviewStale();
    } catch {
      setPipelineMessage(t("features:excelCleaner.pipeline.invalid"));
    }
  };

  const runPreview = async () => {
    if (!firstReady || !parsedPipeline.pipeline) return;
    previewControllerRef.current?.abort();
    const controller = new AbortController();
    previewControllerRef.current = controller;
    const generation = ++previewGeneration.current;
    setPreviewError(undefined);
    try {
      const result = await runExcelCleanerFile(firstReady.file, optionsFor(firstReady, parsedPipeline.pipeline, output, csvSafeMode, confirmFormulaDowngrade), language, "preview", controller.signal);
      if (generation !== previewGeneration.current) return;
      setPreview(result);
      setPreviewStale(false);
    } catch (error) {
      if (generation !== previewGeneration.current || error instanceof DOMException && error.name === "AbortError") return;
      setPreviewError(safeError(error, translate));
    }
  };

  const cleanupResults = () => {
    downloads.forEach((item) => { URL.revokeObjectURL(item.url); urls.current.delete(item.url); });
    if (zip) { URL.revokeObjectURL(zip.url); urls.current.delete(zip.url); }
    setDownloads([]); setFailures([]); setZip(undefined);
  };

  const run = async () => {
    if (!parsedPipeline.pipeline || !readyItems.length || busy) return;
    cleanupResults();
    const controller = new AbortController();
    controllerRef.current = controller;
    const names = new SafeFileNameRegistry();
    const completed: DownloadItem[] = [];
    const failed: FailedItem[] = [];
    operation.start(t("features:excelCleaner.progress.starting", { count: readyItems.length }));
    for (let index = 0; index < readyItems.length; index += 1) {
      const item = readyItems[index];
      try {
        const result = await runExcelCleanerFile(item.file, optionsFor(item, parsedPipeline.pipeline, output, csvSafeMode, confirmFormulaDowngrade), language, "run", controller.signal, ({ progress, phase, ruleId }) => {
          const overall = Math.round(((index + progress / 100) / readyItems.length) * 94);
          operation.update(overall, progressText(phase, ruleId, index, readyItems.length, translate), ruleId ? `${item.id}:${ruleId}` : `${item.id}:${phase}`);
        });
        result.outputs.forEach((workerOutput) => completed.push(createDownload(item.id, workerOutput, names, urls)));
        setDownloads([...completed]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") break;
        failed.push({ fileName: item.file.name, message: safeError(error, translate) });
        setFailures([...failed]);
      }
    }
    if (controller.signal.aborted) { operation.fail(t("features:excelCleaner.progress.canceled")); controllerRef.current = undefined; return; }
    if (completed.length >= 2) {
      try {
        operation.update(96, t("features:excelCleaner.progress.ZIPPING"), "zip");
        const writer = new BlobWriter("application/zip");
        await writeZipArchive(completed.map((item) => ({ fileName: item.fileName, blob: item.blob })), writer, controller.signal);
        const blob = await writer.getData();
        const fileName = createUniqueSafeFileName("worklazy-excel-cleaner-results.zip", names, "excel-cleaner-results.zip");
        const url = keepUrl(URL.createObjectURL(blob), urls);
        setZip({ fileName, url, size: blob.size });
      } catch (error) { failed.push({ fileName: t("features:excelCleaner.results.zip"), message: safeError(error, translate) }); setFailures([...failed]); }
    }
    operation.succeed(t("features:excelCleaner.progress.complete", { success: completed.length, failed: failed.length }));
    controllerRef.current = undefined;
  };

  const exported = parsedPipeline.pipeline ? JSON.stringify(parsedPipeline.pipeline, null, 2) : "";
  const csvRiskCount = downloads.reduce((sum, item) => sum + item.csvRiskCount, 0);
  return <div className="page tool-page page-enter excel-cleaner-page" data-testid="excel-cleaner-page">
    <PageHeader eyebrow="EXCEL CLEANER" title={t("features:excelCleaner.title")} description={t("features:excelCleaner.description")} />

    <SectionCard step={1} title={t("features:excelCleaner.files.title")} description={t("features:excelCleaner.files.description")}>
      <FileDropZone hint={t("features:excelCleaner.files.hint")} accept={ACCEPT} multiple files={items.map((item) => item.file)} onFiles={replaceFiles} accent="green" disabled={busy} />
      <div className="excel-cleaner-files">
        {items.map((item, index) => <article className="excel-cleaner-file" key={item.id} data-testid="excel-cleaner-file">
          <header><FileSpreadsheet size={18} /><span><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)}{item.inspection ? ` · ${item.inspection.format.toUpperCase()}` : ""}</small></span><button type="button" className="remove-button" aria-label={t("common:files.remove", { name: item.file.name })} onClick={() => void replaceFiles(items.filter((_candidate, position) => position !== index).map((candidate) => candidate.file))}><X size={16} /></button></header>
          {item.inspecting && <p>{t("features:excelCleaner.files.inspecting")}</p>}
          {item.error && <div className="inline-notice error"><AlertCircle size={16} /><span>{item.error}</span></div>}
          {item.inspection?.softLimitExceeded && !item.inspection.hardLimitExceeded && <div className="inline-notice warning"><AlertCircle size={16} /><span>{t("features:excelCleaner.files.large", { count: item.inspection.cellCount.toLocaleString() })}</span></div>}
          {item.inspection?.hardLimitExceeded && <div className="inline-notice error"><AlertCircle size={16} /><span>{t("features:excelCleaner.files.tooLarge", { count: item.inspection.cellCount.toLocaleString() })}</span></div>}
          {item.inspection && <div className="excel-cleaner-sheets">{item.inspection.sheets.map((sheet) => { const selected = item.selectedSheets.includes(sheet.name); return <div key={sheet.name}><label><input type="checkbox" checked={selected} onChange={(event) => updateSelection(item.id, sheet.name, event.target.checked)} /><span><strong>{sheet.name}</strong><small>{sheet.rowCount.toLocaleString()} × {sheet.columnCount.toLocaleString()}</small></span></label>{selected && <label className="excel-cleaner-header-row"><span>{t("features:excelCleaner.files.headerRow")}</span><input type="number" min={1} max={Math.max(1, sheet.rowCount)} value={item.headerRows[sheet.name] ?? 1} onChange={(event) => updateHeader(item.id, sheet.name, Number(event.target.value))} onBlur={() => void refreshHeader(item.id, sheet.name)} /></label>}</div>; })}</div>}
          {item.inspection && <p className="excel-cleaner-sheet-note">{t("features:excelCleaner.files.unselectedOmitted")}</p>}
        </article>)}
      </div>
    </SectionCard>

    <SectionCard step={2} title={t("features:excelCleaner.pipeline.title")} description={t("features:excelCleaner.pipeline.description")}>
      <div className="excel-cleaner-add-rule"><label><span>{t("features:excelCleaner.pipeline.ruleType")}</span><select value={addType} onChange={(event) => setAddType(event.target.value as ExcelCleanerRuleType)}>{EXCEL_CLEANER_RULE_TYPES.map((type) => <option value={type} key={type}>{t(`features:excelCleaner.rules.${type}` as never)}</option>)}</select></label><button type="button" className="secondary-button" onClick={addRule}><Plus size={16} />{t("features:excelCleaner.pipeline.add")}</button></div>
      <div className="excel-cleaner-rules" aria-label={t("features:excelCleaner.pipeline.orderLabel")}>
        {drafts.map((draft, index) => <article key={draft.key} className="excel-cleaner-rule" draggable onDragStart={() => { dragRuleIndex.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragRuleIndex.current !== undefined) moveRule(dragRuleIndex.current, index); dragRuleIndex.current = undefined; }}>
          <header><GripVertical size={17} /><strong>{t("features:excelCleaner.pipeline.rule", { number: index + 1 })}</strong><span>{draftTypeLabel(draft.text, translate)}</span><button type="button" onClick={() => moveRule(index, index - 1)} disabled={index === 0} aria-label={t("features:excelCleaner.pipeline.moveUp")}><ArrowUp size={15} /></button><button type="button" onClick={() => moveRule(index, index + 1)} disabled={index === drafts.length - 1} aria-label={t("features:excelCleaner.pipeline.moveDown")}><ArrowDown size={15} /></button><button type="button" onClick={() => removeRule(index)} aria-label={t("features:excelCleaner.pipeline.remove")}><Trash2 size={15} /></button></header>
          <textarea value={draft.text} onChange={(event) => updateDraft(index, event.target.value)} spellCheck={false} aria-label={t("features:excelCleaner.pipeline.settings", { number: index + 1 })} />
          {parsedPipeline.errors[index] && <p className="field-error">{t("features:excelCleaner.pipeline.invalidRule")}</p>}
        </article>)}
        {!drafts.length && <p className="excel-cleaner-empty-rules">{t("features:excelCleaner.pipeline.empty")}</p>}
      </div>
      <details className="excel-cleaner-json"><summary>{t("features:excelCleaner.pipeline.json")}</summary><div className="excel-cleaner-json-grid"><label><span>{t("features:excelCleaner.pipeline.export")}</span><textarea readOnly value={exported} /></label><label><span>{t("features:excelCleaner.pipeline.import")}</span><textarea value={importText} onChange={(event) => setImportText(event.target.value)} /><button className="secondary-button small" type="button" onClick={applyImport}>{t("features:excelCleaner.pipeline.apply")}</button></label></div></details>
      {(pipelineMessage || parsedPipeline.rootError) && <p className="field-error">{pipelineMessage ?? t("features:excelCleaner.pipeline.invalid")}</p>}
    </SectionCard>

    <SectionCard step={3} title={t("features:excelCleaner.output.title")} description={t("features:excelCleaner.output.description")}>
      <SegmentedControl label={t("features:excelCleaner.output.title")} value={output} options={(["xlsx", "csv", "both"] as const).map((value) => ({ value, label: t(`features:excelCleaner.output.${value}` as never) }))} onChange={setOutput} />
      {(output === "csv" || output === "both") && <ToggleRow checked={csvSafeMode} onChange={setCsvSafeMode} label={t("features:excelCleaner.output.csvSafeMode")} description={t("features:excelCleaner.output.csvSafeModeDescription")} />}
      <ToggleRow checked={confirmFormulaDowngrade} onChange={setConfirmFormulaDowngrade} label={t("features:excelCleaner.output.formulaConfirmation")} description={t("features:excelCleaner.output.formulaConfirmationDescription")} />
      <div className="inline-notice warning"><AlertCircle size={16} /><span>{t("features:excelCleaner.output.formulaNote")}</span></div>
    </SectionCard>

    <div className="excel-cleaner-actions"><button type="button" className="secondary-button" onClick={() => void runPreview()} disabled={!firstReady || !parsedPipeline.pipeline || busy}><RefreshCw size={17} />{t("features:excelCleaner.actions.preview")}</button><PrimaryButton accent="green" onClick={() => void run()} disabled={!readyItems.length || !parsedPipeline.pipeline} loading={busy}><FileSpreadsheet size={18} />{t("features:excelCleaner.actions.run", { count: readyItems.length })}</PrimaryButton></div>
    {busy && <div className="cancel-operation"><button className="secondary-button danger" type="button" onClick={() => controllerRef.current?.abort()}><X size={16} />{t("features:excelCleaner.actions.cancel")}</button></div>}
    <OperationProgress {...operation} accent="green" title={t("features:excelCleaner.progress.title")} />

    {(preview || previewError) && <section className="excel-cleaner-preview"><div className="content-heading"><div><p className="eyebrow">PREVIEW</p><h2>{t("features:excelCleaner.preview.title")}{previewStale && <span className="excel-cleaner-stale">{t("features:excelCleaner.preview.stale")}</span>}</h2><p>{preview ? t("features:excelCleaner.preview.summary", { rows: preview.summary.outputRows, changed: preview.summary.changedCells }) : previewError}</p></div></div>{preview?.stages.at(-1)?.sample.length ? <div className="excel-cleaner-preview-table"><table><tbody>{preview.stages.at(-1)!.sample.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => rowIndex === 0 ? <th key={columnIndex}>{value}</th> : <td key={columnIndex}>{value}</td>)}</tr>)}</tbody></table></div> : null}</section>}

    {(downloads.length || failures.length) && <section className="excel-cleaner-results"><div className="content-heading"><div><p className="eyebrow">RESULTS</p><h2>{t("features:excelCleaner.results.title")}</h2><p>{t("features:excelCleaner.results.description", { success: downloads.length, failed: failures.length })}</p></div></div>
      {csvRiskCount > 0 && !csvSafeMode && <div className="inline-notice warning" data-testid="csv-risk-warning"><AlertCircle size={16} /><span>{t("features:excelCleaner.results.csvRisk", { count: csvRiskCount })}</span></div>}
      <div className="excel-report-downloads">{downloads.map((item) => <a className={`result-download accent-${item.kind === "xlsx" ? "green" : "blue"}`} href={item.url} download={item.fileName} key={`${item.fileId}-${item.fileName}`}><Download size={18} /><span><strong>{item.kind.toUpperCase()}</strong><small>{item.fileName} · {formatBytes(item.blob.size)}</small></span></a>)}{zip && <a className="result-download accent-violet" href={zip.url} download={zip.fileName}><Download size={18} /><span><strong>{t("features:excelCleaner.results.zip")}</strong><small>{zip.fileName} · {formatBytes(zip.size)}</small></span></a>}</div>
      {failures.map((item) => <div className="inline-notice error" key={`${item.fileName}-${item.message}`}><AlertCircle size={16} /><span><strong>{item.fileName}</strong>{item.message}</span></div>)}
    </section>}

    <ToolGuide title={t("features:excelCleaner.guide.title")} description={t("features:excelCleaner.guide.description")} blocks={(t("features:excelCleaner.guide.blocks", { returnObjects: true }) as unknown as Array<{ title: string; text: string }>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:excelCleaner.guide.faq", { returnObjects: true }) as unknown as Array<{ q: string; a: string }>).map((item) => ({ question: item.q, answer: item.a }))} />
  </div>;

  function markPreviewStale() { previewControllerRef.current?.abort(); previewGeneration.current += 1; if (preview) setPreviewStale(true); }
}

function parseDrafts(drafts: RuleDraft[]) {
  const errors: Record<number, true> = {};
  const rules: unknown[] = [];
  drafts.forEach((draft, index) => { try { rules.push(JSON.parse(draft.text)); } catch { errors[index] = true; rules.push({}); } });
  if (Object.keys(errors).length) return { errors, rootError: true as const, pipeline: undefined };
  try { return { errors, rootError: false as const, pipeline: validateExcelCleanerPipeline({ version: 1, rules }) }; }
  catch (error) {
    const path = error && typeof error === "object" && "path" in error ? String(error.path) : "";
    const match = path.match(/\$\.rules\[(\d+)\]/u); if (match) errors[Number(match[1])] = true;
    return { errors, rootError: true as const, pipeline: undefined };
  }
}

function defaultRule(type: ExcelCleanerRuleType, columns: Array<{ id: string; name: string }>): ExcelCleanerRule {
  const id = crypto.randomUUID(); const one = columns[0]?.id; const two = columns[1]?.id;
  const requireOne = () => { if (!one) throw new Error("COLUMN_REQUIRED"); return one; };
  const requireTwo = () => { if (!one || !two) throw new Error("COLUMNS_REQUIRED"); return [one, two]; };
  const outputId = () => `derived:${crypto.randomUUID()}`;
  switch (type) {
    case "trim-edge-empty": return { type, id, axis: "both" }; case "remove-empty-rows": case "remove-empty-columns": case "unmerge-cells": case "unmerge-fill-down": case "dedupe-rows": return { type, id };
    case "collapse-consecutive-empty": return { type, id, axis: "rows", minRun: 2 }; case "rename-column": return { type, id, columnId: requireOne(), newName: columns[0]?.name || "Column" };
    case "reorder-columns": return { type, id, order: columns.map((column) => column.id) }; case "delete-columns": return { type, id, columnIds: [requireOne()] };
    case "combine-columns": return { type, id, columnIds: requireTwo(), separator: " ", outputColumnId: outputId(), outputName: "Combined", removeSources: true };
    case "split-column": { const first = outputId(); return { type, id, columnId: requireOne(), mode: "delimiter", pattern: ",", maxParts: 2, outputColumnIds: [first, outputId()], outputNames: ["Part 1", "Part 2"], removeSource: true }; }
    case "add-constant-column": return { type, id, value: "", outputColumnId: outputId(), outputName: "New column", position: "end" };
    case "add-row-number-column": return { type, id, startAt: 1, outputColumnId: outputId(), outputName: "Row number", position: "start" };
    case "trim-whitespace": case "collapse-spaces": case "remove-invisible-chars": case "normalize-unicode": case "convert-numeric-strings": return { type, id, columnIds: columns.map((column) => column.id) } as ExcelCleanerRule;
    case "normalize-newlines": return { type, id, columnIds: columns.map((column) => column.id), replaceWith: "space" }; case "find-replace": return { type, id, columnIds: columns.map((column) => column.id), find: "find", replace: "", caseSensitive: true };
    case "regex-replace": return { type, id, columnIds: columns.map((column) => column.id), pattern: "\\s+", flags: "g", replace: " " };
    case "dedupe-by-columns": return { type, id, columnIds: [requireOne()], keep: "first" }; case "filter-rows": return { type, id, mode: "keep", columnId: requireOne(), operator: "empty", caseSensitive: true };
    case "fill-empty-cells": return { type, id, columnIds: columns.map((column) => column.id), source: "above" }; case "unify-date-format": return { type, id, columnIds: [requireOne()], outputFormat: "yyyy-mm-dd", inputHint: "auto" };
    case "format-phone-number": case "format-business-number": return { type, id, columnIds: [requireOne()], style: "dash" } as ExcelCleanerRule;
  }
}

function optionsFor(item: FileItem, pipeline: ExcelCleanerPipeline, output: "xlsx" | "csv" | "both", csvSafeMode: boolean, confirmFormulaDowngrade: boolean) {
  return { selections: item.selectedSheets.map((sheetName) => ({ sheetName, headerRow: item.headerRows[sheetName] ?? 1 })), pipeline, output, csvSafeMode, confirmFormulaDowngrade, previewRows: 20 };
}
function createDownload(fileId: string, output: ExcelCleanerOutput, names: SafeFileNameRegistry, urls: { current: Set<string> }): DownloadItem {
  const fileName = createUniqueSafeFileName(output.suggestedName, names, output.kind === "xlsx" ? "cleaned.xlsx" : "cleaned.csv");
  const blob = new Blob([output.buffer], { type: output.kind === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv;charset=utf-8" });
  output.buffer = new ArrayBuffer(0);
  return { fileId, fileName, blob, url: keepUrl(URL.createObjectURL(blob), urls), kind: output.kind, csvRiskCount: output.csvRiskCount ?? 0 };
}
function keepUrl(url: string, ref: { current: Set<string> }) { ref.current.add(url); return url; }
function safeError(error: unknown, t: LooseT) {
  const typed = error as { code?: string; details?: string[]; ruleId?: string } | undefined;
  const code = typed?.code ?? "PROCESSING_FAILED";
  const base = t(`features:excelCleaner.error.${code}`, { defaultValue: t("features:excelCleaner.error.PROCESSING_FAILED") });
  const detail = code === "FORMULA_CACHE_MISSING" && typed?.details?.length ? ` ${t("features:excelCleaner.error.cells", { cells: typed.details.slice(0, 20).join(", "), count: typed.details.length })}` : "";
  const rule = typed?.ruleId ? ` ${t("features:excelCleaner.error.rule", { id: typed.ruleId })}` : "";
  return `${base}${detail}${rule}`;
}
function progressText(phase: string | undefined, ruleId: string | undefined, index: number, total: number, t: LooseT) { return t(`features:excelCleaner.progress.${phase ?? "PROCESSING"}`, { defaultValue: t("features:excelCleaner.progress.PROCESSING"), current: index + 1, total, rule: ruleId ?? "" }); }
function draftTypeLabel(text: string, t: LooseT) { try { const type = JSON.parse(text).type; return typeof type === "string" ? t(`features:excelCleaner.rules.${type}`, { defaultValue: type }) : ""; } catch { return ""; } }
function columnLabel(id: string, initial: Array<{ id: string; name: string }>, pipeline: ExcelCleanerPipeline) {
  const source = initial.find((column) => column.id === id);
  if (source) {
    let name = source.name;
    pipeline.rules.forEach((rule) => { if (rule.type === "rename-column" && rule.columnId === id) name = rule.newName; });
    return name;
  }
  for (const rule of pipeline.rules) {
    if ((rule.type === "combine-columns" || rule.type === "add-constant-column" || rule.type === "add-row-number-column") && rule.outputColumnId === id) return rule.outputName;
    if (rule.type === "split-column") { const index = rule.outputColumnIds.indexOf(id); if (index >= 0) return rule.outputNames[index]; }
  }
  return id;
}
