#!/usr/bin/env python3
"""Read-only pipeline-based year-end reconciliation; no network/model access."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from pipeline.foliotrace import yearend_pipeline


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--excel', type=Path, required=True)
    parser.add_argument('--artifacts-root', type=Path, required=True)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--target-point', default='2025-12-31')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'review-output/fty-pipeline-run')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--previous-report', type=Path)
    args = parser.parse_args()
    out = args.output_dir.resolve()
    if not out.is_relative_to((ROOT / 'review-output').resolve()) or out == ROOT / 'review-output':
        parser.error('output must be a subdirectory of this worktree review-output')
    if any(out == p.resolve() or out.is_relative_to(p.resolve()) for p in (args.excel, args.artifacts_root, args.source_root)):
        parser.error('output cannot overlap a read-only input')
    if not args.dry_run:
        out.mkdir(parents=True, exist_ok=True)
    report = yearend_pipeline.reconcile(args.excel, args.artifacts_root, args.source_root, target=args.target_point,
        scratch_dir=out if not args.dry_run else None, dry_run=args.dry_run,
        progress=lambda value: print(json.dumps(value), file=sys.stderr, flush=True))
    if args.previous_report:
        previous_bytes = args.previous_report.read_bytes()
        previous = json.loads(previous_bytes)
        report['category_comparison'] = {'previous_report': str(args.previous_report),
            'previous_sha256': hashlib.sha256(previous_bytes).hexdigest(),
            'counts': {category: {'previous': previous['counts'].get(category, 0),
                'current': report['counts'][category],
                'delta': report['counts'][category] - previous['counts'].get(category, 0)}
                for category in yearend_pipeline.CATEGORIES}}
    if not args.dry_run:
        out.mkdir(parents=True, exist_ok=True)
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (out / 'REPORT.md').write_text(yearend_pipeline.markdown(report), encoding='utf-8')
    print(json.dumps(report['counts'], indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
