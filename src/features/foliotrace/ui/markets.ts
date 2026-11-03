import type { Holding } from '../contracts';
import reference from '../data/marketReference.json' with { type: 'json' };

export const LISTING_MARKETS = ['KOSPI', 'KOSDAQ', 'KONEX', 'UNKNOWN'] as const;
export type ListingMarket = typeof LISTING_MARKETS[number];
export const marketReferenceDate = reference.asOfDate;
export const marketSourceUrl = 'https://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd';
const marketCodes: Readonly<Record<string, string>> = reference.markets;

export function marketOf(stockCode: string): ListingMarket {
  const market = marketCodes[stockCode];
  return market === 'KOSPI' || market === 'KOSDAQ' || market === 'KONEX' ? market : 'UNKNOWN';
}

export function groupHoldingsByMarket(holdings: readonly Holding[]): Record<ListingMarket, Holding[]> {
  const groups: Record<ListingMarket, Holding[]> = { KOSPI: [], KOSDAQ: [], KONEX: [], UNKNOWN: [] };
  for (const holding of holdings) groups[marketOf(holding.stockCode)].push(holding);
  return groups;
}

function decimalParts(value: string): { units: bigint; scale: number } | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  return { units: BigInt((match[1] || '') + match[2] + (match[3] || '')), scale: (match[3] || '').length };
}

function decimalText(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${scale ? digits.slice(0, -scale) : digits}${fraction ? '.' + fraction : ''}`;
}

export interface MarketValue {
  count: number;
  pricedCount: number;
  amount: string;
  percent: string | null;
}

/** Full unfiltered portfolio; money and percent text use scaled integers, never floating point. */
export function marketAllocation(holdings: readonly Holding[]) {
  const parts = holdings.map(holding => holding.estimatedValue === null ? null : decimalParts(holding.estimatedValue));
  let scale = 0, valid = true;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part) { scale = Math.max(scale, part.scale); if (part.units < 0n) valid = false; }
    else if (holdings[i].estimatedValue !== null) valid = false;
  }
  const units: Record<ListingMarket, bigint> = { KOSPI: 0n, KOSDAQ: 0n, KONEX: 0n, UNKNOWN: 0n };
  const markets: Record<ListingMarket, MarketValue> = Object.fromEntries(LISTING_MARKETS.map(market =>
    [market, { count: 0, pricedCount: 0, amount: '0', percent: null }])) as Record<ListingMarket, MarketValue>;
  for (let i = 0; i < holdings.length; i++) {
    const market = marketOf(holdings[i].stockCode), part = parts[i];
    markets[market].count++;
    if (part) { units[market] += part.units * 10n ** BigInt(scale - part.scale); markets[market].pricedCount++; }
  }
  const total = LISTING_MARKETS.reduce((sum, market) => sum + units[market], 0n);
  const available = valid && total > 0n;
  for (const market of LISTING_MARKETS) {
    markets[market].amount = decimalText(units[market], scale);
    if (available) {
      const percent = (units[market] * 10000n + total / 2n) / total;
      markets[market].percent = `${percent / 100n}.${(percent % 100n).toString().padStart(2, '0')}`;
    }
  }
  return { total: decimalText(total, scale), available, markets };
}
