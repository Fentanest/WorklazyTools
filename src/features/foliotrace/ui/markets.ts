import type { Holding } from '../contracts';
import reference from '../data/marketReference.json' with { type: 'json' };

export const LISTING_MARKETS = ['KOSPI', 'KOSDAQ', 'KONEX', 'UNKNOWN'] as const;
export type ListingMarket = typeof LISTING_MARKETS[number];
export const marketReferenceDate = reference.asOfDate;
export const MARKET_REFERENCE_MAX_AGE_DAYS = 30;
export const marketSourceUrl = 'https://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd';
const marketCodes: Readonly<Record<string, string>> = reference.markets;

/** Calendar days relative to the valuation day, not to the browser's clock. */
export function marketReferenceAgeDays(valuationDate: string | null, referenceDate = marketReferenceDate): number | null {
  const day = (value: string) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : null;
  };
  if (!valuationDate) return null;
  const valuation = day(valuationDate), reference = day(referenceDate);
  return valuation === null || reference === null ? null : Math.max(0, valuation - reference);
}

export function marketOf(stockCode: string): ListingMarket {
  const market = marketCodes[stockCode];
  return market === 'KOSPI' || market === 'KOSDAQ' || market === 'KONEX' ? market : 'UNKNOWN';
}

/** Company-code market of each issuer's common row, for rows that name no listed code. */
function marketByCorpCode(holdings: readonly Holding[]): Map<string, ListingMarket> {
  const markets = new Map<string, ListingMarket>();
  for (const holding of holdings) {
    if (holding.securityKind === 'common' && !markets.has(holding.corpCode)) {
      markets.set(holding.corpCode, marketOf(holding.stockCode));
    }
  }
  return markets;
}

/**
 * Market of one holding. The combined-preferred aggregate carries the company code
 * instead of a listed code, so it follows its company's (common row's) market and
 * never lands in 「기타·시장 미확인」. Price and valuation stay absent: only the panel
 * grouping changes.
 */
export function marketOfHolding(holding: Holding, markets: Map<string, ListingMarket>): ListingMarket {
  if (holding.preferredCombined === true) return markets.get(holding.corpCode) ?? marketOf(holding.stockCode);
  return marketOf(holding.stockCode);
}

export function groupHoldingsByMarket(holdings: readonly Holding[]): Record<ListingMarket, Holding[]> {
  const groups: Record<ListingMarket, Holding[]> = { KOSPI: [], KOSDAQ: [], KONEX: [], UNKNOWN: [] };
  const markets = marketByCorpCode(holdings);
  for (const holding of holdings) groups[marketOfHolding(holding, markets)].push(holding);
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
  const byCorp = marketByCorpCode(holdings);
  for (let i = 0; i < holdings.length; i++) {
    const market = marketOfHolding(holdings[i], byCorp), part = parts[i];
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
