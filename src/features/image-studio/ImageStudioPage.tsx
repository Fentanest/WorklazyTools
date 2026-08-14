import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, Brush, CircleIcon, ClipboardPaste, Download, Eraser, FlipHorizontal2, FlipVertical2, ImageIcon, Images, LayoutGrid, Minus, MousePointer2, Pencil, Redo2, RotateCw, Sparkles, Square, Trash2, Type, Undo2 } from "lucide-react";
import { Canvas, Circle, FabricImage, FabricText, Line, PencilBrush, Rect, filters, type FabricObject } from "fabric";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, FileList, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { batchProcessImages, buildAnimatedGif, buildCollage, serializeWatermark } from "./imageWorkerClient";
import type { CollageOptions, ImageOutputFormat, WatermarkPosition } from "./types";

type StudioTab = "editor" | "batch" | "collage" | "gif";
const RASTER_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export function ImageStudioPage() {
  const [tab, setTab] = useState<StudioTab>("editor");
  const progress = useOperationProgress();
  const activeController = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => activeController.current?.abort(), []);

  return (
    <div className="page tool-page page-enter image-studio-page">
      <PageHeader eyebrow="IMAGE STUDIO" title="이미지 스튜디오" description="한 장을 꾸미거나 여러 이미지를 일괄 편집하고 콜라주·GIF로 저장하세요.">
        <PrivacyBanner compact />
      </PageHeader>
      <nav className="studio-tabs" aria-label="이미지 기능">
        {([
          ["editor", "이미지 편집", ImageIcon], ["batch", "일괄 편집", Images], ["collage", "이어붙이기·콜라주", LayoutGrid], ["gif", "GIF 만들기", Sparkles],
        ] as const).map(([value, label, Icon]) => <button type="button" className={tab === value ? "active" : ""} onClick={() => { setTab(value); progress.reset(); }} key={value}><Icon size={17} /><span>{label}</span></button>)}
      </nav>

      <div className="inline-notice warning image-format-notice"><AlertTriangle size={16} /><span>HEIC·HEIF 입력은 현재 지원하지 않습니다. iPhone 사진은 JPG·PNG·WebP로 변환하거나 ‘높은 호환성’ 형식으로 촬영한 파일을 사용해 주세요.</span></div>
      {(tab === "batch" || tab === "collage" || tab === "gif") && <div className="inline-notice warning image-worker-notice"><AlertTriangle size={16} /><span>이 탭은 브라우저의 고급 이미지 처리 기능(OffscreenCanvas)을 사용하므로 iOS 16.3 이하에서는 사용할 수 없습니다. iOS 16.4 이상 또는 최신 Android 브라우저가 필요합니다. 모바일에서 대형 이미지가 위험한 것은 아니지만 완성 이미지 크기를 약 1,600만 화소 이하로 맞추고 적은 파일부터 처리하면 메모리 부족으로 멈출 가능성을 줄일 수 있습니다.</span></div>}

      {tab === "editor" && <ImageEditor />}
      {tab === "batch" && <BatchImagePanel progress={progress} controllerRef={activeController} />}
      {tab === "collage" && <CollagePanel progress={progress} controllerRef={activeController} />}
      {tab === "gif" && <GifPanel progress={progress} controllerRef={activeController} />}

      <OperationProgress {...progress} accent="sky" title="이미지 처리 로그" />
      {progress.status === "running" && <div className="cancel-operation"><button className="secondary-button" type="button" onClick={() => activeController.current?.abort()}>작업 취소</button></div>}

      <ToolGuide
        title="브라우저 이미지 편집 안내"
        description="원본 이미지와 편집 결과는 외부 작업 서버로 업로드하지 않습니다. 한 장 편집은 화면에서, 일괄 작업은 브라우저의 별도 작업 공간에서 처리합니다."
        blocks={[
          { title: "통합 이미지 편집", paragraphs: ["사진을 열거나 빈 캔버스에서 시작해 자르기·밝기·대비·색조, 연필·붓·지우개, 텍스트·도형·이모지를 한 작업 기록 안에서 사용합니다. 원본 사진은 기본 잠금되어 실수로 이동하지 않습니다."] },
          { title: "일괄 처리", paragraphs: ["여러 파일과 클립보드 이미지를 한 목록에 추가할 수 있습니다. 크기 변경과 워터마크는 브라우저의 별도 작업 공간에서 한 장씩 처리하고 결과를 ZIP 파일로 묶습니다."] },
          { title: "콜라주와 GIF", paragraphs: ["이어붙이기는 배치·간격·배경색을 바꿀 때 실제 출력 계산과 같은 방식의 축소 미리보기를 갱신합니다. GIF는 256색 제한 때문에 사진의 미세한 색 변화가 단순화될 수 있습니다."] },
        ]}
        faq={[
          { question: "이미지가 서버로 전송되나요?", answer: "아니요. 이미지 파일은 현재 브라우저 메모리와 별도 작업 공간 안에서만 처리합니다." },
          { question: "원본 파일이 바뀌나요?", answer: "아니요. 원본은 읽기만 하며 모든 결과는 새 파일로 내려받습니다." },
          { question: "지원 형식은 무엇인가요?", answer: "JPG, PNG, WebP를 입력으로 사용합니다. HEIC·HEIF는 현재 지원하지 않습니다. 출력은 PNG, JPG, WebP와 애니메이션 GIF를 지원합니다." },
          { question: "투명 배경을 유지할 수 있나요?", answer: "네. 이미지 편집, 일괄 편집과 콜라주에서 투명 배경을 선택할 수 있습니다. PNG·WebP는 투명도를 유지하며 JPG로 저장하면 투명한 부분을 흰색으로 처리합니다." },
          { question: "대용량 이미지가 중단되는 이유는 무엇인가요?", answer: "브라우저와 기기에는 캔버스 최대 크기와 메모리 한도가 있습니다. 출력 크기나 파일 수를 줄이면 안정적으로 처리할 수 있습니다." },
        ]}
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
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const stageElement = useRef<HTMLDivElement>(null);
  const canvas = useRef<Canvas | undefined>(undefined);
  const baseImage = useRef<FabricImage | undefined>(undefined);
  const sourceUrl = useRef<string | undefined>(undefined);
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
    const shape = object instanceof Rect || object instanceof Circle ? object : undefined;
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
      const scale = Math.min(860 / image.width, 560 / image.height);
      image.set({ left: 450, top: 300, originX: "center", originY: "center", scaleX: scale, scaleY: scale, selectable: false, evented: false });
      baseImage.current = image;
      instance.add(image);
      instance.discardActiveObject();
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      sourceUrl.current = url;
      setFile(next);
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
      throw error;
    }
  };

  const newBlankCanvas = () => {
    const instance = canvas.current;
    if (!instance) return;
    if (instance.getObjects().length && !window.confirm("현재 편집 내용을 비우고 새 캔버스를 시작할까요?")) return;
    restoringRef.current = true;
    instance.clear();
    instance.setDimensions({ width: 900, height: 600 });
    instance.backgroundColor = transparentBackground ? "" : background;
    baseImage.current = undefined;
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    sourceUrl.current = undefined;
    setFile(undefined);
    setBrightness(0); setContrast(0); setHue(0); setBaseLocked(true); setMode("select");
    modeRef.current = "select";
    editorSettings.current = { ...editorSettings.current, brightness: 0, contrast: 0, hue: 0, baseLocked: true };
    instance.requestRenderAll();
    syncSelectedShape();
    restoringRef.current = false;
    pushSnapshot(true, true);
    window.requestAnimationFrame(syncCanvasDisplay);
  };

  useClipboardImages((images) => void loadFile(images.at(-1)));

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
    instance.setDimensions({ width, height });
    window.requestAnimationFrame(syncCanvasDisplay);
    if (image) {
      const scale = Math.max(width / image.width, height / image.height);
      image.set({ left: width / 2, top: height / 2, scaleX: scale, scaleY: scale });
      image.setCoords();
    }
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
    addObject(new FabricText(value, { left: 90, top: 90, fontFamily: "sans-serif", fontSize: 48, fontWeight: "700", fill: drawColor, stroke: "rgba(255,255,255,.55)", strokeWidth: 1 }));
  };

  const addShape = (kind: "line" | "rect" | "circle") => {
    if (kind === "line") addObject(new Line([130, 150, 430, 300], { stroke: drawColor, strokeWidth: drawWidth, strokeLineCap: "round" }));
    if (kind === "rect") addObject(new Rect({ left: 120, top: 120, width: 220, height: 140, rx: 24, ry: 24, fill: "#0a84ff", stroke: "#ffffff", strokeWidth: 0 }));
    if (kind === "circle") addObject(new Circle({ left: 120, top: 120, radius: 90, fill: "#ff375f", stroke: "#ffffff", strokeWidth: 0 }));
  };

  const setSelectedShapeStyle = (property: "fill" | "stroke" | "strokeWidth", value: string | number) => {
    mutateActive((object) => {
      if (object instanceof Rect || object instanceof Circle) object.set(property, value);
    });
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
      restoringRef.current = false;
    }
  };

  const exportImage = () => {
    const instance = canvas.current;
    if (!instance) return;
    instance.renderAll();
    let dataUrl: string;
    if (format === "jpeg") {
      const flattened = document.createElement("canvas");
      flattened.width = instance.getWidth();
      flattened.height = instance.getHeight();
      const context = flattened.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, flattened.width, flattened.height);
      context.drawImage(instance.getElement(), 0, 0);
      dataUrl = flattened.toDataURL("image/jpeg", 0.92);
      flattened.width = 1; flattened.height = 1;
    } else dataUrl = instance.toDataURL({ format, quality: 0.92, multiplier: 1 });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${file ? stripExtension(file.name) : "worklazy-image"}-편집.${format === "jpeg" ? "jpg" : format}`;
    anchor.click();
  };

  return (
    <SectionCard title="이미지 편집" description="사진을 보정하거나 빈 캔버스에 그리고, 모든 작업을 같은 Undo·Redo 기록에서 관리하세요.">
      <FileDropZone files={file ? [file] : []} onFiles={(files) => void loadFile(filterRasterImages(files).at(-1))} accept={RASTER_IMAGE_ACCEPT} hint="JPG·PNG·WebP · Ctrl/⌘+V로 붙여넣기" accent="sky" />
      <ClipboardHint mode="replace" />
      <div className="editor-source-actions"><button type="button" className="secondary-button" onClick={newBlankCanvas}><ImageIcon size={16} /> 빈 캔버스로 새로 시작</button>{file && <span><strong>{file.name}</strong>을 바탕으로 편집 중</span>}</div>
      <div className="editor-toolbar">
        <div className="editor-draw-tools" aria-label="이미지 편집 도구">
          <ToolButton active={mode === "select"} label="선택" onClick={() => setMode("select")}><MousePointer2 /></ToolButton>
          <ToolButton active={mode === "pencil"} label="연필" onClick={() => setMode("pencil")}><Pencil /></ToolButton>
          <ToolButton active={mode === "brush"} label="붓" onClick={() => setMode("brush")}><Brush /></ToolButton>
          <ToolButton active={mode === "erase"} label="지우개" onClick={() => setMode("erase")}><Eraser /></ToolButton>
        </div>
        <label className="editor-draw-color"><span>그리기 색상</span><input type="color" value={drawColor} onChange={(event) => setDrawColor(event.target.value)} /></label>
        <label className="editor-draw-width"><span>굵기 {drawWidth}px</span><input type="range" min={1} max={40} value={drawWidth} onChange={(event) => setDrawWidth(Number(event.target.value))} /></label>
        <div className="editor-history-actions"><button type="button" disabled={historyState.index <= 0} aria-label="실행 취소" onClick={() => void restore(historyState.index - 1)}><Undo2 /></button><button type="button" disabled={historyState.index >= historyState.length - 1} aria-label="다시 실행" onClick={() => void restore(historyState.index + 1)}><Redo2 /></button><button type="button" aria-label="선택 개체 삭제" onClick={removeSelectedLayers}><Trash2 /></button></div>
      </div>
      <div className="image-editor-layout">
        <aside className="image-editor-controls">
          <div className="editor-tool-group"><strong>캔버스 비율·자르기</strong><div className="button-grid"><button type="button" onClick={() => cropTo(1)}>1:1</button><button type="button" onClick={() => cropTo(4 / 3)}>4:3</button><button type="button" onClick={() => cropTo(16 / 9)}>16:9</button></div></div>
          <div className="editor-tool-group"><strong>선택 레이어</strong><div className="icon-tool-row"><button title="오른쪽으로 90도 회전" aria-label="오른쪽으로 90도 회전" type="button" onClick={() => mutateActive((object) => object.rotate((object.angle || 0) + 90))}><RotateCw size={18} /></button><button title="좌우 반전" aria-label="좌우 반전" type="button" onClick={() => mutateActive((object) => object.set("flipX", !object.flipX))}><FlipHorizontal2 size={18} /></button><button title="상하 반전" aria-label="상하 반전" type="button" onClick={() => mutateActive((object) => object.set("flipY", !object.flipY))}><FlipVertical2 size={18} /></button><button title="맨 앞으로" aria-label="맨 앞으로" type="button" onClick={() => mutateActive((object) => canvas.current?.bringObjectToFront(object))}><ArrowUpToLine size={18} /></button><button title="맨 뒤로" aria-label="맨 뒤로" type="button" onClick={() => mutateActive((object) => canvas.current?.sendObjectToBack(object))}><ArrowDownToLine size={18} /></button><button title="삭제 (Delete)" aria-label="삭제 (Delete)" type="button" onClick={removeSelectedLayers}><Trash2 size={18} /></button></div></div>
          <div className={`editor-tool-group${file ? "" : " is-disabled"}`}><strong>원본 사진 보정</strong><label>밝기 <b>{brightness}</b><input disabled={!file} type="range" min={-80} max={80} value={brightness} onChange={(event) => updateFilter("brightness", Number(event.target.value))} /></label><label>대비 <b>{contrast}</b><input disabled={!file} type="range" min={-80} max={80} value={contrast} onChange={(event) => updateFilter("contrast", Number(event.target.value))} /></label><label>색조 <b>{hue}°</b><input disabled={!file} type="range" min={-180} max={180} value={hue} onChange={(event) => updateFilter("hue", Number(event.target.value))} /></label>{file && <ToggleRow label="원본 사진 잠금" description="이동·회전 실수 방지" checked={baseLocked} onChange={updateBaseLock} />}</div>
          <div className="editor-tool-group"><strong>텍스트·스티커</strong><div className="inline-input-action"><input value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => addText()}><Type size={16} /></button></div><div className="button-grid sticker-grid">{["✨", "✅", "❤️", "📌"].map((emoji) => <button type="button" key={emoji} onClick={() => addText(emoji)}>{emoji}</button>)}</div></div>
          <div className="editor-tool-group"><strong>선·도형</strong><div className="icon-tool-row"><button title="직선 추가" aria-label="직선 추가" type="button" onClick={() => addShape("line")}><Minus size={18} /></button><button title="사각형 추가" aria-label="사각형 추가" type="button" onClick={() => addShape("rect")}><Square size={18} /></button><button title="원 추가" aria-label="원 추가" type="button" onClick={() => addShape("circle")}><CircleIcon size={18} /></button></div></div>
          <div className={`editor-tool-group shape-style-controls${shapeSelected ? "" : " is-disabled"}`}><strong>선택 도형 스타일</strong><label><span>채움</span><input aria-label="도형 채움색" type="color" value={shapeFill} disabled={!shapeSelected} onChange={(event) => { setShapeFill(event.target.value); setSelectedShapeStyle("fill", event.target.value); }} /></label><label><span>테두리</span><input aria-label="도형 테두리색" type="color" value={shapeStroke} disabled={!shapeSelected} onChange={(event) => { setShapeStroke(event.target.value); setSelectedShapeStyle("stroke", event.target.value); }} /></label><label><span>테두리 두께 <b>{shapeStrokeWidth}px</b></span><input aria-label="도형 테두리 두께" type="range" min={0} max={30} step={1} value={shapeStrokeWidth} disabled={!shapeSelected} onChange={(event) => { const value = Number(event.target.value); setShapeStrokeWidth(value); setSelectedShapeStyle("strokeWidth", value); }} /></label>{!shapeSelected && <small>캔버스에서 사각형이나 원을 선택하세요.</small>}</div>
          <div className="editor-tool-group editor-background-control"><strong>배경·정리</strong><label><span>배경색</span><input type="color" value={background} disabled={transparentBackground} onChange={(event) => updateBackground(event.target.value, transparentBackground)} /></label><div className="image-background-options compact"><ToggleRow label="투명 배경" description="PNG·WebP 출력에 적용" checked={transparentBackground} onChange={(checked) => updateBackground(background, checked)} /></div><button type="button" className="secondary-button" onClick={clearAddedLayers}><Trash2 size={15} /> 추가 레이어 모두 지우기</button></div>
        </aside>
        <div
          ref={stageElement}
          className={`fabric-stage image-preview-drop${stageDragging ? " is-file-dragging" : ""}`}
          onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setStageDragging(true); } }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setStageDragging(true); } }}
          onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setStageDragging(false); }}
          onDrop={dropOnPreview}
        ><canvas ref={canvasElement} />{stageDragging && <span className="image-preview-drop-hint">여기에 놓아 편집 이미지 열기</span>}</div>
      </div>
      <div className="export-row"><div className="image-format-control"><SegmentedControl value={format} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} onChange={setFormat} label="이미지 출력 형식" /><small>사진이 없어도 빈 캔버스 작업을 저장할 수 있습니다. 투명 배경은 PNG·WebP에서 유지되고 JPG는 흰색으로 저장됩니다.</small></div><PrimaryButton accent="sky" onClick={exportImage}><Download size={18} /> 이미지 다운로드</PrimaryButton></div>
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
    progress.start("이미지 파일을 준비하는 중…");
    try {
      const watermarkImage = await serializeWatermark(watermarkFile);
      const result = await batchProcessImages(files, { mode, width, height, format, quality, background: transparentBackground ? "transparent" : "#ffffff", watermarkText, watermarkPosition, watermarkOpacity, watermarkImage }, "worklazy-일괄이미지.zip", progress.update, controller.signal);
      downloadWorkerResult(result);
      progress.succeed(`${files.length}개 이미지 일괄 처리 완료`);
    } catch (error) { progress.fail(normalizePanelError(error)); }
    finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
  };

  return <SectionCard title="이미지 일괄 편집" description="같은 크기와 워터마크 설정을 여러 이미지에 적용하고 ZIP으로 받습니다.">
    <FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint="JPG·PNG·WebP · 여러 번 추가·Ctrl/⌘+V 가능" accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" />
    <div className="image-settings-grid"><label><span>리사이즈 방식</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="fit-width">가로폭 맞춤</option><option value="contain">지정 크기 안에 맞춤</option><option value="cover">지정 크기 채우기</option><option value="original">원본 크기</option></select></label><NumberField label="가로 px" value={width} onChange={setWidth} /><NumberField label="세로 px" value={height} onChange={setHeight} disabled={mode === "fit-width" || mode === "original"} /><FormatField value={format} onChange={setFormat} /><RangeField label="품질" value={quality} min={0.4} max={1} step={0.05} onChange={setQuality} /></div>
    <TransparencyControl checked={transparentBackground} onChange={setTransparentBackground} format={format} />
    <div className="watermark-settings"><label><span>워터마크 텍스트</span><input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} placeholder="비워두면 적용하지 않음" /></label><label><span>워터마크 이미지</span><input type="file" accept={RASTER_IMAGE_ACCEPT} onChange={(event) => setWatermarkFile(filterRasterImages(Array.from(event.target.files || []))[0])} /></label><label><span>위치</span><select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value as WatermarkPosition)}><option value="top-left">왼쪽 위</option><option value="top-right">오른쪽 위</option><option value="center">가운데</option><option value="bottom-left">왼쪽 아래</option><option value="bottom-right">오른쪽 아래</option></select></label><RangeField label="불투명도" value={watermarkOpacity} min={0.1} max={1} step={0.05} onChange={setWatermarkOpacity} /></div>
    <div className="section-actions"><PrimaryButton accent="sky" disabled={!files.length} loading={progress.status === "running"} onClick={() => void execute()}><Download size={18} /> ZIP으로 일괄 다운로드</PrimaryButton></div>
  </SectionCard>;
}

function CollagePanel({ progress, controllerRef }: ProcessPanelProps) {
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
  const execute = async () => runPanelTask(controllerRef, progress, async (controller) => buildCollage(files, { layout, columns, width, gap, background: outputBackground, format, quality: 0.92 }, "worklazy-콜라주", progress.update, controller.signal), "콜라주 생성 완료");
  return <SectionCard title="이어붙이기·콜라주" description="설정한 간격만 이미지 사이에 적용합니다. 격자는 칸을 빈틈없이 채우며 가장자리가 일부 잘릴 수 있습니다."><FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint="두 개 이상의 이미지 · Ctrl/⌘+V 가능" accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" /><div className="image-settings-grid"><label><span>배치</span><select value={layout} onChange={(event) => setLayout(event.target.value as CollageOptions["layout"])}><option value="vertical">세로 이어붙이기</option><option value="horizontal">가로 이어붙이기</option><option value="grid">격자 콜라주</option></select></label><NumberField label="열 개수" value={columns} onChange={setColumns} disabled={layout !== "grid"} /><NumberField label="전체 가로 px" value={width} onChange={setWidth} /><NumberField label="간격 px" value={gap} min={0} onChange={setGap} /><label><span>배경색</span><input type="color" value={background} disabled={transparentBackground} onChange={(event) => setBackground(event.target.value)} /></label><FormatField value={format} onChange={setFormat} /></div><TransparencyControl checked={transparentBackground} onChange={setTransparentBackground} format={format} /><CollagePreview files={files} options={{ layout, columns, width, gap, background: outputBackground, format, quality: 0.92 }} onFiles={(incoming) => setFiles((current) => [...current, ...incoming])} /><div className="section-actions"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><LayoutGrid size={18} /> 콜라주 다운로드</PrimaryButton></div></SectionCard>;
}

function CollagePreview({ files, options, onFiles }: { files: File[]; options: CollageOptions; onFiles: (files: File[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState("이미지를 추가하면 결과 배치를 미리 볼 수 있습니다.");
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
        setSummary("이미지를 추가하면 결과 배치를 미리 볼 수 있습니다.");
        return;
      }

      const bitmaps: ImageBitmap[] = [];
      try {
        for (const file of files) bitmaps.push(await createImageBitmap(file));
        if (disposed) return;
        const layout = calculatePreviewLayout(bitmaps, options);
        const scale = calculatePreviewScale(layout.width, layout.height);
        const displayWidth = Math.max(1, Math.round(layout.width * scale));
        const displayHeight = Math.max(1, Math.round(layout.height * scale));
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.max(1, Math.round(displayWidth * pixelRatio));
        canvas.height = Math.max(1, Math.round(displayHeight * pixelRatio));
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("미리보기 캔버스를 만들 수 없습니다.");
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
        setSummary(`출력 예상 ${layout.width.toLocaleString()} × ${layout.height.toLocaleString()} px · ${files.length}개 이미지`);
      } catch (error) {
        if (!disposed) setSummary(error instanceof Error ? error.message : "미리보기를 만들지 못했습니다.");
      } finally {
        bitmaps.forEach((bitmap) => bitmap.close());
      }
    }, 120);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [files, options.background, options.columns, options.format, options.gap, options.layout, options.width]);

  return (
    <div className="collage-preview-panel">
      <div className="collage-preview-heading"><span><LayoutGrid size={17} /><strong>결과 미리보기</strong></span><small>{summary}</small></div>
      <div
        className={`collage-preview-stage image-preview-drop${files.length ? " has-preview" : ""}${dragging ? " is-file-dragging" : ""}`}
        onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); } }}
        onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = filterRasterImages(Array.from(event.dataTransfer.files)); if (dropped.length) onFiles(dropped); }}
      >
        {!files.length && <span><ImageIcon size={24} />이미지를 추가해 주세요.</span>}
        <canvas ref={canvasRef} aria-label="이어붙이기 결과 미리보기" />
        {dragging && <span className="image-preview-drop-hint">여기에 놓아 이미지 추가</span>}
      </div>
    </div>
  );
}

function GifPanel({ progress, controllerRef }: ProcessPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [width, setWidth] = useState(720);
  const [delay, setDelay] = useState(500);
  const [colors, setColors] = useState(192);
  const execute = async () => runPanelTask(controllerRef, progress, async (controller) => buildAnimatedGif(files, { width, delay, qualityColors: colors }, "worklazy-애니메이션.gif", progress.update, controller.signal), "GIF 애니메이션 생성 완료");
  return <SectionCard title="GIF 애니메이션 만들기" description="업로드 순서가 프레임 순서가 됩니다."><FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint="두 개 이상의 JPG·PNG·WebP 프레임" accent="sky" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" /><div className="image-settings-grid"><NumberField label="최대 가로 px" value={width} onChange={setWidth} /><NumberField label="프레임 간격 ms" value={delay} onChange={setDelay} /><label><span>색상 수</span><select value={colors} onChange={(event) => setColors(Number(event.target.value))}><option value={128}>128색 · 작게</option><option value={192}>192색 · 균형</option><option value={256}>256색 · 선명</option></select></label></div><div className="section-actions"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><Sparkles size={18} /> GIF 다운로드</PrimaryButton></div></SectionCard>;
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

async function runPanelTask(controllerRef: ProcessPanelProps["controllerRef"], progress: ProcessPanelProps["progress"], task: (controller: AbortController) => Promise<import("./types").ImageWorkerResult>, success: string) {
  const controller = new AbortController(); controllerRef.current = controller; progress.start("이미지 파일을 준비하는 중…");
  try { const result = await task(controller); downloadWorkerResult(result); progress.succeed(success); }
  catch (error) { progress.fail(normalizePanelError(error)); }
  finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
}

function NumberField({ label, value, onChange, disabled = false, min = 1 }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number }) { return <label><span>{label}</span><input type="number" min={min} value={value} disabled={disabled} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></label>; }
function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) { return <label><span>{label} <b>{Math.round(value * 100)}%</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function FormatField({ value, onChange }: { value: ImageOutputFormat; onChange: (value: ImageOutputFormat) => void }) { return <label><span>출력 형식</span><select value={value} onChange={(event) => onChange(event.target.value as ImageOutputFormat)}><option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option></select></label>; }

function TransparencyControl({ checked, onChange, format }: { checked: boolean; onChange: (value: boolean) => void; format: ImageOutputFormat }) {
  return <div className="image-background-options"><ToggleRow label="투명 배경" description="빈 공간과 이미지 사이 간격을 투명하게 저장" checked={checked} onChange={onChange} /><p>{format === "jpeg" ? "JPG는 투명도를 지원하지 않아 투명한 부분을 흰색으로 처리합니다." : "PNG·WebP 출력에서 투명 배경을 유지합니다."}</p></div>;
}

function ClipboardHint({ mode }: { mode: "replace" | "append" }) {
  return <div className="clipboard-image-hint"><ClipboardPaste size={15} /><span>화면을 캡처하거나 이미지를 복사한 뒤 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>V</kbd>를 누르면 {mode === "replace" ? "편집 이미지로 바로 열립니다." : "현재 목록 뒤에 추가됩니다."}</span></div>;
}

function useClipboardImages(onImages: (files: File[]) => void) {
  const callbackRef = useRef(onImages);
  useEffect(() => { callbackRef.current = onImages; }, [onImages]);
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === "file" && /^(?:image\/(?:png|jpeg|webp))$/i.test(item.type))
        .map((item, index) => item.getAsFile() ? clipboardFile(item.getAsFile() as File, index) : undefined)
        .filter((file): file is File => Boolean(file));
      if (!pasted.length) return;
      event.preventDefault();
      callbackRef.current(pasted);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);
}

function clipboardFile(source: File, index: number) {
  const extension = source.type === "image/jpeg" ? "jpg" : source.type === "image/webp" ? "webp" : "png";
  return new File([source], `클립보드-${new Date().toISOString().replace(/[:.]/g, "-")}-${index + 1}.${extension}`, { type: source.type, lastModified: Date.now() });
}

function calculatePreviewLayout(bitmaps: Array<{ width: number; height: number }>, options: CollageOptions) {
  const width = Math.max(1, Math.round(options.width));
  const gap = Math.max(0, Math.round(options.gap));
  if (options.layout === "vertical") {
    const heights = bitmaps.map((bitmap) => Math.max(1, Math.round(bitmap.height * width / bitmap.width)));
    let y = 0;
    const cells = heights.map((height) => { const cell = { x: 0, y, width, height }; y += height + gap; return cell; });
    return { width, height: Math.max(1, y - gap), cells };
  }
  if (options.layout === "horizontal") {
    if (width - gap * (bitmaps.length - 1) < bitmaps.length) throw new Error("전체 가로 크기에 비해 이미지 수와 간격이 너무 큽니다.");
    const cellWidth = Math.max(1, Math.floor((width - gap * (bitmaps.length - 1)) / bitmaps.length));
    const height = Math.max(...bitmaps.map((bitmap) => Math.max(1, Math.round(bitmap.height * cellWidth / bitmap.width))));
    return { width, height, cells: bitmaps.map((_, index) => ({ x: index * (cellWidth + gap), y: 0, width: cellWidth, height })) };
  }
  const columns = Math.max(1, Math.min(Math.round(options.columns), bitmaps.length));
  if (width - gap * (columns - 1) < columns) throw new Error("전체 가로 크기에 비해 열 개수와 간격이 너무 큽니다.");
  const rows = Math.ceil(bitmaps.length / columns);
  const cellWidth = Math.floor((width - gap * (columns - 1)) / columns);
  const cellHeight = Math.max(1, Math.round(cellWidth * 0.75));
  return { width, height: rows * cellHeight + (rows - 1) * gap, cells: bitmaps.map((_, index) => ({ x: (index % columns) * (cellWidth + gap), y: Math.floor(index / columns) * (cellHeight + gap), width: cellWidth, height: cellHeight })) };
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
function normalizePanelError(error: unknown) { return error instanceof DOMException && error.name === "AbortError" ? "이미지 작업을 취소했습니다." : error instanceof Error ? error.message : "이미지 처리에 실패했습니다."; }
function downloadWorkerResult(result: import("./types").ImageWorkerResult) { const url = URL.createObjectURL(new Blob([result.buffer], { type: result.mimeType })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
