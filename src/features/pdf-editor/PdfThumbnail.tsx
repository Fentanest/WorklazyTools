import { Check, ChevronLeft, ChevronRight, GripVertical, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { renderPdfThumbnail } from "./pdfPreview";
import type { PdfPageItem } from "./types";

export function PdfThumbnail({
  item,
  file,
  outputIndex,
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
  onRotate?: () => void;
  onRemove?: () => void;
  onMove?: (direction: -1 | 1) => void;
  onSelect?: () => void;
  groupNumbers?: number[];
  draggable?: boolean;
  selected?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 172, height: 224 });
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState(false);

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
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    setError("");
    setRendered(false);
    renderPdfThumbnail(file, item.sourcePageIndex, canvasRef.current)
      .then((size) => { if (!cancelled) { setDimensions(size); setRendered(true); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "미리보기 실패"); });
    return () => { cancelled = true; };
  }, [file, item.sourcePageIndex, visible]);

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
        {draggable && <button type="button" className="pdf-drag-handle" aria-label={`${outputIndex + 1}번 페이지 순서 변경`}><GripVertical size={16} /></button>}
        <strong>{outputIndex + 1}</strong>
        <span>{item.rotation ? `${item.rotation}°` : "원본 방향"}</span>
        {onSelect && <button type="button" className={`pdf-page-select${selected ? " selected" : ""}`} onClick={onSelect} aria-pressed={selected} aria-label={`${outputIndex + 1}번 페이지 ${selected ? "선택 해제" : "선택"}`}><Check size={13} /></button>}
      </div>
      <div className="pdf-thumbnail-frame" style={frameStyle}>
        {!!groupNumbers.length && <span className="pdf-group-badges" aria-label={`포함된 범위 그룹 ${groupNumbers.join(", ")}`}>{groupNumbers.map((number) => <b key={number}>{number}</b>)}</span>}
        {(!visible || visible && !rendered && !error) && <span className="pdf-thumbnail-placeholder">{visible ? "페이지 그리는 중…" : "미리보기 대기"}</span>}
        {error && <span className="pdf-thumbnail-error">{error}</span>}
        <canvas
          ref={canvasRef}
          aria-label={`${item.sourceName} ${item.sourcePageIndex + 1}페이지 미리보기`}
          style={{ opacity: rendered ? 1 : 0, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${sideways ? dimensions.width / dimensions.height : 1})` }}
        />
      </div>
      <div className="pdf-page-source" title={item.sourceName}>
        <strong>{item.sourceName}</strong>
        <small>원본 {item.sourcePageIndex + 1}페이지</small>
      </div>
      {(onRotate || onRemove || onMove) && (
        <div className="pdf-page-actions">
          {onMove && <button type="button" onClick={() => onMove(-1)} disabled={outputIndex === 0} aria-label="왼쪽으로 이동"><ChevronLeft size={15} /></button>}
          {onRotate && <button type="button" onClick={onRotate} aria-label="오른쪽으로 90도 회전"><RotateCw size={15} /><span>회전</span></button>}
          {onMove && <button type="button" onClick={() => onMove(1)} aria-label="오른쪽으로 이동"><ChevronRight size={15} /></button>}
          {onRemove && <button type="button" className="danger" onClick={onRemove} aria-label="페이지 삭제"><Trash2 size={15} /></button>}
        </div>
      )}
    </article>
  );
}
