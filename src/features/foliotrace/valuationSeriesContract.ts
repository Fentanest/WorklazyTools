// F6 valuationSeries contract. Existing Snapshot.history remains unchanged.
export type ReconstructedValuationPoint = {
  tradeDate: string
  estimatedValue: string | null
  kind: 'reconstructed'
  reconstructed: true
  methodologyVersion: '2'
  calculationPolicyRevision: string
  datasetVersion: null
  holdingsAssemblyDate: string
  knowledgeCutoff: string
  quantityOrigin: 'stored-assembly' | 'ledger-yearend-assembly'
  trackedCount: number
  pricedCount: number
  unvaluedCount: number
  valuationCoverage: 'complete' | 'partial' | 'unavailable'
  exclusionCounts: Record<string, number>
  quantityContentSha256: string
  priceContentSha256: string
}

export type ReconstructedValuationSeries = {
  schemaVersion: 1
  seriesId: string
  portfolioId: 'nps-kr-disclosed'
  scopeId: string
  currency: 'KRW'
  methodologyVersion: '2'
  calculationPolicyRevision: string
  knowledgePolicy: 'ledger-known-by-trade-date-retrospective-cache'
  priceBasis: 'krx-official-unadjusted-close'
  generatedAt: string
  limitations: string[]
  points: ReconstructedValuationPoint[]
}

// Proposed additive property: valuationSeries?: ReconstructedValuationSeries
// Absence: use existing history. Present but invalid: reject the extension;
// never silently convert its points into published history or hide its origin.
