import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { DateTime } from "luxon";
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";

import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { cityName, countryName, type WorldCity } from "./cities";

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

export function WorldTimeMap({ cities, selectedIds, baseCityId, instant, selectionLimit, onToggle, language }: WorldTimeMapProps) {
  const { t } = useTranslation("features");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; pan: PanPoint } | undefined>(undefined);
  const projection = useMemo(() => geoEqualEarth().fitExtent([[18, 18], [MAP_WIDTH - 18, MAP_HEIGHT - 18]], { type: "Sphere" }), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const countryPaths = useMemo(() => countries.features.map((country) => path(country) ?? ""), [path]);
  const graticulePath = useMemo(() => path(geoGraticule10()) ?? "", [path]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

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
    if (zoom <= 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
  };

  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = MAP_WIDTH / bounds.width;
    const scaleY = MAP_HEIGHT / bounds.height;
    setPan(clampPan({
      x: drag.pan.x + (event.clientX - drag.x) * scaleX,
      y: drag.pan.y + (event.clientY - drag.y) * scaleY,
    }, zoom));
  };

  const stopDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
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
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label={t("timezone.map.aria", { total: cities.length, selected: selectedIds.length, limit: selectionLimit })}
          className={cn("block h-auto w-full touch-pan-y select-none", zoom > 1 && "cursor-grab touch-none active:cursor-grabbing")}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <defs><clipPath id="world-time-map-clip"><rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="24" /></clipPath></defs>
          <rect className="fill-sky-500/5" width={MAP_WIDTH} height={MAP_HEIGHT} rx="24" />
          <g clipPath="url(#world-time-map-clip)">
            <g transform={mapTransform} className="pointer-events-none" aria-hidden="true">
              <path className="fill-none stroke-sky-600/15 [stroke-width:.8] [vector-effect:non-scaling-stroke]" d={graticulePath} />
              {countryPaths.map((countryPath, index) => <path className="fill-card stroke-sky-600/25 transition-[fill] [stroke-width:.7] [vector-effect:non-scaling-stroke]" d={countryPath} key={index} />)}
            </g>
            {cities.map((city) => {
              const projected = projection([...city.coordinates]);
              if (!projected) return null;
              const x = MAP_WIDTH / 2 + (projected[0] - MAP_WIDTH / 2) * zoom + pan.x;
              const y = MAP_HEIGHT / 2 + (projected[1] - MAP_HEIGHT / 2) * zoom + pan.y;
              const isSelected = selected.has(city.id);
              const isBase = city.id === baseCityId;
              const local = instant.setZone(city.zone);
              const label = `${cityName(city, language)}, ${countryName(city, language)} · ${local.isValid ? local.toFormat("HH:mm") : t("timezone.map.unavailable")}`;
              return (
                <g
                  className={cn("group/map-pin cursor-pointer text-muted-foreground outline-none hover:text-sky-600 focus-visible:text-sky-600 dark:hover:text-sky-400 dark:focus-visible:text-sky-400", isSelected && "text-sky-600 dark:text-sky-400", isBase && "text-orange-500 dark:text-orange-300")}
                  data-testid="timezone-map-pin"
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${label}${isBase ? ` · ${t("timezone.map.baseSuffix")}` : ""}`}
                  key={city.id}
                  onClick={(event) => { event.stopPropagation(); onToggle(city.id); }}
                  onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onToggle(city.id);
                  }}
                >
                  <circle className="fill-transparent group-focus-visible/map-pin:fill-sky-500/15 group-focus-visible/map-pin:stroke-sky-600 [stroke-width:1.4]" cy={-8} r={15} />
                  <path className="fill-current stroke-card [filter:drop-shadow(0_2px_3px_rgba(0,0,0,.18))] [stroke-width:1.6]" d="M0 2C-1.5-1-7-5.5-7-11a7 7 0 1 1 14 0C7-5.5 1.5-1 0 2Z" />
                  <circle className="pointer-events-none fill-background" cy={-11} r={2.4} />
                  <text className={cn("pointer-events-none fill-foreground stroke-background text-[13px] font-extrabold opacity-0 transition-opacity [paint-order:stroke] [stroke-width:4px] [text-anchor:middle] group-hover/map-pin:opacity-100 group-focus-visible/map-pin:opacity-100 max-[620px]:text-base", isSelected && "opacity-100")} y={-22}>{cityName(city, language)} {local.isValid ? local.toFormat("HH:mm") : "--:--"}</text>
                </g>
              );
            })}
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
