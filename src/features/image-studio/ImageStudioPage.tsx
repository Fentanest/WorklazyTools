import { ArrowDownToLine, ArrowUpToLine, CircleIcon, ClipboardPaste, Download, FlipHorizontal2, ImageIcon, Images, LayoutGrid, RotateCw, Shapes, Sparkles, Trash2, Type } from "lucide-react";
import { Canvas, Circle, FabricImage, FabricText, Rect, filters, type FabricObject } from "fabric";
import { useCallback, useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, FileList, PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { batchProcessImages, buildAnimatedGif, buildCollage, serializeWatermark } from "./imageWorkerClient";
import type { CollageOptions, ImageOutputFormat, WatermarkPosition } from "./types";

type StudioTab = "single" | "batch" | "collage" | "gif";
const RASTER_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export function ImageStudioPage() {
  const [tab, setTab] = useState<StudioTab>("single");
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
          ["single", "단일 편집", ImageIcon], ["batch", "일괄 편집", Images], ["collage", "이어붙이기·콜라주", LayoutGrid], ["gif", "GIF 만들기", Sparkles],
        ] as const).map(([value, label, Icon]) => <button type="button" className={tab === value ? "active" : ""} onClick={() => { setTab(value); progress.reset(); }} key={value}><Icon size={17} /><span>{label}</span></button>)}
      </nav>

      {tab === "single" && <SingleImageEditor />}
      {tab === "batch" && <BatchImagePanel progress={progress} controllerRef={activeController} />}
      {tab === "collage" && <CollagePanel progress={progress} controllerRef={activeController} />}
      {tab === "gif" && <GifPanel progress={progress} controllerRef={activeController} />}

      <OperationProgress {...progress} accent="sky" title="이미지 처리 로그" />
      {progress.status === "running" && <div className="cancel-operation"><button className="secondary-button" type="button" onClick={() => activeController.current?.abort()}>작업 취소</button></div>}

      <ToolGuide
        title="브라우저 이미지 편집 안내"
        description="원본 이미지와 편집 결과는 외부 작업 서버로 업로드하지 않습니다. 단일 편집은 화면 캔버스에서, 일괄 작업은 전용 Worker에서 처리합니다."
        blocks={[
          { title: "단일 이미지 편집", paragraphs: ["파일을 선택하거나 클립보드 이미지를 Ctrl/⌘+V로 붙여넣고 텍스트, 도형과 이모지를 각각 선택 가능한 레이어로 배치합니다. 밝기·대비·색조는 원본 이미지 레이어에 적용됩니다."] },
          { title: "일괄 처리", paragraphs: ["여러 파일과 클립보드 이미지를 한 목록에 추가할 수 있습니다. 리사이즈와 워터마크는 OffscreenCanvas Worker에서 한 장씩 처리하고 결과를 ZIP으로 묶습니다."] },
          { title: "콜라주와 GIF", paragraphs: ["이어붙이기는 배치·간격·배경색을 바꿀 때 실제 출력 계산과 같은 방식의 축소 미리보기를 갱신합니다. GIF는 256색 제한 때문에 사진의 미세한 색 변화가 단순화될 수 있습니다."] },
        ]}
        faq={[
          { question: "이미지가 서버로 전송되나요?", answer: "아니요. 이미지 바이트는 현재 브라우저 메모리와 전용 Worker 안에서만 처리합니다." },
          { question: "원본 파일이 바뀌나요?", answer: "아니요. 원본은 읽기만 하며 모든 결과는 새 파일로 내려받습니다." },
          { question: "지원 형식은 무엇인가요?", answer: "브라우저가 해석할 수 있는 JPG, PNG, WebP 등을 입력으로 사용합니다. 출력은 PNG, JPG, WebP와 애니메이션 GIF를 지원합니다." },
          { question: "투명 배경을 유지할 수 있나요?", answer: "현재 단일 편집기는 흰색 캔버스를 사용합니다. 일괄 편집과 콜라주는 선택한 배경색으로 채우며 JPG는 투명 배경을 지원하지 않습니다." },
          { question: "대용량 이미지가 중단되는 이유는 무엇인가요?", answer: "브라우저와 기기에는 캔버스 최대 크기와 메모리 한도가 있습니다. 출력 크기나 파일 수를 줄이면 안정적으로 처리할 수 있습니다." },
        ]}
      />
    </div>
  );
}

function SingleImageEditor() {
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<Canvas | undefined>(undefined);
  const baseImage = useRef<FabricImage | undefined>(undefined);
  const [file, setFile] = useState<File>();
  const [text, setText] = useState("Worklazy Tools");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [hue, setHue] = useState(0);
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  const [shapeSelected, setShapeSelected] = useState(false);
  const [shapeFill, setShapeFill] = useState("#0a84ff");
  const [shapeStroke, setShapeStroke] = useState("#ffffff");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(0);

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
    instance.on("selection:created", syncSelection);
    instance.on("selection:updated", syncSelection);
    instance.on("selection:cleared", syncSelection);
    return () => { baseImage.current = undefined; instance.dispose(); canvas.current = undefined; };
  }, [syncSelectedShape]);

  useEffect(() => {
    const image = baseImage.current;
    if (!image) return;
    image.filters = [
      new filters.Brightness({ brightness: brightness / 100 }),
      new filters.Contrast({ contrast: contrast / 100 }),
      new filters.HueRotation({ rotation: hue / 360 }),
    ];
    image.applyFilters();
    canvas.current?.requestRenderAll();
  }, [brightness, contrast, hue]);

  const loadFile = async (next?: File) => {
    setFile(next);
    if (!next || !canvas.current) return;
    const url = URL.createObjectURL(next);
    try {
      const image = await FabricImage.fromURL(url);
      const instance = canvas.current;
      instance.clear();
      instance.backgroundColor = "#ffffff";
      instance.setDimensions({ width: 900, height: 600 });
      const scale = Math.min(860 / image.width, 560 / image.height);
      image.set({ left: 450, top: 300, originX: "center", originY: "center", scaleX: scale, scaleY: scale });
      instance.add(image);
      instance.setActiveObject(image);
      baseImage.current = image;
      syncSelectedShape(image);
      setBrightness(0); setContrast(0); setHue(0);
      instance.requestRenderAll();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  useClipboardImages((images) => void loadFile(images.at(-1)));

  const mutateActive = (action: (object: FabricObject) => void) => {
    const instance = canvas.current;
    const object = instance?.getActiveObject();
    if (!instance || !object) return;
    action(object);
    object.setCoords();
    instance.requestRenderAll();
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
    return true;
  }, [syncSelectedShape]);

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
    if (!instance || !image) return;
    const width = 900;
    const height = Math.round(width / ratio);
    instance.setDimensions({ width, height });
    const scale = Math.max(width / image.width, height / image.height);
    image.set({ left: width / 2, top: height / 2, scaleX: scale, scaleY: scale });
    image.setCoords();
    instance.requestRenderAll();
  };

  const addText = (value = text) => {
    if (!canvas.current || !value.trim()) return;
    const object = new FabricText(value, { left: 90, top: 90, fontFamily: "sans-serif", fontSize: 48, fontWeight: "700", fill: "#ffffff", stroke: "rgba(0,0,0,.5)", strokeWidth: 1 });
    canvas.current.add(object);
    canvas.current.setActiveObject(object);
    syncSelectedShape(object);
    canvas.current.requestRenderAll();
  };

  const addShape = (kind: "rect" | "circle") => {
    if (!canvas.current) return;
    const shape = kind === "rect"
      ? new Rect({ left: 120, top: 120, width: 220, height: 140, rx: 24, ry: 24, fill: "#0a84ff", stroke: "#ffffff", strokeWidth: 0 })
      : new Circle({ left: 120, top: 120, radius: 90, fill: "#ff375f", stroke: "#ffffff", strokeWidth: 0 });
    canvas.current.add(shape);
    canvas.current.setActiveObject(shape);
    syncSelectedShape(shape);
    canvas.current.requestRenderAll();
  };

  const setSelectedShapeStyle = (property: "fill" | "stroke" | "strokeWidth", value: string | number) => {
    mutateActive((object) => {
      if (object instanceof Rect || object instanceof Circle) object.set(property, value);
    });
  };

  const exportImage = () => {
    const instance = canvas.current;
    if (!instance) return;
    const dataUrl = instance.toDataURL({ format, quality: 0.92, multiplier: 1 });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${file ? stripExtension(file.name) : "worklazy-image"}-편집.${format === "jpeg" ? "jpg" : format}`;
    anchor.click();
  };

  return (
    <SectionCard title="단일 이미지 편집" description="개체를 눌러 이동·확대·회전하고, 선택한 추가 레이어는 Delete 키로 지울 수 있습니다.">
      <FileDropZone files={file ? [file] : []} onFiles={(files) => void loadFile(filterRasterImages(files).at(-1))} accept={RASTER_IMAGE_ACCEPT} hint="JPG·PNG·WebP · Ctrl/⌘+V로 붙여넣기" accent="sky" />
      <ClipboardHint mode="replace" />
      <div className="image-editor-layout">
        <aside className="image-editor-controls">
          <div className="editor-tool-group"><strong>자르기</strong><div className="button-grid"><button type="button" onClick={() => cropTo(1)}>1:1</button><button type="button" onClick={() => cropTo(4 / 3)}>4:3</button><button type="button" onClick={() => cropTo(16 / 9)}>16:9</button></div></div>
          <div className="editor-tool-group"><strong>선택 레이어</strong><div className="icon-tool-row"><button title="회전" type="button" onClick={() => mutateActive((object) => object.rotate((object.angle || 0) + 90))}><RotateCw size={18} /></button><button title="좌우 반전" type="button" onClick={() => mutateActive((object) => object.set("flipX", !object.flipX))}><FlipHorizontal2 size={18} /></button><button title="맨 앞으로" type="button" onClick={() => mutateActive((object) => canvas.current?.bringObjectToFront(object))}><ArrowUpToLine size={18} /></button><button title="맨 뒤로" type="button" onClick={() => mutateActive((object) => canvas.current?.sendObjectToBack(object))}><ArrowDownToLine size={18} /></button><button title="삭제 (Delete)" type="button" onClick={removeSelectedLayers}><Trash2 size={18} /></button></div></div>
          <div className="editor-tool-group"><strong>필터</strong><label>밝기 <b>{brightness}</b><input type="range" min={-80} max={80} value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label><label>대비 <b>{contrast}</b><input type="range" min={-80} max={80} value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label><label>색조 <b>{hue}°</b><input type="range" min={-180} max={180} value={hue} onChange={(event) => setHue(Number(event.target.value))} /></label></div>
          <div className="editor-tool-group"><strong>텍스트·스티커</strong><div className="inline-input-action"><input value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => addText()}><Type size={16} /></button></div><div className="button-grid sticker-grid">{["✨", "✅", "❤️", "📌"].map((emoji) => <button type="button" key={emoji} onClick={() => addText(emoji)}>{emoji}</button>)}</div></div>
          <div className="editor-tool-group"><strong>도형</strong><div className="icon-tool-row"><button type="button" onClick={() => addShape("rect")}><Shapes size={18} /></button><button type="button" onClick={() => addShape("circle")}><CircleIcon size={18} /></button></div></div>
          <div className={`editor-tool-group shape-style-controls${shapeSelected ? "" : " is-disabled"}`}><strong>선택 도형 스타일</strong><label><span>채움</span><input aria-label="도형 채움색" type="color" value={shapeFill} disabled={!shapeSelected} onChange={(event) => { setShapeFill(event.target.value); setSelectedShapeStyle("fill", event.target.value); }} /></label><label><span>테두리</span><input aria-label="도형 테두리색" type="color" value={shapeStroke} disabled={!shapeSelected} onChange={(event) => { setShapeStroke(event.target.value); setSelectedShapeStyle("stroke", event.target.value); }} /></label><label><span>테두리 두께 <b>{shapeStrokeWidth}px</b></span><input aria-label="도형 테두리 두께" type="range" min={0} max={30} step={1} value={shapeStrokeWidth} disabled={!shapeSelected} onChange={(event) => { const value = Number(event.target.value); setShapeStrokeWidth(value); setSelectedShapeStyle("strokeWidth", value); }} /></label>{!shapeSelected && <small>캔버스에서 사각형이나 원을 선택하세요.</small>}</div>
        </aside>
        <div className="fabric-stage"><canvas ref={canvasElement} /></div>
      </div>
      <div className="export-row"><SegmentedControl value={format} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }, { value: "webp", label: "WebP" }]} onChange={setFormat} label="이미지 출력 형식" /><PrimaryButton accent="sky" disabled={!file} onClick={exportImage}><Download size={18} /> 이미지 다운로드</PrimaryButton></div>
    </SectionCard>
  );
}

function BatchImagePanel({ progress, controllerRef }: ProcessPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"fit-width" | "contain" | "cover" | "original">("fit-width");
  const [width, setWidth] = useState(1600);
  const [height, setHeight] = useState(1200);
  const [format, setFormat] = useState<ImageOutputFormat>("jpeg");
  const [quality, setQuality] = useState(0.9);
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
      const result = await batchProcessImages(files, { mode, width, height, format, quality, background: "#ffffff", watermarkText, watermarkPosition, watermarkOpacity, watermarkImage }, "worklazy-일괄이미지.zip", progress.update, controller.signal);
      downloadWorkerResult(result);
      progress.succeed(`${files.length}개 이미지 일괄 처리 완료`);
    } catch (error) { progress.fail(normalizePanelError(error)); }
    finally { if (controllerRef.current === controller) controllerRef.current = undefined; }
  };

  return <SectionCard title="이미지 일괄 편집" description="같은 크기와 워터마크 설정을 여러 이미지에 적용하고 ZIP으로 받습니다.">
    <FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint="여러 JPG·PNG·WebP · Ctrl/⌘+V 가능" accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" />
    <div className="image-settings-grid"><label><span>리사이즈 방식</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="fit-width">가로폭 맞춤</option><option value="contain">지정 크기 안에 맞춤</option><option value="cover">지정 크기 채우기</option><option value="original">원본 크기</option></select></label><NumberField label="가로 px" value={width} onChange={setWidth} /><NumberField label="세로 px" value={height} onChange={setHeight} disabled={mode === "fit-width" || mode === "original"} /><FormatField value={format} onChange={setFormat} /><RangeField label="품질" value={quality} min={0.4} max={1} step={0.05} onChange={setQuality} /></div>
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
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  useClipboardImages((images) => setFiles((current) => [...current, ...images]));
  const execute = async () => runPanelTask(controllerRef, progress, async (controller) => buildCollage(files, { layout, columns, width, gap, background, format, quality: 0.92 }, "worklazy-콜라주", progress.update, controller.signal), "콜라주 생성 완료");
  return <SectionCard title="이어붙이기·콜라주" description="설정한 간격만 이미지 사이에 적용합니다. 격자는 칸을 빈틈없이 채우며 가장자리가 일부 잘릴 수 있습니다."><FileDropZone files={files} onFiles={(next) => setFiles(filterRasterImages(next))} accept={RASTER_IMAGE_ACCEPT} multiple hint="두 개 이상의 이미지 · Ctrl/⌘+V 가능" accent="sky" /><ClipboardHint mode="append" /><FileList files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} accent="sky" /><div className="image-settings-grid"><label><span>배치</span><select value={layout} onChange={(event) => setLayout(event.target.value as CollageOptions["layout"])}><option value="vertical">세로 이어붙이기</option><option value="horizontal">가로 이어붙이기</option><option value="grid">격자 콜라주</option></select></label><NumberField label="열 개수" value={columns} onChange={setColumns} disabled={layout !== "grid"} /><NumberField label="전체 가로 px" value={width} onChange={setWidth} /><NumberField label="간격 px" value={gap} min={0} onChange={setGap} /><label><span>배경색</span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label><FormatField value={format} onChange={setFormat} /></div><CollagePreview files={files} options={{ layout, columns, width, gap, background, format, quality: 0.92 }} /><div className="section-actions"><PrimaryButton accent="sky" disabled={files.length < 2} loading={progress.status === "running"} onClick={() => void execute()}><LayoutGrid size={18} /> 콜라주 다운로드</PrimaryButton></div></SectionCard>;
}

function CollagePreview({ files, options }: { files: File[]; options: CollageOptions }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState("이미지를 추가하면 결과 배치를 미리 볼 수 있습니다.");

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
        context.fillStyle = options.background;
        context.fillRect(0, 0, displayWidth, displayHeight);
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
  }, [files, options.background, options.columns, options.gap, options.layout, options.width]);

  return (
    <div className="collage-preview-panel">
      <div className="collage-preview-heading"><span><LayoutGrid size={17} /><strong>결과 미리보기</strong></span><small>{summary}</small></div>
      <div className={`collage-preview-stage${files.length ? " has-preview" : ""}`}>
        {!files.length && <span><ImageIcon size={24} />이미지를 추가해 주세요.</span>}
        <canvas ref={canvasRef} aria-label="이어붙이기 결과 미리보기" />
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
