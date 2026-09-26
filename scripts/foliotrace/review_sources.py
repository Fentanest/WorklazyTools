#!/usr/bin/env python3
"""Reprocess saved DART source candidates independently of site search availability."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.foliotrace import folio, secondary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--scope", choices=("all", "equity", "prior-all", "prior-equity"), required=True)
    parser.add_argument("--review-limit", type=int, default=20)
    parser.add_argument("--source-receipt")
    args = parser.parse_args()
    state = folio.read_json(args.state)
    ledger = state.get({"all": "secondary_backfill", "equity": "secondary_equity_backfill",
                        "prior-all": "secondary_prior_backfill",
                        "prior-equity": "secondary_prior_equity_backfill"}[args.scope])
    if ledger is None:
        print(json.dumps({"status": "SOURCE_LEDGER_NOT_INITIALIZED", "scope": args.scope}))
        return 0
    try:
        result = secondary.scan_secondary(args.state, date.fromisoformat(ledger["start_date"]),
            date.fromisoformat(ledger["target_date"]), read_state=folio.read_json,
            write_state=folio.write_json, key=os.environ.get("DART_API_KEY", ""),
            review_limit=args.review_limit, scope=args.scope, source_only=True,
            source_receipt=args.source_receipt)
    except (ValueError, RuntimeError) as exc:
        code = str(exc) if str(exc) in ("DART_API_KEY unavailable", "invalid source receipt selection",
                                         "invalid secondary search bounds") else "SOURCE_REVIEW_FAILED"
        print(json.dumps({"error": code, "scope": args.scope}), file=sys.stderr)
        return 1
    print(json.dumps({"scope": args.scope, **result}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
