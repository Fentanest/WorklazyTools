import { BlobWriter } from "@zip.js/zip.js";
import { AlertCircle, ArrowLeftRight, Download, FileSpreadsheet, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect } from "../../components/UtilitySurface";
import { PageHeader, PrimaryButton, ToggleRow, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
const STATUS_DOT_CLASSES: Record<ExcelCompareStatus, string> = {
  matched: "bg-green-600",
  changed: "bg-amber-500",
  added: "bg-blue-600",
  removed: "bg-rose-500",
  duplicate: "bg-violet-600",
  ambiguous: "bg-violet-600",
  unmatched: "bg-muted-foreground",
  error: "bg-rose-500",
};
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
    <UtilityPage toolId="excel-compare">
      <div className="contents" data-testid="excel-compare-page">
      <PageHeader eyebrow="EXCEL COMPARE" title={t("features:excelCompare.title")} description={t("features:excelCompare.description")} />

      <UtilitySectionCard step={1} title={t("features:excelCompare.pairs.title")} description={t("features:excelCompare.pairs.description")}>
        <div className="grid gap-3" data-testid="excel-compare-pair-list">
          {pairs.map((pair, index) => <PairCard key={pair.id} pair={pair} index={index} mode={mode} busy={operation.status === "running"} t={translate} updatePair={updatePair} selectFile={selectFile} refreshHeader={refreshHeader} removePair={removePair} canRemove={pairs.length > 1} />)}
        </div>
        <Button className="mt-3 min-h-11 self-start rounded-xl border-green-700/50 px-4 font-bold text-green-800 shadow-sm hover:border-green-700! hover:bg-green-500/10! focus-visible:border-green-700! focus-visible:ring-green-700/30! dark:border-green-300/60 dark:text-green-300 dark:hover:border-green-300! dark:hover:bg-green-400/10!" data-testid="excel-add-pair" variant="outline" type="button" onClick={addPair} disabled={operation.status === "running"}><Plus size={17} /> {t("features:excelCompare.pairs.add")}</Button>
      </UtilitySectionCard>

      <UtilitySectionCard step={2} title={t("features:excelCompare.method.title")} description={t("features:excelCompare.method.description")}>
        <div className="grid grid-cols-3 gap-2 max-[720px]:grid-cols-1" data-testid="excel-compare-mode-grid" role="radiogroup" aria-label={t("features:excelCompare.method.title")}>
          {(["position", "key", "reconcile"] as ExcelCompareMode[]).map((value) => { const selected = mode === value; return <button type="button" role="radio" aria-checked={selected} data-selected={selected || undefined} className={`min-h-20 rounded-2xl border p-3 text-left outline-none transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-green-700/60 focus-visible:ring-3 focus-visible:ring-green-700/30 dark:hover:border-green-300/70 ${selected ? "border-green-700 bg-green-50 text-foreground ring-2 ring-green-700/25 dark:border-green-300 dark:bg-green-950/70 dark:ring-green-300/30" : "border-border bg-muted/45 text-foreground"}`} key={value} onClick={() => setMode(value)}><strong className="block text-sm">{t(`features:excelCompare.method.${value}` as never)}</strong><small className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t(`features:excelCompare.method.${value}Description` as never)}</small></button>; })}
        </div>
      </UtilitySectionCard>

      <UtilitySectionCard step={3} title={t("features:excelCompare.options.title")} description={t("features:excelCompare.options.description")}>
        <NormalizationOptions value={normalization} onChange={setNormalization} t={translate} />
      </UtilitySectionCard>

      <UtilitySectionCard title={t("features:excelCompare.support.title")} description={t("features:excelCompare.support.description")}>
        <SupportTable t={translate} />
      </UtilitySectionCard>

      <div data-testid="excel-compare-actions"><PrimaryButton accent="green" disabled={!ready} loading={operation.status === "running"} onClick={() => void run()}><FileSpreadsheet size={18} /> {t("features:excelCompare.actions.compare", { count: pairs.length })}</PrimaryButton></div>
      {operation.status === "running" && <div className="mt-2 flex justify-end"><Button className="rounded-xl" data-testid="excel-compare-cancel" variant="destructive" type="button" onClick={() => controllerRef.current?.abort()}><X size={16} /> {t("features:excelCompare.actions.cancel")}</Button></div>}
      <OperationProgress {...operation} accent="green" title={t("features:excelCompare.progress.title")} />

      {(completed.length > 0 || failed.length > 0) && <Card as="section" className="mt-4 gap-0 overflow-visible rounded-3xl border border-border p-4 shadow-sm" data-testid="excel-compare-results" aria-labelledby="excel-compare-results-title">
        <div><p className="text-xs font-extrabold tracking-[.08em] text-green-700 uppercase dark:text-green-300">RESULTS</p><h2 className="mt-1 font-heading text-xl font-medium" id="excel-compare-results-title">{t("features:excelCompare.results.title")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("features:excelCompare.results.description", { success: completed.length, failed: failed.length })}</p></div>
        <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1" data-testid="excel-report-downloads">
          {completed.map((item, index) => <Button render={<a href={item.url} download={item.fileName} data-testid="excel-report-download" />} variant="secondary" className="h-auto min-h-12 justify-start rounded-xl px-3 py-2 text-left" key={item.pairId}><Download size={18} /><span className="min-w-0"><strong className="block">{t("features:excelCompare.results.pairReport", { number: index + 1 })}</strong><small className="block overflow-hidden text-ellipsis text-xs text-muted-foreground">{item.fileName} · {formatBytes(item.blob.size)}</small></span></Button>)}
          {zipResult && <Button render={<a href={zipResult.url} download={zipResult.fileName} data-testid="excel-report-download" />} variant="secondary" className="h-auto min-h-12 justify-start rounded-xl px-3 py-2 text-left"><Download size={18} /><span className="min-w-0"><strong className="block">{t("features:excelCompare.results.zip")}</strong><small className="block overflow-hidden text-ellipsis text-xs text-muted-foreground">{zipResult.fileName} · {formatBytes(zipResult.size)}</small></span></Button>}
        </div>
        {completed.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{t("features:excelCompare.results.downloadCheck")}</p>}
        {failed.map((item) => <UtilityNotice className="mt-2" data-testid="excel-compare-error" tone="error" role="alert" key={`${item.pairId}-${item.leftName}`}><AlertCircle className="mt-0.5 shrink-0" size={16} /><span className="flex flex-col"><strong>{item.leftName && item.rightName ? `${item.leftName} ↔ ${item.rightName}` : t("features:excelCompare.results.zip")}</strong>{item.message}</span></UtilityNotice>)}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" data-testid="excel-status-filters" aria-label={t("features:excelCompare.results.filters")}>
            {STATUSES.map((status) => { const selected = statuses.has(status); return <Button type="button" size="sm" variant="outline" data-status={status} aria-pressed={selected} className={`rounded-full ${selected ? "border-green-700/60 bg-green-500/10 text-foreground dark:border-green-300/60" : "opacity-55"}`} key={status} onClick={() => toggleStatus(status)}><span className={`size-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />{t(`features:excelCompare.status.${status}` as never)}</Button>; })}
          </div>
          <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-input bg-background px-3 text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20" data-testid="excel-result-search"><Search size={16} /><span className="sr-only">{t("features:excelCompare.results.search")}</span><input className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground max-[620px]:text-base" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleLimit(500); }} placeholder={t("features:excelCompare.results.search")} /></label>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[920px] border-collapse text-sm [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left" data-testid="excel-result-table"><thead><tr><th>{t("features:excelCompare.results.pair")}</th><th>{t("features:excelCompare.results.state")}</th><th>{t("features:excelCompare.results.location")}</th><th>{t("features:excelCompare.results.key")}</th><th>{t("features:excelCompare.results.left")}</th><th>{t("features:excelCompare.results.right")}</th><th>{t("features:excelCompare.results.reason")}</th></tr></thead><tbody>
            {resultRows.slice(0, visibleLimit).map(({ item, pairIndex, record }, index) => <tr data-status={record.status} key={`${item.pairId}-${index}-${record.leftRow}-${record.rightRow}-${record.leftColumn}`}><td>{pairIndex + 1}</td><td><span className="font-bold">{t(`features:excelCompare.status.${record.status}` as never)}</span></td><td>{locationText(record.leftRow, record.rightRow, record.leftColumn, record.rightColumn)}</td><td>{record.key}</td><td>{record.leftValue}</td><td>{record.rightValue}</td><td>{reasonText(record.reason, translate)}</td></tr>)}
          </tbody></table>
          {!resultRows.length && <p className="p-4 text-center text-sm text-muted-foreground">{t("features:excelCompare.results.empty")}</p>}
        </div>
        {resultRows.length > visibleLimit && <Button className="mt-3 rounded-xl" variant="secondary" type="button" onClick={() => setVisibleLimit((current) => current + 500)}>{t("features:excelCompare.results.showMore", { remaining: resultRows.length - visibleLimit })}</Button>}
      </Card>}

      <ToolGuide title={t("features:excelCompare.guide.title")} description={t("features:excelCompare.guide.description")} blocks={(t("features:excelCompare.guide.blocks", { returnObjects: true }) as Array<{ title: string; text: string }>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("features:excelCompare.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map((item) => ({ question: item.q, answer: item.a }))} />
      </div>
    </UtilityPage>
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
  return <Card as="article" className="gap-0 overflow-visible rounded-3xl border border-border p-4 shadow-sm" data-testid="excel-compare-pair">
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-green-700 text-sm font-extrabold text-white">{index + 1}</span><div className="min-w-0"><strong className="block text-sm">{t("features:excelCompare.pairs.pair", { number: index + 1 })}</strong><small className="mt-0.5 block text-xs text-muted-foreground">{t("features:excelCompare.pairs.pairHint")}</small></div><div className="flex items-center gap-1.5"><Button className="size-11 rounded-xl border-green-700/60 text-green-800 shadow-sm hover:border-green-700! hover:bg-green-500/10! focus-visible:border-green-700! focus-visible:ring-green-700/30! dark:border-green-300/70 dark:text-green-300 dark:hover:border-green-300! dark:hover:bg-green-400/10!" data-testid="excel-pair-swap" variant="outline" size="icon-lg" type="button" disabled={busy || inspectionBusy} onClick={() => updatePair(pair.id, swapPairSides)} aria-label={t("features:excelCompare.pairs.swap")}><ArrowLeftRight size={19} /></Button>{canRemove && <Button className="size-11 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" variant="ghost" size="icon-lg" type="button" disabled={busy} onClick={() => removePair(pair.id)} aria-label={t("features:excelCompare.pairs.remove", { number: index + 1 })}><Trash2 size={18} /></Button>}</div></div>
    <PairFileDropZone label={t("features:excelCompare.pairs.dropLabel")} hint={t("features:excelCompare.pairs.fileHint")} accept={ACCEPT} files={[pair.left, pair.right].filter((file): file is File => Boolean(file))} onFiles={addFiles} disabled={busy} />
    {pair.unassignedFileCount > 0 && <UtilityNotice className="mt-2" data-testid="excel-pair-overflow" role="status"><AlertCircle className="mt-0.5 shrink-0" size={15} /> {t("features:excelCompare.pairs.overflow", { count: pair.unassignedFileCount })}</UtilityNotice>}
    <div className="mt-3 grid grid-cols-2 gap-3 max-[720px]:grid-cols-1" data-testid="excel-pair-files">
      {(["left", "right"] as const).map((side) => <div className="min-w-0 rounded-2xl border border-border bg-muted/35 p-3" key={side}>
        <p className="mb-2 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{t(`features:excelCompare.pairs.${side}` as never)}</p>
        {pair[side] && <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-background p-2 ring-1 ring-border" data-testid="excel-selected-file"><FileSpreadsheet className="text-green-700 dark:text-green-300" size={16} /><span className="min-w-0"><strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm">{pair[side]!.name}</strong><small className="block text-xs text-muted-foreground">{formatBytes(pair[side]!.size)}</small></span><Button type="button" variant="ghost" size="icon-sm" className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void selectFile(pair.id, side, undefined)} aria-label={t("common:files.remove", { name: pair[side]!.name })}><X size={15} /></Button></div>}
        {pair[`${side}Error`] && <p className="mt-2 flex items-start gap-1.5 text-sm font-bold text-destructive" data-testid="excel-file-error"><AlertCircle className="mt-0.5 shrink-0" size={14} /> {pair[`${side}Error`]}</p>}
        {pair[`${side}Inspection`] && <div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px] gap-2" data-testid="excel-sheet-fields">
          <UtilityField><span>{t("features:excelCompare.pairs.sheet")}</span><UtilitySelect value={pair[`${side}Sheet`]} onChange={(event) => updatePair(pair.id, { [`${side}Sheet`]: event.target.value } as Partial<PairState>)}>{pair[`${side}Inspection`]!.sheets.map((sheet) => <option key={sheet.name}>{sheet.name}</option>)}</UtilitySelect></UtilityField>
          <UtilityField><span>{t("features:excelCompare.pairs.headerRow")}</span><UtilityInput type="number" min={1} max={selectedSheet(pair, side)?.rowCount || 1} value={pair[`${side}HeaderRow`]} onChange={(event) => updatePair(pair.id, { [`${side}HeaderRow`]: Math.max(1, Number(event.target.value) || 1) } as Partial<PairState>)} onBlur={() => void refreshHeader(pair.id, side, pair[`${side}HeaderRow`])} /></UtilityField>
          <p className="col-span-full text-xs text-muted-foreground">{formatLabel(pair[`${side}Inspection`]!.format, pair[`${side}Inspection`]!.supportsStyleComparison, t)}</p>
        </div>}
      </div>)}
    </div>
    {mode === "key" && pair.leftInspection && pair.rightInspection && <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-3" data-testid="excel-pair-mode-options">
      <h3 className="mb-3 font-heading text-base font-medium">{t("features:excelCompare.key.title")}</h3>
      <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1"><ColumnPicker label={t("features:excelCompare.key.leftPrimary")} headers={leftHeaders} value={pair.primaryLeft} onChange={(value) => updatePair(pair.id, { primaryLeft: value })} /><ColumnPicker label={t("features:excelCompare.key.rightPrimary")} headers={rightHeaders} value={pair.primaryRight} onChange={(value) => updatePair(pair.id, { primaryRight: value })} /></div>
      <UtilityField className="mt-3"><span>{t("features:excelCompare.key.duplicatePolicy")}</span><UtilitySelect value={pair.duplicatePolicy} onChange={(event) => updatePair(pair.id, { duplicatePolicy: event.target.value as DuplicateKeyPolicy })}><option value="secondary">{t("features:excelCompare.key.secondary")}</option><option value="occurrence">{t("features:excelCompare.key.occurrence")}</option><option value="error">{t("features:excelCompare.key.error")}</option></UtilitySelect></UtilityField>
      {pair.duplicatePolicy === "secondary" && <div className="mt-3 grid grid-cols-2 gap-3 max-[720px]:grid-cols-1"><ColumnPicker label={t("features:excelCompare.key.leftSecondary")} headers={leftHeaders} value={pair.secondaryLeft} onChange={(value) => updatePair(pair.id, { secondaryLeft: value })} /><ColumnPicker label={t("features:excelCompare.key.rightSecondary")} headers={rightHeaders} value={pair.secondaryRight} onChange={(value) => updatePair(pair.id, { secondaryRight: value })} /></div>}
    </div>}
    {mode === "reconcile" && pair.leftInspection && pair.rightInspection && <ReconcileOptions pair={pair} leftHeaders={leftHeaders} rightHeaders={rightHeaders} updatePair={updatePair} t={t} />}
  </Card>;
}

function ColumnPicker({ label, headers, value, onChange }: { label: string; headers: string[]; value: number[]; onChange: (value: number[]) => void }) {
  return <fieldset className="min-w-0"><legend className="mb-1.5 text-xs font-bold text-muted-foreground">{label}</legend><div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border bg-background p-2">{headers.map((header, index) => { const column = index + 1; const selected = value.includes(column); return <Button key={`${column}-${header}`} type="button" size="sm" variant="outline" aria-pressed={selected} className={`max-w-full rounded-lg ${selected ? "border-green-700 bg-green-500/10 dark:border-green-300" : ""}`} onClick={() => onChange(selected ? value.filter((item) => item !== column) : [...value, column].sort((a, b) => a - b))}><span className="font-mono text-xs">{columnLabel(column)}</span><span className="overflow-hidden text-ellipsis">{header}</span></Button>; })}</div></fieldset>;
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
  return <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-3" data-testid="excel-pair-mode-options"><h3 className="mb-3 font-heading text-base font-medium">{t("features:excelCompare.reconcile.title")}</h3><div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1" data-testid="excel-reconcile-grid">
    {amountFields.map(([key, label, headers]) => <UtilityField key={key} data-reconcile-field={key}><span>{t(`features:excelCompare.reconcile.${label}` as never)}</span><UtilitySelect value={pair.reconcile[key]} onChange={(event) => update(key, Number(event.target.value))}>{headers.map((header, index) => <option value={index + 1} key={`${index}-${header}`}>{columnLabel(index + 1)} · {header}</option>)}</UtilitySelect></UtilityField>)}
    {optionalFields.map(([leftKey, rightKey, side, label, headers]) => {
      const key = side === "left" ? leftKey : rightKey;
      return <UtilityField key={key} data-reconcile-field={key}><span>{t(`features:excelCompare.reconcile.${label}` as never)}</span><UtilitySelect value={pair.reconcile[key] ?? ""} onChange={(event) => updateOptionalPair(leftKey, rightKey, side, event.target.value)}><option value="">{t("features:excelCompare.reconcile.unused")}</option>{headers.map((header, index) => <option value={index + 1} key={`${index}-${header}`}>{columnLabel(index + 1)} · {header}</option>)}</UtilitySelect></UtilityField>;
    })}
  </div><div className="mt-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1" data-testid="excel-number-options"><UtilityField><span>{t("features:excelCompare.reconcile.dateTolerance")}</span><UtilityInput type="number" min={0} disabled={dateUnused} value={pair.reconcile.dateToleranceDays} onChange={(event) => update("dateToleranceDays", Math.max(0, Number(event.target.value) || 0))} /></UtilityField><UtilityField><span>{t("features:excelCompare.reconcile.roundingUnit")}</span><UtilityInput type="number" min="0.000001" step="0.01" value={pair.reconcile.roundingUnit} onChange={(event) => update("roundingUnit", Math.max(0.000001, Number(event.target.value) || 0.01))} /></UtilityField></div><div className="mt-2"><ToggleRow label={t("features:excelCompare.reconcile.grouped")} description={t("features:excelCompare.reconcile.groupedDescription")} checked={pair.reconcile.allowGroupedMatches} onChange={(checked) => update("allowGroupedMatches", checked)} /></div></div>;
}

function NormalizationOptions({ value, onChange, t }: { value: typeof DEFAULT_EXCEL_COMPARE_OPTIONS; onChange: (value: typeof DEFAULT_EXCEL_COMPARE_OPTIONS) => void; t: LooseT }) {
  const toggles = ["trimWhitespace", "collapseWhitespace", "normalizeLineBreaks", "ignoreCase", "unicodeNfc", "stripNumberSymbols", "numericStrings", "ignoreDateDisplayFormat", "blankEqualsEmpty", "blankEqualsZero", "compareDisplayValues", "compareFormatting"] as const;
  return <><div className="grid grid-cols-2 divide-y divide-border max-[720px]:grid-cols-1 [&_[data-ui-component=toggle-row]]:min-h-[45px]">{toggles.map((key) => <ToggleRow key={key} label={t(`features:excelCompare.options.${key}` as never)} description={key === "numericStrings" ? t("features:excelCompare.options.numericStringsDescription") : key === "blankEqualsZero" ? t("features:excelCompare.options.blankEqualsZeroDescription") : undefined} checked={value[key]} onChange={(checked) => onChange({ ...value, [key]: checked })} />)}</div><div className="mt-3 grid grid-cols-3 gap-3 max-[720px]:grid-cols-1" data-testid="excel-number-options"><UtilityField><span>{t("features:excelCompare.options.formulaMode")}</span><UtilitySelect value={value.formulaMode} onChange={(event) => onChange({ ...value, formulaMode: event.target.value as typeof value.formulaMode })}><option value="formula">{t("features:excelCompare.options.formula")}</option><option value="cached">{t("features:excelCompare.options.cached")}</option><option value="both">{t("features:excelCompare.options.both")}</option></UtilitySelect></UtilityField><UtilityField><span>{t("features:excelCompare.options.absoluteTolerance")}</span><UtilityInput type="number" min={0} step="any" value={value.absoluteTolerance} onChange={(event) => onChange({ ...value, absoluteTolerance: Math.max(0, Number(event.target.value) || 0) })} /></UtilityField><UtilityField><span>{t("features:excelCompare.options.relativeTolerance")}</span><UtilityInput type="number" min={0} step="0.0001" value={value.relativeTolerance} onChange={(event) => onChange({ ...value, relativeTolerance: Math.max(0, Number(event.target.value) || 0) })} /></UtilityField></div></>;
}

function SupportTable({ t }: { t: LooseT }) {
  const rows = [
    ["XLSX", "○", "○", "○", "○", "○", "○"], ["XLSM", "○", "○", "○", "○", "○*", "○"],
    ["XLS (BIFF8)", "○", "○", "○", "○", "×", "○"], ["XLSB", "○", "○", "○", "○", "×", "○"],
    ["SpreadsheetML .xls", "○", "○", "○", "○", "×", "○"], ["CSV", "○", "—", "—", "—", "—", "—"],
  ];
  return <div data-testid="excel-support-table"><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[680px] border-collapse text-sm [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td:not(:first-child)]:text-center [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th:not(:first-child)]:text-center"><thead><tr>{["format", "value", "display", "formula", "cache", "style", "merge"].map((key) => <th key={key}>{t(`features:excelCompare.support.${key}` as never)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div><p className="mt-2 text-xs text-muted-foreground">{t("features:excelCompare.support.note")}</p></div>;
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
