import io
import copy
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path

from scripts.foliotrace import folio, secondary, target_source
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
    def test_verified_report_family_retains_corrected_1998_fact_only(self):
        original_no, corrected_no = '19990330000205', '19990611000003'
        state = folio.empty_state()
        state['universe']['00190321'] = {'name': '케이티', 'stock_code': '030200'}
        state['receipts']['20260901000001'] = {'receipt_no': '20260901000001',
            'receipt_date': '2026-09-01', 'corp_code': '00190321', 'stock_code': '030200'}
        state['holdings']['00190321'] = {'corp_code': '00190321', 'stock_code': '030200',
            'name': '케이티', 'receipt_no': '20260901000001', 'receipt_date': '2026-09-01',
            'holding_date': None, 'quantity': '10000000', 'company_ownership_percent': '8.0',
            'security_kind': 'common', 'tracking': 'active', 'evidence': 'legacy_import'}
        def row(*cells):
            return '<TR>' + ''.join(f'<TD>{cell}</TD>' for cell in cells) + '</TR>'
        xml = ('<DOC><P>4. 주식의 총수 등</P>' + row('(1998.12.31. 현재)') +
            row('발행할 주식의 총수', '발행한 주식의 총수', '미발행 주식의 총수') +
            row('1,000,000,000주', '287,917,464주', '712,082,536주') +
            '<P>나. 발행한 주식의 내용</P>' + row('(1998.12.31 현재)') +
            row('구 분', '종 류', '발행주식수', '액면가액총액', '비 고') +
            row('기명식', '보통주', '287,917,464주', '액면가', '') +
            row('합 계', '287,917,464주', '액면가', '') +
            '<P>나. 5%이상 주주의 주식소유 현황</P>' + row('[1998년 12월31일 현재]', '(단위 :주)') +
            '<TABLE>' + row('순 위', '성명(명칭)', '종 류', '주식수', '지분율(%)') +
            row('2', '국민연금관리공단', '보통주', '21,298,820', '7.40') +
            row('우선주', '-', '-') + row('합 계', '21,298,820', '7.40') + '</TABLE></DOC>')
        def archive(text):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as zipped:
                zipped.writestr('filing.xml', text)
            return output.getvalue()
        payload = archive(xml)
        def listed(no, day, report):
            return {'status': '000', 'page_no': '1', 'page_count': '100',
                'total_count': '1', 'total_page': '1', 'list': [{
                    'rcept_no': no, 'rcept_dt': day, 'corp_code': '00190321',
                    'corp_name': '케이티', 'stock_code': '030200',
                    'report_nm': report, 'rm': '정'}]}
        original_list = listed(original_no, '19990330', '사업보고서 (1998.12)')
        corrected_list = listed(corrected_no, '19990611', '[기재정정]사업보고서 (1998.12)')
        family = (f'<script>alertInvestNotice("{corrected_no}", "13413", "{original_no}", "1");'
                  f'</script><select><option value="rcpNo={original_no}" title="사업보고서">원공시</option></select>').encode()
        with tempfile.TemporaryDirectory() as directory:
            archive_dir = Path(directory)
            original = target_source.ingest_target(state, original_no, '00190321',
                date(1999, 3, 30), '', archive_dir=archive_dir,
                fetch_list=lambda _: original_list, fetch_document=lambda _: payload,
                fetch_family=lambda _: self.fail('original must not query correction family'))
            self.assertEqual((original['source_claims'], original['facts_changed']), (1, 0))
            self.assertEqual(len(state['verified_historical_observations']), 0)
            pending = target_source.ingest_target(state, corrected_no, '00190321',
                date(1999, 6, 11), '', archive_dir=archive_dir,
                fetch_list=lambda _: corrected_list, fetch_document=lambda _: payload,
                fetch_family=lambda _: b'<select></select>')
            self.assertEqual((pending['facts_changed'], pending['application_status']),
                             (0, 'correction_relation_unverified'))
            corrected = target_source.ingest_target(state, corrected_no, '00190321',
                date(1999, 6, 11), '', archive_dir=archive_dir,
                fetch_list=lambda _: corrected_list, fetch_document=lambda _: payload,
                fetch_family=lambda _: family)
            self.assertEqual((corrected['source_claims'], corrected['facts_changed'],
                              corrected['family_requests']), (1, 1, 1))
            fact = next(iter(state['verified_historical_observations'].values()))
            self.assertEqual((fact['source_receipt_no'], fact['basis_date'], fact['quantity']),
                             (corrected_no, '1998-12-31', '21298820'))
            self.assertEqual(state['indirect_source_holds'][original_no], 'superseded_by_correction')
            snapshot = make_snapshot(state, {})
            self.assertEqual(len(snapshot['verifiedIndirectObservations']), 1)
            self.assertEqual(snapshot['verifiedIndirectObservations'][0]['receiptNo'], corrected_no)
            self.assertEqual(snapshot['holdings'][0]['companyOwnershipPercent'], '8.0')
            replay = target_source.ingest_target(state, corrected_no, '00190321',
                date(1999, 6, 11), '', archive_dir=archive_dir,
                fetch_list=lambda _: corrected_list,
                fetch_document=lambda _: self.fail('raw cache was not reused'),
                fetch_family=lambda _: family)
            self.assertEqual((replay['facts_changed'], replay['raw_archive_cache_hits']), (0, 0))

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
        self.assertEqual([event['basisDate'] for event in snapshot['events']
                          if event['kind'] == 'unquantified-change'],
                         ['2025-12-31'])
        self.assertTrue(all(event['quantity'] is None and event['companyOwnershipPercent'] is None
                            for event in snapshot['events'] if event['kind'] == 'unquantified-change'))
        conflicting = copy.deepcopy(next(fact for fact in state['issuer_scope_observations'].values()
                                         if fact['basis_date'] == '2025-08-22'))
        conflicting['quantity'] = '9954723'
        conflicting['ownership_percent'] = '8.17'
        state['issuer_scope_observations']['f' * 64] = conflicting
        conflict_snapshot = make_snapshot(state, {})
        self.assertEqual(conflict_snapshot['holdings'][0]['companyOwnershipPercent'], '7.5')
        self.assertTrue(conflict_snapshot['holdings'][0]['issuerScopeConflict'])
        self.assertIn('same_basis_conflict', {item['status']
            for item in conflict_snapshot['issuerScopeObservations']})
        del state['issuer_scope_observations']['f' * 64]
        future_candidate = copy.deepcopy(state['target_source_candidates']['20251114002334'])
        future_candidate['receipt_no'] = '20251115000001'
        future_candidate['source_claims'] = [{**future_candidate['source_claims'][0],
            'basis_date': '2027-08-22', 'denominator_date': '2027-08-22',
            'row_sha256': 'f' * 64}]
        before_facts = len(state['issuer_scope_observations'])
        self.assertEqual(secondary.retain_verified_historical_claims(state, future_candidate), 0)
        self.assertEqual(future_candidate['application_status'], 'source_basis_after_filing')
        self.assertEqual(len(state['issuer_scope_observations']), before_facts)
        # A separately filed correction with no explicit target link holds
        # only the matching report period, not the earlier Q3 citation.
        correction = {'status': '000', 'page_no': '1', 'page_count': '100',
            'total_count': '1', 'total_page': '1',
            'list': [{'rcept_no': '20260516000001', 'rcept_dt': '20260516',
                'corp_code': '00244455', 'corp_name': '케이티앤지', 'stock_code': '033780',
                'report_nm': '정정 분기보고서 (2026.03)', 'rm': '정'}]}
        target_source.ingest_target(state, '20260516000001', '00244455',
            date(2026, 5, 16), '', fetch_list=lambda _: correction,
            fetch_document=fetch_document, fetch_family=lambda _: b'<select></select>')
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['issuerScopeSource']['referenceCount'], 1)
        self.assertEqual(len(make_snapshot(state, {})['issuerScopeObservations'][0]['references']), 1)
        target_source.ingest_target(state, '20251114002334', '00244455',
            date(2025, 11, 14), '',
            fetch_list=lambda _: listed('20251114002334', '2025-11-14', '철'),
            fetch_document=fetch_document)
        self.assertEqual(len(calls), 3)
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['companyOwnershipPercent'], '7.5')
        self.assertEqual(make_snapshot(state, {})['issuerScopeObservations'], [])
        target_source.ingest_target(state, '20260515002914', '00244455',
            date(2026, 5, 15), '',
            fetch_list=lambda _: listed('20260515002914', '2026-05-15', '철'),
            fetch_document=fetch_document)
        self.assertEqual(make_snapshot(state, {})['holdings'][0]['companyOwnershipPercent'], '7.5')


if __name__ == '__main__':
    unittest.main()
