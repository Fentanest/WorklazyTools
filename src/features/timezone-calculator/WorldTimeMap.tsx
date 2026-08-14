import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { DateTime } from "luxon";
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";

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
    <div className="world-map-shell">
      <div className="world-map-toolbar">
        <div className="world-map-legend" aria-label={t("timezone.map.legend")}>
          <span><i className="selected" /> {t("timezone.map.selected")}</span>
          <span><i className="base" /> {t("timezone.map.base")}</span>
        </div>
        <div className="world-map-controls" aria-label={t("timezone.map.controls")}>
          <button type="button" onClick={() => setZoomLevel(zoom - 0.5)} disabled={zoom <= MIN_ZOOM} aria-label={t("timezone.map.zoomOut")}><Minus size={16} /></button>
          <output aria-label={t("timezone.map.zoom")}>{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => setZoomLevel(zoom + 0.5)} disabled={zoom >= MAX_ZOOM} aria-label={t("timezone.map.zoomIn")}><Plus size={16} /></button>
          <button type="button" onClick={resetView} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} aria-label={t("timezone.map.reset")}><RotateCcw size={15} /></button>
        </div>
      </div>

      <div className="world-map-canvas">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label={t("timezone.map.aria", { total: cities.length, selected: selectedIds.length, limit: selectionLimit })}
          className={zoom > 1 ? "is-zoomed" : ""}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <defs><clipPath id="world-time-map-clip"><rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="24" /></clipPath></defs>
          <rect className="world-map-ocean" width={MAP_WIDTH} height={MAP_HEIGHT} rx="24" />
          <g clipPath="url(#world-time-map-clip)">
            <g transform={mapTransform} className="world-map-geography" aria-hidden="true">
              <path className="world-map-graticule" d={graticulePath} />
              {countryPaths.map((countryPath, index) => <path className="world-map-country" d={countryPath} key={index} />)}
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
                  className={`world-map-pin${isSelected ? " is-selected" : ""}${isBase ? " is-base" : ""}`}
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
                  <circle className="world-map-pin-hit" cy={-8} r={15} />
                  <path className="world-map-pin-shape" d="M0 2C-1.5-1-7-5.5-7-11a7 7 0 1 1 14 0C7-5.5 1.5-1 0 2Z" />
                  <circle className="world-map-pin-dot" cy={-11} r={2.4} />
                  <text y={-22}>{cityName(city, language)} {local.isValid ? local.toFormat("HH:mm") : "--:--"}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="world-map-help">{t("timezone.map.help")}</p>
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
