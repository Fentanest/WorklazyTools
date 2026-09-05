import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

interface ImageEditorViewportControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ImageEditorViewportControls({ zoom, minZoom, maxZoom, onFit, onZoomIn, onZoomOut }: ImageEditorViewportControlsProps) {
  const { t } = useTranslation("features");
  return (
    <Card className="image-editor-viewport-controls gap-1 rounded-xl border border-border bg-muted p-1 py-1 shadow-none ring-0" role="toolbar" aria-label={t("image.editor.viewControls")} data-testid="image-editor-viewport-controls">
      <Button type="button" className="image-editor-fit-button h-[34px] rounded-lg px-2 text-xs font-bold" variant="outline" aria-label={t("image.editor.fit")} title={t("image.editor.fit")} data-testid="image-editor-fit" onClick={onFit}>
        <Maximize2 size={16} />
        <span>{t("image.editor.fit")}</span>
      </Button>
      <span className="image-editor-viewport-divider" aria-hidden="true" />
      <Button type="button" className="size-[34px] rounded-lg" variant="outline" size="icon" aria-label={t("image.editor.zoomOut")} title={t("image.editor.zoomOut")} data-testid="image-editor-zoom-out" disabled={zoom <= minZoom} onClick={onZoomOut}><ZoomOut size={17} /></Button>
      <output aria-label={t("image.editor.zoomLevel")} data-testid="image-editor-zoom-level">{Math.round(zoom * 100)}%</output>
      <Button type="button" className="size-[34px] rounded-lg" variant="outline" size="icon" aria-label={t("image.editor.zoomIn")} title={t("image.editor.zoomIn")} data-testid="image-editor-zoom-in" disabled={zoom >= maxZoom} onClick={onZoomIn}><ZoomIn size={17} /></Button>
    </Card>
  );
}
