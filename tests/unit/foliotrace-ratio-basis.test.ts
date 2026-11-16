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

test("basis and denominator-source labels render without raw codes", async () => {
  const { titleFiguresText } = await import("../../src/features/foliotrace/ui/holdings.ts");
  assert.equal(ratioBasisLabel("common_only", "ko"), "보통주만의 비율");
  assert.equal(ratioBasisLabel("preferred_combined", "ko"), "우선주 합계 비율");
  assert.equal(ratioBasisLabel("unverified", "ko"), "기준 미확인");
  assert.equal(ratioBasisLabel("common_only", "en"), "Common shares only");
  assert.equal(ratioBasisLabel(null, "ko"), null);
  assert.equal(ratioBasisLabel(undefined, "en"), null);
  assert.equal(denominatorReportLabel("11012", "ko"), "반기보고서");
  assert.equal(denominatorReportLabel("11014", "en"), "Q3 report");
  assert.equal(denominatorReportLabel("A1", "ko"), "대량보유보고");
  assert.equal(denominatorReportLabel("A2", "ko"), "임원·주요주주보고");
  assert.equal(denominatorReportLabel("A1", "en"), "Large-holding report");
  assert.equal(denominatorReportLabel("A2", "en"), "Insider report");
  assert.equal(denominatorReportLabel("ZZ", "ko"), "ZZ");
  assert.equal(denominatorReportLabel(null, "ko"), null);
  // 새 문구 전수: 내부 코드·영문 kind 값이 화면에 나오지 않는다.
  const labels = [
    ratioBasisLabel("common_only", "ko"), ratioBasisLabel("unverified", "en"),
    denominatorReportLabel("11012", "ko"),
    titleFiguresText({ titleQuantity: "1", titleCompanyOwnershipPercent: "1" }, "ko"),
    titleFiguresText({ titleQuantity: "1", titleCompanyOwnershipPercent: "1" }, "en"),
  ];
  for (const label of labels) {
    assert.ok(label && !/\(A\d\)|\(A3\)|common_only|voting_rights|preferred_only|preferred_combined|issued_total|major_holder_report|year_end|stockCode|corpCode/.test(label),
      `internal code leaked: ${label}`);
  }
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

test("cover figures reach tooltips, history rows, and the detail sheet", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const page = fs.readFileSync(path.join(root, "src/features/foliotrace/ui/FolioTracePage.tsx"), "utf8");
  // 툴팁(보유·이벤트)과 상세·이력 표시가 모두 같은 헬퍼를 쓴다. 빼면 표제 표시가 사라진다.
  assert.match(page, /const title = titleFiguresLine\(h, lang\);/);
  assert.match(page, /const title = titleFiguresLine\(event, lang\);/);
  assert.match(page, /\{titleFiguresLine\(e, lang\) && <small className="foliotrace-row-reason">/);
  assert.match(page, /\{titleFiguresLine\(selected, lang\) && \(/);
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

test("a combined-basis A1 never compares with the 보통주 group", () => {
  // 호텔신라 A1(의결권 총수 40,000,000 = DART 합계): 파이프라인이 issued_total을 싣고,
  // 사이트는 보통주 그룹(common_only)과 묶지 않는다.
  const a1Combined = event({
    receiptNo: "20260701000279", receiptDate: "2026-07-01", basisDate: "2026-04-24",
    quantity: "3213595", companyOwnershipPercent: "8.03",
    ratioBasisKind: "issued_total", reportedCompanyOwnershipPercent: "8.03",
    ratioDenominatorReport: "A1", stockCode: "008770", corpCode: "00165680",
  });
  const a2Common = event({
    receiptNo: "20261002000457", receiptDate: "2026-10-02", basisDate: "2026-09-09",
    quantity: "2841803", companyOwnershipPercent: "7.24",
    ratioBasisKind: "common_only", ratioDenominatorReport: "11012",
    stockCode: "008770", corpCode: "00165680",
  });
  const changes = filingChangesForEvents([a1Combined, a2Common]);
  assert.equal(changes.get(a2Common)?.quantityDelta, "-371792");
  assert.equal(changes.get(a2Common)?.ownershipDelta, null);
  assert.equal(filingBasisChangesForEvents([a1Combined, a2Common]).get(a2Common), true);
});

test("the combined-preferred aggregate follows its company's market, still unpriced", async () => {
  const { groupHoldingsByMarket, marketAllocation, marketOf } = await import("../../src/features/foliotrace/ui/markets.ts");
  const common = holding({ stockCode: "001040", corpCode: "00148540", receiptNo: "20261006000147" });
  const combined = holding({
    stockCode: "00148540", corpCode: "00148540", name: "CJ 우선주 합계", securityKind: "unknown",
    quantity: "90712", companyOwnershipPercent: "1.398423089582047",
    receiptNo: "20261006000147", receiptDate: "2026-10-06", holdingDate: "2026-09-30",
    preferredCombined: true, ratioBasisKind: "preferred_combined",
    quote: null, estimatedValue: null, portfolioWeightPercent: null,
    valuationExclusionReason: "security_mapping_unverified",
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261006000147",
  });
  assert.equal(marketOf("00148540"), "UNKNOWN"); // 회사코드는 참조표에 없다
  const groups = groupHoldingsByMarket([common, combined]);
  assert.deepEqual(groups.KOSPI, [common, combined]); // 보통주와 같은 KOSPI 패널
  assert.deepEqual(groups.UNKNOWN, []);
  const allocation = marketAllocation([common, combined]);
  assert.equal(allocation.markets.KOSPI.count, 2);
  assert.equal(allocation.markets.KOSPI.pricedCount, 0); // 주가·평가는 계속 없음
  assert.equal(allocation.markets.KOSPI.amount, "0");
});

test("the 5% tracking rule skips only rows with a recomputed preferred basis", async () => {
  const { filterHoldings, isBelowFivePercent } = await import("../../src/features/foliotrace/ui/holdings.ts");
  // 코오롱인더우 0.75%(preferred_only): 종류별 비율이지 추적 이탈이 아니다.
  const preferred = holding({ stockCode: "120115", securityKind: "preferred", quantity: "20773", companyOwnershipPercent: "0.750508", ratioBasisKind: "preferred_only" });
  assert.equal(isBelowFivePercent(preferred), false);
  const combined = holding({
    stockCode: "00148540", securityKind: "unknown", quantity: "90712", companyOwnershipPercent: "1.398423",
    preferredCombined: true, ratioBasisKind: "preferred_combined",
  });
  assert.equal(isBelowFivePercent(combined), false);
  // 연말 목록 우선주 줄(새 비율 없음)은 종전대로: 5% 미만이면 라벨·필터 대상.
  // 실제 공개 스냅샷 행: 한화3우B 1.924496%, 코오롱우 0.456207%.
  const ye1 = holding({ stockCode: "00088K", name: "한화3우B", securityKind: "preferred", quantity: "285347", companyOwnershipPercent: "1.924496", ratioBasisKind: "year_end", receiptNo: null, receiptDate: "2025-12-31", holdingDate: "2025-12-31", evidence: "legacy-import" });
  const ye2 = holding({ stockCode: "002025", name: "코오롱우", securityKind: "preferred", quantity: "5294", companyOwnershipPercent: "0.456207", ratioBasisKind: undefined, receiptNo: null, receiptDate: "2025-12-31", holdingDate: "2025-12-31", evidence: "legacy-import" });
  assert.equal(isBelowFivePercent(ye1), true);
  assert.equal(isBelowFivePercent(ye2), true);
  // 보통주 행은 그대로: 5% 미만이면 라벨·필터 대상.
  assert.equal(isBelowFivePercent(holding({ stockCode: "120110", companyOwnershipPercent: "4.99" })), true);
  assert.equal(isBelowFivePercent(holding({ stockCode: "120110", companyOwnershipPercent: "12.946446" })), false);
  assert.deepEqual(filterHoldings([preferred, combined, ye1, ye2, holding({ stockCode: "120110", companyOwnershipPercent: "4.99" })], "", "below-5").map((h) => h.stockCode), ["00088K", "002025", "120110"]);
});

test("user-facing basis labels never expose internal codes", () => {
  const kinds = ["common_only", "voting_rights", "preferred_only", "preferred_combined", "issued_total", "major_holder_report", "unverified", "year_end"] as const;
  for (const kind of kinds) {
    for (const lang of ["ko", "en"] as const) {
      const label = ratioBasisLabel(kind, lang);
      assert.ok(label && !/\(A\d\)|_only|_rights|_combined|_total|_report|verified_scoped/.test(label), `${kind}/${lang}: ${label}`);
    }
  }
  for (const lang of ["ko", "en"] as const) {
    for (const report of ["11013", "11012", "11014", "11011", "A1", "A2"]) {
      const label = denominatorReportLabel(report, lang);
      assert.ok(label && !/\(A\d\)/.test(label), `${report}/${lang}: ${label}`);
    }
  }
});

test("cover figures render with the mandated label and never affect deltas", async () => {
  const { filingChangesForEvents, titleFiguresText } = await import("../../src/features/foliotrace/ui/holdings.ts");
  // RF머트리얼즈 A1 20260701000577 실제 수치: 표제 313,381주·3.68%, 주권 281,582주·3.31%.
  assert.equal(
    titleFiguresText({ titleQuantity: "313381", titleCompanyOwnershipPercent: "3.68" }, "ko"),
    "공시 표제(신주인수권 등 포함) 313,381주·3.68%",
  );
  assert.equal(
    titleFiguresText({ titleQuantity: "313381", titleCompanyOwnershipPercent: "3.68" }, "en"),
    "Filing cover (incl. subscription warrants etc.) 313,381 shares·3.68%",
  );
  assert.equal(titleFiguresText({}, "ko"), null);
  assert.equal(titleFiguresText({ titleQuantity: "313381" }, "ko"), null);
  assert.equal(titleFiguresText({ titleQuantity: "garbage", titleCompanyOwnershipPercent: "3.68" }, "ko"), null);
  // 표제 유무와 무관하게 증감은 주권 수치로만 계산된다(직전 631,125주 → 이번 281,582주).
  const prev = (title?: object) => event({
    receiptNo: "20260401002535", receiptDate: "2026-04-01", basisDate: "2026-02-13",
    stockCode: "327260", corpCode: "01343665", kind: "decrease",
    quantity: "631125", companyOwnershipPercent: "7.48", ratioBasisKind: "voting_rights",
    ...title,
  });
  const cur = (title?: object) => event({
    receiptNo: "20260701000577", receiptDate: "2026-07-01", basisDate: "2026-06-10",
    stockCode: "327260", corpCode: "01343665", kind: "tracking-exit",
    quantity: "281582", companyOwnershipPercent: "3.31", ratioBasisKind: "voting_rights",
    ...title,
  });
  const p0 = prev(), c1 = cur({ titleQuantity: "313381", titleCompanyOwnershipPercent: "3.68" });
  const titled = filingChangesForEvents([p0, c1]).get(c1);
  assert.equal(titled?.quantityDelta, "-349543");
  assert.equal(titled?.ownershipDelta, "-4.17");
  const p1 = prev(), c2 = cur();
  const plain = filingChangesForEvents([p1, c2]).get(c2);
  assert.equal(plain?.quantityDelta, "-349543");
  assert.equal(plain?.ownershipDelta, "-4.17");
});

test("the public-data validator accepts cover figures on holdings and events", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { validatePublicData, DATA_SUBPATH } = await import("../../scripts/foliotrace-public-data.mjs");

  const version = "b".repeat(64);
  const holding = {
    corpCode: "01343665", stockCode: "327260", name: "RF머트리얼즈", securityKind: "common",
    quantity: "281582", companyOwnershipPercent: "3.31",
    ratioBasisKind: "issued_total",
    ratioDenominatorValue: "8495135", ratioDenominatorDate: "2026-06-10",
    ratioDenominatorReport: "A1", ratioDenominatorReceipt: "20260701000577",
    titleQuantity: "313381", titleCompanyOwnershipPercent: "3.68",
    receiptNo: "20260701000577", receiptDate: "2026-07-01", holdingDate: "2026-06-10",
    evidence: "dart-structured", sourceKind: "nps-filing",
    latestUnresolvedReceiptNo: null, latestUnresolvedReason: null,
    tracking: "active", quote: { close: "10000", currency: "KRW", market: "KRX", session: "regular", tradeDate: "2026-11-13", adjusted: false, provider: "naver", observedAt: "2026-11-13T16:30:00+09:00", verified: true },
    estimatedValue: "2815820000", portfolioWeightPercent: "100.00", valuationExclusionReason: null,
    filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260701000577",
  };
  const snapEvent = {
    receiptNo: "20260701000577", receiptDate: "2026-07-01", basisDate: "2026-06-10",
    corpCode: "01343665", stockCode: "327260", kind: "tracking-exit",
    correctionOf: null, isCorrectionOrWithdrawal: false,
    quantity: "281582", companyOwnershipPercent: "3.31",
    ratioBasisKind: "issued_total",
    titleQuantity: "313381", titleCompanyOwnershipPercent: "3.68",
    source: "dart-structured", filingUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260701000577",
  };
  const snap = {
    schemaVersion: 1, datasetVersion: version,
    portfolio: { id: "p", entityId: "e", market: "KRX", currency: "KRW", scopeKo: "s", scopeEn: "s", methodologyVersion: "2", legacyCoverage: "verified" },
    entity: { id: "e", kind: "institution", nameKo: "n", nameEn: "n", officialId: null, source: "OpenDART" },
    valuationTradeDate: "2026-11-13", filingsCheckedAt: null, generatedAt: "2026-11-15T00:00:00Z",
    publishedAt: null, latestReceiptDate: "2026-07-01", trackedCount: 1,
    pricedCount: 1, unresolvedCount: 0, estimatedValue: "2815820000",
    valuationCoverage: "partial", filingCoverage: "complete",
    holdings: [holding], events: [snapEvent], history: [],
  };
  const dir = mkdtempSync(join(tmpdir(), "ft-title-"));
  const bytes = Buffer.from(JSON.stringify(snap));
  mkdirSync(join(dir, DATA_SUBPATH, "snapshots"), { recursive: true });
  writeFileSync(join(dir, DATA_SUBPATH, "snapshots", `${version}.json`), bytes);
  writeFileSync(join(dir, DATA_SUBPATH, "manifest.json"), JSON.stringify({
    schemaVersion: 1, datasetVersion: version,
    snapshotPath: `snapshots/${version}.json`, snapshotSha256: createHash("sha256").update(bytes).digest("hex"),
  }));
  await validatePublicData(dir);
  // 검증 줄을 빼면 비십진 표제 수치가 통과해 버리므로, 무효값은 거절되어야 한다.
  const bad = JSON.parse(JSON.stringify(snap));
  bad.holdings[0].titleQuantity = "not-a-number";
  bad.datasetVersion = "c".repeat(64);
  const dir2 = mkdtempSync(join(tmpdir(), "ft-title-bad-"));
  const bytes2 = Buffer.from(JSON.stringify(bad));
  mkdirSync(join(dir2, DATA_SUBPATH, "snapshots"), { recursive: true });
  writeFileSync(join(dir2, DATA_SUBPATH, "snapshots", `${bad.datasetVersion}.json`), bytes2);
  writeFileSync(join(dir2, DATA_SUBPATH, "manifest.json"), JSON.stringify({
    schemaVersion: 1, datasetVersion: bad.datasetVersion,
    snapshotPath: `snapshots/${bad.datasetVersion}.json`, snapshotSha256: createHash("sha256").update(bytes2).digest("hex"),
  }));
  await assert.rejects(validatePublicData(dir2));
});
