import type { Snapshot } from '../contracts';
import { validHistoryCounts } from '../data/valuationSeries.ts';
import type { ReconstructedValuationSeries } from '../valuationSeriesContract';
import type { Lang } from './holdings';

export type HistoryOrigin = 'published' | 'reconstructed';
export const HISTORY_COORDINATE_SCALE = 1e12;
export interface ChartHistoryPoint {
  tradeDate: string;
  estimatedValue: string | null;
  origin: HistoryOrigin;
  plotValue: number | null;
  trackedCount?: number;
  pricedCount?: number;
  unvaluedCount?: number;
}

/** Approximate coordinates only. Exact money labels always retain the source string. */
function chartCoordinate(value: string | null): number | null {
  if (value === null) return null;
  // LWC 5.2.1 enforces a +/- MAX_SAFE_INTEGER/100 data bound. Total KRW
  // valuations exceed it; trillion-won coordinates stay safely within it.
  const coordinate = Number(value) / HISTORY_COORDINATE_SCALE;
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= Number.MAX_SAFE_INTEGER / 100 ? coordinate : null;
}

export function chartHistory(history: Snapshot['history'], extension?: ReconstructedValuationSeries,
  current?: Pick<Snapshot, 'datasetVersion' | 'valuationTradeDate' | 'trackedCount' | 'pricedCount'>) {
  const publicDays = new Set(history.map(point => point.tradeDate));
  const published: ChartHistoryPoint[] = history.map(point => {
    // Published history owns its counts. Only a legacy point can use the identical current revision.
    const counts = validHistoryCounts(point) ? point : current && current.datasetVersion === point.datasetVersion &&
      current.valuationTradeDate === point.tradeDate ? {
        trackedCount: current.trackedCount, pricedCount: current.pricedCount, unvaluedCount: current.trackedCount - current.pricedCount,
      } : undefined;
    return {
      tradeDate: point.tradeDate, estimatedValue: point.estimatedValue, origin: 'published', plotValue: chartCoordinate(point.estimatedValue),
      ...(counts && validHistoryCounts(counts) ? {
        trackedCount: counts.trackedCount, pricedCount: counts.pricedCount, unvaluedCount: counts.unvaluedCount,
      } : {}),
    };
  });
  // Latest user decision: public dates win. Keep the full extension unchanged;
  // only its 12 non-overlapping dates enter the display projection.
  const reconstructed: ChartHistoryPoint[] = (extension?.points ?? []).filter(point => !publicDays.has(point.tradeDate)).map(point => ({
    tradeDate: point.tradeDate, estimatedValue: point.estimatedValue, origin: 'reconstructed', plotValue: chartCoordinate(point.estimatedValue),
    trackedCount: point.trackedCount, pricedCount: point.pricedCount, unvaluedCount: point.unvaluedCount,
  }));
  const points = [...reconstructed, ...published].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const lineData = points.map(point => point.plotValue === null ? { time: point.tradeDate } : { time: point.tradeDate, value: point.plotValue });
  return { points, published, reconstructed, lineData, available: points.filter(point => point.plotValue !== null).length >= 3 };
}

const dateFormatters = {
  ko: new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }),
};
const shortDateFormatters = {
  ko: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
};
export function formatHistoryDate(day: string, lang: Lang, short = false): string {
  return (short ? shortDateFormatters : dateFormatters)[lang].format(new Date(`${day}T00:00:00Z`));
}
const axisFormatters = { ko: new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }), en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }) };
/** Axis ticks are visual approximations; the tooltip shows exact decimal-string amounts. */
export function formatHistoryAxis(value: number, lang: Lang): string {
  const magnitude = Math.abs(value);
  const units: Array<[number, string]> = lang === 'ko' ? [[1e12, '조원'], [1e8, '억원'], [1e4, '만원'], [1, '원']] :
    [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']];
  const [scale, suffix] = units.find(([scale]) => magnitude >= scale) ?? units[units.length - 1];
  return `${lang === 'en' ? '₩' : ''}${axisFormatters[lang].format(value / scale)}${suffix}`;
}

export const HISTORY_COPY = {
  ko: {
    title: '추정 평가금액 추이',
    empty: '추이 선을 표시하려면 3거래일 이상의 평가 기록이 필요합니다.',
    unavailable: '차트를 표시할 수 없습니다.',
    invalidData: '평가 이력을 확인할 수 없습니다.',
    unpriced: '평가금액 없음', counts: '평가 {count}종목',
  },
  en: {
    title: 'Estimated value history',
    empty: 'At least three trading days with values are needed to draw a trend.',
    unavailable: 'The chart cannot be displayed.',
    invalidData: 'The valuation history could not be verified.',
    unpriced: 'No valuation', counts: '{count} securities priced',
  },
} as const;
