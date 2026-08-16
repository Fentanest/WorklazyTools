import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, Brush, CircleIcon, ClipboardPaste, Crop, Download, Eraser, FlipHorizontal2, FlipVertical2, Grid3X3, ImageIcon, Images, LayoutGrid, Minus, MousePointer2, Pencil, Redo2, RotateCw, Sparkles, Square, Trash2, Type, Undo2 } from "lucide-react";
import { Canvas, Circle, FabricImage, FabricObject, IText, Line, PencilBrush, Rect, filters, util } from "fabric";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { BatchImagePanel, CollagePanel, GifPanel } from "./ImageProcessingPanels";
import { ClipboardHint, RASTER_IMAGE_ACCEPT, filterRasterImages, useClipboardImages } from "./imageStudioShared";
import {
  anchorRegionEffect,
  mapCanvasSelectionToImagePixels,
  orderRegionEffectsAboveBase,
  resolveRegionEffectSourceStrength,
  type ImagePixelRegion,
} from "./regionEffectTransform";
import type { ImageOutputFormat } from "./types";

type StudioTab = "editor" | "batch" | "collage" | "gif";

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

type EditorMode = "select" | "pencil" | "brush" | "erase" | "crop" | "effect";
type RegionEffect = "mosaic" | "blur";
type EditorObjectRole = "base" | "region-effect";

interface RegionSelection {
  left: number;
  top: number;
  width: number;
  height: number;
}

type EditorFabricObject = FabricObject & { worklazyRole?: EditorObjectRole; worklazyAnchorX?: number; worklazyAnchorY?: number };

for (const property of ["worklazyRole", "worklazyAnchorX", "worklazyAnchorY", "imageSmoothing"]) {
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
  const regionOverlay = useRef<Rect | undefined>(undefined);
  const regionOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  const regionEffectUrls = useRef(new Set<string>());
  const regionEffectBusyRef = useRef(false);
  const modeRef = useRef<EditorMode>("select");
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
  const [mode, setMode] = useState<EditorMode>("select");
  const [drawColor, setDrawColor] = useState("#1d1d1f");
  const [drawWidth, setDrawWidth] = useState(7);
  const [historyState, setHistoryState] = useState({ index: -1, length: 0 });
  const [stageDragging, setStageDragging] = useState(false);
  const [shapeSelected, setShapeSelected] = useState(false);
  const [shapeFill, setShapeFill] = useState("#0a84ff");
  const [shapeStroke, setShapeStroke] = useState("#ffffff");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(0);
  const [editorError, setEditorError] = useState("");
  const [regionSelection, setRegionSelection] = useState<RegionSelection>();
  const [regionEffect, setRegionEffect] = useState<RegionEffect>("mosaic");
  const [regionEffectStrength, setRegionEffectStrength] = useState(16);
  const [regionEffectBusy, setRegionEffectBusy] = useState(false);
  const editorSettings = useRef({ brightness, contrast, hue, background, transparentBackground, baseLocked });
  editorSettings.current = { brightness, contrast, hue, background, transparentBackground, baseLocked };
  const syncCanvasDisplay = useResponsiveFabricCanvas(canvas, stageElement);

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

  const syncSelectedShape = useCallback((object?: FabricObject) => {
    const shape = (object as EditorFabricObject | undefined)?.worklazyRole !== "region-effect" && (object instanceof Rect || object instanceof Circle || object instanceof Line || object instanceof IText) ? object : undefined;
    setShapeSelected(Boolean(shape));
    if (!shape) return;
    setShapeFill(fabricColorToHex(shape.fill, "#0a84ff"));
    setShapeStroke(fabricColorToHex(shape.stroke, "#ffffff"));
    setShapeStrokeWidth(Math.max(0, Math.round(shape.strokeWidth || 0)));
  }, []);

  const clearRegionSelection = useCallback(() => {
    const instance = canvas.current;
    const overlay = regionOverlay.current;
    regionOrigin.current = undefined;
    setRegionSelection(undefined);
    if (instance && overlay) {
      instance.remove(overlay);
      instance.requestRenderAll();
    }
    regionOverlay.current = undefined;
  }, []);

  useEffect(() => {
    if (!canvasElement.current) return;
    const instance = new Canvas(canvasElement.current, { width: 900, height: 600, backgroundColor: "#ffffff", preserveObjectStacking: true });
    canvas.current = instance;
    const syncSelection = () => syncSelectedShape(instance.getActiveObject());
    const onPath = (event: { path: FabricObject }) => {
      if (modeRef.current === "erase") event.path.set({ globalCompositeOperation: "destination-out", selectable: false, evented: false });
      pushSnapshot();
    };
    instance.on("selection:created", syncSelection);
    instance.on("selection:updated", syncSelection);
    instance.on("selection:cleared", syncSelection);
    instance.on("path:created", onPath);
    const syncBaseTransform = (event: { target?: FabricObject }) => {
      if (event.target !== baseImage.current || !baseImage.current) return;
      syncRegionEffectTransforms(instance, baseImage.current);
      instance.requestRenderAll();
    };
    instance.on("object:moving", syncBaseTransform);
    instance.on("object:rotating", syncBaseTransform);
    instance.on("object:scaling", syncBaseTransform);
    instance.on("object:skewing", syncBaseTransform);
    instance.on("object:modified", (event) => { syncBaseTransform(event); pushSnapshot(); });
    instance.on("object:added", (event) => { if (event.target !== regionOverlay.current) pushSnapshot(); });
    instance.on("object:removed", (event) => { if (event.target !== regionOverlay.current) pushSnapshot(); });
    instance.on("mouse:down", (event) => {
      if (!isRegionMode(modeRef.current) || regionEffectBusyRef.current) return;
      const point = event.scenePoint;
      const x = Math.max(0, Math.min(instance.getWidth(), point.x));
      const y = Math.max(0, Math.min(instance.getHeight(), point.y));
      clearRegionSelection();
      regionOrigin.current = { x, y };
      const effectMode = modeRef.current === "effect";
      const overlay = new Rect({ left: x, top: y, width: 1, height: 1, fill: effectMode ? "rgba(175,82,222,.14)" : "rgba(10,132,255,.14)", stroke: effectMode ? "#af52de" : "#0a84ff", strokeWidth: 2, strokeDashArray: [9, 6], strokeUniform: true, selectable: false, evented: false, excludeFromExport: true });
      regionOverlay.current = overlay;
      instance.add(overlay);
      instance.requestRenderAll();
    });
    instance.on("mouse:move", (event) => {
      const origin = regionOrigin.current;
      const overlay = regionOverlay.current;
      if (!isRegionMode(modeRef.current) || !origin || !overlay) return;
      const x = Math.max(0, Math.min(instance.getWidth(), event.scenePoint.x));
      const y = Math.max(0, Math.min(instance.getHeight(), event.scenePoint.y));
      overlay.set({ left: Math.min(origin.x, x), top: Math.min(origin.y, y), width: Math.abs(x - origin.x), height: Math.abs(y - origin.y) });
      overlay.setCoords();
      instance.requestRenderAll();
    });
    instance.on("mouse:up", () => {
      const overlay = regionOverlay.current;
      regionOrigin.current = undefined;
      if (!overlay) return;
      const selection = { left: overlay.left || 0, top: overlay.top || 0, width: overlay.width || 0, height: overlay.height || 0 };
      if (selection.width < 10 || selection.height < 10) clearRegionSelection();
      else setRegionSelection(selection);
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
      instance.dispose();
      canvas.current = undefined;
    };
  }, [clearRegionSelection, pushSnapshot, syncCanvasDisplay, syncSelectedShape]);

  useEffect(() => {
    const instance = canvas.current;
    if (!instance) return;
    modeRef.current = mode;
    instance.isDrawingMode = mode === "pencil" || mode === "brush" || mode === "erase";
    instance.selection = mode === "select";
    applyEditorInteractivity(instance, baseImage.current, mode, baseLocked);
    if (mode !== "select") {
      const brush = new PencilBrush(instance);
      brush.color = mode === "erase" ? "rgba(0,0,0,1)" : drawColor;
      brush.width = mode === "brush" ? Math.max(10, drawWidth * 2.2) : mode === "erase" ? Math.max(12, drawWidth * 2.5) : drawWidth;
      instance.freeDrawingBrush = brush;
    }
    instance.discardActiveObject();
    instance.requestRenderAll();
  }, [baseLocked, drawColor, drawWidth, mode]);

  useEffect(() => {
    if (!isRegionMode(mode)) clearRegionSelection();
  }, [clearRegionSelection, mode]);

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
      setMode("select");
      modeRef.current = "select";
      applyEditorInteractivity(instance, image, "select", true);
      instance.requestRenderAll();
      syncSelectedShape();
      restoringRef.current = false;
      pushSnapshot(true, true);
      window.requestAnimationFrame(syncCanvasDisplay);
    } catch (error) {
      restoringRef.current = false;
      URL.revokeObjectURL(url);
      setEditorError(error instanceof Error ? error.message : t("image.common.failed"));
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
    instance.backgroundColor = transparentBackground ? "" : background;
    baseImage.current = undefined;
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    sourceUrl.current = undefined;
    setFile(undefined);
    outputMultiplier.current = 1;
    setEditorError("");
    setBrightness(0); setContrast(0); setHue(0); setBaseLocked(true); setMode("select");
    modeRef.current = "select";
    editorSettings.current = { ...editorSettings.current, brightness: 0, contrast: 0, hue: 0, baseLocked: true };
    instance.requestRenderAll();
    syncSelectedShape();
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
    pushSnapshot();
  };

  const removeSelectedLayers = useCallback(() => {
    const instance = canvas.current;
    if (!instance) return false;
    const removable = instance.getActiveObjects().filter((object) => object !== baseImage.current);
    if (!removable.length) return false;
    instance.remove(...removable);
    instance.discardActiveObject();
    syncSelectedShape();
    instance.requestRenderAll();
    pushSnapshot();
    return true;
  }, [pushSnapshot, syncSelectedShape]);

  const applyCropSelection = useCallback(() => {
    const instance = canvas.current;
    const selection = regionSelection;
    const overlay = regionOverlay.current;
    if (!instance || !selection || selection.width < 10 || selection.height < 10) return;
    restoringRef.current = true;
    if (overlay) instance.remove(overlay);
    regionOverlay.current = undefined;
    regionOrigin.current = undefined;
    instance.getObjects().forEach((object) => {
      object.set({ left: (object.left || 0) - selection.left, top: (object.top || 0) - selection.top });
      object.setCoords();
    });
    instance.setDimensions({ width: Math.max(1, Math.round(selection.width)), height: Math.max(1, Math.round(selection.height)) });
    instance.discardActiveObject();
    setRegionSelection(undefined);
    setMode("select");
    modeRef.current = "select";
    applyEditorInteractivity(instance, baseImage.current, "select", baseLocked);
    instance.requestRenderAll();
    syncSelectedShape();
    restoringRef.current = false;
    pushSnapshot(true);
    window.requestAnimationFrame(syncCanvasDisplay);
  }, [baseLocked, pushSnapshot, regionSelection, syncCanvasDisplay, syncSelectedShape]);

  const applyRegionEffect = useCallback(async () => {
    const instance = canvas.current;
    const image = baseImage.current;
    const selection = regionSelection;
    const overlay = regionOverlay.current;
    if (!instance || !image || !file || !selection || selection.width < 10 || selection.height < 10 || regionEffectBusyRef.current) return;
    regionEffectBusyRef.current = true;
    setRegionEffectBusy(true);
    setEditorError("");
    if (overlay) instance.remove(overlay);
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
      clearRegionSelection();
      instance.discardActiveObject();
      setMode("select");
      modeRef.current = "select";
      applyEditorInteractivity(instance, image, "select", baseLocked);
      instance.requestRenderAll();
      syncSelectedShape();
      restoringRef.current = false;
      pushSnapshot(true);
    } catch {
      if (effectImage && instance.getObjects().includes(effectImage)) instance.remove(effectImage);
      if (effectUrl) {
        regionEffectUrls.current.delete(effectUrl);
        URL.revokeObjectURL(effectUrl);
      }
      if (overlay && !instance.getObjects().includes(overlay)) instance.add(overlay);
      regionOverlay.current = overlay;
      setEditorError(t("image.editor.effectError"));
      instance.requestRenderAll();
    } finally {
      restoringRef.current = false;
      regionEffectBusyRef.current = false;
      setRegionEffectBusy(false);
    }
  }, [baseLocked, clearRegionSelection, file, pushSnapshot, regionEffect, regionEffectStrength, regionSelection, syncSelectedShape, t]);

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (isRegionMode(modeRef.current) && event.key === "Escape") {
        event.preventDefault();
        clearRegionSelection();
        setMode("select");
        return;
      }
      if (modeRef.current === "crop" && event.key === "Enter" && regionOverlay.current) {
        event.preventDefault();
        applyCropSelection();
        return;
      }
      if (modeRef.current === "effect" && event.key === "Enter" && regionOverlay.current) {
        event.preventDefault();
        void applyRegionEffect();
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (removeSelectedLayers()) event.preventDefault();
    };
    document.addEventListener("keydown", handleEditorShortcut);
    return () => document.removeEventListener("keydown", handleEditorShortcut);
  }, [applyCropSelection, applyRegionEffect, clearRegionSelection, removeSelectedLayers]);

  const cropTo = (ratio: number) => {
    const instance = canvas.current;
    const image = baseImage.current;
    if (!instance) return;
    const width = 900;
    const height = Math.round(width / ratio);
    const previousWidth = instance.getWidth();
    const previousHeight = instance.getHeight();
    clearRegionSelection();
    setMode("select");
    modeRef.current = "select";
    instance.setDimensions({ width, height });
    window.requestAnimationFrame(syncCanvasDisplay);
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
    setMode("select");
    modeRef.current = "select";
    instance.isDrawingMode = false;
    instance.add(object);
    instance.setActiveObject(object);
    syncSelectedShape(object);
    instance.requestRenderAll();
    pushSnapshot();
  };

  const addText = (value = text) => {
    if (!value.trim()) return;
    addObject(new IText(value, { left: 90, top: 90, fontFamily: "sans-serif", fontSize: 48, fontWeight: "700", fill: drawColor, stroke: "rgba(255,255,255,.55)", strokeWidth: 1 }));
  };

  const addShape = (kind: "line" | "rect" | "circle") => {
    if (kind === "line") addObject(new Line([130, 150, 430, 300], { stroke: drawColor, strokeWidth: drawWidth, strokeLineCap: "round" }));
    if (kind === "rect") addObject(new Rect({ left: 120, top: 120, width: 220, height: 140, rx: 24, ry: 24, fill: "#0a84ff", stroke: "#ffffff", strokeWidth: 0 }));
    if (kind === "circle") addObject(new Circle({ left: 120, top: 120, radius: 90, fill: "#ff375f", stroke: "#ffffff", strokeWidth: 0 }));
  };

  const setSelectedShapeStyle = (property: "fill" | "stroke" | "strokeWidth", value: string | number) => {
    mutateActive((object) => {
      if (object instanceof Rect || object instanceof Circle) object.set(property, value);
      if (object instanceof IText && property === "fill") object.set("fill", value);
      if (object instanceof Line && property !== "fill") object.set(property, value);
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
      applyEditorInteractivity(canvas.current, baseImage.current, modeRef.current, locked);
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
    syncSelectedShape();
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
      instance.setDimensions({ width: snapshot.width, height: snapshot.height });
      await instance.loadFromJSON(snapshot.canvas);
      baseImage.current = instance.getObjects().find((object): object is FabricImage => object instanceof FabricImage && (object as EditorFabricObject).worklazyRole === "base")
        ?? instance.getObjects().find((object): object is FabricImage => object instanceof FabricImage);
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
      applyEditorInteractivity(instance, baseImage.current, modeRef.current, snapshot.baseLocked);
      instance.discardActiveObject();
      instance.requestRenderAll();
      historyIndexRef.current = index;
      setHistoryState({ index, length: historyRef.current.length });
      syncSelectedShape();
      window.requestAnimationFrame(syncCanvasDisplay);
    } finally {
      window.clearTimeout(snapshotTimerRef.current);
      restoringRef.current = false;
    }
  };

  const exportImage = () => {
    const instance = canvas.current;
    if (!instance) return;
    const overlay = regionOverlay.current;
    if (baseImage.current) keepRegionEffectsAboveBase(instance, baseImage.current);
    if (overlay && instance.getObjects().includes(overlay)) instance.remove(overlay);
    try {
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
      if (overlay && regionOverlay.current === overlay && !instance.getObjects().includes(overlay)) instance.add(overlay);
      instance.requestRenderAll();
    }
  };

  return (
    <SectionCard title={t("image.editor.title")} description={t("image.editor.description")}>
      <FileDropZone files={file ? [file] : []} onFiles={(files) => void loadFile(filterRasterImages(files).at(-1))} accept={RASTER_IMAGE_ACCEPT} hint={t("image.editor.hint")} accent="sky" />
      {editorError && <p className="utility-error" role="alert">{editorError}</p>}
      <ClipboardHint mode="replace" />
      <div className="editor-source-actions"><button type="button" className="secondary-button" onClick={newBlankCanvas}><ImageIcon size={16} /> {t("image.editor.blank")}</button>{file && <span>{t("image.editor.editing", { name: file.name })}</span>}</div>
      <div className="editor-toolbar">
        <div className="editor-draw-tools" aria-label={t("image.editor.tools")}>
          <ToolButton active={mode === "select"} label={t("image.editor.select")} onClick={() => setMode("select")}><MousePointer2 /></ToolButton>
          <ToolButton active={mode === "pencil"} label={t("image.editor.pencil")} onClick={() => setMode("pencil")}><Pencil /></ToolButton>
          <ToolButton active={mode === "brush"} label={t("image.editor.brush")} onClick={() => setMode("brush")}><Brush /></ToolButton>
          <ToolButton active={mode === "erase"} label={t("image.editor.eraser")} onClick={() => setMode("erase")}><Eraser /></ToolButton>
          <ToolButton active={mode === "crop"} label={t("image.editor.cropDrag")} onClick={() => setMode("crop")}><Crop /></ToolButton>
          <ToolButton active={mode === "effect"} disabled={!file || regionEffectBusy} label={t("image.editor.effectTool")} onClick={() => setMode("effect")}><Grid3X3 /></ToolButton>
        </div>
        <label className="editor-draw-color"><span>{t("image.editor.color")}</span><input type="color" value={drawColor} onChange={(event) => setDrawColor(event.target.value)} /></label>
        <label className="editor-draw-width"><span>{t("image.editor.width", { count: drawWidth })}</span><input type="range" min={1} max={40} value={drawWidth} onChange={(event) => setDrawWidth(Number(event.target.value))} /></label>
        <div className="editor-history-actions"><button type="button" disabled={historyState.index <= 0} aria-label={t("image.editor.undo")} onClick={() => void restore(historyState.index - 1)}><Undo2 /></button><button type="button" disabled={historyState.index >= historyState.length - 1} aria-label={t("image.editor.redo")} onClick={() => void restore(historyState.index + 1)}><Redo2 /></button><button type="button" aria-label={t("image.editor.deleteObject")} onClick={removeSelectedLayers}><Trash2 /></button></div>
      </div>
      <div className="image-editor-layout">
        <aside className="image-editor-controls">
          <div className="editor-tool-group"><strong>{t("image.editor.crop")}</strong><div className="button-grid"><button type="button" onClick={() => cropTo(1)}>1:1</button><button type="button" onClick={() => cropTo(4 / 3)}>4:3</button><button type="button" onClick={() => cropTo(3 / 4)}>3:4</button><button type="button" onClick={() => cropTo(16 / 9)}>16:9</button><button type="button" onClick={() => cropTo(9 / 16)}>9:16</button></div><p className="image-crop-hint">{t("image.editor.cropHint")}</p>{mode === "crop" && regionSelection && <div className="image-crop-selection-status"><span>{t("image.editor.cropSelection", { width: Math.round(regionSelection.width), height: Math.round(regionSelection.height) })}</span><div><button type="button" className="secondary-button" onClick={() => { clearRegionSelection(); setMode("select"); }}>{t("image.editor.cropCancel")}</button><button type="button" className="primary-button" onClick={applyCropSelection}>{t("image.editor.cropApply")}</button></div></div>}</div>
          <div className={`editor-tool-group region-effect-controls${file ? "" : " is-disabled"}`}><strong>{t("image.editor.effectTitle")}</strong><div className="button-grid region-effect-options"><button type="button" className={regionEffect === "mosaic" ? "active" : ""} aria-pressed={regionEffect === "mosaic"} disabled={!file || regionEffectBusy} onClick={() => setRegionEffect("mosaic")}>{t("image.editor.mosaic")}</button><button type="button" className={regionEffect === "blur" ? "active" : ""} aria-pressed={regionEffect === "blur"} disabled={!file || regionEffectBusy} onClick={() => { setRegionEffect("blur"); setRegionEffectStrength((current) => Math.max(10, current)); }}>{t("image.editor.blur")}</button></div><label>{t("image.editor.effectStrength")} <b>{regionEffectStrength}</b><input aria-label={t("image.editor.effectStrength")} disabled={!file || regionEffectBusy} type="range" min={regionEffect === "blur" ? 10 : 4} max={40} step={1} value={regionEffectStrength} onChange={(event) => setRegionEffectStrength(Number(event.target.value))} /></label><p className="image-crop-hint">{t("image.editor.effectHint")}</p>{mode === "effect" && regionSelection && <div className="image-crop-selection-status region-effect-selection"><span>{t("image.editor.cropSelection", { width: Math.round(regionSelection.width), height: Math.round(regionSelection.height) })}</span><div><button type="button" className="secondary-button" disabled={regionEffectBusy} onClick={() => { clearRegionSelection(); setMode("select"); }}>{t("image.editor.cropCancel")}</button><button type="button" className="primary-button" disabled={regionEffectBusy} onClick={() => void applyRegionEffect()}>{regionEffectBusy ? t("image.editor.effectBusy") : t(regionEffect === "mosaic" ? "image.editor.applyMosaic" : "image.editor.applyBlur")}</button></div></div>}</div>
          <div className="editor-tool-group"><strong>{t("image.editor.layer")}</strong><div className="icon-tool-row"><button title={t("image.editor.rotate")} aria-label={t("image.editor.rotate")} type="button" onClick={() => mutateActive((object) => object.rotate((object.angle || 0) + 90))}><RotateCw size={18} /></button><button title={t("image.editor.flipH")} aria-label={t("image.editor.flipH")} type="button" onClick={() => mutateActive((object) => object.set("flipX", !object.flipX))}><FlipHorizontal2 size={18} /></button><button title={t("image.editor.flipV")} aria-label={t("image.editor.flipV")} type="button" onClick={() => mutateActive((object) => object.set("flipY", !object.flipY))}><FlipVertical2 size={18} /></button><button title={t("image.editor.front")} aria-label={t("image.editor.front")} type="button" onClick={() => mutateActive((object) => canvas.current?.bringObjectToFront(object))}><ArrowUpToLine size={18} /></button><button title={t("image.editor.back")} aria-label={t("image.editor.back")} type="button" onClick={() => mutateActive((object) => canvas.current?.sendObjectToBack(object))}><ArrowDownToLine size={18} /></button><button title={t("image.editor.duplicate")} aria-label={t("image.editor.duplicate")} type="button" onClick={() => void duplicateSelectedLayer()}><ClipboardPaste size={18} /></button><button title={t("image.editor.delete")} aria-label={t("image.editor.delete")} type="button" onClick={removeSelectedLayers}><Trash2 size={18} /></button></div></div>
          <div className={`editor-tool-group${file ? "" : " is-disabled"}`}><strong>{t("image.editor.adjust")}</strong><label>{t("image.editor.brightness")} <b>{brightness}</b><input disabled={!file} type="range" min={-80} max={80} value={brightness} onChange={(event) => updateFilter("brightness", Number(event.target.value))} /></label><label>{t("image.editor.contrast")} <b>{contrast}</b><input disabled={!file} type="range" min={-80} max={80} value={contrast} onChange={(event) => updateFilter("contrast", Number(event.target.value))} /></label><label>{t("image.editor.hue")} <b>{hue}°</b><input disabled={!file} type="range" min={-180} max={180} value={hue} onChange={(event) => updateFilter("hue", Number(event.target.value))} /></label>{file && <ToggleRow label={t("image.editor.lock")} description={t("image.editor.lockHelp")} checked={baseLocked} onChange={updateBaseLock} />}</div>
          <div className="editor-tool-group"><strong>{t("image.editor.text")}</strong><div className="inline-input-action"><input value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => addText()}><Type size={16} /></button></div><div className="button-grid sticker-grid">{["✨", "✅", "❤️", "📌"].map((emoji) => <button type="button" key={emoji} onClick={() => addText(emoji)}>{emoji}</button>)}</div></div>
          <div className="editor-tool-group"><strong>{t("image.editor.shapes")}</strong><div className="icon-tool-row"><button title={t("image.editor.line")} aria-label={t("image.editor.line")} type="button" onClick={() => addShape("line")}><Minus size={18} /></button><button title={t("image.editor.rect")} aria-label={t("image.editor.rect")} type="button" onClick={() => addShape("rect")}><Square size={18} /></button><button title={t("image.editor.circle")} aria-label={t("image.editor.circle")} type="button" onClick={() => addShape("circle")}><CircleIcon size={18} /></button></div></div>
          <div className={`editor-tool-group shape-style-controls${shapeSelected ? "" : " is-disabled"}`}><strong>{t("image.editor.shapeStyle")}</strong><label><span>{t("image.editor.fill")}</span><input aria-label={t("image.editor.fillLabel")} type="color" value={shapeFill} disabled={!shapeSelected} onChange={(event) => { setShapeFill(event.target.value); setSelectedShapeStyle("fill", event.target.value); }} /></label><label><span>{t("image.editor.stroke")}</span><input aria-label={t("image.editor.strokeLabel")} type="color" value={shapeStroke} disabled={!shapeSelected} onChange={(event) => { setShapeStroke(event.target.value); setSelectedShapeStyle("stroke", event.target.value); }} /></label><label><span>{t("image.editor.strokeWidth", { count: shapeStrokeWidth })}</span><input aria-label={t("image.editor.strokeWidthLabel")} type="range" min={0} max={30} step={1} value={shapeStrokeWidth} disabled={!shapeSelected} onChange={(event) => { const value = Number(event.target.value); setShapeStrokeWidth(value); setSelectedShapeStyle("strokeWidth", value); }} /></label>{!shapeSelected && <small>{t("image.editor.selectShape")}</small>}</div>
          <div className="editor-tool-group editor-background-control"><strong>{t("image.editor.backgroundGroup")}</strong><label><span>{t("image.editor.background")}</span><input type="color" value={background} disabled={transparentBackground} onChange={(event) => updateBackground(event.target.value, transparentBackground)} /></label><div className="image-background-options compact"><ToggleRow label={t("image.editor.transparent")} description={t("image.editor.transparentOutput")} checked={transparentBackground} onChange={(checked) => updateBackground(background, checked)} /></div><button type="button" className="secondary-button" onClick={clearAddedLayers}><Trash2 size={15} /> {t("image.editor.clearLayers")}</button></div>
        </aside>
        <div
          ref={stageElement}
          className={`fabric-stage image-preview-drop${stageDragging ? " is-file-dragging" : ""}${mode === "crop" ? " is-crop-mode" : mode === "effect" ? " is-effect-mode" : ""}`}
          onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setStageDragging(true); } }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setStageDragging(true); } }}
          onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setStageDragging(false); }}
          onDrop={dropOnPreview}
        ><canvas ref={canvasElement} />{stageDragging && <span className="image-preview-drop-hint">{t("image.editor.drop")}</span>}</div>
      </div>
      <div className="export-row"><div className="image-format-control"><SegmentedControl value={format} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} onChange={setFormat} label={t("image.editor.format")} /><small>{t("image.editor.formatHelp")}</small></div><PrimaryButton accent="sky" onClick={exportImage}><Download size={18} /> {t("image.editor.download")}</PrimaryButton></div>
    </SectionCard>
  );
}

function applyEditorInteractivity(instance: Canvas, image: FabricImage | undefined, mode: EditorMode, baseLocked: boolean) {
  instance.forEachObject((object) => {
    const eraserPath = object.globalCompositeOperation === "destination-out";
    const fixedEffect = (object as EditorFabricObject).worklazyRole === "region-effect";
    const interactive = mode === "select" && !eraserPath && !fixedEffect && (object !== image || !baseLocked);
    object.set({ selectable: interactive, evented: interactive });
  });
}

function isRegionMode(mode: EditorMode) {
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

function ToolButton({ active, disabled = false, label, onClick, children }: { active: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" className={active ? "active" : ""} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}<span>{label}</span></button>; }

function useResponsiveFabricCanvas(canvasRef: React.MutableRefObject<Canvas | undefined>, stageRef: React.RefObject<HTMLDivElement | null>) {
  const sync = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const style = getComputedStyle(stage);
    const availableWidth = Math.max(1, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    const scale = Math.min(1, availableWidth / canvas.getWidth());
    canvas.setDimensions({ width: `${Math.round(canvas.getWidth() * scale)}px`, height: `${Math.round(canvas.getHeight() * scale)}px` }, { cssOnly: true });
    canvas.calcOffset();
  }, [canvasRef, stageRef]);

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

function fabricColorToHex(value: FabricObject["fill"] | FabricObject["stroke"], fallback: string) {
  if (typeof value !== "string") return fallback;
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map((part) => part + part).join("")}`.toLowerCase();
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("")}`;
}

function stripExtension(name: string) { return name.replace(/\.[^.]+$/, ""); }
