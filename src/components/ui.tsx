import { Check, FilePlus2, LoaderCircle, UploadCloud, X } from "lucide-react";
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
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Switch } from "./ui/switch";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

const accentButtonClasses = {
  green: "bg-green-700 text-white shadow-md shadow-green-700/20 hover:bg-green-800 focus-visible:border-green-700 focus-visible:ring-green-700/30",
  blue: "bg-blue-700 text-white shadow-md shadow-blue-700/20 hover:bg-blue-800 focus-visible:border-blue-700 focus-visible:ring-blue-700/30",
  violet: "bg-violet-700 text-white shadow-md shadow-violet-700/20 hover:bg-violet-800 focus-visible:border-violet-700 focus-visible:ring-violet-700/30",
  orange: "bg-orange-700 text-white shadow-md shadow-orange-700/20 hover:bg-orange-800 focus-visible:border-orange-700 focus-visible:ring-orange-700/30",
  pink: "bg-pink-700 text-white shadow-md shadow-pink-700/20 hover:bg-pink-800 focus-visible:border-pink-700 focus-visible:ring-pink-700/30",
  sky: "bg-sky-700 text-white shadow-md shadow-sky-700/20 hover:bg-sky-800 focus-visible:border-sky-700 focus-visible:ring-sky-700/30",
} satisfies Record<ToolAccent, string>;

const accentSoftClasses = {
  green: "bg-green-50 text-green-800 dark:bg-green-950/70 dark:text-green-300",
  blue: "bg-blue-50 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300",
  pink: "bg-pink-50 text-pink-800 dark:bg-pink-950/70 dark:text-pink-300",
  sky: "bg-sky-50 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300",
} satisfies Record<ToolAccent, string>;

const accentDraggingClasses = {
  green: "border-green-600 bg-green-50/80 dark:border-green-500 dark:bg-green-950/40",
  blue: "border-blue-600 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/40",
  violet: "border-violet-600 bg-violet-50/80 dark:border-violet-500 dark:bg-violet-950/40",
  orange: "border-orange-600 bg-orange-50/80 dark:border-orange-500 dark:bg-orange-950/40",
  pink: "border-pink-600 bg-pink-50/80 dark:border-pink-500 dark:bg-pink-950/40",
  sky: "border-sky-600 bg-sky-50/80 dark:border-sky-500 dark:bg-sky-950/40",
} satisfies Record<ToolAccent, string>;

const accentResultClasses = {
  green: "border-green-200 bg-green-50/70 dark:border-green-900 dark:bg-green-950/35",
  blue: "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/35",
  violet: "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/35",
  orange: "border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/35",
  pink: "border-pink-200 bg-pink-50/70 dark:border-pink-900 dark:bg-pink-950/35",
  sky: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/35",
} satisfies Record<ToolAccent, string>;

export function PageHeader({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
        <p className="page-description mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>
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
    <Card
      as="section"
      className={cn(
        "section-card gap-0 overflow-visible rounded-4xl p-6 [.hwp-editor-focus_&]:overflow-hidden [.hwp-editor-focus_&]:rounded-2xl [.hwp-editor-focus_&]:p-0 [.hwp-editor-focus_&]:ring-0",
        className,
      )}
    >
      <div className="section-heading mb-5">
        {step && <span className="step-number rounded-lg">{step}</span>}
        <div><h2 className="font-heading font-medium">{title}</h2>{description && <p className="text-muted-foreground">{description}</p>}</div>
      </div>
      {children}
    </Card>
  );
}

export function SegmentedControl<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      className="segmented-control grid w-full grid-flow-col auto-cols-fr rounded-full bg-muted p-1"
      value={[value]}
      onValueChange={(nextValues) => {
        const nextValue = nextValues.at(-1) as T | undefined;
        if (nextValue !== undefined) onChange(nextValue);
      }}
      aria-label={label}
      spacing={1}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn("min-w-0 flex-1 rounded-3xl px-3 text-muted-foreground", value === option.value && "selected")}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
      <Switch
        className={cn("ios-switch", checked && "checked")}
        checked={checked}
        onCheckedChange={(nextChecked) => onChange(nextChecked)}
        aria-label={label}
        disabled={disabled}
        nativeButton
        render={<button type="button" />}
      />
    </div>
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

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    await appendFiles(event.dataTransfer.files);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragging(false);
  };

  return (
    <div className="drop-zone-wrap">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <input ref={inputRef} id={id} className="visually-hidden" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={handleChange} />
      <Card
        className={cn(
          `drop-zone accent-${accent}`,
          "min-h-28 flex-row gap-3 overflow-visible rounded-4xl border border-dashed border-border bg-muted/40 p-4 shadow-none ring-0",
          dragging && ["dragging", accentDraggingClasses[accent]],
          disabled && "disabled opacity-50",
        )}
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
        <span className={cn("drop-icon rounded-2xl", accentSoftClasses[accent])}>{files.length ? <FilePlus2 size={25} /> : <UploadCloud size={25} />}</span>
        <div aria-live="polite"><strong>{files.length ? `${t("files.selected", { count: files.length })}${multiple ? ` · ${t("files.keepAdding")}` : ""}` : t("files.dropHere")}</strong><span>{hint}</span></div>
        <Button className="secondary-button small h-10 rounded-2xl font-semibold" variant="secondary" size="lg" disabled={disabled} onClick={() => inputRef.current?.click()}>{multiple && files.length ? t("actions.addFiles") : t("actions.selectFile")}</Button>
        {files.length > 0 && <em className="drop-added-status" key={files.length}><Check size={12} /> {t("files.added")}</em>}
      </Card>
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
    <Card as="ul" className="file-list gap-0 rounded-3xl py-0 shadow-sm ring-0">
      {files.map((file, index) => (
        <li className="file-row" key={`${file.name}-${file.lastModified}-${index}`}>
          <span className={cn(`file-type accent-${accent}`, accentSoftClasses[accent])}>{file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span>
          <span className="file-meta"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
          <Button className="remove-button rounded-full" variant="ghost" size="icon-sm" onClick={() => onRemove(index)} aria-label={t("files.remove", { name: file.name })}><X size={17} /></Button>
        </li>
      ))}
    </Card>
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
    <Button
      className={cn(`primary-button accent-${accent}`, "h-12 w-full rounded-2xl text-[15px] font-bold", accentButtonClasses[accent])}
      size="lg"
      disabled={disabled || loading}
      aria-busy={loading}
      onClick={onClick}
    >
      {loading && <LoaderCircle className="spin" size={19} aria-hidden="true" />}
      {children}
    </Button>
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
    <Card as="section" className={cn(`result-card accent-${accent}`, "grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-4xl border p-6 shadow-sm ring-0", accentResultClasses[accent])} aria-live="polite">
      <span className={cn("result-icon rounded-2xl", accentButtonClasses[accent])}><Check size={24} /></span>
      <div><p className="eyebrow">{t("status.complete")}</p><h2 className="font-heading font-medium">{title}</h2><p>{message}</p>{children}</div>
    </Card>
  );
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
