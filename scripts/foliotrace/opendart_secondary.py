"""Lossless OpenDART list-API backfill for third-party filing discovery.

The DART web full-text host is unreachable, so this lane lists filings through
the official OpenDART list API without restricting company or report type, then
queues every discovered receipt for bounded source-document review.

Listing facts, downloaded sources, and numeric holding observations are tracked
separately: a completed list window never implies its documents were reviewed,
and a reviewed document never implies its numbers entered holdings. Positive
source findings stay in this lane's independent queue for bounded replay by
the shared observation path; this module never writes the full-text,
direct, or early-direct cursors, nor the receipts/holdings/events ledgers.

The active queue is bounded by spilling terminal, current-version, non-held
negative verdicts into monthly archive shards next to the state file: each
shard is written durably before its rows leave the queue, a manifest with
digests lives in the ledger, and parser upgrades rehydrate stale rows back
into the queue. Nothing is ever deleted without a recoverable copy.
"""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from scripts.foliotrace import secondary

LEDGER_KEY = "opendart_secondary_backfill"
METHOD = "opendart-list-v1-lossless-queue"
EARLIEST_START = date(1999, 4, 1)
# Conservative cap for the OpenDART "within 3 months" list range: the shortest
# 3-calendar-month span (Feb+Mar+Apr in a non-leap year) holds 89 days, while a
# 92-day window starting on some dates would exceed three calendar months.
MAX_WINDOW_DAYS = 89
PAGE_SIZE = 100
RECEIPT = re.compile(r"^\d{14}$")
RCEPT_DT = re.compile(r"^\d{8}$")
CORRECTION_HINT = re.compile(r"정정|철회|취소|변경등록")
# Official list-API `rm` remarks also use single-character short codes.
RM_TOKENS = re.compile(r"[\s,;/|·()\[\]{}]+")
RM_CORRECTION_TOKENS = frozenset({"정", "정정"})
RM_WITHDRAWAL_TOKENS = frozenset({"철", "철회"})
RM_CANCEL_TOKENS = frozenset({"취", "취소"})
# Single letters that may compose official remark codes
# (e.g. 유정, 유철, 코정, 코철, 유연정).
RM_CODE_LETTERS = frozenset({"유", "정", "철", "취", "코", "연"})
ARCHIVE_FORMAT = 2
# Archived rows per monthly shard file; keeps each static data-branch file small.
ARCHIVE_SHARD_ROWS = 5000
PENDING_STATUSES = ("source_review_pending", "source_unavailable")
SOURCE_HISTORY_CAP = 5
DEFAULT_MAX_QUEUE_ENTRIES = 20000
# Listing and source review remain separate from observation reconciliation.
HOLDING_REFLECTION = "separate_reconciliation"


class OpendartListError(RuntimeError):
    def __init__(self, code: str, start: date, end: date, page_no: int | None = None):
        super().__init__(code)
        self.code, self.start, self.end = code, start.isoformat(), end.isoformat()
        self.page_no = page_no


def _row_date(value: object, start: date, end: date) -> str:
    text = str(value or "")
    if not RCEPT_DT.fullmatch(text):
        raise ValueError("ROW_DATE")
    try:
        filing = date(int(text[:4]), int(text[4:6]), int(text[6:8]))
    except ValueError:
        raise ValueError("ROW_DATE") from None
    if not start <= filing <= end:
        raise ValueError("ROW_DATE_RANGE")
    return text


def validate_list_pages(pages: list[dict], start: date, end: date) -> int:
    """Check server totals, page identity, dates, receipts, and duplicates."""
    if not pages:
        raise ValueError("PAGE_SET_EMPTY")
    first = pages[0]
    if first.get("status") == "013":
        if len(pages) != 1 or first.get("list"):
            raise ValueError("NO_DATA_SHAPE")
        return 0
    if first.get("status") != "000":
        raise ValueError("PAGE_STATUS")
    try:
        total = int(first["total_count"])
        count = int(first["total_page"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("PAGINATION_METADATA") from exc
    if total < 0 or count < 1 or count != max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE):
        raise ValueError("PAGINATION_METADATA")
    if len(pages) != count:
        raise ValueError("PAGE_COUNT")
    numbers: list[str] = []
    for number, page in enumerate(pages, 1):
        try:
            same = (page.get("status") == "000" and int(page["page_no"]) == number
                    and int(page["total_count"]) == total and int(page["total_page"]) == count)
        except (KeyError, TypeError, ValueError):
            same = False
        rows = page.get("list")
        if not same or not isinstance(rows, list):
            raise ValueError("PAGE_IDENTITY")
        if len(rows) != min(PAGE_SIZE, max(0, total - (number - 1) * PAGE_SIZE)):
            raise ValueError("PAGE_IDENTITY")
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("ROW_SHAPE")
            no = str(row.get("rcept_no") or "")
            if not RECEIPT.fullmatch(no):
                raise ValueError("RECEIPT_IDENTITY")
            _row_date(row.get("rcept_dt"), start, end)
            numbers.append(no)
    if len(set(numbers)) != total:
        raise ValueError("RECEIPT_COVERAGE")
    return total


def fetch_list_page(params: dict, key: str, *, retries: int = 3) -> dict:
    """Fetch one OpenDART list page; 013 (official no-data) is data, not error."""
    if not key:
        raise ValueError("DART_API_KEY unavailable")
    query = urllib.parse.urlencode({**params, "crtfc_key": key})
    url = f"https://opendart.fss.or.kr/api/list.json?{query}"
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "FolioTrace/1.0"})
            with urllib.request.urlopen(request, timeout=25) as response:
                data = json.load(response)
        except (urllib.error.URLError, TimeoutError, ConnectionError,
                http.client.HTTPException):
            if attempt + 1 == retries:
                raise OpendartListError("OPENDART_TRANSPORT", date.today(), date.today()) from None
            time.sleep(attempt + 1)
            continue
        except ValueError:
            raise OpendartListError("RESPONSE_SHAPE", date.today(), date.today()) from None
        if not isinstance(data, dict):
            # Non-object JSON (or a decoded non-JSON body) is a response-shape
            # error, never retried, and never logged with key-bearing URLs.
            raise OpendartListError("RESPONSE_SHAPE", date.today(), date.today()) from None
        status = data.get("status")
        if status in ("000", "013"):
            return data
        raise OpendartListError(f"OPENDART_STATUS_{status}", date.today(), date.today())
    raise OpendartListError("OPENDART_TRANSPORT", date.today(), date.today())  # pragma: no cover


def _code_token_holds(token: str) -> tuple[bool, bool] | None:
    """Interpret pure code-letter runs such as 유정/유철; None when not a code."""
    if token and all(char in RM_CODE_LETTERS for char in token):
        holds = any(char in token for char in "정철취")
        return holds, "철" in token
    return None


def _correction_flags(report_nm: str, rm: str) -> tuple[bool, bool]:
    """Signal correction/withdrawal holds from long and short remark forms."""
    if CORRECTION_HINT.search(report_nm) or CORRECTION_HINT.search(rm):
        withdrawal = bool(re.search(r"철회|철", report_nm) or re.search(r"철회|철", rm))
        return True, withdrawal
    tokens = set(RM_TOKENS.split(rm)) - {""}
    if tokens & (RM_CORRECTION_TOKENS | RM_WITHDRAWAL_TOKENS | RM_CANCEL_TOKENS):
        return True, bool(tokens & RM_WITHDRAWAL_TOKENS)
    for token in tokens:
        coded = _code_token_holds(token)
        if coded is not None and coded[0]:
            return coded
    return False, False


def _queue_entry(row: dict, window_from: str, window_to: str) -> dict:
    report = str(row.get("report_nm") or "")
    rm = str(row.get("rm") or "")
    correction_hold, withdrawal_flag = _correction_flags(report, rm)
    return {"receipt_no": str(row.get("rcept_no") or ""),
            "corp_code": str(row.get("corp_code") or "") or None,
            "corp_name": str(row.get("corp_name") or "")[:120] or None,
            "stock_code": str(row.get("stock_code") or "") or None,
            "report_nm": report[:180],
            "rcept_dt": str(row.get("rcept_dt") or ""),
            "rm": rm[:120],
            "first_seen_from": window_from, "first_seen_to": window_to,
            "last_seen_from": window_from, "last_seen_to": window_to,
            "correction_hold": correction_hold, "withdrawal_flag": withdrawal_flag,
            "source_status": "source_review_pending", "parser_version": None,
            "source_attempt_count": 0, "last_source_attempt_on": None, "source_sha256": None,
            "source_history": []}


def _refresh_entry(item: dict, row: dict, window_from: str, window_to: str) -> bool:
    """Refresh listing metadata on recrawl; source-review evidence is untouched.

    Returns True when correction/withdrawal eligibility flags changed, so the
    applied positive record can be synchronized or retracted in the same write
    even though same-version source review would otherwise skip the receipt.
    """
    report = str(row.get("report_nm") or "")
    rm = str(row.get("rm") or "")
    correction_hold, withdrawal_flag = _correction_flags(report, rm)
    changed = (item.get("correction_hold") != correction_hold
               or item.get("withdrawal_flag") != withdrawal_flag)
    item.update(corp_code=str(row.get("corp_code") or "") or None,
                corp_name=str(row.get("corp_name") or "")[:120] or None,
                stock_code=str(row.get("stock_code") or "") or None,
                report_nm=report[:180], rcept_dt=str(row.get("rcept_dt") or ""), rm=rm[:120],
                last_seen_from=window_from, last_seen_to=window_to,
                correction_hold=correction_hold, withdrawal_flag=withdrawal_flag)
    return changed


def _is_outstanding(item: dict) -> bool:
    """Pending items plus terminal verdicts recorded under an older parser."""
    if item.get("source_status") in PENDING_STATUSES:
        return True
    return item.get("parser_version") != secondary.SOURCE_PARSER_VERSION


def _outstanding_count(ledger: dict) -> int:
    return sum(1 for item in ledger.get("queue", {}).values() if _is_outstanding(item))


def _needs_source_review(item: dict, today: str) -> bool:
    """Select pending items, plus terminal ones recorded under an older parser.

    Same-version terminal verdicts stay skipped so reruns remain idempotent.
    """
    if item.get("last_source_attempt_on") == today:
        return False
    if item.get("source_status") in PENDING_STATUSES:
        return True
    return item.get("parser_version") != secondary.SOURCE_PARSER_VERSION


def _call_list(fetch_list, key: str, params: dict, cursor: date, last: date,
               page_no: int) -> dict:
    try:
        if fetch_list is fetch_list_page:
            return fetch_list(params, key)
        return fetch_list(params)
    except OpendartListError as exc:
        raise OpendartListError(exc.code, cursor, last, page_no) from None
    except (ValueError, RuntimeError) as exc:
        code = (str(exc) if str(exc) in ("OPENDART_TRANSPORT", "DART_API_KEY unavailable")
                else "LIST_UNEXPECTED")
        raise OpendartListError(code, cursor, last, page_no) from None


def _collect_window(fetch_list, key: str, cursor: date, last: date, *, ledger: dict,
                    state: dict, state_path: Path, write_state,
                    max_listing_pages: int, size_key: str,
                    spent: int) -> tuple[list[dict] | None, date, int, int | None]:
    """Fetch every page of one window, halving oversized ranges safely.

    Returns ``(pages, last, spent, required_pages)``; ``pages`` is None when
    the window cannot be completed on this run, and ``required_pages`` is set
    only when even a single-day window overflows the page budget.
    """
    while True:
        params = {"bgn_de": cursor.strftime("%Y%m%d"), "end_de": last.strftime("%Y%m%d"),
                  "page_no": 1, "page_count": PAGE_SIZE,
                  "last_reprt_at": "N", "sort": "date", "sort_mth": "asc"}
        first = _call_list(fetch_list, key, params, cursor, last, 1)
        spent += 1
        if first.get("status") == "013":
            return [first], last, spent, None
        try:
            page_count = int(first["total_page"])
            total_count = int(first["total_count"])
        except (KeyError, TypeError, ValueError):
            raise OpendartListError("PAGINATION_METADATA", cursor, last, 1) from None
        if page_count < 1 or page_count > 10_000 or total_count < 0:
            raise OpendartListError("PAGINATION_METADATA", cursor, last, 1)
        if page_count > max_listing_pages:
            if last == cursor:
                return None, last, spent, page_count
            last = cursor + timedelta(days=(last - cursor).days // 2)
            ledger[size_key] = (last - cursor).days + 1
            state["revision"] += 1
            write_state(state_path, state)
            if spent >= max_listing_pages:
                return None, last, spent, None
            continue
        if spent + page_count - 1 > max_listing_pages:
            return None, last, spent, None  # Fits a fresh run; never commit truncated pages.
        pages = [first]
        for number in range(2, page_count + 1):
            pages.append(_call_list(fetch_list, key, {**params, "page_no": number},
                                    cursor, last, number))
            spent += 1
        return pages, last, spent, None


def _commit_window(ledger: dict, state: dict, state_path: Path, write_state,
                   cursor: date, last: date,
                   pages: list[dict], *, overlap: bool, archive: dict,
                   max_listing_pages: int) -> tuple[int, int, int]:
    """Validate pages, queue every receipt, and advance only this phase's cursor.

    Receipts already recoverable from the archive are not re-queued unless
    their listing metadata changed (report/rm/hold flags/identity), in which
    case the archived fact is restored for re-evaluation so a late correction
    or withdrawal is never missed. Returns
    ``(new_receipts, total, archived_hits, requeued)``. Each phase grows only
    its own window size, and only when doubling the fetched pages still fits
    the run budget, so tiny budgets settle on stable single-day windows
    instead of oscillating between growth and re-halving probes.
    """
    try:
        total = validate_list_pages(pages, cursor, last)
    except ValueError as exc:
        code = str(exc) if str(exc) in ("NO_DATA_SHAPE", "PAGE_STATUS", "PAGINATION_METADATA",
                                        "PAGE_COUNT", "PAGE_IDENTITY", "ROW_SHAPE",
                                        "RECEIPT_IDENTITY", "ROW_DATE", "ROW_DATE_RANGE",
                                        "RECEIPT_COVERAGE") else "PAGE_VALIDATION"
        raise OpendartListError(code, cursor, last) from None
    new_receipts = queued_this_window = archived_hits = requeued = 0
    window_months = {cursor.strftime("%Y%m"), last.strftime("%Y%m")}
    archived_lookup: dict = {}
    for month in window_months:
        archived_lookup.update(_load_archive_month(ledger, archive["dir"], month, archive["months"]))
    for page in pages:
        for row in page.get("list") or []:
            no = str(row.get("rcept_no") or "")
            existing = ledger["queue"].get(no)
            if existing is None:
                stored = archived_lookup.get(no)
                if stored is None:
                    ledger["queue"][no] = _queue_entry(row, cursor.isoformat(), last.isoformat())
                    new_receipts += 1
                else:
                    archived_hits += 1
                    if _archived_listing_changed(stored, row):
                        ledger["queue"][no] = _restore_archived(
                            stored, row, cursor.isoformat(), last.isoformat())
                        requeued += 1
                        # The restored ID must leave the archive in the same
                        # persisted commit, or a later parser upgrade would
                        # rehydrate a permanent duplicate stale row.
                        _drop_archived_ids(ledger, archive["dir"], {no}, archive["months"])
            else:
                eligibility_changed = _refresh_entry(
                    existing, row, cursor.isoformat(), last.isoformat())
                if eligibility_changed and no in ledger["positives"]:
                    _sync_positive_eligibility(ledger, existing, no)
            queued_this_window += 1
    digests = [hashlib.sha256(json.dumps(
        page, ensure_ascii=False, sort_keys=True).encode()).hexdigest() for page in pages]
    record = {"from": cursor.isoformat(), "to": last.isoformat(),
              "checked_at": datetime.now(timezone.utc).isoformat(), "method": METHOD,
              "pages": len(pages), "total_receipts": total,
              "queued_receipts": queued_this_window, "complete": True,
              "page_digest": hashlib.sha256("".join(digests).encode()).hexdigest()}
    if overlap:
        record["overlap"] = True
        ledger["overlap_coverage"].append(record)
        ledger["overlap_next_date"] = (last + timedelta(days=1)).isoformat()
    else:
        ledger["coverage"].append(record)
        ledger["next_date"] = (last + timedelta(days=1)).isoformat()
    history = ledger["overlap_coverage"] if overlap else ledger["coverage"]
    size_key = "overlap_max_window_days" if overlap else "max_window_days"
    if len(pages) * 2 + 1 <= max_listing_pages:
        ledger[size_key] = min(
            MAX_WINDOW_DAYS, max(1, (last - date.fromisoformat(history[-1]["from"])).days * 2 + 2))
    else:
        ledger[size_key] = max(1, (last - date.fromisoformat(history[-1]["from"])).days + 1)
    state["revision"] += 1
    write_state(state_path, state)
    archive["swept"] = archive.get("swept", 0) + _sweep_unreferenced(
        archive["dir"], ledger.get("archive_manifest", {}))
    return new_receipts, total, archived_hits, requeued


def _drop_archived_ids(ledger: dict, archive_dir: Path, ids: set,
                       cache: dict) -> int:
    """Remove restored IDs from archive shards so they cannot linger as stale.

    Replacement shards are written before the manifest update; the caller
    sweeps superseded files only after persisting that manifest change.
    Returns the dropped count.
    """
    if not ids:
        return 0
    manifest = ledger.get("archive_manifest", {})
    if not isinstance(manifest, dict):
        raise ArchiveIntegrityError("UNKNOWN_MANIFEST")
    months = {month for month, records in manifest.items() if isinstance(records, list)}
    dropped = 0
    for month in sorted(months):
        stored = _load_archive_month(ledger, archive_dir, month, cache)
        victims = [no for no in stored if no in ids]
        if not victims:
            continue
        for no in victims:
            del stored[no]
            dropped += 1
        ordered = sorted(stored.values(), key=lambda row: row["receipt_no"])
        records = []
        for offset in range(0, len(ordered), ARCHIVE_SHARD_ROWS):
            records.append(_write_content_shard(
                archive_dir, month, ordered[offset:offset + ARCHIVE_SHARD_ROWS]))
        manifest[month] = records
        if not records:
            del manifest[month]
        # Force later reads in this run onto the rewritten files.
        cache.pop(month, None)
    return dropped


def _archived_listing_changed(stored: dict, row: dict) -> bool:
    """Compare an archived fact against a fresh listing row for eligibility drift."""
    report = str(row.get("report_nm") or "")
    rm = str(row.get("rm") or "")
    correction_hold, withdrawal_flag = _correction_flags(report, rm)
    fresh = {"corp_code": str(row.get("corp_code") or "") or None,
             "corp_name": str(row.get("corp_name") or "")[:120] or None,
             "stock_code": str(row.get("stock_code") or "") or None,
             "report_nm": report[:180], "rcept_dt": str(row.get("rcept_dt") or ""),
             "rm": rm[:120], "correction_hold": correction_hold,
             "withdrawal_flag": withdrawal_flag}
    return any(stored.get(key) != fresh[key] for key in ARCHIVE_LISTING_KEYS)


def _restore_archived(stored: dict, row: dict, window_from: str, window_to: str) -> dict:
    """Restore an archived fact whose listing metadata changed for re-evaluation."""
    item = dict(stored)
    item.update(corp_code=str(row.get("corp_code") or "") or None,
                corp_name=str(row.get("corp_name") or "")[:120] or None,
                stock_code=str(row.get("stock_code") or "") or None,
                report_nm=str(row.get("report_nm") or "")[:180],
                rcept_dt=str(row.get("rcept_dt") or ""),
                rm=str(row.get("rm") or "")[:120],
                last_seen_from=window_from, last_seen_to=window_to)
    hold, withdrawn = _correction_flags(item["report_nm"], item["rm"])
    item["correction_hold"], item["withdrawal_flag"] = hold, withdrawn
    _record_history(item, "requeued_listing_metadata_changed")
    return item


def _record_history(item: dict, note: str) -> None:
    history = item.setdefault("source_history", [])
    history.append({"checked_at": datetime.now(timezone.utc).isoformat(),
                    "status": item.get("source_status"),
                    "parser_version": item.get("parser_version"),
                    "source_sha256": item.get("source_sha256"),
                    "note": note})
    del history[:-SOURCE_HISTORY_CAP]


def _sync_positive_eligibility(ledger: dict, item: dict, no: str) -> None:
    """Synchronize or retract the applied positive after a listing change.

    A newly withdrawn filing can no longer support a holding observation, so
    its positive record is retracted; a new correction hold only downgrades the
    relation. Both paths keep the audit trail on the queue row.
    """
    held = ledger["positives"].get(no)
    if held is None:
        return
    if item.get("withdrawal_flag"):
        ledger["positives"].pop(no, None)
        _record_history(item, "positive_retracted_withdrawal")
        return
    held.update(report_nm=item.get("report_nm"), rcept_dt=item.get("rcept_dt"),
                corp_code=item.get("corp_code"), corp_name=item.get("corp_name"),
                correction_hold=item.get("correction_hold", False),
                withdrawal_flag=item.get("withdrawal_flag", False),
                relation=("correction_relation_unverified" if item.get("correction_hold")
                          else "holding_observation_pending"))
    _record_history(item, "positive_eligibility_synchronized")


def archive_dir_for(state_path: Path) -> Path:
    return Path(state_path).parent / "opendart-secondary-archive"


class ArchiveIntegrityError(ValueError):
    """A manifest-referenced archive shard is missing, corrupt, or altered."""

    def __init__(self, reason: str, month: str = "", filename: str = ""):
        super().__init__(f"ARCHIVE_INTEGRITY_{reason}")
        self.reason, self.month, self.filename = reason, month, filename


ARCHIVE_ROW_KEYS = ("receipt_no", "corp_code", "corp_name", "stock_code",
                    "report_nm", "rcept_dt", "rm", "first_seen_from", "first_seen_to",
                    "last_seen_from", "last_seen_to", "correction_hold", "withdrawal_flag",
                    "source_status", "parser_version", "source_sha256", "source_history")
# Listing fields re-compared when an archived receipt reappears in the list API.
ARCHIVE_LISTING_KEYS = ("corp_code", "corp_name", "stock_code", "report_nm",
                        "rcept_dt", "rm", "correction_hold", "withdrawal_flag")


def _atomic_write_json(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(obj, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":")).encode() + b"\n"
    descriptor, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".archive-")
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _archive_row(item: dict) -> dict:
    """Store the full queue row: listing metadata, verdict, and audit history."""
    row = {key: item.get(key) for key in ARCHIVE_ROW_KEYS}
    row["correction_hold"] = bool(row["correction_hold"])
    row["withdrawal_flag"] = bool(row["withdrawal_flag"])
    row["source_history"] = list(row["source_history"] or [])[-SOURCE_HISTORY_CAP:]
    return row


def _rows_digest(rows: list) -> str:
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def _shard_filename(month: str, row_digest: str) -> str:
    return f"shard-{month}-{row_digest[:16]}.json"


def _write_content_shard(archive_dir: Path, month: str, rows: list) -> dict:
    """Write one immutable content-addressed shard; returns its manifest record."""
    ordered = sorted(rows, key=lambda row: row["receipt_no"])
    digest = _rows_digest(ordered)
    _atomic_write_json(archive_dir / _shard_filename(month, digest), {
        "method": METHOD, "archive_format": ARCHIVE_FORMAT, "shard_month": month,
        "archived_at": datetime.now(timezone.utc).isoformat(),
        "rows": ordered, "count": len(ordered), "row_digest": digest})
    versions: dict = {}
    for row in ordered:
        versions[row.get("parser_version")] = versions.get(row.get("parser_version"), 0) + 1
    return {"file": _shard_filename(month, digest), "count": len(ordered),
            "row_digest": digest, "parser_versions": versions,
            "updated_at": datetime.now(timezone.utc).isoformat()}


def _read_manifest_shard(archive_dir: Path, month: str, record: dict) -> list:
    """Read one manifest-referenced shard, verifying count and full-row hash.

    Anything unexpected halts loudly: a missing, corrupt, or altered shard is
    never papered over as empty.
    """
    filename = record.get("file") if isinstance(record, dict) else None
    if not isinstance(filename, str) or not re.fullmatch(r"shard-\d{6}-[0-9a-f]{16}\.json",
                                                          filename):
        raise ArchiveIntegrityError("UNKNOWN_MANIFEST", month, str(filename))
    try:
        shard = json.loads((archive_dir / filename).read_text(encoding="utf-8"))
    except OSError:
        raise ArchiveIntegrityError("SHARD_MISSING", month, filename) from None
    except ValueError:
        raise ArchiveIntegrityError("SHARD_CORRUPT", month, filename) from None
    rows = shard.get("rows") if isinstance(shard, dict) else None
    if (not isinstance(shard, dict) or shard.get("archive_format") != ARCHIVE_FORMAT
            or shard.get("shard_month") != month or not isinstance(rows, list)):
        raise ArchiveIntegrityError("SHARD_CORRUPT", month, filename)
    for row in rows:
        if (not isinstance(row, dict) or not isinstance(row.get("receipt_no"), str)
                or any(key not in row for key in ARCHIVE_ROW_KEYS)):
            raise ArchiveIntegrityError("ROW_SHAPE", month, filename)
    digest = _rows_digest(rows)
    if (shard.get("count") != len(rows) or shard.get("row_digest") != digest
            or record.get("count") != len(rows) or record.get("row_digest") != digest):
        raise ArchiveIntegrityError("ROW_DIGEST_MISMATCH", month, filename)
    return rows


def _load_archive_month(ledger: dict, archive_dir: Path, month: str,
                        cache: dict) -> dict:
    """Load manifest-referenced shards of one month into {receipt_no: row}.

    Files outside the manifest (crash orphans) are never read here.
    """
    if month not in cache:
        records = ledger.get("archive_manifest", {}).get(month, [])
        if not isinstance(records, list):
            raise ArchiveIntegrityError("UNKNOWN_MANIFEST", month)
        merged: dict = {}
        for record in records:
            for row in _read_manifest_shard(archive_dir, month, record):
                merged.setdefault(row["receipt_no"], row)
        cache[month] = merged
    return cache[month]


def _count_orphan_shards(ledger: dict, archive_dir: Path) -> int:
    """Count shard-named files the manifest does not reference (names only, never read)."""
    referenced = {record.get("file") for months in ledger.get("archive_manifest", {}).values()
                  if isinstance(months, list) for record in months
                  if isinstance(record, dict)}
    try:
        names = [path.name for path in archive_dir.glob("shard-*.json")]
    except OSError:
        return 0
    return sum(1 for name in names if name not in referenced
               and re.fullmatch(r"shard-\d{6}-[0-9a-f]{16}\.json", name))


def _sweep_unreferenced(archive_dir: Path, manifest: dict) -> int:
    """Delete shard files the persisted manifest no longer references.

    Only called after the manifest update itself was persisted, so a crash can
    only leave unread orphans, never dangling references.
    """
    referenced = {record.get("file") for months in manifest.values()
                  if isinstance(months, list) for record in months
                  if isinstance(record, dict)}
    removed = 0
    try:
        paths = sorted(archive_dir.glob("shard-*.json"))
    except OSError:
        return 0
    for path in paths:
        if path.name not in referenced:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
    return removed


def _is_archivable(item: dict) -> bool:
    return (item.get("source_status") not in PENDING_STATUSES
            and item.get("source_status") != "source_context_review_pending"
            and item.get("parser_version") == secondary.SOURCE_PARSER_VERSION
            and not item.get("correction_hold") and not item.get("withdrawal_flag"))


def _archive_terminal_rows(ledger: dict, archive_dir: Path, *, max_queue_entries: int,
                           cache: dict, to_level: int | None = None) -> int:
    """Spill archivable rows into new immutable shards; queue rows drop only after.

    Only terminal, current-version, non-held negatives move. Pending, stale,
    positive, and held rows are never archived. Old shard files stay referenced
    until the manifest update below is persisted; the caller sweeps them after
    that commit. ``to_level`` spills below the bound to free room for a bounded
    replay. Returns the archived count.
    """
    level = max_queue_entries if to_level is None else min(to_level, max_queue_entries)
    overflow = len(ledger["queue"]) - level
    if overflow <= 0:
        return 0
    candidates = sorted(
        (item.get("rcept_dt") or "", no)
        for no, item in ledger["queue"].items() if _is_archivable(item))
    moving = [no for _, no in candidates[:overflow]]
    if not moving:
        return 0
    by_month: dict = {}
    for no in moving:
        month = (ledger["queue"][no].get("rcept_dt") or "")[:6]
        if not re.fullmatch(r"\d{6}", month):
            continue
        by_month.setdefault(month, []).append(_archive_row(ledger["queue"][no]))
    archived = 0
    manifest = ledger.setdefault("archive_manifest", {})
    for month in sorted(by_month):
        stored = _load_archive_month(ledger, archive_dir, month, cache)
        for row in by_month[month]:
            stored[row["receipt_no"]] = row
        ordered = sorted(stored.values(), key=lambda row: row["receipt_no"])
        records = []
        for offset in range(0, len(ordered), ARCHIVE_SHARD_ROWS):
            records.append(_write_content_shard(
                archive_dir, month, ordered[offset:offset + ARCHIVE_SHARD_ROWS]))
        manifest[month] = records
        for row in by_month[month]:
            if row["receipt_no"] in ledger["queue"]:
                del ledger["queue"][row["receipt_no"]]
                archived += 1
    return archived


def _archived_stale_count(ledger: dict) -> int:
    current = secondary.SOURCE_PARSER_VERSION
    return sum(count for months in ledger.get("archive_manifest", {}).values()
               if isinstance(months, list) for entry in months
               if isinstance(entry, dict)
               for version, count in (entry.get("parser_versions") or {}).items()
               if version != current)


def _prune_source_cache(state: dict, ledger: dict) -> int:
    """Drop cache rows for receipts that are neither queued nor positive."""
    cache = state.get("secondary_source_cache")
    if not isinstance(cache, dict):
        return 0
    keep = set(ledger.get("queue", {})) | set(ledger.get("positives", {}))
    pruned = [key for key in cache if key not in keep]
    for key in pruned:
        del cache[key]
    return len(pruned)


def _rehydrate_locked(ledger: dict, directory: Path, limit: int, cache: dict) -> list:
    """Move stale-parser archived rows out of shards into a return list.

    Months without moved rows are left byte-identical. Shard rewrites happen
    before the caller persists the manifest/queue update; superseded files are
    swept only after that commit. The shared month cache is updated in place so
    a later spill in the same run cannot resurrect a moved row.
    """
    manifest = ledger.get("archive_manifest", {})
    if not isinstance(manifest, dict):
        raise ArchiveIntegrityError("UNKNOWN_MANIFEST")
    current = secondary.SOURCE_PARSER_VERSION
    moved: list = []
    seen = set(ledger.get("queue", {}))
    for month in sorted(manifest):
        if len(moved) >= limit:
            break
        stored = _load_archive_month(ledger, directory, month, cache)
        keep: dict = {}
        month_moved = 0
        for no in sorted(stored):
            row = stored[no]
            if len(moved) < limit and row.get("parser_version") != current and no not in seen:
                seen.add(no)
                moved.append(row)
                month_moved += 1
            else:
                keep[no] = row
        if not month_moved:
            continue
        cache[month] = keep
        ordered = sorted(keep.values(), key=lambda entry: entry["receipt_no"])
        records = []
        for offset in range(0, len(ordered), ARCHIVE_SHARD_ROWS):
            records.append(_write_content_shard(
                directory, month, ordered[offset:offset + ARCHIVE_SHARD_ROWS]))
        manifest[month] = records
        if not records:
            del manifest[month]
    return moved


def _apply_rehydrated(ledger: dict, moved: list) -> None:
    for row in moved:
        entry = dict(row)
        entry["source_attempt_count"] = 0
        entry["last_source_attempt_on"] = None
        ledger["queue"][row["receipt_no"]] = entry
        _record_history(entry, "rehydrated_for_parser_upgrade")


def _remaining_archived(ledger: dict) -> int:
    return sum(entry.get("count", 0) for months in ledger.get("archive_manifest", {}).values()
               if isinstance(months, list) for entry in months
               if isinstance(entry, dict))


def rehydrate_archive(state_path: Path, *, limit: int = 100,
                      read_state=None, write_state=None,
                      archive_dir: Path | None = None) -> dict:
    """Move stale-parser archived rows back into the active queue, bounded by limit.

    Shard files are rewritten (emptied ones removed) and the manifest updated
    in the same persisted write that re-queues the rows, so a crash either
    keeps rows archived or re-queued, never lost or duplicated.
    """
    if read_state is None or write_state is None:
        raise ValueError("state IO required")
    if not 1 <= limit <= 20000:
        raise ValueError("invalid rehydrate limit")
    directory = Path(archive_dir) if archive_dir is not None else archive_dir_for(state_path)
    state = read_state(state_path)
    ledger = state.get(LEDGER_KEY)
    if ledger is None:
        raise ValueError("opendart secondary ledger missing")
    moved = _rehydrate_locked(ledger, directory, limit, {})
    if not moved:
        return {"rehydrated": 0, "remaining_archived": _remaining_archived(ledger),
                "shards": sum(len(months) for months in ledger.get("archive_manifest", {}).values()
                              if isinstance(months, list)),
                "swept_unreferenced": 0}
    _apply_rehydrated(ledger, moved)
    state["revision"] += 1
    write_state(state_path, state)
    swept = _sweep_unreferenced(directory, ledger.get("archive_manifest", {}))
    return {"rehydrated": len(moved), "remaining_archived": _remaining_archived(ledger),
            "shards": sum(len(months) for months in ledger.get("archive_manifest", {}).values()
                          if isinstance(months, list)),
            "swept_unreferenced": swept}


def scan_opendart_secondary(state_path: Path, start: date, end: date, *,
                            max_listing_pages: int = 300, max_windows: int = 20,
                            review_limit: int = 20, max_pending: int = 5000,
                            overlap_days: int = 0,
                            max_queue_entries: int = DEFAULT_MAX_QUEUE_ENTRIES,
                            auto_rehydrate_limit: int = 0,
                            fetch_list=fetch_list_page,
                            fetch_document=secondary.fetch_source_document,
                            read_state=None, write_state=None, key: str = "") -> dict:
    """List every filing in range, then review queued source documents boundedly.

    Only ``opendart_secondary_backfill``, the shared
    ``secondary_source_cache``, and the ``opendart-secondary-archive/`` shard
    directory next to the state file are touched; full-text/direct/early
    cursors and the receipts/holdings/events ledgers are never modified here.

    ``auto_rehydrate_limit`` pulls that many stale archived rows back into the
    active queue first, limited further by free queue capacity, so scheduled
    runs drain parser-upgrade backlog while the same run keeps listing and
    reviewing. With a current parser version nothing moves.
    """
    if read_state is None or write_state is None:
        raise ValueError("state IO required")
    if review_limit and not key:
        raise ValueError("DART_API_KEY unavailable")
    if (start > end or start < EARLIEST_START or max_listing_pages < 1 or max_windows < 1
            or not 0 <= review_limit <= 300 or max_pending < 1 or not 0 <= overlap_days <= 31
            or max_queue_entries < 1 or not 0 <= auto_rehydrate_limit <= 20000):
        raise ValueError("invalid opendart secondary bounds")
    state = read_state(state_path)
    ledger = state.get(LEDGER_KEY)
    if ledger is None:
        ledger = {"method": METHOD, "start_date": start.isoformat(),
                  "target_date": end.isoformat(), "next_date": start.isoformat(),
                  "overlap_next_date": None, "coverage": [], "overlap_coverage": [],
                  "queue": {}, "positives": {}}
        state[LEDGER_KEY] = ledger
        # Persist the configured range before any network call so a failed
        # first window still leaves range/cursor facts instead of silence.
        state["revision"] += 1
        write_state(state_path, state)
    elif (ledger.get("method") != METHOD or ledger.get("start_date") != start.isoformat()
          or end < date.fromisoformat(ledger["target_date"])):
        raise ValueError("opendart secondary range conflicts with persisted cursor")
    else:
        ledger["target_date"] = end.isoformat()
    ledger.setdefault("coverage", [])
    ledger.setdefault("overlap_coverage", [])
    ledger.setdefault("queue", {})
    ledger.setdefault("positives", {})
    ledger.setdefault("archive_manifest", {})
    archive = {"dir": archive_dir_for(state_path), "months": {},
               "hits": 0, "archived": 0, "swept": 0}
    if len(ledger["queue"]) > max_queue_entries:
        # Spill archivable terminals first so a later auto-rehydrate has free
        # room; pending, stale, positive, and held rows are never spilled.
        # Shards land before the manifest/queue update below is persisted.
        archive["archived"] += _archive_terminal_rows(
            ledger, archive["dir"], max_queue_entries=max_queue_entries,
            cache=archive["months"])
        if archive["archived"]:
            state["revision"] += 1
            write_state(state_path, state)
            archive["swept"] += _sweep_unreferenced(
                archive["dir"], ledger.get("archive_manifest", {}))
    auto_rehydrated = 0
    if auto_rehydrate_limit and _archived_stale_count(ledger):
        # Free room for the bounded replay even when the queue sits exactly at
        # the bound; unarchivable rows are never touched for this.
        room_target = max(0, max_queue_entries - min(
            auto_rehydrate_limit, _archived_stale_count(ledger)))
        if len(ledger["queue"]) > room_target:
            archive["archived"] += _archive_terminal_rows(
                ledger, archive["dir"], max_queue_entries=max_queue_entries,
                to_level=room_target, cache=archive["months"])
            if archive["archived"]:
                state["revision"] += 1
                write_state(state_path, state)
                archive["swept"] += _sweep_unreferenced(
                    archive["dir"], ledger.get("archive_manifest", {}))
        room = max_queue_entries - len(ledger["queue"])
        if room > 0:
            moved = _rehydrate_locked(
                ledger, archive_dir_for(state_path), min(auto_rehydrate_limit, room),
                archive["months"])
            if moved:
                _apply_rehydrated(ledger, moved)
                auto_rehydrated = len(moved)
                state["revision"] += 1
                write_state(state_path, state)
                _sweep_unreferenced(archive_dir_for(state_path),
                                    ledger.get("archive_manifest", {}))
    forward = date.fromisoformat(ledger["next_date"])
    if not start <= forward <= end + timedelta(days=1):
        raise ValueError("opendart secondary cursor inconsistent")
    # Scan priority alternates across runs while both frontiers have work, so
    # a tiny page budget cannot starve either side forever: the prioritized
    # phase runs first and the other spends the remainder. An unfinished
    # overlap cycle keeps its pinned [from, to] window even as the forward
    # cursor advances past it; only a completed cycle starts a new rolling one
    # (at most one pass per run), so budget-short runs never silently skip
    # unscanned tail days.
    overlap_base = max(start, forward - timedelta(days=overlap_days)) if overlap_days else forward
    overlap_cap = min(forward, end + timedelta(days=1))
    overlap_cycle_reset = False
    pinned_from = pinned_to = None
    try:
        candidate_from = date.fromisoformat(ledger["overlap_cycle_from"])
        candidate_to = date.fromisoformat(ledger["overlap_cycle_to"])
        if candidate_from <= candidate_to:
            pinned_from, pinned_to = candidate_from, candidate_to
    except (KeyError, TypeError, ValueError):
        pass
    try:
        overlap_saved = (date.fromisoformat(ledger["overlap_next_date"])
                         if ledger.get("overlap_next_date") else None)
    except ValueError:
        overlap_saved = None
    if overlap_days and overlap_base <= overlap_cap - timedelta(days=1):
        restart = (pinned_to is not None and overlap_saved is not None
                   and overlap_saved > pinned_to)
        if pinned_to is None or restart:
            pinned_from, pinned_to = overlap_base, overlap_cap - timedelta(days=1)
            overlap_cycle_reset = restart
            ledger["overlap_cycle_from"] = pinned_from.isoformat()
            ledger["overlap_cycle_to"] = pinned_to.isoformat()
            state["revision"] += 1
            write_state(state_path, state)
            overlap_cursor = pinned_from
        else:
            overlap_cursor = pinned_from if overlap_saved is None else min(
                max(overlap_saved, pinned_from), pinned_to + timedelta(days=1))
    else:
        overlap_cursor = overlap_cap
    # The overlap phase never scans past the pinned cycle end, and the stored
    # frontier is never clamped up to the moving base: an unfinished cycle
    # keeps its dates even as forward advances past them.
    overlap_tail_end = (min(overlap_cap - timedelta(days=1), pinned_to)
                        if pinned_to is not None else overlap_cap - timedelta(days=1))
    forward_work = forward <= end
    overlap_work = overlap_days > 0 and overlap_cursor <= overlap_tail_end
    if forward_work and overlap_work:
        first_overlap = ledger.get("last_phase") == "forward"
    else:
        first_overlap = overlap_work and not forward_work
    ledger["last_phase"] = "overlap" if first_overlap else "forward"
    ledger.setdefault("overlap_max_window_days", 1)

    requests = windows = new_receipts = overlap_windows = requeued = 0
    required_pages = None
    backlog = False
    bound_exceeded = len(ledger["queue"]) > max_queue_entries

    def window_limit(frontier: date, cap: date, size: int) -> date:
        return min(frontier + timedelta(days=size - 1), cap)

    def scan_phase(frontier: date, cap: date, *, overlap: bool) -> date:
        """Commit complete windows until the cap or a budget/backlog/bound stop.

        Terminal verdicts spill into the durable archive to respect the queue
        bound; when nothing archivable remains the run stops and reports the
        bound explicitly instead of dropping pending or positive rows. Each
        phase grows only its own window size, so forward growth can never
        force the overlap tail into wasteful re-halving probes.
        """
        nonlocal requests, windows, new_receipts, overlap_windows, requeued, required_pages, backlog, bound_exceeded
        size_key = "overlap_max_window_days" if overlap else "max_window_days"
        default_size = 1 if overlap else MAX_WINDOW_DAYS
        while (frontier <= cap and windows < max_windows
               and requests < max_listing_pages and required_pages is None
               and not backlog and not bound_exceeded):
            if _outstanding_count(ledger) >= max_pending:
                backlog = True
                break
            if len(ledger["queue"]) > max_queue_entries:
                archive["archived"] += _archive_terminal_rows(
                    ledger, archive["dir"], max_queue_entries=max_queue_entries,
                    cache=archive["months"])
                if len(ledger["queue"]) > max_queue_entries:
                    bound_exceeded = True
                    break
            last = window_limit(frontier, cap, int(ledger.get(size_key) or default_size))
            pages, last, requests, needed = _collect_window(
                fetch_list, key, frontier, last, ledger=ledger, state=state,
                state_path=state_path, write_state=write_state,
                max_listing_pages=max_listing_pages, spent=requests,
                size_key=size_key)
            if needed is not None:
                required_pages = needed
                break
            if pages is None:
                break
            gained, _, hits, restored = _commit_window(ledger, state, state_path, write_state,
                                             frontier, last, pages,
                                             overlap=overlap, archive=archive,
                                             max_listing_pages=max_listing_pages)
            new_receipts += gained
            archive["hits"] += hits
            requeued += restored
            frontier = last + timedelta(days=1)
            windows += 1
            if overlap:
                overlap_windows += 1
        return frontier

    if first_overlap:
        overlap_cursor = scan_phase(overlap_cursor, overlap_tail_end, overlap=True)
        forward = scan_phase(forward, end, overlap=False)
    else:
        forward = scan_phase(forward, end, overlap=False)
        overlap_cursor = scan_phase(overlap_cursor, overlap_tail_end, overlap=True)
    if pinned_to is not None:
        ledger["overlap_next_date"] = max(overlap_cursor, pinned_from).isoformat()
    else:
        ledger["overlap_next_date"] = max(overlap_cursor, overlap_base).isoformat()

    reviewed = source_requests = positive_count = 0
    if review_limit:
        today = datetime.now(timezone.utc).date().isoformat()
        cache = state.setdefault("secondary_source_cache", {})
        pending = sorted(
            (int(item.get("source_attempt_count") or 0), item.get("rcept_dt") or "", no)
            for no, item in ledger["queue"].items()
            if _needs_source_review(item, today))
        for _, _, no in pending:
            if reviewed >= review_limit:
                break
            item = ledger["queue"][no]
            check = cache.get(no)
            if (check is None or check.get("parser_version") != secondary.SOURCE_PARSER_VERSION
                    or check.get("status") in PENDING_STATUSES):
                source_requests += 1
                try:
                    check = secondary.inspect_source_document(fetch_document(no, key))
                except (ValueError, RuntimeError, zipfile.BadZipFile):
                    check = {"status": "source_review_pending",
                             "parser_version": secondary.SOURCE_PARSER_VERSION}
                if check.get("status") not in PENDING_STATUSES:
                    cache[no] = check
            item["source_attempt_count"] = int(item.get("source_attempt_count") or 0) + 1
            item["last_source_attempt_on"] = today
            item["source_status"] = check.get("status") or "source_review_pending"
            item["parser_version"] = check.get("parser_version")
            item["source_sha256"] = check.get("source_sha256")
            _record_history(item, "source_reviewed")
            reviewed += 1
            if check.get("status") == "source_context_review_pending":
                positive_count += 1
                # Replace any earlier verdict for this receipt atomically in the
                # same persisted write so claims never mix parser generations.
                ledger["positives"][no] = {
                    "receipt_no": no, "corp_code": item.get("corp_code"),
                    "corp_name": item.get("corp_name"), "report_nm": item.get("report_nm"),
                    "rcept_dt": item.get("rcept_dt"),
                    "document_no": None,
                    "document_no_note": "list API provides no document_no; not fabricated",
                    "source_sha256": check.get("source_sha256"),
                    "parser_version": check.get("parser_version"),
                    "source_claims": check.get("source_claims") or [],
                    "correction_hold": item.get("correction_hold", False),
                    "withdrawal_flag": item.get("withdrawal_flag", False),
                    "relation": ("correction_relation_unverified" if item.get("correction_hold")
                                 else "holding_observation_pending"),
                    "integration_required": "sol_holding_observation"}
            else:
                # A reprocessed receipt that no longer shows an NPS equity
                # context must not keep its earlier positive claims.
                ledger["positives"].pop(no, None)
        if reviewed:
            state["revision"] += 1
            write_state(state_path, state)
    cache_pruned = _prune_source_cache(state, ledger)
    if cache_pruned:
        state["revision"] += 1
        write_state(state_path, state)

    # Completion distinguishes three scopes: the forward full-range scan
    # (2006 exhaustive coverage), the pinned tail cycle in progress, and stale
    # archived rows awaiting parser-upgrade rehydration. Residual risk: a
    # same-receipt rm change older than the pinned tail may only surface as a
    # new correction filing in the forward scan, and such a filing is not
    # guaranteed to exist; the tail is a bounded re-verification window, not a
    # promise to catch every retroactive edit.
    forward_complete = ledger["next_date"] > end.isoformat()
    overlap_pending_days = 0
    if overlap_days:
        try:
            cycle_to = date.fromisoformat(ledger["overlap_cycle_to"])
            frontier = date.fromisoformat(ledger["overlap_next_date"])
            if frontier <= cycle_to:
                overlap_pending_days = (cycle_to - frontier).days + 1
        except (KeyError, TypeError, ValueError):
            pass
    pending_sources = _outstanding_count(ledger)
    archived_stale = _archived_stale_count(ledger)
    if required_pages is not None:
        status = "LISTING_BUDGET_INSUFFICIENT"
    elif bound_exceeded:
        status = "QUEUE_BOUND_EXCEEDED"
    elif backlog:
        status = "QUEUE_BACKLOG"
    elif not forward_complete:
        status = "LISTING_IN_PROGRESS"
    elif pending_sources:
        status = "LISTING_COMPLETE_SOURCE_PENDING"
    elif overlap_pending_days or archived_stale:
        status = "REPROCESS_PENDING"
    else:
        status = "SOURCE_REVIEW_COMPLETE"
    archived_total = sum(entry.get("count", 0)
                         for months in ledger.get("archive_manifest", {}).values()
                         if isinstance(months, list) for entry in months
                         if isinstance(entry, dict))
    return {"status": status, "next_date": ledger["next_date"],
            "target_date": ledger["target_date"],
            "completed_windows": len(ledger["coverage"]), "windows_this_run": windows,
            "overlap_windows": overlap_windows, "overlap_next_date": ledger["overlap_next_date"],
            "overlap_cycle_reset": overlap_cycle_reset,
            "overlap_pending_days": overlap_pending_days,
            "forward_complete": forward_complete,
            "last_phase": ledger.get("last_phase"),
            "listing_requests": requests, "new_receipts": new_receipts,
            "queued_receipts": len(ledger["queue"]), "pending_sources": pending_sources,
            "archived_this_run": archive["archived"], "archived_total": archived_total,
            "archived_hits": archive["hits"], "archived_requeued": requeued,
            "archived_stale": archived_stale,
            "auto_rehydrated": auto_rehydrated,
            "archive_orphans": _count_orphan_shards(ledger, archive["dir"]),
            "swept_unreferenced": archive["swept"],
            "cache_pruned": cache_pruned,
            "source_review_attempts": reviewed, "source_document_requests": source_requests,
            "positive_count": positive_count,
            "positive_pending_total": len(ledger["positives"]),
            "required_pages": required_pages,
            "holding_reflection": HOLDING_REFLECTION}
