import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, Copy, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  return <div
    className="image-editor-context-menu"
    role="menu"
    aria-label={t("image.editor.contextMenu")}
    data-testid="image-editor-context-menu"
    data-context-target={props.multiple ? "multiple" : props.text ? "text" : "object"}
    style={{ left: props.left, top: props.top }}
  >
    <button type="button" role="menuitem" data-testid="image-editor-context-duplicate" onClick={props.onDuplicate}><Copy size={16} />{t("image.editor.contextDuplicate")}</button>
    <button type="button" role="menuitem" data-testid="image-editor-context-delete" onClick={props.onDelete}><Trash2 size={16} />{t("image.editor.contextDelete")}</button>
    {props.multiple ? <AlignmentMenu onAlign={props.onAlign} /> : <>
      <button type="button" role="menuitem" data-testid="image-editor-context-front" onClick={props.onBringToFront}><ArrowUpToLine size={16} />{t("image.editor.front")}</button>
      <button type="button" role="menuitem" data-testid="image-editor-context-back" onClick={props.onSendToBack}><ArrowDownToLine size={16} />{t("image.editor.back")}</button>
      {props.text && <button type="button" role="menuitem" data-testid="image-editor-context-edit-text" onClick={props.onEditText}><Pencil size={16} />{t("image.editor.editText")}</button>}
    </>}
  </div>;
}

function AlignmentMenu({ onAlign }: { onAlign: (alignment: EditorAlignment) => void }) {
  const { t } = useTranslation("features");
  return <div className="image-editor-context-align" role="group" aria-label={t("image.editor.align")}>{ALIGNMENTS.map(([alignment, Icon]) => <button type="button" role="menuitem" title={t(`image.editor.alignment.${alignment}`)} aria-label={t(`image.editor.alignment.${alignment}`)} data-testid={`image-editor-context-align-${alignment}`} onClick={() => onAlign(alignment)} key={alignment}><Icon size={16} /></button>)}</div>;
}

const ALIGNMENTS = [
  ["left", AlignStartVertical],
  ["center-horizontal", AlignCenterVertical],
  ["right", AlignEndVertical],
  ["top", AlignStartHorizontal],
  ["center-vertical", AlignCenterHorizontal],
  ["bottom", AlignEndHorizontal],
] as const satisfies ReadonlyArray<readonly [EditorAlignment, typeof AlignStartVertical]>;
