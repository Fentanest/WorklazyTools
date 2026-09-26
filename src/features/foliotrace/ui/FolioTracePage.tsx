import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PageHeader, SectionCard } from "../../../components/ui";
import { Card } from "../../../components/ui/card";
import {
  Sheet,
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
} from "./holdings";
import type { Lang, QualityFilter, SortKey } from "./holdings";
import { getFaqsForPath } from "./faq";
import indirectEvidence from "../data/indirectEvidence.json";

const STR = {
  ko: {
    eyebrow: "FolioTrace · 공개 공시 기반 추정",
    title: "FolioTrace",
    description:
      "DART 대량보유 공시로 추적하는 국민연금 국내주식 공개 포트폴리오 추정치입니다. 국민연금 전체 자산·실제 계좌 잔고·실제 운용 수익률이 아닙니다.",
    scopeNote:
      "국민연금의 국내주식 대량보유 공시를 바탕으로 한 추정 내역입니다.",
    historicalCoverageTitle: "과거 공시 확인 범위",
    historicalCoverageRange: "확인한 접수일",
    historicalCoverageTarget: "조회 목표일",
    historicalCoverageComplete: "해당 기간의 공시 목록 확인 완료",
    historicalCoveragePending: "공시 목록 확인 중",
    historicalCoverageScope: "국민연금 기관이 제출한 공시를 찾은 기간입니다. 각 공시의 수량·지분율 확인은 별도로 진행합니다.",
    historicalFirstObserved: "국민연금 기관이 제출한 첫 대량보유 공시 접수",
    historicalFirstTentative: "(조회 진행 중 잠정값)",
    historicalParsePending: "새 공시 내용 확인 중",
    historicalLegacyRecheck: "이전 기록 중 공시 확인이 필요한 건수",
    indirectTitle: "개별 공시에서 확인한 과거 기록",
    indirectSource: "DART 원문 보기",
    indirectScope: "다른 회사의 공시에서 찾은 보유 기록과 배정 계획입니다. 배정 계획은 실제 보유를 뜻하지 않습니다. 아직 확인 중인 기록은 현재 보유액에 넣지 않습니다.",
    historicalObservationTitle: "과거 보유 내역",
    historicalObservationScope: "공시의 보유 날짜·수량·비율을 확인했습니다. 지분율 계산에 쓰인 전체 주식 수의 날짜 등이 불분명한 기록은 현재 지분율과 바로 비교하지 않습니다.",
    historicalDenominatorDatePending: "전체 주식 수의 기준일 확인 중",
    historicalRatioBasisPending: "지분율 계산 기준 확인 중",
    historicalObservationMore: "더 많은 과거 기록",
    secondaryAll: "전체 공시 내용 검색으로 확인한 날짜",
    secondaryEquity: "지분·의결권 공시 내용으로 확인한 날짜",
    secondaryPriorAll: "1999~2005 전체 공시에서 확인한 날짜",
    secondaryPriorEquity: "1999~2005 지분·의결권 공시에서 확인한 날짜",
    secondaryDirect: "2006~2008 국민연금 제출 공시에서 확인한 날짜",
    secondaryCandidates: "내용을 확인할 공시",
    secondaryOtherUnreviewed: "검색에서 찾았지만 아직 읽지 않은 공시",
    secondarySourcePending: "공시 내용 확인 대기",
    secondaryContextPending: "주식 관련 내용 확인 중",
    secondaryNoScan: "기간별 공시 검색이 시작되기 전입니다. 아래는 개별적으로 확인한 기록입니다.",
    priceBasis: "KRX 정규장 종가 기준",
    checkedAt: "공시 확인",
    generatedAt: "자료 정리",
    publishedAt: "게시",
    publishTimeUnknown: "게시 시각 미기록",
    staleBadge: "자료를 확인한 지 3일 이상 지났습니다 — 공시와 종가를 다시 확인하세요",
    freshBadge: "현재 공개된 자료",
    legacyVerified: "이전 기록: 확인됨",
    legacyPartial: "이전 기록: 일부만 확인됨 — 과거 수치는 참고용입니다",
    legacyUnverified: "이전 기록: 아직 확인되지 않음 — 과거 수치는 참고용입니다",
    filingComplete: "확인한 공시 범위: 완료",
    filingPartial: "확인한 공시 범위: 일부 접수·정정 확인 중",
    filingUnverified: "확인한 공시 범위: 확인 중",
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
    historySingle: "검증된 이력이 1개뿐이라 추이를 표시하지 않습니다. 종목 표를 먼저 확인하세요.",
    tableTitle: "종목 표",
    tableDesc: "수량·지분율·종가·추정 금액·비중·접수일을 구분해 표시합니다.",
    tableUnavailable: "—는 확인된 평가 금액이 없다는 뜻입니다. 종목명 아래에서 제외 사유를 확인하세요.",
    searchLabel: "종목명·종목코드 검색",
    searchPlaceholder: "예: 삼성전자 또는 005930",
    qualityLabel: "데이터 상태 필터",
    qualityAll: "전체",
    qualityPriced: "평가 포함",
    qualityUnpriced: "평가 제외",
    qualityBelow5: "5% 추적 범위 이탈",
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
    colWeight: "추적 범위 내 비중",
    colReceipt: "최근 접수일",
    colStatus: "데이터 상태",
    colDetail: "상세",
    detailButton: "상세 보기",
    detailHoldingDate: "보유 기준일",
    rowBasis: "보유 기준일",
    rowIndirectSource: "제3자 공시 원문 확인",
    rowDirectSource: "직접 공시 기록",
    directBaseline: "비교한 직접 공시",
    verifiedObservationTitle: "다른 회사 공시에서 확인한 지분",
    verifiedObservationApplied: "현재 지분율에 반영",
    rowVerifiedValue: "기준일과 지분율 확인",
    verifiedObservationPending: "현재 지분율과 비교할 정보가 부족합니다",
    verifiedObservationConflict: "같은 날짜의 공시 수치가 달라 현재값에 넣지 않았습니다",
    detailReceipt: "접수일·접수번호",
    detailReport: "보고 기준",
    detailPrice: "가격 기준",
    detailInclusion: "평가 포함·제외 사유",
    detailSource: "원문 링크",
    detailHistory: "해당 종목 공시 이력",
    openFiling: "DART 원문 열기",
    noFilingUrl: "원문 링크 없음",
    unknownDate: "미상(기준일 모름)",
    eventsTitle: "최근 공시 변화",
    eventsDesc: "확인된 보유 기준일 우선 최근 {shown}건 / 전체 {total}건입니다. 기준일이 없으면 접수일을 사용합니다. 수량·지분율은 표시한 출처의 기록값입니다.",
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
    eventLegacySource: "과거 기록 · 공시 수치 재확인 전",
    lastChange: "마지막 변화",
    guideTitle: "계산 방법·출처·알아둘 점",
    guideFaqTitle: "자주 묻는 질문",
    faqTitle: "자주 묻는 질문",
    faqDesc: "추정 범위·계산·출처에 대한 자주 묻는 질문입니다.",
    prevVerifiedReceipt: "이전 확인 접수",
    latestUnresolvedReceipt: "최신 미확인 접수",
    retry: "게시된 데이터 다시 조회",
    statusIncluded: "평가 포함",
    statusExcluded: "평가 제외",
    statusActiveRecord: "공시 지분율 5% 이상",
    statusUnknownTracking: "추적 상태 확인 중",
    statusExit: "5% 추적 범위 이탈",
    statusUnresolved: "최신 미확인",
    searchNoResults: "검색 결과가 없습니다.",
    searchNoResultsDesc: "검색어·필터를 바꾸거나 초기화하세요. 없는 종목을 임의로 만들지 않습니다.",
    loading: "게시된 FolioTrace 데이터를 불러오는 중입니다.",
    missingTitle: "공개 데이터를 아직 게시하지 않았습니다",
    missingDesc:
      "아직 표시할 수 있는 실제 공시 자료가 준비되지 않았습니다.",
    loadErrorTitle: "게시된 데이터를 불러오지 못했습니다",
    loadErrorDesc: "페이지 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    schemaErrorTitle: "게시된 데이터 형식을 확인할 수 없습니다",
    schemaErrorDesc: "게시된 자료를 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.",
    formula: "추정 평가금액 = 공시 확인 수량 × 해당 거래일 KRX 정규장 종가 / 추적 범위 내 비중 = 해당 금액 ÷ 같은 통화·범위·거래일의 평가 가능 합계 × 100",
  },
  en: {
    eyebrow: "FolioTrace · Public filing estimate",
    title: "FolioTrace",
    description:
      "An estimated public portfolio of NPS domestic equities tracked from DART major-shareholding filings. Not total NPS assets, real account balances, or actual returns.",
    scopeNote:
      "This estimate follows NPS domestic equities reported in DART filings.",
    historicalCoverageTitle: "Historical filings checked",
    historicalCoverageRange: "Receipt dates checked",
    historicalCoverageTarget: "Target end date",
    historicalCoverageComplete: "Filings listed for the whole period",
    historicalCoveragePending: "Still checking filings",
    historicalCoverageScope: "These dates cover filings submitted by NPS. Reported quantities and percentages are checked separately.",
    historicalFirstObserved: "Earliest large-shareholding filing submitted by NPS",
    historicalFirstTentative: "(provisional while searching)",
    historicalParsePending: "New filings under review",
    historicalLegacyRecheck: "Earlier records awaiting source checks",
    indirectTitle: "Older records checked in individual filings",
    indirectSource: "Open DART filing",
    indirectScope: "These are holding and planned-allotment clues in other filers' documents. A planned allotment is not a confirmed holding. Search-page checks do not verify every source fact. Historical observations with an unverified ratio basis or current date are excluded from current holdings and valuation.",
    historicalObservationTitle: "Historical holdings",
    historicalObservationScope: "The filing confirms a holding date, quantity, and percentage. Some details about the total share count, including its date, still need checking before comparison with today's percentage.",
    historicalDenominatorDatePending: "Date of the total share count still under review",
    historicalRatioBasisPending: "How the percentage was calculated is still under review",
    historicalObservationMore: "More historical records",
    secondaryAll: "All filing contents searched through",
    secondaryEquity: "Ownership and voting filings searched through",
    secondaryPriorAll: "1999–2005 filings searched through",
    secondaryPriorEquity: "1999–2005 ownership and voting filings searched through",
    secondaryDirect: "2006–2008 NPS-submitted filings checked through",
    secondaryCandidates: "Filings needing a closer look",
    secondaryOtherUnreviewed: "Found in search but not yet read",
    secondarySourcePending: "Waiting to read filing contents",
    secondaryContextPending: "Stock-related details under review",
    secondaryNoScan: "The period-by-period search has not started. The records below were checked individually.",
    priceBasis: "KRX regular-session close basis",
    checkedAt: "Filings checked",
    generatedAt: "Records prepared",
    publishedAt: "Published",
    publishTimeUnknown: "Publish time not recorded",
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
    historySingle: "Only one confirmed record is available, so there is no trend yet. See the holdings table first.",
    tableTitle: "Holdings table",
    tableDesc: "Quantity, company ownership, close, estimated value, weight, and receipt date are shown separately.",
    tableUnavailable: "— means no verified valuation is available. See the exclusion reason under the security name.",
    searchLabel: "Search name / stock code",
    searchPlaceholder: "e.g. Samsung or 005930",
    qualityLabel: "Data-status filter",
    qualityAll: "All",
    qualityPriced: "Included in valuation",
    qualityUnpriced: "Excluded from valuation",
    qualityBelow5: "Exited 5% tracking scope",
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
    colWeight: "Weight in scope",
    colReceipt: "Latest receipt",
    colStatus: "Data status",
    colDetail: "Detail",
    detailButton: "View detail",
    detailHoldingDate: "Holding date",
    rowBasis: "Holding basis date",
    rowIndirectSource: "Third-party filing checked",
    rowDirectSource: "Direct filing record",
    directBaseline: "Compared direct filing",
    verifiedObservationTitle: "Ownership found in another company's filing",
    verifiedObservationApplied: "Applied to current ownership",
    rowVerifiedValue: "Holding date and percentage checked",
    verifiedObservationPending: "Not enough information to compare with the current percentage",
    verifiedObservationConflict: "Filings for the same date disagree, so this was not used for the current value",
    detailReceipt: "Receipt date · no.",
    detailReport: "Report basis",
    detailPrice: "Price basis",
    detailInclusion: "Inclusion / exclusion reason",
    detailSource: "Source link",
    detailHistory: "Filing history for this security",
    openFiling: "Open DART source",
    noFilingUrl: "No source link",
    unknownDate: "Unknown (no holding date)",
    eventsTitle: "Recent filing changes",
    eventsDesc: "Latest {shown} by verified holding date, or receipt date when unavailable / {total} overall. Quantities and ownership are recorded source values.",
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
    prevVerifiedReceipt: "Previously confirmed receipt",
    latestUnresolvedReceipt: "Latest unverified receipt",
    retry: "Re-fetch published data",
    statusIncluded: "Included",
    statusExcluded: "Excluded",
    statusActiveRecord: "Filed ownership at or above 5%",
    statusUnknownTracking: "Tracking status under review",
    statusExit: "Exited 5% scope",
    statusUnresolved: "Latest unverified",
    searchNoResults: "No matching securities.",
    searchNoResultsDesc: "Change the query or filters, or reset them. Missing securities are never invented.",
    loading: "Loading the published FolioTrace data…",
    missingTitle: "Public data is not published yet",
    missingDesc:
      "Real filing data is not ready to show yet.",
    loadErrorTitle: "Could not load the published data",
    loadErrorDesc: "The page data could not be loaded. Please try again shortly.",
    schemaErrorTitle: "Published data format could not be verified",
    schemaErrorDesc: "The published data could not be read. Please try again shortly.",
    formula: "Estimated value = filed quantity × KRX regular-session close on that trade date / In-scope weight = value ÷ priced total in same currency, scope, and trade date × 100",
  },
} satisfies Record<Lang, Record<string, string>>;

const EVENT_KIND: Record<Lang, Record<FilingEvent["kind"], string>> = {
  ko: {
    increase: "기록 수량 비교상 증가",
    decrease: "기록 수량 비교상 감소",
    "new-report": "첫 기록 공시",
    "purpose-change": "목적 변경",
    "tracking-exit": "5% 추적 범위 이탈",
    "tracking-reentry": "5% 추적 범위 재진입",
    other: "기타",
  },
  en: {
    increase: "Increase vs prior recorded filing",
    decrease: "Decrease vs prior recorded filing",
    "new-report": "First recorded filing",
    "purpose-change": "Purpose change",
    "tracking-exit": "Exited 5% tracking scope",
    "tracking-reentry": "Re-entered 5% tracking scope",
    other: "Other",
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
      <div className="foliotrace-page">
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
      </div>
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
    indirectReentries.has(`${holding.corpCode}:${holding.receiptNo}`) ? t.eventIndirectReentry :
      holding.tracking === "active" ? t.statusActiveRecord :
        holding.tracking === "below-5-percent" ? t.statusExit : t.statusUnknownTracking;
  const statusLabel = (s: ReturnType<typeof holdingStatus>) =>
    s === "included" ? t.statusIncluded : s === "excluded" ? t.statusExcluded : s === "exit" ? t.statusExit : t.statusUnresolved;

  return (
    <div className="foliotrace-page">
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
          {t.checkedAt}: {snapshot.filingsCheckedAt ?? "—"} · {t.generatedAt}: {snapshot.generatedAt} · {t.publishedAt}:{" "}
          {snapshot.publishedAt ?? t.publishTimeUnknown}
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
            {t.historicalCoverageRange}: {snapshot.historicalCoverage.searchStartDate} ~ {snapshot.historicalCoverage.listingCompleteThrough}
            {" · "}{t.historicalCoverageTarget}: {snapshot.historicalCoverage.searchTargetDate}
            {" · "}{snapshot.historicalCoverage.listingComplete ? t.historicalCoverageComplete : t.historicalCoveragePending}
          </span>
          <span>
            {t.historicalFirstObserved}: {snapshot.historicalCoverage.firstObservedNpsReceiptDate ?? "—"}
            {!snapshot.historicalCoverage.listingComplete && snapshot.historicalCoverage.firstObservedNpsReceiptDate && ` ${t.historicalFirstTentative}`}
            {" · "}{t.historicalParsePending}: {snapshot.historicalCoverage.parsingPendingCount}
            {" · "}{t.historicalLegacyRecheck}: {snapshot.historicalCoverage.legacySourceRecheckCount}
          </span>
          <small>{t.historicalCoverageScope}</small>
        </div>
      )}

      <aside className="foliotrace-indirect-clue" aria-label={t.indirectTitle}>
        <strong>{t.indirectTitle}</strong>
        {snapshot.secondaryCoverage ? (
          <small>
            {t.secondaryAll}: {snapshot.secondaryCoverage.allContentCheckedThrough ?? "—"}
            {" · "}{t.secondaryEquity}: {snapshot.secondaryCoverage.equityContentCheckedThrough ?? "—"}
            {" · "}{t.secondaryPriorAll}: {snapshot.secondaryCoverage.priorContentCheckedThrough ?? "—"}
            {" · "}{t.secondaryPriorEquity}: {snapshot.secondaryCoverage.priorEquityCheckedThrough ?? "—"}
            {" · "}{t.secondaryDirect}: {snapshot.secondaryCoverage.earlyDirectCheckedThrough ?? "—"}
            {" · "}{t.secondaryCandidates}: {snapshot.secondaryCoverage.candidateDocumentCount}
            {" · "}{t.secondaryOtherUnreviewed}: {snapshot.secondaryCoverage.noncandidateUnreviewedCount}
            {" · "}{t.secondarySourcePending}: {snapshot.secondaryCoverage.sourceReviewPendingCount}
            {" · "}{t.secondaryContextPending}: {snapshot.secondaryCoverage.sourceContextReviewCount}
          </small>
        ) : <small>{t.secondaryNoScan}</small>}
        {(snapshot.historicalObservations?.length ?? 0) > 0 && (
          <div className="foliotrace-source-observations">
            <strong>{t.historicalObservationTitle}</strong>
            <small>{t.historicalObservationScope}</small>
            {snapshot.historicalObservations?.slice(0, 20).map((observation) => (
              <p key={`${observation.receiptNo}:${observation.documentNo}:${observation.sourceRowSha256}`}>
                <strong>{observation.issuerName}</strong> · {observation.basisDate} · {formatQty(observation.quantity)} · {formatPct(observation.ownershipPercent)}
                {" · "}{observation.status === "historical_only_denominator_date_unverified" ?
                  t.historicalDenominatorDatePending : t.historicalRatioBasisPending}
                {" "}<a href={observation.filingUrl} target="_blank" rel="noopener noreferrer">{t.indirectSource}</a>
              </p>
            ))}
            {(snapshot.historicalObservations?.length ?? 0) > 20 && (
              <small>{t.historicalObservationMore}: {(snapshot.historicalObservations?.length ?? 0) - 20}</small>
            )}
          </div>
        )}
        {(snapshot.verifiedIndirectObservations?.length ?? 0) > 0 && (
          <div className="foliotrace-source-observations">
            <strong>{t.verifiedObservationTitle}</strong>
            {recentObservations.slice(0, 20).map((observation) => (
              <p key={observation.observationKey}>
                <strong>{currentNameByCorpCode.get(observation.corpCode) ?? observation.stockCode}</strong>
                {" · "}{observation.basisDate} · {observedPercent(observation.ownershipPercent, observation.numericKind)}
                {" · "}{observation.reason === "same_basis_conflict" ? t.verifiedObservationConflict :
                  observation.appliedToHolding ? t.verifiedObservationApplied : t.verifiedObservationPending}
                {" "}<a href={observation.filingUrl} target="_blank" rel="noopener noreferrer">{t.indirectSource}</a>
              </p>
            ))}
          </div>
        )}
        {indirectEvidence.items.filter((clue) => !(clue.facts.length === 1 && snapshot.historicalObservations?.some(
          (observation) => observation.receiptNo === clue.receiptNo &&
            observation.quantity === clue.facts[0].quantity &&
            observation.ownershipPercent === clue.facts[0].ownershipPercent &&
            observation.basisDate === clue.facts[0].basisDate))).map((clue) => (
          <p key={clue.receiptNo}>
            {lang === "ko" ? clue.descriptionKo : clue.descriptionEn}
            {" "}<a href={clue.sourceUrl} target="_blank" rel="noopener noreferrer">{t.indirectSource}</a>
          </p>
        ))}
        <small>{t.indirectScope}</small>
      </aside>

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
                <small>{h.datasetVersion}</small>
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
                <li key={event.observationKey ?? `${event.receiptNo}:${event.corpCode}:${event.stockCode ?? ""}`}>
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
                    {event.percentagePointChange != null && <span>Δ <span className="foliotrace-num">{event.percentagePointChange}pp</span></span>}
                  </div>
                  <div className="foliotrace-event-source">
                    <span>{event.source === "legacy-import" ? t.eventLegacySource :
                      event.source === "indirect-observation" ? t.eventIndirectSource : t.eventDartSource}</span>
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
                            {t.rowBasis}: {h.holdingDate ?? t.unknownDate} · {h.evidence === "indirect-observation" ? t.rowIndirectSource :
                              h.evidence === "legacy-import" ? t.eventLegacySource : t.rowDirectSource}
                          </small>
                          {h.observationStatus && (
                            <small className="foliotrace-row-reason">
                              {h.observationStatus === "same_basis_conflict" ? t.verifiedObservationConflict : t.rowVerifiedValue}
                            </small>
                          )}
                          {h.estimatedValue === null && (
                            <small className="foliotrace-row-reason">
                              {exclusionReasonLabel(h.valuationExclusionReason, lang) ?? t.statusExcluded}
                            </small>
                          )}
                        </th>
                        <td className="foliotrace-num">{formatQty(h.quantity)}</td>
                        <td className="foliotrace-num">{observedPercent(h.companyOwnershipPercent, h.ownershipNumericKind)}</td>
                        <td className="foliotrace-num">
                          {h.quote ? `${formatKrw(h.quote.close, lang)} · ${h.quote.tradeDate}` : "—"}
                        </td>
                        <td className="foliotrace-num">{h.estimatedValue === null ? "—" : formatKrw(h.estimatedValue, lang)}</td>
                        <td className="foliotrace-num">{formatPct(h.portfolioWeightPercent)}</td>
                        <td>{h.receiptDate}</td>
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
          <li>
            {t.priceBasis}
            {snapshot.valuationTradeDate ? ` · ${snapshot.valuationTradeDate}` : ""} · {t.retry}
          </li>
          <li>
            {t.checkedAt}: {snapshot.filingsCheckedAt ?? "—"} · {t.generatedAt}: {snapshot.generatedAt} · {t.publishedAt}:{" "}
            {snapshot.publishedAt ?? t.publishTimeUnknown}
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

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelectedCode(null); }}>
        {selected && (
          <SheetContent side="right" aria-label={`${selected.name} ${t.colDetail}`}>
            <SheetTitle>
              {selected.name} <code className="foliotrace-code">{selected.stockCode}</code>
            </SheetTitle>
            <SheetDescription>
              {entityName} · {scope}
            </SheetDescription>
            <dl className="foliotrace-detail-list">
              <div>
                <dt>{t.colQuantity}</dt>
                <dd className="foliotrace-num">{formatQty(selected.quantity)}</dd>
              </div>
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
                  {selected.receiptDate} · <code className="foliotrace-code">{selected.receiptNo}</code>
                </dd>
              </div>
              {selected.indirectSource && (
                <div>
                  <dt>{t.rowIndirectSource}</dt>
                  <dd>
                    {t.eventBasis}: {selected.indirectSource.basisDate}
                    {selected.indirectSource.documentNo && ` · dcmNo ${selected.indirectSource.documentNo}`}
                    {selected.indirectSource.directReceiptNo &&
                      <> · {t.directBaseline}: <code className="foliotrace-code">{selected.indirectSource.directReceiptNo}</code></>}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t.detailPrice}</dt>
                <dd>
                  {selected.quote
                    ? `${formatKrw(selected.quote.close, lang)} · ${selected.quote.tradeDate} · ${quoteSessionLabel(selected.quote.session, lang)} · ${quoteProviderLabel(selected.quote.provider, lang)}`
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
                      {selected.receiptDate} · <code className="foliotrace-code">{selected.receiptNo}</code>
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
                  <li key={e.observationKey ?? `${e.receiptNo}:${e.corpCode}:${e.stockCode ?? ""}`}>
                    <strong>{e.kind === "tracking-reentry" && e.source === "indirect-observation" ?
                      t.eventIndirectReentry : EVENT_KIND[lang][e.kind]}</strong>
                    <span>{e.basisDate ? `${t.eventBasis}: ${e.basisDate}` : `${t.eventReceipt}: ${e.receiptDate}`}</span>{" "}
                    <code className="foliotrace-code">{e.receiptNo}</code>
                  </li>
                ))}
              </ul>
            )}
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
