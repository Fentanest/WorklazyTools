"""Pipeline adapters and independently specified year-end disclosure boundaries."""
import contextlib
import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline.foliotrace import yearend_pipeline as p
from pipeline.foliotrace.nps_pipeline_adapter import NameMap, PipelineAdapter
from scripts.foliotrace import run_yearend_pipeline as cli
from test_yearend_reconstruction import synthetic_workbook, worker_zip
from test_common_distribution_source import report_xml


def fact(**overrides):
    return {**{'fact_id': 'f1', 'record_kind': 'EQUITY_HOLDING', 'holding_verdict': 'HELD_CONFIRMED',
        'holder_entity': '국민연금공단', 'security_issuer_stock_code': '123456',
        'security_type': '보통주', 'share_scope': 'SHARES_ONLY', 'base_date': '2025-12-01',
        'base_date_kind': 'HOLDING_BASIS', 'stake_pct': 7, 'quantity_status': 'REPORTED',
        'position_scope': 'TOTAL_HOLDING', 'ratio_observation_ready': False,
        'computation_blockers': ['DENOMINATOR_UNVERIFIED']}, **overrides}


def formal(**overrides):
    return {**{'rcept_no': '20251202000001', 'form': 'A1_LARGE_HOLDING', 'guaranteed': True,
        'failures': [], 'reporter': '국민연금공단', 'issuer_stock_code': '123456',
        'base_date': '2025-12-01', 'ratio_pct': '7.00', 'shares': '100', 'evidence_sha256': 'formal-source'}, **overrides}


def observation(**overrides):
    return {**{'issuer_stock_code': '123456', 'security_class': 'common', 'ratio_pct': '7',
        'base_date': '2025-12-01', 'receipt_no': '20251202000001',
        'source_kind': 'structured-holdings', 'guarantee_level': 'PYTHON_FORM_GUARANTEED'}, **overrides}


class MappingAndBracketTests(unittest.TestCase):
    def setUp(self):
        self.names = NameMap([{'corp_name': 'SYNCO', 'corp_code': '00123456', 'stock_code': '123456'},
                              {'corp_name': '두산', 'stock_code': '000150'}])
        self.mapping = self.names.resolve('SYNCO')

    def compare(self, ratio, *obs):
        return p.compare_ratio(ratio, self.mapping, list(obs))

    def test_exact_unique_and_preferred_class_not_ticker_guess(self):
        self.assertEqual(self.names.resolve('두산우')['issuer_stock_code'], '000150')
        self.assertEqual(self.names.resolve('두산우')['security_class'], 'preferred')
        self.assertEqual(self.names.resolve('SYNCO2우B')['security_series'], '2우B')
        self.assertIsNone(self.names.resolve(' SYNCO')['issuer_stock_code'])
        other = NameMap([{'corp_name': 'SYNCO', 'stock_code': '123456'}, {'corp_name': 'SYNCO', 'stock_code': '234567'}])
        self.assertEqual(other.resolve('SYNCO')['reason'], 'ambiguous_registered_name')
        self.assertEqual(other.resolve('SYNCO우')['reason'], 'ambiguous_registered_name')

    def test_fraction_conversion_and_five_ten_percent_thresholds(self):
        self.assertEqual(p.excel_ratio('0.0776'), '7.760000000000')
        self.assertEqual(self.compare(p.excel_ratio('0.049999'))['category'], 'NO_DISCLOSURE_OBLIGATION')
        at_five = self.compare(p.excel_ratio('0.05'))
        self.assertTrue(at_five['disclosure_checkable'])
        self.assertEqual(at_five['category'], 'NO_PIPELINE_EVIDENCE')
        self.assertTrue(self.compare(p.excel_ratio('.1'))['ten_percent_or_more'])
        self.assertFalse(self.compare('9.999')['ten_percent_or_more'])
        self.assertEqual(self.compare(p.excel_ratio('0.09999999999999999'))['ten_percent_or_more'], True)

    def test_subfive_unresolved_is_no_obligation_and_falling_report_consistent(self):
        self.assertEqual(p.compare_ratio('2', self.names.resolve('UNKNOWN'), [])['category'], 'NO_DISCLOSURE_OBLIGATION')
        self.assertEqual(self.compare('3', observation(ratio_pct='4.5'))['category'], 'CONSISTENT')
        self.assertEqual(self.compare('3', observation(ratio_pct='5.5'))['category'], 'NO_DISCLOSURE_OBLIGATION')
        self.assertEqual(p.compare_ratio('5', self.names.resolve('UNKNOWN'), [])['category'], 'NAME_UNRESOLVED')

    def test_tolerance_both_edges_and_outside(self):
        for ratio in ('6', '8', '7'):
            self.assertEqual(self.compare(ratio, observation())['category'], 'CONSISTENT')
        for ratio in ('5.9999', '8.0001'):
            self.assertEqual(self.compare(ratio, observation())['category'], 'DISCREPANCY')

    def test_latest_pre_earliest_post_and_post_cannot_replace_pre(self):
        rows = [observation(base_date='2025-01-01', ratio_pct='5'), observation(),
                observation(base_date='2025-12-31', ratio_pct='8'),
                observation(base_date='2026-01-02', ratio_pct='10'),
                observation(base_date='2026-01-03', ratio_pct='11')]
        result = self.compare('10', *rows)
        self.assertEqual(result['category'], 'DISCREPANCY')
        self.assertEqual(result['pre_yearend']['base_date'], '2025-12-31')
        self.assertEqual(result['post_yearend']['base_date'], '2026-01-02')
        self.assertTrue(result['bracket']['excel_between_endpoints'])
        self.assertEqual(self.compare('10', rows[-1])['category'], 'NO_PIPELINE_EVIDENCE')

    def test_guarantee_only_tiebreaks_same_date_and_conflicts_hold(self):
        lower = observation(ratio_pct='9', guarantee_level='LLM_JUDGMENT')
        result = self.compare('7', observation(), lower)
        self.assertEqual(result['category'], 'CONSISTENT')
        self.assertEqual(len(result['pre_yearend']['lower_guarantee_observations']), 1)
        self.assertEqual(self.compare('7', observation(), observation(ratio_pct='8'))['category'], 'SOURCE_CONFLICT_WITHIN_TOLERANCE')
        self.assertEqual(self.compare('7', observation(), observation(ratio_pct='8.01'))['category'], 'DISCREPANCY')
        # A newer lower-guarantee observation is still the latest observation.
        self.assertEqual(self.compare('7', observation(), {**lower, 'base_date': '2025-12-30'})['category'], 'DISCREPANCY')

    def test_preferred_does_not_borrow_common_or_other_series(self):
        mapping = self.names.resolve('SYNCO2우B')
        result = p.compare_ratio('7', mapping, [observation(), observation(security_class='preferred', security_series='우')])
        self.assertEqual(result['category'], 'NO_PIPELINE_EVIDENCE')
        result = p.compare_ratio('7', mapping, [observation(security_class='preferred', security_series='2우B')])
        self.assertEqual(result['category'], 'CONSISTENT')

    def test_no_reverification_for_other_categories(self):
        with self.assertRaisesRegex(ValueError, 'ONLY_DISCREPANCY'):
            p.reverify({'category': 'CONSISTENT'}, {}, Path('/tmp'))


class AdapterAndRunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.artifacts = self.root / 'artifacts/foliotrace'
        self.ledger = self.artifacts / 'dart-api-ledger-20261004'
        self.ledger.mkdir(parents=True)
        corp = self.artifacts / 'dart-corpcode/corpcode.json'
        corp.parent.mkdir()
        corp.write_text(json.dumps([{'corp_name': 'SYNCO', 'stock_code': '123456', 'corp_code': '00123456'}]))
        self.names = NameMap(json.loads(corp.read_text()))
        self.excel = self.root / 'input.xlsx'
        self.excel.write_bytes(synthetic_workbook([(1, 'SYNCO', '10', '.1', '.0776'),
            (2, 'UNKNOWN', '1', '.1', '.01'), (3, 'UNKNOWN2', '1', '.1', '.06')]))

    def write(self, name, rows):
        target = self.ledger / name
        target.write_text(''.join(json.dumps(row) + '\n' for row in rows))

    def record(self, method='old', at='2026-01-01T00:00:00+00:00', **overrides):
        return {**{'rcept_no': '20251202000001', 'evidence_sha256': 'source', 'reviewer': 'Codx',
            'methodology_sha256': method, 'reviewed_at': at, 'facts': [fact()]}, **overrides}

    def adapter(self):
        return PipelineAdapter(self.artifacts, self.names)

    def test_latest_methodology_supersedes_even_with_not_confirmed(self):
        self.write('codex-verdicts.jsonl', [self.record(),
            self.record('new', '2026-02-01T00:00:00+00:00', facts=[fact(holding_verdict='NOT_CONFIRMED')]),
            self.record('old', '2026-03-01T00:00:00+00:00', facts=[fact(stake_pct=9)]),
            self.record(None, '2026-04-01T00:00:00+00:00')])
        adapter = self.adapter()
        self.assertEqual(adapter.load(), [])
        self.assertEqual(adapter.counts['superseded_judgments'], 2)

    def test_FTY2_F01_real_naver_A3_common_alias(self):
        from pipeline.foliotrace.nps_pipeline_adapter import security
        row = json.loads((Path(__file__).parent / 'fixtures/naver-20250402800428.json').read_text())
        adapter = self.adapter()
        obs = adapter.formal(row, 'structured-holdings', 'PYTHON_FORM_GUARANTEED')
        self.assertEqual(obs[0]['receipt_no'], '20250402800428')
        self.assertEqual(obs[0]['ratio_pct'], '9.24')
        self.assertEqual(obs[0]['security_class'], 'common')
        mapping = NameMap([{'corp_name': 'NAVER', 'stock_code': '035420'}]).resolve('NAVER')
        self.assertEqual(p.compare_ratio('9.27', mapping, obs)['category'], 'CONSISTENT')
        for spelling in ('우선주식', '의결권있는 우선주', '2우B'):
            self.assertEqual(security(spelling), 'preferred')
        for spelling in ('보통주+우선주', '의결권있는', '-'):
            self.assertEqual(security(spelling), 'unknown')
        self.assertEqual(adapter.formal(formal(trades=[{'kind': '보통주식'}, {'kind': '우선주식'}]),
                         'structured-holdings', 'PYTHON_FORM_GUARANTEED'), [])

    def test_FTY2_F02_explicit_source_bound_zero_replaces_old_holding(self):
        zero = fact(fact_id='zero', record_kind='EXPLICIT_ZERO', holding_verdict='NOT_HELD_EXPLICIT',
                    shares_held=0, stake_pct=0, base_date='2025-12-31')
        adapter = self.adapter()
        obs = adapter.facts(self.record(facts=[fact(base_date='2025-01-01'), zero]), 'codex-verdicts', {}, set())
        self.assertEqual(len(obs), 2)
        self.assertEqual(p.compare_ratio('7', self.names.resolve('SYNCO'), obs)['category'], 'DISCREPANCY')
        self.assertEqual(p.compare_ratio('0', self.names.resolve('SYNCO'), obs)['category'], 'CONSISTENT')
        for change in ({'stake_pct': None}, {'stake_pct': 1}, {'shares_held': 5},
                       {'holding_verdict': 'NOT_CONFIRMED'}, {'security_type': 'UNKNOWN'}, {'base_date': None}):
            self.assertEqual(adapter.facts(self.record(facts=[{**zero, **change}]), 'codex-verdicts', {}, set()), [])
        self.assertEqual(adapter.facts(self.record(evidence_sha256=None, facts=[zero]), 'codex-verdicts', {}, set()), [])

    def test_FTY2_F03_component_scope_survives_but_cannot_replace_total(self):
        component = fact(fact_id='component-account-A', position_scope='COMPONENT_POSITION',
                         position_series_id='account-A', account_identifier='account-A', stake_pct=7)
        obs = self.adapter().facts(self.record(facts=[fact(base_date='2025-01-01', stake_pct=9), component]),
                                   'codex-verdicts', {}, set())
        self.assertEqual(obs[1]['position_scope'], 'COMPONENT_POSITION')
        self.assertEqual(obs[1]['position_series_id'], 'account-A')
        self.assertEqual(obs[1]['account_identifier'], 'account-A')
        result = p.compare_ratio('7', self.names.resolve('SYNCO'), obs)
        self.assertEqual(result['category'], 'DISCREPANCY')
        self.assertEqual(result['pre_yearend']['ratio_pct'], '9')
        self.assertEqual(p.compare_ratio('7', self.names.resolve('SYNCO'), obs[1:])['category'], 'NO_PIPELINE_EVIDENCE')

    def test_FTY2_F04_failed_date_binding_never_authorizes_unknown(self):
        adapter = self.adapter()
        record = self.record(facts=[fact(base_date_kind='UNKNOWN')])
        key = ('20251202000001', 'source', 'f1', 'codex')
        failed = {'derived_base_date': None, 'basis': 'NOT_DERIVABLE'}
        self.assertEqual(adapter.facts(record, 'codex-verdicts', {}, set()), [])
        self.assertEqual(adapter.facts(record, 'codex-verdicts', {key: failed}, set()), [])
        success = {'derived_base_date': '2025-12-31', 'basis': 'PERIOD_PHRASE'}
        obs = adapter.facts(record, 'codex-verdicts', {key: success}, set())
        self.assertEqual(obs[0]['base_date'], '2025-12-31')
        self.assertEqual(obs[0]['base_date_origin'], success)
        for kind in ('DISPLAY_DATE', 'FILING_DATE'):
            self.assertEqual(adapter.facts(self.record(facts=[fact(base_date_kind=kind)]), 'codex-verdicts', {key: failed}, set()), [])

    def test_different_source_not_superseded_and_equal_method_reviewers_retained(self):
        self.write('codex-verdicts.jsonl', [self.record(), self.record('new', '2026-02-01T00:00:00+00:00', evidence_sha256='other')])
        self.write('muse-verdicts.jsonl', [self.record(reviewer='Muse', facts=[fact(stake_pct=8)])])
        observations = self.adapter().load()
        self.assertEqual(len(observations), 3)
        self.assertEqual({o['ratio_pct'] for o in observations}, {'7', '8'})

    def test_llm_ratios_without_share_quantity_preserve_gates_and_block_unusable(self):
        self.write('codex-verdicts.jsonl', [self.record(facts=[fact(shares_held=None),
            fact(quantity_status='MASKED'), fact(holding_verdict='NOT_CONFIRMED'),
            fact(base_date=None), fact(holder_entity='국민연금 등'), fact(share_scope='SHARES_AND_EQUIVALENTS'),
            fact(is_hypothetical=True), fact(is_duplicate_observation=True)])])
        rows = self.adapter().load()
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]['shares'])
        self.assertFalse(rows[0]['ratio_observation_ready'])
        self.assertIn('DENOMINATOR_UNVERIFIED', rows[0]['computation_blockers'])

    def test_derived_date_bound_to_source_fact_reviewer_not_receipt_only(self):
        self.write('codex-verdicts.jsonl', [self.record(facts=[fact(base_date=None)])])
        self.write('derived-base-dates.jsonl', [{'rcept_no': '20251202000001', 'evidence_sha256': 'different',
            'reviewer': 'codx', 'fact_id': 'f1', 'derived_base_date': '2025-12-31'}])
        self.assertEqual(self.adapter().load(), [])
        self.write('derived-base-dates.jsonl', [{'rcept_no': '20251202000001', 'evidence_sha256': 'source',
            'reviewer': 'codex', 'fact_id': 'f1', 'derived_base_date': '2025-12-31', 'basis': 'PERIOD_PHRASE'}])
        rows = self.adapter().load()
        self.assertEqual(rows[0]['base_date'], '2025-12-31')

    def test_formal_guarantee_r8_hold_and_mixed_security(self):
        web = self.artifacts / 'dart-attachments'
        web.mkdir()
        (web / 'structured-holdings.jsonl').write_text(json.dumps(formal()) + '\n')
        self.write('structured-parse-results.jsonl', [formal(guaranteed=False), formal(reporter='OTHER'),
            formal(form='A2_INSIDER_OWNERSHIP', trades=[{'kind': '우선주'}])])
        self.write('structured-r8-observations.jsonl', [
            {'rcept_no': '1', 'status': 'HOLD', 'envelope': {'parser_result': formal()}},
            {'rcept_no': '2', 'status': 'BOUNDED_SELF_CHECK_PASS',
             'envelope': {'parser_self_check_guaranteed': True, 'parser_result': formal()}}])
        rows = self.adapter().load()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['guarantee_level'], 'PYTHON_FORM_GUARANTEED')
        self.assertFalse(rows[1]['calculation_clearance'])

    def test_archive_uses_revalidated_not_original_record(self):
        self.write('archive-judgments.jsonl', [{'rcept_no': '20251202000001', 'evidence_sha256': 'source',
            'corpus_binding': {'status': 'MATCHED_LATEST'}, 'original_record': self.record(),
            'revalidation': {'status': 'PASS', 'normalized': self.record(facts=[])}}])
        self.assertEqual(self.adapter().load(), [])

    def test_end_to_end_categories_coverage_and_no_original_reads_for_consistent(self):
        self.write('codex-verdicts.jsonl', [self.record()])
        later = self.artifacts / 'dart-api-ledger-20261013'
        later.mkdir()
        (later / 'corpus.jsonl').write_text(json.dumps({'rcept_no': '20261013000001'}) + '\n')
        before = {str(x): hashlib.sha256(x.read_bytes()).hexdigest() for x in self.root.rglob('*') if x.is_file()}
        with patch.object(p, 'reverify', side_effect=AssertionError('must not read original')):
            report = p.reconcile(self.excel, self.artifacts, self.root)
        self.assertEqual(report['counts']['CONSISTENT'], 1)
        self.assertEqual(report['counts']['NO_DISCLOSURE_OBLIGATION'], 1)
        self.assertEqual(report['counts']['NAME_UNRESOLVED'], 1)
        gap = report['pipeline_coverage_gaps'][-1]
        self.assertEqual(gap['absent_from_all_adapter_inputs'], 1)
        self.assertTrue(gap['later_than_20261008_build'])
        self.assertIn('DENOMINATOR_UNVERIFIED', report['rows'][0]['pre_yearend']['evidence'][0]['computation_blockers'])
        self.assertEqual(before, {str(x): hashlib.sha256(x.read_bytes()).hexdigest() for x in self.root.rglob('*') if x.is_file()})

    def test_discrepancy_without_local_original_does_not_call_worker(self):
        self.write('codex-verdicts.jsonl', [self.record(facts=[fact(stake_pct=5)])])
        with patch.object(p.yearend_worker, 'process_followup', side_effect=AssertionError('no original')):
            report = p.reconcile(self.excel, self.artifacts, self.root)
        self.assertEqual(report['counts']['DISCREPANCY'], 1)
        self.assertEqual(report['rows'][0]['original_reverification']['status'], 'no_local_original')

    def test_local_discrepancy_reverifies_fixed_worker_without_overwriting_pipeline(self):
        no = '20251202000001'
        self.write('codex-verdicts.jsonl', [self.record(facts=[fact(stake_pct=5, base_date='2025-12-31')])])
        archive_dir = self.ledger / 'api-zips'
        archive_dir.mkdir()
        xml = report_xml().replace('<DOC>', '<DOC><COMPANY-NAME AREGCIK="00123456">SYNCO</COMPANY-NAME>')
        archive = worker_zip(xml, no + '.xml')
        path = archive_dir / (no + '.zip')
        path.write_bytes(archive)
        self.write('corpus.jsonl', [{'rcept_no': no, 'source_archive_sha256': hashlib.sha256(archive).hexdigest(),
            'documents': [{'original_member_path': str(path.relative_to(self.root)) + '::' + no + '.xml',
                           'source_sha256': hashlib.sha256(xml.encode()).hexdigest()}]}])
        with patch.object(p.tempfile, 'TemporaryDirectory', side_effect=AssertionError('API ZIP must be read-only')):
            report = p.reconcile(self.excel, self.artifacts, self.root)
        row = report['rows'][0]
        self.assertEqual(row['category'], 'DISCREPANCY')
        self.assertEqual(row['pre_yearend']['ratio_pct'], '5')
        self.assertEqual(row['original_reverification']['status'], 'performed')
        self.assertEqual(row['original_reverification']['results'][0]['outcome'], 'value_conflict')

    def test_FTY2_F06_attachment_scratch_is_explicit_and_dry_run_writes_nothing(self):
        no = '20251202000001'
        raw = self.root / 'raw.xml'
        raw.write_text(report_xml())
        original = {'kind': 'attachment_raw', 'raw_path': 'raw.xml',
                    'source_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(), 'whole_document_verified': True}
        row = {'category': 'DISCREPANCY', 'mapping': self.names.resolve('SYNCO'), 'name': 'SYNCO',
               'row_sha256': 'row', 'pre_yearend': {'evidence': [observation()]}}
        scratch = self.root / 'approved-output'
        scratch.mkdir()
        actual_temp = tempfile.TemporaryDirectory
        with patch.object(p.tempfile, 'TemporaryDirectory', wraps=actual_temp) as temporary:
            result = p.reverify(row, {no: [original]}, self.root, scratch_dir=scratch)
        self.assertEqual(temporary.call_count, 1)
        self.assertEqual(temporary.call_args.kwargs['dir'], scratch)
        self.assertEqual(list(scratch.iterdir()), [])
        self.assertEqual(result['status'], 'performed')
        with patch.object(p.tempfile, 'TemporaryDirectory', side_effect=AssertionError('no dry-run scratch')):
            result = p.reverify(row, {no: [original]}, self.root, scratch_dir=scratch, dry_run=True)
        self.assertEqual(result['results'][0]['reason'], 'attachment_requires_approved_scratch')

    def test_coverage_gap_lists_only_later_absent_NPS_large_holding_originals(self):
        self.write('codex-verdicts.jsonl', [self.record(facts=[fact(stake_pct=5)])])
        folder = self.ledger / 'api-zips'
        folder.mkdir()
        rows = []
        for no, filing, reporter, kind in [('20251215000001', '2025-12-15', '국민연금공단', '주식등의대량보유상황보고서'),
                ('20251115000001', '2025-11-15', '국민연금공단', '주식등의대량보유상황보고서'),
                ('20251215000002', '2025-12-15', 'OTHER', '주식등의대량보유상황보고서'),
                ('20251215000003', '2025-12-15', '국민연금공단', '사업보고서'),
                ('20251202000001', '2025-12-02', '국민연금공단', '주식등의대량보유상황보고서')]:
            xml = f'<DOC><TE ACODE="RPT_RSP_NM">{reporter}</TE></DOC>'
            path = folder / (no + '.zip')
            path.write_bytes(worker_zip(xml, no + '.xml'))
            if no == '20251215000001':
                with p.zipfile.ZipFile(path, 'w') as stream:
                    stream.writestr(no + '.xml', xml.encode('cp949'))
            rows.append({'rcept_no': no, 'filing_date': filing, 'disclosure_company': 'SYNCO', 'report_kind': kind,
                'documents': [{'original_member_path': str(path.relative_to(self.root)) + '::' + no + '.xml'}]})
        self.write('corpus.jsonl', rows)
        report = p.reconcile(self.excel, self.artifacts, self.root)
        gaps = report['rows'][0]['coverage_gap']
        self.assertEqual([r['receipt_no'] for r in gaps['receipts']], ['20251215000001'])
        self.assertEqual(gaps['after_selected_observation'], '2025-12-01')
        self.assertEqual(gaps['receipts'][0]['filing_date'], '2025-12-15')
        self.assertTrue(gaps['receipts'][0]['file_path'].endswith('20251215000001.zip::20251215000001.xml'))
        self.assertIn('20251215000001', p.markdown(report))
        self.write('codex-verdicts.jsonl', [])
        report = p.reconcile(self.excel, self.artifacts, self.root)
        self.assertIsNone(report['rows'][0]['coverage_gap']['after_selected_observation'])
        self.assertEqual(len(report['rows'][0]['coverage_gap']['receipts']), 3)

    def test_numerically_equal_ratios_not_false_same_day_conflict(self):
        result = p.compare_ratio('7', self.names.resolve('SYNCO'), [observation(ratio_pct='7.0'), observation(ratio_pct='7.00')])
        self.assertEqual(result['category'], 'CONSISTENT')

    def test_cli_dry_run_creates_no_report(self):
        out = cli.ROOT / 'review-output/pipeline-test-unused'
        argv = ['runner', '--excel', str(self.excel), '--artifacts-root', str(self.artifacts),
                '--source-root', str(self.root), '--output-dir', str(out), '--dry-run']
        with patch.object(sys, 'argv', argv), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cli.main(), 0)
        self.assertFalse(out.exists())

    def test_append_only_live_input_uses_verified_initial_prefix(self):
        path = self.ledger / 'live.jsonl'
        path.write_text('{"n":1}\n')
        adapter = self.adapter()
        stream = adapter.rows(path)
        self.assertEqual(next(stream), {'n': 1})
        with path.open('a') as output:
            output.write('{"n":2}\n')
        self.assertEqual(list(stream), [])
        self.assertEqual(adapter.inventory[0]['rows'], 1)
        self.assertEqual(adapter.inventory[0]['append_only_bytes_during_read'], 8)
        self.assertEqual(adapter.inventory[0]['sha256'], hashlib.sha256(b'{"n":1}\n').hexdigest())

    def test_changed_prefix_is_rejected_even_if_size_grows(self):
        path = self.ledger / 'live.jsonl'
        path.write_text('{"n":1}\n')
        adapter = self.adapter()
        stream = adapter.rows(path)
        next(stream)
        path.write_text('{"n":9}\n{"n":2}\n')
        with self.assertRaisesRegex(ValueError, 'INPUT_CHANGED'):
            list(stream)

    def test_incomplete_live_tail_is_explicitly_not_used(self):
        path = self.ledger / 'live.jsonl'
        path.write_text('{"n":1}\n{"n":')
        adapter = self.adapter()
        self.assertEqual(list(adapter.rows(path)), [{'n': 1}])
        self.assertEqual(adapter.inventory[0]['ignored_incomplete_tail_bytes'], 5)

    def test_corrupt_json_fails_instead_of_zero_observations_pass(self):
        (self.ledger / 'codex-verdicts.jsonl').write_text('{bad}\n')
        with self.assertRaisesRegex(ValueError, 'NPS_PIPELINE_JSON'):
            self.adapter().load()


if __name__ == '__main__':
    unittest.main()
