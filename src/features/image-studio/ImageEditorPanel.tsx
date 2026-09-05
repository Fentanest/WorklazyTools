import { ArrowLeftRight, ArrowRight, Brush, CircleIcon, Eraser, FlipHorizontal2, FlipVertical2, Hexagon, Highlighter, MessageSquare, Minus, Pencil, RotateCw, Square, Star, Trash2, TriangleIcon, Type } from "lucide-react";
import { useTranslation } from "react-i18next";

import { UtilityInput } from "../../components/UtilitySurface";
import { ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { ImageEditorLayersPanel } from "./ImageEditorLayersPanel";
import { ImageStickerPicker } from "./ImageStickerPicker";
import type { ImageStudioSticker } from "./imageStudioStickers";
import type { EditorDrawTool, EditorLayerItem, EditorPanelName, EditorSelectionState, EditorShapeKind, RegionEffect } from "./imageEditorTypes";

interface RegionSelectionSummary {
  width: number;
  height: number;
}

interface EditorDimensions {
  width: number;
  height: number;
}

interface ImageEditorPanelProps {
  activePanel: EditorPanelName;
  drawTool: EditorDrawTool;
  drawColor: string;
  drawWidth: number;
  selection: EditorSelectionState;
  text: string;
  hasFile: boolean;
  regionEffect: RegionEffect;
  regionEffectStrength: number;
  regionEffectBusy: boolean;
  regionSelection?: RegionSelectionSummary;
  cropRatio?: number;
  unavailableCropRatios: readonly number[];
  canvasDimensions: EditorDimensions;
  resampleDimensions: EditorDimensions;
  canvasResizeDimensions: EditorDimensions;
  resampleRatioLocked: boolean;
  brightness: number;
  contrast: number;
  hue: number;
  baseLocked: boolean;
  background: string;
  transparentBackground: boolean;
  layers: readonly EditorLayerItem[];
  onDrawToolChange: (tool: EditorDrawTool) => void;
  onDrawColorChange: (color: string) => void;
  onDrawWidthChange: (width: number) => void;
  onSelectionColorChange: (color: string) => void;
  onSelectionStrokeColorChange: (color: string) => void;
  onSelectionWidthChange: (width: number) => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onCropRatio: (ratio?: number) => void;
  onCropCancel: () => void;
  onCropApply: () => void;
  onResampleDimensionChange: (axis: keyof EditorDimensions, value: number) => void;
  onResampleRatioLockChange: (locked: boolean) => void;
  onResampleApply: () => void;
  onCanvasResizeDimensionChange: (axis: keyof EditorDimensions, value: number) => void;
  onCanvasResizeApply: () => void;
  onRegionEffectChange: (effect: RegionEffect) => void;
  onRegionEffectStrengthChange: (strength: number) => void;
  onRegionEffectCancel: () => void;
  onRegionEffectApply: () => void;
  onFilterChange: (kind: "brightness" | "contrast" | "hue", value: number) => void;
  onBaseLockChange: (locked: boolean) => void;
  onTextChange: (text: string) => void;
  onAddText: (text?: string) => void;
  onAddShape: (kind: EditorShapeKind) => void;
  stickerBusy: boolean;
  onAddSticker: (sticker: ImageStudioSticker) => void;
  onBackgroundChange: (color: string) => void;
  onTransparentBackgroundChange: (transparent: boolean) => void;
  onClearLayers: () => void;
  onLayerSelect: (id: string) => void;
  onLayerVisibilityChange: (id: string) => void;
  onLayerDelete: (id: string) => void;
  onLayerReorder: (id: string, topIndex: number) => void;
}

export function ImageEditorPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const panelTitle = t(PANEL_TITLE_KEYS[props.activePanel]);

  return (
    <Card as="aside" className="image-editor-panel gap-0 overflow-hidden rounded-2xl border border-border bg-card py-0 shadow-lg ring-0 max-[820px]:rounded-t-3xl" aria-label={t("image.editor.panelOptions", { panel: panelTitle })} data-panel={props.activePanel} data-testid="image-editor-options-panel">
      <header className="flex min-h-11 items-center border-b border-border px-3 py-2"><strong className="text-sm">{panelTitle}</strong></header>
      <div className="image-editor-panel-body">
        {props.activePanel === "select" && <SelectPanel {...props} />}
        {props.activePanel === "crop" && <CropPanel {...props} />}
        {props.activePanel === "size" && <SizePanel {...props} />}
        {props.activePanel === "effect" && <EffectPanel {...props} />}
        {props.activePanel === "draw" && <DrawPanel {...props} />}
        {props.activePanel === "text" && <TextPanel {...props} />}
        {props.activePanel === "shapes" && <ShapesPanel {...props} />}
        {props.activePanel === "stickers" && <StickersPanel {...props} />}
        {props.activePanel === "canvas" && <CanvasPanel {...props} />}
        {props.activePanel === "layers" && <ImageEditorLayersPanel layers={props.layers} onSelect={props.onLayerSelect} onVisibilityChange={props.onLayerVisibilityChange} onDelete={props.onLayerDelete} onReorder={props.onLayerReorder} />}
      </div>
    </Card>
  );
}

function SelectPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const hasSelection = props.selection.kind !== "none";
  const multiple = props.selection.kind === "multiple";
  return (
    <Card
      className={`editor-tool-group selection-style-controls gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0${hasSelection ? "" : " is-disabled"}`}
      data-testid="image-editor-selection-controls"
      data-shape-kind={props.selection.shapeKind}
      data-shape-geometry={props.selection.geometry}
      data-shape-opacity={props.selection.opacity}
      data-shape-color={props.selection.color}
      data-shape-stroke={props.selection.strokeColor}
      data-shape-width={props.selection.width}
    >
      <strong>{hasSelection ? t(`image.editor.selectionKind.${props.selection.kind}`) : t("image.editor.noSelection")}</strong>
      <label><span>{t("image.editor.objectColor")}</span><input type="color" value={props.selection.color} aria-label={t("image.editor.objectColor")} data-testid="image-editor-select-color" disabled={!props.selection.colorEnabled} onChange={(event) => props.onSelectionColorChange(event.target.value)} /></label>
      {props.selection.strokeColorEnabled && <label><span>{t("image.editor.stroke")}</span><input type="color" value={props.selection.strokeColor} aria-label={t("image.editor.strokeLabel")} data-testid="image-editor-select-stroke" onChange={(event) => props.onSelectionStrokeColorChange(event.target.value)} /></label>}
      <label><span>{t("image.editor.objectWidth", { count: props.selection.width })}</span><input type="range" min={0} max={40} step={1} value={props.selection.width} aria-label={t("image.editor.objectWidthLabel")} data-testid="image-editor-select-width" disabled={!props.selection.widthEnabled} onChange={(event) => props.onSelectionWidthChange(Number(event.target.value))} /></label>
      {!multiple && <div className="icon-tool-row selection-transform-actions mt-2 flex flex-wrap gap-1.5">
        <Button className="size-9 rounded-xl text-sky-700 max-[820px]:size-11 dark:text-sky-300" variant="secondary" size="icon" title={t("image.editor.rotate")} aria-label={t("image.editor.rotate")} type="button" disabled={!hasSelection} onClick={props.onRotate}><RotateCw size={18} /></Button>
        <Button className="size-9 rounded-xl text-sky-700 max-[820px]:size-11 dark:text-sky-300" variant="secondary" size="icon" title={t("image.editor.flipH")} aria-label={t("image.editor.flipH")} type="button" disabled={!hasSelection} onClick={props.onFlipHorizontal}><FlipHorizontal2 size={18} /></Button>
        <Button className="size-9 rounded-xl text-sky-700 max-[820px]:size-11 dark:text-sky-300" variant="secondary" size="icon" title={t("image.editor.flipV")} aria-label={t("image.editor.flipV")} type="button" disabled={!hasSelection} onClick={props.onFlipVertical}><FlipVertical2 size={18} /></Button>
      </div>}
      {!hasSelection && <small>{t("image.editor.selectObject")}</small>}
      {props.selection.isBase && <small>{t("image.editor.baseStyleHint")}</small>}
    </Card>
  );
}

function CropPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const ratios = [
    [1, "1:1"],
    [4 / 3, "4:3"],
    [3 / 4, "3:4"],
    [16 / 9, "16:9"],
    [9 / 16, "9:16"],
  ] as const;
  return (
    <Card className="editor-tool-group gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0">
      <div className="button-grid" data-testid="image-editor-crop-presets">
        {ratios.map(([ratio, label]) => {
          const disabled = props.unavailableCropRatios.includes(ratio);
          const selected = props.cropRatio === ratio;
          return <Button type="button" variant="secondary" className={cn("min-h-9 rounded-xl text-sky-700 dark:text-sky-300", selected && "active bg-sky-700 text-white hover:bg-sky-800 dark:text-white")} aria-pressed={selected} disabled={disabled} title={disabled ? t("image.editor.cropRatioUnavailable") : undefined} onClick={() => props.onCropRatio(ratio)} key={label}>{label}</Button>;
        })}
        <Button type="button" variant="secondary" className={cn("min-h-9 rounded-xl text-sky-700 dark:text-sky-300", props.cropRatio === undefined && "active bg-sky-700 text-white hover:bg-sky-800 dark:text-white")} aria-pressed={props.cropRatio === undefined} onClick={() => props.onCropRatio(undefined)}>{t("image.editor.cropFree")}</Button>
      </div>
      <p className="image-crop-hint">{t("image.editor.cropHint")}</p>
      <SelectionActions selection={props.regionSelection} busy={false} onCancel={props.onCropCancel} onApply={props.onCropApply} applyLabel={t("image.editor.cropApply")} testId="image-editor-crop-selection" />
    </Card>
  );
}

function EffectPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return (
    <Card className={`editor-tool-group region-effect-controls gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0${props.hasFile ? "" : " is-disabled"}`}>
      <strong>{t("image.editor.effectTitle")}</strong>
      <div className="button-grid region-effect-options" data-testid="image-editor-effect-options">
        {(["mosaic", "blur"] as const).map((effect) => { const selected = props.regionEffect === effect; return <Button type="button" variant="secondary" className={cn("min-h-9 rounded-xl text-violet-700 dark:text-violet-300", selected && "active bg-violet-700 text-white hover:bg-violet-800 dark:text-white")} aria-pressed={selected} disabled={!props.hasFile || props.regionEffectBusy} onClick={() => props.onRegionEffectChange(effect)} key={effect}>{t(`image.editor.${effect}`)}</Button>; })}
      </div>
      <label>{t("image.editor.effectStrength")} <b>{props.regionEffectStrength}</b><input aria-label={t("image.editor.effectStrength")} data-testid="image-editor-effect-strength" disabled={!props.hasFile || props.regionEffectBusy} type="range" min={props.regionEffect === "blur" ? 10 : 4} max={40} step={1} value={props.regionEffectStrength} onChange={(event) => props.onRegionEffectStrengthChange(Number(event.target.value))} /></label>
      <p className="image-crop-hint">{t("image.editor.effectHint")}</p>
      {props.regionSelection && <SelectionActions selection={props.regionSelection} busy={props.regionEffectBusy} onCancel={props.onRegionEffectCancel} onApply={props.onRegionEffectApply} applyLabel={props.regionEffectBusy ? t("image.editor.effectBusy") : t(props.regionEffect === "mosaic" ? "image.editor.applyMosaic" : "image.editor.applyBlur")} testId="image-editor-effect-selection" effect />}
      <div className="image-adjustment-controls">
        <strong>{t("image.editor.adjust")}</strong>
        {(["brightness", "contrast", "hue"] as const).map((kind) => {
          const value = props[kind];
          return <label key={kind}>{t(`image.editor.${kind}`)} <b>{value}{kind === "hue" ? "°" : ""}</b><input disabled={!props.hasFile} type="range" min={kind === "hue" ? -180 : -80} max={kind === "hue" ? 180 : 80} value={value} aria-label={t(`image.editor.${kind}`)} onChange={(event) => props.onFilterChange(kind, Number(event.target.value))} /></label>;
        })}
        {props.hasFile && <ToggleRow label={t("image.editor.lock")} description={t("image.editor.lockHelp")} checked={props.baseLocked} onChange={props.onBaseLockChange} />}
      </div>
    </Card>
  );
}

function SizePanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const resampleUnchanged = props.resampleDimensions.width === props.canvasDimensions.width && props.resampleDimensions.height === props.canvasDimensions.height;
  const canvasResizeUnchanged = props.canvasResizeDimensions.width === props.canvasDimensions.width && props.canvasResizeDimensions.height === props.canvasDimensions.height;
  return <Card className="editor-tool-group image-size-controls rounded-xl bg-muted py-[11px] shadow-none ring-0">
    <section>
      <strong>{t("image.editor.resampleTitle")}</strong>
      <small>{t("image.editor.resampleHelp", { max: 4096 })}</small>
      <DimensionFields
        dimensions={props.resampleDimensions}
        max={4096}
        testId="image-editor-resample"
        onChange={props.onResampleDimensionChange}
      />
      <div className="image-size-toggle mt-2 overflow-hidden rounded-xl border border-border bg-card [&_[data-ui-component=toggle-row]]:min-h-[46px] [&_[data-ui-component=toggle-row]]:px-2.5 [&_[data-ui-component=toggle-row]]:py-2 [&_small]:text-xs [&_strong]:text-xs"><ToggleRow label={t("image.editor.keepRatio")} description={t("image.editor.keepRatioHelp")} checked={props.resampleRatioLocked} onChange={props.onResampleRatioLockChange} /></div>
      <Button type="button" className="mt-2 min-h-[38px] w-full rounded-xl bg-sky-700 text-white hover:bg-sky-800" data-testid="image-editor-resample-apply" disabled={resampleUnchanged} onClick={props.onResampleApply}>{t("image.editor.resampleApply")}</Button>
    </section>
    <section>
      <strong>{t("image.editor.canvasResizeTitle")}</strong>
      <small>{t("image.editor.canvasResizeHelp", { max: 4096 })}</small>
      <DimensionFields
        dimensions={props.canvasResizeDimensions}
        max={4096}
        testId="image-editor-canvas-resize"
        onChange={props.onCanvasResizeDimensionChange}
      />
      <Button type="button" className="mt-2 min-h-[38px] w-full rounded-xl bg-sky-700 text-white hover:bg-sky-800" data-testid="image-editor-canvas-resize-apply" disabled={canvasResizeUnchanged} onClick={props.onCanvasResizeApply}>{t("image.editor.canvasResizeApply")}</Button>
    </section>
  </Card>;
}

function DimensionFields({ dimensions, max, testId, onChange }: { dimensions: EditorDimensions; max: number; testId: string; onChange: (axis: keyof EditorDimensions, value: number) => void }) {
  const { t } = useTranslation("features");
  return <div className="image-dimension-fields" data-testid={testId} data-width={dimensions.width} data-height={dimensions.height}>
    <label><span>{t("image.editor.dimensionWidth")}</span><UtilityInput className="h-9 px-2 text-[13px] tabular-nums" type="number" min={1} max={max} step={1} value={dimensions.width} aria-label={t("image.editor.dimensionWidth")} data-testid={`${testId}-width`} onChange={(event) => onChange("width", Number(event.target.value))} /></label>
    <span aria-hidden="true">×</span>
    <label><span>{t("image.editor.dimensionHeight")}</span><UtilityInput className="h-9 px-2 text-[13px] tabular-nums" type="number" min={1} max={max} step={1} value={dimensions.height} aria-label={t("image.editor.dimensionHeight")} data-testid={`${testId}-height`} onChange={(event) => onChange("height", Number(event.target.value))} /></label>
  </div>;
}

function DrawPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const tools = [["pencil", Pencil], ["brush", Brush], ["erase", Eraser]] as const;
  return (
    <Card className="editor-tool-group gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0">
      <div className="editor-draw-subtools" role="group" aria-label={t("image.editor.drawTools")}>
        {tools.map(([tool, Icon]) => { const selected = props.drawTool === tool; return <Button type="button" variant="outline" className={cn("min-h-[54px] flex-col gap-1 rounded-xl p-1.5 text-muted-foreground", selected && "active border-sky-600 bg-sky-500/10 text-sky-700 dark:text-sky-300")} aria-label={t(`image.editor.${tool === "erase" ? "eraser" : tool}`)} aria-pressed={selected} data-testid={`image-editor-draw-${tool}`} onClick={() => props.onDrawToolChange(tool)} key={tool}><Icon size={18} /><span className="text-xs font-bold">{t(`image.editor.${tool === "erase" ? "eraser" : tool}`)}</span></Button>; })}
      </div>
      <label><span>{t("image.editor.color")}</span><input type="color" value={props.drawColor} aria-label={t("image.editor.color")} data-testid="image-editor-draw-color" onChange={(event) => props.onDrawColorChange(event.target.value)} /></label>
      <label><span>{t("image.editor.width", { count: props.drawWidth })}</span><input type="range" min={1} max={40} value={props.drawWidth} aria-label={t("image.editor.drawWidthLabel")} data-testid="image-editor-draw-width" onChange={(event) => props.onDrawWidthChange(Number(event.target.value))} /></label>
    </Card>
  );
}

function TextPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return <Card className="editor-tool-group gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0"><div className="inline-input-action grid grid-cols-[minmax(0,1fr)_36px] gap-1.5"><UtilityInput className="h-9" value={props.text} aria-label={t("image.editor.textInput")} data-testid="image-editor-text-input" onChange={(event) => props.onTextChange(event.target.value)} /><Button className="size-9 rounded-xl text-sky-700 dark:text-sky-300" variant="secondary" size="icon" type="button" aria-label={t("image.editor.addText")} data-testid="image-editor-add-text" onClick={() => props.onAddText()}><Type size={16} /></Button></div></Card>;
}

function ShapesPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const shapes = [
    ["line", "line", Minus],
    ["circle", "circle", CircleIcon],
    ["rounded-rect", "roundedRect", Square],
    ["triangle", "triangle", TriangleIcon],
    ["star", "star", Star],
    ["hexagon", "hexagon", Hexagon],
    ["speech-bubble", "speechBubble", MessageSquare],
    ["arrow", "arrow", ArrowRight],
    ["double-arrow", "doubleArrow", ArrowLeftRight],
    ["highlighter", "highlighter", Highlighter],
  ] as const satisfies ReadonlyArray<readonly [EditorShapeKind, string, typeof Square]>;
  return <Card className="editor-tool-group gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0"><div className="shape-picker-grid" data-testid="image-editor-shapes">{shapes.map(([kind, labelKey, Icon]) => <Button className="min-h-[50px] flex-col gap-1 rounded-xl p-1.5 text-sky-700 dark:text-sky-300" variant="secondary" title={t(`image.editor.${labelKey}`)} aria-label={t(`image.editor.${labelKey}`)} data-testid={`image-editor-shape-${kind}`} type="button" onClick={() => props.onAddShape(kind)} key={kind}><Icon size={19} /><span className="text-[10px] font-bold">{t(`image.editor.${labelKey}Short`)}</span></Button>)}</div></Card>;
}

function StickersPanel(props: ImageEditorPanelProps) {
  return <ImageStickerPicker busy={props.stickerBusy} onAddSticker={props.onAddSticker} />;
}

function CanvasPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return <Card className="editor-tool-group editor-background-control gap-0 rounded-xl bg-muted py-[11px] shadow-none ring-0"><label><span>{t("image.editor.background")}</span><input type="color" value={props.background} aria-label={t("image.editor.background")} disabled={props.transparentBackground} onChange={(event) => props.onBackgroundChange(event.target.value)} /></label><div className="image-background-options mt-0 overflow-hidden rounded-xl border border-border bg-card [&_[data-ui-component=toggle-row]]:min-h-[46px] [&_[data-ui-component=toggle-row]]:px-2.5 [&_[data-ui-component=toggle-row]]:py-2 [&_small]:text-xs [&_strong]:text-xs"><ToggleRow label={t("image.editor.transparent")} description={t("image.editor.transparentOutput")} checked={props.transparentBackground} onChange={props.onTransparentBackgroundChange} /></div><Button type="button" className="mt-2 w-full rounded-xl" variant="secondary" aria-label={t("image.editor.clearLayers")} data-testid="image-editor-clear-layers" onClick={props.onClearLayers}><Trash2 size={15} /> {t("image.editor.clearLayers")}</Button></Card>;
}

function SelectionActions({ selection, busy, onCancel, onApply, applyLabel, testId, effect = false }: { selection?: RegionSelectionSummary; busy: boolean; onCancel: () => void; onApply: () => void; applyLabel: string; testId: string; effect?: boolean }) {
  const { t } = useTranslation("features");
  const hasSelection = Boolean(selection && selection.width >= 10 && selection.height >= 10);
  const disabled = busy || !hasSelection;
  const reasonId = `${testId}-reason`;
  return <Card className={`image-crop-selection-status rounded-xl py-2.5 shadow-none ring-0${effect ? " region-effect-selection" : ""}`} data-testid={testId}>
    <span>{selection ? t("image.editor.cropSelection", { width: Math.round(selection.width), height: Math.round(selection.height) }) : t("image.editor.cropSelectionEmpty")}</span>
    {!hasSelection && <small id={reasonId}>{t("image.editor.cropSelectionRequired")}</small>}
    <div><Button type="button" className="rounded-xl" variant="secondary" data-testid={`${testId}-cancel`} disabled={disabled} onClick={onCancel}>{t("image.editor.cropCancel")}</Button><Button type="button" className={cn("rounded-xl text-white", effect ? "bg-violet-700 hover:bg-violet-800" : "bg-sky-700 hover:bg-sky-800")} data-tone={effect ? "violet" : "sky"} data-testid={`${testId}-apply`} disabled={disabled} aria-describedby={!hasSelection ? reasonId : undefined} onClick={onApply}>{applyLabel}</Button></div>
  </Card>;
}

const PANEL_TITLE_KEYS = {
  select: "image.editor.panelSelect",
  crop: "image.editor.panelCrop",
  size: "image.editor.panelSize",
  effect: "image.editor.panelEffect",
  draw: "image.editor.panelDraw",
  text: "image.editor.panelText",
  shapes: "image.editor.panelShapes",
  stickers: "image.editor.panelStickers",
  canvas: "image.editor.panelCanvas",
  layers: "image.editor.panelLayers",
} as const satisfies Record<EditorPanelName, string>;
