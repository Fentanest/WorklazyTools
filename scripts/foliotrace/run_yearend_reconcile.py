#!/usr/bin/env python3
"""Offline year-end reconciliation using read-only Excel, tracking and DART inputs.

All outputs must be inside this worktree. No credentials, network, DART requests
or model providers are used. --dry-run writes no files or directories.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from pipeline.foliotrace import yearend, yearend_reconcile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--excel', type=Path, required=True)
    parser.add_argument('--tracked-state', type=Path, required=True, help='FolioTrace state.json or public snapshot JSON')
    parser.add_argument('--artifacts-root', type=Path, required=True, help='READ-only artifacts/foliotrace collection')
    parser.add_argument('--source-root', type=Path, required=True, help='READ-only root for corpus relative paths')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'review-output/fty-real-run')
    parser.add_argument('--target-point', default='2025-12-31')
    parser.add_argument('--price-date', default='2025-12-30')
    parser.add_argument('--candidate-since', default='2025-01-01')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    out = args.output_dir.resolve()
    if not out.is_relative_to(ROOT) or out == ROOT:
        parser.error('output directory must be a subdirectory of this worktree')
    inputs = [args.excel.resolve(), args.tracked_state.resolve(), args.artifacts_root.resolve()]
    if any(p == out or out.is_relative_to(p) for p in inputs):
        parser.error('output directory cannot overlap an input file or collection')
    from datetime import date
    for value in (args.target_point, args.price_date, args.candidate_since):
        date.fromisoformat(value)
    report, state = yearend_reconcile.reconcile(args.excel, args.tracked_state, args.artifacts_root, args.source_root,
        output_dir=None if args.dry_run else out, target_point=args.target_point, price_date=args.price_date,
        candidate_since=args.candidate_since,
        progress=lambda p: print(json.dumps({'progress': p}), file=sys.stderr, flush=True))
    if not args.dry_run:
        out.mkdir(parents=True, exist_ok=True)
        for filename, value in [('report.json', report), ('state.json', state),
                                ('comparison.json', yearend.build_comparison_table(state))]:
            target = out / filename
            serialized = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
            if not target.exists() or target.read_text(encoding='utf-8') != serialized:
                target.write_text(serialized, encoding='utf-8')
        counts = '\n'.join(f'| {k} | {v} |' for k, v in sorted(report['counts'].items()))
        (out / 'REPORT.md').write_text(
            '# FolioTrace year-end offline reconciliation\n\n'
            'The supplied tracking snapshot is compared with Excel by exact stock/security subject. '
            'Tracking dates are retained; numeric matches do not certify year-end balances.\n\n'
            '| Count | Value |\n| --- | ---: |\n' + counts + '\n\n'
            f"Known receipts needing originals: **{report['receipts_need_fetching_count']}**. "
            'See `report.json` for per-row candidates, reasons, source hashes and receipts.\n\n'
            + '\n'.join('- ' + reason for reason in report['limitations']) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('counts', 'candidate_outcomes', 'receipts_need_fetching_count', 'network', 'model_adapter')}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
