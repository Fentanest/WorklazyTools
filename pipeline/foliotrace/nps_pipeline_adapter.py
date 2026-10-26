"""Read-only adapter for persisted DART NPS judgments, never artifact Python code.

Ratios are percentage points. Issuer codes identify companies, while class/series
identify securities; preferred tickers are never guessed from a common ticker.
The adapter preserves held-but-unusable facts as rejection counts, not balances.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

NPS = {'국민연금공단', '국민연금기금', '국민연금관리공단', '국민연금'}
GUARANTEES = {'PYTHON_FORM_GUARANTEED': 3, 'PYTHON_LEGACY_GUARANTEED': 2,
              'PYTHON_BOUNDED_SELF_CHECK': 1, 'LLM_JUDGMENT': 0, 'ARCHIVE_REVALIDATED': 0}


def number(value):
    try:
        result = Decimal(str(value).replace(',', '').rstrip('%'))
        return format(result.normalize(), 'f') if result.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def day(value):
    try:
        return date.fromisoformat(value).isoformat() if isinstance(value, str) else None
    except ValueError:
        return None


def instant(value):
    try:
        return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat() if value else ''
    except ValueError:
        return ''


def reviewer_name(value):
    value = str(value or '').lower()
    return 'codex' if value in ('codx', 'codex') else value


def security(value):
    value = re.sub(r'\s+', '', str(value or '')).lower()
    if value in ('common', '보통주', '보통주식', '의결권있는주식'):
        return 'common'
    if value in ('preferred', '우선주', '우선주식', '의결권있는우선주', '의결권있는우선주식') or re.fullmatch(r'(?:\d+)?우(?:b|\(전환\))?', value):
        return 'preferred'
    return 'unknown'


class NameMap:
    """Exact unique registered names only; a preferred suffix selects a class."""
    def __init__(self, companies):
        self.names, self.corps = defaultdict(set), defaultdict(set)
        for company in companies:
            code = company.get('stock_code', '').strip()
            if not re.fullmatch(r'\d{6}', code):
                continue
            subject = (code, security(company.get('security_kind') or 'common'), None)
            self.names[company['corp_name']].add(subject)
            self.corps[company.get('corp_code')].add(code)

    def resolve(self, name):
        subjects = self.names.get(name, set())
        if not subjects:
            match = re.fullmatch(r'(.+?)(\d*우(?:B|\(전환\))?)', name or '')
            if match:
                subjects = {(code, 'preferred', match[2]) for code, cls, _ in
                            self.names.get(match[1].rstrip(), set()) if cls == 'common'}
        if len(subjects) == 1:
            code, cls, series = next(iter(subjects))
            return {'issuer_stock_code': code, 'security_class': cls, 'security_series': series,
                    'reason': 'exact_unique_registered_name' if name in self.names else 'exact_unique_issuer_preferred_suffix'}
        return {'issuer_stock_code': None, 'security_class': None, 'security_series': None,
                'reason': 'ambiguous_registered_name' if subjects else 'no_exact_registered_name'}

    def issuer(self, fact, record):
        code = fact.get('security_issuer_stock_code') or fact.get('holding_target_stock_code')
        if re.fullmatch(r'\d{6}', str(code or '')):
            return code
        corp = fact.get('security_issuer_corp_code') or fact.get('holding_target_corp_code')
        candidates = self.corps.get(corp, set()) if corp else set()
        if len(candidates) == 1:
            return next(iter(candidates))
        name = fact.get('security_issuer_company') or fact.get('holding_target_company')
        mapped = self.resolve(name)
        if mapped['issuer_stock_code']:
            return mapped['issuer_stock_code']
        # Only the pipeline's explicit self-target decision permits filer identity.
        if fact.get('is_disclosure_company_target') == 'same':
            return self.resolve(record.get('disclosure_company'))['issuer_stock_code']
        return None


class PipelineAdapter:
    def __init__(self, root: Path, names: NameMap, progress=None):
        self.root, self.names, self.progress = root, names, progress
        self.inventory, self.counts, self.rejected = [], Counter(), Counter()
        self.observations, self.receipts_by_kind = [], defaultdict(set)
        self.method_first_seen = {}

    def rows(self, path):
        if not path.is_file():
            self.inventory.append({'path': str(path), 'missing': True})
            return
        before = path.stat()
        digest, count, tail = hashlib.sha256(), 0, 0
        remaining = before.st_size
        with path.open('rb') as stream:
            while remaining:
                line = stream.readline(remaining)
                if not line:
                    raise ValueError(f'NPS_PIPELINE_INPUT_TRUNCATED:{path.name}')
                remaining -= len(line)
                digest.update(line)
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except ValueError:
                    if remaining == 0 and not line.endswith(b'\n'):
                        # An actively appended JSONL can end in an unfinished
                        # record at the snapshot boundary. Never use that tail.
                        tail = len(line)
                        break
                    raise ValueError(f'NPS_PIPELINE_JSON:{path.name}:{count + 1}') from None
                count += 1
                yield row
        # Verify the captured prefix, allowing append-only growth but never
        # silent replacement, truncation or edits to the bytes actually used.
        prefix, remaining = hashlib.sha256(), before.st_size
        with path.open('rb') as stream:
            while remaining:
                block = stream.read(min(1024 * 1024, remaining))
                if not block:
                    raise ValueError(f'NPS_PIPELINE_INPUT_TRUNCATED:{path.name}')
                prefix.update(block)
                remaining -= len(block)
        if prefix.digest() != digest.digest():
            raise ValueError(f'NPS_PIPELINE_INPUT_CHANGED:{path.name}')
        after = path.stat()
        self.inventory.append({'path': str(path), 'sha256': digest.hexdigest(), 'rows': count,
                               'snapshot_bytes': before.st_size, 'bytes': before.st_size,
                               'ignored_incomplete_tail_bytes': tail,
                               'append_only_bytes_during_read': max(0, after.st_size - before.st_size),
                               'mtime_utc': datetime.fromtimestamp(before.st_mtime, timezone.utc).isoformat()})
        self.counts[path.name] += count
        if self.progress:
            self.progress({'read': path.name, 'rows': count})

    def reject(self, reason):
        self.rejected[reason] += 1
        return []

    def formal(self, row, kind, guarantee, source=None):
        if row.get('guaranteed') is not True or row.get('failures'):
            return self.reject('formal_not_guaranteed')
        if row.get('reporter') not in NPS:
            return self.reject('formal_not_nps_reporter')
        cls = security(row.get('security_kind') or row.get('security_class'))
        basis = 'explicit_class'
        if cls == 'unknown':
            kinds = {security(t.get('kind')) for t in row.get('trades', [])}
            if row.get('form') in ('A1_LARGE_HOLDING', 'A3_MAJOR_SHAREHOLDER_CHANGE') and (not kinds or kinds == {'common'}):
                cls, basis = 'common', 'formal_voting_share_ratio'
            elif row.get('form') == 'A2_INSIDER_OWNERSHIP' and kinds == {'common'} and (
                    number(row.get('trade_sum_after')) == number(row.get('shares')) and row.get('shares') is not None):
                cls, basis = 'common', 'common_trade_endpoint_equals_form_stock_balance'
            else:
                return self.reject('formal_class_mixed_or_unknown')
        code, ratio, base = row.get('issuer_stock_code'), number(row.get('ratio_pct')), day(row.get('base_date'))
        if not re.fullmatch(r'\d{6}', str(code or '')) or ratio is None or not base:
            return self.reject('formal_subject_ratio_or_date_missing')
        if not Decimal('0') <= Decimal(ratio) <= Decimal('100'):
            return self.reject('ratio_out_of_range')
        return [{'issuer_stock_code': code, 'security_class': cls, 'security_series': row.get('security_series'),
                 'ratio_pct': ratio, 'shares': number(row.get('shares')), 'base_date': base,
                 'receipt_no': row['rcept_no'], 'source_kind': kind, 'guarantee_level': guarantee,
                 'source_sha256': row.get('evidence_sha256') or (source or {}).get('evidence_sha256'),
                 'parser': row.get('parser'), 'security_basis': basis,
                 'source_status': (source or {}).get('status', 'GUARANTEED'),
                 'calculation_clearance': False if guarantee == 'PYTHON_BOUNDED_SELF_CHECK' else None}]

    def facts(self, record, kind, dates, excluded):
        no, source = record.get('rcept_no'), record.get('evidence_sha256')
        if record.get('validation_errors') or record.get('status') in ('NOT_CONFIRMED', 'NOT_USABLE_MASKED', 'NO_BASE_DATE', 'HOLD', 'FAILED'):
            return self.reject('record_status_unusable')
        result = []
        for fact in record.get('facts', []):
            if fact.get('holding_verdict') not in ('HELD_CONFIRMED', 'NOT_HELD_EXPLICIT') or fact.get('record_kind') not in ('EQUITY_HOLDING', 'EQUITY_CHANGE', 'EXPLICIT_ZERO'):
                self.reject('not_confirmed_equity'); continue
            if not no or not source or not fact.get('fact_id'):
                self.reject('unbound_fact'); continue
            if fact.get('holder_entity') not in NPS or fact.get('is_aggregate_holder_value') is True or fact.get('is_hypothetical') is True:
                self.reject('holder_aggregate_or_hypothetical'); continue
            if fact.get('is_duplicate_observation') is True:
                self.reject('duplicate_position'); continue
            if fact.get('quantity_status') in ('MASKED', 'NOT_USABLE_MASKED') or fact.get('share_scope') != 'SHARES_ONLY':
                self.reject('masked_or_nonshare_scope'); continue
            code, cls = self.names.issuer(fact, record), security(fact.get('security_type'))
            base = day(fact.get('base_date'))
            binding = dates.get((no, source, fact.get('fact_id'), reviewer_name(record.get('reviewer'))))
            origin = 'pipeline_fact'
            if not base or fact.get('base_date_kind') in ('FILING_DATE', 'DISPLAY_DATE', 'UNKNOWN'):
                base = day((binding or {}).get('derived_base_date'))
                if (binding or {}).get('basis') == 'NOT_DERIVABLE':
                    base = None
                if base:
                    origin = binding
            if no in excluded and not base:
                self.reject('excluded_no_base_date'); continue
            if not base:
                self.reject('no_holding_base_date'); continue
            ratio = number(fact.get('stake_pct'))
            if ratio is None:
                ratio = number(fact.get('stake_pct_after'))
            if not code or cls == 'unknown' or ratio is None:
                self.reject('llm_subject_class_or_ratio_missing'); continue
            if not Decimal('0') <= Decimal(ratio) <= Decimal('100'):
                self.reject('ratio_out_of_range'); continue
            if fact.get('holding_verdict') == 'NOT_HELD_EXPLICIT' and Decimal(ratio) != 0:
                self.reject('nonzero_not_held'); continue
            shares = number(fact.get('shares_held') if fact.get('shares_held') is not None else fact.get('shares_after'))
            if fact.get('record_kind') == 'EXPLICIT_ZERO' and (
                    fact.get('holding_verdict') != 'NOT_HELD_EXPLICIT' or Decimal(ratio) != 0 or
                    (shares is not None and Decimal(shares) != 0)):
                self.reject('explicit_zero_semantics_unverified'); continue
            result.append({'issuer_stock_code': code, 'security_class': cls,
                'security_series': fact.get('security_series'), 'ratio_pct': ratio,
                'shares': shares, 'position_scope': fact.get('position_scope'),
                'position_series_id': fact.get('position_series_id'), 'account_identifier': fact.get('account_identifier'),
                'base_date': base, 'receipt_no': no, 'source_kind': kind,
                'guarantee_level': 'ARCHIVE_REVALIDATED' if kind == 'archive-judgments' else 'LLM_JUDGMENT',
                'source_sha256': source, 'document_sha256': fact.get('evidence_sha256'),
                'evidence_document_no': fact.get('evidence_document_no'), 'fact_id': fact.get('fact_id'),
                'methodology_sha256': record.get('methodology_sha256'), 'reviewer': record.get('reviewer'),
                'reviewed_at': record.get('reviewed_at'), 'source_status': fact.get('holding_verdict'),
                'ratio_observation_ready': fact.get('ratio_observation_ready'),
                'computation_blockers': fact.get('computation_blockers', []),
                'limitations': fact.get('limitations', []),
                'base_date_origin': origin})
        return result

    def load(self):
        ledger = self.root / 'dart-api-ledger-20261004'
        dates, excluded = {}, set()
        for row in self.rows(ledger / 'derived-base-dates.jsonl'):
            key = (row.get('rcept_no'), row.get('evidence_sha256'), row.get('fact_id'), reviewer_name(row.get('reviewer')))
            if key not in dates or instant(row.get('at')) >= instant(dates[key].get('at')):
                dates[key] = row
        for row in self.rows(ledger / 'excluded-no-base-date.jsonl'):
            if row.get('status') == 'NO_BASE_DATE':
                excluded.add(row.get('rcept_no'))
        for path, kind, guarantee in [(self.root / 'dart-attachments/structured-holdings.jsonl', 'structured-holdings', 'PYTHON_FORM_GUARANTEED')] + [
                (p, 'structured-parse-results', 'PYTHON_LEGACY_GUARANTEED') for p in sorted(ledger.glob('structured-parse-results*.jsonl'))]:
            for row in self.rows(path):
                self.receipts_by_kind[kind].add(row.get('rcept_no'))
                self.observations.extend(self.formal(row, kind, guarantee))
        for row in self.rows(ledger / 'structured-r8-observations.jsonl'):
            self.receipts_by_kind['structured-r8'].add(row.get('rcept_no'))
            envelope = row.get('envelope', {})
            if row.get('status') != 'BOUNDED_SELF_CHECK_PASS' or envelope.get('parser_self_check_guaranteed') is not True:
                self.reject('r8_hold'); continue
            self.observations.extend(self.formal(envelope.get('parser_result', {}), 'structured-r8', 'PYTHON_BOUNDED_SELF_CHECK', row))
        candidates = {}
        for filename in ('codex-verdicts.jsonl', 'muse-verdicts.jsonl', 'archive-judgments.jsonl'):
            kind = filename.removesuffix('.jsonl')
            for row in self.rows(ledger / filename):
                if kind == 'archive-judgments':
                    check = row.get('revalidation', {})
                    if check.get('status') != 'PASS' or row.get('corpus_binding', {}).get('status') != 'MATCHED_LATEST':
                        self.reject('archive_not_revalidated_or_bound'); continue
                    record = {**check.get('normalized', {}), 'reviewer': 'archive'}
                    record['evidence_sha256'] = row.get('evidence_sha256')
                else:
                    record = row
                no, source, method = record.get('rcept_no'), record.get('evidence_sha256'), record.get('methodology_sha256')
                self.receipts_by_kind[kind].add(no)
                if not no or not source:
                    self.reject('unbound_judgment'); continue
                at = instant(record.get('reviewed_at'))
                if method:
                    self.method_first_seen[method] = min(self.method_first_seen.get(method, at), at)
                reviewer = record.get('reviewer') or kind
                key = (no, source, method, reviewer)
                if key not in candidates or at >= candidates[key]['at']:
                    candidates[key] = {'at': at, 'observations': self.facts(record, kind, dates, excluded)}
        # SHA values are identities, never lexicographic versions. The first
        # observed use of each hash orders methodologies across both reviewers.
        ranks = {h: index + 1 for index, h in enumerate(sorted(self.method_first_seen, key=lambda h: self.method_first_seen[h]))}
        latest = defaultdict(int)
        for no, source, method, _ in candidates:
            latest[no, source] = max(latest[no, source], ranks.get(method, 0))
        for (no, source, method, _), candidate in candidates.items():
            if ranks.get(method, 0) == latest[no, source]:
                self.observations.extend(candidate['observations'])
            else:
                self.counts['superseded_judgments'] += 1
        self.counts['normalized_observations'] = len(self.observations)
        return self.observations
