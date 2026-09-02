import { AlertTriangle, Download, ImageIcon, Images, LayoutGrid, Sparkles } from "lucide-react";
import { Canvas, Circle, FabricImage, FabricObject, IText, Line, PencilBrush, Point, Rect, filters, util, type TMat2D } from "fabric";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { BatchImagePanel, CollagePanel, GifPanel } from "./ImageProcessingPanels";
import { ImageEditorMinibar } from "./ImageEditorMinibar";
import { ImageEditorPanel } from "./ImageEditorPanel";
import { ImageEditorToolbar } from "./ImageEditorToolbar";
import { ImageEditorViewportControls } from "./ImageEditorViewportControls";
import { getImageStudioStickerUrl, type ImageStudioSticker } from "./imageStudioStickers";
import { ClipboardHint, RASTER_IMAGE_ACCEPT, filterRasterImages, useClipboardImages } from "./imageStudioShared";
import { applyEditorShapeStyle, createEditorShape, getEditorShapeGeometry, getEditorShapeKind, getEditorShapeStyleCapabilities } from "./imageEditorShapes";
import {
  EMPTY_EDITOR_SELECTION,
  type EditorDrawTool,
  type EditorInteractionMode,
  type EditorMinibarPosition,
  type EditorPanelName,
  type EditorSelectionState,
  type EditorShapeKind,
  type RegionEffect,
} from "./imageEditorTypes";
import {
  anchorRegionEffect,
  mapCanvasSelectionToImagePixels,
  orderRegionEffectsAboveBase,
  resolveRegionEffectSourceStrength,
  type ImagePixelRegion,
} from "./regionEffectTransform";
import type { ImageOutputFormat } from "./types";

type StudioTab = "editor" | "batch" | "collage" | "gif";

const EDITOR_MIN_ZOOM = 0.25;
const EDITOR_MAX_ZOOM = 4;
const EDITOR_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
const IDENTITY_VIEWPORT: TMat2D = [1, 0, 0, 1, 0, 0];

export function ImageStudioPage() {
  const { t } = useTranslation("features");
  const [tab, setTab] = useState<StudioTab>("editor");
  const progress = useOperationProgress();
  const activeController = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => activeController.current?.abort(), []);

  return (
    <div className="page tool-page page-enter image-studio-page">
      <PageHeader eyebrow="IMAGE STUDIO" title={t("image.title")} description={t("image.description")}>
        <PrivacyBanner compact />
      </PageHeader>
      <nav className="studio-tabs" aria-label={t("image.tabs.label")}>
        {([
          ["editor", t("image.tabs.editor"), ImageIcon], ["batch", t("image.tabs.batch"), Images], ["collage", t("image.tabs.collage"), LayoutGrid], ["gif", t("image.tabs.gif"), Sparkles],
        ] as const).map(([value, label, Icon]) => <button type="button" className={tab === value ? "active" : ""} onClick={() => { activeController.current?.abort(); activeController.current = undefined; setTab(value); progress.reset(); }} key={value}><Icon size={17} /><span>{label}</span></button>)}
      </nav>

      <div className="inline-notice warning image-format-notice"><AlertTriangle size={16} /><span>{t("image.heic")}</span></div>
      {(tab === "batch" || tab === "collage" || tab === "gif") && <div className="inline-notice warning image-worker-notice"><AlertTriangle size={16} /><span>{t("image.offscreen")}</span></div>}

      {tab === "editor" && <ImageEditor />}
      {tab === "batch" && <BatchImagePanel progress={progress} controllerRef={activeController} />}
      {tab === "collage" && <CollagePanel progress={progress} controllerRef={activeController} />}
      {tab === "gif" && <GifPanel progress={progress} controllerRef={activeController} />}

      <OperationProgress {...progress} accent="sky" title={t("image.log")} />
      {progress.status === "running" && <div className="cancel-operation"><button className="secondary-button" type="button" onClick={() => activeController.current?.abort()}>{t("image.cancel")}</button></div>}

      <ToolGuide
        title={t("image.guide.title")}
        description={t("image.guide.description")}
        blocks={(t("image.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("image.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </div>
  );
}

type EditorObjectRole = "base" | "region-effect" | "sticker";

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
}

function ImageEditor() {
  const { t } = useTranslation("features");
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const stageElement = useRef<HTMLDivElement>(null);
  const canvas = useRef<Canvas | undefined>(undefined);
  const baseImage = useRef<FabricImage | undefined>(undefined);
  const sourceUrl = useRef<string | undefined>(undefined);
  const outputMultiplier = useRef(1);
  const cropOverlay = useRef<Rect | undefined>(undefined);
  const effectOverlay = useRef<Rect | undefined>(undefined);
  const cropOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  const effectOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  const cropSelectionRef = useRef<RegionSelection | undefined>(undefined);
  const effectSelectionRef = useRef<RegionSelection | undefined>(undefined);
  const regionEffectUrls = useRef(new Set<string>());
  const regionEffectBusyRef = useRef(false);
  const interactionModeRef = useRef<EditorInteractionMode>("select");
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
  const [minibarPosition, setMinibarPosition] = useState<EditorMinibarPosition>();
  const [editorError, setEditorError] = useState("");
  const [cropSelection, setCropSelection] = useState<RegionSelection>();
  const [effectSelection, setEffectSelection] = useState<RegionSelection>();
  const [regionLabelPosition, setRegionLabelPosition] = useState<RegionLabelPosition>();
  const [regionEffect, setRegionEffect] = useState<RegionEffect>("mosaic");
  const [regionEffectStrength, setRegionEffectStrength] = useState(16);
  const [regionEffectBusy, setRegionEffectBusy] = useState(false);
  const [stickerBusy, setStickerBusy] = useState(false);
  const editorSettings = useRef({ brightness, contrast, hue, background, transparentBackground, baseLocked });
  editorSettings.current = { brightness, contrast, hue, background, transparentBackground, baseLocked };

  const updateMinibarPosition = useCallback(() => {
    const instance = canvas.current;
    const stage = stageElement.current;
    const object = instance?.getActiveObject();
    if (!instance || !stage || !object || (object as EditorFabricObject).worklazyRole === "region-effect") {
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
    if (!object || (object as EditorFabricObject).worklazyRole === "region-effect") {
      setSelectionState(EMPTY_EDITOR_SELECTION);
      setMinibarPosition(undefined);
      return;
    }
    setSelectionState(getEditorSelectionState(object));
    window.requestAnimationFrame(updateMinibarPosition);
  }, [updateMinibarPosition]);

  const clearCropSelection = useCallback(() => {
    const instance = canvas.current;
    const overlay = cropOverlay.current;
    cropOrigin.current = undefined;
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

  const clearActiveRegionSelection = useCallback(() => {
    if (interactionModeRef.current === "crop") clearCropSelection();
    if (interactionModeRef.current === "effect") clearEffectSelection();
  }, [clearCropSelection, clearEffectSelection]);

  useEffect(() => {
    if (!canvasElement.current) return;
    const instance = new Canvas(canvasElement.current, { width: 900, height: 600, backgroundColor: "#ffffff", preserveObjectStacking: true });
    canvas.current = instance;
    const disposeViewportGestures = installEditorViewportGestures({
      instance,
      stage: stageElement.current,
      onGestureStart: () => {
        clearActiveRegionSelection();
        const cancelledTarget = cancelCurrentFabricInteraction(instance);
        if (cancelledTarget === baseImage.current && baseImage.current) syncRegionEffectTransforms(instance, baseImage.current);
        syncSelectedObject(instance.getActiveObject());
      },
      onViewportChange: (viewport) => applyViewportTransform(instance, viewport),
    });
    const syncSelection = () => syncSelectedObject(instance.getActiveObject());
    const onPath = (event: { path: FabricObject }) => {
      if (interactionModeRef.current === "erase") event.path.set({ globalCompositeOperation: "destination-out", selectable: false, evented: false });
      pushSnapshot();
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
    instance.on("object:moving", syncObjectTransform);
    instance.on("object:rotating", syncObjectTransform);
    instance.on("object:scaling", syncObjectTransform);
    instance.on("object:skewing", syncObjectTransform);
    instance.on("object:modified", (event) => { syncObjectTransform(event); syncSelectedObject(event.target); pushSnapshot(); });
    instance.on("object:added", (event) => { if (event.target !== cropOverlay.current && event.target !== effectOverlay.current) pushSnapshot(); });
    instance.on("object:removed", (event) => { if (event.target !== cropOverlay.current && event.target !== effectOverlay.current) pushSnapshot(); });
    instance.on("mouse:down", (event) => {
      const mode = interactionModeRef.current;
      if (!isRegionMode(mode) || regionEffectBusyRef.current) return;
      const point = event.scenePoint;
      const x = Math.max(0, Math.min(instance.getWidth(), point.x));
      const y = Math.max(0, Math.min(instance.getHeight(), point.y));
      const effectMode = mode === "effect";
      if (effectMode) clearEffectSelection();
      else clearCropSelection();
      const originRef = effectMode ? effectOrigin : cropOrigin;
      const overlayRef = effectMode ? effectOverlay : cropOverlay;
      originRef.current = { x, y };
      const overlay = new Rect({ left: x, top: y, width: 1, height: 1, originX: "left", originY: "top", fill: effectMode ? "rgba(175,82,222,.14)" : "rgba(10,132,255,.14)", stroke: effectMode ? "#af52de" : "#0a84ff", strokeWidth: 2, strokeDashArray: [9, 6], strokeUniform: true, selectable: false, evented: false, excludeFromExport: true });
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
      overlay.set({ left: Math.min(origin.x, x), top: Math.min(origin.y, y), width: Math.abs(x - origin.x), height: Math.abs(y - origin.y) });
      overlay.setCoords();
      const selection = { left: overlay.left || 0, top: overlay.top || 0, width: overlay.width || 0, height: overlay.height || 0 };
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
    instance.on("mouse:up", () => {
      const mode = interactionModeRef.current;
      if (!isRegionMode(mode)) return;
      const effectMode = mode === "effect";
      const originRef = effectMode ? effectOrigin : cropOrigin;
      const overlay = (effectMode ? effectOverlay : cropOverlay).current;
      originRef.current = undefined;
      if (!overlay) return;
      const selection = { left: overlay.left || 0, top: overlay.top || 0, width: overlay.width || 0, height: overlay.height || 0 };
      if (selection.width < 10 || selection.height < 10) {
        if (effectMode) clearEffectSelection();
        else clearCropSelection();
      } else if (effectMode) {
        effectSelectionRef.current = selection;
        setEffectSelection(selection);
      } else {
        cropSelectionRef.current = selection;
        setCropSelection(selection);
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
  }, [applyViewportTransform, clearActiveRegionSelection, clearCropSelection, clearEffectSelection, pushSnapshot, syncCanvasDisplay, syncSelectedObject, updateMinibarPosition, updateRegionLabelPosition]);

  useEffect(() => {
    const instance = canvas.current;
    if (!instance) return;
    interactionModeRef.current = interactionMode;
    instance.isDrawingMode = interactionMode === "pencil" || interactionMode === "brush" || interactionMode === "erase";
    instance.selection = interactionMode === "select";
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
  }, [baseLocked, drawColor, drawWidth, interactionMode, syncSelectedObject]);

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
      outputMultiplier.current = Math.max(1, 1 / scale);
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
    outputMultiplier.current = 1;
    setEditorError("");
    setBrightness(0); setContrast(0); setHue(0); setBaseLocked(true); setInteractionMode("select"); setActivePanel("select");
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
    if (!instance || !object) return;
    action(object);
    object.setCoords();
    if (object === baseImage.current) {
      syncRegionEffectTransforms(instance, baseImage.current);
      keepRegionEffectsAboveBase(instance, baseImage.current);
    }
    instance.requestRenderAll();
    syncSelectedObject(object);
    pushSnapshot();
  };

  const removeSelectedLayers = useCallback(() => {
    const instance = canvas.current;
    if (!instance) return false;
    const removable = instance.getActiveObjects().filter((object) => object !== baseImage.current && (object as EditorFabricObject).worklazyRole !== "region-effect");
    if (!removable.length) return false;
    instance.remove(...removable);
    instance.discardActiveObject();
    syncSelectedObject();
    instance.requestRenderAll();
    pushSnapshot();
    return true;
  }, [pushSnapshot, syncSelectedObject]);

  const applyCropSelection = useCallback(() => {
    const instance = canvas.current;
    const selection = cropSelection;
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
    instance.setDimensions({ width: Math.max(1, Math.round(selection.width)), height: Math.max(1, Math.round(selection.height)) });
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
  }, [baseLocked, cropSelection, pushSnapshot, resetViewport, syncCanvasDisplay, syncSelectedObject]);

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
      effectImage.set({ imageSmoothing: regionEffect === "blur", selectable: false, evented: false });
      effectImage.filters = [...image.filters];
      if (effectImage.filters.length) effectImage.applyFilters();
      syncRegionEffectTransform(effectImage, image);
      restoringRef.current = true;
      const baseIndex = instance.getObjects().indexOf(image);
      const lastEffectIndex = instance.getObjects().reduce((lastIndex, object, index) => (object as EditorFabricObject).worklazyRole === "region-effect" ? index : lastIndex, baseIndex);
      instance.insertAt(lastEffectIndex + 1, effectImage);
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

  const cropTo = (ratio: number) => {
    const instance = canvas.current;
    const image = baseImage.current;
    if (!instance) return;
    const width = 900;
    const height = Math.round(width / ratio);
    const previousWidth = instance.getWidth();
    const previousHeight = instance.getHeight();
    clearRegionSelection();
    setInteractionMode("select");
    interactionModeRef.current = "select";
    instance.setDimensions({ width, height });
    resetViewport(instance);
    if (image) {
      const scale = Math.max(width / image.width, height / image.height);
      image.set({ left: width / 2, top: height / 2, scaleX: scale, scaleY: scale });
      image.setCoords();
    }
    instance.getObjects().filter((object) => object !== image && (object as EditorFabricObject).worklazyRole !== "region-effect").forEach((object) => {
      object.set({ left: (object.left || 0) * width / previousWidth, top: (object.top || 0) * height / previousHeight });
      object.setCoords();
    });
    if (image) syncRegionEffectTransforms(instance, image);
    instance.requestRenderAll();
    pushSnapshot();
  };

  const addObject = (object: FabricObject) => {
    const instance = canvas.current;
    if (!instance) return;
    setInteractionMode("select");
    interactionModeRef.current = "select";
    instance.isDrawingMode = false;
    instance.add(object);
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

  const duplicateSelectedLayer = async () => {
    const active = canvas.current?.getActiveObject();
    if (!active || active === baseImage.current) return;
    const clone = await active.clone();
    clone.set({ left: (active.left || 0) + 24, top: (active.top || 0) + 24 });
    addObject(clone);
  };

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
    const removable = instance.getObjects().filter((object) => object !== baseImage.current && (object as EditorFabricObject).worklazyRole !== "region-effect");
    if (!removable.length) return;
    instance.remove(...removable);
    instance.discardActiveObject();
    syncSelectedObject();
    instance.requestRenderAll();
    pushSnapshot();
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
        keepRegionEffectsAboveBase(instance, baseImage.current);
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
    setActivePanel(panel);
    const nextMode: EditorInteractionMode = panel === "draw" ? drawTool : panel === "crop" || panel === "effect" ? panel : "select";
    interactionModeRef.current = nextMode;
    setInteractionMode(nextMode);
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

  const exportImage = () => {
    const instance = canvas.current;
    if (!instance) return;
    const overlays = [cropOverlay.current, effectOverlay.current].filter((overlay): overlay is Rect => Boolean(overlay));
    const viewport = [...instance.viewportTransform] as TMat2D;
    if (baseImage.current) keepRegionEffectsAboveBase(instance, baseImage.current);
    overlays.forEach((overlay) => { if (instance.getObjects().includes(overlay)) instance.remove(overlay); });
    try {
      instance.setViewportTransform([...IDENTITY_VIEWPORT]);
      instance.renderAll();
      const multiplier = outputMultiplier.current;
      let dataUrl: string;
      if (format === "jpeg") {
        const rendered = instance.toCanvasElement(multiplier);
        const flattened = document.createElement("canvas");
        flattened.width = rendered.width;
        flattened.height = rendered.height;
        const context = flattened.getContext("2d");
        if (!context) return;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, flattened.width, flattened.height);
        context.drawImage(rendered, 0, 0);
        dataUrl = flattened.toDataURL("image/jpeg", 0.92);
        flattened.width = 1; flattened.height = 1;
        rendered.width = 1; rendered.height = 1;
      } else dataUrl = instance.toDataURL({ format, quality: 0.92, multiplier });
      const actualFormat = dataUrl.startsWith("data:image/png") ? "png" : dataUrl.startsWith("data:image/webp") ? "webp" : "jpeg";
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${file ? stripExtension(file.name) : "worklazy-image"}-${t("image.editor.suffix")}.${actualFormat === "jpeg" ? "jpg" : actualFormat}`;
      anchor.click();
    } finally {
      instance.setViewportTransform(viewport);
      overlays.forEach((overlay) => {
        const remainsCurrent = cropOverlay.current === overlay || effectOverlay.current === overlay;
        if (remainsCurrent && !instance.getObjects().includes(overlay)) instance.add(overlay);
      });
      instance.requestRenderAll();
      window.requestAnimationFrame(updateFloatingOverlays);
    }
  };

  const floatingRegionSelection = interactionMode === "crop" ? cropSelection : interactionMode === "effect" ? effectSelection : undefined;

  return (
    <SectionCard title={t("image.editor.title")} description={t("image.editor.description")}>
      <FileDropZone files={file ? [file] : []} onFiles={(files) => void loadFile(filterRasterImages(files).at(-1))} accept={RASTER_IMAGE_ACCEPT} hint={t("image.editor.hint")} accent="sky" />
      {editorError && <p className="utility-error" role="alert">{editorError}</p>}
      <ClipboardHint mode="replace" />
      <div className="editor-source-actions"><button type="button" className="secondary-button" onClick={newBlankCanvas}><ImageIcon size={16} /> {t("image.editor.blank")}</button>{file && <span>{t("image.editor.editing", { name: file.name })}</span>}</div>
      <ImageEditorToolbar
        activePanel={activePanel}
        hasFile={Boolean(file)}
        effectBusy={regionEffectBusy}
        canDelete={selectionState.kind !== "none" && !selectionState.isBase}
        historyIndex={historyState.index}
        historyLength={historyState.length}
        onPanelChange={changePanel}
        onUndo={() => void restore(historyState.index - 1)}
        onRedo={() => void restore(historyState.index + 1)}
        onDelete={() => { removeSelectedLayers(); }}
      />
      <div className="image-editor-layout" data-testid="image-editor-workspace">
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
            className={`fabric-stage image-preview-drop${stageDragging ? " is-file-dragging" : ""}${interactionMode === "crop" ? " is-crop-mode" : interactionMode === "effect" ? " is-effect-mode" : ""}`}
            aria-label={t("image.editor.canvasArea")}
            data-testid="image-editor-canvas-stage"
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
              onBringToFront={() => mutateActive((object) => canvas.current?.bringObjectToFront(object))}
              onSendToBack={() => mutateActive((object) => canvas.current?.sendObjectToBack(object))}
              onDuplicate={() => void duplicateSelectedLayer()}
              onDelete={() => { removeSelectedLayers(); }}
            />
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
            {stageDragging && <span className="image-preview-drop-hint">{t("image.editor.drop")}</span>}
          </div>
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
          onDrawToolChange={changeDrawTool}
          onDrawColorChange={setDrawColor}
          onDrawWidthChange={setDrawWidth}
          onSelectionColorChange={(color) => setSelectedObjectStyle("color", color)}
          onSelectionStrokeColorChange={(color) => setSelectedObjectStyle("stroke", color)}
          onSelectionWidthChange={(width) => setSelectedObjectStyle("width", width)}
          onRotate={() => mutateActive((object) => object.rotate((object.angle || 0) + 90))}
          onFlipHorizontal={() => mutateActive((object) => object.set("flipX", !object.flipX))}
          onFlipVertical={() => mutateActive((object) => object.set("flipY", !object.flipY))}
          onCropRatio={cropTo}
          onCropCancel={clearCropSelection}
          onCropApply={applyCropSelection}
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
        />
      </div>
      <div className="export-row"><div className="image-format-control"><SegmentedControl value={format} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} onChange={setFormat} label={t("image.editor.format")} /><small>{t("image.editor.formatHelp")}</small></div><PrimaryButton accent="sky" onClick={exportImage}><Download size={18} /> {t("image.editor.download")}</PrimaryButton></div>
    </SectionCard>
  );
}

function applyEditorInteractivity(instance: Canvas, image: FabricImage | undefined, mode: EditorInteractionMode, baseLocked: boolean) {
  instance.forEachObject((object) => {
    const eraserPath = object.globalCompositeOperation === "destination-out";
    const fixedEffect = (object as EditorFabricObject).worklazyRole === "region-effect";
    const interactive = mode === "select" && !eraserPath && !fixedEffect && (object !== image || !baseLocked);
    object.set({ selectable: interactive, evented: interactive });
  });
}

function isRegionMode(mode: EditorInteractionMode) {
  return mode === "crop" || mode === "effect";
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

function keepRegionEffectsAboveBase(instance: Canvas, image: FabricImage) {
  const current = instance.getObjects();
  const desired = orderRegionEffectsAboveBase(
    current,
    image,
    (object) => (object as EditorFabricObject).worklazyRole === "region-effect",
  );
  desired.forEach((object, index) => {
    if (instance.getObjects()[index] !== object) instance.moveObjectTo(object, index);
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

function fabricColorToHex(value: FabricObject["fill"] | FabricObject["stroke"], fallback: string) {
  if (typeof value !== "string") return fallback;
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map((part) => part + part).join("")}`.toLowerCase();
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("")}`;
}

function stripExtension(name: string) { return name.replace(/\.[^.]+$/, ""); }
