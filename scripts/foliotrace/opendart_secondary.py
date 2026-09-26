"""Lossless OpenDART list-API backfill for third-party filing discovery.

The DART web full-text host is unreachable, so this lane lists filings through
the official OpenDART list API without restricting company or report type, then
queues every discovered receipt for bounded source-document review.

Listing facts, downloaded sources, and numeric holding observations are tracked
separately: a completed list window never implies its documents were reviewed,
and a reviewed document never implies its numbers entered holdings. Positive
source findings stay in this lane's independent queue until Sol wires the
shared holding-observation path; this module never writes the full-text,
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
ARCHIVE_FORMAT = 1
# Archived rows per monthly shard file; keeps each static data-branch file small.
ARCHIVE_SHARD_ROWS = 5000
PENDING_STATUSES = ("source_review_pending", "source_unavailable")
SOURCE_HISTORY_CAP = 5
DEFAULT_MAX_QUEUE_ENTRIES = 20000
# Holding reflection needs Sol's shared observation wiring; never implied here.
HOLDING_REFLECTION = "pending_sol_integration"


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

    Receipts already recoverable from the archive are not re-queued; returns
    ``(new_receipts, total, archived_hits)``. Each phase grows only its own
    window size, and only when doubling the fetched pages still fits the run
    budget, so tiny budgets settle on stable single-day windows instead of
    oscillating between growth and re-halving probes.
    """
    try:
        total = validate_list_pages(pages, cursor, last)
    except ValueError as exc:
        code = str(exc) if str(exc) in ("NO_DATA_SHAPE", "PAGE_STATUS", "PAGINATION_METADATA",
                                        "PAGE_COUNT", "PAGE_IDENTITY", "ROW_SHAPE",
                                        "RECEIPT_IDENTITY", "ROW_DATE", "ROW_DATE_RANGE",
                                        "RECEIPT_COVERAGE") else "PAGE_VALIDATION"
        raise OpendartListError(code, cursor, last) from None
    new_receipts = queued_this_window = archived_hits = 0
    window_months = {cursor.strftime("%Y%m"), last.strftime("%Y%m")}
    archived_lookup: dict = {}
    for month in window_months:
        archived_lookup.update(_load_archive_month(ledger, archive["dir"], month, archive["months"]))
    for page in pages:
        for row in page.get("list") or []:
            no = str(row.get("rcept_no") or "")
            existing = ledger["queue"].get(no)
            if existing is None:
                if no in archived_lookup:
                    archived_hits += 1
                else:
                    ledger["queue"][no] = _queue_entry(row, cursor.isoformat(), last.isoformat())
                    new_receipts += 1
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
    return new_receipts, total, archived_hits


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


def _shard_path(archive_dir: Path, month: str, index: int) -> Path:
    return archive_dir / f"shard-{month}-{index:04d}.json"


def _read_shard_rows(archive_dir: Path, month: str, index: int) -> list:
    try:
        shard = json.loads(_shard_path(archive_dir, month, index).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if (not isinstance(shard, dict) or shard.get("archive_format") != ARCHIVE_FORMAT
            or shard.get("shard_month") != month or not isinstance(shard.get("rows"), list)):
        return []
    return [row for row in shard["rows"]
            if isinstance(row, list) and len(row) == 6 and isinstance(row[0], str)]


def _write_shard_rows(archive_dir: Path, month: str, index: int, rows: list) -> dict:
    """Write one shard durably; returns its manifest record (never trusts callers)."""
    ordered = sorted(rows, key=lambda row: row[0])
    digest = hashlib.sha256("\n".join(row[0] for row in ordered).encode()).hexdigest()
    _atomic_write_json(_shard_path(archive_dir, month, index), {
        "method": METHOD, "archive_format": ARCHIVE_FORMAT, "shard_month": month,
        "archived_at": datetime.now(timezone.utc).isoformat(),
        "parser_version": secondary.SOURCE_PARSER_VERSION,
        "rows": ordered, "count": len(ordered), "id_digest": digest})
    return {"count": len(ordered), "id_digest": digest,
            "parser_version": secondary.SOURCE_PARSER_VERSION,
            "updated_at": datetime.now(timezone.utc).isoformat()}


def _manifest_shards(ledger: dict, month: str) -> list[int]:
    return sorted(int(index) for index in ledger.get("archive_manifest", {}).get(month, {}))


def _load_archive_month(ledger: dict, archive_dir: Path, month: str,
                        cache: dict) -> dict:
    """Load every shard of one month into {receipt_no: row}; missing files read as empty."""
    if month not in cache:
        merged: dict = {}
        indexes = set(_manifest_shards(ledger, month))
        try:
            files = sorted(archive_dir.glob(f"shard-{month}-*.json"))
        except OSError:
            files = []
        for path in files:
            match = re.fullmatch(r"shard-\d{6}-(\d{4})\.json", path.name)
            if match:
                indexes.add(int(match.group(1)))
        for index in sorted(indexes):
            for row in _read_shard_rows(archive_dir, month, index):
                merged.setdefault(row[0], row)
        cache[month] = merged
    return cache[month]


def _is_archivable(item: dict) -> bool:
    return (item.get("source_status") not in PENDING_STATUSES
            and item.get("source_status") != "source_context_review_pending"
            and item.get("parser_version") == secondary.SOURCE_PARSER_VERSION
            and not item.get("correction_hold") and not item.get("withdrawal_flag"))


def _archive_terminal_rows(ledger: dict, archive_dir: Path, *, max_queue_entries: int,
                           cache: dict) -> int:
    """Spill archivable rows into monthly shards; shard files land before queue rows go.

    Only terminal, current-version, non-held negatives move. Pending, stale,
    positive, and held rows are never archived. Returns the archived count.
    """
    overflow = len(ledger["queue"]) - max_queue_entries
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
        item = ledger["queue"][no]
        by_month.setdefault(month, []).append(
            [no, item.get("source_status"), item.get("parser_version"),
             item.get("source_sha256"), bool(item.get("correction_hold")),
             bool(item.get("withdrawal_flag"))])
    archived = 0
    manifest = ledger.setdefault("archive_manifest", {})
    stored_ids: set = set()
    for month in sorted(by_month):
        stored = _load_archive_month(ledger, archive_dir, month, cache)
        for row in by_month[month]:
            stored.setdefault(row[0], row)
            stored_ids.add(row[0])
    for month in sorted(by_month):
        stored = _load_archive_month(ledger, archive_dir, month, cache)
        for row in by_month[month]:
            stored.setdefault(row[0], row)
        months = manifest.setdefault(month, {})
        index = 0
        ordered = sorted(stored.values(), key=lambda row: row[0])
        for offset in range(0, len(ordered), ARCHIVE_SHARD_ROWS):
            months[str(index)] = _write_shard_rows(
                archive_dir, month, index, ordered[offset:offset + ARCHIVE_SHARD_ROWS])
            index += 1
        for stale in [key for key in months if int(key) >= index]:
            try:
                _shard_path(archive_dir, month, int(stale)).unlink()
            except OSError:
                pass
            del months[stale]
    for no in moving:
        if no in stored_ids and no in ledger["queue"]:
            del ledger["queue"][no]
            archived += 1
    return archived


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
    current = secondary.SOURCE_PARSER_VERSION
    manifest = ledger.get("archive_manifest", {})
    moved: list = []
    seen = set(ledger.get("queue", {}))
    for month in sorted(manifest):
        if len(moved) >= limit:
            break
        months = manifest[month]
        stored: dict = {}
        for index in sorted(int(key) for key in months):
            for row in _read_shard_rows(directory, month, index):
                stored.setdefault(row[0], row)
        keep: dict = {}
        for no in sorted(stored):
            row = stored[no]
            if len(moved) < limit and row[2] != current and no not in seen:
                seen.add(no)
                moved.append(row)
            else:
                keep[no] = row
        ordered = sorted(keep.values(), key=lambda entry: entry[0])
        index = 0
        for offset in range(0, len(ordered), ARCHIVE_SHARD_ROWS):
            months[str(index)] = _write_shard_rows(
                directory, month, index, ordered[offset:offset + ARCHIVE_SHARD_ROWS])
            index += 1
        for stale in [key for key in months if int(key) >= index]:
            try:
                _shard_path(directory, month, int(stale)).unlink()
            except OSError:
                pass
            del months[stale]
        if not months:
            del manifest[month]
    for no, status, parser, sha, held, withdrawn in moved:
        ledger["queue"][no] = {
            "receipt_no": no, "corp_code": None, "corp_name": None, "stock_code": None,
            "report_nm": "", "rcept_dt": no[:8], "rm": "",
            "first_seen_from": "archive", "first_seen_to": "archive",
            "last_seen_from": "archive", "last_seen_to": "archive",
            "correction_hold": bool(held), "withdrawal_flag": bool(withdrawn),
            "source_status": status, "parser_version": parser,
            "source_attempt_count": 0, "last_source_attempt_on": None,
            "source_sha256": sha, "source_history": []}
    remaining = sum(entry.get("count", 0) for months in manifest.values() for entry in months.values())
    state["revision"] += 1
    write_state(state_path, state)
    return {"rehydrated": len(moved), "remaining_archived": remaining,
            "shards": sum(len(months) for months in manifest.values())}


def scan_opendart_secondary(state_path: Path, start: date, end: date, *,
                            max_listing_pages: int = 300, max_windows: int = 20,
                            review_limit: int = 20, max_pending: int = 5000,
                            overlap_days: int = 0,
                            max_queue_entries: int = DEFAULT_MAX_QUEUE_ENTRIES,
                            fetch_list=fetch_list_page,
                            fetch_document=secondary.fetch_source_document,
                            read_state=None, write_state=None, key: str = "") -> dict:
    """List every filing in range, then review queued source documents boundedly.

    Only ``opendart_secondary_backfill`` and the shared
    ``secondary_source_cache`` are touched; full-text/direct/early cursors and
    the receipts/holdings/events ledgers are never modified here.
    """
    if read_state is None or write_state is None:
        raise ValueError("state IO required")
    if review_limit and not key:
        raise ValueError("DART_API_KEY unavailable")
    if (start > end or start < EARLIEST_START or max_listing_pages < 1 or max_windows < 1
            or not 0 <= review_limit <= 300 or max_pending < 1 or not 0 <= overlap_days <= 31
            or max_queue_entries < 1):
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
    forward = date.fromisoformat(ledger["next_date"])
    if not start <= forward <= end + timedelta(days=1):
        raise ValueError("opendart secondary cursor inconsistent")
    # Scan priority alternates across runs while both frontiers have work, so
    # a tiny page budget cannot starve either side forever: the prioritized
    # phase runs first and the other spends the remainder. A completed overlap
    # pass starts a new bounded cycle (at most one pass per run) so late or
    # corrected rows keep being seen instead of the lane going silent.
    overlap_base = max(start, forward - timedelta(days=overlap_days)) if overlap_days else forward
    overlap_cap = min(forward, end + timedelta(days=1))
    try:
        overlap_saved = (date.fromisoformat(ledger["overlap_next_date"])
                         if ledger.get("overlap_next_date") else overlap_base)
    except ValueError:
        overlap_saved = overlap_base
    if overlap_saved >= overlap_cap and overlap_cap > overlap_base:
        overlap_cursor, overlap_cycle_reset = overlap_base, True
    else:
        overlap_cursor = min(max(overlap_saved, overlap_base), forward)
        overlap_cycle_reset = False
    forward_work = forward <= end
    overlap_work = overlap_days > 0 and overlap_cursor <= overlap_cap - timedelta(days=1)
    if forward_work and overlap_work:
        first_overlap = ledger.get("last_phase") == "forward"
    else:
        first_overlap = overlap_work and not forward_work
    ledger["last_phase"] = "overlap" if first_overlap else "forward"
    ledger.setdefault("overlap_max_window_days", 1)

    requests = windows = new_receipts = overlap_windows = 0
    required_pages = None
    backlog = False
    bound_exceeded = False
    archive = {"dir": archive_dir_for(state_path), "months": {},
               "hits": 0, "archived": 0}
    if len(ledger["queue"]) > max_queue_entries:
        # Spill before any listing so an over-bound queue never blocks the run
        # from starting; deletions persist immediately, shards already landed.
        archive["archived"] += _archive_terminal_rows(
            ledger, archive["dir"], max_queue_entries=max_queue_entries,
            cache=archive["months"])
        if archive["archived"]:
            state["revision"] += 1
            write_state(state_path, state)
        if len(ledger["queue"]) > max_queue_entries:
            bound_exceeded = True

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
        nonlocal requests, windows, new_receipts, overlap_windows, required_pages, backlog, bound_exceeded
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
            gained, _, hits = _commit_window(ledger, state, state_path, write_state,
                                             frontier, last, pages,
                                             overlap=overlap, archive=archive,
                                             max_listing_pages=max_listing_pages)
            new_receipts += gained
            archive["hits"] += hits
            frontier = last + timedelta(days=1)
            windows += 1
            if overlap:
                overlap_windows += 1
        return frontier

    if first_overlap:
        overlap_cursor = scan_phase(overlap_cursor, overlap_cap - timedelta(days=1), overlap=True)
        forward = scan_phase(forward, end, overlap=False)
    else:
        forward = scan_phase(forward, end, overlap=False)
        overlap_cursor = scan_phase(overlap_cursor, overlap_cap - timedelta(days=1), overlap=True)
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

    list_complete = ledger["next_date"] > end.isoformat()
    pending_sources = _outstanding_count(ledger)
    if required_pages is not None:
        status = "LISTING_BUDGET_INSUFFICIENT"
    elif bound_exceeded:
        status = "QUEUE_BOUND_EXCEEDED"
    elif backlog:
        status = "QUEUE_BACKLOG"
    elif not list_complete:
        status = "LISTING_IN_PROGRESS"
    elif pending_sources:
        status = "LISTING_COMPLETE_SOURCE_PENDING"
    else:
        status = "SOURCE_REVIEW_COMPLETE"
    archived_total = sum(entry.get("count", 0)
                         for months in ledger.get("archive_manifest", {}).values()
                         for entry in months.values())
    return {"status": status, "next_date": ledger["next_date"],
            "target_date": ledger["target_date"],
            "completed_windows": len(ledger["coverage"]), "windows_this_run": windows,
            "overlap_windows": overlap_windows, "overlap_next_date": ledger["overlap_next_date"],
            "overlap_cycle_reset": overlap_cycle_reset,
            "last_phase": ledger.get("last_phase"),
            "listing_requests": requests, "new_receipts": new_receipts,
            "queued_receipts": len(ledger["queue"]), "pending_sources": pending_sources,
            "archived_this_run": archive["archived"], "archived_total": archived_total,
            "archived_hits": archive["hits"],
            "source_review_attempts": reviewed, "source_document_requests": source_requests,
            "positive_count": positive_count,
            "positive_pending_total": len(ledger["positives"]),
            "required_pages": required_pages,
            "holding_reflection": HOLDING_REFLECTION}
