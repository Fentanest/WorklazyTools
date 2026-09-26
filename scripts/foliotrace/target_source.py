#!/usr/bin/env python3
"""Verify one listed issuer document and replay its dated holding facts."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.foliotrace import folio, opendart_secondary, secondary


def ingest_target(state: dict, receipt_no: str, corp_code: str, filing_day: date, key: str,
                  *, fetch_list=None, fetch_document=None, archive_dir: Path | None = None) -> dict:
    if not re.fullmatch(r"\d{14}", receipt_no) or not re.fullmatch(r"\d{8}", corp_code):
        raise ValueError("TARGET_IDENTITY")
    fetch_list = fetch_list or (lambda params: opendart_secondary.fetch_list_page(params, key))
    fetch_document = fetch_document or (lambda no: secondary.fetch_source_document(no, key))
    params = {"corp_code": corp_code, "bgn_de": filing_day.strftime("%Y%m%d"),
              "end_de": filing_day.strftime("%Y%m%d"), "page_no": 1,
              "page_count": opendart_secondary.PAGE_SIZE,
              "last_reprt_at": "N", "sort": "date", "sort_mth": "asc"}
    first = fetch_list(params)
    if first.get("status") == "013":
        raise ValueError("TARGET_LIST_NOT_FOUND")
    try:
        pages = int(first["total_page"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("TARGET_LIST_METADATA") from None
    if not 1 <= pages <= 10:
        raise ValueError("TARGET_LIST_BUDGET")
    payloads = [first]
    for number in range(2, pages + 1):
        payloads.append(fetch_list({**params, "page_no": number}))
    opendart_secondary.validate_list_pages(payloads, filing_day, filing_day)
    matches = [row for page in payloads for row in page.get("list", [])
               if row.get("rcept_no") == receipt_no]
    if len(matches) != 1 or str(matches[0].get("corp_code") or "") != corp_code:
        raise ValueError("TARGET_LIST_IDENTITY")
    listed = matches[0]
    company = state.get("universe", {}).get(corp_code)
    stock = str(listed.get("stock_code") or "")
    mapping_verified = bool(company and listed.get("corp_name") == company.get("name") and
                            (not stock or stock == company.get("stock_code")))
    before_state = json.dumps(state, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    queue = opendart_secondary._queue_entry(listed, filing_day.isoformat(), filing_day.isoformat())
    checked_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    cache = state.setdefault("secondary_source_cache", {})
    check = cache.get(receipt_no)
    requests = 0
    raw_cache_hits = 0
    if (not isinstance(check, dict) or check.get("parser_version") != secondary.SOURCE_PARSER_VERSION or
            not check.get("source_archive_sha256") or check.get("status") != "source_context_review_pending"):
        prior_hash = state.get("target_source_candidates", {}).get(receipt_no, {}).get("source_archive_sha256")
        raw_path = (archive_dir / f"{receipt_no}-{prior_hash}.zip"
                    if archive_dir is not None and isinstance(prior_hash, str) and
                    re.fullmatch(r"[a-f0-9]{64}", prior_hash) else None)
        if raw_path is not None and raw_path.is_file():
            payload = raw_path.read_bytes()
            if hashlib.sha256(payload).hexdigest() != prior_hash:
                raise ValueError("TARGET_RAW_CACHE_INTEGRITY")
            raw_cache_hits = 1
        else:
            payload = fetch_document(receipt_no)
            requests = 1
        check = secondary.inspect_source_document(payload)
        if not check.get("source_archive_sha256"):
            raise ValueError("TARGET_SOURCE_UNVERIFIED")
        if check.get("claim_limit_exceeded"):
            raise ValueError("TARGET_CLAIM_LIMIT")
        if archive_dir is not None and not raw_cache_hits:
            archive_dir.mkdir(parents=True, exist_ok=True)
            target = archive_dir / f"{receipt_no}-{check['source_archive_sha256']}.zip"
            if not target.exists():
                with tempfile.NamedTemporaryFile(dir=archive_dir, prefix="pending-", delete=False) as handle:
                    temporary = Path(handle.name)
                    handle.write(payload)
                    handle.flush()
                    os.fsync(handle.fileno())
                temporary.replace(target)
        cache[receipt_no] = check
    if archive_dir is not None and check.get("source_archive_sha256"):
        target = archive_dir / f"{receipt_no}-{check['source_archive_sha256']}.zip"
        if not target.is_file():
            payload = fetch_document(receipt_no)
            requests += 1
            if hashlib.sha256(payload).hexdigest() != check["source_archive_sha256"]:
                raise ValueError("TARGET_RAW_CACHE_INTEGRITY")
            archive_dir.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=archive_dir, prefix="pending-", delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(target)
    previous = state.setdefault("target_source_candidates", {}).get(receipt_no, {})
    candidate = {"receipt_no": receipt_no, "document_no": None,
                 "filing_date": filing_day.isoformat(), "filing_company": listed.get("corp_name"),
                 "filer_corp_code": corp_code, "report_name": queue["report_nm"],
                 "correction_hold": queue["correction_hold"],
                 "withdrawal_flag": queue["withdrawal_flag"],
                 "source_checked_at": previous.get("source_checked_at") or checked_at,
                 "first_discovered_at": previous.get("first_discovered_at") or checked_at,
                 "source_archive_sha256": check["source_archive_sha256"],
                 "parser_version": secondary.SOURCE_PARSER_VERSION,
                 "source_claims": check.get("source_claims") or []}
    if queue["correction_hold"] or queue["withdrawal_flag"]:
        state.setdefault("indirect_source_holds", {})[receipt_no] = (
            "withdrawn" if queue["withdrawal_flag"] else "correction_relation_unverified")
    else:
        state.setdefault("indirect_source_holds", {}).pop(receipt_no, None)
    if mapping_verified:
        count = secondary.retain_verified_historical_claims(state, candidate)
    else:
        count = 0
        candidate["application_status"] = "issuer_mapping_pending"
    state["target_source_candidates"][receipt_no] = candidate
    changed = json.dumps(state, sort_keys=True, ensure_ascii=False, separators=(",", ":")) != before_state
    if changed:
        state["revision"] += 1
    return {"receipt_no": receipt_no, "listing_pages": pages, "source_requests": requests,
            "raw_archive_cache_hits": raw_cache_hits,
            "source_claims": len(candidate["source_claims"]), "state_changed": changed,
            "facts_changed": count, "mapping_verified": mapping_verified,
            "application_status": candidate.get("application_status")}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--corp", required=True)
    parser.add_argument("--filing-date", type=date.fromisoformat, required=True)
    args = parser.parse_args()
    try:
        state = folio.read_json(args.state)
        result = ingest_target(state, args.receipt, args.corp, args.filing_date,
                               os.environ.get("DART_API_KEY", ""),
                               archive_dir=args.state.parent / "source-archives")
        folio.write_json(args.state, state)
    except (ValueError, RuntimeError, opendart_secondary.OpendartListError) as exc:
        code = str(exc)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]+", code):
            code = "TARGET_SOURCE_ERROR"
        print(json.dumps({"error": code}), file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
