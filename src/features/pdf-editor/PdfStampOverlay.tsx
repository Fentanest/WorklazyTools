import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  applyNormalizedStamp,
  createNormalizedStamp,
  cssPointToViewport,
  type NormalizedStamp,
} from "./finish/stamp.ts";

interface PdfStampOverlayProps {
  imageUrl: string;
  placement: NormalizedStamp;
  sourceWidth: number;
  sourceHeight: number;
  moveLabel: string;
  resizeLabel: string;
  disabled?: boolean;
  onCommit: (placement: NormalizedStamp) => void;
}

interface PointerSession {
  action: "move" | "resize";
  pointerId: number;
  start: NormalizedStamp;
  startU: number;
  startV: number;
  left: number;
  top: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function fitPlacement(placement: NormalizedStamp, sourceWidth: number, sourceHeight: number) {
  const applied = applyNormalizedStamp(placement, { width: sourceWidth, height: sourceHeight });
  return createNormalizedStamp({
    ...applied,
    viewportWidth: sourceWidth,
    viewportHeight: sourceHeight,
    aspect: placement.aspect,
  });
}

export function PdfStampOverlay({
  imageUrl,
  placement,
  sourceWidth,
  sourceHeight,
  moveLabel,
  resizeLabel,
  disabled = false,
  onCommit,
}: PdfStampOverlayProps) {
  const [draft, setDraft] = useState(placement);
  const draftRef = useRef(placement);
  const sessionRef = useRef<PointerSession | undefined>(undefined);

  useEffect(() => {
    if (sessionRef.current) return;
    draftRef.current = placement;
    setDraft(placement);
  }, [placement]);

  const applied = applyNormalizedStamp(draft, { width: sourceWidth, height: sourceHeight });
  const updateDraft = (next: NormalizedStamp) => {
    draftRef.current = next;
    setDraft(next);
  };
  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => cssPointToViewport({
    clientX: event.clientX,
    clientY: event.clientY,
    rect: event.currentTarget.parentElement?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect(),
    viewport: { width: sourceWidth, height: sourceHeight },
  });
  const startPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const point = pointerPosition(event);
    const fitted = fitPlacement(draftRef.current, sourceWidth, sourceHeight);
    const fittedRect = applyNormalizedStamp(fitted, { width: sourceWidth, height: sourceHeight });
    sessionRef.current = {
      action: (event.target as Element).closest("[data-stamp-resize]") ? "resize" : "move",
      pointerId: event.pointerId,
      start: fitted,
      startU: point.u,
      startV: point.v,
      left: fittedRect.x / sourceWidth,
      top: fittedRect.y / sourceHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = pointerPosition(event);
    if (session.action === "move") {
      updateDraft(fitPlacement({
        ...session.start,
        cx: session.start.cx + point.u - session.startU,
        cy: session.start.cy + point.v - session.startV,
      }, sourceWidth, sourceHeight));
      return;
    }
    let rw = clamp(point.u - session.left, 0.05, 1);
    const relativeHeight = () => rw * sourceWidth / session.start.aspect / sourceHeight;
    if (session.top + relativeHeight() > 1) rw = Math.max(0.05, (1 - session.top) * sourceHeight * session.start.aspect / sourceWidth);
    updateDraft(fitPlacement({
      ...session.start,
      cx: session.left + rw / 2,
      cy: session.top + relativeHeight() / 2,
      rw,
    }, sourceWidth, sourceHeight));
  };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (commit) onCommit(draftRef.current);
    else updateDraft(placement);
  };

  return (
    <div
      className="absolute touch-none select-none rounded-md bg-white/10 shadow-sm outline-solid outline-2 outline-violet-600 focus-visible:ring-3 focus-visible:ring-violet-600/40"
      data-testid="pdf-stamp-overlay"
      data-pdf-stamp-owned
      data-stamp-cx={draft.cx}
      data-stamp-cy={draft.cy}
      data-stamp-rw={draft.rw}
      data-stamp-aspect={draft.aspect}
      role="img"
      aria-label={moveLabel}
      style={{
        left: `${applied.x / sourceWidth * 100}%`,
        top: `${applied.y / sourceHeight * 100}%`,
        width: `${applied.width / sourceWidth * 100}%`,
        height: `${applied.height / sourceHeight * 100}%`,
        cursor: disabled ? "default" : "move",
      }}
      onPointerDown={startPointer}
      onPointerMove={movePointer}
      onPointerUp={(event) => finishPointer(event, true)}
      onPointerCancel={(event) => finishPointer(event, false)}
    >
      <img src={imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full object-contain" />
      <span
        className="absolute -right-2.5 -bottom-2.5 block size-6 rounded-full border-2 border-white bg-violet-700 shadow-sm"
        data-testid="pdf-stamp-resize-handle"
        data-stamp-resize
        aria-hidden="true"
        title={resizeLabel}
        style={{ cursor: disabled ? "default" : "nwse-resize" }}
      />
    </div>
  );
}
