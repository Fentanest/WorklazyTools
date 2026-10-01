#!/usr/bin/env python3
"""Offline citation-followup runner for year-end reconciliation.

Reads a stored archive directory, optional stored model responses and an
isolated state file, then runs verification (or records a hold) for each
request.  No network, no operational state, no paid model calls.

Examples
--------
Single request, archive already staged::

    python3 scripts/foliotrace/run_yearend_followup.py \\
        --state /tmp/w/state.json \\
        --archive-dir /tmp/w/archives \\
        --output-dir /tmp/w/out \\
        --request /tmp/w/requests/ktg.json

Missing-original run, then stage the archive and rerun the same command::

    cp /path/to/20260318001422.zip /tmp/w/archives/
    python3 scripts/foliotrace/run_yearend_followup.py --state ... (same args)

Resume every pending queue item::

    python3 scripts/foliotrace/run_yearend_followup.py --state ... \\
        --archive-dir ... --output-dir ... --resume-pending
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.foliotrace import yearend, yearend_worker
from scripts.foliotrace import folio


def _load_json(path: Path, default):
    if path is None or not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True,
                        help="Isolated state JSON (created when missing).")
    parser.add_argument("--archive-dir", type=Path, required=True,
                        help="Directory holding stored '{receipt}.zip' originals.")
    parser.add_argument("--output-dir", type=Path, required=True,
                        help="Evidence candidates, comparison snapshot and run log land here.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--request", type=Path, help="One request JSON file.")
    group.add_argument("--requests-dir", type=Path, help="Directory of request JSON files.")
    group.add_argument("--resume-pending", action="store_true",
                       help="Re-run every non-terminal queue item with its stored request.")
    parser.add_argument("--stored-responses", type=Path,
                        help="Stored model-response JSON keyed by request key.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Verify without persisting state or result files.")
    args = parser.parse_args()

    try:
        state = folio.read_json(args.state) if args.state.is_file() else folio.empty_state()
    except (ValueError, OSError):
        print(json.dumps({"error": "STATE_UNREADABLE"}))
        return 2
    stored = _load_json(args.stored_responses, {}) or {}
    if args.request:
        try:
            requests = [json.loads(args.request.read_text(encoding="utf-8"))]
        except (ValueError, OSError):
            print(json.dumps({"error": "REQUEST_UNREADABLE"}))
            return 2
    elif args.requests_dir:
        requests = []
        for path in sorted(args.requests_dir.glob("*.json")):
            try:
                requests.append(json.loads(path.read_text(encoding="utf-8")))
            except ValueError:
                print(json.dumps({"error": "REQUEST_UNREADABLE", "path": str(path)}))
                return 2
    else:
        queue = state.get("citation_followup_queue") or {}
        terminal = {"resolved_verified_hold", "value_conflict", "citation_cycle_hold"}
        requests = []
        for key, item in sorted(queue.items()):
            if item.get("state") in terminal:
                continue
            saved = {"request_key": key, "receipt_no": "",
                     "clue": item.get("clue") or {}}
            clue = item.get("clue") or {}
            for field in ("receipt_no", "source_receipt_no"):
                if clue.get(field):
                    saved["receipt_no"] = clue[field]
                    break
            if not saved["receipt_no"]:
                continue
            saved["chain"] = []
            requests.append(saved)
    before = copy.deepcopy(state)
    outcomes = []
    for request in requests:
        try:
            outcomes.append(yearend_worker.process_followup(
                state, request, archive_dir=args.archive_dir,
                stored_responses=stored, output_dir=args.output_dir))
        except (ValueError, TypeError) as exc:
            code = str(exc)
            outcomes.append({"request_key": request.get("request_key"),
                             "outcome": "worker_error", "error": code})
    summary = {"requests": len(outcomes), "outcomes": outcomes,
               "state_changed": before != state,
               "dart_key": yearend.resolve_dart_key(
                   {"DART_API_KEY": __import__("os").environ.get("DART_API_KEY", "")})["status"]}
    if not args.dry_run:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        (args.output_dir / "comparison.json").write_text(
            json.dumps(yearend.build_comparison_table(state), ensure_ascii=False, indent=2),
            encoding="utf-8")
        (args.output_dir / "run-log.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        if before != state:
            state["revision"] = state.get("revision", 0) + 1
            folio.write_json(args.state, state)
    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
