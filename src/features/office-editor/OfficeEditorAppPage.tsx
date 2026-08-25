import { AlertCircle, Download, FileUp, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { OperationProgress } from "../../components/OperationProgress";
import { PrimaryButton } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import { prepareOfficeAssets } from "./officeAssetLoader";
import { launchOfficeRuntime, type OfficeRuntime } from "./officeRuntime";

type EditorState = "idle" | "downloading" | "preparing" | "ready" | "opening" | "editing" | "saving" | "error";

export function OfficeEditorAppPage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const landingPath = useLocalizedPath("/tools/office-editor");
  const [file, setFile] = useState<File>();
  const [state, setState] = useState<EditorState>("idle");
  const [error, setError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<OfficeRuntime | undefined>(undefined);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const assetUiRef = useRef({ fileNumber: 0, percent: -1 });
  const operation = useOperationProgress();

  useEffect(() => {
    if (state !== "preparing" && state !== "opening") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = async () => {
    if (!canvasRef.current) return;
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
      const runtime = await launchOfficeRuntime(canvasRef.current, assetBaseUrl);
      runtimeRef.current = runtime;
      setState("ready");
      operation.update(92, L("편집 화면을 준비했습니다. 문서를 선택해 주세요.", "The editor is ready. Choose a document."));
      if (file) await openFile(file, runtime);
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
      setState("error");
      operation.fail(message);
    }
  };

  const busy = state === "downloading" || state === "preparing" || state === "opening" || state === "saving";
  return <div className="page office-editor-app page-enter">
    <div className="office-app-toolbar">
      <Link className="secondary-button" to={landingPath}>{L("편집기 안내", "Editor guide")}</Link>
      <label className={`secondary-button office-file-picker${busy ? " disabled" : ""}`}><FileUp size={15} /> {file ? L("다른 파일 열기", "Open another file") : L("파일 선택", "Choose file")}<input type="file" accept=".docx,.doc,.odt,.xlsx,.xls,.ods,.pptx,.ppt,.odp" disabled={busy} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void openFile(selected); }} /></label>
      {state === "idle" || state === "error" ? <PrimaryButton accent="violet" loading={busy} onClick={() => void start()}>{L("편집 화면 준비", "Prepare editor")}</PrimaryButton> : null}
      <button type="button" className="primary-button accent-violet" disabled={state !== "editing"} onClick={() => void save()}><Save size={15} /> {L("저장 및 다운로드", "Save and download")}</button>
      {state === "downloading" && <button type="button" className="secondary-button" onClick={() => controllerRef.current?.abort()}>{L("취소", "Cancel")}</button>}
    </div>

    <OperationProgress status={operation.status} progress={operation.progress} message={state === "preparing" || state === "opening" ? `${operation.message} · ${L(`${elapsed}초 경과`, `${elapsed}s elapsed`)}` : operation.message} logs={operation.logs} accent="violet" title={L("오피스 편집기 준비 상태", "Office editor preparation")} />
    {error && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>{L("편집기를 준비하지 못했습니다.", "Could not prepare the editor.")}</strong><span>{error}</span></div></div>}
    <div className={`office-canvas-shell${state === "editing" ? " active" : ""}`}>
      {state !== "editing" && <div className="office-canvas-placeholder"><Download size={30} /><strong>{file ? file.name : L("편집할 파일을 선택하고 편집 화면을 준비하세요.", "Choose a file and prepare the editor.")}</strong><span>{state === "preparing" || state === "opening" ? L(`준비 중 · ${elapsed}초 경과`, `Preparing · ${elapsed}s elapsed`) : L("최초 실행은 약 250MB를 내려받습니다.", "The first run downloads about 250 MB.")}</span></div>}
      <canvas ref={canvasRef} id="qtcanvas" contentEditable className="office-canvas" onContextMenu={(event) => event.preventDefault()} />
    </div>
  </div>;
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
