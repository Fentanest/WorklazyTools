import { Check, FilePlus2, UploadCloud } from "lucide-react";
import { type ChangeEvent, type DragEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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

  return <div className="pair-file-drop-zone">
    <label className="field-label" htmlFor={id}>{label}</label>
    <input ref={inputRef} id={id} className="visually-hidden" type="file" accept={accept} multiple disabled={disabled} onChange={(event) => { void handleChange(event); }} />
    <div
      className={`drop-zone accent-blue pair-drop-zone${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
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
      <span className="drop-icon">{files.length ? <FilePlus2 size={25} /> : <UploadCloud size={25} />}</span>
      <div aria-live="polite"><strong>{files.length ? t("files.selected", { count: files.length }) : t("files.dropHere")}</strong><span>{hint}</span></div>
      <button className="secondary-button small" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>{t("actions.selectFile")}</button>
      {files.length > 0 && <em className="drop-added-status" key={files.length}><Check size={12} /> {t("files.added")}</em>}
    </div>
  </div>;
}
