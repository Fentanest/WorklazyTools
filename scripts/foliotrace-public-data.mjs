// Shared helpers for the committed FolioTrace public data (public/data/foliotrace/v1) and its static summary.
// Contract: docs/foliotrace-public-snapshot-contract.md. Node >= 22 (--experimental-strip-types for the .ts import).
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { SNAPSHOT_LIMITS, validSnapshot } from '../src/features/foliotrace/data/loadSnapshot.ts'

export const DATA_SUBPATH = 'data/foliotrace/v1'

// Mirrors the producing side's publication gate: nothing private may reach a public file.
const PRIVATE_WORDS = /(?<![a-z])(claude|anthropic|sonnet|opus|haiku|gemini|muse|luna|jev|codex|openai|llm_read|msgbatch|systemd|orchestrator)(?![a-z])/i
const PRIVATE_SUBSTRINGS = ['/home/', '/tmp/', '/mnt/', '/users/', 'c:\\', 'file://', 'foliotrace-runtime', 'crtfc_key', 'api_key', 'apikey',
  'api-key', 'password', 'secret', 'bearer ', '.env', 'x-api-key', 'sk-ant-', '-----begin', 'ghp_', 'github_pat_', '.jsonl']
const KEY_SHAPE = /(?<![0-9a-fA-F])[0-9a-f]{40}(?![0-9a-fA-F])/

/** Returns the list of findings (empty when the text is clean). Findings never echo the matched text. */
export function privateContentFindings(text) {
  const out = []
  const low = text.toLowerCase()
  for (const item of PRIVATE_SUBSTRINGS) if (low.includes(item)) out.push(`substring:${item}`)
  const word = PRIVATE_WORDS.exec(text)
  if (word) out.push(`word:${word[1].toLowerCase()}`)
  if (KEY_SHAPE.test(text)) out.push('shape:40-hex-token')
  return out
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/** Validates the manifest + the single snapshot under `<siteRoot>/data/foliotrace/v1`. Throws on any violation. */
export async function validatePublicData(siteRoot) {
  const root = path.join(siteRoot, DATA_SUBPATH)
  const manifestBytes = await fs.readFile(path.join(root, 'manifest.json'))
  if (manifestBytes.length > SNAPSHOT_LIMITS.maxManifestBytes) throw new Error('manifest too large')
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  const fail = message => { throw new Error(message) }
  if (manifest.schemaVersion !== 1) fail('manifest schemaVersion must be 1')
  if (!/^[a-f0-9]{64}$/.test(manifest.datasetVersion)) fail('manifest datasetVersion invalid')
  if (manifest.snapshotPath !== `snapshots/${manifest.datasetVersion}.json`) fail('manifest snapshotPath mismatch')
  if (!/^[a-f0-9]{64}$/.test(manifest.snapshotSha256)) fail('manifest snapshotSha256 invalid')
  const present = (await fs.readdir(path.join(root, 'snapshots'))).sort()
  if (present.length !== 1 || `snapshots/${present[0]}` !== manifest.snapshotPath) fail('snapshots folder must hold only the manifest snapshot (latest only)')
  const bytes = await fs.readFile(path.join(root, manifest.snapshotPath))
  if (bytes.length > SNAPSHOT_LIMITS.maxSnapshotBytes) fail('snapshot exceeds the size limit')
  if (sha256(bytes) !== manifest.snapshotSha256) fail('snapshot hash does not match the manifest')
  const findings = [...privateContentFindings(manifestBytes.toString('utf8')), ...privateContentFindings(bytes.toString('utf8'))]
  if (findings.length) fail(`private content in public data: ${[...new Set(findings)].join(', ')}`)
  const snapshot = JSON.parse(bytes.toString('utf8'))
  if (!validSnapshot(snapshot, manifest.datasetVersion)) fail('snapshot schema invalid')
  if (snapshot.holdings.length !== snapshot.trackedCount) fail('trackedCount does not match holdings')
  if (snapshot.holdings.filter(row => row.estimatedValue !== null).length !== snapshot.pricedCount) fail('pricedCount does not match holdings')
  if (new Set(snapshot.holdings.map(row => row.stockCode)).size !== snapshot.holdings.length) fail('duplicate stockCode in holdings')
  if (!(snapshot.trackedCount > 0 && snapshot.pricedCount > 0 && snapshot.estimatedValue !== null && snapshot.valuationCoverage !== 'unavailable')) {
    fail('All tracked holdings are unpriced; production snapshot withheld')
  }
  return { manifest, snapshot, bytes: bytes.length }
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Adds the crawlable static summary (value, trade date, top 10 by value) to the built ko/en FolioTrace pages. Idempotent. */
export async function injectStaticSummary(distRoot, snapshot) {
  const version = snapshot.datasetVersion
  for (const lang of ['ko', 'en']) {
    const file = path.join(distRoot, lang, 'tools/foliotrace/index.html')
    let source = await fs.readFile(file, 'utf8')
    if (!source.includes('class="seo-static-fallback"')) throw new Error('FolioTrace static fallback missing')
    source = source.replace(/<section data-foliotrace-dataset='[a-f0-9]{64}'>[\s\S]*?<\/section>(?=<\/main>)/, '')
    const ko = lang === 'ko'
    const unavailable = ko ? '검증된 평가금액 없음' : 'No verified estimate available'
    const rows = snapshot.holdings.filter(h => h.estimatedValue !== null)
      .sort((a, b) => (BigInt(b.estimatedValue.split('.')[0]) > BigInt(a.estimatedValue.split('.')[0]) ? 1 :
        BigInt(b.estimatedValue.split('.')[0]) < BigInt(a.estimatedValue.split('.')[0]) ? -1 : 0)).slice(0, 10)
    const table = rows.length === 0 ? '' :
      `<h2>${ko ? '상위 보유종목' : 'Top holdings'}</h2><table><thead><tr><th>${ko ? '종목' : 'Security'}</th><th>${ko ? '코드' : 'Code'}</th><th>KRW</th></tr></thead><tbody>` +
      rows.map(h => `<tr><th scope='row'>${escapeHtml(h.name)}</th><td>${escapeHtml(h.stockCode)}</td><td>${escapeHtml(h.estimatedValue)}</td></tr>`).join('') + '</tbody></table>'
    const summary = `<section data-foliotrace-dataset='${version}'><h2>${ko ? '추정 평가금액' : 'Estimated value'}</h2>` +
      `<p>${escapeHtml(snapshot.estimatedValue ?? unavailable)}</p><p>${ko ? '평가 기준 거래일' : 'Valuation trade date'}: ${escapeHtml(snapshot.valuationTradeDate ?? unavailable)}</p>${table}</section>`
    if (!source.includes('</main>')) throw new Error('FolioTrace page has no main element')
    await fs.writeFile(file, source.replace('</main>', summary + '</main>'), 'utf8')
  }
}
