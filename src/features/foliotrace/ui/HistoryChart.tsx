import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ColorType, CrosshairMode, LineSeries, LineStyle, createChart } from 'lightweight-charts';
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts';
import type { Snapshot } from '../contracts';
import { useAppliedTheme } from '../../../theme';
import { formatCount, formatKrw } from './holdings';
import type { Lang } from './holdings';
import { chartHistory, formatHistoryAxis, formatHistoryDate, historyChange, HISTORY_COPY, HISTORY_COORDINATE_SCALE } from './history';
import type { ChartHistoryPoint, HistoryOrigin } from './history';

function timeKey(time: Time): string {
  if (typeof time === 'string') return time;
  if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

export const HistoryChart = memo(function HistoryChart({ snapshot, lang }: { snapshot: Snapshot; lang: Lang }) {
  const t = HISTORY_COPY[lang], theme = useAppliedTheme();
  const model = useMemo(() => chartHistory(snapshot.history, snapshot.valuationSeries, snapshot), [snapshot]);
  const host = useRef<HTMLDivElement>(null), tooltip = useRef<HTMLDivElement>(null);
  const tooltipDate = useRef<HTMLTimeElement>(null), tooltipValue = useRef<HTMLElement>(null);
  const tooltipOrigin = useRef<HTMLSpanElement>(null), tooltipCounts = useRef<HTMLSpanElement>(null);
  const [renderError, setRenderError] = useState(false);
  const countText = (point: ChartHistoryPoint) => point.pricedCount === undefined ? t.countsMissing : t.counts
    .replace('{priced}', formatCount(point.pricedCount)).replace('{tracked}', formatCount(point.trackedCount!))
    .replace('{excluded}', formatCount(point.unvaluedCount!));

  useEffect(() => {
    setRenderError(false);
    const element = host.current, tip = tooltip.current;
    if (!element || !tip || !model.available) return;
    const style = getComputedStyle(element), publishedColor = style.getPropertyValue('--brand-on-bg').trim() || style.color;
    const reconstructedColor = style.color, separator = style.getPropertyValue('--separator').trim() || style.color;
    let chart: IChartApi | null = null, observer: ResizeObserver | null = null;
    let disposed = false, crosshair: ((event: MouseEventParams<Time>) => void) | null = null;
    try {
      const created = createChart(element, {
        width: element.clientWidth, height: element.clientHeight,
        layout: { background: { type: ColorType.Solid, color: style.backgroundColor }, textColor: style.color, fontFamily: style.fontFamily, fontSize: 11 },
        grid: { vertLines: { color: separator, style: LineStyle.Solid }, horzLines: { color: separator, style: LineStyle.Solid } },
        rightPriceScale: { borderVisible: false, minimumWidth: 80 },
        timeScale: { borderVisible: false, timeVisible: false, tickMarkFormatter: (time: Time) => formatHistoryDate(timeKey(time), lang, true) },
        localization: { locale: lang === 'ko' ? 'ko-KR' : 'en-US',
          priceFormatter: (value: number) => formatHistoryAxis(value * HISTORY_COORDINATE_SCALE, lang), timeFormatter: (time: Time) => formatHistoryDate(timeKey(time), lang) },
        crosshair: { mode: CrosshairMode.Normal, horzLine: { style: LineStyle.Solid }, vertLine: { style: LineStyle.Solid } },
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      });
      chart = created;
      // Whitespace preserves declared gap dates without inventing a zero or forward-filled value.
      created.addSeries(LineSeries, { lineVisible: false, pointMarkersVisible: false, lastValueVisible: false,
        priceLineVisible: false, crosshairMarkerVisible: false }).setData(model.points.map(point => ({ time: point.tradeDate })));
      for (const run of model.runs) {
        created.addSeries(LineSeries, {
          color: run.origin === 'published' ? publishedColor : reconstructedColor,
          lineStyle: run.origin === 'published' ? LineStyle.Solid : LineStyle.Dashed,
          lineWidth: 2, lineVisible: run.points.length > 1, pointMarkersVisible: true, pointMarkersRadius: 3,
          priceLineVisible: false, lastValueVisible: false,
          priceFormat: { type: 'custom', minMove: 0.000001, formatter: (value: number) => formatHistoryAxis(value * HISTORY_COORDINATE_SCALE, lang) },
        }).setData(run.points.map(point => ({ time: point.tradeDate, value: point.plotValue! })));
      }
      element.querySelectorAll('canvas').forEach(canvas => canvas.setAttribute('aria-hidden', 'true'));
      const byDay = new Map(model.points.map(point => [point.tradeDate, point]));
      crosshair = event => {
        const point = event.time === undefined ? undefined : byDay.get(timeKey(event.time));
        if (!event.point || !point || event.point.x < 0 || event.point.y < 0 || event.point.x > element.clientWidth || event.point.y > element.clientHeight) {
          tip.hidden = true; return;
        }
        if (tooltipDate.current) { tooltipDate.current.textContent = formatHistoryDate(point.tradeDate, lang); tooltipDate.current.dateTime = point.tradeDate; }
        if (tooltipValue.current) tooltipValue.current.textContent = point.estimatedValue === null ? t.unpriced : formatKrw(point.estimatedValue, lang);
        if (tooltipOrigin.current) tooltipOrigin.current.textContent = point.origin === 'published' ? t.published : t.reconstructed;
        if (tooltipCounts.current) tooltipCounts.current.textContent = point.pricedCount === undefined ? t.countsMissing : t.counts
          .replace('{priced}', formatCount(point.pricedCount)).replace('{tracked}', formatCount(point.trackedCount!))
          .replace('{excluded}', formatCount(point.unvaluedCount!));
        tip.dataset.origin = point.origin;
        tip.hidden = false;
        tip.style.left = `${Math.min(Math.max(8, event.point.x + 12), Math.max(8, element.clientWidth - tip.offsetWidth - 8))}px`;
        tip.style.top = `${Math.min(Math.max(8, event.point.y + 12), Math.max(8, element.clientHeight - tip.offsetHeight - 8))}px`;
      };
      created.subscribeCrosshairMove(crosshair);
      const resize = () => {
        if (disposed) return;
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
  }, [model, lang, theme, t]);

  const latest = model.points.at(-1);
  const originLabel = (origin: HistoryOrigin) => origin === 'published' ? t.published : t.reconstructed;
  const changes = (['published', 'reconstructed'] as const).map(origin => {
    const points = model[origin].filter(point => point.estimatedValue !== null);
    return { origin, points, change: historyChange(points) };
  }).filter(row => row.points.length > 0);

  return <section className="foliotrace-block foliotrace-trend" aria-labelledby="foliotrace-history-h">
    <h2 id="foliotrace-history-h" className="foliotrace-h2">{t.title}</h2>
    <div className="foliotrace-trend-summary" id="foliotrace-trend-summary">
      <div><span>{t.latest}</span><strong>{latest?.estimatedValue == null ? '—' : formatKrw(latest.estimatedValue, lang)}</strong>
        {latest && <small>{formatHistoryDate(latest.tradeDate, lang)} · {latest.origin === 'published' ? t.published : t.reconstructed}</small>}</div>
      <div><span>{t.period}</span><strong>{model.points.length ? `${formatHistoryDate(model.points[0].tradeDate, lang)} – ${formatHistoryDate(model.points[model.points.length - 1].tradeDate, lang)}` : '—'}</strong></div>
      {changes.map(({ origin, points, change }) => <div key={origin}>
        <span>{origin === 'published' ? t.publicChange : t.reconstructedChange}</span>
        <strong>{change ? `${change.direction === 'up' ? '+' : change.direction === 'down' ? '−' : ''}${formatKrw(change.amount, lang)}${change.percent === null ? '' : ` (${change.direction === 'up' ? '+' : change.direction === 'down' ? '−' : ''}${change.percent}%)`}` : t.noChange}</strong>
        <small>{formatHistoryDate(points[0].tradeDate, lang, true)} – {formatHistoryDate(points[points.length - 1].tradeDate, lang, true)}</small>
      </div>)}
    </div>
    <figure className="foliotrace-trend-figure" aria-labelledby="foliotrace-history-h" aria-describedby="foliotrace-trend-summary">
      {model.available ? <div className="foliotrace-trend-plot">
        <div ref={host} className="foliotrace-trend-canvas" role="img" aria-label={t.title} aria-describedby="foliotrace-trend-summary"
          data-testid="foliotrace-history-chart" data-point-count={model.points.length} data-chart-theme={theme} />
        <div ref={tooltip} className="foliotrace-chart-tooltip" role="tooltip" hidden>
          <time ref={tooltipDate} /><strong ref={tooltipValue} /><span ref={tooltipOrigin} /><small ref={tooltipCounts} />
        </div>
      </div> : <p className="foliotrace-state-text" role="status">{t.empty}</p>}
      {renderError && <p className="foliotrace-state-text" role="status">{t.unavailable}</p>}
      <figcaption className="foliotrace-trend-legend">
        {(['published', 'reconstructed'] as const).filter(origin => model[origin].length > 0).map(origin => <span key={origin} data-history-origin={origin}>
          <i aria-hidden="true" className={`foliotrace-history-line foliotrace-history-line-${origin}`} />
          {originLabel(origin)} · {formatCount(model[origin].length)}
        </span>)}
      </figcaption>
    </figure>
    <p className="foliotrace-block-hint">{t.disclaimer}</p>
    {model.reconstructed.length > 0 && <p className="foliotrace-block-hint">{t.reconstructionNote}</p>}
    <details className="foliotrace-trend-details">
      <summary>{t.table} ({formatCount(model.points.length)})</summary>
      <p className="foliotrace-block-hint">{t.publicDefinition}</p>
      <div className="foliotrace-trend-table-wrap" tabIndex={0} role="region" aria-label={t.table}>
        <table className="foliotrace-trend-table">
          <thead><tr><th scope="col">{t.date}</th><th scope="col">{t.value}</th><th scope="col">{t.origin}</th><th scope="col">{t.coverage}</th></tr></thead>
          <tbody>{model.points.map(point => <tr key={point.tradeDate} data-record-origin={point.origin}>
            <th scope="row"><time dateTime={point.tradeDate}>{formatHistoryDate(point.tradeDate, lang)}</time></th>
            <td>{point.estimatedValue === null ? t.unpriced : formatKrw(point.estimatedValue, lang)}</td>
            <td>{originLabel(point.origin)}</td><td>{countText(point)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
});
