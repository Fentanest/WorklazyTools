export function windowIndices(total: number, count: number, start: number): number[] {
  if (total <= 0) return [];
  return Array.from({ length: Math.min(total, count) }, (_, i) => ((start + i) % total + total) % total);
}
export function advanceIndex(total: number, start: number, step: number): number {
  return total > 0 ? ((start + step) % total + total) % total : 0;
}
export type Playback = Readonly<{ enabled: boolean; paused: boolean; reduced: boolean; hover: boolean; focus: boolean; visible: boolean; background: boolean }>;
export function canPlay(s: Playback, total: number, count: number): boolean {
  return total > count && s.enabled && !s.paused && !s.reduced && !s.hover && !s.focus && s.visible && !s.background;
}
