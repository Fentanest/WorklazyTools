import { Brush, Eye, EyeOff, GripVertical, ImageIcon, Lock, Minus, Smile, Square, Trash2, Type } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Sortable from "sortablejs";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
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

  return <Card className="editor-tool-group image-editor-layers gap-0 rounded-xl bg-muted py-2 shadow-none ring-0" data-testid="image-editor-layers">
    <p>{t("image.editor.layersHelp")}</p>
    <div ref={listRef} className="image-editor-layer-list" role="list" aria-label={t("image.editor.layersList")}>
      {layers.map((layer) => {
        const Icon = LAYER_ICONS[layer.kind];
        return <Card
          className={cn("image-editor-layer-row gap-1 rounded-xl border border-border bg-card p-1 py-1 shadow-none ring-0", layer.isBase ? "is-base" : "is-movable", layer.active && "is-active border-sky-600 ring-2 ring-sky-500/10")}
          data-layer-id={layer.id}
          data-layer-kind={layer.kind}
          data-layer-visible={layer.visible}
          data-layer-base={layer.isBase}
          role="listitem"
          key={layer.id}
        >
          <Button type="button" variant="ghost" className="image-editor-layer-select h-[34px] min-w-0 justify-start gap-2 rounded-lg px-1.5 text-xs font-bold" aria-pressed={layer.active} onClick={() => onSelect(layer.id)}>
            {layer.isBase ? <Lock size={14} className="image-editor-layer-lock" aria-label={t("image.editor.layerLocked")} /> : <span className="image-editor-layer-drag" aria-hidden="true"><GripVertical size={15} /></span>}
            <Icon size={17} />
            <span>{t(`image.editor.layerKind.${layer.kind}`)}</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" className="image-editor-layer-visibility size-[34px] rounded-lg text-sky-700 max-[820px]:size-11 dark:text-sky-300" aria-label={t(layer.visible ? "image.editor.layerHide" : "image.editor.layerShow", { layer: t(`image.editor.layerKind.${layer.kind}`) })} onClick={() => onVisibilityChange(layer.id)}>{layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}</Button>
          <Button type="button" variant="destructive" size="icon" className="image-editor-layer-delete size-[34px] rounded-lg max-[820px]:size-11" aria-label={t("image.editor.layerDelete", { layer: t(`image.editor.layerKind.${layer.kind}`) })} disabled={layer.isBase} onClick={() => onDelete(layer.id)}><Trash2 size={16} /></Button>
        </Card>;
      })}
      {!layers.length && <p className="image-editor-layers-empty">{t("image.editor.layersEmpty")}</p>}
    </div>
  </Card>;
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
