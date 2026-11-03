export interface MapPoint { id: string; x: number; y: number }
export interface MapRect { x: number; y: number; width: number; height: number }
export interface MapLabel extends MapPoint { width: number; height: number }

export function rectanglesOverlap(a: MapRect, b: MapRect, gap = 0) {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap
    && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

/** Labels occupy their measured SVG boxes, independently of pin paint order. */
export function layoutMapLabels(labels: readonly MapLabel[], pins: readonly MapPoint[], width: number, height: number) {
  const placed: Array<MapLabel & MapRect> = [];
  const obstacles = pins.filter(p => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)
    .map(p => ({ x: p.x - 9, y: p.y - 20, width: 18, height: 24 }));
  const margin = 6;
  for (const label of labels) {
    const bounded = (x: number, y: number): MapRect => ({
      x: Math.max(margin, Math.min(width - label.width - margin, x)),
      y: Math.max(margin, Math.min(height - label.height - margin, y)),
      width: label.width, height: label.height,
    });
    const free = (rect: MapRect, avoidPins: boolean) => !placed.some(p => rectanglesOverlap(p, rect, 6))
      && (!avoidPins || !obstacles.some(p => rectanglesOverlap(p, rect, 3)));
    let chosen: MapRect | undefined;
    // Prefer nearby positions before searching farther from a dense cluster.
    for (let distance = 8; distance <= 200 && !chosen; distance += 12) {
      const x = label.x, y = label.y;
      const candidates = [
        bounded(x - label.width / 2, y - 20 - distance - label.height),
        bounded(x - label.width / 2, y + 4 + distance),
        bounded(x + 10 + distance, y - 8 - label.height / 2),
        bounded(x - 10 - distance - label.width, y - 8 - label.height / 2),
        bounded(x + distance, y - 20 - distance - label.height),
        bounded(x - distance - label.width, y - 20 - distance - label.height),
        bounded(x + distance, y + distance),
        bounded(x - distance - label.width, y + distance),
      ];
      chosen = candidates.find(rect => free(rect, true));
    }
    // A zoomed/panned-offscreen anchor can still keep its selected label visible.
    for (const avoidPins of [true, false]) {
      if (chosen) break;
      let bestDistance = Infinity;
      for (let y = margin; y + label.height <= height - margin; y += 8) for (let x = margin; x + label.width <= width - margin; x += 8) {
        const rect = bounded(x, y);
        if (!free(rect, avoidPins)) continue;
        const distance = (x + label.width / 2 - label.x) ** 2 + (y + label.height / 2 - label.y) ** 2;
        if (distance < bestDistance) { chosen = rect; bestDistance = distance; }
      }
    }
    // The map has at most six selected labels plus focus/hover; its 960×500
    // viewport leaves ample room. Keep the last-resort box bounded as well.
    placed.push({ ...label, ...(chosen ?? bounded(label.x - label.width / 2, label.y - label.height - 28)) });
  }
  return placed;
}

/** Resolve overlapping hit areas by geographic distance, never DOM paint order. */
export function nearestMapPin(pins: readonly MapPoint[], x: number, y: number) {
  let nearest: MapPoint | undefined, distance = Infinity;
  for (const pin of pins) {
    const next = (pin.x - x) ** 2 + (pin.y - 8 - y) ** 2;
    if (next < distance) { nearest = pin; distance = next; }
  }
  return nearest;
}
