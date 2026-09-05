import { Brush, Crop, Grid3X3, Layers3, Maximize2, MousePointer2, Palette, PanelRightClose, PanelRightOpen, Redo2, Smile, Square, Trash2, Type, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import type { EditorPanelName } from "./imageEditorTypes";

interface ImageEditorToolbarProps {
  activePanel: EditorPanelName;
  hasFile: boolean;
  effectBusy: boolean;
  canDelete: boolean;
  historyIndex: number;
  historyLength: number;
  panelCollapsed: boolean;
  panelToggleDisabled: boolean;
  onPanelChange: (panel: EditorPanelName) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onPanelToggle: () => void;
}

export function ImageEditorToolbar({
  activePanel,
  hasFile,
  effectBusy,
  canDelete,
  historyIndex,
  historyLength,
  panelCollapsed,
  panelToggleDisabled,
  onPanelChange,
  onUndo,
  onRedo,
  onDelete,
  onPanelToggle,
}: ImageEditorToolbarProps) {
  const { t } = useTranslation("features");
  const panels = [
    ["select", t("image.editor.panelSelect"), MousePointer2],
    ["crop", t("image.editor.panelCrop"), Crop],
    ["size", t("image.editor.panelSize"), Maximize2],
    ["effect", t("image.editor.panelEffect"), Grid3X3],
    ["draw", t("image.editor.panelDraw"), Brush],
    ["text", t("image.editor.panelText"), Type],
    ["shapes", t("image.editor.panelShapes"), Square],
    ["stickers", t("image.editor.panelStickers"), Smile],
    ["canvas", t("image.editor.panelCanvas"), Palette],
    ["layers", t("image.editor.panelLayers"), Layers3],
  ] as const;

  return (
    <Card className="image-editor-toolbar gap-0 rounded-2xl border border-border bg-muted p-1.5 py-1.5 shadow-none ring-0" data-testid="image-editor-toolbar">
      <div className="image-editor-panel-tabs" role="toolbar" aria-label={t("image.editor.tools")}>
        {panels.map(([panel, label, Icon]) => {
          const disabled = panel === "effect" && (!hasFile || effectBusy);
          return (
            <Button
              type="button"
              variant="ghost"
              className={cn("min-h-[50px] min-w-[57px] flex-1 flex-col gap-1 rounded-xl px-2 py-1 text-muted-foreground hover:bg-card hover:text-foreground", activePanel === panel && "active border border-border bg-card text-sky-700 shadow-sm hover:bg-card dark:text-sky-300")}
              aria-label={label}
              aria-pressed={activePanel === panel}
              data-testid={`image-editor-panel-${panel}`}
              disabled={disabled}
              onClick={() => onPanelChange(panel)}
              key={panel}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Button>
          );
        })}
      </div>
      <div className="editor-history-actions" role="group" aria-label={t("image.editor.history")}>
        <Button className="size-9 rounded-xl" variant="outline" size="icon" type="button" disabled={historyIndex <= 0} aria-label={t("image.editor.undo")} data-testid="image-editor-undo" onClick={onUndo}><Undo2 /></Button>
        <Button className="size-9 rounded-xl" variant="outline" size="icon" type="button" disabled={historyIndex >= historyLength - 1} aria-label={t("image.editor.redo")} data-testid="image-editor-redo" onClick={onRedo}><Redo2 /></Button>
        <Button className="size-9 rounded-xl" variant="outline" size="icon" type="button" disabled={!canDelete} aria-label={t("image.editor.deleteObject")} data-testid="image-editor-delete" onClick={onDelete}><Trash2 /></Button>
        <Button
          className="size-9 rounded-xl"
          variant="outline"
          size="icon"
          type="button"
          disabled={panelToggleDisabled}
          aria-label={t(panelCollapsed ? "image.editor.panelExpand" : "image.editor.panelCollapse")}
          aria-expanded={!panelCollapsed}
          data-testid="image-editor-panel-toggle"
          onClick={onPanelToggle}
        >{panelCollapsed ? <PanelRightOpen /> : <PanelRightClose />}</Button>
      </div>
    </Card>
  );
}
