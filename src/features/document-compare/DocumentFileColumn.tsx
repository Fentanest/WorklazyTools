import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, X } from "lucide-react";
import { type DragEvent as ReactDragEvent, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileDropZone, formatBytes } from "../../components/ui";
import { documentFileKey } from "./filePairs";
import type { DocumentPairSide } from "./useDocumentPairFiles";

const DOCUMENT_DRAG_TYPE_PREFIX = "application/x-worklazy-document-";

export function DocumentFileColumn({
  files,
  side,
  sideLabel,
  hint,
  accept,
  accent,
  listClassName = "",
  onFiles,
  onRemove,
  onMove,
  onMoveAcross,
  renderAccessory,
}: {
  files: File[];
  side: DocumentPairSide;
  sideLabel: string;
  hint: string;
  accept: string;
  accent: "blue" | "orange";
  listClassName?: string;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onMoveAcross: (index: number) => void;
  renderAccessory?: (file: File) => ReactNode;
}) {
  const { t } = useTranslation("features");
  const [receivingFiles, setReceivingFiles] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const oppositeLabel = t(side === "before" ? "documentCompare.side.after" : "documentCompare.side.before");
  const currentSideLabel = t(side === "before" ? "documentCompare.side.before" : "documentCompare.side.after");
  const isExternalFileDrag = (event: ReactDragEvent<HTMLDivElement>) => Array.from(event.dataTransfer.types).includes("Files");
  const ownDragType = `${DOCUMENT_DRAG_TYPE_PREFIX}${side}`;
  const isOwnColumnDrag = (event: ReactDragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes(ownDragType);
  const isDocumentDrag = (event: ReactDragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).some((type) => type.startsWith(DOCUMENT_DRAG_TYPE_PREFIX));

  useEffect(() => {
    const clearDragState = () => { setDraggedIndex(null); setOverIndex(null); };
    document.addEventListener("dragend", clearDragState);
    document.addEventListener("drop", clearDragState);
    return () => {
      document.removeEventListener("dragend", clearDragState);
      document.removeEventListener("drop", clearDragState);
    };
  }, []);

  return (
    <div
      className={`word-file-column accent-${accent}${receivingFiles ? " receiving-files" : ""}`}
      onDragEnter={(event) => { if (isExternalFileDrag(event)) { event.preventDefault(); setReceivingFiles(true); } }}
      onDragOver={(event) => { if (isExternalFileDrag(event)) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(event) => { const next = event.relatedTarget; if (!(next instanceof Node && event.currentTarget.contains(next))) setReceivingFiles(false); }}
      onDrop={(event) => {
        if (!isExternalFileDrag(event)) return;
        event.preventDefault();
        setReceivingFiles(false);
        if ((event.target as Element).closest('[data-ui-part="drop-target"]')) return;
        const dropped = Array.from(event.dataTransfer.files);
        if (dropped.length) onFiles([...files, ...dropped]);
      }}
    >
      <FileDropZone label={t("documentCompare.fileCount", { side: sideLabel, count: files.length })} accept={accept} hint={hint} multiple files={files} onFiles={onFiles} accent={accent} />
      {!!files.length && (
        <ol className={`sortable-word-files${listClassName ? ` ${listClassName}` : ""}`} aria-label={t("documentCompare.documentOrder", { side: sideLabel })}>
          {files.map((file, index) => {
            const moveAcrossLabel = t("documentCompare.moveAcross", { name: file.name, side: oppositeLabel });
            return <li
              key={documentFileKey(file)}
              className={`${draggedIndex === index ? "dragging" : ""}${overIndex === index ? " drag-over" : ""}`}
              draggable
              onDragStart={(event) => { setDraggedIndex(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(ownDragType, String(index)); }}
              onDragEnter={(event) => setOverIndex(isOwnColumnDrag(event) ? index : null)}
              onDragOver={(event) => {
                if (isOwnColumnDrag(event)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                } else if (isDocumentDrag(event)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "none";
                  setOverIndex(null);
                }
              }}
              onDragLeave={(event) => { const next = event.relatedTarget; if (!(next instanceof Node && event.currentTarget.contains(next))) setOverIndex(null); }}
              onDrop={(event) => { event.preventDefault(); if (isOwnColumnDrag(event) && draggedIndex !== null && draggedIndex !== index) onMove(draggedIndex, index); setDraggedIndex(null); setOverIndex(null); }}
              onDragEnd={() => { setDraggedIndex(null); setOverIndex(null); }}
            >
              <span className="drag-handle" title={t("documentCompare.dragToReorder")}><GripVertical size={16} /></span>
              <b>{index + 1}</b>
              <span className="sortable-file-copy"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
              <span className="sortable-file-actions">
                <button className="move-across-button" type="button" title={moveAcrossLabel} onClick={() => onMoveAcross(index)} aria-label={moveAcrossLabel}>{side === "before" ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}</button>
                <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t("documentCompare.moveUp", { name: file.name })}><ArrowUp size={14} /></button>
                <button type="button" disabled={index === files.length - 1} onClick={() => onMove(index, index + 1)} aria-label={t("documentCompare.moveDown", { name: file.name })}><ArrowDown size={14} /></button>
                <button type="button" onClick={() => onRemove(index)} aria-label={t("documentCompare.remove", { name: file.name })}><X size={15} /></button>
              </span>
              {renderAccessory?.(file)}
            </li>;
          })}
        </ol>
      )}
      {receivingFiles && <div className="word-column-drop-hint">{t("documentCompare.dropToAdd", { side: currentSideLabel })}</div>}
    </div>
  );
}
