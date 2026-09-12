import type { MaskRect, PageSize } from './types';

export type MasksByPage = Record<number, MaskRect[]>;
export interface MaskHistory { past: MasksByPage[]; present: MasksByPage; future: MasksByPage[] }

const copy = (value: MasksByPage): MasksByPage => Object.fromEntries(
  Object.entries(value).map(([page, masks]) => [page, masks.map(mask => ({ ...mask }))]),
);

export const emptyMaskHistory = (): MaskHistory => ({ past: [], present: {}, future: [] });
export const commitMasks = (history: MaskHistory, next: MasksByPage): MaskHistory => ({
  past: [...history.past, copy(history.present)], present: copy(next), future: [],
});
export const undoMasks = (history: MaskHistory): MaskHistory => history.past.length === 0 ? history : ({
  past: history.past.slice(0, -1), present: copy(history.past.at(-1)!), future: [copy(history.present), ...history.future],
});
export const redoMasks = (history: MaskHistory): MaskHistory => history.future.length === 0 ? history : ({
  past: [...history.past, copy(history.present)], present: copy(history.future[0]), future: history.future.slice(1),
});

export function clampMask(mask: MaskRect, page: PageSize): MaskRect {
  void page;
  const w = Math.max(Number.EPSILON, Math.min(1, mask.w));
  const h = Math.max(Number.EPSILON, Math.min(1, mask.h));
  return { x: Math.max(0, Math.min(1 - w, mask.x)), y: Math.max(0, Math.min(1 - h, mask.y)), w, h };
}

export function clientDelta(dx: number, dy: number, rect: Pick<DOMRect, 'width'|'height'>, page: PageSize) {
  void page;
  return { x: rect.width ? dx / rect.width : 0, y: rect.height ? dy / rect.height : 0 };
}

export const countMasks = (masks: MasksByPage) => Object.values(masks).reduce((sum, page) => sum + page.length, 0);
export const unmaskedPages = (masks: MasksByPage, pages: number) => Array.from({ length: pages }, (_, i) => i).filter(i => !(masks[i]?.length));
