import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PageHeader, SectionCard } from "../../../components/ui";
import { UtilityPage } from "../../../components/UtilitySurface";
import { Card } from "../../../components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../../components/ui/sheet";
import type {
  FilingEvent,
  FolioTraceView,
  Holding,
} from "../contracts";
import type { FolioTracePageProps } from "../contracts";

export type { FolioTracePageProps } from "../contracts";

import "./foliotrace.css";
import { dartFilingUrl } from "../data/dartLink";
import {
  approxNumber,
  eventRangeOf,
  exclusionReasonLabel,
  filingChangesForHoldings,
  filterHoldings,
  formatKstTimestamp,
  formatKrw,
  formatPct,
  formatQty,
  hasReceiptNo,
  holdingStatus,
  isBelowFivePercent,
  latestUnresolvedReasonLabel,
  quotePriceDetail,
  sortHoldings,
  topHoldings,
} from "./holdings";
import type { FilingChangeDirection, Lang, QualityFilter, SortKey } from "./holdings";
import { XIcon } from "lucide-react";
import { getFaqsForPath } from "./faq";
import delistedReference from "../data/delistedReference.json";

const delistedItems = [...delistedReference.items].sort((a, b) =>
  (a.delistedDate === null ? 1 : 0) - (b.delistedDate === null ? 1 : 0) ||
  (a.delistedDate ?? "").localeCompare(b.delistedDate ?? "") || a.nameKo.localeCompare(b.nameKo, "ko"));

const STR = {
  ko: {
    eyebrow: "FolioTrace · 공개 공시 기반 추정",
    title: "FolioTrace",
    description:
      "연말 보유 목록과 DART 공시로 추적하는 국민연금 국내주식 공개 포트폴리오 추정치입니다. 국민연금 전체 자산·실제 계좌 잔고·실제 운용 수익률이 아닙니다.",
    scopeNote:
      "국민연금의 연말 국내주식 보유 목록과 이후 공시를 바탕으로 한 추정 내역입니다. 지분율 5% 미만 종목도 포함하며, 마지막으로 확인된 수량에 종가를 곱해 합계에 넣습니다.",
    historicalCoverageTitle: "과거 공시 확인 범위",
    historicalCoverageRange: "확인한 접수일",
    historicalCoverageTarget: "확인할 공시의 마지막 접수일",
    historicalCoverageComplete: "공시 목록 {from}–{to} 확인 완료",
    historicalCoveragePending: "공시 목록 {from}–{to} 확인 중",
    historicalCoverageDetails: "공시 확인 범위 자세히 보기",
    historicalCoverageScope: "국민연금 기관이 제출한 공시를 찾은 기간입니다. 각 공시의 수량·지분율 확인은 별도로 진행합니다.",
    historicalFirstObserved: "국민연금 기관이 제출한 첫 대량보유 공시 접수",
    historicalFirstFound: "확인된 첫 국민연금 제출 공시",
    historicalFirstTentative: "(조회 진행 중 잠정값)",
    historicalParsePending: "새 공시 내용 확인 중",
    historicalLegacyRecheck: "이전 기록 중 공시 확인이 필요한 건수",
    indirectSource: "DART 원문 보기",
    priceBasis: "한국거래소 정규장 마감 가격 기준",
    checkedAt: "공시 확인",
    generatedAt: "자료 작성",
    publishedAt: "자료 게시",
    staleBadge: "자료를 확인한 지 3일 이상 지났습니다 — 공시와 종가를 다시 확인하세요",
    freshBadge: "현재 공개된 자료",
    legacyVerified: "이전 기록: 확인됨",
    legacyPartial: "이전 기록: 일부만 확인됨 — 과거 수치는 참고용입니다",
    legacyUnverified: "이전 기록: 아직 확인되지 않음 — 과거 수치는 참고용입니다",
    filingComplete: "공시 목록 확인 완료",
    filingPartial: "일부 공시·정정 확인 중",
    filingUnverified: "공시 목록 확인 중",
    methodLink: "계산 방법·출처는 하단 안내를 확인하세요",
    summaryValue: "공개 보유분 추정 평가금액",
    summaryTracked: "추적 종목 수",
    summaryPriced: "평가 가능 종목",
    summaryEvents: "추적 기간 전체 공시",
    unavailable: "평가 불가",
    unavailableReasonComplete: "유효한 종가가 없어 평가할 수 없습니다.",
    unavailableReasonPartial: "수량·종목과 주식 종류·종가를 확인하지 못한 종목을 제외한 금액입니다.",
    noHoldings: "추적 중인 종목이 없습니다.",
    noHoldingsDesc: "현재 표시할 종목이 없습니다. 잠시 후 다시 조회해 보세요.",
    topWeights: "상위 보유 종목 비중",
    topWeightsDesc: "평가할 수 있는 종목의 전체 금액을 기준으로 계산한 비중입니다. 검색·필터를 바꿔도 이 기준은 같습니다.",
    historyTitle: "추정 평가금액 추이",
    historyDesc: "같은 계산 기준의 실제 기록이 두 번 이상 쌓이면 표시합니다.",
    historySingle: "같은 방식으로 계산한 기록이 더 쌓이면 추이를 보여 드립니다.",
    tableTitle: "종목 표",
    tableDesc: "수량·지분율·종가·추정 금액·비중·접수일을 구분해 표시합니다.",
    tableUnavailable: "—는 확인된 평가 금액이 없다는 뜻입니다. 종목명 아래에서 제외 사유를 확인하세요.",
    tableChangeNote: "같은 종목의 직전 공시 숫자보다 크면 빨강, 작으면 파랑으로 표시합니다. 첫 확인·비교 불가 값은 기본색이며, 색이 실제 매매를 뜻하지는 않습니다.",
    changeUp: "직전 공시 수치보다 증가",
    changeDown: "직전 공시 수치보다 감소",
    searchLabel: "종목명·종목코드 검색",
    searchPlaceholder: "예: 삼성전자 또는 005930",
    qualityLabel: "평가 여부",
    qualityAll: "전체",
    qualityPriced: "평가 포함",
    qualityUnpriced: "평가 제외",
    qualityBelow5: "5% 미만",
    sortLabel: "정렬",
    sortValue: "추정 금액순",
    sortWeight: "비중순",
    sortOwnership: "회사 지분율순",
    sortReceipt: "최근 접수일순",
    resetFilters: "필터 초기화",
    resultCount: "검색 결과",
    unitCount: "건",
    colName: "종목",
    colQuantity: "공시 수량",
    colOwnership: "회사 지분율",
    colClose: "정규장 종가·기준일",
    colValue: "추정 금액",
    colWeight: "평가 금액 비중",
    colReceipt: "최근 접수일",
    colStatus: "평가 상태",
    colDetail: "상세",
    detailButton: "상세 보기",
    closeDetail: "상세 보기 닫기",
    detailHoldingDate: "보유 기준일",
    rowBasis: "보유 기준일",
    rowIndirectSource: "제3자 공시 원문 확인",
    rowDirectSource: "직접 공시 기록",
    directBaseline: "기존 직접 공시",
    issuerScopeSource: "다른 회사 공시에서 확인한 지분율 · 주식 종류 확인 중",
    issuerScopeDetail: "발행주식 기준으로 확인한 수량",
    issuerScopeComparison: "이전 직접 공시와 지분율 계산 기준이 같다고 확인되지 않아 증감은 표시하지 않습니다.",
    issuerScopeLaterChange: "이후 국민연금 보유주식 감소가 기록됐지만 새 수량·지분율은 확인되지 않았습니다",
    documentNumber: "문서 번호",
    verifiedObservationTitle: "다른 회사 공시에서 확인한 지분",
    verifiedObservationApplied: "현재 지분율에 반영",
    rowVerifiedValue: "기준일과 지분율 확인",
    rowScopedValue: "국민연금 본인·발행주식수 기준 · 직접 공시와 증감 비교 보류",
    verifiedObservationPending: "현재 지분율과 비교할 정보가 부족합니다",
    directBasisPending: "직접 공시의 보유 기준일을 확인 중입니다",
    verifiedObservationConflict: "같은 날짜의 공시 수치가 달라 현재값에 넣지 않았습니다",
    detailReceipt: "접수일·접수번호",
    detailReport: "보고 기준",
    detailPrice: "가격 기준",
    detailInclusion: "평가 포함·제외 사유",
    detailSource: "공시 원문",
    detailHistory: "해당 종목 공시 이력",
    openFiling: "DART 원문 열기",
    noFilingUrl: "원문 링크 없음",
    noReceiptNo: "접수번호 없음",
    detailOrigin: "자료 출처",
    ratioMarker: "비율 보정",
    adjustedQuantity: "보정 수량",
    ratioMarkerTitle: "공시에서 확인한 기업행위 비율로 보정한 수량(추정)입니다",
    detailReportedQuantity: "보고 수량",
    detailRatio: "적용 비율",
    ratioTipKo: "비율 보정: 공시 수량 {r} × {n} ÷ {d}",
    detailRatioNote: "보고 수량 × {n} ÷ {d} (소수점 이하 버림)",
    detailRatioEvents: "근거 공시",
    ratioEventPrice: "가격 변경일",
    ratioEventQuantity: "수량 변경일",
    ratioEventPending: "미정",
    ratioKind_bonus_issue: "무상증자",
    ratioKind_stock_split: "액면분할",
    ratioKind_reverse_split: "주식병합",
    ratioKind_capital_reduction: "감자",
    ratioKind_spin_off: "분할",
    ratioKind_stock_dividend: "주식배당",
    ratioGuide: "일부 수량은 무상증자·분할·병합·감자 등 공시된 기업행위 비율로 보정한 추정값이며, 표에 '비율 보정'으로 표시합니다. 보고된 수량과 다를 수 있습니다.",
    rowYearEnd: "연말 기준 보유 목록",
    sourceYearEnd: "연말 기준 보유 목록",
    sourceNps: "국민연금 대량보유 공시",
    sourceIssuer: "발행회사 보고서",
    sourceTextRead: "공시 원문 판독",
    unknownDate: "기준일 모름",
    eventsTitle: "최근 공시 변화",
    eventsDesc: "전체 {total}건 중 최근 {shown}건입니다. 보유 기준일순으로 정렬하며, 기준일이 없을 때만 접수일을 정렬에 사용합니다. 수량·지분율은 공시에 적힌 값입니다.",
    eventPointChange: "이전 기록과 차이: {amount}퍼센트포인트",
    eventsEmpty: "해당 기간의 공시 변화가 없습니다.",
    eventQuantity: "공시 수량",
    eventOwnership: "공시 지분율",
    eventUnknown: "미확인",
    eventStockCode: "종목코드",
    eventCorpCode: "회사코드",
    eventDartSource: "DART 확인값",
    eventIndirectSource: "제3자 공시 원문 확인값",
    eventIndirectReentry: "제3자 공시로 5% 이상 보유 재확인",
    eventBasis: "보유 기준일",
    eventReceipt: "접수일",
    eventLegacySource: "과거 기록 · 공시 원문과 수치 대조 중",
    lastChange: "마지막 변화",
    guideTitle: "계산 방법·출처·알아둘 점",
    guideFaqTitle: "자주 묻는 질문",
    faqTitle: "자주 묻는 질문",
    faqDesc: "추정 범위·계산·출처에 대한 자주 묻는 질문입니다.",
    delistedTitle: "참고: 2025년 말 보유 후 상장폐지(결정)된 종목 ({count}종목)",
    delistedNote: "2025년 말 국민연금 공시 목록 기준 보유 주식 수입니다. 이후 상장폐지되었거나 상장폐지가 결정된 종목입니다.",
    delistedShares: "25년 말 보유",
    delistedUnit: "주",
    delistedDate: "이후 상장폐지",
    delistedEstimated: "(추정)",
    delistedPending: "상장폐지 결정(확정 전)",
    delistedSource: "DART 공시 보기",
    prevVerifiedReceipt: "이전에 확인한 접수",
    latestUnresolvedReceipt: "아직 확인하지 못한 최신 접수",
    retry: "게시된 자료 다시 불러오기",
    statusIncluded: "평가 포함",
    statusExcluded: "평가 제외",
    statusActiveRecord: "공시 지분율 5% 이상",
    statusActiveBelow5: "지분율 5% 미만 · 마지막 확인 수량 기준",
    statusUnknownTracking: "추적 상태 확인 중",
    statusExit: "5% 추적 범위 이탈",
    statusUnresolved: "최신 미확인",
    searchNoResults: "검색 결과가 없습니다.",
    searchNoResultsDesc: "검색어나 필터를 바꾸거나 초기화하세요.",
    loading: "게시된 FolioTrace 데이터를 불러오는 중입니다.",
    missingTitle: "공개 데이터를 아직 게시하지 않았습니다",
    missingDesc:
      "아직 표시할 수 있는 실제 공시 자료가 준비되지 않았습니다.",
    loadErrorTitle: "게시된 데이터를 불러오지 못했습니다",
    loadErrorDesc: "페이지 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    schemaErrorTitle: "자료를 표시할 수 없습니다",
    schemaErrorDesc: "게시된 자료를 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.",
    formula: "공시에서 확인한 수량에 해당 거래일의 KRX 정규장 종가를 곱해 평가금액을 추정합니다. 비중은 같은 날 평가할 수 있는 종목의 금액 합계에서 차지하는 몫입니다.",
  },
  en: {
    eyebrow: "FolioTrace · Public filing estimate",
    title: "FolioTrace",
    description:
      "An estimated public portfolio of NPS domestic equities tracked from the year-end holdings list and later DART filings. Not total NPS assets, real account balances, or actual returns.",
    scopeNote:
      "This estimate follows the NPS year-end domestic equity holdings list and later filings. Holdings below 5% are included; the total multiplies the last confirmed quantity by the closing price.",
    historicalCoverageTitle: "Historical filings checked",
    historicalCoverageRange: "Receipt dates checked",
    historicalCoverageTarget: "Last filing receipt date to check",
    historicalCoverageComplete: "Filing list checked {from}–{to}",
    historicalCoveragePending: "Filing list check in progress {from}–{to}",
    historicalCoverageDetails: "See filing coverage details",
    historicalCoverageScope: "These dates cover filings submitted by NPS. Reported quantities and percentages are checked separately.",
    historicalFirstObserved: "Earliest large-shareholding filing submitted by NPS",
    historicalFirstFound: "Earliest NPS-submitted filing found",
    historicalFirstTentative: "(provisional while searching)",
    historicalParsePending: "New filings under review",
    historicalLegacyRecheck: "Earlier records awaiting source checks",
    indirectSource: "Open DART filing",
    priceBasis: "Closing price from the Korea Exchange regular session",
    checkedAt: "Filings checked",
    generatedAt: "Data prepared",
    publishedAt: "Data published",
    staleBadge: "These records were checked more than 3 days ago — please check filings and closing prices again",
    freshBadge: "Currently published records",
    legacyVerified: "Earlier records: verified",
    legacyPartial: "Earlier records: partly verified — use older figures as a guide",
    legacyUnverified: "Earlier records: unverified — use older figures as a guide",
    filingComplete: "Filings checked: complete",
    filingPartial: "Filings checked: some receipts and corrections remain under review",
    filingUnverified: "Filings checked: in progress",
    methodLink: "See the notes below for method and sources",
    summaryValue: "Estimated disclosed value",
    summaryTracked: "Tracked securities",
    summaryPriced: "Priced securities",
    summaryEvents: "Filings across tracked period",
    unavailable: "Valuation unavailable",
    unavailableReasonComplete: "No valid closing prices, so nothing could be valued.",
    unavailableReasonPartial: "This total excludes securities whose quantity, share class, listed identity, or closing price could not be confirmed.",
    noHoldings: "No tracked securities.",
    noHoldingsDesc: "There are no holdings to show right now. Please try again later.",
    topWeights: "Top holdings by weight",
    topWeightsDesc: "Shares of the total value we can estimate. Search and filters do not change the total.",
    historyTitle: "Estimated value history",
    historyDesc: "Shown after at least two real records use the same calculation method.",
    historySingle: "A trend will appear when more values calculated the same way are available.",
    tableTitle: "Holdings table",
    tableDesc: "Quantity, company ownership, close, estimated value, weight, and receipt date are shown separately.",
    tableUnavailable: "— means no verified valuation is available. See the exclusion reason under the security name.",
    tableChangeNote: "Reported numbers appear red when above the previous filing for the same security and blue when below it. First reports and incomparable values keep the usual color; colors do not establish a trade.",
    changeUp: "Higher than the previous filing",
    changeDown: "Lower than the previous filing",
    searchLabel: "Search name / stock code",
    searchPlaceholder: "e.g. Samsung or 005930",
    qualityLabel: "Valuation status",
    qualityAll: "All",
    qualityPriced: "Included in valuation",
    qualityUnpriced: "Excluded from valuation",
    qualityBelow5: "Below 5%",
    sortLabel: "Sort",
    sortValue: "By estimated value",
    sortWeight: "By weight",
    sortOwnership: "By company ownership",
    sortReceipt: "By latest receipt date",
    resetFilters: "Reset filters",
    resultCount: "Results",
    unitCount: "items",
    colName: "Security",
    colQuantity: "Filed quantity",
    colOwnership: "Company ownership",
    colClose: "Regular close · date",
    colValue: "Estimated value",
    colWeight: "Share of valued total",
    colReceipt: "Latest receipt",
    colStatus: "Valuation status",
    colDetail: "Detail",
    detailButton: "View detail",
    closeDetail: "Close details",
    detailHoldingDate: "Holding date",
    rowBasis: "Holding basis date",
    rowIndirectSource: "Third-party filing checked",
    rowDirectSource: "Direct filing record",
    directBaseline: "Earlier direct filing",
    issuerScopeSource: "Ownership confirmed in another company's filing · share class under review",
    issuerScopeDetail: "Shares confirmed against all issued shares",
    issuerScopeComparison: "The earlier direct filing has no confirmed matching percentage basis, so no change is shown.",
    issuerScopeLaterChange: "A later filing reports fewer NPS shares, but gives no new NPS quantity or percentage",
    documentNumber: "Document number",
    verifiedObservationTitle: "Ownership found in another company's filing",
    verifiedObservationApplied: "Applied to current ownership",
    rowVerifiedValue: "Holding date and percentage checked",
    rowScopedValue: "NPS-held shares / all issued shares · change from direct filing unverified",
    verifiedObservationPending: "Not enough information to compare with the current percentage",
    directBasisPending: "Checking the holding date in the direct filing",
    verifiedObservationConflict: "Filings for the same date disagree, so this was not used for the current value",
    detailReceipt: "Receipt date · no.",
    detailReport: "Report basis",
    detailPrice: "Price basis",
    detailInclusion: "Inclusion / exclusion reason",
    detailSource: "Original filing",
    detailHistory: "Filing history for this security",
    openFiling: "Open DART source",
    noFilingUrl: "No source link",
    noReceiptNo: "No receipt number",
    detailOrigin: "Data source",
    ratioMarker: "Ratio-adjusted",
    adjustedQuantity: "Adjusted quantity",
    ratioMarkerTitle: "Quantity adjusted by corporate-action ratios from filings (estimate)",
    detailReportedQuantity: "Reported quantity",
    detailRatio: "Ratio applied",
    ratioTipKo: "Ratio-adjusted: reported quantity {r} × {n} ÷ {d}",
    detailRatioNote: "reported quantity × {n} ÷ {d}, rounded down",
    detailRatioEvents: "Source filings",
    ratioEventPrice: "Price change date",
    ratioEventQuantity: "Quantity change date",
    ratioEventPending: "not set",
    ratioKind_bonus_issue: "Bonus issue",
    ratioKind_stock_split: "Stock split",
    ratioKind_reverse_split: "Reverse split",
    ratioKind_capital_reduction: "Capital reduction",
    ratioKind_spin_off: "Spin-off",
    ratioKind_stock_dividend: "Stock dividend",
    ratioGuide: "Some quantities are estimates adjusted by corporate-action ratios from filings (bonus issues, splits, reverse splits, capital reductions) and are marked 'Ratio-adjusted' in the table. They may differ from the reported quantity.",
    rowYearEnd: "Year-end holdings list",
    sourceYearEnd: "Year-end holdings list",
    sourceNps: "NPS large-holding filing",
    sourceIssuer: "Issuer report",
    sourceTextRead: "Disclosure text reading",
    unknownDate: "Unknown (no holding date)",
    eventsTitle: "Recent filing changes",
    eventsDesc: "Showing the latest {shown} of {total} records. We sort by the holding date, using the filing date only for sorting when the holding date is unknown. Quantities and percentages are as reported.",
    eventPointChange: "Change from the prior record: {amount} percentage points",
    eventsEmpty: "No filing changes in this period.",
    eventQuantity: "Filed quantity",
    eventOwnership: "Filed ownership",
    eventUnknown: "Unverified",
    eventStockCode: "Stock code",
    eventCorpCode: "Company code",
    eventDartSource: "DART-verified values",
    eventIndirectSource: "Source-checked third-party filing",
    eventIndirectReentry: "At least 5% holding reconfirmed in another filer's source",
    eventBasis: "Holding basis date",
    eventReceipt: "Receipt date",
    eventLegacySource: "Older record · reported values still being checked",
    lastChange: "Last change",
    guideTitle: "Calculation, sources, and things to know",
    guideFaqTitle: "FAQ",
    faqTitle: "FAQ",
    faqDesc: "Frequently asked questions about scope, estimation, and sources.",
    delistedTitle: "Reference: stocks held at end-2025 and later delisted or set for delisting ({count})",
    delistedNote: "Shares held at the end of 2025 per the NPS disclosure list. These stocks were later delisted or are set to be delisted.",
    delistedShares: "Held at end-2025",
    delistedUnit: " shares",
    delistedDate: "Later delisted",
    delistedEstimated: "(est.)",
    delistedPending: "Delisting decided (pending)",
    delistedSource: "Open DART filing",
    prevVerifiedReceipt: "Previously checked receipt",
    latestUnresolvedReceipt: "Latest unchecked receipt",
    retry: "Reload published data",
    statusIncluded: "Included",
    statusExcluded: "Excluded",
    statusActiveRecord: "Filed ownership at or above 5%",
    statusActiveBelow5: "Below 5% · last confirmed quantity",
    statusUnknownTracking: "Tracking status under review",
    statusExit: "Exited 5% scope",
    statusUnresolved: "Latest unverified",
    searchNoResults: "No matching securities.",
    searchNoResultsDesc: "Change the search or filters, or reset them.",
    loading: "Loading the published FolioTrace data…",
    missingTitle: "Public data is not published yet",
    missingDesc:
      "Real filing data is not ready to show yet.",
    loadErrorTitle: "Could not load the published data",
    loadErrorDesc: "The page data could not be loaded. Please try again shortly.",
    schemaErrorTitle: "Could not display the records",
    schemaErrorDesc: "The published data could not be read. Please try again shortly.",
    formula: "We estimate value by multiplying the filed quantity by the KRX regular-session close for that date. Weight is its share of the total value we can price on the same day.",
  },
} satisfies Record<Lang, Record<string, string>>;

const EVENT_KIND: Record<Lang, Record<FilingEvent["kind"], string>> = {
  ko: {
    increase: "이전 기록 대비 증가",
    decrease: "이전 기록 대비 감소",
    "new-report": "첫 기록 공시",
    "purpose-change": "목적 변경",
    "tracking-exit": "5% 추적 범위 이탈",
    "tracking-reentry": "5% 추적 범위 재진입",
    "unquantified-change": "지분 변동 확인 · 수치는 미기재",
    other: "기타 공시",
  },
  en: {
    increase: "Increase vs prior recorded filing",
    decrease: "Decrease vs prior recorded filing",
    "new-report": "First recorded filing",
    "purpose-change": "Purpose change",
    "tracking-exit": "Exited 5% tracking scope",
    "tracking-reentry": "Re-entered 5% tracking scope",
    "unquantified-change": "Ownership change noted · amount unstated",
    other: "Other filing",
  },
};

function observedPercent(value: string | null, kind?: Holding["ownershipNumericKind"]): string {
  if (value === null) return "—";
  const rendered = formatPct(value);
  if (kind === "lower_bound") return `≥${rendered}`;
  if (kind === "upper_bound") return `≤${rendered}`;
  if (kind === "estimated") return `≈${rendered}`;
  return rendered;
}

/**
 * Renders an exact formatted financial string with break opportunities
 * after each thousands separator. The commas stay in the text (so
 * textContent, copy, and AT read the exact formatted string) and each
 * is followed by a <wbr/>, letting long amounts wrap at group boundaries
 * instead of stranding a lone digit on the next line.
 */
function breakableValue(text: string): ReactNode {
  const parts = text.split(",");
  if (parts.length === 1) return text;
  return parts.flatMap((part, index): ReactNode[] =>
    index === 0 ? [part] : [",", <wbr key={index} />, part],
  );
}

function FilingChangeValue({ value, direction, upLabel, downLabel }: {
  value: string;
  direction: FilingChangeDirection;
  upLabel: string;
  downLabel: string;
}) {
  if (direction === null) return value;
  const label = direction === "up" ? upLabel : downLabel;
  return (
    <span className={`foliotrace-change-${direction}`} title={label}>
      <span aria-hidden="true">{direction === "up" ? "↑ " : "↓ "}</span>
      {value}<span className="sr-only"> · {label}</span>
    </span>
  );
}

export function FolioTracePage({ lang, view, onRefresh }: FolioTracePageProps) {
  const t = STR[lang];
  if (view.status !== "ready") {
    const title =
      view.status === "missing-import"
        ? t.missingTitle
        : view.status === "load-error"
          ? t.loadErrorTitle
          : view.status === "schema-error"
            ? t.schemaErrorTitle
            : t.title;
    const desc =
      view.status === "missing-import"
        ? t.missingDesc
        : view.status === "load-error"
          ? t.loadErrorDesc
          : view.status === "schema-error"
            ? t.schemaErrorDesc
            : t.loading;
    return (
      <UtilityPage toolId="foliotrace" className="foliotrace-page">
        <PageHeader eyebrow={t.eyebrow} title={title} description={desc} />
        <SectionCard title={title} description={view.message ?? desc}>
          {view.status === "loading" ? (
            <p role="status" className="foliotrace-state-text">
              {t.loading}
            </p>
          ) : (
            <div className="foliotrace-state-actions">
              <p role={view.status === "missing-import" ? "status" : "alert"} className="foliotrace-state-text">
                {view.message ?? desc}
              </p>
              {view.status === "load-error" && (
                <button type="button" className="foliotrace-retry" onClick={onRefresh}>
                  {t.retry}
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </UtilityPage>
    );
  }

  return <ReadyView lang={lang} view={view} onRefresh={onRefresh} />;
}

function ReadyView({
  lang,
  view,
  onRefresh,
}: {
  lang: Lang;
  view: Extract<FolioTraceView, { status: "ready" }>;
  onRefresh: () => void;
}) {
  const t = STR[lang];
  const { snapshot, stale } = view;
  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState<QualityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const filtered = useMemo(
    () => sortHoldings(filterHoldings(snapshot.holdings, query, quality), sortKey),
    [snapshot.holdings, query, quality, sortKey],
  );
  const filingChanges = useMemo(
    () => filingChangesForHoldings(snapshot.holdings, snapshot.events),
    [snapshot.holdings, snapshot.events],
  );

  const topWeights = useMemo(() => topHoldings(snapshot.holdings), [snapshot.holdings]);

  // Bar widths only: approximate visual sizing, never financial text or ordering.
  const maxWeight = Math.max(0, ...topWeights.map((h) => approxNumber(h.portfolioWeightPercent)));

  const eventRange = useMemo(() => eventRangeOf(snapshot.events), [snapshot.events]);
  const recentEvents = useMemo(
    () => [...snapshot.events]
      .sort((a, b) => (b.basisDate ?? b.receiptDate).localeCompare(a.basisDate ?? a.receiptDate) ||
        b.receiptNo.localeCompare(a.receiptNo))
      .slice(0, 30),
    [snapshot.events],
  );
  const indirectReentries = useMemo(
    () => new Set(snapshot.events.filter((event) => event.source === "indirect-observation" &&
      event.kind === "tracking-reentry").map((event) => `${event.corpCode}:${event.receiptNo}`)),
    [snapshot.events],
  );
  const currentNameByCorpCode = useMemo(
    () => new Map(snapshot.holdings.map((holding) => [holding.corpCode, holding.name])),
    [snapshot.holdings],
  );
  const eventsDescription = t.eventsDesc
    .replace("{shown}", String(recentEvents.length))
    .replace("{total}", String(snapshot.events.length));

  const selected: Holding | null =
    selectedCode === null ? null : (snapshot.holdings.find((h) => h.stockCode === selectedCode) ?? null);
  const selectedEvents = useMemo(
    () => (selected ? snapshot.events.filter((e) => e.corpCode === selected.corpCode)
      .sort((a, b) => (b.basisDate ?? b.receiptDate).localeCompare(a.basisDate ?? a.receiptDate) ||
        b.receiptNo.localeCompare(a.receiptNo)) : []),
    [selected, snapshot.events],
  );
  const recentObservations = useMemo(
    () => [...(snapshot.verifiedIndirectObservations ?? [])]
      .sort((a, b) => b.basisDate.localeCompare(a.basisDate) || b.filingDate.localeCompare(a.filingDate)),
    [snapshot.verifiedIndirectObservations],
  );
  const selectedObservations = selected
    ? recentObservations.filter((observation) => observation.corpCode === selected.corpCode) : [];

  const entityName = lang === "ko" ? snapshot.entity.nameKo : snapshot.entity.nameEn;
  const scope = lang === "ko" ? snapshot.portfolio.scopeKo : snapshot.portfolio.scopeEn;
  const trackingStatusLabel = (holding: Holding) =>
    (indirectReentries.has(`${holding.corpCode}:${holding.receiptNo}`) ||
      (holding.observationStatus === "verified_scoped" && holding.tracking === "active")) ? t.eventIndirectReentry :
      holding.tracking === "active" ? (isBelowFivePercent(holding) ? t.statusActiveBelow5 : t.statusActiveRecord) :
        holding.tracking === "below-5-percent" ? t.statusExit : t.statusUnknownTracking;
  const statusLabel = (s: ReturnType<typeof holdingStatus>) =>
    s === "included" ? t.statusIncluded : s === "excluded" ? t.statusExcluded : s === "exit" ? t.statusExit : t.statusUnresolved;

  return (
    <UtilityPage toolId="foliotrace" className="foliotrace-page">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description}>
        <button type="button" className="foliotrace-retry" onClick={onRefresh}>
          {t.retry}
        </button>
      </PageHeader>

      <div className="foliotrace-status-strip" role="status" aria-live="polite">
        <span className="foliotrace-scope">
          {entityName} · {scope}
        </span>
        <span>
          {t.priceBasis}
          {snapshot.valuationTradeDate ? ` · ${snapshot.valuationTradeDate}` : ""}
        </span>
        <span>
          {t.checkedAt}: {formatKstTimestamp(snapshot.filingsCheckedAt, lang) ?? "—"} · {t.generatedAt}: {formatKstTimestamp(snapshot.generatedAt, lang)}
          {snapshot.publishedAt && ` · ${t.publishedAt}: ${formatKstTimestamp(snapshot.publishedAt, lang)}`}
        </span>
        <span className={stale ? "foliotrace-badge-warn" : "foliotrace-badge-ok"}>{stale ? t.staleBadge : t.freshBadge}</span>
        <span>
          {snapshot.portfolio.legacyCoverage === "verified"
            ? t.legacyVerified
            : snapshot.portfolio.legacyCoverage === "partial"
              ? t.legacyPartial
              : t.legacyUnverified}{" "}
          ·{" "}
          {snapshot.filingCoverage === "complete"
            ? t.filingComplete
            : snapshot.filingCoverage === "partial"
              ? t.filingPartial
              : t.filingUnverified}
        </span>
        <span>{t.methodLink}</span>
      </div>

      <p className="foliotrace-scope-note">{t.scopeNote}</p>

      {snapshot.historicalCoverage && (
        <div className="foliotrace-history-coverage" role="status">
          <strong>{t.historicalCoverageTitle}</strong>
          <span>
            {(snapshot.historicalCoverage.listingComplete
              ? t.historicalCoverageComplete
              : t.historicalCoveragePending
            )
              .replace("{from}", snapshot.historicalCoverage.searchStartDate)
              .replace("{to}", snapshot.historicalCoverage.listingCompleteThrough)}
            {" · "}
            {t.historicalFirstFound}: {snapshot.historicalCoverage.firstObservedNpsReceiptDate ?? "—"}
            {!snapshot.historicalCoverage.listingComplete &&
              snapshot.historicalCoverage.firstObservedNpsReceiptDate && ` ${t.historicalFirstTentative}`}
          </span>
          <details>
            <summary>{t.historicalCoverageDetails}</summary>
            <div className="foliotrace-coverage-details">
              {!snapshot.historicalCoverage.listingComplete && (
                <span>{t.historicalCoverageTarget}: {snapshot.historicalCoverage.searchTargetDate}</span>
              )}
              <span>
                {t.historicalParsePending}: {snapshot.historicalCoverage.parsingPendingCount}
              </span>
              <span>
                {t.historicalLegacyRecheck}: {snapshot.historicalCoverage.legacySourceRecheckCount}
              </span>
              <small>{t.historicalCoverageScope}</small>
            </div>
          </details>
        </div>
      )}

      <div className="foliotrace-summary-grid">
        <Card className="foliotrace-summary-card">
          <span className="foliotrace-summary-label">{t.summaryValue}</span>
          <strong className="foliotrace-summary-value foliotrace-num">
            {snapshot.estimatedValue === null ? t.unavailable : breakableValue(formatKrw(snapshot.estimatedValue, lang))}
          </strong>
          <small>
            {snapshot.valuationCoverage === "unavailable"
              ? t.unavailableReasonComplete
              : snapshot.valuationCoverage === "partial"
                ? t.unavailableReasonPartial
                : snapshot.valuationTradeDate ?? ""}
          </small>
        </Card>
        <Card className="foliotrace-summary-card">
          <span className="foliotrace-summary-label">{t.summaryTracked}</span>
          <strong className="foliotrace-summary-value foliotrace-num">{snapshot.trackedCount}</strong>
          <small>
            {t.summaryPriced}: {snapshot.pricedCount}/{snapshot.trackedCount}
          </small>
        </Card>
        <Card className="foliotrace-summary-card">
          <span className="foliotrace-summary-label">{t.summaryEvents}</span>
          <strong className="foliotrace-summary-value foliotrace-num">{eventRange?.count ?? 0}</strong>
          <small>
            {eventRange ? `${eventRange.from} ~ ${eventRange.to}` : `${t.lastChange}: ${snapshot.latestReceiptDate ?? "—"}`}
          </small>
        </Card>
      </div>

      <SectionCard title={t.topWeights} description={t.topWeightsDesc}>
        {topWeights.length === 0 ? (
          <p className="foliotrace-state-text">{t.noHoldings}</p>
        ) : (
          <ul className="foliotrace-bars">
            {topWeights.map((h) => {
              // Approximate ratio for bar sizing only; labels use exact strings.
              const w = approxNumber(h.portfolioWeightPercent);
              return (
                <li key={h.stockCode} className="foliotrace-bar-row">
                  <span className="foliotrace-bar-name">
                    {h.name} <code className="foliotrace-code">{h.stockCode}</code>
                  </span>
                  <span className="foliotrace-bar-track" role="img" aria-label={`${h.name} ${formatPct(h.portfolioWeightPercent)}`}>
                    <span className="foliotrace-bar-fill" style={{ width: `${maxWeight > 0 ? (w / maxWeight) * 100 : 0}%` }} />
                  </span>
                  <span className="foliotrace-num foliotrace-bar-value">{formatPct(h.portfolioWeightPercent)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t.historyTitle} description={t.historyDesc}>
        {snapshot.history.length >= 2 ? (
          <ul className="foliotrace-history">
            {snapshot.history.map((h) => (
              <li key={`${h.tradeDate}-${h.datasetVersion}`}>
                <span>{h.tradeDate}</span>
                <span className="foliotrace-num">{breakableValue(formatKrw(h.estimatedValue, lang))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="foliotrace-state-text">{t.historySingle}</p>
        )}
      </SectionCard>

      <SectionCard title={t.eventsTitle} description={eventsDescription}>
        {recentEvents.length === 0 ? (
          <p className="foliotrace-state-text" role="status">
            {t.eventsEmpty} {t.lastChange}: {snapshot.latestReceiptDate ?? "—"}
          </p>
        ) : (
          <ul className="foliotrace-events">
            {recentEvents.map((event) => {
              const currentName = currentNameByCorpCode.get(event.corpCode);
              const label = currentName ?? (event.stockCode
                ? `${t.eventStockCode} ${event.stockCode}`
                : `${t.eventCorpCode} ${event.corpCode}`);
              return (
                <li key={event.observationKey ?? `${event.receiptNo}:${event.corpCode}:${event.stockCode ?? ""}:${event.kind}:${event.basisDate ?? ""}`}>
                  <div className="foliotrace-event-heading">
                    <strong>{label}</strong>
                    {currentName && event.stockCode && <code className="foliotrace-code">{event.stockCode}</code>}
                    <span>{event.basisDate ? `${t.eventBasis}: ${event.basisDate}` : `${t.eventReceipt}: ${event.receiptDate}`}</span>
                    <span>{event.kind === "tracking-reentry" && event.source === "indirect-observation" ?
                      t.eventIndirectReentry : EVENT_KIND[lang][event.kind]}</span>
                  </div>
                  <div className="foliotrace-event-values">
                    <span>{t.eventQuantity}: <span className="foliotrace-num">{event.quantity === null ? t.eventUnknown : formatQty(event.quantity)}</span></span>
                    <span>{t.eventOwnership}: <span className="foliotrace-num">{event.companyOwnershipPercent === null ? t.eventUnknown : observedPercent(event.companyOwnershipPercent, event.numericKind)}</span></span>
                    {event.percentagePointChange != null && <span>{t.eventPointChange.replace("{amount}", String(event.percentagePointChange))}</span>}
                  </div>
                  <div className="foliotrace-event-source">
                    <span>{event.source === "legacy-import" ? t.eventLegacySource :
                      event.source === "indirect-observation" ? t.eventIndirectSource :
                      event.source === "issuer-scope-observation" ? t.issuerScopeSource : t.eventDartSource}</span>
                    <code className="foliotrace-code">{event.receiptNo}</code>
                    {event.correctionOf && <small> ← {event.correctionOf}</small>}
                    {event.filingUrl && (
                      <a href={event.filingUrl} target="_blank" rel="noreferrer">
                        {t.openFiling}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t.tableTitle} description={t.tableDesc}>
        {snapshot.holdings.length === 0 ? (
          <>
            <p className="foliotrace-state-text" role="status">
              {t.noHoldings}
            </p>
            <p className="foliotrace-state-text">{t.noHoldingsDesc}</p>
          </>
        ) : (
          <>
            <p className="foliotrace-state-text foliotrace-table-note">{t.tableUnavailable}</p>
            <p className="foliotrace-state-text foliotrace-table-note">{t.tableChangeNote}</p>
            <div className="foliotrace-controls">
              <label className="foliotrace-field">
                <span>{t.searchLabel}</span>
                <input
                  type="search"
                  value={query}
                  placeholder={t.searchPlaceholder}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={t.searchLabel}
                />
              </label>
              <label className="foliotrace-field">
                <span>{t.qualityLabel}</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value as QualityFilter)} aria-label={t.qualityLabel}>
                  <option value="all">{t.qualityAll}</option>
                  <option value="priced">{t.qualityPriced}</option>
                  <option value="unpriced">{t.qualityUnpriced}</option>
                  <option value="below-5">{t.qualityBelow5}</option>
                </select>
              </label>
              <label className="foliotrace-field">
                <span>{t.sortLabel}</span>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label={t.sortLabel}>
                  <option value="value">{t.sortValue}</option>
                  <option value="weight">{t.sortWeight}</option>
                  <option value="ownership">{t.sortOwnership}</option>
                  <option value="receipt">{t.sortReceipt}</option>
                </select>
              </label>
              <button
                type="button"
                className="foliotrace-retry"
                onClick={() => {
                  setQuery("");
                  setQuality("all");
                  setSortKey("value");
                }}
              >
                {t.resetFilters}
              </button>
            </div>
            <p className="foliotrace-state-text" role="status" aria-live="polite">
              {t.resultCount}: <span className="foliotrace-num">{filtered.length}</span> {t.unitCount}
            </p>
            {filtered.length === 0 ? (
              <p className="foliotrace-state-text" role="status">
                <strong>{t.searchNoResults}</strong> {t.searchNoResultsDesc}
              </p>
            ) : (
              <div className="foliotrace-table-wrap">
                <table className="foliotrace-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.colName}</th>
                      <th scope="col" className="foliotrace-num">{t.colQuantity}</th>
                      <th scope="col" className="foliotrace-num">{t.colOwnership}</th>
                      <th scope="col" className="foliotrace-num">{t.colClose}</th>
                      <th scope="col" className="foliotrace-num">{t.colValue}</th>
                      <th scope="col" className="foliotrace-num">{t.colWeight}</th>
                      <th scope="col">{t.colReceipt}</th>
                      <th scope="col">{t.colStatus}</th>
                      <th scope="col">{t.colDetail}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((h) => (
                      <tr key={h.stockCode}>
                        <th scope="row">
                          {h.name} <code className="foliotrace-code">{h.stockCode}</code>
                          <small className="foliotrace-row-reason">
                            {t.rowBasis}: {h.holdingDate ?? t.unknownDate} · {h.evidence === "issuer-scope-observation" ? t.issuerScopeSource : h.evidence === "indirect-observation" ? t.rowIndirectSource :
                              h.evidence === "legacy-import" ? (h.sourceKind === "year-end-list" ? t.rowYearEnd : t.eventLegacySource) : t.rowDirectSource}
                          </small>
                          {h.observationStatus && (
                            <small className="foliotrace-row-reason">
                              {h.observationStatus === "same_basis_conflict" ? t.verifiedObservationConflict :
                                h.observationStatus === "verified_scoped" ? t.rowScopedValue : t.rowVerifiedValue}
                            </small>
                          )}
                          {h.issuerScopeConflict && (
                            <small className="foliotrace-row-reason">{t.verifiedObservationConflict}</small>
                          )}
                          {h.issuerScopeSource?.laterChangeDate && (
                            <small className="foliotrace-row-reason">
                              {h.issuerScopeSource.laterChangeDate}: {t.issuerScopeLaterChange}
                            </small>
                          )}
                          {h.estimatedValue === null && (
                            <small className="foliotrace-row-reason">
                              {exclusionReasonLabel(h.valuationExclusionReason, lang) ?? t.statusExcluded}
                            </small>
                          )}
                        </th>
                        <td className="foliotrace-num">
                          <FilingChangeValue value={formatQty(h.quantity)} direction={filingChanges.get(h)?.quantity ?? null}
                            upLabel={t.changeUp} downLabel={t.changeDown} />
                          {h.quantityAdjustment && (
                            <small className="foliotrace-row-reason" title={t.ratioTipKo.replace("{r}", formatQty(h.quantityAdjustment.reportedQuantity)).replace("{n}", h.quantityAdjustment.ratioNumerator).replace("{d}", h.quantityAdjustment.ratioDenominator)}>{t.ratioMarker}</small>
                          )}
                        </td>
                        <td className="foliotrace-num">
                          <FilingChangeValue value={observedPercent(h.companyOwnershipPercent, h.ownershipNumericKind)}
                            direction={filingChanges.get(h)?.ownership ?? null} upLabel={t.changeUp} downLabel={t.changeDown} />
                        </td>
                        <td className="foliotrace-num">
                          {h.quote ? `${formatKrw(h.quote.close, lang)} · ${h.quote.tradeDate}` : "—"}
                        </td>
                        <td className="foliotrace-num">{h.estimatedValue === null ? "—" : formatKrw(h.estimatedValue, lang)}</td>
                        <td className="foliotrace-num">{formatPct(h.portfolioWeightPercent)}</td>
                        <td className="foliotrace-receipt-date">{h.receiptDate}</td>
                        <td>{trackingStatusLabel(h)}<small className="foliotrace-row-reason">{statusLabel(holdingStatus(h))}</small></td>
                        <td>
                          <button type="button" className="foliotrace-retry" onClick={() => setSelectedCode(h.stockCode)}>
                            {t.detailButton}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title={t.guideTitle} description={t.formula}>
        <ul className="foliotrace-guide">
          <li>{t.description}</li>
          <li>{t.scopeNote}</li>
          <li>{t.ratioGuide}</li>
          <li>
            {t.priceBasis}
            {snapshot.valuationTradeDate ? ` · ${snapshot.valuationTradeDate}` : ""}
          </li>
          <li>
            {t.checkedAt}: {formatKstTimestamp(snapshot.filingsCheckedAt, lang) ?? "—"} · {t.generatedAt}: {formatKstTimestamp(snapshot.generatedAt, lang)}
            {snapshot.publishedAt && ` · ${t.publishedAt}: ${formatKstTimestamp(snapshot.publishedAt, lang)}`}
          </li>
        </ul>
      </SectionCard>

      <SectionCard title={t.faqTitle} description={t.faqDesc}>
        <div className="foliotrace-faq">
          {getFaqsForPath(lang, "foliotrace", "/tools/foliotrace").map((entry) => (
            <details key={entry.question}>
              <summary>{entry.question}</summary>
              <p>{entry.answer}</p>
            </details>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t.delistedTitle.replace("{count}", String(delistedItems.length))} description={t.delistedNote}>
        <ul className="foliotrace-delisted">
          {delistedItems.map((item) => (
            <li key={item.stockCode}>
              <strong>{lang === "ko" ? item.nameKo : item.nameEn}</strong>
              <span>{t.delistedShares} <span className="foliotrace-num">{formatQty(item.holdingShares2025ye)}</span>{t.delistedUnit}</span>
              <span>
                {item.delistedDate === null ? t.delistedPending :
                  `${t.delistedDate}: ${item.delistedDate}${item.dateEstimated ? ` ${t.delistedEstimated}` : ""}`}
              </span>
              <small>
                {lang === "ko" ? item.reasonKo : item.reasonEn}
                {" "}<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{t.delistedSource}</a>
              </small>
            </li>
          ))}
        </ul>
      </SectionCard>

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelectedCode(null); }}>
        {selected && (
          <SheetContent side="center" className="foliotrace-detail-panel" showCloseButton={false} style={{ maxHeight: "100dvh" }} aria-label={`${selected.name} ${t.colDetail}`}>
            <SheetClose className="foliotrace-detail-close" aria-label={t.closeDetail}>
              <XIcon aria-hidden="true" size={18} />
            </SheetClose>
            <SheetTitle>
              {selected.name} <code className="foliotrace-code">{selected.stockCode}</code>
            </SheetTitle>
            <SheetDescription>
              {entityName} · {scope}
            </SheetDescription>
            <dl className="foliotrace-detail-list">
              <div>
                <dt>{selected.quantityAdjustment ? t.adjustedQuantity : t.colQuantity}</dt>
                <dd className="foliotrace-num">{formatQty(selected.quantity)}</dd>
              </div>
              {selected.quantityAdjustment && (
                <>
                  <div>
                    <dt>{t.detailReportedQuantity}</dt>
                    <dd className="foliotrace-num">{formatQty(selected.quantityAdjustment.reportedQuantity)}</dd>
                  </div>
                  <div>
                    <dt>{t.detailRatio}</dt>
                    <dd className="foliotrace-num" title={t.ratioMarkerTitle}>
                      {lang === "ko"
                        ? `${selected.quantityAdjustment.ratioDenominator}주 → ${selected.quantityAdjustment.ratioNumerator}주`
                        : `${selected.quantityAdjustment.ratioDenominator} → ${selected.quantityAdjustment.ratioNumerator} shares`}
                      <small className="foliotrace-row-reason">
                        {t.detailRatioNote.replace("{n}", selected.quantityAdjustment.ratioNumerator).replace("{d}", selected.quantityAdjustment.ratioDenominator)}
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.detailRatioEvents}</dt>
                    <dd>
                      {selected.quantityAdjustment.events.map((event) => (
                        <div key={event.receiptNo}>
                          <a href={dartFilingUrl(event.receiptNo)} target="_blank" rel="noreferrer">
                            {t[`ratioKind_${event.kind.replace(/-/g, "_")}` as keyof typeof t]} · <code className="foliotrace-code">{event.receiptNo}</code>
                          </a>
                          <small className="foliotrace-row-reason">
                            {t.ratioEventPrice}: {event.priceChangeDate} · {t.ratioEventQuantity}: {event.quantityChangeDate ?? t.ratioEventPending}
                          </small>
                        </div>
                      ))}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>{t.colOwnership}</dt>
                <dd className="foliotrace-num">{observedPercent(selected.companyOwnershipPercent, selected.ownershipNumericKind)}</dd>
              </div>
              <div>
                <dt>{t.detailHoldingDate}</dt>
                <dd>{selected.holdingDate ?? t.unknownDate}</dd>
              </div>
              <div>
                <dt>{t.detailReceipt}</dt>
                <dd>
                  {selected.receiptDate} · {hasReceiptNo(selected.receiptNo)
                    ? <code className="foliotrace-code">{selected.receiptNo}</code> : t.noReceiptNo}
                </dd>
              </div>
              {selected.sourceKind && (
                <div>
                  <dt>{t.detailOrigin}</dt>
                  <dd>{selected.sourceKind === "year-end-list" ? t.sourceYearEnd :
                    selected.sourceKind === "nps-filing" ? t.sourceNps :
                      selected.sourceKind === "issuer-report" ? t.sourceIssuer : t.sourceTextRead}</dd>
                </div>
              )}
              {selected.indirectSource && (
                <div>
                  <dt>{t.rowIndirectSource}</dt>
                  <dd>
                    {t.eventBasis}: {selected.indirectSource.basisDate}
                    {selected.indirectSource.documentNo && ` · ${t.documentNumber} ${selected.indirectSource.documentNo}`}
                    {selected.indirectSource.directReceiptNo &&
                      <> · {t.directBaseline}: <code className="foliotrace-code">{selected.indirectSource.directReceiptNo}</code></>}
                  </dd>
                </div>
              )}
              {(selected.observationStatus === "verified_scoped" || selected.observationStatus === "same_basis_conflict") && selected.directBaseline && (
                <div><dt>{t.directBaseline}</dt><dd>
                  {selected.directBaseline.ownershipPercent === null ? "—" : formatPct(selected.directBaseline.ownershipPercent)}
                  {` · ${t.detailHoldingDate}: ${selected.directBaseline.holdingDate ?? t.unknownDate}`}
                  {selected.directBaseline.receiptDate && ` · ${t.eventReceipt}: ${selected.directBaseline.receiptDate}`}
                  <small className="foliotrace-row-reason">{selected.observationStatus === "same_basis_conflict" ? t.verifiedObservationConflict : t.issuerScopeComparison}</small>
                </dd></div>
              )}
              {selected.issuerScopeSource && (
                <>
                  <div><dt>{t.issuerScopeSource}</dt><dd>
                    {t.eventBasis}: {selected.holdingDate} · {t.issuerScopeDetail}: {formatQty(selected.issuerScopeSource.sourceQuantity)}
                    {" / "}{formatQty(selected.issuerScopeSource.denominatorQuantity)} · {selected.issuerScopeSource.denominatorDate}
                    {selected.issuerScopeSource.referenceCount > 1 && ` · ${selected.issuerScopeSource.referenceCount} ${t.unitCount}`}
                    {selected.issuerScopeSource.laterChangeDate &&
                      <small className="foliotrace-row-reason">
                        {selected.issuerScopeSource.laterChangeDate}: {t.issuerScopeLaterChange}
                      </small>}
                  </dd></div>
                  <div><dt>{t.directBaseline}</dt><dd>
                    {selected.directBaseline?.ownershipPercent == null ? "—" : formatPct(selected.directBaseline.ownershipPercent)}
                    {` · ${t.detailHoldingDate}: ${selected.directBaseline?.holdingDate ?? t.unknownDate}`}
                    {selected.directBaseline?.receiptDate && ` · ${t.eventReceipt}: ${selected.directBaseline.receiptDate}`}
                    <small className="foliotrace-row-reason">{t.issuerScopeComparison}</small>
                  </dd></div>
                </>
              )}
              <div>
                <dt>{t.detailPrice}</dt>
                <dd>
                  {selected.quote
                    ? quotePriceDetail(selected.quote, lang)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>{t.detailInclusion}</dt>
                <dd>
                  {trackingStatusLabel(selected)} · {statusLabel(holdingStatus(selected))}
                  {(() => {
                    const reason = exclusionReasonLabel(selected.valuationExclusionReason, lang);
                    return reason ? ` — ${reason}` : "";
                  })()}
                </dd>
              </div>
              {selected.evidence === "unresolved-latest" && selected.latestUnresolvedReceiptNo && (
                <>
                  <div>
                    <dt>{t.prevVerifiedReceipt}</dt>
                    <dd>
                      {selected.receiptDate} · {hasReceiptNo(selected.receiptNo)
                        ? <code className="foliotrace-code">{selected.receiptNo}</code> : t.noReceiptNo}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.latestUnresolvedReceipt}</dt>
                    <dd>
                      <code className="foliotrace-code">{selected.latestUnresolvedReceiptNo}</code>
                      {(() => {
                        const sub = latestUnresolvedReasonLabel(selected.latestUnresolvedReason, lang);
                        return sub ? ` — ${sub}` : "";
                      })()}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>{t.detailSource}</dt>
                <dd>
                  {selected.filingUrl ? (
                    <a href={selected.filingUrl} target="_blank" rel="noreferrer">
                      {t.openFiling}
                    </a>
                  ) : (
                    t.noFilingUrl
                  )}
                </dd>
              </div>
            </dl>
            {selectedObservations.length > 0 && (
              <section className="foliotrace-source-observations" aria-label={t.verifiedObservationTitle}>
                <h3 className="foliotrace-detail-h3">{t.verifiedObservationTitle}</h3>
                {selectedObservations.map((observation) => (
                  <p key={observation.observationKey}>
                    {observation.basisDate} · {observedPercent(observation.ownershipPercent, observation.numericKind)}
                    {" · "}{observation.reason === "same_basis_conflict" ? t.verifiedObservationConflict :
                      observation.reason === "direct_basis_unverified" ? t.directBasisPending :
                      observation.appliedToHolding ? t.verifiedObservationApplied : t.verifiedObservationPending}
                    {" "}<a href={observation.filingUrl} target="_blank" rel="noopener noreferrer">{t.indirectSource}</a>
                  </p>
                ))}
              </section>
            )}
            <h3 className="foliotrace-detail-h3">{t.detailHistory}</h3>
            {selectedEvents.length === 0 ? (
              <p className="foliotrace-state-text">{t.eventsEmpty}</p>
            ) : (
              <ul className="foliotrace-events">
                {selectedEvents.map((e) => (
                  <li key={e.observationKey ?? `${e.receiptNo}:${e.corpCode}:${e.stockCode ?? ""}:${e.kind}:${e.basisDate ?? ""}`}>
                    <strong>{e.kind === "tracking-reentry" && e.source === "indirect-observation" ?
                      t.eventIndirectReentry : EVENT_KIND[lang][e.kind]}</strong>
                    {" · "}<span>{e.basisDate ? `${t.eventBasis}: ${e.basisDate}` : `${t.eventReceipt}: ${e.receiptDate}`}</span>{" "}
                    <code className="foliotrace-code">{e.receiptNo}</code>
                  </li>
                ))}
              </ul>
            )}
          </SheetContent>
        )}
      </Sheet>
    </UtilityPage>
  );
}
