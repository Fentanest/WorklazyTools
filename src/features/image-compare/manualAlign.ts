import { applyMatrix, transformMatrix } from "./geometry.ts";
import type { Transform } from "./types.ts";

/** Manual alignment geometry after Diffchecker 7.3.0 (module 61612): snapping within 8 screen pixels to the
 * original's centre and (when the changed image is axis-aligned) its edges, corner resizing that keeps the
 * opposite corner fixed, and rotation by handle with Shift snapping to 5°. All values are original image pixels. */
export const SNAP_SCREEN_PX = 8, MIN_SCALE = 0.05, MAX_SCALE = 20;
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }
export interface Guides { x?: number; y?: number }

export const scaleYOf = (transform: Transform) => transform.scaleY ?? transform.scale;
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
const round = (value: number, digits: number) => { const factor = 10 ** digits; return Math.round(value * factor) / factor; };
/** Keeps transforms readable in the number fields; a uniform scale drops the separate vertical value. */
export function tidyTransform(transform: Transform): Transform {
  const { scaleY, ...rest } = transform, scale = round(transform.scale, 4), vertical = scaleY === undefined ? undefined : round(scaleY, 4);
  return { ...rest, x: round(transform.x, 2), y: round(transform.y, 2), degrees: round(transform.degrees, 2), scale, ...(vertical === undefined || vertical === scale ? {} : { scaleY: vertical }) };
}
export function normalizeDegrees(degrees: number) { const value = ((degrees + 180) % 360 + 360) % 360 - 180; return value === -180 ? 180 : value; }
/** Within 1.5° of a multiple of 90°, the rotated image's box edges are its own edges. */
export function axisAligned(degrees: number) { const rest = ((degrees % 90) + 90) % 90; return Math.min(rest, 90 - rest) <= 1.5; }

/** Corners of the changed image in original-image coordinates, in local order (0,0) (w,0) (w,h) (0,h). */
export function imageCorners(right: Size, transform: Transform): Point[] {
  const matrix = transformMatrix(right.width, right.height, transform);
  return [[0, 0], [right.width, 0], [right.width, right.height], [0, right.height]].map(([x, y]) => applyMatrix(matrix, x, y));
}
function bounds(points: Point[]) { const xs = points.map(p => p.x), ys = points.map(p => p.y); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
function nearest(values: number[], targets: number[], threshold: number) {
  let best: { delta: number; target: number } | undefined;
  for (const value of values) for (const target of targets) { const delta = target - value; if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target }; }
  return best;
}

/** Snaps a moved image: centre to the original's centre at any angle, edges to its edges only when axis-aligned. */
export function snapMove(left: Size, right: Size, transform: Transform, threshold: number): { transform: Transform; guides: Guides } {
  const box = bounds(imageCorners(right, transform)), edges = axisAligned(transform.degrees), guides: Guides = {};
  const x = nearest([(box.minX + box.maxX) / 2, ...(edges ? [box.minX, box.maxX] : [])], [left.width / 2, ...(edges ? [0, left.width] : [])], threshold);
  const y = nearest([(box.minY + box.maxY) / 2, ...(edges ? [box.minY, box.maxY] : [])], [left.height / 2, ...(edges ? [0, left.height] : [])], threshold);
  if (x) guides.x = x.target; if (y) guides.y = y.target;
  return { transform: { ...transform, x: transform.x + (x?.delta ?? 0), y: transform.y + (y?.delta ?? 0) }, guides };
}
/** Snaps a dragged corner to the original's edges (axis-aligned images only). */
export function snapPoint(left: Size, point: Point, degrees: number, threshold: number): { point: Point; guides: Guides } {
  if (!axisAligned(degrees)) return { point, guides: {} };
  const x = nearest([point.x], [0, left.width], threshold), y = nearest([point.y], [0, left.height], threshold);
  return { point: { x: x?.target ?? point.x, y: y?.target ?? point.y }, guides: { ...(x ? { x: x.target } : {}), ...(y ? { y: y.target } : {}) } };
}

const rotate = (angle: number, v: Point): Point => ({ x: Math.cos(angle) * v.x - Math.sin(angle) * v.y, y: Math.sin(angle) * v.x + Math.cos(angle) * v.y });
/** Visual corner signs (after flips) of each local corner, matching imageCorners order. */
export function cornerSigns(transform: Transform) {
  const fx = transform.flipX ? -1 : 1, fy = transform.flipY ? -1 : 1;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ ux: x * fx, uy: y * fy }));
}
/** Resizes from a visual corner (ux, uy) to `pointer`, keeping the opposite corner fixed; `locked` keeps the ratio. */
export function resizeFromCorner(right: Size, start: Transform, corner: { ux: number; uy: number }, pointer: Point, locked: boolean): Transform {
  const angle = start.degrees * Math.PI / 180, width = right.width * start.scale, height = right.height * scaleYOf(start);
  const center = { x: start.x + right.width / 2, y: start.y + right.height / 2 }, half = rotate(angle, { x: -corner.ux * width / 2, y: -corner.uy * height / 2 });
  const anchor = { x: center.x + half.x, y: center.y + half.y }, q = rotate(-angle, { x: pointer.x - anchor.x, y: pointer.y - anchor.y });
  let scaleX = corner.ux * q.x / right.width, scaleY = corner.uy * q.y / right.height;
  if (locked) { const ratio = (corner.ux * q.x * width + corner.uy * q.y * height) / (width * width + height * height); scaleX = start.scale * ratio; scaleY = scaleYOf(start) * ratio; }
  scaleX = clampScale(scaleX); scaleY = clampScale(scaleY);
  const offset = rotate(angle, { x: corner.ux * right.width * scaleX / 2, y: corner.uy * right.height * scaleY / 2 });
  const { scaleY: _previous, ...rest } = start;
  return { ...rest, scale: scaleX, ...(scaleY === scaleX ? {} : { scaleY }), x: anchor.x + offset.x - right.width / 2, y: anchor.y + offset.y - right.height / 2 };
}
/** Rotation by handle: the pointer's angle change around the image centre; Shift snaps to 5°. */
export function rotateFromPointer(right: Size, start: Transform, from: Point, to: Point, snap: boolean): Transform {
  const center = { x: start.x + right.width / 2, y: start.y + right.height / 2 };
  const delta = (Math.atan2(to.y - center.y, to.x - center.x) - Math.atan2(from.y - center.y, from.x - center.x)) * 180 / Math.PI;
  const degrees = normalizeDegrees(start.degrees + delta);
  return { ...start, degrees: snap ? normalizeDegrees(5 * Math.round(degrees / 5)) : degrees };
}
