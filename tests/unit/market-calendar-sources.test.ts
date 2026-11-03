import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { citedArticles, fallbackRule, isKrxRule, loadSourceExcerpts, validCatalog } from '../../src/features/market-calendar/sourceExcerpts.ts'

const catalog = { schema_version: 1, generation_id: 'fixture', sources: [{
  id: 'krx-rule-210025251', bookid: '210025251', title: fallbackRule('krx-rule-210025251')!.title,
  fetched_at: '2026-11-03T01:00:00Z', raw_sha256: 'a'.repeat(64), text_sha256: 'b'.repeat(64),
  representation: 'session_redacted', excerpts: [{ article: '제4조(test)', text: '제4조(test)\nSynthetic saved citation.' }],
}] }
test('KRX identification uses the actual host and keeps article labels from citations', () => {
  assert.equal(isKrxRule('https://rule.krx.co.kr/out/regulation/regulationViewPop.do'), true)
  assert.equal(isKrxRule('https://kind.krx.co.kr/external/example.htm'), false)
  assert.equal(isKrxRule('https://rule.krx.co.kr.attacker.invalid/'), false)
  assert.deepEqual(citedArticles(['제4조(test) details', '제4조(test)', '[revision]']), ['제4조(test)'])
})
test('optional catalog rejects a different generation and wrong book identity', () => {
  assert.equal(validCatalog(catalog, 'fixture'), true)
  assert.equal(validCatalog(catalog, 'other'), false)
  assert.equal(validCatalog({ ...catalog, sources: [{ ...catalog.sources[0], bookid: '123' }] }, 'fixture'), false)
})
test('missing or corrupt optional provenance leaves the calendar reader independent', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('', { status: 404 })
    assert.equal(await loadSourceExcerpts('/', 'fixture'), null)
    const raw = JSON.stringify(catalog)
    globalThis.fetch = async input => new Response(String(input).endsWith('.sha256') ? '0'.repeat(64) : raw)
    assert.equal(await loadSourceExcerpts('/', 'fixture'), null)
    const bytes = new TextEncoder().encode(raw)
    const digest = await webcrypto.subtle.digest('SHA-256', bytes)
    const checksum = Buffer.from(digest).toString('hex')
    globalThis.fetch = async input => new Response(String(input).endsWith('.sha256') ? checksum : raw)
    assert.deepEqual(await loadSourceExcerpts('/', 'fixture'), catalog)
  } finally { globalThis.fetch = original }
})
