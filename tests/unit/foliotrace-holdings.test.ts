import assert from "node:assert/strict";
import test from "node:test";

import type { FilingEvent, Holding } from "../../src/features/foliotrace/contracts.ts";
import {
  approxNumber,
  eventRangeOf,
  exclusionReasonLabel,
  filterHoldings,
  formatKrw,
  formatPct,
  formatQty,
  holdingStatus,
  latestUnresolvedReasonLabel,
  quoteProviderLabel,
  quoteSessionLabel,
  sortHoldings,
  topHoldings,
} from "../../src/features/foliotrace/ui/holdings.ts";
import { getFaqsForPath } from "../../src/i18n/guideData.ts";

function holding(overrides: Partial<Holding> & { stockCode: string }): Holding {
  return {
    corpCode: "00100000",
    name: "Fixture Corp",
    securityKind: "common",
    quantity: "1000",
    companyOwnershipPercent: "6.10",
    receiptNo: "20260101000001",
    receiptDate: "2026-01-05",
    holdingDate: "2025-12-31",
    evidence: "dart-structured",
    tracking: "active",
    quote: {
      close: "70000",
      currency: "KRW",
      market: "KRX",
      session: "regular",
      tradeDate: "2026-01-05",
      adjusted: false,
      provider: "naver",
      observedAt: "2026-01-05T16:30:00+09:00",
      verified: true,
    },
    estimatedValue: "70000000",
    portfolioWeightPercent: "10.00",
    valuationExclusionReason: null,
    filingUrl: "https://dart.fss.or.kr/example",
    latestUnresolvedReceiptNo: null,
    latestUnresolvedReason: null,
    ...overrides,
  };
}

function event(overrides: Partial<FilingEvent> & { receiptNo: string; receiptDate: string }): FilingEvent {
  return {
    corpCode: "00100000",
    stockCode: "005930",
    kind: "increase",
    correctionOf: null,
    quantity: "1000",
    companyOwnershipPercent: "6.10",
    source: "dart-structured",
    filingUrl: null,
    ...overrides,
  };
}

test("financial display preserves >2^53 decimal strings exactly", () => {
  // Number("9007199254740993") === 9007199254740992: must not round.
  assert.equal(formatKrw("9007199254740993", "ko"), "₩9,007,199,254,740,993");
  assert.equal(formatKrw("9007199254740993", "en"), "₩9,007,199,254,740,993");
  assert.equal(formatQty("9007199254740993"), "9,007,199,254,740,993");
  assert.equal(formatPct("9007199254740993"), "9,007,199,254,740,993%");
});

test("financial display preserves fractional digits without rounding", () => {
  assert.equal(formatKrw("1234567.891", "ko"), "₩1,234,567.891");
  assert.equal(formatQty("1000.5000"), "1,000.5000");
  assert.equal(formatPct("12.3456"), "12.3456%");
  assert.equal(formatPct("6.10"), "6.10%");
});

test("financial display renders null and non-decimal input as em-dash, never NaN", () => {
  assert.equal(formatKrw(null, "ko"), "—");
  assert.equal(formatPct(null), "—");
  assert.equal(formatQty(null), "—");
  for (const bad of ["not-a-number", "Infinity", "NaN", "1e5", "", "12,000"]) {
    assert.equal(formatKrw(bad, "ko"), "—", bad);
    assert.equal(formatQty(bad), "—", bad);
    assert.equal(formatPct(bad), "—", bad);
  }
  const ko = formatKrw("70000000", "ko");
  assert.ok(ko.includes("70,000,000"), `unexpected ko value: ${ko}`);
  assert.ok(!ko.includes("NaN"), `NaN leaked: ${ko}`);
});

test("approxNumber exists only for bar sizing and never throws", () => {
  assert.equal(approxNumber(null), 0);
  assert.equal(approxNumber("not-a-number"), 0);
  assert.ok(approxNumber("10.00") > 0);
});

test("decimal ordering distinguishes adjacent values above 2^53", () => {
  const rows = [
    holding({ stockCode: "lower", estimatedValue: "9007199254740992" }),
    holding({ stockCode: "upper", estimatedValue: "9007199254740993" }),
    holding({ stockCode: "top", estimatedValue: "9007199254740993.5" }),
  ];
  // A Number-based sort ties the first two; exact decimal sort must not.
  assert.deepEqual(
    sortHoldings(rows, "value").map((h) => h.stockCode),
    ["top", "upper", "lower"],
  );
});

test("decimal ordering handles fractions, signs, and leading zeros", () => {
  const rows = [
    holding({ stockCode: "frac-short", companyOwnershipPercent: "6.1" }),
    holding({ stockCode: "frac-long", companyOwnershipPercent: "6.10" }),
    holding({ stockCode: "frac-more", companyOwnershipPercent: "6.101" }),
    holding({ stockCode: "padded", companyOwnershipPercent: "006.100" }),
  ];
  const sorted = sortHoldings(rows, "ownership").map((h) => h.stockCode);
  assert.equal(sorted[0], "frac-more");
  // 6.1 == 6.10 == 006.100: equal keys keep their relative input order.
  assert.deepEqual(sorted.slice(1), ["frac-short", "frac-long", "padded"]);
});

test("sortHoldings puts null and non-decimal values last without dropping rows", () => {
  const rows = [
    holding({ stockCode: "bad", estimatedValue: "garbage" }),
    holding({ stockCode: "none", estimatedValue: null }),
    holding({ stockCode: "big", estimatedValue: "9007199254740993" }),
    holding({ stockCode: "small", estimatedValue: "1000" }),
  ];
  const sorted = sortHoldings(rows, "value").map((h) => h.stockCode);
  assert.deepEqual(sorted.slice(0, 2), ["big", "small"]);
  assert.equal(sorted.length, 4);
  assert.ok(sorted.slice(2).includes("bad") && sorted.slice(2).includes("none"));
});

test("sortHoldings defaults to value desc and supports receipt desc", () => {
  const rows = [
    holding({ stockCode: "small", estimatedValue: "1000", receiptDate: "2026-01-03" }),
    holding({ stockCode: "none", estimatedValue: null, receiptDate: "2026-01-04" }),
    holding({ stockCode: "big", estimatedValue: "9000", receiptDate: "2026-01-02" }),
  ];
  assert.deepEqual(
    sortHoldings(rows, "value").map((h) => h.stockCode),
    ["big", "small", "none"],
  );
  assert.deepEqual(
    sortHoldings(rows, "receipt").map((h) => h.stockCode),
    ["none", "small", "big"],
  );
});

test("holdingStatus prioritizes tracking-exit, then unresolved, then exclusion", () => {
  assert.equal(holdingStatus(holding({ stockCode: "005930" })), "included");
  assert.equal(
    holdingStatus(holding({ stockCode: "000660", tracking: "below-5-percent" })),
    "exit",
  );
  assert.equal(
    holdingStatus(holding({ stockCode: "000660", evidence: "unresolved-latest" })),
    "unresolved",
  );
  assert.equal(holdingStatus(holding({ stockCode: "000660", quote: null })), "excluded");
  assert.equal(holdingStatus(holding({ stockCode: "000660", estimatedValue: null })), "excluded");
  // Exit wins even over unresolved evidence: a 5% exit is not "latest unverified".
  assert.equal(
    holdingStatus(
      holding({ stockCode: "000660", tracking: "below-5-percent", evidence: "unresolved-latest" }),
    ),
    "exit",
  );
});

test("filterHoldings searches names and string codes, preserves leading zeros", () => {
  const rows = [
    holding({ stockCode: "005930", name: "삼성전자" }),
    holding({ stockCode: "000660", name: "SK하이닉스" }),
  ];
  assert.deepEqual(
    filterHoldings(rows, "0059", "all").map((h) => h.stockCode),
    ["005930"],
  );
  assert.deepEqual(
    filterHoldings(rows, "005930", "all").map((h) => h.stockCode),
    ["005930"],
  );
  assert.equal(filterHoldings(rows, "삼성", "all").length, 1);
  assert.equal(filterHoldings(rows, "  ", "all").length, 2);
  assert.equal(filterHoldings(rows, "no-such-security", "all").length, 0);
});

test("filterHoldings quality filters separate priced, unpriced, and exits", () => {
  const rows = [
    holding({ stockCode: "005930" }),
    holding({ stockCode: "000660", quote: null, estimatedValue: null }),
    holding({ stockCode: "035420", tracking: "below-5-percent" }),
  ];
  assert.deepEqual(
    filterHoldings(rows, "", "priced").map((h) => h.stockCode),
    ["005930"],
  );
  assert.deepEqual(
    filterHoldings(rows, "", "unpriced").map((h) => h.stockCode).sort(),
    ["000660", "035420"],
  );
  assert.deepEqual(
    filterHoldings(rows, "", "below-5").map((h) => h.stockCode),
    ["035420"],
  );
});

test("topHoldings takes the top 8 priced weights in exact desc order", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    holding({ stockCode: `code-${i}`, portfolioWeightPercent: `${i + 1}.00` }),
  );
  rows.push(holding({ stockCode: "unpriced", portfolioWeightPercent: null }));
  const top = topHoldings(rows);
  assert.equal(top.length, 8);
  assert.deepEqual(
    top.map((h) => h.stockCode),
    ["code-9", "code-8", "code-7", "code-6", "code-5", "code-4", "code-3", "code-2"],
  );
});

test("every known exclusion reason maps to ko/en text, never the raw code", () => {
  const known = [
    "tracking_exit",
    "security_mapping_unverified",
    "quantity_unverified",
    "zero_quantity",
    "quote_unverified",
    "quote_date_or_session_mismatch",
    "quote_basis_unverified",
    "latest_filing_unresolved",
    "filing_after_quote_date",
    "corporate_action_unverified",
  ];
  for (const reason of known) {
    for (const lang of ["ko", "en"] as const) {
      const label = exclusionReasonLabel(reason, lang);
      assert.ok(label, `${reason}/${lang} must map`);
      assert.ok(!label!.includes(reason), `${reason}/${lang} leaks raw code: ${label}`);
      assert.ok(!label!.includes("_"), `${reason}/${lang} looks unmapped: ${label}`);
    }
  }
  assert.equal(exclusionReasonLabel("tracking_exit", "ko"), "5% 미만이라 평가에서 제외");
  assert.equal(
    exclusionReasonLabel("security_mapping_unverified", "ko"),
    "공시의 주식 종류와 종목을 확인하지 못해 평가에서 제외",
  );
  assert.equal(
    exclusionReasonLabel("quote_date_or_session_mismatch", "en"),
    "Excluded: the closing-price date or regular trading price could not be confirmed",
  );
  assert.equal(
    exclusionReasonLabel("latest_filing_unresolved", "ko"),
    "최신 공시가 확인되지 않아 평가에서 제외 — 이전 확인 수량은 유지",
  );
  assert.ok(
    (exclusionReasonLabel("latest_filing_unresolved", "en") ?? "").includes("retained"),
  );
});

test("latest-unresolved sub-reasons map, unknowns fall back without echo", () => {
  assert.equal(latestUnresolvedReasonLabel(null, "ko"), null);
  assert.equal(latestUnresolvedReasonLabel("needs_filing_parse", "ko"), "공시 내용 확인 중");
  assert.equal(latestUnresolvedReasonLabel("correction_relation_unverified", "en"), "Correction relation unverified");
  assert.equal(latestUnresolvedReasonLabel("withdrawal_unverified", "ko"), "철회 여부 미확인");
  assert.equal(latestUnresolvedReasonLabel("security_identity_missing", "en"), "Not enough information to identify the share class and security");
  assert.equal(latestUnresolvedReasonLabel("future_code", "ko"), "미확인 사유");
  assert.equal(latestUnresolvedReasonLabel("future_code", "en"), "Unverified reason");
});

test("visible FAQ carries approved ko/en questions and answers", () => {
  // FT-10 regression: the React page rendered no FAQ at all.
  const korean = getFaqsForPath("ko", "foliotrace", "/tools/foliotrace");
  const english = getFaqsForPath("en", "foliotrace", "/tools/foliotrace");
  assert.equal(korean.length, 6);
  assert.equal(english.length, korean.length);
  const questions = new Set<string>();
  for (let i = 0; i < korean.length; i++) {
    assert.ok(korean[i].question.trim() && english[i].question.trim(), "each FAQ needs both questions");
    assert.ok(korean[i].answer.trim() && english[i].answer.trim(), "each FAQ needs both answers");
    questions.add(korean[i].question);
  }
  assert.equal(questions.size, korean.length, "FAQ questions must be distinct");
  const allKo = korean.map((e) => `${e.question} ${e.answer}`).join("\n");
  assert.ok(allKo.includes("전체 자산"), "FAQ must state the not-total-assets scope");
  assert.ok(allKo.includes("정규장 종가"), "FAQ must state the price basis");
});

test("unknown exclusion reasons fall back generically without echoing", () => {
  assert.equal(exclusionReasonLabel(null, "ko"), null);
  assert.equal(exclusionReasonLabel(null, "en"), null);
  for (const unknown of ["some_future_reason", "SECURITY_MAPPING_UNVERIFIED", "tracking_exit ", ""]) {
    for (const lang of ["ko", "en"] as const) {
      const label = exclusionReasonLabel(unknown, lang);
      assert.ok(label, `unknown reason must still explain: ${JSON.stringify(unknown)}`);
      assert.ok(!label!.includes(unknown) || unknown === "", `echoes unknown code: ${label}`);
    }
  }
  assert.equal(exclusionReasonLabel("some_future_reason", "ko"), "확인되지 않은 사유로 평가에서 제외");
  assert.equal(exclusionReasonLabel("some_future_reason", "en"), "Excluded: reason unavailable");
});

test("quote session/provider render as clear terms with identity kept", () => {
  assert.equal(quoteSessionLabel("regular", "ko"), "정규장");
  assert.equal(quoteSessionLabel("regular", "en"), "Regular session");
  assert.equal(quoteProviderLabel("naver", "ko"), "네이버");
  assert.equal(quoteProviderLabel("naver", "en"), "Naver");
  // Unknown contract values pass through (own data, React-escaped), never blank.
  assert.equal(quoteSessionLabel("auction", "ko"), "auction");
  assert.equal(quoteProviderLabel("other-feed", "en"), "other-feed");
});

test("eventRangeOf reports the real receipt-date span, never fabricated", () => {
  assert.equal(eventRangeOf([]), null);
  assert.deepEqual(eventRangeOf([event({ receiptNo: "a", receiptDate: "2026-01-05" })]), {
    from: "2026-01-05",
    to: "2026-01-05",
    count: 1,
  });
  assert.deepEqual(
    eventRangeOf([
      event({ receiptNo: "a", receiptDate: "2026-01-07" }),
      event({ receiptNo: "b", receiptDate: "2026-01-05" }),
    ]),
    { from: "2026-01-05", to: "2026-01-07", count: 2 },
  );
});
