import { AlertTriangle, Download, ImageIcon, Images, LayoutGrid, Sparkles } from "lucide-react";
import { ActiveSelection, Canvas, Circle, Control, FabricImage, FabricObject, IText, Line, PencilBrush, Point, Rect, controlsUtils, filters, util, type TMat2D, type TPointerEvent, type Transform } from "fabric";
import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard } from "../../components/UtilitySurface";
import { FileDropZone, PageHeader, PrimaryButton, SegmentedControl, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { BatchImagePanel, CollagePanel, GifPanel } from "./ImageProcessingPanels";
import { ImageEditorContextMenu } from "./ImageEditorContextMenu";
import { ImageEditorMinibar } from "./ImageEditorMinibar";
import { ImageEditorPanel } from "./ImageEditorPanel";
import { ImageEditorToolbar } from "./ImageEditorToolbar";
import { ImageEditorViewportControls } from "./ImageEditorViewportControls";
import { getImageStudioStickerUrl, type ImageStudioSticker } from "./imageStudioStickers";
import { ClipboardHint, RASTER_IMAGE_ACCEPT, filterRasterImages, useClipboardImages } from "./imageStudioShared";
import { applyEditorShapeStyle, createEditorShape, getEditorShapeGeometry, getEditorShapeKind, getEditorShapeStyleCapabilities } from "./imageEditorShapes";
import { alignEditorObjects, enforceEditorLayerInvariant, isEditorAdditionalLayer, isEditorOverlay, isEditorRegionEffect, moveEditorLayer } from "./imageEditorLayers";
import {
  EMPTY_EDITOR_SELECTION,
  type EditorAlignment,
  type EditorDrawTool,
  type EditorInteractionMode,
  type EditorLayerItem,
  type EditorLayerKind,
  type EditorMinibarPosition,
  type EditorPanelName,
  type EditorSelectionState,
  type EditorShapeKind,
  type RegionEffect,
} from "./imageEditorTypes";
import {
  anchorRegionEffect,
  mapCanvasSelectionToImagePixels,
  resolveRegionEffectSourceStrength,
  type ImagePixelRegion,
} from "./regionEffectTransform";
import type { ImageOutputFormat } from "./types";

type StudioTab = "editor" | "batch" | "collage" | "gif";

const EDITOR_MIN_ZOOM = 0.25;
const EDITOR_MAX_ZOOM = 4;
const EDITOR_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
const IDENTITY_VIEWPORT: TMat2D = [1, 0, 0, 1, 0, 0];
const EDITOR_WORK_MAX_DIMENSION = 4096;
const EDITOR_EXPORT_MAX_DIMENSION = 8192;
const EDITOR_PANEL_STORAGE_KEY = "worklazy:image-editor-panel-collapsed";

export function ImageStudioPage() {
  const { t } = useTranslation("features");
  const [tab, setTab] = useState<StudioTab>("editor");
  const progress = useOperationProgress();
  const activeController = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => activeController.current?.abort(), []);

  return (
    <UtilityPage toolId="image-studio" className="image-studio-page">
      <PageHeader eyebrow="IMAGE STUDIO" title={t("image.title")} description={t("image.description")}>
        <PrivacyBanner compact />
      </PageHeader>
      <Card as="nav" className="studio-tabs mb-3 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted p-1.5 py-1.5 shadow-none ring-0 max-[620px]:grid-cols-2" aria-label={t("image.tabs.label")} data-testid="image-studio-tabs">
        {([
          ["editor", t("image.tabs.editor"), ImageIcon], ["batch", t("image.tabs.batch"), Images], ["collage", t("image.tabs.collage"), LayoutGrid], ["gif", t("image.tabs.gif"), Sparkles],
        ] as const).map(([value, label, Icon]) => <Button type="button" variant="ghost" className={cn("min-h-11 rounded-xl text-muted-foreground hover:bg-card hover:text-foreground", tab === value && "active bg-card text-sky-700 shadow-sm hover:bg-card dark:text-sky-300")} aria-pressed={tab === value} data-state={tab === value ? "active" : "inactive"} onClick={() => { activeController.current?.abort(); activeController.current = undefined; setTab(value); progress.reset(); }} key={value}><Icon size={17} /><span>{label}</span></Button>)}
      </Card>

      <UtilityNotice className="image-format-notice mb-2"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span>{t("image.heic")}</span></UtilityNotice>
      {(tab === "batch" || tab === "collage" || tab === "gif") && <UtilityNotice className="image-worker-notice mb-2"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span>{t("image.offscreen")}</span></UtilityNotice>}

      {tab === "editor" && <ImageEditor />}
      {tab === "batch" && <BatchImagePanel progress={progress} controllerRef={activeController} />}
      {tab === "collage" && <CollagePanel progress={progress} controllerRef={activeController} />}
      {tab === "gif" && <GifPanel progress={progress} controllerRef={activeController} />}

      <OperationProgress {...progress} accent="sky" title={t("image.log")} />
      {progress.status === "running" && <div className="mt-2 flex justify-end"><Button className="rounded-xl" variant="secondary" type="button" onClick={() => activeController.current?.abort()}>{t("image.cancel")}</Button></div>}

      <ToolGuide
        title={t("image.guide.title")}
        description={t("image.guide.description")}
        blocks={(t("image.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("image.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </UtilityPage>
  );
}

type EditorObjectRole = "base" | "region-effect" | "sticker" | "crop-overlay";

interface RegionSelection {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RegionLabelPosition {
  left: number;
  top: number;
}

interface EditorContextMenuState {
  left: number;
  top: number;
  target: FabricObject;
  multiple: boolean;
  text: boolean;
}

type CropRatio = number | undefined;
type EditorExportMode = "original" | "custom";

interface EditorDimensions {
  width: number;
  height: number;
}

const CROP_PRESET_RATIOS = [1, 4 / 3, 3 / 4, 16 / 9, 9 / 16] as const;
const CROP_MIN_SIZE = 10;

type EditorFabricObject = FabricObject & { worklazyRole?: EditorObjectRole; worklazyAnchorX?: number; worklazyAnchorY?: number; worklazyShapeKind?: EditorShapeKind };

for (const property of ["worklazyRole", "worklazyAnchorX", "worklazyAnchorY", "worklazyShapeKind", "imageSmoothing"]) {
  if (!FabricObject.customProperties.includes(property)) FabricObject.customProperties.push(property);
}

interface EditorHistorySnapshot {
  canvas: object;
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  hue: number;
  background: string;
  transparentBackground: boolean;
  baseLocked: boolean;
  outputMultiplier: number;
}

function ImageEditor() {
  const { t } = useTranslation("features");
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const stageElement = useRef<HTMLDivElement>(null);
  const canvas = useRef<Canvas | undefined>(undefined);
  const baseImage = useRef<FabricImage | undefined>(undefined);
  const sourceUrl = useRef<string | undefined>(undefined);
  const outputMultiplierRef = useRef(1);
  const cropOverlay = useRef<Rect | undefined>(undefined);
  const effectOverlay = useRef<Rect | undefined>(undefined);
  const cropOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  const effectOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  const cropSelectionRef = useRef<RegionSelection | undefined>(undefined);
  const effectSelectionRef = useRef<RegionSelection | undefined>(undefined);
  const cropRatioRef = useRef<CropRatio>(undefined);
  const cropDragRatioRef = useRef<CropRatio>(undefined);
  const regionEffectUrls = useRef(new Set<string>());
  const regionEffectBusyRef = useRef(false);
  const interactionModeRef = useRef<EditorInteractionMode>("select");
  const mobilePanelLayoutRef = useRef(false);
  const sanitizingSelectionRef = useRef(false);
  const layerIdsRef = useRef(new WeakMap<FabricObject, string>());
  const layerObjectsRef = useRef(new Map<string, FabricObject>());
  const nextLayerIdRef = useRef(1);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const restoringRef = useRef(false);
  const snapshotTimerRef = useRef<number | undefined>(undefined);
  const [file, setFile] = useState<File>();
  const [text, setText] = useState("Worklazy Tools");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [hue, setHue] = useState(0);
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  const [outputMultiplier, setOutputMultiplier] = useState(1);
  const [canvasDimensions, setCanvasDimensions] = useState<EditorDimensions>({ width: 900, height: 600 });
  const [resampleDimensions, setResampleDimensions] = useState<EditorDimensions>({ width: 900, height: 600 });
  const [canvasResizeDimensions, setCanvasResizeDimensions] = useState<EditorDimensions>({ width: 900, height: 600 });
  const [resampleRatioLocked, setResampleRatioLocked] = useState(true);
  const [exportMode, setExportMode] = useState<EditorExportMode>("original");
  const [exportDimensions, setExportDimensions] = useState<EditorDimensions>({ width: 900, height: 600 });
  const [exportRatioLocked, setExportRatioLocked] = useState(true);
  const [background, setBackground] = useState("#ffffff");
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [baseLocked, setBaseLocked] = useState(true);
  const [interactionMode, setInteractionMode] = useState<EditorInteractionMode>("select");
  const [activePanel, setActivePanel] = useState<EditorPanelName>("select");
  const [drawTool, setDrawTool] = useState<EditorDrawTool>("pencil");
  const [drawColor, setDrawColor] = useState("#1d1d1f");
  const [drawWidth, setDrawWidth] = useState(7);
  const [viewZoom, setViewZoom] = useState(1);
  const [historyState, setHistoryState] = useState({ index: -1, length: 0 });
  const [stageDragging, setStageDragging] = useState(false);
  const [selectionState, setSelectionState] = useState<EditorSelectionState>(EMPTY_EDITOR_SELECTION);
  const [layers, setLayers] = useState<EditorLayerItem[]>([]);
  const [minibarPosition, setMinibarPosition] = useState<EditorMinibarPosition>();
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState>();
  const [editorError, setEditorError] = useState("");
  const [cropSelection, setCropSelection] = useState<RegionSelection>();
  const [cropRatio, setCropRatio] = useState<CropRatio>(undefined);
  const [effectSelection, setEffectSelection] = useState<RegionSelection>();
  const [regionLabelPosition, setRegionLabelPosition] = useState<RegionLabelPosition>();
  const [regionEffect, setRegionEffect] = useState<RegionEffect>("mosaic");
  const [regionEffectStrength, setRegionEffectStrength] = useState(16);
  const [regionEffectBusy, setRegionEffectBusy] = useState(false);
  const [stickerBusy, setStickerBusy] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(readStoredEditorPanelCollapsed);
  const mobilePanelLayout = useEditorMobilePanelLayout();
  mobilePanelLayoutRef.current = mobilePanelLayout;
  const effectivePanelCollapsed = panelCollapsed && !mobilePanelLayout;
  const editorSettings = useRef({ brightness, contrast, hue, background, transparentBackground, baseLocked });
  editorSettings.current = { brightness, contrast, hue, background, transparentBackground, baseLocked };
  cropRatioRef.current = cropRatio;

  const updateOutputMultiplier = useCallback((value: number) => {
    const normalized = Math.max(Number.EPSILON, Number.isFinite(value) ? value : 1);
    outputMultiplierRef.current = normalized;
    setOutputMultiplier(normalized);
  }, []);

  const syncDimensionControls = useCallback((width: number, height: number) => {
    const next = { width: clampEditorDimension(width, EDITOR_WORK_MAX_DIMENSION), height: clampEditorDimension(height, EDITOR_WORK_MAX_DIMENSION) };
    setCanvasDimensions(next);
    setResampleDimensions(next);
    setCanvasResizeDimensions(next);
    setExportDimensions(next);
  }, []);

  const updateMinibarPosition = useCallback(() => {
    const instance = canvas.current;
    const stage = stageElement.current;
    const object = instance?.getActiveObject();
    const role = object && (object as EditorFabricObject).worklazyRole;
    if (!instance || !stage || !object || object === cropOverlay.current || object === effectOverlay.current || role === "region-effect" || role === "crop-overlay") {
      setMinibarPosition(undefined);
      return;
    }
    const canvasBounds = instance.upperCanvasEl.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const objectBounds = object.getBoundingRect();
    const scaleX = canvasBounds.width / Math.max(1, instance.getWidth());
    const scaleY = canvasBounds.height / Math.max(1, instance.getHeight());
    const [zoomX, , , zoomY, panX, panY] = instance.viewportTransform;
    const rawLeft = canvasBounds.left - stageBounds.left + ((objectBounds.left + objectBounds.width / 2) * zoomX + panX) * scaleX;
    const rawTop = canvasBounds.top - stageBounds.top + (objectBounds.top * zoomY + panY) * scaleY - 10;
    const minibar = stage.querySelector<HTMLElement>("[data-testid='image-editor-minibar']");
    const minibarWidth = minibar?.getBoundingClientRect().width || Math.min(310, stage.clientWidth - 16);
    const horizontalInset = Math.min(stage.clientWidth / 2, minibarWidth / 2 + 8);
    setMinibarPosition({
      left: Math.max(horizontalInset, Math.min(stage.clientWidth - horizontalInset, rawLeft)),
      top: Math.max(58, Math.min(stage.clientHeight - 8, rawTop)),
    });
  }, []);

  const syncLayerPanel = useCallback(() => {
    const instance = canvas.current;
    if (!instance) {
      layerObjectsRef.current.clear();
      setLayers([]);
      return;
    }
    const active = new Set(instance.getActiveObjects());
    const nextObjects = instance.getObjects().filter((object) => !isEditorRegionEffect(object) && !isEditorOverlay(object)).reverse();
    layerObjectsRef.current.clear();
    setLayers(nextObjects.map((object) => {
      let id = layerIdsRef.current.get(object);
      if (!id) {
        id = `layer-${nextLayerIdRef.current++}`;
        layerIdsRef.current.set(object, id);
      }
      layerObjectsRef.current.set(id, object);
      const kind = getEditorLayerKind(object);
      return {
        id,
        kind,
        name: object instanceof IText && object.text.trim() ? object.text.trim() : undefined,
        visible: object.visible,
        isBase: object === baseImage.current || (object as EditorFabricObject).worklazyRole === "base",
        active: active.has(object),
      };
    }));
  }, []);

  const updateRegionLabelPosition = useCallback(() => {
    const instance = canvas.current;
    const stage = stageElement.current;
    const selection = interactionModeRef.current === "crop"
      ? cropSelectionRef.current
      : interactionModeRef.current === "effect" ? effectSelectionRef.current : undefined;
    if (!instance || !stage || !selection) {
      setRegionLabelPosition(undefined);
      return;
    }
    const canvasBounds = instance.upperCanvasEl.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const scaleX = canvasBounds.width / Math.max(1, instance.getWidth());
    const scaleY = canvasBounds.height / Math.max(1, instance.getHeight());
    const [zoomX, , , zoomY, panX, panY] = instance.viewportTransform;
    setRegionLabelPosition({
      left: canvasBounds.left - stageBounds.left + ((selection.left + selection.width) * zoomX + panX) * scaleX,
      top: canvasBounds.top - stageBounds.top + ((selection.top + selection.height) * zoomY + panY) * scaleY,
    });
  }, []);

  const updateFloatingOverlays = useCallback(() => {
    updateMinibarPosition();
    updateRegionLabelPosition();
  }, [updateMinibarPosition, updateRegionLabelPosition]);

  const syncCanvasDisplay = useResponsiveFabricCanvas(canvas, stageElement, updateFloatingOverlays);

  useEffect(() => {
    try {
      sessionStorage.setItem(EDITOR_PANEL_STORAGE_KEY, panelCollapsed ? "1" : "0");
    } catch {
      // The editor remains usable when session storage is unavailable.
    }
  }, [panelCollapsed]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-testid='image-editor-context-menu']")) setContextMenu(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setContextMenu(undefined); };
    const close = () => setContextMenu(undefined);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    window.requestAnimationFrame(syncCanvasDisplay);
  }, [effectivePanelCollapsed, syncCanvasDisplay]);

  const applyViewportTransform = useCallback((instance: Canvas, viewport: TMat2D) => {
    instance.setViewportTransform(viewport);
    setViewZoom(instance.getZoom());
    instance.requestRenderAll();
    window.requestAnimationFrame(updateFloatingOverlays);
  }, [updateFloatingOverlays]);

  const resetViewport = useCallback((instance = canvas.current) => {
    if (!instance) return;
    applyViewportTransform(instance, [...IDENTITY_VIEWPORT]);
    window.requestAnimationFrame(syncCanvasDisplay);
  }, [applyViewportTransform, syncCanvasDisplay]);

  const changeViewZoom = useCallback((direction: "in" | "out") => {
    const instance = canvas.current;
    if (!instance) return;
    const current = instance.getZoom();
    const candidates = direction === "in" ? EDITOR_ZOOM_STEPS : [...EDITOR_ZOOM_STEPS].reverse();
    const next = candidates.find((value) => direction === "in" ? value > current + 0.001 : value < current - 0.001);
    if (next === undefined) return;
    const center = new Point(instance.getWidth() / 2, instance.getHeight() / 2);
    instance.zoomToPoint(center, next);
    setViewZoom(instance.getZoom());
    instance.requestRenderAll();
    window.requestAnimationFrame(updateFloatingOverlays);
  }, [updateFloatingOverlays]);

  const pushSnapshot = useCallback((immediate = false, reset = false) => {
    const save = () => {
      const instance = canvas.current;
      if (!instance || restoringRef.current) return;
      const settings = editorSettings.current;
      const snapshot = JSON.stringify({
        canvas: instance.toJSON(),
        width: instance.getWidth(),
        height: instance.getHeight(),
        ...settings,
        outputMultiplier: outputMultiplierRef.current,
      } satisfies EditorHistorySnapshot);
      if (reset) {
        historyRef.current = [];
        historyIndexRef.current = -1;
      }
      if (historyRef.current[historyIndexRef.current] === snapshot) return;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(snapshot);
      if (historyRef.current.length > 60) historyRef.current.shift();
      historyIndexRef.current = historyRef.current.length - 1;
      setHistoryState({ index: historyIndexRef.current, length: historyRef.current.length });
      regionEffectUrls.current.forEach((url) => {
        if (historyRef.current.some((entry) => entry.includes(url))) return;
        URL.revokeObjectURL(url);
        regionEffectUrls.current.delete(url);
      });
    };
    window.clearTimeout(snapshotTimerRef.current);
    if (immediate) save();
    else snapshotTimerRef.current = window.setTimeout(save, 80);
  }, []);

  const syncSelectedObject = useCallback((object?: FabricObject) => {
    const role = object && (object as EditorFabricObject).worklazyRole;
    if (!object || object === cropOverlay.current || object === effectOverlay.current || role === "region-effect" || role === "crop-overlay") {
      setSelectionState(EMPTY_EDITOR_SELECTION);
      setMinibarPosition(undefined);
      syncLayerPanel();
      return;
    }
    setSelectionState(getEditorSelectionState(object));
    syncLayerPanel();
    window.requestAnimationFrame(updateMinibarPosition);
  }, [syncLayerPanel, updateMinibarPosition]);

  const sanitizeEditorSelection = useCallback((instance: Canvas, event?: Event) => {
    if (sanitizingSelectionRef.current) return instance.getActiveObject();
    const active = instance.getActiveObject();
    const rubberBandBaseOnly = active === baseImage.current && event?.type === "mouseup" && !mobilePanelLayoutRef.current;
    if (!(active instanceof ActiveSelection) && !rubberBandBaseOnly) return active;
    const selected = active instanceof ActiveSelection ? active.getObjects() : active ? [active] : [];
    const filtered = selected.filter((object) => object !== baseImage.current && isEditorAdditionalLayer(object, baseImage.current) && object.visible);
    if (active instanceof ActiveSelection && filtered.length === selected.length) return active;
    sanitizingSelectionRef.current = true;
    try {
      instance.discardActiveObject(event as TPointerEvent | undefined);
      setEditorActiveObjects(instance, filtered, event as TPointerEvent | undefined);
      instance.requestRenderAll();
      return instance.getActiveObject();
    } finally {
      sanitizingSelectionRef.current = false;
    }
  }, []);

  const syncCropOverlaySelection = useCallback((overlay: Rect, normalize = false, activeRatio: CropRatio = cropRatioRef.current) => {
    const instance = canvas.current;
    if (!instance || cropOverlay.current !== overlay) return;
    const selection = constrainCropOverlay(overlay, instance, normalize, activeRatio);
    cropSelectionRef.current = selection;
    setCropSelection(selection);
    instance.requestRenderAll();
    window.requestAnimationFrame(updateRegionLabelPosition);
  }, [updateRegionLabelPosition]);

  const clearCropSelection = useCallback(() => {
    const instance = canvas.current;
    const overlay = cropOverlay.current;
    cropOrigin.current = undefined;
    cropDragRatioRef.current = undefined;
    cropSelectionRef.current = undefined;
    setCropSelection(undefined);
    if (instance && overlay) {
      instance.remove(overlay);
      instance.requestRenderAll();
    }
    cropOverlay.current = undefined;
    if (interactionModeRef.current === "crop") setRegionLabelPosition(undefined);
  }, []);

  const clearEffectSelection = useCallback(() => {
    const instance = canvas.current;
    const overlay = effectOverlay.current;
    effectOrigin.current = undefined;
    effectSelectionRef.current = undefined;
    setEffectSelection(undefined);
    if (instance && overlay) {
      instance.remove(overlay);
      instance.requestRenderAll();
    }
    effectOverlay.current = undefined;
    if (interactionModeRef.current === "effect") setRegionLabelPosition(undefined);
  }, []);

  const clearRegionSelection = useCallback(() => {
    clearCropSelection();
    clearEffectSelection();
  }, [clearCropSelection, clearEffectSelection]);

  const setKeyboardRegionSelection = useCallback((mode: "crop" | "effect", selection: RegionSelection) => {
    const instance = canvas.current;
    if (!instance) return;
    const effectMode = mode === "effect";
    const overlayRef = effectMode ? effectOverlay : cropOverlay;
    let overlay = overlayRef.current;
    if (!overlay) {
      overlay = new Rect({
        ...selection,
        originX: "left",
        originY: "top",
        fill: effectMode ? "rgba(175,82,222,.14)" : "rgba(10,132,255,.14)",
        stroke: effectMode ? "#af52de" : "#0a84ff",
        strokeWidth: 2,
        strokeDashArray: [9, 6],
        strokeUniform: true,
        selectable: !effectMode,
        evented: !effectMode,
        excludeFromExport: true,
      });
      if (!effectMode) {
        (overlay as EditorFabricObject).worklazyRole = "crop-overlay";
        configureCropOverlay(overlay, () => cropRatioRef.current);
      }
      overlayRef.current = overlay;
      instance.add(overlay);
    }
    overlay.set({ ...selection, scaleX: 1, scaleY: 1 });
    overlay.setCoords();
    if (effectMode) {
      effectSelectionRef.current = selection;
      setEffectSelection(selection);
    } else {
      cropSelectionRef.current = selection;
      setCropSelection(selection);
      instance.setActiveObject(overlay);
    }
    instance.requestRenderAll();
    window.requestAnimationFrame(updateRegionLabelPosition);
  }, [updateRegionLabelPosition]);

  const handleStageKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const instance = canvas.current;
    if (!instance) return;
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    const mode = interactionModeRef.current;
    if (isRegionMode(mode) && (event.key === "Enter" || arrows.includes(event.key))) {
      event.preventDefault();
      event.stopPropagation();
      const canvasWidth = instance.getWidth();
      const canvasHeight = instance.getHeight();
      const ratio = mode === "crop" ? cropRatioRef.current : undefined;
      const initialWidth = ratio ? Math.min(canvasWidth * 0.5, canvasHeight * 0.5 * ratio) : canvasWidth * 0.5;
      const initialHeight = ratio ? initialWidth / ratio : canvasHeight * 0.5;
      const initial: RegionSelection = {
        left: (canvasWidth - initialWidth) / 2,
        top: (canvasHeight - initialHeight) / 2,
        width: Math.max(10, initialWidth),
        height: Math.max(10, initialHeight),
      };
      const current = (mode === "crop" ? cropSelectionRef.current : effectSelectionRef.current) ?? initial;
      if (event.key === "Enter") {
        setKeyboardRegionSelection(mode, current);
        return;
      }
      const step = event.altKey ? 1 : 10;
      let next = { ...current };
      if (event.shiftKey) {
        const grow = event.key === "ArrowRight" || event.key === "ArrowDown" ? step : -step;
        if (ratio) {
          const proposedWidth = event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? current.width + grow
            : (current.height + grow) * ratio;
          next.width = Math.max(10, Math.min(canvasWidth - current.left, proposedWidth));
          next.height = Math.max(10, Math.min(canvasHeight - current.top, next.width / ratio));
          next.width = next.height * ratio;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          next.width = Math.max(10, Math.min(canvasWidth - current.left, current.width + grow));
        } else {
          next.height = Math.max(10, Math.min(canvasHeight - current.top, current.height + grow));
        }
      } else {
        if (event.key === "ArrowLeft") next.left -= step;
        if (event.key === "ArrowRight") next.left += step;
        if (event.key === "ArrowUp") next.top -= step;
        if (event.key === "ArrowDown") next.top += step;
        next.left = Math.max(0, Math.min(canvasWidth - next.width, next.left));
        next.top = Math.max(0, Math.min(canvasHeight - next.height, next.top));
      }
      setKeyboardRegionSelection(mode, next);
      return;
    }
    if (!arrows.includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 60 : event.altKey ? 1 : 20;
    const viewport = [...instance.viewportTransform] as TMat2D;
    if (event.key === "ArrowLeft") viewport[4] -= step;
    if (event.key === "ArrowRight") viewport[4] += step;
    if (event.key === "ArrowUp") viewport[5] -= step;
    if (event.key === "ArrowDown") viewport[5] += step;
    applyViewportTransform(instance, viewport);
  }, [applyViewportTransform, setKeyboardRegionSelection]);

  useEffect(() => {
    if (!canvasElement.current) return;
    // Keep construction in this React effect: synchronous failures reach RouteErrorBoundary.
    const instance = new Canvas(canvasElement.current, { width: 900, height: 600, backgroundColor: "#ffffff", preserveObjectStacking: true });
    canvas.current = instance;
    const disposeViewportGestures = installEditorViewportGestures({
      instance,
      stage: stageElement.current,
      onGestureStart: () => {
        cropOrigin.current = undefined;
        effectOrigin.current = undefined;
        const cancelledTarget = cancelCurrentFabricInteraction(instance);
        if (cancelledTarget === baseImage.current && baseImage.current) syncRegionEffectTransforms(instance, baseImage.current);
        if (cancelledTarget === cropOverlay.current && cropOverlay.current) syncCropOverlaySelection(cropOverlay.current);
        syncSelectedObject(instance.getActiveObject());
      },
      onViewportChange: (viewport) => applyViewportTransform(instance, viewport),
    });
    const syncSelection = (event?: { e?: Event }) => syncSelectedObject(sanitizeEditorSelection(instance, event?.e));
    const onPath = (event: { path: FabricObject }) => {
      if (interactionModeRef.current === "erase") event.path.set({ globalCompositeOperation: "destination-out", selectable: false, evented: false });
      pushSnapshot();
      syncLayerPanel();
    };
    instance.on("selection:created", syncSelection);
    instance.on("selection:updated", syncSelection);
    instance.on("selection:cleared", syncSelection);
    instance.on("path:created", onPath);
    const syncObjectTransform = (event: { target?: FabricObject }) => {
      if (event.target === baseImage.current && baseImage.current) {
        syncRegionEffectTransforms(instance, baseImage.current);
        instance.requestRenderAll();
      }
      updateMinibarPosition();
    };
    instance.on("object:moving", (event) => {
      if (event.target === cropOverlay.current) {
        syncCropOverlaySelection(event.target as Rect);
        return;
      }
      syncObjectTransform(event);
    });
    instance.on("object:rotating", syncObjectTransform);
    instance.on("object:scaling", (event) => {
      if (event.target === cropOverlay.current) {
        const activeRatio = cropRatioRef.current ?? (event.e.shiftKey ? 1 : undefined);
        syncCropOverlaySelection(event.target as Rect, false, activeRatio);
        return;
      }
      syncObjectTransform(event);
    });
    instance.on("object:skewing", syncObjectTransform);
    instance.on("object:modified", (event) => {
      if (event.target === cropOverlay.current) {
        const activeRatio = cropRatioRef.current ?? (event.e?.shiftKey ? 1 : undefined);
        syncCropOverlaySelection(event.target as Rect, true, activeRatio);
        instance.setActiveObject(event.target);
        syncSelectedObject();
        return;
      }
      syncObjectTransform(event);
      syncSelectedObject(event.target);
      pushSnapshot();
    });
    instance.on("object:added", (event) => {
      if (event.target !== cropOverlay.current && event.target !== effectOverlay.current) pushSnapshot();
      syncLayerPanel();
    });
    instance.on("object:removed", (event) => {
      if (event.target !== cropOverlay.current && event.target !== effectOverlay.current) pushSnapshot();
      syncLayerPanel();
    });
    instance.on("contextmenu", (event) => {
      setContextMenu(undefined);
      if (mobilePanelLayoutRef.current) return;
      const active = instance.getActiveObject();
      const eventTarget = event.target;
      const multiple = active instanceof ActiveSelection && (eventTarget === active || Boolean(eventTarget && active.getObjects().includes(eventTarget)));
      const target = multiple ? active : eventTarget;
      const role = target && (target as EditorFabricObject).worklazyRole;
      if (!target || target === baseImage.current || role === "base" || role === "region-effect" || role === "crop-overlay") return;
      if (!multiple && target !== active) {
        instance.setActiveObject(target, event.e as TPointerEvent);
        syncSelectedObject(target);
        instance.requestRenderAll();
      }
      const stage = stageElement.current;
      const pointer = event.e as Event & { clientX?: number; clientY?: number };
      if (!stage || pointer.clientX === undefined || pointer.clientY === undefined) return;
      const bounds = stage.getBoundingClientRect();
      setContextMenu({
        left: Math.max(8, Math.min(Math.max(8, stage.clientWidth - 200), pointer.clientX - bounds.left)),
        top: Math.max(8, Math.min(Math.max(8, stage.clientHeight - 190), pointer.clientY - bounds.top)),
        target,
        multiple,
        text: target instanceof IText,
      });
    });
    instance.on("mouse:down", () => setContextMenu(undefined));
    instance.on("mouse:down", (event) => {
      const mode = interactionModeRef.current;
      if (!isRegionMode(mode) || regionEffectBusyRef.current) return;
      if (isNonPrimaryMouseEvent(event.e)) return;
      if (mode === "crop" && cropOverlay.current && event.target === cropOverlay.current) return;
      const point = event.scenePoint;
      const x = Math.max(0, Math.min(instance.getWidth(), point.x));
      const y = Math.max(0, Math.min(instance.getHeight(), point.y));
      const effectMode = mode === "effect";
      if (effectMode) clearEffectSelection();
      else clearCropSelection();
      const originRef = effectMode ? effectOrigin : cropOrigin;
      const overlayRef = effectMode ? effectOverlay : cropOverlay;
      originRef.current = { x, y };
      cropDragRatioRef.current = effectMode ? undefined : cropRatioRef.current;
      const overlay = new Rect({ left: x, top: y, width: 1, height: 1, originX: "left", originY: "top", fill: effectMode ? "rgba(175,82,222,.14)" : "rgba(10,132,255,.14)", stroke: effectMode ? "#af52de" : "#0a84ff", strokeWidth: 2, strokeDashArray: [9, 6], strokeUniform: true, selectable: !effectMode, evented: !effectMode, excludeFromExport: true });
      if (!effectMode) {
        (overlay as EditorFabricObject).worklazyRole = "crop-overlay";
        configureCropOverlay(overlay, () => cropRatioRef.current);
      }
      overlayRef.current = overlay;
      instance.add(overlay);
      instance.requestRenderAll();
    });
    instance.on("mouse:move", (event) => {
      const mode = interactionModeRef.current;
      if (!isRegionMode(mode)) return;
      const effectMode = mode === "effect";
      const origin = (effectMode ? effectOrigin : cropOrigin).current;
      const overlay = (effectMode ? effectOverlay : cropOverlay).current;
      if (!origin || !overlay) return;
      const x = Math.max(0, Math.min(instance.getWidth(), event.scenePoint.x));
      const y = Math.max(0, Math.min(instance.getHeight(), event.scenePoint.y));
      const nativeEvent = event.e as TPointerEvent;
      const requestedRatio = effectMode ? undefined : cropRatioRef.current ?? (nativeEvent.shiftKey ? 1 : undefined);
      const activeRatio = requestedRatio && canFitCropRatio(instance.getWidth(), instance.getHeight(), requestedRatio) ? requestedRatio : undefined;
      cropDragRatioRef.current = activeRatio;
      const selection = createRegionDragSelection(origin, { x, y }, instance.getWidth(), instance.getHeight(), activeRatio, !effectMode && nativeEvent.altKey);
      overlay.set({ ...selection, scaleX: 1, scaleY: 1 });
      overlay.setCoords();
      if (effectMode) {
        effectSelectionRef.current = selection;
        setEffectSelection(selection);
      } else {
        cropSelectionRef.current = selection;
        setCropSelection(selection);
      }
      instance.requestRenderAll();
      window.requestAnimationFrame(updateRegionLabelPosition);
    });
    instance.on("mouse:up", (event) => {
      const mode = interactionModeRef.current;
      if (!isRegionMode(mode)) return;
      const effectMode = mode === "effect";
      const originRef = effectMode ? effectOrigin : cropOrigin;
      const overlay = (effectMode ? effectOverlay : cropOverlay).current;
      originRef.current = undefined;
      if (!overlay) return;
      if (!effectMode && event.target === overlay && event.transform) return;
      const activeRatio = effectMode ? undefined : cropDragRatioRef.current;
      const selection = effectMode
        ? getCropOverlaySelection(overlay)
        : constrainCropOverlay(overlay, instance, true, activeRatio);
      cropDragRatioRef.current = undefined;
      if (selection.width < 10 || selection.height < 10) {
        if (effectMode) clearEffectSelection();
        else clearCropSelection();
      } else if (effectMode) {
        effectSelectionRef.current = selection;
        setEffectSelection(selection);
      } else {
        cropSelectionRef.current = selection;
        setCropSelection(selection);
        instance.setActiveObject(overlay);
        syncSelectedObject();
        instance.requestRenderAll();
        window.requestAnimationFrame(updateRegionLabelPosition);
      }
    });
    pushSnapshot(true, true);
    window.requestAnimationFrame(syncCanvasDisplay);
    return () => {
      window.clearTimeout(snapshotTimerRef.current);
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      regionEffectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      regionEffectUrls.current.clear();
      sourceUrl.current = undefined;
      baseImage.current = undefined;
      disposeViewportGestures();
      instance.dispose();
      canvas.current = undefined;
    };
  }, [applyViewportTransform, clearCropSelection, clearEffectSelection, pushSnapshot, sanitizeEditorSelection, syncCanvasDisplay, syncCropOverlaySelection, syncLayerPanel, syncSelectedObject, updateMinibarPosition, updateRegionLabelPosition]);

  useEffect(() => {
    const instance = canvas.current;
    if (!instance) return;
    interactionModeRef.current = interactionMode;
    instance.isDrawingMode = interactionMode === "pencil" || interactionMode === "brush" || interactionMode === "erase";
    instance.selection = interactionMode === "select" && !mobilePanelLayout;
    instance.selectionKey = mobilePanelLayout ? null : "shiftKey";
    applyEditorInteractivity(instance, baseImage.current, interactionMode, baseLocked);
    if (interactionMode !== "select") {
      const brush = new PencilBrush(instance);
      brush.color = interactionMode === "erase" ? "rgba(0,0,0,1)" : drawColor;
      brush.width = interactionMode === "brush" ? Math.max(10, drawWidth * 2.2) : interactionMode === "erase" ? Math.max(12, drawWidth * 2.5) : drawWidth;
      instance.freeDrawingBrush = brush;
    }
    instance.discardActiveObject();
    syncSelectedObject();
    instance.requestRenderAll();
  }, [baseLocked, drawColor, drawWidth, interactionMode, mobilePanelLayout, syncSelectedObject]);

  useEffect(() => {
    if (interactionMode !== "crop") clearCropSelection();
    if (interactionMode !== "effect") clearEffectSelection();
  }, [clearCropSelection, clearEffectSelection, interactionMode]);

  const loadFile = async (next?: File) => {
    if (!next || !canvas.current) return;
    const url = URL.createObjectURL(next);
    try {
      const image = await FabricImage.fromURL(url);
      const instance = canvas.current;
      restoringRef.current = true;
      clearRegionSelection();
      instance.clear();
      instance.backgroundColor = transparentBackground ? "" : background;
      instance.setDimensions({ width: 900, height: 600 });
      resetViewport(instance);
      const scale = Math.min(1, 860 / image.width, 560 / image.height);
      updateOutputMultiplier(Math.max(1, 1 / scale));
      (image as EditorFabricObject).worklazyRole = "base";
      image.set({ left: 450, top: 300, originX: "center", originY: "center", scaleX: scale, scaleY: scale, selectable: false, evented: false });
      baseImage.current = image;
      instance.add(image);
      instance.discardActiveObject();
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      sourceUrl.current = url;
      setFile(next);
      setEditorError("");
      setBaseLocked(true);
      setBrightness(0); setContrast(0); setHue(0);
      editorSettings.current = { ...editorSettings.current, brightness: 0, contrast: 0, hue: 0, baseLocked: true };
      setInteractionMode("select");
      interactionModeRef.current = "select";
      setActivePanel("select");
      syncDimensionControls(900, 600);
      applyEditorInteractivity(instance, image, "select", true);
      instance.requestRenderAll();
      syncSelectedObject();
      restoringRef.current = false;
      pushSnapshot(true, true);
      window.requestAnimationFrame(syncCanvasDisplay);
    } catch {
      restoringRef.current = false;
      URL.revokeObjectURL(url);
      setEditorError(t("image.common.failed"));
    }
  };

  const newBlankCanvas = () => {
    const instance = canvas.current;
    if (!instance) return;
    if (instance.getObjects().length && !window.confirm(t("image.editor.confirm"))) return;
    restoringRef.current = true;
    clearRegionSelection();
    instance.clear();
    instance.setDimensions({ width: 900, height: 600 });
    resetViewport(instance);
    instance.backgroundColor = transparentBackground ? "" : background;
    baseImage.current = undefined;
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    sourceUrl.current = undefined;
    setFile(undefined);
    updateOutputMultiplier(1);
    setEditorError("");
    setBrightness(0); setContrast(0); setHue(0); setBaseLocked(true); setInteractionMode("select"); setActivePanel("select");
    syncDimensionControls(900, 600);
    interactionModeRef.current = "select";
    editorSettings.current = { ...editorSettings.current, brightness: 0, contrast: 0, hue: 0, baseLocked: true };
    instance.requestRenderAll();
    syncSelectedObject();
    restoringRef.current = false;
    pushSnapshot(true, true);
    window.requestAnimationFrame(syncCanvasDisplay);
  };

  useClipboardImages((images) => {
    if (canvas.current?.getObjects().length && !window.confirm(t("image.editor.confirm"))) return;
    void loadFile(images.at(-1));
  });

  const dropOnPreview = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setStageDragging(false);
    const dropped = filterRasterImages(Array.from(event.dataTransfer.files));
    if (dropped.length) void loadFile(dropped.at(-1));
  };

  const mutateActive = (action: (object: FabricObject) => void) => {
    const instance = canvas.current;
    const object = instance?.getActiveObject();
    if (!instance || !object || object instanceof ActiveSelection) return;
    action(object);
    object.setCoords();
    if (object === baseImage.current) {
      syncRegionEffectTransforms(instance, baseImage.current);
      enforceEditorLayerInvariant(instance, baseImage.current);
    }
    instance.requestRenderAll();
    syncSelectedObject(object);
    pushSnapshot();
  };

  const moveLayerObject = useCallback((object: FabricObject, destination: "front" | "back" | { additionalIndex: number }) => {
    const instance = canvas.current;
    if (!instance || !moveEditorLayer(instance, baseImage.current, object, destination)) return false;
    instance.requestRenderAll();
    syncSelectedObject(instance.getActiveObject());
    syncLayerPanel();
    pushSnapshot(true);
    return true;
  }, [pushSnapshot, syncLayerPanel, syncSelectedObject]);

  const removeLayerObjects = useCallback((requested: readonly FabricObject[]) => {
    const instance = canvas.current;
    if (!instance) return false;
    const removable = requested.filter((object) => isEditorAdditionalLayer(object, baseImage.current) && instance.getObjects().includes(object));
    if (!removable.length) return false;
    const previousSelection = instance.getActiveObjects();
    const selectionChanged = previousSelection.some((object) => removable.includes(object));
    if (selectionChanged) instance.discardActiveObject();
    instance.remove(...removable);
    enforceEditorLayerInvariant(instance, baseImage.current);
    if (selectionChanged) setEditorActiveObjects(instance, previousSelection.filter((object) => !removable.includes(object) && object.visible));
    instance.requestRenderAll();
    syncSelectedObject(instance.getActiveObject());
    syncLayerPanel();
    pushSnapshot(true);
    return true;
  }, [pushSnapshot, syncLayerPanel, syncSelectedObject]);

  const removeSelectedLayers = useCallback(() => {
    const instance = canvas.current;
    return instance ? removeLayerObjects(instance.getActiveObjects()) : false;
  }, [removeLayerObjects]);

  const selectLayer = useCallback((id: string) => {
    const instance = canvas.current;
    const object = layerObjectsRef.current.get(id);
    if (!instance || !object || !object.visible) return;
    instance.setActiveObject(object);
    syncSelectedObject(object);
    instance.requestRenderAll();
  }, [syncSelectedObject]);

  const changeLayerVisibility = useCallback((id: string) => {
    const instance = canvas.current;
    const object = layerObjectsRef.current.get(id);
    if (!instance || !object || isEditorOverlay(object) || isEditorRegionEffect(object)) return;
    const nextVisible = !object.visible;
    const previousSelection = instance.getActiveObjects();
    const affected = object === baseImage.current
      ? [object, ...instance.getObjects().filter(isEditorRegionEffect)]
      : [object];
    affected.forEach((candidate) => candidate.set("visible", nextVisible));
    if (!nextVisible && previousSelection.some((candidate) => affected.includes(candidate))) {
      instance.discardActiveObject();
      setEditorActiveObjects(instance, previousSelection.filter((candidate) => !affected.includes(candidate) && candidate.visible));
    }
    enforceEditorLayerInvariant(instance, baseImage.current);
    instance.requestRenderAll();
    syncSelectedObject(instance.getActiveObject());
    syncLayerPanel();
    pushSnapshot(true);
  }, [pushSnapshot, syncLayerPanel, syncSelectedObject]);

  const deleteLayer = useCallback((id: string) => {
    const object = layerObjectsRef.current.get(id);
    if (object) removeLayerObjects([object]);
  }, [removeLayerObjects]);

  const reorderLayer = useCallback((id: string, topIndex: number) => {
    const instance = canvas.current;
    const object = layerObjectsRef.current.get(id);
    if (!instance || !object) return;
    const additionalCount = instance.getObjects().filter((candidate) => isEditorAdditionalLayer(candidate, baseImage.current)).length;
    moveLayerObject(object, { additionalIndex: Math.max(0, additionalCount - 1 - topIndex) });
  }, [moveLayerObject]);

  const applyCropSelection = useCallback(() => {
    const instance = canvas.current;
    const selection = cropSelectionRef.current;
    const overlay = cropOverlay.current;
    if (!instance || !selection || selection.width < 10 || selection.height < 10) return;
    restoringRef.current = true;
    if (overlay) instance.remove(overlay);
    cropOverlay.current = undefined;
    cropOrigin.current = undefined;
    cropSelectionRef.current = undefined;
    instance.getObjects().forEach((object) => {
      object.set({ left: (object.left || 0) - selection.left, top: (object.top || 0) - selection.top });
      object.setCoords();
    });
    const nextWidth = Math.max(1, Math.round(selection.width));
    const nextHeight = Math.max(1, Math.round(selection.height));
    instance.setDimensions({ width: nextWidth, height: nextHeight });
    syncDimensionControls(nextWidth, nextHeight);
    resetViewport(instance);
    instance.discardActiveObject();
    setCropSelection(undefined);
    setInteractionMode("select");
    interactionModeRef.current = "select";
    setActivePanel("select");
    applyEditorInteractivity(instance, baseImage.current, "select", baseLocked);
    instance.requestRenderAll();
    syncSelectedObject();
    restoringRef.current = false;
    pushSnapshot(true);
    window.requestAnimationFrame(syncCanvasDisplay);
  }, [baseLocked, pushSnapshot, resetViewport, syncCanvasDisplay, syncDimensionControls, syncSelectedObject]);

  const applyRegionEffect = useCallback(async () => {
    const instance = canvas.current;
    const image = baseImage.current;
    const selection = effectSelection;
    const overlay = effectOverlay.current;
    if (!instance || !image || !file || !selection || selection.width < 10 || selection.height < 10 || regionEffectBusyRef.current) return;
    regionEffectBusyRef.current = true;
    setRegionEffectBusy(true);
    setEditorError("");
    if (overlay) instance.remove(overlay);
    setRegionLabelPosition(undefined);
    let effectUrl: string | undefined;
    let effectImage: FabricImage | undefined;
    try {
      instance.discardActiveObject();
      instance.renderAll();
      // Region effects sample the immutable source photo. They do not compound prior effects or rasterize drawing/text layers.
      const sourceImage = await FabricImage.fromURL(image.getSrc());
      const sourceElement = sourceImage.getElement();
      const sourceWidth = (sourceElement as HTMLImageElement).naturalWidth || sourceElement.width;
      const sourceHeight = (sourceElement as HTMLImageElement).naturalHeight || sourceElement.height;
      if (!sourceWidth || !sourceHeight) throw new Error("Image dimensions are unavailable");
      const pixelRegion = mapSelectionToImagePixels(selection, image, sourceWidth, sourceHeight);
      const imageScale = image.getObjectScaling();
      const effectStrengthInPixels = resolveRegionEffectSourceStrength(regionEffectStrength, imageScale.x, imageScale.y, instance.getZoom());
      let effected: HTMLCanvasElement;
      try {
        effected = createRegionEffectCanvas(sourceElement, sourceWidth, sourceHeight, pixelRegion.bounds, regionEffect, effectStrengthInPixels);
      } finally {
        sourceImage.dispose();
      }
      try {
        const effectedContext = effected.getContext("2d");
        if (!effectedContext) throw new Error("Canvas 2D context unavailable");
        effectedContext.save();
        effectedContext.globalCompositeOperation = "destination-in";
        effectedContext.beginPath();
        pixelRegion.polygon.forEach((point, index) => {
          const x = point.x - pixelRegion.bounds.left;
          const y = point.y - pixelRegion.bounds.top;
          if (index === 0) effectedContext.moveTo(x, y);
          else effectedContext.lineTo(x, y);
        });
        effectedContext.closePath();
        effectedContext.fill();
        effectedContext.restore();
        const blob = await canvasToBlob(effected, "image/png");
        effectUrl = URL.createObjectURL(blob);
      } finally {
        effected.width = 1;
        effected.height = 1;
      }
      if (!effectUrl) throw new Error("The browser could not create the effect image.");
      regionEffectUrls.current.add(effectUrl);
      effectImage = await FabricImage.fromURL(effectUrl);
      const effectObject = effectImage as EditorFabricObject;
      effectObject.worklazyRole = "region-effect";
      effectObject.worklazyAnchorX = pixelRegion.bounds.left + pixelRegion.bounds.width / 2 - image.cropX - image.width / 2;
      effectObject.worklazyAnchorY = pixelRegion.bounds.top + pixelRegion.bounds.height / 2 - image.cropY - image.height / 2;
      effectImage.set({ imageSmoothing: regionEffect === "blur", selectable: false, evented: false, visible: image.visible });
      effectImage.filters = [...image.filters];
      if (effectImage.filters.length) effectImage.applyFilters();
      syncRegionEffectTransform(effectImage, image);
      restoringRef.current = true;
      const baseIndex = instance.getObjects().indexOf(image);
      const lastEffectIndex = instance.getObjects().reduce((lastIndex, object, index) => (object as EditorFabricObject).worklazyRole === "region-effect" ? index : lastIndex, baseIndex);
      instance.insertAt(lastEffectIndex + 1, effectImage);
      enforceEditorLayerInvariant(instance, image);
      clearEffectSelection();
      instance.discardActiveObject();
      setInteractionMode("select");
      interactionModeRef.current = "select";
      applyEditorInteractivity(instance, image, "select", baseLocked);
      instance.requestRenderAll();
      syncSelectedObject();
      restoringRef.current = false;
      pushSnapshot(true);
    } catch {
      if (effectImage && instance.getObjects().includes(effectImage)) instance.remove(effectImage);
      if (effectUrl) {
        regionEffectUrls.current.delete(effectUrl);
        URL.revokeObjectURL(effectUrl);
      }
      if (overlay && !instance.getObjects().includes(overlay)) instance.add(overlay);
      effectOverlay.current = overlay;
      setEditorError(t("image.editor.effectError"));
      instance.requestRenderAll();
      window.requestAnimationFrame(updateRegionLabelPosition);
    } finally {
      restoringRef.current = false;
      regionEffectBusyRef.current = false;
      setRegionEffectBusy(false);
    }
  }, [baseLocked, clearEffectSelection, effectSelection, file, pushSnapshot, regionEffect, regionEffectStrength, syncSelectedObject, t, updateRegionLabelPosition]);

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (interactionModeRef.current === "crop" && event.key === "Escape") {
        event.preventDefault();
        clearCropSelection();
        return;
      }
      if (interactionModeRef.current === "effect" && event.key === "Escape") {
        event.preventDefault();
        clearEffectSelection();
        return;
      }
      if (interactionModeRef.current === "crop" && event.key === "Enter" && cropOverlay.current) {
        event.preventDefault();
        applyCropSelection();
        return;
      }
      if (interactionModeRef.current === "effect" && event.key === "Enter" && effectOverlay.current) {
        event.preventDefault();
        void applyRegionEffect();
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (removeSelectedLayers()) event.preventDefault();
    };
    document.addEventListener("keydown", handleEditorShortcut);
    return () => document.removeEventListener("keydown", handleEditorShortcut);
  }, [applyCropSelection, applyRegionEffect, clearCropSelection, clearEffectSelection, removeSelectedLayers]);

  const changeCropRatio = (ratio: CropRatio) => {
    const instance = canvas.current;
    if (!instance) return;
    if (ratio && !canFitCropRatio(instance.getWidth(), instance.getHeight(), ratio)) return;
    cropRatioRef.current = ratio;
    setCropRatio(ratio);
    const overlay = cropOverlay.current;
    if (!overlay) return;
    configureCropOverlay(overlay, () => cropRatioRef.current);
    if (ratio) {
      const current = getCropOverlaySelection(overlay);
      const dimensions = fitCropRatioDimensions(instance.getWidth(), instance.getHeight(), ratio, Math.min(current.width, current.height * ratio));
      if (!dimensions) return;
      const centerX = current.left + current.width / 2;
      const centerY = current.top + current.height / 2;
      overlay.set({
        left: Math.max(0, Math.min(instance.getWidth() - dimensions.width, centerX - dimensions.width / 2)),
        top: Math.max(0, Math.min(instance.getHeight() - dimensions.height, centerY - dimensions.height / 2)),
        width: dimensions.width,
        height: dimensions.height,
        scaleX: 1,
        scaleY: 1,
      });
    }
    syncCropOverlaySelection(overlay, true, ratio);
    instance.setActiveObject(overlay);
    instance.requestRenderAll();
  };

  const addObject = (object: FabricObject) => {
    const instance = canvas.current;
    if (!instance) return;
    setInteractionMode("select");
    interactionModeRef.current = "select";
    instance.isDrawingMode = false;
    instance.add(object);
    enforceEditorLayerInvariant(instance, baseImage.current);
    instance.setActiveObject(object);
    syncSelectedObject(object);
    instance.requestRenderAll();
    pushSnapshot();
  };

  const addText = (value = text) => {
    if (!value.trim()) return;
    addObject(new IText(value, { left: 90, top: 90, fontFamily: "sans-serif", fontSize: 48, fontWeight: "700", fill: drawColor, stroke: "rgba(255,255,255,.55)", strokeWidth: 1 }));
  };

  const addShape = (kind: EditorShapeKind) => {
    addObject(createEditorShape(kind, drawColor, drawWidth));
  };

  const addSticker = async (sticker: ImageStudioSticker) => {
    if (stickerBusy) return;
    setStickerBusy(true);
    setEditorError("");
    try {
      const image = await FabricImage.fromURL(getImageStudioStickerUrl(sticker));
      const scale = 150 / Math.max(1, image.width, image.height);
      (image as EditorFabricObject).worklazyRole = "sticker";
      image.set({ left: 120, top: 120, scaleX: scale, scaleY: scale });
      addObject(image);
    } catch {
      setEditorError(t("image.editor.stickerError"));
    } finally {
      setStickerBusy(false);
    }
  };

  const setSelectedObjectStyle = (property: "color" | "stroke" | "width", value: string | number) => {
    mutateActive((object) => {
      if (["base", "sticker"].includes((object as EditorFabricObject).worklazyRole || "")) return;
      if (getEditorShapeKind(object)) {
        applyEditorShapeStyle(object, property, value);
        return;
      }
      if (property === "color") object.set(object instanceof Line || object.type === "path" ? "stroke" : "fill", value);
      if (property === "stroke" && (object instanceof Rect || object instanceof Circle)) object.set("stroke", value);
      if (property === "width") object.set("strokeWidth", value);
    });
  };

  const duplicateSelectedLayers = useCallback(async () => {
    const instance = canvas.current;
    if (!instance) return;
    const originals = instance.getActiveObjects()
      .filter((object) => isEditorAdditionalLayer(object, baseImage.current))
      .sort((left, right) => instance.getObjects().indexOf(left) - instance.getObjects().indexOf(right));
    if (!originals.length) return;
    if (instance.getActiveObject() instanceof ActiveSelection) instance.discardActiveObject();
    restoringRef.current = true;
    const clones: FabricObject[] = [];
    try {
      for (const original of originals) {
        const clone = await original.clone();
        util.applyTransformToObject(clone, util.multiplyTransformMatrices([1, 0, 0, 1, 24, 24], original.calcTransformMatrix()));
        clone.setCoords();
        instance.add(clone);
        clones.push(clone);
      }
      enforceEditorLayerInvariant(instance, baseImage.current);
    } catch {
      if (clones.length) instance.remove(...clones);
      setEditorError(t("image.editor.duplicateError"));
      return;
    } finally {
      restoringRef.current = false;
    }
    pushSnapshot(true);
    setEditorActiveObjects(instance, clones);
    instance.requestRenderAll();
    syncSelectedObject(instance.getActiveObject());
    syncLayerPanel();
  }, [pushSnapshot, syncLayerPanel, syncSelectedObject, t]);

  const alignSelectedLayers = useCallback((alignment: EditorAlignment) => {
    const instance = canvas.current;
    if (!instance) return;
    const selected = instance.getActiveObjects().filter((object) => isEditorAdditionalLayer(object, baseImage.current));
    if (selected.length < 2) return;
    instance.discardActiveObject();
    if (!alignEditorObjects(selected, alignment)) return;
    enforceEditorLayerInvariant(instance, baseImage.current);
    pushSnapshot(true);
    setEditorActiveObjects(instance, selected);
    instance.requestRenderAll();
    syncSelectedObject(instance.getActiveObject());
    syncLayerPanel();
  }, [pushSnapshot, syncLayerPanel, syncSelectedObject]);

  const updateFilter = (kind: "brightness" | "contrast" | "hue", value: number) => {
    if (kind === "brightness") setBrightness(value);
    if (kind === "contrast") setContrast(value);
    if (kind === "hue") setHue(value);
    editorSettings.current = { ...editorSettings.current, [kind]: value };
    const image = baseImage.current;
    if (!image) return;
    const settings = editorSettings.current;
    image.filters = [
      new filters.Brightness({ brightness: settings.brightness / 100 }),
      new filters.Contrast({ contrast: settings.contrast / 100 }),
      new filters.HueRotation({ rotation: settings.hue / 360 }),
    ];
    image.applyFilters();
    canvas.current?.getObjects().forEach((object) => {
      if (!(object instanceof FabricImage) || (object as EditorFabricObject).worklazyRole !== "region-effect") return;
      object.filters = [...image.filters];
      object.applyFilters();
    });
    canvas.current?.requestRenderAll();
    pushSnapshot();
  };

  const updateBackground = (nextBackground = background, nextTransparent = transparentBackground) => {
    setBackground(nextBackground);
    setTransparentBackground(nextTransparent);
    editorSettings.current = { ...editorSettings.current, background: nextBackground, transparentBackground: nextTransparent };
    if (canvas.current) {
      canvas.current.backgroundColor = nextTransparent ? "" : nextBackground;
      canvas.current.requestRenderAll();
      pushSnapshot();
    }
  };

  const updateBaseLock = (locked: boolean) => {
    setBaseLocked(locked);
    editorSettings.current = { ...editorSettings.current, baseLocked: locked };
    if (canvas.current) {
      applyEditorInteractivity(canvas.current, baseImage.current, interactionModeRef.current, locked);
      canvas.current.requestRenderAll();
      pushSnapshot();
    }
  };

  const clearAddedLayers = () => {
    const instance = canvas.current;
    if (!instance) return;
    removeLayerObjects(instance.getObjects());
  };

  const changeResampleDimension = (axis: keyof EditorDimensions, value: number) => {
    setResampleDimensions((current) => resampleRatioLocked
      ? resizeLockedDimensions(value, axis, canvasDimensions, EDITOR_WORK_MAX_DIMENSION)
      : { ...current, [axis]: clampEditorDimension(value, EDITOR_WORK_MAX_DIMENSION) });
  };

  const changeResampleRatioLock = (locked: boolean) => {
    setResampleRatioLocked(locked);
    if (locked) setResampleDimensions((current) => resizeLockedDimensions(current.width, "width", canvasDimensions, EDITOR_WORK_MAX_DIMENSION));
  };

  const changeCanvasResizeDimension = (axis: keyof EditorDimensions, value: number) => {
    setCanvasResizeDimensions((current) => ({ ...current, [axis]: clampEditorDimension(value, EDITOR_WORK_MAX_DIMENSION) }));
  };

  const changeExportDimension = (axis: keyof EditorDimensions, value: number) => {
    setExportDimensions((current) => exportRatioLocked
      ? resizeLockedDimensions(value, axis, canvasDimensions, EDITOR_EXPORT_MAX_DIMENSION)
      : { ...current, [axis]: clampEditorDimension(value, EDITOR_EXPORT_MAX_DIMENSION) });
  };

  const changeExportRatioLock = (locked: boolean) => {
    setExportRatioLocked(locked);
    if (locked) setExportDimensions((current) => resizeLockedDimensions(current.width, "width", canvasDimensions, EDITOR_EXPORT_MAX_DIMENSION));
  };

  const applyImageResample = () => {
    const instance = canvas.current;
    if (!instance) return;
    const target = normalizeEditorDimensions(resampleDimensions, EDITOR_WORK_MAX_DIMENSION);
    const previous = { width: instance.getWidth(), height: instance.getHeight() };
    if (target.width === previous.width && target.height === previous.height) return;
    restoringRef.current = true;
    setEditorError("");
    try {
      clearRegionSelection();
      instance.discardActiveObject();
      const scaleTransform: TMat2D = [target.width / previous.width, 0, 0, target.height / previous.height, 0, 0];
      instance.getObjects().forEach((object) => {
        const role = (object as EditorFabricObject).worklazyRole;
        if (role === "region-effect" || role === "crop-overlay") return;
        util.applyTransformToObject(object, util.multiplyTransformMatrices(scaleTransform, object.calcTransformMatrix()));
        object.setCoords();
      });
      if (baseImage.current) {
        syncRegionEffectTransforms(instance, baseImage.current);
        enforceEditorLayerInvariant(instance, baseImage.current);
      }
      instance.setDimensions(target);
      resetViewport(instance);
      syncDimensionControls(target.width, target.height);
      applyEditorInteractivity(instance, baseImage.current, interactionModeRef.current, baseLocked);
      syncSelectedObject();
      instance.requestRenderAll();
    } catch {
      setEditorError(t("image.editor.resizeError"));
      return;
    } finally {
      restoringRef.current = false;
    }
    pushSnapshot(true);
    window.requestAnimationFrame(syncCanvasDisplay);
  };

  const applyCanvasResize = () => {
    const instance = canvas.current;
    if (!instance) return;
    const target = normalizeEditorDimensions(canvasResizeDimensions, EDITOR_WORK_MAX_DIMENSION);
    const previous = { width: instance.getWidth(), height: instance.getHeight() };
    if (target.width === previous.width && target.height === previous.height) return;
    restoringRef.current = true;
    setEditorError("");
    try {
      clearRegionSelection();
      instance.discardActiveObject();
      const translateTransform: TMat2D = [1, 0, 0, 1, (target.width - previous.width) / 2, (target.height - previous.height) / 2];
      instance.getObjects().forEach((object) => {
        util.applyTransformToObject(object, util.multiplyTransformMatrices(translateTransform, object.calcTransformMatrix()));
        object.setCoords();
      });
      if (baseImage.current) {
        syncRegionEffectTransforms(instance, baseImage.current);
        enforceEditorLayerInvariant(instance, baseImage.current);
      }
      instance.setDimensions(target);
      resetViewport(instance);
      syncDimensionControls(target.width, target.height);
      applyEditorInteractivity(instance, baseImage.current, interactionModeRef.current, baseLocked);
      syncSelectedObject();
      instance.requestRenderAll();
    } catch {
      setEditorError(t("image.editor.resizeError"));
      return;
    } finally {
      restoringRef.current = false;
    }
    pushSnapshot(true);
    window.requestAnimationFrame(syncCanvasDisplay);
  };

  const restore = async (index: number) => {
    const instance = canvas.current;
    const serialized = historyRef.current[index];
    if (!instance || !serialized) return;
    const snapshot = JSON.parse(serialized) as EditorHistorySnapshot;
    window.clearTimeout(snapshotTimerRef.current);
    restoringRef.current = true;
    try {
      const dimensionsChanged = instance.getWidth() !== snapshot.width || instance.getHeight() !== snapshot.height;
      const preservedViewport = [...instance.viewportTransform] as TMat2D;
      instance.setDimensions({ width: snapshot.width, height: snapshot.height });
      await instance.loadFromJSON(snapshot.canvas);
      baseImage.current = instance.getObjects().find((object): object is FabricImage => object instanceof FabricImage && (object as EditorFabricObject).worklazyRole === "base")
        ?? instance.getObjects().find((object): object is FabricImage => object instanceof FabricImage && !(object as EditorFabricObject).worklazyRole);
      setBrightness(snapshot.brightness); setContrast(snapshot.contrast); setHue(snapshot.hue);
      setBackground(snapshot.background); setTransparentBackground(snapshot.transparentBackground); setBaseLocked(snapshot.baseLocked);
      updateOutputMultiplier(snapshot.outputMultiplier ?? 1);
      syncDimensionControls(snapshot.width, snapshot.height);
      editorSettings.current = {
        brightness: snapshot.brightness,
        contrast: snapshot.contrast,
        hue: snapshot.hue,
        background: snapshot.background,
        transparentBackground: snapshot.transparentBackground,
        baseLocked: snapshot.baseLocked,
      };
      instance.backgroundColor = snapshot.transparentBackground ? "" : snapshot.background;
      if (baseImage.current) {
        syncRegionEffectTransforms(instance, baseImage.current);
        enforceEditorLayerInvariant(instance, baseImage.current);
      }
      applyEditorInteractivity(instance, baseImage.current, interactionModeRef.current, snapshot.baseLocked);
      instance.discardActiveObject();
      if (dimensionsChanged) resetViewport(instance);
      else applyViewportTransform(instance, preservedViewport);
      instance.requestRenderAll();
      historyIndexRef.current = index;
      setHistoryState({ index, length: historyRef.current.length });
      syncSelectedObject();
      window.requestAnimationFrame(syncCanvasDisplay);
    } finally {
      window.clearTimeout(snapshotTimerRef.current);
      restoringRef.current = false;
    }
  };

  const changePanel = (panel: EditorPanelName) => {
    setContextMenu(undefined);
    setActivePanel(panel);
    const nextMode: EditorInteractionMode = panel === "draw" ? drawTool : panel === "crop" || panel === "effect" ? panel : "select";
    interactionModeRef.current = nextMode;
    setInteractionMode(nextMode);
  };

  const toggleEditorPanel = () => {
    if (mobilePanelLayout) return;
    setPanelCollapsed((current) => !current);
  };

  const changeDrawTool = (tool: EditorDrawTool) => {
    setDrawTool(tool);
    interactionModeRef.current = tool;
    setInteractionMode(tool);
  };

  const changeRegionEffect = (effect: RegionEffect) => {
    setRegionEffect(effect);
    if (effect === "blur") setRegionEffectStrength((current) => Math.max(10, current));
  };

  const originalExportPlan = getOriginalQualityExportPlan(canvasDimensions, outputMultiplier, EDITOR_EXPORT_MAX_DIMENSION);
  const exportResultDimensions = exportMode === "original" ? originalExportPlan.dimensions : normalizeEditorDimensions(exportDimensions, EDITOR_EXPORT_MAX_DIMENSION);

  const exportImage = () => {
    const instance = canvas.current;
    if (!instance) return;
    const overlays = [cropOverlay.current, effectOverlay.current].filter((overlay): overlay is Rect => Boolean(overlay));
    const activeOverlay = overlays.find((overlay) => instance.getActiveObject() === overlay);
    const viewport = [...instance.viewportTransform] as TMat2D;
    if (baseImage.current) enforceEditorLayerInvariant(instance, baseImage.current);
    overlays.forEach((overlay) => { if (instance.getObjects().includes(overlay)) instance.remove(overlay); });
    setEditorError("");
    try {
      instance.setViewportTransform([...IDENTITY_VIEWPORT]);
      instance.renderAll();
      const source = instance.toCanvasElement(exportMode === "original" ? originalExportPlan.multiplier : 1);
      const rendered = exportMode === "custom"
        ? renderEditorExportSize(source, exportResultDimensions, exportRatioLocked, format === "jpeg")
        : source;
      const dataUrl = encodeEditorExportCanvas(rendered, format);
      if (rendered !== source) {
        rendered.width = 1;
        rendered.height = 1;
      }
      source.width = 1;
      source.height = 1;
      const actualFormat = dataUrl.startsWith("data:image/png") ? "png" : dataUrl.startsWith("data:image/webp") ? "webp" : "jpeg";
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${file ? stripExtension(file.name) : "worklazy-image"}-${t("image.editor.suffix")}.${actualFormat === "jpeg" ? "jpg" : actualFormat}`;
      anchor.click();
    } catch {
      setEditorError(t("image.editor.exportError"));
    } finally {
      instance.setViewportTransform(viewport);
      overlays.forEach((overlay) => {
        const remainsCurrent = cropOverlay.current === overlay || effectOverlay.current === overlay;
        if (remainsCurrent && !instance.getObjects().includes(overlay)) instance.add(overlay);
      });
      if (activeOverlay && cropOverlay.current === activeOverlay && interactionModeRef.current === "crop") instance.setActiveObject(activeOverlay);
      instance.requestRenderAll();
      window.requestAnimationFrame(updateFloatingOverlays);
    }
  };

  const floatingRegionSelection = interactionMode === "crop" ? cropSelection : interactionMode === "effect" ? effectSelection : undefined;

  return (
    <UtilitySectionCard title={t("image.editor.title")} description={t("image.editor.description")}>
      <FileDropZone files={file ? [file] : []} onFiles={(files) => void loadFile(filterRasterImages(files).at(-1))} accept={RASTER_IMAGE_ACCEPT} hint={t("image.editor.hint")} accent="sky" />
      {editorError && <UtilityNotice tone="error" role="alert" className="mt-3">{editorError}</UtilityNotice>}
      <ClipboardHint mode="replace" />
      <div className="editor-source-actions mt-2 flex items-center justify-between gap-2.5"><Button type="button" className="rounded-xl" variant="secondary" onClick={newBlankCanvas}><ImageIcon size={16} /> {t("image.editor.blank")}</Button>{file && <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted-foreground">{t("image.editor.editing", { name: file.name })}</span>}</div>
      <ImageEditorToolbar
        activePanel={activePanel}
        hasFile={Boolean(file)}
        effectBusy={regionEffectBusy}
        canDelete={selectionState.kind !== "none" && !selectionState.isBase}
        historyIndex={historyState.index}
        historyLength={historyState.length}
        panelCollapsed={effectivePanelCollapsed}
        panelToggleDisabled={mobilePanelLayout}
        onPanelChange={changePanel}
        onUndo={() => void restore(historyState.index - 1)}
        onRedo={() => void restore(historyState.index + 1)}
        onDelete={() => { removeSelectedLayers(); }}
        onPanelToggle={toggleEditorPanel}
      />
      <div className={cn("image-editor-layout mt-3.5 grid grid-cols-[minmax(0,1fr)_270px] items-start gap-3.5 max-[820px]:grid-cols-1", effectivePanelCollapsed && "is-panel-collapsed grid-cols-1 min-[821px]:[&_.image-editor-panel]:hidden")} data-testid="image-editor-workspace" data-panel-collapsed={effectivePanelCollapsed}>
        <div className="image-editor-canvas-column">
          <ImageEditorViewportControls
            zoom={viewZoom}
            minZoom={EDITOR_MIN_ZOOM}
            maxZoom={EDITOR_MAX_ZOOM}
            onFit={() => resetViewport()}
            onZoomIn={() => changeViewZoom("in")}
            onZoomOut={() => changeViewZoom("out")}
          />
          <div
            ref={stageElement}
            className={cn("fabric-stage image-preview-drop relative min-w-0 overflow-auto rounded-2xl border border-border bg-[repeating-conic-gradient(#ececf0_0_25%,#f8f8fa_0_50%)] bg-[length:16px_16px] p-3 outline-none focus-visible:border-sky-700 focus-visible:ring-3 focus-visible:ring-sky-700/30 dark:bg-[repeating-conic-gradient(#242426_0_25%,#303033_0_50%)] max-[820px]:overflow-hidden max-[820px]:p-2", stageDragging && "is-file-dragging border-sky-600 shadow-[inset_0_0_0_2px_rgba(21,155,215,.18)]", interactionMode === "crop" ? "is-crop-mode" : interactionMode === "effect" ? "is-effect-mode" : "")}
            role="region"
            aria-label={t("image.editor.canvasArea")}
            aria-describedby="image-editor-canvas-keyboard-help"
            tabIndex={0}
            data-testid="image-editor-canvas-stage"
            onKeyDown={handleStageKeyDown}
            onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setStageDragging(true); } }}
            onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setStageDragging(true); } }}
            onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setStageDragging(false); }}
            onDrop={dropOnPreview}
          >
            <canvas ref={canvasElement} />
            <ImageEditorMinibar
              position={minibarPosition}
              selection={selectionState}
              onColorChange={(color) => setSelectedObjectStyle("color", color)}
              onWidthChange={(width) => setSelectedObjectStyle("width", width)}
              onBringToFront={() => { const object = canvas.current?.getActiveObject(); if (object) moveLayerObject(object, "front"); }}
              onSendToBack={() => { const object = canvas.current?.getActiveObject(); if (object) moveLayerObject(object, "back"); }}
              onDuplicate={() => void duplicateSelectedLayers()}
              onDelete={() => { removeSelectedLayers(); }}
              onAlign={alignSelectedLayers}
            />
            {contextMenu && <ImageEditorContextMenu
              left={contextMenu.left}
              top={contextMenu.top}
              multiple={contextMenu.multiple}
              text={contextMenu.text}
              onDuplicate={() => { setContextMenu(undefined); void duplicateSelectedLayers(); }}
              onDelete={() => { const target = contextMenu.target; const multiple = contextMenu.multiple; setContextMenu(undefined); if (multiple) removeSelectedLayers(); else removeLayerObjects([target]); }}
              onBringToFront={() => { const target = contextMenu.target; setContextMenu(undefined); moveLayerObject(target, "front"); }}
              onSendToBack={() => { const target = contextMenu.target; setContextMenu(undefined); moveLayerObject(target, "back"); }}
              onEditText={() => {
                const target = contextMenu.target;
                setContextMenu(undefined);
                if (!(target instanceof IText) || !canvas.current) return;
                canvas.current.setActiveObject(target);
                target.enterEditing();
                target.selectAll();
                canvas.current.requestRenderAll();
                syncSelectedObject(target);
              }}
              onAlign={(alignment) => { setContextMenu(undefined); alignSelectedLayers(alignment); }}
            />}
            {floatingRegionSelection && regionLabelPosition && <span
              className={`image-region-size-label${interactionMode === "effect" ? " is-effect" : ""}`}
              style={{ left: regionLabelPosition.left, top: regionLabelPosition.top }}
              data-testid="image-editor-region-size-label"
              data-region-mode={interactionMode}
              data-selection-left={floatingRegionSelection.left}
              data-selection-top={floatingRegionSelection.top}
              data-selection-width={floatingRegionSelection.width}
              data-selection-height={floatingRegionSelection.height}
            >{t("image.editor.regionSize", { width: Math.round(floatingRegionSelection.width), height: Math.round(floatingRegionSelection.height) })}</span>}
            {stageDragging && <span className="image-preview-drop-hint absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-sky-600/50 bg-sky-50/95 p-4 text-sm font-extrabold text-sky-700 backdrop-blur-sm dark:bg-sky-950/95 dark:text-sky-300">{t("image.editor.drop")}</span>}
          </div>
          <p id="image-editor-canvas-keyboard-help" className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("image.editor.canvasKeyboardHelp")}</p>
        </div>
        <ImageEditorPanel
          activePanel={activePanel}
          drawTool={drawTool}
          drawColor={drawColor}
          drawWidth={drawWidth}
          selection={selectionState}
          text={text}
          hasFile={Boolean(file)}
          regionEffect={regionEffect}
          regionEffectStrength={regionEffectStrength}
          regionEffectBusy={regionEffectBusy}
          regionSelection={activePanel === "crop" ? cropSelection : activePanel === "effect" ? effectSelection : undefined}
          brightness={brightness}
          contrast={contrast}
          hue={hue}
          baseLocked={baseLocked}
          background={background}
          transparentBackground={transparentBackground}
          layers={layers}
          onDrawToolChange={changeDrawTool}
          onDrawColorChange={setDrawColor}
          onDrawWidthChange={setDrawWidth}
          onSelectionColorChange={(color) => setSelectedObjectStyle("color", color)}
          onSelectionStrokeColorChange={(color) => setSelectedObjectStyle("stroke", color)}
          onSelectionWidthChange={(width) => setSelectedObjectStyle("width", width)}
          onRotate={() => mutateActive((object) => object.rotate((object.angle || 0) + 90))}
          onFlipHorizontal={() => mutateActive((object) => object.set("flipX", !object.flipX))}
          onFlipVertical={() => mutateActive((object) => object.set("flipY", !object.flipY))}
          cropRatio={cropRatio}
          unavailableCropRatios={CROP_PRESET_RATIOS.filter((ratio) => !canFitCropRatio(canvas.current?.getWidth() || 900, canvas.current?.getHeight() || 600, ratio))}
          canvasDimensions={canvasDimensions}
          resampleDimensions={resampleDimensions}
          canvasResizeDimensions={canvasResizeDimensions}
          resampleRatioLocked={resampleRatioLocked}
          onCropRatio={changeCropRatio}
          onCropCancel={clearCropSelection}
          onCropApply={applyCropSelection}
          onResampleDimensionChange={changeResampleDimension}
          onResampleRatioLockChange={changeResampleRatioLock}
          onResampleApply={applyImageResample}
          onCanvasResizeDimensionChange={changeCanvasResizeDimension}
          onCanvasResizeApply={applyCanvasResize}
          onRegionEffectChange={changeRegionEffect}
          onRegionEffectStrengthChange={setRegionEffectStrength}
          onRegionEffectCancel={clearEffectSelection}
          onRegionEffectApply={() => void applyRegionEffect()}
          onFilterChange={updateFilter}
          onBaseLockChange={updateBaseLock}
          onTextChange={setText}
          onAddText={addText}
          onAddShape={addShape}
          stickerBusy={stickerBusy}
          onAddSticker={(sticker) => void addSticker(sticker)}
          onBackgroundChange={(color) => updateBackground(color, transparentBackground)}
          onTransparentBackgroundChange={(transparent) => updateBackground(background, transparent)}
          onClearLayers={clearAddedLayers}
          onLayerSelect={selectLayer}
          onLayerVisibilityChange={changeLayerVisibility}
          onLayerDelete={deleteLayer}
          onLayerReorder={reorderLayer}
        />
      </div>
      <div className="export-row image-editor-export-row mt-3.5 grid grid-cols-[minmax(260px,1fr)_minmax(230px,310px)] items-end gap-3 max-[620px]:grid-cols-1">
        <div className="image-editor-export-settings grid min-w-0 gap-3">
          <div className="image-format-control"><SegmentedControl value={format} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} onChange={setFormat} label={t("image.editor.format")} /><small className="mt-2 block text-[13px] leading-relaxed text-muted-foreground">{t("image.editor.formatHelp")}</small></div>
          <Card className="image-export-size-control gap-0 rounded-2xl border border-border bg-muted p-3 py-3 shadow-none ring-0">
            <SegmentedControl
              value={exportMode}
              options={[{ value: "original", label: t("image.editor.exportOriginalQuality") }, { value: "custom", label: t("image.editor.exportCustomSize") }]}
              onChange={setExportMode}
              label={t("image.editor.exportSize")}
            />
            {exportMode === "custom" && <>
              <ExportDimensionFields
                dimensions={exportDimensions}
                max={EDITOR_EXPORT_MAX_DIMENSION}
                testId="image-editor-export-size"
                onChange={changeExportDimension}
                widthLabel={t("image.editor.dimensionWidth")}
                heightLabel={t("image.editor.dimensionHeight")}
              />
              <div className="image-export-ratio-toggle mt-2 overflow-hidden rounded-xl border border-border bg-card [&_[data-ui-component=toggle-row]]:min-h-[46px] [&_[data-ui-component=toggle-row]]:px-2.5 [&_[data-ui-component=toggle-row]]:py-2 [&_small]:text-xs [&_strong]:text-xs"><ToggleRow label={t("image.editor.keepRatio")} description={t("image.editor.exportRatioHelp")} checked={exportRatioLocked} onChange={changeExportRatioLock} /></div>
            </>}
            <p
              className={cn("m-0 mt-2 text-xs font-bold leading-relaxed text-muted-foreground", originalExportPlan.reduced && exportMode === "original" && "is-limited text-orange-700 dark:text-orange-300")}
              data-testid="image-editor-export-result"
              data-width={exportResultDimensions.width}
              data-height={exportResultDimensions.height}
              data-limited={originalExportPlan.reduced && exportMode === "original"}
            >{t("image.editor.exportResult", { width: exportResultDimensions.width, height: exportResultDimensions.height })}{originalExportPlan.reduced && exportMode === "original" ? ` ${t("image.editor.exportLimited", { max: EDITOR_EXPORT_MAX_DIMENSION })}` : ""}</p>
          </Card>
        </div>
        <div className="w-full" data-testid="image-editor-export-action"><PrimaryButton accent="sky" onClick={exportImage}><Download size={18} /> {t("image.editor.download")}</PrimaryButton></div>
      </div>
    </UtilitySectionCard>
  );
}

function ExportDimensionFields({ dimensions, max, testId, onChange, widthLabel, heightLabel }: { dimensions: EditorDimensions; max: number; testId: string; onChange: (axis: keyof EditorDimensions, value: number) => void; widthLabel: string; heightLabel: string }) {
  return <div className="image-dimension-fields mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1.5" data-testid={testId} data-width={dimensions.width} data-height={dimensions.height}>
    <label className="grid min-w-0 gap-1 text-[11px] font-bold text-muted-foreground"><span>{widthLabel}</span><UtilityInput className="h-9 px-2 text-[13px] tabular-nums" type="number" min={1} max={max} step={1} value={dimensions.width} aria-label={`${widthLabel} (${max})`} data-testid={`${testId}-width`} onChange={(event) => onChange("width", Number(event.target.value))} /></label>
    <span className="pb-2 text-[13px] font-extrabold text-muted-foreground" aria-hidden="true">×</span>
    <label className="grid min-w-0 gap-1 text-[11px] font-bold text-muted-foreground"><span>{heightLabel}</span><UtilityInput className="h-9 px-2 text-[13px] tabular-nums" type="number" min={1} max={max} step={1} value={dimensions.height} aria-label={`${heightLabel} (${max})`} data-testid={`${testId}-height`} onChange={(event) => onChange("height", Number(event.target.value))} /></label>
  </div>;
}

function clampEditorDimension(value: number, max: number) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)));
}

function normalizeEditorDimensions(dimensions: EditorDimensions, max: number): EditorDimensions {
  return {
    width: clampEditorDimension(dimensions.width, max),
    height: clampEditorDimension(dimensions.height, max),
  };
}

function resizeLockedDimensions(value: number, axis: keyof EditorDimensions, source: EditorDimensions, max: number): EditorDimensions {
  const ratio = Math.max(Number.EPSILON, source.width / Math.max(1, source.height));
  if (axis === "width") {
    let width = clampEditorDimension(value, max);
    let height = Math.max(1, Math.round(width / ratio));
    if (height > max) {
      height = max;
      width = Math.max(1, Math.min(max, Math.round(height * ratio)));
    }
    return { width, height };
  }
  let height = clampEditorDimension(value, max);
  let width = Math.max(1, Math.round(height * ratio));
  if (width > max) {
    width = max;
    height = Math.max(1, Math.min(max, Math.round(width / ratio)));
  }
  return { width, height };
}

function getOriginalQualityExportPlan(dimensions: EditorDimensions, multiplier: number, max: number) {
  const requestedMultiplier = Math.max(Number.EPSILON, Number.isFinite(multiplier) ? multiplier : 1);
  const effectiveMultiplier = Math.min(requestedMultiplier, max / dimensions.width, max / dimensions.height);
  return {
    multiplier: effectiveMultiplier,
    reduced: effectiveMultiplier < requestedMultiplier - 1e-9,
    dimensions: {
      width: Math.max(1, Math.min(max, Math.floor(dimensions.width * effectiveMultiplier + 1e-6))),
      height: Math.max(1, Math.min(max, Math.floor(dimensions.height * effectiveMultiplier + 1e-6))),
    },
  };
}

function renderEditorExportSize(source: HTMLCanvasElement, dimensions: EditorDimensions, ratioLocked: boolean, whiteBackground: boolean) {
  const destination = document.createElement("canvas");
  destination.width = dimensions.width;
  destination.height = dimensions.height;
  const context = destination.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");
  if (whiteBackground) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, destination.width, destination.height);
  }
  if (ratioLocked) {
    const scale = Math.min(destination.width / source.width, destination.height / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    context.drawImage(source, (destination.width - width) / 2, (destination.height - height) / 2, width, height);
  } else {
    context.drawImage(source, 0, 0, destination.width, destination.height);
  }
  return destination;
}

function encodeEditorExportCanvas(source: HTMLCanvasElement, format: ImageOutputFormat) {
  if (format !== "jpeg") return source.toDataURL(`image/${format}`, 0.92);
  const flattened = document.createElement("canvas");
  flattened.width = source.width;
  flattened.height = source.height;
  const context = flattened.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, flattened.width, flattened.height);
  context.drawImage(source, 0, 0);
  const dataUrl = flattened.toDataURL("image/jpeg", 0.92);
  flattened.width = 1;
  flattened.height = 1;
  return dataUrl;
}

function readStoredEditorPanelCollapsed() {
  try {
    return sessionStorage.getItem(EDITOR_PANEL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function useEditorMobilePanelLayout() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

function applyEditorInteractivity(instance: Canvas, image: FabricImage | undefined, mode: EditorInteractionMode, baseLocked: boolean) {
  instance.forEachObject((object) => {
    const eraserPath = object.globalCompositeOperation === "destination-out";
    const role = (object as EditorFabricObject).worklazyRole;
    const fixedEffect = role === "region-effect";
    const cropBox = role === "crop-overlay";
    const interactive = cropBox ? mode === "crop" : mode === "select" && !eraserPath && !fixedEffect && (object !== image || !baseLocked);
    object.set({ selectable: interactive, evented: interactive });
  });
}

function isRegionMode(mode: EditorInteractionMode) {
  return mode === "crop" || mode === "effect";
}

function isNonPrimaryMouseEvent(event: TPointerEvent) {
  const pointerType = "pointerType" in event ? event.pointerType : undefined;
  const mouseLike = pointerType ? pointerType === "mouse" : typeof MouseEvent !== "undefined" && event instanceof MouseEvent;
  return mouseLike && "button" in event && event.button !== 0;
}

function canFitCropRatio(width: number, height: number, ratio: number) {
  return Boolean(fitCropRatioDimensions(width, height, ratio, CROP_MIN_SIZE));
}

function fitCropRatioDimensions(maxWidth: number, maxHeight: number, ratio: number, preferredWidth: number) {
  const widthLimit = Math.max(0, Math.floor(maxWidth + 1e-9));
  const heightLimit = Math.max(0, Math.floor(maxHeight + 1e-9));
  if (!Number.isFinite(ratio) || ratio <= 0 || widthLimit < CROP_MIN_SIZE || heightLimit < CROP_MIN_SIZE) return undefined;
  const minimumHeight = Math.max(CROP_MIN_SIZE, Math.ceil(CROP_MIN_SIZE / ratio - 1e-9));
  let maximumHeight = Math.min(heightLimit, Math.floor((widthLimit + 0.499999) / ratio));
  while (maximumHeight >= minimumHeight && Math.round(maximumHeight * ratio) > widthLimit) maximumHeight -= 1;
  if (maximumHeight < minimumHeight) return undefined;
  const preferredHeight = Math.round(preferredWidth / ratio);
  const height = Math.max(minimumHeight, Math.min(maximumHeight, preferredHeight));
  const width = Math.round(height * ratio);
  if (width < CROP_MIN_SIZE || width > widthLimit || Math.abs(width - height * ratio) > 1) return undefined;
  return { width, height };
}

function createRegionDragSelection(
  origin: { x: number; y: number },
  point: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  ratio: CropRatio,
  centered: boolean,
): RegionSelection {
  const deltaX = point.x - origin.x;
  const deltaY = point.y - origin.y;
  const centeredWidthLimit = Math.max(0, 2 * Math.min(origin.x, canvasWidth - origin.x));
  const centeredHeightLimit = Math.max(0, 2 * Math.min(origin.y, canvasHeight - origin.y));
  const widthLimit = centered ? centeredWidthLimit : canvasWidth;
  const heightLimit = centered ? centeredHeightLimit : canvasHeight;
  const rawWidth = Math.min(widthLimit, Math.abs(deltaX) * (centered ? 2 : 1));
  const rawHeight = Math.min(heightLimit, Math.abs(deltaY) * (centered ? 2 : 1));
  const dimensions = ratio ? fitCropRatioDimensions(widthLimit, heightLimit, ratio, Math.min(rawWidth, rawHeight * ratio)) : undefined;
  const width = dimensions?.width ?? rawWidth;
  const height = dimensions?.height ?? rawHeight;
  const left = centered ? origin.x - width / 2 : deltaX >= 0 ? origin.x : origin.x - width;
  const top = centered ? origin.y - height / 2 : deltaY >= 0 ? origin.y : origin.y - height;
  return {
    left: Math.max(0, Math.min(canvasWidth - width, left)),
    top: Math.max(0, Math.min(canvasHeight - height, top)),
    width,
    height,
  };
}

function getCropOverlaySelection(overlay: Rect): RegionSelection {
  const topLeft = overlay.getPointByOrigin("left", "top");
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: Math.abs(overlay.width * overlay.scaleX),
    height: Math.abs(overlay.height * overlay.scaleY),
  };
}

function constrainCropOverlay(overlay: Rect, instance: Canvas, normalize: boolean, ratio: CropRatio): RegionSelection {
  const current = getCropOverlaySelection(overlay);
  const ratioDimensions = ratio
    ? fitCropRatioDimensions(instance.getWidth(), instance.getHeight(), ratio, Math.min(current.width, current.height * ratio))
    : undefined;
  const width = ratioDimensions?.width
    ?? Math.min(instance.getWidth(), Math.max(CROP_MIN_SIZE, normalize ? Math.round(current.width) : current.width));
  const height = ratioDimensions?.height
    ?? Math.min(instance.getHeight(), Math.max(CROP_MIN_SIZE, normalize ? Math.round(current.height) : current.height));
  const left = Math.max(0, Math.min(instance.getWidth() - width, current.left));
  const top = Math.max(0, Math.min(instance.getHeight() - height, current.top));
  if (normalize) overlay.set({ left, top, width, height, scaleX: 1, scaleY: 1, flipX: false, flipY: false, skewX: 0, skewY: 0, angle: 0 });
  else overlay.set({ left, top, scaleX: width / Math.max(1e-9, overlay.width), scaleY: height / Math.max(1e-9, overlay.height), flipX: false, flipY: false });
  overlay.setCoords();
  return { left, top, width, height };
}

function configureCropOverlay(overlay: Rect, getRatio: () => CropRatio) {
  const cornerControl = (x: -0.5 | 0.5, y: -0.5 | 0.5, cursorStyle: string) => new Control({
    x,
    y,
    cursorStyle,
    actionName: "scale",
    actionHandler: createCropScaleHandler("both", getRatio),
  });
  const controls = {
    tl: cornerControl(-0.5, -0.5, "nwse-resize"),
    tr: cornerControl(0.5, -0.5, "nesw-resize"),
    bl: cornerControl(-0.5, 0.5, "nesw-resize"),
    br: cornerControl(0.5, 0.5, "nwse-resize"),
    ...(getRatio() === undefined ? {
      ml: new Control({ x: -0.5, y: 0, cursorStyle: "ew-resize", actionName: "scaleX", actionHandler: createCropScaleHandler("x", getRatio) }),
      mr: new Control({ x: 0.5, y: 0, cursorStyle: "ew-resize", actionName: "scaleX", actionHandler: createCropScaleHandler("x", getRatio) }),
      mt: new Control({ x: 0, y: -0.5, cursorStyle: "ns-resize", actionName: "scaleY", actionHandler: createCropScaleHandler("y", getRatio) }),
      mb: new Control({ x: 0, y: 0.5, cursorStyle: "ns-resize", actionName: "scaleY", actionHandler: createCropScaleHandler("y", getRatio) }),
    } : {}),
  };
  overlay.controls = controls;
  overlay.set({
    selectable: true,
    evented: true,
    hasBorders: true,
    hasControls: true,
    lockRotation: true,
    lockSkewingX: true,
    lockSkewingY: true,
    lockScalingFlip: true,
    centeredScaling: false,
    transparentCorners: false,
    cornerColor: "#ffffff",
    cornerStrokeColor: "#0a84ff",
    borderColor: "#0a84ff",
    cornerStyle: "circle",
    cornerSize: 13,
    touchCornerSize: 30,
  });
  overlay.setCoords();
}

function createCropScaleHandler(axis: "x" | "y" | "both", getRatio: () => CropRatio) {
  return controlsUtils.wrapWithFireEvent("scaling", controlsUtils.wrapWithFixedAnchor((event: TPointerEvent, transform: Transform, x: number, y: number) => {
    const target = transform.target as Rect;
    const instance = target.canvas;
    if (!instance) return false;
    const anchor = target.getPositionByOrigin(transform.originX, transform.originY);
    const horizontalDirection = transform.corner.includes("l") ? -1 : 1;
    const verticalDirection = transform.corner.includes("t") ? -1 : 1;
    const changesWidth = axis !== "y";
    const changesHeight = axis !== "x";
    const centeredX = transform.originX === "center";
    const centeredY = transform.originY === "center";
    const horizontalDistance = horizontalDirection * (x - anchor.x);
    const verticalDistance = verticalDirection * (y - anchor.y);
    if ((changesWidth && horizontalDistance <= 0) || (changesHeight && verticalDistance <= 0)) return false;
    const current = getCropOverlaySelection(target);
    const rawWidth = changesWidth ? horizontalDistance * (centeredX ? 2 : 1) : current.width;
    const rawHeight = changesHeight ? verticalDistance * (centeredY ? 2 : 1) : current.height;
    const requestedRatio = getRatio() ?? (event.shiftKey ? 1 : undefined);
    const ratio = requestedRatio && canFitCropRatio(instance.getWidth(), instance.getHeight(), requestedRatio) ? requestedRatio : undefined;
    const preferredWidth = axis === "x" ? rawWidth : axis === "y" ? rawHeight * (ratio || 1) : Math.min(rawWidth, rawHeight * (ratio || 1));
    const dimensions = ratio ? fitCropRatioDimensions(instance.getWidth(), instance.getHeight(), ratio, preferredWidth) : undefined;
    const width = dimensions?.width ?? Math.max(CROP_MIN_SIZE, Math.min(instance.getWidth(), rawWidth));
    const height = dimensions?.height ?? Math.max(CROP_MIN_SIZE, Math.min(instance.getHeight(), rawHeight));
    const previousScaleX = target.scaleX;
    const previousScaleY = target.scaleY;
    target.set({ scaleX: width / Math.max(1e-9, target.width), scaleY: height / Math.max(1e-9, target.height), flipX: false, flipY: false });
    return previousScaleX !== target.scaleX || previousScaleY !== target.scaleY;
  }));
}

function mapSelectionToImagePixels(selection: RegionSelection, image: FabricImage, sourceWidth: number, sourceHeight: number): ImagePixelRegion {
  return mapCanvasSelectionToImagePixels({
    selection,
    imageTransform: image.calcTransformMatrix(),
    cropX: image.cropX,
    cropY: image.cropY,
    imageWidth: image.width,
    imageHeight: image.height,
    sourceWidth,
    sourceHeight,
  });
}

function syncRegionEffectTransform(effect: FabricImage, image: FabricImage) {
  const anchoredEffect = effect as EditorFabricObject;
  const anchorX = anchoredEffect.worklazyAnchorX;
  const anchorY = anchoredEffect.worklazyAnchorY;
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return;
  const transform = anchorRegionEffect(image.calcTransformMatrix(), anchorX!, anchorY!);
  util.applyTransformToObject(effect, transform);
  effect.setCoords();
}

function syncRegionEffectTransforms(instance: Canvas, image: FabricImage) {
  instance.getObjects().forEach((object) => {
    if (object instanceof FabricImage && (object as EditorFabricObject).worklazyRole === "region-effect") syncRegionEffectTransform(object, image);
  });
}

function createRegionEffectCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  selection: RegionSelection,
  effect: RegionEffect,
  strength: number,
) {
  const left = Math.max(0, Math.min(sourceWidth - 1, Math.floor(selection.left)));
  const top = Math.max(0, Math.min(sourceHeight - 1, Math.floor(selection.top)));
  const width = Math.max(1, Math.min(sourceWidth, Math.ceil(selection.left + selection.width)) - left);
  const height = Math.max(1, Math.min(sourceHeight, Math.ceil(selection.top + selection.height)) - top);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  if (effect === "mosaic") {
    const sample = document.createElement("canvas");
    const blockSize = Math.max(2, strength);
    sample.width = Math.max(1, Math.ceil(width / blockSize));
    sample.height = Math.max(1, Math.ceil(height / blockSize));
    const sampleContext = sample.getContext("2d");
    if (!sampleContext) throw new Error("Canvas 2D context unavailable");
    sampleContext.imageSmoothingEnabled = true;
    sampleContext.drawImage(source, left, top, width, height, 0, 0, sample.width, sample.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(sample, 0, 0, sample.width, sample.height, 0, 0, width, height);
    sample.width = 1;
    sample.height = 1;
    return output;
  }

  const radius = Math.max(2, strength * 0.55);
  const padding = Math.ceil(radius * 3);
  const padded = document.createElement("canvas");
  padded.width = width + padding * 2;
  padded.height = height + padding * 2;
  const paddedContext = padded.getContext("2d");
  if (!paddedContext) throw new Error("Canvas 2D context unavailable");
  drawEdgeClampedRegion(paddedContext, source, sourceWidth, sourceHeight, left - padding, top - padding, padded.width, padded.height);

  const blurred = document.createElement("canvas");
  blurred.width = padded.width;
  blurred.height = padded.height;
  const blurredContext = blurred.getContext("2d");
  if (!blurredContext) throw new Error("Canvas 2D context unavailable");
  if (typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype) {
    blurredContext.filter = `blur(${radius}px)`;
    blurredContext.drawImage(padded, 0, 0);
    blurredContext.filter = "none";
  } else {
    drawApproximateBlur(blurredContext, padded, radius);
  }
  context.drawImage(blurred, padding, padding, width, height, 0, 0, width, height);
  padded.width = 1;
  padded.height = 1;
  blurred.width = 1;
  blurred.height = 1;
  return output;
}

function drawEdgeClampedRegion(context: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, sourceLeft: number, sourceTop: number, width: number, height: number) {
  const sourceRight = sourceLeft + width;
  const sourceBottom = sourceTop + height;
  const actualLeft = Math.max(0, sourceLeft);
  const actualTop = Math.max(0, sourceTop);
  const actualRight = Math.min(sourceWidth, sourceRight);
  const actualBottom = Math.min(sourceHeight, sourceBottom);
  const actualWidth = Math.max(1, actualRight - actualLeft);
  const actualHeight = Math.max(1, actualBottom - actualTop);
  const destinationLeft = actualLeft - sourceLeft;
  const destinationTop = actualTop - sourceTop;
  context.drawImage(source, actualLeft, actualTop, actualWidth, actualHeight, destinationLeft, destinationTop, actualWidth, actualHeight);

  if (destinationLeft > 0) context.drawImage(source, actualLeft, actualTop, 1, actualHeight, 0, destinationTop, destinationLeft, actualHeight);
  const destinationRight = destinationLeft + actualWidth;
  if (destinationRight < width) context.drawImage(source, actualRight - 1, actualTop, 1, actualHeight, destinationRight, destinationTop, width - destinationRight, actualHeight);
  if (destinationTop > 0) context.drawImage(source, actualLeft, actualTop, actualWidth, 1, destinationLeft, 0, actualWidth, destinationTop);
  const destinationBottom = destinationTop + actualHeight;
  if (destinationBottom < height) context.drawImage(source, actualLeft, actualBottom - 1, actualWidth, 1, destinationLeft, destinationBottom, actualWidth, height - destinationBottom);
  if (destinationLeft > 0 && destinationTop > 0) context.drawImage(source, actualLeft, actualTop, 1, 1, 0, 0, destinationLeft, destinationTop);
  if (destinationRight < width && destinationTop > 0) context.drawImage(source, actualRight - 1, actualTop, 1, 1, destinationRight, 0, width - destinationRight, destinationTop);
  if (destinationLeft > 0 && destinationBottom < height) context.drawImage(source, actualLeft, actualBottom - 1, 1, 1, 0, destinationBottom, destinationLeft, height - destinationBottom);
  if (destinationRight < width && destinationBottom < height) context.drawImage(source, actualRight - 1, actualBottom - 1, 1, 1, destinationRight, destinationBottom, width - destinationRight, height - destinationBottom);
}

function drawApproximateBlur(context: CanvasRenderingContext2D, source: HTMLCanvasElement, radius: number) {
  const passes = radius >= 14 ? 3 : 2;
  const reduction = Math.max(2, Math.min(12, Math.round(1 + (radius / Math.sqrt(passes)) * 0.45)));
  let passSource: HTMLCanvasElement = source;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (let pass = 0; pass < passes; pass += 1) {
    const reduced = document.createElement("canvas");
    reduced.width = Math.max(1, Math.ceil(source.width / reduction));
    reduced.height = Math.max(1, Math.ceil(source.height / reduction));
    const reducedContext = reduced.getContext("2d");
    if (!reducedContext) throw new Error("Canvas 2D context unavailable");
    reducedContext.imageSmoothingEnabled = true;
    reducedContext.imageSmoothingQuality = "high";
    reducedContext.drawImage(passSource, 0, 0, reduced.width, reduced.height);
    context.clearRect(0, 0, source.width, source.height);
    context.drawImage(reduced, 0, 0, reduced.width, reduced.height, 0, 0, source.width, source.height);
    reduced.width = 1;
    reduced.height = 1;
    passSource = context.canvas;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the image canvas.")), type));
}

interface InternalGestureCanvas {
  _currentTransform: { target: FabricObject; original: Partial<FabricObject> } | null;
  _groupSelector: unknown;
  _isCurrentlyDrawing: boolean;
}

function cancelCurrentFabricInteraction(instance: Canvas) {
  const internal = instance as unknown as InternalGestureCanvas;
  const transform = internal._currentTransform;
  if (transform) {
    transform.target.set(transform.original);
    transform.target.isMoving = false;
    transform.target.setCoords();
  }
  internal._currentTransform = null;
  internal._groupSelector = null;
  if (internal._isCurrentlyDrawing) {
    internal._isCurrentlyDrawing = false;
    instance.clearContext(instance.contextTop);
  }
  instance.requestRenderAll();
  return transform?.target;
}

function installEditorViewportGestures({
  instance,
  stage,
  onGestureStart,
  onViewportChange,
}: {
  instance: Canvas;
  stage: HTMLDivElement | null;
  onGestureStart: () => void;
  onViewportChange: (viewport: TMat2D) => void;
}) {
  const upperCanvas = instance.upperCanvasEl;
  let pointerOverCanvas = false;
  let spacePressed = false;
  let mousePan: { clientX: number; clientY: number; viewport: TMat2D } | undefined;
  let touchGesture: { ids: [number, number]; distance: number; sceneCenter: Point; viewport: TMat2D } | undefined;

  const toViewportPoint = (clientX: number, clientY: number) => {
    const bounds = upperCanvas.getBoundingClientRect();
    return new Point(
      (clientX - bounds.left) * instance.getWidth() / Math.max(1, bounds.width),
      (clientY - bounds.top) * instance.getHeight() / Math.max(1, bounds.height),
    );
  };

  const notifyViewport = (viewport: TMat2D) => onViewportChange(viewport);

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = toViewportPoint(event.clientX, event.clientY);
    const currentViewport = [...instance.viewportTransform] as TMat2D;
    const nextZoom = Math.max(EDITOR_MIN_ZOOM, Math.min(EDITOR_MAX_ZOOM, instance.getZoom() * Math.exp(-event.deltaY * 0.0015)));
    const scenePoint = point.transform(util.invertTransform(currentViewport));
    notifyViewport([
      nextZoom,
      0,
      0,
      nextZoom,
      point.x - scenePoint.x * nextZoom,
      point.y - scenePoint.y * nextZoom,
    ]);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.code !== "Space" || target?.closest("input, textarea, select, [contenteditable='true']") || !pointerOverCanvas) return;
    event.preventDefault();
    spacePressed = true;
    stage?.classList.add("is-pan-ready");
  };

  const clearSpaceState = () => {
    spacePressed = false;
    if (!mousePan) stage?.classList.remove("is-pan-ready");
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") clearSpaceState();
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!spacePressed || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    mousePan = { clientX: event.clientX, clientY: event.clientY, viewport: [...instance.viewportTransform] as TMat2D };
    stage?.classList.add("is-panning");
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!mousePan) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const bounds = upperCanvas.getBoundingClientRect();
    const scaleX = instance.getWidth() / Math.max(1, bounds.width);
    const scaleY = instance.getHeight() / Math.max(1, bounds.height);
    const viewport = [...mousePan.viewport] as TMat2D;
    viewport[4] += (event.clientX - mousePan.clientX) * scaleX;
    viewport[5] += (event.clientY - mousePan.clientY) * scaleY;
    notifyViewport(viewport);
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!mousePan) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    mousePan = undefined;
    stage?.classList.remove("is-panning");
    if (!spacePressed) stage?.classList.remove("is-pan-ready");
  };

  const touchPoints = (touches: TouchList, ids?: [number, number]) => {
    const all = Array.from(touches);
    const selected = ids
      ? ids.map((id) => all.find((touch) => touch.identifier === id)).filter((touch): touch is Touch => Boolean(touch))
      : all.slice(0, 2);
    return selected.length === 2 ? selected : undefined;
  };

  const beginTouchGesture = (event: TouchEvent) => {
    const points = touchPoints(event.touches);
    if (!points) return;
    onGestureStart();
    const first = toViewportPoint(points[0].clientX, points[0].clientY);
    const second = toViewportPoint(points[1].clientX, points[1].clientY);
    const center = first.midPointFrom(second);
    const viewport = [...instance.viewportTransform] as TMat2D;
    touchGesture = {
      ids: [points[0].identifier, points[1].identifier],
      distance: Math.max(1, first.distanceFrom(second)),
      sceneCenter: center.transform(util.invertTransform(viewport)),
      viewport,
    };
    stage?.classList.add("is-viewport-gesture");
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length < 2 && !touchGesture) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!touchGesture) beginTouchGesture(event);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!touchGesture) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const points = touchPoints(event.touches, touchGesture.ids);
    if (!points) return;
    const first = toViewportPoint(points[0].clientX, points[0].clientY);
    const second = toViewportPoint(points[1].clientX, points[1].clientY);
    const center = first.midPointFrom(second);
    const startZoom = Math.hypot(touchGesture.viewport[0], touchGesture.viewport[1]);
    const zoom = Math.max(EDITOR_MIN_ZOOM, Math.min(EDITOR_MAX_ZOOM, startZoom * first.distanceFrom(second) / touchGesture.distance));
    notifyViewport([
      zoom,
      0,
      0,
      zoom,
      center.x - touchGesture.sceneCenter.x * zoom,
      center.y - touchGesture.sceneCenter.y * zoom,
    ]);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!touchGesture) return;
    if (event.touches.length > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    touchGesture = undefined;
    stage?.classList.remove("is-viewport-gesture");
  };

  const handleMouseEnter = () => { pointerOverCanvas = true; };
  const handleMouseLeave = () => { pointerOverCanvas = false; clearSpaceState(); };
  upperCanvas.addEventListener("mouseenter", handleMouseEnter);
  upperCanvas.addEventListener("mouseleave", handleMouseLeave);
  upperCanvas.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  upperCanvas.addEventListener("mousedown", handleMouseDown, true);
  upperCanvas.addEventListener("touchstart", handleTouchStart, { capture: true, passive: false });
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearSpaceState);
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
  document.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });

  return () => {
    upperCanvas.removeEventListener("mouseenter", handleMouseEnter);
    upperCanvas.removeEventListener("mouseleave", handleMouseLeave);
    upperCanvas.removeEventListener("wheel", handleWheel, true);
    upperCanvas.removeEventListener("mousedown", handleMouseDown, true);
    upperCanvas.removeEventListener("touchstart", handleTouchStart, true);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", clearSpaceState);
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("touchmove", handleTouchMove, true);
    document.removeEventListener("touchend", handleTouchEnd, true);
  };
}

function useResponsiveFabricCanvas(canvasRef: React.MutableRefObject<Canvas | undefined>, stageRef: React.RefObject<HTMLDivElement | null>, onResize: () => void) {
  const sync = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const style = getComputedStyle(stage);
    const availableWidth = Math.max(1, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    const scale = Math.min(1, availableWidth / canvas.getWidth());
    canvas.setDimensions({ width: `${Math.round(canvas.getWidth() * scale)}px`, height: `${Math.round(canvas.getHeight() * scale)}px` }, { cssOnly: true });
    canvas.calcOffset();
    onResize();
  }, [canvasRef, onResize, stageRef]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(sync);
    observer.observe(stage);
    window.addEventListener("orientationchange", sync);
    window.requestAnimationFrame(sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", sync);
    };
  }, [stageRef, sync]);
  return sync;
}

function getEditorSelectionState(object: FabricObject): EditorSelectionState {
  if (object instanceof ActiveSelection) {
    return {
      ...EMPTY_EDITOR_SELECTION,
      kind: "multiple",
      count: object.size(),
    };
  }
  const isBase = (object as EditorFabricObject).worklazyRole === "base";
  const isSticker = (object as EditorFabricObject).worklazyRole === "sticker";
  const shapeKind = getEditorShapeKind(object);
  const shapeCapabilities = shapeKind ? getEditorShapeStyleCapabilities(shapeKind) : undefined;
  const isDrawing = object.type === "path" && !shapeKind;
  const isLine = shapeKind === "line" || object instanceof Line;
  const isShape = Boolean(shapeKind && shapeKind !== "line") || object instanceof Rect || object instanceof Circle;
  const isText = object instanceof IText;
  const colorSource = isLine || isDrawing ? object.stroke : object.fill;
  return {
    kind: isBase ? "base" : isSticker ? "sticker" : isText ? "text" : isLine ? "line" : isShape ? "shape" : isDrawing ? "drawing" : "shape",
    color: fabricColorToHex(colorSource, "#1d1d1f"),
    strokeColor: fabricColorToHex(object.stroke, "#ffffff"),
    width: Math.max(0, Math.round(object.strokeWidth || 0)),
    colorEnabled: !isBase && !isSticker && (isDrawing || isLine || isShape || isText),
    strokeColorEnabled: !isBase && !isSticker && (shapeCapabilities ? shapeCapabilities.stroke : isShape),
    widthEnabled: !isBase && !isSticker && (shapeCapabilities ? shapeCapabilities.strokeWidth : isDrawing || isLine || isShape || isText),
    isBase,
    shapeKind,
    geometry: shapeKind ? getEditorShapeGeometry(object) : undefined,
    opacity: object.opacity,
  };
}

function getEditorLayerKind(object: FabricObject): EditorLayerKind {
  const kind = getEditorSelectionState(object).kind;
  return kind === "none" || kind === "multiple" ? "shape" : kind;
}

function setEditorActiveObjects(instance: Canvas, objects: readonly FabricObject[], event?: TPointerEvent) {
  const selectable = objects.filter((object) => object.visible);
  if (selectable.length === 1) instance.setActiveObject(selectable[0], event);
  else if (selectable.length > 1) instance.setActiveObject(new ActiveSelection([...selectable], { canvas: instance }), event);
}

function fabricColorToHex(value: FabricObject["fill"] | FabricObject["stroke"], fallback: string) {
  if (typeof value !== "string") return fallback;
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map((part) => part + part).join("")}`.toLowerCase();
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("")}`;
}

function stripExtension(name: string) { return name.replace(/\.[^.]+$/, ""); }
