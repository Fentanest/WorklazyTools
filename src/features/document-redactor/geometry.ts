import { RedactorError, type MaskRect, type PageSize } from './types.ts';
export interface PixelRect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
export function validateMasks(rects: readonly MaskRect[]): void {
    if (!Array.isArray(rects) || rects.length > 1000)
        throw new RedactorError('invalid-masks');
    for (const r of rects)
        if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0 || r.x < 0 || r.y < 0 || r.x + r.w > 1 + Number.EPSILON || r.y + r.h > 1 + Number.EPSILON)
            throw new RedactorError('invalid-masks');
}
export function normalizedToPixelRect(size: PageSize, r: MaskRect, padding = 2): PixelRect {
    validateMasks([r]);
    const w = Math.ceil(size.width), h = Math.ceil(size.height);
    if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1)
        throw new RedactorError('dimensions');
    return { x0: Math.max(0, Math.floor(r.x * w) - padding), y0: Math.max(0, Math.floor(r.y * h) - padding), x1: Math.min(w, Math.ceil((r.x + r.w) * w) + padding), y1: Math.min(h, Math.ceil((r.y + r.h) * h) + padding) };
}
export function pointToNormalized(x: number, y: number, box: {
    left: number;
    top: number;
    width: number;
    height: number;
}) {
    if (![x, y, box.left, box.top, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0)
        throw new RedactorError('invalid-masks');
    return { x: Math.min(1, Math.max(0, (x - box.left) / box.width)), y: Math.min(1, Math.max(0, (y - box.top) / box.height)) };
}
/** Union membership is independent of painting order and does not allocate a page-sized mask. */
export function rowIntervals(rects: readonly PixelRect[], y: number): Array<[
    number,
    number
]> {
    const rows = rects.filter(r => y >= r.y0 && y < r.y1).map(r => [r.x0, r.x1] as [
        number,
        number
    ]).sort((a, b) => a[0] - b[0]);
    const out: Array<[
        number,
        number
    ]> = [];
    for (const r of rows) {
        const last = out.at(-1);
        if (last && r[0] <= last[1])
            last[1] = Math.max(last[1], r[1]);
        else
            out.push(r);
    }
    return out;
}
export function validatePageMasks(masksByPage: Readonly<Record<number, readonly MaskRect[]>>, pageCount: number): void {
    let totalMasks = 0;
    for (const [key, masks] of Object.entries(masksByPage)) {
        if (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(Number(key)) || Number(key) >= pageCount)
            throw new RedactorError('invalid-masks');
        validateMasks(masks);
        totalMasks += masks.length;
    }
    if (!totalMasks)
        throw new RedactorError('no-masks');
    if (totalMasks > 1000)
        throw new RedactorError('invalid-masks');
}
