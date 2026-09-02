import { Brush, Crop, Grid3X3, MousePointer2, Palette, Redo2, Smile, Square, Trash2, Type, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { EditorPanelName } from "./imageEditorTypes";

interface ImageEditorToolbarProps {
  activePanel: EditorPanelName;
  hasFile: boolean;
  effectBusy: boolean;
  canDelete: boolean;
  historyIndex: number;
  historyLength: number;
  onPanelChange: (panel: EditorPanelName) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}

export function ImageEditorToolbar({
  activePanel,
  hasFile,
  effectBusy,
  canDelete,
  historyIndex,
  historyLength,
  onPanelChange,
  onUndo,
  onRedo,
  onDelete,
}: ImageEditorToolbarProps) {
  const { t } = useTranslation("features");
  const panels = [
    ["select", t("image.editor.panelSelect"), MousePointer2],
    ["crop", t("image.editor.panelCrop"), Crop],
    ["effect", t("image.editor.panelEffect"), Grid3X3],
    ["draw", t("image.editor.panelDraw"), Brush],
    ["text", t("image.editor.panelText"), Type],
    ["shapes", t("image.editor.panelShapes"), Square],
    ["stickers", t("image.editor.panelStickers"), Smile],
    ["canvas", t("image.editor.panelCanvas"), Palette],
  ] as const;

  return (
    <div className="image-editor-toolbar" data-testid="image-editor-toolbar">
      <div className="image-editor-panel-tabs" role="toolbar" aria-label={t("image.editor.tools")}>
        {panels.map(([panel, label, Icon]) => {
          const disabled = panel === "effect" && (!hasFile || effectBusy);
          return (
            <button
              type="button"
              className={activePanel === panel ? "active" : ""}
              aria-label={label}
              aria-pressed={activePanel === panel}
              data-testid={`image-editor-panel-${panel}`}
              disabled={disabled}
              onClick={() => onPanelChange(panel)}
              key={panel}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="editor-history-actions" role="group" aria-label={t("image.editor.history")}>
        <button type="button" disabled={historyIndex <= 0} aria-label={t("image.editor.undo")} data-testid="image-editor-undo" onClick={onUndo}><Undo2 /></button>
        <button type="button" disabled={historyIndex >= historyLength - 1} aria-label={t("image.editor.redo")} data-testid="image-editor-redo" onClick={onRedo}><Redo2 /></button>
        <button type="button" disabled={!canDelete} aria-label={t("image.editor.deleteObject")} data-testid="image-editor-delete" onClick={onDelete}><Trash2 /></button>
      </div>
    </div>
  );
}
