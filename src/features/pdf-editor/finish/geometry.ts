export type PdfPageRotation = 0 | 90 | 180 | 270;

export type ViewportTransform = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface PdfViewportGeometry {
  width: number;
  height: number;
  rotation: PdfPageRotation;
  transform: ViewportTransform;
}

export interface ViewportMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type FinishVerticalRegion = "top" | "bottom";
export type FinishHorizontalRegion = "left" | "center" | "right";
export type FinishRegion = `${FinishVerticalRegion}-${FinishHorizontalRegion}`;

export interface FinishAnchor {
  region: FinishRegion;
  viewport: { x: number; y: number };
  pdf: { x: number; y: number };
  textRotation: PdfPageRotation;
}

function assertFinite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${name}-not-finite`);
}

function validateViewport(viewport: PdfViewportGeometry) {
  assertFinite(viewport.width, "viewport-width");
  assertFinite(viewport.height, "viewport-height");
  if (viewport.width <= 0 || viewport.height <= 0) throw new RangeError("viewport-size-invalid");
  if (![0, 90, 180, 270].includes(viewport.rotation)) throw new RangeError("viewport-rotation-invalid");
  for (const [index, value] of viewport.transform.entries()) assertFinite(value, `viewport-transform-${index}`);
}

export function viewportPointToPdf(
  transform: ViewportTransform,
  x: number,
  y: number,
): { x: number; y: number } {
  assertFinite(x, "viewport-x");
  assertFinite(y, "viewport-y");
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) throw new RangeError("viewport-transform-singular");
  const offsetX = x - e;
  const offsetY = y - f;
  return {
    x: (d * offsetX - c * offsetY) / determinant,
    y: (-b * offsetX + a * offsetY) / determinant,
  };
}

export function uprightTextRotation(rotation: PdfPageRotation): PdfPageRotation {
  return rotation;
}

export function createFinishAnchors(
  viewport: PdfViewportGeometry,
  margins: ViewportMargins = { top: 0, right: 0, bottom: 0, left: 0 },
): FinishAnchor[] {
  validateViewport(viewport);
  for (const [name, value] of Object.entries(margins)) {
    assertFinite(value, `margin-${name}`);
    if (value < 0) throw new RangeError("margin-negative");
  }
  if (margins.left + margins.right >= viewport.width || margins.top + margins.bottom >= viewport.height) {
    throw new RangeError("margin-exhausts-page");
  }
  const xs: Record<FinishHorizontalRegion, number> = {
    left: margins.left,
    center: margins.left + (viewport.width - margins.left - margins.right) / 2,
    right: viewport.width - margins.right,
  };
  const ys: Record<FinishVerticalRegion, number> = {
    top: margins.top,
    bottom: viewport.height - margins.bottom,
  };
  const anchors: FinishAnchor[] = [];
  for (const vertical of ["top", "bottom"] as const) {
    for (const horizontal of ["left", "center", "right"] as const) {
      const point = { x: xs[horizontal], y: ys[vertical] };
      anchors.push({
        region: `${vertical}-${horizontal}`,
        viewport: point,
        pdf: viewportPointToPdf(viewport.transform, point.x, point.y),
        textRotation: uprightTextRotation(viewport.rotation),
      });
    }
  }
  return anchors;
}
