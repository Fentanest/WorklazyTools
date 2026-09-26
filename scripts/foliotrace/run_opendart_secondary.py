#!/usr/bin/env python3
"""Run one bounded OpenDART list-API backfill lane.

List completion, source-document completion, and holding-observation
reflection stay separate in the result. State writes go to a temporary copy
under --validate-only so the first runs exercise the lane without touching
the data branch. This wrapper never prints keys, URLs, or filing bodies.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.foliotrace import folio, opendart_secondary, secondary
from pipeline.foliotrace.publish import encoded

# Stops that leave the lane incomplete must surface as process failure.
INCOMPLETE_STATUSES = frozenset({"LISTING_BUDGET_INSUFFICIENT", "QUEUE_BACKLOG",
                                 "QUEUE_BOUND_EXCEEDED", "REPROCESS_PENDING"})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--start", type=date.fromisoformat, default=date(1999, 4, 1))
    parser.add_argument("--end", type=date.fromisoformat, default=None)
    parser.add_argument("--max-listing-pages", type=int, default=300)
    parser.add_argument("--max-windows", type=int, default=20)
    parser.add_argument("--review-limit", type=int, default=20)
    parser.add_argument("--max-pending", type=int, default=5000)
    parser.add_argument("--max-queue-entries", type=int, default=20000)
    parser.add_argument("--overlap-days", type=int, default=0)
    parser.add_argument("--rehydrate-limit", type=int, default=0)
    parser.add_argument("--auto-rehydrate-limit", type=int, default=0)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    target = args.end
    if target is None:
        state = folio.read_json(args.state)
        latest = state.get("latest_complete_listing_date")
        target = date.fromisoformat(latest) if latest else folio.kst_today()
    state_path = args.state
    cleanup = None
    if args.validate_only:
        cleanup = tempfile.mkdtemp(prefix="opendart-secondary-validate-")
        state_path = Path(cleanup) / "state.json"
        shutil.copyfile(args.state, state_path)
        # Manifests reference the archive directory, so a validation run must
        # see the same shards in isolation; the originals stay untouched and
        # the whole copy is discarded afterwards.
        origin_archive = opendart_secondary.archive_dir_for(args.state)
        if origin_archive.is_dir():
            shutil.copytree(origin_archive, opendart_secondary.archive_dir_for(state_path))
    try:
        replay = None
        if args.rehydrate_limit:
            replay = opendart_secondary.rehydrate_archive(
                state_path, limit=args.rehydrate_limit,
                read_state=folio.read_json, write_state=folio.write_json)
            print(json.dumps({"validate_only": args.validate_only, "replay": replay},
                             sort_keys=True))
        result = opendart_secondary.scan_opendart_secondary(
            state_path, args.start, target,
            max_listing_pages=args.max_listing_pages, max_windows=args.max_windows,
            review_limit=args.review_limit, max_pending=args.max_pending,
            max_queue_entries=args.max_queue_entries,
            auto_rehydrate_limit=args.auto_rehydrate_limit,
            overlap_days=args.overlap_days,
            read_state=folio.read_json, write_state=folio.write_json,
            key=os.environ.get("DART_API_KEY", ""))
        normalized = folio.read_json(state_path)
        before = encoded(normalized)
        applied = secondary.replay_opendart_positives(normalized, limit=max(1, args.review_limit))
        after = encoded(normalized)
        if after != before:
            normalized["revision"] += 1
            folio.write_json(state_path, normalized)
        result["observation_replay"] = applied
    except opendart_secondary.OpendartListError as exc:
        print(json.dumps({"error": exc.code, "window_start": exc.start,
                          "window_end": exc.end, "page_no": exc.page_no}), file=sys.stderr)
        return 1
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    finally:
        if cleanup:
            shutil.rmtree(cleanup, ignore_errors=True)
    print(json.dumps({"validate_only": args.validate_only, **result}, sort_keys=True))
    if result["status"] in INCOMPLETE_STATUSES:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
