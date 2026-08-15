import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, Brush, CircleIcon, ClipboardPaste, Download, Eraser, FlipHorizontal2, FlipVertical2, ImageIcon, Images, LayoutGrid, Minus, MousePointer2, Pencil, Redo2, RotateCw, Sparkles, Square, Trash2, Type, Undo2 } from "lucide-react";
import type { TFunction } from "i18next";
import { Canvas, Circle, FabricImage, IText, Line, PencilBrush, Rect, filters, type FabricObject } from "fabric";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, FileList, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { batchProcessImages, buildAnimatedGif, buildCollage, serializeWatermark } from "./imageWorkerClient";
import { calculateCollageLayout, CollageLayoutError } from "./collageLayout";
import type { CollageOptions, ImageOutputFormat, WatermarkPosition } from "./types";

type StudioTab = "editor" | "batch" | "collage" | "gif";
const RASTER_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

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

type EditorMode = "select" | "pencil" | "brush" | "erase";

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
    };
    window.clearTimeout(snapshotTimerRef.current);
    if (immediate) save();
    else snapshotTimerRef.current = window.setTimeout(save, 80);
  }, []);

  const syncSelectedShape = useCallback((object?: FabricObject) => {
    const shape = object instanceof Rect || object instanceof Circle || object instanceof Line || object instanceof IText ? object : undefined;
    setShapeSelected(Boolean(shape));
    if (!shape) return;
    setShapeFill(fabricColorToHex(shape.fill, "#0a84ff"));
    setShapeStroke(fabricColorToHex(shape.stroke, "#ffffff"));
    setShapeStrokeWidth(Math.max(0, Math.round(shape.strokeWidth || 0)));
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
    instance.on("object:modified", () => pushSnapshot());
    instance.on("object:added", () => pushSnapshot());
    instance.on("object:removed", () => pushSnapshot());
    pushSnapshot(true, true);
    window.requestAnimationFrame(syncCanvasDisplay);
    return () => {
      window.clearTimeout(snapshotTimerRef.current);
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      sourceUrl.current = undefined;
      baseImage.current = undefined;
      instance.dispose();
      canvas.current = undefined;
    };
  }, [pushSnapshot, syncCanvasDisplay, syncSelectedShape]);

  useEffect(() => {
    const instance = canvas.current;
    if (!instance) return;
    modeRef.current = mode;
    instance.isDrawingMode = mode !== "select";
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

  const loadFile = async (next?: File) => {
    if (!next || !canvas.current) return;
    const url = URL.createObjectURL(next);
    try {
      const image = await FabricImage.fromURL(url);
      const instance = canvas.current;
      restoringRef.current = true;
      instance.clear();
      instance.backgroundColor = transparentBackground ? "" : background;
      instance.setDimensions({ width: 900, height: 600 });
      const scale = Math.min(1, 860 / image.width, 560 / image.height);
      outputMultiplier.current = Math.max(1, 1 / scale);
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

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (removeSelectedLayers()) event.preventDefault();
    };
    document.addEventListener("keydown", handleDelete);
    return () => document.removeEventListener("keydown", handleDelete);
  }, [removeSelectedLayers]);

  const cropTo = (ratio: number) => {
    const instance = canvas.current;
    const image = baseImage.current;
    if (!instance) return;
    const width = 900;
    const height = Math.round(width / ratio);
    const previousWidth = instance.getWidth();
    const previousHeight = instance.getHeight();
    instance.setDimensions({ width, height });
    window.requestAnimationFrame(syncCanvasDisplay);
    if (image) {
      const scale = Math.max(width / image.width, height / image.height);
      image.set({ left: width / 2, top: height / 2, scaleX: scale, scaleY: scale });
      image.setCoords();
    }
    instance.getObjects().filter((object) => object !== image).forEach((object) => {
      object.set({ left: (object.left || 0) * width / previousWidth, top: (object.top || 0) * height / previousHeight });
      object.setCoords();
    });
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
    const removable = instance.getObjects().filter((object) => object !== baseImage.current);
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
      baseImage.current = instance.getObjects().find((object): object is FabricImage => object instanceof FabricImage);
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
    instance.renderAll();
    const multiplier = outputMultiplier.current;
    let dataUrl: string;
    if (format === "jpeg") {
      const flattened = document.createElement("canvas");
      flattened.width = Math.round(instance.getWidth() * multiplier);
      flattened.height = Math.round(instance.getHeight() * multiplier);
      const context = flattened.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, flattened.width, flattened.height);
      context.drawImage(instance.getElement(), 0, 0, flattened.width, flattened.height);
      dataUrl = flattened.toDataURL("image/jpeg", 0.92);
      flattened.width = 1; flattened.height = 1;
    } else dataUrl = instance.toDataURL({ format, quality: 0.92, multiplier });
    const actualFormat = dataUrl.startsWith("data:image/png") ? "png" : dataUrl.startsWith("data:image/webp") ? "webp" : "jpeg";
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${file ? stripExtension(file.name) : "worklazy-image"}-${t("image.editor.suffix")}.${actualFormat === "jpeg" ? "jpg" : actualFormat}`;
    anchor.click();
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
        </div>
        <label className="editor-draw-color"><span>{t("image.editor.color")}</span><input type="color" value={drawColor} onChange={(event) => setDrawColor(event.target.value)} /></label>
        <label className="editor-draw-width"><span>{t("image.editor.width", { count: drawWidth })}</span><input type="range" min={1} max={40} value={drawWidth} onChange={(event) => setDrawWidth(Number(event.target.value))} /></label>
        <div className="editor-history-actions"><button type="button" disabled={historyState.index <= 0} aria-label={t("image.editor.undo")} onClick={() => void restore(historyState.index - 1)}><Undo2 /></button><button type="button" disabled={historyState.index >= historyState.length - 1} aria-label={t("image.editor.redo")} onClick={() => void restore(historyState.index + 1)}><Redo2 /></button><button type="button" aria-label={t("image.editor.deleteObject")} onClick={removeSelectedLayers}><Trash2 /></button></div>
      </div>
      <div className="image-editor-layout">
        <aside className="image-editor-controls">
          <div className="editor-tool-group"><strong>{t("image.editor.crop")}</strong><div className="button-grid"><button type="button" onClick={() => cropTo(1)}>1:1</button><button type="button" onClick={() => cropTo(4 / 3)}>4:3</button><button type="button" onClick={() => cropTo(3 / 4)}>3:4</button><button type="button" onClick={() => cropTo(16 / 9)}>16:9</button><button type="button" onClick={() => cropTo(9 / 16)}>9:16</button></div></div>
          <div className="editor-tool-group"><strong>{t("image.editor.layer")}</strong><div className="icon-tool-row"><button title={t("image.editor.rotate")} aria-label={t("image.editor.rotate")} type="button" onClick={() => mutateActive((object) => object.rotate((object.angle || 0) + 90))}><RotateCw size={18} /></button><button title={t("image.editor.flipH")} aria-label={t("image.editor.flipH")} type="button" onClick={() => mutateActive((object) => object.set("flipX", !object.flipX))}><FlipHorizontal2 size={18} /></button><button title={t("image.editor.flipV")} aria-label={t("image.editor.flipV")} type="button" onClick={() => mutateActive((object) => object.set("flipY", !object.flipY))}><FlipVertical2 size={18} /></button><button title={t("image.editor.front")} aria-label={t("image.editor.front")} type="button" onClick={() => mutateActive((object) => canvas.current?.bringObjectToFront(object))}><ArrowUpToLine size={18} /></button><button title={t("image.editor.back")} aria-label={t("image.editor.back")} type="button" onClick={() => mutateActive((object) => canvas.current?.sendObjectToBack(object))}><ArrowDownToLine size={18} /></button><button title={t("image.editor.duplicate", { defaultValue: "선택 레이어 복제" })} aria-label={t("image.editor.duplicate", { defaultValue: "선택 레이어 복제" })} type="button" onClick={() => void duplicateSelectedLayer()}><ClipboardPaste size={18} /></button><button title={t("image.editor.delete")} aria-label={t("image.editor.delete")} type="button" onClick={removeSelectedLayers}><Trash2 size={18} /></button></div></div>
          <div className={`editor-tool-group${file ? "" : " is-disabled"}`}><strong>{t("image.editor.adjust")}</strong><label>{t("image.editor.brightness")} <b>{brightness}</b><input disabled={!file} type="range" min={-80} max={80} value={brightness} onChange={(event) => updateFilter("brightness", Number(event.target.value))} /></label><label>{t("image.editor.contrast")} <b>{contrast}</b><input disabled={!file} type="range" min={-80} max={80} value={contrast} onChange={(event) => updateFilter("contrast", Number(event.target.value))} /></label><label>{t("image.editor.hue")} <b>{hue}°</b><input disabled={!file} type="range" min={-180} max={180} value={hue} onChange={(event) => updateFilter("hue", Number(event.target.value))} /></label>{file && <ToggleRow label={t("image.editor.lock")} description={t("image.editor.lockHelp")} checked={baseLocked} onChange={updateBaseLock} />}</div>
          <div className="editor-tool-group"><strong>{t("image.editor.text")}</strong><div className="inline-input-action"><input value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => addText()}><Type size={16} /></button></div><div className="button-grid sticker-grid">{["✨", "✅", "❤️", "📌"].map((emoji) => <button type="button" key={emoji} onClick={() => addText(emoji)}>{emoji}</button>)}</div></div>
          <div className="editor-tool-group"><strong>{t("image.editor.shapes")}</strong><div className="icon-tool-row"><button title={t("image.editor.line")} aria-label={t("image.editor.line")} type="button" onClick={() => addShape("line")}><Minus size={18} /></button><button title={t("image.editor.rect")} aria-label={t("image.editor.rect")} type="button" onClick={() => addShape("rect")}><Square size={18} /></button><button title={t("image.editor.circle")} aria-label={t("image.editor.circle")} type="button" onClick={() => addShape("circle")}><CircleIcon size={18} /></button></div></div>
          <div className={`editor-tool-group shape-style-controls${shapeSelected ? "" : " is-disabled"}`}><strong>{t("image.editor.shapeStyle")}</strong><label><span>{t("image.editor.fill")}</span><input aria-label={t("image.editor.fillLabel")} type="color" value={shapeFill} disabled={!shapeSelected} onChange={(event) => { setShapeFill(event.target.value); setSelectedShapeStyle("fill", event.target.value); }} /></label><label><span>{t("image.editor.stroke")}</span><input aria-label={t("image.editor.strokeLabel")} type="color" value={shapeStroke} disabled={!shapeSelected} onChange={(event) => { setShapeStroke(event.target.value); setSelectedShapeStyle("stroke", event.target.value); }} /></label><label><span>{t("image.editor.strokeWidth", { count: shapeStrokeWidth })}</span><input aria-label={t("image.editor.strokeWidthLabel")} type="range" min={0} max={30} step={1} value={shapeStrokeWidth} disabled={!shapeSelected} onChange={(event) => { const value = Number(event.target.value); setShapeStrokeWidth(value); setSelectedShapeStyle("strokeWidth", value); }} /></label>{!shapeSelected && <small>{t("image.editor.selectShape")}</small>}</div>
          <div className="editor-tool-group editor-background-control"><strong>{t("image.editor.backgroundGroup")}</strong><label><span>{t("image.editor.background")}</span><input type="color" value={background} disabled={transparentBackground} onChange={(event) => updateBackground(event.target.value, transparentBackground)} /></label><div className="image-background-options compact"><ToggleRow label={t("image.editor.transparent")} description={t("image.editor.transparentOutput")} checked={transparentBackground} onChange={(checked) => updateBackground(background, checked)} /></div><button type="button" className="secondary-button" onClick={clearAddedLayers}><Trash2 size={15} /> {t("image.editor.clearLayers")}</button></div>
        </aside>
        <div
          ref={stageElement}
          className={`fabric-stage image-preview-drop${stageDragging ? " is-file-dragging" : ""}`}
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
    const interactive = mode === "select" && !eraserPath && (object !== image || !baseLocked);
    object.set({ selectable: interactive, evented: interactive });
  });
}

function BatchImagePanel({ progress, controllerRef }: ProcessPanelProps) {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"fit-width" | "contain" | "cover" | "original">("fit-width");
  const [width, setWidth] = useState(1600);
  const [height, setHeight] = useState(1200);
  const [format, setFormat] = useState<ImageOutputFormat>("jpeg");
  const [quality, setQuality] = useState(0.9);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkFile, setWatermarkFile] = useState<File>();
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.7);

  useClipboardImages((images) => setFiles((current) => [...current, ...images]));

  const execute = async () => {
    if (!files.length) return;
    const controller = new AbortController(); controllerRef.current = controller;
    progress.start(t("image.batch.prepare"));
    try {
      const watermarkImage = await serializeWatermark(watermarkFile);
      const result = await batchProcessImages(files, { mode, width, height, format, quality, background: transparentBackground ? "transparent" : "#ffffff", watermarkText, watermarkPosition, watermarkOpacity, watermarkImage }, t("image.batch.archive"), progress.update, controller.signal, i18n.language === "en" ? "en" : "ko");
      downloadWorkerResult(result);
      progress.succeed(t("image.batch.done", { count: files.length }));
    } catch (error) { progress.fail(normalizePanelError(error, t)); }
    finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
  };

  return <SectionCard title={t("image.batch.title")} description={t("image.batch.description")}>
    <FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint={t("image.batch.hint")} accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" />
    <div className="image-settings-grid"><label><span>{t("image.batch.resize")}</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="fit-width">{t("image.batch.fitWidth")}</option><option value="contain">{t("image.batch.contain")}</option><option value="cover">{t("image.batch.cover")}</option><option value="original">{t("image.batch.original")}</option></select></label><NumberField label={t("image.batch.width")} value={width} onChange={setWidth} /><NumberField label={t("image.batch.height")} value={height} onChange={setHeight} disabled={mode === "fit-width" || mode === "original"} /><FormatField value={format} onChange={setFormat} /><RangeField label={t("image.batch.quality")} value={quality} min={0.4} max={1} step={0.05} onChange={setQuality} /></div>
    <TransparencyControl checked={transparentBackground} onChange={setTransparentBackground} format={format} />
    <div className="watermark-settings"><label><span>{t("image.batch.watermarkText")}</span><input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} placeholder={t("image.batch.watermarkPlaceholder")} /></label><label><span>{t("image.batch.watermarkImage")}</span><input type="file" accept={RASTER_IMAGE_ACCEPT} onChange={(event) => setWatermarkFile(filterRasterImages(Array.from(event.target.files || []))[0])} /></label><label><span>{t("image.batch.position")}</span><select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value as WatermarkPosition)}><option value="top-left">{t("image.batch.topLeft")}</option><option value="top-right">{t("image.batch.topRight")}</option><option value="center">{t("image.batch.center")}</option><option value="bottom-left">{t("image.batch.bottomLeft")}</option><option value="bottom-right">{t("image.batch.bottomRight")}</option></select></label><RangeField label={t("image.batch.opacity")} value={watermarkOpacity} min={0.1} max={1} step={0.05} onChange={setWatermarkOpacity} /></div>
    <div className="section-actions"><PrimaryButton accent="sky" disabled={!files.length} loading={progress.status === "running"} onClick={() => void execute()}><Download size={18} /> {t("image.batch.download")}</PrimaryButton></div>
  </SectionCard>;
}

function CollagePanel({ progress, controllerRef }: ProcessPanelProps) {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [layout, setLayout] = useState<CollageOptions["layout"]>("vertical");
  const [columns, setColumns] = useState(2);
  const [width, setWidth] = useState(1600);
  const [gap, setGap] = useState(16);
  const [background, setBackground] = useState("#ffffff");
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  useClipboardImages((images) => setFiles((current) => [...current, ...images]));
  const outputBackground = transparentBackground ? "transparent" : background;
  const language = i18n.language === "en" ? "en" : "ko";
  const execute = async () => runPanelTask(controllerRef, progress, async (controller) => buildCollage(files, { layout, columns, width, gap, background: outputBackground, format, quality: 0.92 }, t("image.collage.file"), progress.update, controller.signal, language), t("image.collage.done"), t);
  return <SectionCard title={t("image.collage.title")} description={t("image.collage.description")}><FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint={t("image.collage.hint")} accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" /><div className="image-settings-grid"><label><span>{t("image.collage.layout")}</span><select value={layout} onChange={(event) => setLayout(event.target.value as CollageOptions["layout"])}><option value="vertical">{t("image.collage.vertical")}</option><option value="horizontal">{t("image.collage.horizontal")}</option><option value="grid">{t("image.collage.grid")}</option></select></label><NumberField label={t("image.collage.columns")} value={columns} onChange={setColumns} disabled={layout !== "grid"} /><NumberField label={t("image.collage.width")} value={width} onChange={setWidth} /><NumberField label={t("image.collage.gap")} value={gap} min={0} onChange={setGap} /><label><span>{t("image.collage.background")}</span><input type="color" value={background} disabled={transparentBackground} onChange={(event) => setBackground(event.target.value)} /></label><FormatField value={format} onChange={setFormat} /></div><TransparencyControl checked={transparentBackground} onChange={setTransparentBackground} format={format} /><CollagePreview files={files} options={{ layout, columns, width, gap, background: outputBackground, format, quality: 0.92 }} onFiles={(incoming) => setFiles((current) => [...current, ...incoming])} /><div className="section-actions"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><LayoutGrid size={18} /> {t("image.collage.download")}</PrimaryButton></div></SectionCard>;
}

function CollagePreview({ files, options, onFiles }: { files: File[]; options: CollageOptions; onFiles: (files: File[]) => void }) {
  const { t, i18n } = useTranslation("features");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState(() => t("image.collage.emptySummary"));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!files.length) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.style.width = "0";
        canvas.style.height = "0";
        setSummary(t("image.collage.emptySummary"));
        return;
      }

      const bitmaps: ImageBitmap[] = [];
      try {
        for (const file of files) bitmaps.push(await createImageBitmap(file));
        if (disposed) return;
        const layout = calculateCollageLayout(bitmaps, options);
        const scale = calculatePreviewScale(layout.width, layout.height);
        const displayWidth = Math.max(1, Math.round(layout.width * scale));
        const displayHeight = Math.max(1, Math.round(layout.height * scale));
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.max(1, Math.round(displayWidth * pixelRatio));
        canvas.height = Math.max(1, Math.round(displayHeight * pixelRatio));
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error(t("image.collage.canvasError"));
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.clearRect(0, 0, displayWidth, displayHeight);
        const previewBackground = options.format === "jpeg" ? "#ffffff" : options.background;
        if (previewBackground !== "transparent") {
          context.fillStyle = previewBackground;
          context.fillRect(0, 0, displayWidth, displayHeight);
        }
        bitmaps.forEach((bitmap, index) => {
          const cell = layout.cells[index];
          const draw = options.layout === "grid" ? drawCoveredPreview : drawContainedPreview;
          draw(context, bitmap, cell.x * scale, cell.y * scale, cell.width * scale, cell.height * scale);
        });
        setSummary(t("image.collage.summary", { width: layout.width.toLocaleString(i18n.language), height: layout.height.toLocaleString(i18n.language), count: files.length }));
      } catch (error) {
        if (!disposed) setSummary(error instanceof Error ? error.message : t("image.collage.previewError"));
      } finally {
        bitmaps.forEach((bitmap) => bitmap.close());
      }
    }, 120);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [files, i18n.language, options.background, options.columns, options.format, options.gap, options.layout, options.width, t]);

  return (
    <div className="collage-preview-panel">
      <div className="collage-preview-heading"><span><LayoutGrid size={17} /><strong>{t("image.collage.preview")}</strong></span><small>{summary}</small></div>
      <div
        className={`collage-preview-stage image-preview-drop${files.length ? " has-preview" : ""}${dragging ? " is-file-dragging" : ""}`}
        onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); } }}
        onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = filterRasterImages(Array.from(event.dataTransfer.files)); if (dropped.length) onFiles(dropped); }}
      >
        {!files.length && <span><ImageIcon size={24} />{t("image.collage.add")}</span>}
        <canvas ref={canvasRef} aria-label={t("image.collage.previewLabel")} />
        {dragging && <span className="image-preview-drop-hint">{t("image.collage.drop")}</span>}
      </div>
    </div>
  );
}

function GifPanel({ progress, controllerRef }: ProcessPanelProps) {
  const { t, i18n } = useTranslation("features");
  const [files, setFiles] = useState<File[]>([]);
  const [delays, setDelays] = useState<number[]>([]);
  const [width, setWidth] = useState(720);
  const [delay, setDelay] = useState(500);
  const [colors, setColors] = useState(192);
  const [preview, setPreview] = useState<{ url: string; fileName: string }>();
  const language = i18n.language === "en" ? "en" : "ko";
  const replaceFiles = useCallback((next: File[]) => {
    const filtered = filterRasterImages(next);
    setFiles(filtered);
    setDelays((current) => filtered.map((_, index) => Math.max(20, current[index] ?? delay)));
  }, [delay]);
  const appendFiles = useCallback((incoming: File[]) => {
    const filtered = filterRasterImages(incoming);
    if (!filtered.length) return;
    setFiles((current) => [...current, ...filtered]);
    setDelays((current) => [...current, ...filtered.map(() => Math.max(20, delay))]);
  }, [delay]);
  useClipboardImages(appendFiles);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const moveFrame = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return;
    setFiles((current) => moveItem(current, from, to));
    setDelays((current) => moveItem(current, from, to));
  };
  const removeFrame = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setDelays((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const execute = async () => {
    const controller = new AbortController(); controllerRef.current = controller; progress.start(t("image.batch.prepare"));
    try {
      const result = await buildAnimatedGif(files, { width, delay: Math.max(20, delay), delays: delays.map((value) => Math.max(20, value)), qualityColors: colors }, t("image.gif.file"), progress.update, controller.signal, language);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(new Blob([result.buffer], { type: result.mimeType })), fileName: result.fileName });
      progress.succeed(t("image.gif.done"));
    } catch (error) { progress.fail(normalizePanelError(error, t)); }
    finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
  };
  return <SectionCard title={t("image.gif.title")} description={t("image.gif.description")}>
    <FileDropZone files={files} onFiles={replaceFiles} accept={RASTER_IMAGE_ACCEPT} multiple hint={t("image.gif.hint")} accent="sky" />
    <ClipboardHint mode="append" />
    {!!files.length && <div className="gif-frame-list">{files.map((file, index) => <div className="gif-frame-row" key={`${file.name}-${file.lastModified}-${index}`}><span><b>{index + 1}</b>{file.name}</span><label>{t("image.gif.frameDelay")}<input type="number" min={20} step={10} value={delays[index] ?? delay} onChange={(event) => setDelays((current) => current.map((value, itemIndex) => itemIndex === index ? Math.max(20, Number(event.target.value) || 20) : value))} /></label><button type="button" disabled={index === 0} aria-label={t("image.gif.moveUp")} onClick={() => moveFrame(index, index - 1)}><ArrowUpToLine size={16} /></button><button type="button" disabled={index === files.length - 1} aria-label={t("image.gif.moveDown")} onClick={() => moveFrame(index, index + 1)}><ArrowDownToLine size={16} /></button><button type="button" aria-label={t("image.gif.remove")} onClick={() => removeFrame(index)}><Trash2 size={16} /></button></div>)}</div>}
    <div className="image-settings-grid"><NumberField label={t("image.gif.width")} value={width} onChange={setWidth} /><NumberField label={t("image.gif.delay")} value={delay} min={20} onChange={(value) => { setDelay(value); setDelays(files.map(() => value)); }} /><label><span>{t("image.gif.colors")}</span><select value={colors} onChange={(event) => setColors(Number(event.target.value))}><option value={128}>{t("image.gif.small")}</option><option value={192}>{t("image.gif.balanced")}</option><option value={256}>{t("image.gif.sharp")}</option></select></label></div>
    {preview && <div className="gif-result-preview"><img src={preview.url} alt={t("image.gif.previewAlt")} /><a className="result-download blue-download" href={preview.url} download={preview.fileName}><Download size={17} /> {t("image.gif.download")}</a></div>}
    <div className="section-actions"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><Sparkles size={18} /> {t("image.gif.create")}</PrimaryButton></div>
  </SectionCard>;
}

function ToolButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" className={active ? "active" : ""} aria-pressed={active} onClick={onClick}>{children}<span>{label}</span></button>; }

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

interface ProcessPanelProps { progress: ReturnType<typeof useOperationProgress>; controllerRef: React.MutableRefObject<AbortController | undefined>; }

async function runPanelTask(controllerRef: ProcessPanelProps["controllerRef"], progress: ProcessPanelProps["progress"], task: (controller: AbortController) => Promise<import("./types").ImageWorkerResult>, success: string, t: TFunction<"features">) {
  const controller = new AbortController(); controllerRef.current = controller; progress.start(t("image.batch.prepare"));
  try { const result = await task(controller); downloadWorkerResult(result); progress.succeed(success); }
  catch (error) { progress.fail(normalizePanelError(error, t)); }
  finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
}

function NumberField({ label, value, onChange, disabled = false, min = 1 }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number }) { return <label><span>{label}</span><input type="number" min={min} value={value} disabled={disabled} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></label>; }
function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) { return <label><span>{label} <b>{Math.round(value * 100)}%</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function FormatField({ value, onChange }: { value: ImageOutputFormat; onChange: (value: ImageOutputFormat) => void }) { const { t } = useTranslation("features"); return <label><span>{t("image.common.output")}</span><select value={value} onChange={(event) => onChange(event.target.value as ImageOutputFormat)}><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option></select></label>; }

function TransparencyControl({ checked, onChange, format }: { checked: boolean; onChange: (value: boolean) => void; format: ImageOutputFormat }) {
  const { t } = useTranslation("features");
  return <div className="image-background-options"><ToggleRow label={t("image.common.transparent")} description={t("image.common.transparentHelp")} checked={checked} onChange={onChange} /><p>{format === "jpeg" ? t("image.common.jpeg") : t("image.common.alpha")}</p></div>;
}

function ClipboardHint({ mode }: { mode: "replace" | "append" }) {
  const { t } = useTranslation("features");
  return <div className="clipboard-image-hint"><ClipboardPaste size={15} /><span>{t("image.common.clipboard", { action: mode === "replace" ? t("image.common.replace") : t("image.common.append") })}</span></div>;
}

function useClipboardImages(onImages: (files: File[]) => void) {
  const { t } = useTranslation("features");
  const callbackRef = useRef(onImages);
  useEffect(() => { callbackRef.current = onImages; }, [onImages]);
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
      const pasted = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === "file" && /^(?:image\/(?:png|jpeg|webp))$/i.test(item.type))
        .map((item, index) => item.getAsFile() ? clipboardFile(item.getAsFile() as File, index, t("image.common.clipboardPrefix")) : undefined)
        .filter((file): file is File => Boolean(file));
      if (!pasted.length) return;
      event.preventDefault();
      callbackRef.current(pasted);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [t]);
}

function clipboardFile(source: File, index: number, prefix: string) {
  const extension = source.type === "image/jpeg" ? "jpg" : source.type === "image/webp" ? "webp" : "png";
  return new File([source], `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${index + 1}.${extension}`, { type: source.type, lastModified: Date.now() });
}

function calculatePreviewScale(width: number, height: number) {
  const widthScale = Math.min(1, 820 / width);
  const heightScale = Math.min(1, 5_000 / height);
  const pixelScale = Math.min(1, Math.sqrt(6_000_000 / Math.max(1, width * height)));
  return Math.max(0.01, Math.min(widthScale, heightScale, pixelScale));
}

function drawContainedPreview(context: CanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawnWidth = bitmap.width * scale;
  const drawnHeight = bitmap.height * scale;
  context.drawImage(bitmap, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function drawCoveredPreview(context: CanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  const targetRatio = width / height;
  const sourceRatio = bitmap.width / bitmap.height;
  const sourceWidth = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
  const sourceHeight = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;
  context.drawImage(bitmap, (bitmap.width - sourceWidth) / 2, (bitmap.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height);
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
function filterRasterImages(files: File[]) { return files.filter((file) => /^(image\/(?:jpeg|png|webp))$/i.test(file.type) || /\.(?:jpe?g|png|webp)$/i.test(file.name)); }
function normalizePanelError(error: unknown, t: TFunction<"features">) {
  if (error instanceof DOMException && error.name === "AbortError") return t("image.common.cancelled");
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "COLLAGE_SIZE") return t("image.collage.sizeError");
  if (code === "COLLAGE_COLUMNS") return t("image.collage.columnError");
  if (error instanceof CollageLayoutError) return error.code === "COLLAGE_SIZE" ? t("image.collage.sizeError") : t("image.collage.columnError");
  return error instanceof Error && error.message ? error.message : t("image.common.failed");
}
function downloadWorkerResult(result: import("./types").ImageWorkerResult) { const url = URL.createObjectURL(new Blob([result.buffer], { type: result.mimeType })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 15_000); }
function moveItem<T>(items: T[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
