import { FileOutput, Languages, ScanText, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { UtilityInput, UtilityNotice } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { PdfThumbnail } from "./PdfThumbnail";
import { extractPdfText, inspectPdf, parsePageRange, releasePdf, type PdfOcrMode } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { combineOcrPdfPages, textDocumentToOffice } from "./pdfWorkerClient";
import type { PdfPageItem } from "./types";
import { featureMessage } from "../../i18n/featureMessages";

type OutputFormat = "docx" | "xlsx" | "txt" | "searchable-pdf";

export function PdfConvertPanel() {
  const language = useAppLanguage();
    const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("docx");
  const [ocrMode, setOcrMode] = useState<PdfOcrMode>("auto");
  const [outputName, setOutputName] = useState(featureMessage(language, "pdf.messages.PdfConvertPanel.worklazyPdfConversion"));
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
    operation.start(featureMessage(language, "pdf.messages.PdfConvertPanel.checkingPagesAndSecuritySettingsIn", { p0: next.name }));
    try {
      const inspected = await inspectPdf(next, language);
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      setOutputName(`${next.name.replace(/\.pdf$/i, "")}-${featureMessage(language, "pdf.messages.PdfConvertPanel.converted")}`);
      operation.succeed(featureMessage(language, "pdf.messages.PdfConvertPanel.pagesAreReadyToConvert", { p0: inspected.pageCount }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfConvertPanel.unableToReadThePdf");
      setError(message);
      operation.fail(message);
    } finally { setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    setError("");
    download.clearResult();
    const searchable = format === "searchable-pdf";
    operation.start(searchable ? featureMessage(language, "pdf.messages.PdfConvertPanel.preparingSearchableText") : featureMessage(language, "pdf.messages.PdfConvertPanel.analyzingPdfTextAndLayoutCoordinates"));
    try {
      const selectedPageIndexes = pageRange.trim() ? parsePageRange(pageRange, pageCount, language) : undefined;
      const selectedPageCount = selectedPageIndexes?.length || pageCount;
      const extracted = await extractPdfText(file, searchable ? "all" : ocrMode, searchable, operation.update, selectedPageIndexes, language);
      if (searchable) {
        if (extracted.ocrPdfBuffers.length !== selectedPageCount) throw new Error(featureMessage(language, "pdf.messages.PdfConvertPanel.searchablePdfDataCouldNotBeCreatedFor"));
        operation.update(91, featureMessage(language, "pdf.messages.PdfConvertPanel.combiningPagesWithOcrTextLayers"));
        const output = await combineOcrPdfPages(extracted.ocrPdfBuffers, normalizeOutputName(outputName, featureMessage(language, "pdf.messages.PdfConvertPanel.worklazySearchablePdf")), (value, message) => operation.update(91 + value * 0.08, message), language);
        download.makeResult(output);
      } else {
        if (!extracted.document.characterCount) throw new Error(featureMessage(language, "pdf.messages.PdfConvertPanel.noTextWasExtractedEnableAutomaticOcrFor"));
        operation.update(91, featureMessage(language, "pdf.messages.PdfConvertPanel.buildingAStructureFromCharacters", { p0: extracted.document.characterCount.toLocaleString(), p1: format.toUpperCase() }));
        const output = await textDocumentToOffice(extracted.document, format, normalizeOutputName(outputName, featureMessage(language, "pdf.messages.PdfConvertPanel.worklazyPdfConversion")), (value, message) => operation.update(91 + value * 0.08, message), language);
        if (extracted.ocrPageCount) output.warnings.push(featureMessage(language, "pdf.messages.PdfConvertPanel.pagesUsedKoreanAndEnglishOcrResults", { p0: extracted.ocrPageCount }));
        download.makeResult(output);
      }
      operation.succeed(searchable ? featureMessage(language, "pdf.messages.PdfConvertPanel.createdASearchablePdfWithSelectableText") : featureMessage(language, "pdf.messages.PdfConvertPanel.createdTheFile", { p0: format.toUpperCase() }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfConvertPanel.unableToCompleteThePdfConversion");
      setError(message);
      operation.fail(message);
    }
  };

  const extension = format === "searchable-pdf" ? "pdf" : format;
  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `convert-${index}`, sourceId: "convert-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  return (
    <>
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfConvertPanel.chooseAPdf")} description={featureMessage(language, "pdf.messages.PdfConvertPanel.convertTextOrScannedPdfsToDocxXlsx")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint={featureMessage(language, "pdf.messages.PdfConvertPanel.chooseOnePdfToExtractTextFromOr")} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {file && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfConvertPanel.reviewTheConversionRange")} description={featureMessage(language, "pdf.messages.PdfConvertPanel.embeddedTextIsUsedFirstPageImagesAre")} className="overflow-visible [&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
              <UtilityNotice className="mb-4 bg-violet-500/10 text-muted-foreground"><Wifi className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300" size={16} /><div className="flex flex-col"><strong className="text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.ocrCannotStartDuringAFirstOfflineVisit")}</strong><span className="mt-1">{featureMessage(language, "pdf.messages.PdfConvertPanel.theOcrRuntimeAndKoreanEnglishModelsLoad")}</span></div></UtilityNotice>
              {pageCount >= ((window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760) ? 15 : 50) && <UtilityNotice className="mb-4"><ScanText className="mt-0.5 shrink-0" size={16} /><span>{featureMessage(language, "pdf.messages.PdfConvertPanel.thisDocumentHasPagesLargeDocumentsAreSupported", { p0: pageCount })}</span></UtilityNotice>}
              <div className="pdf-page-grid grid max-h-[610px] grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3 overflow-y-auto pr-1 [overscroll-behavior:contain] [scrollbar-gutter:stable] max-[620px]:max-h-[520px] max-[620px]:grid-cols-2" data-density="compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div>
            </SectionCard>
          )}
        </div>
        <aside className="sticky top-6 min-w-0 max-[820px]:static">
          <Card as="section" data-testid="pdf-output-card" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0 max-[620px]:p-[18px]">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><FileOutput size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.conversionSettings")}</h2></div>
            <div className="pdf-format-grid my-4 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={featureMessage(language, "pdf.messages.PdfConvertPanel.pdfConversionFormat")}>
              {([
                ["docx", "DOCX", featureMessage(language, "pdf.messages.PdfConvertPanel.paragraphs")],
                ["xlsx", "XLSX", featureMessage(language, "pdf.messages.PdfConvertPanel.estimatedCells")],
                ["txt", "TXT", featureMessage(language, "pdf.messages.PdfConvertPanel.textOnly")],
                ["searchable-pdf", featureMessage(language, "pdf.messages.PdfConvertPanel.searchablePdf"), featureMessage(language, "pdf.messages.PdfConvertPanel.ocrLayer")],
              ] as Array<[OutputFormat, string, string]>).map(([value, label, hint]) => { const selected = format === value; return <Button key={value} type="button" role="radio" aria-checked={selected} data-selected={selected || undefined} variant="outline" className={cn("min-h-[52px] flex-col items-start justify-center gap-1 rounded-xl px-2.5 py-2 text-left", selected ? "border-violet-600 bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 dark:text-violet-300" : "border-transparent bg-muted text-muted-foreground")} onClick={() => { setFormat(value); download.clearResult(); }}><strong className="text-sm">{label}</strong><small className="text-xs text-muted-foreground">{hint}</small></Button>; })}
            </div>
            {format !== "searchable-pdf" && <div className="pdf-summary-control mt-4 mb-1.5"><span className="mx-0.5 mb-2 flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground"><Languages size={13} /> {featureMessage(language, "pdf.messages.PdfConvertPanel.scannedPageOcr")}</span><SegmentedControl value={ocrMode} onChange={setOcrMode} label={featureMessage(language, "pdf.messages.PdfConvertPanel.ocrScope")} options={[{ value: "auto", label: featureMessage(language, "pdf.messages.PdfConvertPanel.auto") }, { value: "off", label: featureMessage(language, "pdf.messages.PdfConvertPanel.off") }, { value: "all", label: featureMessage(language, "pdf.messages.PdfConvertPanel.all") }]} /></div>}
            {format === "searchable-pdf" && <p className="mt-3 rounded-xl bg-violet-500/10 p-2.5 text-xs leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.aSearchablePdfAppliesKoreanAndEnglishOcr")}</p>}
            <dl className="my-5">
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfConvertPanel.pages")} value={pageCount} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfConvertPanel.languages")} value={featureMessage(language, "pdf.messages.PdfConvertPanel.koreanEnglish")} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfConvertPanel.processing")} value={featureMessage(language, "pdf.messages.PdfConvertPanel.thisBrowser")} />
            </dl>
            <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-violet-700 dark:text-violet-300"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.pagesToProcess")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfConvertPanel.allEG158Max", { p0: pageCount })} /><small className="text-xs text-muted-foreground">{pageRange.trim() ? featureMessage(language, "pdf.messages.PdfConvertPanel.custom") : featureMessage(language, "pdf.messages.PdfConvertPanel.all")}</small></label>
            <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-violet-700 dark:text-violet-300"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.outputFileName")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small className="text-xs text-muted-foreground">.{extension}</small></label>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><ScanText size={18} /> {format === "searchable-pdf" ? featureMessage(language, "pdf.messages.PdfConvertPanel.createOcrPdf") : featureMessage(language, "pdf.messages.PdfConvertPanel.convertTo", { p0: format.toUpperCase() })}</PrimaryButton>
            <p className="mx-0.5 mt-3 text-center text-sm leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfConvertPanel.pdfsMayNotContainOriginalParagraphOrTable")}</p>
          </Card>
          <OperationProgress {...operation} accent="violet" title={featureMessage(language, "pdf.messages.PdfConvertPanel.pdfConversionOcrLog")} />
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
