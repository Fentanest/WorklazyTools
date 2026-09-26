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
function str(value: unknown): value is string { return typeof value === 'string' }
function nullable(value: unknown, check: (value: unknown) => boolean): boolean { return value === null || check(value) }
function decimal(value: unknown): boolean { return str(value) && DECIMAL.test(value) }
function isoDate(value: unknown): boolean { return str(value) && ISO_DATE.test(value) }
function timestamp(value: unknown): boolean { return str(value) && Number.isFinite(Date.parse(value)) }
function filingUrl(value: unknown): boolean { return str(value) && FILING_URL.test(value) }
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
    str(value.receiptNo) && RECEIPT.test(value.receiptNo) && isoDate(value.receiptDate) &&
    nullable(value.holdingDate, isoDate) &&
    ['legacy-import', 'dart-structured', 'dart-document', 'unresolved-latest'].includes(String(value.evidence)) &&
    nullable(value.latestUnresolvedReceiptNo, (item) => str(item) && RECEIPT.test(item)) &&
    nullable(value.latestUnresolvedReason, str) &&
    ['active', 'below-5-percent', 'unknown'].includes(String(value.tracking)) &&
    nullable(value.quote, validQuote) && nullable(value.estimatedValue, decimal) &&
    nullable(value.portfolioWeightPercent, decimal) && nullable(value.valuationExclusionReason, str) &&
    nullable(value.filingUrl, filingUrl)
}
function validEvent(value: unknown): boolean {
  return isRecord(value) && str(value.receiptNo) && RECEIPT.test(value.receiptNo) && isoDate(value.receiptDate) &&
    str(value.corpCode) && /^\d{8}$/.test(value.corpCode) && nullable(value.stockCode, x => str(x) && STOCK.test(x)) &&
    ['increase', 'decrease', 'new-report', 'purpose-change', 'tracking-exit', 'other'].includes(String(value.kind)) &&
    nullable(value.correctionOf, x => str(x) && RECEIPT.test(x)) && nullable(value.quantity, decimal) &&
    nullable(value.companyOwnershipPercent, decimal) && ['legacy-import', 'dart-structured', 'dart-document'].includes(String(value.source)) &&
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
