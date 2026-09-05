import { ArrowDownToLine, ArrowUpToLine, Download, GripVertical, ImageIcon, LayoutGrid, Sparkles, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { UtilityField, UtilityInput, UtilitySectionCard, UtilitySelect } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { calculateCollageLayout } from "./collageLayout";
import { batchProcessImages, buildAnimatedGif, buildCollage, serializeWatermark } from "./imageWorkerClient";
import {
  ClipboardHint,
  FormatField,
  NumberField,
  RASTER_IMAGE_ACCEPT,
  RangeField,
  TransparencyControl,
  calculatePreviewScale,
  downloadWorkerResult,
  drawContainedPreview,
  drawCoveredPreview,
  filterRasterImages,
  moveItem,
  normalizePanelError,
  runPanelTask,
  type ProcessPanelProps,
  useClipboardImages,
} from "./imageStudioShared";
import type { CollageOptions, ImageOutputFormat, WatermarkPosition } from "./types";

export function BatchImagePanel({ progress, controllerRef }: ProcessPanelProps) {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"fit-width" | "contain" | "cover" | "original">("fit-width");
  const [width, setWidth] = useState(1600);
  const [height, setHeight] = useState(1200);
  const [format, setFormat] = useState<ImageOutputFormat>("jpeg");
  const [quality, setQuality] = useState(0.9);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkFile, setWatermarkFile] = useState<File>();
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.7);

  useClipboardImages((images) => setFiles((current) => [...current, ...images]));

  const execute = async () => {
    if (!files.length) return;
    const controller = new AbortController(); controllerRef.current = controller;
    progress.start(t("image.batch.prepare"));
    try {
      const watermarkImage = await serializeWatermark(watermarkFile);
      const result = await batchProcessImages(files, { mode, width, height, format, quality, background: transparentBackground ? "transparent" : "#ffffff", watermarkText, watermarkPosition, watermarkOpacity, watermarkImage }, t("image.batch.archive"), progress.update, controller.signal, i18n.language === "en" ? "en" : "ko");
      downloadWorkerResult(result);
      progress.succeed(t("image.batch.done", { count: files.length }));
    } catch (error) { progress.fail(normalizePanelError(error, t)); }
    finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
  };

  return <UtilitySectionCard title={t("image.batch.title")} description={t("image.batch.description")}>
    <FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint={t("image.batch.hint")} accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" />
    <div className="image-settings-grid mt-3 grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1"><UtilityField><span>{t("image.batch.resize")}</span><UtilitySelect value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="fit-width">{t("image.batch.fitWidth")}</option><option value="contain">{t("image.batch.contain")}</option><option value="cover">{t("image.batch.cover")}</option><option value="original">{t("image.batch.original")}</option></UtilitySelect></UtilityField><NumberField label={t("image.batch.width")} value={width} onChange={setWidth} /><NumberField label={t("image.batch.height")} value={height} onChange={setHeight} disabled={mode === "fit-width" || mode === "original"} /><FormatField value={format} onChange={setFormat} /><RangeField label={t("image.batch.quality")} value={quality} min={0.4} max={1} step={0.05} onChange={setQuality} /></div>
    <TransparencyControl checked={transparentBackground} onChange={setTransparentBackground} format={format} />
    <Card className="watermark-settings mt-3 grid grid-cols-2 gap-2.5 rounded-2xl border border-sky-200 bg-sky-50/70 p-3 py-3 shadow-none ring-0 max-[620px]:grid-cols-1 dark:border-sky-900 dark:bg-sky-950/35"><UtilityField><span>{t("image.batch.watermarkText")}</span><UtilityInput value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} placeholder={t("image.batch.watermarkPlaceholder")} /></UtilityField><UtilityField><span>{t("image.batch.watermarkImage")}</span><UtilityInput className="cursor-pointer px-2 py-1.5 file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-bold" type="file" accept={RASTER_IMAGE_ACCEPT} onChange={(event) => setWatermarkFile(filterRasterImages(Array.from(event.target.files || []))[0])} /></UtilityField><UtilityField><span>{t("image.batch.position")}</span><UtilitySelect value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value as WatermarkPosition)}><option value="top-left">{t("image.batch.topLeft")}</option><option value="top-right">{t("image.batch.topRight")}</option><option value="center">{t("image.batch.center")}</option><option value="bottom-left">{t("image.batch.bottomLeft")}</option><option value="bottom-right">{t("image.batch.bottomRight")}</option></UtilitySelect></UtilityField><RangeField label={t("image.batch.opacity")} value={watermarkOpacity} min={0.1} max={1} step={0.05} onChange={setWatermarkOpacity} /></Card>
    <div className="mt-4 flex justify-end max-[620px]:block" data-testid="image-batch-action"><div className="w-full max-w-[310px] max-[620px]:max-w-none"><PrimaryButton accent="sky" disabled={!files.length} loading={progress.status === "running"} onClick={() => void execute()}><Download size={18} /> {t("image.batch.download")}</PrimaryButton></div></div>
  </UtilitySectionCard>;
}
export function CollagePanel({ progress, controllerRef }: ProcessPanelProps) {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [layout, setLayout] = useState<CollageOptions["layout"]>("vertical");
  const [columns, setColumns] = useState(2);
  const [width, setWidth] = useState(1600);
  const [gap, setGap] = useState(16);
  const [background, setBackground] = useState("#ffffff");
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  useClipboardImages((images) => setFiles((current) => [...current, ...images]));
  const outputBackground = transparentBackground ? "transparent" : background;
  const language = i18n.language === "en" ? "en" : "ko";
  const execute = async () => runPanelTask(controllerRef, progress, async (controller) => buildCollage(files, { layout, columns, width, gap, background: outputBackground, format, quality: 0.92 }, t("image.collage.file"), progress.update, controller.signal, language), t("image.collage.done"), t);
  return <UtilitySectionCard title={t("image.collage.title")} description={t("image.collage.description")}><FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint={t("image.collage.hint")} accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" /><div className="image-settings-grid mt-3 grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1"><UtilityField><span>{t("image.collage.layout")}</span><UtilitySelect value={layout} onChange={(event) => setLayout(event.target.value as CollageOptions["layout"])}><option value="vertical">{t("image.collage.vertical")}</option><option value="horizontal">{t("image.collage.horizontal")}</option><option value="grid">{t("image.collage.grid")}</option></UtilitySelect></UtilityField><NumberField label={t("image.collage.columns")} value={columns} onChange={setColumns} disabled={layout !== "grid"} /><NumberField label={t("image.collage.width")} value={width} onChange={setWidth} /><NumberField label={t("image.collage.gap")} value={gap} min={0} onChange={setGap} /><UtilityField><span>{t("image.collage.background")}</span><UtilityInput className="cursor-pointer p-1" type="color" value={background} disabled={transparentBackground} onChange={(event) => setBackground(event.target.value)} /></UtilityField><FormatField value={format} onChange={setFormat} /></div><TransparencyControl checked={transparentBackground} onChange={setTransparentBackground} format={format} /><CollagePreview files={files} options={{ layout, columns, width, gap, background: outputBackground, format, quality: 0.92 }} onFiles={(incoming) => setFiles((current) => [...current, ...incoming])} /><div className="mt-4 flex justify-end max-[620px]:block" data-testid="image-collage-action"><div className="w-full max-w-[310px] max-[620px]:max-w-none"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><LayoutGrid size={18} /> {t("image.collage.download")}</PrimaryButton></div></div></UtilitySectionCard>;
}
function CollagePreview({ files, options, onFiles }: { files: File[]; options: CollageOptions; onFiles: (files: File[]) => void }) {
  const { t, i18n } = useTranslation("features");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState(() => t("image.collage.emptySummary"));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!files.length) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.style.width = "0";
        canvas.style.height = "0";
        setSummary(t("image.collage.emptySummary"));
        return;
      }

      const bitmaps: ImageBitmap[] = [];
      try {
        for (const file of files) bitmaps.push(await createImageBitmap(file));
        if (disposed) return;
        const layout = calculateCollageLayout(bitmaps, options);
        const scale = calculatePreviewScale(layout.width, layout.height);
        const displayWidth = Math.max(1, Math.round(layout.width * scale));
        const displayHeight = Math.max(1, Math.round(layout.height * scale));
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.max(1, Math.round(displayWidth * pixelRatio));
        canvas.height = Math.max(1, Math.round(displayHeight * pixelRatio));
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error(t("image.collage.canvasError"));
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.clearRect(0, 0, displayWidth, displayHeight);
        const previewBackground = options.format === "jpeg" ? "#ffffff" : options.background;
        if (previewBackground !== "transparent") {
          context.fillStyle = previewBackground;
          context.fillRect(0, 0, displayWidth, displayHeight);
        }
        bitmaps.forEach((bitmap, index) => {
          const cell = layout.cells[index];
          const draw = options.layout === "grid" ? drawCoveredPreview : drawContainedPreview;
          draw(context, bitmap, cell.x * scale, cell.y * scale, cell.width * scale, cell.height * scale);
        });
        setSummary(t("image.collage.summary", { width: layout.width.toLocaleString(i18n.language), height: layout.height.toLocaleString(i18n.language), count: files.length }));
      } catch (error) {
        if (!disposed) setSummary(error instanceof Error ? error.message : t("image.collage.previewError"));
      } finally {
        bitmaps.forEach((bitmap) => bitmap.close());
      }
    }, 120);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [files, i18n.language, options.background, options.columns, options.format, options.gap, options.layout, options.width, t]);

  return (
    <Card className="collage-preview-panel mt-3 gap-0 rounded-2xl border border-border bg-muted p-3 py-3 shadow-none ring-0">
      <div className="collage-preview-heading mb-2 flex items-center justify-between gap-3 max-[620px]:flex-col max-[620px]:items-start"><span className="flex items-center gap-2 text-sky-700 dark:text-sky-300"><LayoutGrid size={17} /><strong className="text-[13px] text-foreground">{t("image.collage.preview")}</strong></span><small className="text-right text-xs text-muted-foreground max-[620px]:text-left">{summary}</small></div>
      <div
        className={cn("collage-preview-stage image-preview-drop relative grid min-h-[180px] place-items-center overflow-auto rounded-xl border border-border bg-[repeating-conic-gradient(#ececf0_0_25%,#f8f8fa_0_50%)] bg-[length:16px_16px] p-2.5 dark:bg-[repeating-conic-gradient(#242426_0_25%,#303033_0_50%)]", files.length && "has-preview max-h-[520px] items-start", dragging && "is-file-dragging border-sky-600 shadow-[inset_0_0_0_2px_rgba(21,155,215,.18)]")}
        onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); } }}
        onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = filterRasterImages(Array.from(event.dataTransfer.files)); if (dropped.length) onFiles(dropped); }}
      >
        {!files.length && <span className="flex flex-col items-center gap-2 text-xs font-bold text-muted-foreground"><ImageIcon size={24} />{t("image.collage.add")}</span>}
        <canvas className="block max-w-none shadow-lg" ref={canvasRef} aria-label={t("image.collage.previewLabel")} />
        {dragging && <span className="image-preview-drop-hint absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-sky-600/50 bg-sky-50/95 p-4 text-sm font-extrabold text-sky-700 backdrop-blur-sm dark:bg-sky-950/95 dark:text-sky-300">{t("image.collage.drop")}</span>}
      </div>
    </Card>
  );
}

export function GifPanel({ progress, controllerRef }: ProcessPanelProps) {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [delays, setDelays] = useState<number[]>([]);
  const [width, setWidth] = useState(720);
  const [delay, setDelay] = useState(500);
  const [colors, setColors] = useState(192);
  const [preview, setPreview] = useState<{ url: string; fileName: string }>();
  const frameListRef = useRef<HTMLDivElement>(null);
  const language = i18n.language === "en" ? "en" : "ko";
  const replaceFiles = useCallback((next: File[]) => {
    const filtered = filterRasterImages(next);
    setFiles(filtered);
    setDelays((current) => filtered.map((_, index) => Math.max(20, current[index] ?? delay)));
  }, [delay]);
  const appendFiles = useCallback((incoming: File[]) => {
    const filtered = filterRasterImages(incoming);
    if (!filtered.length) return;
    setFiles((current) => [...current, ...filtered]);
    setDelays((current) => [...current, ...filtered.map(() => Math.max(20, delay))]);
  }, [delay]);
  useClipboardImages(appendFiles);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => {
    const list = frameListRef.current;
    if (!list) return;
    const sortable = Sortable.create(list, {
      animation: 170,
      handle: ".gif-frame-drag-handle",
      draggable: ".gif-frame-row",
      forceFallback: true,
      fallbackOnBody: true,
      delay: 120,
      delayOnTouchOnly: true,
      fallbackTolerance: 4,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        restoreSortableDom(list, oldIndex, newIndex);
        setFiles((current) => moveItem(current, oldIndex, newIndex));
        setDelays((current) => moveItem(current, oldIndex, newIndex));
      },
    });
    return () => sortable.destroy();
  }, [files.length]);
  const moveFrame = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return;
    setFiles((current) => moveItem(current, from, to));
    setDelays((current) => moveItem(current, from, to));
  };
  const removeFrame = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setDelays((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const execute = async () => {
    const controller = new AbortController(); controllerRef.current = controller; progress.start(t("image.batch.prepare"));
    try {
      const result = await buildAnimatedGif(files, { width, delay: Math.max(20, delay), delays: delays.map((value) => Math.max(20, value)), qualityColors: colors }, t("image.gif.file"), progress.update, controller.signal, language);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(new Blob([result.buffer], { type: result.mimeType })), fileName: result.fileName });
      progress.succeed(t("image.gif.done"));
    } catch (error) { progress.fail(normalizePanelError(error, t)); }
    finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
  };
  return <UtilitySectionCard title={t("image.gif.title")} description={t("image.gif.description")}>
    <FileDropZone files={files} onFiles={replaceFiles} accept={RASTER_IMAGE_ACCEPT} multiple hint={t("image.gif.hint")} accent="sky" />
    <ClipboardHint mode="append" />
    {!!files.length && <div ref={frameListRef} className="gif-frame-list mt-3 grid gap-2">{files.map((file, index) => <Card className="gif-frame-row grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 rounded-2xl border border-border bg-muted p-2.5 py-2.5 shadow-none ring-0 max-[620px]:grid-cols-[minmax(0,1fr)_auto_auto_auto]" key={`${file.name}-${file.lastModified}-${index}`}><span className="flex min-w-0 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap"><Button type="button" className="gif-frame-drag-handle size-9 shrink-0 cursor-grab rounded-xl active:cursor-grabbing" variant="outline" size="icon" aria-label={t("image.gif.drag", { number: index + 1, name: file.name })}><GripVertical size={16} /></Button><b className="grid size-6 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">{index + 1}</b><span className="overflow-hidden text-ellipsis">{file.name}</span></span><UtilityField className="flex-row items-center gap-1.5 text-xs max-[620px]:col-span-4 max-[620px]:row-start-2"><span>{t("image.gif.frameDelay")}</span><UtilityInput className="h-9 w-[78px]" type="number" min={20} step={10} value={delays[index] ?? delay} onChange={(event) => setDelays((current) => current.map((value, itemIndex) => itemIndex === index ? Math.max(20, Number(event.target.value) || 20) : value))} /></UtilityField><Button type="button" className="size-9 rounded-xl" variant="outline" size="icon" disabled={index === 0} aria-label={t("image.gif.moveUp", { number: index + 1, name: file.name })} onClick={() => moveFrame(index, index - 1)}><ArrowUpToLine size={16} /></Button><Button type="button" className="size-9 rounded-xl" variant="outline" size="icon" disabled={index === files.length - 1} aria-label={t("image.gif.moveDown", { number: index + 1, name: file.name })} onClick={() => moveFrame(index, index + 1)}><ArrowDownToLine size={16} /></Button><Button type="button" className="size-9 rounded-xl" variant="destructive" size="icon" aria-label={t("image.gif.remove", { number: index + 1, name: file.name })} onClick={() => removeFrame(index)}><Trash2 size={16} /></Button></Card>)}</div>}
    <div className="image-settings-grid mt-3 grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1"><NumberField label={t("image.gif.width")} value={width} onChange={setWidth} /><NumberField label={t("image.gif.delay")} value={delay} min={20} onChange={(value) => { setDelay(value); setDelays(files.map(() => value)); }} /><UtilityField><span>{t("image.gif.colors")}</span><UtilitySelect value={colors} onChange={(event) => setColors(Number(event.target.value))}><option value={128}>{t("image.gif.small")}</option><option value={192}>{t("image.gif.balanced")}</option><option value={256}>{t("image.gif.sharp")}</option></UtilitySelect></UtilityField></div>
    {preview && <Card className="gif-result-preview mt-3 grid justify-items-center gap-3 rounded-2xl border border-border bg-muted p-3.5 py-3.5 shadow-none ring-0"><img className="max-h-[440px] max-w-full rounded-xl" src={preview.url} alt={t("image.gif.previewAlt")} /><Button render={<a href={preview.url} download={preview.fileName} />} className="rounded-xl bg-sky-700 text-white hover:bg-sky-800"><Download size={17} /> {t("image.gif.download")}</Button></Card>}
    <div className="mt-4 flex justify-end max-[620px]:block" data-testid="image-gif-action"><div className="w-full max-w-[310px] max-[620px]:max-w-none"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><Sparkles size={18} /> {t("image.gif.create")}</PrimaryButton></div></div>
  </UtilitySectionCard>;
}

function restoreSortableDom(container: HTMLElement, oldIndex: number, newIndex: number) {
  const moved = container.children[newIndex];
  if (!moved) return;
  if (oldIndex < newIndex) container.insertBefore(moved, container.children[oldIndex] ?? null);
  else container.insertBefore(moved, container.children[oldIndex + 1] ?? null);
}
