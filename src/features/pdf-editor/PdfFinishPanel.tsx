import { FileCheck2, Hash, PanelTop, SquareDashed, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { UtilityField, UtilityInput, UtilityNotice, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { featureResource } from "../../i18n/featureMessages";
import type { AppLanguage } from "../../i18n/languages";
import { useAppLanguage } from "../../i18n/routing";
import { cn } from "../../lib/utils";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, releasePdf, renderPdfThumbnail } from "./pdfPreview";
import { PdfDownloadCard, PdfError, useDownloadResult } from "./pdfUi";
import { finishPdfFiles, PdfFinishEngineError, type PdfFinishProgress, type PdfFinishWarningCode } from "./finish/engine.ts";
import { isThumbnailDisabled, createPageSelection, displayNumber, toggleThumbnailPage, type PageParity, type PageSelectionState } from "./finish/selection.ts";
import { expandTokens } from "./finish/tokens.ts";
import type { FinishRegion } from "./finish/geometry.ts";
import { createLocalId, type PdfFinishPreset, type PdfFinishTab, type PdfPageItem } from "./types";

type ImplementedFinishTab = Extract<PdfFinishTab, "page-numbers" | "header-footer">;

interface FinishFormState {
  template: string;
  region: FinishRegion;
  fontSize: number;
  color: string;
  margin: number;
}

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
}

const DEFAULT_FORMS: Record<ImplementedFinishTab, FinishFormState> = {
  "page-numbers": { template: "{page} / {pages}", region: "bottom-center", fontSize: 10, color: "#34343a", margin: 24 },
  "header-footer": { template: "{filename} · {date}", region: "top-center", fontSize: 10, color: "#34343a", margin: 24 },
};

const regions: FinishRegion[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

function implementedTab(tab: PdfFinishTab): ImplementedFinishTab {
  return tab === "header-footer" ? tab : "page-numbers";
}

function emptySelection(): PageSelectionState {
  return { totalPages: 0, exactPages: [], parity: "all", rangeText: "", canExecute: false };
}

export function PdfFinishPanel({ preset }: { preset: PdfFinishPreset }) {
  const language = useAppLanguage();
  const copy = featureResource<FinishCopy>(language, "pdf.finish");
  const [activeTab, setActiveTab] = useState<ImplementedFinishTab>(() => implementedTab(preset.initialTab));
  const [forms, setForms] = useState(DEFAULT_FORMS);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState("");
  const [parity, setParity] = useState<PageParity>("all");
  const [startNumber, setStartNumber] = useState(1);
  const [startPage, setStartPage] = useState(1);
  const [excludeCover, setExcludeCover] = useState(false);
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const operation = useOperationProgress();
  const download = useDownloadResult();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const fileRef = useRef<File | null>(null);
  const tabPanelId = useId();
  const form = forms[activeTab];
  const locked = inspecting || operation.status === "running";
  const lowerBound = { startPage, excludeCover };

  useEffect(() => setActiveTab(implementedTab(preset.initialTab)), [preset.initialTab]);
  useEffect(() => { fileRef.current = file; }, [file]);
  useEffect(() => () => {
    controllerRef.current?.abort();
    if (fileRef.current) void releasePdf(fileRef.current);
  }, []);

  const selectionEvaluation = useMemo(() => {
    if (!pageCount) return { selection: emptySelection(), error: "" };
    const result = createPageSelection(pageCount, rangeText, parity, lowerBound);
    return "error" in result ? { selection: result.state, error: result.error } : { selection: result, error: "" };
  }, [excludeCover, pageCount, parity, rangeText, startPage]);
  const selection = selectionEvaluation.selection;

  const pages = useMemo<PdfPageItem[]>(() => file ? Array.from({ length: pageCount }, (_, index) => ({
    id: `${fileKey}-page-${index + 1}`,
    sourceId: fileKey,
    sourceName: file.name,
    sourcePageIndex: index,
    rotation: 0,
  })) : [], [file, fileKey, pageCount]);

  const updateForm = <K extends keyof FinishFormState>(field: K, value: FinishFormState[K]) => {
    setForms((current) => ({ ...current, [activeTab]: { ...current[activeTab], [field]: value } }));
    download.clearResult();
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
      setError(reason instanceof Error ? reason.message : copy.errors["unreadable-document"]);
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
    operation.reset();
    download.clearResult();
  };

  const fieldError = useMemo(() => {
    if (!Number.isFinite(form.fontSize) || form.fontSize < 6 || form.fontSize > 72) return copy.fieldErrors.fontSize;
    if (!Number.isFinite(form.margin) || form.margin < 0 || form.margin > 144) return copy.fieldErrors.margin;
    if (!Number.isSafeInteger(startNumber)) return copy.fieldErrors.startNumber;
    if (!Number.isSafeInteger(startPage) || startPage < 1) return copy.fieldErrors.startPage;
    if (!form.template) return copy.fieldErrors.template;
    return "";
  }, [copy.fieldErrors, form.fontSize, form.margin, form.template, startNumber, startPage]);

  const execute = async () => {
    if (!file || !selection.canExecute || fieldError || selectionEvaluation.error) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    download.clearResult();
    operation.start(copy.creating);
    try {
      const [output] = await finishPdfFiles({
        files: [{ key: fileKey, file, selection }],
        options: { ...form, startNumber, startPage, excludeCover },
        locale: language === "ko" ? "ko-KR" : "en-US",
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
    <section className="pdf-finish-panel" data-testid="pdf-finish-ready" data-pdf-finish-tab={activeTab}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label={copy.tabsLabel}>
        {(["page-numbers", "header-footer"] as const).map((tab) => {
          const selected = activeTab === tab;
          const Icon = tab === "page-numbers" ? Hash : PanelTop;
          return <Button key={tab} id={`${tabPanelId}-${tab}`} className={cn("min-h-11 rounded-xl text-muted-foreground", selected && "bg-card text-violet-700 shadow-sm dark:text-violet-300")} variant="ghost" type="button" role="tab" aria-selected={selected} aria-controls={tabPanelId} data-finish-tab={tab} onClick={() => { setActiveTab(tab); setError(""); }}><Icon size={17} />{copy.tabs[tab]}</Button>;
        })}
      </div>

      <div id={tabPanelId} role="tabpanel" aria-labelledby={`${tabPanelId}-${activeTab}`}>
        <SectionCard step={1} title={copy.uploadTitle} description={copy.uploadDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
          <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={replaceFile} disabled={locked} accent="violet" hint={inspecting ? copy.inspecting : copy.uploadHint} />
          <FileList files={file ? [file] : []} onRemove={removeFile} accent="violet" />
        </SectionCard>

        {file && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] items-start gap-4 max-[820px]:grid-cols-1">
            <div className="min-w-0">
              <SectionCard step={2} title={copy.settingsTitle} description={copy.settingsDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
                <UtilityField>{copy.template}<UtilityTextarea data-testid="pdf-finish-template" className="min-h-24 max-h-48" value={form.template} disabled={locked} maxLength={300} placeholder={copy.templatePlaceholder[activeTab]} aria-invalid={!form.template || undefined} onChange={(event) => updateForm("template", event.target.value)} /></UtilityField>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.templateHelp} <code>{"{page} {pages} {filename} {date} {date:YYYY-MM-DD}"}</code></p>
                <fieldset className="mt-5" disabled={locked}><legend className="mb-2 text-[13px] font-bold text-muted-foreground">{copy.position}</legend><div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={copy.position}>{regions.map((region) => <Button key={region} type="button" variant="outline" role="radio" aria-checked={form.region === region} data-finish-region={region} data-selected={form.region === region || undefined} className={cn("min-h-11 rounded-xl text-xs", form.region === region && "border-violet-600 bg-violet-500/10 text-violet-700 dark:text-violet-300")} onClick={() => updateForm("region", region)}>{copy.regions[region]}</Button>)}</div></fieldset>
                <div className="mt-5 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.fontSize}<UtilityInput data-testid="pdf-finish-font-size" type="number" min={6} max={72} step={1} value={form.fontSize} disabled={locked} onChange={(event) => updateForm("fontSize", Number(event.target.value))} /></UtilityField>
                  <UtilityField>{copy.margin}<UtilityInput type="number" min={0} max={144} step={1} value={form.margin} disabled={locked} onChange={(event) => updateForm("margin", Number(event.target.value))} /></UtilityField>
                  <UtilityField>{copy.color}<UtilityInput className="p-1" type="color" value={form.color} disabled={locked} onChange={(event) => updateForm("color", event.target.value)} /></UtilityField>
                </div>
                <h3 className="mt-6 mb-3 font-heading text-base font-medium">{copy.numberingTitle}</h3>
                <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.startNumber}<UtilityInput data-testid="pdf-finish-start-number" type="number" step={1} value={startNumber} disabled={locked} onChange={(event) => { setStartNumber(Number(event.target.value)); download.clearResult(); }} /></UtilityField>
                  <UtilityField>{copy.startPage}<UtilityInput data-testid="pdf-finish-start-page" type="number" min={1} max={pageCount} step={1} value={startPage} disabled={locked} onChange={(event) => { setStartPage(Number(event.target.value)); download.clearResult(); }} /></UtilityField>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-border"><ToggleRow label={copy.excludeCover} description={copy.excludeCoverDescription} checked={excludeCover} onChange={(checked) => { setExcludeCover(checked); download.clearResult(); }} disabled={locked} /></div>
              </SectionCard>

              <SectionCard step={3} title={copy.pagesTitle} description={copy.pagesDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
                <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.pageRange}<UtilityInput data-testid="pdf-finish-range" value={rangeText} disabled={locked} placeholder={copy.pageRangeExample} aria-invalid={!!selectionEvaluation.error || undefined} onChange={(event) => { setRangeText(event.target.value); download.clearResult(); }} onBlur={() => { if (selection.canExecute) setRangeText(selection.rangeText); }} /></UtilityField>
                  <UtilityField>{copy.parity}<UtilitySelect data-testid="pdf-finish-parity" value={parity} disabled={locked} onChange={(event) => { setParity(event.target.value as PageParity); download.clearResult(); }}>{(["all", "odd", "even"] as const).map((value) => <option key={value} value={value}>{copy.parityOptions[value]}</option>)}</UtilitySelect></UtilityField>
                </div>
                {selectionEvaluation.error && <UtilityNotice className="mt-3" tone="error" role="alert">{copy.rangeErrors[selectionEvaluation.error]}</UtilityNotice>}
                <p className="mt-3 text-sm font-bold text-violet-700 dark:text-violet-300" aria-live="polite">{copy.selectedPages.replace("{{count}}", `${selection.exactPages.length}`).replace("{{total}}", `${pageCount}`)}</p>
                <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-[620px]:grid-cols-2" data-testid="pdf-finish-thumbnails">
                  {pages.map((item, index) => <PdfThumbnail key={item.id} item={item} file={file} outputIndex={index} totalItems={pages.length} draggable={false} selected={selection.exactPages.includes(index + 1)} selectionDisabled={locked || isThumbnailDisabled(index + 1, pageCount, lowerBound)} onSelect={() => { const next = toggleThumbnailPage(selection, index + 1, lowerBound); setRangeText(next.rangeText); setParity(next.parity); download.clearResult(); }} />)}
                </div>
              </SectionCard>
            </div>

            <aside className="sticky top-6 min-w-0 max-[820px]:static">
              <Card as="section" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0" aria-labelledby={`${tabPanelId}-preview-title`}>
                <div className="mb-4 flex items-center gap-2 text-violet-700 dark:text-violet-300"><SquareDashed size={18} /><h2 id={`${tabPanelId}-preview-title`} className="font-heading text-base font-medium text-foreground">{copy.previewTitle}</h2></div>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{copy.previewDescription}</p>
                <FinishPreview file={file} pageIndex={Math.max(0, (selection.exactPages[0] ?? 1) - 1)} language={language} form={form} startNumber={startNumber} startPage={startPage} excludeCover={excludeCover} pageCount={pageCount} copy={copy} />
                <UtilityNotice className="mt-3" tone="warning">{copy.previewDisclaimer}</UtilityNotice>
                {(fieldError || selectionEvaluation.error) && <UtilityNotice className="mt-3" tone="error" role="alert">{fieldError || copy.rangeErrors[selectionEvaluation.error]}</UtilityNotice>}
                <div className="mt-4">
                  <PrimaryButton accent="violet" disabled={!selection.canExecute || !!fieldError || !!selectionEvaluation.error || locked} loading={operation.status === "running"} onClick={() => void execute()}>{operation.status !== "running" && <FileCheck2 size={18} />}{operation.status === "running" ? copy.creating : operation.status === "error" ? copy.retry : copy.create}</PrimaryButton>
                  {operation.status === "running" && <Button type="button" variant="outline" className="mt-2 min-h-11 w-full rounded-xl text-destructive" data-testid="pdf-finish-cancel" onClick={() => controllerRef.current?.abort()}><X size={17} />{copy.cancel}</Button>}
                </div>
                <OperationProgress {...operation} compact accent="violet" title={copy.progressTitle} />
                <PdfError message={error} />
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
  form: FinishFormState;
  startNumber: number;
  startPage: number;
  excludeCover: boolean;
  pageCount: number;
  copy: FinishCopy;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    setRendering(true);
    setFailed(false);
    void renderPdfThumbnail(file, pageIndex, canvas, 520, language, controller.signal)
      .then(() => setRendering(false))
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
  const positionStyle = {
    [vertical]: `${Math.min(22, Math.max(3, form.margin / 4))}px`,
    [horizontal]: horizontal === "center" ? "50%" : `${Math.min(22, Math.max(3, form.margin / 4))}px`,
    transform: horizontal === "center" ? "translateX(-50%)" : undefined,
    color: form.color,
    fontSize: `${Math.min(24, Math.max(8, form.fontSize))}px`,
    textAlign: horizontal,
  } as const;
  return <div className="relative min-h-72 overflow-hidden rounded-2xl bg-[#e9e9ed] p-2 dark:bg-[#202023]" data-testid="pdf-finish-preview">
    {(rendering || failed) && <span className="absolute inset-0 grid place-items-center p-4 text-center text-sm font-bold text-muted-foreground">{failed ? copy.previewFailed : copy.previewWaiting}</span>}
    <canvas ref={canvasRef} className={cn("mx-auto block h-auto max-w-full bg-white shadow-md", rendering && "invisible")} />
    {!failed && !rendering && <span className="pointer-events-none absolute max-w-[60%] whitespace-pre-wrap break-words font-medium leading-[1.2] opacity-90" data-testid="pdf-finish-overlay" aria-hidden="true" style={positionStyle}>{overlay}</span>}
  </div>;
}
