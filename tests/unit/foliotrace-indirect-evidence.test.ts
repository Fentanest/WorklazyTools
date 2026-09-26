import assert from 'node:assert/strict'
import test from 'node:test'

import evidence from '../../src/features/foliotrace/data/indirectEvidence.json' with { type: 'json' }

test('third-party DART clue stays separate from direct NPS holdings', () => {
  assert.equal(evidence.schemaVersion, 1)
  assert.equal(evidence.scope, 'third-party-filing-mentions')
  assert.equal(evidence.items.length, 2)
  for (const item of evidence.items) {
    assert.equal(item.quantity, null)
    assert.match(item.sourceUrl, /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}&dcmNo=\d+$/)
    assert.match(item.sourceSectionSha256, /^[a-f0-9]{64}$/)
    assert.notEqual(item.filer, item.mentionedEntity)
  }
  const proxy = evidence.items.find((item) => item.receiptNo === '20060208000020')
  assert.equal(proxy?.relationship, 'proxy-solicitation-target-shareholder')
  assert.equal(proxy?.filer, '주식회사 포스코')
  assert.equal(proxy?.securityKind, '보통주')
  assert.equal(proxy?.statedOwnershipPercent, null)
  assert.equal(proxy?.quantity, null)
  const reporter = evidence.items.find((item) => item.receiptNo === '20081007000308')
  assert.equal(reporter?.relationship, 'largest-shareholder-of-filer')
  assert.equal(reporter?.filer, 'KB금융지주')
  assert.equal(reporter?.statedOwnershipPercent, '5.03')
  assert.equal(reporter?.securityKind, null)
})
