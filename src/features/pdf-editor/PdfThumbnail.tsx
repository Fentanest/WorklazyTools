import { Check, ChevronLeft, ChevronRight, GripVertical, Maximize2, RotateCw, Scissors, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { getCachedPdfThumbnail, renderPdfThumbnail, type CachedPdfThumbnail } from "./pdfPreview";
import { useAppLanguage } from "../../i18n/routing";
import type { PdfPageItem } from "./types";
import { featureMessage } from "../../i18n/featureMessages";

export function PdfThumbnail({
  item,
  file,
  outputIndex,
  totalItems,
  onRotate,
  onRemove,
  onMove,
  onSelect,
  onSplitAfter,
  groupNumbers = [],
  draggable = true,
  selected = false,
  splitAfter = false,
}: {
  item: PdfPageItem;
  file: File;
  outputIndex: number;
  totalItems?: number;
  onRotate?: () => void;
  onRemove?: () => void;
  onMove?: (direction: -1 | 1) => void;
  onSelect?: (selected: boolean, extend: boolean) => void;
  onSplitAfter?: () => void;
  groupNumbers?: number[];
  draggable?: boolean;
  selected?: boolean;
  splitAfter?: boolean;
}) {
  const language = useAppLanguage();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 172, height: 224 });
  const [error, setError] = useState("");
  const [thumbnail, setThumbnail] = useState<CachedPdfThumbnail | null>(null);
  const [expanded, setExpanded] = useState(false);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "320px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError("");
    setThumbnail(null);
    getCachedPdfThumbnail(file, item.sourcePageIndex, 172, language)
      .then((preview) => { if (active) { setDimensions(preview); setThumbnail(preview); } })
      .catch((reason) => { if (active && !(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfThumbnail.previewFailed")); });
    return () => { active = false; };
  }, [file, item.sourcePageIndex, visible, language]);

  useEffect(() => {
    if (!expanded || !largeCanvasRef.current) return;
    const controller = new AbortController();
    void renderPdfThumbnail(file, item.sourcePageIndex, largeCanvasRef.current, Math.min(960, window.innerWidth - 48), language, controller.signal).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfThumbnail.largePreviewFailed"));
    });
    return () => controller.abort();
  }, [expanded, file, item.sourcePageIndex, language]);

  const sideways = item.rotation === 90 || item.rotation === 270;
  const frameStyle = {
    aspectRatio: sideways ? `${dimensions.height} / ${dimensions.width}` : `${dimensions.width} / ${dimensions.height}`,
  };

  return (
    <article
      ref={hostRef}
      className={cn(
        "pdf-page-card min-w-0 gap-0 overflow-hidden rounded-2xl border border-border bg-white/40 py-0 shadow-sm ring-0 transition-[border-color,box-shadow,transform] dark:bg-white/[.025] [&.sortable-ghost]:opacity-35 [&.sortable-chosen]:border-violet-600 [&.sortable-chosen]:shadow-lg [&.sortable-chosen]:shadow-violet-700/15",
        selected && "relative border-violet-600 bg-violet-100/70 shadow-md shadow-violet-700/15 ring-2 ring-violet-600/20 before:pointer-events-none before:absolute before:inset-y-2 before:left-1 before:z-10 before:w-1 before:rounded-full before:bg-violet-700 dark:border-violet-400 dark:bg-violet-950/60 dark:before:bg-violet-300",
      )}
      data-selected={selected || undefined}
      data-page-id={item.id}
      data-rotation={item.rotation}
    >
      <div className="pdf-page-card-top grid h-[33px] grid-cols-[27px_1fr_auto_auto] items-center gap-1 border-b border-border px-2 text-muted-foreground">
        {draggable && <Button type="button" className="pdf-drag-handle size-[27px] touch-none cursor-grab rounded-lg p-0 text-muted-foreground active:cursor-grabbing max-[620px]:size-11" variant="ghost" size="icon-xs" aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.reorderPage", { p0: outputIndex + 1 })}><GripVertical size={16} /></Button>}
        <strong className="text-sm text-foreground">{outputIndex + 1}</strong>
        <span className="text-xs font-bold">{item.rotation ? `${item.rotation}°` : featureMessage(language, "pdf.messages.PdfThumbnail.original")}</span>
        {onSelect && <label className={cn("pdf-page-select relative grid size-[22px] cursor-pointer place-items-center rounded-lg border border-border bg-muted text-transparent focus-within:ring-2 focus-within:ring-violet-600 focus-within:ring-offset-2", selected && "border-violet-600 bg-violet-700 text-white dark:border-violet-400")} data-selected={selected || undefined}><input className="absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0" type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked, Boolean((event.nativeEvent as MouseEvent).shiftKey))} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.page", { p0: outputIndex + 1, p1: featureMessage(language, selected ? "pdf.messages.PdfThumbnail.deselect" : "pdf.messages.PdfThumbnail.select") })} /><Check size={13} aria-hidden="true" /></label>}
      </div>
      <div className="pdf-thumbnail-frame relative m-2 grid w-[calc(100%-16px)] cursor-zoom-in place-items-center overflow-hidden rounded-lg bg-[#e9e9ed] transition-[aspect-ratio] dark:bg-[#202023]" style={frameStyle} onClick={() => setExpanded(true)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded(true); } }}>
        {!!groupNumbers.length && <span className="pdf-group-badges absolute top-1.5 left-1.5 z-10 flex max-w-[calc(100%-12px)] flex-wrap gap-1" aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.includedRangeGroups", { p0: groupNumbers.join(", ") })}>{groupNumbers.map((number) => <b className="grid h-[19px] min-w-[19px] place-items-center rounded-full border border-white/65 bg-violet-700 px-1.5 text-xs text-white shadow-sm" key={number}>{number}</b>)}</span>}
        {(!visible || visible && !thumbnail && !error) && <span className="pdf-thumbnail-placeholder text-center text-xs font-bold text-muted-foreground">{visible ? featureMessage(language, "pdf.messages.PdfThumbnail.renderingPage") : featureMessage(language, "pdf.messages.PdfThumbnail.previewPending")}</span>}
        {error && <span className="pdf-thumbnail-error max-w-[120px] text-center text-xs font-bold leading-relaxed text-destructive">{error}</span>}
        {thumbnail && <img className="absolute top-1/2 left-1/2 origin-center shadow-sm transition-transform" src={thumbnail.url} alt={featureMessage(language, "pdf.messages.PdfThumbnail.pagePreview", { p0: item.sourceName, p1: item.sourcePageIndex + 1 })} style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${sideways ? dimensions.width / dimensions.height : 1})` }} />}
        {thumbnail && <Maximize2 className="pdf-thumbnail-expand absolute right-2 bottom-2 z-10 box-content rounded-lg bg-black/55 p-1 text-white" size={15} aria-hidden="true" />}
      </div>
      <div className="pdf-page-source flex min-w-0 flex-col px-2.5 pt-0.5 pb-2" title={item.sourceName}>
        <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-foreground">{item.sourceName}</strong>
        <small className="mt-1 text-xs text-muted-foreground">{featureMessage(language, "pdf.messages.PdfThumbnail.sourcePage", { p0: item.sourcePageIndex + 1 })}</small>
      </div>
      {(onRotate || onRemove || onMove) && (
        <div className="pdf-page-actions grid grid-cols-[29px_1fr_29px_31px] gap-1 border-t border-border p-2">
          {onMove && <Button className="min-h-[29px] rounded-lg bg-violet-500/10 p-0 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300" variant="ghost" size="icon-xs" type="button" onClick={() => onMove(-1)} disabled={outputIndex === 0} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.moveLeft")}><ChevronLeft size={15} /></Button>}
          {onRotate && <Button className="min-h-[29px] rounded-lg bg-violet-500/10 p-0 text-xs font-bold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300" variant="ghost" size="sm" type="button" onClick={onRotate} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.rotate90DegreesClockwise")}><RotateCw size={15} /><span>{featureMessage(language, "pdf.messages.PdfThumbnail.rotate")}</span></Button>}
          {onMove && <Button className="min-h-[29px] rounded-lg bg-violet-500/10 p-0 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300" variant="ghost" size="icon-xs" type="button" onClick={() => onMove(1)} disabled={totalItems !== undefined && outputIndex === totalItems - 1} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.moveRight")}><ChevronRight size={15} /></Button>}
          {onRemove && <Button className="min-h-[29px] rounded-lg bg-destructive/10 p-0 text-destructive hover:bg-destructive/20" variant="ghost" size="icon-xs" type="button" onClick={onRemove} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.deletePage")}><Trash2 size={15} /></Button>}
        </div>
      )}
      {onSplitAfter && <Button type="button" variant="outline" size="sm" data-selected={splitAfter || undefined} className={cn("pdf-split-after mx-2 mb-2 min-h-[30px] w-[calc(100%-16px)] rounded-lg border-dashed border-violet-500/40 bg-violet-500/10 px-2 text-[11px] font-bold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300", splitAfter && "border-solid border-violet-700 bg-violet-700 text-white hover:bg-violet-800 dark:border-violet-500 dark:bg-violet-700 dark:text-white")} onClick={onSplitAfter} aria-pressed={splitAfter}><Scissors size={14} /><span>{featureMessage(language, splitAfter ? "pdf.messages.PdfThumbnail.removeSplitAfterPage" : "pdf.messages.PdfThumbnail.splitAfterPage", { p0: outputIndex + 1 })}</span></Button>}
      {expanded && <div className="pdf-lightbox fixed inset-0 z-[1000] grid place-items-center bg-black/75 p-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.largePdfPagePreview")} onClick={() => setExpanded(false)}><div className="relative max-h-full max-w-full overflow-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><Button type="button" variant="ghost" size="icon-lg" className="pdf-lightbox-close sticky top-2 z-10 float-right m-2 rounded-full bg-black/60 text-white hover:bg-black/75 hover:text-white" onClick={() => setExpanded(false)} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.close")}><X size={19} /></Button><canvas className="block h-auto! max-w-[min(960px,calc(100vw-48px))]" ref={largeCanvasRef} /></div></div>}
    </article>
  );
}
