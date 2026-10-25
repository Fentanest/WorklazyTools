import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "../../components/ui/button";
import type { ImageT } from "./ImageViews.tsx";
import { SNAP_SCREEN_PX, cornerSigns, imageCorners, resizeFromCorner, rotateFromPointer, scaleYOf, snapMove, snapPoint, tidyTransform, type Guides, type Point, type Size } from "./manualAlign.ts";
import type { Transform } from "./types.ts";

const SNAP_KEY = "worklazy.imageAlignSnapping", STAGE_MAX_HEIGHT = 440, PAD = 0.25, HANDLE = 10;
function readSnapping() { try { return globalThis.localStorage?.getItem(SNAP_KEY) !== "false"; } catch { return true; } }
function writeSnapping(value: boolean) { try { globalThis.localStorage?.setItem(SNAP_KEY, String(value)); } catch { /* per-viewer convenience only */ } }
const same = (a: Transform, b: Transform) => a.x === b.x && a.y === b.y && a.degrees === b.degrees && a.scale === b.scale && scaleYOf(a) === scaleYOf(b) && a.flipX === b.flipX && a.flipY === b.flipY;
type Gesture = { kind: "move" } | { kind: "resize"; corner: { ux: number; uy: number } } | { kind: "rotate" };

/** Diffchecker-style manual alignment: the changed image over the original at an adjustable opacity, moved by
 * dragging or arrow keys, resized from its corners, rotated by a handle. Edits stay a draft until Apply. */
export function ManualAlignEditor({ left, right, transform, t, disabled, onApply }: { left: File; right: File; transform: Transform; t: ImageT; disabled: boolean; onApply: (next: Transform) => void }) {
  const [urls, setUrls] = useState<{ left: string; right: string }>();
  const [sizes, setSizes] = useState<{ left?: Size; right?: Size }>({});
  const [draft, setDraft] = useState(transform), [opacity, setOpacity] = useState(50), [snapping, setSnapping] = useState(readSnapping);
  const [locked, setLocked] = useState(() => transform.scaleY === undefined), [guides, setGuides] = useState<Guides>({}), [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null), gesture = useRef<{ type: Gesture; start: Transform; from: Point } | undefined>(undefined);
  useEffect(() => { const next = { left: URL.createObjectURL(left), right: URL.createObjectURL(right) }; setUrls(next); setSizes({}); return () => { URL.revokeObjectURL(next.left); URL.revokeObjectURL(next.right); }; }, [left, right]);
  useEffect(() => { setDraft(transform); setLocked(transform.scaleY === undefined); }, [transform]);
  useLayoutEffect(() => { const node = frame.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width)); observer.observe(node); return () => observer.disconnect(); }, []);
  const ready = sizes.left && sizes.right ? { left: sizes.left, right: sizes.right } : undefined;
  const maxWidth = Math.max(sizes.left?.width ?? 1, sizes.right?.width ?? 1), maxHeight = Math.max(sizes.left?.height ?? 1, sizes.right?.height ?? 1);
  const viewWidth = maxWidth * (1 + 2 * PAD), viewHeight = maxHeight * (1 + 2 * PAD), em = width ? Math.min(width / viewWidth, STAGE_MAX_HEIGHT / viewHeight) : 0;
  const stageHeight = viewHeight * em, originX = width / 2 - (sizes.left?.width ?? 0) * em / 2, originY = stageHeight / 2 - (sizes.left?.height ?? 0) * em / 2;
  const toImage = (event: PointerEvent): Point => { const rect = inner.current!.getBoundingClientRect(); return { x: (event.clientX - rect.left) / em, y: (event.clientY - rect.top) / em }; };
  const begin = (type: Gesture) => (event: PointerEvent<HTMLElement>) => {
    if (disabled || !ready || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); frame.current?.focus({ preventScroll: true });
    gesture.current = { type, start: draft, from: toImage(event) };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current; if (!active || !ready) return;
    const point = toImage(event), snap = snapping && !(event.ctrlKey || event.metaKey), threshold = SNAP_SCREEN_PX / em;
    let next: Transform, lines: Guides = {};
    if (active.type.kind === "move") {
      next = { ...active.start, x: active.start.x + point.x - active.from.x, y: active.start.y + point.y - active.from.y };
      if (snap) ({ transform: next, guides: lines } = snapMove(ready.left, ready.right, next, threshold));
    } else if (active.type.kind === "resize") {
      const snapped = snap ? snapPoint(ready.left, point, active.start.degrees, threshold) : { point, guides: {} };
      next = resizeFromCorner(ready.right, active.start, active.type.corner, snapped.point, locked); lines = snapped.guides;
    } else next = rotateFromPointer(ready.right, active.start, active.from, point, event.shiftKey);
    setDraft(tidyTransform(next)); setGuides(lines);
  };
  const end = () => { gesture.current = undefined; setGuides({}); };
  const nudge = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1, delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta || disabled) return; event.preventDefault();
    setDraft(current => tidyTransform({ ...current, x: current.x + delta[0], y: current.y + delta[1] }));
  };
  // Locking makes the scale uniform at the horizontal value, as Diffchecker resets the ratio.
  const toggleLock = () => { if (!locked) setDraft(current => tidyTransform({ ...current, scaleY: current.scale })); setLocked(!locked); };
  const toggleSnapping = () => { writeSnapping(!snapping); setSnapping(!snapping); };
  const corners = ready ? imageCorners(ready.right, draft) : [], signs = cornerSigns(draft);
  const center = ready ? { x: draft.x + ready.right.width / 2, y: draft.y + ready.right.height / 2 } : { x: 0, y: 0 }, angle = draft.degrees * Math.PI / 180;
  const knobDistance = ready ? ready.right.height * scaleYOf(draft) / 2 + 28 / Math.max(em, 1e-6) : 0, knob = { x: center.x + Math.sin(angle) * knobDistance, y: center.y - Math.cos(angle) * knobDistance };
  const handle = HANDLE / Math.max(em, 1e-6), changed = !same(draft, transform);
  const imageStyle = (side: "left" | "right") => side === "left" ? { left: 0, top: 0, width: sizes.left?.width, height: sizes.left?.height } : { left: 0, top: 0, width: sizes.right?.width, height: sizes.right?.height, transformOrigin: "center", transform: `translate(${draft.x}px, ${draft.y}px) rotate(${draft.degrees}deg) scale(${draft.scale * (draft.flipX ? -1 : 1)}, ${scaleYOf(draft) * (draft.flipY ? -1 : 1)})` };
  return <section className="mt-3" data-testid="image-manual-align" aria-label={t("manual.title")}>
    <p className="text-xs text-muted-foreground">{t("manual.hint")}</p>
    <div className="my-2 flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">{t("manual.opacity")}<input type="range" min={0} max={100} value={opacity} onChange={event => setOpacity(Number(event.target.value))} data-testid="image-manual-opacity" /><span className="tabular-nums">{opacity}%</span></label>
      <Button type="button" size="sm" variant={locked ? "secondary" : "outline"} aria-pressed={locked} data-testid="image-manual-lock" onClick={toggleLock}>{t(locked ? "manual.locked" : "manual.unlocked")}</Button>
      <Button type="button" size="sm" variant={snapping ? "secondary" : "outline"} aria-pressed={snapping} data-testid="image-manual-snap" onClick={toggleSnapping}>{t(snapping ? "manual.snapOn" : "manual.snapOff")}</Button>
    </div>
    <div ref={frame} tabIndex={0} role="application" aria-label={t("manual.stage")} onKeyDown={nudge} data-testid="image-manual-stage" className="relative w-full touch-none overflow-hidden rounded border border-border bg-[repeating-conic-gradient(#ddd_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ height: stageHeight || 240 }}>
      {urls && <div ref={inner} className="absolute" style={{ left: originX, top: originY, width: sizes.left?.width, height: sizes.left?.height, transform: `scale(${em})`, transformOrigin: "0 0" }}>
        <img src={urls.left} alt="" draggable={false} className="absolute max-w-none select-none" style={imageStyle("left")} onLoad={event => { const image = event.currentTarget; setSizes(current => ({ ...current, left: { width: image.naturalWidth, height: image.naturalHeight } })); }} />
        <img src={urls.right} alt="" draggable={false} className="absolute max-w-none select-none" style={{ ...imageStyle("right"), opacity: opacity / 100 }} onLoad={event => { const image = event.currentTarget; setSizes(current => ({ ...current, right: { width: image.naturalWidth, height: image.naturalHeight } })); }} />
        {ready && <>
          <div className="absolute cursor-move" style={imageStyle("right")} data-testid="image-manual-body" onPointerDown={begin({ kind: "move" })} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          {corners.map((point, index) => <div key={index} data-manual-corner={index} className="absolute border-2 border-emerald-600 bg-white" style={{ left: point.x - handle / 2, top: point.y - handle / 2, width: handle, height: handle, cursor: signs[index].ux * signs[index].uy > 0 ? "nwse-resize" : "nesw-resize" }} onPointerDown={begin({ kind: "resize", corner: signs[index] })} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />)}
          <div data-testid="image-manual-rotate" title={t("manual.rotateHint")} className="absolute cursor-grab rounded-full border-2 border-emerald-600 bg-white active:cursor-grabbing" style={{ left: knob.x - handle * 0.65, top: knob.y - handle * 0.65, width: handle * 1.3, height: handle * 1.3 }} onPointerDown={begin({ kind: "rotate" })} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          {guides.x !== undefined && <div className="pointer-events-none absolute bg-[#f0f]" style={{ left: guides.x, top: -viewHeight, width: 1 / em, height: viewHeight * 3 }} />}
          {guides.y !== undefined && <div className="pointer-events-none absolute bg-[#f0f]" style={{ top: guides.y, left: -viewWidth, height: 1 / em, width: viewWidth * 3 }} />}
        </>}
      </div>}
    </div>
    <p className="my-2 text-xs tabular-nums" data-testid="image-manual-values">{t("manual.values", { x: draft.x, y: draft.y, degrees: draft.degrees, scaleX: draft.scale, scaleY: scaleYOf(draft) })}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={disabled || !changed} data-testid="image-manual-apply" onClick={() => onApply(draft)}>{t("manual.apply")}</Button>
      <Button type="button" variant="secondary" disabled={!changed} data-testid="image-manual-discard" onClick={() => { setDraft(transform); setLocked(transform.scaleY === undefined); }}>{t("manual.discard")}</Button>
    </div>
  </section>;
}
