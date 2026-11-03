import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { DateTime } from "luxon";
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";

import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { cityName, countryName, type WorldCity } from "./cities";
import { layoutMapLabels, nearestMapPin } from "./mapLayout";
import { exceedsMapDragThreshold } from "./mapInteraction";

const MAP_WIDTH = 960;
const MAP_HEIGHT = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const topology = worldAtlas as unknown as Topology;
const countries = feature(topology, topology.objects.countries) as unknown as FeatureCollection;

interface WorldTimeMapProps {
  cities: readonly WorldCity[];
  selectedIds: readonly string[];
  baseCityId: string;
  instant: DateTime;
  selectionLimit: number;
  onToggle: (cityId: string) => void;
  language: "ko" | "en";
}

interface PanPoint {
  x: number;
  y: number;
}

interface LabelMetrics { width: number; height: number; offsetY: number }

export function WorldTimeMap({ cities, selectedIds, baseCityId, instant, selectionLimit, onToggle, language }: WorldTimeMapProps) {
  const { t } = useTranslation("features");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [metrics, setMetrics] = useState<Record<string, LabelMetrics>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const textRefs = useRef(new Map<string, SVGTextElement>());
  const dragRef = useRef<{ pointerId: number; x: number; y: number; pan: PanPoint; moved: boolean; capture: SVGElement } | undefined>(undefined);
  const suppressPointerClick = useRef(false);
  const projection = useMemo(() => geoEqualEarth().fitExtent([[18, 18], [MAP_WIDTH - 18, MAP_HEIGHT - 18]], { type: "Sphere" }), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const countryPaths = useMemo(() => countries.features.map((country) => path(country) ?? ""), [path]);
  const graticulePath = useMemo(() => path(geoGraticule10()) ?? "", [path]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pins = useMemo(() => cities.flatMap(city => {
    const point = projection([...city.coordinates]);
    if (!point) return [];
    const local = instant.setZone(city.zone);
    const time = local.isValid ? local.toFormat("HH:mm") : "--:--";
    return [{
      ...city,
      x: MAP_WIDTH / 2 + (point[0] - MAP_WIDTH / 2) * zoom + pan.x,
      y: MAP_HEIGHT / 2 + (point[1] - MAP_HEIGHT / 2) * zoom + pan.y,
      text: `${cityName(city, language)} ${time}`,
      accessibleLabel: `${cityName(city, language)}, ${countryName(city, language)} · ${local.isValid ? time : t("timezone.map.unavailable")}`,
    }];
  }), [cities, projection, instant, language, zoom, pan, t]);
  const labelPins = useMemo(() => pins.filter(city => selected.has(city.id) || city.id === hoveredId || city.id === focusedId), [pins, selected, hoveredId, focusedId]);
  const labelSignature = labelPins.map(city => `${city.id}:${city.text}`).join("|");

  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active) return;
      const next: Record<string, LabelMetrics> = {};
      for (const city of labelPins) {
        const text = textRefs.current.get(city.id);
        if (!text) continue;
        const box = text.getBBox();
        next[city.id] = { width: box.width, height: box.height, offsetY: box.y - text.y.baseVal.getItem(0).value };
      }
      setMetrics(previous => Object.keys(previous).length === Object.keys(next).length && Object.entries(next).every(([id, value]) => {
        const old = previous[id];
        return old && Math.abs(old.width - value.width) < .1 && Math.abs(old.height - value.height) < .1 && Math.abs(old.offsetY - value.offsetY) < .1;
      }) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (svgRef.current) observer.observe(svgRef.current);
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
    // Only the label identities/text affect measurement; zoom and pan move the
    // boxes without changing the glyphs. ResizeObserver covers responsive fonts.
  }, [labelSignature]);

  const labels = useMemo(() => layoutMapLabels(labelPins.map(city => {
    const size = metrics[city.id] ?? { width: city.text.length * 10, height: 18 };
    return { id: city.id, x: city.x, y: city.y, width: size.width + 6, height: size.height + 6 };
  }), pins, MAP_WIDTH, MAP_HEIGHT), [labelPins, pins, metrics]);

  const pointerPin = (event: MouseEvent<SVGGElement> | PointerEvent<SVGGElement>) => {
    const transform = svgRef.current?.getScreenCTM();
    if (!transform) return undefined;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
    // A pin whose center is just outside the clip can still have a visible,
    // clickable edge. Include it rather than redirecting that click far away.
    return nearestMapPin(pins, point.x, point.y);
  };

  const setZoomLevel = (nextValue: number) => {
    const next = clamp(nextValue, MIN_ZOOM, MAX_ZOOM);
    setZoom(next);
    setPan((current) => next === 1 ? { x: 0, y: 0 } : clampPan(current, next));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const startDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressPointerClick.current = false;
    setFocusedId(undefined);
    // Capturing the pressed pin preserves ordinary clicks; capturing the SVG
    // would retarget its click to the background. Moves still bubble to SVG.
    const capture = (event.target as Element).closest<SVGElement>('[data-testid="timezone-map-pin"]') ?? event.currentTarget;
    capture.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan, moved: false, capture };
  };

  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && exceedsMapDragThreshold(drag.x, drag.y, event.clientX, event.clientY)) {
      drag.moved = true;
      setHoveredId(undefined);
    }
    if (!drag.moved || zoom <= 1) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = MAP_WIDTH / bounds.width;
    const scaleY = MAP_HEIGHT / bounds.height;
    setPan(clampPan({
      x: drag.pan.x + (event.clientX - drag.x) * scaleX,
      y: drag.pan.y + (event.clientY - drag.y) * scaleY,
    }, zoom));
  };

  const stopDrag = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressPointerClick.current = drag.moved || event.type !== "pointerup";
    dragRef.current = undefined;
    if (drag.capture.hasPointerCapture(event.pointerId)) drag.capture.releasePointerCapture(event.pointerId);
  };

  const mapTransform = `translate(${MAP_WIDTH / 2 + pan.x} ${MAP_HEIGHT / 2 + pan.y}) scale(${zoom}) translate(${-MAP_WIDTH / 2} ${-MAP_HEIGHT / 2})`;

  return (
    <div className="overflow-hidden rounded-[18px] border border-sky-600/15 bg-[linear-gradient(145deg,rgba(21,155,215,.08),rgba(0,122,255,.025))]" data-testid="timezone-world-map">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-sky-600/15 py-2 pr-2.5 pl-[13px] max-[620px]:items-start">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground max-[620px]:gap-[7px]" role="group" aria-label={t("timezone.map.legend")}>
          <span className="inline-flex items-center gap-1.5"><i className="block size-2 rounded-full bg-sky-600 shadow-[0_0_0_3px_rgba(21,155,215,.12)]" /> {t("timezone.map.selected")}</span>
          <span className="inline-flex items-center gap-1.5"><i className="block size-2 rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(245,139,0,.12)]" /> {t("timezone.map.base")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-background p-[3px]" data-testid="timezone-map-controls" role="group" aria-label={t("timezone.map.controls")}>
          <Button className="size-[29px] rounded-lg text-sky-700 hover:bg-sky-500/10 dark:text-sky-300" size="icon-xs" variant="ghost" type="button" onClick={() => setZoomLevel(zoom - 0.5)} disabled={zoom <= MIN_ZOOM} aria-label={t("timezone.map.zoomOut")}><Minus size={16} /></Button>
          <output className="min-w-[38px] text-center text-xs font-bold text-muted-foreground" aria-label={t("timezone.map.zoom")}>{Math.round(zoom * 100)}%</output>
          <Button className="size-[29px] rounded-lg text-sky-700 hover:bg-sky-500/10 dark:text-sky-300" size="icon-xs" variant="ghost" type="button" onClick={() => setZoomLevel(zoom + 0.5)} disabled={zoom >= MAX_ZOOM} aria-label={t("timezone.map.zoomIn")}><Plus size={16} /></Button>
          <Button className="size-[29px] rounded-lg text-sky-700 hover:bg-sky-500/10 dark:text-sky-300" size="icon-xs" variant="ghost" type="button" onClick={resetView} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} aria-label={t("timezone.map.reset")}><RotateCcw size={15} /></Button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label={t("timezone.map.aria", { total: cities.length, selected: selectedIds.length, limit: selectionLimit })}
          className={cn("block h-auto w-full touch-pan-y select-none", zoom > 1 && "cursor-grab touch-none active:cursor-grabbing")}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={stopDrag}
          onClickCapture={event => {
            if (event.detail > 0 && suppressPointerClick.current) {
              suppressPointerClick.current = false;
              event.preventDefault(); event.stopPropagation();
            }
          }}
        >
          <defs><clipPath id="world-time-map-clip"><rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="24" /></clipPath></defs>
          <rect className="fill-sky-500/5" width={MAP_WIDTH} height={MAP_HEIGHT} rx="24" />
          <g clipPath="url(#world-time-map-clip)">
            <g transform={mapTransform} className="pointer-events-none" aria-hidden="true">
              <path className="fill-none stroke-sky-600/15 [stroke-width:.8] [vector-effect:non-scaling-stroke]" d={graticulePath} />
              {countryPaths.map((countryPath, index) => <path className="fill-card stroke-sky-600/25 transition-[fill] [stroke-width:.7] [vector-effect:non-scaling-stroke]" d={countryPath} key={index} />)}
            </g>
            {pins.map((city) => {
              const isSelected = selected.has(city.id);
              const isBase = city.id === baseCityId;
              return (
                <g
                  className={cn("group/map-pin cursor-pointer text-muted-foreground outline-none hover:text-sky-600 focus-visible:text-sky-600 dark:hover:text-sky-400 dark:focus-visible:text-sky-400", isSelected && "text-sky-600 dark:text-sky-400", isBase && "text-orange-500 dark:text-orange-300")}
                  data-testid="timezone-map-pin"
                  data-city={city.id}
                  transform={`translate(${city.x} ${city.y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${city.accessibleLabel}${isBase ? ` · ${t("timezone.map.baseSuffix")}` : ""}`}
                  key={city.id}
                  onPointerEnter={(event) => { if (!dragRef.current?.moved) setHoveredId(pointerPin(event)?.id ?? city.id); }}
                  onPointerMove={(event) => { if (!dragRef.current?.moved) setHoveredId(pointerPin(event)?.id ?? city.id); }}
                  onPointerLeave={() => setHoveredId(undefined)}
                  onFocus={event => setFocusedId(event.currentTarget.matches(":focus-visible") ? city.id : undefined)}
                  onBlur={() => setFocusedId(undefined)}
                  onClick={(event) => {
                    event.stopPropagation();
                    const target = event.detail > 0 ? pointerPin(event)?.id ?? city.id : city.id;
                    onToggle(target);
                    if (target !== city.id) svgRef.current?.querySelector<SVGGElement>(`[data-city="${target}"]`)?.focus({ preventScroll: true });
                  }}
                  onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                    setFocusedId(event.currentTarget.matches(":focus-visible") ? city.id : undefined);
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onToggle(city.id);
                  }}
                >
                  <circle className="fill-transparent group-focus-visible/map-pin:fill-sky-500/15 group-focus-visible/map-pin:stroke-sky-600 [stroke-width:1.4]" cy={-8} r={15} />
                  <path className="fill-current stroke-card [filter:drop-shadow(0_2px_3px_rgba(0,0,0,.18))] [stroke-width:1.6]" d="M0 2C-1.5-1-7-5.5-7-11a7 7 0 1 1 14 0C7-5.5 1.5-1 0 2Z" />
                  <circle className="pointer-events-none fill-background" cy={-11} r={2.4} />
                </g>
              );
            })}
            <g className="pointer-events-none" aria-hidden="true" data-testid="timezone-map-labels">
              {labels.map(label => {
                const city = pins.find(pin => pin.id === label.id)!;
                const size = metrics[label.id];
                return <g key={label.id}>
                  <polyline data-testid="timezone-map-leader" data-city={label.id} className="fill-none stroke-sky-600/50 [stroke-width:1]" points={label.leaderPath.map(p => `${p.x},${p.y}`).join(" ")} />
                  <text
                    ref={element => { if (element) textRefs.current.set(label.id, element); else textRefs.current.delete(label.id); }}
                    data-testid="timezone-map-label" data-city={label.id}
                    className="fill-foreground stroke-background text-[13px] font-extrabold [paint-order:stroke] [stroke-width:4px] [text-anchor:middle] max-[620px]:text-base"
                    x={label.x + label.width / 2} y={label.y + 3 - (size?.offsetY ?? -13)}
                  >{city.text}</text>
                </g>;
              })}
            </g>
          </g>
        </svg>
      </div>
      <p className="m-0 border-t border-sky-600/10 px-3 pt-2 pb-2.5 text-center text-xs text-muted-foreground">{t("timezone.map.help")}</p>
    </div>
  );
}

function clampPan(point: PanPoint, zoom: number): PanPoint {
  const horizontalLimit = MAP_WIDTH * (zoom - 1) * 0.42;
  const verticalLimit = MAP_HEIGHT * (zoom - 1) * 0.42;
  return {
    x: clamp(point.x, -horizontalLimit, horizontalLimit),
    y: clamp(point.y, -verticalLimit, verticalLimit),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
