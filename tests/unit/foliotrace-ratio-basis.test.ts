import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { FilingEvent, Holding } from "../../src/features/foliotrace/contracts.ts";
import {
  denominatorReportLabel,
  filingBasisChangesForEvents,
  filingBasisChangesForHoldings,
  filingChangesForEvents,
  filingChangesForHoldings,
  holdingKeyOf,
  ratioBasisLabel,
  reportedIsCombinedBasis,
  selectionKeyForEvent,
} from "../../src/features/foliotrace/ui/holdings.ts";

function holding(overrides: Partial<Holding> & { stockCode: string }): Holding {
  return {
    corpCode: "00795135",
    name: "코오롱인더",
    securityKind: "common",
    quantity: "3876947",
    companyOwnershipPercent: "12.94644646075313",
    ratioBasisKind: "common_only",
    reportedCompanyOwnershipPercent: "11.91",
    ratioDenominatorValue: "29946032",
    ratioDenominatorDate: "2026-06-30",
    ratioDenominatorReport: "11012",
    ratioDenominatorReceipt: "20260814003133",
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

test("A1 voting-rights and recomputed common-only share the 보통주 group", () => {
  // 코오롱 실제 공시: A1 20261002000509 보통주 3,869,337 / 의결권 29,946,032 = 12.92%,
  // A2 20261006000227 보통주만의 비율 12.946%(원문 11.91%는 합산 기준).
  // A1 의결권 총수 = DART 보통주 분모이므로 같은 기준 — 증감을 그대로 비교한다.
  const prev = a1(), cur = a2();
  const changes = filingChangesForEvents([prev, cur]);
  const change = changes.get(cur);
  assert.equal(change?.quantity, "up");
  assert.equal(change?.quantityDelta, "7610");
  assert.equal(change?.ownership, "up");
  assert.equal(change?.ownershipDelta, "0.02644646075313");
  assert.equal(filingBasisChangesForEvents([prev, cur]).get(cur), false);
});

test("a combined-basis filing against a per-class figure shows a basis change", () => {
  // 분모 미분리 A2(원문 그대로, issued_total)는 보통주 기준과 뺄 수 없다.
  const prev = event({
    receiptNo: "20260102000001", receiptDate: "2026-01-02", quantity: "900", companyOwnershipPercent: "5.10",
    ratioBasisKind: "common_only",
  });
  const cur = event({
    receiptNo: "20260103000001", receiptDate: "2026-01-03", quantity: "1000", companyOwnershipPercent: "6.10",
    ratioBasisKind: "issued_total",
  });
  const changes = filingChangesForEvents([prev, cur]);
  assert.equal(changes.get(cur)?.quantityDelta, "100");
  assert.equal(changes.get(cur)?.ownershipDelta, null);
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

test("holdings compare A1 and recomputed common-only within the 보통주 group", () => {
  const h = holding({ stockCode: "120110" });
  const prev = a1(), cur = a2();
  const changes = filingChangesForHoldings([h], [prev, cur]);
  assert.deepEqual(changes.get(h),
    { quantity: "up", ownership: "up", quantityDelta: "7610", ownershipDelta: "0.02644646075313" });
  assert.equal(filingBasisChangesForHoldings([h], [prev, cur]).get(h), undefined);
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

test("preserved filing percentages say when they use the combined basis", () => {
  // 합산 정의 원문: 미확인 A2, 우선주 종류 행, 분기 분모의 보통주 행.
  assert.equal(reportedIsCombinedBasis("unverified", null, false), true);
  assert.equal(reportedIsCombinedBasis("preferred_only", "11012", true), true);
  assert.equal(reportedIsCombinedBasis("common_only", "11012", false), true);
  // 우선주 없는 회사의 A2(분모가 공시 자체): 원문과 같은 기준이라 합산 표기 없음.
  assert.equal(reportedIsCombinedBasis("common_only", "A2", false), false);
  assert.equal(reportedIsCombinedBasis("voting_rights", "A1", false), false);
});

test("event name buttons resolve to the holding key, not the bare stock code", () => {
  const common = holding({ stockCode: "120110", receiptNo: "20261006000227" });
  const ev = a2();
  assert.equal(selectionKeyForEvent(ev, [common]), holdingKeyOf(common));
  assert.equal(selectionKeyForEvent(ev, [common]), "120110:common:20261006000227");
  // 보유 종목이 없는 이력 전용 이벤트는 종목코드 그대로(상세 대신 이력 시트).
  const historyOnly = event({ receiptNo: "20200101000001", receiptDate: "2020-01-05", stockCode: "999999" });
  assert.equal(selectionKeyForEvent(historyOnly, [common]), "999999");
  // 합계 줄(회사코드 식별자)은 종목코드 이벤트와 절대 매칭되지 않는다.
  const combined = holding({
    stockCode: "00148540", name: "CJ 우선주 합계", securityKind: "unknown",
    quantity: "90712", companyOwnershipPercent: "1.398423089582047",
    receiptNo: "20261006000147", receiptDate: "2026-10-06", holdingDate: "2026-09-30",
    preferredCombined: true, ratioBasisKind: "preferred_combined",
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261006000147",
  });
  const cjEvent = event({
    corpCode: "00148540", receiptNo: "20261006000147", receiptDate: "2026-10-06", basisDate: "2026-09-30",
    stockCode: "001040", quantity: "3345231", companyOwnershipPercent: "11.465302221976366",
    ratioBasisKind: "common_only",
  });
  assert.equal(selectionKeyForEvent(cjEvent, [combined]), "001040");
});

test("the recent-events name button goes through the holding-key resolver", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const page = fs.readFileSync(path.join(root, "src/features/foliotrace/ui/FolioTracePage.tsx"), "utf8");
  assert.match(page, /setSelectedCode\(selectionKeyForEvent\(event, snapshot\.holdings\)\)/);
  assert.doesNotMatch(page, /setSelectedCode\(event\.stockCode/);
});

test("the public-data validator accepts the company-code aggregate and rejects listed-code reuse", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { validatePublicData, DATA_SUBPATH } = await import("../../scripts/foliotrace-public-data.mjs");

  const version = "a".repeat(64);
  const baseHolding = {
    corpCode: "00148540", stockCode: "001040", name: "CJ", securityKind: "common",
    quantity: "3345231", companyOwnershipPercent: "11.465302221976366",
    ratioBasisKind: "common_only", reportedCompanyOwnershipPercent: "9.63",
    ratioDenominatorValue: "29176998", ratioDenominatorDate: "2026-06-30",
    ratioDenominatorReport: "11012", ratioDenominatorReceipt: "20260814002852",
    receiptNo: "20261006000147", receiptDate: "2026-10-06", holdingDate: "2026-09-30",
    evidence: "dart-structured", sourceKind: "nps-filing",
    latestUnresolvedReceiptNo: null, latestUnresolvedReason: null,
    tracking: "active", quote: null, estimatedValue: "100",
    portfolioWeightPercent: "50.00", valuationExclusionReason: null,
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261006000147",
  };
  const combined = {
    corpCode: "00148540", stockCode: "00148540", name: "CJ 우선주 합계", securityKind: "unknown",
    quantity: "90712", companyOwnershipPercent: "1.398423089582047",
    ratioBasisKind: "preferred_combined", preferredCombined: true,
    ratioDenominatorValue: "6486735", ratioDenominatorDate: "2026-06-30",
    ratioDenominatorReport: "11012", ratioDenominatorReceipt: "20260814002852",
    receiptNo: "20261006000147", receiptDate: "2026-10-06", holdingDate: "2026-09-30",
    evidence: "dart-structured", sourceKind: "nps-filing",
    latestUnresolvedReceiptNo: null, latestUnresolvedReason: null,
    tracking: "active", quote: null, estimatedValue: null,
    portfolioWeightPercent: null, valuationExclusionReason: "security_mapping_unverified",
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261006000147",
  };
  const skeleton = (holdings: unknown[]) => ({
    schemaVersion: 1, datasetVersion: version,
    portfolio: { id: "p", entityId: "e", market: "KRX", currency: "KRW", scopeKo: "s", scopeEn: "s", methodologyVersion: "2", legacyCoverage: "verified" },
    entity: { id: "e", kind: "institution", nameKo: "n", nameEn: "n", officialId: null, source: "OpenDART" },
    valuationTradeDate: "2026-11-13", filingsCheckedAt: null, generatedAt: "2026-11-15T00:00:00Z",
    publishedAt: null, latestReceiptDate: "2026-10-06", trackedCount: holdings.length,
    pricedCount: holdings.filter((h) => (h as Holding).estimatedValue !== null).length,
    unresolvedCount: 0, estimatedValue: "100", valuationCoverage: "partial", filingCoverage: "complete",
    holdings, events: [], history: [],
  });
  const layOut = (holdings: unknown[]) => {
    const dir = mkdtempSync(join(tmpdir(), "ft-combined-"));
    const snap = skeleton(holdings);
    const bytes = Buffer.from(JSON.stringify(snap));
    mkdirSync(join(dir, DATA_SUBPATH, "snapshots"), { recursive: true });
    writeFileSync(join(dir, DATA_SUBPATH, "snapshots", `${version}.json`), bytes);
    writeFileSync(join(dir, DATA_SUBPATH, "manifest.json"), JSON.stringify({
      schemaVersion: 1, datasetVersion: version,
      snapshotPath: `snapshots/${version}.json`, snapshotSha256: createHash("sha256").update(bytes).digest("hex"),
    }));
    return dir;
  };

  // 합계 줄(회사코드 식별자)은 기존 보통주 줄과 겹치지 않아 통과한다.
  await validatePublicData(layOut([baseHolding, combined]));
  // 합계 줄에 상장 종목코드를 쓰면 스키마 단계에서 거절된다(사이트 검증기와 같은 규칙).
  await assert.rejects(validatePublicData(layOut([baseHolding, { ...combined, stockCode: "001040" }])));
  // 종목코드 중복도 그대로 거절된다.
  await assert.rejects(validatePublicData(layOut([baseHolding, { ...baseHolding, quantity: "1" }])));
});
