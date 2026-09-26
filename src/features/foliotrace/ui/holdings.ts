import type { FilingEvent, Holding } from "../contracts";

export type SortKey = "value" | "weight" | "ownership" | "receipt";
export type QualityFilter = "all" | "priced" | "unpriced" | "below-5";
export type HoldingStatus = "included" | "excluded" | "exit" | "unresolved";

export function toNumberOrNull(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatKrw(value: string | null, lang: "ko" | "en"): string {
  const n = toNumberOrNull(value);
  if (n === null) return "—";
  return new Intl.NumberFormat(lang === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(value: string | null): string {
  const n = toNumberOrNull(value);
  if (n === null) return "—";
  return `${n.toFixed(2)}%`;
}

export function formatQty(value: string | null): string {
  const n = toNumberOrNull(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
}

export function holdingStatus(h: Holding): HoldingStatus {
  if (h.tracking === "below-5-percent") return "exit";
  if (h.evidence === "unresolved-latest") return "unresolved";
  if (h.quote === null || h.estimatedValue === null) return "excluded";
  return "included";
}

export function filterHoldings(holdings: Holding[], query: string, quality: QualityFilter): Holding[] {
  const q = query.trim().toLowerCase();
  return holdings.filter((h) => {
    if (q && !(h.name.toLowerCase().includes(q) || h.stockCode.toLowerCase().includes(q))) return false;
    const s = holdingStatus(h);
    if (quality === "priced" && s !== "included") return false;
    if (quality === "unpriced" && s === "included") return false;
    if (quality === "below-5" && s !== "exit") return false;
    return true;
  });
}

export function sortHoldings(holdings: Holding[], sortKey: SortKey): Holding[] {
  const num = (h: Holding): number | null => {
    if (sortKey === "value") return toNumberOrNull(h.estimatedValue);
    if (sortKey === "weight") return toNumberOrNull(h.portfolioWeightPercent);
    if (sortKey === "ownership") return toNumberOrNull(h.companyOwnershipPercent);
    return null;
  };
  return [...holdings].sort((a, b) => {
    if (sortKey === "receipt") return b.receiptDate.localeCompare(a.receiptDate);
    const na = num(a);
    const nb = num(b);
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    return nb - na;
  });
}

export function topHoldings(holdings: Holding[], limit = 8): Holding[] {
  return holdings
    .filter((h) => toNumberOrNull(h.portfolioWeightPercent) !== null)
    .sort((a, b) => (toNumberOrNull(b.portfolioWeightPercent) ?? 0) - (toNumberOrNull(a.portfolioWeightPercent) ?? 0))
    .slice(0, limit);
}

export interface EventRange {
  from: string;
  to: string;
  count: number;
}

export function eventRangeOf(events: FilingEvent[]): EventRange | null {
  if (!events.length) return null;
  const dates = events.map((e) => e.receiptDate).sort();
  return { from: dates[0], to: dates[dates.length - 1], count: events.length };
}
