import assert from 'node:assert/strict'
import test from 'node:test'
import { validSnapshot } from '../../src/features/foliotrace/data/loadSnapshot.ts'

const version = 'a'.repeat(64)
const base = {
  schemaVersion: 1, datasetVersion: version,
  portfolio: { id: 'nps', entityId: 'nps', market: 'KRX', currency: 'KRW', scopeKo: '범위', scopeEn: 'Scope', methodologyVersion: '1', legacyCoverage: 'unverified' },
  entity: { id: 'nps', kind: 'institution', nameKo: '국민연금', nameEn: 'NPS', officialId: null, source: 'OpenDART' },
  valuationTradeDate: '2026-09-23', filingsCheckedAt: '2026-09-26T00:00:00Z', generatedAt: '2026-09-26T00:00:00Z',
  publishedAt: '2026-09-26T00:00:00Z', latestReceiptDate: '2026-09-23', trackedCount: 1, pricedCount: 1, unresolvedCount: 0,
  estimatedValue: '123.45', valuationCoverage: 'complete', filingCoverage: 'complete',
  holdings: [{ corpCode: '00101488', stockCode: '009450', name: '종목', securityKind: 'common', quantity: '1',
    companyOwnershipPercent: '5.0', receiptNo: '20260923000001', receiptDate: '2026-09-23', holdingDate: null,
    evidence: 'dart-document', tracking: 'active', quote: { close: '123.45', currency: 'KRW', market: 'KRX',
      session: 'regular', tradeDate: '2026-09-23', adjusted: false, provider: 'naver', observedAt: '2026-09-26T00:00:00Z', verified: true },
    estimatedValue: '123.45', portfolioWeightPercent: '100', valuationExclusionReason: null,
    filingUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260923000001' }],
  events: [{ receiptNo: '20260923000001', receiptDate: '2026-09-23', corpCode: '00101488', stockCode: '009450', kind: 'new-report',
    correctionOf: null, quantity: '1', companyOwnershipPercent: '5.0', source: 'dart-document', filingUrl: null }],
  history: [{ tradeDate: '2026-09-22', estimatedValue: '100', datasetVersion: 'b'.repeat(64) }],
}

test('FolioTrace validates nested quote, event, history, and filing links', () => {
  assert.equal(validSnapshot(base, version), true)
  assert.equal(validSnapshot({ ...base, holdings: [{ ...base.holdings[0], quote: { ...base.holdings[0].quote, close: {} } }] }, version), false)
  assert.equal(validSnapshot({ ...base, holdings: [{ ...base.holdings[0], filingUrl: 'javascript:alert(1)' }] }, version), false)
  assert.equal(validSnapshot({ ...base, events: [{ ...base.events[0], receiptDate: null }] }, version), false)
  assert.equal(validSnapshot({ ...base, history: [{ ...base.history[0], estimatedValue: null }] }, version), false)
})
