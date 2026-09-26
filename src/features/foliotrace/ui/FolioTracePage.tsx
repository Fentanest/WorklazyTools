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

const STR = {
  ko: {
    eyebrow: "FolioTrace · 공개 공시 기반 추정",
    title: "FolioTrace",
    description:
      "DART 대량보유 공시로 추적하는 국민연금 국내주식 공개 포트폴리오 추정치입니다. 국민연금 전체 자산·실제 계좌 잔고·실제 운용 수익률이 아닙니다.",
    scopeNote:
      "현재 범위는 국민연금 국내주식 DART 대량보유 공시 기반 1개 포트폴리오입니다. 미구현 해외·타 기관·인물 포트폴리오는 제공하지 않습니다.",
    priceBasis: "KRX 정규장 종가 기준",
    checkedAt: "공시 확인",
    generatedAt: "데이터 생성",
    publishedAt: "게시",
    publishTimeUnknown: "게시 시각 미기록",
    staleBadge: "데이터 생성 후 3일 초과 — 공시·종가를 다시 확인하세요",
    freshBadge: "생성 데이터 표시",
    legacyVerified: "이관 자료 범위: 검증됨",
    legacyPartial: "이관 자료 범위: 일부만 검증됨 — 과거 수치는 참고용입니다",
    legacyUnverified: "이관 자료 범위: 미검증 — 과거 수치는 참고용입니다",
    filingComplete: "공시 커버리지: 완전",
    filingPartial: "공시 커버리지: 부분적 — 일부 접수·정정이 미반영일 수 있음",
    filingUnverified: "공시 커버리지: 미검증",
    methodLink: "계산 방법·출처는 하단 안내를 확인하세요",
    summaryValue: "공개 보유분 추정 평가금액",
    summaryTracked: "추적 종목 수",
    summaryPriced: "평가 가능 종목",
    summaryEvents: "최근 공시 변화",
    unavailable: "평가 불가",
    unavailableReasonComplete: "유효한 종가가 없어 평가할 수 없습니다.",
    unavailableReasonPartial: "수량·증권 대응·종가를 확인하지 못한 종목은 제외한 부분합입니다.",
    noHoldings: "추적 중인 종목이 없습니다.",
    noHoldingsDesc: "공시 확인 시각 이후 추적 종목이 비어 있습니다. 게시된 정적 데이터를 다시 조회해 보세요.",
    topWeights: "상위 보유 종목 비중",
    topWeightsDesc: "추적 범위 내 비중입니다. 분모는 평가 가능한 전체 집합이며, 표 필터로 분모를 다시 100%로 만들지 않습니다.",
    historyTitle: "추정 평가금액 추이",
    historyDesc: "같은 방법론의 실제 스냅샷이 2개 이상일 때만 표시합니다.",
    historySingle: "검증된 이력이 1개뿐이라 추이를 표시하지 않습니다. 종목 표를 먼저 확인하세요.",
    tableTitle: "종목 표",
    tableDesc: "수량·지분율·종가·추정 금액·비중·접수일을 구분해 표시합니다.",
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
    detailReceipt: "접수일·접수번호",
    detailReport: "보고 기준",
    detailPrice: "가격 기준",
    detailInclusion: "평가 포함·제외 사유",
    detailSource: "원문 링크",
    detailHistory: "해당 종목 공시 이력",
    openFiling: "DART 원문 열기",
    noFilingUrl: "원문 링크 없음",
    unknownDate: "미상(기준일 모름)",
    eventsTitle: "공시 변화",
    eventsDesc: "수집 날짜가 아니라 실제 접수일 기준으로 표시합니다.",
    eventsEmpty: "해당 기간의 공시 변화가 없습니다.",
    lastChange: "마지막 변화",
    guideTitle: "방법론·출처·주의사항",
    guideFaqTitle: "자주 묻는 질문",
    faqTitle: "자주 묻는 질문",
    faqDesc: "추정 범위·계산·출처에 대한 자주 묻는 질문입니다.",
    prevVerifiedReceipt: "이전 확인 접수",
    latestUnresolvedReceipt: "최신 미확인 접수",
    retry: "게시된 데이터 다시 조회",
    statusIncluded: "평가 포함",
    statusExcluded: "평가 제외",
    statusExit: "5% 추적 범위 이탈",
    statusUnresolved: "최신 미확인",
    searchNoResults: "검색 결과가 없습니다.",
    searchNoResultsDesc: "검색어·필터를 바꾸거나 초기화하세요. 없는 종목을 임의로 만들지 않습니다.",
    loading: "게시된 FolioTrace 데이터를 불러오는 중입니다.",
    missingTitle: "공개 데이터를 아직 게시하지 않았습니다",
    missingDesc:
      "실제 데이터 이관(import)이 완료되지 않아 표시할 수 없습니다. 샘플 금융 데이터로 대체하지 않습니다.",
    loadErrorTitle: "게시된 데이터를 불러오지 못했습니다",
    loadErrorDesc: "같은 사이트의 정적 JSON을 다시 조회해 보세요. DART 배치를 실행하지 않습니다.",
    schemaErrorTitle: "게시된 데이터 형식을 확인할 수 없습니다",
    schemaErrorDesc: "게시 파일의 버전·형식이 계약과 다릅니다. 관리자가 게시물을 고칠 때까지 기다려 주세요.",
    formula: "추정 평가금액 = 공시 확인 수량 × 해당 거래일 KRX 정규장 종가 / 추적 범위 내 비중 = 해당 금액 ÷ 같은 통화·범위·거래일의 평가 가능 합계 × 100",
  },
  en: {
    eyebrow: "FolioTrace · Public filing estimate",
    title: "FolioTrace",
    description:
      "An estimated public portfolio of NPS domestic equities tracked from DART major-shareholding filings. Not total NPS assets, real account balances, or actual returns.",
    scopeNote:
      "Current scope is one NPS domestic-equity portfolio from DART filings. Unimplemented foreign, other-institution, or person portfolios are not offered.",
    priceBasis: "KRX regular-session close basis",
    checkedAt: "Filings checked",
    generatedAt: "Generated",
    publishedAt: "Published",
    publishTimeUnknown: "Publish time not recorded",
    staleBadge: "Generated over 3 days ago — re-check filings and closes",
    freshBadge: "Generated data shown",
    legacyVerified: "Migrated coverage: verified",
    legacyPartial: "Migrated coverage: partially verified — treat history as reference",
    legacyUnverified: "Migrated coverage: unverified — treat history as reference",
    filingComplete: "Filing coverage: complete",
    filingPartial: "Filing coverage: partial — some receipts/corrections may be missing",
    filingUnverified: "Filing coverage: unverified",
    methodLink: "See the notes below for method and sources",
    summaryValue: "Estimated disclosed value",
    summaryTracked: "Tracked securities",
    summaryPriced: "Priced securities",
    summaryEvents: "Recent filing changes",
    unavailable: "Valuation unavailable",
    unavailableReasonComplete: "No valid closing prices, so nothing could be valued.",
    unavailableReasonPartial: "This is a partial sum; holdings without verified quantity, security mapping, or close are excluded.",
    noHoldings: "No tracked securities.",
    noHoldingsDesc: "The tracked list is empty after the last filings check. Re-fetch the published static data.",
    topWeights: "Top holdings by weight",
    topWeightsDesc: "Weights within the tracked scope. The denominator is the full priced set; table filters never renormalize it to 100%.",
    historyTitle: "Estimated value history",
    historyDesc: "Shown only with 2+ real snapshots under the same methodology.",
    historySingle: "Only one verified snapshot exists, so no trend is shown. See the holdings table first.",
    tableTitle: "Holdings table",
    tableDesc: "Quantity, company ownership, close, estimated value, weight, and receipt date are shown separately.",
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
    detailReceipt: "Receipt date · no.",
    detailReport: "Report basis",
    detailPrice: "Price basis",
    detailInclusion: "Inclusion / exclusion reason",
    detailSource: "Source link",
    detailHistory: "Filing history for this security",
    openFiling: "Open DART source",
    noFilingUrl: "No source link",
    unknownDate: "Unknown (no holding date)",
    eventsTitle: "Filing changes",
    eventsDesc: "Shown by actual receipt date, not collection date.",
    eventsEmpty: "No filing changes in this period.",
    lastChange: "Last change",
    guideTitle: "Method · sources · cautions",
    guideFaqTitle: "FAQ",
    faqTitle: "FAQ",
    faqDesc: "Frequently asked questions about scope, estimation, and sources.",
    prevVerifiedReceipt: "Previously confirmed receipt",
    latestUnresolvedReceipt: "Latest unverified receipt",
    retry: "Re-fetch published data",
    statusIncluded: "Included",
    statusExcluded: "Excluded",
    statusExit: "Exited 5% scope",
    statusUnresolved: "Latest unverified",
    searchNoResults: "No matching securities.",
    searchNoResultsDesc: "Change the query or filters, or reset them. Missing securities are never invented.",
    loading: "Loading the published FolioTrace data…",
    missingTitle: "Public data is not published yet",
    missingDesc:
      "The real data import is not complete, so nothing can be shown. No sample financial data is substituted.",
    loadErrorTitle: "Could not load the published data",
    loadErrorDesc: "Re-fetch this site's static JSON. This never runs a DART batch.",
    schemaErrorTitle: "Published data format could not be verified",
    schemaErrorDesc: "The published file version/format differs from the contract. Please wait for a fixed publish.",
    formula: "Estimated value = filed quantity × KRX regular-session close on that trade date / In-scope weight = value ÷ priced total in same currency, scope, and trade date × 100",
  },
} satisfies Record<Lang, Record<string, string>>;

const EVENT_KIND: Record<Lang, Record<FilingEvent["kind"], string>> = {
  ko: {
    increase: "공시상 보유 증가",
    decrease: "공시상 보유 감소",
    "new-report": "신규 보고",
    "purpose-change": "목적 변경",
    "tracking-exit": "5% 추적 범위 이탈",
    other: "기타",
  },
  en: {
    increase: "Filed increase",
    decrease: "Filed decrease",
    "new-report": "New report",
    "purpose-change": "Purpose change",
    "tracking-exit": "Exited 5% tracking scope",
    other: "Other",
  },
};

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

  const selected: Holding | null =
    selectedCode === null ? null : (snapshot.holdings.find((h) => h.stockCode === selectedCode) ?? null);
  const selectedEvents = useMemo(
    () => (selected ? snapshot.events.filter((e) => e.corpCode === selected.corpCode) : []),
    [selected, snapshot.events],
  );

  const entityName = lang === "ko" ? snapshot.entity.nameKo : snapshot.entity.nameEn;
  const scope = lang === "ko" ? snapshot.portfolio.scopeKo : snapshot.portfolio.scopeEn;
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

      <SectionCard title={t.historyTitle} description={`${t.historyDesc} (v${snapshot.portfolio.methodologyVersion})`}>
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
                        </th>
                        <td className="foliotrace-num">{formatQty(h.quantity)}</td>
                        <td className="foliotrace-num">{formatPct(h.companyOwnershipPercent)}</td>
                        <td className="foliotrace-num">
                          {h.quote ? `${formatKrw(h.quote.close, lang)} · ${h.quote.tradeDate}` : "—"}
                        </td>
                        <td className="foliotrace-num">{h.estimatedValue === null ? "—" : formatKrw(h.estimatedValue, lang)}</td>
                        <td className="foliotrace-num">{formatPct(h.portfolioWeightPercent)}</td>
                        <td>{h.receiptDate}</td>
                        <td>{statusLabel(holdingStatus(h))}</td>
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

      <SectionCard title={t.eventsTitle} description={t.eventsDesc}>
        {snapshot.events.length === 0 ? (
          <p className="foliotrace-state-text" role="status">
            {t.eventsEmpty} {t.lastChange}: {snapshot.latestReceiptDate ?? "—"}
          </p>
        ) : (
          <ul className="foliotrace-events">
            {[...snapshot.events]
              .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))
              .slice(0, 30)
              .map((e) => (
                <li key={e.receiptNo}>
                  <strong>{EVENT_KIND[lang][e.kind]}</strong> <span>{e.receiptDate}</span>{" "}
                  <code className="foliotrace-code">{e.receiptNo}</code>
                  {e.correctionOf && <small> ← {e.correctionOf}</small>}
                  {e.filingUrl && (
                    <a href={e.filingUrl} target="_blank" rel="noreferrer">
                      {t.openFiling}
                    </a>
                  )}
                </li>
              ))}
          </ul>
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
                <dd className="foliotrace-num">{formatPct(selected.companyOwnershipPercent)}</dd>
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
                  {statusLabel(holdingStatus(selected))}
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
            <h3 className="foliotrace-detail-h3">{t.detailHistory}</h3>
            {selectedEvents.length === 0 ? (
              <p className="foliotrace-state-text">{t.eventsEmpty}</p>
            ) : (
              <ul className="foliotrace-events">
                {selectedEvents.map((e) => (
                  <li key={e.receiptNo}>
                    <strong>{EVENT_KIND[lang][e.kind]}</strong> <span>{e.receiptDate}</span>{" "}
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
