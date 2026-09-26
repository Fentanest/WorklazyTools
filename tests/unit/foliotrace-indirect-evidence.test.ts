import assert from 'node:assert/strict'
import test from 'node:test'

import evidence from '../../src/features/foliotrace/data/indirectEvidence.json' with { type: 'json' }

test('third-party DART clue stays separate from direct NPS holdings', () => {
  assert.equal(evidence.schemaVersion, 1)
  assert.equal(evidence.scope, 'source-checked-third-party-filing-samples')
  assert.equal(evidence.items.length, 9)
  for (const item of evidence.items) {
    assert.ok(item.descriptionKo.length > 30)
    assert.ok(item.descriptionEn.length > 30)
    assert.match(item.sourceUrl, /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}&dcmNo=\d+$/)
    assert.match(item.sourceSectionSha256, /^[a-f0-9]{64}$/)
    assert.ok(item.facts.length > 0)
    for (const fact of item.facts) {
      assert.equal(fact.quantity === null || /^\d+$/.test(fact.quantity), true)
      assert.equal(fact.ownershipPercent === null || /^\d+(?:\.\d+)?$/.test(fact.ownershipPercent), true)
    }
  }
  const proxy = evidence.items.find((item) => item.receiptNo === '20060208000020')
  assert.equal(proxy?.relationship, 'proxy-solicitation-target-shareholder')
  assert.equal(proxy?.filer, '주식회사 포스코')
  assert.equal(proxy?.facts[0].securityKind, 'common')
  assert.equal(proxy?.facts[0].quantity, null)
  assert.equal(proxy?.sourceConflict, 'search-index-quantity-masked-in-viewer')
  const reporter = evidence.items.find((item) => item.receiptNo === '20081007000308')
  assert.equal(reporter?.relationship, 'largest-shareholder-of-filer')
  assert.equal(reporter?.filer, 'KB금융지주')
  assert.equal(reporter?.facts[0].issuer, 'KB금융지주')
  assert.equal(reporter?.facts[0].ownershipPercent, '5.03')
  assert.equal(reporter?.facts[0].quantity, null)
  const exchange = evidence.items.find((item) => item.receiptNo === '20081007000289')
  assert.deepEqual(exchange?.facts.map((fact) => [fact.issuer, fact.quantity, fact.ownershipPercent]), [
    ['국민은행', '17910781', '5.32'], ['KB금융지주', '17910781', '5.03'],
  ])
  const poscoSale = evidence.items.find((item) => item.receiptNo === '20060124800040')
  assert.equal(poscoSale?.referencedPriorReportDate, '2005-01-25')
  assert.deepEqual(poscoSale?.facts.map((fact) => fact.quantity), ['3084186', '2407509'])
  const allotment = evidence.items.find((item) => item.receiptNo === '20000420000129')
  assert.equal(allotment?.relationship, 'planned-third-party-allotment-unconfirmed')
  assert.equal(allotment?.facts[0].stage, 'planned-allotment-not-confirmed-holding')
  const sbs = evidence.items.find((item) => item.receiptNo === '20050131000208')
  assert.equal(sbs?.facts[0].quantity, null)
})
