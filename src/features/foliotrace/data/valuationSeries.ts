import type { ReconstructedValuationSeries } from '../valuationSeriesContract';

export const MAX_VALUATION_POINTS = 1000;
const HASH = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const LEGACY_AMOUNT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10000;
const identifier = (value: unknown): value is string => typeof value === 'string' && IDENTIFIER.test(value);

export function validTradeDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function validPublishedHistory(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_VALUATION_POINTS) return false;
  let previous = '';
  for (const point of value) {
    if (!record(point) || !validTradeDate(point.tradeDate) || point.tradeDate <= previous ||
      typeof point.estimatedValue !== 'string' || !LEGACY_AMOUNT.test(point.estimatedValue) ||
      typeof point.datasetVersion !== 'string' || !HASH.test(point.datasetVersion)) return false;
    previous = point.tradeDate;
  }
  return true;
}

/** Validate the additive extension separately; invalid data must never lose its reconstructed origin. */
export function validValuationSeries(value: unknown): value is ReconstructedValuationSeries {
  if (!record(value) || value.schemaVersion !== 1 || value.portfolioId !== 'nps-kr-disclosed' ||
    value.currency !== 'KRW' || value.methodologyVersion !== '2' ||
    value.knowledgePolicy !== 'ledger-known-by-trade-date-retrospective-cache' ||
    value.priceBasis !== 'krx-official-unadjusted-close' ||
    !identifier(value.seriesId) || !identifier(value.scopeId) || !identifier(value.calculationPolicyRevision) ||
    typeof value.generatedAt !== 'string' || value.generatedAt.length > 40 || !Number.isFinite(Date.parse(value.generatedAt)) ||
    !Array.isArray(value.limitations) || value.limitations.length > 20 ||
    !value.limitations.every(item => typeof item === 'string' && item.length <= 500) ||
    !Array.isArray(value.points) || value.points.length > MAX_VALUATION_POINTS) return false;
  const generatedDay = new Date(value.generatedAt).toISOString().slice(0, 10);
  let previous = '';
  for (const point of value.points) {
    if (!record(point) || !validTradeDate(point.tradeDate) || point.tradeDate <= previous || point.tradeDate > generatedDay ||
      !validTradeDate(point.knowledgeCutoff) || point.knowledgeCutoff > point.tradeDate ||
      !validTradeDate(point.holdingsAssemblyDate) || point.holdingsAssemblyDate > generatedDay ||
      point.kind !== 'reconstructed' || point.reconstructed !== true || point.datasetVersion !== null ||
      point.methodologyVersion !== value.methodologyVersion || point.calculationPolicyRevision !== value.calculationPolicyRevision ||
      typeof point.quantityOrigin !== 'string' || !['stored-assembly', 'ledger-yearend-assembly'].includes(point.quantityOrigin) ||
      !(point.estimatedValue === null || typeof point.estimatedValue === 'string' && AMOUNT.test(point.estimatedValue)) ||
      !count(point.trackedCount) || !count(point.pricedCount) || !count(point.unvaluedCount) ||
      point.pricedCount + point.unvaluedCount !== point.trackedCount || !record(point.exclusionCounts) ||
      Object.keys(point.exclusionCounts).length > 50 || typeof point.quantityContentSha256 !== 'string' || !HASH.test(point.quantityContentSha256) ||
      typeof point.priceContentSha256 !== 'string' || !HASH.test(point.priceContentSha256)) return false;
    let excluded = 0;
    for (const [reason, amount] of Object.entries(point.exclusionCounts)) {
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(reason) || !count(amount)) return false;
      excluded += amount;
    }
    if (excluded !== point.unvaluedCount) return false;
    const coverage = point.pricedCount === 0 ? 'unavailable' : point.pricedCount === point.trackedCount ? 'complete' : 'partial';
    if (point.valuationCoverage !== coverage) return false;
    previous = point.tradeDate;
  }
  return true;
}
