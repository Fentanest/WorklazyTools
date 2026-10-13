"""Year-end ratio reconciliation THROUGH persisted NPS pipeline observations.

No quote/quantity estimate and no original-text discovery are used for comparison.
Original verification is a separate, discrepancy-only diagnostic; it cannot
replace the pipeline bracket or silently turn a discrepancy into a match.
"""
from __future__ import annotations

import gzip
import contextlib
import hashlib
import json
import re
import html
import tempfile
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

from pipeline.foliotrace import yearend, yearend_worker
from pipeline.foliotrace.nps_pipeline_adapter import GUARANTEES, NPS, NameMap, PipelineAdapter, day, number
from pipeline.foliotrace.yearend_reconcile import _safe_source

CATEGORIES = ('NO_DISCLOSURE_OBLIGATION', 'CONSISTENT', 'DISCREPANCY',
              'NO_PIPELINE_EVIDENCE', 'NAME_UNRESOLVED', 'SOURCE_CONFLICT_WITHIN_TOLERANCE')


def excel_ratio(raw):
    value = number(raw)
    if value is None or not Decimal('0') <= Decimal(value) <= Decimal('1'):
        raise ValueError('YEAREND_INVALID_OWNERSHIP_FRACTION')
    # Remove only SpreadsheetML binary-float serialization noise, not display
    # rounding. Thus 0.0776 stays 7.76, and 4.9999% still stays below 5%.
    return format((Decimal(value) * 100).quantize(Decimal('0.000000000001')), 'f')


def endpoint(observations, before, target):
    eligible = [o for o in observations if (o['base_date'] <= target) == before
                and o.get('position_scope') in (None, 'TOTAL_HOLDING')
                and not o.get('account_identifier') and not o.get('position_series_id')]
    if not eligible:
        return None
    bound = (max if before else min)(o['base_date'] for o in eligible)
    same_day = [o for o in eligible if o['base_date'] == bound]
    best = max(GUARANTEES[o['guarantee_level']] for o in same_day)
    used = [o for o in same_day if GUARANTEES[o['guarantee_level']] == best]
    # Conflicting same-day observations at the winning guarantee are visible;
    # no arbitrary receipt/file order chooses a convenient ratio.
    ratios = [format(value.normalize(), 'f') for value in sorted({Decimal(o['ratio_pct']) for o in used})]
    return {'base_date': bound, 'ratio_pct': ratios[0] if len(ratios) == 1 else None,
            'conflicting_ratios': ratios if len(ratios) > 1 else [],
            'evidence': used, 'lower_guarantee_observations': [o for o in same_day if o not in used]}


def compare_ratio(ratio, mapping, observations, target='2025-12-31'):
    below = Decimal(ratio) < 5
    result = {'disclosure_checkable': not below, 'ten_percent_or_more': Decimal(ratio) >= 10,
              'pre_yearend': None, 'post_yearend': None}
    if not mapping.get('issuer_stock_code'):
        result.update(category='NO_DISCLOSURE_OBLIGATION' if below else 'NAME_UNRESOLVED',
                      reason='below_five_percent' if below else mapping['reason'])
        return result
    subject = [o for o in observations if o['issuer_stock_code'] == mapping['issuer_stock_code']
               and o['security_class'] == mapping['security_class'] and (
                   mapping['security_class'] != 'preferred' or o.get('security_series') == mapping.get('security_series'))]
    pre, post = endpoint(subject, True, target), endpoint(subject, False, target)
    result.update(pre_yearend=pre, post_yearend=post)
    if below:
        fallen = pre and pre['ratio_pct'] is not None and Decimal(pre['ratio_pct']) < 5
        result.update(category='CONSISTENT' if fallen else 'NO_DISCLOSURE_OBLIGATION',
                      reason='last_report_below_five_percent' if fallen else 'below_five_percent')
        return result
    if pre is None:
        result.update(category='NO_PIPELINE_EVIDENCE', reason='no_usable_pre_yearend_observation')
        return result
    if pre['ratio_pct'] is None:
        within = all(abs(Decimal(ratio) - Decimal(r)) <= 1 for r in pre['conflicting_ratios'])
        result.update(category='SOURCE_CONFLICT_WITHIN_TOLERANCE' if within else 'DISCREPANCY',
                      reason='conflicting_same_day_pipeline_observations', tolerance_pp='1.00')
        return result
    delta = Decimal(ratio) - Decimal(pre['ratio_pct'])
    result.update(delta_pp=format(delta, 'f'), tolerance_pp='1.00',
                  category='CONSISTENT' if abs(delta) <= 1 else 'DISCREPANCY',
                  reason='within_one_percentage_point' if abs(delta) <= 1 else 'outside_one_percentage_point')
    if post and post['ratio_pct'] is not None:
        a, b = sorted([Decimal(pre['ratio_pct']), Decimal(post['ratio_pct'])])
        result['bracket'] = {'start': pre['base_date'], 'end': post['base_date'],
            'min_ratio_pct': format(a, 'f'), 'max_ratio_pct': format(b, 'f'),
            'excel_between_endpoints': a <= Decimal(ratio) <= b,
            'post_delta_pp': format(Decimal(ratio) - Decimal(post['ratio_pct']), 'f'),
            'interpretation': 'temporal_window_only; no monotonic trading path assumed'}
    return result


def large_holding_reporter(payload):
    """Read the explicit reporter field; legacy Korean originals use CP949."""
    try:
        text = payload.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = payload.decode('cp949')
    reporters = [html.unescape(re.sub(r'<[^>]+>', '', m)).strip() for m in
        re.findall(r'<TE\b[^>]*\bACODE=[\'"]RPT_RSP_NM[\'"][^>]*>(.*?)</TE>', text, re.S)]
    return reporters[0] if len(reporters) == 1 and reporters[0] in NPS else None


def coverage(adapter, wanted, gap_rows=(), source_root=None):
    """Receipt presence and requested read-only NPS large-holding lookup.

    Gap lookup identifies reporter/filing metadata only, never holding values.
    Filing dates are compared to the selected pre-year-end observation date;
    without a selected observation the lookup has no lower date bound.
    """
    originals, gaps = defaultdict(list), []
    gap_by_code = defaultdict(list)
    for row in gap_rows:
        row['coverage_gap'] = {'after_selected_observation': (row.get('pre_yearend') or {}).get('base_date'),
                               'date_basis': 'filing_date; no lower bound when no selected observation',
                               'receipts': [], 'lookup_errors': []}
        gap_by_code[row['mapping']['issuer_stock_code']].append(row)
    seen_gap = set()
    formal = adapter.receipts_by_kind['structured-holdings']
    all_pipeline = set().union(*adapter.receipts_by_kind.values())
    for ledger in sorted(adapter.root.glob('dart-api-ledger-*')):
        corpus = ledger / 'corpus.jsonl'
        unique, missing_formal, missing_any = set(), set(), set()
        for row in adapter.rows(corpus):
            no = row.get('rcept_no')
            if not no:
                continue
            unique.add(no)
            if no not in formal:
                missing_formal.add(no)
            if no not in all_pipeline:
                missing_any.add(no)
            if no in wanted:
                originals[no].append({'kind': 'api_zip', 'ledger': str(ledger), **row})
            if no in all_pipeline or '대량보유' not in (row.get('report_kind') or row.get('report_name') or ''):
                continue
            code = adapter.names.resolve(row.get('disclosure_company'))['issuer_stock_code']
            for target in gap_by_code.get(code, []):
                detail = target['coverage_gap']
                filing = day(row.get('filing_date'))
                if not filing or (detail['after_selected_observation'] and filing <= detail['after_selected_observation']):
                    continue
                for document in row.get('documents') or [{}]:
                    location = document.get('original_member_path') or ''
                    rel, _, member = location.partition('::')
                    archive = _safe_source(source_root, rel) if rel else ledger / 'api-zips' / (no + '.zip')
                    key = (target['row_sha256'], no, str(archive), member)
                    if key in seen_gap or not archive.is_file():
                        continue
                    seen_gap.add(key)
                    try:
                        with zipfile.ZipFile(archive) as stream:
                            members = [member] if member else [n for n in stream.namelist() if n.endswith('.xml')]
                            for selected in members:
                                payload = stream.read(selected)
                                reporter = large_holding_reporter(payload)
                                if reporter is None:
                                    continue
                                detail['receipts'].append({'receipt_no': no, 'filing_date': filing,
                                    'file_path': str(archive) + '::' + selected, 'reporter': reporter,
                                    'corpus_path': str(corpus), 'document_sha256': hashlib.sha256(payload).hexdigest()})
                    except (OSError, ValueError, zipfile.BadZipFile, KeyError, UnicodeError) as exc:
                        detail['lookup_errors'].append({'receipt_no': no, 'file_path': str(archive), 'error': type(exc).__name__})
        gaps.append({'ledger': ledger.name, 'corpus_unique_receipts': len(unique),
                     'absent_from_structured_holdings': len(missing_formal),
                     'absent_from_all_adapter_inputs': len(missing_any),
                     'later_than_20261008_build': ledger.name[-8:] > '20261008'})
    if wanted:
        for row in adapter.rows(adapter.root / 'dart-attachments/documents.jsonl'):
            if row.get('rcept_no') in wanted:
                originals[row['rcept_no']].append({'kind': 'attachment_raw', **row})
    return gaps, originals


def reverify(row, originals, source_root, *, scratch_dir=None, corpcode_path=None, dry_run=False):
    """Only called for DISCREPANCY; only invoke the fixed worker on local bytes."""
    if row['category'] != 'DISCREPANCY':
        raise ValueError('YEAREND_REVERIFY_ONLY_DISCREPANCY')
    outcomes, seen = [], set()
    mapping = row['mapping']
    for side in ('pre_yearend', 'post_yearend'):
        for obs in (row.get(side) or {}).get('evidence', []):
            for original in originals.get(obs['receipt_no'], []):
                documents = original.get('documents') or [{}]
                for document in documents:
                    if original['kind'] == 'api_zip':
                        location = document.get('original_member_path') or ''
                        archive_rel, _, member = location.partition('::')
                        archive = _safe_source(source_root, archive_rel) if archive_rel else Path(original['ledger']) / 'api-zips' / (obs['receipt_no'] + '.zip')
                        local = archive.is_file()
                    else:
                        archive = _safe_source(source_root, original.get('raw_path') or '')
                        member, local = 'attachment.xml', archive.is_file()
                    key = (str(archive), member, obs['base_date'], obs['ratio_pct'])
                    if key in seen or not local:
                        continue
                    seen.add(key)
                    summary = {'receipt_no': obs['receipt_no'], 'base_date': obs['base_date'],
                               'local_original': str(archive), 'original_kind': original['kind']}
                    try:
                        with contextlib.ExitStack() as stack:
                            if original['kind'] == 'attachment_raw':
                                if dry_run or scratch_dir is None:
                                    summary.update(outcome='comparison_pending_hold', reason='attachment_requires_approved_scratch')
                                    outcomes.append(summary); continue
                                payload = archive.read_bytes()
                                if archive.suffix == '.gz':
                                    payload = gzip.decompress(payload)
                                digest = hashlib.sha256(payload).hexdigest()
                                summary['source_sha256'] = digest
                                if original.get('source_sha256') != digest or original.get('whole_document_verified') is not True:
                                    summary.update(outcome='comparison_pending_hold', reason='attachment_hash_or_completeness_unverified')
                                    outcomes.append(summary); continue
                                tmp = stack.enter_context(tempfile.TemporaryDirectory(prefix='fty-reverify-', dir=scratch_dir))
                                prepared = Path(tmp) / (obs['receipt_no'] + '.zip')
                                with zipfile.ZipFile(prepared, 'w') as stream:
                                    stream.writestr(member, payload)
                                archive = prepared
                            registry = {'archive_path': archive.name,
                                        'archive_sha256': original.get('source_archive_sha256') if original['kind'] == 'api_zip' else hashlib.sha256(archive.read_bytes()).hexdigest()}
                            if member:
                                registry['inner_file_name'] = member
                                if document.get('source_sha256'):
                                    registry['inner_file_sha256'] = document['source_sha256']
                            # The worker re-verifies this observation's own date;
                            # its comparison state never enters the pipeline result.
                            request = {'request_key': hashlib.sha256(repr(key).encode()).hexdigest(),
                                'receipt_no': obs['receipt_no'], 'equity_target_corp': row['name'],
                                'stock_code': mapping['issuer_stock_code'], 'security_kind': mapping['security_class'],
                                'target_point': obs['base_date'], 'input_id': row['row_sha256'],
                                'clue': {'ownership_percent': obs['ratio_pct']}}
                            state = {'yearend_archive_registry': {obs['receipt_no']: registry}}
                            value = yearend_worker.process_followup(state, request, archive_dir=archive.parent, corpcode_path=corpcode_path)
                            summary.update({k: v for k, v in value.items() if k not in ('evidence', 'comparison', 'written')})
                            summary['failed'] = state.get('citation_followup_queue', {}).get(request['request_key'], {}).get('last_verification', {}).get('failed', [])
                    except (ValueError, OSError, RuntimeError, zipfile.BadZipFile, UnicodeError) as exc:
                        summary.update(outcome='comparison_pending_hold', reason=type(exc).__name__ + ':' + str(exc))
                    outcomes.append(summary)
    return {'status': 'performed' if outcomes else 'no_local_original', 'results': outcomes}


def reconcile(workbook, artifacts_root, source_root, *, target='2025-12-31', progress=None, scratch_dir=None, dry_run=False):
    if day(target) is None:
        raise ValueError('YEAREND_INVALID_TARGET')
    parsed = yearend.parse_yearend_workbook(workbook.read_bytes())
    corpfile = artifacts_root / 'dart-corpcode/corpcode.json'
    corpbytes = corpfile.read_bytes()
    names = NameMap(json.loads(corpbytes))
    corp_digest = hashlib.sha256(corpbytes).hexdigest()
    del corpbytes
    adapter = PipelineAdapter(artifacts_root, names, progress)
    observations = adapter.load()
    by_code = defaultdict(list)
    for observation in observations:
        by_code[observation['issuer_stock_code']].append(observation)
    details, counts = [], Counter({category: 0 for category in CATEGORIES})
    source_mix, guarantees = Counter(), Counter()
    for raw in parsed['rows']:
        ratio, mapped = excel_ratio(raw['ratio_raw']), names.resolve(raw['name'])
        row = {**raw, 'excel_ratio_pct': ratio, 'mapping': mapped,
               **compare_ratio(ratio, mapped, by_code[mapped['issuer_stock_code']], target)}
        counts[row['category']] += 1
        counts['excel_rows'] += 1
        counts['disclosure_checkable'] += int(row['disclosure_checkable'])
        counts['below_five_percent'] += int(not row['disclosure_checkable'])
        counts['ten_percent_or_more'] += int(row['ten_percent_or_more'])
        counts['name_unresolved_all_rows'] += int(mapped['issuer_stock_code'] is None)
        counts['below_five_consistent'] += int(not row['disclosure_checkable'] and row['category'] == 'CONSISTENT')
        counts['with_post_yearend_bracket'] += int(row['pre_yearend'] is not None and row['post_yearend'] is not None)
        for side in ('pre_yearend', 'post_yearend'):
            used = (row.get(side) or {}).get('evidence', [])
            for kind in {o['source_kind'] for o in used}:
                source_mix[side + ':' + kind] += 1
            for level in {o['guarantee_level'] for o in used}:
                guarantees[side + ':' + level] += 1
        details.append(row)
    discrep = [row for row in details if row['category'] == 'DISCREPANCY']
    wanted = {o['receipt_no'] for row in discrep for side in ('pre_yearend', 'post_yearend')
              for o in (row.get(side) or {}).get('evidence', [])}
    gap_rows = [row for row in details if row['category'] in ('DISCREPANCY', 'NO_PIPELINE_EVIDENCE')]
    gaps, originals = coverage(adapter, wanted, gap_rows, source_root)
    for row in gap_rows:
        row['coverage_gap']['receipts'].sort(key=lambda r: (r['filing_date'], r['receipt_no'], r['file_path']))
    reverify_counts = Counter()
    for index, row in enumerate(discrep, 1):
        row['original_reverification'] = reverify(row, originals, source_root, scratch_dir=scratch_dir,
                                                corpcode_path=corpfile, dry_run=dry_run)
        reverify_counts[row['original_reverification']['status']] += 1
        reverify_counts.update(r['outcome'] for r in row['original_reverification']['results'])
        if progress:
            progress({'discrepancy_reverified': index, 'total': len(discrep)})
    return {'schema': 'fty-pipeline-yearend-v1', 'target_point': target, 'counts': dict(counts),
            'evidence_source_mix': dict(source_mix), 'evidence_guarantee_mix': dict(guarantees),
            'pipeline_input_counts': dict(adapter.counts), 'rejected_observation_reasons': dict(adapter.rejected),
            'pipeline_coverage_gaps': gaps, 'original_reverification_counts': dict(reverify_counts),
            'methodology_order': {'basis': 'earliest observed reviewed_at per methodology_sha256 across both reviewers; missing hash ranks before known hashes',
                                  'first_observed': adapter.method_first_seen},
            'input_hashes': [{'path': str(workbook), 'sha256': parsed['workbook_sha256']},
                             {'path': str(corpfile), 'sha256': corp_digest}, *adapter.inventory],
            'rows': details, 'network': 'not_used', 'models': 'not_called',
            'limitations': ['CONSISTENT means the Excel ratio satisfies the requested 1%p disclosure tolerance, not an exact certified year-end balance.',
                            'Post-year-end observations bound time and describe endpoints; they never backdate holdings or assume monotonic trading.',
                            'Preferred classes require their own series; issuer totals and unspecified preferred series are not borrowed.',
                            'LLM reported ratios retain gate blockers and limitations; they are judgments, not Python or calculation guarantees.',
                            'R8 self-check evidence retains calculation_clearance=false and never promotes operating gates.',
                            'Original re-verification is limited to discrepancy receipts with local originals and does not replace the pipeline category.',
                            'Receipt coverage measures adapter input presence, not usable ratio/date/security evidence. Later-ledger counts are independent and may overlap.',
                            'Coverage gap lists identify exact registered issuer names, large-holding report metadata and an explicit NPS reporter field in local ZIP originals; they do not judge holdings. Empty lists cover this supported reporter grammar only.',
                            'Methodology chronology is inferred from first observed use, not a verified version registry.']}


def markdown(report):
    lines = ['# FolioTrace year-end reconciliation through DART NPS pipeline', '',
             f"Target: {report['target_point']}. Ratios use Excel fractions × 100 and ±1.00 percentage point.", '',
             '| Category / measure | Rows |', '| --- | ---: |']
    lines += [f'| {key} | {value} |' for key, value in report['counts'].items()]
    if report.get('category_comparison'):
        comparison = report['category_comparison']
        lines += ['', '## Category counts versus previous run', '',
                  f"Previous: `{comparison['previous_report']}` (SHA-256 {comparison['previous_sha256']}).", '',
                  '| Category | Previous | Current | Change |', '| --- | ---: | ---: | ---: |']
        lines += [f"| {key} | {value['previous']} | {value['current']} | {value['delta']:+d} |" for key, value in comparison['counts'].items()]
    conflicts = [row for row in report['rows'] if row['category'] == 'SOURCE_CONFLICT_WITHIN_TOLERANCE']
    if conflicts:
        lines += ['', '## Source conflicts within tolerance', '', '| Name | Excel % | Observation date | Source ratios % | Receipts |', '| --- | ---: | --- | --- | --- |']
        lines += [f"| {row['name']} | {row['excel_ratio_pct']} | {row['pre_yearend']['base_date']} | {', '.join(row['pre_yearend']['conflicting_ratios'])} | " +
                  ', '.join(sorted({o['receipt_no'] for o in row['pre_yearend']['evidence']})) + ' |' for row in conflicts]
    lines += ['', '## Evidence used (row endpoints; kinds can overlap)', '', '| Evidence source | Rows |', '| --- | ---: |']
    lines += [f'| {key} | {value} |' for key, value in sorted(report['evidence_source_mix'].items())]
    lines += ['', '| Guarantee | Rows |', '| --- | ---: |']
    lines += [f'| {key} | {value} |' for key, value in sorted(report['evidence_guarantee_mix'].items())]
    lines += ['', '## Discrepancies', '', '| Name / class | Excel % | Last pre-year-end (date / %) | Pre / post receipts | Original diagnostic |', '| --- | ---: | --- | --- | --- |']
    for row in report['rows']:
        if row['category'] != 'DISCREPANCY':
            continue
        pre = row['pre_yearend']
        receipts = ' / '.join(', '.join(sorted({o['receipt_no'] for o in (row.get(side) or {}).get('evidence', [])})) or 'none' for side in ('pre_yearend', 'post_yearend'))
        diagnostic = ', '.join(sorted({o['outcome'] for o in row['original_reverification']['results']})) or 'no_local_original'
        lines.append(f"| {row['name']} / {row['mapping']['security_class']} | {row['excel_ratio_pct']} | {pre['base_date']} / {pre['ratio_pct'] or pre['conflicting_ratios']} | {receipts} | {diagnostic} |")
    lines += ['', '## Pipeline coverage gaps (receipt presence)', '', '| Ledger | Corpus receipts | Absent structured-holdings | Absent all adapter inputs | After Oct 8 build |', '| --- | ---: | ---: | ---: | --- |']
    lines += [f"| {g['ledger']} | {g['corpus_unique_receipts']} | {g['absent_from_structured_holdings']} | {g['absent_from_all_adapter_inputs']} | {g['later_than_20261008_build']} |" for g in report['pipeline_coverage_gaps']]
    formal = next((x for x in report['input_hashes'] if x['path'].endswith('/structured-holdings.jsonl')), {})
    lines += ['', f"structured-holdings snapshot: {formal.get('rows', 0)} rows; filesystem mtime UTC {formal.get('mtime_utc', 'unknown')}; SHA-256 {formal.get('sha256', 'missing')}.", '',
              'Complete per-row brackets, guarantee levels, pipeline rejection counts, gate limitations, original diagnostics and source hashes are in `report.json`.', '',
              '## Coverage gap: collected NPS large-holding receipts absent from pipeline inputs', '',
              'Read-only filing-date lookup after the selected pre-year-end observation. No lower bound applies where an observation is absent. No holdings judgment is made.', '',
              '| Row / name | Selected observation | Receipt / filing date | Local original file |', '| --- | --- | --- | --- |']
    for row in report['rows']:
        if 'coverage_gap' not in row:
            continue
        gap = row['coverage_gap']
        for receipt in gap['receipts'] or [None]:
            lines.append(f"| {row['row_number']} / {row['name']} | {gap['after_selected_observation'] or 'none (unbounded)'} | " +
                         (f"{receipt['receipt_no']} / {receipt['filing_date']} | {receipt['file_path']} |" if receipt else 'none located | — |'))
    lines += ['', '## Limits', '', *['- ' + value for value in report['limitations']], '', 'Signature: Codx. Implementation / local verification; formal review pending.', '']
    return '\n'.join(lines)
