import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <div className="image-editor-viewport-controls" role="toolbar" aria-label={t("image.editor.viewControls")} data-testid="image-editor-viewport-controls">
      <button type="button" className="image-editor-fit-button" aria-label={t("image.editor.fit")} title={t("image.editor.fit")} data-testid="image-editor-fit" onClick={onFit}>
        <Maximize2 size={16} />
        <span>{t("image.editor.fit")}</span>
      </button>
      <span className="image-editor-viewport-divider" aria-hidden="true" />
      <button type="button" aria-label={t("image.editor.zoomOut")} title={t("image.editor.zoomOut")} data-testid="image-editor-zoom-out" disabled={zoom <= minZoom} onClick={onZoomOut}><ZoomOut size={17} /></button>
      <output aria-label={t("image.editor.zoomLevel")} data-testid="image-editor-zoom-level">{Math.round(zoom * 100)}%</output>
      <button type="button" aria-label={t("image.editor.zoomIn")} title={t("image.editor.zoomIn")} data-testid="image-editor-zoom-in" disabled={zoom >= maxZoom} onClick={onZoomIn}><ZoomIn size={17} /></button>
    </div>
  );
}
