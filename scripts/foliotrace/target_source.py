#!/usr/bin/env python3
"""Verify one listed issuer document and replay its dated holding facts."""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.foliotrace import folio, opendart_secondary, secondary


def fetch_filing_family(receipt_no: str) -> bytes:
    if not re.fullmatch(r"\d{14}", receipt_no):
        raise ValueError("FAMILY_IDENTITY")
    request = urllib.request.Request(
        f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={receipt_no}",
        headers={"User-Agent": "FolioTrace/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read(2_000_001)
    except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException):
        raise RuntimeError("FAMILY_TRANSPORT") from None
    if len(payload) > 2_000_000:
        raise ValueError("FAMILY_SIZE")
    return payload


def correction_original(payload: bytes, corrected_no: str) -> str | None:
    try:
        source = payload.decode("utf-8")
    except UnicodeDecodeError:
        return None
    linked = set(re.findall(
        rf'alertInvestNotice\(\s*"{corrected_no}"\s*,\s*"\d+"\s*,\s*"(\d{{14}})"',
        source))
    if len(linked) != 1:
        return None
    original = next(iter(linked))
    if original == corrected_no or not re.search(
            rf'<option\b[^>]*\bvalue="rcpNo={original}"', source):
        return None
    return original


def _report_identity(name: str) -> str:
    return re.sub(r"\s+", "", re.sub(r"^(?:\[(?:기재)?정정\]|정정)\s*", "", name or ""))


def _same_dated_shareholder_facts(original: dict, correction: dict) -> bool:
    fields = ("structure", "basis_date", "security_kind", "quantity",
              "ownership_percent", "denominator_quantity", "denominator_date")
    def facts(item):
        return {tuple(claim.get(field) for field in fields)
                for claim in item.get("source_claims") or []
                if claim.get("structure") == "dated_five_percent_shareholder_all_common" and
                claim.get("status") == "actual_holding_basis_verified" and
                claim.get("source_file_sha256") and claim.get("row_sha256")}
    left, right = facts(original), facts(correction)
    return bool(left) and left == right


def ingest_target(state: dict, receipt_no: str, corp_code: str, filing_day: date, key: str,
                  *, fetch_list=None, fetch_document=None, fetch_family=None,
                  archive_dir: Path | None = None) -> dict:
    if not re.fullmatch(r"\d{14}", receipt_no) or not re.fullmatch(r"\d{8}", corp_code):
        raise ValueError("TARGET_IDENTITY")
    fetch_list = fetch_list or (lambda params: opendart_secondary.fetch_list_page(params, key))
    fetch_document = fetch_document or (lambda no: secondary.fetch_source_document(no, key))
    fetch_family = fetch_family or fetch_filing_family
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
    family_requests = 0
    possible_original = any(
        item.get("filer_corp_code") == corp_code and
        item.get("filing_date", "") < filing_day.isoformat() and
        _report_identity(item.get("report_name")) == _report_identity(queue["report_nm"])
        for item in (state.get("target_source_candidates") or {}).values())
    if (queue["correction_hold"] and not queue["withdrawal_flag"] and
            _report_identity(queue["report_nm"]) != re.sub(r"\s+", "", queue["report_nm"]) and
            mapping_verified and possible_original):
        family_requests = 1
        try:
            family = fetch_family(receipt_no)
            original_no = correction_original(family, receipt_no)
        except (ValueError, RuntimeError):
            original_no = None
        original = (state.get("target_source_candidates") or {}).get(original_no) if original_no else None
        if (original and original.get("filer_corp_code") == corp_code and
                original.get("filing_date", "") < filing_day.isoformat() and
                original.get("parser_version") == secondary.SOURCE_PARSER_VERSION and
                original.get("source_archive_sha256") and
                original.get("source_checked_at") and
                _report_identity(original.get("report_name")) == _report_identity(queue["report_nm"]) and
                _same_dated_shareholder_facts(original, candidate)):
            candidate["listing_correction_flag"] = True
            candidate["correction_hold"] = False
            candidate["correction_relation_verified"] = {
                "original_receipt_no": original_no,
                "original_archive_sha256": original["source_archive_sha256"],
                "family_page_sha256": hashlib.sha256(family).hexdigest()}
            state.setdefault("indirect_source_holds", {})[original_no] = "superseded_by_correction"
    if candidate["correction_hold"] or queue["withdrawal_flag"]:
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
            "family_requests": family_requests,
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
