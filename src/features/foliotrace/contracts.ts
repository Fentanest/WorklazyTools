/**
 * Public FolioTrace snapshot contract, revision 2 (docs/foliotrace-public-snapshot-contract.md).
 * The wire `schemaVersion` and the data URL stay at 1: revision 2 only relaxes `Holding.receiptNo`
 * to nullable and adds the optional `Holding.sourceKind`, so revision-1 snapshots still load.
 * Decimal quantities and money are strings.
 */
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

/** General source wording only. Internal tool, model and runtime names must never be added here. */
export type SourceKind = 'year-end-list' | 'nps-filing' | 'issuer-report' | 'disclosure-text-read'

/** Corporate-action kinds a quantity ratio adjustment may cite. */
export type QuantityAdjustmentKind = 'bonus-issue' | 'stock-split' | 'reverse-split' | 'capital-reduction' | 'spin-off' | 'stock-dividend'

/**
 * Optional ratio adjustment: `holding.quantity` (used for valuation) = reportedQuantity x ratioNumerator / ratioDenominator, floored.
 * Integer strings only. Estimates from filings, not reported figures.
 */
export interface QuantityAdjustment {
  reportedQuantity: string
  ratioNumerator: string
  ratioDenominator: string
  events: Array<{
    receiptNo: string
    kind: QuantityAdjustmentKind
    priceChangeDate: IsoDate
    quantityChangeDate: IsoDate | null
  }>
}

export interface Holding {
  corpCode: string
  stockCode: string
  name: string
  securityKind: 'common' | 'preferred' | 'other' | 'unknown'
  quantity: DecimalString | null
  companyOwnershipPercent: DecimalString | null
  ownershipNumericKind?: 'exact' | 'lower_bound' | 'upper_bound' | 'estimated' | null
  observationStatus?: 'verified' | 'verified_scoped' | 'same_basis_conflict' | null
  /** Null for year-end list rows, which have no DART receipt. The all-zero 14-digit placeholder of early dry-runs is treated the same. */
  receiptNo: string | null
  receiptDate: IsoDate
  holdingDate: IsoDate | null
  /** Absent in revision-1 snapshots. Shown in the row details only. */
  sourceKind?: SourceKind
  /** Absent or null when the quantity is the reported one. */
  quantityAdjustment?: QuantityAdjustment | null
  evidence: 'legacy-import' | 'dart-structured' | 'dart-document' | 'unresolved-latest' | 'indirect-observation' | 'issuer-scope-observation'
  indirectSource?: {
    documentNo: string | null
    sourceSha256: string
    basisDate: IsoDate
    directReceiptNo: string | null
    ratioDenominator: string
  } | null
  issuerScopeSource?: {
    observationKey: string
    sourceQuantity: DecimalString
    denominatorQuantity: DecimalString
    denominatorDate: IsoDate
    referenceCount: number
    laterChangeDate: IsoDate | null
    receiptNo: string
    documentNo: string | null
  } | null
  directBaseline?: {
    receiptNo: string
    receiptDate: IsoDate
    holdingDate: IsoDate | null
    ownershipPercent: DecimalString | null
    quantity: DecimalString | null
  } | null
  issuerScopeConflict?: boolean
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
  kind: 'increase' | 'decrease' | 'new-report' | 'purpose-change' | 'tracking-exit' | 'tracking-reentry' | 'unquantified-change' | 'other'
  correctionOf: string | null
  /** Absent in older snapshots; null when the receipt flags cannot be verified. */
  isCorrectionOrWithdrawal?: boolean | null
  quantity: DecimalString | null
  companyOwnershipPercent: DecimalString | null
  numericKind?: 'exact' | 'lower_bound' | 'upper_bound' | 'estimated'
  percentagePointChange?: DecimalString | null
  source: 'legacy-import' | 'dart-structured' | 'dart-document' | 'indirect-observation' | 'issuer-scope-observation'
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
    priorQ1CheckedThrough?: IsoDate | null
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
    documentNo: string | null
    sourceRowSha256: string
    ratioDenominator: 'unverified' | 'issued_shares'
    denominatorQuantity?: DecimalString | null
    denominatorDate?: IsoDate | null
    status: 'historical_only_ratio_basis_unverified' | 'historical_only_denominator_date_unverified'
    filingUrl: string
  }>
  issuerScopeObservations?: Array<{
    observationKey: string
    corpCode: string
    stockCode: string
    issuerName: string
    basisDate: IsoDate
    ownershipPercent: DecimalString
    sourceQuantity: DecimalString
    denominatorQuantity: DecimalString
    denominatorDate: IsoDate
    securityKind: 'unclassified'
    ratioDenominator: 'issued_shares'
    holderScope: 'nps_only'
    status: 'comparison_pending' | 'same_basis_conflict' | 'direct_basis_unverified'
    references: Array<{
      receiptNo: string
      documentNo: string | null
      filingDate: IsoDate
      archiveSha256: string
      fileSha256: string
      rowSha256: string
      parserVersion: string
      filingUrl: string
    }>
  }>
  issuerScopeLaterChanges?: Array<{
    corpCode: string
    basisDate: IsoDate
    kind: 'nps_share_decrease_amount_unreported'
    references: Array<{ receiptNo: string; filingUrl: string }>
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
