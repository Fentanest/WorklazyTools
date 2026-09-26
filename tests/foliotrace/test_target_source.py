import io
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path

from scripts.foliotrace import folio, target_source
from pipeline.foliotrace.publish import make_snapshot


def source_archive(later=False):
    xml = ('<DOC>다. 최대주주의 변동<TABLE><TR>'
           '<TH>변동일</TH><TH>최대주주명</TH><TH>소유주식수</TH><TH>지분율</TH><TH>비고</TH></TR>'
           '<TR><TD>2025년 08월 22일</TD><TD>국민연금공단</TD><TD>9,954,722</TD>'
           '<TD>8.16</TD><TD>변동일은 2025.08.22 기준일 주주명부 기준</TD></TR>'
           '<TR><TD>2025년 12월 31일</TD><TD>중소기업은행</TD><TD>9,510,485</TD>'
           '<TD>8.06</TD><TD>' +
           ('변경 전 최대주주인 국민연금공단의 소유주식수 감소로 인한 최대주주 변경'
            if later else '다른 주주') +
           '</TD>' + ('<TD>변동일은 2025.12.31 기준일 주주명부 기준</TD>' if later else '') +
           '</TR></TABLE>'
           '※ 상기 지분율은 각각 변동일 당시 발행주식총수를 기준으로 산정하였으며, '
           '해당 기준 주식수는 2025년 8월 22일 122,062,497주, '
           '2025년 12월 31일 117,976,645주임.</DOC>')
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        archive.writestr('filing.xml', xml)
    return output.getvalue()


class TargetSourceTests(unittest.TestCase):
    def test_official_listing_to_document_to_scoped_main_and_withdrawal(self):
        state = folio.empty_state()
        state['universe']['00244455'] = {'name': '케이티앤지', 'stock_code': '033780'}
        state['receipts']['20250401003742'] = {'receipt_no': '20250401003742',
            'receipt_date': '2025-04-01', 'corp_code': '00244455', 'stock_code': '033780'}
        state['holdings']['00244455'] = {'corp_code': '00244455', 'stock_code': '033780',
            'name': '케이티앤지', 'receipt_no': '20250401003742',
            'receipt_date': '2025-04-01', 'holding_date': None, 'quantity': '9157340',
            'company_ownership_percent': '7.5', 'security_kind': 'unknown',
            'tracking': 'unknown', 'evidence': 'legacy_import'}
        payload = source_archive()
        later_payload = source_archive(later=True)
        calls = []
        def listed(receipt, day, rm=''):
            period = '2025.09' if day.startswith('2025') else '2026.03'
            return {'status': '000', 'page_no': '1', 'page_count': '100',
                    'total_count': '1', 'total_page': '1',
                    'list': [{'rcept_no': receipt, 'rcept_dt': day.replace('-', ''),
                              'corp_code': '00244455', 'corp_name': '케이티앤지',
                              'stock_code': '033780', 'report_nm': f'분기보고서 ({period})', 'rm': rm}]}
        def fetch_document(no):
            calls.append(no)
            return later_payload if no.startswith('202605') else payload
        with tempfile.TemporaryDirectory() as directory:
            archive_dir = Path(directory)
            for receipt, day in [('20251114002334', '2025-11-14'),
                                 ('20260515002914', '2026-05-15')]:
                result = target_source.ingest_target(state, receipt, '00244455',
                    date.fromisoformat(day), '', archive_dir=archive_dir,
                    fetch_list=lambda _, no=receipt, filed=day: listed(no, filed),
                    fetch_document=fetch_document)
                self.assertEqual(result['source_claims'], 2 if receipt.startswith('202605') else 1)
            self.assertEqual(len(list(archive_dir.glob('*.zip'))), 2)
            state['secondary_source_cache']['20251114002334']['parser_version'] = 'older-parser'
            replay = target_source.ingest_target(state, '20251114002334', '00244455',
                date(2025, 11, 14), '', archive_dir=archive_dir,
                fetch_list=lambda _: listed('20251114002334', '2025-11-14'),
                fetch_document=fetch_document)
            self.assertEqual((replay['raw_archive_cache_hits'], replay['source_requests']), (1, 0))
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(state['issuer_scope_observations']), 1)
        snapshot = make_snapshot(state, {})
        self.assertEqual(snapshot['holdings'][0]['companyOwnershipPercent'], '8.16')
        self.assertEqual(snapshot['holdings'][0]['directBaseline']['ownershipPercent'], '7.5')
        self.assertIsNone(snapshot['holdings'][0]['estimatedValue'])
        self.assertEqual(snapshot['holdings'][0]['issuerScopeSource']['referenceCount'], 2)
        self.assertEqual(snapshot['holdings'][0]['issuerScopeSource']['laterChangeDate'], '2025-12-31')
        self.assertEqual(snapshot['holdings'][0]['tracking'], 'unknown')
        self.assertEqual(len(snapshot['issuerScopeLaterChanges']), 1)
        self.assertEqual(snapshot['events'], [])
        # A separately filed correction with no explicit target link holds
        # only the matching report period, not the earlier Q3 citation.
        correction = {'status': '000', 'page_no': '1', 'page_count': '100',
            'total_count': '1', 'total_page': '1',
            'list': [{'rcept_no': '20260516000001', 'rcept_dt': '20260516',
                'corp_code': '00244455', 'corp_name': '케이티앤지', 'stock_code': '033780',
                'report_nm': '정정 분기보고서 (2026.03)', 'rm': '정'}]}
        target_source.ingest_target(state, '20260516000001', '00244455',
            date(2026, 5, 16), '', fetch_list=lambda _: correction,
            fetch_document=fetch_document)
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['issuerScopeSource']['referenceCount'], 1)
        target_source.ingest_target(state, '20251114002334', '00244455',
            date(2025, 11, 14), '',
            fetch_list=lambda _: listed('20251114002334', '2025-11-14', '철'),
            fetch_document=fetch_document)
        self.assertEqual(len(calls), 3)
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['companyOwnershipPercent'], '7.5')
        target_source.ingest_target(state, '20260515002914', '00244455',
            date(2026, 5, 15), '',
            fetch_list=lambda _: listed('20260515002914', '2026-05-15', '철'),
            fetch_document=fetch_document)
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['companyOwnershipPercent'], '7.5')


if __name__ == '__main__':
    unittest.main()
