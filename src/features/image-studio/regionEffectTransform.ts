export type CanvasTransform = [number, number, number, number, number, number];

export interface RegionBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImagePixelRegion {
  bounds: RegionBounds;
  polygon: Array<{ x: number; y: number }>;
}

export function anchorRegionEffect(base: CanvasTransform, anchorX: number, anchorY: number): CanvasTransform {
  const [a, b, c, d, translateX, translateY] = base;
  return [a, b, c, d, translateX + a * anchorX + c * anchorY, translateY + b * anchorX + d * anchorY];
}

export function resolveRegionEffectSourceStrength(strength: number, scaleX: number, scaleY: number, zoom = 1) {
  const visibleScale = Math.max(0.001, ((Math.abs(scaleX) + Math.abs(scaleY)) / 2) * Math.max(0.001, Math.abs(zoom)));
  return strength / visibleScale;
}

export function orderRegionEffectsAboveBase<T>(objects: readonly T[], base: T, isRegionEffect: (object: T) => boolean) {
  const effects = objects.filter(isRegionEffect);
  if (!effects.length) return [...objects];
  const otherObjects = objects.filter((object) => !isRegionEffect(object));
  const baseIndex = otherObjects.indexOf(base);
  if (baseIndex < 0) return [...objects];
  return [
    ...otherObjects.slice(0, baseIndex + 1),
    ...effects,
    ...otherObjects.slice(baseIndex + 1),
  ];
}

export function mapCanvasSelectionToImagePixels({
  selection,
  imageTransform,
  cropX,
  cropY,
  imageWidth,
  imageHeight,
  sourceWidth,
  sourceHeight,
}: {
  selection: RegionBounds;
  imageTransform: CanvasTransform;
  cropX: number;
  cropY: number;
  imageWidth: number;
  imageHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}): ImagePixelRegion {
  const inverse = invertTransform(imageTransform);
  const polygon = [
    { x: selection.left, y: selection.top },
    { x: selection.left + selection.width, y: selection.top },
    { x: selection.left + selection.width, y: selection.top + selection.height },
    { x: selection.left, y: selection.top + selection.height },
  ].map((point) => {
    const local = transformPoint(point, inverse);
    return {
      x: cropX + local.x + imageWidth / 2,
      y: cropY + local.y + imageHeight / 2,
    };
  });
  if (polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error("Invalid image selection");
  const left = Math.max(0, Math.floor(Math.min(...polygon.map((point) => point.x))));
  const top = Math.max(0, Math.floor(Math.min(...polygon.map((point) => point.y))));
  const right = Math.min(sourceWidth, Math.ceil(Math.max(...polygon.map((point) => point.x))));
  const bottom = Math.min(sourceHeight, Math.ceil(Math.max(...polygon.map((point) => point.y))));
  if (right <= left || bottom <= top) throw new Error("The selection does not overlap the image");
  return { bounds: { left, top, width: right - left, height: bottom - top }, polygon };
}

function invertTransform([a, b, c, d, translateX, translateY]: CanvasTransform): CanvasTransform {
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < Number.EPSILON) throw new Error("Invalid image transform");
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * translateY - d * translateX) / determinant,
    (b * translateX - a * translateY) / determinant,
  ];
}

function transformPoint(point: { x: number; y: number }, [a, b, c, d, translateX, translateY]: CanvasTransform) {
  return { x: a * point.x + c * point.y + translateX, y: b * point.x + d * point.y + translateY };
}
