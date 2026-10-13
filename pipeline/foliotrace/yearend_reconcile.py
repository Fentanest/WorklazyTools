"""Read-only local year-end discovery and reconciliation. No network or model calls.

The comparison is with the supplied tracked snapshot, with its actual dates and
scope kept visible. It does not silently backdate today's tracking to year-end.
Excel quantities are derived ONLY from a verified, unadjusted target-date quote;
ratio-only comparisons remain available when that historical quote is missing.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from collections import Counter, defaultdict, deque
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from pipeline.foliotrace import yearend, yearend_worker


def _digest(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def _jsonl(path):
    with path.open(encoding='utf-8') as stream:
        for line_no, line in enumerate(stream, 1):
            if line.strip():
                try:
                    yield json.loads(line)
                except ValueError:
                    raise ValueError(f'YEAREND_INDEX_JSON:{path.name}:{line_no}') from None


def _safe_source(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('YEAREND_SOURCE_PATH')
    return path


class NameHints:
    """Literal multi-name discovery in one pass; never semantic verification."""
    def __init__(self, names):
        self.transitions, self.failures, self.outputs = [{}], [0], [[]]
        for name in sorted(set(names)):
            node = 0
            for character in name:
                if character not in self.transitions[node]:
                    self.transitions[node][character] = len(self.transitions)
                    self.transitions.append({})
                    self.failures.append(0)
                    self.outputs.append([])
                node = self.transitions[node][character]
            self.outputs[node].append(name)
        queue = deque(self.transitions[0].values())
        while queue:
            node = queue.popleft()
            for character, child in self.transitions[node].items():
                queue.append(child)
                failure = self.failures[node]
                while failure and character not in self.transitions[failure]:
                    failure = self.failures[failure]
                self.failures[child] = self.transitions[failure].get(character, 0)
                self.outputs[child] += self.outputs[self.failures[child]]

    def findall(self, text):
        node, found = 0, set()
        for character in text:
            while node and character not in self.transitions[node]:
                node = self.failures[node]
            node = self.transitions[node].get(character, 0)
            found.update(self.outputs[node])
        return found


def local_index(artifacts_root, source_root, since, until, discovery_names=(), progress=None):
    """Receipt/name discovery is an auxiliary lead, never issuer proof."""
    by_name = defaultdict(dict)
    receipts = {}
    inventory = []
    for ledger in sorted(artifacts_root.glob('dart-api-ledger-*')):
        corpus = ledger / 'corpus.jsonl'
        manifest = ledger / 'manifest.json'
        if manifest.is_file():
            inventory.append({'path': str(manifest), 'sha256': _digest(manifest), 'kind': 'manifest'})
        if not corpus.is_file():
            continue
        inventory.append({'path': str(corpus), 'sha256': _digest(corpus), 'kind': 'corpus'})
        for row in _jsonl(corpus):
            no = row.get('rcept_no')
            if not no or not re.fullmatch(r'\d{14}', no):
                continue
            if not since <= no[:8] <= until:
                continue
            documents_by_archive = defaultdict(list)
            for document in row.get('documents', []):
                archive_relative = (document.get('original_member_path') or '').split('::')[0]
                if archive_relative:
                    archive_path = _safe_source(source_root, archive_relative)
                    if archive_path.parent.name != 'api-zips' or not archive_path.parent.parent.name.startswith('dart-api-ledger-'):
                        continue
                    directory = archive_path.parent
                else:
                    directory = ledger / 'api-zips'
                documents_by_archive[str(directory)].append(document)
            if not documents_by_archive:
                documents_by_archive[str(ledger / 'api-zips')] = []
            prior = receipts.setdefault(no, [])
            for directory, documents_in_archive in documents_by_archive.items():
                entry = {'receipt_no': no, 'filing_date': row.get('filing_date'),
                         'discovery_name': row.get('disclosure_company'), 'report_name': row.get('report_name'),
                         'archive_dir': directory, 'documents': documents_in_archive,
                         'archive_sha256': row.get('source_archive_sha256'), 'source_complete': row.get('source_complete'),
                         'attachments': []}
                if entry not in prior:
                    prior.append(entry)
            if row.get('disclosure_company'):
                by_name[row['disclosure_company']][no] = prior
        if progress:
            progress({'indexed_ledger': ledger.name, 'eligible_receipts': len(receipts)})
    name_hints = NameHints(discovery_names) if discovery_names else None
    documents = artifacts_root / 'dart-attachments' / 'documents.jsonl'
    if documents.is_file():
        inventory.append({'path': str(documents), 'sha256': _digest(documents), 'kind': 'attachments_index'})
        for attachment_index, row in enumerate(_jsonl(documents), 1):
            if progress and attachment_index % 5000 == 0:
                progress({"attachment_index_rows": attachment_index})
            no = row.get('rcept_no')
            if not no or not since <= no[:8] <= until:
                continue
            entries = receipts.setdefault(no, [{'receipt_no': no, 'filing_date': None, 'archive_dir': None,
                                               'documents': [], 'attachments': []}])
            if row.get('plain_path'):
                path = _safe_source(source_root, row['plain_path'])
                attachment = {'path': str(path), 'sha256': row.get('plain_sha256'),
                              'document_no': row.get('document_no'), 'whole_document_verified': row.get('whole_document_verified')}
                if name_hints and path.is_file():
                    text = path.read_text(encoding='utf-8')
                    if any(owner in text for owner in yearend_worker.NPS_NAMES):
                        for name in set(name_hints.findall(text)):
                            by_name[name][no] = entries
                for entry in entries:
                    if attachment not in entry['attachments']:
                        entry['attachments'].append(attachment)
    return by_name, receipts, inventory


def _tracked_rows(tracked):
    if isinstance(tracked.get('holdings'), list):
        # Explicit public snapshot schema.
        return [{'name': r.get('name'), 'corp_code': r.get('corpCode'), 'stock_code': r.get('stockCode'),
                 'security_kind': r.get('securityKind'), 'quantity': r.get('quantity'),
                 'company_ownership_percent': r.get('companyOwnershipPercent'), 'holding_date': r.get('holdingDate'),
                 'receipt_no': r.get('receiptNo'), 'evidence': r.get('evidence')}
                for r in tracked['holdings']]
    return list((tracked.get('holdings') or {}).values())


def _followup_entry(state, raw, baseline, mapped, args, initial, entry, *, by_name, by_receipt,
                    candidate_since, target_point, output_dir, llm_adapter, counts, outcome_counts,
                    secured_receipts, fetch, prefix=''):
    stock, security = mapped if mapped else (None, None)
    # Discover by exact issuer name and explicitly tracked receipts. This
    # does not borrow another input's comparison or confirm issuer identity.
    candidate_receipts = set(by_name.get(raw['name'], {}))
    if baseline and baseline.get('receipt_no'):
        candidate_receipts.add(baseline['receipt_no'])
    candidate_receipts = sorted(no for no in candidate_receipts
        if candidate_since.replace('-', '') <= no[:8] <= (str(int(target_point[:4]) + 1) + '1231'))
    if entry['classification'] != 'matched':
        local_count = 0
        for no in candidate_receipts:
            originals = by_receipt.get(no) or [{'receipt_no': no, 'archive_dir': None, 'attachments': [], 'documents': []}]
            for source in originals:
                archive_dir = Path(source['archive_dir']) if source.get('archive_dir') else None
                local_zip = archive_dir / (no + '.zip') if archive_dir else None
                local_attachments = []
                for attachment in source.get('attachments', []):
                    path = Path(attachment['path'])
                    if path.is_file():
                        local_attachments.append({**attachment, 'hash_verified': _digest(path) == attachment['sha256']})
                if any(a['hash_verified'] and a['whole_document_verified'] for a in local_attachments):
                    secured_receipts.add(no)
                is_local = bool(local_zip and local_zip.is_file()) or any(a['hash_verified'] and a['whole_document_verified'] for a in local_attachments)
                local_count += int(is_local)
                request = {'request_key': hashlib.sha256((initial['key'] + '|' + no + '|' + str(archive_dir)).encode()).hexdigest(),
                           'receipt_no': no, 'equity_target_corp': raw['name'], 'corp_code': baseline.get('corp_code') if baseline else None,
                           'excel_eval_eok_raw': raw['eval_eok_raw'], 'excel_ratio_display': args['excel_ratio_display'],
                           'derived_estimate': args['derived_estimate'], 'price_date': args['price_date'],
                           'stock_code': stock, 'security_kind': security, 'target_point': target_point, 'input_id': args['input_id']}
                # Honor expected hashes / inner document choice from corpus;
                # multi-member ZIPs remain explicit per-document requests.
                documents = source.get('documents') or [{}]
                for document in documents:
                    member = (document.get('original_member_path') or '').split('::')[-1]
                    job = dict(request)
                    if member:
                        job['request_key'] += '-' + hashlib.sha256(member.encode()).hexdigest()[:12]
                    if source.get('archive_sha256'):
                        registry = {no: {
                            'archive_path': no + '.zip', 'archive_sha256': source['archive_sha256'],
                            **({'inner_file_name': member, 'inner_file_sha256': document.get('source_sha256')} if member else {})}}
                    else:
                        registry = {}
                    job_state = {'yearend_archive_registry': registry,
                                 'yearend_comparison': {initial['key']: copy.deepcopy(state['yearend_comparison'][initial['key']])}}
                    stored = None
                    if llm_adapter is not None:
                        stored = {job['request_key']: llm_adapter.propose_clue(job)}
                    result = yearend_worker.process_followup(job_state, job, archive_dir=archive_dir, output_dir=output_dir, stored_responses=stored)
                    if job_state['citation_followup_queue'][job['request_key']].get('last_lookup', {}).get('status') == 'archive_hit':
                        secured_receipts.add(no)
                    state['citation_followup_queue'].update(job_state['citation_followup_queue'])
                    state['yearend_archive_registry'].update(job_state['yearend_archive_registry'])
                    outcome_counts[result['outcome']] += 1
                    if result.get('lookup_status') in ('missing_original', 'origin_unverified_cache_claim',
                            'archive_corrupt', 'archive_hash_mismatch', 'inner_file_missing') and not any(
                            a['hash_verified'] and a['whole_document_verified'] for a in local_attachments):
                        fetch.add(no)
                    evidence = result.get('evidence') or {}
                    supported_yearend = bool(yearend_worker.holding_basis(evidence) and
                        yearend_worker.holding_basis(evidence)['text'] == target_point and mapped and security in ('common', 'preferred') and
                        result['outcome'] == 'resolved_verified_hold')
                    summary = {k: v for k, v in result.items() if k not in ('evidence', 'comparison', 'written')}
                    summary.update(receipt_no=no, archive_path=str(local_zip) if local_zip else None,
                                   local_original=is_local, attachments=local_attachments,
                                   verified_yearend=supported_yearend,
                                   evidence_quantity=evidence.get('quantity'), evidence_ratio=evidence.get('ownership_percent'),
                                   evidence_date_bindings=evidence.get('date_bindings', []),
                                   evidence_fingerprint=(job_state['citation_followup_queue'][job['request_key']].get('verification') or {}).get('evidence_sha256'))
                    entry['candidate_results'].append(summary)
                if not is_local:
                    fetch.add(no)
        entry['has_local_candidate'] = local_count > 0
        counts[prefix + ('differences_with_local_candidates' if local_count else 'differences_without_local_candidates')] += 1
        accepted = [r for r in entry['candidate_results'] if r['verified_yearend']]
        distinct = {(Decimal(r['evidence_quantity']) if r['evidence_quantity'] is not None else None,
                     Decimal(r['evidence_ratio']) if r['evidence_ratio'] is not None else None) for r in accepted}
        entry['followup_status'] = 'verified' if len(distinct) == 1 else 'pending'
        entry['followup_reason'] = 'conflicting_verified_candidates' if len(distinct) > 1 else 'source_verified' if accepted else 'no_supported_yearend_subject_basis'
        counts[prefix + ('verified' if entry['followup_status'] == 'verified' else 'pending_followup')] += 1
        if entry['followup_status'] == 'verified':
            accepted_source = accepted[0]
            yearend.compare_yearend(state, raw['name'], **args,
                disclosure_quantity=accepted_source['evidence_quantity'],
                disclosure_ratio_display=accepted_source['evidence_ratio'],
                disclosure_basis_date=target_point, disclosure_basis_role='shareholder_register_date',
                disclosure_receipt_no=accepted_source['receipt_no'], basis_confirmed=True, scope_confirmed=True,
                evidence_fingerprint=accepted_source['evidence_fingerprint'], note='unique source-bound year-end candidate')
        else:
            yearend.compare_yearend(state, raw['name'], **args,
                hold_reason='comparison_pending_hold', note=entry['followup_reason'])


def reconcile(workbook, tracked_path, artifacts_root, source_root, *, output_dir=None,
              target_point='2025-12-31', price_date='2025-12-30', candidate_since='2025-01-01',
              llm_adapter=None, progress=None):
    """Return report + isolated state. An optional adapter proposes stored clues.

    Default is deterministic/offline. Caller owns adapter execution permissions;
    this CLI never supplies one. Operating files are never written.
    """
    payload = workbook.read_bytes()
    parsed = yearend.parse_yearend_workbook(payload)
    tracked = json.loads(tracked_path.read_text(encoding='utf-8'))
    state = {}
    yearend.ensure_yearend_ledgers(state)
    rows = _tracked_rows(tracked)
    exact = defaultdict(list)
    names = defaultdict(set)
    for row in rows:
        subject = (row.get('stock_code'), row.get('security_kind'))
        exact[subject].append(row)
        if row.get('name') and subject[0] and subject[1] in ('common', 'preferred'):
            names[row['name']].add(subject)
    # The universe supplies exact registered name/code leads, not preferred
    # ticker guesses or a guarantee of current holdings.
    for company in (tracked.get('universe') or {}).values():
        if company.get('stock_code') and company.get('name'):
            classes = {r.get('security_kind') for r in rows if r.get('stock_code') == company['stock_code']}
            security = company.get('security_kind') or (next(iter(classes)) if len(classes) == 1 else None)
            names[company['name']].add((company['stock_code'], security))
    by_name, by_receipt, inventory = local_index(artifacts_root, source_root, candidate_since.replace('-', ''),
        str(int(target_point[:4]) + 1) + '1231', [r['name'] for r in parsed['rows']] +
        [r['name'] for r in rows if r.get('name')], progress)
    details = []
    counts = Counter()
    matched_subjects = set()
    fetch = set()
    secured_receipts = set()
    outcome_counts = Counter()
    for index, raw in enumerate(parsed['rows']):
        saved = {**raw, 'workbook_sha256': parsed['workbook_sha256']}
        input_id = yearend.store_excel_input(state, saved)['key']
        mappings = names.get(raw['name'], set())
        mapped = next(iter(mappings)) if len(mappings) == 1 else None
        stock, security = mapped if mapped else (None, None)
        candidates_tracked = exact.get(mapped, []) if mapped else []
        baseline = candidates_tracked[0] if len(candidates_tracked) == 1 else None
        if mapped and baseline:
            matched_subjects.add(mapped)
        # SpreadsheetML percentages are stored as fractions. Keep raw bytes
        # immutable; quantize only the displayed comparison to two decimals.
        ratio = format((Decimal(yearend.normalize_number(raw['ratio_raw'])) * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP), 'f') if raw['ratio_raw'] else None
        derived = None
        quote = (tracked.get('quote_cache') or {}).get(stock) or {}
        if (raw['eval_eok_raw'] and quote.get('verified') is True and quote.get('trade_date') == price_date
                and quote.get('adjusted') is False and quote.get('currency') == 'KRW'
                and quote.get('market') == 'KRX' and quote.get('session') == 'regular'):
            derived = yearend.derive_quantity_estimate(raw['eval_eok_raw'], quote['close'], price_date)
            yearend.store_derived_quantity(state, input_id, derived)
        equal = yearend._equal_numeric(ratio, baseline.get('company_ownership_percent')) if baseline and ratio else None
        if not mapped or not baseline:
            classification = 'foliotrace_missing'
        elif equal is True and (derived is None or yearend._equal_numeric(
                derived['derived_quantity_estimate'], baseline.get('quantity')) is not False):
            classification = 'matched'
        elif equal is False or (derived and yearend._equal_numeric(derived['derived_quantity_estimate'], baseline.get('quantity')) is False):
            classification = 'differing'
        else:
            classification = 'pending'
        counts[classification] += 1
        args = dict(excel_eval_eok_raw=raw['eval_eok_raw'], excel_ratio_display=ratio,
                    derived_estimate=derived['derived_quantity_estimate'] if derived else None,
                    price_date=price_date if derived else None, security_kind=security, stock_code=stock,
                    target_point=target_point, input_id=input_id)
        initial = yearend.compare_yearend(state, raw['name'], **args,
            disclosure_quantity=baseline.get('quantity') if baseline else None,
            disclosure_ratio_display=baseline.get('company_ownership_percent') if baseline else None,
            disclosure_basis_date=baseline.get('holding_date') if baseline else None,
            disclosure_basis_role='writing_basis_date' if baseline and baseline.get('holding_date') else None,
            disclosure_receipt_no=baseline.get('receipt_no') if baseline else None,
            basis_confirmed=False, scope_confirmed=False, note='tracked snapshot comparison; original scope/date retained separately')
        entry = {'input_id': input_id, 'subject_key': initial['key'], 'name': raw['name'],
                 'stock_code': stock, 'security_kind': security, 'mapping_status': 'exact_unique_name' if mapped else 'unmapped_or_ambiguous',
                 'classification': classification, 'excel_ratio_display': ratio,
                 'derived_quantity_estimate': args['derived_estimate'], 'price_status': 'verified_target_quote' if derived else 'historical_quote_missing',
                 'tracked': baseline, 'tracking_date_matches_target': bool(baseline and baseline.get('holding_date') == target_point),
                 'candidate_results': []}
        _followup_entry(state, raw, baseline, mapped, args, initial, entry,
            by_name=by_name, by_receipt=by_receipt, candidate_since=candidate_since, target_point=target_point,
            output_dir=output_dir, llm_adapter=llm_adapter, counts=counts, outcome_counts=outcome_counts,
            secured_receipts=secured_receipts, fetch=fetch)
        details.append(entry)
        if progress and ((index + 1) % 10 == 0 or index + 1 == parsed['row_count']):
            progress({'excel_rows_processed': index + 1, 'candidate_requests': sum(outcome_counts.values())})
    excel_missing = [r for subject, values in exact.items() if subject not in matched_subjects for r in values]
    # Tracked subjects absent from Excel are differences too. Preserve null
    # Excel fields; never create an invented Excel row or quantity for them.
    for missing_index, baseline in enumerate(excel_missing):
        mapped = (baseline.get('stock_code'), baseline.get('security_kind'))
        raw = {'name': baseline.get('name') or str(mapped[0]), 'eval_eok_raw': None}
        args = dict(excel_eval_eok_raw=None, excel_ratio_display=None, derived_estimate=None,
                    price_date=None, security_kind=mapped[1], stock_code=mapped[0],
                    target_point=target_point, input_id=None)
        initial = yearend.compare_yearend(state, raw['name'], **args,
            hold_reason='comparison_pending_hold', note='Excel counterpart absent; no Excel value fabricated')
        entry = {**baseline, 'subject_key': initial['key'], 'classification': 'excel_missing',
                 'tracked': baseline.copy(), 'candidate_results': []}
        _followup_entry(state, raw, baseline, mapped, args, initial, entry,
            by_name=by_name, by_receipt=by_receipt, candidate_since=candidate_since, target_point=target_point,
            output_dir=output_dir, llm_adapter=llm_adapter, counts=counts, outcome_counts=outcome_counts,
            secured_receipts=secured_receipts, fetch=fetch, prefix='excel_missing_')
        excel_missing[missing_index] = entry
        if progress and ((missing_index + 1) % 10 == 0 or missing_index + 1 == len(excel_missing)):
            progress({'excel_missing_processed': missing_index + 1, 'candidate_requests': sum(outcome_counts.values())})
    fetch -= secured_receipts
    counts['excel_missing'] = len(excel_missing)
    counts['excel_rows'] = parsed['row_count']
    counts['tracked_rows'] = len(rows)
    report = {'schema_version': 1, 'target_point': target_point, 'price_date': price_date,
              'comparison_mode': 'supplied_tracking_snapshot_with_original_dates; not_backdated',
              'candidate_since': candidate_since, 'candidate_until': str(int(target_point[:4]) + 1) + '-12-31',
              'counts': dict(counts), 'candidate_outcomes': dict(outcome_counts),
              'receipts_need_fetching': sorted(fetch), 'receipts_need_fetching_count': len(fetch),
              'inputs': [{'path': str(workbook), 'sha256': parsed['workbook_sha256']},
                         {'path': str(tracked_path), 'sha256': _digest(tracked_path)}, *inventory],
              'limitations': ['Numbers matching a newer/older tracked date do not confirm the year-end balance.',
                  'No historical quantity is derived without a verified 2025-12-30 price.',
                  'Only exact unique registered names map to stock/security subjects; unclassified names remain pending.',
                  'Discovery-name matches only identify candidates. Original issuer/header and row/date/security proof gates verification.',
                  'Unsupported source layouts and web plain text remain pending; no model accuracy claim.'],
              'rows': details, 'excel_missing': excel_missing, 'network': 'disabled',
              'model_adapter': 'none' if llm_adapter is None else 'injected'}
    return report, state
