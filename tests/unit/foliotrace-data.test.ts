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
    evidence: 'dart-document', latestUnresolvedReceiptNo: null, latestUnresolvedReason: null, tracking: 'active', quote: { close: '123.45', currency: 'KRW', market: 'KRX',
      session: 'regular', tradeDate: '2026-09-23', adjusted: false, provider: 'naver', observedAt: '2026-09-26T00:00:00Z', verified: true },
    estimatedValue: '123.45', portfolioWeightPercent: '100', valuationExclusionReason: null,
    filingUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260923000001' }],
  events: [{ receiptNo: '20260923000001', receiptDate: '2026-09-23', corpCode: '00101488', stockCode: '009450', kind: 'new-report',
    correctionOf: null, quantity: '1', companyOwnershipPercent: '5.0', source: 'dart-document', filingUrl: null }],
  history: [{ tradeDate: '2026-09-22', estimatedValue: '100', datasetVersion: 'b'.repeat(64) }],
}

test('FolioTrace validates nested quote, event, history, and filing links', () => {
  assert.equal(validSnapshot(base, version), true)
  const historicalCoverage = { searchStartDate: '1999-01-01', searchTargetDate: '2026-09-08',
    listingCompleteThrough: '2000-01-01', listingComplete: false,
    firstObservedNpsReceiptDate: '1999-10-01', parsingPendingCount: 2, legacySourceRecheckCount: 3 }
  assert.equal(validSnapshot({ ...base, historicalCoverage }, version), true)
  assert.equal(validSnapshot({ ...base, historicalCoverage: { ...historicalCoverage, parsingPendingCount: -1 } }, version), false)
  assert.equal(validSnapshot({ ...base, historicalCoverage: { ...historicalCoverage, listingComplete: true } }, version), false)
  assert.equal(validSnapshot({ ...base, historicalCoverage: { ...historicalCoverage, firstObservedNpsReceiptDate: '2026-09-23' } }, version), false)
  assert.equal(validSnapshot({ ...base, holdings: [{ ...base.holdings[0], quote: { ...base.holdings[0].quote, close: {} } }] }, version), false)
  assert.equal(validSnapshot({ ...base, holdings: [{ ...base.holdings[0], filingUrl: 'javascript:alert(1)' }] }, version), false)
  assert.equal(validSnapshot({ ...base, events: [{ ...base.events[0], receiptDate: null }] }, version), false)
  assert.equal(validSnapshot({ ...base, history: [{ ...base.history[0], estimatedValue: null }] }, version), false)
})

test('receipt-only indirect observation and its event load together', () => {
  const receiptNo = '20260602000001'
  const observationKey = `${receiptNo}:-:00101488:009450:2026-06-01:${'c'.repeat(64)}`
  const filingUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}`
  const observation = {
    observationKey, corpCode: '00101488', stockCode: '009450', ownershipPercent: '5.05',
    numericKind: 'exact', basisDate: '2026-06-01', filingDate: '2026-06-02', receiptNo,
    documentNo: null, sourceSha256: 'd'.repeat(64), filingUrl, appliedToHolding: true,
    reason: null, percentagePointChange: '0.25', trackingChange: 'tracking-reentry',
  }
  const event = {
    receiptNo, receiptDate: '2026-06-02', basisDate: '2026-06-01', observationKey,
    corpCode: '00101488', stockCode: '009450', kind: 'tracking-reentry', correctionOf: null,
    quantity: null, companyOwnershipPercent: '5.05', numericKind: 'exact',
    percentagePointChange: '0.25', source: 'indirect-observation', filingUrl,
  }
  assert.equal(validSnapshot({ ...base, events: [event], verifiedIndirectObservations: [observation] }, version), true)
  assert.equal(validSnapshot({ ...base, events: [{ ...event, observationKey: observationKey.replace(':-:', ':bad:') }],
    verifiedIndirectObservations: [observation] }, version), false)
})

test('issuer-level dated observation keeps the direct baseline separate', () => {
  const receiptNo = '20251114002334'
  const reference = { receiptNo, documentNo: null, filingDate: '2025-11-14',
    archiveSha256: 'b'.repeat(64), fileSha256: 'c'.repeat(64), rowSha256: 'd'.repeat(64),
    parserVersion: 'source-issued-shares-v5',
    filingUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}` }
  const scoped = { observationKey: 'e'.repeat(64), corpCode: '00244455', stockCode: '033780',
    issuerName: '케이티앤지', basisDate: '2025-08-22', ownershipPercent: '8.16',
    sourceQuantity: '9954722', denominatorQuantity: '122062497', denominatorDate: '2025-08-22',
    securityKind: 'unclassified', ratioDenominator: 'issued_shares', holderScope: 'nps_only',
    status: 'comparison_pending', references: [reference] }
  const holding = { ...base.holdings[0], corpCode: '00244455', stockCode: '033780',
    securityKind: 'unknown', quantity: null, companyOwnershipPercent: '8.16',
    receiptNo, receiptDate: '2025-11-14', holdingDate: '2025-08-22',
    evidence: 'issuer-scope-observation', quote: null, estimatedValue: null,
    portfolioWeightPercent: null, valuationExclusionReason: 'security_mapping_unverified',
    issuerScopeSource: { observationKey: scoped.observationKey, sourceQuantity: scoped.sourceQuantity,
      denominatorQuantity: scoped.denominatorQuantity, denominatorDate: scoped.denominatorDate,
      referenceCount: 1, laterChangeDate: '2025-12-31', receiptNo, documentNo: null },
    directBaseline: { receiptNo: '20250401003742', receiptDate: '2025-04-01',
      holdingDate: null, ownershipPercent: '7.5', quantity: '9157340' } }
  const later = { corpCode: '00244455', basisDate: '2025-12-31',
    kind: 'nps_share_decrease_amount_unreported',
    references: [{ receiptNo: '20260515002914',
      filingUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260515002914' }] }
  const laterEvent = { receiptNo: '20260515002914', receiptDate: '2026-05-15',
    basisDate: '2025-12-31', corpCode: '00244455', stockCode: null,
    kind: 'unquantified-change', correctionOf: null, quantity: null,
    companyOwnershipPercent: null, source: 'issuer-scope-observation',
    filingUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260515002914' }
  assert.equal(validSnapshot({ ...base, holdings: [holding], issuerScopeObservations: [scoped],
    issuerScopeLaterChanges: [later], events: [laterEvent] }, version), true)
  assert.equal(validSnapshot({ ...base, holdings: [holding], issuerScopeObservations: [
    { ...scoped, references: [{ ...reference, filingUrl: 'javascript:bad()' }] }] }, version), false)
})
