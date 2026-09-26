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

function validManifest(value: unknown): value is Manifest {
  return isRecord(value) && value.schemaVersion === 1 &&
    typeof value.datasetVersion === 'string' && VERSION.test(value.datasetVersion) &&
    typeof value.snapshotPath === 'string' &&
    value.snapshotPath === `snapshots/${value.datasetVersion}.json` &&
    typeof value.snapshotSha256 === 'string' && VERSION.test(value.snapshotSha256)
}

function validSnapshot(value: unknown, version: string): value is Snapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.datasetVersion !== version) return false
  if (!isRecord(value.portfolio) || !isRecord(value.entity)) return false
  if (typeof value.generatedAt !== 'string' || !Array.isArray(value.holdings) || !Array.isArray(value.events) || !Array.isArray(value.history)) return false
  if (!Number.isSafeInteger(value.trackedCount) || !Number.isSafeInteger(value.pricedCount) || !Number.isSafeInteger(value.unresolvedCount)) return false
  if (!['complete', 'partial', 'unavailable'].includes(String(value.valuationCoverage))) return false
  if (!['complete', 'partial', 'unverified'].includes(String(value.filingCoverage))) return false
  return value.holdings.every((holding: unknown) => isRecord(holding) && typeof holding.stockCode === 'string' &&
    /^[0-9A-Z]{6}$/.test(holding.stockCode) && typeof holding.receiptNo === 'string' &&
    /^(?:[0-9]{14}|)$/.test(holding.receiptNo) &&
    (holding.estimatedValue === null || typeof holding.estimatedValue === 'string'))
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
    const publishedAt = snapshot.publishedAt ? Date.parse(snapshot.publishedAt) : Number.NaN
    const stale = !Number.isFinite(publishedAt) || Date.now() - publishedAt > 3 * 24 * 60 * 60 * 1000
    return { status: 'ready', snapshot, stale }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return { status: 'load-error' }
  }
}
