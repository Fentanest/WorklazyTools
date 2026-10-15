import { useImageInputs, type ImageEntry } from "./useImageInputs";
import { imageFailureMessage } from "./imageMessages";
import type { ImageStage } from "./imageInput.ts";
import { BatchConversionPanel } from "../conversion-batch/BatchConversionPanel";
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
import { imagesToPdf } from "./pdfWorkerClient";
import { type PdfPageItem } from "./types";
import { featureMessage } from "../../i18n/featureMessages";

export function PdfImagePanel({ direction }: { direction: "image-to-pdf" | "pdf-to-image" }) {
  return direction === "image-to-pdf" ? <ImagesToPdf /> : <PdfToImages />;
}

function ImagesToPdf() {
  const language = useAppLanguage();
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => active.current?.abort(), []);
  const inputs = useImageInputs();
  const files = inputs.entries.flatMap(e => e.file ? [e.file] : []);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const preparing = inputs.entries.some(e => e.status === 'reading' || e.status === 'preview');
  const canConvert = inputs.entries.length > 0 && inputs.entries.every(e => e.file && e.stage !== "decode") && !preparing && !inputs.acquiring;
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
      disabled: busy,
      handle: ".pdf-drag-handle",
      draggable: ".pdf-image-card",
      delay: 120,
      delayOnTouchOnly: true,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        restoreSortableDom(list, oldIndex, newIndex);
        if (active.current) return;
        inputs.reorder(oldIndex, newIndex);
        download.clearResult();
      },
    });
    return () => sortable.destroy();
  }, [inputs.entries.length, busy]);

  const addFiles = async (next: File[]) => {
    if (active.current) return;
    setError(""); download.clearResult();
    await inputs.add(next);
  };

  const exportPdf = async () => {
    if (active.current || !canConvert) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setCanceling(false);
    inputs.entries.forEach(e => { if (e.stage === "embed" || e.stage === "orientation") inputs.patch(e.id, { status: e.url ? "ready" : "failed", stage: e.url ? undefined : "thumbnail" }); });
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfImagePanel.preparingImagesAsPdfPages", { p0: files.length }));
    try {
      const output = await imagesToPdf(files, pageMode, normalizeOutputName(outputName, featureMessage(language, "pdf.messages.PdfImagePanel.worklazyImagePdf")), (value, message) => { if (!controller.signal.aborted) operation.update(value, message); }, language, {}, controller.signal, inputs.entries.map(e => e.id));
      if (controller.signal.aborted) return;
      download.makeResult(output);
      operation.succeed(featureMessage(language, "pdf.messages.PdfImagePanel.createdAPdfInTheSelectedImageOrder"));
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfImagePanel.unableToConvertTheImagesToPdf");
      const detail = reason as { imageId?: string; stage?: ImageStage; errorName?: string };
      if (detail.imageId) inputs.patch(detail.imageId, { status: 'failed', stage: detail.stage });
      console.debug('image-pdf', { imageId: detail.imageId, stage: detail.stage, errorName: detail.errorName });
      setError(message);
      operation.fail(message);
    } finally {
      if (active.current === controller) { active.current = undefined; setBusy(false); setCanceling(false); }
    }
  };

  return (
    <>
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfImagePanel.addImages")} description={featureMessage(language, "pdf.messages.PdfImagePanel.addJpgAndPngImagesAndArrangeThem")} className="">
            <FileDropZone accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple files={files} onFiles={addFiles} onNewFiles={addFiles} disabled={busy || preparing || inputs.acquiring} accent="violet" hint={featureMessage(language, "pdf.messages.PdfImagePanel.chooseJpgPngImagesAtOnceOrAdd")} />
          </SectionCard>
          {(preparing || inputs.acquiring) && <div role="status" className="my-3 text-sm">
            {!preparing ? featureMessage(language, "pdf.imageInput.canceling") : featureMessage(language, "pdf.imageInput.preparing", { done: inputs.entries.filter(e => e.status === 'ready' || e.status === 'failed').length, total: inputs.entries.length })}
            <Button variant="outline" onClick={() => { inputs.cancelPreparation(); download.clearResult(); setError(""); }}>{featureMessage(language, "pdf.imageInput.cancelPreparation")}</Button>
          </div>}
          {!!inputs.entries.length && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfImagePanel.pageOrder")} description={featureMessage(language, "pdf.messages.PdfImagePanel.dragImagesToChangeThePdfPageOrder")} className="">
              <div ref={listRef} className="pdf-image-grid grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-[620px]:grid-cols-2">
                {inputs.entries.map((entry, index) => <ImageCard key={entry.id} entry={entry} index={index} disabled={busy}
                  onRemove={() => { if (active.current) return; inputs.remove(entry.id); download.clearResult(); setError(""); }}
                  onRetry={() => { if (!active.current) void inputs.retry(entry.id); }} onPreviewError={() => inputs.previewFailed(entry.id)} />)}
              </div>
            </SectionCard>
          )}
        </div>
        <aside className="sticky top-6 min-w-0 max-[820px]:static">
          <Card as="section" data-testid="pdf-output-card" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0 max-[620px]:p-[18px]">
            <div className="flex items-center gap-2 text-primary "><Images size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.pdfSettings")}</h2></div>
            <fieldset disabled={busy} className="pdf-summary-control mt-4 mb-1.5"><span className="mx-0.5 mb-2 block text-[13px] font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.pageSize")}</span><SegmentedControl value={pageMode} onChange={value => { if (!active.current) { setPageMode(value); download.clearResult(); } }} label={featureMessage(language, "pdf.messages.PdfImagePanel.imagePdfPageSize")} options={[{ value: "a4", label: featureMessage(language, "pdf.messages.PdfImagePanel.fitA4") }, { value: "image", label: featureMessage(language, "pdf.messages.PdfImagePanel.imageSize") }]} /></fieldset>
            <dl className="my-5">
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.images")} value={inputs.entries.length} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.orientation")} value={featureMessage(language, "pdf.messages.PdfImagePanel.automaticA4")} />
              <SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.cropping")} value={featureMessage(language, "pdf.messages.PdfImagePanel.none")} />
            </dl>
            <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-primary "><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.outputFileName")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" disabled={busy} value={outputName} onChange={(event) => { setOutputName(event.target.value); download.clearResult(); }} /><small className="text-xs text-muted-foreground">.pdf</small></label>
            <PrimaryButton accent="violet" disabled={!canConvert || busy} loading={busy} onClick={exportPdf}><FileImage size={18} /> {featureMessage(language, "pdf.messages.PdfImagePanel.createPdf")}</PrimaryButton>
            {busy && <p role="status" className="my-2 text-sm">{featureMessage(language, "pdf.imageInput.locked")}</p>}
            {busy && <Button variant="outline" disabled={canceling} onClick={() => { active.current?.abort(); setCanceling(true); operation.reset(); }}>{canceling ? featureMessage(language, "pdf.imageInput.canceling") : language === "ko" ? "변환 취소" : "Cancel conversion"}</Button>}
          </Card>
          <OperationProgress {...operation} accent="coral" title={featureMessage(language, "pdf.messages.PdfImagePanel.imageConversionLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function PdfToImages() {
  const language = useAppLanguage();
  const [batchFiles, setBatchFiles] = useState<File[]>();
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => active.current?.abort(), []);
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
    active.current?.abort();
    if (files.length > 1) { setFile(null); download.clearResult(); setBatchFiles(files); return; }
    const controller = new AbortController(); active.current = controller;
    const next = files.at(-1);
    if (!next || next === file) return;
    setLoading(true);
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfImagePanel.checkingPagesIn", { p0: next.name }));
    try {
      const inspected = await inspectPdf(next, language, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      operation.succeed(featureMessage(language, "pdf.messages.PdfImagePanel.loadedPages", { p0: inspected.pageCount }));
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfImagePanel.unableToReadThePdf");
      setError(message);
      operation.fail(message);
    } finally { if (active.current === controller) setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfImagePanel.startingPdfPageImageConversion"));
    try {
      const selectedPages = pageRange.trim() ? parsePageRange(pageRange, pageCount, language) : undefined;
      const output = await pdfToImageArchive(file, format, dpi, 0.9, (value, message) => { if (!controller.signal.aborted) operation.update(value, message); }, language, selectedPages, controller.signal);
      if (controller.signal.aborted) return;
      download.makeBlobResult(output.blob, output.fileName, [featureMessage(language, "pdf.messages.PdfImagePanel.morePagesAndHigherResolutionIncreaseConversionTime")]);
      const convertedCount = selectedPages?.length ?? pageCount;
      operation.succeed(featureMessage(language, "pdf.messages.PdfImagePanel.createdAZipContainingPageImages", { p0: convertedCount }));
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfImagePanel.unableToConvertThePdfToImages");
      setError(message);
      operation.fail(message);
    }
  };

  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `image-preview-${index}`, sourceId: "image-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  if (batchFiles) return <BatchConversionPanel mode="pdf-images" files={batchFiles} initialOptions={{ imageFormat: format, dpi, pageRange }} onClose={() => setBatchFiles(undefined)} />;
  return (
    <>
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfImagePanel.chooseAPdf")} description={featureMessage(language, "pdf.messages.PdfImagePanel.convertEveryPageToAHighResolutionPng")} className="">
            <FileDropZone accept=".pdf,application/pdf" multiple files={file ? [file] : []} disabled={loading || operation.status === "running"} onFiles={setInput} accent="violet" hint={language === "ko" ? "여러 PDF를 한 번에 선택할 수 있습니다." : "Choose one or more PDFs."} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { active.current?.abort(); operation.reset(); void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {!!file && <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfImagePanel.pagePreview")} description={featureMessage(language, "pdf.messages.PdfImagePanel.everyPageIsConvertedWithTheSameFormat")} className="overflow-visible "><div className="pdf-page-grid grid max-h-[610px] grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3 overflow-y-auto pr-1 [overscroll-behavior:contain] [scrollbar-gutter:stable] max-[620px]:max-h-[520px] max-[620px]:grid-cols-2" data-density="compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div></SectionCard>}
        </div>
        <aside className="sticky top-6 min-w-0 max-[820px]:static">
          <Card as="section" data-testid="pdf-output-card" className="gap-0 overflow-visible rounded-3xl border border-border p-5 py-5 shadow-sm ring-0 max-[620px]:p-[18px]">
            <div className="flex items-center gap-2 text-primary "><FileImage size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.imageSettings")}</h2></div>
            <div className="pdf-summary-control mt-4 mb-1.5"><span className="mx-0.5 mb-2 block text-[13px] font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.fileFormat")}</span><SegmentedControl value={format} onChange={setFormat} label={featureMessage(language, "pdf.messages.PdfImagePanel.outputImageFormat")} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }]} /></div>
            <UtilityField className="mt-3"><span><strong className="block text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.resolution")}</strong><small className="mt-1 block font-medium text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.higherIsSharperButSlower")}</small></span><UtilitySelect value={dpi} onChange={(event) => setDpi(Number(event.target.value) as 96 | 144 | 216)}><option value={96}>{featureMessage(language, "pdf.messages.PdfImagePanel.screen96Dpi")}</option><option value={144}>{featureMessage(language, "pdf.messages.PdfImagePanel.sharp144Dpi")}</option><option value={216}>{featureMessage(language, "pdf.messages.PdfImagePanel.highResolution216Dpi")}</option></UtilitySelect></UtilityField>
            <label className="pdf-output-field mt-3 mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-primary "><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfImagePanel.pagesToConvert")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfImagePanel.allEG13710")} /><small className="text-xs text-muted-foreground">{pageRange.trim() ? featureMessage(language, "pdf.messages.PdfImagePanel.custom") : featureMessage(language, "pdf.messages.PdfImagePanel.all")}</small></label>
            <dl className="my-5"><SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.pages")} value={pageCount} /><SummaryRow label={featureMessage(language, "pdf.messages.PdfImagePanel.output")} value="ZIP" /></dl>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><Images size={18} /> {featureMessage(language, "pdf.messages.PdfImagePanel.createImageZip")}</PrimaryButton>
            {operation.status === "running" && <Button variant="outline" onClick={() => { active.current?.abort(); operation.reset(); setLoading(false); }}>{language === "ko" ? "변환 취소" : "Cancel conversion"}</Button>}
          </Card>
          <OperationProgress {...operation} accent="coral" title={featureMessage(language, "pdf.messages.PdfImagePanel.pdfImageConversionLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function ImageCard({ entry, index, disabled, onRemove, onRetry, onPreviewError }: {
  entry: ImageEntry; index: number; disabled: boolean; onRemove: () => void; onRetry: () => void; onPreviewError: () => void;
}) {
  const language = useAppLanguage();
  return <Card as="article" data-image-id={entry.id} data-image-status={entry.status} className="pdf-image-card min-w-0 gap-0 overflow-hidden rounded-2xl border border-border bg-white/40 py-0 shadow-sm ring-0 dark:bg-white/[.025] [&.sortable-ghost]:opacity-35">
    <div className="pdf-page-card-top flex items-center justify-between border-b border-border px-2 text-muted-foreground">
      <Button disabled={disabled} className="pdf-drag-handle touch-none cursor-grab max-[620px]:size-11" variant="ghost" size="icon-sm" aria-label={featureMessage(language, "pdf.messages.PdfImagePanel.reorderImage", { p0: index+1 })}><GripVertical size={16} /></Button>
      <strong className="text-sm">{index+1}</strong>
      <Button disabled={disabled} className="pdf-image-remove text-destructive max-[620px]:size-11" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={featureMessage(language, "pdf.messages.PdfImagePanel.remove", { p0: entry.name })}><Trash2 size={15} /></Button>
    </div>
    <div className="pdf-image-preview m-2 grid aspect-4/3 place-items-center overflow-hidden rounded-lg bg-muted">
      {entry.url ? <img className="size-full object-contain" src={entry.url} alt="" loading="lazy" onError={onPreviewError} /> : <FileImage size={28} />}
    </div>
    <div className="pdf-page-source flex min-w-0 flex-col px-2.5 pb-2 text-xs">
      <strong className="truncate text-[13px]" title={entry.name}>{entry.name}</strong>
      <span>{Math.ceil(entry.size/1024)} KB</span>
      <span role="status" className="[overflow-wrap:anywhere]">{entry.stage ? imageFailureMessage(language, entry.name, index, entry.stage) : featureMessage(language, `pdf.imageInput.${entry.status}`)}</span>
      {entry.status === 'failed' && <>
        <span>{featureMessage(language, entry.file && (entry.stage === "thumbnail") ? "pdf.imageInput.previewOnly" : "pdf.imageInput.reselect")}</span>
        {entry.file && <Button disabled={disabled} variant="outline" onClick={onRetry}>{featureMessage(language, "pdf.imageInput.retry")}</Button>}
      </>}
    </div>
  </Card>;
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between border-b border-border py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="m-0 font-bold text-foreground">{value}</dd></div>;
}

function restoreSortableDom(container: HTMLElement, oldIndex: number, newIndex: number) {
  const moved = container.children.item(newIndex);
  if (!moved) return;
  container.removeChild(moved);
  container.insertBefore(moved, container.children.item(oldIndex));
}
