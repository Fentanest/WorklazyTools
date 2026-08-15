import { Check, ChevronLeft, ChevronRight, GripVertical, Maximize2, RotateCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { renderPdfThumbnail } from "./pdfPreview";
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
  groupNumbers = [],
  draggable = true,
  selected = false,
}: {
  item: PdfPageItem;
  file: File;
  outputIndex: number;
  totalItems?: number;
  onRotate?: () => void;
  onRemove?: () => void;
  onMove?: (direction: -1 | 1) => void;
  onSelect?: () => void;
  groupNumbers?: number[];
  draggable?: boolean;
  selected?: boolean;
}) {
  const language = useAppLanguage();
    const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 172, height: 224 });
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: "320px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const controller = new AbortController();
    setError("");
    setRendered(false);
    renderPdfThumbnail(file, item.sourcePageIndex, canvasRef.current, 172, language, controller.signal)
      .then((size) => { if (!controller.signal.aborted) { setDimensions(size); setRendered(true); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfThumbnail.previewFailed")); });
    return () => { controller.abort(); if (canvasRef.current) { canvasRef.current.width = 1; canvasRef.current.height = 1; } };
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
      className={`pdf-page-card${selected ? " selected" : ""}`}
      data-page-id={item.id}
      data-rotation={item.rotation}
    >
      <div className="pdf-page-card-top">
        {draggable && <button type="button" className="pdf-drag-handle" aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.reorderPage", { p0: outputIndex + 1 })}><GripVertical size={16} /></button>}
        <strong>{outputIndex + 1}</strong>
        <span>{item.rotation ? `${item.rotation}°` : featureMessage(language, "pdf.messages.PdfThumbnail.original")}</span>
        {onSelect && <button type="button" className={`pdf-page-select${selected ? " selected" : ""}`} onClick={onSelect} aria-pressed={selected} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.page", { p0: outputIndex + 1, p1: featureMessage(language, selected ? "pdf.messages.PdfThumbnail.deselect" : "pdf.messages.PdfThumbnail.select") })}><Check size={13} /></button>}
      </div>
      <div className="pdf-thumbnail-frame" style={frameStyle} onClick={() => setExpanded(true)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded(true); } }}>
        {!!groupNumbers.length && <span className="pdf-group-badges" aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.includedRangeGroups", { p0: groupNumbers.join(", ") })}>{groupNumbers.map((number) => <b key={number}>{number}</b>)}</span>}
        {(!visible || visible && !rendered && !error) && <span className="pdf-thumbnail-placeholder">{visible ? featureMessage(language, "pdf.messages.PdfThumbnail.renderingPage") : featureMessage(language, "pdf.messages.PdfThumbnail.previewPending")}</span>}
        {error && <span className="pdf-thumbnail-error">{error}</span>}
        <canvas
          ref={canvasRef}
          aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.pagePreview", { p0: item.sourceName, p1: item.sourcePageIndex + 1 })}
          style={{ opacity: rendered ? 1 : 0, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${sideways ? dimensions.width / dimensions.height : 1})` }}
        />
        {rendered && <Maximize2 className="pdf-thumbnail-expand" size={15} aria-hidden="true" />}
      </div>
      <div className="pdf-page-source" title={item.sourceName}>
        <strong>{item.sourceName}</strong>
        <small>{featureMessage(language, "pdf.messages.PdfThumbnail.sourcePage", { p0: item.sourcePageIndex + 1 })}</small>
      </div>
      {(onRotate || onRemove || onMove) && (
        <div className="pdf-page-actions">
          {onMove && <button type="button" onClick={() => onMove(-1)} disabled={outputIndex === 0} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.moveLeft")}><ChevronLeft size={15} /></button>}
          {onRotate && <button type="button" onClick={onRotate} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.rotate90DegreesClockwise")}><RotateCw size={15} /><span>{featureMessage(language, "pdf.messages.PdfThumbnail.rotate")}</span></button>}
          {onMove && <button type="button" onClick={() => onMove(1)} disabled={totalItems !== undefined && outputIndex === totalItems - 1} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.moveRight")}><ChevronRight size={15} /></button>}
          {onRemove && <button type="button" className="danger" onClick={onRemove} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.deletePage")}><Trash2 size={15} /></button>}
        </div>
      )}
      {expanded && <div className="pdf-lightbox" role="dialog" aria-modal="true" aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.largePdfPagePreview")} onClick={() => setExpanded(false)}><div onClick={(event) => event.stopPropagation()}><button type="button" className="pdf-lightbox-close" onClick={() => setExpanded(false)} aria-label={featureMessage(language, "pdf.messages.PdfThumbnail.close")}><X size={19} /></button><canvas ref={largeCanvasRef} /></div></div>}
    </article>
  );
}
