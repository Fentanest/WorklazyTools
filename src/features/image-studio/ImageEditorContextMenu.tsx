import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, Copy, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import type { EditorAlignment } from "./imageEditorTypes";

interface ImageEditorContextMenuProps {
  left: number;
  top: number;
  multiple: boolean;
  text: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onEditText: () => void;
  onAlign: (alignment: EditorAlignment) => void;
}

export function ImageEditorContextMenu(props: ImageEditorContextMenuProps) {
  const { t } = useTranslation("features");
  return <Card
    className="image-editor-context-menu gap-1 rounded-xl border border-border bg-card p-1.5 py-1.5 shadow-xl ring-0"
    role="menu"
    aria-label={t("image.editor.contextMenu")}
    data-testid="image-editor-context-menu"
    data-context-target={props.multiple ? "multiple" : props.text ? "text" : "object"}
    style={{ left: props.left, top: props.top }}
  >
    <Button className="min-h-9 justify-start rounded-lg px-2.5 text-xs font-bold" variant="ghost" type="button" role="menuitem" data-testid="image-editor-context-duplicate" onClick={props.onDuplicate}><Copy size={16} />{t("image.editor.contextDuplicate")}</Button>
    <Button className="min-h-9 justify-start rounded-lg px-2.5 text-xs font-bold" variant="ghost" type="button" role="menuitem" data-testid="image-editor-context-delete" onClick={props.onDelete}><Trash2 size={16} />{t("image.editor.contextDelete")}</Button>
    {props.multiple ? <AlignmentMenu onAlign={props.onAlign} /> : <>
      <Button className="min-h-9 justify-start rounded-lg px-2.5 text-xs font-bold" variant="ghost" type="button" role="menuitem" data-testid="image-editor-context-front" onClick={props.onBringToFront}><ArrowUpToLine size={16} />{t("image.editor.front")}</Button>
      <Button className="min-h-9 justify-start rounded-lg px-2.5 text-xs font-bold" variant="ghost" type="button" role="menuitem" data-testid="image-editor-context-back" onClick={props.onSendToBack}><ArrowDownToLine size={16} />{t("image.editor.back")}</Button>
      {props.text && <Button className="min-h-9 justify-start rounded-lg px-2.5 text-xs font-bold" variant="ghost" type="button" role="menuitem" data-testid="image-editor-context-edit-text" onClick={props.onEditText}><Pencil size={16} />{t("image.editor.editText")}</Button>}
    </>}
  </Card>;
}

function AlignmentMenu({ onAlign }: { onAlign: (alignment: EditorAlignment) => void }) {
  const { t } = useTranslation("features");
  return <div className="image-editor-context-align" role="group" aria-label={t("image.editor.align")}>{ALIGNMENTS.map(([alignment, Icon]) => <Button className="size-[34px] rounded-lg" variant="secondary" size="icon" type="button" role="menuitem" title={t(`image.editor.alignment.${alignment}`)} aria-label={t(`image.editor.alignment.${alignment}`)} data-testid={`image-editor-context-align-${alignment}`} onClick={() => onAlign(alignment)} key={alignment}><Icon size={16} /></Button>)}</div>;
}

const ALIGNMENTS = [
  ["left", AlignStartVertical],
  ["center-horizontal", AlignCenterVertical],
  ["right", AlignEndVertical],
  ["top", AlignStartHorizontal],
  ["center-vertical", AlignCenterHorizontal],
  ["bottom", AlignEndHorizontal],
] as const satisfies ReadonlyArray<readonly [EditorAlignment, typeof AlignStartVertical]>;
