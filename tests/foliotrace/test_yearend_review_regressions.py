"""Positive regressions for Astra's 13 probes (FTY-F01..F12, including F02b)."""
import contextlib
import copy
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from test_yearend_reconstruction import worker_doc, worker_zip, synthetic_workbook
from test_common_distribution_source import report_xml
from pipeline.foliotrace import yearend as y, yearend_worker as w
from scripts.foliotrace import folio, secondary, run_yearend_followup as cli


class YearendReviewRegressions(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.archives = self.root / 'archives'
        self.archives.mkdir()
        self.out = self.root / 'out'
        self.state = {}
        self.req = dict(request_key='job', receipt_no='20260318001422',
                        equity_target_corp='SYNCO', document_target_corp='SYNCO',
                        excel_eval_eok_raw='1', excel_ratio_display='1.00',
                        derived_estimate='100', price_date='2025-12-30')

    def stage(self, xml=None):
        xml = xml or worker_doc([dict(holder='국민연금공단', security='보통주', quantity='100', ratio='1.00')],
            notes=[('2025-12-31', 'shareholder_register_date', '0', 'quantity', '')])
        (self.archives / (self.req['receipt_no'] + '.zip')).write_bytes(worker_zip(xml))

    def run_worker(self, **kw):
        return w.process_followup(self.state, self.req, archive_dir=self.archives, output_dir=self.out, **kw)

    def run_cli(self, *extra):
        args = ['runner', '--state', str(self.root / 'state.json'), '--archive-dir', str(self.archives),
                '--output-dir', str(self.out), *extra]
        buf = io.StringIO()
        with patch.object(sys, 'argv', args), contextlib.redirect_stdout(buf):
            code = cli.main()
        return code, json.loads(buf.getvalue())

    def test_F01_unrelated_tokens_and_invented_note_stay_pending(self):
        self.stage('<filing><p>SYNCO 국민연금공단 보통주 관련 문의</p>'
                   '<p>다른 회사 First Eagle 우선주 1000주</p><p>접수일 2026-03-18</p></filing>')
        clue = dict(holder_name='국민연금공단', equity_target_corp='SYNCO', security_kind='보통주',
                    quantity='100', holder_aggregation_scope='single_holder', note_text='this note does not exist',
                    date_clues=[dict(text='2026-03-18', role='shareholder_register_date', ambiguous=True)])
        result = self.run_worker(stored_responses={'job': {'clue': clue}})
        self.assertEqual(result['outcome'], 'comparison_pending_hold')
        self.assertEqual(self.state['yearend_comparison'], {})
        self.assertFalse(self.out.exists())

    def test_F02_filing_date_is_not_confirmed_balance(self):
        self.stage(worker_doc([dict(holder='국민연금공단', security='보통주', quantity='100', ratio='1.00')]))
        result = self.run_worker()
        self.assertEqual(result['outcome'], 'resolved_verified_hold')
        row = y.build_comparison_table(self.state)[0]
        self.assertEqual(row['status'], 'values_match_basis_unconfirmed')
        self.assertIsNone(row['disclosure_basis_date'])
        self.assertFalse(row['basis_confirmed'])
        self.assertFalse(row['scope_confirmed'])
        self.assertEqual(y.assess_comparison(derived_estimate='100', disclosure_quantity='100',
                         basis_confirmed=True, scope_confirmed=True), 'values_match_basis_unconfirmed')

    def test_F02b_role_and_ratio_only_date_scope_are_preserved(self):
        xml = worker_doc([dict(holder='국민연금공단', security='보통주', quantity='100', ratio='1.00')])
        layout = w.extract_holder_table(xml, 'a'*64, 'f.xml', 'b'*64)
        clue = w.candidate_from_row(layout, 0, date_bindings=[dict(text='2026-03-18', role='shareholder_register_date', ambiguous=True)])
        self.assertFalse(w.verify_candidate(layout, clue)['verified'])
        self.stage(worker_doc([dict(holder='국민연금공단', security='보통주', quantity='100', ratio='1.00')],
                             notes=[('2024-12-31', 'shareholder_register_date', '0', 'ownership_percent', '')]))
        result = self.run_worker()
        row = y.build_comparison_table(self.state)[0]
        self.assertIsNone(row['disclosure_basis_date'])
        self.assertFalse(row['basis_confirmed'])
        self.assertIn('ownership_percent', [b['applies_to_field'] for b in result['evidence']['date_bindings']])

    def test_F03_non_nps_or_unproven_fact_is_rejected(self):
        self.stage('<filing><p>SYNCO First Eagle 보통주 100주 1.00 2025-12-31 주주명부</p></filing>')
        clue = dict(holder_name='First Eagle', equity_target_corp='SYNCO', security_kind='보통주', quantity='100',
                    ownership_percent='1.00', holder_aggregation_scope='single_holder',
                    date_clues=[dict(text='2025-12-31', role='shareholder_register_date', ambiguous=False)])
        self.assertEqual(self.run_worker(stored_responses={'job': {'clue': clue}})['outcome'], 'comparison_pending_hold')
        with self.assertRaisesRegex(ValueError, 'YEAREND_EVIDENCE_OWNER_OR_PROOF'):
            w.build_register_evidence_fact(dict(holder='First Eagle', verification={'verified': True}), {})
        self.state = {}
        self.stage()
        evidence = self.run_worker()['evidence']
        with self.assertRaisesRegex(ValueError, 'YEAREND_EVIDENCE_SCOPE_UNMAPPABLE'):
            w.build_register_evidence_fact(evidence, {'basis_date': '2025-12-31'})
        with self.assertRaisesRegex(ValueError, 'YEAREND_EVIDENCE_BASIS'):
            w.build_register_evidence_fact(evidence, {'basis_date': '2020-01-01'})

    def test_F04_changed_full_evidence_versions_and_missing_artifact_repair(self):
        rows = [dict(holder='국민연금공단', security='보통주', quantity='100', ratio='1.00'),
                dict(holder='국민연금공단', security='보통주', quantity='100', ratio='2.00')]
        xml = worker_doc(rows, notes=[('2025-12-31', 'shareholder_register_date', '0', 'quantity', ''),
                                    ('2025-12-31', 'shareholder_register_date', '1', 'quantity', '')])
        self.stage(xml)
        layout = w.extract_holder_table(xml, 'a'*64, 'f.xml', 'b'*64)
        def stored(index):
            return {'job': {'clue': w.candidate_from_row(layout, index, date_bindings=[dict(
                text='2025-12-31', role='shareholder_register_date', ambiguous=False)])}}
        self.assertEqual(self.run_worker(stored_responses=stored(0))['outcome'], 'resolved_verified_hold')
        result = self.run_worker(stored_responses=stored(1))
        self.assertTrue(result['changed'])
        self.assertFalse(result.get('idempotent', False))
        row = self.state['yearend_comparison']['SYNCO']
        self.assertEqual(row['disclosure_ratio_display'], '2.00')
        self.assertEqual(len(row['versions']), 2)
        target = w.evidence_path(self.out, 'job')
        self.assertEqual(json.loads(target.read_text())['quantity'], '100')
        self.assertEqual(json.loads(target.read_text())['ownership_percent'], '2.00')
        target.unlink()
        self.assertTrue(self.run_worker(stored_responses=stored(1))['changed'])
        self.assertTrue(target.exists())
        self.assertFalse(self.run_worker(stored_responses=stored(1))['changed'])

    def test_F05_subject_original_is_selected_by_full_key(self):
        y.compare_yearend(self.state, 'SYNCO', excel_eval_eok_raw='7', excel_ratio_display='7.00',
                          derived_estimate='700', price_date='2024-12-30', input_id='A')
        self.req['input_id'] = 'B'
        self.stage()
        self.run_worker()
        row = self.state['yearend_comparison']['SYNCO|input:B']
        self.assertEqual(row['derived_quantity_estimate'], '100')
        self.assertEqual(row['excel_eval_eok_raw'], '1')
        self.assertEqual(self.state['yearend_comparison']['SYNCO|input:A']['derived_quantity_estimate'], '700')

    def test_F06_resume_replays_complete_immutable_request(self):
        self.req.update(input_id='B', target_point='2025-12-31', security_kind='common', stock_code='123456',
                        chain=['20260317000001'], clue={'source_receipt_no': '20260319000001'})
        path = self.root / 'req.json'
        path.write_text(json.dumps(self.req))
        _, first = self.run_cli('--request', str(path))
        self.assertEqual(first['outcomes'][0]['outcome'], 'missing_original')
        self.stage()
        _, resumed = self.run_cli('--resume-pending')
        self.assertEqual(resumed['requests'], 1)
        persisted = folio.read_json(self.root / 'state.json')
        self.assertEqual(persisted['citation_followup_queue']['job']['request'], self.req)
        self.assertEqual(resumed['outcomes'][0]['outcome'], 'resolved_verified_hold')
        self.assertIn('SYNCO|code:123456|sec:common|asof:2025-12-31|input:B', persisted['yearend_comparison'])

    def test_F07_dry_run_does_not_write_any_file(self):
        self.stage()
        path = self.root / 'req.json'
        path.write_text(json.dumps(self.req))
        self.out.mkdir()
        (self.out / 'comparison.json').write_text('retain')
        before = {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.run_cli('--request', str(path), '--dry-run')
        after = {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)

    def test_F08_corrupt_zip_is_item_hold_and_progress_is_saved(self):
        self.stage()
        paths = self.root / 'requests'
        paths.mkdir()
        (paths / '1.json').write_text(json.dumps(self.req))
        (paths / '2.json').write_text(json.dumps(dict(self.req, request_key='corrupt', receipt_no='20260318001423')))
        (self.archives / '20260318001423.zip').write_bytes(b'not a zip')
        code, result = self.run_cli('--requests-dir', str(paths))
        self.assertEqual(code, 0)
        self.assertEqual(result['outcomes'][1]['lookup_status'], 'archive_corrupt')
        queue = folio.read_json(self.root / 'state.json')['citation_followup_queue']
        self.assertEqual(queue['job']['state'], 'resolved_verified_hold')
        self.assertEqual(queue['corrupt']['state'], 'comparison_pending_hold')

    def test_F09_citation_conflict_is_not_overwritten(self):
        self.stage()
        self.req['clue'] = dict(quantity='999', source_receipt_no='20260319000001')
        self.assertEqual(self.run_worker()['outcome'], 'value_conflict')
        self.req['clue']['quantity'] = '888'
        self.assertEqual(self.run_worker()['outcome'], 'value_conflict')
        item = self.state['citation_followup_queue']['job']
        self.assertEqual(item['state'], 'value_conflict')
        self.assertEqual(item['clue']['quantity'], '999')
        self.assertEqual(item['conflicting_clues'][0]['quantity'], '888')
        self.assertNotIn('resolved_verified_hold', [x['outcome'] for x in item['history']])

    def test_F10_existing_parser_located_proof_completes_with_issuer_header(self):
        original_probe = report_xml().replace('<DOC>', '<DOC><P>SYNCO</P>')
        self.assertEqual(secondary.extract_source_claims(original_probe)[0]['status'], 'actual_holding_basis_verified')
        self.stage(original_probe)
        result = self.run_worker()
        self.assertEqual(result['outcome'], 'comparison_pending_hold')
        self.assertEqual(result['failed'], ['equity_target'])
        self.state = {}
        xml = report_xml().replace('<DOC>', '<DOC><COMPANY-NAME AREGCIK="00126380">SYNCO</COMPANY-NAME>')
        self.req.update(corp_code='00126380', stock_code='005930', security_kind='common')
        self.stage(xml)
        result = self.run_worker()
        self.assertEqual(result['outcome'], 'resolved_verified_hold')
        evidence = result['evidence']
        self.assertEqual(evidence['extraction_source'], 'secondary_structured')
        self.assertEqual(evidence['source_status'], 'actual_holding_basis_verified')
        self.assertTrue(evidence['provenance']['row_refs'])
        self.assertTrue(evidence['provenance']['text_spans'])
        self.assertEqual(evidence['denominator_date'], '2025-12-31')
        # The source header alone proves the corp, not the requested ticker.
        self.assertIsNone(evidence['subject_identity']['stock_code'])
        mapping = Path(self.tmp.name) / 'corpcode.json'
        mapping.write_text(json.dumps([{'corp_code': '00126380', 'stock_code': '005930'}]))
        result = self.run_worker(corpcode_path=mapping)
        evidence = result['evidence']
        context = dict(corp_code='00126380', stock_code='005930',
            filer_corp_code='00126380', source_filing_date='2026-03-18', basis_date='2025-12-31',
            source_receipt_no=self.req['receipt_no'], source_document_sha256=evidence['provenance']['inner_file_sha256'],
            issuer_identity_sha256=evidence['subject_identity']['source_header_sha256'],
            source_status='no_known_correction_or_withdrawal', verified_at='2026-10-13T00:00:00Z')
        fact = w.build_register_evidence_fact(evidence, context)
        from pipeline.foliotrace.indirect import register_evidence
        self.assertTrue(register_evidence(folio.empty_state(), fact)['changed'])
        for field, value in [('corp_code', '00226380'), ('stock_code', '999999'),
                             ('filer_corp_code', '00226380'), ('source_document_sha256', 'c'*64),
                             ('issuer_identity_sha256', 'e'*64)]:
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'YEAREND_EVIDENCE_SUBJECT_OR_SOURCE_MISMATCH'):
                w.build_register_evidence_fact(evidence, {**context, field: value})
        self.req.update(stock_code='999999', request_key='wrong-ticker')
        unbound = self.run_worker()['evidence']
        self.assertIsNone(unbound['subject_identity']['stock_code'])
        self.assertEqual(unbound['subject_identity']['request_ticker_lead'], '999999')
        with self.assertRaisesRegex(ValueError, 'YEAREND_EVIDENCE_SUBJECT_OR_SOURCE_MISMATCH'):
            w.build_register_evidence_fact(unbound, {**context, 'stock_code': '999999'})
        self.assertEqual(self.run_worker(corpcode_path=mapping)['outcome'], 'comparison_pending_hold')
        mapping.write_text(json.dumps([{'corp_code': '00126380', 'stock_code': '005930'},
                                       {'corp_code': '00126380', 'stock_code': '999999'}]))
        ambiguous = self.run_worker(corpcode_path=mapping)['evidence']
        self.assertIsNone(ambiguous['subject_identity']['stock_code'])
        self.req['corp_code'] = '00226380'
        self.req['request_key'] = 'wrong-issuer-code'
        self.assertEqual(self.run_worker()['outcome'], 'comparison_pending_hold')

    def test_F11_self_closing_blank_cell_keeps_column_alignment(self):
        payload = synthetic_workbook([(1, 'SYNCO', '99', '0.5', '1.00')])
        with zipfile.ZipFile(io.BytesIO(payload)) as z:
            parts = {n: z.read(n) for n in z.namelist()}
        parts['xl/worksheets/sheet1.xml'] = parts['xl/worksheets/sheet1.xml'].replace(b'<c r="C8"><v>99</v></c>', b'<c r="C8" s="1"/>')
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            for name, value in parts.items():
                z.writestr(name, value)
        row = y.parse_yearend_workbook(buf.getvalue())['rows'][0]
        self.assertEqual(row['eval_eok_raw'], '')
        self.assertEqual(row['weight_raw'], '0.5')

    def test_F12_request_key_cannot_escape_artifact_directory(self):
        self.stage()
        sentinel = self.root / 'unrelated.json'
        sentinel.write_text('retain me')
        self.req['request_key'] = '../../unrelated'
        result = self.run_worker()
        self.assertEqual(result['outcome'], 'resolved_verified_hold')
        self.assertEqual(sentinel.read_text(), 'retain me')
        artifact = Path(result['written']['evidence_candidate'])
        self.assertEqual(artifact.parent, (self.out / 'evidence-candidates').resolve())
        self.assertEqual(json.loads(artifact.read_text())['request_key'], '../../unrelated')

    def test_artifact_directory_symlink_escape_is_held(self):
        self.stage()
        self.out.mkdir()
        outside = self.root / 'outside'
        outside.mkdir()
        (self.out / 'evidence-candidates').symlink_to(outside, target_is_directory=True)
        result = self.run_worker()
        self.assertEqual(result['outcome'], 'comparison_pending_hold')
        self.assertEqual(list(outside.iterdir()), [])
        self.assertEqual(self.state['yearend_comparison'], {})

    def test_legacy_queue_incomplete_is_reported(self):
        state = folio.empty_state()
        y.enqueue_citation_followup(state, 'legacy', {'source_receipt_no': 'WRONG'})
        folio.write_json(self.root / 'state.json', state)
        _, result = self.run_cli('--resume-pending')
        self.assertEqual(result['legacy_entries'][0]['outcome'], 'legacy_request_incomplete')

    def test_ambiguous_quantity_basis_is_not_confirmed(self):
        self.stage()
        xml = worker_doc([dict(holder='국민연금공단', security='보통주', quantity='100', ratio='1.00')],
                         notes=[('2025-12-31', 'shareholder_register_date', '0', 'quantity', '')])
        layout = w.extract_holder_table(xml, 'a'*64, 'f.xml', 'b'*64)
        candidate = w.candidate_from_row(layout, 0, date_bindings=[dict(text='2025-12-31', role='shareholder_register_date', ambiguous=True)])
        result = self.run_worker(stored_responses={'job': {'clue': candidate}})
        self.assertEqual(result['outcome'], 'resolved_verified_hold')
        self.assertFalse(y.build_comparison_table(self.state)[0]['basis_confirmed'])

    def test_structured_whole_numbers_reject_100_inside_1000(self):
        xml = worker_doc([dict(holder='국민연금공단', security='보통주', quantity='1,000', ratio='1.00')])
        layout = w.extract_holder_table(xml, 'a'*64, 'f.xml', 'b'*64)
        candidate = w.candidate_from_row(layout, 0, date_bindings=[dict(text='2026-03-18', role='filing_date')])
        candidate['quantity'] = '100'
        self.assertFalse(w.verify_candidate(layout, candidate)['verified'])
        candidate['quantity'] = '1000.0'
        self.assertTrue(w.verify_candidate(layout, candidate)['verified'])

    def test_exact_archive_does_not_scan_directory_and_suffix_fallback_still_works(self):
        self.stage()
        with patch.object(Path, 'glob', side_effect=AssertionError('unnecessary directory scan')):
            self.assertEqual(self.run_worker()['outcome'], 'resolved_verified_hold')
        self.state = {}
        (self.archives / (self.req['receipt_no'] + '.zip')).rename(
            self.archives / (self.req['receipt_no'] + '-original.zip'))
        self.assertEqual(self.run_worker()['outcome'], 'resolved_verified_hold')
