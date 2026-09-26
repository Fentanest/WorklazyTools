import copy
import unittest

from scripts.foliotrace import folio
from pipeline.foliotrace.indirect import observation_timeline, reconcile_indirect, register_evidence
from pipeline.foliotrace.publish import make_snapshot

H = 'a' * 64
J = 'b' * 64
CORP = '00126380'
STOCK = '005930'
DIRECT = '20260302000001'
INDIRECT = '20260602000001'


def base_state():
    state = folio.empty_state()
    state['universe'][CORP] = {'corp_code': CORP, 'stock_code': STOCK, 'name': '삼성전자'}
    state['receipts'][DIRECT] = {'receipt_no': DIRECT, 'receipt_date': '2026-03-02',
        'corp_code': CORP, 'stock_code': STOCK, 'quantity': '100',
        'company_ownership_percent': '4.80', 'evidence': 'dart_document'}
    state['holdings'][CORP] = {'corp_code': CORP, 'stock_code': STOCK, 'name': '삼성전자',
        'receipt_no': DIRECT, 'receipt_date': '2026-03-02', 'holding_date': '2026-03-01',
        'quantity': '100', 'company_ownership_percent': '4.80', 'security_kind': 'common',
        'tracking': 'below-5-percent', 'evidence': 'dart_document'}
    return state


def direct_basis():
    return {'kind': 'direct_ratio_basis', 'direct_receipt_no': DIRECT, 'source_document_no': '123',
        'corp_code': CORP, 'stock_code': STOCK, 'security_kind': 'common', 'ratio_denominator': 'shares_etc_total',
        'holder_scope': 'nps_reporting_group', 'basis_date': '2026-03-01',
        'basis_kind': 'explicit_actual_holding', 'source_document_sha256': H,
        'source_section_sha256': J, 'verified_at': '2026-09-27T00:00:00Z'}


def indirect(**overrides):
    fact = {'kind': 'indirect_holding', 'source_receipt_no': INDIRECT, 'source_document_no': '456',
        'source_filing_date': '2026-06-02', 'basis_date': '2026-06-01',
        'corp_code': CORP, 'filer_corp_code': '00126381', 'stock_code': STOCK, 'security_kind': 'common',
        'ownership_percent': '5.05', 'quantity': None, 'numeric_kind': 'exact',
        'source_file_sha256': H, 'source_row_sha256': J, 'source_row_offset': 100,
        'parser_version': 'source-holdings-v1',
        'ratio_denominator': 'shares_etc_total', 'holder_scope': 'nps_reporting_group',
        'owner_identity': 'nps_confirmed', 'basis_kind': 'explicit_actual_holding',
        'source_status': 'no_known_correction_or_withdrawal',
        'source_document_sha256': H, 'source_section_sha256': J,
        'issuer_identity_sha256': H, 'verified_at': '2026-09-27T00:00:00Z'}
    fact.update(overrides)
    return fact


class IndirectObservationTests(unittest.TestCase):
    def setup_with_basis(self):
        state = base_state()
        register_evidence(state, direct_basis())
        return state

    def test_below_five_to_ratio_only_reentry(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect())
        snap = make_snapshot(state, {})
        holding = snap['holdings'][0]
        self.assertEqual((holding['companyOwnershipPercent'], holding['tracking']), ('5.05', 'active'))
        self.assertIsNone(holding['quantity'])
        self.assertIsNone(holding['estimatedValue'])
        self.assertIsNone(holding['portfolioWeightPercent'])
        self.assertEqual(holding['receiptNo'], INDIRECT)
        self.assertEqual(holding['holdingDate'], '2026-06-01')
        self.assertEqual(holding['indirectSource']['directReceiptNo'], DIRECT)
        self.assertEqual(snap['events'][0]['kind'], 'tracking-reentry')
        self.assertEqual(snap['events'][0]['quantity'], None)
        self.assertEqual(len(snap['verifiedIndirectObservations']), 1)
        self.assertTrue(snap['verifiedIndirectObservations'][0]['appliedToHolding'])
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['companyOwnershipPercent'], '5.05')
        self.assertEqual(state['holdings'][CORP]['company_ownership_percent'], '4.80')

    def test_verified_close_remains_visible_when_value_is_excluded(self):
        state = base_state()
        state['holdings'][CORP]['tracking'] = 'active'
        quote = {'verified': True, 'trade_date': '2026-03-02', 'market': 'KRX',
                 'session': 'regular', 'currency': 'KRW', 'adjusted': False,
                 'close': '70000', 'observed_at': '2026-03-02T16:35:00+09:00'}
        row = make_snapshot(state, {STOCK: quote})['holdings'][0]
        self.assertEqual(row['valuationExclusionReason'], 'corporate_action_unverified')
        self.assertEqual(row['quote']['close'], '70000')
        self.assertIsNone(row['estimatedValue'])
        self.assertIsNone(row['portfolioWeightPercent'])

        quote['session'] = 'after-hours'
        row = make_snapshot(state, {STOCK: quote})['holdings'][0]
        self.assertIsNone(row['quote'])
        self.assertIsNone(row['estimatedValue'])

    def test_receipt_only_source_keeps_document_number_unknown(self):
        state = self.setup_with_basis()
        fact = indirect(source_document_no=None)
        result = register_evidence(state, fact)
        self.assertIn(f'{INDIRECT}:-:', result['key'])
        snap = make_snapshot(state, {})
        self.assertIsNone(snap['verifiedIndirectObservations'][0]['documentNo'])
        self.assertIsNone(snap['holdings'][0]['indirectSource']['documentNo'])

    def test_exact_direct_row_derives_comparable_ratio_basis_only_when_math_matches(self):
        state = base_state()
        receipt = state['receipts'][DIRECT]
        receipt.update(quantity='6576661', company_ownership_percent='8.30')
        state['holdings'][CORP].update(quantity='6576661', company_ownership_percent='8.30')
        state['mapping_ledger'][DIRECT] = {'status': 'verified', 'xml_sha256': H}
        columns = {'shares_etc_quantity': '6576661', 'shares_etc_percent': '8.30',
            'reporting_count': '1', 'stock_quantity': '6576661', 'stock_percent': '8.30',
            'issued_voting_shares': '79241527'}
        source = {'quantity': '6576661', 'company_ownership_percent': '8.30',
            'holding_date': '2026-03-01', 'xml_sha256': H, 'basis_row_sha256': J,
            'source_ratio_columns': columns}
        result = folio.recheck_direct_basis(state, 'test-key', target_receipt=DIRECT,
            fetch=lambda *_: source)
        self.assertEqual(result['verified'], 1)
        profile = state['direct_ratio_basis'][DIRECT]
        self.assertEqual((profile['basis_date'], profile['ratio_denominator'],
            profile['denominator_quantity'], profile['source_document_no']),
            ('2026-03-01', 'voting_rights', '79241527', None))
        self.assertEqual(state['receipts'][DIRECT]['ratio_basis_review_status'],
                         'verified_voting_rights_group')
        prior_profile = dict(profile)
        self.assertEqual(folio.recheck_direct_basis(state, 'test-key', target_receipt=DIRECT,
            fetch=lambda *_: self.fail('unexpected refetch'))['checked'], 0)
        self.assertEqual(state['direct_ratio_basis'][DIRECT], prior_profile)

        other = base_state()
        other['receipts'][DIRECT].update(quantity='6576661', company_ownership_percent='8.30')
        other['holdings'][CORP].update(quantity='6576661', company_ownership_percent='8.30')
        other['mapping_ledger'][DIRECT] = {'status': 'verified', 'xml_sha256': H}
        mismatched = {**source, 'source_ratio_columns': {**columns, 'issued_voting_shares': '80000000'}}
        folio.recheck_direct_basis(other, 'test-key', target_receipt=DIRECT, fetch=lambda *_: mismatched)
        self.assertEqual(other['receipts'][DIRECT]['holding_date'], '2026-03-01')
        self.assertEqual(other['receipts'][DIRECT]['ratio_basis_review_status'], 'ratio_basis_unverified')
        self.assertNotIn(DIRECT, other.get('direct_ratio_basis', {}))

    def test_old_source_value_enters_timeline_without_replacing_new_direct_holding(self):
        state = self.setup_with_basis()
        state['verified_historical_observations'] = {'old': {
            'source_receipt_no': '20060124800040', 'source_filing_date': '2006-02-01',
            'corp_code': CORP, 'stock_code': STOCK, 'security_kind': 'common',
            'holder_scope': 'nps_only', 'ratio_denominator': 'unverified',
            'basis_date': '2006-02-01', 'quantity': '2407509',
            'ownership_percent': '2.76',
            'observation_status': 'historical_only_ratio_basis_unverified'}}
        timeline = observation_timeline(state)
        self.assertEqual(timeline[0]['status'], 'source_values_verified_comparison_pending')
        self.assertIsNone(timeline[0]['percentage_point_change'])
        rows, _, _ = reconcile_indirect(state, list(state['holdings'].values()))
        self.assertEqual(rows[0]['company_ownership_percent'], '4.80')

    def test_past_direct_receipt_gets_own_profile_from_same_document_class_proof(self):
        state = base_state()
        old = '20250110000001'
        state['receipts'][old] = {'receipt_no': old, 'receipt_date': '2025-01-10',
            'corp_code': CORP, 'stock_code': STOCK, 'quantity': '68',
            'company_ownership_percent': '6.80', 'evidence': 'dart_document'}
        parsed = {'quantity': '68', 'company_ownership_percent': '6.80',
            'holding_date': '2025-01-08', 'xml_sha256': H, 'basis_row_sha256': J,
            'verified_common_stock_code': STOCK, 'verified_voting_share_quantity': '68',
            'source_ratio_columns': {'shares_etc_quantity': '68', 'shares_etc_percent': '6.80',
                'reporting_count': '1', 'stock_quantity': '68', 'stock_percent': '6.80',
                'issued_voting_shares': '1000'}}
        result = folio.recheck_direct_basis(state, 'test-key', target_receipt=old,
            fetch=lambda *_: parsed)
        self.assertEqual(result['verified'], 1)
        self.assertEqual(state['direct_ratio_basis'][old]['basis_date'], '2025-01-08')
        self.assertEqual(state['holdings'][CORP]['receipt_no'], DIRECT)

    def test_missing_percentage_stays_visible_and_zero_is_a_known_value(self):
        missing = self.setup_with_basis()
        register_evidence(missing, indirect(ownership_percent=None))
        snap = make_snapshot(missing, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertIsNone(snap['verifiedIndirectObservations'][0]['ownershipPercent'])
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'source_ratio_missing')

        zero = self.setup_with_basis()
        register_evidence(zero, indirect(ownership_percent='0', quantity='0'))
        snap = make_snapshot(zero, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '0')
        self.assertEqual(snap['holdings'][0]['tracking'], 'below-5-percent')
        self.assertIsNone(snap['holdings'][0]['estimatedValue'])

    def test_older_basis_only_later_filing_is_not_applied(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(basis_date='2026-02-01'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'basis_not_newer_than_direct')

    def test_unknown_direct_denominator_preserves_visible_observation(self):
        state = base_state()
        register_evidence(state, indirect())
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'ratio_basis_unverified')

    def test_other_company_observation_cannot_update_current_holding(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(corp_code='00126381', stock_code='000660'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'issuer_identity_unverified')

    def test_planned_allotment_rejected_at_entry(self):
        state = self.setup_with_basis()
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_NOT_ACTUAL_HOLDING'):
            register_evidence(state, indirect(basis_kind='planned_allotment'))
        self.assertEqual(state['indirect_observations'], {})

    def test_newer_direct_receipt_blocks_indirect_overlay(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect())
        state['receipts']['20260603000001'] = {'receipt_no': '20260603000001',
            'receipt_date': '2026-06-03', 'corp_code': CORP, 'stock_code': STOCK,
            'evidence': 'dart_document'}
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'newer_direct_basis_unverified')

    def test_same_day_direct_receipt_blocks_indirect_overlay(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect())
        state['receipts']['20260601000001'] = {'receipt_no': '20260601000001',
            'receipt_date': '2026-06-01', 'corp_code': CORP, 'stock_code': STOCK,
            'evidence': 'dart_document'}
        self.assertEqual(make_snapshot(state, {})['verifiedIndirectObservations'][0]['reason'], 'newer_direct_basis_unverified')

    def test_withdrawal_removes_overlay_without_erasing_source_fact(self):
        state = self.setup_with_basis()
        fact = indirect()
        key = register_evidence(state, fact)['key']
        register_evidence(state, {'kind': 'invalidate_indirect', 'observation_key': key,
            'status': 'withdrawn', 'source_receipt_no': '20260604000001', 'source_document_no': '789',
            'source_document_sha256': H, 'source_section_sha256': J,
            'verified_at': '2026-09-27T00:00:00Z'})
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'source_corrected_or_withdrawn')
        self.assertIn(key, state['indirect_observations'])

    def test_same_basis_disagreement_quarantines_both(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect())
        register_evidence(state, indirect(source_receipt_no='20260602000002', ownership_percent='5.07'))
        snap = make_snapshot(state, {})
        self.assertIsNone(snap['holdings'][0]['companyOwnershipPercent'])
        self.assertIsNone(snap['holdings'][0]['quantity'])
        self.assertEqual([item['reason'] for item in snap['verifiedIndirectObservations']],
                         ['same_basis_conflict', 'same_basis_conflict'])

    def test_newer_observation_supersedes_older_without_duplicate_reentry(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect())
        register_evidence(state, indirect(source_receipt_no='20260702000001',
            source_filing_date='2026-07-02', basis_date='2026-07-01', ownership_percent='5.20'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '5.20')
        self.assertEqual(sum(item['appliedToHolding'] for item in snap['verifiedIndirectObservations']), 1)
        self.assertEqual(len([event for event in snap['events'] if event['kind'] == 'tracking-reentry']), 1)

    def test_ratio_basis_or_security_class_mismatch_rejected(self):
        for override, reason in (({'ratio_denominator': 'voting_rights'}, 'ratio_basis_unverified'),
                                 ({'security_kind': 'preferred'}, 'security_kind_unverified')):
            with self.subTest(override=override):
                state = self.setup_with_basis()
                register_evidence(state, indirect(**override))
                self.assertEqual(make_snapshot(state, {})['verifiedIndirectObservations'][0]['reason'], reason)

    def test_direct_baseline_requires_real_document_number_and_exact_basis(self):
        state = base_state()
        bad = direct_basis(); bad['source_document_no'] = ''
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_SOURCE'):
            register_evidence(state, bad)
        bad = direct_basis(); bad['basis_date'] = '2026-03-03'
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_DIRECT_BASIS'):
            register_evidence(state, bad)

    def test_zero_and_negative_percent_are_distinct(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(ownership_percent='0'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '0')
        self.assertEqual(snap['holdings'][0]['tracking'], 'below-5-percent')
        self.assertIsNone(snap['holdings'][0]['quantity'])
        self.assertTrue(snap['verifiedIndirectObservations'][0]['appliedToHolding'])
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_DECIMAL'):
            register_evidence(state, indirect(source_receipt_no='20260602000002', ownership_percent='-0.1'))

    def test_direct_reentry_kind_uses_explicit_matching_basis(self):
        state = self.setup_with_basis()
        later = '20260702000002'
        state['receipts'][later] = {'receipt_no': later, 'receipt_date': '2026-07-02',
            'corp_code': CORP, 'stock_code': STOCK, 'quantity': '110',
            'company_ownership_percent': '5.05', 'evidence': 'dart_document'}
        state['events'][later] = {'receipt_no': later, 'receipt_date': '2026-07-02',
            'corp_code': CORP, 'stock_code': STOCK, 'quantity': '110',
            'company_ownership_percent': '5.05', 'source': 'dart_document'}
        state['direct_ratio_basis'][later] = {**direct_basis(), 'direct_receipt_no': later,
            'basis_date': '2026-07-01'}
        folio.classify_events(state)
        self.assertEqual(state['events'][later]['kind'], 'tracking-reentry')

    def test_repeated_below_five_direct_is_not_another_exit(self):
        state = self.setup_with_basis()
        first = '20260302000000'
        state['receipts'][first] = {'receipt_no': first, 'receipt_date': '2026-02-28',
            'corp_code': CORP, 'stock_code': STOCK, 'quantity': '102',
            'company_ownership_percent': '4.90', 'evidence': 'dart_document',
            'security_kind': 'common'}
        state['direct_ratio_basis'][first] = {**direct_basis(), 'direct_receipt_no': first,
            'basis_date': '2026-02-27'}
        state['events'][DIRECT] = {'receipt_no': DIRECT, 'receipt_date': '2026-03-02',
            'corp_code': CORP, 'stock_code': STOCK, 'quantity': '100',
            'company_ownership_percent': '4.80', 'source': 'dart_document'}
        folio.classify_events(state)
        self.assertEqual(state['events'][DIRECT]['kind'], 'decrease')

    def test_common_basis_timeline_tracks_direct_exit_then_indirect_reentry(self):
        state = self.setup_with_basis()
        for no, filed, basis, percent in (
                ('20260107000001', '2026-01-07', '2026-01-06', '6.80'),
                ('20260208000001', '2026-02-08', '2026-02-07', '7.80')):
            state['receipts'][no] = {'receipt_no': no, 'receipt_date': filed, 'corp_code': CORP,
                'stock_code': STOCK, 'quantity': '100', 'company_ownership_percent': percent,
                'evidence': 'dart_document', 'security_kind': 'common'}
            state['direct_ratio_basis'][no] = {**direct_basis(), 'direct_receipt_no': no,
                                               'basis_date': basis}
        register_evidence(state, indirect())
        timeline = [item for item in observation_timeline(state) if item['status'] == 'verified']
        self.assertEqual([item['ownership_percent'] for item in timeline],
                         ['6.80', '7.80', '4.80', '5.05'])
        self.assertEqual([item['tracking_change'] for item in timeline],
                         [None, None, 'tracking-exit', 'tracking-reentry'])
        self.assertEqual(timeline[-1]['percentage_point_change'], '0.25')

    def test_direct_current_uses_verified_basis_order_not_receipt_order(self):
        state = self.setup_with_basis()
        newer_basis_older_receipt = '20260301000001'
        state['receipts'][newer_basis_older_receipt] = {
            'receipt_no': newer_basis_older_receipt, 'receipt_date': '2026-03-01',
            'corp_code': CORP, 'stock_code': STOCK, 'quantity': '110',
            'company_ownership_percent': '5.05', 'evidence': 'dart_document',
            'security_kind': 'common'}
        state['direct_ratio_basis'][newer_basis_older_receipt] = {
            **direct_basis(), 'direct_receipt_no': newer_basis_older_receipt,
            'basis_date': '2026-02-28'}
        state['direct_ratio_basis'][DIRECT]['basis_date'] = '2026-02-27'
        snap = make_snapshot(state, {})
        self.assertEqual((snap['holdings'][0]['receiptNo'], snap['holdings'][0]['holdingDate'],
                          snap['holdings'][0]['companyOwnershipPercent']),
                         (newer_basis_older_receipt, '2026-02-28', '5.05'))
        self.assertEqual(state['holdings'][CORP]['receipt_no'], DIRECT)

    def test_common_basis_conflict_quarantines_direct_and_indirect(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(basis_date='2026-03-01', source_filing_date='2026-03-02'))
        timeline = observation_timeline(state)
        self.assertEqual({item['status'] for item in timeline}, {'same_basis_conflict'})
        self.assertTrue(all(item['tracking_change'] is None for item in timeline))

    def test_latest_below_five_observation_supersedes_earlier_reentry(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect())
        register_evidence(state, indirect(source_receipt_no='20260702000001',
            source_filing_date='2026-07-02', basis_date='2026-07-01', ownership_percent='4.80'))
        snap = make_snapshot(state, {})
        self.assertEqual((snap['holdings'][0]['companyOwnershipPercent'], snap['holdings'][0]['tracking']),
                         ('4.80', 'below-5-percent'))
        self.assertEqual([item['appliedToHolding'] for item in snap['verifiedIndirectObservations']], [False, True])
        self.assertEqual(snap['verifiedIndirectObservations'][-1]['trackingChange'], 'tracking-exit')

    def test_lower_bound_is_visible_without_fabricated_exact_change(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(numeric_kind='lower_bound', ownership_percent='5.05'))
        snap = make_snapshot(state, {})
        holding = snap['holdings'][0]
        self.assertEqual((holding['companyOwnershipPercent'], holding['ownershipNumericKind'],
                          holding['tracking']), ('5.05', 'lower_bound', 'active'))
        self.assertIsNone(holding['quantity'])
        self.assertIsNone(holding['estimatedValue'])
        self.assertIsNone(snap['verifiedIndirectObservations'][0]['percentagePointChange'])
        self.assertEqual(snap['verifiedIndirectObservations'][0]['trackingChange'], 'tracking-reentry')
        self.assertEqual(snap['events'][0]['numericKind'], 'lower_bound')

    def test_exact_within_bound_same_basis_uses_more_precise_fact(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(numeric_kind='lower_bound'))
        register_evidence(state, indirect(source_receipt_no='20260602000002'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '5.05')
        self.assertEqual({item['reason'] for item in snap['verifiedIndirectObservations']},
                         {'same_basis_bound_compatible', None})

    def test_compatible_lower_and_upper_bounds_keep_tight_lower_not_conflict(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(numeric_kind='lower_bound', ownership_percent='5.00'))
        register_evidence(state, indirect(source_receipt_no='20260602000002',
                                          numeric_kind='upper_bound', ownership_percent='7.00'))
        snap = make_snapshot(state, {})
        self.assertEqual((snap['holdings'][0]['companyOwnershipPercent'],
                          snap['holdings'][0]['ownershipNumericKind'], snap['holdings'][0]['tracking']),
                         ('5.00', 'lower_bound', 'active'))
        self.assertEqual({item['reason'] for item in snap['verifiedIndirectObservations']},
                         {None, 'same_basis_bound_compatible'})
        self.assertEqual(sum(item['appliedToHolding'] for item in snap['verifiedIndirectObservations']), 1)

    def test_new_issuer_with_different_owner_scopes_is_not_arbitrarily_selected(self):
        state = folio.empty_state()
        state['universe'][CORP] = {'corp_code': CORP, 'stock_code': STOCK, 'name': '삼성전자'}
        register_evidence(state, indirect(holder_scope='nps_only',
                                          basis_date='2026-06-01', ownership_percent='5.05'))
        register_evidence(state, indirect(source_receipt_no='20260702000001',
                                          source_filing_date='2026-07-02', basis_date='2026-01-01',
                                          holder_scope='nps_reporting_group', ownership_percent='8.00'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'], [])
        self.assertEqual(len(snap['verifiedIndirectObservations']), 2)
        self.assertEqual({item['reason'] for item in snap['verifiedIndirectObservations']},
                         {'comparison_scope_unverified'})
        self.assertTrue(all(not item['appliedToHolding'] for item in snap['verifiedIndirectObservations']))

    def test_threshold_straddling_compatible_interval_stays_pending(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(numeric_kind='lower_bound', ownership_percent='4.00'))
        register_evidence(state, indirect(source_receipt_no='20260602000002',
                                          numeric_kind='upper_bound', ownership_percent='7.00'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual({item['reason'] for item in snap['verifiedIndirectObservations']},
                         {'compatible_interval_unresolved'})
        self.assertTrue(all(not item['appliedToHolding'] for item in snap['verifiedIndirectObservations']))

    def test_incompatible_bound_quarantines_same_basis(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(numeric_kind='lower_bound', ownership_percent='6.00'))
        register_evidence(state, indirect(source_receipt_no='20260602000002'))
        snap = make_snapshot(state, {})
        self.assertIsNone(snap['holdings'][0]['companyOwnershipPercent'])
        self.assertEqual({item['reason'] for item in snap['verifiedIndirectObservations']},
                         {'same_basis_conflict'})

    def test_estimate_cannot_replace_verified_direct_or_fact(self):
        state = self.setup_with_basis()
        register_evidence(state, indirect(numeric_kind='estimated'))
        snap = make_snapshot(state, {})
        self.assertEqual(snap['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(snap['verifiedIndirectObservations'][0]['reason'], 'estimate_not_applicable')


if __name__ == '__main__':
    unittest.main()
