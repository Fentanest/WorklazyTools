import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  LockKeyhole,
  LockOpen,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocation } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { OperationProgress } from "../../components/OperationProgress";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect } from "../../components/UtilitySurface";
import {
  FileDropZone,
  formatBytes,
  PageHeader,
  PrimaryButton,
  ResultCard,
  SegmentedControl,
  ToggleRow,
} from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { inspectExcelFiles, mergeExcelFiles } from "./excelWorkerClient";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { stripLanguagePrefix } from "../../i18n/languages";
import { useLocalizedPath } from "../../i18n/routing";
import { prepareOfficeAssets } from "../office-editor/officeAssetLoader";
import { launchOfficeRuntime, type OfficeRuntime } from "../office-editor/officeRuntime";
import type { ExcelInspectionResult, ExcelMergeResult, MergeMode, SheetNameRule, SheetSelectionMode } from "./types";
import type { ExcelThemePalette } from "./excelThemeColors";
import { requiresLegacySpreadsheetConversion, xlsPreserveError } from "./xlsPreserve";

type InspectionState = "checking" | "ready" | "degradedLegacy" | "error";

interface ExcelFileEntry {
  id: string;
  file: File;
  processingFile?: File;
  preservedLegacy?: boolean;
  degradedLegacy?: boolean;
  themePalette?: ExcelThemePalette;
  inspection: InspectionState;
  encrypted: boolean;
  password: string;
  sheetNames: string[];
  selectedSheetNames: string[];
  error?: string;
}

interface DownloadResult extends Omit<ExcelMergeResult, "buffer"> {
  url: string;
  fileName: string;
  size: number;
}

const SUPPORTED_EXTENSIONS = new Set(["xlsx", "xls", "xlsb", "xlsm", "csv"]);
let fileIdSequence = 0;

export function ExcelMergerPage() {
  const { t, i18n } = useTranslation("features");
  const language = i18n.resolvedLanguage === "en" ? "en" : "ko";
  const location = useLocation();
  const preserveLegacyXls = stripLanguagePrefix(location.pathname).replace(/\/+$/, "") === "/tools/excel-merger/xls-preserve";
  const initialXlsRetention = getInitialXlsRetention(preserveLegacyXls, location.search);
  const standardPath = useLocalizedPath("/tools/excel-merger/");
  const preservePath = useLocalizedPath("/tools/excel-merger/xls-preserve/");
  const [entries, setEntries] = useState<ExcelFileEntry[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>("sheets");
  const [xlsxFormulas, setXlsxFormulas] = useState(true);
  const [xlsxFormatting, setXlsxFormatting] = useState(true);
  const [xlsFormulas, setXlsFormulas] = useState(initialXlsRetention.formulas);
  const [xlsFormatting, setXlsFormatting] = useState(initialXlsRetention.formatting);
  const [trimEmptyEdges, setTrimEmptyEdges] = useState(true);
  const [sheetTrimRows, setSheetTrimRows] = useState(false);
  const [sheetTrimColumns, setSheetTrimColumns] = useState(false);
  const [sheetTrimThreshold, setSheetTrimThreshold] = useState(3);
  const [skipHeaderRows, setSkipHeaderRows] = useState(0);
  const [csvEncoding, setCsvEncoding] = useState<"auto" | "utf-8" | "euc-kr">("auto");
  const [sheetNameRule, setSheetNameRule] = useState<SheetNameRule>("file-sheet");
  const [sheetSelectionMode, setSheetSelectionMode] = useState<SheetSelectionMode>("all");
  const [sheetPositionPattern, setSheetPositionPattern] = useState("1");
  const [protectOutput, setProtectOutput] = useState(false);
  const [outputPassword, setOutputPassword] = useState("");
  const [outputPasswordConfirm, setOutputPasswordConfirm] = useState("");
  const [showOutputPassword, setShowOutputPassword] = useState(false);
  const [outputName, setOutputName] = useState(() => t("excel.defaultName"));
  const [loading, setLoading] = useState(false);
  const [precisionPreparing, setPrecisionPreparing] = useState(false);
  const operation = useOperationProgress();
  const [error, setError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const mergeControllerRef = useRef<AbortController | undefined>(undefined);
  const precisionControllerRef = useRef<AbortController | undefined>(undefined);
  const converterCanvasRef = useRef<HTMLCanvasElement>(null);
  const officeRuntimeRef = useRef<OfficeRuntime | undefined>(undefined);
  const assetUiRef = useRef({ fileNumber: 0, percent: -1 });

  useEffect(() => () => {
    mergeControllerRef.current?.abort();
    precisionControllerRef.current?.abort();
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result?.url]);

  const encryptedCount = entries.filter((entry) => entry.encrypted).length;
  const inspecting = entries.some((entry) => entry.inspection === "checking");
  const inspectionFailed = entries.some((entry) => entry.inspection === "error");
  const missingInputPassword = entries.some((entry) => entry.encrypted && !entry.password);
  const outputPasswordMismatch = protectOutput && outputPassword !== outputPasswordConfirm;
  const outputPasswordMissing = protectOutput && !outputPassword;
  const selectedSheetsByFile = useMemo(() => entries.map((entry) => ({
    id: entry.id,
    names: resolveSelectedSheetNames(entry, sheetSelectionMode, sheetPositionPattern),
  })), [entries, sheetSelectionMode, sheetPositionPattern]);
  const selectedSheetCount = selectedSheetsByFile.reduce((total, item) => total + item.names.length, 0);
  const ready = entries.length > 0
    && !precisionPreparing
    && !inspecting
    && !inspectionFailed
    && !missingInputPassword
    && selectedSheetCount > 0
    && !outputPasswordMissing
    && !outputPasswordMismatch;

  const mergeModeLabel = t(`excel.modes.${mergeMode}`);
  const visibleFiles = useMemo(() => entries.map((entry) => entry.file), [entries]);

  const handleFiles = async (nextFiles: File[]) => {
    if (precisionPreparing) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    const existingKeys = new Set(entries.map((entry) => fileKey(entry.file)));

    nextFiles.forEach((file) => {
      if (existingKeys.has(fileKey(file))) return;
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        rejected.push(file.name);
        return;
      }
      existingKeys.add(fileKey(file));
      accepted.push(file);
    });

    if (rejected.length) setFileNotice(t("excel.unsupportedFiles", { files: rejected.join(", ") }));
    else setFileNotice(null);
    if (!accepted.length) return;

    const additions = accepted.map((file) => ({
      id: createFileId(),
      file,
      inspection: "checking" as const,
      encrypted: false,
      password: "",
      sheetNames: [],
      selectedSheetNames: [],
    }));
    setEntries((current) => [...current, ...additions]);
    clearResult();
    setError(null);

    const legacyAdditions = preserveLegacyXls
      ? (await Promise.all(additions.map(async (entry) => ({
          entry,
          requiresConversion: getExtension(entry.file.name) === "xls" && await requiresLegacySpreadsheetConversion(entry.file),
        })))).filter(({ requiresConversion }) => requiresConversion).map(({ entry }) => entry)
      : [];
    if (legacyAdditions.length) {
      void prepareLegacyInputs(additions, legacyAdditions);
      return;
    }

    void inspectExcelFiles(additions.map(({ id, file }) => ({ id, file, csvEncoding })), language)
      .then((inspectionResults) => {
        const byId = new Map(inspectionResults.map((item) => [item.id, item]));
        setEntries((current) => current.map((entry) => {
          const inspectionResult = byId.get(entry.id);
          if (!inspectionResult) return entry;
          return applyInspectionResult(entry, inspectionResult);
        }));
      })
      .catch((inspectionError: Error) => {
        setEntries((current) => current.map((entry) => additions.some((item) => item.id === entry.id)
          ? { ...entry, inspection: "error", error: inspectionError.message }
          : entry));
      });
  };

  const prepareLegacyInputs = async (additions: ExcelFileEntry[], legacyAdditions: ExcelFileEntry[]) => {
    const controller = new AbortController();
    precisionControllerRef.current = controller;
    setPrecisionPreparing(true);
    assetUiRef.current = { fileNumber: 0, percent: -1 };
    operation.start(t("excel.xlsPreserve.status.checking"));
    const additionIds = new Set(additions.map((entry) => entry.id));
    const failEntries = (ids: Set<string>, message: string) => {
      setEntries((current) => current.map((entry) => ids.has(entry.id)
        ? { ...entry, inspection: "error", error: message }
        : entry));
    };
    try {
      if (!crossOriginIsolated || typeof SharedArrayBuffer === "undefined" || !converterCanvasRef.current) {
        throw new Error("isolation-required");
      }
      let runtime = officeRuntimeRef.current;
      if (!runtime) {
        const assetBaseUrl = await prepareOfficeAssets(({ loaded, total, fileNumber, fileCount, cached }) => {
          const percent = Math.max(2, Math.min(74, Math.round((loaded / Math.max(1, total)) * 74)));
          if (assetUiRef.current.fileNumber === fileNumber && assetUiRef.current.percent === percent) return;
          const message = cached
            ? t("excel.xlsPreserve.status.cached", { fileNumber, fileCount })
            : t("excel.xlsPreserve.status.downloading", { loaded: formatBytes(loaded), total: formatBytes(total), fileNumber, fileCount });
          if (assetUiRef.current.fileNumber === fileNumber) operation.updateCurrent(percent, message);
          else operation.update(percent, message);
          assetUiRef.current = { fileNumber, percent };
        }, controller.signal, "converter");
        operation.update(78, t("excel.xlsPreserve.status.preparing"));
        runtime = await launchOfficeRuntime(converterCanvasRef.current, assetBaseUrl);
        officeRuntimeRef.current = runtime;
      } else {
        operation.update(78, t("excel.xlsPreserve.status.reusing"));
      }

      const convertedById = new Map<string, File>();
      const degradedIds = new Set<string>();
      for (let index = 0; index < legacyAdditions.length; index += 1) {
        if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
        const entry = legacyAdditions[index];
        const progress = 80 + Math.round((index / Math.max(1, legacyAdditions.length)) * 14);
        operation.update(progress, t("excel.xlsPreserve.status.converting", { current: index + 1, total: legacyAdditions.length, name: entry.file.name }));
        try {
          const converted = await runtime.convertLegacySpreadsheet(entry.file);
          convertedById.set(entry.id, new File([converted.bytes], converted.fileName, {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            lastModified: entry.file.lastModified,
          }));
        } catch (reason) {
          if (controller.signal.aborted || (reason instanceof DOMException && reason.name === "AbortError")) throw reason;
          degradedIds.add(entry.id);
        }
      }
      if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
      const prepared = additions.map((entry) => {
        const processingFile = convertedById.get(entry.id);
        if (processingFile) return { ...entry, processingFile, preservedLegacy: true, degradedLegacy: false };
        if (degradedIds.has(entry.id)) return { ...entry, processingFile: undefined, preservedLegacy: false, degradedLegacy: true };
        return entry;
      });
      setEntries((current) => current.map((entry) => {
        return prepared.find((item) => item.id === entry.id) ?? entry;
      }));
      operation.update(96, t("excel.xlsPreserve.status.inspecting"));
      const inspectionResults = await inspectExcelFiles(prepared.map((entry) => ({
        id: entry.id,
        file: entry.processingFile ?? entry.file,
        displayName: entry.file.name,
        preservedLegacy: entry.preservedLegacy,
        degradedLegacy: entry.degradedLegacy,
        csvEncoding,
      })), language);
      const byId = new Map(inspectionResults.map((item) => [item.id, item]));
      setEntries((current) => current.map((entry) => {
        const inspectionResult = byId.get(entry.id);
        if (!inspectionResult) return entry;
        return applyInspectionResult(prepared.find((item) => item.id === entry.id) ?? entry, inspectionResult);
      }));
      const firstError = inspectionResults.find((result) => result.error)?.error;
      if (firstError) operation.fail(firstError);
      else if (degradedIds.size) operation.succeed(t("excel.xlsPreserve.status.degraded", { count: degradedIds.size }));
      else operation.succeed(t("excel.xlsPreserve.status.ready", { count: legacyAdditions.length }));
    } catch (reason) {
      const message = xlsPreserveError(reason, language);
      failEntries(additionIds, message);
      setError(message);
      operation.fail(message);
    } finally {
      setPrecisionPreparing(false);
      if (precisionControllerRef.current === controller) precisionControllerRef.current = undefined;
    }
  };

  const changeXlsRetention = (kind: "formulas" | "formatting", checked: boolean) => {
    if (precisionPreparing || loading) return;
    const next = {
      formulas: kind === "formulas" ? checked : xlsFormulas,
      formatting: kind === "formatting" ? checked : xlsFormatting,
    };
    const requiresNavigation = preserveLegacyXls ? !next.formulas && !next.formatting : next.formulas || next.formatting;
    if (requiresNavigation) {
      if (entries.length > 0 && !window.confirm(t("excel.xlsPreserve.switchConfirm"))) return;
      if (!next.formulas && !next.formatting) {
        window.location.assign(standardPath);
        return;
      }
      window.location.assign(createPreserveUrl(preservePath, next));
      return;
    }
    setXlsFormulas(next.formulas);
    setXlsFormatting(next.formatting);
    window.history.replaceState(window.history.state, "", createPreserveUrl(preservePath, next));
    clearResult();
  };

  const removeFile = (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setError(null);
    clearResult();
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    clearResult();
  };

  const updateInputPassword = (id: string, password: string) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, password, error: undefined, inspection: "ready" } : entry));
    setError(null);
  };

  const inspectProtectedFile = (id: string, password: string) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry || !password) return;
    setEntries((current) => current.map((item) => item.id === id ? { ...item, inspection: "checking", error: undefined } : item));
    void inspectExcelFiles([{
      id,
      file: entry.processingFile ?? entry.file,
      displayName: entry.file.name,
      preservedLegacy: entry.preservedLegacy,
      degradedLegacy: entry.degradedLegacy,
      password,
    }], language).then(([inspectionResult]) => {
      setEntries((current) => current.map((item) => item.id === id ? applyInspectionResult(item, inspectionResult, true) : item));
    }).catch((inspectionError: Error) => {
      setEntries((current) => current.map((item) => item.id === id
        ? { ...item, inspection: "error", error: inspectionError.message }
        : item));
    });
  };

  const toggleSheet = (id: string, sheetName: string) => {
    setEntries((current) => current.map((entry) => {
      if (entry.id !== id) return entry;
      const selected = new Set(entry.selectedSheetNames);
      if (selected.has(sheetName)) selected.delete(sheetName);
      else selected.add(sheetName);
      return { ...entry, selectedSheetNames: entry.sheetNames.filter((name) => selected.has(name)) };
    }));
    clearResult();
  };

  const setAllSheetsForFile = (id: string, selected: boolean) => {
    setEntries((current) => current.map((entry) => entry.id === id
      ? { ...entry, selectedSheetNames: selected ? entry.sheetNames : [] }
      : entry));
    clearResult();
  };

  const runMerge = async () => {
    if (!ready) return;
    clearResult();
    setLoading(true);
    const controller = new AbortController();
    mergeControllerRef.current = controller;
    operation.start(t("excel.status.preparing", { count: entries.length }));
    setError(null);

    try {
      const mergeEntries = entries.map((entry) => ({
        entry,
        selectedSheetNames: resolveSelectedSheetNames(entry, sheetSelectionMode, sheetPositionPattern),
      })).filter((item) => item.selectedSheetNames.length > 0);
      const merged = await mergeExcelFiles(
        mergeEntries.map(({ entry, selectedSheetNames }) => ({
          id: entry.id,
          file: entry.processingFile ?? entry.file,
          displayName: entry.file.name,
          preservedLegacy: entry.preservedLegacy,
          degradedLegacy: entry.degradedLegacy,
          themePalette: entry.themePalette,
          password: entry.password || undefined,
          selectedSheetNames,
          csvEncoding,
          retention: entry.degradedLegacy ? { formulas: false, formatting: false } : retentionForFile(entry.file.name, {
            xlsx: { formulas: xlsxFormulas, formatting: xlsxFormatting },
            xls: { formulas: xlsFormulas, formatting: xlsFormatting },
          }),
        })),
        {
          mergeMode,
          trimEmptyEdges,
          sheetTrimRows,
          sheetTrimColumns,
          sheetTrimThreshold,
          skipHeaderRows: mergeMode === "vertical" ? skipHeaderRows : 0,
          sheetNameRule,
          outputPassword: protectOutput ? outputPassword : undefined,
        },
        (nextProgress, message) => {
          operation.update(nextProgress, message);
        },
        language,
        controller.signal,
      );

      const fileName = normalizeOutputName(outputName, t("excel.defaultName"));
      const blob = new Blob([merged.buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      setResult({
        url,
        fileName,
        size: blob.size,
        fileCount: merged.fileCount,
        sheetCount: merged.sheetCount,
        outputSheetCount: merged.outputSheetCount,
        encrypted: merged.encrypted,
        warnings: merged.warnings,
      });

      // Passwords should not remain in React state after the operation is complete.
      setEntries((current) => current.map((entry) => ({ ...entry, password: "" })));
      setOutputPassword("");
      setOutputPasswordConfirm("");
      operation.succeed(t("excel.status.complete"));
    } catch (mergeError) {
      const normalized = mergeError as Error & { code?: string; fileName?: string };
      setError(normalized.message);
      operation.fail(normalized.message);
      if (normalized.code === "PASSWORD_REQUIRED" && normalized.fileName) {
        setEntries((current) => current.map((entry) => entry.file.name === normalized.fileName
          ? { ...entry, encrypted: true, inspection: "ready" }
          : entry));
      }
    } finally {
      setLoading(false);
      if (mergeControllerRef.current === controller) mergeControllerRef.current = undefined;
    }
  };

  const clearResult = () => {
    setResult((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  return (
    <UtilityPage toolId="excel-merger">
      <div className="contents" data-testid="excel-merger-page">
      <PageHeader eyebrow="SPREADSHEET TOOL" title={t("excel.title")} description={t("excel.description")}>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-800 dark:text-green-300"><span className="size-2 rounded-full bg-green-600 dark:bg-green-300" /> {t("excel.ready")}</div>
      </PageHeader>
      <PrivacyBanner compact />

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_280px] items-start gap-5 max-[900px]:grid-cols-1">
        <div className="min-w-0">
          <UtilitySectionCard step={1} title={t("excel.steps.files.title")} description={t("excel.steps.files.description")}>
            <FileDropZone
              accept=".xlsx,.xls,.xlsb,.xlsm,.csv"
              hint={t("excel.steps.files.hint")}
              multiple
              files={visibleFiles}
              onFiles={handleFiles}
              accent="green"
            />
            <UtilityNotice className="mt-3"><Info className="mt-0.5 shrink-0" size={15} /><span>{t(preserveLegacyXls ? "excel.steps.files.preserveNotice" : "excel.steps.files.notice")}</span></UtilityNotice>
            {fileNotice && <UtilityNotice className="mt-2" role="status"><AlertCircle className="mt-0.5 shrink-0" size={15} /><span>{fileNotice}</span></UtilityNotice>}
            <ExcelFileList
              entries={entries}
              onRemove={removeFile}
              onMove={moveFile}
              onPasswordChange={updateInputPassword}
              onPasswordInspect={inspectProtectedFile}
              t={t}
            />
          </UtilitySectionCard>

          <UtilitySectionCard step={2} title={t("excel.steps.sheets.title")} description={t("excel.steps.sheets.description")}>
            <div data-testid="excel-sheet-selection-mode"><SegmentedControl
              label={t("excel.sheetSelection.label")}
              value={sheetSelectionMode}
              onChange={(value) => { setSheetSelectionMode(value); clearResult(); }}
              options={[
                { value: "all", label: t("excel.sheetSelection.all") },
                { value: "positions", label: t("excel.sheetSelection.positions") },
                { value: "custom", label: t("excel.sheetSelection.custom") },
              ]}
            /></div>
            {sheetSelectionMode === "positions" && (
              <UtilityField className="mt-3" data-testid="excel-sheet-position-input">
                <span>{t("excel.sheetSelection.positionLabel")}</span>
                <UtilityInput
                  id="sheet-position-pattern"
                  value={sheetPositionPattern}
                  onChange={(event) => { setSheetPositionPattern(event.target.value); clearResult(); }}
                  placeholder={t("excel.sheetSelection.placeholder")}
                />
                <small className="font-normal text-muted-foreground">{t("excel.sheetSelection.help")}</small>
              </UtilityField>
            )}
            {entries.length > 0 && (
              <div className="hidden items-center gap-2 rounded-xl border border-green-700/30 bg-green-50 px-3 py-2 text-sm font-bold text-green-900 shadow-sm max-[620px]:sticky max-[620px]:top-[calc(72px+env(safe-area-inset-top))] max-[620px]:z-10 max-[620px]:mt-3 max-[620px]:flex dark:border-green-300/40 dark:bg-green-950/90 dark:text-green-200" data-testid="excel-mobile-sheet-summary" role="status">
                <FileSpreadsheet size={16} aria-hidden="true" />
                <span>{t("excel.sheetList.mobileSummary", { files: entries.length, sheets: selectedSheetCount })}</span>
              </div>
            )}
            <ExcelSheetSelector
              entries={entries}
              mode={sheetSelectionMode}
              pattern={sheetPositionPattern}
              onToggle={toggleSheet}
              onSetAll={setAllSheetsForFile}
              t={t}
            />
            {entries.length > 0 && !inspecting && selectedSheetCount === 0 && <UtilityNotice className="mt-2" data-testid="excel-sheet-required" role="status"><AlertCircle className="mt-0.5 shrink-0" size={15} /><span>{t("excel.sheetSelection.required")}</span></UtilityNotice>}
          </UtilitySectionCard>

          <UtilitySectionCard step={3} title={t("excel.steps.mode.title")} description={t("excel.steps.mode.description")}>
            <div data-testid="excel-merge-mode" className="[&_[data-slot=toggle-group-item]]:h-auto [&_[data-slot=toggle-group-item]]:min-h-9 [&_[data-slot=toggle-group-item]]:py-2 [&_[data-slot=toggle-group-item]]:wrap-anywhere [&_[data-slot=toggle-group-item]]:whitespace-normal max-[620px]:[&_[data-slot=toggle-group-item]]:min-h-11 max-[620px]:[&_[data-slot=toggle-group-item]]:px-1">
              <SegmentedControl
                label={t("excel.steps.mode.label")}
                value={mergeMode}
                onChange={(value) => { setMergeMode(value); clearResult(); }}
                options={[
                  { value: "sheets", label: t("excel.modes.sheets") },
                  { value: "vertical", label: t("excel.modes.vertical") },
                  { value: "horizontal", label: t("excel.modes.horizontal") },
                ]}
              />
            </div>
            <UtilityNotice className="mt-3" tone="success">
              <Info className="mt-0.5 shrink-0" size={17} />
              <span>{t(`excel.modeHelp.${mergeMode}`)}</span>
            </UtilityNotice>
          </UtilitySectionCard>

          <UtilitySectionCard step={4} title={t("excel.steps.output.title")} description={t("excel.steps.output.description")}>
            <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1" data-testid="excel-settings-categories">
              <Card as="section" className="gap-0 overflow-visible rounded-2xl border border-border p-3 shadow-sm" data-testid="excel-settings-category">
                <h3 className="mb-1 font-heading text-base font-medium">{t("excel.output.categories.xlsxInput")}</h3>
                <div className="divide-y divide-border">
                  <ToggleRow
                    label={t("excel.output.xlsxFormulas")}
                    description={t(xlsxFormulas ? "excel.output.xlsxFormulasOn" : "excel.output.xlsxFormulasOff")}
                    checked={xlsxFormulas}
                    onChange={(checked) => { setXlsxFormulas(checked); clearResult(); }}
                  />
                  <ToggleRow
                    label={t("excel.output.xlsxFormatting")}
                    description={t(xlsxFormatting ? "excel.output.xlsxFormattingOn" : "excel.output.xlsxFormattingOff")}
                    checked={xlsxFormatting}
                    onChange={(checked) => { setXlsxFormatting(checked); clearResult(); }}
                  />
                </div>
              </Card>

              <Card as="section" className="gap-0 overflow-visible rounded-2xl border border-border p-3 shadow-sm" data-testid="excel-settings-category">
                <h3 className="mb-1 font-heading text-base font-medium">{t("excel.output.categories.xlsInput")}</h3>
                <div className="divide-y divide-border">
                  <ToggleRow
                    label={t("excel.xlsPreserve.formulasLabel")}
                    description={t(xlsFormulas ? "excel.xlsPreserve.formulasOn" : "excel.xlsPreserve.formulasOff")}
                    checked={xlsFormulas}
                    onChange={(checked) => changeXlsRetention("formulas", checked)}
                    disabled={precisionPreparing || loading}
                  />
                  <ToggleRow
                    label={t("excel.xlsPreserve.formattingLabel")}
                    description={t(xlsFormatting ? "excel.xlsPreserve.formattingOn" : "excel.xlsPreserve.formattingOff")}
                    checked={xlsFormatting}
                    onChange={(checked) => changeXlsRetention("formatting", checked)}
                    disabled={precisionPreparing || loading}
                  />
                </div>
                <UtilityNotice className="mt-2"><Info className="mt-0.5 shrink-0" size={15} /><span>{t("excel.xlsPreserve.reloadNotice")}</span></UtilityNotice>
              </Card>

              <Card as="section" className="gap-0 overflow-visible rounded-2xl border border-border p-3 shadow-sm" data-testid="excel-settings-category">
                <h3 className="mb-3 font-heading text-base font-medium">{t("excel.output.categories.csvInput")}</h3>
                <UtilityField><span>{t("excel.output.csvEncoding")}</span><small className="font-normal text-muted-foreground">{t("excel.output.csvEncodingHelp")}</small><UtilitySelect value={csvEncoding} onChange={(event) => { setCsvEncoding(event.target.value as "auto" | "utf-8" | "euc-kr"); clearResult(); }}><option value="auto">{t("excel.output.csvAuto")}</option><option value="utf-8">UTF-8</option><option value="euc-kr">CP949 / EUC-KR</option></UtilitySelect></UtilityField>
              </Card>

              <Card as="section" className="gap-0 overflow-visible rounded-2xl border border-border p-3 shadow-sm" data-testid="excel-settings-category">
                <h3 className="mb-1 font-heading text-base font-medium">{t("excel.output.categories.emptyAreas")}</h3>
                <div className="divide-y divide-border">
                  <ToggleRow
                    label={t("excel.output.trimEdges")}
                    description={t("excel.output.trimEdgesHelp")}
                    checked={trimEmptyEdges}
                    onChange={(checked) => { setTrimEmptyEdges(checked); clearResult(); }}
                  />
                  <ToggleRow
                    label={t("excel.output.trimRows")}
                    description={t("excel.output.trimRowsHelp")}
                    checked={sheetTrimRows}
                    onChange={(checked) => { setSheetTrimRows(checked); clearResult(); }}
                  />
                  <ToggleRow
                    label={t("excel.output.trimColumns")}
                    description={t("excel.output.trimColumnsHelp")}
                    checked={sheetTrimColumns}
                    onChange={(checked) => { setSheetTrimColumns(checked); clearResult(); }}
                  />
                  <UtilityField className="border-t border-border pt-2.5" data-testid="excel-sheet-trim-threshold">
                    <span>{t("excel.output.trimThreshold")}</span><small className="font-normal text-muted-foreground">{t("excel.output.trimThresholdHelp")}</small>
                    <span className="flex items-center gap-2">
                      <UtilityInput
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={sheetTrimThreshold}
                        disabled={!sheetTrimRows && !sheetTrimColumns}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) setSheetTrimThreshold(Math.max(1, Math.floor(next)));
                          clearResult();
                        }}
                        aria-label={t("excel.output.trimThresholdAria")}
                      />
                      <small className="shrink-0 font-normal text-muted-foreground">{t("excel.output.orMore")}</small>
                    </span>
                  </UtilityField>
                </div>
              </Card>

              <Card as="section" className="gap-0 overflow-visible rounded-2xl border border-border p-3 shadow-sm" data-testid="excel-settings-category">
                <h3 className="mb-3 font-heading text-base font-medium">{t("excel.output.categories.mergeDetails")}</h3>
                <div className="grid gap-3">
                  <UtilityField>
                    <span>{t("excel.output.skipHeaders")}</span><small className="font-normal text-muted-foreground">{t("excel.output.skipHeadersHelp")}</small>
                    <span className="flex items-center gap-2"><UtilityInput type="number" min={0} step={1} inputMode="numeric" value={skipHeaderRows} disabled={mergeMode !== "vertical"} onChange={(event) => { setSkipHeaderRows(Math.max(0, Math.floor(Number(event.target.value) || 0))); clearResult(); }} /><small className="shrink-0 font-normal text-muted-foreground">{t("excel.output.rows")}</small></span>
                  </UtilityField>
                  <UtilityField>
                    <span>{t("excel.output.sheetNameRule")}</span><small className="font-normal text-muted-foreground">{t("excel.output.sheetNameRuleHelp")}</small>
                    <UtilitySelect value={sheetNameRule} disabled={mergeMode !== "sheets"} onChange={(event) => setSheetNameRule(event.target.value as SheetNameRule)}>
                      <option value="file-sheet">{t("excel.output.fileSheet")}</option>
                      <option value="sheet-file">{t("excel.output.sheetFile")}</option>
                      <option value="sheet">{t("excel.output.originalSheet")}</option>
                    </UtilitySelect>
                  </UtilityField>
                </div>
              </Card>
            </div>

            <UtilityField className="mt-3"><span>{t("excel.output.fileName")}</span><span className="flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"><FileSpreadsheet className="shrink-0 text-green-700 dark:text-green-300" size={17} /><input className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none max-[620px]:text-base" id="output-file-name" value={outputName} onChange={(event) => setOutputName(event.target.value)} /></span></UtilityField>
          </UtilitySectionCard>

          <UtilitySectionCard step={5} title={t("excel.steps.protect.title")} description={t("excel.steps.protect.description")}>
            <div>
              <ToggleRow
                label={t("excel.protect.label")}
                description={t("excel.protect.help")}
                checked={protectOutput}
                onChange={(checked) => {
                  setProtectOutput(checked);
                  if (!checked) {
                    setOutputPassword("");
                    setOutputPasswordConfirm("");
                  }
                  clearResult();
                }}
              />
            </div>
            {protectOutput && (
              <div className="mt-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1" data-testid="excel-output-password-form">
                <PasswordField label={t("excel.protect.password")} value={outputPassword} onChange={setOutputPassword} visible={showOutputPassword} onVisibilityChange={setShowOutputPassword} toggleLabel={t("excel.protect.toggle")} />
                <PasswordField label={t("excel.protect.confirm")} value={outputPasswordConfirm} onChange={setOutputPasswordConfirm} visible={showOutputPassword} toggleLabel={t("excel.protect.toggle")} />
                {outputPasswordConfirm && outputPasswordMismatch && <p className="col-span-full text-sm font-bold text-destructive">{t("excel.protect.mismatch")}</p>}
                <p className="col-span-full flex items-start gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="mt-0.5 shrink-0" size={13} /> {t("excel.protect.warning")}</p>
              </div>
            )}
          </UtilitySectionCard>
        </div>

        <aside className="sticky top-24 max-[900px]:static" data-testid="excel-merge-summary">
          <Card className="gap-0 overflow-visible rounded-3xl border border-border p-4 shadow-md">
            <div className="flex items-center gap-2"><SlidersHorizontal className="text-green-700 dark:text-green-300" size={19} /><h2 className="font-heading text-lg font-medium">{t("excel.summary.title")}</h2></div>
            <dl className="mt-3 divide-y divide-border text-sm [&>div]:flex [&>div]:items-start [&>div]:justify-between [&>div]:gap-3 [&>div]:py-2 [&_dd]:text-right [&_dd]:font-bold [&_dt]:text-muted-foreground">
              <div><dt>{t("excel.summary.files")}</dt><dd>{t("excel.summary.count", { count: entries.length })}</dd></div>
              <div><dt>{t("excel.summary.sheets")}</dt><dd>{t("excel.summary.count", { count: selectedSheetCount })}</dd></div>
              <div><dt>{t("excel.summary.encryptedInputs")}</dt><dd>{t("excel.summary.count", { count: encryptedCount })}</dd></div>
              <div><dt>{t("excel.summary.mode")}</dt><dd>{mergeModeLabel}</dd></div>
              <div><dt>{t("excel.summary.xlsxFormulas")}</dt><dd>{t(xlsxFormulas ? "excel.summary.enabled" : "excel.summary.disabled")}</dd></div>
              <div><dt>{t("excel.summary.xlsxFormatting")}</dt><dd>{t(xlsxFormatting ? "excel.summary.enabled" : "excel.summary.disabled")}</dd></div>
              <div><dt>{t("excel.summary.xlsFormulas")}</dt><dd>{t(xlsFormulas ? "excel.summary.enabled" : "excel.summary.disabled")}</dd></div>
              <div><dt>{t("excel.summary.xlsFormatting")}</dt><dd>{t(xlsFormatting ? "excel.summary.enabled" : "excel.summary.disabled")}</dd></div>
              <div><dt>{t("excel.summary.middleEmpty")}</dt><dd>{sheetTrimRows || sheetTrimColumns ? t("excel.summary.emptyEnabled", { axes: `${sheetTrimRows ? t("excel.summary.rows") : ""}${sheetTrimRows && sheetTrimColumns ? "·" : ""}${sheetTrimColumns ? t("excel.summary.columns") : ""}`, count: sheetTrimThreshold }) : t("excel.summary.disabled")}</dd></div>
              <div><dt>{t("excel.summary.format")}</dt><dd>{t(protectOutput ? "excel.summary.protected" : "excel.summary.unprotected")}</dd></div>
            </dl>
            <div className="mt-3"><PrimaryButton accent="green" disabled={!ready} loading={loading} onClick={() => void runMerge()}>
              {loading ? t("excel.summary.processing", { progress: operation.progress }) : t("excel.summary.merge")}
            </PrimaryButton></div>
            {loading && <Button className="mt-2 w-full rounded-xl" type="button" variant="secondary" onClick={() => mergeControllerRef.current?.abort()}>{t("excel.summary.cancel")}</Button>}
            {precisionPreparing && <Button className="mt-2 w-full rounded-xl" type="button" variant="secondary" onClick={() => precisionControllerRef.current?.abort()}>{t("excel.xlsPreserve.cancel")}</Button>}
            {!loading && inspecting && <p className="mt-2 text-center text-xs text-muted-foreground">{t("excel.summary.inspecting")}</p>}
            {!loading && inspectionFailed && <p className="mt-2 text-center text-xs font-bold text-destructive">{t("excel.summary.inspectionFailed")}</p>}
            {!loading && !result && missingInputPassword && <p className="mt-2 text-center text-xs font-bold text-destructive">{t("excel.summary.inputPassword")}</p>}
            {!loading && entries.length > 0 && selectedSheetCount === 0 && <p className="mt-2 text-center text-xs font-bold text-destructive">{t("excel.summary.selectSheet")}</p>}
            {!loading && !result && outputPasswordMissing && <p className="mt-2 text-center text-xs font-bold text-destructive">{t("excel.summary.outputPassword")}</p>}
          </Card>
          <OperationProgress
            status={operation.status}
            progress={operation.progress}
            message={operation.message}
            logs={operation.logs}
            accent="green"
            title={t("excel.progressTitle")}
          />
        </aside>
      </div>

      {error && <UtilityNotice className="mt-4" data-testid="excel-merge-error" tone="error" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={19} /><div className="flex flex-col"><strong>{t("excel.failed")}</strong><span>{error}</span></div></UtilityNotice>}

      {result && (
        <ResultCard
          accent="green"
          title={t("excel.result.title")}
          message={t("excel.result.message", { fileCount: result.fileCount, sheetCount: result.sheetCount, outputCount: result.outputSheetCount, encrypted: result.encrypted ? t("excel.result.encrypted") : "" })}
        >
          <div className="flex flex-wrap items-center gap-2" data-testid="excel-result-actions"><Button render={<a href={result.url} download={result.fileName} data-testid="excel-result-download" />} className="h-auto min-h-11 rounded-xl" variant="secondary"><Download size={17} /><span className="min-w-0 overflow-hidden text-ellipsis">{result.fileName}</span><small className="text-xs text-muted-foreground">{formatBytes(result.size)}</small></Button><FileShareButton url={result.url} fileName={result.fileName} mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
          {result.warnings.length > 0 && (
            <div className="mt-2 grid gap-1" data-testid="excel-result-warnings">{result.warnings.map((warning) => <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300" key={warning}><Info className="mt-0.5 shrink-0" size={13} /> {warning}</p>)}</div>
          )}
        </ResultCard>
      )}

      <ToolGuide
        title={t("excel.guide.title")}
        description={t("excel.guide.description")}
        blocks={t("excel.guide.blocks", { returnObjects: true }) as Array<{ title: string; paragraphs: string[]; items?: string[] }>}
        faq={(t("excel.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map(({ q, a }) => ({ question: q, answer: a }))}
      />
      {preserveLegacyXls && <canvas ref={converterCanvasRef} id="qtcanvas" className="pointer-events-none fixed size-px opacity-0" aria-hidden="true" />}
      </div>
    </UtilityPage>
  );
}

function applyInspectionResult(entry: ExcelFileEntry, result: ExcelInspectionResult, preserveSelection = false): ExcelFileEntry {
  return {
    ...entry,
    inspection: result.error ? "error" : entry.degradedLegacy ? "degradedLegacy" : "ready",
    encrypted: result.encrypted,
    sheetNames: result.sheetNames,
    selectedSheetNames: preserveSelection && entry.sheetNames.length
      ? result.sheetNames.filter((name) => entry.selectedSheetNames.includes(name))
      : result.sheetNames,
    themePalette: result.themePalette,
    error: result.error,
  };
}

function ExcelSheetSelector({ entries, mode, pattern, onToggle, onSetAll, t }: {
  entries: ExcelFileEntry[];
  mode: SheetSelectionMode;
  pattern: string;
  onToggle: (id: string, sheetName: string) => void;
  onSetAll: (id: string, selected: boolean) => void;
  t: TFunction<"features">;
}) {
  if (!entries.length) return <div className="mt-3 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground" data-testid="excel-sheet-selector-empty">{t("excel.sheetList.empty")}</div>;

  return (
    <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] items-start gap-[9px] max-[900px]:grid-cols-1" data-testid="excel-sheet-selector">
      {entries.map((entry) => {
        const selectedNames = new Set(resolveSelectedSheetNames(entry, mode, pattern));
        const headingId = `sheet-file-heading-${entry.id}`;
        return (
          <Card as="section" className="gap-0 overflow-visible rounded-2xl border border-border p-3 shadow-sm" data-testid="excel-sheet-file-group" key={entry.id} aria-labelledby={headingId}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" data-testid="excel-sheet-file-heading">
              <span className="min-w-0"><h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold" id={headingId} title={entry.file.name} aria-label={entry.file.name}>{entry.file.name}</h3><small className="mt-0.5 block text-xs text-muted-foreground">{entry.sheetNames.length ? t("excel.sheetList.included", { selected: selectedNames.size, total: entry.sheetNames.length }) : t("excel.sheetList.needsCheck")}</small></span>
              {mode === "custom" && entry.sheetNames.length > 0 && (
                <span className="flex items-center gap-1" data-testid="excel-sheet-select-actions">
                  <Button size="xs" variant="ghost" type="button" onClick={() => onSetAll(entry.id, true)}>{t("excel.sheetList.all")}</Button>
                  <Button size="xs" variant="ghost" type="button" onClick={() => onSetAll(entry.id, false)}>{t("excel.sheetList.clear")}</Button>
                </span>
              )}
            </div>
            {entry.inspection === "checking" ? (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={14} /> {t("excel.sheetList.loading")}</div>
            ) : entry.encrypted && !entry.sheetNames.length && !entry.error ? (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><FileLock2 size={14} /> {t("excel.sheetList.password")}</div>
            ) : entry.error ? (
              <div className="mt-3 flex items-center gap-1.5 text-sm font-bold text-destructive"><AlertCircle size={14} /> {entry.error}</div>
            ) : (
              <ol className="mt-3 flex max-h-[204px] flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain rounded-xl bg-muted/35 p-2" data-testid="excel-sheet-name-list" data-mode={mode}>
                {entry.sheetNames.map((sheetName, index) => {
                  const selected = selectedNames.has(sheetName);
                  return (
                    <li className="min-w-0 max-w-full" data-selected={selected || undefined} key={sheetName} aria-label={mode === "custom" ? undefined : sheetName}>
                      {mode === "custom" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={`min-h-9 max-w-[180px] justify-start rounded-lg px-2 max-[620px]:min-h-11 ${selected ? "border-green-700 bg-green-500/10 dark:border-green-300" : "opacity-65"}`}
                          data-testid="excel-sheet-name-chip"
                          aria-pressed={selected}
                          aria-label={sheetName}
                          title={sheetName}
                          onClick={() => onToggle(entry.id, sheetName)}
                        >
                          <b className="grid size-5 shrink-0 place-items-center rounded bg-green-500/15 text-[11px]" aria-hidden="true">{index + 1}</b><span className="min-w-0 overflow-hidden text-ellipsis">{sheetName}</span>
                        </Button>
                      ) : (
                        <span className={`inline-flex min-h-9 max-w-[180px] items-center gap-1.5 rounded-lg border px-2 text-xs max-[620px]:min-h-11 ${selected ? "border-green-700/50 bg-green-500/10" : "border-border opacity-55"}`} data-testid="excel-sheet-name-chip" title={sheetName}>
                          <b className="grid size-5 shrink-0 place-items-center rounded bg-green-500/15 text-[11px]" aria-hidden="true">{index + 1}</b><span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{sheetName}</span>{selected && <small className="shrink-0 font-bold text-green-800 dark:text-green-300">{t("excel.sheetList.include")}</small>}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ExcelFileList({ entries, onRemove, onMove, onPasswordChange, onPasswordInspect, t }: {
  entries: ExcelFileEntry[];
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onPasswordChange: (id: string, password: string) => void;
  onPasswordInspect: (id: string, password: string) => void;
  t: TFunction<"features">;
}) {
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  if (!entries.length) return null;

  const togglePassword = (id: string) => setVisiblePasswords((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="mt-3 grid gap-2.5" data-testid="excel-file-list">
      {entries.map((entry, index) => (
        <Card className={`gap-0 overflow-visible rounded-2xl border p-3 shadow-sm ${entry.encrypted ? "border-amber-500/40" : "border-border"}`} data-testid="excel-file-item" data-inspection={entry.inspection} data-encrypted={entry.encrypted || undefined} key={entry.id}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 max-[620px]:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span className="grid h-8 min-w-10 place-items-center rounded-lg bg-green-500/15 px-1.5 text-[10px] font-extrabold text-green-800 dark:text-green-300">{entry.file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span>
            <span className="min-w-0" data-testid="excel-file-meta"><strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm">{entry.file.name}</strong><small className="block text-xs text-muted-foreground">{formatBytes(entry.file.size)}</small></span>
            <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground max-[620px]:col-span-2 max-[620px]:col-start-1" data-testid="excel-file-status" data-state={entry.inspection}>
              {entry.inspection === "checking"
                ? <><LoaderCircle className="animate-spin" size={14} /> {t("excel.fileList.checking")}</>
                : entry.encrypted
                  ? <><FileLock2 size={14} /> {t("excel.fileList.encrypted")}</>
                  : entry.inspection === "error"
                    ? <><AlertCircle size={14} /> {t("excel.fileList.needsCheck")}</>
                    : entry.inspection === "degradedLegacy"
                      ? <><AlertCircle size={14} /> {t("excel.fileList.degradedLegacy")}</>
                    : <><CheckCircle2 size={14} /> {t("excel.fileList.available")}</>}
            </span>
            <span className="flex items-center gap-0.5 max-[620px]:col-start-3 max-[620px]:row-start-1">
              <Button variant="ghost" size="icon-sm" className="rounded-lg" type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={t("excel.fileList.moveUp", { name: entry.file.name })}><ArrowUp size={15} /></Button>
              <Button variant="ghost" size="icon-sm" className="rounded-lg" type="button" onClick={() => onMove(index, 1)} disabled={index === entries.length - 1} aria-label={t("excel.fileList.moveDown", { name: entry.file.name })}><ArrowDown size={15} /></Button>
            </span>
            <Button className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive max-[620px]:col-start-3 max-[620px]:row-start-2" variant="ghost" size="icon-sm" type="button" onClick={() => onRemove(entry.id)} aria-label={t("excel.fileList.remove", { name: entry.file.name })}><X size={17} /></Button>
          </div>
          {entry.encrypted && (
            <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-amber-500/10 p-2.5" data-testid="excel-input-password">
              <LockKeyhole className="text-amber-800 dark:text-amber-300" size={16} />
              <label className="text-xs font-bold text-muted-foreground" htmlFor={`password-${entry.id}`}>{t("excel.protect.password")}</label>
              <div className="col-span-full flex h-10 items-center rounded-xl border border-input bg-background pl-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
                <input className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none max-[620px]:text-base"
                  id={`password-${entry.id}`}
                  type={visiblePasswords.has(entry.id) ? "text" : "password"}
                  value={entry.password}
                  onChange={(event) => onPasswordChange(entry.id, event.target.value)}
                  onBlur={(event) => onPasswordInspect(entry.id, event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  placeholder={t("excel.fileList.passwordPlaceholder")}
                  autoComplete="off"
                />
                <Button className="rounded-xl" variant="ghost" size="icon-sm" type="button" onClick={() => togglePassword(entry.id)} aria-label={t("excel.protect.toggle")}>
                  {visiblePasswords.has(entry.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              <small className="col-span-full text-xs text-muted-foreground">{t("excel.fileList.passwordHelp")}</small>
            </div>
          )}
          {entry.degradedLegacy && !entry.error && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300" data-testid="excel-file-warning"><AlertCircle className="mt-0.5 shrink-0" size={13} /> {t("excel.fileList.degradedLegacyHelp")}</p>}
          {entry.error && <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-destructive" data-testid="excel-file-error"><AlertCircle className="mt-0.5 shrink-0" size={13} /> {entry.error}</p>}
        </Card>
      ))}
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onVisibilityChange, toggleLabel }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  toggleLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground">
      <span>{label}</span>
      <div className="flex h-10 items-center rounded-xl border border-input bg-background pl-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
        {value ? <ShieldCheck className="shrink-0 text-green-700 dark:text-green-300" size={17} /> : <LockOpen className="shrink-0" size={17} />}
        <input className="min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none max-[620px]:text-base" type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
        {onVisibilityChange && <Button className="rounded-xl" variant="ghost" size="icon-sm" type="button" onClick={() => onVisibilityChange(!visible)} aria-label={toggleLabel}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button>}
      </div>
    </label>
  );
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function getInitialXlsRetention(preserveRoute: boolean, search: string) {
  if (!preserveRoute) return { formulas: false, formatting: false };
  const parameters = new URLSearchParams(search);
  if (!parameters.has("formula") && !parameters.has("format")) return { formulas: true, formatting: true };
  return {
    formulas: parameters.get("formula") === "1",
    formatting: parameters.get("format") === "1",
  };
}

function createPreserveUrl(path: string, retention: { formulas: boolean; formatting: boolean }) {
  const target = new URL(path, window.location.origin);
  target.searchParams.set("formula", retention.formulas ? "1" : "0");
  target.searchParams.set("format", retention.formatting ? "1" : "0");
  return `${target.pathname}${target.search}`;
}

function retentionForFile(fileName: string, retention: {
  xlsx: { formulas: boolean; formatting: boolean };
  xls: { formulas: boolean; formatting: boolean };
}) {
  const extension = getExtension(fileName);
  if (extension === "xlsx") return retention.xlsx;
  if (extension === "xls") return retention.xls;
  if (extension === "csv") return { formulas: false, formatting: false };
  return { formulas: true, formatting: true };
}

function resolveSelectedSheetNames(entry: ExcelFileEntry, mode: SheetSelectionMode, pattern: string) {
  if (mode === "all") return entry.sheetNames;
  if (mode === "custom") return entry.sheetNames.filter((name) => entry.selectedSheetNames.includes(name));
  return parseSheetPositions(pattern, entry.sheetNames.length).map((index) => entry.sheetNames[index]);
}

function parseSheetPositions(value: string, sheetCount: number) {
  const positions: number[] = [];
  const add = (oneBasedIndex: number) => {
    const index = oneBasedIndex - 1;
    if (index >= 0 && index < sheetCount && !positions.includes(index)) positions.push(index);
  };

  value.split(",").map((token) => token.trim()).filter(Boolean).forEach((token) => {
    if (/^\d+$/.test(token)) {
      add(Number(token));
      return;
    }
    const until = token.match(/^-(\d+)$/);
    if (until) {
      for (let index = 1; index <= Math.min(sheetCount, Number(until[1])); index += 1) add(index);
      return;
    }
    const from = token.match(/^(\d+)-$/);
    if (from) {
      for (let index = Number(from[1]); index <= sheetCount; index += 1) add(index);
      return;
    }
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Math.max(1, Math.min(sheetCount, Number(range[1])));
      const end = Math.max(1, Math.min(sheetCount, Number(range[2])));
      const direction = start <= end ? 1 : -1;
      for (let index = start; direction > 0 ? index <= end : index >= end; index += direction) add(index);
    }
  });
  return positions;
}

function createFileId() {
  fileIdSequence += 1;
  return `excel-file-${Date.now().toString(36)}-${fileIdSequence.toString(36)}`;
}

function normalizeOutputName(name: string, fallback: string) {
  const sanitized = name.trim().replace(/[\\/:*?"<>|]/g, "_") || fallback;
  return sanitized.toLowerCase().endsWith(".xlsx") ? sanitized : `${sanitized}.xlsx`;
}
