import { BatchConversionPanel } from "../conversion-batch/BatchConversionPanel";
import { FileOutput, Languages, ScanText, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { UtilityInput, UtilityNotice } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, parsePageRange, releasePdf, type PdfOcrMode } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { convertPdfDocument, type PdfOutputMode } from "./pdfConversionCore";
import type { PdfPageItem } from "./types";
import { featureMessage } from "../../i18n/featureMessages";
import { PdfConversionError } from "./pdfConversionErrors";
import { pdfConversionMessage } from "./pdfConversionMessages";

type OutputFormat = "docx" | "xlsx" | "txt" | "pptx" | "hwpx" | "searchable-pdf";

import { DirectEntryConfirmation, DirectEntryNotice } from "../../components/DirectEntryNotice";
import { pdfConvertDirty, type PdfConvertPreset } from "./pdfConvertDirect";
import { usePdfConvert } from "./pdfConvertDirectLifecycle";
export function PdfConvertPanel({ preset }: { preset?: PdfConvertPreset }) {
  const language = useAppLanguage();
  const [batchFiles, setBatchFiles] = useState<File[]>();
  const batchInputs = useRef<File[]>([]);
  const [batchGeneration, setBatchGeneration] = useState(0);
    const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("docx");
  const [ocrLayout, setOcrLayout] = useState<"sparse" | "paragraphs">("sparse");
  const [ocrMode, setOcrMode] = useState<PdfOcrMode>("auto");
  const [outputMode, setOutputMode] = useState<PdfOutputMode>("editable");
  const [outputName, setOutputName] = useState(featureMessage(language, "pdf.messages.PdfConvertPanel.worklazyPdfConversion"));
  const [pageRange, setPageRange] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const operation = useOperationProgress();
  const download = useDownloadResult();

  const pendingInputs = useRef<File[]>([]);
  const inputTask = useRef<Promise<void>>(Promise.resolve());
  const inputHandler = useRef<((files: File[]) => Promise<void>) | undefined>(undefined);
  const resumeGeneration = useRef(0);
  const activeController = useRef<AbortController | undefined>(undefined);
  const direct = usePdfConvert(preset, Boolean(batchFiles) || pdfConvertDirty({ file, loading, status: operation.status, result: download.result }), next => {
    if (batchFiles) { setBatchFiles([...batchInputs.current]); setBatchGeneration(value => value + 1); }
    const resume = pendingInputs.current;
    const generation = ++resumeGeneration.current;
    activeController.current?.abort();
    if (resume.length) void inputTask.current.then(() => { if (generation === resumeGeneration.current) void inputHandler.current?.(resume); });
    setLoading(false);
    operation.reset();
    download.clearResult();
    setError("");
    setFormat(next?.format ?? "docx");
    setPageRange(next?.pageRange ?? "");
    if (!next || next.purpose === "convert") setOcrMode(next?.ocrMode ?? "auto");
  });
  useEffect(() => () => { resumeGeneration.current += 1; activeController.current?.abort(); }, []);
  useEffect(() => () => { if (file) void releasePdf(file); }, [file]);

  const acquireInput = async (files: File[]) => {
    const next = files.at(-1);
    if (!next || next === file) return;
    activeController.current?.abort();
    pendingInputs.current = [next];
    const controller = new AbortController();
    activeController.current = controller;
    setLoading(true);
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfConvertPanel.checkingPagesAndSecuritySettingsIn", { p0: next.name }));
    try {
      const inspected = await inspectPdf(next, language, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      setOutputName(`${next.name.replace(/\.pdf$/i, "")}-${featureMessage(language, "pdf.messages.PdfConvertPanel.converted")}`);
      operation.succeed(featureMessage(language, "pdf.messages.PdfConvertPanel.pagesAreReadyToConvert", { p0: inspected.pageCount }));
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = pdfConversionMessage(reason, language, "INPUT");
      setError(message);
      operation.fail(message);
    } finally { if (activeController.current === controller) { setLoading(false); pendingInputs.current = []; } }
  };

  const setInput = (files: File[]) => {
    if (files.length > 1) { activeController.current?.abort(); setFile(null); download.clearResult(); setBatchFiles(files); return Promise.resolve(); }
    const task = acquireInput(files);
    inputTask.current = task;
    return task;
  };
  inputHandler.current = setInput;

  const convert = async () => {
    if (!file) return;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const update = (...args: Parameters<typeof operation.update>) => { if (!controller.signal.aborted) operation.update(...args); };
    setError("");
    download.clearResult();
    const searchable = format === "searchable-pdf";
    operation.start(searchable ? featureMessage(language, "pdf.messages.PdfConvertPanel.preparingSearchableText") : featureMessage(language, "pdf.messages.PdfConvertPanel.analyzingPdfTextAndLayoutCoordinates"));
    try {
      let selectedPageIndexes: number[] | undefined;
      try { selectedPageIndexes = pageRange.trim() ? parsePageRange(pageRange, pageCount, language) : undefined; }
      catch { throw new PdfConversionError("INVALID_RANGE", { count: pageCount }); }
      const output = await convertPdfDocument({ source: file, fileName: normalizeOutputName(outputName, featureMessage(language, "pdf.messages.PdfConvertPanel.worklazyPdfConversion")), format, selectedPageIndexes, ocrMode: searchable ? "all" : ocrMode, ocrLanguage: "kor+eng", ocrLayout, outputMode, language, signal: controller.signal, onProgress: update });
      if (controller.signal.aborted) return;
      download.makeBlobResult(output.blob, output.fileName, output.warnings);
      operation.succeed(searchable ? featureMessage(language, "pdf.messages.PdfConvertPanel.createdASearchablePdfWithSelectableText") : featureMessage(language, "pdf.messages.PdfConvertPanel.createdTheFile", { p0: format.toUpperCase() }));
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = pdfConversionMessage(reason, language);
      setError(message);
      operation.fail(message);
    }
  };

  const extension = format === "searchable-pdf" ? "pdf" : format;
  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `convert-${index}`, sourceId: "convert-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  if (batchFiles) return <><DirectEntryConfirmation open={direct.pending} onAccept={direct.accept} onReject={direct.reject} /><BatchConversionPanel key={batchGeneration} mode="pdf-document" files={batchFiles} onFilesChange={files => { batchInputs.current = files; }} initialOptions={{ format, ocrMode, ocrLayout, outputMode, pageRange }} onClose={() => setBatchFiles(undefined)} /></>;
  return (
    <>
      <DirectEntryConfirmation open={direct.pending} onAccept={direct.accept} onReject={direct.reject} />
      {direct.acceptedPreset && <DirectEntryNotice purpose={direct.acceptedPreset.purpose} title={language === "ko" ? (direct.acceptedPreset.purpose === "ocr" ? "PDF OCR" : "PDF 변환") : (direct.acceptedPreset.purpose === "ocr" ? "Make a searchable PDF" : "Convert a PDF")} description={language === "ko" ? (direct.acceptedPreset.purpose === "ocr" ? "모든 페이지에 문자 인식을 적용하여 검색 가능한 PDF를 만드세요." : "PDF를 DOCX 등 다른 형식으로 저장하세요.") : (direct.acceptedPreset.purpose === "ocr" ? "Recognize text on all pages and create a searchable PDF." : "Save a PDF as DOCX or another format.")} />}
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfConvertPanel.chooseAPdf")} description={featureMessage(language, "pdf.messages.PdfConvertPanel.convertTextOrScannedPdfsToDocxXlsx")} className="">
            <FileDropZone accept=".pdf,application/pdf" multiple files={[]} onFiles={setInput} accent="violet" hint={language === "ko" ? "여러 PDF를 한 번에 선택할 수 있습니다." : "Choose one or more PDFs."} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { activeController.current?.abort(); void releasePdf(file); setLoading(false); operation.reset(); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {file && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfConvertPanel.reviewTheConversionRange")} description={featureMessage(language, "pdf.messages.PdfConvertPanel.embeddedTextIsUsedFirstPageImagesAre")} className="overflow-visible ">
              <UtilityNotice className="mb-4" kind="info"><div className="flex flex-col"><strong className="text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.ocrCannotStartDuringAFirstOfflineVisit")}</strong><span className="mt-1">{featureMessage(language, "pdf.messages.PdfConvertPanel.theOcrRuntimeAndKoreanEnglishModelsLoad")}</span></div></UtilityNotice>
              {pageCount >= ((window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760) ? 15 : 50) && <UtilityNotice className="mb-4"><ScanText className="mt-0.5 shrink-0" size={16} /><span>{featureMessage(language, "pdf.messages.PdfConvertPanel.thisDocumentHasPagesLargeDocumentsAreSupported", { p0: pageCount })}</span></UtilityNotice>}
              <div className="pdf-page-grid grid max-h-[610px] grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3 overflow-y-auto pr-1 [overscroll-behavior:contain] [scrollbar-gutter:stable] max-[620px]:max-h-[520px] max-[620px]:grid-cols-2" data-density="compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div>
            </SectionCard>
          )}
        </div>
        <aside className="sticky top-6 min-w-0 max-[820px]:static">
          <Card as="section" data-testid="pdf-output-card" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0 max-[620px]:p-[18px]">
            <div className="flex items-center gap-2 text-primary "><FileOutput size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.conversionSettings")}</h2></div>
            <div className="pdf-format-grid my-4 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={featureMessage(language, "pdf.messages.PdfConvertPanel.pdfConversionFormat")}>
              {([
                ["docx", "DOCX", featureMessage(language, "pdf.messages.PdfConvertPanel.paragraphs")],
                ["xlsx", "XLSX", featureMessage(language, "pdf.messages.PdfConvertPanel.estimatedCells")],
                ["pptx", "PPTX", language === "ko" ? "편집 가능한 슬라이드" : "Editable slides"],
                ["hwpx", "HWPX", language === "ko" ? "편집 가능한 문단" : "Editable paragraphs"],
                ["txt", "TXT", featureMessage(language, "pdf.messages.PdfConvertPanel.textOnly")],
                ["searchable-pdf", featureMessage(language, "pdf.messages.PdfConvertPanel.searchablePdf"), featureMessage(language, "pdf.messages.PdfConvertPanel.ocrLayer")],
              ] as Array<[OutputFormat, string, string]>).map(([value, label, hint]) => { const selected = format === value; return <Button key={value} type="button" disabled={operation.status === "running"} role="radio" aria-checked={selected} data-selected={selected || undefined} variant="outline" className={cn("min-h-[52px] flex-col items-start justify-center gap-1 rounded-xl px-2.5 py-2 text-left", selected ? "border-primary bg-primary/10 text-foreground hover:bg-primary/15 " : "border-transparent bg-muted text-muted-foreground")} onClick={() => { setFormat(value); download.clearResult(); }}><strong className="text-sm">{label}</strong><small className="text-xs text-muted-foreground">{hint}</small></Button>; })}
            </div>
            {format !== "searchable-pdf" && <div className="pdf-summary-control mt-4 mb-1.5"><span className="mx-0.5 mb-2 flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground"><Languages size={13} /> {featureMessage(language, "pdf.messages.PdfConvertPanel.scannedPageOcr")}</span><SegmentedControl value={ocrMode} onChange={setOcrMode} label={featureMessage(language, "pdf.messages.PdfConvertPanel.ocrScope")} options={[{ value: "auto", label: featureMessage(language, "pdf.messages.PdfConvertPanel.auto") }, { value: "off", label: featureMessage(language, "pdf.messages.PdfConvertPanel.off") }, { value: "all", label: featureMessage(language, "pdf.messages.PdfConvertPanel.all") }]} /></div>}
            {(["docx", "pptx", "hwpx"] as OutputFormat[]).includes(format) && <label className="mt-3 grid gap-2 text-sm text-muted-foreground">{language === "ko" ? "출력 방식" : "Output mode"}<select disabled={operation.status === "running"} aria-label={language === "ko" ? "출력 방식" : "Output mode"} className="min-h-10 rounded-lg border border-border bg-background px-2 text-foreground" value={outputMode} onChange={event => { setOutputMode(event.target.value as PdfOutputMode); download.clearResult(); }}><option value="editable">{language === "ko" ? "편집 가능한 내용" : "Editable content"}</option><option value="page-image">{language === "ko" ? "페이지 모양 유지 · 글자 편집 불가" : "Preserve page appearance · text not editable"}</option></select></label>}
            {format === "searchable-pdf" && <p className="mt-3 rounded-xl bg-primary/10 p-2.5 text-xs leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.aSearchablePdfAppliesKoreanAndEnglishOcr")}</p>}
            {(format === "searchable-pdf" || ocrMode !== "off") && <label className="mt-3 grid gap-2 text-sm text-muted-foreground">{language === "ko" ? "OCR 글 배치" : "OCR text layout"}<select disabled={operation.status === "running"} aria-label={language === "ko" ? "OCR 글 배치" : "OCR text layout"} className="min-h-10 rounded-lg border border-border bg-background px-2 text-foreground" value={ocrLayout} onChange={event => { setOcrLayout(event.target.value as "sparse" | "paragraphs"); download.clearResult(); }}><option value="sparse">{language === "ko" ? "표·흩어진 글자" : "Tables / scattered text"}</option><option value="paragraphs">{language === "ko" ? "연속된 문단" : "Continuous paragraphs"}</option></select><span className="text-xs">{language === "ko" ? "인식한 숫자·읽기 순서를 원본과 대조하세요. 누락되면 다른 배치로 다시 시도하세요." : "Check numbers and reading order against the original. Try the other layout if text is missing."}</span></label>}
            <dl className="my-5">
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfConvertPanel.pages")} value={pageCount} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfConvertPanel.languages")} value={featureMessage(language, "pdf.messages.PdfConvertPanel.koreanEnglish")} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfConvertPanel.processing")} value={featureMessage(language, "pdf.messages.PdfConvertPanel.thisBrowser")} />
            </dl>
            <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-primary "><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.pagesToProcess")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfConvertPanel.allEG158Max", { p0: pageCount })} /><small className="text-xs text-muted-foreground">{pageRange.trim() ? featureMessage(language, "pdf.messages.PdfConvertPanel.custom") : featureMessage(language, "pdf.messages.PdfConvertPanel.all")}</small></label>
            <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-primary "><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.outputFileName")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small className="text-xs text-muted-foreground">.{extension}</small></label>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><ScanText size={18} /> {format === "searchable-pdf" ? featureMessage(language, "pdf.messages.PdfConvertPanel.createOcrPdf") : featureMessage(language, "pdf.messages.PdfConvertPanel.convertTo", { p0: format.toUpperCase() })}</PrimaryButton>
            {operation.status === "running" && <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => { activeController.current?.abort(); operation.reset(); download.clearResult(); }}>{language === "ko" ? "변환 취소" : "Cancel conversion"}</Button>}
            <p className="mx-0.5 mt-3 text-center text-sm leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.pdfsMayNotContainOriginalParagraphOrTable")}</p>
          </Card>
          <OperationProgress {...operation} accent="coral" title={featureMessage(language, "pdf.messages.PdfConvertPanel.pdfConversionOcrLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} title={format === "searchable-pdf" ? featureMessage(language, "pdf.messages.PdfConvertPanel.yourSearchablePdfIsReady") : featureMessage(language, "pdf.messages.PdfConvertPanel.yourConvertedFileIsReady")} />}
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between border-b border-border py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="m-0 font-bold text-foreground">{value}</dd></div>;
}
