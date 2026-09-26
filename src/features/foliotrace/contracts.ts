/** Public FolioTrace v1 values. Decimal quantities and money are strings. */
export type DecimalString = string
export type IsoDate = string

export interface Entity {
  id: string
  kind: 'institution' | 'manager' | 'person'
  nameKo: string
  nameEn: string
  officialId: string | null
  source: string
}

export interface Portfolio {
  id: string
  entityId: string
  market: 'KRX'
  currency: 'KRW'
  scopeKo: string
  scopeEn: string
  methodologyVersion: string
  legacyCoverage: 'verified' | 'partial' | 'unverified'
}

export interface Quote {
  close: DecimalString
  currency: 'KRW'
  market: 'KRX'
  session: 'regular'
  tradeDate: IsoDate
  adjusted: boolean | null
  provider: 'naver'
  observedAt: string
  verified: true
}

export interface Holding {
  corpCode: string
  stockCode: string
  name: string
  securityKind: 'common' | 'preferred' | 'other' | 'unknown'
  quantity: DecimalString | null
  companyOwnershipPercent: DecimalString | null
  ownershipNumericKind?: 'exact' | 'lower_bound' | 'upper_bound' | 'estimated' | null
  observationStatus?: 'verified' | 'same_basis_conflict' | null
  receiptNo: string
  receiptDate: IsoDate
  holdingDate: IsoDate | null
  evidence: 'legacy-import' | 'dart-structured' | 'dart-document' | 'unresolved-latest' | 'indirect-observation'
  indirectSource?: {
    documentNo: string | null
    sourceSha256: string
    basisDate: IsoDate
    directReceiptNo: string | null
    ratioDenominator: string
  } | null
  latestUnresolvedReceiptNo: string | null
  latestUnresolvedReason: string | null
  tracking: 'active' | 'below-5-percent' | 'unknown'
  quote: Quote | null
  estimatedValue: DecimalString | null
  portfolioWeightPercent: DecimalString | null
  valuationExclusionReason: string | null
  filingUrl: string | null
}

export interface FilingEvent {
  observationKey?: string
  receiptNo: string
  receiptDate: IsoDate
  basisDate?: IsoDate | null
  corpCode: string
  stockCode: string | null
  kind: 'increase' | 'decrease' | 'new-report' | 'purpose-change' | 'tracking-exit' | 'tracking-reentry' | 'other'
  correctionOf: string | null
  quantity: DecimalString | null
  companyOwnershipPercent: DecimalString | null
  numericKind?: 'exact' | 'lower_bound' | 'upper_bound' | 'estimated'
  percentagePointChange?: DecimalString | null
  source: 'legacy-import' | 'dart-structured' | 'dart-document' | 'indirect-observation'
  filingUrl: string | null
}

export interface Snapshot {
  schemaVersion: 1
  datasetVersion: string
  portfolio: Portfolio
  entity: Entity
  valuationTradeDate: IsoDate | null
  filingsCheckedAt: string | null
  generatedAt: string
  publishedAt: string | null
  latestReceiptDate: IsoDate | null
  trackedCount: number
  pricedCount: number
  unresolvedCount: number
  estimatedValue: DecimalString | null
  valuationCoverage: 'complete' | 'partial' | 'unavailable'
  filingCoverage: 'complete' | 'partial' | 'unverified'
  historicalCoverage?: {
    searchStartDate: IsoDate
    searchTargetDate: IsoDate
    listingCompleteThrough: IsoDate
    listingComplete: boolean
    firstObservedNpsReceiptDate: IsoDate | null
    parsingPendingCount: number
    legacySourceRecheckCount: number
  }
  secondaryCoverage?: {
    searchStartDate: IsoDate
    searchTargetDate: IsoDate
    priorContentCheckedThrough: IsoDate | null
    priorEquityCheckedThrough: IsoDate | null
    allContentCheckedThrough: IsoDate | null
    equityContentCheckedThrough: IsoDate | null
    earlyDirectCheckedThrough: IsoDate | null
    candidateDocumentCount: number
    noncandidateUnreviewedCount: number
    sourceContextReviewCount: number
    sourceReviewPendingCount: number
  }
  holdings: Holding[]
  events: FilingEvent[]
  verifiedIndirectObservations?: Array<{
    observationKey: string
    corpCode: string
    stockCode: string
    ownershipPercent: DecimalString | null
    numericKind: 'exact' | 'lower_bound' | 'upper_bound' | 'estimated'
    basisDate: IsoDate
    filingDate: IsoDate
    receiptNo: string
    documentNo: string | null
    sourceSha256: string
    filingUrl: string
    appliedToHolding: boolean
    reason: string | null
    percentagePointChange?: DecimalString | null
    trackingChange?: 'tracking-exit' | 'tracking-reentry' | null
  }>
  historicalObservations?: Array<{
    corpCode: string
    stockCode: string
    issuerName: string
    quantity: DecimalString
    ownershipPercent: DecimalString
    basisDate: IsoDate
    filingDate: IsoDate
    receiptNo: string
    documentNo: string
    sourceRowSha256: string
    ratioDenominator: 'unverified' | 'issued_shares'
    denominatorQuantity?: DecimalString | null
    denominatorDate?: IsoDate | null
    status: 'historical_only_ratio_basis_unverified' | 'historical_only_denominator_date_unverified'
    filingUrl: string
  }>
  history: Array<{ tradeDate: IsoDate; estimatedValue: DecimalString; datasetVersion: string }>
}

export type FolioTraceView =
  | { status: 'ready'; snapshot: Snapshot; stale: boolean }
  | { status: 'loading' | 'missing-import' | 'load-error' | 'schema-error'; message?: string }

/** Muse owns this component and its scoped styles. Sol owns the data loader. */
export interface FolioTracePageProps {
  lang: 'ko' | 'en'
  view: FolioTraceView
  onRefresh: () => void
}
