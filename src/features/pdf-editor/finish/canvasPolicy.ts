export const DEFAULT_CANVAS_MAX_SIDE = 4096;
export const DEFAULT_CANVAS_MAX_AREA = 4096 ** 2;
export const MEMORY_RESULT_LIMIT_BYTES = 200 * 1024 * 1024;
export const OUTPUT_WARNING_LIMIT_BYTES = 100 * 1024 * 1024;

export interface CanvasViewportSize {
  width: number;
  height: number;
}

export interface CanvasLimits {
  maxSide: number;
  maxArea: number;
}

export interface CanvasMeasurement {
  width: number;
  height: number;
  pixels: number;
  rgbaBytes: number;
  maxSideExceeded: boolean;
  maxAreaExceeded: boolean;
  allowed: boolean;
}

export interface DpiPolicyResult {
  requestedDpi: 150 | 200 | 300;
  appliedDpi: 150 | 200 | 300 | null;
  downgraded: boolean;
  supported: boolean;
  decision: "use-requested" | "use-lower-dpi" | "unsupported-reduce-range";
  attempts: Array<{ dpi: 150 | 200 | 300; measurement: CanvasMeasurement }>;
}

export interface RawRgbaResource {
  /** Pixel count for one live canvas or bitmap resource. */
  pixels: number;
  /** Raw RGBA bytes for one live resource; this must equal pixels * 4. */
  bytes: number;
  /** Number of identical resources alive at this point in time. */
  count: number;
}

/** One point in time, containing every canvas/bitmap resource still alive together. */
export interface RawRgbaLedgerEntry {
  resources: readonly RawRgbaResource[];
}

export interface RawRgbaLedgerTotal {
  pixels: number;
  bytes: number;
  resourceCount: number;
}

export interface BatchResourceMetrics {
  /** Work-volume metric only; it is not a peak-memory estimate or blocking gate. */
  cumulativePixels: number;
  /** Work-volume metric only; it is not used to calculate the raw RGBA peak. */
  cumulativeRawRgbaBytes: number;
  /** Per-time-point sums of the simultaneously live raw resources. */
  rawRgbaLedger: RawRgbaLedgerTotal[];
  /** Maximum of each time point's summed bytes, never the maximum individual resource. */
  peakRawRgbaBytes: number;
  /** Maximum of each time point's summed live-resource count. */
  peakRawResourceCount: number;
}

export type RasterOutputFormat = "png" | "jpeg";

/**
 * Locked U4-7 benchmark maxima for photo-scan final PDF bytes per selected
 * pixel (1/4/16 pages, desktop/Pixel 7 emulation, three recorded runs).
 */
export const RASTER_OUTPUT_BYTES_PER_PIXEL: Readonly<Record<`${150 | 200 | 300}-${RasterOutputFormat}`, number>> = Object.freeze({
  "150-png": 2.2751643072999026,
  "150-jpeg": 0.3164912799752287,
  "200-png": 2.2396780732368913,
  "200-jpeg": 0.3908593726170973,
  "300-png": 2.1839512794386713,
  "300-jpeg": 0.34944035329852374,
});

const DEFAULT_LIMITS = { maxSide: DEFAULT_CANVAS_MAX_SIDE, maxArea: DEFAULT_CANVAS_MAX_AREA };

export function measureCanvas(
  viewport: CanvasViewportSize,
  limits: CanvasLimits = DEFAULT_LIMITS,
): CanvasMeasurement {
  const values = [viewport.width, viewport.height, limits.maxSide, limits.maxArea];
  if (values.some((value) => !Number.isFinite(value)) || viewport.width <= 0 || viewport.height <= 0 || limits.maxSide <= 0 || limits.maxArea <= 0) {
    throw new RangeError("invalid-canvas-policy-input");
  }
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels)) throw new RangeError("canvas-area-overflow");
  const maxSideExceeded = width > limits.maxSide || height > limits.maxSide;
  const maxAreaExceeded = pixels > limits.maxArea;
  return { width, height, pixels, rgbaBytes: pixels * 4, maxSideExceeded, maxAreaExceeded, allowed: !maxSideExceeded && !maxAreaExceeded };
}

export function chooseCanvasDpi(input: {
  requestedDpi: 150 | 200 | 300;
  viewportAtDpi: (dpi: 150 | 200 | 300) => CanvasViewportSize;
  limits?: CanvasLimits;
}): DpiPolicyResult {
  const order = [300, 200, 150] as const;
  const start = order.indexOf(input.requestedDpi);
  const attempts: DpiPolicyResult["attempts"] = [];
  for (const dpi of order.slice(start)) {
    const measurement = measureCanvas(input.viewportAtDpi(dpi), input.limits);
    attempts.push({ dpi, measurement });
    if (measurement.allowed) {
      return {
        requestedDpi: input.requestedDpi,
        appliedDpi: dpi,
        downgraded: dpi !== input.requestedDpi,
        supported: true,
        decision: dpi === input.requestedDpi ? "use-requested" : "use-lower-dpi",
        attempts,
      };
    }
  }
  return {
    requestedDpi: input.requestedDpi,
    appliedDpi: null,
    downgraded: false,
    supported: false,
    decision: "unsupported-reduce-range",
    attempts,
  };
}

export function measureBatchResources(
  pages: readonly CanvasMeasurement[],
  rawLedger: readonly RawRgbaLedgerEntry[] = pages.map((page) => ({
    resources: [{ pixels: page.pixels, bytes: page.rgbaBytes, count: 1 }],
  })),
): BatchResourceMetrics {
  const cumulativePixels = pages.reduce((sum, page) => sum + page.pixels, 0);
  const ledgerTotals = rawLedger.map(({ resources }) => resources.reduce<RawRgbaLedgerTotal>((total, resource) => {
    if (!Number.isSafeInteger(resource.pixels)
        || resource.pixels < 0
        || !Number.isSafeInteger(resource.bytes)
        || resource.bytes < 0
        || resource.bytes !== resource.pixels * 4
        || !Number.isSafeInteger(resource.count)
        || resource.count < 1) {
      throw new RangeError("invalid-raw-ledger-resource");
    }
    const pixels = resource.pixels * resource.count;
    const bytes = resource.bytes * resource.count;
    if (!Number.isSafeInteger(pixels) || !Number.isSafeInteger(bytes)) throw new RangeError("raw-ledger-overflow");
    const next = {
      pixels: total.pixels + pixels,
      bytes: total.bytes + bytes,
      resourceCount: total.resourceCount + resource.count,
    };
    if (![next.pixels, next.bytes, next.resourceCount].every(Number.isSafeInteger)) throw new RangeError("raw-ledger-overflow");
    return next;
  }, { pixels: 0, bytes: 0, resourceCount: 0 }));
  return {
    cumulativePixels,
    cumulativeRawRgbaBytes: pages.reduce((sum, page) => sum + page.rgbaBytes, 0),
    rawRgbaLedger: ledgerTotals,
    peakRawRgbaBytes: ledgerTotals.length ? Math.max(...ledgerTotals.map(({ bytes }) => bytes)) : 0,
    peakRawResourceCount: ledgerTotals.length ? Math.max(...ledgerTotals.map(({ resourceCount }) => resourceCount)) : 0,
  };
}

export function estimateOutputWarning(input: {
  selectedPixels: number;
  bytesPerPixel: number;
  inputBytes: number;
  absoluteLimitBytes?: number;
}) {
  const { selectedPixels, bytesPerPixel, inputBytes } = input;
  if (![selectedPixels, bytesPerPixel, inputBytes].every(Number.isFinite) || selectedPixels < 0 || bytesPerPixel < 0 || inputBytes < 0) {
    throw new RangeError("invalid-output-estimate");
  }
  const estimatedBytes = selectedPixels * bytesPerPixel;
  const thresholdBytes = Math.min(inputBytes * 10, input.absoluteLimitBytes ?? OUTPUT_WARNING_LIMIT_BYTES);
  return { estimatedBytes, thresholdBytes, warn: estimatedBytes > thresholdBytes };
}

export function estimatePreflightOutputWarning(input: {
  selectedPagePixels: readonly number[];
  dpi: 150 | 200 | 300;
  format: RasterOutputFormat;
  coefficient: (dpi: 150 | 200 | 300, format: RasterOutputFormat) => number;
  inputBytes: number;
  absoluteLimitBytes?: number;
}) {
  if (input.selectedPagePixels.some((pixels) => !Number.isSafeInteger(pixels) || pixels < 0)) {
    throw new RangeError("invalid-selected-page-pixels");
  }
  return estimateOutputWarning({
    selectedPixels: input.selectedPagePixels.reduce((sum, pixels) => sum + pixels, 0),
    bytesPerPixel: input.coefficient(input.dpi, input.format),
    inputBytes: input.inputBytes,
    absoluteLimitBytes: input.absoluteLimitBytes,
  });
}

export function estimateRasterOutputWarning(input: {
  pages: readonly { pixels: number; dpi: 150 | 200 | 300 }[];
  format: RasterOutputFormat;
  inputBytes: number;
  absoluteLimitBytes?: number;
}) {
  if (input.pages.some(({ pixels }) => !Number.isSafeInteger(pixels) || pixels < 0)) {
    throw new RangeError("invalid-selected-page-pixels");
  }
  const estimatedBytes = input.pages.reduce(
    (sum, page) => sum + page.pixels * RASTER_OUTPUT_BYTES_PER_PIXEL[`${page.dpi}-${input.format}`],
    0,
  );
  const thresholdBytes = Math.min(input.inputBytes * 10, input.absoluteLimitBytes ?? OUTPUT_WARNING_LIMIT_BYTES);
  return { estimatedBytes, thresholdBytes, warn: estimatedBytes > thresholdBytes };
}

export function checkMemoryResultRegistration(
  retainedBytes: number,
  currentBytes: number,
  limitBytes = MEMORY_RESULT_LIMIT_BYTES,
) {
  if (![retainedBytes, currentBytes, limitBytes].every(Number.isSafeInteger) || retainedBytes < 0 || currentBytes < 0 || limitBytes < 1) {
    throw new RangeError("invalid-memory-registration-size");
  }
  const totalBytes = retainedBytes + currentBytes;
  return {
    retainedBytes,
    currentBytes,
    totalBytes,
    limitBytes,
    register: totalBytes <= limitBytes,
    decision: totalBytes <= limitBytes ? "register" as const : "discard-current-and-stop" as const,
  };
}
