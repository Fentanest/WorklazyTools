import tempfile
import unittest
import io
import http.client
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import patch

from scripts.foliotrace import folio, secondary
from pipeline.foliotrace.publish import make_snapshot


def result_page(rows, total=None, page=1, pages=1):
    total = len(rows) if total is None else total
    body = "".join(
        f'<tr><th><a class="company">{company}</a>'
        f'<a class="second" href="/dsaf001/main.do?rcpNo={no}&dcmNo={dcm}">{report}</a></th>'
        f'<td>{snippet}</td><td class="info">제출인</td><td class="date">{day}</td></tr>'
        for no, dcm, company, report, snippet, day in rows)
    page_info = f'<div class="pageInfo">[{page}/{pages}]</div>' if total else ""
    return (f'<table>{body}</table>{page_info}<input id="totalCnt" value="{total}">').encode()


POSCO = ("20060208000020", "1251611", "포스코", "의결권대리행사권유참고서류",
         "국민연금공단 보통주 *****", "2006.02.08")
NOISE = ("20060208000286", "1252220", "회사", "투자설명서",
         "국민연금관리공단 빌딩 4층", "2006.02.08")


class SecondaryBackfillTests(unittest.TestCase):
    def test_disconnected_search_retries_and_reports_only_safe_transport_code(self):
        day = date(2006, 2, 8)
        payload = result_page([POSCO])
        with patch.object(secondary.time, 'sleep'), patch.object(secondary.urllib.request, 'urlopen',
                side_effect=[http.client.RemoteDisconnected('connection closed'), io.BytesIO(payload)]) as request:
            self.assertEqual(secondary.fetch_search_page('국민연금공단', day, day, 1), payload)
            self.assertEqual(request.call_count, 2)
        with patch.object(secondary.time, 'sleep'), patch.object(secondary.urllib.request, 'urlopen',
                side_effect=http.client.RemoteDisconnected('secret-bearing transport detail')) as request:
            with self.assertRaisesRegex(RuntimeError, '^SEARCH_TRANSPORT$') as failure:
                secondary.fetch_search_page('국민연금공단', day, day, 1, retries=3)
            self.assertEqual(request.call_count, 3)
            self.assertNotIn('secret-bearing', str(failure.exception))

    def test_disconnected_document_retries_and_preserves_retryable_failure(self):
        payload = b'example archive bytes'
        with patch.object(secondary.time, 'sleep'), patch.object(secondary.urllib.request, 'urlopen',
                side_effect=[http.client.RemoteDisconnected('connection closed'), io.BytesIO(payload)]) as request:
            self.assertEqual(secondary.fetch_source_document(POSCO[0], 'test-key'), payload)
            self.assertEqual(request.call_count, 2)
        with patch.object(secondary.time, 'sleep'), patch.object(secondary.urllib.request, 'urlopen',
                side_effect=http.client.RemoteDisconnected('test-key transport detail')) as request:
            with self.assertRaisesRegex(RuntimeError, '^DOCUMENT_TRANSPORT$') as failure:
                secondary.fetch_source_document(POSCO[0], 'test-key', retries=3)
            self.assertEqual(request.call_count, 3)
            self.assertNotIn('test-key', str(failure.exception))

    def test_source_archive_marks_context_for_review_without_extracting_quantity(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("filing.xml", "<DOC><ROW>국민연금관리공단</ROW><ROW>보통주 2,407,509</ROW></DOC>")
        result = secondary.inspect_source_document(buffer.getvalue())
        self.assertEqual(result["status"], "source_context_review_pending")
        self.assertGreater(result["equity_context_count"], 0)
        self.assertNotIn("quantity", result)
        self.assertEqual(secondary.inspect_source_document(b'<result><status>020</status></result>')["status"],
                         "source_review_pending")

    def test_actual_source_row_shapes_become_unapplied_claims(self):
        xml = ('<DOC><TR><TD>국민연금관리공단</TD><TD>사업자등록</TD><TD>219-82-01593</TD>'
               '<TD>본인</TD><TD>2,407,509</TD><TD>2.76</TD><TD>0</TD></TR>'
               '<TR><TD>최대주주등</TD><TD>국민연금공단</TD><TD>보통주</TD>'
               '<TD>17,910,781</TD><TD>5.03</TD></TR>'
               '<TR><TD>최대주주등</TD><TD>국민연금공단</TD><TD>보통주</TD>'
               '<TD>17,910,781</TD><TD>5.32</TD></TR>'
               '<TR><TD>국민연금공단</TD><TD>보통주</TD><TD>*****</TD><TD>5.05</TD></TR></DOC>')
        claims = secondary.extract_source_claims(xml)
        self.assertEqual([(claim['quantity'], claim['ownership_percent']) for claim in claims],
                         [('2407509', '2.76'), ('17910781', '5.03'), ('17910781', '5.32')])
        self.assertTrue(all(claim['basis_date'] is None for claim in claims))
        self.assertTrue(all(claim['status'] == 'source_context_review_pending' for claim in claims))
        self.assertEqual(claims[0]['security_kind'], None)

    def test_report_change_owner_total_must_agree_within_one_section(self):
        def row(*cells):
            return '<TR>' + ''.join(f'<TD>{cell}</TD>' for cell in cells) + '</TR>'
        first = (row('이번보고서제출일', '2006년 02월 01일', '보통주', '2,407,509', '2.76') +
                 '<P>4. 개인별세부변동사항</P>' + row('성명', '국민연금관리공단') +
                 row('2006년 02월 01일', '장내매도(-)', '보통주', '3,084,186', '-676,677', '2,407,509') +
                 '<P>5. 최대주주등 주식소유현황(총괄현황)</P>' +
                 row('국민연금관리공단', '사업자등록', '219-82-01593', '본인', '2,407,509', '2.76'))
        other = (row('이번보고서제출일', '2006년 02월 01일', '보통주', '2,481,311', '2.85') +
                 '<P>4. 개인별세부변동사항</P>' + row('성명', '다른 주주') +
                 row('2006년 02월 01일', '해당사항없슴', '보통주', '2,481,310', '0', '2,481,310') +
                 '<P>5. 최대주주등 주식소유현황(총괄현황)</P>' +
                 row('다른 주주', '사업자등록', '0', '본인', '2,481,311', '2.85'))
        claims = secondary.extract_source_claims('<DOC>' + first + other + '</DOC>')
        self.assertEqual(len(claims), 1)
        self.assertEqual((claims[0]['basis_date'], claims[0]['status'], claims[0]['security_kind']),
                         ('2006-02-01', 'actual_holding_basis_verified', '보통주'))
        mismatched = first.replace('2,407,509</TD></TR><P>5.', '2,407,508</TD></TR><P>5.')
        self.assertIsNone(secondary.extract_source_claims('<DOC>' + mismatched + other + '</DOC>')[0]['basis_date'])

    def test_issued_share_total_checks_actual_posco_ratio_without_inventing_denominator_date(self):
        def row(*cells):
            return '<TR>' + ''.join(f'<TD>{cell}</TD>' for cell in cells) + '</TR>'
        xml = ('<DOC><P>2. 발행주식수정보</P>' +
            row('보통주식총수(1)', '우선주식총수(2)', '발행주식총수(1+2)') +
            row('87,186,835', '0', '87,186,835') +
            row('이번보고서제출일', '2006년 02월 01일', '보통주', '2,407,509', '2.76') +
            '<P>4. 개인별세부변동사항</P>' + row('성명', '국민연금관리공단') +
            row('2006년 02월 01일', '장내매도(-)', '보통주', '3,084,186', '-676,677', '2,407,509') +
            '<P>5. 최대주주등 주식소유현황(총괄현황)</P>' +
            row('국민연금관리공단', '사업자등록', '219-82-01593', '본인', '2,407,509', '2.76') + '</DOC>')
        claim = secondary.extract_source_claims(xml)[0]
        self.assertEqual((claim['ratio_denominator'], claim['denominator_quantity'],
                          claim['denominator_date']), ('issued_shares', '87186835', None))
        wrong = xml.replace('87,186,835', '80,000,000')
        self.assertNotIn('ratio_denominator', secondary.extract_source_claims(wrong)[0])

        state = folio.empty_state()
        state['universe']['00155319'] = {'name': 'POSCO홀딩스', 'stock_code': '005490'}
        candidate = {'receipt_no': '20060124800040', 'document_no': '1248144',
            'filing_date': '2006-02-01', 'filing_company': 'POSCO홀딩스',
            'source_archive_sha256': 'a' * 64, 'parser_version': secondary.SOURCE_PARSER_VERSION,
            'source_claims': [{**claim, 'source_file_sha256': 'c' * 64}]}
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 1)
        fact = next(iter(state['verified_historical_observations'].values()))
        self.assertEqual((fact['ratio_denominator'], fact['denominator_date'],
            fact['observation_status']), ('issued_shares', None, 'historical_only_denominator_date_unverified'))
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 0)
        self.assertEqual(len(state['verified_historical_observations']), 1)
        key = next(iter(state['verified_historical_observations']))
        prior = dict(fact, ratio_denominator='unverified', denominator_quantity=None,
            denominator_date=None, denominator_evidence=None,
            observation_status='historical_only_ratio_basis_unverified',
            parser_version='source-change-sections-v4')
        state['verified_historical_observations'][key] = prior
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 1)
        self.assertEqual(candidate['application_status'], 'historical_fact_enriched')
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 0)
        self.assertEqual(len(state['verified_historical_observations']), 1)

    def test_stored_candidate_rechecks_source_and_reaches_public_history(self):
        def row(*cells):
            return '<TR>' + ''.join(f'<TD>{cell}</TD>' for cell in cells) + '</TR>'
        xml = ('<DOC><P>2. 발행주식수정보</P>' +
            row('보통주식총수(1)', '우선주식총수(2)', '발행주식총수(1+2)') +
            row('87,186,835', '0', '87,186,835') +
            row('이번보고서제출일', '2006년 02월 01일', '보통주', '2,407,509', '2.76') +
            '<P>4. 개인별세부변동사항</P>' + row('성명', '국민연금관리공단') +
            row('2006년 02월 01일', '장내매도(-)', '보통주', '3,084,186', '-676,677', '2,407,509') +
            '<P>5. 최대주주등 주식소유현황(총괄현황)</P>' +
            row('국민연금관리공단', '사업자등록', '219-82-01593', '본인', '2,407,509', '2.76') + '</DOC>')
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as zf:
            zf.writestr('report.xml', xml)
        state = folio.empty_state()
        corp, stock, receipt, document = '00155319', '005490', '20060124800040', '1248144'
        state['universe'][corp] = {'name': 'POSCO홀딩스', 'stock_code': stock}
        state['holdings'][corp] = {'corp_code': corp, 'stock_code': stock, 'name': 'POSCO홀딩스',
            'receipt_no': '20260623000336', 'receipt_date': '2026-06-23',
            'holding_date': '2026-06-18', 'quantity': '6576661',
            'company_ownership_percent': '8.3', 'security_kind': 'common',
            'tracking': 'active', 'evidence': 'dart_document'}
        candidate = {'receipt_no': receipt, 'document_no': document,
            'filing_date': '2006-02-01', 'filing_company': 'POSCO홀딩스',
            'review_status': 'source_context_review_pending',
            'parser_version': 'source-change-sections-v4'}
        state['secondary_backfill'] = {'method': secondary.METHOD,
            'start_date': '2006-02-01', 'target_date': '2006-02-01',
            'next_date': '2006-02-02', 'coverage': [], 'candidates': {f'{receipt}:{document}': candidate}}
        state['secondary_source_cache'][receipt] = {'parser_version': 'source-change-sections-v4',
            'status': 'source_context_review_pending'}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, state)
            first = secondary.scan_secondary(path, date(2006, 2, 1), date(2006, 2, 1),
                read_state=folio.read_json, write_state=folio.write_json, key='test-key',
                source_only=True, source_receipt=receipt, review_limit=1,
                fetch_document=lambda *_: archive.getvalue())
            self.assertEqual((first['source_document_requests'], first['historical_facts_retained']), (1, 1))
            saved = folio.read_json(path)
            fact = next(iter(saved['verified_historical_observations'].values()))
            self.assertEqual((fact['basis_date'], fact['quantity'], fact['ownership_percent'],
                fact['ratio_denominator'], fact['denominator_date']),
                ('2006-02-01', '2407509', '2.76', 'issued_shares', None))
            public = make_snapshot(saved, {})
            self.assertEqual(public['historicalObservations'][0]['status'],
                             'historical_only_denominator_date_unverified')
            self.assertEqual(public['holdings'][0]['companyOwnershipPercent'], '8.3')
            second = secondary.scan_secondary(path, date(2006, 2, 1), date(2006, 2, 1),
                read_state=folio.read_json, write_state=folio.write_json, key='test-key',
                source_only=True, source_receipt=receipt, review_limit=1,
                fetch_document=lambda *_: self.fail('unexpected source re-fetch'))
            self.assertEqual((second['source_document_requests'], second['historical_facts_retained']), (0, 0))
    def test_source_checked_history_fact_keeps_unknown_denominator_and_current_holding(self):
        state = folio.empty_state()
        state['universe']['00155319'] = {'name': 'POSCO홀딩스', 'stock_code': '005490'}
        state['holdings']['00155319'] = {'corp_code': '00155319', 'stock_code': '005490',
            'quantity': '6576661', 'company_ownership_percent': '8.3',
            'receipt_no': '20260623000336', 'holding_date': None}
        candidate = {'receipt_no': '20060124800040', 'document_no': '1248144',
            'filing_date': '2006-02-01', 'filing_company': 'POSCO홀딩스',
            'source_archive_sha256': 'a' * 64, 'parser_version': secondary.SOURCE_PARSER_VERSION,
            'source_claims': [{'status': 'actual_holding_basis_verified', 'row_sha256': 'b' * 64,
                'source_file_sha256': 'c' * 64, 'row_offset': 12006, 'basis_date': '2006-02-01',
                'basis_evidence': 'matched_report_change_and_owner_total',
                'quantity': '2407509', 'ownership_percent': '2.76'}]}
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 1)
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 0)
        fact = next(iter(state['verified_historical_observations'].values()))
        self.assertEqual((fact['corp_code'], fact['stock_code'], fact['basis_date']),
                         ('00155319', '005490', '2006-02-01'))
        self.assertEqual(fact['ratio_denominator'], 'unverified')
        self.assertEqual(state['holdings']['00155319']['company_ownership_percent'], '8.3')
        self.assertIsNone(state['holdings']['00155319']['holding_date'])
        public = make_snapshot(state, {})
        self.assertEqual(public['historicalObservations'][0]['ownershipPercent'], '2.76')
        self.assertEqual(public['historicalObservations'][0]['basisDate'], '2006-02-01')
        self.assertEqual(public['holdings'][0]['companyOwnershipPercent'], '8.3')
        candidate['filing_company'] = '다른회사'
        self.assertEqual(secondary.retain_verified_historical_claims(state, candidate), 0)
        self.assertEqual(candidate['application_status'], 'issuer_identity_unverified')

    def test_existing_v4_source_claim_replays_into_history_without_refetch(self):
        day = date(2006, 2, 1)
        state = folio.empty_state()
        state['universe']['00155319'] = {'name': 'POSCO홀딩스', 'stock_code': '005490'}
        state['holdings']['00155319'] = {'corp_code': '00155319', 'stock_code': '005490',
            'receipt_no': '20260623000336', 'company_ownership_percent': '8.3'}
        key = '20060124800040:1248144'
        candidate = {'receipt_no': '20060124800040', 'document_no': '1248144',
            'filing_date': '2006-02-01', 'filing_company': 'POSCO홀딩스',
            'review_status': 'source_context_review_pending',
            'parser_version': secondary.SOURCE_PARSER_VERSION,
            'source_archive_sha256': 'a' * 64,
            'source_claims': [{'status': 'actual_holding_basis_verified', 'row_sha256': 'b' * 64,
                'source_file_sha256': 'c' * 64, 'row_offset': 12006, 'basis_date': '2006-02-01',
                'basis_evidence': 'matched_report_change_and_owner_total',
                'quantity': '2407509', 'ownership_percent': '2.76'}]}
        state['secondary_backfill'] = {'method': secondary.METHOD, 'start_date': day.isoformat(),
            'target_date': day.isoformat(), 'next_date': '2006-02-02', 'coverage': [],
            'candidates': {key: candidate}}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, state)
            def run():
                return secondary.scan_secondary(path, day, day, read_state=folio.read_json,
                    write_state=folio.write_json, key='test-key', review_limit=1,
                    source_only=True, source_receipt='20060124800040',
                    fetch_document=lambda *_: self.fail('source re-fetched'))
            first = run()
            self.assertEqual((first['source_document_requests'], first['historical_facts_retained']), (0, 1))
            saved = folio.read_json(path)
            self.assertEqual(len(saved['verified_historical_observations']), 1)
            self.assertEqual(saved['holdings']['00155319']['company_ownership_percent'], '8.3')
            before = path.read_bytes()
            self.assertEqual(run()['historical_facts_retained'], 0)
            self.assertEqual(path.read_bytes(), before)

    def test_existing_v4_claim_without_archive_provenance_refetches_once(self):
        day = date(2006, 2, 1)
        state = folio.empty_state()
        state['universe']['00155319'] = {'name': 'POSCO홀딩스', 'stock_code': '005490'}
        key = '20060124800040:1248144'
        old_claim = {'status': 'actual_holding_basis_verified', 'row_sha256': 'b' * 64,
            'row_offset': 12006, 'basis_date': '2006-02-01',
            'basis_evidence': 'matched_report_change_and_owner_total',
            'quantity': '2407509', 'ownership_percent': '2.76'}
        state['secondary_backfill'] = {'method': secondary.METHOD, 'start_date': day.isoformat(),
            'target_date': day.isoformat(), 'next_date': '2006-02-02', 'coverage': [],
            'candidates': {key: {'receipt_no': '20060124800040', 'document_no': '1248144',
                'filing_date': '2006-02-01', 'filing_company': 'POSCO홀딩스',
                'review_status': 'source_context_review_pending',
                'last_source_attempt_on': '2026-09-26',
                'parser_version': secondary.SOURCE_PARSER_VERSION, 'source_claims': [old_claim]}}}
        state['secondary_source_cache']['20060124800040'] = {
            'status': 'source_context_review_pending', 'parser_version': secondary.SOURCE_PARSER_VERSION,
            'source_claims': [old_claim]}
        inspected = {'status': 'source_context_review_pending',
            'parser_version': secondary.SOURCE_PARSER_VERSION,
            'source_archive_sha256': 'a' * 64,
            'source_claims': [{**old_claim, 'source_file_sha256': 'c' * 64}]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, state)
            with patch.object(secondary, 'inspect_source_document', return_value=inspected) as inspect:
                run = secondary.scan_secondary(path, day, day, read_state=folio.read_json,
                    write_state=folio.write_json, key='test-key', review_limit=1, source_only=True,
                    source_receipt='20060124800040', fetch_document=lambda *_: b'archive')
                self.assertEqual(inspect.call_count, 1)
            self.assertEqual((run['source_document_requests'], run['historical_facts_retained']), (1, 1))
            saved = folio.read_json(path)
            self.assertEqual(len(saved['verified_historical_observations']), 1)
            self.assertEqual(saved['secondary_backfill']['candidates'][key]['application_status'],
                             'historical_fact_retained')
            before = path.read_bytes()
            repeat = secondary.scan_secondary(path, day, day, read_state=folio.read_json,
                write_state=folio.write_json, key='test-key', review_limit=1, source_only=True,
                source_receipt='20060124800040', fetch_document=lambda *_: self.fail('source refetched'))
            self.assertEqual(repeat['source_document_requests'], 0)
            self.assertEqual(path.read_bytes(), before)

    def test_provenance_upgrade_transport_failure_persists_retry_state(self):
        day = date(2006, 2, 1)
        state = folio.empty_state()
        state['universe']['00155319'] = {'name': 'POSCO홀딩스', 'stock_code': '005490'}
        key = '20060124800040:1248144'
        state['secondary_backfill'] = {'method': secondary.METHOD, 'start_date': day.isoformat(),
            'target_date': day.isoformat(), 'next_date': '2006-02-02', 'coverage': [],
            'candidates': {key: {'receipt_no': '20060124800040', 'document_no': '1248144',
                'filing_date': '2006-02-01', 'filing_company': 'POSCO홀딩스',
                'review_status': 'source_context_review_pending',
                'parser_version': secondary.SOURCE_PARSER_VERSION,
                'source_archive_sha256': 'a' * 64,
                'source_claims': [{'status': 'actual_holding_basis_verified',
                    'row_sha256': 'b' * 64, 'basis_date': '2006-02-01',
                    'quantity': '2407509', 'ownership_percent': '2.76'}]}}}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, state)
            result = secondary.scan_secondary(path, day, day, read_state=folio.read_json,
                write_state=folio.write_json, key='test-key', review_limit=1, source_only=True,
                source_receipt='20060124800040',
                fetch_document=lambda *_: (_ for _ in ()).throw(RuntimeError('DOCUMENT_TRANSPORT')))
            self.assertEqual((result['source_review_attempts'], result['historical_facts_retained']), (1, 0))
            saved = folio.read_json(path)
            candidate = saved['secondary_backfill']['candidates'][key]
            self.assertEqual(candidate['review_status'], 'source_review_pending')
            self.assertEqual(candidate['application_status'], 'source_provenance_pending')
            self.assertEqual(candidate['source_attempt_count'], 1)
            self.assertEqual(saved.get('verified_historical_observations', {}), {})

    def test_parser_keeps_official_page_identity_and_receipt_metadata(self):
        day = date(2006, 2, 8)
        page = secondary.parse_search_page(result_page([POSCO]), 1, day, day)
        self.assertEqual((page["total"], page["page_count"]), (1, 1))
        self.assertEqual(page["rows"][0]["receipt_no"], POSCO[0])
        self.assertEqual(page["rows"][0]["document_no"], POSCO[1])
        count_with_separator = result_page([POSCO], total=1).replace(b'value="1"', b'value="1,000"')
        with self.assertRaisesRegex(ValueError, "PAGE_COUNT"):
            secondary.parse_search_page(count_with_separator, 1, day, day)
        with self.assertRaisesRegex(ValueError, "PAGE_IDENTITY"):
            secondary.parse_search_page(result_page([POSCO], page=2, pages=2, total=11), 1, day, day)
        with self.assertRaisesRegex(ValueError, "ROW_DATE_RANGE"):
            secondary.parse_search_page(result_page([POSCO]), 1, date(2006, 2, 9), date(2006, 2, 9))

    def test_completed_window_deduplicates_terms_and_keeps_noise_out_of_candidate_ledger(self):
        day = date(2006, 2, 8)
        answers = {
            secondary.TERMS[0]: result_page([POSCO]),
            secondary.TERMS[1]: result_page([NOISE, POSCO]),
            secondary.TERMS[2]: result_page([]),
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json)
            saved = folio.read_json(path)
            ledger = saved["secondary_backfill"]
            self.assertEqual(result["status"], "SEARCH_COMPLETE")
            self.assertEqual((result["search_requests"], result["new_candidates"]), (3, 1))
            self.assertEqual(ledger["next_date"], "2006-02-09")
            self.assertEqual(ledger["coverage"][0]["unique_documents"], 2)
            self.assertEqual(secondary.decode_noncandidate_keys(ledger["coverage"][0]),
                             [f'{NOISE[0]}:{NOISE[1]}'])
            self.assertEqual(ledger["coverage"][0]["term_hits"][secondary.TERMS[1]], 2)
            self.assertEqual(set(ledger["candidates"]), {f'{POSCO[0]}:{POSCO[1]}'})
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})
            snapshot = make_snapshot(saved, {})
            self.assertEqual(snapshot["secondaryCoverage"]["allContentCheckedThrough"], "2006-02-08")
            self.assertEqual(snapshot["secondaryCoverage"]["candidateDocumentCount"], 1)
            self.assertEqual(snapshot["secondaryCoverage"]["noncandidateUnreviewedCount"], 1)
            again = secondary.scan_secondary(path, day, day, fetch=lambda *_: self.fail("complete range refetched"),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(again["search_requests"], 0)

    def test_noncandidate_queue_reviews_after_candidates_and_retries_bad_zip(self):
        day = date(2006, 2, 8)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("filing.xml", "<DOC>국민연금관리공단 보통주</DOC>")
        answers = {secondary.TERMS[0]: result_page([POSCO, NOISE]),
                   secondary.TERMS[1]: result_page([]), secondary.TERMS[2]: result_page([])}
        requests = []
        def document(no, _key):
            requests.append(no)
            return buffer.getvalue() if no == POSCO[0] or requests.count(NOISE[0]) > 1 else b'<result>020</result>'
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=2,
                fetch_document=document)
            self.assertEqual((result['source_review_attempts'], result['noncandidate_review_attempts']), (2, 1))
            saved = folio.read_json(path)
            key = f'{NOISE[0]}:{NOISE[1]}'
            self.assertEqual(saved['secondary_backfill']['noncandidate_reviews'][key]['review_status'],
                             'source_review_pending')
            self.assertNotIn(NOISE[0], saved['secondary_source_cache'])
            self.assertEqual(make_snapshot(saved, {})['secondaryCoverage']['noncandidateUnreviewedCount'], 1)
            saved['secondary_backfill']['noncandidate_reviews'][key]['last_source_attempt_on'] = '2006-02-08'
            folio.write_json(path, saved)
            retry = secondary.scan_secondary(path, day, day, fetch=lambda *_: self.fail('range refetched'),
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=2,
                fetch_document=document)
            saved = folio.read_json(path)
            self.assertEqual((retry['search_requests'], retry['noncandidate_review_attempts']), (0, 1))
            self.assertEqual(saved['secondary_backfill']['noncandidate_reviews'][key]['review_status'],
                             'source_context_review_pending')
            self.assertEqual(make_snapshot(saved, {})['secondaryCoverage']['noncandidateUnreviewedCount'], 0)
            self.assertEqual(make_snapshot(saved, {})['secondaryCoverage']['sourceContextReviewCount'], 2)
            self.assertEqual(saved['holdings'], {})

    def test_retryable_noise_does_not_starve_unseen_documents(self):
        day = date(2006, 2, 8)
        other = ('20060208000287', '1252221', '회사', '투자설명서',
                 '국민연금관리공단 빌딩 5층', '2006.02.08')
        answers = {secondary.TERMS[0]: result_page([NOISE, other]),
                   secondary.TERMS[1]: result_page([]), secondary.TERMS[2]: result_page([])}
        called = []
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            def document(no, _key):
                called.append(no)
                return b'<result>020</result>'
            secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=1,
                fetch_document=document)
            saved = folio.read_json(path)
            self.assertEqual(called, [NOISE[0]])
            saved['secondary_backfill']['noncandidate_reviews'][f'{NOISE[0]}:{NOISE[1]}']['last_source_attempt_on'] = '2006-02-08'
            folio.write_json(path, saved)
            secondary.scan_secondary(path, day, day, fetch=lambda *_: self.fail('range refetched'),
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=1,
                fetch_document=document)
            self.assertEqual(called, [NOISE[0], other[0]])

    def test_failing_candidate_does_not_starve_noncandidate_at_limit_one(self):
        day = date(2006, 2, 8)
        answers = {secondary.TERMS[0]: result_page([POSCO, NOISE]),
                   secondary.TERMS[1]: result_page([]), secondary.TERMS[2]: result_page([])}
        called = []
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            def document(no, _key):
                called.append(no)
                return b'<result>020</result>'
            secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=1,
                fetch_document=document)
            saved = folio.read_json(path)
            self.assertEqual(called, [POSCO[0]])
            saved['secondary_backfill']['candidates'][f'{POSCO[0]}:{POSCO[1]}']['last_source_attempt_on'] = '2006-02-08'
            folio.write_json(path, saved)
            second = secondary.scan_secondary(path, day, day, fetch=lambda *_: self.fail('range refetched'),
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=1,
                fetch_document=document)
            self.assertEqual(called, [POSCO[0], NOISE[0]])
            self.assertEqual(second['noncandidate_review_attempts'], 1)
            self.assertEqual(make_snapshot(folio.read_json(path), {})['secondaryCoverage']['noncandidateUnreviewedCount'], 1)

    def test_source_review_is_bounded_and_never_promotes_holdings(self):
        day = date(2006, 2, 8)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("filing.xml", "<DOC>국민연금공단 보통주 *****</DOC>")
        answers = {secondary.TERMS[0]: result_page([POSCO]),
                   secondary.TERMS[1]: result_page([]), secondary.TERMS[2]: result_page([])}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json, key="test-key", review_limit=1,
                fetch_document=lambda no, key: buffer.getvalue())
            saved = folio.read_json(path)
            candidate = next(iter(saved["secondary_backfill"]["candidates"].values()))
            self.assertEqual(result["source_document_requests"], 1)
            self.assertEqual(candidate["review_status"], "source_context_review_pending")
            self.assertEqual(saved["holdings"], {})

    def test_parser_upgrade_refetches_previously_reviewed_candidate_without_search(self):
        day = date(2006, 2, 8)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('filing.xml', '<DOC>국민연금관리공단 보통주 100</DOC>')
        answers = {secondary.TERMS[0]: result_page([POSCO]),
                   secondary.TERMS[1]: result_page([]), secondary.TERMS[2]: result_page([])}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            called = []
            def document(no, _key):
                called.append(no)
                return buffer.getvalue()
            secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=1,
                fetch_document=document)
            saved = folio.read_json(path)
            candidate = saved['secondary_backfill']['candidates'][f'{POSCO[0]}:{POSCO[1]}']
            candidate['parser_version'] = 'old-parser'
            saved['secondary_source_cache'][POSCO[0]]['parser_version'] = 'old-parser'
            folio.write_json(path, saved)
            result = secondary.scan_secondary(path, day, day, fetch=lambda *_: self.fail('search refetched'),
                read_state=folio.read_json, write_state=folio.write_json, key='test-key', review_limit=1,
                fetch_document=document, source_only=True, source_receipt=POSCO[0])
            self.assertEqual(result['source_document_requests'], 1)
            self.assertEqual(result['status'], 'SOURCE_REVIEW_COMPLETE')
            self.assertEqual(called, [POSCO[0], POSCO[0]])
            self.assertEqual(folio.read_json(path)['secondary_backfill']['candidates'][
                f'{POSCO[0]}:{POSCO[1]}']['parser_version'], secondary.SOURCE_PARSER_VERSION)
            self.assertEqual(saved["events"], {})

    def test_failed_later_page_does_not_advance_window(self):
        day = date(2006, 2, 8)
        first = result_page([(f'20060208{i:06d}', str(1251611 + i), *POSCO[2:])
                             for i in range(10)], total=11, pages=2)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            def fetch(term, _start, _end, page):
                if term == secondary.TERMS[0] and page == 1:
                    return first
                if term == secondary.TERMS[0]:
                    raise RuntimeError("SEARCH_TRANSPORT")
                return result_page([])
            with self.assertRaises(secondary.SecondarySearchError) as failure:
                secondary.scan_secondary(path, day, day, fetch=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual((failure.exception.code, failure.exception.page), ("SEARCH_TRANSPORT", 2))
            self.assertIsNone(folio.read_json(path)["secondary_backfill"] if "secondary_backfill" in folio.read_json(path) else None)

    def test_repeated_document_on_nonadjacent_page_rejects_checkpoint(self):
        day = date(2006, 2, 8)
        rows = [(f'20060208{i:06d}', str(1251611 + i), '포스코',
                 '의결권대리행사권유참고서류', '국민연금공단 보통주', '2006.02.08')
                for i in range(20)]
        responses = {1: result_page(rows[:10], total=21, page=1, pages=3),
                     2: result_page(rows[10:], total=21, page=2, pages=3),
                     3: result_page([rows[0]], total=21, page=3, pages=3)}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            def fetch(term, _start, _end, page):
                return responses[page] if term == secondary.TERMS[0] else result_page([])
            with self.assertRaises(secondary.SecondarySearchError) as failure:
                secondary.scan_secondary(path, day, day, fetch=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(failure.exception.code, 'PAGINATION_REPEAT')
            self.assertIsNone(folio.read_json(path)['secondary_backfill'])

    def test_site_page_cap_splits_window_before_checkpoint(self):
        start, end = date(2006, 2, 8), date(2006, 2, 9)
        calls = []
        def fetch(term, first, last, page):
            calls.append((term, first, last, page))
            if term == secondary.TERMS[0] and first != last:
                return result_page([POSCO] * 10, total=1010, pages=101)
            return result_page([])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, start, end, max_windows=1, fetch=fetch,
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["next_date"], "2006-02-09")
            self.assertEqual(folio.read_json(path)["secondary_backfill"]["coverage"][0]["to"], "2006-02-08")
            self.assertTrue(any(first == last == start for _, first, last, _ in calls))

    def test_budget_exhausted_while_shrinking_does_not_mix_window_pages(self):
        start, end = date(2006, 2, 8), date(2006, 2, 9)
        eleven = [(f'20060208{i:06d}', str(1251611 + i), '포스코', '주식등의대량보유상황보고서',
                   '국민연금공단 보통주', '2006.02.08') for i in range(11)]
        def fetch(term, first, last, page):
            if term != secondary.TERMS[2]:
                return result_page([])
            return result_page(eleven[(page-1)*10:page*10], total=11, page=page, pages=2)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            first = secondary.scan_secondary(path, start, end, max_pages=3, fetch=fetch,
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual((first['next_date'], first['windows_this_run']), ('2006-02-08', 0))
            self.assertEqual(folio.read_json(path)['secondary_backfill']['coverage'], [])
            resumed = secondary.scan_secondary(path, start, end, max_pages=4, max_windows=1, fetch=fetch,
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual((resumed['next_date'], resumed['windows_this_run']), ('2006-02-09', 1))

    def test_early_direct_uses_separate_cursor_and_preserves_current_holdings(self):
        initial = folio.empty_state()
        initial["import_ledger"] = ["synthetic"]
        initial["latest_complete_listing_date"] = "2026-09-26"
        initial["historical_backfill"] = {"start_date": "2009-01-01", "target_date": "2026-09-26",
            "next_date": "2010-01-01", "coverage": []}
        initial["holdings"]["00104856"] = {"receipt_no": "20260923000001", "quantity": "100"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, initial)
            with patch.object(folio, "dart_json", return_value={"status": "013", "list": []}):
                result = folio.backfill_history(path, date(2006, 1, 1), date(2006, 1, 7), "test-key",
                    parse_limit=0, recheck_limit=0, ledger_key="early_direct_backfill")
            saved = folio.read_json(path)
            self.assertEqual(result["status"], "LISTING_COMPLETE")
            self.assertEqual(saved["early_direct_backfill"]["next_date"], "2006-01-08")
            self.assertEqual(saved["historical_backfill"], initial["historical_backfill"])
            self.assertEqual(saved["holdings"], initial["holdings"])


if __name__ == "__main__":
    unittest.main()
