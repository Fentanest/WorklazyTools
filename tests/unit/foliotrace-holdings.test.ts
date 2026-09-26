import assert from "node:assert/strict";
import test from "node:test";

import type { FilingEvent, Holding } from "../../src/features/foliotrace/contracts.ts";
import {
  eventRangeOf,
  filterHoldings,
  formatKrw,
  formatPct,
  formatQty,
  holdingStatus,
  sortHoldings,
  toNumberOrNull,
  topHoldings,
} from "../../src/features/foliotrace/ui/holdings.ts";

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

test("toNumberOrNull never produces NaN/Infinity and keeps null as null", () => {
  assert.equal(toNumberOrNull(null), null);
  assert.equal(toNumberOrNull("70000"), 70000);
  assert.equal(toNumberOrNull("005930"), 5930);
  assert.equal(toNumberOrNull("not-a-number"), null);
  assert.equal(toNumberOrNull("Infinity"), null);
});

test("formatters render null as em-dash and never NaN", () => {
  assert.equal(formatKrw(null, "ko"), "—");
  assert.equal(formatPct(null), "—");
  assert.equal(formatQty(null), "—");
  const ko = formatKrw("70000000", "ko");
  assert.ok(ko.includes("70,000,000"), `unexpected ko value: ${ko}`);
  assert.ok(!ko.includes("NaN"), `NaN leaked: ${ko}`);
  assert.equal(formatPct("12.3456"), "12.35%");
  assert.equal(formatQty("1000.5"), "1,000.5");
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

test("sortHoldings defaults to value desc with nulls last", () => {
  const rows = [
    holding({ stockCode: "small", estimatedValue: "1000", portfolioWeightPercent: "1.00", receiptDate: "2026-01-03" }),
    holding({ stockCode: "none", estimatedValue: null, portfolioWeightPercent: null, receiptDate: "2026-01-04" }),
    holding({ stockCode: "big", estimatedValue: "9000", portfolioWeightPercent: "9.00", receiptDate: "2026-01-02" }),
  ];
  assert.deepEqual(
    sortHoldings(rows, "value").map((h) => h.stockCode),
    ["big", "small", "none"],
  );
  assert.deepEqual(
    sortHoldings(rows, "weight").map((h) => h.stockCode),
    ["big", "small", "none"],
  );
  assert.deepEqual(
    sortHoldings(rows, "receipt").map((h) => h.stockCode),
    ["none", "small", "big"],
  );
});

test("topHoldings takes the top 8 priced weights in desc order", () => {
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
