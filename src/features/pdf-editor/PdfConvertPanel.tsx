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
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfConvertPanel.chooseAPdf")} description={featureMessage(language, "pdf.messages.PdfConvertPanel.convertTextOrScannedPdfsToDocxXlsx")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint={featureMessage(language, "pdf.messages.PdfConvertPanel.chooseOnePdfToExtractTextFromOr")} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {file && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfConvertPanel.reviewTheConversionRange")} description={featureMessage(language, "pdf.messages.PdfConvertPanel.embeddedTextIsUsedFirstPageImagesAre")} className="accent-context-violet pdf-page-section">
              <div className="pdf-ocr-notice"><Wifi size={16} /><div><strong>{featureMessage(language, "pdf.messages.PdfConvertPanel.ocrCannotStartDuringAFirstOfflineVisit")}</strong><span>{featureMessage(language, "pdf.messages.PdfConvertPanel.theOcrRuntimeAndKoreanEnglishModelsLoad")}</span></div></div>
              {pageCount >= ((window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760) ? 15 : 50) && <div className="pdf-large-warning"><ScanText size={16} /><span>{featureMessage(language, "pdf.messages.PdfConvertPanel.thisDocumentHasPagesLargeDocumentsAreSupported", { p0: pageCount })}</span></div>}
              <div className="pdf-page-grid compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div>
            </SectionCard>
          )}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><FileOutput size={18} /><h2>{featureMessage(language, "pdf.messages.PdfConvertPanel.conversionSettings")}</h2></div>
            <div className="pdf-format-grid" role="radiogroup" aria-label={featureMessage(language, "pdf.messages.PdfConvertPanel.pdfConversionFormat")}>
              {([
                ["docx", "DOCX", featureMessage(language, "pdf.messages.PdfConvertPanel.paragraphs")],
                ["xlsx", "XLSX", featureMessage(language, "pdf.messages.PdfConvertPanel.estimatedCells")],
                ["txt", "TXT", featureMessage(language, "pdf.messages.PdfConvertPanel.textOnly")],
                ["searchable-pdf", featureMessage(language, "pdf.messages.PdfConvertPanel.searchablePdf"), featureMessage(language, "pdf.messages.PdfConvertPanel.ocrLayer")],
              ] as Array<[OutputFormat, string, string]>).map(([value, label, hint]) => <button key={value} type="button" role="radio" aria-checked={format === value} className={format === value ? "selected" : ""} onClick={() => { setFormat(value); download.clearResult(); }}><strong>{label}</strong><small>{hint}</small></button>)}
            </div>
            {format !== "searchable-pdf" && <div className="pdf-summary-control"><span><Languages size={13} /> {featureMessage(language, "pdf.messages.PdfConvertPanel.scannedPageOcr")}</span><SegmentedControl value={ocrMode} onChange={setOcrMode} label={featureMessage(language, "pdf.messages.PdfConvertPanel.ocrScope")} options={[{ value: "auto", label: featureMessage(language, "pdf.messages.PdfConvertPanel.auto") }, { value: "off", label: featureMessage(language, "pdf.messages.PdfConvertPanel.off") }, { value: "all", label: featureMessage(language, "pdf.messages.PdfConvertPanel.all") }]} /></div>}
            {format === "searchable-pdf" && <p className="pdf-setting-note">{featureMessage(language, "pdf.messages.PdfConvertPanel.aSearchablePdfAppliesKoreanAndEnglishOcr")}</p>}
            <dl>
              <div><dt>{featureMessage(language, "pdf.messages.PdfConvertPanel.pages")}</dt><dd>{pageCount}</dd></div>
              <div><dt>{featureMessage(language, "pdf.messages.PdfConvertPanel.languages")}</dt><dd>{featureMessage(language, "pdf.messages.PdfConvertPanel.koreanEnglish")}</dd></div>
              <div><dt>{featureMessage(language, "pdf.messages.PdfConvertPanel.processing")}</dt><dd>{featureMessage(language, "pdf.messages.PdfConvertPanel.thisBrowser")}</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{featureMessage(language, "pdf.messages.PdfConvertPanel.pagesToProcess")}</span><input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfConvertPanel.allEG158Max", { p0: pageCount })} /><small>{pageRange.trim() ? featureMessage(language, "pdf.messages.PdfConvertPanel.custom") : featureMessage(language, "pdf.messages.PdfConvertPanel.all")}</small></label>
            <label className="pdf-output-field"><span>{featureMessage(language, "pdf.messages.PdfConvertPanel.outputFileName")}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.{extension}</small></label>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><ScanText size={18} /> {format === "searchable-pdf" ? featureMessage(language, "pdf.messages.PdfConvertPanel.createOcrPdf") : featureMessage(language, "pdf.messages.PdfConvertPanel.convertTo", { p0: format.toUpperCase() })}</PrimaryButton>
            <p className="prototype-note">{featureMessage(language, "pdf.messages.PdfConvertPanel.pdfsMayNotContainOriginalParagraphOrTable")}</p>
          </section>
          <OperationProgress {...operation} accent="violet" title={featureMessage(language, "pdf.messages.PdfConvertPanel.pdfConversionOcrLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} title={format === "searchable-pdf" ? featureMessage(language, "pdf.messages.PdfConvertPanel.yourSearchablePdfIsReady") : featureMessage(language, "pdf.messages.PdfConvertPanel.yourConvertedFileIsReady")} />}
    </>
  );
}
