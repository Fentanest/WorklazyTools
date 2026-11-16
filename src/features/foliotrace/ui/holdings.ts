import type { FilingEvent, Holding, Quote, RatioBasisKind } from "../contracts";

export type SortKey = "value" | "weight" | "ownership" | "receipt";
export type QualityFilter = "all" | "priced" | "unpriced" | "below-5" | "ratio-adjusted";
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

/**
 * Compact KRW text built from the exact integer digits (truncated, never via Number).
 * `mixed` renders Korean "99조 499억"; otherwise one unit with `decimals` digits ("350.0", "조").
 * The exact amount is always shown elsewhere (title / key-figure sub line).
 */
export function compactKrw(
  value: string | null, lang: Lang, options: { decimals?: number; mixed?: boolean } = {},
): { num: string; unit: string; text: string } | null {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed.neg) return null;
  const int = parsed.int;
  const decimals = options.decimals ?? 1;
  const units: Array<[number, string]> = lang === "ko"
    ? [[12, "조"], [8, "억"], [4, "만"]]
    : [[12, "T"], [9, "B"], [6, "M"]];
  const hit = units.find(([zeros]) => int.length > zeros);
  if (!hit) return { num: groupInt(int), unit: "", text: `₩${groupInt(int)}` };
  const [zeros, unit] = hit;
  const head = int.slice(0, int.length - zeros);
  const tail = int.slice(int.length - zeros);
  if (lang === "ko" && options.mixed) {
    if (unit === "조") {
      const eok = tail.slice(0, 4).replace(/^0+(?=\d)/, "");
      if (eok !== "0") {
        const text = `${groupInt(head)}조 ${groupInt(eok)}억`;
        return { num: text, unit: "", text };
      }
    }
    return { num: groupInt(head), unit, text: `${groupInt(head)}${unit}` };
  }
  const frac = decimals > 0 ? `.${tail.slice(0, decimals).padEnd(decimals, "0")}` : "";
  const num = `${groupInt(head)}${frac}`;
  return { num, unit, text: lang === "ko" ? `${num}${unit}` : `₩${num}${unit}` };
}

/** Exact sum of percent strings (4 decimals, BigInt), rendered with 1 decimal (rounded half up). Null if any is missing. */
export function sumPercentText(values: Array<string | null>): string | null {
  let total = 0n;
  for (const value of values) {
    const parsed = parseDecimal(value);
    if (parsed === null || parsed.neg) return null;
    total += BigInt(parsed.int + parsed.frac.padEnd(4, "0").slice(0, 4));
  }
  const tenths = (total + 500n) / 1000n;
  const whole = tenths / 10n;
  return `${whole}.${tenths % 10n}%`;
}

/** Integer count with thousands separators. */
export function formatCount(value: number): string {
  return groupInt(String(Math.trunc(value)));
}

/**
 * Percent with exactly 2 decimals, rounded half up on the decimal string.
 * Display only: the exact value belongs in a title/tooltip and the detail sheet.
 */
export function formatPctShort(value: string | null): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  const digits = BigInt(parsed.int + parsed.frac.padEnd(2, "0").slice(0, 2));
  const roundUp = parsed.frac.length > 2 && parsed.frac.charCodeAt(2) >= 53;
  const scaled = (roundUp ? digits + 1n : digits).toString().padStart(3, "0");
  const neg = parsed.neg && scaled !== "000";
  return `${neg ? "-" : ""}${groupInt(scaled.slice(0, -2))}.${scaled.slice(-2)}%`;
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
  quantityDelta: string | null;
  ownershipDelta: string | null;
}

const DIRECT_EVENT_SOURCES = new Set<FilingEvent["source"]>([
  "legacy-import", "dart-structured", "dart-document",
]);
const DIRECT_HOLDING_EVIDENCE = new Set<Holding["evidence"]>([
  "legacy-import", "dart-structured", "dart-document",
]);

/** Exact decimal subtraction, including quantities above Number.MAX_SAFE_INTEGER. */
export function reportedDelta(current: string | null, previous: string | null): string | null {
  const currentValue = parseDecimal(current);
  const previousValue = parseDecimal(previous);
  if (currentValue === null || previousValue === null) return null;
  const scale = Math.max(currentValue.frac.length, previousValue.frac.length);
  const scaled = (value: ParsedDecimal) => BigInt(value.int + value.frac.padEnd(scale, "0")) * (value.neg ? -1n : 1n);
  const difference = scaled(currentValue) - scaled(previousValue);
  const digits = (difference < 0n ? -difference : difference).toString().padStart(scale + 1, "0");
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, "") : "";
  return `${difference < 0n ? "-" : ""}${scale ? digits.slice(0, -scale) : digits}${fraction ? `.${fraction}` : ""}`;
}

function deltaDirection(delta: string | null): FilingChangeDirection {
  return delta === null || delta === "0" ? null : delta.startsWith("-") ? "down" : "up";
}

export function formatFilingDelta(delta: string, metric: "quantity" | "ownership", lang: Lang): string {
  const sign = delta.startsWith("-") ? "−" : delta === "0" ? "" : "+";
  const amount = formatQty(delta.replace(/^-/, ""));
  return `${sign}${amount}${metric === "ownership" ? "%p" : lang === "ko" ? "주" : " shares"}`;
}

export function filingDeltaLabel(delta: string, metric: "quantity" | "ownership", lang: Lang): string {
  const label = metric === "quantity" ? (lang === "ko" ? "수량" : "Quantity") : (lang === "ko" ? "지분율" : "Ownership");
  return `${label} ${formatFilingDelta(delta, metric, lang)}`;
}

/** Pipeline observation order: basis date → receipt date → receipt number.
 * Older snapshots without a basis date fall back to their receipt date. */
export function compareFilingOrder(a: FilingEvent, b: FilingEvent): number {
  return (a.basisDate ?? a.receiptDate).localeCompare(b.basisDate ?? b.receiptDate) ||
    a.receiptDate.localeCompare(b.receiptDate) || a.receiptNo.localeCompare(b.receiptNo);
}

/** Stable identity of one holding row: the combined-preferred aggregate reuses the
 * common code's company, so a bare stock code no longer identifies one row. */
export function holdingKeyOf(h: Pick<Holding, "stockCode" | "securityKind" | "receiptNo">): string {
  return `${h.stockCode}:${h.securityKind}:${h.receiptNo ?? "ye"}`;
}

/** Selection key for an event's name button: the common-share holding when one exists,
 * otherwise the event's own key (history-only sheet). */
export function selectionKeyForEvent(event: FilingEvent, holdings: Holding[]): string {
  const rows = holdings.filter((h) => event.stockCode != null && h.stockCode === event.stockCode);
  const common = rows.find((h) => h.securityKind === "common") ?? rows[0];
  return common ? holdingKeyOf(common) : (event.stockCode ?? `corp:${event.corpCode}`);
}

/** Ratio basis of one figure: null/undefined means an older snapshot without basis info. */
export function figureBasisKind(figure: Pick<FilingEvent, "ratioBasisKind"> | Pick<Holding, "ratioBasisKind">): RatioBasisKind | null {
  return figure.ratioBasisKind ?? null;
}

/**
 * Common-share basis group. An A1 voting-rights figure and a recomputed common-only
 * figure share the same denominator kind (보통주): A1 의결권 총수가 DART 보통주 발행수와
 * 같음이 실제 자료로 확인됐다(2026H2 근접 49쌍 중 48 일치, 1건은 빙그레 소각 시점차로
 * A1=보통주 일치). Only a combined-basis (합산) figure stands apart.
 */
const COMMON_BASIS: ReadonlySet<RatioBasisKind> = new Set(["voting_rights", "common_only"]);

function basisGroup(kind: RatioBasisKind | null): string | null {
  if (kind === null) return null;
  return COMMON_BASIS.has(kind) ? "common" : kind;
}

/**
 * Whether two reported ownership figures may be subtracted. Only figures with
 * equal *known* bases compare; a basis change (or an unknown side against a known
 * one) never produces a numeric delta. A1 voting-rights and recomputed common-only
 * figures share the 보통주 group. Figures from snapshots without any basis
 * info keep the legacy behavior (they cannot be told apart).
 */
export function sameRatioBasis(
  current: Pick<FilingEvent, "ratioBasisKind"> | Pick<Holding, "ratioBasisKind">,
  previous: Pick<FilingEvent, "ratioBasisKind"> | Pick<Holding, "ratioBasisKind">,
): boolean {
  const left = figureBasisKind(current);
  const right = figureBasisKind(previous);
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  return basisGroup(left) === basisGroup(right);
}

/** True when both figures carry a known basis and the basis groups differ: show "basis change", not a delta. */
export function ratioBasisChanged(
  current: Pick<FilingEvent, "ratioBasisKind"> | Pick<Holding, "ratioBasisKind">,
  previous: Pick<FilingEvent, "ratioBasisKind"> | Pick<Holding, "ratioBasisKind">,
): boolean {
  const left = figureBasisKind(current);
  const right = figureBasisKind(previous);
  return left !== null && right !== null && basisGroup(left) !== basisGroup(right);
}

/**
 * Whether a preserved filing percentage (`reportedCompanyOwnershipPercent`) uses the
 * combined (보통주+우선주 합산) basis. Unverified A2 figures and preferred-kind rows
 * always quote the combined filing ratio; a common-only figure does so only when its
 * denominator came from a quarterly report rather than the filing itself.
 */
export function reportedIsCombinedBasis(
  kind: RatioBasisKind | null | undefined,
  denReport: string | null | undefined,
  isPreferredRow: boolean,
): boolean {
  if (kind === "unverified") return true;
  if (isPreferredRow) return true;
  return kind === "common_only" && denReport != null && denReport !== "A2";
}

/**
 * User-facing labels for a reported figure's ratio basis (revision 3).
 * Raw basis codes never reach the screen.
 */
const RATIO_BASIS_LABELS: Record<RatioBasisKind, Record<Lang, string>> = {
  common_only: { ko: "보통주만의 비율", en: "Common shares only" },
  voting_rights: { ko: "의결권 있는 주식 기준", en: "Voting-rights basis" },
  preferred_only: { ko: "우선주 종류별 비율", en: "Preferred class basis" },
  preferred_combined: { ko: "우선주 합계 비율", en: "Combined preferred basis" },
  issued_total: { ko: "발행주식 총수 기준(원문 그대로)", en: "All issued shares (as filed)" },
  major_holder_report: { ko: "최대주주 변동신고 기준", en: "Major-shareholder report basis" },
  unverified: { ko: "기준 미확인", en: "Basis unverified" },
  year_end: { ko: "연말 목록 종류별 기준", en: "Year-end list class basis" },
};

export function ratioBasisLabel(kind: RatioBasisKind | null | undefined, lang: Lang): string | null {
  if (kind == null) return null;
  return RATIO_BASIS_LABELS[kind]?.[lang] ?? null;
}

/** DART quarterly report codes and filing forms used as denominator sources. */
const DENOMINATOR_REPORT_LABELS: Record<string, Record<Lang, string>> = {
  "11013": { ko: "1분기보고서", en: "Q1 report" },
  "11012": { ko: "반기보고서", en: "Half-year report" },
  "11014": { ko: "3분기보고서", en: "Q3 report" },
  "11011": { ko: "사업보고서", en: "Annual report" },
  A1: { ko: "대량보유보고", en: "Large-holding report" },
  A2: { ko: "임원·주요주주보고", en: "Insider report" },
};

export function denominatorReportLabel(report: string | null | undefined, lang: Lang): string | null {
  if (report == null || report === "") return null;
  return DENOMINATOR_REPORT_LABELS[report]?.[lang] ?? report;
}

/**
 * A1 cover (주식등, incl. warrants etc.) figures line, shown only when the cover
 * differs from the 주권 figures. The pipeline only emits the two fields together,
 * so a half-present pair never renders.
 */
const TITLE_FILING_FIGURES: Record<Lang, string> = {
  ko: "공시 표제(신주인수권 등 포함)",
  en: "Filing cover (incl. subscription warrants etc.)",
};

export function titleFiguresText(
  figure: Pick<Holding, "titleQuantity" | "titleCompanyOwnershipPercent">, lang: Lang,
): string | null {
  if (figure.titleQuantity == null || figure.titleCompanyOwnershipPercent == null) return null;
  const qty = parseDecimal(figure.titleQuantity);
  const ratio = parseDecimal(figure.titleCompanyOwnershipPercent);
  if (qty === null || ratio === null) return null;   // malformed strings never render
  return `${TITLE_FILING_FIGURES[lang]} ${renderAmount(qty)}${lang === "ko" ? "주" : " shares"}·${renderExact(ratio)}%`;
}

/** Raw reported events only; corrections, first reports and indirect estimates stay neutral. */
export function filingChangesForEvents(events: FilingEvent[]): Map<FilingEvent, FilingValueChanges> {
  const bySecurity = new Map<string, FilingEvent[]>();
  for (const event of events) {
    if (!event.stockCode || !DIRECT_EVENT_SOURCES.has(event.source)) continue;
    const key = `${event.corpCode}:${event.stockCode}`;
    const filings = bySecurity.get(key) ?? [];
    filings.push(event);
    bySecurity.set(key, filings);
  }
  const changes = new Map<FilingEvent, FilingValueChanges>();
  for (const filings of bySecurity.values()) {
    filings.sort(compareFilingOrder);
    for (let index = 1; index < filings.length; index++) {
      const current = filings[index], previous = filings[index - 1];
      if (current.isCorrectionOrWithdrawal !== false || previous.isCorrectionOrWithdrawal !== false ||
          current.correctionOf || previous.correctionOf ||
          current.kind === "new-report" || current.kind === "tracking-reentry") continue;
      const quantityDelta = reportedDelta(current.quantity, previous.quantity);
      const exactOwnership = (current.numericKind == null || current.numericKind === "exact") &&
        (previous.numericKind == null || previous.numericKind === "exact");
      // Ownership compares only within the same basis kind (보통주만의 비율끼리 등).
      // A cross-basis pair (e.g. A1 의결권 기준 → A2 합산 기준) shows a basis change instead.
      const ownershipDelta = exactOwnership && sameRatioBasis(current, previous)
        ? reportedDelta(current.companyOwnershipPercent, previous.companyOwnershipPercent) : null;
      changes.set(current, { quantity: deltaDirection(quantityDelta), ownership: deltaDirection(ownershipDelta), quantityDelta, ownershipDelta });
    }
  }
  return changes;
}

/**
 * Per-event basis-change flags for the same pairs `filingChangesForEvents` walks:
 * true when the current and previous figures carry different known bases.
 */
export function filingBasisChangesForEvents(events: FilingEvent[]): Map<FilingEvent, boolean> {
  const bySecurity = new Map<string, FilingEvent[]>();
  for (const event of events) {
    if (!event.stockCode || !DIRECT_EVENT_SOURCES.has(event.source)) continue;
    const key = `${event.corpCode}:${event.stockCode}`;
    const filings = bySecurity.get(key) ?? [];
    filings.push(event);
    bySecurity.set(key, filings);
  }
  const changed = new Map<FilingEvent, boolean>();
  for (const filings of bySecurity.values()) {
    filings.sort(compareFilingOrder);
    for (let index = 1; index < filings.length; index++) {
      const current = filings[index], previous = filings[index - 1];
      if (current.isCorrectionOrWithdrawal !== false || previous.isCorrectionOrWithdrawal !== false ||
          current.correctionOf || previous.correctionOf ||
          current.kind === "new-report" || current.kind === "tracking-reentry") continue;
      changed.set(current, ratioBasisChanged(current, previous));
    }
  }
  return changed;
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
  const latestBySecurity = new Map<string, FilingEvent>();
  for (const event of events) {
    if (!event.stockCode || !DIRECT_EVENT_SOURCES.has(event.source)) continue;
    const key = `${event.corpCode}:${event.stockCode}`;
    const prior = latestBySecurity.get(key);
    if (!prior || compareFilingOrder(event, prior) > 0) latestBySecurity.set(key, event);
  }
  const eventChanges = filingChangesForEvents(events);
  const changes = new Map<Holding, FilingValueChanges>();
  for (const holding of holdings) {
    if (!DIRECT_HOLDING_EVIDENCE.has(holding.evidence)) continue;
    // The combined-preferred aggregate has no per-filing event series: never colour it.
    if (holding.preferredCombined) continue;
    const current = latestBySecurity.get(`${holding.corpCode}:${holding.stockCode}`);
    if (!current || current.receiptNo !== holding.receiptNo) continue;
    // Ratio-adjusted quantities are estimates, not reported figures: never colour them as a trade.
    if (holding.quantityAdjustment) continue;
    const change = eventChanges.get(current);
    if (!change) continue;
    const quantityDelta = sameReportedValue(holding.quantity, current.quantity) ? change.quantityDelta : null;
    const exactOwnership = (holding.ownershipNumericKind == null || holding.ownershipNumericKind === "exact") &&
      sameReportedValue(holding.companyOwnershipPercent, current.companyOwnershipPercent);
    const ownershipDelta = exactOwnership && sameRatioBasis(holding, current) ? change.ownershipDelta : null;
    const quantity = deltaDirection(quantityDelta), ownership = deltaDirection(ownershipDelta);
    if (quantity || ownership) changes.set(holding, { quantity, ownership, quantityDelta, ownershipDelta });
  }
  return changes;
}

/** Holdings whose latest filing pair carries different known bases (show "basis change"). */
export function filingBasisChangesForHoldings(
  holdings: Holding[], events: FilingEvent[],
): Map<Holding, boolean> {
  const latestBySecurity = new Map<string, FilingEvent>();
  for (const event of events) {
    if (!event.stockCode || !DIRECT_EVENT_SOURCES.has(event.source)) continue;
    const key = `${event.corpCode}:${event.stockCode}`;
    const prior = latestBySecurity.get(key);
    if (!prior || compareFilingOrder(event, prior) > 0) latestBySecurity.set(key, event);
  }
  const eventBasisChanges = filingBasisChangesForEvents(events);
  const changed = new Map<Holding, boolean>();
  for (const holding of holdings) {
    if (!DIRECT_HOLDING_EVIDENCE.has(holding.evidence)) continue;
    if (holding.preferredCombined) continue;
    const current = latestBySecurity.get(`${holding.corpCode}:${holding.stockCode}`);
    if (!current || current.receiptNo !== holding.receiptNo) continue;
    if (eventBasisChanges.get(current) === true &&
        sameReportedValue(holding.companyOwnershipPercent, current.companyOwnershipPercent)) {
      changed.set(holding, true);
    }
  }
  return changed;
}

/** Year-end list rows carry no receipt (null; the all-zero placeholder of early dry-runs counts as none). */
export function hasReceiptNo(receiptNo: string | null): receiptNo is string {
  return receiptNo !== null && !/^0{14}$/.test(receiptNo);
}

/**
 * True when the reported ownership is a decimal below 5 (rows kept in the list but
 * outside the 5% filing threshold). The 5% tracking rule is company-level and runs on
 * the 보통주 (voting-rights) basis, so the per-class ratios newly attached in this
 * fix (preferred_only·preferred_combined) never read as "below 5%": the same company's
 * common row carries the status separately, and the combined aggregate is outside
 * tracking by construction. All other rows — common rows and year-end preferred rows
 * without a recomputed basis — keep the previous behavior unchanged.
 */
export function isBelowFivePercent(h: Holding): boolean {
  if (h.ratioBasisKind === "preferred_only" || h.ratioBasisKind === "preferred_combined") return false;
  const ownership = parseDecimal(h.companyOwnershipPercent);
  const threshold = parseDecimal("5");
  return ownership !== null && threshold !== null && compareParsed(ownership, threshold) < 0;
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
  corporate_action_pending: {
    ko: "기업행위 시행 중(거래 정지 구간)이라 평가에서 잠시 제외",
    en: "Temporarily excluded: a corporate action is in progress (trading suspended)",
  },
  corporate_action_ratio_unverified: {
    ko: "기업행위 후 보유 수량·조정 근거 확인을 기다려 평가에서 제외",
    en: "Excluded pending verification of holdings and corporate-action adjustments",
  },
  delisting_pending: {
    ko: "상장폐지 진행 중이라 평가에서 제외",
    en: "Excluded while delisting is in progress",
  },
  corporate_action_unverified: {
    ko: "공시 후 주식 변동·실제 보유 수량 확인을 기다려 평가에서 제외",
    en: "Excluded pending verification of share changes and actual holdings since the filing",
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

/** Quote session in clear ko/en terms; unknown values retain their label. */
export function quoteSessionLabel(session: string, lang: Lang): string {
  if (session === "regular") return lang === "ko" ? "정규장" : "Regular session";
  return session;
}

export function quotePriceDetail(quote: Pick<Quote, "close" | "tradeDate" | "session">, lang: Lang): string {
  return `${formatKrw(quote.close, lang)} · ${quote.tradeDate} · ${quoteSessionLabel(quote.session, lang)}`;
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
    if (quality === "below-5" && s !== "exit" && !isBelowFivePercent(h)) return false;
    if (quality === "ratio-adjusted" && !h.quantityAdjustment) return false;
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

/**
 * A display-only projection in pipeline observation order (basis date,
 * receipt date, receipt number), per security; company fallback for unknown codes.
 * Corrections and withdrawals participate normally in the same order.
 * Keep the original objects/array for the complete disclosure history.
 */
export function latestFilingsByStock(events: readonly FilingEvent[]): FilingEvent[] {
  const latest = new Map<string, FilingEvent>();
  for (const event of events) {
    const key = event.stockCode ? `stock:${event.stockCode}` : `corp:${event.corpCode}`;
    const prior = latest.get(key);
    if (!prior || compareFilingOrder(event, prior) > 0) {
      latest.set(key, event);
    }
  }
  return [...latest.values()].sort((a, b) => compareFilingOrder(b, a));
}

/** A later receipt can describe an earlier holding date; this does not change the selected filing. */
export function isLateFilingWithOlderBasis(event: FilingEvent, holding: Holding | undefined): boolean {
  return !!(holding?.holdingDate && event.basisDate && event.receiptDate > holding.receiptDate &&
    event.basisDate < holding.holdingDate);
}

export function eventRangeOf(events: FilingEvent[]): EventRange | null {
  if (!events.length) return null;
  const dates = events.map((e) => e.receiptDate).sort();
  return { from: dates[0], to: dates[dates.length - 1], count: events.length };
}
