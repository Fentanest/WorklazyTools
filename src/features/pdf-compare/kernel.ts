import type { PageMapping, PixelThreshold, RenderGeometry, PageText, PageComparison } from './types.ts';
export class PdfCompareError extends Error {
  readonly code: import('./types.ts').PdfCompareErrorCode;
  constructor(code: import('./types.ts').PdfCompareErrorCode) { super(code); this.code = code; this.name = 'PdfCompareError'; }
}
export function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); }
export function indexMapping(before: number, after: number): PageMapping[] {
  return Array.from({ length: Math.max(before, after) }, (_, i) => ({ before: i < before ? i : null, after: i < after ? i : null }));
}
export function validateMapping(mapping: PageMapping[], beforeCount: number, afterCount: number): PageMapping[] {
  const seen = { before: new Set<number>(), after: new Set<number>() };
  if (!mapping.length) throw new PdfCompareError('invalid-mapping');
  for (const row of mapping) {
    if (row.before === null && row.after === null) throw new PdfCompareError('invalid-mapping');
    for (const side of ['before', 'after'] as const) {
      const n = row[side]; const count = side === 'before' ? beforeCount : afterCount;
      if (n !== null) {
        if (!Number.isInteger(n) || n < 0 || n >= count || seen[side].has(n)) throw new PdfCompareError('invalid-mapping');
        seen[side].add(n);
      }
    }
  }
  return mapping.map(row => ({ ...row }));
}
export function textFromItems(items: readonly { str: string; hasEOL: boolean }[]): PageText {
  return { text: items.map(item => item.str + (item.hasEOL ? '\n' : '')).join(''), available: items.some(item => item.str.length > 0) };
}
export function pairedGeometry(before: { width: number; height: number } | null, after: { width: number; height: number } | null): RenderGeometry {
  const w = Math.max(before?.width ?? 0, after?.width ?? 0), h = Math.max(before?.height ?? 0, after?.height ?? 0);
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) throw new PdfCompareError('render-failed');
  const factor = Math.min(1, 4096 / w, 4096 / h, Math.sqrt(4096 ** 2 / (w * h)));
  return { width: Math.min(4096, Math.ceil(w * factor)), height: Math.min(4096, Math.ceil(h * factor)),
    beforeWidth: before ? Math.min(4096, Math.ceil(before.width * factor)) : 0, beforeHeight: before ? Math.min(4096, Math.ceil(before.height * factor)) : 0,
    afterWidth: after ? Math.min(4096, Math.ceil(after.width * factor)) : 0, afterHeight: after ? Math.min(4096, Math.ceil(after.height * factor)) : 0,
    scaleFactor: factor, dpi: 96 * factor, reducedResolution: factor < 1,
    pageSizeChanged: !!before && !!after && (before.width !== after.width || before.height !== after.height) };
}
export function compareRgb(before: Uint8ClampedArray, after: Uint8ClampedArray, threshold: PixelThreshold, overlay = false) {
  if (![0, 16, 32].includes(threshold) || before.length !== after.length || !before.length || before.length % 4) throw new PdfCompareError('render-failed');
  let count = 0; const diff = overlay ? new Uint8ClampedArray(before.length) : undefined;
  for (let i = 0; i < before.length; i += 4) {
    if (before[i + 3] !== 255 || after[i + 3] !== 255) throw new PdfCompareError('render-failed');
    const changed = Math.max(Math.abs(before[i] - after[i]), Math.abs(before[i + 1] - after[i + 1]), Math.abs(before[i + 2] - after[i + 2])) > threshold;
    if (changed) count++;
    if (diff && changed) { diff[i] = 220; diff[i + 1] = 38; diff[i + 2] = 38; diff[i + 3] = 180; }
  }
  return { count, ratio: count / (before.length / 4), diff };
}
export function pendingPage(mapping: PageMapping, threshold: PixelThreshold): PageComparison {
  return { mapping: { ...mapping }, status: 'unknown', beforeTextAvailable: false, afterTextAvailable: false, beforeText: '', afterText: '', textComparison: 'unavailable', segments: [], visualComparison: 'unknown', pixelCount: null, pixelRatio: null, threshold, geometry: null, warnings: ['extraction-limit'] };
}
