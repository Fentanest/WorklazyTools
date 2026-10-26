"""Offline real-run CLI contracts with independently constructed local inputs."""
import contextlib
import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_common_distribution_source import report_xml
from test_yearend_reconstruction import synthetic_workbook, worker_zip
from pipeline.foliotrace import yearend_reconcile as r
from scripts.foliotrace import run_yearend_reconcile as cli


class ReconcileRunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.excel = self.root / 'input.xlsx'
        self.tracked = self.root / 'tracked.json'
        self.artifacts = self.root / 'artifacts/foliotrace'
        self.ledger = self.artifacts / 'dart-api-ledger-20261013'
        (self.ledger / 'api-zips').mkdir(parents=True)
        self.excel.write_bytes(synthetic_workbook([(1, 'SYNCO', '1', '.1', '.0862'), (2, 'SYNCO우', '1', '.1', '.01'),
                                                 (3, 'UNKNOWN', '1', '.1', '.02')]))
        self.tracked.write_text(json.dumps({'holdings': {
            'issuer': {'name': 'SYNCO', 'corp_code': '00126380', 'stock_code': '123456', 'security_kind': 'common',
                       'quantity': '1', 'company_ownership_percent': '7.00', 'holding_date': '2026-01-01', 'receipt_no': '20260318001422'},
            'preferred': {'name': 'SYNCO우', 'corp_code': '00126380', 'stock_code': '123457', 'security_kind': 'preferred',
                          'quantity': '1', 'company_ownership_percent': '1.00', 'holding_date': '2026-01-01'},
            'extra': {'name': 'EXTRA', 'corp_code': '00226380', 'stock_code': '222222', 'security_kind': 'common'}},
            'quote_cache': {'123456': {'trade_date': '2026-10-08', 'verified': True, 'close': '100', 'adjusted': False,
                                     'currency': 'KRW', 'market': 'KRX', 'session': 'regular'}}}))
        self.no = '20260318001422'
        xml = report_xml().replace('<DOC>', '<DOC><COMPANY-NAME AREGCIK="00126380">SYNCO</COMPANY-NAME>')
        archive = worker_zip(xml, self.no + '.xml')
        (self.ledger / 'api-zips' / (self.no + '.zip')).write_bytes(archive)
        (self.ledger / 'corpus.jsonl').write_text(json.dumps({'rcept_no': self.no, 'disclosure_company': 'SYNCO',
            'filing_date': '2026-03-18', 'source_archive_sha256': hashlib.sha256(archive).hexdigest(),
            'documents': [{'original_member_path': str((self.ledger / 'api-zips' / (self.no + '.zip')).relative_to(self.root)) + '::' + self.no + '.xml',
                           'source_sha256': hashlib.sha256(xml.encode()).hexdigest()}]}) + '\n')

    def run_reconcile(self):
        return r.reconcile(self.excel, self.tracked, self.artifacts, self.root)

    def test_unicode_literal_discovery_overlap(self):
        hints = r.NameHints(['삼성전자', '삼성전자우', 'SYNCO', 'OTHER', '신세계'])
        self.assertEqual(hints.findall('삼성전자우 SYNCO 신세계'), {'삼성전자', '삼성전자우', 'SYNCO', '신세계'})

    def test_counts_exact_subject_and_source_verification(self):
        report, state = self.run_reconcile()
        self.assertEqual(report['counts']['excel_rows'], 3)
        self.assertEqual(report['counts']['matched'], 1)
        self.assertEqual(report['counts']['differing'], 1)
        self.assertEqual(report['counts']['foliotrace_missing'], 1)
        self.assertEqual(report['counts']['excel_missing'], 1)
        self.assertEqual(report['counts']['verified'], 1)
        self.assertEqual(report['counts']['pending_followup'], 1)
        self.assertEqual(report['receipts_need_fetching'], [])
        row = report['rows'][0]
        self.assertEqual(row['excel_ratio_display'], '8.62')
        self.assertIsNone(row['derived_quantity_estimate'])
        self.assertFalse(row['tracking_date_matches_target'])
        self.assertEqual(row['followup_status'], 'verified')
        self.assertIn('sec:common', row['subject_key'])
        self.assertIn('sec:preferred', report['rows'][1]['subject_key'])
        self.assertEqual(len(state['yearend_excel_inputs']), 3)
        self.assertNotIn('indirect_observations', state)

    def test_missing_original_receipt_is_reported_for_fetch(self):
        (self.ledger / 'api-zips' / (self.no + '.zip')).unlink()
        report, _ = self.run_reconcile()
        self.assertEqual(report['receipts_need_fetching'], [self.no])
        self.assertEqual(report['rows'][0]['followup_status'], 'pending')
        self.assertFalse(report['rows'][0]['has_local_candidate'])

    def test_excel_missing_subject_gets_local_followup_without_fabricated_excel(self):
        tracked = json.loads(self.tracked.read_text())
        tracked['holdings']['extra']['receipt_no'] = self.no
        tracked['holdings']['extra']['name'] = 'SYNCO EXTRA'
        self.tracked.write_text(json.dumps(tracked))
        report, state = self.run_reconcile()
        missing = report['excel_missing'][0]
        self.assertTrue(missing['has_local_candidate'])
        self.assertEqual(missing['followup_status'], 'pending')
        self.assertEqual(len(missing['candidate_results']), 1)
        self.assertEqual(report['counts']['excel_missing_differences_with_local_candidates'], 1)
        self.assertEqual(len(state['yearend_excel_inputs']), 3)
        comparison = state['yearend_comparison'][missing['subject_key']]
        self.assertIsNone(comparison['excel_eval_eok_raw'])
        self.assertIsNone(comparison['excel_ratio_display'])

    def test_web_text_is_discovery_not_numeric_proof(self):
        (self.ledger / 'api-zips' / (self.no + '.zip')).unlink()
        web = self.artifacts / 'dart-attachments'
        (web / 'text').mkdir(parents=True)
        text = 'SYNCO 국민연금공단 26,755,051 8.62 2025-12-31'
        path = web / 'text' / 'attachment.txt'
        path.write_text(text)
        (web / 'documents.jsonl').write_text(json.dumps({'rcept_no': self.no, 'plain_path': str(path.relative_to(self.root)),
            'plain_sha256': hashlib.sha256(text.encode()).hexdigest(), 'whole_document_verified': True}) + '\n')
        report, _ = self.run_reconcile()
        self.assertTrue(report['rows'][0]['has_local_candidate'])
        self.assertEqual(report['rows'][0]['followup_status'], 'pending')
        self.assertEqual(report['receipts_need_fetching'], [])
        self.assertTrue(report['rows'][0]['candidate_results'][0]['attachments'][0]['hash_verified'])

    def test_ambiguous_mapping_does_not_borrow_another_security(self):
        state = json.loads(self.tracked.read_text())
        state['holdings']['other'] = {**state['holdings']['issuer'], 'security_kind': 'preferred', 'stock_code': '123458'}
        self.tracked.write_text(json.dumps(state))
        report, _ = self.run_reconcile()
        self.assertEqual(report['rows'][0]['classification'], 'foliotrace_missing')
        self.assertEqual(report['rows'][0]['followup_status'], 'pending')
        self.assertIsNone(report['rows'][0]['tracked'])

    def test_cli_dry_run_writes_nothing(self):
        # The CLI output containment check uses the real worktree; dry-run
        # leaves even its output directory absent.
        out = cli.ROOT / 'review-output/test-dry-run-unused'
        before = {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        argv = ['runner', '--excel', str(self.excel), '--tracked-state', str(self.tracked),
                '--artifacts-root', str(self.artifacts), '--source-root', str(self.root), '--output-dir', str(out), '--dry-run']
        with patch.object(sys, 'argv', argv), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(cli.main(), 0)
        self.assertFalse(out.exists())
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()})
