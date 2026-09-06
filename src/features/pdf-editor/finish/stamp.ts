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

export interface AppliedStamp {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

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

export function stampPdfCorners(stamp: AppliedStamp, viewport: StampViewport) {
  const corners = [
    [stamp.x, stamp.y],
    [stamp.x + stamp.width, stamp.y],
    [stamp.x, stamp.y + stamp.height],
    [stamp.x + stamp.width, stamp.y + stamp.height],
  ] as const;
  return corners.map(([x, y]) => {
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
    return { x: pdfX, y: pdfY };
  });
}
