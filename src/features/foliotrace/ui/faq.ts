import type { Lang } from "./holdings";

export interface FolioTraceFaqEntry {
  q: Record<Lang, string>;
  a: Record<Lang, string>;
}

/**
 * Visible React FAQ for FolioTrace (Astra FT-10: the React page rendered
 * guide paragraphs but no FAQ while static fallback carried it).
 *
 * Source of truth: the approved shared spec
 * (docs/jobs/01-SHARED-SPEC.md) — scope, estimation formula, date
 * semantics, exclusion handling, 5% interpretation, and refresh meaning.
 * Sol's static HTML/JSON-LD fallback must stay consistent with this
 * list; report drift instead of silently diverging.
 */
export const FOLIO_TRACE_FAQ: FolioTraceFaqEntry[] = [
  {
    q: { ko: "FolioTrace의 추정 범위는 무엇인가요?", en: "What does FolioTrace estimate?" },
    a: {
      ko: "DART 대량보유 공시로 추적하는 국민연금 국내주식 공개 포트폴리오 추정치입니다. 국민연금 전체 자산·실제 계좌 잔고·실제 운용 수익률이 아닙니다.",
      en: "An estimated public portfolio of NPS domestic equities tracked from DART major-shareholding filings. Not total NPS assets, real account balances, or actual returns.",
    },
  },
  {
    q: { ko: "추정 금액은 어떻게 계산되나요?", en: "How is the estimated value calculated?" },
    a: {
      ko: "추정 평가금액 = 공시에서 확인한 평가 가능한 보유수량 × 해당 거래일의 검증된 KRX 정규장 종가이며, 추적 범위 내 비중 = 해당 금액 ÷ 같은 통화·범위·거래일의 평가 가능 금액 합계 × 100입니다.",
      en: "Estimated value = priced filed quantity × the verified KRX regular-session close on that trade date; in-scope weight = that value ÷ the priced total in the same currency, scope, and trade date × 100.",
    },
  },
  {
    q: {
      ko: "가격 기준일과 공시 확인 시점은 어떻게 다른가요?",
      en: "How do the price date and the filings check differ?",
    },
    a: {
      ko: "가격 기준일(valuationTradeDate)은 종가가 확정된 실제 거래일이고, 공시 확인·데이터 생성·게시 시각은 각각 따로 표시됩니다. 셋을 하나의 ‘최신’으로 뭉뚱그리지 않습니다.",
      en: "The valuation trade date is the actual trading day whose close is final; the filings check, generation, and publish times are shown separately, never merged into one “latest”.",
    },
  },
  {
    q: {
      ko: "일부 종목이 평가에서 제외되는 이유는 무엇인가요?",
      en: "Why are some securities excluded from valuation?",
    },
    a: {
      ko: "검증된 종가가 없거나 최신 공시가 미확인인 종목은 평가에서 제외되지만, 추적 목록에는 사유와 함께 유지됩니다. 금액이 없는 경우 0원이 아닌 ‘평가 불가’로 표시합니다.",
      en: "Securities without a verified close or with an unverified latest filing stay on the tracked list with their reason but are excluded from valuation, shown as unavailable rather than zero.",
    },
  },
  {
    q: {
      ko: "지분율 5% 미만은 전부 매도한 것인가요?",
      en: "Does below 5% ownership mean everything was sold?",
    },
    a: {
      ko: "아닙니다. 최신 공시 5% 미만은 추적 범위 이탈이지 전량 매도로 해석하지 않습니다.",
      en: "No. A latest filing below 5% is a tracking-scope exit, not evidence of a full sale.",
    },
  },
  {
    q: { ko: "새로고침(다시 조회)은 무엇을 하나요?", en: "What does refresh do?" },
    a: {
      ko: "같은 사이트에 게시된 정적 데이터를 다시 조회할 뿐, DART 수집 배치를 실행하지 않습니다.",
      en: "It only re-fetches this site's published static data; it never runs a DART collection batch.",
    },
  },
];
