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
"""
from __future__ import annotations

import hashlib
import http.client
import json
import re
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


def _correction_flags(report_nm: str, rm: str) -> tuple[bool, bool]:
    """Signal correction/withdrawal holds from long and short remark forms."""
    if CORRECTION_HINT.search(report_nm) or CORRECTION_HINT.search(rm):
        withdrawal = bool(re.search(r"철회|철", report_nm) or re.search(r"철회|철", rm))
        return True, withdrawal
    tokens = set(RM_TOKENS.split(rm)) - {""}
    if tokens & (RM_CORRECTION_TOKENS | RM_WITHDRAWAL_TOKENS | RM_CANCEL_TOKENS):
        return True, bool(tokens & RM_WITHDRAWAL_TOKENS)
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


def _refresh_entry(item: dict, row: dict, window_from: str, window_to: str) -> None:
    """Refresh listing metadata on recrawl; source-review evidence is untouched."""
    report = str(row.get("report_nm") or "")
    rm = str(row.get("rm") or "")
    correction_hold, withdrawal_flag = _correction_flags(report, rm)
    item.update(corp_code=str(row.get("corp_code") or "") or None,
                corp_name=str(row.get("corp_name") or "")[:120] or None,
                stock_code=str(row.get("stock_code") or "") or None,
                report_nm=report[:180], rcept_dt=str(row.get("rcept_dt") or ""), rm=rm[:120],
                last_seen_from=window_from, last_seen_to=window_to,
                correction_hold=correction_hold, withdrawal_flag=withdrawal_flag)


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
                    max_listing_pages: int,
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
            ledger["max_window_days"] = (last - cursor).days + 1
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
                   pages: list[dict], *, overlap: bool, max_queue_entries: int) -> tuple[int, int]:
    """Validate pages, queue every receipt, and advance only this phase's cursor."""
    try:
        total = validate_list_pages(pages, cursor, last)
    except ValueError as exc:
        code = str(exc) if str(exc) in ("NO_DATA_SHAPE", "PAGE_STATUS", "PAGINATION_METADATA",
                                        "PAGE_COUNT", "PAGE_IDENTITY", "ROW_SHAPE",
                                        "RECEIPT_IDENTITY", "ROW_DATE", "ROW_DATE_RANGE",
                                        "RECEIPT_COVERAGE") else "PAGE_VALIDATION"
        raise OpendartListError(code, cursor, last) from None
    new_receipts = queued_this_window = 0
    for page in pages:
        for row in page.get("list") or []:
            no = str(row.get("rcept_no") or "")
            existing = ledger["queue"].get(no)
            if existing is None:
                ledger["queue"][no] = _queue_entry(row, cursor.isoformat(), last.isoformat())
                new_receipts += 1
            else:
                _refresh_entry(existing, row, cursor.isoformat(), last.isoformat())
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
    if not overlap:
        # Only forward commits grow the window: overlap rescans must stay
        # small, otherwise the next run burns its page budget re-halving
        # instead of advancing either frontier.
        ledger["max_window_days"] = min(
            MAX_WINDOW_DAYS, max(1, (last - date.fromisoformat(history[-1]["from"])).days * 2 + 2))
    _enforce_queue_bound(ledger, max_queue_entries)
    state["revision"] += 1
    write_state(state_path, state)
    return new_receipts, total


def _enforce_queue_bound(ledger: dict, max_queue_entries: int) -> int:
    """Evict only terminal, current-version, non-held negatives with explicit accounting.

    Pending, stale-version, positive, and correction/withdrawal-held rows are
    never evicted; evicted rows stay re-derivable from the per-window coverage
    records (from/to/total/page_digest) instead of vanishing silently.
    """
    evicted = 0
    while len(ledger["queue"]) > max_queue_entries:
        candidates = sorted(
            (item.get("rcept_dt") or "", no)
            for no, item in ledger["queue"].items()
            if item.get("source_status") not in PENDING_STATUSES
            and item.get("source_status") != "source_context_review_pending"
            and item.get("parser_version") == secondary.SOURCE_PARSER_VERSION
            and not item.get("correction_hold") and not item.get("withdrawal_flag"))
        if not candidates:
            break
        _, oldest = candidates[0]
        del ledger["queue"][oldest]
        evicted += 1
        ledger["evicted_count"] = int(ledger.get("evicted_count") or 0) + 1
        ledger["evicted_digest"] = hashlib.sha256(
            f'{ledger.get("evicted_digest") or ""}\n{oldest}'.encode()).hexdigest()
    return evicted


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
                  "queue": {}, "positives": {},
                  "evicted_count": 0, "evicted_digest": ""}
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
    ledger.setdefault("evicted_count", 0)
    ledger.setdefault("evicted_digest", "")
    forward = date.fromisoformat(ledger["next_date"])
    if not start <= forward <= end + timedelta(days=1):
        raise ValueError("opendart secondary cursor inconsistent")
    # Overlap rescans already-listed days for late filings and metadata changes,
    # but track their progress separately: without a persisted overlap frontier
    # every run would restart at ``forward - overlap_days`` and burn its whole
    # page budget before the forward cursor ever advances.
    overlap_base = max(start, forward - timedelta(days=overlap_days)) if overlap_days else forward
    try:
        overlap_saved = (date.fromisoformat(ledger["overlap_next_date"])
                         if ledger.get("overlap_next_date") else overlap_base)
    except ValueError:
        overlap_saved = overlap_base
    overlap_cursor = min(max(overlap_saved, overlap_base), forward)
    overlap_cap = min(forward, end + timedelta(days=1))

    requests = windows = new_receipts = overlap_windows = 0
    required_pages = None
    backlog = False

    def window_limit(frontier: date, cap: date) -> date:
        return min(frontier + timedelta(days=int(ledger.get("max_window_days")
                                                or MAX_WINDOW_DAYS) - 1), cap)

    def scan_phase(frontier: date, cap: date, *, overlap: bool) -> date:
        """Commit complete windows until the cap or a budget/backlog stop."""
        nonlocal requests, windows, new_receipts, overlap_windows, required_pages, backlog
        while (frontier <= cap and windows < max_windows
               and requests < max_listing_pages and required_pages is None and not backlog):
            if _outstanding_count(ledger) >= max_pending:
                backlog = True
                break
            last = window_limit(frontier, cap)
            pages, last, requests, needed = _collect_window(
                fetch_list, key, frontier, last, ledger=ledger, state=state,
                state_path=state_path, write_state=write_state,
                max_listing_pages=max_listing_pages, spent=requests)
            if needed is not None:
                required_pages = needed
                break
            if pages is None:
                break
            gained, _ = _commit_window(ledger, state, state_path, write_state,
                                       frontier, last, pages,
                                       overlap=overlap, max_queue_entries=max_queue_entries)
            new_receipts += gained
            frontier = last + timedelta(days=1)
            windows += 1
            if overlap:
                overlap_windows += 1
        return frontier

    # Phase 1: re-verify the overlap tail with its own persisted frontier so a
    # tight page budget still leaves room for phase 2 to advance forward.
    overlap_cursor = scan_phase(overlap_cursor, overlap_cap - timedelta(days=1), overlap=True)
    ledger["overlap_next_date"] = max(overlap_cursor, overlap_base).isoformat()
    # Phase 2: advance the forward cursor over not-yet-listed days.
    forward = scan_phase(forward, end, overlap=False)

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
            history = item.setdefault("source_history", [])
            history.append({"checked_at": datetime.now(timezone.utc).isoformat(),
                            "status": item["source_status"],
                            "parser_version": item["parser_version"],
                            "source_sha256": item["source_sha256"]})
            del history[:-SOURCE_HISTORY_CAP]
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
    elif backlog:
        status = "QUEUE_BACKLOG"
    elif not list_complete:
        status = "LISTING_IN_PROGRESS"
    elif pending_sources:
        status = "LISTING_COMPLETE_SOURCE_PENDING"
    else:
        status = "SOURCE_REVIEW_COMPLETE"
    return {"status": status, "next_date": ledger["next_date"],
            "target_date": ledger["target_date"],
            "completed_windows": len(ledger["coverage"]), "windows_this_run": windows,
            "overlap_windows": overlap_windows, "overlap_next_date": ledger["overlap_next_date"],
            "listing_requests": requests, "new_receipts": new_receipts,
            "queued_receipts": len(ledger["queue"]), "pending_sources": pending_sources,
            "source_review_attempts": reviewed, "source_document_requests": source_requests,
            "positive_count": positive_count,
            "positive_pending_total": len(ledger["positives"]),
            "evicted_count": int(ledger.get("evicted_count") or 0),
            "required_pages": required_pages,
            "holding_reflection": HOLDING_REFLECTION}
