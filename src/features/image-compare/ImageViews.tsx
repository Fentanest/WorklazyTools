import {projectFeatureRoiOverlay,type RoiOverlay} from "./alignmentRoiPreview.ts";
import type {AlignmentFeatureRois} from "./alignmentTypes.ts";
import { OcrComparePanel } from "../ocr-compare/OcrComparePanel.tsx";
import { discardOwnedBuffer } from "./memory.ts";
import { changesOnlyPixels } from "./kernel.ts";
import { Button } from "../../components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageCompareResult, Region } from "./types.ts";
export const IMAGE_VIEWS = ["split", "fade", "flicker", "slider", "highlight", "subtract", "ocrText", "ocrBoxes", "details"] as const;
export type ImageView = typeof IMAGE_VIEWS[number];
export type ImageT = (key: string, values?: Record<string, unknown>) => string;
export function viewPixels(result: ImageCompareResult, view: ImageView, amount: number, flickerRight: boolean, changesOnly = false) {
  if (view === "highlight") return changesOnly ? changesOnlyPixels(result.overlay, result.changedMask) : result.overlay;
  if (view === "subtract") return result.subtract;
  if (view === "flicker") return flickerRight ? result.right : result.left;
  const output = new Uint8ClampedArray(result.left.length), mix = Math.max(0, Math.min(1, amount / 100));
  for (let p = 0; p < result.width * result.height; p++) {
    const i = p * 4;
    if (view === "slider") { output.set((p % result.width < result.width * mix ? result.left : result.right).subarray(i, i + 4), i); continue; }
    const a = result.left[i + 3] / 255 * (1 - mix), b = result.right[i + 3] / 255 * mix, alpha = a + b;
    for (let c = 0; c < 3; c++) output[i + c] = alpha ? (result.left[i + c] * a + result.right[i + c] * b) / alpha : 0;
    output[i + 3] = alpha * 255;
  }
  return output;
}
export function ImageViews({ result, t, regions, focus, boxes, darken, initialView = "split", featureRois, ocrEnabled = false, retainedRegionPasses = 0, onOcrBusyChange, onOcrRetainedChange }: { result: ImageCompareResult; t: ImageT; regions: Region[]; focus?: Region; boxes: boolean; darken: boolean; initialView?: ImageView; featureRois?:AlignmentFeatureRois; ocrEnabled?: boolean; retainedRegionPasses?:number; onOcrBusyChange?:(busy:boolean)=>void; onOcrRetainedChange?:(bytes:number)=>void }) {
  const [view, setView] = useState<ImageView>(initialView), [amount, setAmount] = useState(50), [playing, setPlaying] = useState(false), [frame, setFrame] = useState(false);
  // Flicker interval is speed seconds (0.1–1, Diffchecker's default 1); 1/2 hold one side, again releases.
  const [speed, setSpeed] = useState(1), [held, setHeld] = useState<"left" | "right" | null>(null), [changesOnly, setChangesOnly] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null), [rotation, setRotation] = useState(0);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || target?.closest("input,textarea,select,[contenteditable=true]")) return;
      if (view === "flicker" && (event.key === "1" || event.key === "2")) { const side = event.key === "1" ? "left" : "right"; setHeld(current => current === side ? null : side); event.preventDefault(); }
      else if (view !== "details" && (event.key === "[" || event.key === "]")) { setRotation(current => normalizeDegrees(current + (event.key === "]" ? 90 : -90))); event.preventDefault(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [view]);
  useEffect(()=>{if(featureRois)setView("split");},[featureRois]);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const change = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); }; media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  useEffect(() => { if (!playing || view !== "flicker" || reducedMotion || held) return; const timer = setInterval(() => setFrame((value) => !value), 1000 * speed); return () => clearInterval(timer); }, [playing, view, reducedMotion, speed, held]);
  const roiOverlays=useMemo(()=>({left:projectFeatureRoiOverlay(result,"left",featureRois?.left),right:projectFeatureRoiOverlay(result,"right",featureRois?.right)}),[result,featureRois]);
  return <div data-testid="image-views" data-run-id={result.runId}><div className="flex flex-wrap gap-2" role="group" aria-label={t("views.title")}>{IMAGE_VIEWS.map((item) => <Button type="button" variant={item === view ? "secondary" : "outline"} className="rounded-xl" key={item} aria-pressed={item === view} onClick={() => { setView(item); setPlaying(false); }} data-view={item}>{t(`views.${item}`)}</Button>)}</div>
    {Object.values(roiOverlays).some(overlay=>overlay.status==='invalid')&&<p data-testid="image-roi-overlay-warning" role="status" className="my-2 text-sm">{t("alignment.roi.overlayHidden")}</p>}
    {(view === "fade" || view === "slider") && <label className="my-2 block">{t("views.amount")} {amount}% <input aria-label={t("views.amount")} type="range" min={0} max={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>}
    {view === "flicker" && <div className="my-2 flex flex-wrap items-center gap-2" data-testid="image-flicker-controls"><Button type="button" variant="secondary" className="rounded-xl" disabled={reducedMotion} onClick={() => setPlaying((value) => !value)}>{t(reducedMotion ? "views.reducedMotion" : playing ? "views.pause" : "views.play")}</Button>
      <label className="flex items-center gap-2 text-sm">{t("views.faster")}<input aria-label={t("views.flickerSpeed")} data-testid="image-flicker-speed" type="range" min={0.1} max={1} step={0.05} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />{t("views.slower")}</label>
      {(["left", "right"] as const).map((side, index) => <Button key={side} type="button" variant={held === side ? "secondary" : "outline"} className="rounded-xl" aria-pressed={held === side} data-testid={`image-flicker-hold-${side}`} onClick={() => setHeld(current => current === side ? null : side)}>{t(side === "left" ? "views.holdOriginal" : "views.holdRevised")} <kbd className="ml-1 text-xs opacity-70">{index + 1}</kbd></Button>)}</div>}
    {view === "highlight" && <div className="my-2 flex flex-wrap gap-2" role="group" aria-label={t("views.highlightMode")}>{([false, true] as const).map(only => <Button key={String(only)} type="button" variant={changesOnly === only ? "secondary" : "outline"} className="rounded-xl" aria-pressed={changesOnly === only} data-testid={only ? "image-highlight-changes-only" : "image-highlight-full"} onClick={() => setChangesOnly(only)}>{t(only ? "views.changesOnly" : "views.fullContext")}</Button>)}</div>}
    {view !== "details" && view !== "ocrText" && view !== "ocrBoxes" && <div className="my-2 flex flex-wrap items-center gap-2 text-sm" data-testid="image-zoom-controls">
      <Button type="button" variant="outline" className="rounded-xl" aria-label={t("views.zoomOut")} onClick={() => setZoom(current => Math.max(0.25, (current ?? 1) - 0.25))}>−</Button>
      <select aria-label={t("views.zoom")} data-testid="image-zoom" className="rounded border border-border bg-background px-2 py-1" value={zoom === null ? "fit" : String(zoom)} onChange={event => setZoom(event.target.value === "fit" ? null : Number(event.target.value))}><option value="fit">{t("views.fit")}</option>{(zoom !== null && !ZOOM_STEPS.includes(zoom) ? [...ZOOM_STEPS, zoom].sort((a, b) => a - b) : ZOOM_STEPS).map(step => <option key={step} value={String(step)}>{Math.round(step * 100)}%</option>)}</select>
      <Button type="button" variant="outline" className="rounded-xl" aria-label={t("views.zoomIn")} onClick={() => setZoom(current => Math.min(5, (current ?? 1) + 0.25))}>+</Button>
      <Button type="button" variant="outline" className="rounded-xl" aria-label={t("views.rotateLeft")} onClick={() => setRotation(current => normalizeDegrees(current - 90))}>⟲</Button>
      <input aria-label={t("views.rotate")} data-testid="image-rotation" type="range" min={-180} max={180} step={0.1} value={rotation} onChange={event => setRotation(normalizeDegrees(Number(event.target.value)))} /><span className="tabular-nums">{rotation.toFixed(1)}°</span>
      <Button type="button" variant="outline" className="rounded-xl" aria-label={t("views.rotateRight")} onClick={() => setRotation(current => normalizeDegrees(current + 90))}>⟳</Button>
      {(rotation !== 0 || zoom !== null) && <Button type="button" variant="ghost" className="rounded-xl" onClick={() => { setRotation(0); setZoom(null); }}>{t("views.resetView")}</Button>}</div>}
    {view === "details" ? <dl className="my-3 grid grid-cols-2 gap-4">{(["left", "right"] as const).map((side) => <div key={side}><dt className="font-bold">{t(side)}</dt>{Object.entries(result.sources[side]).map(([key, value]) => <div className="break-all text-sm" data-image-meta={key} data-value={key === "decodedWidth" || key === "decodedHeight" ? String(value) : undefined} key={key}>{t(`metadata.${key}`)}: {key === "decodeOrientation" ? t("metadata.orientationApplied") : String(value)}</div>)}</div>)}</dl> : view === "ocrText" || view === "ocrBoxes" ? null : <div className={`my-3 grid gap-3 ${view === "split" ? "grid-cols-2 max-[620px]:grid-cols-1" : "grid-cols-1"}`}>
      {view === "split" ? <>{(["left", "right"] as const).map((side) => <figure key={side}><figcaption>{t(side)}</figcaption><PixelCanvas roiOverlays={roiOverlays} side={side} result={result} pixels={result[side]} regions={regions} focus={focus} boxes={boxes} darken={darken} label={t(side)} zoom={zoom} rotation={rotation} /></figure>)}</> : <PixelCanvas roiOverlays={roiOverlays} result={result} pixels={result.left} view={view} amount={amount} flickerRight={held ? held === "right" : frame} changesOnly={changesOnly} regions={regions} focus={focus} boxes={boxes} darken={darken} label={t(`views.${view}`)} zoom={zoom} rotation={rotation} />}
    </div>}
    <OcrComparePanel key={result.runId} result={result} mode={view==='ocrBoxes'?'boxes':'text'} active={view==='ocrText'||view==='ocrBoxes'} enabled={ocrEnabled} retainedRegionPasses={retainedRegionPasses} t={t} onBusyChange={onOcrBusyChange} onRetainedChange={onOcrRetainedChange}/>
  </div>;
}
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5];
const normalizeDegrees = (degrees: number) => { const value = ((degrees + 180) % 360 + 360) % 360 - 180; return Math.round(value * 10) / 10; };
function PixelCanvas({ roiOverlays,side,result, pixels, view, amount, flickerRight, changesOnly, regions, focus, boxes, darken, label, zoom = null, rotation = 0 }: {roiOverlays:Record<"left"|"right",RoiOverlay>;side?:"left"|"right"; result: ImageCompareResult; pixels: Uint8ClampedArray; view?: ImageView; amount?: number; flickerRight?: boolean; changesOnly?: boolean; regions: Region[]; focus?: Region; boxes: boolean; darken: boolean; label: string; zoom?: number | null; rotation?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const bounds = focus?.bounds ?? { x: 0, y: 0, width: result.width, height: result.height };
    canvas.width = bounds.width; canvas.height = bounds.height;
    const context = canvas.getContext("2d"); if (!context) return;
    const workingPixels = view ? viewPixels(result, view, amount ?? 50, flickerRight ?? false, changesOnly) : pixels;
    const imageData = new ImageData(Uint8ClampedArray.from(workingPixels), result.width, result.height);
    context.putImageData(imageData, -bounds.x, -bounds.y); discardOwnedBuffer(imageData.data.buffer);
    if (view === "fade" || view === "slider" || view === "highlight" && changesOnly) discardOwnedBuffer(workingPixels.buffer);
    // Darken everything outside the changed regions (their boxes stay at full brightness).
    // Overlapping boxes stay bright too: their pixels are kept and put back after dimming.
    if (darken) {
      const kept = regions.flatMap(region => {
        const b = region.bounds, x = Math.max(0, b.x - bounds.x), y = Math.max(0, b.y - bounds.y);
        const width = Math.min(canvas.width, b.x - bounds.x + b.width) - x, height = Math.min(canvas.height, b.y - bounds.y + b.height) - y;
        return width > 0 && height > 0 ? [{ x, y, data: context.getImageData(x, y, width, height) }] : [];
      });
      context.fillStyle = "#0006"; context.fillRect(0, 0, canvas.width, canvas.height);
      for (const item of kept) context.putImageData(item.data, item.x, item.y);
    }
    if (boxes) { context.strokeStyle = "#f43f5e"; context.lineWidth = 2; for (const region of regions) { const b = region.bounds; context.strokeRect(b.x - bounds.x, b.y - bounds.y, b.width, b.height); } }
    for(const sourceSide of side?[side]:['left','right'] as const){const overlay=roiOverlays[sourceSide];if(overlay.status!=="projected")continue;const points=overlay.points;context.strokeStyle=sourceSide==='left'?'#0284c7':'#a855f7';context.lineWidth=3;context.setLineDash([8,4]);context.beginPath();points.forEach((p,i)=>i?context.lineTo(p.x-bounds.x,p.y-bounds.y):context.moveTo(p.x-bounds.x,p.y-bounds.y));context.closePath();context.stroke();context.setLineDash([]);}
    return () => { canvas.width = 1; canvas.height = 1; };
    // The framed (zoomed or rotated) layout mounts a different canvas, which must be drawn too.
  }, [result, pixels, view, amount, flickerRight, changesOnly, regions, focus, boxes, darken,roiOverlays,side,zoom === null && rotation === 0]);
  const checker = "rounded border border-border bg-[repeating-conic-gradient(#ddd_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]";
  if (zoom === null && rotation === 0) return <canvas ref={ref} className={`h-auto w-full max-w-full ${checker}`} aria-label={label} role="img" data-testid="image-pixel-canvas" />;
  // Zoomed or rotated: a scrollable frame sized to the rotated box of the scaled image.
  const scale = zoom ?? 1, width = (focus?.bounds.width ?? result.width) * scale, height = (focus?.bounds.height ?? result.height) * scale;
  const radians = rotation * Math.PI / 180, boxWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)), boxHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  return <div className="max-h-[70vh] max-w-full overflow-auto rounded border border-border" data-testid="image-zoom-frame"><div className="relative" style={{ width: boxWidth, height: boxHeight }}>
    <canvas ref={ref} className={checker} style={{ position: "absolute", left: (boxWidth - width) / 2, top: (boxHeight - height) / 2, width, height, transform: `rotate(${rotation}deg)`, imageRendering: scale >= 2 ? "pixelated" : "auto" }} aria-label={label} role="img" data-testid="image-pixel-canvas" data-zoom={scale} data-rotation={rotation} />
  </div></div>;
}
