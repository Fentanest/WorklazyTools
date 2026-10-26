import type { Bounds, Region, RegionOptions } from "./types.ts";
interface Mat { data: Uint8Array; delete(): void }
interface Vector { get(index: number): Mat; size(): number; delete(): void }
export interface RegionCv {
  Mat: new (rows?: number, columns?: number, type?: number) => Mat;
  MatVector: new () => Vector; Size: new (width: number, height: number) => unknown;
  CV_8UC1: number; MORPH_RECT: number; RETR_EXTERNAL: number; CHAIN_APPROX_SIMPLE: number;
  getStructuringElement(shape: number, size: unknown): Mat;
  dilate(input: Mat, output: Mat, kernel: Mat): void;
  findContours(input: Mat, contours: Vector, hierarchy: Mat, mode: number, method: number): void;
  boundingRect(contour: Mat): Bounds;
}
export function detectRegions(cv: RegionCv, delta: Uint8Array, width: number, height: number, options: RegionOptions, passId: string) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8000 || height > 8000 || width * height > 16_000_000) throw new Error("IMAGE_SIZE_LIMIT");
  if (delta.length !== width * height || !Number.isInteger(options.diffThreshold) || options.diffThreshold < 0 || options.diffThreshold > 255 || !Number.isInteger(options.groupingRadius) || options.groupingRadius < 0 || options.groupingRadius > 32 || !Number.isFinite(options.minArea) || options.minArea < 0 || !Number.isFinite(options.maxAreaFraction) || options.maxAreaFraction <= 0 || options.maxAreaFraction > 1) throw new Error("INVALID_REGION_OPTIONS");
  const mask = Uint8Array.from(delta, (value) => value > options.diffThreshold ? 255 : 0);
  const rawChangedPixelCount = mask.reduce((count, value) => count + Number(value !== 0), 0);
  let work = 0;
  function boxes(roi: Bounds, radius: number): Bounds[] {
    work += roi.width * roi.height; if (work > 128_000_000) throw new Error("REGION_WORK_LIMIT");
    const owned: Array<{ delete(): void }> = [];
    const own = <T extends { delete(): void }>(item: T) => { owned.push(item); return item; };
    try {
      const input = own(new cv.Mat(roi.height, roi.width, cv.CV_8UC1)), dilated = own(new cv.Mat()), contours = own(new cv.MatVector()), hierarchy = own(new cv.Mat());
      for (let y = 0; y < roi.height; y++) input.data.set(mask.subarray((y + roi.y) * width + roi.x, (y + roi.y) * width + roi.x + roi.width), y * roi.width);
      if (radius) { const kernel = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(radius * 2 + 1, radius * 2 + 1))); cv.dilate(input, dilated, kernel); }
      cv.findContours(radius ? dilated : input, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      if (contours.size() > 5000) throw new Error("REGION_COUNT_LIMIT");
      const result: Bounds[] = [];
      for (let i = 0; i < contours.size(); i++) { const contour = contours.get(i); try { const rect = cv.boundingRect(contour); result.push({ ...rect, x: rect.x + roi.x, y: rect.y + roi.y }); } finally { contour.delete(); } }
      return result;
    } finally { for (const item of owned.reverse()) item.delete(); }
  }
  const maximum = width * height * options.maxAreaFraction, regions: Region[] = [];
  const initial = boxes({ x: 0, y: 0, width, height }, options.groupingRadius);
  for (const bounds of initial) {
    if (bounds.width * bounds.height < options.minArea) continue;
    let selected = [bounds], selectedRadius = options.groupingRadius;
    if (bounds.width * bounds.height > maximum) for (let radius = options.groupingRadius - 1; radius >= 0; radius--) {
      let candidates: Bounds[];
      try { candidates = boxes(bounds, radius).filter((rect) => rect.width * rect.height >= options.minArea); } catch (error) { if (error instanceof Error && error.message === "REGION_WORK_LIMIT") break; throw error; }
      if (candidates.length && Math.max(...candidates.map((r) => r.width * r.height)) < Math.max(...selected.map((r) => r.width * r.height))) { selected = candidates; selectedRadius = radius; }
      if (selected.every((r) => r.width * r.height <= maximum)) break;
    }
    for (const rect of selected) {
      let changedPixelCount = 0;
      for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) if (mask[y * width + x]) changedPixelCount++;
      regions.push({ id: `${passId}:${regions.length}`, bounds: rect, bboxArea: rect.width * rect.height, changedPixelCount, sourcePassId: passId, groupingRadius: selectedRadius, satisfiedMaxArea: rect.width * rect.height <= maximum });
      if (regions.length > 5000) throw new Error("REGION_COUNT_LIMIT");
    }
  }
  return { regions, rawChangedPixelCount };
}
