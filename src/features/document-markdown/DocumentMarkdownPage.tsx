import { BatchConversionPanel } from "../conversion-batch/BatchConversionPanel";
import { Download, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUnsavedWorkGuard } from "../../app/toolState";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { OperationProgress } from "../../components/OperationProgress";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityInput, UtilityNotice, UtilityPage, UtilityTextarea } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { createSafeFileName } from "../../utils/fileNameSafety";
import { convertToMarkdown, MARKDOWN_ACCEPT, MARKDOWN_EXTENSIONS, MARKDOWN_MAX_BYTES } from "./markdownClient";

export function DocumentMarkdownPage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const [batchFiles, setBatchFiles] = useState<File[]>();
  const [file, setFile] = useState<File>();
  const [markdown, setMarkdown] = useState("");
  const [outputName, setOutputName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const active = useRef<AbortController | undefined>(undefined);
  const operation = useOperationProgress();
  useUnsavedWorkGuard("document-markdown", Boolean(file) && !saved, { kind: "files", scopePath: "/tools/document-markdown" });
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!markdown) { setUrl(""); return; }
    const next = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [markdown]);
  const choose = (files: File[]) => {
    active.current?.abort();
    active.current = undefined;
    setLoading(false); setMarkdown(""); setSaved(false); setError(""); operation.reset();
    if (files.length > 1) { setFile(undefined); setBatchFiles(files); return; }
    const next = files.at(-1);
    if (next && !MARKDOWN_EXTENSIONS.has(next.name.split(".").at(-1)?.toLowerCase() ?? "")) {
      setFile(undefined);
      setError(L("DOCX·XLSX·XLS·PPTX·PDF 파일을 선택해 주세요.", "Choose a DOCX, XLSX, XLS, PPTX, or PDF file."));
      return;
    }
    if (next && next.size > MARKDOWN_MAX_BYTES) {
      setFile(undefined); setError(L("50 MiB 이하의 파일을 선택해 주세요.", "Choose a file no larger than 50 MiB.")); return;
    }
    setFile(next);
    setOutputName(next?.name.replace(/\.[^.]+$/, "") ?? "");
  };
  const run = async () => {
    if (!file) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(""); setMarkdown(""); setSaved(false);
    operation.start(L("Markdown 변환 기능을 준비합니다.", "Preparing Markdown conversion."));
    try {
      const result = await convertToMarkdown(file, controller.signal, ({ progress, phase }) => {
        if (active.current !== controller) return;
        operation.updateCurrent(progress, phase === "converting"
          ? L("문서의 텍스트와 구조를 읽고 있습니다.", "Reading document text and structure.")
          : L("변환에 필요한 파일을 이 브라우저에 불러옵니다. 첫 실행은 시간이 걸릴 수 있습니다.", "Loading conversion files into this browser. The first run may take a while."));
      });
      if (active.current !== controller || controller.signal.aborted) return;
      setMarkdown(result);
      operation.succeed(L("Markdown 파일을 만들었습니다.", "Markdown file created."));
    } catch (reason) {
      if (active.current !== controller || controller.signal.aborted) return;
      const code = (reason as Error & { code?: string }).code ?? (reason as Error).message;
      const message = code === "NO_TEXT"
        ? L("추출할 텍스트가 없습니다. 스캔 PDF의 OCR은 이 도구에서 지원하지 않습니다.", "No text was extracted. This tool does not perform OCR on scanned PDFs.")
        : code === "ENCRYPTED"
          ? L("암호로 보호된 파일은 열 수 없습니다. 암호를 해제한 사본을 선택해 주세요.", "Password-protected files cannot be opened. Choose an unlocked copy.")
          : code === "RUNTIME_UNAVAILABLE"
            ? L("변환 파일을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.", "Conversion files could not be loaded. Check your connection and retry.")
            : code === "WORKER_TIMEOUT" || code === "CONVERSION_TIMEOUT"
              ? L("변환 대기 시간이 초과됐습니다. 더 작은 파일로 다시 시도해 주세요.", "Conversion timed out. Try a smaller file.")
              : L("문서를 변환하지 못했습니다. 파일 형식과 손상 여부를 확인해 주세요.", "The document could not be converted. Check its format and whether it is damaged.");
      setError(message); operation.fail(message);
    } finally {
      if (active.current === controller) { active.current = undefined; setLoading(false); }
    }
  };
  const cancel = () => {
    active.current?.abort(); active.current = undefined; setLoading(false);
    operation.reset();
  };
  return <UtilityPage toolId="document-markdown" className="[--primary:var(--brand-strong)] [&_.bg-primary:hover]:bg-[var(--brand-strong)] [&_[data-ui-component=file-list]>li>span:first-child]:text-foreground [&_[data-testid=pdf-download]_small]:text-primary-foreground [&_.privacy-inline]:text-foreground [&_.ui-step-number]:bg-[var(--brand-strong)] [&_.ui-step-number]:text-primary-foreground [&_[data-slot=notice]]:text-foreground">
    <PageHeader eyebrow="MARKDOWN" title={L("문서 → Markdown", "Document to Markdown")}
      description={L("워드·엑셀·PPTX·PDF의 제목, 문단과 표를 Markdown 파일로 추출하세요.", "Convert Word, Excel, PowerPoint PPTX and text PDFs into Markdown headings, paragraphs and tables.")}>
      <PrivacyBanner compact />
    </PageHeader>
    {batchFiles ? <BatchConversionPanel mode="markdown" files={batchFiles} onClose={() => setBatchFiles(undefined)} /> : <>
    <SectionCard step={1} title={L("문서 선택", "Choose a document")} description="DOCX · XLSX · XLS · PPTX · PDF">
      <FileDropZone accept={MARKDOWN_ACCEPT} multiple files={[]} onFiles={choose} accent="blue"
        hint={L("여러 파일을 놓거나 선택하세요. 파일당 최대 50 MiB.", "Drop or choose files, up to 50 MiB each.")} />
      {file && <FileList files={[file]} accent="blue" onRemove={() => choose([])} />}
    </SectionCard>
    <UtilityNotice className="my-4" kind="info">
      <FileText className="shrink-0" size={18} /><span>{L(
        "제목·문단·표를 추출하는 도구입니다. 시각적 서식·수식·편집 구조의 복원은 보장하지 않으며 스캔 PDF의 문자 인식은 지원하지 않습니다.",
        "Extracts headings, paragraphs and tables. Visual formatting, formulas and editing structure may not be preserved. Scanned PDF text recognition is not supported.")}</span>
    </UtilityNotice>
    <div className="my-4 flex flex-wrap gap-2">
      <PrimaryButton accent="blue" disabled={!file || loading} loading={loading} onClick={() => void run()}>
        {L("Markdown 만들기", "Create Markdown")}
      </PrimaryButton>
      {loading && <Button variant="outline" onClick={cancel}><X size={16} />{L("취소", "Cancel")}</Button>}
    </div>
    {error && <UtilityNotice kind="error" role="alert">{error}</UtilityNotice>}
    <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="blue" />
    {markdown && <SectionCard step={2} title={L("Markdown 결과", "Markdown result")} description={L("내용을 확인하고 파일로 저장하세요.", "Review the content and save the file.")}>
      <UtilityTextarea aria-label={L("Markdown 결과", "Markdown result")} value={markdown} readOnly rows={14} className="font-mono text-sm" />
      <label className="my-3 flex items-center gap-2 text-sm">
        {L("파일명", "File name")}
        <UtilityInput value={outputName} onChange={event => { setOutputName(event.target.value); setSaved(false); }} /><span>.md</span>
      </label>
      {url && <Button render={<a data-testid="markdown-download" href={url} download={createSafeFileName(outputName || "document") + ".md"} onClick={() => setSaved(true)} />}><Download size={16} />{L("Markdown 다운로드", "Download Markdown")}</Button>}
    </SectionCard>}
    </>}
    <ToolGuideWrapper slug="documentMarkdown" />
  </UtilityPage>;
}
