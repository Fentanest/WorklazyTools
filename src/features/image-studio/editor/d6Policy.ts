/** Pure D6 policy. IE1 samples device signals once when the editing session opens. */
export type D6Candidate = 'primary-pointer' | 'coarse-or-touch-screen' | 'touch-memory-assisted';
export interface D6Signals {
  readonly primaryPointerCoarse?: boolean | null;
  readonly maxTouchPoints?: number | null;
  /** Orientation-independent short edge of screen in CSS pixels, NOT viewport width. */
  readonly screenShortEdgeCssPx?: number | null;
  readonly deviceMemoryGiB?: number | null;
}
export type D6Tier = 'A' | 'B';
const positive = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Heuristic tier, not proof of hardware class. Missing decisive signals fail conservatively to A. */
export function classifyD6(signals: D6Signals, candidate: D6Candidate = 'coarse-or-touch-screen'): D6Tier {
  if (signals.primaryPointerCoarse === true) return 'A';
  if (signals.primaryPointerCoarse !== false) return 'A';
  if (candidate === 'primary-pointer') return 'B';
  const touches = signals.maxTouchPoints;
  if (typeof touches !== 'number' || !Number.isInteger(touches) || touches < 0) return 'A';
  if (touches === 0) return 'B';
  if (!positive(signals.screenShortEdgeCssPx)) return 'A';
  if (signals.screenShortEdgeCssPx <= 1100) return 'A';
  if (candidate === 'touch-memory-assisted' && positive(signals.deviceMemoryGiB) && signals.deviceMemoryGiB <= 4) return 'A';
  return 'B';
}

export function draftD6Props(tier: D6Tier) {
  const edge = tier === 'A' ? 4096 : 8192;
  return {
    jpegExportQuality: 95,
    resolutionLimits: {
      inputMaxDimension: edge,
      cropMaxPixels: edge ** 2,
      // IE1 uses the conservative A cap for flattened output and URL/blob imports too.
      flattenMaxPixels: edge ** 2,
      limitUrlInputs: true,
    },
  } as const;
}

export interface PixelSize { readonly width: number; readonly height: number }
/** Actual, orientation-normalized decoded dimensions from import; never inferred from configured caps. */
export function actualShrinkNotice(original: PixelSize, decoded: PixelSize, locale: 'ko' | 'en'): string | null {
  const valid = (s: PixelSize) => [s.width, s.height].every(n => Number.isSafeInteger(n) && n > 0);
  if (!valid(original) || !valid(decoded)) return null;
  if (decoded.width > original.width || decoded.height > original.height ||
      (decoded.width === original.width && decoded.height === original.height)) return null;
  const from = `${original.width}×${original.height}`;
  const to = `${decoded.width}×${decoded.height}`;
  return locale === 'ko'
    ? `이미지가 ${from}에서 ${to}픽셀로 줄어들었습니다. 현재 편집에는 줄어든 이미지를 사용합니다.`
    : `The image was reduced from ${from} to ${to} pixels. Editing uses the reduced image.`;
}

/** Full working-scene output, never the CSS/retina backing size or a source-photo upsample. */
export function flattenWorkingSceneTarget(surface: PixelSize, maxPixels: number): PixelSize | undefined {
  if (![surface.width, surface.height, maxPixels].every(n => Number.isSafeInteger(n) && n > 0)) return undefined;
  const scale = Math.min(1, Math.sqrt(maxPixels / (surface.width * surface.height)));
  let width = Math.max(1, Math.floor(surface.width * scale));
  let height = Math.max(1, Math.floor(surface.height * scale));
  // The one-pixel minimum can exceed an area cap for extremely thin surfaces.
  if (width * height > maxPixels) {
    if (width >= height) width = Math.floor(maxPixels / height);
    else height = Math.floor(maxPixels / width);
  }
  return { width, height };
}
