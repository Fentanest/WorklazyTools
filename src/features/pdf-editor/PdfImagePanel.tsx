import { FileImage, GripVertical, Images, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { UtilityField, UtilityInput, UtilitySelect } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfImagePanel.addImages")} description={featureMessage(language, "pdf.messages.PdfImagePanel.addJpgAndPngImagesAndArrangeThem")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
            <FileDropZone accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple files={files} onFiles={addFiles} accent="violet" hint={featureMessage(language, "pdf.messages.PdfImagePanel.chooseJpgPngImagesAtOnceOrAdd")} />
          </SectionCard>
          {!!files.length && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfImagePanel.pageOrder")} description={featureMessage(language, "pdf.messages.PdfImagePanel.dragImagesToChangeThePdfPageOrder")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
              <div ref={listRef} className="pdf-image-grid grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-[620px]:grid-cols-2">
                {files.map((file, index) => <ImageCard key={fileKey(file)} file={file} index={index} onRemove={() => { setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index)); download.clearResult(); }} />)}
              </div>
            </SectionCard>
          )}
        </div>
        <aside className="sticky top-6 min-w-0 max-[820px]:static">
          <Card as="section" data-testid="pdf-output-card" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0 max-[620px]:p-[18px]">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><Images size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.pdfSettings")}</h2></div>
            <div className="pdf-summary-control mt-4 mb-1.5"><span className="mx-0.5 mb-2 block text-[13px] font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.pageSize")}</span><SegmentedControl value={pageMode} onChange={setPageMode} label={featureMessage(language, "pdf.messages.PdfImagePanel.imagePdfPageSize")} options={[{ value: "a4", label: featureMessage(language, "pdf.messages.PdfImagePanel.fitA4") }, { value: "image", label: featureMessage(language, "pdf.messages.PdfImagePanel.imageSize") }]} /></div>
            <dl className="my-5">
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.images")} value={files.length} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.orientation")} value={featureMessage(language, "pdf.messages.PdfImagePanel.automaticA4")} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.cropping")} value={featureMessage(language, "pdf.messages.PdfImagePanel.none")} />
            </dl>
            <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-violet-700 dark:text-violet-300"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.outputFileName")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small className="text-xs text-muted-foreground">.pdf</small></label>
            <PrimaryButton accent="violet" disabled={!files.length || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}><FileImage size={18} /> {featureMessage(language, "pdf.messages.PdfImagePanel.createPdf")}</PrimaryButton>
          </Card>
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
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfImagePanel.chooseAPdf")} description={featureMessage(language, "pdf.messages.PdfImagePanel.convertEveryPageToAHighResolutionPng")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint={featureMessage(language, "pdf.messages.PdfImagePanel.chooseOnePdfToConvertToImages")} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {!!file && <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfImagePanel.pagePreview")} description={featureMessage(language, "pdf.messages.PdfImagePanel.everyPageIsConvertedWithTheSameFormat")} className="overflow-visible [&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20"><div className="pdf-page-grid grid max-h-[610px] grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3 overflow-y-auto pr-1 [overscroll-behavior:contain] [scrollbar-gutter:stable] max-[620px]:max-h-[520px] max-[620px]:grid-cols-2" data-density="compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div></SectionCard>}
        </div>
        <aside className="sticky top-6 min-w-0 max-[820px]:static">
          <Card as="section" data-testid="pdf-output-card" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0 max-[620px]:p-[18px]">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><FileImage size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.imageSettings")}</h2></div>
            <div className="pdf-summary-control mt-4 mb-1.5"><span className="mx-0.5 mb-2 block text-[13px] font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.fileFormat")}</span><SegmentedControl value={format} onChange={setFormat} label={featureMessage(language, "pdf.messages.PdfImagePanel.outputImageFormat")} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }]} /></div>
            <UtilityField className="mt-3"><span><strong className="block text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.resolution")}</strong><small className="mt-1 block font-medium text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.higherIsSharperButSlower")}</small></span><UtilitySelect value={dpi} onChange={(event) => setDpi(Number(event.target.value) as 96 | 144 | 216)}><option value={96}>{featureMessage(language, "pdf.messages.PdfImagePanel.screen96Dpi")}</option><option value={144}>{featureMessage(language, "pdf.messages.PdfImagePanel.sharp144Dpi")}</option><option value={216}>{featureMessage(language, "pdf.messages.PdfImagePanel.highResolution216Dpi")}</option></UtilitySelect></UtilityField>
            <label className="pdf-output-field mt-3 mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-violet-700 dark:text-violet-300"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.pagesToConvert")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfImagePanel.allEG13710")} /><small className="text-xs text-muted-foreground">{pageRange.trim() ? featureMessage(language, "pdf.messages.PdfImagePanel.custom") : featureMessage(language, "pdf.messages.PdfImagePanel.all")}</small></label>
            <dl className="my-5"><SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.pages")} value={pageCount} /><SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.output")} value="ZIP" /></dl>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><Images size={18} /> {featureMessage(language, "pdf.messages.PdfImagePanel.createImageZip")}</PrimaryButton>
          </Card>
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
  return <Card as="article" className="pdf-image-card min-w-0 gap-0 overflow-hidden rounded-2xl border border-border bg-white/40 py-0 shadow-sm ring-0 transition-[border-color,box-shadow,transform] dark:bg-white/[.025] [&.sortable-ghost]:opacity-35 [&.sortable-chosen]:border-violet-600 [&.sortable-chosen]:shadow-lg"><div className="pdf-page-card-top grid h-[33px] grid-cols-[27px_1fr_auto] items-center gap-1 border-b border-border px-2 text-muted-foreground"><Button type="button" className="pdf-drag-handle size-[27px] touch-none cursor-grab rounded-lg p-0 text-muted-foreground active:cursor-grabbing max-[620px]:size-11" variant="ghost" size="icon-xs" aria-label={featureMessage(language, "pdf.messages.PdfImagePanel.reorderImage", { p0: index + 1 })}><GripVertical size={16} /></Button><strong className="text-sm text-foreground">{index + 1}</strong><Button type="button" className="pdf-image-remove size-[27px] rounded-lg p-0 text-destructive hover:bg-destructive/10 max-[620px]:size-11" variant="ghost" size="icon-xs" onClick={onRemove} aria-label={featureMessage(language, "pdf.messages.PdfImagePanel.remove", { p0: file.name })}><Trash2 size={15} /></Button></div><div className="pdf-image-preview m-2 grid aspect-4/3 place-items-center overflow-hidden rounded-lg bg-[#e9e9ed] dark:bg-[#202023]"><img className="size-full object-contain" src={url} alt="" /></div><div className="pdf-page-source flex min-w-0 flex-col px-2.5 pt-0.5 pb-2"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-foreground">{file.name}</strong><small className="mt-1 text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</small></div></Card>;
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between border-b border-border py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="m-0 font-bold text-foreground">{value}</dd></div>;
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
