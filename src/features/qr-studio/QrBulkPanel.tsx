import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileArchive, FileSpreadsheet, FileText, ImageDown, SquareX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, PrimaryButton, SectionCard, ToggleRow, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import type { SpreadsheetBookData } from "../spreadsheet-core/inputAdapter.ts";
import { createSafeFileName, createUniqueSafeFileName, SafeFileNameRegistry, SafeZipEntryPathRegistry, validateSafeZipEntryPath, type SafeFileName, type SafeZipEntryPath } from "../../utils/fileNameSafety.ts";
import type { IncrementalZipArchiveWriter } from "../../utils/zipArchive.ts";
import { createQrBulkRasterClient, QrBulkRasterError } from "./qrBulkClient.ts";
import { createQrBulkResultStorage, inspectQrBulkStorage, type QrBulkResultStorage } from "./qrBulkStorage.ts";
import {
  QR_BULK_LIMITS,
  buildQrPayload,
  compileQrTemplate,
  createSpreadsheetDisplayLookup,
  effectiveQrErrorCorrection,
  effectiveQrQuietZone,
  estimateQrBulkDurationMs,
  estimateQrBulkOutputBytes,
  qrBulkHeaders,
  QrBulkError,
  renderQrTemplate,
  validateQrBulkBudget,
  type CompiledQrTemplate,
  type QrErrorCorrectionLevel,
  type QrPayloadFields,
  type QrPayloadType,
  type QrWifiSecurity,
} from "./qrBulk.ts";

const ACCEPT = ".xlsx,.xlsm,.xls,.xlsb,.csv,.xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/xml,text/xml,text/csv";
const PAGE_SIZE = 50;
type LooseT = (key: string, options?: Record<string, unknown>) => string;
type MappingKey = "content" | "fileName" | "title" | "description" | "group";

interface PreparedQrRow {
  sourceRow: number;
  payload: string;
  fileName: SafeFileName;
  zipPath: SafeZipEntryPath;
  title: string;
  description: string;
}

interface QrResult extends PreparedQrRow {
  storageKey: string;
  bytes: number;
}

interface QrFailure {
  sourceRow: number;
  message: string;
}

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "grid gap-1 text-sm font-medium text-foreground";

export function QrBulkPanel() {
  const { t, i18n } = useTranslation(["features", "common"]);
  const translate = t as unknown as LooseT;
  const language = i18n.language.startsWith("en") ? "en" : "ko";
  const operation = useOperationProgress();
  const storageRef = useRef<QrBulkResultStorage | undefined>(undefined);
  const rasterRef = useRef<Awaited<ReturnType<typeof createQrBulkRasterClient>> | undefined>(undefined);
  const canceledRef = useRef(false);
  const mountedRef = useRef(false);
  const exportSequenceRef = useRef(0);
  const activeExportRef = useRef<{ token: number; controller: AbortController; kind: "zip" | "pdf" } | undefined>(undefined);
  const fontLoaderRef = useRef<ReturnType<typeof import("./qrLabelFont.ts").createQrLabelFontLoader> | undefined>(undefined);
  const [file, setFile] = useState<File>();
  const [book, setBook] = useState<SpreadsheetBookData>();
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [mappings, setMappings] = useState<Record<MappingKey, number>>({ content: 1, fileName: 0, title: 0, description: 0, group: 0 });
  const [templates, setTemplates] = useState<Record<MappingKey, string>>({ content: "", fileName: "", title: "", description: "", group: "" });
  const [payloadType, setPayloadType] = useState<QrPayloadType>("text");
  const [payloadTemplates, setPayloadTemplates] = useState({ subject: "", body: "", message: "", password: "", familyName: "", givenName: "", organization: "", phone: "", email: "", url: "" });
  const [wifiSecurity, setWifiSecurity] = useState<QrWifiSecurity>("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);
  const [size, setSize] = useState(640);
  const [quietZone, setQuietZone] = useState(4);
  const [errorCorrection, setErrorCorrection] = useState<QrErrorCorrectionLevel>("M");
  const [foreground, setForeground] = useState("#111118");
  const [background, setBackground] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [logo, setLogo] = useState<File>();
  const [pdfPreset, setPdfPreset] = useState<"a4" | "letter">("a4");
  const [results, setResults] = useState<QrResult[]>([]);
  const [failures, setFailures] = useState<QrFailure[]>([]);
  const [manifest, setManifest] = useState<Blob>();
  const [resultPage, setResultPage] = useState(0);
  const [exporting, setExporting] = useState<"zip" | "pdf" | "">("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidateExport();
      canceledRef.current = true;
      rasterRef.current?.stop();
      const storage = storageRef.current;
      storageRef.current = undefined;
      void storage?.clear();
    };
  }, []);

  const selectedSheet = book?.sheets.find((sheet) => sheet.name === sheetName);
  const headers = useMemo(() => selectedSheet ? qrBulkHeaders(selectedSheet, headerRow) : [], [selectedSheet, headerRow]);
  const rowCount = selectedSheet ? Math.max(0, selectedSheet.rowCount - headerRow) : 0;
  const selectedCells = selectedSheet ? selectedSheet.rowCount * selectedSheet.columnCount : 0;
  const estimatedBytes = estimateQrBulkOutputBytes(rowCount, size, Boolean(logo), transparent);
  const estimatedDuration = estimateQrBulkDurationMs(rowCount, size);
  const busy = operation.status === "running";
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice(resultPage * PAGE_SIZE, (resultPage + 1) * PAGE_SIZE);

  const chooseFile = async (files: File[]) => {
    const next = files.at(-1);
    await cleanupResults();
    setFile(next);
    setBook(undefined);
    setMessage("");
    if (!next) return;
    if (next.size > QR_BULK_LIMITS.inputBytes) {
      setMessage(t("features:qr.bulk.errors.inputLimit"));
      return;
    }
    setParsing(true);
    try {
      const { parseSpreadsheetInput } = await import("../spreadsheet-core/inputAdapter.ts");
      const parsed = await parseSpreadsheetInput(next.name, await next.arrayBuffer());
      const firstSheet = parsed.sheets[0];
      if (!firstSheet) throw new Error("EMPTY_BOOK");
      setBook(parsed);
      setSheetName(firstSheet.name);
      setHeaderRow(1);
      setMappings({ content: 1, fileName: 0, title: 0, description: 0, group: 0 });
    } catch (error) {
      setMessage(spreadsheetReadError(error, translate));
    } finally {
      setParsing(false);
    }
  };

  const changeSheet = (next: string) => {
    setSheetName(next);
    setHeaderRow(1);
    setMappings({ content: 1, fileName: 0, title: 0, description: 0, group: 0 });
    setMessage("");
  };

  const run = async () => {
    if (!file || !selectedSheet || busy) return;
    await cleanupResults();
    setMessage("");
    canceledRef.current = false;
    let capability;
    try {
      capability = await inspectQrBulkStorage();
      validateQrBulkBudget({
        inputBytes: file.size,
        selectedCells,
        rows: rowCount,
        estimatedOutputBytes: estimatedBytes,
        availableStorageBytes: capability.kind === "opfs" ? capability.availableBytes : undefined,
        memoryFallback: capability.kind === "memory",
      });
    } catch (error) {
      setMessage(budgetError(error, translate));
      return;
    }

    let prepared: PreparedQrRow[];
    let preflightFailures: QrFailure[];
    try {
      ({ prepared, failures: preflightFailures } = prepareRows({ selectedSheet, headerRow, headers, mappings, templates, payloadType, payloadTemplates, wifiSecurity, wifiHidden, language, translate }));
    } catch (error) {
      setMessage(templateError(error, translate));
      return;
    }
    if (!prepared.length) {
      setFailures(preflightFailures);
      setManifest(await createManifest([], preflightFailures, payloadType, translate));
      setMessage(t("features:qr.bulk.errors.noRows"));
      return;
    }

    let storage: QrBulkResultStorage;
    try {
      storage = await createQrBulkResultStorage(capability.kind);
    } catch {
      try {
        validateQrBulkBudget({ inputBytes: file.size, selectedCells, rows: rowCount, estimatedOutputBytes: estimatedBytes, memoryFallback: true });
        storage = await createQrBulkResultStorage("memory");
        capability = { kind: "memory" };
      } catch (error) {
        setMessage(budgetError(error, translate));
        return;
      }
    }
    storageRef.current = storage;
    if (capability.kind === "memory") setMessage(t("features:qr.bulk.memoryFallback"));
    const completed: QrResult[] = [];
    const failed = [...preflightFailures];
    setFailures(failed);
    operation.start(t("features:qr.bulk.progress.start", { count: prepared.length }));
    try {
      const raster = await createQrBulkRasterClient({
        size,
        quietZone: effectiveQrQuietZone(quietZone, Boolean(logo)),
        errorCorrection: effectiveQrErrorCorrection(errorCorrection, Boolean(logo)),
        foreground,
        background,
        transparent,
      }, logo);
      rasterRef.current = raster;
      for (let index = 0; index < prepared.length; index += 1) {
        if (canceledRef.current) throw new DOMException("Aborted", "AbortError");
        const row = prepared[index];
        try {
          const blob = await raster.generate(row.payload);
          await storage.write(row.fileName, blob);
          completed.push({ ...row, storageKey: row.fileName, bytes: blob.size });
          setResults([...completed]);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          failed.push({ sourceRow: row.sourceRow, message: rasterError(error, translate) });
          setFailures([...failed]);
        }
        operation.updateCurrent(Math.max(2, Math.round(((index + 1) / prepared.length) * 96)), t("features:qr.bulk.progress.row", { current: index + 1, total: prepared.length }));
      }
      setManifest(await createManifest(completed, failed, payloadType, translate));
      operation.succeed(t("features:qr.bulk.progress.complete", { success: completed.length, failed: failed.length }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        invalidateExport();
        setExporting("");
        storageRef.current = undefined;
        await storage.clear();
        setResults([]);
        setFailures([]);
        setManifest(undefined);
        operation.fail(t("features:qr.bulk.progress.canceled"));
      } else {
        invalidateExport();
        setExporting("");
        storageRef.current = undefined;
        await storage.clear();
        setResults([]);
        setManifest(undefined);
        operation.fail(rasterError(error, translate));
      }
    } finally {
      rasterRef.current?.stop();
      rasterRef.current = undefined;
    }
  };

  const cancel = () => {
    invalidateExport();
    setExporting("");
    canceledRef.current = true;
    rasterRef.current?.stop();
  };

  const downloadResult = async (result: QrResult) => {
    const blob = await storageRef.current?.read(result.storageKey);
    if (blob) downloadBlob(blob, result.fileName);
  };

  // ZIP and PDF share the same exporting state, so both hold the same lease.
  const downloadZip = async () => {
    const storage = storageRef.current;
    if (!storage || !results.length || exporting || activeExportRef.current) return;
    const currentResults = [...results];
    const active = beginExport("zip");
    let writer: IncrementalZipArchiveWriter | undefined;
    try {
      const [{ BlobWriter }, { createIncrementalZipArchiveWriter }] = await Promise.all([
        import("@zip.js/zip.js"), import("../../utils/zipArchive.ts"),
      ]);
      assertExport(active);
      const output = new BlobWriter("application/zip");
      writer = createIncrementalZipArchiveWriter(output);
      for (const result of currentResults) {
        const blob = await storage.read(result.storageKey);
        assertExport(active);
        await writer.add(result.zipPath, blob);
        assertExport(active);
      }
      await writer.close();
      assertExport(active);
      const blob = await output.getData();
      assertExport(active);
      downloadBlob(blob, "worklazy-qr-bulk.zip");
    } catch (error) {
      await writer?.discard().catch(() => undefined);
      if (isCurrentExport(active) && !isAbort(error)) setMessage(t("features:qr.bulk.errors.zip"));
    } finally {
      finishExport(active);
    }
  };

  const downloadPdf = async () => {
    const storage = storageRef.current;
    if (!storage || !results.length || exporting || activeExportRef.current) return;
    if (results.length > QR_BULK_LIMITS.pdfRows) {
      setMessage(t("features:qr.bulk.errors.pdfLimit"));
      return;
    }
    const currentResults = [...results];
    const preset = pdfPreset;
    const active = beginExport("pdf");
    const signal = active.controller.signal;
    try {
      // Promise.all attaches rejection handlers to all three branches immediately.
      // Only the font loader's acquire() performs acquisition fallback.
      const fontTask = import("./qrLabelFont.ts").then(async (module) => {
        assertExport(active);
        const loader = fontLoaderRef.current
          ?? module.createQrLabelFontLoader(import.meta.env.BASE_URL, window.location.origin);
        fontLoaderRef.current = loader;
        const kind = await module.selectQrLabelFont(currentResults, signal);
        assertExport(active);
        const selected = await loader.acquire(kind, signal);
        assertExport(active);
        return { loader, selected, QrLabelFontInitError: module.QrLabelFontInitError };
      });
      const entriesTask = (async () => {
        const entries = [];
        for (const result of currentResults) {
          const png = await storage.read(result.storageKey);
          assertExport(active);
          entries.push({ png, title: result.title, description: result.description });
        }
        return entries;
      })();
      const [{ loader, selected, QrLabelFontInitError }, { createQrLabelPdf }, entries] = await Promise.all([
        fontTask, import("./qrLabelPdf.ts"), entriesTask,
      ]);
      assertExport(active);
      let blob: Blob;
      try {
        blob = await createQrLabelPdf(entries, preset, selected.bytes, signal);
        assertExport(active);
      } catch (error) {
        assertExport(active);
        if (selected.kind !== "subset" || !(error instanceof QrLabelFontInitError)) throw error;
        loader.evict("subset");
        const full = await loader.load("full", signal);
        assertExport(active);
        blob = await createQrLabelPdf(entries, preset, full.bytes, signal);
        assertExport(active);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assertExport(active);
      downloadBlob(blob, `worklazy-qr-labels-${preset}.pdf`);
    } catch (error) {
      if (isCurrentExport(active) && !isAbort(error)) setMessage(t("features:qr.bulk.errors.pdf"));
    } finally {
      finishExport(active);
    }
  };

  function beginExport(kind: "zip" | "pdf") {
    const active = { token: ++exportSequenceRef.current, controller: new AbortController(), kind };
    activeExportRef.current = active;
    setExporting(kind);
    return active;
  }

  function isCurrentExport(active: NonNullable<typeof activeExportRef.current>) {
    return mountedRef.current
      && activeExportRef.current?.token === active.token
      && !active.controller.signal.aborted;
  }

  function assertExport(active: NonNullable<typeof activeExportRef.current>) {
    if (!isCurrentExport(active)) throw new DOMException("Aborted", "AbortError");
  }

  function isAbort(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
  }

  function finishExport(active: NonNullable<typeof activeExportRef.current>) {
    const owned = activeExportRef.current?.token === active.token;
    active.controller.abort();
    if (!owned) return;
    activeExportRef.current = undefined;
    if (mountedRef.current) setExporting("");
  }

  function invalidateExport() {
    activeExportRef.current?.controller.abort();
    activeExportRef.current = undefined;
    ++exportSequenceRef.current;
    fontLoaderRef.current?.dispose();
    fontLoaderRef.current = undefined;
  }

  return <div data-testid="qr-bulk-page" className="grid gap-6">
    <SectionCard step={1} title={t("features:qr.bulk.file.title")} description={t("features:qr.bulk.file.description")}>
      <FileDropZone hint={t("features:qr.bulk.file.hint")} accept={ACCEPT} files={file ? [file] : []} onFiles={chooseFile} accent="blue" disabled={busy || parsing} />
      {parsing && <p className="mt-3 text-sm text-muted-foreground" role="status">{t("features:qr.bulk.file.reading")}</p>}
      {book && <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}><span>{t("features:qr.bulk.file.sheet")}</span><select className={fieldClass} value={sheetName} onChange={(event) => changeSheet(event.target.value)}>{book.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</select></label>
        <label className={labelClass}><span>{t("features:qr.bulk.file.headerRow")}</span><input className={fieldClass} type="number" min={1} max={Math.max(1, selectedSheet?.rowCount ?? 1)} value={headerRow} onChange={(event) => setHeaderRow(Math.max(1, Number(event.target.value) || 1))} /></label>
        <p className="sm:col-span-2 text-sm text-muted-foreground">{t("features:qr.bulk.file.summary", { rows: rowCount, columns: selectedSheet?.columnCount ?? 0, cells: selectedCells.toLocaleString(language) })}</p>
      </div>}
    </SectionCard>

    {selectedSheet && <>
      <SectionCard step={2} title={t("features:qr.bulk.mapping.title")} description={t("features:qr.bulk.mapping.description", { Header: "{{Header}}" })}>
        <div className="grid gap-4 lg:grid-cols-2">{(["content", "fileName", "title", "description", "group"] as const).map((key) => <div className="rounded-2xl border border-border bg-muted/30 p-4" key={key}>
          <label className={labelClass}><span>{t(`features:qr.bulk.mapping.${key}`)}</span><select className={fieldClass} value={mappings[key]} onChange={(event) => setMappings((current) => ({ ...current, [key]: Number(event.target.value) }))}>
            {key !== "content" && <option value={0}>{t("features:qr.bulk.mapping.unused")}</option>}
            {headers.map((header) => <option key={header.column} value={header.column}>{columnName(header.column)} · {header.name}</option>)}
          </select></label>
          <label className={`${labelClass} mt-3`}><span>{t("features:qr.bulk.mapping.template")}</span><input data-testid={`qr-mapping-${key}-template`} className={fieldClass} value={templates[key]} onChange={(event) => setTemplates((current) => ({ ...current, [key]: event.target.value }))} placeholder={key === "fileName" ? "{{Name}}-{{ID}}" : "{{Header}}"} /></label>
        </div>)}</div>
      </SectionCard>

      <SectionCard step={3} title={t("features:qr.bulk.payload.title")} description={t("features:qr.bulk.payload.description")}>
        <label className={labelClass}><span>{t("features:qr.bulk.payload.type")}</span><select data-testid="qr-payload-type" className={fieldClass} value={payloadType} onChange={(event) => setPayloadType(event.target.value as QrPayloadType)}>{(["text", "email", "tel", "sms", "wifi", "vcard", "url"] as const).map((type) => <option key={type} value={type}>{t(`features:qr.bulk.payload.types.${type}`)}</option>)}</select></label>
        <PayloadFields type={payloadType} values={payloadTemplates} setValues={setPayloadTemplates} wifiSecurity={wifiSecurity} setWifiSecurity={setWifiSecurity} wifiHidden={wifiHidden} setWifiHidden={setWifiHidden} t={translate} />
      </SectionCard>

      <SectionCard step={4} title={t("features:qr.bulk.design.title")} description={t("features:qr.bulk.design.description")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}><span>{t("features:qr.bulk.design.size")}</span><select className={fieldClass} value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={320}>320px</option><option value={640}>640px</option><option value={1024}>1024px</option></select></label>
          <label className={labelClass}><span>{t("features:qr.bulk.design.quietZone")}</span><input className={fieldClass} type="number" min={0} max={8} value={quietZone} onChange={(event) => setQuietZone(Math.max(0, Math.min(8, Number(event.target.value) || 0)))} /></label>
          <label className={labelClass}><span>{t("features:qr.bulk.design.errorCorrection")}</span><select className={fieldClass} value={logo ? "H" : errorCorrection} disabled={Boolean(logo)} onChange={(event) => setErrorCorrection(event.target.value as QrErrorCorrectionLevel)}>{(["L", "M", "Q", "H"] as const).map((level) => <option key={level}>{level}</option>)}</select></label>
          <label className={labelClass}><span>{t("features:qr.bulk.design.logo")}</span><input data-testid="qr-bulk-logo" className={`${fieldClass} file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0])} /></label>
          <label className={labelClass}><span>{t("features:qr.bulk.design.foreground")}</span><input className={`${fieldClass} p-1`} type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></label>
          <label className={labelClass}><span>{t("features:qr.bulk.design.background")}</span><input className={`${fieldClass} p-1`} type="color" value={background} disabled={transparent} onChange={(event) => setBackground(event.target.value)} /></label>
          <div data-testid="qr-bulk-transparent" className="sm:col-span-2"><ToggleRow label={t("features:qr.bulk.design.transparent")} description={t("features:qr.bulk.design.transparentHelp")} checked={transparent} onChange={setTransparent} /></div>
        </div>
        {logo && <p className="mt-3 text-sm text-muted-foreground">{t("features:qr.bulk.design.logoForced", { quietZone: effectiveQrQuietZone(quietZone, true) })}</p>}
      </SectionCard>

      <SectionCard step={5} title={t("features:qr.bulk.run.title")} description={t("features:qr.bulk.run.description")}>
        <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-3">
          <Metric label={t("features:qr.bulk.run.rows")} value={rowCount.toLocaleString(language)} />
          <Metric label={t("features:qr.bulk.run.estimatedSize")} value={formatBytes(estimatedBytes)} />
          <Metric label={t("features:qr.bulk.run.estimatedTime")} value={formatDuration(estimatedDuration, language)} />
        </div>
        {estimatedBytes > QR_BULK_LIMITS.softOutputBytes && estimatedBytes <= QR_BULK_LIMITS.hardOutputBytes && <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status"><AlertTriangle className="shrink-0" size={18} />{t("features:qr.bulk.softWarning", { size: formatBytes(estimatedBytes) })}</p>}
        {rowCount > 1_000 && <p className="mt-3 text-sm text-muted-foreground">{t("features:qr.bulk.longRun", { time: formatDuration(estimatedDuration, language) })}</p>}
        {message && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{message}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <div data-testid="qr-bulk-generate"><PrimaryButton accent="blue" loading={busy} disabled={!rowCount || selectedCells > QR_BULK_LIMITS.selectedCells || busy} onClick={() => void run()}>{t("features:qr.bulk.run.generate")}</PrimaryButton></div>
          {busy && <Button type="button" variant="outline" className="min-h-11" onClick={cancel}><SquareX size={17} />{t("features:qr.bulk.run.cancel")}</Button>}
        </div>
      </SectionCard>
    </>}

    <OperationProgress {...operation} accent="blue" title={t("features:qr.bulk.progress.title")} />

    {(results.length > 0 || failures.length > 0) && <div data-testid="qr-bulk-results"><SectionCard title={t("features:qr.bulk.results.title")} description={t("features:qr.bulk.results.summary", { success: results.length, failed: failures.length })}>
      <div className="flex flex-wrap gap-3">
        {results.length > 1 && <Button type="button" variant="outline" className="min-h-11" disabled={Boolean(exporting)} onClick={() => void downloadZip()}><FileArchive size={17} />{exporting === "zip" ? t("features:qr.bulk.results.preparing") : t("features:qr.bulk.results.zip")}</Button>}
        <label className={`${labelClass} min-w-36`}><span className="sr-only">{t("features:qr.bulk.results.pdfPreset")}</span><select className={fieldClass} value={pdfPreset} onChange={(event) => setPdfPreset(event.target.value as "a4" | "letter")}><option value="a4">A4</option><option value="letter">Letter</option></select></label>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy || !results.length || Boolean(exporting) || results.length > QR_BULK_LIMITS.pdfRows} onClick={() => void downloadPdf()}><FileText size={17} />{exporting === "pdf" ? t("features:qr.bulk.results.preparing") : t("features:qr.bulk.results.pdf")}</Button>
        {manifest && <Button type="button" variant="outline" className="min-h-11" onClick={() => downloadBlob(manifest, "worklazy-qr-manifest.xlsx")}><FileSpreadsheet size={17} />{t("features:qr.bulk.results.manifest")}</Button>}
      </div>
      {results.length > 0 && <div className="mt-5 grid gap-2" role="list">{visibleResults.map((result) => <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3" role="listitem" key={`${result.sourceRow}:${result.fileName}`}>
        <ImageDown className="shrink-0 text-blue-700" size={18} /><div className="min-w-0 flex-1"><strong className="block truncate">{result.fileName}</strong><small className="text-muted-foreground">{t("features:qr.bulk.results.row", { row: result.sourceRow, size: formatBytes(result.bytes) })}</small></div>
        <Button type="button" variant="outline" size="sm" onClick={() => void downloadResult(result)}><Download size={15} />{t("features:qr.bulk.results.download")}</Button>
      </div>)}</div>}
      {results.length > PAGE_SIZE && <div className="mt-4 flex items-center justify-center gap-3"><Button type="button" variant="outline" size="icon" aria-label={t("features:qr.bulk.results.previous")} disabled={resultPage === 0} onClick={() => setResultPage((page) => Math.max(0, page - 1))}><ChevronLeft /></Button><span className="text-sm text-muted-foreground">{resultPage + 1} / {pageCount}</span><Button type="button" variant="outline" size="icon" aria-label={t("features:qr.bulk.results.next")} disabled={resultPage >= pageCount - 1} onClick={() => setResultPage((page) => Math.min(pageCount - 1, page + 1))}><ChevronRight /></Button></div>}
      {failures.length > 0 && <details className="mt-5 rounded-xl border border-destructive/30 p-4"><summary className="cursor-pointer font-medium text-destructive">{t("features:qr.bulk.results.failures", { count: failures.length })}</summary><ul className="mt-3 grid gap-2 text-sm">{failures.slice(0, 100).map((failure, index) => <li key={`${failure.sourceRow}:${index}`}>{t("features:qr.bulk.results.failureRow", { row: failure.sourceRow, message: failure.message })}</li>)}</ul></details>}
    </SectionCard></div>}
  </div>;

  async function cleanupResults() {
    invalidateExport();
    setExporting("");
    canceledRef.current = true;
    rasterRef.current?.stop();
    rasterRef.current = undefined;
    const storage = storageRef.current;
    storageRef.current = undefined;
    setResults([]);
    setFailures([]);
    setManifest(undefined);
    setResultPage(0);
    operation.reset();
    await storage?.clear();
  }
}

function PayloadFields({ type, values, setValues, wifiSecurity, setWifiSecurity, wifiHidden, setWifiHidden, t }: {
  type: QrPayloadType;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<{ subject: string; body: string; message: string; password: string; familyName: string; givenName: string; organization: string; phone: string; email: string; url: string }>>;
  wifiSecurity: QrWifiSecurity;
  setWifiSecurity: (value: QrWifiSecurity) => void;
  wifiHidden: boolean;
  setWifiHidden: (value: boolean) => void;
  t: LooseT;
}) {
  const keys = type === "email" ? ["subject", "body"] : type === "sms" ? ["message"] : type === "wifi" ? ["password"] : type === "vcard" ? ["familyName", "givenName", "organization", "phone", "email", "url"] : [];
  if (!keys.length && type !== "wifi") return <p className="mt-3 text-sm text-muted-foreground">{t("features:qr.bulk.payload.primaryHelp")}</p>;
  return <div className="mt-4 grid gap-4 sm:grid-cols-2">
    {type === "wifi" && <label className={labelClass}><span>{t("features:qr.bulk.payload.security")}</span><select className={fieldClass} value={wifiSecurity} onChange={(event) => setWifiSecurity(event.target.value as QrWifiSecurity)}><option>WPA</option><option>WEP</option><option>nopass</option></select></label>}
    {keys.map((key) => <label className={labelClass} key={key}><span>{t(`features:qr.bulk.payload.${key}`)}</span><input data-testid={`qr-payload-${key}`} className={fieldClass} value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder="{{Header}}" /></label>)}
    {type === "wifi" && <div className="sm:col-span-2"><ToggleRow label={t("features:qr.bulk.payload.hidden")} checked={wifiHidden} onChange={setWifiHidden} /></div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><small className="text-muted-foreground">{label}</small><strong className="mt-1 block text-lg">{value}</strong></div>;
}

function prepareRows(input: {
  selectedSheet: NonNullable<SpreadsheetBookData["sheets"][number]>;
  headerRow: number;
  headers: Array<{ column: number; name: string }>;
  mappings: Record<MappingKey, number>;
  templates: Record<MappingKey, string>;
  payloadType: QrPayloadType;
  payloadTemplates: Record<string, string>;
  wifiSecurity: QrWifiSecurity;
  wifiHidden: boolean;
  language: "ko" | "en";
  translate: LooseT;
}) {
  const compiled = Object.fromEntries(Object.entries(input.templates).map(([key, value]) => [key, value ? compileQrTemplate(value, input.headers) : undefined])) as Record<MappingKey, CompiledQrTemplate | undefined>;
  const compiledPayload = Object.fromEntries(Object.entries(input.payloadTemplates).map(([key, value]) => [key, value ? compileQrTemplate(value, input.headers) : undefined])) as Record<string, CompiledQrTemplate | undefined>;
  const lookup = createSpreadsheetDisplayLookup(input.selectedSheet);
  const names = new SafeFileNameRegistry();
  const paths = new SafeZipEntryPathRegistry();
  const prepared: PreparedQrRow[] = [];
  const failures: QrFailure[] = [];
  for (let sourceRow = input.headerRow + 1; sourceRow <= input.selectedSheet.rowCount; sourceRow += 1) {
    const valueForColumn = (column: number) => lookup(sourceRow, column);
    const resolve = (key: MappingKey) => compiled[key] ? renderQrTemplate(compiled[key]!, valueForColumn) : input.mappings[key] ? valueForColumn(input.mappings[key]) : "";
    const payloadValue = resolve("content");
    const payloadField = (key: string) => compiledPayload[key] ? renderQrTemplate(compiledPayload[key]!, valueForColumn) : input.payloadTemplates[key] ?? "";
    try {
      const fields: QrPayloadFields = payloadFields(input.payloadType, payloadValue, payloadField, input.wifiSecurity, input.wifiHidden);
      const payload = buildQrPayload(input.payloadType, fields);
      const rawFileName = resolve("fileName");
      const withExtension = rawFileName ? (/\.png$/iu.test(rawFileName) ? rawFileName : `${rawFileName}.png`) : `qr-row-${sourceRow}.png`;
      const fileName = createUniqueSafeFileName(withExtension, names, `qr-row-${sourceRow}.png`);
      const rawGroup = resolve("group");
      const group = rawGroup ? createSafeFileName(rawGroup, `group-${sourceRow}`) : undefined;
      const zipPath = paths.add(validateSafeZipEntryPath(group ? `${group}/${fileName}` : fileName));
      prepared.push({ sourceRow, payload, fileName, zipPath, title: resolve("title"), description: resolve("description") });
    } catch (error) {
      failures.push({ sourceRow, message: rowError(error, input.translate) });
    }
  }
  return { prepared, failures };
}

function payloadFields(type: QrPayloadType, value: string, field: (key: string) => string, security: QrWifiSecurity, hidden: boolean): QrPayloadFields {
  if (type === "email") return { address: value, subject: field("subject"), body: field("body") };
  if (type === "tel") return { number: value };
  if (type === "sms") return { number: value, message: field("message") };
  if (type === "wifi") return { ssid: value, password: field("password"), security, hidden };
  if (type === "vcard") return { formattedName: value, familyName: field("familyName"), givenName: field("givenName"), organization: field("organization"), phone: field("phone"), email: field("email"), url: field("url") };
  return { value };
}

async function createManifest(results: QrResult[], failures: QrFailure[], type: QrPayloadType, t: LooseT) {
  const { writeXlsxReport } = await import("../../utils/xlsxReport.ts");
  const buffer = await writeXlsxReport({ creator: "Worklazy QR Bulk", sheets: [
    { name: t("features:qr.bulk.manifest.success"), headers: ["sourceRow", "fileName", "zipPath", "payloadType", "payload", "bytes", "status"], rows: results.map((result) => [result.sourceRow, result.fileName, result.zipPath, type, result.payload, result.bytes, "success"]) },
    { name: t("features:qr.bulk.manifest.failures"), headers: ["sourceRow", "error", "status"], rows: failures.map((failure) => [failure.sourceRow, failure.message, "failed"]) },
  ] });
  return new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function budgetError(error: unknown, t: LooseT) {
  if (!(error instanceof QrBulkError)) return t("features:qr.bulk.errors.prepare");
  const keys: Record<string, string> = { INPUT_LIMIT: "inputLimit", CELL_LIMIT: "cellLimit", ROW_LIMIT: "rowLimit", PDF_ROW_LIMIT: "pdfLimit", OUTPUT_LIMIT: "outputLimit", STORAGE_LIMIT: "storageLimit" };
  return t(`features:qr.bulk.errors.${keys[error.code] ?? "prepare"}`);
}

function spreadsheetReadError(error: unknown, t: LooseT) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const keys: Record<string, string> = {
    UNSUPPORTED_FORMAT: "unsupported",
    ENCRYPTED_FILE: "encrypted",
    DAMAGED_FILE: "damaged",
    CSV_PARSE_ERROR: "csv",
  };
  return t(`features:qr.bulkReadErrors.${keys[code] ?? "read"}`);
}

function templateError(error: unknown, t: LooseT) {
  if (error instanceof QrBulkError && error.code === "MISSING_HEADER") return t("features:qr.bulk.errors.missingHeader", { name: error.detail });
  if (error instanceof QrBulkError && error.code === "DUPLICATE_HEADER") return t("features:qr.bulk.errors.duplicateHeader", { name: error.detail });
  return t("features:qr.bulk.errors.template");
}

function rowError(error: unknown, t: LooseT) {
  if (error instanceof QrBulkError && error.code === "EMPTY_VALUE") return t("features:qr.bulk.errors.emptyValue");
  if (error instanceof QrBulkError && error.code === "INVALID_URL") return t("features:qr.bulk.errors.invalidUrl");
  if (error instanceof QrBulkError && error.code === "INVALID_EMAIL") return t("features:qr.bulk.errors.invalidEmail");
  return t("features:qr.bulk.errors.row");
}

function rasterError(error: unknown, t: LooseT) {
  if (error instanceof QrBulkRasterError && error.code === "RESCAN") return t("features:qr.bulk.errors.rescan");
  if (error instanceof QrBulkRasterError && error.code === "LOGO") return t("features:qr.bulk.errors.logo");
  return t("features:qr.bulk.errors.generate");
}

function columnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26); }
  return result;
}

function formatDuration(milliseconds: number, language: string) {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1_000));
  if (seconds < 60) return language === "ko" ? `약 ${seconds}초` : `about ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return language === "ko" ? `약 ${minutes}분` : `about ${minutes} min`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
