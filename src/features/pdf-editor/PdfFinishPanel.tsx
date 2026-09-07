import { FileCheck2, Hash, PanelTop, SquareDashed, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { UtilityField, UtilityInput, UtilityNotice, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { featureMessage, featureResource } from "../../i18n/featureMessages";
import type { AppLanguage } from "../../i18n/languages";
import { useAppLanguage } from "../../i18n/routing";
import { cn } from "../../lib/utils";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, releasePdf, renderPdfThumbnail } from "./pdfPreview";
import { PdfDownloadCard, PdfError, useDownloadResult } from "./pdfUi";
import {
  finishPdfFiles,
  preflightPdfFiles,
  PdfFinishEngineError,
  type PdfFinishPreflightError,
  type PdfFinishProgress,
  type PdfFinishWarningCode,
} from "./finish/engine.ts";
import { isThumbnailDisabled, createPageSelection, displayNumber, toggleThumbnailPage, type PageParity, type PageSelectionState } from "./finish/selection.ts";
import { expandTokens } from "./finish/tokens.ts";
import type { FinishRegion } from "./finish/geometry.ts";
import { createLocalId, type PdfFinishPreset, type PdfFinishTab, type PdfPageItem } from "./types";

type ImplementedFinishTab = Extract<PdfFinishTab, "page-numbers" | "header-footer">;

interface FinishFormState {
  template: string;
  region: FinishRegion;
  fontSize: string;
  color: string;
  margin: string;
}

type FinishPreviewFormState = Omit<FinishFormState, "fontSize" | "margin"> & { fontSize: number; margin: number };

interface FinishCopy {
  tabsLabel: string;
  tabs: Record<ImplementedFinishTab, string>;
  uploadTitle: string;
  uploadDescription: string;
  uploadHint: string;
  invalidFile: string;
  inspecting: string;
  settingsTitle: string;
  settingsDescription: string;
  template: string;
  templateHelp: string;
  templateCount: string;
  templatePlaceholder: Record<ImplementedFinishTab, string>;
  position: string;
  regions: Record<FinishRegion, string>;
  fontSize: string;
  color: string;
  margin: string;
  numberingTitle: string;
  startNumber: string;
  startPage: string;
  excludeCover: string;
  excludeCoverDescription: string;
  pagesTitle: string;
  pagesDescription: string;
  pageRange: string;
  pageRangeExample: string;
  parity: string;
  parityOptions: Record<PageParity, string>;
  selectedPages: string;
  previewTitle: string;
  previewDescription: string;
  previewDisclaimer: string;
  previewWaiting: string;
  previewFailed: string;
  preflightChecking: string;
  preflightErrors: Record<PdfFinishPreflightError["code"], string>;
  create: string;
  creating: string;
  retry: string;
  cancel: string;
  canceled: string;
  progressTitle: string;
  progress: Record<PdfFinishProgress["phase"], string>;
  complete: string;
  ready: string;
  fieldErrors: Record<string, string>;
  rangeErrors: Record<string, string>;
  errors: Record<string, string>;
  warnings: Record<PdfFinishWarningCode, string>;
  outputFileName: { suffix: string; fallback: string };
}

const DEFAULT_FORMS: Record<ImplementedFinishTab, FinishFormState> = {
  "page-numbers": { template: "{page} / {pages}", region: "bottom-center", fontSize: "10", color: "#34343a", margin: "24" },
  "header-footer": { template: "{filename} · {date}", region: "top-center", fontSize: "10", color: "#34343a", margin: "24" },
};

const regions: FinishRegion[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

function implementedTab(tab: PdfFinishTab): ImplementedFinishTab {
  return tab === "header-footer" ? tab : "page-numbers";
}

function emptySelection(): PageSelectionState {
  return { totalPages: 0, exactPages: [], parity: "all", rangeText: "", canExecute: false };
}

function inspectionErrorMessage(reason: unknown, language: AppLanguage, copy: FinishCopy) {
  const message = reason instanceof Error ? reason.message : "";
  const protectedErrors = [
    "pdf.messages.pdfPreview.encryptedOrPermissionRestrictedPdfsCannotBeEdited",
    "pdf.messages.pdfPreview.thisPdfIsPasswordProtectedTryAgainWith",
  ].map((key) => featureMessage(language, key));
  return protectedErrors.includes(message) ? copy.errors["protected-document"] : copy.errors["unreadable-document"];
}

function numericInput(value: string) {
  return value.trim() ? Number(value) : Number.NaN;
}

function formatPreflightError(copy: FinishCopy, error: PdfFinishPreflightError) {
  return copy.preflightErrors[error.code]
    .replace("{{page}}", `${error.physicalPage}`)
    .replace("{{line}}", `${error.line ?? 1}`)
    .replace("{{column}}", `${error.column ?? 1}`);
}

export function PdfFinishPanel({ preset }: { preset: PdfFinishPreset }) {
  const language = useAppLanguage();
  const copy = featureResource<FinishCopy>(language, "pdf.finish");
  const [activeTab, setActiveTab] = useState<ImplementedFinishTab>(() => implementedTab(preset.initialTab));
  const [forms, setForms] = useState(DEFAULT_FORMS);
  const [templateLimitNotices, setTemplateLimitNotices] = useState<Record<ImplementedFinishTab, boolean>>({ "page-numbers": false, "header-footer": false });
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState("");
  const [parity, setParity] = useState<PageParity>("all");
  const [startNumber, setStartNumber] = useState("1");
  const [startPage, setStartPage] = useState("1");
  const [excludeCover, setExcludeCover] = useState(false);
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [preflight, setPreflight] = useState<{
    status: "idle" | "checking" | "ready";
    errors: PdfFinishPreflightError[];
    warnings: PdfFinishWarningCode[];
    failure: string;
  }>({ status: "idle", errors: [], warnings: [], failure: "" });
  const operation = useOperationProgress();
  const download = useDownloadResult();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const fileRef = useRef<File | null>(null);
  const tabPanelId = useId();
  const form = forms[activeTab];
  const locked = inspecting || operation.status === "running";
  const fontSize = numericInput(form.fontSize);
  const margin = numericInput(form.margin);
  const startingNumber = numericInput(startNumber);
  const startingPage = numericInput(startPage);
  const validLowerBound = Number.isSafeInteger(startingPage) && startingPage >= 1;
  const lowerBound = useMemo(
    () => validLowerBound ? { startPage: startingPage, excludeCover } : null,
    [excludeCover, startingPage, validLowerBound],
  );

  useEffect(() => setActiveTab(implementedTab(preset.initialTab)), [preset.initialTab]);
  useEffect(() => { fileRef.current = file; }, [file]);
  useEffect(() => () => {
    controllerRef.current?.abort();
    if (fileRef.current) void releasePdf(fileRef.current);
  }, []);

  const selectionEvaluation = useMemo(() => {
    if (!pageCount || !lowerBound) return { selection: emptySelection(), error: "" };
    const result = createPageSelection(pageCount, rangeText, parity, lowerBound);
    return "error" in result ? { selection: result.state, error: result.error } : { selection: result, error: "" };
  }, [lowerBound, pageCount, parity, rangeText]);
  const selection = selectionEvaluation.selection;

  const pages = useMemo<PdfPageItem[]>(() => file ? Array.from({ length: pageCount }, (_, index) => ({
    id: `${fileKey}-page-${index + 1}`,
    sourceId: fileKey,
    sourceName: file.name,
    sourcePageIndex: index,
    rotation: 0,
  })) : [], [file, fileKey, pageCount]);

  const updateForm = <K extends keyof FinishFormState>(field: K, value: FinishFormState[K]) => {
    if (Object.is(forms[activeTab][field], value)) return;
    setForms((current) => ({ ...current, [activeTab]: { ...current[activeTab], [field]: value } }));
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    if (field === "template" && typeof value === "string" && value.length < 300) {
      setTemplateLimitNotices((current) => ({ ...current, [activeTab]: false }));
    }
    download.clearResult();
  };

  const updatePreflightInput = <T,>(currentValue: T, nextValue: T, setValue: (value: T) => void) => {
    if (Object.is(currentValue, nextValue)) return;
    setValue(nextValue);
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    download.clearResult();
  };

  const selectTab = (tab: ImplementedFinishTab) => {
    if (activeTab === tab) return;
    setActiveTab(tab);
    setError("");
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
  };

  const noteTemplateLimitAttempt = (currentValue: string, selectionStart: number | null, selectionEnd: number | null, inserted: string) => {
    const selectedLength = Math.max(0, (selectionEnd ?? currentValue.length) - (selectionStart ?? currentValue.length));
    if (currentValue.length - selectedLength + inserted.length > 300) {
      setTemplateLimitNotices((current) => ({ ...current, [activeTab]: true }));
    }
  };

  const replaceFile = async (incoming: File[]) => {
    const next = incoming[0];
    if (!next) return;
    if (!/\.pdf$/iu.test(next.name) && next.type !== "application/pdf") {
      setError(copy.invalidFile);
      return;
    }
    setInspecting(true);
    setError("");
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    operation.reset();
    download.clearResult();
    if (fileRef.current) await releasePdf(fileRef.current);
    setFile(null);
    setPageCount(0);
    try {
      const inspected = await inspectPdf(next, language, { requirePdfLibCompatibility: true });
      const key = createLocalId("finish-source");
      setFile(next);
      setFileKey(key);
      setPageCount(inspected.pageCount);
      setRangeText(`1-${inspected.pageCount}`);
      setParity("all");
    } catch (reason) {
      setError(inspectionErrorMessage(reason, language, copy));
      await releasePdf(next);
    } finally {
      setInspecting(false);
    }
  };

  const removeFile = () => {
    controllerRef.current?.abort();
    if (fileRef.current) void releasePdf(fileRef.current);
    setFile(null);
    setPageCount(0);
    setRangeText("");
    setError("");
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    operation.reset();
    download.clearResult();
  };

  const baseFieldErrors = useMemo(() => ({
    fontSize: !Number.isFinite(fontSize) || fontSize < 6 || fontSize > 72 ? copy.fieldErrors.fontSize : "",
    margin: !Number.isFinite(margin) || margin < 0 || margin > 144 ? copy.fieldErrors.margin : "",
    startNumber: !Number.isSafeInteger(startingNumber) ? copy.fieldErrors.startNumber : "",
    startPage: !validLowerBound ? copy.fieldErrors.startPage : "",
    template: !form.template ? copy.fieldErrors.template : form.template.length > 300 ? copy.fieldErrors.templateLength : "",
  }), [copy.fieldErrors, fontSize, form.template, margin, startingNumber, validLowerBound]);
  const baseFieldError = Object.values(baseFieldErrors).find(Boolean) ?? "";

  useEffect(() => {
    if (!file || !selection.canExecute || baseFieldError || selectionEvaluation.error || !lowerBound) {
      setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setPreflight({ status: "checking", errors: [], warnings: [], failure: "" });
      void preflightPdfFiles({
        files: [{ key: fileKey, file, selection }],
        options: {
          template: form.template,
          region: form.region,
          fontSize,
          color: form.color,
          margin,
          startNumber: startingNumber,
          startPage: startingPage,
          excludeCover,
        },
        locale: language === "ko" ? "ko-KR" : "en-US",
        signal: controller.signal,
      }).then((result) => {
        if (!controller.signal.aborted) setPreflight({ status: "ready", ...result, failure: "" });
      }).catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        const code = reason instanceof PdfFinishEngineError ? reason.code : "unreadable-document";
        if (!controller.signal.aborted) setPreflight({ status: "ready", errors: [], warnings: [], failure: code });
      });
    }, 120);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeTab, baseFieldError, excludeCover, file, fileKey, fontSize, form.color, form.fontSize, form.margin, form.region, form.template, language, lowerBound, margin, selection, selectionEvaluation.error, startNumber, startPage, startingNumber, startingPage]);

  const firstPreflightError = preflight.errors[0];
  const preflightErrorText = firstPreflightError ? formatPreflightError(copy, firstPreflightError) : "";
  const fieldErrors = {
    ...baseFieldErrors,
    template: baseFieldErrors.template || (firstPreflightError?.field === "template" ? preflightErrorText : ""),
    fontSize: baseFieldErrors.fontSize || (firstPreflightError?.field === "fontSize" ? preflightErrorText : ""),
    margin: baseFieldErrors.margin || (firstPreflightError?.field === "margin" ? preflightErrorText : ""),
  };
  const fieldError = Object.values(fieldErrors).find(Boolean) ?? "";
  const preflightFailure = preflight.failure ? copy.errors[preflight.failure] ?? copy.errors["unreadable-document"] : "";
  const preflightBlocked = preflight.status !== "ready" || preflight.errors.length > 0 || !!preflight.failure;

  const execute = async () => {
    if (!file || !selection.canExecute || fieldError || selectionEvaluation.error || preflightBlocked) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    download.clearResult();
    operation.start(copy.creating);
    try {
      const [output] = await finishPdfFiles({
        files: [{ key: fileKey, file, selection }],
        options: { ...form, fontSize, margin, startNumber: startingNumber, startPage: startingPage, excludeCover, opacity: 0.9 },
        locale: language === "ko" ? "ko-KR" : "en-US",
        outputName: copy.outputFileName,
        signal: controller.signal,
        onProgress: (progress) => operation.update(Math.max(2, progress.percent), copy.progress[progress.phase], progress.phase),
      });
      const warnings = output.warnings.map((warning) => copy.warnings[warning]);
      download.makeBlobResult(new Blob([output.buffer], { type: "application/pdf" }), output.fileName, warnings);
      operation.succeed(copy.complete);
    } catch (reason) {
      const canceled = reason instanceof DOMException && reason.name === "AbortError";
      const code = reason instanceof PdfFinishEngineError ? reason.code : "unreadable-document";
      const message = canceled ? copy.canceled : copy.errors[code] ?? copy.errors["unreadable-document"];
      setError(message);
      operation.fail(message);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  };

  return (
    <section className="pdf-finish-panel" data-testid="pdf-finish-ready" data-pdf-finish-tab={activeTab} data-preflight-status={preflight.status}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label={copy.tabsLabel}>
        {(["page-numbers", "header-footer"] as const).map((tab) => {
          const selected = activeTab === tab;
          const Icon = tab === "page-numbers" ? Hash : PanelTop;
          return <Button key={tab} id={`${tabPanelId}-${tab}`} className={cn("min-h-11 rounded-xl text-muted-foreground", selected && "bg-card text-violet-700 shadow-sm dark:text-violet-300")} variant="ghost" type="button" role="tab" aria-selected={selected} aria-controls={tabPanelId} data-finish-tab={tab} onClick={() => selectTab(tab)}><Icon size={17} />{copy.tabs[tab]}</Button>;
        })}
      </div>

      <div id={tabPanelId} role="tabpanel" aria-labelledby={`${tabPanelId}-${activeTab}`}>
        <SectionCard step={1} title={copy.uploadTitle} description={copy.uploadDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
          <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={replaceFile} disabled={locked} accent="violet" hint={inspecting ? copy.inspecting : copy.uploadHint} />
          <FileList files={file ? [file] : []} onRemove={removeFile} accent="violet" />
        </SectionCard>
        <PdfError message={error} />

        {file && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] items-start gap-4 max-[820px]:grid-cols-1">
            <div className="min-w-0">
              <SectionCard step={2} title={copy.settingsTitle} description={copy.settingsDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
                <UtilityField>{copy.template}<UtilityTextarea data-testid="pdf-finish-template" className="min-h-24 max-h-48" value={form.template} disabled={locked} maxLength={300} placeholder={copy.templatePlaceholder[activeTab]} aria-invalid={!!fieldErrors.template || undefined} aria-describedby={`${tabPanelId}-template-count${fieldErrors.template || templateLimitNotices[activeTab] ? ` ${tabPanelId}-template-error` : ""}`} onBeforeInput={(event) => { const nativeEvent = event.nativeEvent as InputEvent; if (nativeEvent.data) noteTemplateLimitAttempt(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, nativeEvent.data); }} onPaste={(event) => noteTemplateLimitAttempt(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.clipboardData.getData("text"))} onChange={(event) => updateForm("template", event.target.value)} />{(fieldErrors.template || templateLimitNotices[activeTab]) && <span id={`${tabPanelId}-template-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.template || copy.fieldErrors.templateLength}</span>}</UtilityField>
                <div className="mt-2 flex items-start justify-between gap-3 text-xs leading-relaxed text-muted-foreground"><p>{copy.templateHelp} <code>{"{page} {pages} {filename} {date} {date:YYYY-MM-DD}"}</code></p><span id={`${tabPanelId}-template-count`} className="shrink-0 tabular-nums" data-testid="pdf-finish-template-count">{copy.templateCount.replace("{{count}}", `${form.template.length}`)}</span></div>
                <fieldset className="mt-5" disabled={locked}><legend className="mb-2 text-[13px] font-bold text-muted-foreground">{copy.position}</legend><div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={copy.position}>{regions.map((region) => <Button key={region} type="button" variant="outline" role="radio" aria-checked={form.region === region} data-finish-region={region} data-selected={form.region === region || undefined} className={cn("min-h-11 rounded-xl text-xs", form.region === region && "border-violet-600 bg-violet-500/10 text-violet-700 dark:text-violet-300")} onClick={() => updateForm("region", region)}>{copy.regions[region]}</Button>)}</div></fieldset>
                <div className="mt-5 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.fontSize}<UtilityInput data-testid="pdf-finish-font-size" type="number" min={6} max={72} step={1} value={form.fontSize} disabled={locked} aria-invalid={!!fieldErrors.fontSize || undefined} aria-describedby={fieldErrors.fontSize ? `${tabPanelId}-font-size-error` : undefined} onChange={(event) => updateForm("fontSize", event.target.value)} />{fieldErrors.fontSize && <span id={`${tabPanelId}-font-size-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.fontSize}</span>}</UtilityField>
                  <UtilityField>{copy.margin}<UtilityInput data-testid="pdf-finish-margin" type="number" min={0} max={144} step={1} value={form.margin} disabled={locked} aria-invalid={!!fieldErrors.margin || undefined} aria-describedby={fieldErrors.margin ? `${tabPanelId}-margin-error` : undefined} onChange={(event) => updateForm("margin", event.target.value)} />{fieldErrors.margin && <span id={`${tabPanelId}-margin-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.margin}</span>}</UtilityField>
                  <UtilityField>{copy.color}<UtilityInput data-testid="pdf-finish-color" className="p-1" type="color" value={form.color} disabled={locked} onChange={(event) => updateForm("color", event.target.value)} /></UtilityField>
                </div>
                <h3 className="mt-6 mb-3 font-heading text-base font-medium">{copy.numberingTitle}</h3>
                <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.startNumber}<UtilityInput data-testid="pdf-finish-start-number" type="number" step={1} value={startNumber} disabled={locked} aria-invalid={!!fieldErrors.startNumber || undefined} aria-describedby={fieldErrors.startNumber ? `${tabPanelId}-start-number-error` : undefined} onChange={(event) => updatePreflightInput(startNumber, event.target.value, setStartNumber)} />{fieldErrors.startNumber && <span id={`${tabPanelId}-start-number-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.startNumber}</span>}</UtilityField>
                  <UtilityField>{copy.startPage}<UtilityInput data-testid="pdf-finish-start-page" type="number" min={1} max={pageCount} step={1} value={startPage} disabled={locked} aria-invalid={!!fieldErrors.startPage || undefined} aria-describedby={fieldErrors.startPage ? `${tabPanelId}-start-page-error` : undefined} onChange={(event) => updatePreflightInput(startPage, event.target.value, setStartPage)} />{fieldErrors.startPage && <span id={`${tabPanelId}-start-page-error`} className="text-xs leading-relaxed text-destructive" data-testid="pdf-finish-start-page-error" role="alert">{fieldErrors.startPage}</span>}</UtilityField>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-border"><ToggleRow label={copy.excludeCover} description={copy.excludeCoverDescription} checked={excludeCover} onChange={(checked) => updatePreflightInput(excludeCover, checked, setExcludeCover)} disabled={locked} /></div>
              </SectionCard>

              <SectionCard step={3} title={copy.pagesTitle} description={copy.pagesDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
                <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.pageRange}<UtilityInput data-testid="pdf-finish-range" value={rangeText} disabled={locked} placeholder={copy.pageRangeExample} aria-invalid={!!selectionEvaluation.error || undefined} onChange={(event) => updatePreflightInput(rangeText, event.target.value, setRangeText)} onBlur={() => { if (selection.canExecute) setRangeText(selection.rangeText); }} /></UtilityField>
                  <UtilityField>{copy.parity}<UtilitySelect data-testid="pdf-finish-parity" value={parity} disabled={locked} onChange={(event) => updatePreflightInput(parity, event.target.value as PageParity, setParity)}>{(["all", "odd", "even"] as const).map((value) => <option key={value} value={value}>{copy.parityOptions[value]}</option>)}</UtilitySelect></UtilityField>
                </div>
                {selectionEvaluation.error && <UtilityNotice className="mt-3" tone="error" role="alert">{copy.rangeErrors[selectionEvaluation.error]}</UtilityNotice>}
                <p className="mt-3 text-sm font-bold text-violet-700 dark:text-violet-300" aria-live="polite">{copy.selectedPages.replace("{{count}}", `${selection.exactPages.length}`).replace("{{total}}", `${pageCount}`)}</p>
                <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-[620px]:grid-cols-2" data-testid="pdf-finish-thumbnails">
                  {pages.map((item, index) => <PdfThumbnail key={item.id} item={item} file={file} outputIndex={index} totalItems={pages.length} draggable={false} selected={selection.exactPages.includes(index + 1)} selectionDisabled={locked || !lowerBound || isThumbnailDisabled(index + 1, pageCount, lowerBound)} onSelect={() => { if (!lowerBound) return; const next = toggleThumbnailPage(selection, index + 1, lowerBound); setRangeText(next.rangeText); setParity(next.parity); setPreflight({ status: "idle", errors: [], warnings: [], failure: "" }); download.clearResult(); }} />)}
                </div>
              </SectionCard>
            </div>

            <aside className="sticky top-6 min-w-0 max-[820px]:static">
              <Card as="section" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0" aria-labelledby={`${tabPanelId}-preview-title`}>
                <div className="mb-4 flex items-center gap-2 text-violet-700 dark:text-violet-300"><SquareDashed size={18} /><h2 id={`${tabPanelId}-preview-title`} className="font-heading text-base font-medium text-foreground">{copy.previewTitle}</h2></div>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{copy.previewDescription}</p>
                <FinishPreview file={file} pageIndex={Math.max(0, (selection.exactPages[0] ?? 1) - 1)} language={language} form={{ ...form, fontSize: Number.isFinite(fontSize) ? fontSize : 10, margin: Number.isFinite(margin) ? margin : 24 }} startNumber={Number.isSafeInteger(startingNumber) ? startingNumber : 1} startPage={validLowerBound ? startingPage : 1} excludeCover={excludeCover} pageCount={pageCount} copy={copy} />
                <UtilityNotice className="mt-3" tone="warning">{copy.previewDisclaimer}</UtilityNotice>
                {preflight.status === "checking" && <UtilityNotice className="mt-3" tone="warning" role="status" data-testid="pdf-finish-preflight-checking">{copy.preflightChecking}</UtilityNotice>}
                {preflight.status === "ready" && <span className="sr-only" data-testid="pdf-finish-preflight-ready">ready</span>}
                {preflightErrorText && <UtilityNotice className="mt-3" tone="error" role="alert" data-testid="pdf-finish-preflight-error" data-error-code={firstPreflightError?.code}>{preflightErrorText}</UtilityNotice>}
                {preflightFailure && <UtilityNotice className="mt-3" tone="error" role="alert" data-testid="pdf-finish-preflight-error">{preflightFailure}</UtilityNotice>}
                {!!preflight.warnings.length && <div className="mt-3 space-y-2" data-testid="pdf-finish-preflight-warnings">{preflight.warnings.map((warning) => <UtilityNotice key={warning} tone="warning" data-warning-code={warning}>{copy.warnings[warning]}</UtilityNotice>)}</div>}
                {selectionEvaluation.error && <UtilityNotice className="mt-3" tone="error" role="alert">{copy.rangeErrors[selectionEvaluation.error]}</UtilityNotice>}
                <div className="mt-4">
                  <PrimaryButton accent="violet" disabled={!selection.canExecute || !!fieldError || !!selectionEvaluation.error || preflightBlocked || locked} loading={operation.status === "running"} onClick={() => void execute()}>{operation.status !== "running" && <FileCheck2 size={18} />}{operation.status === "running" ? copy.creating : operation.status === "error" ? copy.retry : copy.create}</PrimaryButton>
                  {operation.status === "running" && <Button type="button" variant="outline" className="mt-2 min-h-11 w-full rounded-xl text-destructive" data-testid="pdf-finish-cancel" onClick={() => controllerRef.current?.abort()}><X size={17} />{copy.cancel}</Button>}
                </div>
                <OperationProgress {...operation} compact accent="violet" title={copy.progressTitle} />
                {download.result && <PdfDownloadCard compact result={download.result} title={copy.ready} />}
              </Card>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function FinishPreview({ file, pageIndex, language, form, startNumber, startPage, excludeCover, pageCount, copy }: {
  file: File;
  pageIndex: number;
  language: AppLanguage;
  form: FinishPreviewFormState;
  startNumber: number;
  startPage: number;
  excludeCover: boolean;
  pageCount: number;
  copy: FinishCopy;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    setRendering(true);
    setFailed(false);
    setDimensions(null);
    void renderPdfThumbnail(file, pageIndex, canvas, 520, language, controller.signal)
      .then((nextDimensions) => {
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        setDimensions(nextDimensions);
        setRendering(false);
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setFailed(true);
          setRendering(false);
        }
      });
    return () => controller.abort();
  }, [file, language, pageIndex]);

  const physicalPage = pageIndex + 1;
  let page = physicalPage;
  try { page = displayNumber(physicalPage, startNumber, { startPage, excludeCover }); } catch { /* Invalid fields are reported by the form. */ }
  const overlay = expandTokens(form.template, {
    page,
    pages: pageCount,
    filename: file.name.replace(/\.pdf$/iu, ""),
    date: new Date(),
    locale: language === "ko" ? "ko-KR" : "en-US",
  }).text;
  const [vertical, horizontal] = form.region.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  const inset = `${Math.min(22, Math.max(3, form.margin / 4))}px`;
  const positionStyle = {
    [vertical]: inset,
    ...(horizontal === "center" ? { left: "50%" } : { [horizontal]: inset }),
    transform: horizontal === "center" ? "translateX(-50%)" : undefined,
    color: form.color,
    fontSize: `${Math.min(24, Math.max(8, form.fontSize))}px`,
    textAlign: horizontal,
  } as const;
  return <div className="relative min-h-72 overflow-hidden rounded-2xl bg-[#e9e9ed] p-2 dark:bg-[#202023]" data-testid="pdf-finish-preview">
    {(rendering || failed) && <span className="absolute inset-0 grid place-items-center p-4 text-center text-sm font-bold text-muted-foreground">{failed ? copy.previewFailed : copy.previewWaiting}</span>}
    <div className={cn("relative mx-auto max-w-full", rendering && "invisible")} data-testid="pdf-finish-canvas-area" style={dimensions ? { width: `${dimensions.width}px`, aspectRatio: `${dimensions.width} / ${dimensions.height}` } : undefined}>
      <canvas ref={canvasRef} className="block h-auto w-full bg-white shadow-md" style={{ width: "100%", height: "auto" }} />
      {!failed && !rendering && <span className="pointer-events-none absolute max-w-[60%] whitespace-pre-wrap break-words font-medium leading-[1.2] opacity-90" data-testid="pdf-finish-overlay" aria-hidden="true" style={positionStyle}>{overlay}</span>}
    </div>
  </div>;
}
