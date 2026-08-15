import { FileOutput, Languages, ScanText, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { PdfThumbnail } from "./PdfThumbnail";
import { extractPdfText, inspectPdf, parsePageRange, releasePdf, type PdfOcrMode } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { combineOcrPdfPages, textDocumentToOffice } from "./pdfWorkerClient";
import type { PdfPageItem } from "./types";

type OutputFormat = "docx" | "xlsx" | "txt" | "searchable-pdf";

export function PdfConvertPanel() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("docx");
  const [ocrMode, setOcrMode] = useState<PdfOcrMode>("auto");
  const [outputName, setOutputName] = useState(language === "ko" ? "Worklazy-PDF-변환" : "Worklazy-PDF-conversion");
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
    operation.start(L(`${next.name} 페이지와 보안 상태를 확인하는 중…`, `Checking pages and security settings in ${next.name}…`));
    try {
      const inspected = await inspectPdf(next, language);
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      setOutputName(`${next.name.replace(/\.pdf$/i, "")}-${L("변환", "converted")}`);
      operation.succeed(L(`${inspected.pageCount}개 페이지를 변환할 수 있습니다.`, `${inspected.pageCount} pages are ready to convert.`));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("PDF를 읽지 못했습니다.", "Unable to read the PDF.");
      setError(message);
      operation.fail(message);
    } finally { setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    setError("");
    download.clearResult();
    const searchable = format === "searchable-pdf";
    operation.start(searchable ? L("검색 가능한 텍스트 생성을 준비합니다.", "Preparing searchable text…") : L("PDF의 텍스트와 배치 좌표를 분석하는 중…", "Analyzing PDF text and layout coordinates…"));
    try {
      const selectedPageIndexes = pageRange.trim() ? parsePageRange(pageRange, pageCount, language) : undefined;
      const selectedPageCount = selectedPageIndexes?.length || pageCount;
      const extracted = await extractPdfText(file, searchable ? "all" : ocrMode, searchable, operation.update, selectedPageIndexes, language);
      if (searchable) {
        if (extracted.ocrPdfBuffers.length !== selectedPageCount) throw new Error(L("일부 페이지의 검색 가능한 PDF 데이터를 만들지 못했습니다.", "Searchable PDF data could not be created for some pages."));
        operation.update(91, L("OCR 텍스트 레이어가 포함된 페이지를 결합하는 중…", "Combining pages with OCR text layers…"));
        const output = await combineOcrPdfPages(extracted.ocrPdfBuffers, normalizeOutputName(outputName, L("Worklazy-검색-PDF", "Worklazy-searchable-PDF")), (value, message) => operation.update(91 + value * 0.08, message), language);
        download.makeResult(output);
      } else {
        if (!extracted.document.characterCount) throw new Error(L("추출된 텍스트가 없습니다. 스캔 페이지 자동 OCR을 선택해 다시 시도해 주세요.", "No text was extracted. Enable automatic OCR for scanned pages and try again."));
        operation.update(91, L(`${extracted.document.characterCount.toLocaleString()}자를 ${format.toUpperCase()} 구조로 만드는 중…`, `Building a ${format.toUpperCase()} structure from ${extracted.document.characterCount.toLocaleString()} characters…`));
        const output = await textDocumentToOffice(extracted.document, format, normalizeOutputName(outputName, L("Worklazy-PDF-변환", "Worklazy-PDF-conversion")), (value, message) => operation.update(91 + value * 0.08, message), language);
        if (extracted.ocrPageCount) output.warnings.push(L(`${extracted.ocrPageCount}개 페이지는 한국어·영어 OCR 결과를 사용했습니다.`, `${extracted.ocrPageCount} pages used Korean and English OCR results.`));
        download.makeResult(output);
      }
      operation.succeed(searchable ? L("검색과 텍스트 선택이 가능한 OCR PDF를 만들었습니다.", "Created a searchable PDF with selectable text.") : L(`${format.toUpperCase()} 변환 파일을 만들었습니다.`, `Created the ${format.toUpperCase()} file.`));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("PDF 변환을 완료하지 못했습니다.", "Unable to complete the PDF conversion.");
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
          <SectionCard step={1} title={L("PDF 선택", "Choose a PDF")} description={L("텍스트 PDF와 스캔 PDF를 DOCX·XLSX·TXT 또는 검색 가능한 PDF로 변환합니다.", "Convert text or scanned PDFs to DOCX, XLSX, TXT, or a searchable PDF.")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint={L("텍스트를 추출하거나 OCR할 PDF 하나를 선택하세요.", "Choose one PDF to extract text from or process with OCR.")} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {file && (
            <SectionCard step={2} title={L("변환 범위 확인", "Review the conversion range")} description={L("내장 텍스트를 먼저 사용하고, 필요할 때만 페이지 이미지를 OCR합니다.", "Embedded text is used first; page images are OCRed only when needed.")} className="accent-context-violet pdf-page-section">
              <div className="pdf-ocr-notice"><Wifi size={16} /><div><strong>{L("오프라인에서 사이트를 처음 열면 OCR을 시작할 수 없습니다.", "OCR cannot start during a first offline visit.")}</strong><span>{L("OCR 실행 파일과 한국어·영어 모델은 Worklazy Tools 배포 파일에서만 불러오며 외부 CDN이나 OCR 서버를 사용하지 않습니다. 선택한 PDF 내용은 브라우저 밖으로 전송되지 않습니다.", "The OCR runtime and Korean/English models load only from the Worklazy Tools deployment, with no external CDN or OCR server. Your PDF content does not leave the browser.")}</span></div></div>
              {pageCount >= ((window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760) ? 15 : 50) && <div className="pdf-large-warning"><ScanText size={16} /><span>{L(`${pageCount}페이지 문서입니다. 대형 문서도 처리할 수 있지만 모바일에서는 아래 ‘처리 페이지’에 필요한 범위만 입력하면 더 빠르고 안정적입니다.`, `This document has ${pageCount} pages. Large documents are supported, but on mobile it is faster and more reliable to enter only the required range below.`)}</span></div>}
              <div className="pdf-page-grid compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div>
            </SectionCard>
          )}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><FileOutput size={18} /><h2>{L("변환 설정", "Conversion settings")}</h2></div>
            <div className="pdf-format-grid" role="radiogroup" aria-label={L("PDF 변환 형식", "PDF conversion format")}>
              {([
                ["docx", "DOCX", L("문단 중심", "Paragraphs")],
                ["xlsx", "XLSX", L("행·열 추정", "Estimated cells")],
                ["txt", "TXT", L("텍스트만", "Text only")],
                ["searchable-pdf", L("검색 PDF", "Searchable PDF"), L("OCR 레이어", "OCR layer")],
              ] as Array<[OutputFormat, string, string]>).map(([value, label, hint]) => <button key={value} type="button" role="radio" aria-checked={format === value} className={format === value ? "selected" : ""} onClick={() => { setFormat(value); download.clearResult(); }}><strong>{label}</strong><small>{hint}</small></button>)}
            </div>
            {format !== "searchable-pdf" && <div className="pdf-summary-control"><span><Languages size={13} /> {L("스캔 페이지 OCR", "Scanned-page OCR")}</span><SegmentedControl value={ocrMode} onChange={setOcrMode} label={L("OCR 적용 범위", "OCR scope")} options={[{ value: "auto", label: L("자동", "Auto") }, { value: "off", label: L("사용 안 함", "Off") }, { value: "all", label: L("전체", "All") }]} /></div>}
            {format === "searchable-pdf" && <p className="pdf-setting-note">{L("검색 가능한 PDF는 모든 페이지에 한국어·영어 OCR을 적용하고 이미지를 다시 구성합니다.", "A searchable PDF applies Korean and English OCR to every page and rebuilds each page image.")}</p>}
            <dl>
              <div><dt>{L("페이지", "Pages")}</dt><dd>{pageCount}</dd></div>
              <div><dt>{L("언어", "Languages")}</dt><dd>{L("한국어 + 영어", "Korean + English")}</dd></div>
              <div><dt>{L("처리 위치", "Processing")}</dt><dd>{L("이 브라우저", "This browser")}</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{L("처리 페이지", "Pages to process")}</span><input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={L(`전체 · 예: 1-5, 8 (최대 ${pageCount})`, `All · e.g. 1-5, 8 (max ${pageCount})`)} /><small>{pageRange.trim() ? L("지정", "Custom") : L("전체", "All")}</small></label>
            <label className="pdf-output-field"><span>{L("출력 파일명", "Output file name")}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.{extension}</small></label>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><ScanText size={18} /> {format === "searchable-pdf" ? L("OCR PDF 만들기", "Create OCR PDF") : L(`${format.toUpperCase()}로 변환`, `Convert to ${format.toUpperCase()}`)}</PrimaryButton>
            <p className="prototype-note">{L("PDF는 원래 문단·표 구조가 없을 수 있어 DOCX·XLSX 배치는 좌표로 추정됩니다.", "PDFs may not contain original paragraph or table structure, so DOCX and XLSX layout is estimated from coordinates.")}</p>
          </section>
          <OperationProgress {...operation} accent="violet" title={L("PDF 변환·OCR 로그", "PDF conversion & OCR log")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} title={format === "searchable-pdf" ? L("검색 가능한 PDF가 준비됐어요.", "Your searchable PDF is ready.") : L("변환 파일이 준비됐어요.", "Your converted file is ready.")} />}
    </>
  );
}
