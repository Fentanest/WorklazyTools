import { FileImage, GripVertical, Images, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, parsePageRange, pdfToImageArchive, releasePdf } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { movePdfItem as moveItem } from "./pdfShared";
import { imagesToPdf } from "./pdfWorkerClient";
import { createLocalId, type PdfPageItem } from "./types";
import { featureMessage } from "../../i18n/featureMessages";

export function PdfImagePanel({ direction }: { direction: "image-to-pdf" | "pdf-to-image" }) {
  return direction === "image-to-pdf" ? <ImagesToPdf /> : <PdfToImages />;
}

function ImagesToPdf() {
  const language = useAppLanguage();
    const [files, setFiles] = useState<File[]>([]);
  const [pageMode, setPageMode] = useState<"a4" | "image">("a4");
  const [outputName, setOutputName] = useState(featureMessage(language, "pdf.messages.PdfImagePanel.worklazyImagePdf"));
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const operation = useOperationProgress();
  const download = useDownloadResult();

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const sortable = Sortable.create(list, {
      animation: 170,
      handle: ".pdf-drag-handle",
      draggable: ".pdf-image-card",
      delay: 120,
      delayOnTouchOnly: true,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        restoreSortableDom(list, oldIndex, newIndex);
        setFiles((current) => moveItem(current, oldIndex, newIndex));
        download.clearResult();
      },
    });
    return () => sortable.destroy();
  }, [files.length]);

  const addFiles = (next: File[]) => {
    const invalid = next.find((file) => !/\.(png|jpe?g)$/i.test(file.name));
    if (invalid) {
      setError(featureMessage(language, "pdf.messages.PdfImagePanel.onlyJpgAndPngImagesAreSupported", { p0: invalid.name }));
      return;
    }
    setError("");
    setFiles(next);
    download.clearResult();
  };

  const exportPdf = async () => {
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfImagePanel.preparingImagesAsPdfPages", { p0: files.length }));
    try {
      const output = await imagesToPdf(files, pageMode, normalizeOutputName(outputName, featureMessage(language, "pdf.messages.PdfImagePanel.worklazyImagePdf")), operation.update, language);
      download.makeResult(output);
      operation.succeed(featureMessage(language, "pdf.messages.PdfImagePanel.createdAPdfInTheSelectedImageOrder"));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfImagePanel.unableToConvertTheImagesToPdf");
      setError(message);
      operation.fail(message);
    }
  };

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfImagePanel.addImages")} description={featureMessage(language, "pdf.messages.PdfImagePanel.addJpgAndPngImagesAndArrangeThem")} className="accent-context-violet">
            <FileDropZone accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple files={files} onFiles={addFiles} accent="violet" hint={featureMessage(language, "pdf.messages.PdfImagePanel.chooseJpgPngImagesAtOnceOrAdd")} />
          </SectionCard>
          {!!files.length && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfImagePanel.pageOrder")} description={featureMessage(language, "pdf.messages.PdfImagePanel.dragImagesToChangeThePdfPageOrder")} className="accent-context-violet">
              <div ref={listRef} className="pdf-image-grid">
                {files.map((file, index) => <ImageCard key={fileKey(file)} file={file} index={index} onRemove={() => { setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index)); download.clearResult(); }} />)}
              </div>
            </SectionCard>
          )}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><Images size={18} /><h2>{featureMessage(language, "pdf.messages.PdfImagePanel.pdfSettings")}</h2></div>
            <div className="pdf-summary-control"><span>{featureMessage(language, "pdf.messages.PdfImagePanel.pageSize")}</span><SegmentedControl value={pageMode} onChange={setPageMode} label={featureMessage(language, "pdf.messages.PdfImagePanel.imagePdfPageSize")} options={[{ value: "a4", label: featureMessage(language, "pdf.messages.PdfImagePanel.fitA4") }, { value: "image", label: featureMessage(language, "pdf.messages.PdfImagePanel.imageSize") }]} /></div>
            <dl>
              <div><dt>{featureMessage(language, "pdf.messages.PdfImagePanel.images")}</dt><dd>{files.length}</dd></div>
              <div><dt>{featureMessage(language, "pdf.messages.PdfImagePanel.orientation")}</dt><dd>{featureMessage(language, "pdf.messages.PdfImagePanel.automaticA4")}</dd></div>
              <div><dt>{featureMessage(language, "pdf.messages.PdfImagePanel.cropping")}</dt><dd>{featureMessage(language, "pdf.messages.PdfImagePanel.none")}</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{featureMessage(language, "pdf.messages.PdfImagePanel.outputFileName")}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.pdf</small></label>
            <PrimaryButton accent="violet" disabled={!files.length || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}><FileImage size={18} /> {featureMessage(language, "pdf.messages.PdfImagePanel.createPdf")}</PrimaryButton>
          </section>
          <OperationProgress {...operation} accent="violet" title={featureMessage(language, "pdf.messages.PdfImagePanel.imageConversionLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function PdfToImages() {
  const language = useAppLanguage();
    const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<96 | 144 | 216>(144);
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
    operation.start(featureMessage(language, "pdf.messages.PdfImagePanel.checkingPagesIn", { p0: next.name }));
    try {
      const inspected = await inspectPdf(next, language);
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      operation.succeed(featureMessage(language, "pdf.messages.PdfImagePanel.loadedPages", { p0: inspected.pageCount }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfImagePanel.unableToReadThePdf");
      setError(message);
      operation.fail(message);
    } finally { setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfImagePanel.startingPdfPageImageConversion"));
    try {
      const selectedPages = pageRange.trim() ? parsePageRange(pageRange, pageCount, language) : undefined;
      const output = await pdfToImageArchive(file, format, dpi, 0.9, operation.update, language, selectedPages);
      download.makeBlobResult(output.blob, output.fileName, [featureMessage(language, "pdf.messages.PdfImagePanel.morePagesAndHigherResolutionIncreaseConversionTime")]);
      const convertedCount = selectedPages?.length ?? pageCount;
      operation.succeed(featureMessage(language, "pdf.messages.PdfImagePanel.createdAZipContainingPageImages", { p0: convertedCount }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfImagePanel.unableToConvertThePdfToImages");
      setError(message);
      operation.fail(message);
    }
  };

  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `image-preview-${index}`, sourceId: "image-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfImagePanel.chooseAPdf")} description={featureMessage(language, "pdf.messages.PdfImagePanel.convertEveryPageToAHighResolutionPng")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint={featureMessage(language, "pdf.messages.PdfImagePanel.chooseOnePdfToConvertToImages")} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {!!file && <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfImagePanel.pagePreview")} description={featureMessage(language, "pdf.messages.PdfImagePanel.everyPageIsConvertedWithTheSameFormat")} className="accent-context-violet pdf-page-section"><div className="pdf-page-grid compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div></SectionCard>}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><FileImage size={18} /><h2>{featureMessage(language, "pdf.messages.PdfImagePanel.imageSettings")}</h2></div>
            <div className="pdf-summary-control"><span>{featureMessage(language, "pdf.messages.PdfImagePanel.fileFormat")}</span><SegmentedControl value={format} onChange={setFormat} label={featureMessage(language, "pdf.messages.PdfImagePanel.outputImageFormat")} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }]} /></div>
            <label className="settings-row select-row"><span><strong>{featureMessage(language, "pdf.messages.PdfImagePanel.resolution")}</strong><small>{featureMessage(language, "pdf.messages.PdfImagePanel.higherIsSharperButSlower")}</small></span><select value={dpi} onChange={(event) => setDpi(Number(event.target.value) as 96 | 144 | 216)}><option value={96}>{featureMessage(language, "pdf.messages.PdfImagePanel.screen96Dpi")}</option><option value={144}>{featureMessage(language, "pdf.messages.PdfImagePanel.sharp144Dpi")}</option><option value={216}>{featureMessage(language, "pdf.messages.PdfImagePanel.highResolution216Dpi")}</option></select></label>
            <label className="pdf-output-field"><span>{featureMessage(language, "pdf.messages.PdfImagePanel.pagesToConvert")}</span><input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfImagePanel.allEG13710")} /><small>{pageRange.trim() ? featureMessage(language, "pdf.messages.PdfImagePanel.custom") : featureMessage(language, "pdf.messages.PdfImagePanel.all")}</small></label>
            <dl><div><dt>{featureMessage(language, "pdf.messages.PdfImagePanel.pages")}</dt><dd>{pageCount}</dd></div><div><dt>{featureMessage(language, "pdf.messages.PdfImagePanel.output")}</dt><dd>ZIP</dd></div></dl>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><Images size={18} /> {featureMessage(language, "pdf.messages.PdfImagePanel.createImageZip")}</PrimaryButton>
          </section>
          <OperationProgress {...operation} accent="violet" title={featureMessage(language, "pdf.messages.PdfImagePanel.pdfImageConversionLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function ImageCard({ file, index, onRemove }: { file: File; index: number; onRemove: () => void }) {
  const language = useAppLanguage();
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <article className="pdf-image-card"><div className="pdf-page-card-top"><button type="button" className="pdf-drag-handle" aria-label={featureMessage(language, "pdf.messages.PdfImagePanel.reorderImage", { p0: index + 1 })}><GripVertical size={16} /></button><strong>{index + 1}</strong><button type="button" className="pdf-image-remove" onClick={onRemove} aria-label={featureMessage(language, "pdf.messages.PdfImagePanel.remove", { p0: file.name })}><Trash2 size={15} /></button></div><div className="pdf-image-preview"><img src={url} alt="" /></div><div className="pdf-page-source"><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div></article>;
}

const imageFileIds = new WeakMap<File, string>();
function fileKey(file: File) {
  let id = imageFileIds.get(file);
  if (!id) { id = createLocalId("pdf-image"); imageFileIds.set(file, id); }
  return id;
}

function restoreSortableDom(container: HTMLElement, oldIndex: number, newIndex: number) {
  const moved = container.children.item(newIndex);
  if (!moved) return;
  container.removeChild(moved);
  container.insertBefore(moved, container.children.item(oldIndex));
}
