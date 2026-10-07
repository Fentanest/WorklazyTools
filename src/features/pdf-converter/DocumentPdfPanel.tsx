import { Download, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUnsavedWorkGuard } from "../../app/toolState";
import { OperationProgress } from "../../components/OperationProgress";
import { UtilityInput, UtilityNotice } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { createSafeFileName } from "../../utils/fileNameSafety";
import { convertOfficePdf } from "./officePdfClient";
import { BatchConversionPanel } from "../conversion-batch/BatchConversionPanel";

import { HwpPdfPanel } from "./HwpPdfPanel";

const supported = new Set(["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const maxBytes = 50 * 1024 * 1024;
export function DocumentPdfPanel() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const [batchFiles, setBatchFiles] = useState<File[]>();
  const [file, setFile] = useState<File>();
  const isHwp = /\.hwpx?$/i.test(file?.name ?? "");
  const [bytes, setBytes] = useState<Uint8Array>();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
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
    if (loading) return;
    if (files.length > 1) { controller.current?.abort(); setFile(undefined); setBytes(undefined); setBatchFiles(files); return; }
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
  const cancel = () => {
    controller.current?.abort(); controller.current = undefined;
    setLoading(false); operation.reset();
  };
  const run = async () => {
    if (!file || isHwp || loading) return;
    const active = new AbortController(); controller.current = active;
    setLoading(true); setBytes(undefined); setError(""); setSaved(false);
    operation.start(L("문서 변환을 준비합니다.", "Preparing document conversion."));
    try {
      const result = await convertOfficePdf(file, active.signal, value => {
        if (!active.signal.aborted) operation.updateCurrent(value, value < 90
          ? L("문서 변환 기능을 준비합니다.", "Preparing document conversion.")
          : L("문서를 PDF로 변환하고 있습니다.", "Converting the document to PDF."));
      });
      if (active.signal.aborted) return;
      setBytes(result.bytes);
      operation.succeed(L("PDF를 만들었습니다. 저장 후 페이지와 글꼴을 확인해 주세요.", "PDF created. Check its pages and fonts after saving."));
    } catch (reason) {
      if (active.signal.aborted) return;
      const code = (reason as Error).message;
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
  if (batchFiles) return <BatchConversionPanel mode="document-pdf" files={batchFiles} onClose={() => setBatchFiles(undefined)} />;
  return <div data-document-pdf-ready={crossOriginIsolated}>
    <SectionCard step={1} title={L("문서 선택", "Choose a document")} description="HWP · HWPX · DOC · DOCX · XLS · XLSX · PPT · PPTX">
      <FileDropZone disabled={!crossOriginIsolated || loading} multiple files={[]} accept=".hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onFiles={choose} accent="coral" hint={L("여러 파일 선택 가능 · 파일당 최대 50 MiB", "Choose one or more files · up to 50 MiB each")} />
      {file && <FileList files={[file]} accent="coral" onRemove={() => choose([])} />}
    </SectionCard>
    {!isHwp && <UtilityNotice kind="info" className="my-4"><FileText className="shrink-0" size={18} /><span>{L(
      "첫 실행 시 약 252 MiB의 변환 파일을 브라우저에 불러옵니다. 메모리가 충분한 데스크톱을 권장합니다. 원본 글꼴과 인쇄 설정에 따라 줄바꿈·표·페이지가 달라질 수 있습니다. 암호 파일은 지원하지 않습니다. HWP·HWPX는 파일 선택 후 브라우저 인쇄로 PDF를 저장합니다.",
      "The first run loads about 252 MiB of conversion files into your browser. A desktop with sufficient memory is recommended. Fonts and print settings can change line breaks, tables, and pages. Password-protected files are not supported. HWP / HWPX saves PDF through browser printing after file selection.")}</span></UtilityNotice>}
    {!isHwp && <div className="my-4 flex flex-wrap gap-2">
      <PrimaryButton accent="coral" disabled={!file || loading} loading={loading} onClick={() => void run()}>{L("PDF 만들기", "Create PDF")}</PrimaryButton>
      {loading && <Button variant="outline" onClick={cancel}><X size={16} />{L("취소 및 초기화", "Cancel and reset")}</Button>}
    </div>}
    {isHwp && file && <HwpPdfPanel file={file} onClear={() => choose([])} />}
    {error && <UtilityNotice kind="error" role="alert">{error}</UtilityNotice>}
    <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="coral" />
    {url && <SectionCard step={2} title={L("PDF 저장", "Save PDF")} description={L("다운로드 후 원본과 비교해 주세요.", "Compare the downloaded PDF with your original.")}>
      <label className="my-3 flex items-center gap-2 text-sm">{L("파일명", "File name")}<UtilityInput value={name} onChange={event => { setName(event.target.value); setSaved(false); }} /><span>.pdf</span></label>
      <Button render={<a data-testid="document-pdf-download" href={url} download={createSafeFileName(name || "document") + ".pdf"} onClick={() => setSaved(true)} />}><Download size={16} />{L("PDF 다운로드", "Download PDF")}</Button>
    </SectionCard>}
  </div>;
}
