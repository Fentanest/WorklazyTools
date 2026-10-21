import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import reference from '../../src/features/foliotrace/data/delistedReference.json' with { type: 'json' }

test('delisted reference lists only displayable rows with DART links, sorted by date then name', () => {
  assert.equal(reference.schemaVersion, 1)
  assert.equal(reference.items.length, 13)
  assert.ok(!reference.items.some((item) => item.nameKo === 'MTRON'))
  for (const item of reference.items) {
    assert.match(item.stockCode, /^[0-9A-Z]{6}$/)
    assert.match(item.holdingShares2025ye, /^\d+$/)
    assert.ok(item.nameEn.length > 0 && item.reasonKo.length > 0 && item.reasonEn.length > 0)
    assert.match(item.sourceUrl, /^https:\/\/dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=\d{14}$/)
    assert.ok(item.delistedDate === null || /^\d{4}-\d{2}-\d{2}$/.test(item.delistedDate))
  }
  const dated = reference.items.filter((item) => item.delistedDate !== null)
  const keys = dated.map((item) => `${item.delistedDate}|${item.nameKo}`)
  assert.deepEqual(keys, [...keys].sort())
  const pending = reference.items.filter((item) => item.delistedDate === null)
  assert.deepEqual(pending.map((item) => item.status), ['DELISTING_DECIDED_PENDING'])
  assert.equal(reference.items.at(-1)?.delistedDate, null)
  assert.equal(reference.items.find((item) => item.nameKo === '푸른소나무')?.nameEn, '푸른소나무')
})

test('FolioTrace page renders the delisted reference as the last section with both languages', () => {
  const page = fs.readFileSync('src/features/foliotrace/ui/FolioTracePage.tsx', 'utf8')
  assert.match(page, /delistedReference from "\.\.\/data\/delistedReference\.json"/)
  assert.match(page, /참고: 2025년 말 보유 후 상장폐지된 종목 \(\{count\}종목\)/)
  assert.match(page, /Reference: stocks held at end-2025 and later delisted \(\{count\}\)/)
  assert.ok(page.indexOf('foliotrace-delisted"') > page.indexOf('foliotrace-faq"'))
  assert.ok(page.indexOf('foliotrace-delisted"') < page.indexOf('<Sheet open='))
})
