import { FileOutput, Languages, ScanText, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { PdfThumbnail } from "./PdfThumbnail";
import { extractPdfText, inspectPdf, parsePageRange, releasePdf, type PdfOcrMode } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { combineOcrPdfPages, textDocumentToOffice } from "./pdfWorkerClient";
import type { PdfPageItem } from "./types";

type OutputFormat = "docx" | "xlsx" | "txt" | "searchable-pdf";

export function PdfConvertPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("docx");
  const [ocrMode, setOcrMode] = useState<PdfOcrMode>("auto");
  const [outputName, setOutputName] = useState("Worklazy-PDF-변환");
  const [pageRange, setPageRange] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const operation = useOperationProgress();
  const download = useDownloadResult();

  useEffect(() => () => { if (file) void releasePdf(file); }, [file]);

  const setInput = async (files: File[]) => {
    const next = files.at(-1);
    if (!next || next === file) return;
    setLoading(true);
    setError("");
    download.clearResult();
    operation.start(`${next.name} 페이지와 보안 상태를 확인하는 중…`);
    try {
      const inspected = await inspectPdf(next);
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      setOutputName(`${next.name.replace(/\.pdf$/i, "")}-변환`);
      operation.succeed(`${inspected.pageCount}개 페이지를 변환할 수 있습니다.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "PDF를 읽지 못했습니다.";
      setError(message);
      operation.fail(message);
    } finally { setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    setError("");
    download.clearResult();
    const searchable = format === "searchable-pdf";
    operation.start(searchable ? "검색 가능한 텍스트 생성을 준비합니다." : "PDF의 텍스트와 배치 좌표를 분석하는 중…");
    try {
      const selectedPageIndexes = pageRange.trim() ? parsePageRange(pageRange, pageCount) : undefined;
      const selectedPageCount = selectedPageIndexes?.length || pageCount;
      const extracted = await extractPdfText(file, searchable ? "all" : ocrMode, searchable, operation.update, selectedPageIndexes);
      if (searchable) {
        if (extracted.ocrPdfBuffers.length !== selectedPageCount) throw new Error("일부 페이지의 검색 가능한 PDF 데이터를 만들지 못했습니다.");
        operation.update(91, "OCR 텍스트 레이어가 포함된 페이지를 결합하는 중…");
        const output = await combineOcrPdfPages(extracted.ocrPdfBuffers, normalizeOutputName(outputName, "Worklazy-검색-PDF"), (value, message) => operation.update(91 + value * 0.08, message));
        download.makeResult(output);
      } else {
        if (!extracted.document.characterCount) throw new Error("추출된 텍스트가 없습니다. 스캔 페이지 자동 OCR을 선택해 다시 시도해 주세요.");
        operation.update(91, `${extracted.document.characterCount.toLocaleString()}자를 ${format.toUpperCase()} 구조로 만드는 중…`);
        const output = await textDocumentToOffice(extracted.document, format, normalizeOutputName(outputName, "Worklazy-PDF-변환"), (value, message) => operation.update(91 + value * 0.08, message));
        if (extracted.ocrPageCount) output.warnings.push(`${extracted.ocrPageCount}개 페이지는 한국어·영어 OCR 결과를 사용했습니다.`);
        download.makeResult(output);
      }
      operation.succeed(searchable ? "검색과 텍스트 선택이 가능한 OCR PDF를 만들었습니다." : `${format.toUpperCase()} 변환 파일을 만들었습니다.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "PDF 변환을 완료하지 못했습니다.";
      setError(message);
      operation.fail(message);
    }
  };

  const extension = format === "searchable-pdf" ? "pdf" : format;
  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `convert-${index}`, sourceId: "convert-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title="PDF 선택" description="텍스트 PDF와 스캔 PDF를 DOCX·XLSX·TXT 또는 검색 가능한 PDF로 변환합니다." className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint="텍스트를 추출하거나 OCR할 PDF 하나를 선택하세요." />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {file && (
            <SectionCard step={2} title="변환 범위 확인" description="내장 텍스트를 먼저 사용하고, 필요할 때만 페이지 이미지를 OCR합니다." className="accent-context-violet pdf-page-section">
              <div className="pdf-ocr-notice"><Wifi size={16} /><div><strong>오프라인에서 사이트를 처음 열면 OCR을 시작할 수 없습니다.</strong><span>OCR 실행 파일과 한국어·영어 모델은 Worklazy Tools 배포 파일에서만 불러오며 외부 CDN이나 OCR 서버를 사용하지 않습니다. 선택한 PDF 내용은 브라우저 밖으로 전송되지 않습니다.</span></div></div>
              {pageCount >= ((window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760) ? 15 : 50) && <div className="pdf-large-warning"><ScanText size={16} /><span>{pageCount}페이지 문서입니다. 대형 문서도 처리할 수 있지만 모바일에서는 아래 ‘처리 페이지’에 필요한 범위만 입력하면 더 빠르고 안정적입니다.</span></div>}
              <div className="pdf-page-grid compact">{previewItems.map((item, index) => <PdfThumbnail key={item.id} item={item} file={file} outputIndex={index} draggable={false} />)}</div>
            </SectionCard>
          )}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><FileOutput size={18} /><h2>변환 설정</h2></div>
            <div className="pdf-format-grid" role="radiogroup" aria-label="PDF 변환 형식">
              {([
                ["docx", "DOCX", "문단 중심"],
                ["xlsx", "XLSX", "행·열 추정"],
                ["txt", "TXT", "텍스트만"],
                ["searchable-pdf", "검색 PDF", "OCR 레이어"],
              ] as Array<[OutputFormat, string, string]>).map(([value, label, hint]) => <button key={value} type="button" role="radio" aria-checked={format === value} className={format === value ? "selected" : ""} onClick={() => { setFormat(value); download.clearResult(); }}><strong>{label}</strong><small>{hint}</small></button>)}
            </div>
            {format !== "searchable-pdf" && <div className="pdf-summary-control"><span><Languages size={13} /> 스캔 페이지 OCR</span><SegmentedControl value={ocrMode} onChange={setOcrMode} label="OCR 적용 범위" options={[{ value: "auto", label: "자동" }, { value: "off", label: "사용 안 함" }, { value: "all", label: "전체" }]} /></div>}
            {format === "searchable-pdf" && <p className="pdf-setting-note">검색 가능한 PDF는 모든 페이지에 한국어·영어 OCR을 적용하고 이미지를 다시 구성합니다.</p>}
            <dl>
              <div><dt>페이지</dt><dd>{pageCount}개</dd></div>
              <div><dt>언어</dt><dd>한국어 + 영어</dd></div>
              <div><dt>처리 위치</dt><dd>이 브라우저</dd></div>
            </dl>
            <label className="pdf-output-field"><span>처리 페이지</span><input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={`전체 · 예: 1-5, 8 (최대 ${pageCount})`} /><small>{pageRange.trim() ? "지정" : "전체"}</small></label>
            <label className="pdf-output-field"><span>출력 파일명</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.{extension}</small></label>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><ScanText size={18} /> {format === "searchable-pdf" ? "OCR PDF 만들기" : `${format.toUpperCase()}로 변환`}</PrimaryButton>
            <p className="prototype-note">PDF는 원래 문단·표 구조가 없을 수 있어 DOCX·XLSX 배치는 좌표로 추정됩니다.</p>
          </section>
          <OperationProgress {...operation} accent="violet" title="PDF 변환·OCR 로그" />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} title={format === "searchable-pdf" ? "검색 가능한 PDF가 준비됐어요." : "변환 파일이 준비됐어요."} />}
    </>
  );
}
