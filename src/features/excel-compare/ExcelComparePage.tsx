import { BlobWriter } from "@zip.js/zip.js";
import { AlertCircle, ArrowLeftRight, Download, FileSpreadsheet, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { ToolGuide } from "../../components/ToolGuide";
import { PageHeader, PrimaryButton, SectionCard, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { createUniqueSafeFileName, SafeFileNameRegistry, type SafeFileName } from "../../utils/fileNameSafety.ts";
import { writeZipArchive } from "../../utils/zipArchive.ts";
import { inspectExcelCompareFile, runExcelComparePair } from "./excelCompareClient.ts";
import { PairFileDropZone } from "./PairFileDropZone.tsx";
import { assignPairFiles, swapPairSides, type PairState } from "./pairFiles.ts";
import { isReconcileConfigValid } from "./reconcileConfig.ts";
import { assertReportBlobSize } from "./reportIntegrity.ts";
import {
  DEFAULT_EXCEL_COMPARE_OPTIONS,
  type DuplicateKeyPolicy,
  type ExcelCompareMode,
  type ExcelComparePairOptions,
  type ExcelComparePairResult,
  type ExcelCompareStatus,
} from "./types.ts";

interface CompletedPair {
  pairId: number;
  result: ExcelComparePairResult;
  blob: Blob;
  url: string;
  fileName: SafeFileName;
}

interface FailedPair {
  pairId: number;
  leftName: string;
  rightName: string;
  message: string;
}

const STATUSES: ExcelCompareStatus[] = ["matched", "changed", "added", "removed", "duplicate", "ambiguous", "unmatched", "error"];
const ACCEPT = ".xlsx,.xlsm,.xls,.xlsb,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
type LooseT = (key: string, options?: Record<string, unknown>) => string;

export function ExcelComparePage() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const translate = t as unknown as LooseT;
  const language = i18n.language.startsWith("en") ? "en" : "ko";
  const nextPairId = useRef(2);
  const operation = useOperationProgress();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const objectUrls = useRef<Set<string>>(new Set());
  const pendingRevokeUrls = useRef<string[]>([]);
  const [pairs, setPairs] = useState<PairState[]>([newPair(1)]);
  const [mode, setMode] = useState<ExcelCompareMode>("position");
  const [normalization, setNormalization] = useState({ ...DEFAULT_EXCEL_COMPARE_OPTIONS });
  const [completed, setCompleted] = useState<CompletedPair[]>([]);
  const [failed, setFailed] = useState<FailedPair[]>([]);
  const [zipResult, setZipResult] = useState<{ url: string; fileName: SafeFileName; size: number }>();
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<Set<ExcelCompareStatus>>(() => new Set(STATUSES));
  const [visibleLimit, setVisibleLimit] = useState(500);

  useEffect(() => {
    const activeUrls = new Set([...completed.map((item) => item.url), ...(zipResult ? [zipResult.url] : [])]);
    const pending = pendingRevokeUrls.current;
    pendingRevokeUrls.current = [];
    pending.forEach((url) => {
      if (activeUrls.has(url)) return;
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
    });
  }, [completed, zipResult]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const updatePair = (id: number, update: Partial<PairState> | ((pair: PairState) => PairState)) => {
    setPairs((current) => current.map((pair) => pair.id !== id ? pair : typeof update === "function" ? update(pair) : { ...pair, ...update }));
  };

  const selectFile = async (pairId: number, side: "left" | "right", file: File | undefined) => {
    const fileKey = side;
    const inspectionKey = `${side}Inspection` as const;
    const errorKey = `${side}Error` as const;
    const inspectingKey = `${side}Inspecting` as const;
    updatePair(pairId, { [fileKey]: file, [inspectionKey]: undefined, [errorKey]: undefined, [inspectingKey]: Boolean(file) } as Partial<PairState>);
    if (!file) return;
    try {
      const inspection = await inspectExcelCompareFile(file, language);
      updatePair(pairId, (pair) => {
        if (pair[side] !== file) return pair;
        const firstSheet = inspection.sheets[0]?.name ?? "";
        return { ...pair, [inspectionKey]: inspection, [errorKey]: undefined, [`${side}Sheet`]: firstSheet, [`${side}HeaderRow`]: 1 };
      });
    } catch (error) {
      updatePair(pairId, (pair) => pair[side] === file ? { ...pair, [errorKey]: safeError(error, translate) } : pair);
    } finally {
      updatePair(pairId, (pair) => pair[side] === file ? { ...pair, [inspectingKey]: false } : pair);
    }
  };

  const refreshHeader = async (pairId: number, side: "left" | "right", headerRow: number) => {
    const pair = pairs.find((item) => item.id === pairId);
    const file = pair?.[side];
    if (!file || !Number.isInteger(headerRow) || headerRow < 1) return;
    try {
      const next = await inspectExcelCompareFile(file, language, undefined, [1, headerRow]);
      updatePair(pairId, (current) => current[side] === file ? { ...current, [`${side}Inspection`]: next } : current);
    } catch {
      // The initial inspection already owns the user-facing file error.
    }
  };

  const addPair = () => setPairs((current) => [...current, newPair(nextPairId.current++)]);
  const removePair = (id: number) => setPairs((current) => current.length === 1 ? current : current.filter((pair) => pair.id !== id));
  const cleanupResults = () => {
    pendingRevokeUrls.current.push(...completed.map((item) => item.url), ...(zipResult ? [zipResult.url] : []));
    setCompleted([]);
    setFailed([]);
    setZipResult(undefined);
  };

  const ready = pairs.length > 0 && pairs.every((pair) => pairConfigured(pair, mode)) && pairs.some((pair) => pairReady(pair, mode));

  const run = async () => {
    if (!ready || operation.status === "running") return;
    cleanupResults();
    const controller = new AbortController();
    controllerRef.current = controller;
    const names = new SafeFileNameRegistry();
    const successes: CompletedPair[] = [];
    const failures: FailedPair[] = [];
    operation.start(t("features:excelCompare.progress.starting", { count: pairs.length }));
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      if (controller.signal.aborted) break;
      const options = pairOptions(pair, mode, normalization);
      try {
        const result = await runExcelComparePair(pair.left!, pair.right!, options, language, controller.signal, ({ progress, phase }) => {
          const overall = Math.round(((index + progress / 100) / pairs.length) * 92);
          operation.updateCurrent(overall, t(`features:excelCompare.progress.${phase ?? "COMPARING"}` as never, { current: index + 1, total: pairs.length }));
        });
        const fileName = createUniqueSafeFileName(`${fileStem(pair.left!.name)}-vs-${fileStem(pair.right!.name)}.xlsx`, names, `comparison-${index + 1}.xlsx`);
        const blob = new Blob([result.reportBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        assertReportBlobSize(blob, result.reportByteLength);
        result.reportBuffer = new ArrayBuffer(0);
        const url = keepObjectUrl(URL.createObjectURL(blob), objectUrls);
        const item = { pairId: pair.id, result, blob, url, fileName };
        successes.push(item);
        setCompleted([...successes]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") break;
        const failure = { pairId: pair.id, leftName: pair.left!.name, rightName: pair.right!.name, message: safeError(error, translate) };
        failures.push(failure);
        setFailed([...failures]);
      }
    }
    if (controller.signal.aborted) {
      operation.fail(t("features:excelCompare.progress.canceled"));
      controllerRef.current = undefined;
      return;
    }
    if (successes.length >= 2) {
      operation.update(94, t("features:excelCompare.progress.ZIPPING"));
      try {
        const writer = new BlobWriter("application/zip");
        await writeZipArchive(successes.map((item) => ({ fileName: item.fileName, blob: item.blob })), writer, controller.signal);
        const blob = await writer.getData();
        const fileName = createUniqueSafeFileName("worklazy-excel-comparisons.zip", names, "comparisons.zip");
        const url = keepObjectUrl(URL.createObjectURL(blob), objectUrls);
        setZipResult({ url, fileName, size: blob.size });
      } catch (error) {
        failures.push({ pairId: -1, leftName: "", rightName: "", message: safeError(error, translate) });
        setFailed([...failures]);
      }
    }
    operation.succeed(t("features:excelCompare.progress.complete", { success: successes.length, failed: failures.length }));
    controllerRef.current = undefined;
  };

  const toggleStatus = (status: ExcelCompareStatus) => {
    setVisibleLimit(500);
    setStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  const resultRows = useMemo(() => {
    const query = search.normalize("NFC").toLocaleLowerCase(language);
    return completed.flatMap((item, pairIndex) => item.result.records
      .filter((record) => statuses.has(record.status))
      .filter((record) => !query || [record.key, record.leftValue, record.rightValue, record.change, record.reason].join(" ").normalize("NFC").toLocaleLowerCase(language).includes(query))
      .map((record) => ({ item, pairIndex, record })));
  }, [completed, language, search, statuses]);

  return (
    <div className="page tool-page page-enter excel-compare-page" data-testid="excel-compare-page">
      <PageHeader eyebrow="EXCEL COMPARE" title={t("features:excelCompare.title")} description={t("features:excelCompare.description")} />

      <SectionCard step={1} title={t("features:excelCompare.pairs.title")} description={t("features:excelCompare.pairs.description")}>
        <div className="excel-compare-pair-list">
          {pairs.map((pair, index) => <PairCard key={pair.id} pair={pair} index={index} mode={mode} busy={operation.status === "running"} t={translate} updatePair={updatePair} selectFile={selectFile} refreshHeader={refreshHeader} removePair={removePair} canRemove={pairs.length > 1} />)}
        </div>
        <button className="secondary-button excel-add-pair" type="button" onClick={addPair} disabled={operation.status === "running"}><Plus size={17} /> {t("features:excelCompare.pairs.add")}</button>
      </SectionCard>

      <SectionCard step={2} title={t("features:excelCompare.method.title")} description={t("features:excelCompare.method.description")}>
        <div className="excel-compare-mode-grid" role="radiogroup" aria-label={t("features:excelCompare.method.title")}>
          {(["position", "key", "reconcile"] as ExcelCompareMode[]).map((value) => <button type="button" role="radio" aria-checked={mode === value} className={mode === value ? "selected" : ""} key={value} onClick={() => setMode(value)}><strong>{t(`features:excelCompare.method.${value}` as never)}</strong><small>{t(`features:excelCompare.method.${value}Description` as never)}</small></button>)}
        </div>
      </SectionCard>

      <SectionCard step={3} title={t("features:excelCompare.options.title")} description={t("features:excelCompare.options.description")}>
        <NormalizationOptions value={normalization} onChange={setNormalization} t={translate} />
      </SectionCard>

      <SectionCard title={t("features:excelCompare.support.title")} description={t("features:excelCompare.support.description")}>
        <SupportTable t={translate} />
      </SectionCard>

      <PrimaryButton accent="green" disabled={!ready} loading={operation.status === "running"} onClick={() => void run()}><FileSpreadsheet size={18} /> {t("features:excelCompare.actions.compare", { count: pairs.length })}</PrimaryButton>
      {operation.status === "running" && <div className="cancel-operation"><button className="secondary-button danger" type="button" onClick={() => controllerRef.current?.abort()}><X size={16} /> {t("features:excelCompare.actions.cancel")}</button></div>}
      <OperationProgress {...operation} accent="green" title={t("features:excelCompare.progress.title")} />

      {(completed.length > 0 || failed.length > 0) && <section className="excel-compare-results" aria-labelledby="excel-compare-results-title">
        <div className="content-heading"><div><p className="eyebrow">RESULTS</p><h2 id="excel-compare-results-title">{t("features:excelCompare.results.title")}</h2><p>{t("features:excelCompare.results.description", { success: completed.length, failed: failed.length })}</p></div></div>
        <div className="excel-report-downloads">
          {completed.map((item, index) => <a className="result-download accent-green" key={item.pairId} href={item.url} download={item.fileName}><Download size={18} /><span><strong>{t("features:excelCompare.results.pairReport", { number: index + 1 })}</strong><small>{item.fileName} · {formatBytes(item.blob.size)}</small></span></a>)}
          {zipResult && <a className="result-download accent-violet" href={zipResult.url} download={zipResult.fileName}><Download size={18} /><span><strong>{t("features:excelCompare.results.zip")}</strong><small>{zipResult.fileName} · {formatBytes(zipResult.size)}</small></span></a>}
        </div>
        {completed.length > 0 && <p className="excel-download-note">{t("features:excelCompare.results.downloadCheck")}</p>}
        {failed.map((item) => <div className="inline-notice error" key={`${item.pairId}-${item.leftName}`}><AlertCircle size={16} /><span><strong>{item.leftName && item.rightName ? `${item.leftName} ↔ ${item.rightName}` : t("features:excelCompare.results.zip")}</strong>{item.message}</span></div>)}
        <div className="excel-result-toolbar">
          <div className="excel-status-filters" aria-label={t("features:excelCompare.results.filters")}>
            {STATUSES.map((status) => <button type="button" data-status={status} aria-pressed={statuses.has(status)} className={statuses.has(status) ? "selected" : ""} key={status} onClick={() => toggleStatus(status)}><span />{t(`features:excelCompare.status.${status}` as never)}</button>)}
          </div>
          <label className="excel-result-search"><Search size={16} /><span className="visually-hidden">{t("features:excelCompare.results.search")}</span><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleLimit(500); }} placeholder={t("features:excelCompare.results.search")} /></label>
        </div>
        <div className="excel-result-table-wrap">
          <table className="excel-result-table"><thead><tr><th>{t("features:excelCompare.results.pair")}</th><th>{t("features:excelCompare.results.state")}</th><th>{t("features:excelCompare.results.location")}</th><th>{t("features:excelCompare.results.key")}</th><th>{t("features:excelCompare.results.left")}</th><th>{t("features:excelCompare.results.right")}</th><th>{t("features:excelCompare.results.reason")}</th></tr></thead><tbody>
            {resultRows.slice(0, visibleLimit).map(({ item, pairIndex, record }, index) => <tr data-status={record.status} key={`${item.pairId}-${index}-${record.leftRow}-${record.rightRow}-${record.leftColumn}`}><td>{pairIndex + 1}</td><td><span className="excel-status-text"><i />{t(`features:excelCompare.status.${record.status}` as never)}</span></td><td>{locationText(record.leftRow, record.rightRow, record.leftColumn, record.rightColumn)}</td><td>{record.key}</td><td>{record.leftValue}</td><td>{record.rightValue}</td><td>{reasonText(record.reason, translate)}</td></tr>)}
          </tbody></table>
          {!resultRows.length && <p className="excel-empty-result">{t("features:excelCompare.results.empty")}</p>}
        </div>
        {resultRows.length > visibleLimit && <button className="secondary-button excel-show-more" type="button" onClick={() => setVisibleLimit((current) => current + 500)}>{t("features:excelCompare.results.showMore", { remaining: resultRows.length - visibleLimit })}</button>}
      </section>}

      <ToolGuide title={t("features:excelCompare.guide.title")} description={t("features:excelCompare.guide.description")} blocks={(t("features:excelCompare.guide.blocks", { returnObjects: true }) as Array<{ title: string; text: string }>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:excelCompare.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map((item) => ({ question: item.q, answer: item.a }))} />
    </div>
  );
}

function PairCard({ pair, index, mode, busy, t, updatePair, selectFile, refreshHeader, removePair, canRemove }: {
  pair: PairState; index: number; mode: ExcelCompareMode; busy: boolean; t: LooseT;
  updatePair: (id: number, update: Partial<PairState> | ((pair: PairState) => PairState)) => void;
  selectFile: (id: number, side: "left" | "right", file: File | undefined) => Promise<void>;
  refreshHeader: (id: number, side: "left" | "right", row: number) => Promise<void>;
  removePair: (id: number) => void; canRemove: boolean;
}) {
  const leftHeaders = headersFor(pair, "left");
  const rightHeaders = headersFor(pair, "right");
  const inspectionBusy = pair.leftInspecting || pair.rightInspecting;
  const addFiles = async (files: File[]) => {
    const assignment = assignPairFiles({ left: pair.left, right: pair.right }, files);
    updatePair(pair.id, { unassignedFileCount: assignment.unassignedFiles.length });
    const selections: Array<Promise<void>> = [];
    if (!pair.left && assignment.left) selections.push(selectFile(pair.id, "left", assignment.left));
    if (!pair.right && assignment.right) selections.push(selectFile(pair.id, "right", assignment.right));
    await Promise.all(selections);
  };
  return <article className="excel-compare-pair" data-testid="excel-compare-pair">
    <div className="excel-pair-heading"><span className="pair-number">{index + 1}</span><div><strong>{t("features:excelCompare.pairs.pair", { number: index + 1 })}</strong><small>{t("features:excelCompare.pairs.pairHint")}</small></div><div className="excel-pair-actions"><button className="secondary-button small excel-pair-swap" type="button" disabled={busy || inspectionBusy} onClick={() => updatePair(pair.id, swapPairSides)} aria-label={t("features:excelCompare.pairs.swap")}><ArrowLeftRight size={17} /><span aria-hidden="true">⇄</span></button>{canRemove && <button className="remove-button" type="button" disabled={busy} onClick={() => removePair(pair.id)} aria-label={t("features:excelCompare.pairs.remove", { number: index + 1 })}><Trash2 size={17} /></button>}</div></div>
    <PairFileDropZone label={t("features:excelCompare.pairs.dropLabel")} hint={t("features:excelCompare.pairs.fileHint")} accept={ACCEPT} files={[pair.left, pair.right].filter((file): file is File => Boolean(file))} onFiles={addFiles} disabled={busy} />
    {pair.unassignedFileCount > 0 && <p className="inline-notice warning excel-pair-overflow" role="status"><AlertCircle size={15} /> {t("features:excelCompare.pairs.overflow", { count: pair.unassignedFileCount })}</p>}
    <div className="excel-pair-files">
      {(["left", "right"] as const).map((side) => <div className="excel-pair-side" key={side}>
        <p className="field-label">{t(`features:excelCompare.pairs.${side}` as never)}</p>
        {pair[side] && <div className="excel-selected-file"><FileSpreadsheet size={16} /><span><strong>{pair[side]!.name}</strong><small>{formatBytes(pair[side]!.size)}</small></span><button type="button" className="remove-button" onClick={() => void selectFile(pair.id, side, undefined)} aria-label={t("common:files.remove", { name: pair[side]!.name })}><X size={15} /></button></div>}
        {pair[`${side}Error`] && <p className="field-error"><AlertCircle size={14} /> {pair[`${side}Error`]}</p>}
        {pair[`${side}Inspection`] && <div className="excel-sheet-fields">
          <label><span>{t("features:excelCompare.pairs.sheet")}</span><select value={pair[`${side}Sheet`]} onChange={(event) => updatePair(pair.id, { [`${side}Sheet`]: event.target.value } as Partial<PairState>)}>{pair[`${side}Inspection`]!.sheets.map((sheet) => <option key={sheet.name}>{sheet.name}</option>)}</select></label>
          <label><span>{t("features:excelCompare.pairs.headerRow")}</span><input type="number" min={1} max={selectedSheet(pair, side)?.rowCount || 1} value={pair[`${side}HeaderRow`]} onChange={(event) => updatePair(pair.id, { [`${side}HeaderRow`]: Math.max(1, Number(event.target.value) || 1) } as Partial<PairState>)} onBlur={() => void refreshHeader(pair.id, side, pair[`${side}HeaderRow`])} /></label>
          <p>{formatLabel(pair[`${side}Inspection`]!.format, pair[`${side}Inspection`]!.supportsStyleComparison, t)}</p>
        </div>}
      </div>)}
    </div>
    {mode === "key" && pair.leftInspection && pair.rightInspection && <div className="excel-pair-mode-options">
      <h3>{t("features:excelCompare.key.title")}</h3>
      <div className="excel-key-grid"><ColumnPicker label={t("features:excelCompare.key.leftPrimary")} headers={leftHeaders} value={pair.primaryLeft} onChange={(value) => updatePair(pair.id, { primaryLeft: value })} /><ColumnPicker label={t("features:excelCompare.key.rightPrimary")} headers={rightHeaders} value={pair.primaryRight} onChange={(value) => updatePair(pair.id, { primaryRight: value })} /></div>
      <label className="excel-select-field"><span>{t("features:excelCompare.key.duplicatePolicy")}</span><select value={pair.duplicatePolicy} onChange={(event) => updatePair(pair.id, { duplicatePolicy: event.target.value as DuplicateKeyPolicy })}><option value="secondary">{t("features:excelCompare.key.secondary")}</option><option value="occurrence">{t("features:excelCompare.key.occurrence")}</option><option value="error">{t("features:excelCompare.key.error")}</option></select></label>
      {pair.duplicatePolicy === "secondary" && <div className="excel-key-grid"><ColumnPicker label={t("features:excelCompare.key.leftSecondary")} headers={leftHeaders} value={pair.secondaryLeft} onChange={(value) => updatePair(pair.id, { secondaryLeft: value })} /><ColumnPicker label={t("features:excelCompare.key.rightSecondary")} headers={rightHeaders} value={pair.secondaryRight} onChange={(value) => updatePair(pair.id, { secondaryRight: value })} /></div>}
    </div>}
    {mode === "reconcile" && pair.leftInspection && pair.rightInspection && <ReconcileOptions pair={pair} leftHeaders={leftHeaders} rightHeaders={rightHeaders} updatePair={updatePair} t={t} />}
  </article>;
}

function ColumnPicker({ label, headers, value, onChange }: { label: string; headers: string[]; value: number[]; onChange: (value: number[]) => void }) {
  return <fieldset className="excel-column-picker"><legend>{label}</legend><div>{headers.map((header, index) => { const column = index + 1; const selected = value.includes(column); return <button key={`${column}-${header}`} type="button" aria-pressed={selected} className={selected ? "selected" : ""} onClick={() => onChange(selected ? value.filter((item) => item !== column) : [...value, column].sort((a, b) => a - b))}><span>{columnLabel(column)}</span>{header}</button>; })}</div></fieldset>;
}

function ReconcileOptions({ pair, leftHeaders, rightHeaders, updatePair, t }: { pair: PairState; leftHeaders: string[]; rightHeaders: string[]; updatePair: (id: number, update: Partial<PairState>) => void; t: LooseT }) {
  const update = (key: keyof PairState["reconcile"], value: number | boolean | undefined) => updatePair(pair.id, { reconcile: { ...pair.reconcile, [key]: value } });
  const updateOptionalPair = (
    leftKey: "leftDateColumn" | "leftPartnerColumn",
    rightKey: "rightDateColumn" | "rightPartnerColumn",
    side: "left" | "right",
    rawValue: string,
  ) => {
    if (!rawValue) {
      updatePair(pair.id, { reconcile: { ...pair.reconcile, [leftKey]: undefined, [rightKey]: undefined } });
      return;
    }
    const counterpartHeaders = side === "left" ? rightHeaders : leftHeaders;
    if (!counterpartHeaders.length) {
      updatePair(pair.id, { reconcile: { ...pair.reconcile, [leftKey]: undefined, [rightKey]: undefined } });
      return;
    }
    const ownKey = side === "left" ? leftKey : rightKey;
    const counterpartKey = side === "left" ? rightKey : leftKey;
    updatePair(pair.id, { reconcile: {
      ...pair.reconcile,
      [ownKey]: Number(rawValue),
      [counterpartKey]: pair.reconcile[counterpartKey] ?? 1,
    } });
  };
  const amountFields = [
    ["leftAmountColumn", "leftAmount", leftHeaders], ["rightAmountColumn", "rightAmount", rightHeaders],
  ] as const;
  const optionalFields = [
    ["leftDateColumn", "rightDateColumn", "left", "leftDate", leftHeaders],
    ["leftDateColumn", "rightDateColumn", "right", "rightDate", rightHeaders],
    ["leftPartnerColumn", "rightPartnerColumn", "left", "leftPartner", leftHeaders],
    ["leftPartnerColumn", "rightPartnerColumn", "right", "rightPartner", rightHeaders],
  ] as const;
  const dateUnused = pair.reconcile.leftDateColumn === undefined;
  return <div className="excel-pair-mode-options"><h3>{t("features:excelCompare.reconcile.title")}</h3><div className="excel-reconcile-grid">
    {amountFields.map(([key, label, headers]) => <label key={key} data-reconcile-field={key}><span>{t(`features:excelCompare.reconcile.${label}` as never)}</span><select value={pair.reconcile[key]} onChange={(event) => update(key, Number(event.target.value))}>{headers.map((header, index) => <option value={index + 1} key={`${index}-${header}`}>{columnLabel(index + 1)} · {header}</option>)}</select></label>)}
    {optionalFields.map(([leftKey, rightKey, side, label, headers]) => {
      const key = side === "left" ? leftKey : rightKey;
      return <label key={key} data-reconcile-field={key}><span>{t(`features:excelCompare.reconcile.${label}` as never)}</span><select value={pair.reconcile[key] ?? ""} onChange={(event) => updateOptionalPair(leftKey, rightKey, side, event.target.value)}><option value="">{t("features:excelCompare.reconcile.unused")}</option>{headers.map((header, index) => <option value={index + 1} key={`${index}-${header}`}>{columnLabel(index + 1)} · {header}</option>)}</select></label>;
    })}
  </div><div className="excel-number-options"><label><span>{t("features:excelCompare.reconcile.dateTolerance")}</span><input type="number" min={0} disabled={dateUnused} value={pair.reconcile.dateToleranceDays} onChange={(event) => update("dateToleranceDays", Math.max(0, Number(event.target.value) || 0))} /></label><label><span>{t("features:excelCompare.reconcile.roundingUnit")}</span><input type="number" min="0.000001" step="0.01" value={pair.reconcile.roundingUnit} onChange={(event) => update("roundingUnit", Math.max(0.000001, Number(event.target.value) || 0.01))} /></label></div><ToggleRow label={t("features:excelCompare.reconcile.grouped")} description={t("features:excelCompare.reconcile.groupedDescription")} checked={pair.reconcile.allowGroupedMatches} onChange={(checked) => update("allowGroupedMatches", checked)} /></div>;
}

function NormalizationOptions({ value, onChange, t }: { value: typeof DEFAULT_EXCEL_COMPARE_OPTIONS; onChange: (value: typeof DEFAULT_EXCEL_COMPARE_OPTIONS) => void; t: LooseT }) {
  const toggles = ["trimWhitespace", "collapseWhitespace", "normalizeLineBreaks", "ignoreCase", "unicodeNfc", "stripNumberSymbols", "numericStrings", "ignoreDateDisplayFormat", "blankEqualsEmpty", "blankEqualsZero", "compareDisplayValues", "compareFormatting"] as const;
  return <><div className="excel-normalization-grid">{toggles.map((key) => <ToggleRow key={key} label={t(`features:excelCompare.options.${key}` as never)} description={key === "numericStrings" ? t("features:excelCompare.options.numericStringsDescription") : key === "blankEqualsZero" ? t("features:excelCompare.options.blankEqualsZeroDescription") : undefined} checked={value[key]} onChange={(checked) => onChange({ ...value, [key]: checked })} />)}</div><div className="excel-number-options"><label><span>{t("features:excelCompare.options.formulaMode")}</span><select value={value.formulaMode} onChange={(event) => onChange({ ...value, formulaMode: event.target.value as typeof value.formulaMode })}><option value="formula">{t("features:excelCompare.options.formula")}</option><option value="cached">{t("features:excelCompare.options.cached")}</option><option value="both">{t("features:excelCompare.options.both")}</option></select></label><label><span>{t("features:excelCompare.options.absoluteTolerance")}</span><input type="number" min={0} step="any" value={value.absoluteTolerance} onChange={(event) => onChange({ ...value, absoluteTolerance: Math.max(0, Number(event.target.value) || 0) })} /></label><label><span>{t("features:excelCompare.options.relativeTolerance")}</span><input type="number" min={0} step="0.0001" value={value.relativeTolerance} onChange={(event) => onChange({ ...value, relativeTolerance: Math.max(0, Number(event.target.value) || 0) })} /></label></div></>;
}

function SupportTable({ t }: { t: LooseT }) {
  const rows = [
    ["XLSX", "○", "○", "○", "○", "○", "○"], ["XLSM", "○", "○", "○", "○", "○*", "○"],
    ["XLS (BIFF8)", "○", "○", "○", "○", "×", "○"], ["XLSB", "○", "○", "○", "○", "×", "○"],
    ["SpreadsheetML .xls", "○", "○", "○", "○", "×", "○"], ["CSV", "○", "—", "—", "—", "—", "—"],
  ];
  return <div className="excel-support-table-wrap"><table className="excel-support-table"><thead><tr>{["format", "value", "display", "formula", "cache", "style", "merge"].map((key) => <th key={key}>{t(`features:excelCompare.support.${key}` as never)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table><p>{t("features:excelCompare.support.note")}</p></div>;
}

function newPair(id: number): PairState {
  return { id, leftInspecting: false, rightInspecting: false, leftSheet: "", rightSheet: "", leftHeaderRow: 1, rightHeaderRow: 1, primaryLeft: [1], primaryRight: [1], secondaryLeft: [], secondaryRight: [], duplicatePolicy: "error", reconcile: { leftAmountColumn: 1, rightAmountColumn: 1, leftDateColumn: 2, rightDateColumn: 2, leftPartnerColumn: 3, rightPartnerColumn: 3, dateToleranceDays: 0, allowGroupedMatches: false, roundingUnit: 0.01 }, unassignedFileCount: 0 };
}

function pairOptions(pair: PairState, mode: ExcelCompareMode, normalization: typeof DEFAULT_EXCEL_COMPARE_OPTIONS): ExcelComparePairOptions {
  return { mode, left: { sheetName: pair.leftSheet, headerRow: pair.leftHeaderRow }, right: { sheetName: pair.rightSheet, headerRow: pair.rightHeaderRow }, normalization, key: mode === "key" ? { leftColumns: pair.primaryLeft, rightColumns: pair.primaryRight, secondaryLeftColumns: pair.secondaryLeft, secondaryRightColumns: pair.secondaryRight, duplicatePolicy: pair.duplicatePolicy } : undefined, reconcile: mode === "reconcile" ? pair.reconcile : undefined };
}

function pairReady(pair: PairState, mode: ExcelCompareMode) {
  if (!pair.left || !pair.right || !pair.leftInspection || !pair.rightInspection || pair.leftError || pair.rightError || !pair.leftSheet || !pair.rightSheet) return false;
  if (mode === "key") return pair.primaryLeft.length > 0 && pair.primaryLeft.length === pair.primaryRight.length && (pair.duplicatePolicy !== "secondary" || pair.secondaryLeft.length === pair.secondaryRight.length);
  if (mode === "reconcile") return isReconcileConfigValid(pair.reconcile);
  return true;
}

function pairConfigured(pair: PairState, mode: ExcelCompareMode) {
  if (!pair.left || !pair.right) return false;
  if (pair.leftError || pair.rightError) return true;
  return pairReady(pair, mode);
}

function selectedSheet(pair: PairState, side: "left" | "right") { return pair[`${side}Inspection`]?.sheets.find((sheet) => sheet.name === pair[`${side}Sheet`]); }
function headersFor(pair: PairState, side: "left" | "right") { const sheet = selectedSheet(pair, side); const row = sheet?.headerRows.find((item) => item.row === pair[`${side}HeaderRow`]); return row?.values ?? Array.from({ length: sheet?.columnCount ?? 0 }, (_, index) => columnLabel(index + 1)); }
function columnLabel(column: number) { let value = column; let result = ""; while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); } return result; }
function fileStem(name: string) { return name.replace(/\.[^.]+$/u, ""); }
function keepObjectUrl(url: string, ref: { current: Set<string> }) { ref.current.add(url); return url; }
function locationText(leftRow: number | null, rightRow: number | null, leftColumn: number | null, rightColumn: number | null) { return `L ${leftRow ?? "–"}:${leftColumn ?? "–"} · R ${rightRow ?? "–"}:${rightColumn ?? "–"}`; }
function formatLabel(format: string, style: boolean, t: LooseT) { return `${format.toUpperCase()} · ${style ? t("features:excelCompare.pairs.styleSupported") : t("features:excelCompare.pairs.styleExcluded")}`; }
function reasonText(reason: string, t: LooseT) { return reason.split("+").map((code) => t(`features:excelCompare.reason.${code}`, { defaultValue: t("features:excelCompare.reason.generic") })).join(" · "); }
function safeError(error: unknown, t: LooseT) { const code = error && typeof error === "object" && "code" in error ? String(error.code) : "PROCESSING_FAILED"; return t(`features:excelCompare.error.${code}`, { defaultValue: t("features:excelCompare.error.PROCESSING_FAILED") }); }
