import { AlertCircle, Download, FileText, FileUp, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { UtilityNotice } from "../../components/UtilitySurface";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import { cn } from "../../lib/utils";
import { prepareOfficeAssets } from "./officeAssetLoader";
import { OFFICE_EDITOR_FONT_ASSETS } from "./officeAssets";
import { launchOfficeRuntime, type OfficeRuntime } from "./officeRuntime";
import { takePendingOfficeFile } from "./pendingOfficeFile";

type EditorState = "idle" | "downloading" | "preparing" | "ready" | "opening" | "editing" | "saving" | "error";
const OFFICE_ACCEPT = ".docx,.doc,.odt,.xlsx,.xls,.ods,.pptx,.ppt,.odp";
const OFFICE_EXTENSIONS = new Set(["docx", "doc", "odt", "xlsx", "xls", "ods", "pptx", "ppt", "odp"]);

export function OfficeEditorAppPage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const landingPath = useLocalizedPath("/tools/office-editor");
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<EditorState>("idle");
  const [error, setError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<OfficeRuntime | undefined>(undefined);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const assetUiRef = useRef({ fileNumber: 0, percent: -1 });
  const pendingFileCheckedRef = useRef(false);
  const operation = useOperationProgress();

  useEffect(() => {
    if (state !== "preparing" && state !== "opening") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventPageMovement = (event: KeyboardEvent | WheelEvent) => event.preventDefault();
    canvas.addEventListener("keydown", preventPageMovement);
    canvas.addEventListener("wheel", preventPageMovement, { passive: false });
    return () => {
      canvas.removeEventListener("keydown", preventPageMovement);
      canvas.removeEventListener("wheel", preventPageMovement);
    };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = canvas?.parentElement;
    if (!canvas || !shell || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const notifyEditor = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      if (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1) return;
      lastWidth = width;
      lastHeight = height;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };
    const observer = new ResizeObserver(notifyEditor);
    observer.observe(shell);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const start = async (requestedFile = file) => {
    if (!canvasRef.current) return;
    if (requestedFile) setFile(requestedFile);
    setError(undefined);
    setState("downloading");
    const controller = new AbortController();
    controllerRef.current = controller;
    assetUiRef.current = { fileNumber: 0, percent: -1 };
    operation.start(L("편집에 필요한 파일을 확인하고 있습니다.", "Checking files required for editing."));
    try {
      if (!crossOriginIsolated || typeof SharedArrayBuffer === "undefined") throw new Error("isolation-required");
      const assetBaseUrl = await prepareOfficeAssets(({ loaded, total, fileNumber, fileCount, cached }) => {
        const percent = Math.max(2, Math.min(80, Math.round((loaded / Math.max(1, total)) * 80)));
        if (assetUiRef.current.fileNumber === fileNumber && assetUiRef.current.percent === percent) return;
        const nextMessage = cached
          ? L(`저장된 편집 파일 확인 중 · ${fileNumber}/${fileCount}`, `Checking saved editor files · ${fileNumber}/${fileCount}`)
          : L(`편집 파일 내려받는 중 · ${formatBytes(loaded)} / ${formatBytes(total)} · ${fileNumber}/${fileCount}`, `Downloading editor files · ${formatBytes(loaded)} / ${formatBytes(total)} · ${fileNumber}/${fileCount}`);
        if (assetUiRef.current.fileNumber !== fileNumber) operation.update(percent, nextMessage);
        else operation.updateCurrent(percent, nextMessage);
        assetUiRef.current = { fileNumber, percent };
      }, controller.signal);
      setState("preparing");
      setElapsed(0);
      operation.update(84, L("편집 화면을 준비하고 있습니다. 잠시만 기다려 주세요.", "Preparing the editor. Please wait."));
      const runtime = await launchOfficeRuntime(canvasRef.current, assetBaseUrl, OFFICE_EDITOR_FONT_ASSETS.map((asset) => asset.name));
      runtimeRef.current = runtime;
      setState("ready");
      operation.update(92, L("편집 화면을 준비했습니다. 문서를 선택해 주세요.", "The editor is ready. Choose a document."));
      if (requestedFile) await openFile(requestedFile, runtime);
      else operation.succeed(L("편집 화면을 사용할 수 있습니다.", "The editor is ready to use."));
    } catch (reason) {
      const message = editorError(reason, language);
      setError(message);
      setState("error");
      operation.fail(message);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  };

  const openFile = async (nextFile: File, runtime = runtimeRef.current) => {
    setFile(nextFile);
    setError(undefined);
    if (!runtime) return;
    setState("opening");
    setElapsed(0);
    operation.update(94, L(`${nextFile.name} 문서를 여는 중…`, `Opening ${nextFile.name}…`));
    try {
      await runtime.open(nextFile);
      setState("editing");
      operation.succeed(L(`${nextFile.name} 문서를 열었습니다.`, `${nextFile.name} is open.`));
    } catch (reason) {
      const message = editorError(reason, language);
      setError(message);
      setState("error");
      operation.fail(message);
    }
  };

  const save = async () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setError(undefined);
    setState("saving");
    operation.start(L("변경 내용을 저장하고 파일을 확인하는 중…", "Saving changes and checking the file…"));
    try {
      const output = await runtime.save();
      const url = URL.createObjectURL(new Blob([output.bytes], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = output.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setState("editing");
      operation.succeed(L("저장한 파일을 내려받았습니다.", "The saved file was downloaded."));
    } catch (reason) {
      const message = editorError(reason, language);
      setError(message);
      setState("editing");
      operation.fail(message);
    }
  };

  const chooseFile = (nextFile: File) => {
    if (!isSupportedOfficeFile(nextFile)) {
      const message = L("DOCX, DOC, ODT, XLSX, XLS, ODS, PPTX, PPT 또는 ODP 파일 한 개를 선택해 주세요.", "Choose one DOCX, DOC, ODT, XLSX, XLS, ODS, PPTX, PPT or ODP file.");
      setError(message);
      operation.fail(message);
      return;
    }
    if (state === "editing" && !window.confirm(L("현재 문서의 변경 내용을 저장했는지 확인해 주세요. 다른 문서를 여시겠어요?", "Make sure you saved changes to the current document. Open another document?"))) return;
    const runtime = runtimeRef.current;
    if (runtime) void openFile(nextFile, runtime);
    else void start(nextFile);
  };

  useEffect(() => {
    if (pendingFileCheckedRef.current) return;
    pendingFileCheckedRef.current = true;
    void takePendingOfficeFile()
      .then((pendingFile) => { if (pendingFile) chooseFile(pendingFile); })
      .catch(() => {
        const message = L("이전에 선택한 파일을 가져오지 못했습니다. 아래 영역에서 파일을 다시 선택해 주세요.", "The previously selected file could not be retrieved. Choose it again below.");
        setError(message);
        operation.fail(message);
      });
  }, []);

  const busy = state === "downloading" || state === "preparing" || state === "opening" || state === "saving";
  const focusMode = Boolean(file);
  return <div
    data-tool-page="office-editor-app"
    data-focus-mode={focusMode ? "true" : "false"}
    className={cn(
      "mx-auto w-full max-w-[1440px]",
      focusMode
        ? "fixed inset-y-0 right-0 left-[280px] z-20 m-0 flex h-dvh w-auto max-w-none flex-col overflow-hidden bg-background p-2 [animation:none] max-[1020px]:left-[250px] max-[820px]:inset-0 max-[820px]:z-[60] max-[820px]:p-0"
        : "pt-[61px] pb-[52px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 max-[820px]:pt-[calc(84px+env(safe-area-inset-top))] max-[820px]:pb-[calc(92px+env(safe-area-inset-bottom))]",
    )}
    onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files") && !busy) { event.preventDefault(); setDragging(true); } }}
    onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = busy ? "none" : "copy"; } }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={(event) => {
      if ((event.target as Element).closest('[data-ui-part="drop-target"]')) return;
      event.preventDefault();
      setDragging(false);
      if (!busy && event.dataTransfer.files[0]) chooseFile(event.dataTransfer.files[0]);
    }}
  >
    <div
      className={cn(
        "sticky top-2.5 z-[8] mb-[13px] flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-[11px] shadow-lg backdrop-blur-lg max-[620px]:static max-[620px]:grid max-[620px]:grid-cols-2 max-[620px]:[&>*]:w-full max-[620px]:[&>*]:justify-center",
        focusMode && "static mb-2 min-h-[54px] shrink-0 rounded-[14px] px-[9px] py-[7px] max-[820px]:rounded-none max-[820px]:border-x-0 max-[820px]:border-t-0",
      )}
      data-testid="office-app-toolbar"
    >
      <Button render={<Link to={landingPath} />} className="min-h-10 rounded-xl font-bold" variant="secondary">{L("편집기 안내", "Editor guide")}</Button>
      {file && <span className="flex min-w-0 flex-1 items-center gap-2 text-violet-700 max-[620px]:col-span-full max-[620px]:justify-start dark:text-violet-300" data-testid="office-toolbar-document"><FileText className="shrink-0" size={17} /><span className="flex min-w-0 flex-col gap-0.5"><strong className="max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground">{file.name}</strong><small className="max-w-[520px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{state === "editing" ? L("브라우저에서 편집 중", "Editing in this browser") : operation.message}</small></span></span>}
      <label className={cn("relative inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-secondary px-3 text-sm font-bold whitespace-nowrap text-secondary-foreground transition-colors hover:bg-muted", busy && "cursor-not-allowed opacity-50")}><FileUp size={15} /> {file ? L("다른 파일 열기", "Open another file") : L("파일 선택", "Choose file")}<input className="sr-only" data-testid="office-file-picker" type="file" accept={OFFICE_ACCEPT} disabled={busy} onChange={(event) => { const selected = event.target.files?.[0]; event.currentTarget.value = ""; if (selected) chooseFile(selected); }} /></label>
      {state === "error" && file ? <Button className="min-h-10 rounded-xl bg-violet-700 font-bold text-white hover:bg-violet-800" disabled={busy} onClick={() => { const runtime = runtimeRef.current; if (runtime) void openFile(file, runtime); else void start(file); }}>{L("다시 시도", "Try again")}</Button> : null}
      <Button className="min-h-10 rounded-xl bg-violet-700 font-bold text-white hover:bg-violet-800" data-testid="office-save" type="button" disabled={state !== "editing"} onClick={() => void save()}><Save size={15} /> {L("저장 및 다운로드", "Save and download")}</Button>
      {state === "downloading" && <Button className="min-h-10 rounded-xl font-bold" type="button" variant="secondary" onClick={() => controllerRef.current?.abort()}>{L("취소", "Cancel")}</Button>}
    </div>

    <div className={cn(focusMode && "mb-2 shrink-0")} hidden={focusMode && state === "editing"} data-testid="office-progress-region"><OperationProgress status={operation.status} progress={operation.progress} message={state === "preparing" || state === "opening" ? `${operation.message} · ${L(`${elapsed}초 경과`, `${elapsed}s elapsed`)}` : operation.message} logs={operation.logs} accent="violet" title={L("오피스 편집기 준비 상태", "Office editor preparation")} /></div>
    {error && <UtilityNotice className={cn("mb-2 shrink-0", !focusMode && "mb-0")} tone="error" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={19} /><div className="flex flex-col"><strong>{L("편집기를 준비하지 못했습니다.", "Could not prepare the editor.")}</strong><span>{error}</span></div></UtilityNotice>}
    <div
      className={cn(
        "relative mt-[13px] min-h-[680px] overflow-hidden rounded-2xl border border-border bg-[#303035] shadow-lg max-[820px]:min-h-[max(560px,calc(100vh-260px))] max-[820px]:rounded-xl max-[620px]:min-h-[max(500px,calc(100vh-330px))]",
        state === "editing" && "min-h-[max(680px,calc(100vh-230px))]",
        focusMode && "mt-0 h-auto min-h-0 flex-1 rounded-[14px] max-[820px]:rounded-none",
      )}
      data-active={state === "editing" ? "true" : "false"}
      data-testid="office-canvas-shell"
    >
      {state !== "editing" && <div className="absolute inset-0 z-[2] grid place-items-center content-center gap-2 bg-[radial-gradient(circle_at_50%_35%,#47474f,#29292e_68%)] p-6 text-center text-[#d7d7dc] [&_.ui-drop-zone-wrap]:w-[min(720px,100%)] [&_svg]:text-[#b496ff]">
        {state === "idle" || (state === "error" && !file) ? <>
          <FileDropZone files={[]} onFiles={(files) => { const selected = files.at(-1); if (selected) chooseFile(selected); }} accept={OFFICE_ACCEPT} hint={L("파일을 놓거나 선택하면 편집 준비와 문서 열기를 자동으로 시작합니다.", "Drop or choose a file to prepare the editor and open it automatically.")} accent="violet" disabled={busy} />
          <span className="text-[13px] text-[#aaaab3]">{L("최초 실행에는 대용량 편집 파일과 한글 글꼴을 내려받습니다.", "The first run downloads the editor and a Korean font file.")}</span>
        </> : <><Download size={30} /><strong className="max-w-[620px] text-base [overflow-wrap:anywhere]">{file?.name}</strong><span className="text-[13px] text-[#aaaab3]">{state === "preparing" || state === "opening" ? L(`준비 중 · ${elapsed}초 경과`, `Preparing · ${elapsed}s elapsed`) : operation.message}</span></>}
      </div>}
      <canvas ref={canvasRef} id="qtcanvas" contentEditable tabIndex={0} className="block h-full min-h-[inherit] w-full border-0 p-0 outline-0 focus-visible:ring-3 focus-visible:ring-violet-400/50" data-testid="office-canvas" onPointerDown={(event) => event.currentTarget.focus()} onContextMenu={(event) => event.preventDefault()} />
    </div>
    {dragging && !busy && <div className="pointer-events-none fixed inset-y-4 right-4 left-[296px] z-80 grid place-items-center content-center gap-2.5 rounded-[20px] border-[3px] border-dashed border-[#b496ff] bg-[rgba(54,37,82,.88)] text-white max-[1020px]:left-[266px] max-[820px]:inset-2 max-[820px]:rounded-[14px] [&_svg]:text-[#c8b3ff]" data-testid="office-drop-overlay"><FileUp size={32} /><strong>{L("여기에 놓아 문서 열기", "Drop to open the document")}</strong></div>}
  </div>;
}

function isSupportedOfficeFile(file: File) {
  return OFFICE_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "");
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function editorError(reason: unknown, language: "ko" | "en") {
  if (reason instanceof DOMException && reason.name === "AbortError") return language === "en" ? "Preparation was cancelled." : "편집기 준비를 취소했습니다.";
  const code = reason instanceof Error ? reason.message : String(reason);
  if (code === "isolation-required") return language === "en" ? "This browser session cannot start the editor. Reload this workspace in a current Chrome or Edge browser." : "현재 브라우저 환경에서 편집기를 시작할 수 없습니다. 최신 Chrome 또는 Edge에서 이 작업 화면을 다시 열어 주세요.";
  if (code === "cache-unavailable") return language === "en" ? "Browser storage is unavailable. Allow site storage and retry." : "브라우저 저장 공간을 사용할 수 없습니다. 사이트 저장을 허용한 뒤 다시 시도해 주세요.";
  if (code === "asset-download-failed") return language === "en" ? "Required editor files could not be downloaded. Check the connection and available storage, then retry." : "필요한 편집 파일을 내려받지 못했습니다. 인터넷 연결과 저장 공간을 확인한 뒤 다시 시도해 주세요.";
  if (code === "office-operation-timeout") return language === "en" ? "Preparation took longer than expected. Keep this tab open and try again." : "준비 시간이 예상보다 길어 중단했습니다. 이 탭을 유지한 채 다시 시도해 주세요.";
  if (code === "save-failed") return language === "en" ? "The changes could not be saved. Keep this page open and try again." : "변경 내용을 저장하지 못했습니다. 현재 페이지를 닫지 말고 다시 시도해 주세요.";
  if (code === "office-save-verification-failed") return language === "en" ? "The saved file could not be verified. Keep the current page open and try saving again." : "저장한 파일을 확인하지 못했습니다. 현재 페이지를 닫지 말고 다시 저장해 주세요.";
  return language === "en" ? "The document could not be opened. Check that the format is supported and the file is not damaged." : "문서를 열지 못했습니다. 지원 형식인지, 파일이 손상되지 않았는지 확인해 주세요.";
}
