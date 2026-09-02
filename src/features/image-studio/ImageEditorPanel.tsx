import { CircleIcon, Eraser, FlipHorizontal2, FlipVertical2, Minus, Pencil, RotateCw, Square, Trash2, Type, Brush } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ToggleRow } from "../../components/ui";
import type { EditorDrawTool, EditorPanelName, EditorSelectionState, RegionEffect } from "./imageEditorTypes";

interface RegionSelectionSummary {
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
  brightness: number;
  contrast: number;
  hue: number;
  baseLocked: boolean;
  background: string;
  transparentBackground: boolean;
  onDrawToolChange: (tool: EditorDrawTool) => void;
  onDrawColorChange: (color: string) => void;
  onDrawWidthChange: (width: number) => void;
  onSelectionColorChange: (color: string) => void;
  onSelectionStrokeColorChange: (color: string) => void;
  onSelectionWidthChange: (width: number) => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onCropRatio: (ratio: number) => void;
  onCropCancel: () => void;
  onCropApply: () => void;
  onRegionEffectChange: (effect: RegionEffect) => void;
  onRegionEffectStrengthChange: (strength: number) => void;
  onRegionEffectCancel: () => void;
  onRegionEffectApply: () => void;
  onFilterChange: (kind: "brightness" | "contrast" | "hue", value: number) => void;
  onBaseLockChange: (locked: boolean) => void;
  onTextChange: (text: string) => void;
  onAddText: (text?: string) => void;
  onAddShape: (kind: "line" | "rect" | "circle") => void;
  onBackgroundChange: (color: string) => void;
  onTransparentBackgroundChange: (transparent: boolean) => void;
  onClearLayers: () => void;
}

export function ImageEditorPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const panelTitle = t(PANEL_TITLE_KEYS[props.activePanel]);

  return (
    <aside className="image-editor-panel" aria-label={t("image.editor.panelOptions", { panel: panelTitle })} data-panel={props.activePanel} data-testid="image-editor-options-panel">
      <header><strong>{panelTitle}</strong></header>
      <div className="image-editor-panel-body">
        {props.activePanel === "select" && <SelectPanel {...props} />}
        {props.activePanel === "crop" && <CropPanel {...props} />}
        {props.activePanel === "effect" && <EffectPanel {...props} />}
        {props.activePanel === "draw" && <DrawPanel {...props} />}
        {props.activePanel === "text" && <TextPanel {...props} />}
        {props.activePanel === "shapes" && <ShapesPanel {...props} />}
        {props.activePanel === "stickers" && <StickersPanel {...props} />}
        {props.activePanel === "canvas" && <CanvasPanel {...props} />}
      </div>
    </aside>
  );
}

function SelectPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const hasSelection = props.selection.kind !== "none";
  return (
    <div className={`editor-tool-group selection-style-controls${hasSelection ? "" : " is-disabled"}`} data-testid="image-editor-selection-controls">
      <strong>{hasSelection ? t(`image.editor.selectionKind.${props.selection.kind}`) : t("image.editor.noSelection")}</strong>
      <label><span>{t("image.editor.objectColor")}</span><input type="color" value={props.selection.color} aria-label={t("image.editor.objectColor")} data-testid="image-editor-select-color" disabled={!props.selection.colorEnabled} onChange={(event) => props.onSelectionColorChange(event.target.value)} /></label>
      {props.selection.strokeColorEnabled && <label><span>{t("image.editor.stroke")}</span><input type="color" value={props.selection.strokeColor} aria-label={t("image.editor.strokeLabel")} data-testid="image-editor-select-stroke" onChange={(event) => props.onSelectionStrokeColorChange(event.target.value)} /></label>}
      <label><span>{t("image.editor.objectWidth", { count: props.selection.width })}</span><input type="range" min={0} max={40} step={1} value={props.selection.width} aria-label={t("image.editor.objectWidthLabel")} data-testid="image-editor-select-width" disabled={!props.selection.widthEnabled} onChange={(event) => props.onSelectionWidthChange(Number(event.target.value))} /></label>
      <div className="icon-tool-row selection-transform-actions">
        <button title={t("image.editor.rotate")} aria-label={t("image.editor.rotate")} type="button" disabled={!hasSelection} onClick={props.onRotate}><RotateCw size={18} /></button>
        <button title={t("image.editor.flipH")} aria-label={t("image.editor.flipH")} type="button" disabled={!hasSelection} onClick={props.onFlipHorizontal}><FlipHorizontal2 size={18} /></button>
        <button title={t("image.editor.flipV")} aria-label={t("image.editor.flipV")} type="button" disabled={!hasSelection} onClick={props.onFlipVertical}><FlipVertical2 size={18} /></button>
      </div>
      {!hasSelection && <small>{t("image.editor.selectObject")}</small>}
      {props.selection.isBase && <small>{t("image.editor.baseStyleHint")}</small>}
    </div>
  );
}

function CropPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return (
    <div className="editor-tool-group">
      <div className="button-grid" data-testid="image-editor-crop-presets">
        <button type="button" onClick={() => props.onCropRatio(1)}>1:1</button>
        <button type="button" onClick={() => props.onCropRatio(4 / 3)}>4:3</button>
        <button type="button" onClick={() => props.onCropRatio(3 / 4)}>3:4</button>
        <button type="button" onClick={() => props.onCropRatio(16 / 9)}>16:9</button>
        <button type="button" onClick={() => props.onCropRatio(9 / 16)}>9:16</button>
      </div>
      <p className="image-crop-hint">{t("image.editor.cropHint")}</p>
      {props.regionSelection && <SelectionActions selection={props.regionSelection} busy={false} onCancel={props.onCropCancel} onApply={props.onCropApply} applyLabel={t("image.editor.cropApply")} testId="image-editor-crop-selection" />}
    </div>
  );
}

function EffectPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return (
    <div className={`editor-tool-group region-effect-controls${props.hasFile ? "" : " is-disabled"}`}>
      <strong>{t("image.editor.effectTitle")}</strong>
      <div className="button-grid region-effect-options" data-testid="image-editor-effect-options">
        {(["mosaic", "blur"] as const).map((effect) => <button type="button" className={props.regionEffect === effect ? "active" : ""} aria-pressed={props.regionEffect === effect} disabled={!props.hasFile || props.regionEffectBusy} onClick={() => props.onRegionEffectChange(effect)} key={effect}>{t(`image.editor.${effect}`)}</button>)}
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
    </div>
  );
}

function DrawPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  const tools = [["pencil", Pencil], ["brush", Brush], ["erase", Eraser]] as const;
  return (
    <div className="editor-tool-group">
      <div className="editor-draw-subtools" role="group" aria-label={t("image.editor.drawTools")}>
        {tools.map(([tool, Icon]) => <button type="button" className={props.drawTool === tool ? "active" : ""} aria-label={t(`image.editor.${tool === "erase" ? "eraser" : tool}`)} aria-pressed={props.drawTool === tool} data-testid={`image-editor-draw-${tool}`} onClick={() => props.onDrawToolChange(tool)} key={tool}><Icon size={18} /><span>{t(`image.editor.${tool === "erase" ? "eraser" : tool}`)}</span></button>)}
      </div>
      <label><span>{t("image.editor.color")}</span><input type="color" value={props.drawColor} aria-label={t("image.editor.color")} data-testid="image-editor-draw-color" onChange={(event) => props.onDrawColorChange(event.target.value)} /></label>
      <label><span>{t("image.editor.width", { count: props.drawWidth })}</span><input type="range" min={1} max={40} value={props.drawWidth} aria-label={t("image.editor.drawWidthLabel")} data-testid="image-editor-draw-width" onChange={(event) => props.onDrawWidthChange(Number(event.target.value))} /></label>
    </div>
  );
}

function TextPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return <div className="editor-tool-group"><div className="inline-input-action"><input value={props.text} aria-label={t("image.editor.textInput")} data-testid="image-editor-text-input" onChange={(event) => props.onTextChange(event.target.value)} /><button type="button" aria-label={t("image.editor.addText")} data-testid="image-editor-add-text" onClick={() => props.onAddText()}><Type size={16} /></button></div></div>;
}

function ShapesPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return <div className="editor-tool-group"><div className="icon-tool-row" data-testid="image-editor-shapes"><button title={t("image.editor.line")} aria-label={t("image.editor.line")} type="button" onClick={() => props.onAddShape("line")}><Minus size={18} /></button><button title={t("image.editor.rect")} aria-label={t("image.editor.rect")} type="button" onClick={() => props.onAddShape("rect")}><Square size={18} /></button><button title={t("image.editor.circle")} aria-label={t("image.editor.circle")} type="button" onClick={() => props.onAddShape("circle")}><CircleIcon size={18} /></button></div></div>;
}

function StickersPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return <div className="editor-tool-group"><p className="image-crop-hint">{t("image.editor.stickerHint")}</p><div className="button-grid sticker-grid" data-testid="image-editor-stickers">{["✨", "✅", "❤️", "📌"].map((emoji) => <button type="button" aria-label={t("image.editor.addSticker", { sticker: emoji })} onClick={() => props.onAddText(emoji)} key={emoji}>{emoji}</button>)}</div></div>;
}

function CanvasPanel(props: ImageEditorPanelProps) {
  const { t } = useTranslation("features");
  return <div className="editor-tool-group editor-background-control"><label><span>{t("image.editor.background")}</span><input type="color" value={props.background} aria-label={t("image.editor.background")} disabled={props.transparentBackground} onChange={(event) => props.onBackgroundChange(event.target.value)} /></label><div className="image-background-options compact"><ToggleRow label={t("image.editor.transparent")} description={t("image.editor.transparentOutput")} checked={props.transparentBackground} onChange={props.onTransparentBackgroundChange} /></div><button type="button" className="secondary-button" aria-label={t("image.editor.clearLayers")} data-testid="image-editor-clear-layers" onClick={props.onClearLayers}><Trash2 size={15} /> {t("image.editor.clearLayers")}</button></div>;
}

function SelectionActions({ selection, busy, onCancel, onApply, applyLabel, testId, effect = false }: { selection: RegionSelectionSummary; busy: boolean; onCancel: () => void; onApply: () => void; applyLabel: string; testId: string; effect?: boolean }) {
  const { t } = useTranslation("features");
  return <div className={`image-crop-selection-status${effect ? " region-effect-selection" : ""}`} data-testid={testId}><span>{t("image.editor.cropSelection", { width: Math.round(selection.width), height: Math.round(selection.height) })}</span><div><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>{t("image.editor.cropCancel")}</button><button type="button" className="primary-button" disabled={busy} onClick={onApply}>{applyLabel}</button></div></div>;
}

const PANEL_TITLE_KEYS = {
  select: "image.editor.panelSelect",
  crop: "image.editor.panelCrop",
  effect: "image.editor.panelEffect",
  draw: "image.editor.panelDraw",
  text: "image.editor.panelText",
  shapes: "image.editor.panelShapes",
  stickers: "image.editor.panelStickers",
  canvas: "image.editor.panelCanvas",
} as const satisfies Record<EditorPanelName, string>;
