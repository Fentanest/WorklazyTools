import type { FilingEvent, Holding } from "../contracts";

export type SortKey = "value" | "weight" | "ownership" | "receipt";
export type QualityFilter = "all" | "priced" | "unpriced" | "below-5";
export type HoldingStatus = "included" | "excluded" | "exit" | "unresolved";

/**
 * Exact decimal-string handling for all financial labels.
 *
 * Contract quantities/money arrive as decimal strings and may exceed 2^53
 * (e.g. "9007199254740993"), where JS Number silently rounds. Display and
 * ordering below therefore never pass through Number: grouping and
 * comparison operate on the digit strings directly.
 *
 * The single exception is `approxNumber`, reserved for sizing the CSS
 * weight bars. It must never feed financial text or ordering.
 */

const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

interface ParsedDecimal {
  neg: boolean;
  int: string;
  frac: string;
}

function parseDecimal(value: string | null): ParsedDecimal | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!DECIMAL_RE.test(trimmed)) return null;
  let rest = trimmed;
  let neg = false;
  if (rest[0] === "+" || rest[0] === "-") {
    neg = rest[0] === "-";
    rest = rest.slice(1);
  }
  const dot = rest.indexOf(".");
  let int = dot === -1 ? rest : rest.slice(0, dot);
  const frac = dot === -1 ? "" : rest.slice(dot + 1);
  if (int === "") int = "0";
  int = int.replace(/^0+(?=\d)/, "");
  return { neg, int, frac };
}

/** Approximate Number for visual bar sizing ONLY. Never for text or ordering. */
export function approxNumber(value: string | null): number {
  if (value === null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function groupInt(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function renderExact(parsed: ParsedDecimal): string {
  return `${parsed.neg ? "-" : ""}${groupInt(parsed.int)}${parsed.frac ? `.${parsed.frac}` : ""}`;
}

export function formatKrw(value: string | null, _lang: "ko" | "en"): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  return `₩${renderExact(parsed)}`;
}

export function formatPct(value: string | null): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  return `${renderExact(parsed)}%`;
}

export function formatQty(value: string | null): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  return renderExact(parsed);
}

/** Exact comparison of two parsed decimals: -1 | 0 | 1. */
function compareParsed(a: ParsedDecimal, b: ParsedDecimal): number {
  if (a.neg !== b.neg) return a.neg ? -1 : 1;
  const sign = a.neg ? -1 : 1;
  if (a.int.length !== b.int.length) return (a.int.length < b.int.length ? -1 : 1) * sign;
  if (a.int !== b.int) return (a.int < b.int ? -1 : 1) * sign;
  const len = Math.max(a.frac.length, b.frac.length);
  const af = a.frac.padEnd(len, "0");
  const bf = b.frac.padEnd(len, "0");
  if (af !== bf) return (af < bf ? -1 : 1) * sign;
  return 0;
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

function sortField(h: Holding, sortKey: SortKey): string | null {
  if (sortKey === "value") return h.estimatedValue;
  if (sortKey === "weight") return h.portfolioWeightPercent;
  if (sortKey === "ownership") return h.companyOwnershipPercent;
  return null;
}

export function sortHoldings(holdings: Holding[], sortKey: SortKey): Holding[] {
  return [...holdings].sort((a, b) => {
    if (sortKey === "receipt") return b.receiptDate.localeCompare(a.receiptDate);
    // Exact decimal ordering; null/invalid strings sort last, never via Number.
    const pa = parseDecimal(sortField(a, sortKey));
    const pb = parseDecimal(sortField(b, sortKey));
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return -compareParsed(pa, pb);
  });
}

export function topHoldings(holdings: Holding[], limit = 8): Holding[] {
  return holdings
    .filter((h) => parseDecimal(h.portfolioWeightPercent) !== null)
    .sort((a, b) =>
      -compareParsed(
        parseDecimal(a.portfolioWeightPercent)!,
        parseDecimal(b.portfolioWeightPercent)!,
      ),
    )
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
