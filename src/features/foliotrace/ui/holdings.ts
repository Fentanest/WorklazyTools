import type { FilingEvent, Holding } from "../contracts";

export type SortKey = "value" | "weight" | "ownership" | "receipt";
export type QualityFilter = "all" | "priced" | "unpriced" | "below-5";
export type HoldingStatus = "included" | "excluded" | "exit" | "unresolved";
export type Lang = "ko" | "en";

export function formatKstTimestamp(value: string | null, lang: Lang): string | null {
  if (value === null) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const formatted = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(instant);
  return `${formatted} KST`;
}

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

function renderAmount(parsed: ParsedDecimal): string {
  return renderExact(parsed.frac && /^0+$/.test(parsed.frac) ? { ...parsed, frac: "" } : parsed);
}

export function formatKrw(value: string | null, _lang: "ko" | "en"): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  return `₩${renderAmount(parsed)}`;
}

export function formatPct(value: string | null): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  return `${renderExact(parsed)}%`;
}

export function formatQty(value: string | null): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  return renderAmount(parsed);
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

export type FilingChangeDirection = "up" | "down" | null;
export interface FilingValueChanges {
  quantity: FilingChangeDirection;
  ownership: FilingChangeDirection;
}

const DIRECT_EVENT_SOURCES = new Set<FilingEvent["source"]>([
  "legacy-import", "dart-structured", "dart-document",
]);
const DIRECT_HOLDING_EVIDENCE = new Set<Holding["evidence"]>([
  "legacy-import", "dart-structured", "dart-document",
]);

function reportedDirection(current: string | null, previous: string | null): FilingChangeDirection {
  const currentValue = parseDecimal(current);
  const previousValue = parseDecimal(previous);
  if (currentValue === null || previousValue === null) return null;
  const order = compareParsed(currentValue, previousValue);
  return order > 0 ? "up" : order < 0 ? "down" : null;
}

function sameReportedValue(left: string | null, right: string | null): boolean {
  const leftValue = parseDecimal(left);
  const rightValue = parseDecimal(right);
  return leftValue !== null && rightValue !== null && compareParsed(leftValue, rightValue) === 0;
}

/**
 * Compare the table's two reported numbers with the immediately preceding
 * filing for the same security. This describes the reported numbers only;
 * it does not infer trades or compare third-party ownership observations.
 */
export function filingChangesForHoldings(
  holdings: Holding[], events: FilingEvent[],
): Map<Holding, FilingValueChanges> {
  const bySecurity = new Map<string, FilingEvent[]>();
  for (const event of events) {
    if (!event.stockCode || !DIRECT_EVENT_SOURCES.has(event.source)) continue;
    const key = `${event.corpCode}:${event.stockCode}`;
    const filings = bySecurity.get(key) ?? [];
    filings.push(event);
    bySecurity.set(key, filings);
  }
  for (const filings of bySecurity.values()) filings.sort((a, b) => a.receiptNo.localeCompare(b.receiptNo));

  const changes = new Map<Holding, FilingValueChanges>();
  for (const holding of holdings) {
    if (!DIRECT_HOLDING_EVIDENCE.has(holding.evidence)) continue;
    const filings = bySecurity.get(`${holding.corpCode}:${holding.stockCode}`);
    if (!filings || filings.length < 2) continue;
    const currentIndex = filings.findIndex((event) => event.receiptNo === holding.receiptNo);
    if (currentIndex < 1 || currentIndex !== filings.length - 1) continue;
    const current = filings[currentIndex];
    const previous = filings[currentIndex - 1];
    // A first/re-entry report establishes a position; corrections and
    // uncertain latest holdings must not be presented as a numeric change.
    if (current.correctionOf || previous.correctionOf ||
        current.kind === "new-report" || current.kind === "tracking-reentry") continue;
    const quantity = sameReportedValue(holding.quantity, current.quantity)
      ? reportedDirection(holding.quantity, previous.quantity) : null;
    const exactOwnership = (holding.ownershipNumericKind == null || holding.ownershipNumericKind === "exact") &&
      (current.numericKind == null || current.numericKind === "exact") &&
      (previous.numericKind == null || previous.numericKind === "exact");
    const ownership = exactOwnership && sameReportedValue(holding.companyOwnershipPercent, current.companyOwnershipPercent)
      ? reportedDirection(holding.companyOwnershipPercent, previous.companyOwnershipPercent) : null;
    if (quantity || ownership) changes.set(holding, { quantity, ownership });
  }
  return changes;
}

export function holdingStatus(h: Holding): HoldingStatus {
  if (h.tracking === "below-5-percent") return "exit";
  if (h.evidence === "unresolved-latest") return "unresolved";
  if (h.quote === null || h.estimatedValue === null) return "excluded";
  return "included";
}

/**
 * User-facing labels for pipeline valuation exclusion reasons.
 * Raw reason codes (e.g. "security_mapping_unverified") are internal
 * identifiers and must never reach the screen: known codes map to
 * accurate ko/en text, anything else falls back to a generic message
 * that does not echo the unknown string.
 */
const EXCLUSION_REASON_LABELS: Record<string, Record<Lang, string>> = {
  tracking_exit: {
    ko: "5% 미만이라 평가에서 제외",
    en: "Excluded: below 5% ownership",
  },
  security_mapping_unverified: {
    ko: "공시된 주식이 어떤 상장 종목인지 확인되지 않아 평가에서 제외",
    en: "Excluded: the reported shares could not be linked to a listed security",
  },
  quantity_unverified: {
    ko: "수량이 확인되지 않아 평가에서 제외",
    en: "Excluded: quantity unverified",
  },
  scope_comparison_unverified: {
    ko: "다른 공시의 지분율은 확인했지만 평가에 쓸 주식 수와 연결할 수 없어 금액은 제외",
    en: "Value excluded: ownership was confirmed in another filing, but the share count needed for valuation could not be matched",
  },
  same_basis_observation_conflict: {
    ko: "같은 기준일의 공시 수치가 달라 평가에서 제외",
    en: "Excluded: filings for the same holding date disagree",
  },
  zero_quantity: {
    ko: "수량이 0이라 평가에서 제외",
    en: "Excluded: zero quantity",
  },
  quote_unverified: {
    ko: "검증된 종가가 없어 평가에서 제외",
    en: "Excluded: no verified closing price",
  },
  quote_date_or_session_mismatch: {
    ko: "가격 날짜나 정규장 마감 가격인지 확인되지 않아 평가에서 제외",
    en: "Excluded: the price date or regular-session closing price could not be confirmed",
  },
  quote_basis_unverified: {
    ko: "가격 기준이 확인되지 않아 평가에서 제외",
    en: "Excluded: price basis unverified",
  },
  latest_filing_unresolved: {
    ko: "최신 공시가 확인되지 않아 평가에서 제외 — 이전 확인 수량은 유지",
    en: "Excluded: latest filing unverified — previously confirmed quantity retained",
  },
  filing_after_quote_date: {
    ko: "공시 접수일이 종가 기준일보다 늦어 평가에서 제외",
    en: "Excluded: filing arrived after the closing-price date",
  },
  corporate_action_unverified: {
    ko: "공시 후 주식 변동 여부가 확인되지 않아 평가에서 제외",
    en: "Excluded: share changes since the filing are unverified",
  },
};

export function exclusionReasonLabel(reason: string | null, lang: Lang): string | null {
  if (reason === null) return null;
  return (
    EXCLUSION_REASON_LABELS[reason]?.[lang] ??
    (lang === "ko" ? "확인되지 않은 사유로 평가에서 제외" : "Excluded: reason unavailable")
  );
}

/**
 * User-facing labels for the latest-unresolved-filing sub-reasons
 * (FT-02). Unknown strings fall back generically without echoing.
 */
const LATEST_UNRESOLVED_REASON_LABELS: Record<string, Record<Lang, string>> = {
  correction_relation_unverified: {
    ko: "정정 관계 미확인",
    en: "Correction relation unverified",
  },
  withdrawal_unverified: {
    ko: "철회 여부 미확인",
    en: "Withdrawal unverified",
  },
  needs_filing_parse: {
    ko: "공시 내용 확인 중",
    en: "Filing details under review",
  },
  security_identity_missing: {
    ko: "주식 종류와 종목을 확인할 정보 부족",
    en: "Not enough information to identify the share class and security",
  },
};

export function latestUnresolvedReasonLabel(reason: string | null, lang: Lang): string | null {
  if (reason === null) return null;
  return (
    LATEST_UNRESOLVED_REASON_LABELS[reason]?.[lang] ??
    (lang === "ko" ? "미확인 사유" : "Unverified reason")
  );
}

/**
 * Quote basis in clear ko/en terms. The contract session and provider
 * values get human labels; anything else passes through raw (own data,
 * React-escaped) rather than blanking.
 */
export function quoteSessionLabel(session: string, lang: Lang): string {
  if (session === "regular") return lang === "ko" ? "정규장" : "Regular session";
  return session;
}

export function quoteProviderLabel(provider: string, lang: Lang): string {
  if (provider === "naver") return lang === "ko" ? "네이버" : "Naver";
  return provider;
}

const LETTER_NAMES: Record<string, string> = {
  a: "에이", b: "비", c: "씨", d: "디", e: "이", f: "에프", g: "지",
  h: "에이치", i: "아이", j: "제이", k: "케이", l: "엘", m: "엠", n: "엔",
  o: "오", p: "피", q: "큐", r: "알", s: "에스", t: "티", u: "유",
  v: "브이", w: "더블유", x: "엑스", y: "와이", z: "지",
};

function searchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function spokenInitialism(value: string): string | null {
  const compact = value.toLowerCase().replace(/[\s.\-]/g, "");
  if (!/^[a-z&]+$/.test(compact) || (compact.match(/[a-z]/g)?.length ?? 0) < 2) return null;
  return [...compact].map((character) => character === "&" ? "앤" : LETTER_NAMES[character]).join("");
}

export function filterHoldings(holdings: Holding[], query: string, quality: QualityFilter): Holding[] {
  const q = query.trim().toLowerCase();
  const compactQuery = searchText(q);
  const spokenQuery = spokenInitialism(q);
  return holdings.filter((h) => {
    if (q && !(h.name.toLowerCase().includes(q) || h.stockCode.toLowerCase().includes(q) ||
      (compactQuery && searchText(h.name).includes(compactQuery)) ||
      (spokenQuery && searchText(h.name).includes(spokenQuery)))) return false;
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
