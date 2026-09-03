import { Check, ChevronRight, FilePlus2, LoaderCircle, UploadCloud, X } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { ToolAccent } from "../app/toolRegistry";

export function PageHeader({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </header>
  );
}

export function SectionCard({ title, description, step, children, className = "" }: {
  title: string;
  description?: string;
  step?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section-card ${className}`}>
      <div className="section-heading">
        {step && <span className="step-number">{step}</span>}
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      </div>
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented-control" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? "selected" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({ label, description, checked, onChange, disabled = false }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="settings-row">
      <div><strong>{label}</strong>{description && <small>{description}</small>}</div>
      <button
        className={`ios-switch${checked ? " checked" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      ><span /></button>
    </div>
  );
}

export function NavigationRow({ label, value, onClick }: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button className="settings-row navigation-row" type="button" onClick={onClick}>
      <strong>{label}</strong>
      <span>{value}<ChevronRight size={17} /></span>
    </button>
  );
}

interface FileDropZoneProps {
  label?: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void | Promise<void>;
  accent?: ToolAccent;
  disabled?: boolean;
}

export function FileDropZone({ label, hint, accept, multiple = false, files, onFiles, accent = "blue", disabled = false }: FileDropZoneProps) {
  const { t } = useTranslation("common");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const appendFiles = async (incoming: FileList | null) => {
    if (!incoming || disabled) return;
    const next = Array.from(incoming);
    await onFiles(multiple ? [...files, ...next] : next.slice(0, 1));
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedFiles = input.files;
    try {
      await appendFiles(selectedFiles);
    } finally {
      // Some browsers revoke access to a selected File as soon as the input is
      // reset. Keep the selection alive until async consumers finish copying it.
      input.value = "";
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await appendFiles(event.dataTransfer.files);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragging(false);
  };

  return (
    <div className="drop-zone-wrap">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <input ref={inputRef} id={id} className="visually-hidden" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={handleChange} />
      <div
        className={`drop-zone accent-${accent}${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={t("files.selectOrDrop", { label: label || t("files.generic"), action: multiple && files.length ? t("files.add") : t("files.select") })}
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
        onDragLeave={handleDragLeave}
        onDrop={(event) => { void handleDrop(event); }}
      >
        <span className="drop-icon">{files.length ? <FilePlus2 size={25} /> : <UploadCloud size={25} />}</span>
        <div aria-live="polite"><strong>{files.length ? `${t("files.selected", { count: files.length })}${multiple ? ` · ${t("files.keepAdding")}` : ""}` : t("files.dropHere")}</strong><span>{hint}</span></div>
        <button className="secondary-button small" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>{multiple && files.length ? t("actions.addFiles") : t("actions.selectFile")}</button>
        {files.length > 0 && <em className="drop-added-status" key={files.length}><Check size={12} /> {t("files.added")}</em>}
      </div>
    </div>
  );
}

export function FileList({ files, onRemove, accent = "blue" }: {
  files: File[];
  onRemove: (index: number) => void;
  accent?: ToolAccent;
}) {
  const { t } = useTranslation("common");
  if (!files.length) return null;
  return (
    <div className="file-list">
      {files.map((file, index) => (
        <div className="file-row" key={`${file.name}-${file.lastModified}-${index}`}>
          <span className={`file-type accent-${accent}`}>{file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span>
          <span className="file-meta"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
          <button className="remove-button" type="button" onClick={() => onRemove(index)} aria-label={t("files.remove", { name: file.name })}><X size={17} /></button>
        </div>
      ))}
    </div>
  );
}

export function PrimaryButton({ children, disabled = false, loading = false, onClick, accent = "blue" }: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  accent?: ToolAccent;
}) {
  return (
    <button className={`primary-button accent-${accent}`} type="button" disabled={disabled || loading} onClick={onClick}>
      {loading && <LoaderCircle className="spin" size={19} />}
      {children}
    </button>
  );
}

export function ResultCard({ title, message, accent = "blue", children }: {
  title: string;
  message: string;
  accent?: ToolAccent;
  children?: ReactNode;
}) {
  const { t } = useTranslation("common");
  return (
    <section className={`result-card accent-${accent}`} aria-live="polite">
      <span className="result-icon"><Check size={24} /></span>
      <div><p className="eyebrow">{t("status.complete")}</p><h2>{title}</h2><p>{message}</p>{children}</div>
    </section>
  );
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
