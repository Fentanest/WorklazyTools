export interface MapPoint { id: string; x: number; y: number }
export interface MapRect { x: number; y: number; width: number; height: number }
export interface MapLabel extends MapPoint { width: number; height: number }
export interface LeaderPoint { x: number; y: number }
export interface MapLabelPlacement extends MapLabel, MapRect { leaderStart: LeaderPoint; leaderEnd: LeaderPoint; leaderPath: LeaderPoint[] }

function pathSegments(points: readonly LeaderPoint[]) { return points.slice(1).map((point, i) => [points[i], point] as const); }

export function segmentDistanceSquared(point: LeaderPoint, a: LeaderPoint, b: LeaderPoint) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = dx || dy ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
}

/** Includes touching/collinear segments and a small visual separation. */
export function leaderSegmentsCross(a: LeaderPoint, b: LeaderPoint, c: LeaderPoint, d: LeaderPoint, gap = 1) {
  if (Math.max(a.x, b.x) + gap < Math.min(c.x, d.x) || Math.max(c.x, d.x) + gap < Math.min(a.x, b.x)
    || Math.max(a.y, b.y) + gap < Math.min(c.y, d.y) || Math.max(c.y, d.y) + gap < Math.min(a.y, b.y)) return false;
  const cross = (p: LeaderPoint, q: LeaderPoint, r: LeaderPoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
  return Math.min(segmentDistanceSquared(a, c, d), segmentDistanceSquared(b, c, d), segmentDistanceSquared(c, a, b), segmentDistanceSquared(d, a, b)) <= gap * gap;
}

function leaderHitsRect(a: LeaderPoint, b: LeaderPoint, rect: MapRect) {
  const x = rect.x - 2, y = rect.y - 2, right = rect.x + rect.width + 2, bottom = rect.y + rect.height + 2;
  if (Math.max(a.x, b.x) < x || Math.min(a.x, b.x) > right || Math.max(a.y, b.y) < y || Math.min(a.y, b.y) > bottom) return false;
  if ((a.x >= x && a.x <= right && a.y >= y && a.y <= bottom) || (b.x >= x && b.x <= right && b.y >= y && b.y <= bottom)) return true;
  const p = [{ x, y }, { x: right, y }, { x: right, y: bottom }, { x, y: bottom }];
  return p.some((point, i) => leaderSegmentsCross(a, b, point, p[(i + 1) % 4], 0));
}

const PORTS = Array.from({ length: 32 }, (_, i) => ({ x: Math.cos(i * Math.PI / 16) * 7, y: Math.sin(i * Math.PI / 16) * 7 }));
const ORDER_ROUTE_BUDGET = 3_000;
const GRID_ROUTE_BUDGET = 24_000;
const RECTANGLE_BUDGET = 2_048;

function visibleLeaderStart(start: LeaderPoint, end: LeaderPoint, width: number, height: number) {
  let t = 0;
  if (start.x < 0) t = Math.max(t, -start.x / (end.x - start.x));
  if (start.x > width) t = Math.max(t, (width - start.x) / (end.x - start.x));
  if (start.y < 0) t = Math.max(t, -start.y / (end.y - start.y));
  if (start.y > height) t = Math.max(t, (height - start.y) / (end.y - start.y));
  return { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) };
}

export function rectanglesOverlap(a: MapRect, b: MapRect, gap = 0) {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap
    && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

export function mapLeaderEnd(anchor: MapPoint, rect: MapRect) {
  return { x: Math.max(rect.x, Math.min(rect.x + rect.width, anchor.x)), y: Math.max(rect.y, Math.min(rect.y + rect.height, anchor.y - 10)) };
}

export function mapLeaderIntersectsPin(anchor: MapPoint, rect: MapRect, pin: MapPoint, radius = 9) {
  const start = { x: anchor.x, y: anchor.y - 10 }, end = mapLeaderEnd(anchor, rect);
  const dx = end.x - start.x, dy = end.y - start.y;
  const fraction = dx || dy ? Math.max(0, Math.min(1, ((pin.x - start.x) * dx + (pin.y - 10 - start.y) * dy) / (dx * dx + dy * dy))) : 0;
  return (start.x + fraction * dx - pin.x) ** 2 + (start.y + fraction * dy - (pin.y - 10)) ** 2 < radius ** 2;
}

/** Labels occupy their measured SVG boxes, independently of pin paint order. */
export function layoutMapLabels(labels: readonly MapLabel[], pins: readonly MapPoint[], width: number, height: number) {
  const obstacles = pins.filter(p => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)
    .map(p => ({ x: p.x - 9, y: p.y - 20, width: 18, height: 24 }));
  const margin = 6;
  const ordered = labels.map(label => ({ label, ports: PORTS.map(p => ({ x: label.x + p.x, y: label.y - 10 + p.y }))
    .filter(p => pins.every(pin => pin.id === label.id || (p.x - pin.x) ** 2 + (p.y - (pin.y - 10)) ** 2 >= 100)),
    neighbours: pins.filter(pin => pin.id !== label.id).map(pin => ({ x: pin.x, y: pin.y - 10 })), }))
    .sort((a, b) => a.ports.length - b.ports.length || b.label.y - a.label.y || a.label.x - b.label.x);
  const tryOrder = (order: typeof ordered, allowGrid: boolean) => {
    const placed: MapLabelPlacement[] = [];
    const placedSegments: ReturnType<typeof pathSegments>[] = [];
    let routeChecks = 0, rectangleChecks = 0, exhausted = false;
    const routeBudget = allowGrid ? GRID_ROUTE_BUDGET : ORDER_ROUTE_BUDGET;
    // Give crowded pins their limited escape directions before unconstrained ones.
    for (const { label, ports, neighbours } of order) {
      const visited = new Set<string>();
      const bounded = (x: number, y: number): MapRect => ({
        x: Math.max(margin, Math.min(width - label.width - margin, x)),
        y: Math.max(margin, Math.min(height - label.height - margin, y)),
        width: label.width, height: label.height,
      });
      const free = (rect: MapRect, avoidPins: boolean) => !placed.some((p, i) => rectanglesOverlap(p, rect, 6) || placedSegments[i].some(([a, b]) => leaderHitsRect(a, b, rect)))
        && (!avoidPins || !obstacles.some(p => rectanglesOverlap(p, rect, 3)));
      // Start at an exposed point on the pin body, not at a centre already
      // covered by another pin. This preserves geographic pin positions.
      let chosen: MapLabelPlacement | undefined;
      let fallback: MapLabelPlacement | undefined;
      let fallbackCost = Infinity;
      const tryRect = (rect: MapRect, avoidPins = true) => {
        if (exhausted) return undefined;
        const key = `${rect.x}:${rect.y}:${avoidPins}`;
        if (visited.has(key)) return undefined;
        visited.add(key);
        if (++rectangleChecks > RECTANGLE_BUDGET) { exhausted = true; return undefined; }
        if (!free(rect, avoidPins)) return undefined;
        const end = mapLeaderEnd(label, rect);
        if (!ports.length) { const start = { x: label.x, y: label.y - 10 }; return { ...label, ...rect, leaderStart: start, leaderEnd: end, leaderPath: [start, end] }; }
        const starts = [...ports].sort((a, b) => (a.x - end.x) ** 2 + (a.y - end.y) ** 2 - (b.x - end.x) ** 2 - (b.y - end.y) ** 2);
        for (const port of starts) {
          // Offscreen parts were clipped by SVG anyway; do not route around
          // invisible crossings or let them obstruct visible label candidates.
          const start = visibleLeaderStart(port, end, width, height);
          const routes = [[start, end], [start, { x: start.x, y: end.y }, end], [start, { x: end.x, y: start.y }, end]];
          for (const delta of [-12, 12, -24, 24, -48, 48]) {
            const x = start.x + delta, y = start.y + delta;
            if (x >= 0 && x <= width) routes.push([start, { x, y: start.y }, { x, y: end.y }, end]);
            if (y >= 0 && y <= height) routes.push([start, { x: start.x, y }, { x: end.x, y }, end]);
          }
          for (const route of routes) {
            if (++routeChecks > routeBudget) { exhausted = true; return undefined; }
            const segments = pathSegments(route).filter(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) > .01);
            const blocked = segments.some(([a, b]) => leaderHitsRect(a, b, { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: rect.height - 6 })
              || neighbours.some(pin => pin.x >= Math.min(a.x, b.x) - 10 && pin.x <= Math.max(a.x, b.x) + 10
              && pin.y >= Math.min(a.y, b.y) - 10 && pin.y <= Math.max(a.y, b.y) + 10 && segmentDistanceSquared(pin, a, b) < 100)
              || placed.some((p, i) => placedSegments[i].some(([c, d]) => leaderSegmentsCross(a, b, c, d)) || leaderHitsRect(a, b, p)));
            const result = { ...label, ...rect, leaderStart: start, leaderEnd: end, leaderPath: route };
            if (!blocked) return result;
            const cost = segments.reduce((sum, [a, b]) => sum + Math.hypot(a.x - b.x, a.y - b.y), 0);
            if (cost < fallbackCost) { fallback = result; fallbackCost = cost; }
          }
        }
        return undefined;
      };
      // Prefer nearby positions before searching farther from a dense cluster.
      for (let distance = 8; distance <= 200 && !chosen && !exhausted; distance += 12) {
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
        for (const rect of candidates) { chosen = tryRect(rect); if (chosen) break; }
      }
      if (!chosen && !allowGrid) return undefined;
      // A zoomed/panned-offscreen anchor can still keep its selected label visible.
      for (const avoidPins of [true, false]) {
        if (chosen) break;
        for (let y = margin; y + label.height <= height - margin && !chosen && !exhausted; y += 20) for (let x = margin; x + label.width <= width - margin && !exhausted; x += 20) {
          chosen = tryRect(bounded(x, y), avoidPins); if (chosen) break;
        }
      }
      // The map has at most six selected labels plus focus/hover; its 960×500
      // viewport leaves ample room. Keep the last-resort box bounded as well.
      const rect = bounded(label.x - label.width / 2, label.y - label.height - 28);
      const start = { x: label.x, y: label.y - 10 }, end = mapLeaderEnd(label, rect);
      placed.push(chosen ?? fallback ?? { ...label, ...rect, leaderStart: start, leaderEnd: end, leaderPath: [start, end] });
      placedSegments.push(pathSegments(placed[placed.length - 1].leaderPath));
    }
    return placed;
  };
  // A first route can consume another pin's only escape direction. Retry a
  // bounded set of cyclic priorities instead of accepting that crossing.
  for (let offset = 0; offset < ordered.length; offset++) {
    const result = tryOrder(ordered.slice(offset).concat(ordered.slice(0, offset)), false);
    if (result) return result;
  }
  return tryOrder(ordered, true)!;
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
