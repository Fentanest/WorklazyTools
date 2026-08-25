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
import {
  FileDropZone,
  formatBytes,
  PageHeader,
  PrimaryButton,
  ResultCard,
  SectionCard,
  SegmentedControl,
  ToggleRow,
} from "../../components/ui";
import { inspectExcelFiles, mergeExcelFiles } from "./excelWorkerClient";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { stripLanguagePrefix } from "../../i18n/languages";
import { useLocalizedPath } from "../../i18n/routing";
import { prepareOfficeAssets } from "../office-editor/officeAssetLoader";
import { launchOfficeRuntime, type OfficeRuntime } from "../office-editor/officeRuntime";
import type { ExcelInspectionResult, ExcelMergeResult, MergeMode, SheetNameRule, SheetSelectionMode } from "./types";

type InspectionState = "checking" | "ready" | "error";

interface ExcelFileEntry {
  id: string;
  file: File;
  processingFile?: File;
  preservedLegacy?: boolean;
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
  const standardPath = useLocalizedPath("/tools/excel-merger/");
  const preservePath = useLocalizedPath("/tools/excel-merger/xls-preserve/");
  const [entries, setEntries] = useState<ExcelFileEntry[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>("sheets");
  const [onlyValues, setOnlyValues] = useState(false);
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
  const formulaLabel = t(onlyValues ? "excel.valuesOnly" : "excel.keepFormulas");
  const visibleFiles = useMemo(() => entries.map((entry) => entry.file), [entries]);

  const handleFiles = (nextFiles: File[]) => {
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
      ? additions.filter((entry) => getExtension(entry.file.name) === "xls")
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
        }, controller.signal);
        operation.update(78, t("excel.xlsPreserve.status.preparing"));
        runtime = await launchOfficeRuntime(converterCanvasRef.current, assetBaseUrl);
        officeRuntimeRef.current = runtime;
      } else {
        operation.update(78, t("excel.xlsPreserve.status.reusing"));
      }

      const convertedById = new Map<string, File>();
      for (let index = 0; index < legacyAdditions.length; index += 1) {
        if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
        const entry = legacyAdditions[index];
        const progress = 80 + Math.round((index / Math.max(1, legacyAdditions.length)) * 14);
        operation.update(progress, t("excel.xlsPreserve.status.converting", { current: index + 1, total: legacyAdditions.length, name: entry.file.name }));
        const converted = await runtime.convertLegacySpreadsheet(entry.file);
        convertedById.set(entry.id, new File([converted.bytes], converted.fileName, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          lastModified: entry.file.lastModified,
        }));
      }
      if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
      const prepared = additions.map((entry) => {
        const processingFile = convertedById.get(entry.id);
        return processingFile ? { ...entry, processingFile, preservedLegacy: true } : entry;
      });
      setEntries((current) => current.map((entry) => prepared.find((item) => item.id === entry.id) ?? entry));
      operation.update(96, t("excel.xlsPreserve.status.inspecting"));
      const inspectionResults = await inspectExcelFiles(prepared.map((entry) => ({
        id: entry.id,
        file: entry.processingFile ?? entry.file,
        displayName: entry.file.name,
        preservedLegacy: entry.preservedLegacy,
        csvEncoding,
      })), language);
      const byId = new Map(inspectionResults.map((item) => [item.id, item]));
      setEntries((current) => current.map((entry) => {
        const inspectionResult = byId.get(entry.id);
        if (!inspectionResult) return entry;
        return applyInspectionResult(entry, inspectionResult);
      }));
      operation.succeed(t("excel.xlsPreserve.status.ready", { count: legacyAdditions.length }));
    } catch (reason) {
      const message = xlsPreserveError(reason, language);
      setEntries((current) => current.map((entry) => additions.some((item) => item.id === entry.id)
        ? { ...entry, inspection: "error", error: message }
        : entry));
      setError(message);
      operation.fail(message);
    } finally {
      setPrecisionPreparing(false);
      if (precisionControllerRef.current === controller) precisionControllerRef.current = undefined;
    }
  };

  const changePreserveMode = (enabled: boolean) => {
    if (enabled === preserveLegacyXls || precisionPreparing || loading) return;
    if (entries.length > 0 && !window.confirm(t("excel.xlsPreserve.switchConfirm"))) return;
    window.location.assign(enabled ? preservePath : standardPath);
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
          password: entry.password || undefined,
          selectedSheetNames,
          csvEncoding,
        })),
        {
          mergeMode,
          onlyValues,
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
    <div className="page tool-page page-enter accent-context-green">
      <PageHeader eyebrow="SPREADSHEET TOOL" title={t("excel.title")} description={t("excel.description")}>
        <div className="header-status ready"><span className="status-dot" /> {t("excel.ready")}</div>
      </PageHeader>
      <PrivacyBanner compact />

      <div className="workflow-grid">
        <div className="workflow-main">
          <SectionCard step={1} title={t("excel.steps.files.title")} description={t("excel.steps.files.description")}>
            <FileDropZone
              accept=".xlsx,.xls,.xlsb,.xlsm,.csv"
              hint={t("excel.steps.files.hint")}
              multiple
              files={visibleFiles}
              onFiles={handleFiles}
              accent="green"
            />
            <div className="inline-notice"><Info size={15} /><span>{t(preserveLegacyXls ? "excel.steps.files.preserveNotice" : "excel.steps.files.notice")}</span></div>
            {fileNotice && <div className="inline-notice warning"><AlertCircle size={15} /><span>{fileNotice}</span></div>}
            <ExcelFileList
              entries={entries}
              onRemove={removeFile}
              onMove={moveFile}
              onPasswordChange={updateInputPassword}
              onPasswordInspect={inspectProtectedFile}
              t={t}
            />
          </SectionCard>

          <SectionCard step={2} title={t("excel.steps.sheets.title")} description={t("excel.steps.sheets.description")}>
            <SegmentedControl
              label={t("excel.sheetSelection.label")}
              value={sheetSelectionMode}
              onChange={(value) => { setSheetSelectionMode(value); clearResult(); }}
              options={[
                { value: "all", label: t("excel.sheetSelection.all") },
                { value: "positions", label: t("excel.sheetSelection.positions") },
                { value: "custom", label: t("excel.sheetSelection.custom") },
              ]}
            />
            {sheetSelectionMode === "positions" && (
              <div className="sheet-position-input">
                <label htmlFor="sheet-position-pattern">{t("excel.sheetSelection.positionLabel")}</label>
                <input
                  id="sheet-position-pattern"
                  value={sheetPositionPattern}
                  onChange={(event) => { setSheetPositionPattern(event.target.value); clearResult(); }}
                  placeholder={t("excel.sheetSelection.placeholder")}
                />
                <small>{t("excel.sheetSelection.help")}</small>
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
            {entries.length > 0 && !inspecting && selectedSheetCount === 0 && <div className="inline-notice warning"><AlertCircle size={15} /><span>{t("excel.sheetSelection.required")}</span></div>}
          </SectionCard>

          <SectionCard step={3} title={t("excel.steps.mode.title")} description={t("excel.steps.mode.description")}>
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
            <div className="mode-explainer">
              <Info size={17} />
              <span>{t(`excel.modeHelp.${mergeMode}`)}</span>
            </div>
          </SectionCard>

          <SectionCard step={4} title={t("excel.steps.output.title")} description={t("excel.steps.output.description")}>
            <div className="settings-categories">
              <section className="settings-category">
                <h3>{t("excel.output.categories.cellContent")}</h3>
                <div className="settings-list">
                  <ToggleRow
                    label={t("excel.output.valuesLabel")}
                    description={t(onlyValues ? "excel.output.valuesOn" : "excel.output.valuesOff")}
                    checked={onlyValues}
                    onChange={(checked) => { setOnlyValues(checked); clearResult(); }}
                  />
                  <label className="settings-row select-row">
                    <span><strong>{t("excel.output.csvEncoding")}</strong><small>{t("excel.output.csvEncodingHelp")}</small></span>
                    <select value={csvEncoding} onChange={(event) => { setCsvEncoding(event.target.value as "auto" | "utf-8" | "euc-kr"); clearResult(); }}><option value="auto">{t("excel.output.csvAuto")}</option><option value="utf-8">UTF-8</option><option value="euc-kr">CP949 / EUC-KR</option></select>
                  </label>
                </div>
              </section>

              <section className="settings-category">
                <h3>{t("excel.output.categories.xlsInput")}</h3>
                <div className="settings-list">
                  <ToggleRow
                    label={t("excel.xlsPreserve.label")}
                    description={t(preserveLegacyXls ? "excel.xlsPreserve.onHelp" : "excel.xlsPreserve.offHelp")}
                    checked={preserveLegacyXls}
                    onChange={changePreserveMode}
                    disabled={precisionPreparing || loading}
                  />
                </div>
              </section>

              <section className="settings-category">
                <h3>{t("excel.output.categories.emptyAreas")}</h3>
                <div className="settings-list">
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
                  <label className="settings-row select-row sheet-trim-threshold">
                    <span><strong>{t("excel.output.trimThreshold")}</strong><small>{t("excel.output.trimThresholdHelp")}</small></span>
                    <span className="number-input-with-unit">
                      <input
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
                      <small>{t("excel.output.orMore")}</small>
                    </span>
                  </label>
                </div>
              </section>

              <section className="settings-category">
                <h3>{t("excel.output.categories.mergeDetails")}</h3>
                <div className="settings-list">
                  <label className="settings-row select-row">
                    <span><strong>{t("excel.output.skipHeaders")}</strong><small>{t("excel.output.skipHeadersHelp")}</small></span>
                    <span className="number-input-with-unit"><input type="number" min={0} step={1} inputMode="numeric" value={skipHeaderRows} disabled={mergeMode !== "vertical"} onChange={(event) => { setSkipHeaderRows(Math.max(0, Math.floor(Number(event.target.value) || 0))); clearResult(); }} /><small>{t("excel.output.rows")}</small></span>
                  </label>
                  <label className="settings-row select-row">
                    <span><strong>{t("excel.output.sheetNameRule")}</strong><small>{t("excel.output.sheetNameRuleHelp")}</small></span>
                    <select value={sheetNameRule} disabled={mergeMode !== "sheets"} onChange={(event) => setSheetNameRule(event.target.value as SheetNameRule)}>
                      <option value="file-sheet">{t("excel.output.fileSheet")}</option>
                      <option value="sheet-file">{t("excel.output.sheetFile")}</option>
                      <option value="sheet">{t("excel.output.originalSheet")}</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <div className="output-name-field">
              <label htmlFor="output-file-name">{t("excel.output.fileName")}</label>
              <div><FileSpreadsheet size={17} /><input id="output-file-name" value={outputName} onChange={(event) => setOutputName(event.target.value)} /></div>
            </div>
          </SectionCard>

          <SectionCard step={5} title={t("excel.steps.protect.title")} description={t("excel.steps.protect.description")}>
            <div className="settings-list">
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
              <div className="password-form output-password-form">
                <PasswordField label={t("excel.protect.password")} value={outputPassword} onChange={setOutputPassword} visible={showOutputPassword} onVisibilityChange={setShowOutputPassword} toggleLabel={t("excel.protect.toggle")} />
                <PasswordField label={t("excel.protect.confirm")} value={outputPasswordConfirm} onChange={setOutputPasswordConfirm} visible={showOutputPassword} toggleLabel={t("excel.protect.toggle")} />
                {outputPasswordConfirm && outputPasswordMismatch && <p className="field-error">{t("excel.protect.mismatch")}</p>}
                <p className="field-help"><LockKeyhole size={13} /> {t("excel.protect.warning")}</p>
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="workflow-summary">
          <div className="summary-card">
            <div className="summary-title"><SlidersHorizontal size={19} /><h2>{t("excel.summary.title")}</h2></div>
            <dl>
              <div><dt>{t("excel.summary.files")}</dt><dd>{t("excel.summary.count", { count: entries.length })}</dd></div>
              <div><dt>{t("excel.summary.sheets")}</dt><dd>{t("excel.summary.count", { count: selectedSheetCount })}</dd></div>
              <div><dt>{t("excel.summary.encryptedInputs")}</dt><dd>{t("excel.summary.count", { count: encryptedCount })}</dd></div>
              <div><dt>{t("excel.summary.mode")}</dt><dd>{mergeModeLabel}</dd></div>
              <div><dt>{t("excel.summary.cells")}</dt><dd>{formulaLabel}</dd></div>
              <div><dt>{t("excel.summary.middleEmpty")}</dt><dd>{sheetTrimRows || sheetTrimColumns ? t("excel.summary.emptyEnabled", { axes: `${sheetTrimRows ? t("excel.summary.rows") : ""}${sheetTrimRows && sheetTrimColumns ? "·" : ""}${sheetTrimColumns ? t("excel.summary.columns") : ""}`, count: sheetTrimThreshold }) : t("excel.summary.disabled")}</dd></div>
              <div><dt>{t("excel.summary.format")}</dt><dd>{t(protectOutput ? "excel.summary.protected" : "excel.summary.unprotected")}</dd></div>
            </dl>
            <PrimaryButton accent="green" disabled={!ready} loading={loading} onClick={() => void runMerge()}>
              {loading ? t("excel.summary.processing", { progress: operation.progress }) : t("excel.summary.merge")}
            </PrimaryButton>
            {loading && <button type="button" className="secondary-button" onClick={() => mergeControllerRef.current?.abort()}>{t("excel.summary.cancel")}</button>}
            {precisionPreparing && <button type="button" className="secondary-button" onClick={() => precisionControllerRef.current?.abort()}>{t("excel.xlsPreserve.cancel")}</button>}
            {!loading && inspecting && <p className="prototype-note">{t("excel.summary.inspecting")}</p>}
            {!loading && inspectionFailed && <p className="prototype-note error-text">{t("excel.summary.inspectionFailed")}</p>}
            {!loading && !result && missingInputPassword && <p className="prototype-note error-text">{t("excel.summary.inputPassword")}</p>}
            {!loading && entries.length > 0 && selectedSheetCount === 0 && <p className="prototype-note error-text">{t("excel.summary.selectSheet")}</p>}
            {!loading && !result && outputPasswordMissing && <p className="prototype-note error-text">{t("excel.summary.outputPassword")}</p>}
          </div>
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

      {error && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>{t("excel.failed")}</strong><span>{error}</span></div></div>}

      {result && (
        <ResultCard
          accent="green"
          title={t("excel.result.title")}
          message={t("excel.result.message", { fileCount: result.fileCount, sheetCount: result.sheetCount, outputCount: result.outputSheetCount, encrypted: result.encrypted ? t("excel.result.encrypted") : "" })}
        >
          <div className="result-file-actions"><a className="result-download" href={result.url} download={result.fileName}><Download size={17} /> {result.fileName}<small>{formatBytes(result.size)}</small></a><FileShareButton url={result.url} fileName={result.fileName} mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></div>
          {result.warnings.length > 0 && (
            <div className="result-warnings">{result.warnings.map((warning) => <p key={warning}><Info size={13} /> {warning}</p>)}</div>
          )}
        </ResultCard>
      )}

      <ToolGuide
        title={t("excel.guide.title")}
        description={t("excel.guide.description")}
        blocks={t("excel.guide.blocks", { returnObjects: true }) as Array<{ title: string; paragraphs: string[]; items?: string[] }>}
        faq={(t("excel.guide.faq", { returnObjects: true }) as Array<{ q: string; a: string }>).map(({ q, a }) => ({ question: q, answer: a }))}
      />
      {preserveLegacyXls && <canvas ref={converterCanvasRef} id="qtcanvas" className="excel-converter-canvas" aria-hidden="true" />}
    </div>
  );
}

function applyInspectionResult(entry: ExcelFileEntry, result: ExcelInspectionResult, preserveSelection = false): ExcelFileEntry {
  return {
    ...entry,
    inspection: result.error ? "error" : "ready",
    encrypted: result.encrypted,
    sheetNames: result.sheetNames,
    selectedSheetNames: preserveSelection && entry.sheetNames.length
      ? result.sheetNames.filter((name) => entry.selectedSheetNames.includes(name))
      : result.sheetNames,
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
  if (!entries.length) return <div className="sheet-selector-empty">{t("excel.sheetList.empty")}</div>;

  return (
    <div className="excel-sheet-selector">
      {entries.map((entry) => {
        const selectedNames = new Set(resolveSelectedSheetNames(entry, mode, pattern));
        return (
          <section className="sheet-file-group" key={entry.id}>
            <div className="sheet-file-heading">
              <span><strong>{entry.file.name}</strong><small>{entry.sheetNames.length ? t("excel.sheetList.included", { selected: selectedNames.size, total: entry.sheetNames.length }) : t("excel.sheetList.needsCheck")}</small></span>
              {mode === "custom" && entry.sheetNames.length > 0 && (
                <span className="sheet-select-actions">
                  <button type="button" onClick={() => onSetAll(entry.id, true)}>{t("excel.sheetList.all")}</button>
                  <button type="button" onClick={() => onSetAll(entry.id, false)}>{t("excel.sheetList.clear")}</button>
                </span>
              )}
            </div>
            {entry.inspection === "checking" ? (
              <div className="sheet-loading"><LoaderCircle className="spin" size={14} /> {t("excel.sheetList.loading")}</div>
            ) : entry.encrypted && !entry.sheetNames.length && !entry.error ? (
              <div className="sheet-loading"><FileLock2 size={14} /> {t("excel.sheetList.password")}</div>
            ) : entry.error ? (
              <div className="sheet-loading error-text"><AlertCircle size={14} /> {entry.error}</div>
            ) : (
              <ol className={`sheet-name-list mode-${mode}`}>
                {entry.sheetNames.map((sheetName, index) => {
                  const selected = selectedNames.has(sheetName);
                  return (
                    <li className={selected ? "selected" : ""} key={sheetName}>
                      {mode === "custom" ? (
                        <label>
                          <input type="checkbox" checked={selected} onChange={() => onToggle(entry.id, sheetName)} />
                          <b>{index + 1}</b><span>{sheetName}</span>
                        </label>
                      ) : <><b>{index + 1}</b><span>{sheetName}</span>{selected && <small>{t("excel.sheetList.include")}</small>}</>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
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
    <div className="excel-file-list">
      {entries.map((entry, index) => (
        <div className={`excel-file-item${entry.encrypted ? " encrypted" : ""}`} key={entry.id}>
          <div className="file-row">
            <span className="file-type accent-green">{entry.file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span>
            <span className="file-meta"><strong>{entry.file.name}</strong><small>{formatBytes(entry.file.size)}</small></span>
            <span className={`file-security-status ${entry.inspection}`}>
              {entry.inspection === "checking"
                ? <><LoaderCircle className="spin" size={14} /> {t("excel.fileList.checking")}</>
                : entry.encrypted
                  ? <><FileLock2 size={14} /> {t("excel.fileList.encrypted")}</>
                  : entry.inspection === "error"
                    ? <><AlertCircle size={14} /> {t("excel.fileList.needsCheck")}</>
                    : <><CheckCircle2 size={14} /> {t("excel.fileList.available")}</>}
            </span>
            <span className="file-order-actions">
              <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={t("excel.fileList.moveUp", { name: entry.file.name })}><ArrowUp size={15} /></button>
              <button type="button" onClick={() => onMove(index, 1)} disabled={index === entries.length - 1} aria-label={t("excel.fileList.moveDown", { name: entry.file.name })}><ArrowDown size={15} /></button>
            </span>
            <button className="remove-button" type="button" onClick={() => onRemove(entry.id)} aria-label={t("excel.fileList.remove", { name: entry.file.name })}><X size={17} /></button>
          </div>
          {entry.encrypted && (
            <div className="input-password-row">
              <LockKeyhole size={16} />
              <label htmlFor={`password-${entry.id}`}>{t("excel.protect.password")}</label>
              <div className="password-input compact">
                <input
                  id={`password-${entry.id}`}
                  type={visiblePasswords.has(entry.id) ? "text" : "password"}
                  value={entry.password}
                  onChange={(event) => onPasswordChange(entry.id, event.target.value)}
                  onBlur={(event) => onPasswordInspect(entry.id, event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  placeholder={t("excel.fileList.passwordPlaceholder")}
                  autoComplete="off"
                />
                <button type="button" onClick={() => togglePassword(entry.id)} aria-label={t("excel.protect.toggle")}>
                  {visiblePasswords.has(entry.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small>{t("excel.fileList.passwordHelp")}</small>
            </div>
          )}
          {entry.error && <p className="file-item-error"><AlertCircle size={13} /> {entry.error}</p>}
        </div>
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
    <label className="password-field">
      <span>{label}</span>
      <div className="password-input">
        {value ? <ShieldCheck size={17} /> : <LockOpen size={17} />}
        <input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
        {onVisibilityChange && <button type="button" onClick={() => onVisibilityChange(!visible)} aria-label={toggleLabel}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
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

function xlsPreserveError(reason: unknown, language: "ko" | "en") {
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return language === "en" ? "XLS preparation was cancelled." : "XLS 보존 준비를 취소했습니다.";
  }
  const code = reason instanceof Error ? reason.message : "";
  if (code === "isolation-required") {
    return language === "en"
      ? "This browser session cannot prepare XLS preservation. Reload this page in a current Chrome or Edge browser."
      : "현재 브라우저 환경에서 XLS 보존을 준비할 수 없습니다. 최신 Chrome 또는 Edge에서 이 페이지를 다시 열어 주세요.";
  }
  if (code === "cache-unavailable") {
    return language === "en"
      ? "Browser storage is unavailable. Allow site storage and try again."
      : "브라우저 저장 공간을 사용할 수 없습니다. 사이트 저장을 허용한 뒤 다시 시도해 주세요.";
  }
  if (code === "asset-download-failed") {
    return language === "en"
      ? "The files needed for XLS preservation could not be downloaded. Check your connection and available storage, then try again."
      : "XLS 보존에 필요한 파일을 내려받지 못했습니다. 인터넷 연결과 저장 공간을 확인한 뒤 다시 시도해 주세요.";
  }
  if (code === "office-operation-timeout") {
    return language === "en"
      ? "XLS conversion took longer than expected. Keep this tab open and try again."
      : "XLS 변환 시간이 예상보다 길어 중단했습니다. 이 탭을 유지한 채 다시 시도해 주세요.";
  }
  return language === "en"
    ? "The XLS file could not be prepared. Check that it is not damaged or password-protected, then try again."
    : "XLS 파일을 준비하지 못했습니다. 파일이 손상되지 않았는지, 암호로 보호되지 않았는지 확인한 뒤 다시 시도해 주세요.";
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
