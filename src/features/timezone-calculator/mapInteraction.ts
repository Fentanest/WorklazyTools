/** CSS pixels: the same hand-movement tolerance at every map/viewport scale. */
export const MAP_DRAG_THRESHOLD_PX = 6;

export function exceedsMapDragThreshold(startX: number, startY: number, x: number, y: number) {
  return (x - startX) ** 2 + (y - startY) ** 2 > MAP_DRAG_THRESHOLD_PX ** 2;
}
