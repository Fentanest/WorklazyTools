import assert from "node:assert/strict";
import test from "node:test";

import type { FilingEvent, Holding } from "../../src/features/foliotrace/contracts.ts";
import {
  denominatorReportLabel,
  filingBasisChangesForEvents,
  filingBasisChangesForHoldings,
  filingChangesForEvents,
  filingChangesForHoldings,
  ratioBasisLabel,
} from "../../src/features/foliotrace/ui/holdings.ts";

function holding(overrides: Partial<Holding> & { stockCode: string }): Holding {
  return {
    corpCode: "00795135",
    name: "코오롱인더",
    securityKind: "common",
    quantity: "3876947",
    companyOwnershipPercent: "12.94644646075313",
    receiptNo: "20261006000227",
    receiptDate: "2026-10-06",
    holdingDate: "2026-09-30",
    evidence: "dart-structured",
    tracking: "active",
    quote: null,
    estimatedValue: null,
    portfolioWeightPercent: null,
    valuationExclusionReason: null,
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261006000227",
    latestUnresolvedReceiptNo: null,
    latestUnresolvedReason: null,
    ...overrides,
  };
}

function event(overrides: Partial<FilingEvent> & { receiptNo: string; receiptDate: string }): FilingEvent {
  return {
    corpCode: "00795135",
    stockCode: "120110",
    kind: "other",
    correctionOf: null,
    isCorrectionOrWithdrawal: false,
    quantity: "3876947",
    companyOwnershipPercent: "12.94644646075313",
    source: "dart-structured",
    filingUrl: null,
    ...overrides,
  };
}

// 코오롱인더 실제 공시: A1 20261002000509 보통주 3,869,337 / 의결권 29,946,032 = 12.92%,
// A2 20261006000227 보통주만의 비율 12.946%(원문 11.91%는 합산 기준).
const a1 = () => event({
  receiptNo: "20261002000509", receiptDate: "2026-10-02", basisDate: "2026-09-23",
  quantity: "3869337", companyOwnershipPercent: "12.92", ratioBasisKind: "voting_rights",
});
const a2 = () => event({
  receiptNo: "20261006000227", receiptDate: "2026-10-06", basisDate: "2026-09-30",
  quantity: "3876947", companyOwnershipPercent: "12.94644646075313",
  ratioBasisKind: "common_only", reportedCompanyOwnershipPercent: "11.91",
});

test("cross-basis pairs show a basis change instead of a numeric ownership delta", () => {
  const prev = a1(), cur = a2();
  const changes = filingChangesForEvents([prev, cur]);
  const change = changes.get(cur);
  assert.equal(change?.quantity, "up"); // 보통주끼리 수량은 그대로 비교
  assert.equal(change?.quantityDelta, "7610");
  assert.equal(change?.ownership, null); // 의결권 기준과 보통주 기준은 빼지 않는다
  assert.equal(change?.ownershipDelta, null);
  assert.equal(filingBasisChangesForEvents([prev, cur]).get(cur), true);
});

test("same-basis pairs compare per-class ratios exactly", () => {
  const earlier = event({
    receiptNo: "20260401000999", receiptDate: "2026-04-01", basisDate: "2026-03-27",
    quantity: "3860000", companyOwnershipPercent: "12.89", ratioBasisKind: "common_only",
  });
  const cur = a2();
  const changes = filingChangesForEvents([earlier, cur]);
  assert.equal(changes.get(cur)?.ownershipDelta, "0.05644646075313");
  assert.equal(filingBasisChangesForEvents([earlier, cur]).get(cur), false);
});

test("snapshots without basis info keep the legacy comparison", () => {
  const previous = event({ receiptNo: "20260102000001", receiptDate: "2026-01-02", quantity: "900", companyOwnershipPercent: "5.10" });
  const current = event({ receiptNo: "20260103000001", receiptDate: "2026-01-03", quantity: "1000", companyOwnershipPercent: "6.10" });
  assert.equal(filingChangesForEvents([previous, current]).get(current)?.ownershipDelta, "1");
  assert.equal(filingBasisChangesForEvents([previous, current]).get(current), false);
});

test("a known basis against an unknown one never produces an ownership delta", () => {
  const previous = event({ receiptNo: "20260102000001", receiptDate: "2026-01-02", quantity: "900", companyOwnershipPercent: "5.10" });
  const cur = a2();
  const changes = filingChangesForEvents([previous, cur]);
  assert.equal(changes.get(cur)?.ownershipDelta, null);
  assert.equal(filingBasisChangesForEvents([previous, cur]).get(cur), false);
});

test("holdings follow the same-basis rule and flag the change", () => {
  const h = holding({ stockCode: "120110" });
  const prev = a1(), cur = a2();
  const changes = filingChangesForHoldings([h], [prev, cur]);
  assert.deepEqual(changes.get(h),
    { quantity: "up", ownership: null, quantityDelta: "7610", ownershipDelta: null }); // 수량은 비교, 지분율은 기준 변경
  assert.equal(filingBasisChangesForHoldings([h], [prev, cur]).get(h), true);
});

test("the combined-preferred aggregate never takes part in filing changes", () => {
  const combined = holding({
    stockCode: "001040", name: "CJ 우선주 합계", securityKind: "unknown",
    quantity: "90712", companyOwnershipPercent: "1.398423089582047",
    receiptNo: "20261006000147", receiptDate: "2026-10-06", holdingDate: "2026-09-30",
    preferredCombined: true, ratioBasisKind: "preferred_combined",
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261006000147",
  });
  const ev = event({
    corpCode: "00148540", receiptNo: "20261006000147", receiptDate: "2026-10-06", basisDate: "2026-09-30",
    stockCode: "001040", quantity: "3345231", companyOwnershipPercent: "11.465302221976366",
    ratioBasisKind: "common_only",
  });
  assert.equal(filingChangesForHoldings([combined], [ev]).has(combined), false);
  assert.equal(filingBasisChangesForHoldings([combined], [ev]).has(combined), false);
});

test("basis and denominator-source labels render without raw codes", () => {
  assert.equal(ratioBasisLabel("common_only", "ko"), "보통주만의 비율");
  assert.equal(ratioBasisLabel("preferred_combined", "ko"), "우선주 합계 비율");
  assert.equal(ratioBasisLabel("unverified", "ko"), "기준 미확인");
  assert.equal(ratioBasisLabel("common_only", "en"), "Common shares only");
  assert.equal(ratioBasisLabel(null, "ko"), null);
  assert.equal(ratioBasisLabel(undefined, "en"), null);
  assert.equal(denominatorReportLabel("11012", "ko"), "반기보고서");
  assert.equal(denominatorReportLabel("11014", "en"), "Q3 report");
  assert.equal(denominatorReportLabel("A1", "ko"), "대량보유보고서(A1)");
  assert.equal(denominatorReportLabel("ZZ", "ko"), "ZZ");
  assert.equal(denominatorReportLabel(null, "ko"), null);
});
