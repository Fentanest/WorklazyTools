import type { FolioTraceView, Snapshot } from '../contracts'

const DATA_ROOT = '/data/foliotrace/v1/'
const VERSION = /^[a-f0-9]{64}$/

interface Manifest {
  schemaVersion: 1
  datasetVersion: string
  snapshotPath: string
  snapshotSha256: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const RECEIPT = /^\d{14}$/
const STOCK = /^[0-9A-Z]{6}$/
const FILING_URL = /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/
const OBSERVATION_KEY = /^\d{14}:(?:\d+|-):\d{8}:[0-9A-Z]{6}:\d{4}-\d{2}-\d{2}:[a-f0-9]{64}$/
function str(value: unknown): value is string { return typeof value === 'string' }
function nullable(value: unknown, check: (value: unknown) => boolean): boolean { return value === null || check(value) }
function decimal(value: unknown): boolean { return str(value) && DECIMAL.test(value) }
function isoDate(value: unknown): boolean { return str(value) && ISO_DATE.test(value) }
function timestamp(value: unknown): boolean { return str(value) && Number.isFinite(Date.parse(value)) }
function filingUrl(value: unknown): boolean { return str(value) && FILING_URL.test(value) }
function numericKind(value: unknown): boolean {
  return value === 'exact' || value === 'lower_bound' || value === 'upper_bound' || value === 'estimated'
}
function validIndirectSource(value: unknown): boolean {
  return isRecord(value) && nullable(value.documentNo, item => str(item) && /^\d+$/.test(item)) &&
    str(value.sourceSha256) && VERSION.test(value.sourceSha256) && isoDate(value.basisDate) &&
    nullable(value.directReceiptNo, item => str(item) && RECEIPT.test(item)) &&
    str(value.ratioDenominator) && ['shares_etc_total', 'issued_shares', 'voting_rights'].includes(value.ratioDenominator)
}
function validIndirectObservation(value: unknown): boolean {
  return isRecord(value) && str(value.observationKey) && OBSERVATION_KEY.test(value.observationKey) &&
    str(value.corpCode) && /^\d{8}$/.test(value.corpCode) && str(value.stockCode) && STOCK.test(value.stockCode) &&
    nullable(value.ownershipPercent, decimal) && isoDate(value.basisDate) && isoDate(value.filingDate) &&
    numericKind(value.numericKind) &&
    str(value.receiptNo) && RECEIPT.test(value.receiptNo) && nullable(value.documentNo, item => str(item) && /^\d+$/.test(item)) &&
    str(value.sourceSha256) && VERSION.test(value.sourceSha256) && filingUrl(value.filingUrl) &&
    typeof value.appliedToHolding === 'boolean' && nullable(value.reason, str) &&
    (value.percentagePointChange === undefined || nullable(value.percentagePointChange, decimal)) &&
    (value.trackingChange === undefined || nullable(value.trackingChange,
      item => item === 'tracking-exit' || item === 'tracking-reentry'))
}
function validHistoricalObservation(value: unknown): boolean {
  return isRecord(value) && str(value.corpCode) && /^\d{8}$/.test(value.corpCode) &&
    str(value.stockCode) && STOCK.test(value.stockCode) && str(value.issuerName) &&
    decimal(value.quantity) && decimal(value.ownershipPercent) &&
    isoDate(value.basisDate) && isoDate(value.filingDate) &&
    str(value.receiptNo) && RECEIPT.test(value.receiptNo) &&
    str(value.documentNo) && /^\d+$/.test(value.documentNo) &&
    str(value.sourceRowSha256) && VERSION.test(value.sourceRowSha256) &&
    ((value.ratioDenominator === 'unverified' && value.status === 'historical_only_ratio_basis_unverified') ||
      (value.ratioDenominator === 'issued_shares' && value.status === 'historical_only_denominator_date_unverified')) &&
    (value.denominatorQuantity === undefined || nullable(value.denominatorQuantity, decimal)) &&
    (value.denominatorDate === undefined || nullable(value.denominatorDate, isoDate)) && filingUrl(value.filingUrl)
}
function validQuote(value: unknown): boolean {
  return isRecord(value) && decimal(value.close) && value.currency === 'KRW' && value.market === 'KRX' &&
    value.session === 'regular' && isoDate(value.tradeDate) && value.adjusted === false &&
    value.provider === 'naver' && timestamp(value.observedAt) && value.verified === true
}
function validHolding(value: unknown): boolean {
  return isRecord(value) && str(value.corpCode) && /^\d{8}$/.test(value.corpCode) &&
    str(value.stockCode) && STOCK.test(value.stockCode) && str(value.name) &&
    ['common', 'preferred', 'other', 'unknown'].includes(String(value.securityKind)) &&
    nullable(value.quantity, decimal) && nullable(value.companyOwnershipPercent, decimal) &&
    (value.ownershipNumericKind === undefined || nullable(value.ownershipNumericKind, numericKind)) &&
    (value.observationStatus === undefined || nullable(value.observationStatus,
      item => item === 'verified' || item === 'same_basis_conflict')) &&
    str(value.receiptNo) && RECEIPT.test(value.receiptNo) && isoDate(value.receiptDate) &&
    nullable(value.holdingDate, isoDate) &&
    ['legacy-import', 'dart-structured', 'dart-document', 'unresolved-latest', 'indirect-observation'].includes(String(value.evidence)) &&
    (value.indirectSource === undefined || nullable(value.indirectSource, validIndirectSource)) &&
    nullable(value.latestUnresolvedReceiptNo, (item) => str(item) && RECEIPT.test(item)) &&
    nullable(value.latestUnresolvedReason, str) &&
    ['active', 'below-5-percent', 'unknown'].includes(String(value.tracking)) &&
    nullable(value.quote, validQuote) && nullable(value.estimatedValue, decimal) &&
    nullable(value.portfolioWeightPercent, decimal) && nullable(value.valuationExclusionReason, str) &&
    nullable(value.filingUrl, filingUrl)
}
function validEvent(value: unknown): boolean {
  return isRecord(value) && str(value.receiptNo) && RECEIPT.test(value.receiptNo) && isoDate(value.receiptDate) &&
    (value.basisDate === undefined || nullable(value.basisDate, isoDate)) &&
    (value.observationKey === undefined || (str(value.observationKey) &&
      OBSERVATION_KEY.test(value.observationKey))) &&
    str(value.corpCode) && /^\d{8}$/.test(value.corpCode) && nullable(value.stockCode, x => str(x) && STOCK.test(x)) &&
    ['increase', 'decrease', 'new-report', 'purpose-change', 'tracking-exit', 'tracking-reentry', 'other'].includes(String(value.kind)) &&
    nullable(value.correctionOf, x => str(x) && RECEIPT.test(x)) && nullable(value.quantity, decimal) &&
    nullable(value.companyOwnershipPercent, decimal) && ['legacy-import', 'dart-structured', 'dart-document', 'indirect-observation'].includes(String(value.source)) &&
    (value.numericKind === undefined || numericKind(value.numericKind)) &&
    (value.percentagePointChange === undefined || nullable(value.percentagePointChange, decimal)) &&
    nullable(value.filingUrl, filingUrl)
}

function validHistoricalCoverage(value: unknown): boolean {
  if (!isRecord(value) || typeof value.searchStartDate !== 'string' ||
    typeof value.searchTargetDate !== 'string' || typeof value.listingCompleteThrough !== 'string' ||
    (value.firstObservedNpsReceiptDate !== null && typeof value.firstObservedNpsReceiptDate !== 'string')) return false
  return isoDate(value.searchStartDate) && isoDate(value.searchTargetDate) &&
    isoDate(value.listingCompleteThrough) && typeof value.listingComplete === 'boolean' &&
    nullable(value.firstObservedNpsReceiptDate, isoDate) &&
    Number.isSafeInteger(value.parsingPendingCount) && Number(value.parsingPendingCount) >= 0 &&
    Number.isSafeInteger(value.legacySourceRecheckCount) && Number(value.legacySourceRecheckCount) >= 0 &&
    value.searchStartDate <= value.listingCompleteThrough &&
    value.listingCompleteThrough <= value.searchTargetDate &&
    (value.firstObservedNpsReceiptDate === null ||
      (value.searchStartDate <= value.firstObservedNpsReceiptDate && value.firstObservedNpsReceiptDate <= value.listingCompleteThrough)) &&
    value.listingComplete === (value.listingCompleteThrough === value.searchTargetDate)
}

function validSecondaryCoverage(value: unknown): boolean {
  if (!isRecord(value) || !str(value.searchStartDate) || !str(value.searchTargetDate) ||
      !isoDate(value.searchStartDate) || !isoDate(value.searchTargetDate)) return false
  const target = value.searchTargetDate
  const checked = [value.priorContentCheckedThrough, value.priorEquityCheckedThrough,
    value.allContentCheckedThrough, value.equityContentCheckedThrough,
    value.earlyDirectCheckedThrough]
  return checked.every((date) => date === null || (str(date) && isoDate(date) && date <= target)) &&
    nullable(value.priorContentCheckedThrough, isoDate) &&
    nullable(value.priorEquityCheckedThrough, isoDate) &&
    nullable(value.allContentCheckedThrough, isoDate) &&
    nullable(value.equityContentCheckedThrough, isoDate) &&
    nullable(value.earlyDirectCheckedThrough, isoDate) &&
    Number.isSafeInteger(value.candidateDocumentCount) && Number(value.candidateDocumentCount) >= 0 &&
    Number.isSafeInteger(value.noncandidateUnreviewedCount) && Number(value.noncandidateUnreviewedCount) >= 0 &&
    Number.isSafeInteger(value.sourceContextReviewCount) && Number(value.sourceContextReviewCount) >= 0 &&
    Number.isSafeInteger(value.sourceReviewPendingCount) && Number(value.sourceReviewPendingCount) >= 0 &&
    value.searchStartDate <= value.searchTargetDate
}

function validManifest(value: unknown): value is Manifest {
  return isRecord(value) && value.schemaVersion === 1 &&
    typeof value.datasetVersion === 'string' && VERSION.test(value.datasetVersion) &&
    typeof value.snapshotPath === 'string' &&
    value.snapshotPath === `snapshots/${value.datasetVersion}.json` &&
    typeof value.snapshotSha256 === 'string' && VERSION.test(value.snapshotSha256)
}

export function validSnapshot(value: unknown, version: string): value is Snapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.datasetVersion !== version) return false
  if (!isRecord(value.portfolio) || !isRecord(value.entity)) return false
  if (!str(value.portfolio.id) || !str(value.portfolio.entityId) || value.portfolio.market !== 'KRX' ||
    value.portfolio.currency !== 'KRW' || !str(value.portfolio.scopeKo) || !str(value.portfolio.scopeEn) ||
    !str(value.portfolio.methodologyVersion) || !['verified', 'partial', 'unverified'].includes(String(value.portfolio.legacyCoverage))) return false
  if (!str(value.entity.id) || !['institution', 'manager', 'person'].includes(String(value.entity.kind)) ||
    !str(value.entity.nameKo) || !str(value.entity.nameEn) || !nullable(value.entity.officialId, str) || !str(value.entity.source)) return false
  if (!nullable(value.valuationTradeDate, isoDate) || !nullable(value.filingsCheckedAt, timestamp) ||
    !timestamp(value.generatedAt) || !nullable(value.publishedAt, timestamp) || !nullable(value.latestReceiptDate, isoDate) ||
    !Array.isArray(value.holdings) || !Array.isArray(value.events) || !Array.isArray(value.history) ||
    !nullable(value.estimatedValue, decimal)) return false
  if (!Number.isSafeInteger(value.trackedCount) || !Number.isSafeInteger(value.pricedCount) || !Number.isSafeInteger(value.unresolvedCount)) return false
  if (!['complete', 'partial', 'unavailable'].includes(String(value.valuationCoverage))) return false
  if (!['complete', 'partial', 'unverified'].includes(String(value.filingCoverage))) return false
  if (value.historicalCoverage !== undefined && !validHistoricalCoverage(value.historicalCoverage)) return false
  if (value.secondaryCoverage !== undefined && !validSecondaryCoverage(value.secondaryCoverage)) return false
  if (value.verifiedIndirectObservations !== undefined &&
      (!Array.isArray(value.verifiedIndirectObservations) || !value.verifiedIndirectObservations.every(validIndirectObservation))) return false
  if (value.historicalObservations !== undefined &&
      (!Array.isArray(value.historicalObservations) || !value.historicalObservations.every(validHistoricalObservation))) return false
  return value.holdings.every(validHolding) && value.events.every(validEvent) && value.history.every((row: unknown) =>
    isRecord(row) && isoDate(row.tradeDate) && decimal(row.estimatedValue) && str(row.datasetVersion) && VERSION.test(row.datasetVersion))
}

async function digestHex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function loadFolioTraceSnapshot(signal?: AbortSignal): Promise<FolioTraceView> {
  try {
    const manifestResponse = await fetch(`${DATA_ROOT}manifest.json`, { cache: 'no-store', signal })
    if (manifestResponse.status === 404) return { status: 'missing-import' }
    if (!manifestResponse.ok) return { status: 'load-error' }
    const manifest: unknown = await manifestResponse.json()
    if (!validManifest(manifest)) return { status: 'schema-error' }

    const response = await fetch(`${DATA_ROOT}${manifest.snapshotPath}`, { cache: 'no-store', signal })
    if (!response.ok) return { status: 'load-error' }
    const payload = await response.arrayBuffer()
    if (await digestHex(payload) !== manifest.snapshotSha256) return { status: 'schema-error' }
    const snapshot: unknown = JSON.parse(new TextDecoder().decode(payload))
    if (!validSnapshot(snapshot, manifest.datasetVersion)) return { status: 'schema-error' }
    const freshnessAt = Date.parse(snapshot.publishedAt ?? snapshot.generatedAt)
    const stale = !Number.isFinite(freshnessAt) || Date.now() - freshnessAt > 3 * 24 * 60 * 60 * 1000
    return { status: 'ready', snapshot, stale }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return { status: 'load-error' }
  }
}
