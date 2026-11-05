import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ColorType, CrosshairMode, LineSeries, LineStyle, createChart } from 'lightweight-charts';
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts';
import type { Snapshot } from '../contracts';
import { useAppliedTheme } from '../../../theme';
import { formatCount, formatKrw } from './holdings';
import type { Lang } from './holdings';
import { chartHistory, formatHistoryAxis, formatHistoryDate, HISTORY_COPY, HISTORY_COORDINATE_SCALE } from './history';

function timeKey(time: Time): string {
  if (typeof time === 'string') return time;
  if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

export const HistoryChart = memo(function HistoryChart({ snapshot, lang, unavailable = false }: { snapshot: Snapshot; lang: Lang; unavailable?: boolean }) {
  const t = HISTORY_COPY[lang], theme = useAppliedTheme();
  const model = useMemo(() => chartHistory(snapshot.history, snapshot.valuationSeries, snapshot), [snapshot]);
  const host = useRef<HTMLDivElement>(null), tooltip = useRef<HTMLDivElement>(null);
  const tooltipDate = useRef<HTMLTimeElement>(null), tooltipValue = useRef<HTMLElement>(null);
  const tooltipCounts = useRef<HTMLElement>(null);
  const [renderError, setRenderError] = useState(false);
  useEffect(() => {
    setRenderError(false);
    const element = host.current, tip = tooltip.current;
    if (!element || !tip || !model.available || unavailable) return;
    const style = getComputedStyle(element), lineColor = style.getPropertyValue('--brand-on-bg').trim() || style.color;
    const separator = style.getPropertyValue('--separator').trim() || style.color;
    let chart: IChartApi | null = null, observer: ResizeObserver | null = null;
    let disposed = false, crosshair: ((event: MouseEventParams<Time>) => void) | null = null;
    try {
      const created = createChart(element, {
        width: element.clientWidth, height: element.clientHeight,
        layout: { background: { type: ColorType.Solid, color: style.backgroundColor }, textColor: style.color, fontFamily: style.fontFamily, fontSize: 11 },
        grid: { vertLines: { visible: false }, horzLines: { color: separator, style: LineStyle.Solid } },
        rightPriceScale: { borderVisible: false, minimumWidth: 80 },
        timeScale: { borderVisible: false, timeVisible: false, tickMarkFormatter: (time: Time) => formatHistoryDate(timeKey(time), lang, true) },
        localization: { locale: lang === 'ko' ? 'ko-KR' : 'en-US',
          priceFormatter: (value: number) => formatHistoryAxis(value * HISTORY_COORDINATE_SCALE, lang), timeFormatter: (time: Time) => formatHistoryDate(timeKey(time), lang) },
        crosshair: { mode: CrosshairMode.Normal, horzLine: { visible: false, labelVisible: false }, vertLine: { visible: false, labelVisible: false } },
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      });
      chart = created;
      // One series spans all origins. Missing values remain whitespace, never zero-filled.
      created.addSeries(LineSeries, {
        color: lineColor, lineStyle: LineStyle.Solid, lineWidth: 2,
        pointMarkersVisible: false, crosshairMarkerVisible: false,
        priceLineVisible: false, lastValueVisible: false,
        priceFormat: { type: 'custom', minMove: 0.000001, formatter: (value: number) => formatHistoryAxis(value * HISTORY_COORDINATE_SCALE, lang) },
      }).setData(model.lineData);
      element.querySelectorAll('canvas').forEach(canvas => canvas.setAttribute('aria-hidden', 'true'));
      const byDay = new Map(model.points.map(point => [point.tradeDate, point]));
      crosshair = event => {
        const point = event.time === undefined ? undefined : byDay.get(timeKey(event.time));
        if (!event.point || !point || event.point.x < 0 || event.point.y < 0 || event.point.x > element.clientWidth || event.point.y > element.clientHeight) {
          tip.hidden = true; return;
        }
        if (tooltipDate.current) { tooltipDate.current.textContent = formatHistoryDate(point.tradeDate, lang); tooltipDate.current.dateTime = point.tradeDate; }
        if (tooltipValue.current) tooltipValue.current.textContent = point.estimatedValue === null ? t.unpriced : formatKrw(point.estimatedValue, lang);
        if (tooltipCounts.current) {
          tooltipCounts.current.hidden = point.pricedCount === undefined;
          tooltipCounts.current.textContent = point.pricedCount === undefined ? '' : t.counts.replace('{count}', formatCount(point.pricedCount));
        }
        tip.hidden = false;
        const compact = element.clientWidth <= 640;
        tip.style.left = compact ? '8px' : `${Math.min(Math.max(8, event.point.x + 12), Math.max(8, element.clientWidth - tip.offsetWidth - 8))}px`;
        tip.style.top = compact ? '8px' : `${Math.min(Math.max(8, event.point.y + 12), Math.max(8, element.clientHeight - tip.offsetHeight - 8))}px`;
      };
      created.subscribeCrosshairMove(crosshair);
      const resize = () => {
        if (disposed) return;
        tip.hidden = true;
        created.resize(element.clientWidth, element.clientHeight);
        const scale = created.timeScale(), width = scale.width() || Math.max(1, element.clientWidth - 80);
        // Keep both endpoint date labels inside narrow canvases as well.
        const padding = Math.max(0.5, (model.points.length - 1) * 24 / Math.max(1, width - 48));
        scale.setVisibleLogicalRange({ from: -padding, to: model.points.length - 1 + padding });
      };
      observer = new ResizeObserver(resize); observer.observe(element); resize();
      element.dataset.chartReady = 'true';
    } catch {
      observer?.disconnect(); chart?.remove(); chart = null;
      setRenderError(true);
    }
    return () => {
      disposed = true; observer?.disconnect();
      if (chart && crosshair) chart.unsubscribeCrosshairMove(crosshair);
      chart?.remove(); tip.hidden = true; delete element.dataset.chartReady;
    };
  }, [model, lang, theme, t, unavailable]);

  if (unavailable) return <section className="foliotrace-block foliotrace-trend" aria-labelledby="foliotrace-history-h">
    <h2 id="foliotrace-history-h" className="foliotrace-h2">{t.title}</h2>
    <p className="foliotrace-state-text" role="status" data-testid="foliotrace-chart-unavailable">{t.invalidData}</p>
  </section>;

  return <section className="foliotrace-block foliotrace-trend" aria-labelledby="foliotrace-history-h">
    <h2 id="foliotrace-history-h" className="foliotrace-h2">{t.title}</h2>
    <figure className="foliotrace-trend-figure" aria-labelledby="foliotrace-history-h">
      {model.available ? <div className="foliotrace-trend-plot">
        <div ref={host} className="foliotrace-trend-canvas" role="img" aria-label={t.title}
          data-testid="foliotrace-history-chart" data-point-count={model.points.length} data-chart-theme={theme} />
        <div ref={tooltip} className="foliotrace-chart-tooltip" role="tooltip" hidden>
          <time ref={tooltipDate} /><strong ref={tooltipValue} /><small ref={tooltipCounts} />
        </div>
      </div> : <p className="foliotrace-state-text" role="status">{t.empty}</p>}
      {renderError && <p className="foliotrace-state-text" role="status">{t.unavailable}</p>}
    </figure>
  </section>;
});
