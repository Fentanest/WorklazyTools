#!/usr/bin/env python3
"""Read-only OpenDART audit of the earliest NPS large-holding filings."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


NPS = re.compile(r"국민연금|National Pension Service", re.I)
RECEIPT = re.compile(r"^\d{14}$")
CORP = re.compile(r"^\d{8}$")


class ProbeError(Exception):
    pass


class RequestBudgetReached(Exception):
    pass


class DartClient:
    def __init__(self, key: str, limit: int):
        self.key = key
        self.limit = limit
        self.requests = 0

    def get(self, endpoint: str, params: dict[str, object]) -> dict:
        if self.requests >= self.limit:
            raise RequestBudgetReached
        query = urllib.parse.urlencode({**params, "crtfc_key": self.key})
        url = f"https://opendart.fss.or.kr/api/{endpoint}?{query}"
        self.requests += 1
        for attempt in range(3):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": "FolioTrace-History-Audit/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    payload = response.read(2_000_001)
                if len(payload) > 2_000_000:
                    raise ProbeError("response_too_large")
                result = json.loads(payload)
                if not isinstance(result, dict):
                    raise ProbeError("invalid_response")
                status = str(result.get("status", ""))
                if status not in ("000", "013"):
                    raise ProbeError(f"dart_status_{status[:3]}")
                return result
            except urllib.error.HTTPError as error:
                if attempt == 2:
                    raise ProbeError(f"http_status_{error.code}") from None
            except (urllib.error.URLError, TimeoutError):
                if attempt == 2:
                    raise ProbeError("transport_failure") from None
            time.sleep(attempt + 1)
        raise ProbeError("request_failed")


def windows(year: int):
    cursor = date(year, 1, 1)
    last = date(year, 12, 31)
    while cursor <= last:
        end = min(cursor + timedelta(days=79), last)
        yield cursor, end
        cursor = end + timedelta(days=1)


def public_row(row: dict) -> dict | None:
    no = str(row.get("rcept_no", ""))
    corp = str(row.get("corp_code", ""))
    if not RECEIPT.fullmatch(no) or not CORP.fullmatch(corp):
        return None
    return {
        "receipt_no": no,
        "receipt_date": str(row.get("rcept_dt", "")),
        "corp_code": corp,
        "stock_code": str(row.get("stock_code", "")),
        "company": str(row.get("corp_name", ""))[:100],
        "filer": str(row.get("flr_nm", ""))[:100],
        "report": str(row.get("report_nm", ""))[:150],
        "filing_url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={no}",
    }


def inspect_first_filings(client: DartClient, rows: list[dict]) -> list[dict]:
    from scripts.foliotrace.folio import dart_document

    findings = []
    structured_cache: dict[str, dict] = {}
    for row in rows[:3]:
        entry = {"receipt_no": row["receipt_no"], "structured": "unavailable", "document": "unparsed"}
        corp = row["corp_code"]
        try:
            if corp not in structured_cache:
                structured_cache[corp] = client.get("majorstock.json", {"corp_code": corp})
            for item in structured_cache[corp].get("list") or []:
                if str(item.get("rcept_no", "")) == row["receipt_no"] and NPS.search(str(item.get("repror", ""))):
                    entry["structured"] = "quantity_and_ratio" if item.get("stkqy") and item.get("stkrt") else "missing_values"
                    break
        except (ProbeError, RequestBudgetReached):
            entry["structured"] = "lookup_failed"
        try:
            if client.requests >= client.limit:
                raise RequestBudgetReached
            client.requests += 1
            parsed = dart_document(row["receipt_no"], client.key, retries=1)
            entry["document"] = "quantity_and_ratio" if parsed.get("quantity") and parsed.get("company_ownership_percent") else "missing_values"
        except RequestBudgetReached:
            entry["document"] = "request_budget_reached"
        except Exception:
            entry["document"] = "unparsed_by_current_parser"
        findings.append(entry)
    return findings


def scan(client: DartClient, start_year: int, end_year: int, output: Path) -> dict:
    report: dict = {"start_year": start_year, "end_year": end_year, "complete_through_year": None,
                    "first_d001_date": None, "first_nps_year": None, "first_nps_filings": [],
                    "years": [], "requests": 0, "status": "running"}

    def save():
        report["requests"] = client.requests
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for year in range(start_year, end_year + 1):
        year_total = 0
        year_nps: list[dict] = []
        try:
            for first_day, last_day in windows(year):
                params = {"bgn_de": first_day.strftime("%Y%m%d"), "end_de": last_day.strftime("%Y%m%d"),
                          "pblntf_ty": "D", "pblntf_detail_ty": "D001", "last_reprt_at": "N",
                          "sort": "date", "sort_mth": "asc", "page_count": 100}
                first = client.get("list.json", {**params, "page_no": 1})
                if first.get("status") == "013":
                    continue
                total = int(first.get("total_count") or 0)
                pages = int(first.get("total_page") or 0)
                if total < 1 or pages != (total + 99) // 100 or pages > 10_000:
                    raise ProbeError("pagination_inconsistent")
                year_total += total
                seen: set[str] = set()
                for page in range(1, pages + 1):
                    data = first if page == 1 else client.get("list.json", {**params, "page_no": page})
                    if data.get("status") != "000":
                        raise ProbeError("page_status_inconsistent")
                    if int(data.get("total_count") or 0) != total or int(data.get("page_no") or 0) != page:
                        raise ProbeError("page_metadata_inconsistent")
                    rows = data.get("list")
                    if not isinstance(rows, list):
                        raise ProbeError("page_rows_missing")
                    for item in rows:
                        no = str(item.get("rcept_no", ""))
                        if not RECEIPT.fullmatch(no) or no in seen:
                            raise ProbeError("receipt_identity_inconsistent")
                        seen.add(no)
                        receipt_date = str(item.get("rcept_dt", ""))
                        if not re.fullmatch(r"\d{8}", receipt_date):
                            raise ProbeError("receipt_date_inconsistent")
                        if report["first_d001_date"] is None or receipt_date < report["first_d001_date"]:
                            report["first_d001_date"] = receipt_date
                        if NPS.search(str(item.get("flr_nm", ""))):
                            row = public_row(item)
                            if not row:
                                raise ProbeError("nps_identity_missing")
                            year_nps.append(row)
                if len(seen) != total:
                    raise ProbeError("listing_count_inconsistent")
            report["years"].append({"year": year, "d001_count": year_total, "nps_count": len(year_nps)})
            report["complete_through_year"] = year
            print(f"year={year} d001_count={year_total} nps_count={len(year_nps)} requests={client.requests}", flush=True)
            save()
            if year_nps:
                year_nps.sort(key=lambda row: (row["receipt_date"], row["receipt_no"]))
                report["first_nps_year"] = year
                report["first_nps_filings"] = year_nps[:10]
                report["sample_parse"] = inspect_first_filings(client, year_nps)
                report["status"] = "found"
                save()
                break
        except RequestBudgetReached:
            report["status"] = "request_budget_reached"
            report["incomplete_year"] = year
            save()
            break
        except ProbeError as error:
            report["status"] = str(error)
            report["incomplete_year"] = year
            save()
            break
    else:
        report["status"] = "no_nps_in_range"
        save()
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=1999)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--max-requests", type=int, default=2500)
    parser.add_argument("--output", type=Path, default=Path("history-probe.json"))
    args = parser.parse_args()
    if not 1999 <= args.start_year <= args.end_year <= date.today().year or not 1 <= args.max_requests <= 10_000:
        print("invalid_probe_range", file=sys.stderr)
        return 2
    key = os.environ.get("DART_API_KEY", "")
    if not key:
        print("DART_API_KEY_missing", file=sys.stderr)
        return 2
    report = scan(DartClient(key, args.max_requests), args.start_year, args.end_year, args.output)
    print(f"result={report['status']} earliest_nps_year={report['first_nps_year']} requests={report['requests']}")
    return 0 if report["status"] in ("found", "no_nps_in_range") else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"probe_failed={type(error).__name__}", file=sys.stderr)
        raise SystemExit(1)
