import { Brush, Eye, EyeOff, GripVertical, ImageIcon, Lock, Minus, Smile, Square, Trash2, Type } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Sortable from "sortablejs";

import type { EditorLayerItem, EditorLayerKind } from "./imageEditorTypes";

interface ImageEditorLayersPanelProps {
  layers: readonly EditorLayerItem[];
  onSelect: (id: string) => void;
  onVisibilityChange: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, topIndex: number) => void;
}

export function ImageEditorLayersPanel({ layers, onSelect, onVisibilityChange, onDelete, onReorder }: ImageEditorLayersPanelProps) {
  const { t } = useTranslation("features");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const sortable = Sortable.create(list, {
      animation: 140,
      draggable: ".image-editor-layer-row.is-movable",
      handle: ".image-editor-layer-drag",
      ghostClass: "is-dragging",
      onEnd: ({ item, oldIndex, newIndex }) => {
        const id = item.getAttribute("data-layer-id");
        const topIndex = Array.from(list.querySelectorAll<HTMLElement>(".image-editor-layer-row.is-movable")).findIndex((row) => row.dataset.layerId === id);
        restoreSortableDom(list, oldIndex, newIndex);
        if (id && topIndex >= 0) onReorder(id, topIndex);
      },
    });
    return () => sortable.destroy();
  }, [onReorder]);

  return <div className="editor-tool-group image-editor-layers" data-testid="image-editor-layers">
    <p>{t("image.editor.layersHelp")}</p>
    <div ref={listRef} className="image-editor-layer-list" role="list" aria-label={t("image.editor.layersList")}>
      {layers.map((layer) => {
        const Icon = LAYER_ICONS[layer.kind];
        return <div
          className={`image-editor-layer-row${layer.isBase ? " is-base" : " is-movable"}${layer.active ? " is-active" : ""}`}
          data-layer-id={layer.id}
          data-layer-kind={layer.kind}
          data-layer-visible={layer.visible}
          data-layer-base={layer.isBase}
          role="listitem"
          key={layer.id}
        >
          <button type="button" className="image-editor-layer-select" aria-pressed={layer.active} onClick={() => onSelect(layer.id)}>
            {layer.isBase ? <Lock size={14} className="image-editor-layer-lock" aria-label={t("image.editor.layerLocked")} /> : <GripVertical size={15} className="image-editor-layer-drag" aria-hidden="true" />}
            <Icon size={17} />
            <span>{t(`image.editor.layerKind.${layer.kind}`)}</span>
          </button>
          <button type="button" className="image-editor-layer-visibility" aria-label={t(layer.visible ? "image.editor.layerHide" : "image.editor.layerShow", { layer: t(`image.editor.layerKind.${layer.kind}`) })} onClick={() => onVisibilityChange(layer.id)}>{layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          <button type="button" className="image-editor-layer-delete" aria-label={t("image.editor.layerDelete", { layer: t(`image.editor.layerKind.${layer.kind}`) })} disabled={layer.isBase} onClick={() => onDelete(layer.id)}><Trash2 size={16} /></button>
        </div>;
      })}
      {!layers.length && <p className="image-editor-layers-empty">{t("image.editor.layersEmpty")}</p>}
    </div>
  </div>;
}

const LAYER_ICONS = {
  base: ImageIcon,
  text: Type,
  line: Minus,
  shape: Square,
  drawing: Brush,
  sticker: Smile,
} as const satisfies Record<EditorLayerKind, typeof Square>;

function restoreSortableDom(container: HTMLElement, oldIndex?: number, newIndex?: number) {
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
  const moved = container.children[newIndex];
  if (!moved) return;
  if (oldIndex < newIndex) container.insertBefore(moved, container.children[oldIndex] || null);
  else container.insertBefore(moved, container.children[oldIndex + 1] || null);
}
