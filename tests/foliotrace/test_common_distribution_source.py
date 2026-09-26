import io
import unittest
import zipfile
from datetime import date

from scripts.foliotrace import folio, secondary, target_source
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

    def test_class_date_denominator_and_ratio_must_all_agree(self):
        for changed in ({'preferred': '1'}, {'issued_date': '2025년 11월 30일'},
                        {'register_date': '2025년 12월 30일'},
                        {'note_denominator': '310,327,034'},
                        {'ratio': '8.63'}, {'quantity': '*****'}):
            with self.subTest(changed=changed):
                self.assertFalse(any(
                    claim['structure'] == 'dated_share_distribution_all_common'
                    for claim in secondary.extract_source_claims(report_xml(**changed))))


if __name__ == '__main__':
    unittest.main()
