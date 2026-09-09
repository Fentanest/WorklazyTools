export interface CssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StampViewport {
  width: number;
  height: number;
  convertToPdfPoint: (x: number, y: number) => readonly [number, number];
}

export interface NormalizedStamp {
  cx: number;
  cy: number;
  rw: number;
  aspect: number;
}

export interface PdfStampSettings {
  image: File;
  placement: NormalizedStamp;
}

export interface StampHistory {
  past: NormalizedStamp[];
  present: NormalizedStamp;
  future: NormalizedStamp[];
}

export interface AppliedStamp {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export type StampPdfCorners = readonly [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];

function validPositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function cssPointToViewport(input: {
  clientX: number;
  clientY: number;
  rect: CssRect;
  viewport: Pick<StampViewport, "width" | "height">;
}) {
  const { clientX, clientY, rect, viewport } = input;
  if (![clientX, clientY, rect.left, rect.top].every(Number.isFinite)
      || !validPositive(rect.width)
      || !validPositive(rect.height)
      || !validPositive(viewport.width)
      || !validPositive(viewport.height)) {
    throw new RangeError("invalid-stamp-coordinate-input");
  }
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  return { u, v, x: u * viewport.width, y: v * viewport.height };
}

export function cssPointToPdf(input: {
  clientX: number;
  clientY: number;
  rect: CssRect;
  viewport: StampViewport;
}) {
  const point = cssPointToViewport(input);
  const [x, y] = input.viewport.convertToPdfPoint(point.x, point.y);
  return { ...point, pdf: { x, y } };
}

export function createNormalizedStamp(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  aspect: number;
}): NormalizedStamp {
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value))
      || !validPositive(input.width)
      || !validPositive(input.height)
      || !validPositive(input.viewportWidth)
      || !validPositive(input.viewportHeight)
      || !validPositive(input.aspect)) {
    throw new RangeError("invalid-stamp-model");
  }
  return {
    cx: (input.x + input.width / 2) / input.viewportWidth,
    cy: (input.y + input.height / 2) / input.viewportHeight,
    rw: input.width / input.viewportWidth,
    aspect: input.aspect,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sameStamp(left: NormalizedStamp, right: NormalizedStamp) {
  return left.cx === right.cx
    && left.cy === right.cy
    && left.rw === right.rw
    && left.aspect === right.aspect;
}

export function createStampHistory(present: NormalizedStamp): StampHistory {
  applyNormalizedStamp(present, { width: 1, height: 1 });
  return { past: [], present: { ...present }, future: [] };
}

export function commitStamp(history: StampHistory, next: NormalizedStamp): StampHistory {
  applyNormalizedStamp(next, { width: 1, height: 1 });
  if (sameStamp(history.present, next)) return history;
  return { past: [...history.past, history.present], present: { ...next }, future: [] };
}

export function undoStamp(history: StampHistory): StampHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoStamp(history: StampHistory): StampHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function applyNormalizedStamp(
  stamp: NormalizedStamp,
  viewport: Pick<StampViewport, "width" | "height">,
): AppliedStamp {
  const values = [stamp.cx, stamp.cy, stamp.rw, stamp.aspect, viewport.width, viewport.height];
  if (values.some((value) => !Number.isFinite(value))
      || !validPositive(stamp.rw)
      || !validPositive(stamp.aspect)
      || !validPositive(viewport.width)
      || !validPositive(viewport.height)) {
    throw new RangeError("invalid-stamp-application");
  }
  let width = stamp.rw * viewport.width;
  let height = width / stamp.aspect;
  const scale = Math.min(1, viewport.width / width, viewport.height / height);
  width *= scale;
  height *= scale;
  const cx = clamp(stamp.cx * viewport.width, width / 2, viewport.width - width / 2);
  const cy = clamp(stamp.cy * viewport.height, height / 2, viewport.height - height / 2);
  return { x: cx - width / 2, y: cy - height / 2, width, height, cx, cy };
}

export function stampPdfCorners(stamp: AppliedStamp, viewport: StampViewport): StampPdfCorners {
  const corners = [
    [stamp.x, stamp.y],
    [stamp.x + stamp.width, stamp.y],
    [stamp.x, stamp.y + stamp.height],
    [stamp.x + stamp.width, stamp.y + stamp.height],
  ] as const;
  const convert = ([x, y]: readonly [number, number]) => {
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
    return { x: pdfX, y: pdfY };
  };
  return [convert(corners[0]), convert(corners[1]), convert(corners[2]), convert(corners[3])];
}
