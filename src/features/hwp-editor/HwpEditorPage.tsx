import { FileInput } from "../../components/FileDropProvider";
import { Download, FileCheck2, FileText, FolderOpen, RefreshCw, X } from "lucide-react";
import { createEditor, type HmlSaveState, type RhwpEditor } from "@rhwp/editor";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TranslationResources } from "../../i18n/resources";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { FileDropZone, FileList, PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { UtilityPage } from "../../components/UtilitySurface";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { getRhwpStudioUrl } from "../../config/rhwp";
import { cn } from "../../lib/utils";
import { useFocusMode } from "../../components/AppShell";

type ExportFormat = "hwp" | "hwpx" | "hml";
type ProgressMessageKey = `hwpEditor.${keyof TranslationResources["features"]["hwpEditor"]}`;
type ProgressTranslate = (key: ProgressMessageKey, options?: Record<string, string | number>) => string;

export function HwpEditorPage() {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [editorReady, setEditorReady] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [hmlSaveState, setHmlSaveState] = useState<HmlSaveState>();
  const [exporting, setExporting] = useState<ExportFormat>();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RhwpEditor | undefined>(undefined);
  const editorPromiseRef = useRef<Promise<RhwpEditor> | undefined>(undefined);
  const progress = useOperationProgress();
  const file = files[0];
  // Retain translation inputs for the current operation when the locale changes.
  const progressCopyRef = useRef(new Map<string, { key: ProgressMessageKey; options?: Record<string, string | number> }>());
  const progressT: ProgressTranslate = (key, options) => {
    const message = i18n.t(key, { ...options, ns: "features" });
    progressCopyRef.current.set(message, { key, options });
    return message;
  };
  const localizeProgress = (message: string) => {
    const copy = progressCopyRef.current.get(message);
    if (!copy) return message;
    const options = copy.key === "hwpEditor.downloadStarted"
      ? { ...copy.options, verification: copy.options?.verification ? t("hwpEditor.verified") : "" }
      : copy.options;
    return t(copy.key, options);
  };
  // Locale changes update labels without destroying the open document.
  const initializationRef = useRef({ t, i18n, progress, progressT });
  initializationRef.current = { t, i18n, progress, progressT };

  const setFocusMode = useFocusMode();
  useEffect(() => {
    setFocusMode(documentOpen ? "editor" : "standard");
    return () => setFocusMode("standard");
  }, [documentOpen, setFocusMode]);

  useEffect(() => {
    let disposed = false;
    const initialize = async () => {
      if (!containerRef.current) throw new Error(initializationRef.current.t("hwpEditor.missingContainer"));
      progressCopyRef.current.clear();
      initializationRef.current.progress.start(initializationRef.current.progressT("hwpEditor.preparing"));
      const editor = await createEditor(containerRef.current, {
        studioUrl: getRhwpStudioUrl(),
        renderer: "canvas2d",
        width: "100%",
        height: "100%",
        requestTimeoutMs: 120_000,
        handshakeTimeoutMs: 4_000,
      });
      if (disposed) {
        editor.destroy();
        throw new DOMException(initializationRef.current.t("hwpEditor.closed"), "AbortError");
      }
      editor.element.title = initializationRef.current.t("hwpEditor.frameTitle");
      editorRef.current = editor;
      setEditorReady(true);
      initializationRef.current.progress.succeed(initializationRef.current.progressT("hwpEditor.ready"));
      return editor;
    };

    editorPromiseRef.current = initialize();
    editorPromiseRef.current.catch((error) => {
      if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
        initializationRef.current.progress.fail(normalizeEditorError(error, initializationRef.current.progressT, initializationRef.current.i18n.resolvedLanguage === "en"));
      }
    });

    return () => {
      disposed = true;
      editorRef.current?.destroy();
      editorRef.current = undefined;
      editorPromiseRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (editorRef.current) editorRef.current.element.title = t("hwpEditor.frameTitle");
  }, [t]);

  const getEditor = async () => {
    const editor = editorRef.current ?? await editorPromiseRef.current;
    if (!editor) throw new Error(progressT("hwpEditor.notReady"));
    return editor;
  };

  const openDocument = async (nextFile: File) => {
    progressCopyRef.current.clear();
    progress.start(progressT("hwpEditor.opening", { name: nextFile.name }));
    try {
      const editor = await getEditor();
      const result = await editor.loadFile(await nextFile.arrayBuffer(), nextFile.name, {
        skipUnsavedGuard: false,
        suppressDialogs: false,
      });
      setPageCount(result.pageCount);
      setDocumentOpen(true);
      setDocumentName(nextFile.name);
      try {
        setHmlSaveState(await editor.getHmlSaveState());
      } catch {
        setHmlSaveState(undefined);
      }
      progress.succeed(progressT("hwpEditor.opened", { count: result.pageCount }));
    } catch (error) {
      progress.fail(normalizeEditorError(error, progressT, i18n.resolvedLanguage === "en"));
    }
  };

  const selectFiles = (next: File[]) => {
    const selected = next.slice(-1);
    setFiles(selected);
    const nextFile = selected[0];
    if (nextFile) void openDocument(nextFile);
  };

  const exportDocument = async (format: ExportFormat) => {
    if (!documentOpen || exporting) return;
    setExporting(format);
    progressCopyRef.current.clear();
    progress.start(progressT("hwpEditor.exporting", { format: format.toUpperCase() }));
    try {
      const editor = await getEditor();
      if (format === "hml") {
        const state = await editor.getHmlSaveState();
        setHmlSaveState(state);
        if (!state.hmlSavable) {
          const reasons = state.blockers.map((item) => item.message).filter(Boolean).slice(0, 3).join(" · ");
          throw new Error(reasons || progressT("hwpEditor.hmlUnavailable"));
        }
      }

      let verificationMessage = "";
      if (format === "hwp") {
        const verification = await editor.exportHwpVerify();
        if (!verification.recovered || verification.pageCountBefore !== verification.pageCountAfter) {
          throw new Error(progressT("hwpEditor.verificationFailed"));
        }
        verificationMessage = t("hwpEditor.verified");
      }

      const bytes = format === "hwp"
        ? await editor.exportHwp()
        : format === "hwpx"
          ? await editor.exportHwpx()
          : await editor.exportHml();
      const outputName = `${stripExtension(documentName || "worklazy-document")}-${t("hwpEditor.editedSuffix")}.${format}`;
      downloadBlob(new Blob([copyArrayBuffer(bytes)], { type: mimeTypeFor(format) }), outputName);
      try {
        await editor.notifySaved(outputName);
      } catch {
        // 구버전 Studio는 저장 완료 통지를 지원하지 않을 수 있다. 다운로드 결과는 유효하다.
      }
      progress.succeed(progressT("hwpEditor.downloadStarted", { name: outputName, verification: verificationMessage }));
    } catch (error) {
      progress.fail(normalizeEditorError(error, progressT, i18n.resolvedLanguage === "en"));
    } finally {
      setExporting(undefined);
    }
  };

  const progressToneClass = progress.status === "error"
    ? "text-destructive"
    : progress.status === "running"
      ? "text-orange-600 dark:text-orange-300"
      : undefined;

  return (
    <UtilityPage
      toolId="hwp-editor"
      flush={documentOpen}
      className={documentOpen ? "relative z-20 m-0 flex h-dvh w-full max-w-none flex-col overflow-hidden bg-background p-2 [animation:none] max-[820px]:p-0" : undefined}
    >
      {!documentOpen && <>
        <PageHeader eyebrow="HWP EDITOR" title={t("hwpEditor.title")} description={t("hwpEditor.description")}>
          <PrivacyBanner compact />
        </PageHeader>

        <SectionCard step={1} title={t("hwpEditor.openTitle")} description={t("hwpEditor.openDescription")}>
          <FileDropZone files={files} onFiles={selectFiles} accept=".hwp,.hwpx,.hml,application/x-hwp,application/xml,text/xml" hint={t("hwpEditor.dropHint")} accent="orange" />
          <FileList files={files} onRemove={() => setFiles([])} accent="orange" />
          {file && editorReady && (
            <div className="mt-[11px] flex flex-wrap items-center gap-2 max-[620px]:[&>*]:w-full">
              <PrimaryButton accent="orange" loading={progress.status === "running"} onClick={() => void openDocument(file)}><RefreshCw size={18} /> {t("hwpEditor.reopen")}</PrimaryButton>
            </div>
          )}
        </SectionCard>

        <OperationProgress {...progress} message={localizeProgress(progress.message)} logs={progress.logs.map((entry) => ({ ...entry, message: localizeProgress(entry.message) }))} accent="blue" title={t("hwpEditor.logTitle")} />
      </>}

      <SectionCard step={2} title={t("hwpEditor.editorTitle")} description={documentOpen ? t("hwpEditor.documentSummary", { name: documentName || t("hwpEditor.document"), count: pageCount }) : t("hwpEditor.editorHint")} className={documentOpen ? "!m-0 flex h-full flex-col !gap-0 overflow-hidden !rounded-2xl !border-0 !bg-card !p-0 shadow-xl [backdrop-filter:none] [&>.ui-section-heading]:hidden max-[820px]:!rounded-none" : "!mt-0 mb-[15px]"}>
        {documentOpen && <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 bg-card py-[7px] pr-2.5 pl-[13px] min-[821px]:pr-[133px] max-[620px]:min-h-[94px] max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-1.5 max-[620px]:p-[7px]" data-testid="hwp-focus-toolbar">
          <div className="flex min-w-0 items-center gap-[9px] text-orange-600 max-[620px]:min-h-[31px] max-[620px]:px-1 dark:text-orange-300" data-testid="hwp-focus-document">
            <FileText size={18} />
            <span className="flex min-w-0 flex-col gap-0.5"><strong className="max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground max-[620px]:max-w-60">{documentName || t("hwpEditor.hwpDocument")}</strong><small aria-live="polite" className={cn("text-xs tabular-nums text-muted-foreground", progressToneClass)}>{t("hwpEditor.pageCount", { count: pageCount })} · {progress.status === "running" || progress.status === "error" ? localizeProgress(progress.message) : t("hwpEditor.editing")}</small></span>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5" data-testid="hwp-focus-actions">
            <Button className="h-9 rounded-xl px-[11px] text-[13px] font-bold" variant="secondary" type="button" onClick={() => setDocumentOpen(false)}><X size={16} /> {t("hwpEditor.toolScreen")}</Button>
            <label className="relative inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-secondary px-[11px] text-[13px] font-bold whitespace-nowrap text-secondary-foreground transition-colors hover:bg-muted"><FolderOpen size={16} /> {t("hwpEditor.anotherDocument")}
              <FileInput className="sr-only" data-testid="hwp-focus-open" type="file" accept=".hwp,.hwpx,.hml,application/x-hwp,application/xml,text/xml" onChange={(event) => { const next = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; selectFiles(next); }} />
            </label>
            <Button className="h-9 rounded-xl bg-orange-700 px-[11px] text-[13px] font-bold text-white shadow-md shadow-orange-700/20 hover:bg-orange-800" data-testid="hwp-save" type="button" disabled={Boolean(exporting)} onClick={() => void exportDocument("hwp")}><Download size={16} /> {exporting === "hwp" ? t("hwpEditor.saving") : t("hwpEditor.saveHwp")}</Button>
            <Button className="h-9 rounded-xl px-[11px] text-[13px] font-bold" variant="secondary" type="button" disabled={Boolean(exporting)} onClick={() => void exportDocument("hwpx")}><Download size={16} /> HWPX</Button>
            <Button className="h-9 rounded-xl px-[11px] text-[13px] font-bold" variant="secondary" type="button" disabled={Boolean(exporting) || hmlSaveState?.hmlSavable === false} onClick={() => void exportDocument("hml")}><Download size={16} /> HML</Button>
          </div>
        </div>}
        {!documentOpen && <div className="mb-[11px] flex items-start gap-[9px] rounded-xl bg-orange-500/10 px-3 py-2.5 text-orange-700 dark:text-orange-300">
          <FileCheck2 className="mt-px shrink-0" size={18} />
          <span className="flex flex-col gap-[3px]"><strong className="text-[13px] text-foreground">{t("hwpEditor.studioTitle")}</strong><small className="text-[13px] leading-5 text-muted-foreground">{t("hwpEditor.studioDescription")}</small></span>
        </div>}
        <div data-file-drop-frame-scope ref={containerRef} className={cn("h-[clamp(680px,78vh,980px)] w-full overflow-hidden rounded-2xl border border-border bg-[#f4f5f7] shadow-[0_16px_42px_rgba(30,35,50,.12)] empty:relative empty:bg-[linear-gradient(145deg,var(--muted),var(--card))] empty:after:absolute empty:after:inset-0 empty:after:grid empty:after:place-items-center empty:after:text-sm empty:after:font-bold empty:after:text-muted-foreground empty:after:content-[attr(data-loading-label)] [&>iframe]:block [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0 [&>iframe]:bg-white max-[620px]:h-[max(620px,78vh)] max-[620px]:rounded-lg dark:border-white/15 dark:shadow-[0_20px_50px_rgba(0,0,0,.38)]", documentOpen && "h-auto min-h-0 flex-1 rounded-none border-0 border-t border-border shadow-none max-[620px]:h-auto max-[620px]:rounded-none")} data-loading-label={t("hwpEditor.loading")} data-testid="hwp-editor-shell" aria-label={t("hwpEditor.editorLabel")} />
        {documentOpen && <RhwpVersionNotice mode="editor" compact />}
      </SectionCard>

      {!documentOpen && <ToolGuideWrapper slug="hwpEditor" />}
      {!documentOpen && <RhwpVersionNotice mode="editor" />}
    </UtilityPage>
  );
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function mimeTypeFor(format: ExportFormat) {
  if (format === "hwp") return "application/x-hwp";
  if (format === "hwpx") return "application/vnd.hancom.hwpx";
  return "application/xml";
}

function copyArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function normalizeEditorError(error: unknown, t: ProgressTranslate, english: boolean) {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|initialization|connect/i.test(message)) return t("hwpEditor.connectionError");
  if (/password|비밀번호|암호/i.test(message)) return t("hwpEditor.passwordError");
  if (/unsaved|저장되지|cancel/i.test(message)) return t("hwpEditor.unsavedError");
  return message && !(english && /[가-힣]/.test(message)) ? message : t("hwpEditor.operationError");
}
