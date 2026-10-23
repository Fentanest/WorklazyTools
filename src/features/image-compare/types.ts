export interface Bounds { x: number; y: number; width: number; height: number }
export type Matrix = [number, number, number, number, number, number];
export interface Transform { x: number; y: number; degrees: number; scale: number; flipX: boolean; flipY: boolean }
export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, degrees: 0, scale: 1, flipX: false, flipY: false };
export interface PixelOptions { threshold: number; includeAA: boolean; alphaThreshold: number; background: "transparent" | "white" | "black" }
export const DEFAULT_PIXEL_OPTIONS: PixelOptions = { threshold: 0.1, includeAA: true, alphaThreshold: 0, background: "transparent" };
export interface ImageMetadata { name: string; bytes: number; mime: string; width: number; height: number; decodedWidth?: number; decodedHeight?: number; bitDepth: number; exifOrientation: number; decodeOrientation: "from-image"; workingColorSpace: "8-bit sRGB" }
export interface RegionOptions { diffThreshold: number; groupingRadius: number; minArea: number; maxAreaFraction: number }
export const DEFAULT_REGION_OPTIONS: RegionOptions = { diffThreshold: 20, groupingRadius: 7, minArea: 53, maxAreaFraction: 0.15 };
export interface Region { sourcePolygons?: { left: Array<{ x: number; y: number }>; right: Array<{ x: number; y: number }> }; id: string; bounds: Bounds; bboxArea: number; changedPixelCount: number; sourcePassId: string; groupingRadius: number; satisfiedMaxArea: boolean }
export interface RegionPass { nativeHeapBytes: number; id: string; sourceRunId: string; options: RegionOptions; requestedOptions?:RegionOptions; workingScale?:number; optionUnits?:"original-image-pixels"; regions: Region[]; rawChangedPixelCount: number; engine: string }
export interface ImageCompareResult {
  quality: { mode: "full-resolution"|"reduced-resolution"; scale:number; originalWidth:number;originalHeight:number;workingWidth:number;workingHeight:number;resizePasses:0|1;/** One geometric sampling pass directly from each original; never from a prior working result. */ samplingPassesPerSource:1;pixelUnits:"working-pixels"; resources: ReturnType<typeof import("./memory.ts").imageMemoryEstimate> };
  runId: string; engine: "pixelmatch-7.1.0-rgba-v1"; width: number; height: number;
  left: Uint8ClampedArray; right: Uint8ClampedArray; leftValid: Uint8Array; rightValid: Uint8Array;
  changedMask: Uint8Array; channelDelta: Uint8Array; overlay: Uint8ClampedArray; subtract: Uint8ClampedArray;
  changedPixelCount: number; comparablePixelCount: number; differenceRatio: number;
  addedBoundaryPixelCount: number; removedBoundaryPixelCount: number;
  sources: { left: ImageMetadata; right: ImageMetadata }; options: PixelOptions;
  geometry: { originX: number; originY: number; leftMatrix: Matrix; rightMatrix: Matrix; rightTransform: Transform; /** Authoritative when present; rightMatrix remains the legacy affine-only field. */ rightProjective?: import("./alignmentTypes.ts").Matrix3 };
}
export const IMAGE_LIMITS = { fileBytes: 32 * 1024 * 1024, sourcePixels: 12_000_000, outputPixels: 16_000_000, dimension: 8000, memoryBytes: 256 * 1024 * 1024 };
