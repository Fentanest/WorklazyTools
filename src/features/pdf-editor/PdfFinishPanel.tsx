import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileCheck2, Hash, Image as ImageIcon, Minus, PanelTop, PenLine, Plus, Redo2, SquareDashed, Stamp, Type, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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
import { PdfStampOverlay } from "./PdfStampOverlay";
import { inspectPdf, isPdfDisplayLoadError, releasePdf, renderPdfThumbnail } from "./pdfPreview";
import { PdfDownloadCard, PdfError, useDownloadResults } from "./pdfUi";
import {
  finishPdfFiles,
  preflightPdfFiles,
  PdfFinishEngineError,
  type PdfFinishPreflightError,
  type PdfFinishProgress,
  type PdfFinishOutput,
  type PdfFinishWarningCode,
} from "./finish/engine.ts";
import { isThumbnailDisabled, createPageSelection, displayNumber, toggleThumbnailPage, type PageParity, type PageSelectionState } from "./finish/selection.ts";
import { expandTokens } from "./finish/tokens.ts";
import type { FinishRegion } from "./finish/geometry.ts";
import { createWatermarkPlacements, type PdfWatermarkSettings, type WatermarkContentKind, type WatermarkLayer, type WatermarkPattern, type WatermarkRegion } from "./finish/watermark.ts";
import { commitStamp, createStampHistory, redoStamp, undoStamp, type NormalizedStamp } from "./finish/stamp.ts";
import type { PdfFormMode, PdfStructureOptions } from "./finish/structure.ts";
import { DEFAULT_RASTER_DPI, DEFAULT_RASTER_FORMAT, RASTER_DPI_VALUES, type RasterDpi } from "./finish/raster.ts";
import type { RasterOutputFormat } from "./finish/canvasPolicy.ts";
import { createLocalId, type PdfFinishPreset, type PdfFinishTab, type PdfPageItem } from "./types";

type ImplementedFinishTab = PdfFinishTab;

interface FinishFormState {
  template: string;
  region: WatermarkRegion;
  fontSize: string;
  color: string;
  margin: string;
}

interface FinishSource {
  key: string;
  file: File;
  pageCount: number;
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
  includeDecoration: string;
  includeDecorationDescription: string;
  template: string;
  templateHelp: string;
  templateCount: string;
  templatePlaceholder: Record<ImplementedFinishTab, string>;
  position: string;
  regions: Record<WatermarkRegion, string>;
  fontSize: string;
  color: string;
  margin: string;
  watermark: {
    contentType: string;
    text: string;
    image: string;
    imageFile: string;
    imageHint: string;
    layer: string;
    background: string;
    foreground: string;
    pattern: string;
    single: string;
    tile: string;
    rotation: string;
    opacity: string;
    size: string;
    gap: string;
    offsetX: string;
    offsetY: string;
    riskTitle: string;
    riskConsent: string;
    riskConsentDescription: string;
  };
  stamp: {
    noticeTitle: string;
    noticeDescription: string;
    settingsTitle: string;
    settingsDescription: string;
    imageFile: string;
    imageHint: string;
    samePosition: string;
    historyScope: string;
    undo: string;
    redo: string;
    move: string;
    resize: string;
    moveLeft: string;
    moveRight: string;
    moveUp: string;
    moveDown: string;
    smaller: string;
    larger: string;
    previewTitle: string;
    previewDescription: string;
    create: string;
    complete: string;
  };
  structure: {
    title: string;
    description: string;
    metadata: string;
    metadataDescription: string;
    annotations: string;
    annotationsDescription: string;
    attachments: string;
    attachmentsDescription: string;
    forms: string;
    formOptions: Record<PdfFormMode, string>;
    formResults: Record<PdfFormMode, string>;
    linkNotice: string;
    tableTitle: string;
    structureLabel: string;
    resultLabel: string;
    pages: string;
    outlines: string;
    destinations: string;
    embeddedFiles: string;
    pageLabels: string;
    viewerPreferences: string;
    optionalContent: string;
    taggedStructure: string;
    xmpMetadata: string;
    acroForm: string;
    linkAnnotations: string;
    markupAnnotations: string;
    unsupported: string;
    preserveResult: string;
    removeResult: string;
    pagesResult: string;
    outlinesResult: string;
    destinationsResult: string;
    pageLabelsResult: string;
    viewerPreferencesResult: string;
    linksResult: string;
    optionalContentResult: string;
    taggedStructureResult: string;
    unsupportedResult: string;
  };
  raster: {
    title: string;
    description: string;
    enabled: string;
    enabledDescription: string;
    dpi: string;
    format: string;
    formats: Record<RasterOutputFormat, string>;
    lossNotice: string;
    mobileLimitNotice: string;
  };
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
  packing: string;
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
  archiveFileName: string;
}

const DEFAULT_FORMS: Record<ImplementedFinishTab, FinishFormState> = {
  "page-numbers": { template: "{page} / {pages}", region: "bottom-center", fontSize: "10", color: "#34343a", margin: "24" },
  "header-footer": { template: "{filename} · {date}", region: "top-center", fontSize: "10", color: "#34343a", margin: "24" },
  watermark: { template: "CONFIDENTIAL", region: "center", fontSize: "36", color: "#8b3f55", margin: "24" },
  stamp: { template: "", region: "center", fontSize: "10", color: "#34343a", margin: "0" },
};

function initialStamp(aspect = 2): NormalizedStamp {
  return { cx: 0.75, cy: 0.78, rw: 0.28, aspect };
}

const regions: FinishRegion[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
const watermarkRegions: WatermarkRegion[] = ["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"];

function implementedTab(tab: PdfFinishTab): ImplementedFinishTab {
  return tab;
}

function emptySelection(): PageSelectionState {
  return { totalPages: 0, exactPages: [], parity: "all", rangeText: "", canExecute: false };
}

function inspectionErrorMessage(reason: unknown, language: AppLanguage, copy: FinishCopy) {
  if (isPdfDisplayLoadError(reason)) return reason.message;
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
  const [enabled, setEnabled] = useState<Record<ImplementedFinishTab, boolean>>(() => ({
    "page-numbers": preset.initialTab === "page-numbers",
    "header-footer": preset.initialTab === "header-footer",
    watermark: preset.initialTab === "watermark",
    stamp: preset.initialTab === "stamp",
  }));
  const [forms, setForms] = useState(DEFAULT_FORMS);
  const [templateLimitNotices, setTemplateLimitNotices] = useState<Record<ImplementedFinishTab, boolean>>({ "page-numbers": false, "header-footer": false, watermark: false, stamp: false });
  const [watermark, setWatermark] = useState<{
    content: WatermarkContentKind;
    image?: File;
    layer: WatermarkLayer;
    pattern: WatermarkPattern;
    rotation: string;
    opacity: string;
    sizePercent: string;
    gap: string;
    offsetX: string;
    offsetY: string;
  }>({ content: "text", layer: "foreground", pattern: "single", rotation: "-32", opacity: "0.2", sizePercent: "60", gap: "72", offsetX: "24", offsetY: "24" });
  const [stampImage, setStampImage] = useState<File>();
  const [stampImageStatus, setStampImageStatus] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const [stampHistory, setStampHistory] = useState(() => createStampHistory(initialStamp()));
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [structure, setStructure] = useState<PdfStructureOptions>({ removeMetadata: false, removeAnnotations: false, removeAttachments: false, formMode: "preserve" });
  const [rasterEnabled, setRasterEnabled] = useState(false);
  const [rasterDpi, setRasterDpi] = useState<RasterDpi>(DEFAULT_RASTER_DPI);
  const [rasterFormat, setRasterFormat] = useState<RasterOutputFormat>(DEFAULT_RASTER_FORMAT);
  const [file, setFile] = useState<File | null>(null);
  const [sources, setSources] = useState<FinishSource[]>([]);
  const [fileKey, setFileKey] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState("");
  const [parity, setParity] = useState<PageParity>("all");
  const [startNumber, setStartNumber] = useState("1");
  const [startPage, setStartPage] = useState("1");
  const [excludeCover, setExcludeCover] = useState(false);
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preflight, setPreflight] = useState<{
    status: "idle" | "checking" | "ready";
    errors: PdfFinishPreflightError[];
    warnings: PdfFinishWarningCode[];
    failure: string;
  }>({ status: "idle", errors: [], warnings: [], failure: "" });
  const operation = useOperationProgress();
  const download = useDownloadResults();
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const fileLifecycleControllerRef = useRef<AbortController | undefined>(undefined);
  const fileRequestRef = useRef(0);
  const previewOwnerRef = useRef<object | undefined>(undefined);
  const fileRef = useRef<File | null>(null);
  const tabPanelId = useId();
  const form = forms[activeTab];
  const locked = inspecting || operation.status === "running";
  const fontSize = numericInput(form.fontSize);
  const margin = numericInput(form.margin);
  const startingNumber = numericInput(startNumber);
  const startingPage = numericInput(startPage);
  const watermarkRotation = numericInput(watermark.rotation);
  const watermarkOpacity = numericInput(watermark.opacity);
  const watermarkSize = numericInput(watermark.sizePercent);
  const watermarkGap = numericInput(watermark.gap);
  const watermarkOffsetX = numericInput(watermark.offsetX);
  const watermarkOffsetY = numericInput(watermark.offsetY);
  const validLowerBound = Number.isSafeInteger(startingPage) && startingPage >= 1;
  const lowerBound = useMemo(
    () => validLowerBound ? { startPage: startingPage, excludeCover } : null,
    [excludeCover, startingPage, validLowerBound],
  );

  useEffect(() => {
    const tab = implementedTab(preset.initialTab);
    setActiveTab(tab);
    setEnabled((current) => ({ ...current, [tab]: true }));
  }, [preset.initialTab]);
  useEffect(() => { fileRef.current = file; }, [file]);
  useEffect(() => {
    if (!stampImage) {
      setStampImageStatus("empty");
      return;
    }
    const type = stampImage.type.toLowerCase();
    const name = stampImage.name.toLowerCase();
    if (!(type === "image/png" || type === "image/jpeg" || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg"))) {
      setStampImageStatus("error");
      return;
    }
    const url = URL.createObjectURL(stampImage);
    const image = new Image();
    let active = true;
    setStampImageStatus("loading");
    image.onload = () => {
      if (!active || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
      setStampHistory(createStampHistory(initialStamp(image.naturalWidth / image.naturalHeight)));
      setStampImageStatus("ready");
    };
    image.onerror = () => { if (active) setStampImageStatus("error"); };
    image.src = url;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [stampImage]);
  useEffect(() => () => {
    controllerRef.current?.abort();
    fileLifecycleControllerRef.current?.abort();
    if (fileRef.current) void releasePdf(fileRef.current);
  }, []);

  const selectionEvaluation = useMemo(() => {
    if (!pageCount || !lowerBound) return { selection: emptySelection(), error: "" };
    const result = createPageSelection(pageCount, rangeText, parity, lowerBound);
    return "error" in result ? { selection: result.state, error: result.error } : { selection: result, error: "" };
  }, [lowerBound, pageCount, parity, rangeText]);
  const selection = selectionEvaluation.selection;
  const batchSelection = useMemo(() => {
    if (!lowerBound) return { files: [], error: "" };
    const files = [];
    for (const source of sources) {
      const result = createPageSelection(source.pageCount, rangeText, parity, lowerBound);
      if ("error" in result) return { files: [], error: result.error };
      files.push({ key: source.key, file: source.file, selection: result });
    }
    return { files, error: "" };
  }, [lowerBound, parity, rangeText, sources]);

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
    setRiskAccepted(false);
    if (field === "template" && typeof value === "string" && value.length < 300) {
      setTemplateLimitNotices((current) => ({ ...current, [activeTab]: false }));
    }
    download.clearResults();
  };

  const updateWatermark = <K extends keyof typeof watermark>(field: K, value: (typeof watermark)[K]) => {
    if (Object.is(watermark[field], value)) return;
    setWatermark((current) => ({ ...current, [field]: value }));
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
    download.clearResults();
  };

  const resetStampValidation = () => {
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
    download.clearResults();
  };

  const updateStampImage = (image?: File) => {
    setStampImage(image);
    setStampImageStatus(image ? "loading" : "empty");
    resetStampValidation();
  };

  const updateStampPlacement = (next: NormalizedStamp) => {
    setStampHistory((current) => commitStamp(current, next));
    resetStampValidation();
  };

  const nudgeStamp = (change: Partial<Pick<NormalizedStamp, "cx" | "cy" | "rw">>) => {
    const current = stampHistory.present;
    updateStampPlacement({
      ...current,
      cx: Math.min(1, Math.max(0, change.cx ?? current.cx)),
      cy: Math.min(1, Math.max(0, change.cy ?? current.cy)),
      rw: Math.min(1, Math.max(0.05, change.rw ?? current.rw)),
    });
  };

  const stepStampHistory = (direction: "undo" | "redo") => {
    setStampHistory((current) => direction === "undo" ? undoStamp(current) : redoStamp(current));
    resetStampValidation();
  };

  const updatePreflightInput = <T,>(currentValue: T, nextValue: T, setValue: (value: T) => void) => {
    if (Object.is(currentValue, nextValue)) return;
    setValue(nextValue);
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
    download.clearResults();
  };

  const updateStructure = <K extends keyof PdfStructureOptions>(field: K, value: PdfStructureOptions[K]) => {
    setStructure((current) => ({ ...current, [field]: value }));
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    download.clearResults();
  };

  const updateRaster = (next: { enabled?: boolean; dpi?: RasterDpi; format?: RasterOutputFormat }) => {
    if (next.enabled !== undefined) setRasterEnabled(next.enabled);
    if (next.dpi !== undefined) setRasterDpi(next.dpi);
    if (next.format !== undefined) setRasterFormat(next.format);
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    download.clearResults();
  };

  const selectTab = (tab: ImplementedFinishTab) => {
    if (activeTab === tab) return;
    setActiveTab(tab);
    setError("");
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
  };

  const setDecorationEnabled = (value: boolean) => {
    setEnabled((current) => ({ ...current, [activeTab]: value }));
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
    download.clearResults();
  };

  const noteTemplateLimitAttempt = (currentValue: string, selectionStart: number | null, selectionEnd: number | null, inserted: string) => {
    const selectedLength = Math.max(0, (selectionEnd ?? currentValue.length) - (selectionStart ?? currentValue.length));
    if (currentValue.length - selectedLength + inserted.length > 300) {
      setTemplateLimitNotices((current) => ({ ...current, [activeTab]: true }));
    }
  };

  const updatePreviewing = useCallback((next: boolean, owner: object) => {
    if (next) {
      previewOwnerRef.current = owner;
      setPreviewing(true);
    } else if (previewOwnerRef.current === owner) {
      previewOwnerRef.current = undefined;
      setPreviewing(false);
    }
  }, []);

  const replaceFile = async (incoming: File[]) => {
    if (!incoming.length) return;
    if (incoming.some((next) => !/\.pdf$/iu.test(next.name) && next.type !== "application/pdf")) {
      setError(copy.invalidFile);
      return;
    }
    const requestId = fileRequestRef.current + 1;
    fileRequestRef.current = requestId;
    fileLifecycleControllerRef.current?.abort();
    controllerRef.current?.abort();
    const controller = new AbortController();
    fileLifecycleControllerRef.current = controller;
    const previous = fileRef.current;
    fileRef.current = incoming[0];
    setFile(incoming[0]);
    setSources([]);
    setFileKey("");
    setPageCount(0);
    setRangeText("");
    previewOwnerRef.current = undefined;
    setPreviewing(false);
    setInspecting(true);
    setError("");
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
    operation.reset();
    download.clearResults();
    if (previous) void releasePdf(previous);
    try {
      const inspectedSources: FinishSource[] = [];
      for (const [index, next] of incoming.entries()) {
        const inspected = await inspectPdf(next, language, { requirePdfLibCompatibility: true, signal: controller.signal });
        if (index > 0) await releasePdf(next);
        if (controller.signal.aborted || fileRequestRef.current !== requestId) return;
        inspectedSources.push({ key: createLocalId("finish-source"), file: next, pageCount: inspected.pageCount });
      }
      const first = inspectedSources[0];
      setSources(inspectedSources);
      setFileKey(first.key);
      setPageCount(first.pageCount);
      setRangeText(`1-${first.pageCount}`);
      setParity("all");
    } catch (reason) {
      if (controller.signal.aborted || fileRequestRef.current !== requestId) return;
      setError(inspectionErrorMessage(reason, language, copy));
      fileRef.current = null;
      setFile(null);
      setSources([]);
      await releasePdf(incoming[0]);
    } finally {
      if (fileRequestRef.current === requestId) setInspecting(false);
    }
  };

  const removeFile = (index?: number) => {
    if (index !== undefined && sources.length > 1) {
      void replaceFile(sources.filter((_, sourceIndex) => sourceIndex !== index).map(({ file: sourceFile }) => sourceFile));
      return;
    }
    fileRequestRef.current += 1;
    fileLifecycleControllerRef.current?.abort();
    fileLifecycleControllerRef.current = undefined;
    controllerRef.current?.abort();
    const current = fileRef.current;
    fileRef.current = null;
    if (current) void releasePdf(current);
    setInspecting(false);
    previewOwnerRef.current = undefined;
    setPreviewing(false);
    setFile(null);
    setSources([]);
    setPageCount(0);
    setRangeText("");
    setError("");
    setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
    setRiskAccepted(false);
    operation.reset();
    download.clearResults();
  };

  const watermarkActive = activeTab === "watermark";
  const stampActive = activeTab === "stamp";
  const watermarkForm = forms.watermark;
  const watermarkSettings: PdfWatermarkSettings | undefined = enabled.watermark ? {
    ...watermark,
    region: watermarkForm.region,
    rotation: watermarkRotation,
    opacity: watermarkOpacity,
    sizePercent: watermarkSize,
    gap: watermarkGap,
    offsetX: watermarkOffsetX,
    offsetY: watermarkOffsetY,
  } : undefined;
  const stampSettings = enabled.stamp && stampImage && stampImageStatus === "ready"
    ? { image: stampImage, placement: stampHistory.present }
    : undefined;
  const textDecorations = (["page-numbers", "header-footer"] as const)
    .filter((tab) => enabled[tab])
    .map((tab) => ({
      ...forms[tab],
      region: forms[tab].region as FinishRegion,
      fontSize: numericInput(forms[tab].fontSize),
      margin: numericInput(forms[tab].margin),
      startNumber: startingNumber,
      startPage: startingPage,
      excludeCover,
      opacity: 0.9,
    }));
  const baseForm = enabled.watermark ? watermarkForm : DEFAULT_FORMS["page-numbers"];
  const finishOptions = {
    template: baseForm.template,
    region: baseForm.region,
    fontSize: numericInput(baseForm.fontSize),
    color: baseForm.color,
    margin: numericInput(baseForm.margin),
    startNumber: startingNumber,
    startPage: startingPage,
    excludeCover,
    opacity: 0.9,
    textDecorations,
    watermark: watermarkSettings,
    stamp: stampSettings,
    structure,
    raster: { enabled: rasterEnabled, dpi: rasterDpi, format: rasterFormat },
  };
  const baseFieldErrors = useMemo(() => ({
    fontSize: stampActive || watermarkActive && watermark.content === "image" ? "" : !Number.isFinite(fontSize) || fontSize < 6 || fontSize > 72 ? copy.fieldErrors.fontSize : "",
    margin: stampActive ? "" : !Number.isFinite(margin) || margin < 0 || margin > 144 ? copy.fieldErrors.margin : "",
    startNumber: stampActive ? "" : !Number.isSafeInteger(startingNumber) ? copy.fieldErrors.startNumber : "",
    startPage: stampActive ? "" : !validLowerBound ? copy.fieldErrors.startPage : "",
    template: stampActive || watermarkActive && watermark.content === "image" ? "" : !form.template ? copy.fieldErrors.template : form.template.length > 300 ? copy.fieldErrors.templateLength : "",
    image: stampActive
      ? !stampImage || stampImageStatus === "error" ? copy.fieldErrors.stampImage : stampImageStatus === "loading" ? copy.fieldErrors.imageLoading : ""
      : watermarkActive && watermark.content === "image" && !watermark.image ? copy.fieldErrors.image : "",
    rotation: watermarkActive && (!Number.isFinite(watermarkRotation) || watermarkRotation < -180 || watermarkRotation > 180) ? copy.fieldErrors.rotation : "",
    opacity: watermarkActive && (!Number.isFinite(watermarkOpacity) || watermarkOpacity < 0.01 || watermarkOpacity > 1) ? copy.fieldErrors.opacity : "",
    sizePercent: watermarkActive && (!Number.isFinite(watermarkSize) || watermarkSize < 1 || watermarkSize > 100) ? copy.fieldErrors.size : "",
    gap: watermarkActive && watermark.pattern === "tile" && (!Number.isFinite(watermarkGap) || watermarkGap < 0 || watermarkGap > 2_000) ? copy.fieldErrors.gap : "",
    offsetX: watermarkActive && watermark.pattern === "tile" && (!Number.isFinite(watermarkOffsetX) || watermarkOffsetX < -2_000 || watermarkOffsetX > 2_000) ? copy.fieldErrors.offset : "",
    offsetY: watermarkActive && watermark.pattern === "tile" && (!Number.isFinite(watermarkOffsetY) || watermarkOffsetY < -2_000 || watermarkOffsetY > 2_000) ? copy.fieldErrors.offset : "",
  }), [copy.fieldErrors, fontSize, form.template, margin, stampActive, stampImage, stampImageStatus, startingNumber, validLowerBound, watermark.content, watermark.image, watermark.pattern, watermarkActive, watermarkGap, watermarkOffsetX, watermarkOffsetY, watermarkOpacity, watermarkRotation, watermarkSize]);
  const baseFieldError = enabled[activeTab] ? Object.values(baseFieldErrors).find(Boolean) ?? "" : "";
  const combinedFieldError = baseFieldError
    || (!Number.isSafeInteger(startingNumber) ? copy.fieldErrors.startNumber : "")
    || (!validLowerBound ? copy.fieldErrors.startPage : "")
    || (textDecorations.some(({ fontSize: size }) => !Number.isFinite(size) || size < 6 || size > 72) ? copy.fieldErrors.fontSize : "")
    || (textDecorations.some(({ margin: value }) => !Number.isFinite(value) || value < 0 || value > 144) ? copy.fieldErrors.margin : "")
    || (textDecorations.some(({ template }) => !template || template.length > 300) ? copy.fieldErrors.template : "")
    || (enabled.watermark && watermark.content === "text" && (!watermarkForm.template || watermarkForm.template.length > 300) ? copy.fieldErrors.template : "")
    || (enabled.watermark && watermark.content === "text" && (!Number.isFinite(numericInput(watermarkForm.fontSize)) || numericInput(watermarkForm.fontSize) < 6 || numericInput(watermarkForm.fontSize) > 72) ? copy.fieldErrors.fontSize : "")
    || (enabled.watermark && (!Number.isFinite(numericInput(watermarkForm.margin)) || numericInput(watermarkForm.margin) < 0 || numericInput(watermarkForm.margin) > 144) ? copy.fieldErrors.margin : "")
    || (enabled.watermark && watermark.content === "image" && !watermark.image ? copy.fieldErrors.image : "")
    || (enabled.stamp && (!stampImage || stampImageStatus !== "ready") ? copy.fieldErrors.stampImage : "")
    || (enabled.watermark && (!Number.isFinite(watermarkRotation) || watermarkRotation < -180 || watermarkRotation > 180) ? copy.fieldErrors.rotation : "")
    || (enabled.watermark && (!Number.isFinite(watermarkOpacity) || watermarkOpacity < 0.01 || watermarkOpacity > 1) ? copy.fieldErrors.opacity : "")
    || (enabled.watermark && (!Number.isFinite(watermarkSize) || watermarkSize < 1 || watermarkSize > 100) ? copy.fieldErrors.size : "")
    || (enabled.watermark && watermark.pattern === "tile" && (!Number.isFinite(watermarkGap) || watermarkGap < 0 || watermarkGap > 2_000) ? copy.fieldErrors.gap : "")
    || (enabled.watermark && watermark.pattern === "tile" && (!Number.isFinite(watermarkOffsetX) || watermarkOffsetX < -2_000 || watermarkOffsetX > 2_000) ? copy.fieldErrors.offset : "")
    || (enabled.watermark && watermark.pattern === "tile" && (!Number.isFinite(watermarkOffsetY) || watermarkOffsetY < -2_000 || watermarkOffsetY > 2_000) ? copy.fieldErrors.offset : "");

  useEffect(() => {
    if (!file || !batchSelection.files.length || combinedFieldError || batchSelection.error || !lowerBound) {
      setPreflight({ status: "idle", errors: [], warnings: [], failure: "" });
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setPreflight({ status: "checking", errors: [], warnings: [], failure: "" });
      void preflightPdfFiles({
        files: batchSelection.files,
        options: finishOptions,
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
  }, [activeTab, baseFieldError, batchSelection, combinedFieldError, enabled, excludeCover, file, fileKey, fontSize, form.color, form.fontSize, form.margin, form.region, form.template, forms, language, lowerBound, margin, rasterDpi, rasterEnabled, rasterFormat, selection, selectionEvaluation.error, stampHistory.present, stampImage, stampImageStatus, startNumber, startPage, startingNumber, startingPage, structure, watermark.content, watermark.gap, watermark.image, watermark.layer, watermark.offsetX, watermark.offsetY, watermark.opacity, watermark.pattern, watermark.rotation, watermark.sizePercent, watermarkGap, watermarkOffsetX, watermarkOffsetY, watermarkOpacity, watermarkRotation, watermarkSize]);

  const firstPreflightError = preflight.errors[0];
  const preflightErrorText = firstPreflightError ? formatPreflightError(copy, firstPreflightError) : "";
  const fieldErrors = {
    ...baseFieldErrors,
    template: baseFieldErrors.template || (firstPreflightError?.field === "template" ? preflightErrorText : ""),
    fontSize: baseFieldErrors.fontSize || (firstPreflightError?.field === "fontSize" ? preflightErrorText : ""),
    margin: baseFieldErrors.margin || (firstPreflightError?.field === "margin" ? preflightErrorText : ""),
    image: baseFieldErrors.image || (firstPreflightError?.field === "image" ? preflightErrorText : ""),
    watermark: firstPreflightError?.field === "watermark" ? preflightErrorText : "",
  };
  const fieldError = combinedFieldError || (firstPreflightError ? preflightErrorText : "");
  const preflightFailure = preflight.failure ? copy.errors[preflight.failure] ?? copy.errors["unreadable-document"] : "";
  const riskWarnings = preflight.warnings.filter((warning) => warning.startsWith("risky-"));
  const preflightBlocked = preflight.status !== "ready" || preflight.errors.length > 0 || !!preflight.failure || riskWarnings.length > 0 && !riskAccepted;

  const execute = async () => {
    if (!file || !batchSelection.files.length || fieldError || batchSelection.error || preflightBlocked) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    download.clearResults();
    operation.start(copy.creating);
    let outputs: PdfFinishOutput[] = [];
    let handedOff = false;
    try {
      outputs = await finishPdfFiles({
        files: batchSelection.files,
        options: finishOptions,
        locale: language === "ko" ? "ko-KR" : "en-US",
        allowRiskyDocuments: riskAccepted,
        outputName: copy.outputFileName,
        signal: controller.signal,
        onProgress: (progress) => operation.update(Math.max(2, progress.percent), copy.progress[progress.phase], progress.phase),
      });
      const items: Array<{ blob: Blob; fileName: string; warnings: string[]; dispose?: () => void | Promise<void> }> = outputs.map((output) => ({
        blob: output.blob,
        fileName: output.fileName,
        warnings: output.warnings.map((warning) => copy.warnings[warning]),
        dispose: output.dispose,
      }));
      if (outputs.length > 1) {
        operation.update(97, copy.packing, "zip");
        const [{ BlobWriter }, { createSafeZipArchiveSources, writeZipArchive }] = await Promise.all([
          import("@zip.js/zip.js"), import("../../utils/zipArchive.ts"),
        ]);
        const writer = new BlobWriter("application/zip");
        await writeZipArchive(createSafeZipArchiveSources(outputs), writer, controller.signal);
        const blob = await writer.getData();
        items.push({ blob, fileName: copy.archiveFileName, warnings: [] });
      }
      download.makeBlobResults(items);
      handedOff = true;
      operation.succeed(copy.complete);
    } catch (reason) {
      if (!handedOff) {
        const partial = outputs.length ? outputs : reason && typeof reason === "object" && "partialResults" in reason
          ? (reason as { partialResults: readonly PdfFinishOutput[] }).partialResults
          : [];
        if (partial.length) {
          download.makeBlobResults(partial.map((output) => ({
            blob: output.blob,
            fileName: output.fileName,
            warnings: output.warnings.map((warning) => copy.warnings[warning]),
            dispose: output.dispose,
          })));
          handedOff = true;
        } else {
          await Promise.allSettled(partial.map((output) => output.dispose()));
        }
      }
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
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label={copy.tabsLabel}>
        {(["page-numbers", "header-footer", "watermark", "stamp"] as const).map((tab) => {
          const selected = activeTab === tab;
          const Icon = tab === "page-numbers" ? Hash : tab === "header-footer" ? PanelTop : tab === "watermark" ? Stamp : PenLine;
          return <Button key={tab} id={`${tabPanelId}-${tab}`} className={cn("h-auto min-h-14 min-w-0 rounded-xl bg-card px-1 text-foreground sm:min-h-11 sm:px-3", selected && "text-violet-700 shadow-sm dark:text-violet-300")} variant="ghost" type="button" role="tab" aria-selected={selected} aria-controls={tabPanelId} data-finish-tab={tab} data-pdf-watermark-owned={tab === "watermark" || undefined} data-pdf-stamp-owned={tab === "stamp" || undefined} onClick={() => selectTab(tab)}><span className="flex min-w-0 flex-col items-center justify-center gap-1 sm:flex-row sm:gap-1.5" data-finish-tab-content><Icon size={17} /><span className="min-w-0 whitespace-normal text-center text-[11px] leading-tight sm:text-sm">{copy.tabs[tab]}</span></span></Button>;
        })}
      </div>

      <div id={tabPanelId} role="tabpanel" aria-labelledby={`${tabPanelId}-${activeTab}`}>
        {stampActive && <UtilityNotice className="mb-4" tone="warning" data-testid="pdf-stamp-notice" data-pdf-stamp-owned><strong className="block text-foreground" data-testid="pdf-stamp-notice-title">{copy.stamp.noticeTitle}</strong><span data-testid="pdf-stamp-notice-description">{copy.stamp.noticeDescription}</span></UtilityNotice>}
        <SectionCard step={1} title={copy.uploadTitle} description={copy.uploadDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
          <FileDropZone accept=".pdf,application/pdf" multiple files={sources.map(({ file: sourceFile }) => sourceFile)} onFiles={replaceFile} disabled={locked} accent="violet" hint={inspecting ? copy.inspecting : copy.uploadHint} />
          <FileList files={sources.map(({ file: sourceFile }) => sourceFile)} onRemove={removeFile} accent="violet" />
          {(inspecting || previewing) && operation.status !== "running" && <Button type="button" variant="outline" className="mt-2 min-h-11 w-full rounded-xl text-destructive" data-testid="pdf-finish-file-cancel" onClick={() => removeFile()}><X size={17} />{copy.cancel}</Button>}
        </SectionCard>
        <PdfError message={error} />

        {file && pageCount > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] items-start gap-4 max-[820px]:grid-cols-1">
            <div className="min-w-0">
              <SectionCard step={2} title={stampActive ? copy.stamp.settingsTitle : copy.settingsTitle} description={stampActive ? copy.stamp.settingsDescription : copy.settingsDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
                <div className="mb-5 overflow-hidden rounded-2xl border border-border" data-testid="pdf-finish-decoration-toggle" data-decoration={activeTab}>
                  <ToggleRow label={copy.includeDecoration} description={copy.includeDecorationDescription} checked={enabled[activeTab]} onChange={setDecorationEnabled} disabled={locked} />
                </div>
                {watermarkActive && <div className="grid grid-cols-3 gap-3 max-[620px]:grid-cols-1" data-pdf-watermark-owned>
                  <UtilityField>{copy.watermark.contentType}<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={copy.watermark.contentType}><Button type="button" variant="outline" role="radio" aria-checked={watermark.content === "text"} data-testid="pdf-watermark-content-text" className={cn("min-h-11 rounded-xl", watermark.content === "text" && "border-violet-600 bg-violet-500/10 text-violet-700 dark:text-violet-300")} disabled={locked} onClick={() => updateWatermark("content", "text")}><Type size={16} />{copy.watermark.text}</Button><Button type="button" variant="outline" role="radio" aria-checked={watermark.content === "image"} data-testid="pdf-watermark-content-image" className={cn("min-h-11 rounded-xl", watermark.content === "image" && "border-violet-600 bg-violet-500/10 text-violet-700 dark:text-violet-300")} disabled={locked} onClick={() => updateWatermark("content", "image")}><ImageIcon size={16} />{copy.watermark.image}</Button></div></UtilityField>
                  <UtilityField>{copy.watermark.layer}<UtilitySelect data-testid="pdf-watermark-layer" value={watermark.layer} disabled={locked} onChange={(event) => updateWatermark("layer", event.target.value as WatermarkLayer)}><option value="background">{copy.watermark.background}</option><option value="foreground">{copy.watermark.foreground}</option></UtilitySelect></UtilityField>
                  <UtilityField>{copy.watermark.pattern}<UtilitySelect data-testid="pdf-watermark-pattern" value={watermark.pattern} disabled={locked} onChange={(event) => updateWatermark("pattern", event.target.value as WatermarkPattern)}><option value="single">{copy.watermark.single}</option><option value="tile">{copy.watermark.tile}</option></UtilitySelect></UtilityField>
                </div>}
                {stampActive ? <div className="space-y-4" data-pdf-stamp-owned>
                  <UtilityField>{copy.stamp.imageFile}<UtilityInput data-testid="pdf-stamp-image" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={locked} aria-invalid={stampImageStatus === "error" || !stampImage || undefined} aria-describedby={`${tabPanelId}-stamp-image-hint${fieldErrors.image ? ` ${tabPanelId}-stamp-image-status` : ""}`} onChange={(event) => updateStampImage(event.target.files?.[0])} /><span id={`${tabPanelId}-stamp-image-hint`} className="text-xs leading-relaxed text-muted-foreground">{stampImage?.name || copy.stamp.imageHint}</span>{fieldErrors.image && <span id={`${tabPanelId}-stamp-image-status`} className={cn("text-xs leading-relaxed", stampImageStatus === "loading" ? "text-muted-foreground" : "text-destructive")} role={stampImageStatus === "loading" ? "status" : "alert"}>{fieldErrors.image}</span>}</UtilityField>
                  <UtilityNotice>{copy.stamp.samePosition}</UtilityNotice>
                  <div className="rounded-2xl border border-border p-3">
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{copy.stamp.historyScope}</p>
                    <div className="grid grid-cols-4 gap-2 max-[520px]:grid-cols-2">
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" data-testid="pdf-stamp-undo" disabled={locked || stampHistory.past.length === 0} onClick={() => stepStampHistory("undo")}><Undo2 size={16} />{copy.stamp.undo}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" data-testid="pdf-stamp-redo" disabled={locked || stampHistory.future.length === 0} onClick={() => stepStampHistory("redo")}><Redo2 size={16} />{copy.stamp.redo}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={copy.stamp.smaller} title={copy.stamp.smaller} disabled={locked} onClick={() => nudgeStamp({ rw: stampHistory.present.rw - 0.02 })}><Minus size={16} />{copy.stamp.smaller}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={copy.stamp.larger} title={copy.stamp.larger} disabled={locked} onClick={() => nudgeStamp({ rw: stampHistory.present.rw + 0.02 })}><Plus size={16} />{copy.stamp.larger}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={copy.stamp.moveLeft} title={copy.stamp.moveLeft} disabled={locked} onClick={() => nudgeStamp({ cx: stampHistory.present.cx - 0.02 })}><ArrowLeft size={16} />{copy.stamp.moveLeft}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={copy.stamp.moveRight} title={copy.stamp.moveRight} disabled={locked} onClick={() => nudgeStamp({ cx: stampHistory.present.cx + 0.02 })}><ArrowRight size={16} />{copy.stamp.moveRight}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={copy.stamp.moveUp} title={copy.stamp.moveUp} disabled={locked} onClick={() => nudgeStamp({ cy: stampHistory.present.cy - 0.02 })}><ArrowUp size={16} />{copy.stamp.moveUp}</Button>
                      <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-label={copy.stamp.moveDown} title={copy.stamp.moveDown} disabled={locked} onClick={() => nudgeStamp({ cy: stampHistory.present.cy + 0.02 })}><ArrowDown size={16} />{copy.stamp.moveDown}</Button>
                    </div>
                  </div>
                </div> : watermarkActive && watermark.content === "image" ? <UtilityField className="mt-5" data-pdf-watermark-owned>{copy.watermark.imageFile}<UtilityInput data-testid="pdf-watermark-image" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={locked} aria-invalid={!!fieldErrors.image || undefined} aria-describedby={fieldErrors.image ? `${tabPanelId}-image-error` : `${tabPanelId}-image-hint`} onChange={(event) => updateWatermark("image", event.target.files?.[0])} /><span id={`${tabPanelId}-image-hint`} className="text-xs leading-relaxed text-muted-foreground">{watermark.image?.name || copy.watermark.imageHint}</span>{fieldErrors.image && <span id={`${tabPanelId}-image-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.image}</span>}</UtilityField> : <>
                  <UtilityField className={watermarkActive ? "mt-5" : undefined} data-pdf-watermark-owned={watermarkActive || undefined}>{copy.template}<UtilityTextarea data-testid="pdf-finish-template" className={cn("min-h-24 max-h-48", watermarkActive && "aria-invalid:text-red-800 dark:aria-invalid:text-red-200")} value={form.template} disabled={locked} maxLength={300} placeholder={copy.templatePlaceholder[activeTab]} aria-invalid={!!fieldErrors.template || undefined} aria-describedby={`${tabPanelId}-template-count${fieldErrors.template || templateLimitNotices[activeTab] ? ` ${tabPanelId}-template-error` : ""}`} onBeforeInput={(event) => { const nativeEvent = event.nativeEvent as InputEvent; if (nativeEvent.data) noteTemplateLimitAttempt(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, nativeEvent.data); }} onPaste={(event) => noteTemplateLimitAttempt(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.clipboardData.getData("text"))} onChange={(event) => updateForm("template", event.target.value)} />{(fieldErrors.template || templateLimitNotices[activeTab]) && <span id={`${tabPanelId}-template-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.template || copy.fieldErrors.templateLength}</span>}</UtilityField>
                  <div className="mt-2 flex items-start justify-between gap-3 text-xs leading-relaxed text-muted-foreground" data-pdf-watermark-owned={watermarkActive || undefined}><p>{copy.templateHelp} <code>{"{page} {pages} {filename} {date} {date:YYYY-MM-DD}"}</code></p><span id={`${tabPanelId}-template-count`} className="shrink-0 tabular-nums" data-testid="pdf-finish-template-count">{copy.templateCount.replace("{{count}}", `${form.template.length}`)}</span></div>
                </>}
                {!stampActive && (!watermarkActive || watermark.pattern === "single") && <fieldset className="mt-5" disabled={locked} data-pdf-watermark-owned={watermarkActive || undefined}><legend className="mb-2 text-[13px] font-bold text-muted-foreground">{copy.position}</legend><div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={copy.position}>{(watermarkActive ? watermarkRegions : regions).map((region) => <Button key={region} type="button" variant="outline" role="radio" aria-checked={form.region === region} data-finish-region={region} data-selected={form.region === region || undefined} className={cn("min-h-11 rounded-xl text-xs", form.region === region && "border-violet-600 bg-violet-500/10 text-violet-700 dark:text-violet-300")} onClick={() => updateForm("region", region)}>{copy.regions[region]}</Button>)}</div></fieldset>}
                {!stampActive && <div className="mt-5 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1" data-pdf-watermark-owned={watermarkActive || undefined}>
                  {(!watermarkActive || watermark.content === "text") && <UtilityField>{copy.fontSize}<UtilityInput data-testid="pdf-finish-font-size" type="number" min={6} max={72} step={1} value={form.fontSize} disabled={locked} aria-invalid={!!fieldErrors.fontSize || undefined} aria-describedby={fieldErrors.fontSize ? `${tabPanelId}-font-size-error` : undefined} onChange={(event) => updateForm("fontSize", event.target.value)} />{fieldErrors.fontSize && <span id={`${tabPanelId}-font-size-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.fontSize}</span>}</UtilityField>}
                  <UtilityField>{copy.margin}<UtilityInput data-testid="pdf-finish-margin" type="number" min={0} max={144} step={1} value={form.margin} disabled={locked} aria-invalid={!!fieldErrors.margin || undefined} aria-describedby={fieldErrors.margin ? `${tabPanelId}-margin-error` : undefined} onChange={(event) => updateForm("margin", event.target.value)} />{fieldErrors.margin && <span id={`${tabPanelId}-margin-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.margin}</span>}</UtilityField>
                  {(!watermarkActive || watermark.content === "text") && <UtilityField>{copy.color}<UtilityInput data-testid="pdf-finish-color" className="p-1" type="color" value={form.color} disabled={locked} onChange={(event) => updateForm("color", event.target.value)} /></UtilityField>}
                </div>}
                {watermarkActive && <div className="mt-5 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1" data-pdf-watermark-owned>
                  <UtilityField>{copy.watermark.rotation}<UtilityInput data-testid="pdf-watermark-rotation" type="number" min={-180} max={180} step={1} value={watermark.rotation} disabled={locked} aria-invalid={!!fieldErrors.rotation || undefined} onChange={(event) => updateWatermark("rotation", event.target.value)} />{fieldErrors.rotation && <span className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.rotation}</span>}</UtilityField>
                  <UtilityField>{copy.watermark.opacity}<UtilityInput data-testid="pdf-watermark-opacity" type="number" min={0.01} max={1} step={0.01} value={watermark.opacity} disabled={locked} aria-invalid={!!fieldErrors.opacity || undefined} onChange={(event) => updateWatermark("opacity", event.target.value)} />{fieldErrors.opacity && <span className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.opacity}</span>}</UtilityField>
                  <UtilityField>{copy.watermark.size}<UtilityInput data-testid="pdf-watermark-size" type="number" min={1} max={100} step={1} value={watermark.sizePercent} disabled={locked} aria-invalid={!!fieldErrors.sizePercent || undefined} onChange={(event) => updateWatermark("sizePercent", event.target.value)} />{fieldErrors.sizePercent && <span className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.sizePercent}</span>}</UtilityField>
                </div>}
                {watermarkActive && watermark.pattern === "tile" && <div className="mt-3 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1" data-pdf-watermark-owned>
                  <UtilityField>{copy.watermark.gap}<UtilityInput data-testid="pdf-watermark-gap" type="number" min={0} max={2000} step={1} value={watermark.gap} disabled={locked} aria-invalid={!!fieldErrors.gap || undefined} onChange={(event) => updateWatermark("gap", event.target.value)} />{fieldErrors.gap && <span className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.gap}</span>}</UtilityField>
                  <UtilityField>{copy.watermark.offsetX}<UtilityInput data-testid="pdf-watermark-offset-x" type="number" min={-2000} max={2000} step={1} value={watermark.offsetX} disabled={locked} aria-invalid={!!fieldErrors.offsetX || undefined} onChange={(event) => updateWatermark("offsetX", event.target.value)} />{fieldErrors.offsetX && <span className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.offsetX}</span>}</UtilityField>
                  <UtilityField>{copy.watermark.offsetY}<UtilityInput data-testid="pdf-watermark-offset-y" type="number" min={-2000} max={2000} step={1} value={watermark.offsetY} disabled={locked} aria-invalid={!!fieldErrors.offsetY || undefined} onChange={(event) => updateWatermark("offsetY", event.target.value)} />{fieldErrors.offsetY && <span className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.offsetY}</span>}</UtilityField>
                </div>}
                {!stampActive && <><h3 className="mt-6 mb-3 font-heading text-base font-medium">{copy.numberingTitle}</h3>
                <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.startNumber}<UtilityInput data-testid="pdf-finish-start-number" type="number" step={1} value={startNumber} disabled={locked} aria-invalid={!!fieldErrors.startNumber || undefined} aria-describedby={fieldErrors.startNumber ? `${tabPanelId}-start-number-error` : undefined} onChange={(event) => updatePreflightInput(startNumber, event.target.value, setStartNumber)} />{fieldErrors.startNumber && <span id={`${tabPanelId}-start-number-error`} className="text-xs leading-relaxed text-destructive" role="alert">{fieldErrors.startNumber}</span>}</UtilityField>
                  <UtilityField>{copy.startPage}<UtilityInput data-testid="pdf-finish-start-page" type="number" min={1} max={pageCount} step={1} value={startPage} disabled={locked} aria-invalid={!!fieldErrors.startPage || undefined} aria-describedby={fieldErrors.startPage ? `${tabPanelId}-start-page-error` : undefined} onChange={(event) => updatePreflightInput(startPage, event.target.value, setStartPage)} />{fieldErrors.startPage && <span id={`${tabPanelId}-start-page-error`} className="text-xs leading-relaxed text-destructive" data-testid="pdf-finish-start-page-error" role="alert">{fieldErrors.startPage}</span>}</UtilityField>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-border"><ToggleRow label={copy.excludeCover} description={copy.excludeCoverDescription} checked={excludeCover} onChange={(checked) => updatePreflightInput(excludeCover, checked, setExcludeCover)} disabled={locked} /></div></>}
                <details className="mt-4 rounded-2xl border border-border p-4" data-testid="pdf-finish-structure" data-pdf-structure-owned>
                  <summary className="cursor-pointer font-heading font-medium" data-testid="pdf-finish-structure-summary">{copy.structure.title}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.structure.description}</p>
                  <UtilityNotice className="mt-3" tone="warning" data-testid="pdf-finish-link-preservation">{copy.structure.linkNotice}</UtilityNotice>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border" data-testid="pdf-finish-structure-cleanup-switches">
                    <ToggleRow label={copy.structure.metadata} description={copy.structure.metadataDescription} checked={structure.removeMetadata} onChange={(value) => updateStructure("removeMetadata", value)} disabled={locked} />
                    <ToggleRow label={copy.structure.annotations} description={copy.structure.annotationsDescription} checked={structure.removeAnnotations} onChange={(value) => updateStructure("removeAnnotations", value)} disabled={locked} />
                    <ToggleRow label={copy.structure.attachments} description={copy.structure.attachmentsDescription} checked={structure.removeAttachments} onChange={(value) => updateStructure("removeAttachments", value)} disabled={locked} />
                  </div>
                  <UtilityField className="mt-3">{copy.structure.forms}<UtilitySelect data-testid="pdf-finish-form-mode" value={structure.formMode} disabled={locked} onChange={(event) => updateStructure("formMode", event.target.value as PdfFormMode)}>{(["preserve", "remove", "flatten"] as const).map((value) => <option key={value} value={value}>{copy.structure.formOptions[value]}</option>)}</UtilitySelect></UtilityField>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border" data-testid="pdf-finish-raster" data-pdf-raster-owned>
                    <ToggleRow label={copy.raster.enabled} description={copy.raster.enabledDescription} checked={rasterEnabled} onChange={(enabled) => updateRaster({ enabled })} disabled={locked} />
                    {rasterEnabled && <div className="border-t border-border p-4" data-testid="pdf-finish-raster-settings">
                      <h3 className="font-heading text-sm font-medium">{copy.raster.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy.raster.description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                        <UtilityField>{copy.raster.dpi}<UtilitySelect data-testid="pdf-finish-raster-dpi" value={rasterDpi} disabled={locked} onChange={(event) => updateRaster({ dpi: Number(event.target.value) as RasterDpi })}>{RASTER_DPI_VALUES.map((dpi) => <option key={dpi} value={dpi}>{dpi} DPI</option>)}</UtilitySelect></UtilityField>
                        <UtilityField>{copy.raster.format}<UtilitySelect data-testid="pdf-finish-raster-format" value={rasterFormat} disabled={locked} onChange={(event) => updateRaster({ format: event.target.value as RasterOutputFormat })}>{(["png", "jpeg"] as const).map((format) => <option key={format} value={format}>{copy.raster.formats[format]}</option>)}</UtilitySelect></UtilityField>
                      </div>
                      <UtilityNotice className="mt-3" tone="warning" data-testid="pdf-finish-raster-loss">{copy.raster.lossNotice}</UtilityNotice>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground" data-testid="pdf-finish-raster-mobile-limit">{copy.raster.mobileLimitNotice}</p>
                    </div>}
                  </div>
                  <h3 className="mt-4 text-sm font-bold">{copy.structure.tableTitle}</h3>
                  <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="pb-2 pr-3">{copy.structure.structureLabel}</th><th className="pb-2">{copy.structure.resultLabel}</th></tr></thead><tbody>{[
                    { id: "pages", label: copy.structure.pages, result: copy.structure.pagesResult },
                    { id: "outlines", label: copy.structure.outlines, result: copy.structure.outlinesResult },
                    { id: "destinations", label: copy.structure.destinations, result: copy.structure.destinationsResult },
                    { id: "embedded-files", label: copy.structure.embeddedFiles, result: structure.removeAttachments ? copy.structure.removeResult : copy.structure.preserveResult },
                    { id: "page-labels", label: copy.structure.pageLabels, result: copy.structure.pageLabelsResult },
                    { id: "viewer-preferences", label: copy.structure.viewerPreferences, result: copy.structure.viewerPreferencesResult },
                    { id: "optional-content", label: copy.structure.optionalContent, result: copy.structure.optionalContentResult },
                    { id: "tagged-structure", label: copy.structure.taggedStructure, result: copy.structure.taggedStructureResult },
                    { id: "xmp-metadata", label: copy.structure.xmpMetadata, result: structure.removeMetadata ? copy.structure.removeResult : copy.structure.preserveResult },
                    { id: "acroform", label: copy.structure.acroForm, result: copy.structure.formResults[structure.formMode] },
                    { id: "link-annotations", label: copy.structure.linkAnnotations, result: copy.structure.linksResult },
                    { id: "markup-annotations", label: copy.structure.markupAnnotations, result: structure.removeAnnotations ? copy.structure.removeResult : copy.structure.preserveResult },
                    { id: "unsupported", label: copy.structure.unsupported, result: copy.structure.unsupportedResult },
                  ].map(({ id, label, result }) => <tr key={id} className="border-t border-border" data-structure-row={id}><th scope="row" className="py-2 pr-3 align-top">{label}</th><td className="py-2 leading-relaxed text-muted-foreground">{result}</td></tr>)}</tbody></table></div>
                </details>
              </SectionCard>

              <SectionCard step={3} title={copy.pagesTitle} description={copy.pagesDescription} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
                <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-3 max-[620px]:grid-cols-1">
                  <UtilityField>{copy.pageRange}<UtilityInput data-testid="pdf-finish-range" value={rangeText} disabled={locked} placeholder={copy.pageRangeExample} aria-invalid={!!(selectionEvaluation.error || batchSelection.error) || undefined} onChange={(event) => updatePreflightInput(rangeText, event.target.value, setRangeText)} onBlur={() => { if (selection.canExecute) setRangeText(selection.rangeText); }} /></UtilityField>
                  <UtilityField>{copy.parity}<UtilitySelect data-testid="pdf-finish-parity" value={parity} disabled={locked} onChange={(event) => updatePreflightInput(parity, event.target.value as PageParity, setParity)}>{(["all", "odd", "even"] as const).map((value) => <option key={value} value={value}>{copy.parityOptions[value]}</option>)}</UtilitySelect></UtilityField>
                </div>
                {(selectionEvaluation.error || batchSelection.error) && <UtilityNotice className="mt-3" tone="error" role="alert">{copy.rangeErrors[selectionEvaluation.error || batchSelection.error]}</UtilityNotice>}
                <p className="mt-3 text-sm font-bold text-violet-700 dark:text-violet-300" aria-live="polite">{copy.selectedPages.replace("{{count}}", `${selection.exactPages.length}`).replace("{{total}}", `${pageCount}`)}</p>
                <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-[620px]:grid-cols-2" data-testid="pdf-finish-thumbnails">
                  {pages.map((item, index) => <PdfThumbnail key={item.id} item={item} file={file} outputIndex={index} totalItems={pages.length} draggable={false} selected={selection.exactPages.includes(index + 1)} selectionDisabled={locked || !lowerBound || isThumbnailDisabled(index + 1, pageCount, lowerBound)} onSelect={() => { if (!lowerBound) return; const next = toggleThumbnailPage(selection, index + 1, lowerBound); setRangeText(next.rangeText); setParity(next.parity); setPreflight({ status: "idle", errors: [], warnings: [], failure: "" }); setRiskAccepted(false); download.clearResults(); }} />)}
                </div>
              </SectionCard>
            </div>

            <aside className="sticky top-6 min-w-0 max-[820px]:static">
              <Card as="section" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0" aria-labelledby={`${tabPanelId}-preview-title`}>
                <div className="mb-4 flex items-center gap-2 text-violet-700 dark:text-violet-300"><SquareDashed size={18} /><h2 id={`${tabPanelId}-preview-title`} className="font-heading text-base font-medium text-foreground">{stampActive ? copy.stamp.previewTitle : copy.previewTitle}</h2></div>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{stampActive ? copy.stamp.previewDescription : copy.previewDescription}</p>
                <FinishPreview file={file} pageIndex={Math.max(0, (selection.exactPages[0] ?? 1) - 1)} language={language} form={{ ...form, fontSize: Number.isFinite(fontSize) ? fontSize : 10, margin: Number.isFinite(margin) ? margin : 24 }} startNumber={Number.isSafeInteger(startingNumber) ? startingNumber : 1} startPage={validLowerBound ? startingPage : 1} excludeCover={excludeCover} pageCount={pageCount} copy={copy} lifecycleSignal={fileLifecycleControllerRef.current?.signal} onRenderingChange={updatePreviewing} watermark={watermarkActive ? { ...watermark, rotation: watermarkRotation, opacity: watermarkOpacity, sizePercent: watermarkSize, gap: watermarkGap, offsetX: watermarkOffsetX, offsetY: watermarkOffsetY } : undefined} stamp={stampActive && stampImage && stampImageStatus === "ready" ? { image: stampImage, placement: stampHistory.present, onCommit: updateStampPlacement } : undefined} locked={locked} />
                {!stampActive && <UtilityNotice className="mt-3" tone="warning" data-testid="pdf-finish-preview-disclaimer" data-pdf-watermark-owned={watermarkActive || undefined}>{copy.previewDisclaimer}</UtilityNotice>}
                {preflight.status === "checking" && <UtilityNotice className="mt-3" tone="warning" role="status" data-testid="pdf-finish-preflight-checking" data-pdf-watermark-owned={watermarkActive || undefined}>{copy.preflightChecking}</UtilityNotice>}
                {preflight.status === "ready" && <span className="sr-only" data-testid="pdf-finish-preflight-ready">ready</span>}
                {preflightErrorText && <UtilityNotice className={cn("mt-3", watermarkActive && "text-red-800 dark:text-red-200")} tone="error" role="alert" data-testid="pdf-finish-preflight-error" data-error-code={firstPreflightError?.code} data-pdf-watermark-owned={watermarkActive || undefined} data-pdf-raster-owned={firstPreflightError?.field === "raster" || undefined}>{preflightErrorText}</UtilityNotice>}
                {preflightFailure && <UtilityNotice className={cn("mt-3", watermarkActive && "text-red-800 dark:text-red-200")} tone="error" role="alert" data-testid="pdf-finish-preflight-error" data-error-code={preflight.failure} data-pdf-watermark-owned={watermarkActive || undefined} data-pdf-structure-owned={["structure-unsupported", "form-unsupported"].includes(preflight.failure) || undefined}>{preflightFailure}</UtilityNotice>}
                {!!preflight.warnings.length && <div className="mt-3 space-y-2" data-testid="pdf-finish-preflight-warnings" data-pdf-watermark-owned={watermarkActive || undefined} data-pdf-raster-owned={rasterEnabled || undefined}>{preflight.warnings.map((warning) => <UtilityNotice key={warning} tone="warning" data-warning-code={warning}>{copy.warnings[warning]}</UtilityNotice>)}</div>}
                {!!riskWarnings.length && <div className="mt-3 overflow-hidden rounded-2xl border border-amber-300/70 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" data-testid="pdf-watermark-risk-confirmation" data-pdf-watermark-owned><p className="px-4 pt-4 text-sm font-bold text-foreground">{copy.watermark.riskTitle}</p><ToggleRow label={copy.watermark.riskConsent} description={copy.watermark.riskConsentDescription} checked={riskAccepted} onChange={(checked) => { setRiskAccepted(checked); download.clearResults(); }} disabled={locked} /></div>}
                {(selectionEvaluation.error || batchSelection.error) && <UtilityNotice className="mt-3" tone="error" role="alert">{copy.rangeErrors[selectionEvaluation.error || batchSelection.error]}</UtilityNotice>}
                <div className="mt-4">
                  <PrimaryButton accent="violet" disabled={!batchSelection.files.length || !!fieldError || !!(selectionEvaluation.error || batchSelection.error) || preflightBlocked || locked} loading={operation.status === "running"} onClick={() => void execute()}>{operation.status !== "running" && <FileCheck2 size={18} />}{operation.status === "running" ? copy.creating : operation.status === "error" ? copy.retry : copy.create}</PrimaryButton>
                  {operation.status === "running" && <Button type="button" variant="outline" className="mt-2 min-h-11 w-full rounded-xl text-destructive" data-testid="pdf-finish-cancel" onClick={() => controllerRef.current?.abort()}><X size={17} />{copy.cancel}</Button>}
                </div>
                <OperationProgress {...operation} compact accent="violet" title={copy.progressTitle} />
                {download.results.map((result) => <PdfDownloadCard key={result.url} compact result={result} title={copy.ready} />)}
              </Card>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function FinishPreview({ file, pageIndex, language, form, startNumber, startPage, excludeCover, pageCount, copy, lifecycleSignal, onRenderingChange, watermark, stamp, locked }: {
  file: File;
  pageIndex: number;
  language: AppLanguage;
  form: FinishPreviewFormState;
  startNumber: number;
  startPage: number;
  excludeCover: boolean;
  pageCount: number;
  copy: FinishCopy;
  lifecycleSignal?: AbortSignal;
  onRenderingChange: (rendering: boolean, owner: object) => void;
  watermark?: Omit<PdfWatermarkSettings, "region">;
  stamp?: { image: File; placement: NormalizedStamp; onCommit: (placement: NormalizedStamp) => void };
  locked: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number; sourceWidth: number; sourceHeight: number } | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    const owner = {};
    const cancelFromLifecycle = () => controller.abort();
    lifecycleSignal?.addEventListener("abort", cancelFromLifecycle, { once: true });
    if (lifecycleSignal?.aborted) controller.abort();
    setRendering(true);
    onRenderingChange(true, owner);
    setFailed(false);
    setDimensions(null);
    void renderPdfThumbnail(file, pageIndex, canvas, 520, language, controller.signal)
      .then((nextDimensions) => {
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        if (!controller.signal.aborted) {
          setDimensions(nextDimensions);
          setRendering(false);
          onRenderingChange(false, owner);
        }
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          if (!controller.signal.aborted) {
            setFailed(true);
            setRendering(false);
            onRenderingChange(false, owner);
          }
        }
      });
    return () => {
      lifecycleSignal?.removeEventListener("abort", cancelFromLifecycle);
      controller.abort();
      onRenderingChange(false, owner);
    };
  }, [file, language, lifecycleSignal, onRenderingChange, pageIndex]);
  useEffect(() => {
    const overlayImage = watermark?.image ?? stamp?.image;
    if (!overlayImage) {
      setImageUrl("");
      setImageDimensions(null);
      return;
    }
    const nextUrl = URL.createObjectURL(overlayImage);
    setImageUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [stamp?.image, watermark?.image]);
  useEffect(() => {
    if (!imageUrl) return;
    const image = new Image();
    image.onload = () => setImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => setImageDimensions(null);
    image.src = imageUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl]);

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
  const [vertical, horizontal] = form.region === "center" ? ["center", "center"] as const : form.region.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  const inset = `${Math.min(22, Math.max(3, form.margin / 4))}px`;
  const positionStyle = {
    [vertical]: inset,
    ...(horizontal === "center" ? { left: "50%" } : { [horizontal]: inset }),
    transform: horizontal === "center" ? "translateX(-50%)" : undefined,
    color: form.color,
    fontSize: `${Math.min(24, Math.max(8, form.fontSize))}px`,
    textAlign: horizontal,
  } as const;
  let watermarkPlan: ReturnType<typeof createWatermarkPlacements> | null = null;
  if (watermark && dimensions) {
    const { sourceWidth, sourceHeight } = dimensions;
    const sizePercent = Number.isFinite(watermark.sizePercent) ? Math.min(100, Math.max(1, watermark.sizePercent)) : 60;
    let objectWidth = Math.max(0, sourceWidth - form.margin * 2) * sizePercent / 100;
    let objectHeight = 0;
    if (watermark.content === "image") {
      if (imageDimensions) {
        const scale = Math.min(
          sourceWidth * sizePercent / 100 / imageDimensions.width,
          sourceHeight * sizePercent / 100 / imageDimensions.height,
        );
        objectWidth = imageDimensions.width * scale;
        objectHeight = imageDimensions.height * scale;
      }
    } else {
      const lineHeight = form.fontSize * 1.2;
      const regionHeight = form.region === "center" ? sourceHeight - form.margin * 2 : (sourceHeight - form.margin * 2) / 2;
      const visibleLineCount = Math.min(overlay.split("\n").length, Math.max(0, Math.floor(regionHeight / lineHeight)));
      if (form.region !== "center") objectWidth = Math.min(objectWidth, Math.max(0, sourceWidth - form.margin * 2) / 3);
      if (visibleLineCount > 0) objectHeight = Math.max(lineHeight, (visibleLineCount - 1) * lineHeight + form.fontSize);
    }
    if (objectWidth > 0 && objectHeight > 0) {
      watermarkPlan = createWatermarkPlacements({
        viewport: { width: sourceWidth, height: sourceHeight, rotation: 0, transform: [1, 0, 0, -1, 0, sourceHeight] },
        width: objectWidth,
        height: objectHeight,
        settings: {
          ...watermark,
          region: form.region,
          rotation: Number.isFinite(watermark.rotation) ? watermark.rotation : 0,
          gap: Number.isFinite(watermark.gap) ? watermark.gap : 72,
          offsetX: Number.isFinite(watermark.offsetX) ? watermark.offsetX : 24,
          offsetY: Number.isFinite(watermark.offsetY) ? watermark.offsetY : 24,
        },
        margin: form.margin,
      });
    }
  }
  const previewPlacements = watermarkPlan?.ok ? watermarkPlan.placements : [];
  return <div className="relative min-h-72 overflow-hidden rounded-2xl bg-[#e9e9ed] p-2 dark:bg-[#202023]" data-testid="pdf-finish-preview" data-preview-status={rendering ? "rendering" : failed ? "failed" : "ready"}>
    {(rendering || failed) && <span className="absolute inset-0 grid place-items-center p-4 text-center text-sm font-bold text-muted-foreground">{failed ? copy.previewFailed : copy.previewWaiting}</span>}
    <div className={cn("relative mx-auto max-w-full", rendering && "invisible")} data-testid="pdf-finish-canvas-area" style={dimensions ? { width: `${dimensions.width}px`, aspectRatio: `${dimensions.width} / ${dimensions.height}`, containerType: "inline-size" } : undefined}>
      <canvas ref={canvasRef} className="block h-auto w-full bg-white shadow-md" style={{ width: "100%", height: "auto" }} />
      {!failed && !rendering && stamp && imageUrl && dimensions && <PdfStampOverlay imageUrl={imageUrl} placement={stamp.placement} sourceWidth={dimensions.sourceWidth} sourceHeight={dimensions.sourceHeight} moveLabel={copy.stamp.move} resizeLabel={copy.stamp.resize} disabled={locked} onCommit={stamp.onCommit} />}
      {!failed && !rendering && watermark && <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="pdf-finish-overlay" data-watermark-pattern={watermark.pattern} data-watermark-layer={watermark.layer} data-placement-count={previewPlacements.length} aria-hidden="true">{dimensions && previewPlacements.map((placement, index) => <div key={`${placement.centerX}-${placement.centerY}-${index}`} className="absolute flex items-end overflow-hidden" data-watermark-placement style={{ left: `${placement.centerX / dimensions.sourceWidth * 100}%`, top: `${placement.centerY / dimensions.sourceHeight * 100}%`, width: `${placement.width / dimensions.sourceWidth * 100}%`, height: `${placement.height / dimensions.sourceHeight * 100}%`, color: form.color, fontSize: `${form.fontSize / dimensions.sourceWidth * 100}cqw`, opacity: Number.isFinite(watermark.opacity) ? watermark.opacity : 0.2, textAlign: horizontal, transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`, transformOrigin: "center" }}>{watermark.content === "image" ? imageUrl && <img src={imageUrl} alt="" className="block h-full w-full object-contain" /> : <span className="block w-full whitespace-pre-wrap break-words font-semibold leading-[1.2]">{overlay}</span>}</div>)}</div>}
      {!failed && !rendering && !watermark && !stamp && <span className="pointer-events-none absolute max-w-[60%] whitespace-pre-wrap break-words font-medium leading-[1.2] opacity-90" data-testid="pdf-finish-overlay" aria-hidden="true" style={positionStyle}>{overlay}</span>}
    </div>
  </div>;
}
