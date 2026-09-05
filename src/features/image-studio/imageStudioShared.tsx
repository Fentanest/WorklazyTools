import { ClipboardPaste } from "lucide-react";
import type { TFunction } from "i18next";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { UtilityField, UtilityInput, UtilitySelect } from "../../components/UtilitySurface";
import { ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { CollageLayoutError } from "./collageLayout";
import type { ImageOutputFormat, ImageWorkerResult } from "./types";

export const RASTER_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export interface ProcessPanelProps { progress: ReturnType<typeof useOperationProgress>; controllerRef: React.MutableRefObject<AbortController | undefined>; }

export async function runPanelTask(controllerRef: ProcessPanelProps["controllerRef"], progress: ProcessPanelProps["progress"], task: (controller: AbortController) => Promise<ImageWorkerResult>, success: string, t: TFunction<"features">) {
  const controller = new AbortController(); controllerRef.current = controller; progress.start(t("image.batch.prepare"));
  try { const result = await task(controller); downloadWorkerResult(result); progress.succeed(success); }
  catch (error) { progress.fail(normalizePanelError(error, t)); }
  finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
}

export function NumberField({ label, value, onChange, disabled = false, min = 1 }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number }) { return <UtilityField><span>{label}</span><UtilityInput type="number" min={min} value={value} disabled={disabled} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></UtilityField>; }
export function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) { return <UtilityField><span>{label} <b className="text-sky-700 tabular-nums dark:text-sky-300">{Math.round(value * 100)}%</b></span><input className="h-10 w-full [accent-color:var(--color-sky-700)]" type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></UtilityField>; }
export function FormatField({ value, onChange }: { value: ImageOutputFormat; onChange: (value: ImageOutputFormat) => void }) { const { t } = useTranslation("features"); return <UtilityField><span>{t("image.common.output")}</span><UtilitySelect value={value} onChange={(event) => onChange(event.target.value as ImageOutputFormat)}><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option></UtilitySelect></UtilityField>; }

export function TransparencyControl({ checked, onChange, format }: { checked: boolean; onChange: (value: boolean) => void; format: ImageOutputFormat }) {
  const { t } = useTranslation("features");
  return <div className="image-background-options mt-3 overflow-hidden rounded-2xl border border-border [&_[data-ui-component=toggle-row]]:min-h-[50px]"><ToggleRow label={t("image.common.transparent")} description={t("image.common.transparentHelp")} checked={checked} onChange={onChange} /><p className="m-0 border-t border-border bg-muted px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">{format === "jpeg" ? t("image.common.jpeg") : t("image.common.alpha")}</p></div>;
}

export function ClipboardHint({ mode }: { mode: "replace" | "append" }) {
  const { t } = useTranslation("features");
  return <div className="clipboard-image-hint mt-2 flex items-center gap-2 text-[13px] leading-relaxed text-muted-foreground"><ClipboardPaste className="shrink-0 text-sky-700 dark:text-sky-300" size={15} /><span>{t("image.common.clipboard", { action: mode === "replace" ? t("image.common.replace") : t("image.common.append") })}</span></div>;
}

export function useClipboardImages(onImages: (files: File[]) => void) {
  const { t } = useTranslation("features");
  const callbackRef = useRef(onImages);
  useEffect(() => { callbackRef.current = onImages; }, [onImages]);
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
      const pasted = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === "file" && /^(?:image\/(?:png|jpeg|webp))$/i.test(item.type))
        .map((item, index) => item.getAsFile() ? clipboardFile(item.getAsFile() as File, index, t("image.common.clipboardPrefix")) : undefined)
        .filter((file): file is File => Boolean(file));
      if (!pasted.length) return;
      event.preventDefault();
      callbackRef.current(pasted);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [t]);
}

function clipboardFile(source: File, index: number, prefix: string) {
  const extension = source.type === "image/jpeg" ? "jpg" : source.type === "image/webp" ? "webp" : "png";
  return new File([source], `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${index + 1}.${extension}`, { type: source.type, lastModified: Date.now() });
}

export function calculatePreviewScale(width: number, height: number) {
  return Math.max(0.01, Math.min(1, 820 / width, 5_000 / height, Math.sqrt(6_000_000 / Math.max(1, width * height))));
}

export function drawContainedPreview(context: CanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawnWidth = bitmap.width * scale; const drawnHeight = bitmap.height * scale;
  context.drawImage(bitmap, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

export function drawCoveredPreview(context: CanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  const targetRatio = width / height; const sourceRatio = bitmap.width / bitmap.height;
  const sourceWidth = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
  const sourceHeight = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;
  context.drawImage(bitmap, (bitmap.width - sourceWidth) / 2, (bitmap.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height);
}

export function filterRasterImages(files: File[]) { return files.filter((file) => /^(image\/(?:jpeg|png|webp))$/i.test(file.type) || /\.(?:jpe?g|png|webp)$/i.test(file.name)); }
export function normalizePanelError(error: unknown, t: TFunction<"features">) {
  if (error instanceof DOMException && error.name === "AbortError") return t("image.common.cancelled");
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "COLLAGE_SIZE") return t("image.collage.sizeError");
  if (code === "COLLAGE_COLUMNS") return t("image.collage.columnError");
  if (error instanceof CollageLayoutError) return error.code === "COLLAGE_SIZE" ? t("image.collage.sizeError") : t("image.collage.columnError");
  return error instanceof Error && error.message ? error.message : t("image.common.failed");
}
export function downloadWorkerResult(result: ImageWorkerResult) { const url = URL.createObjectURL(new Blob([result.buffer], { type: result.mimeType })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 15_000); }
export function moveItem<T>(items: T[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
