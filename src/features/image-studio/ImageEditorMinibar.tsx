import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, Copy, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import type { EditorAlignment, EditorMinibarPosition, EditorSelectionState } from "./imageEditorTypes";

interface ImageEditorMinibarProps {
  position?: EditorMinibarPosition;
  selection: EditorSelectionState;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (alignment: EditorAlignment) => void;
}

export function ImageEditorMinibar({ position, selection, onColorChange, onWidthChange, onBringToFront, onSendToBack, onDuplicate, onDelete, onAlign }: ImageEditorMinibarProps) {
  const { t } = useTranslation("features");
  if (!position || selection.kind === "none") return null;
  const multiple = selection.kind === "multiple";
  return (
    <Card className={`image-editor-minibar gap-1 rounded-xl border border-border bg-card p-1.5 py-1.5 shadow-xl ring-0${multiple ? " is-multiple" : ""}`} role="toolbar" aria-label={t("image.editor.minibar")} data-testid="image-editor-minibar" data-selection-kind={selection.kind} style={{ left: position.left, top: position.top }}>
      {multiple ? <>{ALIGNMENTS.map(([alignment, Icon]) => <Button className="size-[34px] rounded-lg max-[820px]:size-11" variant="secondary" size="icon" type="button" title={t(`image.editor.alignment.${alignment}`)} aria-label={t(`image.editor.alignment.${alignment}`)} data-testid={`image-editor-align-${alignment}`} onClick={() => onAlign(alignment)} key={alignment}><Icon size={17} /></Button>)}<span className="image-editor-minibar-divider" aria-hidden="true" /></> : <>
      <label className="image-editor-minibar-color" title={t("image.editor.objectColor")}><span className="sr-only">{t("image.editor.objectColor")}</span><input type="color" value={selection.color} aria-label={t("image.editor.objectColor")} data-testid="image-editor-minibar-color" disabled={!selection.colorEnabled} onChange={(event) => onColorChange(event.target.value)} /></label>
      <label className="image-editor-minibar-width"><span>{selection.width}px</span><input type="range" min={0} max={40} step={1} value={selection.width} aria-label={t("image.editor.objectWidthLabel")} data-testid="image-editor-minibar-width" disabled={!selection.widthEnabled} onChange={(event) => onWidthChange(Number(event.target.value))} /></label>
      <span className="image-editor-minibar-divider" aria-hidden="true" />
      <Button className="size-[34px] rounded-lg max-[820px]:size-11" variant="secondary" size="icon" type="button" title={t("image.editor.front")} aria-label={t("image.editor.front")} disabled={selection.isBase} data-testid="image-editor-minibar-front" onClick={onBringToFront}><ArrowUpToLine size={17} /></Button>
      <Button className="size-[34px] rounded-lg max-[820px]:size-11" variant="secondary" size="icon" type="button" title={t("image.editor.back")} aria-label={t("image.editor.back")} disabled={selection.isBase} data-testid="image-editor-minibar-back" onClick={onSendToBack}><ArrowDownToLine size={17} /></Button>
      </>}
      <Button className="size-[34px] rounded-lg max-[820px]:size-11" variant="secondary" size="icon" type="button" title={t("image.editor.duplicate")} aria-label={t("image.editor.duplicate")} disabled={selection.isBase} data-testid="image-editor-minibar-duplicate" onClick={onDuplicate}><Copy size={17} /></Button>
      <Button className="size-[34px] rounded-lg max-[820px]:size-11" variant="destructive" size="icon" type="button" title={t("image.editor.delete")} aria-label={t("image.editor.delete")} disabled={selection.isBase} data-testid="image-editor-minibar-delete" onClick={onDelete}><Trash2 size={17} /></Button>
    </Card>
  );
}

const ALIGNMENTS = [
  ["left", AlignStartVertical],
  ["center-horizontal", AlignCenterVertical],
  ["right", AlignEndVertical],
  ["top", AlignStartHorizontal],
  ["center-vertical", AlignCenterHorizontal],
  ["bottom", AlignEndHorizontal],
] as const satisfies ReadonlyArray<readonly [EditorAlignment, typeof AlignStartVertical]>;
