import { Download, FileText, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clearUnsavedWork, useUnsavedWorkGuard } from "../../app/toolState";
import { OperationProgress } from "../../components/OperationProgress";
import { UtilityInput, UtilityNotice } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { createSafeFileName } from "../../utils/fileNameSafety";
import { prepareOfficeAssets } from "../office-editor/officeAssetLoader";
import { OFFICE_EDITOR_FONT_ASSETS } from "../office-editor/officeAssets";
import { launchOfficeRuntime, type OfficeRuntime } from "../office-editor/officeRuntime";

import { HwpPdfPanel } from "./HwpPdfPanel";

const supported = new Set(["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const maxBytes = 50 * 1024 * 1024;
export function DocumentPdfPanel() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const [file, setFile] = useState<File>();
  const isHwp = /\.hwpx?$/i.test(file?.name ?? "");
  const [bytes, setBytes] = useState<Uint8Array>();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [saved, setSaved] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const runtime = useRef<OfficeRuntime | undefined>(undefined);
  const started = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const operation = useOperationProgress();
  useUnsavedWorkGuard("document-to-pdf", Boolean(file) && !saved, { kind: "files", scopePath: "/tools/pdf-converter/document-to-pdf" });
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!bytes) { setUrl(""); return; }
    const next = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/pdf" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [bytes]);
  const choose = (files: File[]) => {
    if (loading || reloadRequired) return;
    const next = files.at(-1);
    setBytes(undefined); setFile(undefined); setError(""); setSaved(false); operation.reset();
    if (next && !supported.has(next.name.split(".").at(-1)?.toLowerCase() ?? "")) {
      setError(L("HWP·HWPX·DOC·DOCX·XLS·XLSX·PPT·PPTX 파일을 선택해 주세요.", "Choose an HWP, HWPX, DOC, DOCX, XLS, XLSX, PPT, or PPTX file.")); return;
    }
    if (next && next.size > maxBytes) {
      setError(L("이 도구는 현재 50 MiB 이하의 파일을 받습니다. 더 작은 사본을 선택해 주세요.", "This tool currently accepts files up to 50 MiB. Choose a smaller copy.")); return;
    }
    setFile(next); setName(next?.name.replace(/\.[^.]+$/, "") ?? "");
  };
  const resetRuntime = () => {
    controller.current?.abort(); clearUnsavedWork("document-to-pdf");
    // LibreOffice owns native threads in this document. Reload releases them,
    // including a parser that has stopped responding; no background job remains.
    window.location.reload();
  };
  const cancel = () => {
    if (started.current) { resetRuntime(); return; }
    controller.current?.abort(); controller.current = undefined;
    setLoading(false); operation.reset();
  };
  const run = async () => {
    if (!file || isHwp || loading || reloadRequired) return;
    const active = new AbortController(); controller.current = active;
    setLoading(true); setBytes(undefined); setError(""); setSaved(false);
    operation.start(L("문서 변환을 준비합니다.", "Preparing document conversion."));
    let touchedRuntime = false;
    try {
      const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
      const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (["docx", "xlsx", "pptx"].includes(extension) && header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0) throw new Error("encrypted-document");
      if (active.signal.aborted) return;
      if (!crossOriginIsolated || typeof SharedArrayBuffer === "undefined" || !canvas.current) throw new Error("isolation-required");
      if (!runtime.current) {
        let previous = -1;
        const base = await prepareOfficeAssets(({ loaded, total }) => {
          if (active.signal.aborted) return;
          const progress = Math.floor(loaded / total * 75);
          if (progress === previous) return;
          previous = progress;
          operation.updateCurrent(progress, L(`변환 파일을 준비합니다: ${formatBytes(loaded)} / ${formatBytes(total)}`, `Preparing conversion files: ${formatBytes(loaded)} / ${formatBytes(total)}`));
        }, active.signal, "editor");
        if (active.signal.aborted) return;
        started.current = true; touchedRuntime = true;
        operation.updateCurrent(80, L("문서 변환 기능을 시작합니다.", "Starting document conversion."));
        runtime.current = await launchOfficeRuntime(canvas.current, base, OFFICE_EDITOR_FONT_ASSETS.map(font => font.name));
      }
      if (active.signal.aborted) return;
      operation.updateCurrent(90, L("문서를 PDF로 변환하고 있습니다.", "Converting the document to PDF."));
      touchedRuntime = true;
      const result = await runtime.current.convertToPdf(file);
      if (active.signal.aborted) return;
      setBytes(result.bytes);
      operation.succeed(L("PDF를 만들었습니다. 저장 후 페이지와 글꼴을 확인해 주세요.", "PDF created. Check its pages and fonts after saving."));
    } catch (reason) {
      if (active.signal.aborted) return;
      const code = (reason as Error).message;
      setReloadRequired(touchedRuntime);
      const message = code === "encrypted-document"
        ? L("암호화된 Office 파일은 지원하지 않습니다. 암호를 해제한 사본을 선택해 주세요.", "Encrypted Office files are not supported. Choose an unlocked copy.")
        : code === "isolation-required"
        ? L("이 브라우저에서는 변환 준비를 완료하지 못했습니다. 최신 데스크톱 브라우저에서 다시 열어 주세요.", "This browser could not prepare conversion. Open this page in a current desktop browser.")
        : code === "office-operation-timeout"
          ? L("변환 대기 시간이 초과됐습니다. 초기화한 뒤 더 작은 파일로 다시 시도해 주세요.", "Conversion timed out. Reset and try a smaller file.")
          : L("문서를 변환하지 못했습니다. 손상되지 않은 암호 해제 사본으로 다시 시도해 주세요.", "The document could not be converted. Try an intact, unlocked copy.");
      setError(message); operation.fail(message);
    } finally {
      if (controller.current === active) { controller.current = undefined; setLoading(false); }
    }
  };
  return <div data-document-pdf-ready={crossOriginIsolated}>
    <SectionCard step={1} title={L("문서 선택", "Choose a document")} description="HWP · HWPX · DOC · DOCX · XLS · XLSX · PPT · PPTX">
      <FileDropZone disabled={!crossOriginIsolated || loading || reloadRequired} files={file ? [file] : []} accept=".hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onFiles={choose} accent="coral" hint={L("파일 한 개, 최대 50 MiB", "One file, up to 50 MiB")} />
      {file && <FileList files={[file]} accent="coral" onRemove={() => choose([])} />}
    </SectionCard>
    {!isHwp && <UtilityNotice kind="info" className="my-4"><FileText className="shrink-0" size={18} /><span>{L(
      "첫 실행 시 약 252 MiB의 변환 파일을 브라우저에 불러옵니다. 메모리가 충분한 데스크톱을 권장합니다. 원본 글꼴과 인쇄 설정에 따라 줄바꿈·표·페이지가 달라질 수 있습니다. 암호 파일은 지원하지 않습니다. HWP·HWPX는 파일 선택 후 브라우저 인쇄로 PDF를 저장합니다.",
      "The first run loads about 252 MiB of conversion files into your browser. A desktop with sufficient memory is recommended. Fonts and print settings can change line breaks, tables, and pages. Password-protected files are not supported. HWP / HWPX saves PDF through browser printing after file selection.")}</span></UtilityNotice>}
    {!isHwp && <div className="my-4 flex flex-wrap gap-2">
      <PrimaryButton accent="coral" disabled={!file || loading || reloadRequired} loading={loading} onClick={() => void run()}>{L("PDF 만들기", "Create PDF")}</PrimaryButton>
      {loading && <Button variant="outline" onClick={cancel}><X size={16} />{L("취소 및 초기화", "Cancel and reset")}</Button>}
      {reloadRequired && <Button variant="outline" onClick={resetRuntime}><RotateCcw size={16} />{L("변환 초기화", "Reset conversion")}</Button>}
    </div>}
    {isHwp && file && <HwpPdfPanel file={file} onClear={() => choose([])} />}
    {error && <UtilityNotice kind="error" role="alert">{error}</UtilityNotice>}
    <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="coral" />
    {url && <SectionCard step={2} title={L("PDF 저장", "Save PDF")} description={L("다운로드 후 원본과 비교해 주세요.", "Compare the downloaded PDF with your original.")}>
      <label className="my-3 flex items-center gap-2 text-sm">{L("파일명", "File name")}<UtilityInput value={name} onChange={event => { setName(event.target.value); setSaved(false); }} /><span>.pdf</span></label>
      <Button render={<a data-testid="document-pdf-download" href={url} download={createSafeFileName(name || "document") + ".pdf"} onClick={() => setSaved(true)} />}><Download size={16} />{L("PDF 다운로드", "Download PDF")}</Button>
    </SectionCard>}
    <canvas ref={canvas} id="qtcanvas" width={640} height={480} tabIndex={-1} aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, width: 640, height: 480, pointerEvents: "none" }} />
  </div>;
}
