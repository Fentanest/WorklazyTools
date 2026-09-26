import copy
import io
import unittest
import zipfile
from datetime import date

from scripts.foliotrace import folio, secondary, target_source
from pipeline.foliotrace.indirect import register_evidence
from pipeline.foliotrace.publish import make_snapshot


def report_xml(*, preferred='-', issued_date='2025년 12월 31일',
               register_date='2025년 12월 31일', quantity='26,755,051',
               ratio='8.62', note_denominator='310,327,033'):
    def row(*cells):
        return '<TR>' + ''.join(f'<TD>{cell}</TD>' for cell in cells) + '</TR>'
    return (
        '<DOC><P>4. 주식의 총수 등</P><P>가. 주식의 총수 현황</P><TABLE>' +
        row('(기준일 :', issued_date, ')', '(단위 : 주, %)') +
        row('구 분', '주식의 종류', '비고') +
        row('보통주식', '종류주식', '합계') +
        row('Ⅳ. 발행주식의 총수 (Ⅱ-Ⅲ)', '310,327,033', preferred,
            '310,327,033' if preferred == '-' else '310,327,034', '-') +
        '</TABLE><P>3. 주식의 분포</P><P>가. 주식 소유현황</P><TABLE>' +
        row('(기준일 :', register_date, ')', '(단위 : 주)') +
        row('구분', '주주명', '소유주식수', '지분율(%)', '비고') +
        row('5% 이상 주주', '다른 주주', '33,562,072', '10.82', '-') +
        row('국민연금공단', quantity, ratio, '-') +
        row('주) 2025년 12월말 주주명부를 기준으로 작성하였으며, '
            f'지분율은 발행주식총수 {note_denominator}주에 대한 비율임') +
        '</TABLE></DOC>')


def zipped(xml):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        archive.writestr('report.xml', xml)
    return output.getvalue()


class CommonDistributionSourceTests(unittest.TestCase):
    def test_production_direct_scope_then_later_verified_common_value_is_current_without_false_delta(self):
        state = folio.empty_state()
        corp, stock = '00858364', '138930'
        direct, source = '20250301000001', '20260318001147'
        state['universe'][corp] = {'name': 'BNK금융지주', 'stock_code': stock}
        state['receipts'][direct] = {'receipt_no': direct, 'receipt_date': '2025-03-01',
            'holding_date': '2025-02-28',
            'corp_code': corp, 'stock_code': stock, 'quantity': '48',
            'company_ownership_percent': '4.80', 'evidence': 'dart_document'}
        state['holdings'][corp] = {'corp_code': corp, 'stock_code': stock,
            'name': 'BNK금융지주', 'receipt_no': direct, 'receipt_date': '2025-03-01',
            'holding_date': '2025-02-28', 'quantity': '48',
            'company_ownership_percent': '4.80', 'security_kind': 'common',
            'tracking': 'below-5-percent', 'evidence': 'dart_document'}
        state['mapping_ledger'][direct] = {'status': 'verified', 'xml_sha256': 'a' * 64}
        parsed = {'xml_sha256': 'a' * 64, 'basis_row_sha256': 'b' * 64,
            'source_ratio_columns': {'shares_etc_quantity': '48', 'shares_etc_percent': '4.80',
                'stock_quantity': '48', 'stock_percent': '4.80',
                'issued_voting_shares': '1000', 'reporting_count': '1'}}
        self.assertTrue(folio.register_verified_direct_profile(state, state['receipts'][direct], parsed))
        self.assertEqual(state['direct_ratio_basis'][direct]['ratio_denominator'], 'voting_rights')
        self.assertEqual(state['direct_ratio_basis'][direct]['holder_scope'], 'nps_reporting_group')
        for prior_no, filed, basis, quantity, ratio in (
                ('20250107000001', '2025-01-07', '2025-01-06', '68', '6.80'),
                ('20250207000001', '2025-02-07', '2025-02-06', '78', '7.80')):
            state['receipts'][prior_no] = {**state['receipts'][direct], 'receipt_no': prior_no,
                'receipt_date': filed, 'holding_date': basis, 'quantity': quantity,
                'company_ownership_percent': ratio}
            state['mapping_ledger'][prior_no] = {'status': 'verified', 'xml_sha256': 'a' * 64}
            prior_parsed = copy.deepcopy(parsed)
            prior_parsed['source_ratio_columns']['shares_etc_quantity'] = quantity
            prior_parsed['source_ratio_columns']['shares_etc_percent'] = ratio
            prior_parsed['source_ratio_columns']['stock_quantity'] = quantity
            prior_parsed['source_ratio_columns']['stock_percent'] = ratio
            self.assertTrue(folio.register_verified_direct_profile(state, state['receipts'][prior_no], prior_parsed))
        listing = {'status': '000', 'page_no': '1', 'page_count': '100',
                   'total_count': '1', 'total_page': '1',
                   'list': [{'rcept_no': source, 'rcept_dt': '20260318',
                             'corp_code': corp, 'corp_name': 'BNK금융지주',
                             'stock_code': stock, 'report_nm': '사업보고서 (2025.12)', 'rm': ''}]}
        result = target_source.ingest_target(state, source, corp, date(2026, 3, 18), '',
            fetch_list=lambda _: listing,
            fetch_document=lambda _: zipped(report_xml(quantity='15,671,515', ratio='5.05')))
        self.assertEqual((result['source_claims'], result['facts_changed']), (1, 1))
        observation = next(iter(state['indirect_observations'].values()))
        self.assertEqual((observation['ratio_denominator'], observation['holder_scope']),
                         ('issued_shares', 'nps_only'))
        snap = make_snapshot(state, {stock: {'verified': True, 'trade_date': '2026-03-18',
            'market': 'KRX', 'session': 'regular', 'currency': 'KRW', 'adjusted': False,
            'close': '10000', 'observed_at': '2026-03-18T16:35:00+09:00'}})
        holding = snap['holdings'][0]
        self.assertEqual((holding['companyOwnershipPercent'], holding['tracking'],
                          holding['observationStatus']), ('5.05', 'active', 'verified_scoped'))
        self.assertEqual((holding['holdingDate'], holding['receiptNo']), ('2025-12-31', source))
        self.assertEqual(holding['directBaseline']['ownershipPercent'], '4.80')
        self.assertIsNone(holding['quantity'])
        self.assertEqual(holding['quote']['close'], '10000')
        self.assertIsNone(holding['estimatedValue'])
        self.assertEqual(holding['valuationExclusionReason'], 'scope_comparison_unverified')
        self.assertEqual((snap['verifiedIndirectObservations'][0]['appliedToHolding'],
                          snap['verifiedIndirectObservations'][0]['percentagePointChange'],
                          snap['verifiedIndirectObservations'][0]['trackingChange']), (True, None, None))
        self.assertFalse(any(event['kind'] == 'tracking-reentry' for event in snap['events']))
        self.assertEqual(state['holdings'][corp]['company_ownership_percent'], '4.80')

        ratio_only = copy.deepcopy(state)
        ratio_only['indirect_observations'] = {}
        ratio_fact = copy.deepcopy(observation)
        ratio_fact['quantity'] = None
        self.assertTrue(register_evidence(ratio_only, ratio_fact)['changed'])
        ratio_row = make_snapshot(ratio_only, {})['holdings'][0]
        self.assertEqual((ratio_row['companyOwnershipPercent'], ratio_row['tracking'],
                          ratio_row['observationStatus']), ('5.05', 'active', 'verified_scoped'))
        self.assertIsNone(ratio_row['quantity'])
        self.assertIsNone(ratio_row['estimatedValue'])

        multiple_units = copy.deepcopy(state)
        older_group = copy.deepcopy(observation)
        older_group.update(source_receipt_no='20260317000001', source_filing_date='2026-03-17',
            basis_date='2025-09-30', denominator_date='2025-09-30',
            source_row_sha256='d' * 64, source_section_sha256='d' * 64,
            holder_scope='nps_reporting_group', ratio_denominator='voting_rights',
            denominator_quantity='1000', quantity='51', ownership_percent='5.10')
        self.assertTrue(register_evidence(multiple_units, older_group)['changed'])
        self.assertEqual(make_snapshot(multiple_units, {})['holdings'][0]['companyOwnershipPercent'], '5.05')
        multiple_units['indirect_observations'] = dict(reversed(list(multiple_units['indirect_observations'].items())))
        self.assertEqual(make_snapshot(multiple_units, {})['holdings'][0]['companyOwnershipPercent'], '5.05')

        later_direct = copy.deepcopy(state)
        later_direct['holdings'][corp]['receipt_date'] = '2026-01-01'
        late_filing_old_basis = make_snapshot(later_direct, {})
        self.assertEqual(late_filing_old_basis['holdings'][0]['companyOwnershipPercent'], '5.05')

        later_direct['holdings'][corp]['holding_date'] = '2026-01-01'
        later_direct['receipts'][direct]['holding_date'] = '2026-01-01'
        later_direct['receipts'][direct]['receipt_date'] = '2026-01-01'
        later_direct['direct_ratio_basis'][direct]['basis_date'] = '2026-01-01'
        held = make_snapshot(later_direct, {})
        self.assertEqual(held['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(held['verifiedIndirectObservations'][0]['reason'], 'basis_not_newer_than_direct')

        withdrawn = copy.deepcopy(state)
        withdrawn['indirect_source_holds'][source] = 'withdrawn'
        held = make_snapshot(withdrawn, {})
        self.assertEqual(held['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertEqual(held['verifiedIndirectObservations'][0]['reason'], 'source_corrected_or_withdrawn')

        weaker = copy.deepcopy(state)
        weaker.setdefault('issuer_scope_observations', {})['later'] = {'corp_code': corp,
            'basis_date': '2026-01-31', 'quantity': '16000000',
            'ownership_percent': '5.16', 'denominator_quantity': '310327033',
            'denominator_date': '2026-01-31', 'stock_code': stock,
            'issuer_name': 'BNK금융지주', 'references': [{'receipt_no': '20260319000001',
                'filing_date': '2026-03-19', 'document_no': None, 'archive_sha256': 'a' * 64,
                'file_sha256': 'b' * 64, 'row_sha256': 'c' * 64,
                'parser_version': 'source-holdings-v1'}]}
        self.assertEqual(make_snapshot(weaker, {})['holdings'][0]['companyOwnershipPercent'], '5.05')

        conflict = copy.deepcopy(state)
        other_source = '20260319000001'
        listing['list'][0].update(rcept_no=other_source, rcept_dt='20260319')
        target_source.ingest_target(conflict, other_source, corp, date(2026, 3, 19), '',
            fetch_list=lambda _: listing,
            fetch_document=lambda _: zipped(report_xml(quantity='16,000,000', ratio='5.16')))
        contested = make_snapshot(conflict, {})
        self.assertIsNone(contested['holdings'][0]['companyOwnershipPercent'])
        self.assertEqual(contested['holdings'][0]['observationStatus'], 'same_basis_conflict')

        legacy_conflict = copy.deepcopy(conflict)
        legacy_conflict['direct_ratio_basis'] = {}
        contested = make_snapshot(legacy_conflict, {})
        self.assertIsNone(contested['holdings'][0]['companyOwnershipPercent'])
        self.assertIsNone(contested['holdings'][0]['estimatedValue'])
        self.assertEqual(contested['holdings'][0]['observationStatus'], 'same_basis_conflict')
        self.assertEqual(contested['holdings'][0]['directBaseline']['ownershipPercent'], '4.80')
        self.assertEqual(contested['holdings'][0]['directBaseline']['holdingDate'], '2025-02-28')
        self.assertIsNone(contested['holdings'][0]['latestUnresolvedReceiptNo'])
        self.assertEqual(contested['holdings'][0]['valuationExclusionReason'], 'same_basis_observation_conflict')
        unknown_class_conflict = copy.deepcopy(legacy_conflict)
        unknown_class_conflict['holdings'][corp]['security_kind'] = 'unknown'
        self.assertEqual(make_snapshot(unknown_class_conflict, {})['holdings'][0]['valuationExclusionReason'],
                         'same_basis_observation_conflict')

        older_conflict = copy.deepcopy(legacy_conflict)
        older_conflict['holdings'][corp]['holding_date'] = '2026-01-01'
        older_conflict['holdings'][corp]['receipt_date'] = '2026-01-02'
        older_conflict['receipts'][direct]['holding_date'] = '2026-01-01'
        older_conflict['receipts'][direct]['receipt_date'] = '2026-01-02'
        current = make_snapshot(older_conflict, {})
        self.assertEqual(current['holdings'][0]['companyOwnershipPercent'], '4.80')
        self.assertIsNone(current['holdings'][0]['observationStatus'])
        self.assertTrue(all(item['reason'] == 'same_basis_conflict'
                            for item in current['verifiedIndirectObservations']))

    def test_source_rows_and_official_listing_register_comparable_historical_fact(self):
        state = folio.empty_state()
        corp, stock, no = '00858364', '138930', '20260318001147'
        state['universe'][corp] = {'name': 'BNK금융지주', 'stock_code': stock}
        state['holdings'][corp] = {'corp_code': corp, 'stock_code': stock,
            'name': 'BNK금융지주', 'receipt_no': '20260701000287',
            'receipt_date': '2026-07-01', 'holding_date': None,
            'quantity': '23477020', 'company_ownership_percent': '7.57',
            'security_kind': 'common', 'tracking': 'active', 'evidence': 'legacy_import'}
        listing = {'status': '000', 'page_no': '1', 'page_count': '100',
                   'total_count': '1', 'total_page': '1',
                   'list': [{'rcept_no': no, 'rcept_dt': '20260318',
                             'corp_code': corp, 'corp_name': 'BNK금융지주',
                             'stock_code': stock, 'report_nm': '사업보고서 (2025.12)',
                             'rm': ''}]}
        result = target_source.ingest_target(state, no, corp, date(2026, 3, 18), '',
            fetch_list=lambda _: listing, fetch_document=lambda _: zipped(report_xml()))
        self.assertEqual((result['source_claims'], result['facts_changed']), (1, 1))
        claim = state['target_source_candidates'][no]['source_claims'][0]
        self.assertEqual((claim['basis_date'], claim['quantity'], claim['ownership_percent'],
                          claim['security_kind'], claim['denominator_quantity']),
                         ('2025-12-31', '26755051', '8.62', '보통주', '310327033'))
        self.assertEqual(len(state['indirect_observations']), 1)
        snapshot = make_snapshot(state, {})
        self.assertEqual(snapshot['holdings'][0]['companyOwnershipPercent'], '7.57')
        self.assertEqual(snapshot['verifiedIndirectObservations'][0]['ownershipPercent'], '8.62')

    def test_masked_quantity_with_exact_dated_ratio_retains_ratio_only_current(self):
        state = folio.empty_state()
        corp, stock, source = '00858364', '138930', '20260318001147'
        state['universe'][corp] = {'name': 'BNK금융지주', 'stock_code': stock}
        state['holdings'][corp] = {'corp_code': corp, 'stock_code': stock,
            'name': 'BNK금융지주', 'receipt_no': '20250301000001',
            'receipt_date': '2025-03-01', 'holding_date': '2025-02-28',
            'quantity': '48', 'company_ownership_percent': '4.80',
            'security_kind': 'common', 'tracking': 'below-5-percent', 'evidence': 'dart_document'}
        listing = {'status': '000', 'page_no': '1', 'page_count': '100',
            'total_count': '1', 'total_page': '1', 'list': [{'rcept_no': source,
                'rcept_dt': '20260318', 'corp_code': corp, 'corp_name': 'BNK금융지주',
                'stock_code': stock, 'report_nm': '사업보고서 (2025.12)', 'rm': ''}]}
        result = target_source.ingest_target(state, source, corp, date(2026, 3, 18), '',
            fetch_list=lambda _: listing,
            fetch_document=lambda _: zipped(report_xml(quantity='*****', ratio='5.05')))
        self.assertEqual((result['source_claims'], result['facts_changed']), (1, 1))
        fact = next(iter(state['indirect_observations'].values()))
        self.assertIsNone(fact['quantity'])
        self.assertEqual((fact['denominator_date'], fact['denominator_quantity']),
                         ('2025-12-31', '310327033'))
        row = make_snapshot(state, {})['holdings'][0]
        self.assertEqual((row['companyOwnershipPercent'], row['tracking'],
                          row['observationStatus']), ('5.05', 'active', 'verified_scoped'))
        self.assertIsNone(row['quantity'])
        self.assertIsNone(row['estimatedValue'])

    def test_class_date_denominator_and_ratio_must_all_agree(self):
        for changed in ({'preferred': '1'}, {'issued_date': '2025년 11월 30일'},
                        {'register_date': '2025년 12월 30일'},
                        {'note_denominator': '310,327,034'},
                        {'ratio': '8.63'}, {'quantity': '-'}):
            with self.subTest(changed=changed):
                self.assertFalse(any(
                    claim['structure'] == 'dated_share_distribution_all_common'
                    for claim in secondary.extract_source_claims(report_xml(**changed))))


if __name__ == '__main__':
    unittest.main()
