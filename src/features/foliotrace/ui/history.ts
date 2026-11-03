import type { Snapshot } from '../contracts';
import type { ReconstructedValuationSeries } from '../valuationSeriesContract';
import type { Lang } from './holdings';
import { formatKrw } from './holdings.ts';

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
  const published: ChartHistoryPoint[] = history.map(point => ({
    tradeDate: point.tradeDate, estimatedValue: point.estimatedValue, origin: 'published', plotValue: chartCoordinate(point.estimatedValue),
    ...(current && current.datasetVersion === point.datasetVersion && current.valuationTradeDate === point.tradeDate &&
      current.pricedCount >= 0 && current.pricedCount <= current.trackedCount ? {
        trackedCount: current.trackedCount, pricedCount: current.pricedCount, unvaluedCount: current.trackedCount - current.pricedCount,
      } : {}),
  }));
  // Latest user decision: public dates win. Keep the full extension unchanged;
  // only its 12 non-overlapping dates enter the display projection.
  const reconstructed: ChartHistoryPoint[] = (extension?.points ?? []).filter(point => !publicDays.has(point.tradeDate)).map(point => ({
    tradeDate: point.tradeDate, estimatedValue: point.estimatedValue, origin: 'reconstructed', plotValue: chartCoordinate(point.estimatedValue),
    trackedCount: point.trackedCount, pricedCount: point.pricedCount, unvaluedCount: point.unvaluedCount,
  }));
  const points = [...reconstructed, ...published].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const runs: Array<{ origin: HistoryOrigin; points: ChartHistoryPoint[] }> = [];
  let run: typeof runs[number] | null = null;
  for (const point of points) {
    if (point.plotValue === null) { run = null; continue; }
    if (!run || run.origin !== point.origin) { run = { origin: point.origin, points: [] }; runs.push(run); }
    run.points.push(point);
  }
  return { points, published, reconstructed, runs, available: points.filter(point => point.plotValue !== null).length >= 3 };
}

function decimal(value: string) {
  const [integer, fraction = ''] = value.split('.');
  return { units: BigInt(integer + fraction), scale: fraction.length };
}
function decimalText(units: bigint, scale: number) {
  const digits = units.toString().padStart(scale + 1, '0');
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  return (scale ? digits.slice(0, -scale) : digits) + (fraction ? '.' + fraction : '');
}

/** Exact endpoint change, used separately within each origin, never across the origin boundary. */
export function historyChange(points: Array<{ estimatedValue: string | null }>) {
  const valued = points.filter(point => point.estimatedValue !== null);
  if (valued.length < 2) return null;
  const first = decimal(valued[0].estimatedValue!), last = decimal(valued[valued.length - 1].estimatedValue!);
  const scale = Math.max(first.scale, last.scale);
  const a = first.units * 10n ** BigInt(scale - first.scale), b = last.units * 10n ** BigInt(scale - last.scale);
  const delta = b - a, absolute = delta < 0n ? -delta : delta;
  const percent = a > 0n ? (absolute * 10000n + a / 2n) / a : null;
  return { direction: delta > 0n ? 'up' : delta < 0n ? 'down' : 'flat', amount: decimalText(absolute, scale),
    percent: percent === null ? null : `${percent / 100n}.${(percent % 100n).toString().padStart(2, '0')}` };
}

export function formatHistoryChange(change: ReturnType<typeof historyChange>, lang: Lang): string {
  if (!change) return HISTORY_COPY[lang].noChange;
  const sign = change.direction === 'up' ? '+' : change.direction === 'down' ? '−' : '';
  return `${sign}${formatKrw(change.amount, lang)}${change.percent === null ? '' : ` (${sign}${change.percent}%)`}`;
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
/** Axis ticks are visual approximations; the tooltip and table show exact decimal-string amounts. */
export function formatHistoryAxis(value: number, lang: Lang): string {
  const magnitude = Math.abs(value);
  const units: Array<[number, string]> = lang === 'ko' ? [[1e12, '조원'], [1e8, '억원'], [1e4, '만원'], [1, '원']] :
    [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']];
  const [scale, suffix] = units.find(([scale]) => magnitude >= scale) ?? units[units.length - 1];
  return `${lang === 'en' ? '₩' : ''}${axisFormatters[lang].format(value / scale)}${suffix}`;
}

export const HISTORY_COPY = {
  ko: {
    title: '추정 평가금액 추이', latest: '최신 표시값', period: '표시 기간', published: '공개값',
    reconstructed: '재구성(현재 규칙으로 재계산, 수량 시점 오차 ≤0.06%)',
    publicChange: '공개값 구간 변화', reconstructedChange: '재구성 구간 변화', noChange: '비교할 기록이 부족합니다.',
    empty: '추이 선을 표시하려면 3거래일 이상의 평가 기록이 필요합니다.',
    unavailable: '차트를 표시할 수 없습니다. 아래 날짜별 기록을 확인해 주세요.',
    invalidData: '평가 이력을 확인할 수 없어 추이 차트를 표시하지 않습니다.',
    disclaimer: '평가금액의 변화이며 실제 운용 수익률이 아닙니다. 출처가 바뀌거나 미평가인 지점은 선을 잇지 않습니다.',
    reconstructionNote: '데이터 검수 결론: 수량 시점 오차 ≤0.06%, 공개 7일 대조의 가격·기업행위 잔차 0. 과거 12일은 당시 저장 수량 대조가 없으며, 실제 보유액의 정확도를 보장하지 않습니다.',
    reconstructionScope: '공개 7일 대조: 가격·기업행위 잔차 0. 과거 12일 저장 수량 대조 없음.',
    table: '날짜별 기록과 계산 구분 보기', date: '거래일', value: '추정 평가금액 (KRW)', origin: '구분', coverage: '평가 / 전체 · 제외',
    unpriced: '평가금액 없음', countsMissing: '종목 수 미제공', counts: '평가 {priced}/{tracked}종목 · 제외 {excluded}종목',
    publicDefinition: '공개 스냅샷에 보존된 값입니다. 과거 공개 이력에 없는 평가·제외 종목 수는 추정하지 않습니다.',
  },
  en: {
    title: 'Estimated value history', latest: 'Latest displayed value', period: 'Displayed period', published: 'Published',
    reconstructed: 'Reconstructed (current rules; quantity timing difference ≤0.06%)',
    publicChange: 'Published-period change', reconstructedChange: 'Reconstructed-period change', noChange: 'Not enough comparable records.',
    empty: 'At least three trading days with values are needed to draw a trend.',
    unavailable: 'The chart cannot be displayed. Use the dated records below.',
    invalidData: 'The valuation history could not be verified, so the trend chart is unavailable.',
    disclaimer: 'Changes in estimated value are not investment returns. Lines do not bridge different origins or unvalued points.',
    reconstructionNote: 'Data review: quantity timing difference ≤0.06%; price/corporate-action residual is zero in the 7 published-day comparisons. The earlier 12 days have no stored quantities for direct comparison. This does not guarantee actual holdings accuracy.',
    reconstructionScope: '7 published-day comparisons: zero price/corporate-action residual. No stored-quantity comparison for the earlier 12 days.',
    table: 'View dated records and calculation origins', date: 'Trade date', value: 'Estimated value (KRW)', origin: 'Origin', coverage: 'Priced / tracked · excluded',
    unpriced: 'No valuation', countsMissing: 'Counts not provided', counts: '{priced}/{tracked} securities priced · {excluded} excluded',
    publicDefinition: 'Values retained in public snapshots. Historical priced/excluded counts are not inferred when the public history omits them.',
  },
} as const;
