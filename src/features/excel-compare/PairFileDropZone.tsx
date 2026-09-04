import { Check, FilePlus2, UploadCloud } from "lucide-react";
import { type ChangeEvent, type DragEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DropZoneHint } from "../../components/DropZoneHint";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";

export function PairFileDropZone({ label, hint, accept, files, onFiles, disabled = false }: {
  label: string;
  hint: string;
  accept: string;
  files: File[];
  onFiles: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation("common");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const assignFiles = async (incoming: FileList | null) => {
    if (!incoming || disabled) return;
    await onFiles(Array.from(incoming));
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    try {
      await assignFiles(input.files);
    } finally {
      input.value = "";
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await assignFiles(event.dataTransfer.files);
  };

  return <div className="mt-3">
    <label className="mb-1.5 block text-xs font-bold text-muted-foreground" htmlFor={id}>{label}</label>
    <input ref={inputRef} id={id} className="sr-only" type="file" accept={accept} multiple disabled={disabled} onChange={(event) => { void handleChange(event); }} />
    <Card
      className={cn(
        "relative min-h-32 cursor-pointer items-center justify-center gap-2 overflow-visible rounded-2xl border border-dashed border-green-700/45 bg-green-500/5 px-4 py-5 text-center shadow-none outline-none transition-[border-color,background-color,box-shadow] hover:border-green-700 hover:bg-green-500/10 focus-visible:border-green-700 focus-visible:ring-3 focus-visible:ring-green-700/25 dark:border-green-300/50 dark:hover:border-green-300",
        dragging && "border-green-700 bg-green-500/15 ring-3 ring-green-700/20 dark:border-green-300",
        disabled && "cursor-not-allowed opacity-50",
      )}
      data-testid="excel-pair-drop-zone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label}
      onClick={(event) => {
        if (disabled || (event.target as Element).closest("button")) return;
        inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setDragging(false);
      }}
      onDrop={(event) => { void handleDrop(event); }}
    >
      <span className="grid size-11 place-items-center rounded-full bg-green-500/15 text-green-800 dark:text-green-300">{files.length ? <FilePlus2 size={24} /> : <UploadCloud size={24} />}</span>
      <div className="grid gap-1" aria-live="polite"><strong className="text-sm">{files.length ? t("files.selected", { count: files.length }) : t("files.dropHere")}</strong><DropZoneHint>{hint}</DropZoneHint></div>
      <Button className="min-h-11 rounded-xl" variant="secondary" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>{t("actions.selectFile")}</Button>
      {files.length > 0 && <em className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-700 px-2 py-1 text-[11px] font-bold text-white not-italic" key={files.length}><Check size={12} /> {t("files.added")}</em>}
    </Card>
  </div>;
}
