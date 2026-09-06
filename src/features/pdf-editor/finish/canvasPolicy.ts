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

export interface RawRgbaLedgerEntry {
  pixels: number;
  simultaneousCopies?: number;
}

export interface BatchResourceMetrics {
  cumulativePixels: number;
  cumulativeRawRgbaBytes: number;
  peakRawRgbaBytes: number;
}

export type RasterOutputFormat = "png" | "jpeg";

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
  rawLedger: readonly RawRgbaLedgerEntry[] = pages,
): BatchResourceMetrics {
  const cumulativePixels = pages.reduce((sum, page) => sum + page.pixels, 0);
  const ledgers = rawLedger.map(({ pixels, simultaneousCopies = 1 }) => {
    if (!Number.isSafeInteger(pixels) || pixels < 0 || !Number.isSafeInteger(simultaneousCopies) || simultaneousCopies < 0) {
      throw new RangeError("invalid-raw-ledger");
    }
    return pixels * simultaneousCopies * 4;
  });
  return {
    cumulativePixels,
    cumulativeRawRgbaBytes: pages.reduce((sum, page) => sum + page.rgbaBytes, 0),
    peakRawRgbaBytes: ledgers.length ? Math.max(...ledgers) : 0,
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
