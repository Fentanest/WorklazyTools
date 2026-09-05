import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, X } from "lucide-react";
import { type DragEvent as ReactDragEvent, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileDropZone, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
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
      className={cn(
        "relative min-h-full rounded-2xl border border-transparent p-1 transition-[border-color,background-color,box-shadow]",
        receivingFiles && accent === "blue" && "border-blue-500/50 bg-blue-500/[.06] shadow-[0_0_0_3px_rgba(59,130,246,.08)]",
        receivingFiles && accent === "orange" && "border-orange-500/50 bg-orange-500/[.07] shadow-[0_0_0_3px_rgba(249,115,22,.09)]",
      )}
      data-document-file-column={side}
      data-receiving-files={receivingFiles || undefined}
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
        <ol className={cn("mt-2.5 flex list-none flex-col gap-2 p-0", listClassName)} data-testid={`document-file-list-${side}`} aria-label={t("documentCompare.documentOrder", { side: sideLabel })}>
          {files.map((file, index) => {
            const moveAcrossLabel = t("documentCompare.moveAcross", { name: file.name, side: oppositeLabel });
            return <li
              key={documentFileKey(file)}
              className={cn(
                "grid min-h-[50px] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-background/40 py-2 pr-2 pl-1.5 transition-[opacity,transform,border-color,background-color]",
                draggedIndex === index && "scale-[.985] opacity-40",
                overIndex === index && accent === "blue" && "border-blue-500/50 bg-blue-500/10",
                overIndex === index && accent === "orange" && "border-orange-500/50 bg-orange-500/10",
              )}
              data-testid="document-file-item"
              data-dragging={draggedIndex === index || undefined}
              data-drag-over={overIndex === index || undefined}
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
              <span className="grid size-8 cursor-grab place-items-center rounded-lg text-muted-foreground active:cursor-grabbing" title={t("documentCompare.dragToReorder")}><GripVertical size={16} /></span>
              <b className={cn("grid size-6 place-items-center rounded-lg text-[13px]", accent === "blue" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-orange-500/10 text-orange-700 dark:text-orange-300")}>{index + 1}</b>
              <span className="min-w-0"><strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm">{file.name}</strong><small className="mt-0.5 block text-xs text-muted-foreground">{formatBytes(file.size)}</small></span>
              <span className="flex items-center gap-1">
                <Button className={cn("rounded-lg", accent === "blue" ? "text-blue-700 hover:bg-blue-500/10 dark:text-blue-300" : "text-orange-700 hover:bg-orange-500/10 dark:text-orange-300")} variant="ghost" size="icon-sm" type="button" title={moveAcrossLabel} onClick={() => onMoveAcross(index)} aria-label={moveAcrossLabel}>{side === "before" ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}</Button>
                <Button className="rounded-lg" variant="ghost" size="icon-sm" type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t("documentCompare.moveUp", { name: file.name })}><ArrowUp size={14} /></Button>
                <Button className="rounded-lg" variant="ghost" size="icon-sm" type="button" disabled={index === files.length - 1} onClick={() => onMove(index, index + 1)} aria-label={t("documentCompare.moveDown", { name: file.name })}><ArrowDown size={14} /></Button>
                <Button className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" variant="ghost" size="icon-sm" type="button" onClick={() => onRemove(index)} aria-label={t("documentCompare.remove", { name: file.name })}><X size={15} /></Button>
              </span>
              {renderAccessory?.(file)}
            </li>;
          })}
        </ol>
      )}
      {receivingFiles && <div className={cn("pointer-events-none absolute inset-1 z-10 grid place-items-center rounded-xl border-2 border-dashed p-4 text-sm font-extrabold backdrop-blur-sm", accent === "blue" ? "border-blue-500/50 bg-blue-50/90 text-blue-700 dark:bg-blue-950/90 dark:text-blue-300" : "border-orange-500/50 bg-orange-50/90 text-orange-700 dark:bg-orange-950/90 dark:text-orange-300")}>{t("documentCompare.dropToAdd", { side: currentSideLabel })}</div>}
    </div>
  );
}
