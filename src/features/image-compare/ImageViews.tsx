import {projectFeatureRoiOverlay,type RoiOverlay} from "./alignmentRoiPreview.ts";
import type {AlignmentFeatureRois} from "./alignmentTypes.ts";
import { OcrComparePanel } from "../ocr-compare/OcrComparePanel.tsx";
import { discardOwnedBuffer } from "./memory.ts";
import { Button } from "../../components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageCompareResult, Region } from "./types.ts";
export const IMAGE_VIEWS = ["split", "fade", "flicker", "slider", "highlight", "subtract", "ocrText", "ocrBoxes", "details"] as const;
export type ImageView = typeof IMAGE_VIEWS[number];
export type ImageT = (key: string, values?: Record<string, unknown>) => string;
export function viewPixels(result: ImageCompareResult, view: ImageView, amount: number, flickerRight: boolean) {
  if (view === "highlight") return result.overlay;
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
  useEffect(()=>{if(featureRois)setView("split");},[featureRois]);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const change = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); }; media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  useEffect(() => { if (!playing || view !== "flicker" || reducedMotion) return; const timer = setInterval(() => setFrame((value) => !value), 500); return () => clearInterval(timer); }, [playing, view, reducedMotion]);
  const roiOverlays=useMemo(()=>({left:projectFeatureRoiOverlay(result,"left",featureRois?.left),right:projectFeatureRoiOverlay(result,"right",featureRois?.right)}),[result,featureRois]);
  return <div data-testid="image-views" data-run-id={result.runId}><div className="flex flex-wrap gap-2" role="group" aria-label={t("views.title")}>{IMAGE_VIEWS.map((item) => <Button type="button" variant={item === view ? "secondary" : "outline"} className="rounded-xl" key={item} aria-pressed={item === view} onClick={() => { setView(item); setPlaying(false); }} data-view={item}>{t(`views.${item}`)}</Button>)}</div>
    {Object.values(roiOverlays).some(overlay=>overlay.status==='invalid')&&<p data-testid="image-roi-overlay-warning" role="status" className="my-2 text-sm">{t("alignment.roi.overlayHidden")}</p>}
    {(view === "fade" || view === "slider") && <label className="my-2 block">{t("views.amount")} {amount}% <input aria-label={t("views.amount")} type="range" min={0} max={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>}
    {view === "flicker" && <Button type="button" variant="secondary" className="my-2 rounded-xl" disabled={reducedMotion} onClick={() => setPlaying((value) => !value)}>{t(reducedMotion ? "views.reducedMotion" : playing ? "views.pause" : "views.play")}</Button>}
    {view === "details" ? <dl className="my-3 grid grid-cols-2 gap-4">{(["left", "right"] as const).map((side) => <div key={side}><dt className="font-bold">{t(side)}</dt>{Object.entries(result.sources[side]).map(([key, value]) => <div className="break-all text-sm" data-image-meta={key} data-value={key === "decodedWidth" || key === "decodedHeight" ? String(value) : undefined} key={key}>{t(`metadata.${key}`)}: {key === "decodeOrientation" ? t("metadata.orientationApplied") : String(value)}</div>)}</div>)}</dl> : view === "ocrText" || view === "ocrBoxes" ? null : <div className={`my-3 grid gap-3 ${view === "split" ? "grid-cols-2 max-[620px]:grid-cols-1" : "grid-cols-1"}`}>
      {view === "split" ? <>{(["left", "right"] as const).map((side) => <figure key={side}><figcaption>{t(side)}</figcaption><PixelCanvas roiOverlays={roiOverlays} side={side} result={result} pixels={result[side]} regions={regions} focus={focus} boxes={boxes} darken={darken} label={t(side)} /></figure>)}</> : <PixelCanvas roiOverlays={roiOverlays} result={result} pixels={result.left} view={view} amount={amount} flickerRight={frame} regions={regions} focus={focus} boxes={boxes} darken={darken} label={t(`views.${view}`)} />}
    </div>}
    <OcrComparePanel key={result.runId} result={result} mode={view==='ocrBoxes'?'boxes':'text'} active={view==='ocrText'||view==='ocrBoxes'} enabled={ocrEnabled} retainedRegionPasses={retainedRegionPasses} t={t} onBusyChange={onOcrBusyChange} onRetainedChange={onOcrRetainedChange}/>
  </div>;
}
function PixelCanvas({ roiOverlays,side,result, pixels, view, amount, flickerRight, regions, focus, boxes, darken, label }: {roiOverlays:Record<"left"|"right",RoiOverlay>;side?:"left"|"right"; result: ImageCompareResult; pixels: Uint8ClampedArray; view?: ImageView; amount?: number; flickerRight?: boolean; regions: Region[]; focus?: Region; boxes: boolean; darken: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const bounds = focus?.bounds ?? { x: 0, y: 0, width: result.width, height: result.height };
    canvas.width = bounds.width; canvas.height = bounds.height;
    const context = canvas.getContext("2d"); if (!context) return;
    const workingPixels = view ? viewPixels(result, view, amount ?? 50, flickerRight ?? false) : pixels;
    const imageData = new ImageData(Uint8ClampedArray.from(workingPixels), result.width, result.height);
    context.putImageData(imageData, -bounds.x, -bounds.y); discardOwnedBuffer(imageData.data.buffer);
    if (view === "fade" || view === "slider") discardOwnedBuffer(workingPixels.buffer);
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
  }, [result, pixels, view, amount, flickerRight, regions, focus, boxes, darken,roiOverlays,side]);
  return <canvas ref={ref} className="h-auto w-full max-w-full rounded border border-border bg-[repeating-conic-gradient(#ddd_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]" aria-label={label} role="img" data-testid="image-pixel-canvas" />;
}
