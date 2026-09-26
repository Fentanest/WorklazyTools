#!/usr/bin/env python3
"""FolioTrace local migration and incremental DART state tooling.

Only normalized public filing facts enter the state. Source snapshots stay private.
"""
from __future__ import annotations

import argparse
import html
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from html.parser import HTMLParser
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.foliotrace.naver import NaverClient, QuoteError, expected_session, holiday_set_for, CONFIRMED_SPECIAL_SESSIONS
from pipeline.foliotrace.indirect import observation_timeline, reconcile_indirect, register_evidence
from pipeline.foliotrace.publish import make_snapshot, encoded

RECEIPT = re.compile(r"^\d{14}$")
CORP = re.compile(r"^\d{8}$")
STOCK = re.compile(r"^[0-9A-Z]{6}$")
NPS_FILER = re.compile(r"^(?:국민연금공단|국민연금관리공단|National Pension Service)(?=$|[\s(（])", re.I)
NPS_TABLE = re.compile(r"국민연금|National Pension Service", re.I)
ALLOWED = ("universe.json", "report-cache.json", "holdings-latest.json", "state.json")
SOURCE_NOTE = "MyTradingDesk context-service NPS public DART cache"
MAPPING_METHOD = "dart-voting-krx-kind-v1"
ACTION_METHOD = "krx-listed-share-exact-v2"
HISTORICAL_PARSE_ATTEMPTS = 5
CORRECTION_PREFIXES = ("[기재정정]", "[첨부정정]", "[첨부추가]", "[정정]",
                       "[정정명령부과]", "[정정제출요구]", "[변경등록]", "정정")


class HistoricalCollectionError(RuntimeError):
    def __init__(self, code, start, end, page_no=None, row_index=None):
        super().__init__(code)
        self.code = code
        self.start = start.isoformat()
        self.end = end.isoformat()
        self.page_no = page_no
        self.row_index = row_index


def historical_error_code(exc, stage):
    message = str(exc)
    status = re.fullmatch(r"DART status ([0-9]{3})", message)
    if status:
        return f"DART_STATUS_{status.group(1)}"
    known = {
        "DART historical pagination metadata inconsistent": "PAGINATION_METADATA",
        "DART pagination metadata inconsistent": "PAGINATION_METADATA",
        "DART listing page identity inconsistent": "PAGE_IDENTITY",
        "DART listing receipt coverage inconsistent": "RECEIPT_COVERAGE",
        "DART no-data response inconsistent": "NO_DATA_SHAPE",
        "DART listing page failed": "PAGE_STATUS",
        "DART NPS listing date inconsistent": "NPS_DATE",
        "DART NPS row lacks identity": "NPS_IDENTITY",
        "DART receipt corp conflict": "NPS_CORP_CONFLICT",
        "DART transport failure": "DART_TRANSPORT",
    }
    return known.get(message, f"{stage}_UNEXPECTED")


def nps_filer(value):
    return bool(NPS_FILER.match(str(value or "").strip()))


def nps_large_holding_listing(row):
    report = re.sub(r"\s+", "", str(row.get("report_nm") or ""))
    return nps_filer(row.get("flr_nm")) and "주식등의대량보유" in report


def kst_today(now=None):
    return (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("Asia/Seoul")).date()


def canonical(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = canonical(obj) + b"\n"
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".folio-", delete=False) as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
        tmp = Path(f.name)
    os.replace(tmp, path)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def source_files(root: Path):
    if root.is_symlink() or not root.is_dir():
        raise ValueError("NPS source must be a real directory")
    result = []
    for name in ALLOWED:
        path = root / name
        if path.exists():
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"invalid source entry: {name}")
            result.append((name, path))
    briefings = root / "briefings"
    if briefings.exists():
        if briefings.is_symlink() or not briefings.is_dir():
            raise ValueError("invalid briefings directory")
        for path in sorted(briefings.glob("*.json")):
            if path.is_symlink() or not path.is_file() or not re.fullmatch(r"(?:\d{8}-(?:KRX|NXT|AUTO)|latest|last-change)\.json", path.name):
                raise ValueError("invalid briefing entry")
            result.append((f"briefings/{path.name}", path))
    if not any(name == "holdings-latest.json" for name, _ in result):
        raise ValueError("holdings-latest.json missing")
    return result


def file_manifest(files):
    out = []
    for name, path in files:
        data = path.read_bytes()
        json.loads(data)
        out.append({"name": name, "bytes": len(data), "sha256": sha(data)})
    return out


def inspect_source(root: Path):
    files = source_files(root)
    first = file_manifest(files)
    second = file_manifest(files)
    if first != second or [x[0] for x in source_files(root)] != [x[0] for x in files]:
        raise RuntimeError("source changed during inspection")
    return {"migration_state": "IMPORT_DISCOVERED", "input_files": len(files),
            "source_hash": sha(canonical(first)), "manifest": first}


def export_source(root: Path, dest: Path):
    if dest.exists():
        raise ValueError("export destination already exists")
    files = source_files(root)
    before = file_manifest(files)
    dest.mkdir(parents=True)
    try:
        for name, src in files:
            target = dest / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, target)
        after = file_manifest(files)
        copied = file_manifest(source_files(dest))
        if before != after or before != copied:
            raise RuntimeError("source changed during export")
        manifest = {"schema": 1, "source_kind": SOURCE_NOTE, "files": copied,
                    "source_hash": sha(canonical(copied)), "exported_at": datetime.now(timezone.utc).isoformat()}
        write_json(dest / "export-manifest.json", manifest)
        return {"migration_state": "IMPORT_VALIDATED", "input_files": len(files),
                "source_hash": manifest["source_hash"]}
    except Exception:
        shutil.rmtree(dest)
        raise


def dec(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        n = Decimal(str(value).replace(",", ""))
    except InvalidOperation:
        return None
    return format(n, "f") if n.is_finite() else None


def norm_date(value):
    s = str(value or "").replace("-", "")[:8]
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:8])).isoformat() if len(s) == 8 else None
    except ValueError:
        return None


def safe_str(value, limit=200):
    s = str(value or "")
    return s[:limit] if not re.search(r"https?://|crtfc_key|token|password|secret|[/\\]", s, re.I) else ""


def empty_state():
    return {"schema": 1, "revision": 0, "import_ledger": [], "universe": {}, "receipts": {},
            "holdings": {}, "events": {}, "unresolved": {}, "metadata_recovery": {}, "mapping_ledger": {}, "quote_cache": {},
            "listing_coverage": [], "latest_complete_listing_date": None,
            "historical_backfill": None, "early_direct_backfill": None,
            "secondary_backfill": None, "secondary_equity_backfill": None,
            "secondary_prior_backfill": None, "secondary_prior_equity_backfill": None,
            "secondary_source_cache": {},
            "direct_ratio_basis": {}, "indirect_observations": {}, "indirect_invalidations": {},
            "legacy_coverage_status": "unverified", "legacy_resume_hint": None,
            "last_published_dataset": None, "published_history": []}


def normalize_seed(root: Path):
    manifest = read_json(root / "export-manifest.json")
    actual = file_manifest(source_files(root))
    if actual != manifest["files"] or sha(canonical(actual)) != manifest["source_hash"]:
        raise ValueError("export manifest mismatch")
    universe_raw = read_json(root / "universe.json") if (root / "universe.json").exists() else {}
    cache_raw = read_json(root / "report-cache.json") if (root / "report-cache.json").exists() else {}
    holdings_raw = read_json(root / "holdings-latest.json")
    if not isinstance(universe_raw, dict) or not isinstance(cache_raw, dict) or not isinstance(holdings_raw.get("holdings"), list):
        raise ValueError("invalid NPS source schema")
    universe = {}
    for corp, pair in universe_raw.items():
        if CORP.fullmatch(corp) and isinstance(pair, list) and len(pair) >= 2 and STOCK.fullmatch(str(pair[1])):
            universe[corp] = {"name": safe_str(pair[0]), "stock_code": str(pair[1])}
    metadata = {}
    receipts = {}
    duplicates = 0
    conflicts = []
    value_conflicts = []

    def add_meta(obj, origin):
        nonlocal duplicates
        no = str(obj.get("rcept_no") or "")
        if not RECEIPT.fullmatch(no):
            return
        corp = str(obj.get("corp_code") or "")
        code = str(obj.get("code") or "")
        entry = {"corp_code": corp if CORP.fullmatch(corp) else None,
                 "stock_code": code if STOCK.fullmatch(code) else None,
                 "name": safe_str(obj.get("name")),
                 "receipt_date": norm_date(obj.get("report_date") or obj.get("date") or obj.get("last_report_date")),
                 "quantity": dec(obj.get("stkqy")), "company_ownership_percent": dec(obj.get("stkrt")),
                 "reason": safe_str(obj.get("report_reason") or obj.get("reason")),
                 "sources": [origin]}
        old = metadata.get(no)
        if old:
            duplicates += 1
            conflicted_fields = set()
            for key in ("corp_code", "stock_code", "receipt_date"):
                if old.get(key) and entry.get(key) and old[key] != entry[key]:
                    conflicts.append({"receipt_no": no, "field": key})
            for key in ("quantity", "company_ownership_percent"):
                if old.get(key) is not None and entry.get(key) is not None and old[key] != entry[key]:
                    value_conflicts.append({"receipt_no": no, "field": key})
                    conflicted_fields.add(key)
            merged = {key: old.get(key) or entry.get(key) for key in entry if key != "sources"}
            conflicted_fields.update(item["field"] for item in value_conflicts if item["receipt_no"] == no)
            for key in conflicted_fields:
                merged[key] = None
            merged["sources"] = sorted(set(old.get("sources", [])) | {origin})
            metadata[no] = merged
        else:
            metadata[no] = entry

    for h in holdings_raw["holdings"]:
        if isinstance(h, dict):
            add_meta(h, "holdings")
            for row in h.get("history", []):
                if isinstance(row, dict):
                    add_meta({**row, "corp_code": h.get("corp_code"), "code": h.get("code"), "name": h.get("name")}, "history")
    brief_count = 0
    for path in sorted((root / "briefings").glob("*.json")) if (root / "briefings").exists() else []:
        data = read_json(path)
        for row in data.get("changes", []):
            if isinstance(row, dict):
                brief_count += 1
                add_meta(row, "briefing")

    for no, raw in cache_raw.items():
        if not RECEIPT.fullmatch(no) or not isinstance(raw, dict):
            continue
        if not nps_filer(raw.get("filer")):
            continue
        meta = metadata.get(no, {})
        receipts[no] = {"receipt_no": no, "receipt_date": meta.get("receipt_date"),
                        "corp_code": meta.get("corp_code"), "stock_code": meta.get("stock_code"),
                        "name": meta.get("name") or safe_str(raw.get("corp_name")),
                        "quantity": dec(raw.get("stkqy")), "company_ownership_percent": dec(raw.get("stkrt")),
                        "reason": safe_str(raw.get("report_resn")), "origin": "legacy_import",
                        "evidence": "legacy_json_parser_result", "security_kind": "unknown",
                        "legacy_sources": sorted(set(meta.get("sources", [])) | {"report-cache"}),
                        "source_json_sha256": manifest["source_hash"]}
    for no, meta in metadata.items():
        if no not in receipts:
            receipts[no] = {"receipt_no": no, "receipt_date": meta.get("receipt_date"),
                            "corp_code": meta.get("corp_code"), "stock_code": meta.get("stock_code"),
                            "name": meta.get("name"), "quantity": meta.get("quantity"),
                            "company_ownership_percent": meta.get("company_ownership_percent"),
                            "reason": meta.get("reason"), "origin": "legacy_import",
                            "evidence": "legacy_history_fact" if meta.get("quantity") is not None else "legacy_reference_only",
                            "legacy_sources": meta.get("sources", []),
                            "security_kind": "unknown", "source_json_sha256": manifest["source_hash"]}
    holdings = {}
    for h in holdings_raw["holdings"]:
        if not isinstance(h, dict):
            continue
        corp, code, no = str(h.get("corp_code") or ""), str(h.get("code") or ""), str(h.get("rcept_no") or "")
        if not CORP.fullmatch(corp) or not STOCK.fullmatch(code) or not RECEIPT.fullmatch(no):
            continue
        holdings[corp] = {"corp_code": corp, "stock_code": code, "name": safe_str(h.get("name")),
                          "receipt_no": no, "receipt_date": norm_date(h.get("last_report_date")),
                          "quantity": dec(h.get("stkqy")), "company_ownership_percent": dec(h.get("stkrt")),
                          "holding_date": None, "security_kind": "unknown", "tracking": "unknown",
                          "evidence": "legacy_import", "valuation_exclusion_reason": "security_mapping_unverified"}
    unresolved = {no: "metadata_missing" for no, r in receipts.items() if not r.get("corp_code") or not r.get("stock_code")}
    for conflict in value_conflicts:
        unresolved[conflict["receipt_no"]] = "legacy_value_conflict"
    events = {}
    for no, receipt in receipts.items():
        if receipt.get("corp_code") and receipt.get("stock_code") and receipt.get("receipt_date") and receipt.get("quantity") is not None:
            events[no] = {"receipt_no": no, "receipt_date": receipt["receipt_date"],
                          "corp_code": receipt["corp_code"], "stock_code": receipt["stock_code"],
                          "kind": "other", "correction_of": None, "quantity": receipt["quantity"],
                          "company_ownership_percent": receipt.get("company_ownership_percent"),
                          "source": "legacy_import"}
    classify_events({"receipts": receipts, "events": events})
    observed = sorted(r["receipt_date"] for r in receipts.values() if r.get("receipt_date"))
    # A generation/target date is not evidence that intervening filings were listed.
    hint = observed[-1] if observed else None
    report = {"migration_state": "IMPORT_VALIDATED", "input_files": len(actual),
              "input_records": len(universe_raw) + len(cache_raw) + len(holdings_raw["holdings"]) + brief_count,
              "unique_receipts": len(receipts), "duplicates_merged": duplicates,
              "conflicts_quarantined": len(conflicts), "universe_count": len(universe),
              "value_conflicts_quarantined": len(value_conflicts), "events_preserved": len(events),
              "holdings_with_evidence": len(holdings), "unresolved_metadata": len(unresolved),
              "min_observed_receipt_date": observed[0] if observed else None,
              "max_observed_receipt_date": observed[-1] if observed else None,
              "legacy_coverage_status": "unverified", "resume_anchor": hint,
              "resume_anchor_basis": "legacy_unverified_hint", "source_hash": manifest["source_hash"],
              "import_batch_id": sha(canonical({"source_hash": manifest["source_hash"], "schema": 1}))[:24],
              "conflicts": conflicts, "value_conflicts": value_conflicts}
    return universe, receipts, holdings, unresolved, events, report


def import_seed(root: Path, state_path: Path, commit: bool):
    universe, receipts, holdings, unresolved, events, report = normalize_seed(root)
    state = read_json(state_path) if state_path.exists() else empty_state()
    batch = report["import_batch_id"]
    if batch in state["import_ledger"]:
        report.update(migration_state="IMPORTED", target_state_revision=state["revision"], idempotent_noop=True)
        return report
    if state["import_ledger"]:
        raise ValueError("different legacy seed already imported")
    if state["revision"]:
        raise ValueError("cannot import seed into advanced state")
    if report["conflicts_quarantined"]:
        raise ValueError("receipt metadata conflicts require review")
    state.update(universe=universe, receipts=receipts, holdings=holdings, unresolved=unresolved, events=events,
                 legacy_resume_hint=report["resume_anchor"])
    state["import_ledger"].append(batch)
    state["revision"] += 1
    report.update(target_state_revision=state["revision"], migration_state="IMPORTED" if commit else "IMPORT_VALIDATED")
    if commit:
        write_json(state_path, state)
    return report


def backfill_legacy(root: Path, state_path: Path, commit: bool):
    """Add omitted public filing facts to an already imported state, preserving live facts."""
    _, receipts, _, unresolved, events, report = normalize_seed(root)
    state = read_json(state_path)
    if report["import_batch_id"] not in state.get("import_ledger", []):
        raise ValueError("legacy export does not match imported batch")
    changed_receipts = added_events = 0
    for no, source in receipts.items():
        target = state["receipts"].get(no)
        if target is None:
            state["receipts"][no] = source
            changed_receipts += 1
        else:
            before = dict(target)
            for field in ("corp_code", "stock_code", "name", "receipt_date", "quantity",
                          "company_ownership_percent", "reason", "legacy_sources"):
                if target.get(field) in (None, "", []):
                    target[field] = source.get(field)
            if target.get("evidence") == "legacy_reference_only" and target.get("quantity") is not None:
                target["evidence"] = "legacy_history_fact"
            if target != before:
                changed_receipts += 1
        if no in unresolved:
            state["unresolved"].setdefault(no, unresolved[no])
    for no, event in events.items():
        if no not in state["events"]:
            state["events"][no] = event
            added_events += 1
    before_events = canonical(state["events"])
    classify_events(state)
    reclassified = before_events != canonical(state["events"])
    report.update(changed_receipts=changed_receipts, added_events=added_events,
                  reclassified_events=reclassified,
                  migration_state="BACKFILLED" if commit else "BACKFILL_VALIDATED")
    if changed_receipts or added_events or reclassified:
        state["revision"] += 1
        if commit:
            write_json(state_path, state)
    return report


def dart_json(endpoint, params, key, retries=3):
    query = urllib.parse.urlencode({**params, "crtfc_key": key})
    url = f"https://opendart.fss.or.kr/api/{endpoint}?{query}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "FolioTrace/1.0"}), timeout=25) as response:
                data = json.load(response)
            if data.get("status") in ("000", "013"):
                return data
            raise RuntimeError(f"DART status {data.get('status')}")
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt + 1 == retries:
                raise RuntimeError("DART transport failure") from exc
            time.sleep(attempt + 1)


def document_xml(payload: bytes):
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(".xml") and not name.startswith("/") and ".." not in Path(name).parts]
        if not names:
            raise ValueError("DART archive has no safe XML")
        xml_bytes = archive.read(names[0])
    for encoding in ("utf-8", "cp949"):
        try:
            xml = xml_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("DART XML encoding unsupported")

    return xml, xml_bytes


class FilingTableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "table": self.table = []
        elif self.table is not None and tag == "tr": self.row = []
        elif self.row is not None and tag in ("td", "th", "te", "tu"): self.cell = []

    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th", "te", "tu") and self.cell is not None and self.row is not None:
            self.row.append(re.sub(r"\s+", "", html.unescape("".join(self.cell))))
            self.cell = None
        elif tag == "tr" and self.row is not None and self.table is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def verified_voting_share_quantity(xml: str, expected):
    """Accept a single NPS table only when voting shares equal all reported securities."""
    parser = FilingTableParser()
    parser.feed(xml)
    matches = []
    for table in parser.tables:
        headers = "".join("".join(row) for row in table[:3])
        if "보유주식등의내역" not in headers or "의결권있는주식" not in headers or "주수" not in headers:
            continue
        nps_rows = [row for row in table if len(row) >= 14 and
                    any(NPS_TABLE.search(cell) for cell in row[:3])]
        if not nps_rows:
            continue
        voting = Decimal(0)
        total = Decimal(0)
        for row in nps_rows:
            # The public DART class table has relation, filer, ID, A, a1, a2, B..G, total, ratio.
            cells = row[-11:]
            if len(cells) != 11:
                return None
            try:
                amounts = [Decimal(0) if value in ("", "-") else Decimal(value.replace(",", "")) for value in cells[:-1]]
            except InvalidOperation:
                return None
            if any(value != 0 for value in amounts[1:-1]):
                return None
            voting += amounts[0]
            total += amounts[-1]
        if voting > 0 and voting == total == Decimal(expected):
            matches.append(format(voting, "f"))
    return matches[0] if len(matches) == 1 else None


def verified_common_stock_code(xml: str, expected_quantity):
    """Require an explicit ordinary-share code and amount in one source row."""
    parser = FilingTableParser()
    parser.feed(xml)
    matches = set()
    for table in parser.tables:
        for row in table:
            if not any("보통주" in cell for cell in row):
                continue
            codes = [cell for cell in row if STOCK.fullmatch(cell)]
            amounts = [dec(cell) for cell in row if dec(cell) is not None]
            if len(codes) == 1 and expected_quantity in amounts:
                matches.add(codes[0])
    return next(iter(matches)) if len(matches) == 1 else None


def parse_krx_security_master(html_text):
    return {code: item["name"] for code, item in parse_krx_security_details(html_text).items()}


def parse_krx_security_details(html_text):
    parser = FilingTableParser()
    parser.feed(html_text)
    result = {}
    for table in parser.tables:
        for row in table:
            if len(row) < 5 or row[0] != "주권":
                continue
            name, isin = row[1:3]
            if not re.fullmatch(r"KR7[0-9A-Z]{9}", isin):
                continue
            code = isin[3:9]
            if not STOCK.fullmatch(code):
                continue
            # KRX-listed ordinary identity has the issuer code and 00 series.
            shares = dec(row[4])
            if isin[9:11] == "00" and shares is not None and Decimal(shares) > 0 and not re.search(r"(?:우|우B|우C|우선주)$", name):
                item = {"name": name, "isin": isin, "listed_shares_thousands": shares}
                if code in result and result[code] != item:
                    result.pop(code)
                else:
                    result[code] = item
    return result


def comparable_company_name(value):
    compact = re.sub(r"\s+", "", value or "").replace("㈜", "").replace("(주)", "")
    return compact.removesuffix("주식회사")


def krx_security_details(trade_date):
    url = "https://kind.krx.co.kr/corpgeneral/listedissuestatusdetail.do"
    merged = {}
    hashes = []
    for market in ("STK", "KSQ"):
        params = {"method": "searchListedIssueStatDetailSub", "forward": "listedissuestatdetail_sub",
                  "currentPageSize": "3000", "pageIndex": "1", "selDate": trade_date.replace("-", ""),
                  "mktId": market, "secugrpId": "ST", "detailType": "2"}
        request = urllib.request.Request(url, data=urllib.parse.urlencode(params).encode(),
            headers={"User-Agent": "FolioTrace/1.0", "Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = response.read(3_000_001)
        if len(payload) > 3_000_000:
            raise RuntimeError("KRX security master too large")
        rows = parse_krx_security_details(payload.decode("utf-8"))
        if len(rows) < 100:
            raise RuntimeError("KRX security master incomplete")
        merged.update(rows)
        hashes.append(sha(payload))
    return merged, sha(canonical(hashes))


def krx_security_master(trade_date):
    details, digest = krx_security_details(trade_date)
    return {code: row["name"] for code, row in details.items()}, digest


def parse_filing_document(payload: bytes):
    xml, xml_bytes = document_xml(payload)
    def cell(attribute, code):
        found = re.search(rf'{attribute}="{re.escape(code)}"[^>]*>(.*?)</T[EUD]>', xml, re.S)
        if not found: return None
        return html.unescape(re.sub(r"<[^>]+>", " ", found.group(1))).strip()
    filer = cell("ACODE", "RPT_RSP_NM")
    if not nps_filer(filer):
        raise ValueError("DART filer mismatch")
    quantity = dec(cell("ACODE", "SUM_TMT_CNT"))
    ownership = dec((cell("ACODE", "SUM_TMT_RT") or "").replace("%", ""))
    if quantity is None or ownership is None:
        raise ValueError("DART XML lacks holding quantity or ratio")
    cover = html.unescape(re.sub(r"<[^>]+>", " ", xml[:8000]))
    cover_dates = re.findall(r"보고서\s*작성\s*기준일\s*:\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일", cover)
    def parsed_date(parts):
        try:
            return date(*(int(part) for part in parts)).isoformat()
        except (TypeError, ValueError):
            return None
    cover_date = parsed_date(cover_dates[0]) if len(cover_dates) == 1 else None
    current_rows = [match.group(0) for match in re.finditer(r"<TR\b[^>]*>.*?</TR>", xml, re.I | re.S)
                    if 'ACODE="THS_IFR"' in match.group(0) and
                    "이번보고서" in html.unescape(re.sub(r"<[^>]+>", " ", match.group(0)))]
    current_row = current_rows[0] if len(current_rows) == 1 else ""
    def row_cell(code):
        found = re.search(rf'ACODE="{re.escape(code)}"[^>]*>(.*?)</T[EUD]>', current_row, re.I | re.S)
        return html.unescape(re.sub(r"<[^>]+>", " ", found.group(1))).strip() if found else None
    row_cells = [html.unescape(re.sub(r"<[^>]+>", " ", match.group(1))).strip()
                 for match in re.finditer(r"<T[DEUH]\b[^>]*>(.*?)</T[DEUH]>", current_row, re.I | re.S)]
    row_date_text = (row_cells[1] if len(row_cells) >= 3 and row_cells[0] == "이번보고서"
                     and nps_filer(row_cell("THS_IFR")) else None)
    row_parts = re.fullmatch(r"\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*", row_date_text or "")
    row_date = parsed_date(row_parts.groups()) if row_parts else None
    row_quantity = dec(row_cell("THS_STK_CNT"))
    row_ratio = dec(row_cell("THS_STK_RT"))
    safe_row_date_text = row_date_text if row_date_text and re.fullmatch(r"[0-9년월일 .-]{1,40}", row_date_text) else None
    basis_diagnostic = {"cover_dates": len(cover_dates), "current_row_count": len(current_rows),
                        "row_date_text": safe_row_date_text,
                        "row_date_length": len(row_date_text or ""),
                        "row_date_other_codepoints": sorted({ord(ch) for ch in (row_date_text or "")
                            if not re.fullmatch(r"[0-9년월일 .-]", ch)})[:8],
                        "row_date_valid": row_date is not None,
                        "row_quantity_present": row_quantity is not None,
                        "row_ratio_present": row_ratio is not None,
                        "quantity_matches_summary": (row_quantity is not None and
                            Decimal(row_quantity) == Decimal(quantity)),
                        "ratio_matches_summary": (row_ratio is not None and
                            Decimal(row_ratio) == Decimal(ownership)),
                        "cover_matches_row": (cover_date is None or cover_date == row_date)}
    row_verified = bool(row_date and row_quantity is not None and row_ratio is not None and
                        Decimal(row_quantity) == Decimal(quantity) and Decimal(row_ratio) == Decimal(ownership) and
                        (cover_date is None or cover_date == row_date))
    holding_date = row_date if row_verified else None
    row_sha256 = sha(current_row.encode("utf-8")) if row_verified else None
    voting = verified_voting_share_quantity(xml, quantity)
    return {"quantity": quantity, "company_ownership_percent": ownership,
            "reason": safe_str(cell("ACODE", "SUM_CHN_RWN")), "xml_sha256": sha(xml_bytes),
            "holding_date": holding_date,
            "basis_date_evidence": "dart_current_report_row" if holding_date else None,
            "basis_row_sha256": row_sha256,
            "basis_diagnostic": basis_diagnostic,
            "source_ratio_columns": ({"shares_etc_quantity": str(row_quantity),
                                      "shares_etc_percent": str(row_ratio),
                                      "reporting_count": dec(row_cell("THS_RPT_CNT")),
                                      "stock_quantity": dec(row_cell("THS_CMT_CNT")),
                                      "stock_percent": dec(row_cell("THS_CMT_RT")),
                                      "issued_voting_shares": dec(row_cell("THS_STK_CT"))}
                                     if row_verified else None),
            "verified_voting_share_quantity": voting,
            "verified_common_stock_code": verified_common_stock_code(xml, quantity)}


def dart_document(no, key, retries=3):
    query = urllib.parse.urlencode({"crtfc_key": key, "rcept_no": no})
    url = f"https://opendart.fss.or.kr/api/document.xml?{query}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "FolioTrace/1.0"}), timeout=30) as response:
                payload = response.read(20_000_001)
            if len(payload) > 20_000_000:
                raise ValueError("DART archive exceeds size limit")
            return parse_filing_document(payload)
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt + 1 == retries:
                raise RuntimeError("DART document transport failure") from exc
            time.sleep(attempt + 1)


def structured_receipt(no, corp, key, cache):
    """Use only the exact NPS receipt; a missing/delayed row requires XML fallback."""
    if corp not in cache:
        cache[corp] = dart_json("majorstock.json", {"corp_code": corp}, key)
    rows = cache[corp].get("list") or []
    for row in rows:
        if str(row.get("rcept_no") or "") != no or not nps_filer(row.get("repror")):
            continue
        quantity = dec(row.get("stkqy"))
        ownership = dec(row.get("stkrt"))
        if quantity is None or ownership is None:
            break
        return {"quantity": quantity, "company_ownership_percent": ownership,
                "reason": safe_str(row.get("report_resn")), "evidence": "dart_structured"}
    return None


def apply_listing_row(state, row, *, historical=False):
    """Retain correction/withdrawal flags without inventing a predecessor link.

    OpenDART list guide documents rm=정 (later correction exists) and rm=철
    (withdrawn): https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001
    """
    if not nps_large_holding_listing(row):
        return False
    no, corp = str(row.get("rcept_no") or ""), str(row.get("corp_code") or "")
    if not RECEIPT.fullmatch(no) or not CORP.fullmatch(corp):
        raise RuntimeError("DART NPS row lacks identity")
    listed_date = norm_date(row.get("rcept_dt"))
    if listed_date is None:
        raise RuntimeError("DART NPS listing date inconsistent")
    existing = state["receipts"].get(no)
    newly_discovered = existing is None
    if existing and existing.get("corp_code") and existing["corp_code"] != corp:
        raise RuntimeError("DART receipt corp conflict")
    if existing and existing.get("receipt_date") and existing["receipt_date"] != listed_date:
        existing.setdefault("legacy_receipt_date", existing["receipt_date"])
        state["unresolved"][no] = "receipt_date_conflict"
    report_name = safe_str(row.get("report_nm"))
    remarks = safe_str(row.get("rm"), limit=30)
    correction = report_name.startswith(CORRECTION_PREFIXES)
    superseded = "정" in remarks
    withdrawn = "철" in remarks
    listed_code = str(row.get("stock_code") or "")
    listed_code = listed_code if STOCK.fullmatch(listed_code) else None
    prior_code = state["universe"].get(corp, {}).get("stock_code")
    if listed_code and prior_code and listed_code != prior_code:
        state["unresolved"][no] = "security_identity_conflict"
    elif listed_code and not prior_code:
        state["universe"][corp] = {"name": safe_str(row.get("corp_name")), "stock_code": listed_code}
    stock_code = listed_code or prior_code
    if not existing:
        existing = {"receipt_no": no, "receipt_date": listed_date,
                    "corp_code": corp, "stock_code": stock_code,
                    "name": safe_str(row.get("corp_name")), "quantity": None, "company_ownership_percent": None,
                    "origin": "dart_listing", "evidence": "unresolved", "security_kind": "unknown", "reason": ""}
        state["receipts"][no] = existing
        state["unresolved"][no] = "parsed_identity_ready" if existing.get("evidence") in ("dart_document", "dart_structured") and existing.get("quantity") is not None else "needs_filing_parse"
        old = state["holdings"].get(corp)
        if not historical and old and no > old.get("receipt_no", ""):
            old["latest_unresolved_receipt"] = max(old.get("latest_unresolved_receipt", ""), no)
    elif not existing.get("corp_code") or not existing.get("stock_code"):
        identity_recovered = bool(corp and stock_code and not (existing.get("corp_code") and existing.get("stock_code")))
        existing["corp_code"] = corp
        existing["stock_code"] = stock_code
        existing["receipt_date"] = listed_date
        existing["metadata_evidence"] = "dart_listing"
        if identity_recovered:
            existing["parse_attempt_count"] = 0
        state["unresolved"][no] = "parsed_identity_ready" if existing.get("evidence") in ("dart_document", "dart_structured") and existing.get("quantity") is not None else "needs_filing_parse"
    existing.update(report_name=report_name, remarks=remarks, is_correction=correction,
                    correction_of=None, later_correction_flag=superseded, withdrawn_flag=withdrawn,
                    listing_receipt_date=listed_date)
    if listed_date != norm_date(no[:8]):
        existing["receipt_prefix_date_mismatch"] = True
    if not existing.get("receipt_date"):
        existing["receipt_date"] = listed_date
    if historical:
        # Listing identity is verified separately from the filing's quantities.
        existing.setdefault("listing_verified_at", datetime.now(timezone.utc).isoformat())
        if newly_discovered:
            existing["historical_backfill_only"] = True
    elif existing.pop("historical_backfill_only", False):
        # A receipt seen again in the live overlap is eligible for current-state
        # reconciliation; its earlier historical scan alone was not enough.
        if existing.get("evidence") in ("dart_document", "dart_structured") and existing.get("quantity") is not None:
            state["unresolved"][no] = "parsed_identity_ready"
    if correction or superseded or withdrawn:
        state["unresolved"][no] = "correction_relation_unverified" if correction or superseded else "withdrawal_unverified"
    if listed_code and prior_code and listed_code != prior_code:
        state["unresolved"][no] = "security_identity_conflict"
    if existing.get("receipt_date") != listed_date:
        state["unresolved"][no] = "receipt_date_conflict"
    elif (not historical and existing.get("receipt_prefix_date_mismatch")
          and state["unresolved"].get(no) != "security_identity_conflict"):
        state["unresolved"][no] = "receipt_chronology_unverified"
    return existing.get("origin") == "dart_listing" and existing.get("evidence") == "unresolved"


def validate_listing_pages(pages):
    first = pages[0]
    if first.get("status") == "013":
        if len(pages) != 1 or first.get("list"):
            raise RuntimeError("DART no-data response inconsistent")
        return 0
    if first.get("status") != "000":
        raise RuntimeError("DART listing page failed")
    try:
        total = int(first["total_count"])
        count = int(first["total_page"])
    except (KeyError, TypeError, ValueError) as exc:
        raise RuntimeError("DART pagination metadata inconsistent") from exc
    if total < 0 or count < 1 or count != max(1, (total + 99) // 100) or len(pages) != count:
        raise RuntimeError("DART pagination metadata inconsistent")
    numbers = []
    for number, page in enumerate(pages, 1):
        try:
            same = (page.get("status") == "000" and int(page["page_no"]) == number
                    and int(page["total_count"]) == total and int(page["total_page"]) == count)
        except (KeyError, TypeError, ValueError):
            same = False
        rows = page.get("list")
        if not same or not isinstance(rows, list) or len(rows) != min(100, max(0, total - (number - 1) * 100)):
            raise RuntimeError("DART listing page identity inconsistent")
        numbers.extend(str(row.get("rcept_no") or "") for row in rows)
    if any(not RECEIPT.fullmatch(no) for no in numbers) or len(set(numbers)) != total:
        raise RuntimeError("DART listing receipt coverage inconsistent")
    return total


def resolve_unfinished(state, key, limit=30, state_path=None, candidates=None, promote_holdings=True):
    processed = 0
    structured_cache = {}
    for no in sorted(state["unresolved"], key=lambda number: (
            int(state["receipts"].get(number, {}).get("parse_attempt_count") or 0), -int(number))):
        if processed >= limit:
            break
        if candidates is not None and no not in candidates:
            continue
        receipt = state["receipts"].get(no)
        if not receipt or (receipt.get("evidence") not in ("unresolved", "legacy_json_parser_result", "legacy_reference_only")
                           and not (state["unresolved"].get(no) in ("security_identity_missing", "parsed_identity_ready")
                                    and receipt.get("corp_code") and receipt.get("stock_code")
                                    and receipt.get("quantity") is not None
                                    and receipt.get("company_ownership_percent") is not None)):
            continue
        if state["unresolved"].get(no) in ("security_identity_conflict", "receipt_date_conflict",
                                           "receipt_chronology_unverified"):
            continue
        if receipt.get("historical_backfill_only") and (
                int(receipt.get("parse_attempt_count") or 0) >= HISTORICAL_PARSE_ATTEMPTS
                or receipt.get("last_parse_attempt_on") == kst_today().isoformat()):
            continue
        processed += 1
        receipt["parse_attempt_count"] = int(receipt.get("parse_attempt_count") or 0) + 1
        receipt["last_parse_attempt_on"] = kst_today().isoformat()
        try:
            corp = receipt.get("corp_code")
            if state["unresolved"].get(no) in ("security_identity_missing", "parsed_identity_ready") and corp and receipt.get("stock_code") and receipt.get("evidence") in ("dart_document", "dart_structured"):
                parsed = {field: receipt[field] for field in ("quantity", "company_ownership_percent", "evidence")}
            else:
                try:
                    parsed = structured_receipt(no, corp, key, structured_cache) if corp else None
                except RuntimeError:
                    parsed = None  # An unavailable or delayed structured row can use the document.
                if parsed is None:
                    parsed = dart_document(no, key)
                    parsed["evidence"] = "dart_document"
        except (RuntimeError, ValueError, zipfile.BadZipFile) as exc:
            state["unresolved"][no] = type(exc).__name__
            continue
        basis = parsed.get("holding_date")
        if basis and basis > (receipt.get("listing_receipt_date") or receipt.get("receipt_date") or ""):
            parsed["holding_date"] = None
            parsed["basis_date_evidence"] = None
        receipt.update(parsed)
        corp = receipt.get("corp_code")
        stock = receipt.get("stock_code")
        if corp and stock:
            old = state["holdings"].get(corp)
            new_quantity = dec(parsed["quantity"])
            ownership = Decimal(parsed["company_ownership_percent"])
            state.setdefault("events", {})[no] = {"receipt_no": no, "receipt_date": receipt["receipt_date"],
                "corp_code": corp, "stock_code": stock, "kind": "other",
                "correction_of": receipt.get("correction_of"), "quantity": parsed["quantity"],
                "company_ownership_percent": parsed["company_ownership_percent"],
                "source": parsed["evidence"]}
            flagged_relation = receipt.get("is_correction") or receipt.get("later_correction_flag") or receipt.get("withdrawn_flag")
            if promote_holdings and old and flagged_relation and no > old.get("receipt_no", ""):
                old["latest_unresolved_receipt"] = max(old.get("latest_unresolved_receipt", ""), no)
            if (promote_holdings and not receipt.get("historical_backfill_only") and not flagged_relation
                    and (not old or no >= old.get("receipt_no", ""))):
                state["holdings"][corp] = {"corp_code": corp, "stock_code": stock,
                    "name": receipt.get("name") or state["universe"].get(corp, {}).get("name") or "",
                    "receipt_no": no, "receipt_date": receipt["receipt_date"],
                    "quantity": parsed["quantity"], "company_ownership_percent": parsed["company_ownership_percent"],
                    "holding_date": parsed.get("holding_date"), "security_kind": "unknown",
                    "tracking": "below-5-percent" if ownership < 5 else "active",
                    "evidence": parsed["evidence"], "valuation_exclusion_reason": "security_mapping_unverified"}
            if flagged_relation:
                state["unresolved"][no] = "correction_relation_unverified" if not receipt.get("withdrawn_flag") else "withdrawal_unverified"
            else:
                del state["unresolved"][no]
        else:
            state["unresolved"][no] = "security_identity_missing"
    classify_events(state)
    if state_path and processed:
        state["revision"] += 1
        write_json(state_path, state)
    return processed


def register_verified_direct_profile(state, receipt, parsed):
    """Use one exact report row only when its share class and percentage basis agree."""
    no = receipt["receipt_no"]
    columns = parsed.get("source_ratio_columns") or {}
    current_holding = state.get("holdings", {}).get(receipt["corp_code"])
    current_mapping = (current_holding and current_holding.get("receipt_no") == no and
        current_holding.get("security_kind") == "common" and
        state.get("mapping_ledger", {}).get(no, {}).get("status") == "verified" and
        state["mapping_ledger"][no].get("xml_sha256") == parsed.get("xml_sha256"))
    historic_mapping = (state.get("mapping_ledger", {}).get(no, {}).get("status") == "verified" and
        state["mapping_ledger"][no].get("xml_sha256") == parsed.get("xml_sha256"))
    document_mapping = (parsed.get("verified_common_stock_code") == receipt.get("stock_code") and
        dec(parsed.get("verified_voting_share_quantity")) is not None and
        Decimal(dec(parsed["verified_voting_share_quantity"])) == Decimal(dec(receipt["quantity"])) and
        state.get("universe", {}).get(receipt["corp_code"], {}).get("stock_code") == receipt.get("stock_code"))
    try:
        shares_quantity = Decimal(str(columns["shares_etc_quantity"]))
        stock_quantity = Decimal(str(columns["stock_quantity"]))
        shares_percent = Decimal(str(columns["shares_etc_percent"]))
        stock_percent = Decimal(str(columns["stock_percent"]))
        denominator = Decimal(str(columns["issued_voting_shares"]))
        reporting_count = Decimal(str(columns["reporting_count"]))
        source_quantity = Decimal(dec(receipt["quantity"]))
        source_percent = Decimal(dec(receipt["company_ownership_percent"]))
        scale = Decimal(1).scaleb(stock_percent.as_tuple().exponent)
        arithmetic_matches = (denominator > 0 and
            (stock_quantity / denominator * 100).quantize(scale, rounding=ROUND_HALF_UP) == stock_percent)
        comparable = (reporting_count == 1 and arithmetic_matches and
            shares_quantity == stock_quantity == source_quantity and
            shares_percent == stock_percent == source_percent and
            (current_mapping or historic_mapping or document_mapping))
    except (KeyError, InvalidOperation, TypeError, ValueError, ZeroDivisionError):
        comparable = False
    if not comparable:
        receipt["ratio_basis_review_status"] = "ratio_basis_unverified"
        return False
    profile = {"kind": "direct_ratio_basis", "direct_receipt_no": no,
        "source_document_no": None, "corp_code": receipt["corp_code"],
        "stock_code": receipt["stock_code"], "security_kind": "common",
        "ratio_denominator": "voting_rights", "holder_scope": "nps_reporting_group",
        "basis_date": receipt["holding_date"], "basis_kind": "explicit_actual_holding",
        "denominator_quantity": format(denominator, "f"), "denominator_date": receipt["holding_date"],
        "source_document_sha256": parsed["xml_sha256"],
        "source_section_sha256": parsed["basis_row_sha256"],
        "verified_at": datetime.now(timezone.utc).isoformat()}
    prior = state.get("direct_ratio_basis", {}).get(no)
    if prior is not None:
        profile["verified_at"] = prior["verified_at"]
    try:
        register_evidence(state, profile)
    except ValueError as exc:
        if str(exc) != "EVIDENCE_CONFLICT":
            raise
        receipt["ratio_basis_review_status"] = "profile_conflict"
        return False
    receipt["ratio_basis_review_status"] = "verified_voting_rights_group"
    return True


def recheck_direct_basis(state, key, limit=20, state_path=None, fetch=dart_document, target_receipt=None):
    """Recover report preparation dates from exact source documents in bounded runs."""
    method = "report-current-row-v5"
    if limit < 0 or limit > 100:
        raise ValueError("DIRECT_BASIS_LIMIT")
    if target_receipt is not None and not RECEIPT.fullmatch(target_receipt):
        raise ValueError("DIRECT_BASIS_TARGET")
    if limit and not key:
        raise ValueError("DART_API_KEY unavailable")
    today = kst_today().isoformat()
    current = {holding.get("receipt_no") for holding in state.get("holdings", {}).values()}
    eligible = []
    for no, receipt in state.get("receipts", {}).items():
        if target_receipt and no != target_receipt:
            continue
        source_kind = receipt.get("evidence")
        verified_legacy = source_kind in ("legacy_history_fact", "legacy_json_parser_result") and bool(receipt.get("listing_verified_at"))
        if (not RECEIPT.fullmatch(str(no)) or
                (source_kind not in ("dart_document", "dart_structured") and not verified_legacy)
                or not receipt.get("corp_code") or not receipt.get("stock_code")
                or receipt.get("quantity") is None or receipt.get("company_ownership_percent") is None
                or receipt.get("withdrawn_flag") or receipt.get("is_correction") or receipt.get("later_correction_flag")
                or state.get("unresolved", {}).get(no) in ("receipt_date_conflict", "receipt_chronology_unverified")
                or receipt.get("basis_method") == method
                or (receipt.get("basis_last_attempt_on") == today and
                    receipt.get("basis_last_attempt_method") == method)
                or (receipt.get("basis_last_attempt_method") == method and
                    int(receipt.get("basis_attempt_count") or 0) >= 3)):
            continue
        eligible.append((no not in current, -int(no), no, receipt))
    checked = verified = pending = conflicts = 0
    for _, _, no, receipt in sorted(eligible)[:limit]:
        checked += 1
        previous_attempts = int(receipt.get("basis_attempt_count") or 0) if receipt.get("basis_last_attempt_method") == method else 0
        receipt["basis_last_attempt_on"] = today
        receipt["basis_last_attempt_method"] = method
        receipt["basis_attempt_count"] = previous_attempts + 1
        try:
            parsed = fetch(no, key)
        except (RuntimeError, ValueError, zipfile.BadZipFile):
            receipt["basis_review_status"] = "source_retry_pending"
            pending += 1
            continue
        basis = parsed.get("holding_date")
        source_date = receipt.get("listing_receipt_date") or receipt.get("receipt_date")
        if (not basis or not source_date or basis > source_date):
            receipt["basis_review_status"] = "basis_unverified"
            receipt["basis_method"] = method
            pending += 1
            continue
        source_quantity, parsed_quantity = dec(receipt.get("quantity")), dec(parsed.get("quantity"))
        source_ratio, parsed_ratio = dec(receipt.get("company_ownership_percent")), dec(parsed.get("company_ownership_percent"))
        if (None in (source_quantity, parsed_quantity, source_ratio, parsed_ratio) or
                Decimal(source_quantity) != Decimal(parsed_quantity) or Decimal(source_ratio) != Decimal(parsed_ratio)):
            receipt["basis_review_status"] = "source_value_conflict"
            receipt["basis_method"] = method
            conflicts += 1
            continue
        receipt["holding_date"] = basis
        receipt["basis_date_evidence"] = "dart_current_report_row"
        receipt["basis_document_sha256"] = parsed.get("xml_sha256")
        receipt["basis_row_sha256"] = parsed.get("basis_row_sha256")
        receipt["source_ratio_columns"] = parsed.get("source_ratio_columns")
        if receipt.get("evidence") in ("legacy_history_fact", "legacy_json_parser_result"):
            receipt["evidence"] = "dart_document"
            receipt["xml_sha256"] = parsed.get("xml_sha256")
        receipt["basis_review_status"] = "verified"
        receipt["basis_method"] = method
        current_holding = state.get("holdings", {}).get(receipt["corp_code"])
        if current_holding and current_holding.get("receipt_no") == no:
            current_holding["holding_date"] = basis
            current_holding["tracking"] = "below-5-percent" if Decimal(source_ratio) < 5 else "active"
            if current_holding.get("evidence") == "legacy_import":
                current_holding["evidence"] = "dart_document"
        register_verified_direct_profile(state, receipt, parsed)
        verified += 1
    if checked and state_path:
        state["revision"] += 1
        write_json(state_path, state)
    return {"checked": checked, "verified": verified, "pending": pending, "value_conflicts": conflicts}


def classify_events(state):
    """Compare only source-compatible filing facts in verified basis-date order."""
    profiles = state.get("direct_ratio_basis", {})
    direct_timeline = {item["receipt_no"]: item for item in observation_timeline(state)
                       if item["source"] == "direct" and item["status"] == "verified"}
    by_corp = {}
    for receipt in state["receipts"].values():
        corp = receipt.get("corp_code")
        no = receipt.get("receipt_no")
        if corp and RECEIPT.fullmatch(str(no or "")):
            by_corp.setdefault(corp, []).append(receipt)
    for corp, receipts in by_corp.items():
        previous = None
        for receipt in sorted(receipts, key=lambda item: (profiles.get(item["receipt_no"], {}).get("basis_date") or
                                                       item.get("listing_receipt_date") or
                                                       item.get("receipt_date") or "", item["receipt_no"])):
            no = receipt["receipt_no"]
            if state.get("unresolved", {}).get(no) in ("receipt_date_conflict", "receipt_chronology_unverified"):
                continue
            event = state.get("events", {}).get(no)
            flagged = any(receipt.get(field) for field in ("is_correction", "later_correction_flag", "withdrawn_flag"))
            quantity = dec(receipt.get("quantity"))
            ownership = dec(receipt.get("company_ownership_percent"))
            if event:
                kind = "other"
                if not flagged and quantity is not None and ownership is not None:
                    if direct_timeline.get(no, {}).get("tracking_change"):
                        kind = direct_timeline[no]["tracking_change"]
                    elif "목적" in (receipt.get("reason") or ""):
                        kind = "purpose-change"
                    elif previous is None:
                        kind = "new-report"
                    elif (previous.get("stock_code") == receipt.get("stock_code") and
                          dec(previous.get("quantity")) is not None and
                          profiles.get(previous["receipt_no"]) and profiles.get(no) and
                          all(profiles[previous["receipt_no"]][field] == profiles[no][field]
                              for field in ("ratio_denominator", "holder_scope")) and
                          profiles[previous["receipt_no"]]["basis_date"] < profiles[no]["basis_date"]):
                        before, after = Decimal(dec(previous["quantity"])), Decimal(quantity)
                        kind = "increase" if after > before else "decrease" if after < before else "other"
                event["kind"] = kind
            if not flagged and quantity is not None and ownership is not None:
                previous = receipt


def recheck_legacy_history(state, key, limit=10, state_path=None):
    """Gradually verify listed historical receipts while retaining imported facts."""
    current_nos = {holding.get("receipt_no") for holding in state["holdings"].values()}
    today = kst_today().isoformat()
    candidates = [receipt for no, receipt in sorted(state["receipts"].items())
                  if receipt.get("origin") == "legacy_import" and receipt.get("listing_verified_at")
                  and receipt.get("corp_code") and receipt.get("stock_code") and no not in current_nos
                  and receipt.get("evidence") not in ("dart_structured", "dart_document")
                  and int(receipt.get("source_recheck_attempts") or 0) < HISTORICAL_PARSE_ATTEMPTS
                  and receipt.get("source_recheck_last_on") != today
                  and state["unresolved"].get(no) not in ("security_identity_conflict", "receipt_date_conflict",
                                                         "receipt_chronology_unverified")
                  and state["universe"].get(receipt["corp_code"], {}).get("stock_code") == receipt["stock_code"]]
    checked = verified = 0
    structured_cache = {}
    for receipt in candidates[:limit]:
        no = receipt["receipt_no"]
        receipt["source_recheck_attempts"] = int(receipt.get("source_recheck_attempts") or 0) + 1
        receipt["source_recheck_last_on"] = today
        checked += 1
        try:
            try:
                parsed = structured_receipt(no, receipt["corp_code"], key, structured_cache)
            except RuntimeError:
                parsed = None
            if parsed is None:
                parsed = dart_document(no, key)
                parsed["evidence"] = "dart_document"
        except (RuntimeError, ValueError, zipfile.BadZipFile) as exc:
            receipt["source_recheck_error"] = type(exc).__name__
            continue
        receipt.setdefault("legacy_fact", {"quantity": receipt.get("quantity"),
                                           "company_ownership_percent": receipt.get("company_ownership_percent"),
                                           "evidence": receipt.get("evidence")})
        receipt.update(parsed)
        receipt.pop("source_recheck_error", None)
        state["events"][no] = {"receipt_no": no, "receipt_date": receipt.get("receipt_date"),
            "corp_code": receipt["corp_code"], "stock_code": receipt["stock_code"], "kind": "other",
            "correction_of": receipt.get("correction_of"), "quantity": parsed["quantity"],
            "company_ownership_percent": parsed["company_ownership_percent"], "source": parsed["evidence"]}
        flagged = any(receipt.get(field) for field in ("is_correction", "later_correction_flag", "withdrawn_flag"))
        if flagged:
            state["unresolved"][no] = "withdrawal_unverified" if receipt.get("withdrawn_flag") else "correction_relation_unverified"
        else:
            state["unresolved"].pop(no, None)
        verified += 1
    if checked:
        classify_events(state)
        if state_path:
            state["revision"] += 1
            write_json(state_path, state)
    return {"checked": checked, "verified": verified}


def reconcile_security(state, key, limit=300, pause=time.sleep, state_path=None, master=None, master_hash=None):
    """Check only current imported holdings against their exact DART receipt."""
    ledger = state.setdefault("mapping_ledger", {})
    checked = 0
    mapped = 0
    for holding in sorted(state["holdings"].values(), key=lambda h: h.get("receipt_no", ""), reverse=True):
        if checked >= limit:
            break
        no = holding.get("receipt_no") or ""
        if holding.get("security_kind") != "unknown" or not RECEIPT.fullmatch(no):
            continue
        corp = holding.get("corp_code")
        universe = state["universe"].get(corp, {})
        prior = ledger.get(no, {})
        if prior.get("method") == MAPPING_METHOD:
            if prior.get("status") == "verified":
                continue
            if prior.get("status") == "unverified":
                # A new issuer may appear in KRX after the first attempt, and
                # a later DART listing may repair the universe code.
                changed_identity = universe.get("stock_code") == holding.get("stock_code") and prior.get("reason") == "stock_identity_mismatch"
                changed_master = prior.get("reason") == "krx_stock_class_or_name_unverified" and prior.get("krx_sha256") != master_hash
                if not (changed_identity or changed_master):
                    continue
        if universe.get("stock_code") != holding.get("stock_code"):
            ledger[no] = {"status": "unverified", "method": MAPPING_METHOD, "reason": "stock_identity_mismatch"}
            checked += 1
            if state_path and checked % 20 == 0:
                state["revision"] += 1
                write_json(state_path, state)
            continue
        if master is None:
            continue
        listed_name = master.get(holding.get("stock_code"))
        normalized_name = comparable_company_name(holding.get("name"))
        normalized_listed = comparable_company_name(listed_name)
        if not listed_name or normalized_name != normalized_listed:
            ledger[no] = {"status": "unverified", "method": MAPPING_METHOD, "reason": "krx_stock_class_or_name_unverified", "krx_sha256": master_hash}
            checked += 1
            continue
        try:
            parsed = dart_document(no, key)
        except (RuntimeError, ValueError, zipfile.BadZipFile):
            ledger[no] = {"status": "retry", "method": MAPPING_METHOD, "reason": "document_unavailable"}
            checked += 1
            pause(0.2)
            if state_path and checked % 20 == 0:
                state["revision"] += 1
                write_json(state_path, state)
            continue
        exact = parsed.get("verified_voting_share_quantity")
        quantity = dec(holding.get("quantity"))
        class_code = parsed.get("verified_common_stock_code")
        if exact is not None and (class_code is None or class_code == holding.get("stock_code")) and quantity is not None and Decimal(exact) == Decimal(parsed["quantity"]) == Decimal(quantity):
            holding["security_kind"] = "common"
            holding["security_mapping_evidence"] = "dart_voting_only_and_krx_listed_class"
            holding["security_mapping_xml_sha256"] = parsed["xml_sha256"]
            holding["security_mapping_krx_sha256"] = master_hash
            holding["valuation_exclusion_reason"] = None
            ledger[no] = {"status": "verified", "method": MAPPING_METHOD,
                          "xml_sha256": parsed["xml_sha256"], "krx_sha256": master_hash}
            mapped += 1
        else:
            ledger[no] = {"status": "unverified", "method": MAPPING_METHOD, "reason": "share_class_or_quantity_unverified",
                          "xml_sha256": parsed.get("xml_sha256")}
        checked += 1
        pause(0.2)
        if state_path and checked % 20 == 0:
            state["revision"] += 1
            write_json(state_path, state)
    if state_path and checked % 20:
        state["revision"] += 1
        write_json(state_path, state)
    return {"checked": checked, "mapped": mapped,
            "remaining": sum(h.get("security_kind") == "unknown" for h in state["holdings"].values())}


def reconcile_corporate_actions(state, trade_date, current_master, *, fetch=krx_security_details,
                                state_path=None, limit_dates=50):
    """Bound large split/merger-like share changes using dated KRX security facts."""
    rows = [h for h in state["holdings"].values() if h.get("security_kind") in ("common", "preferred")]
    pending = {}
    for holding in rows:
        day = holding.get("receipt_date")
        baseline = holding.get("corporate_action_baseline") or {}
        if day and day <= trade_date and (baseline.get("method") != ACTION_METHOD or baseline.get("receipt_date") != day
                                        or baseline.get("stock_code") != holding.get("stock_code")):
            pending.setdefault(day, []).append(holding)
    checked_dates = 0
    for day, holdings in sorted(pending.items(), reverse=True)[:limit_dates]:
        historical, source_hash = fetch(day)
        for holding in holdings:
            code = holding.get("stock_code")
            item = historical.get(code)
            holding["corporate_action_baseline"] = {"method": ACTION_METHOD, "receipt_date": day,
                "stock_code": code, "isin": item.get("isin") if item else None,
                "name": item.get("name") if item else None,
                "listed_shares_thousands": item.get("listed_shares_thousands") if item else None,
                "source_sha256": source_hash}
        checked_dates += 1
        if state_path and checked_dates % 5 == 0:
            state["revision"] += 1
            write_json(state_path, state)
    if state_path and checked_dates % 5:
        state["revision"] += 1
        write_json(state_path, state)
    verified = unverified = 0
    for holding in rows:
        day = holding.get("receipt_date")
        code = holding.get("stock_code")
        baseline = holding.get("corporate_action_baseline") or {}
        current = current_master.get(code)
        reason = None
        if not day or day > trade_date:
            reason = "filing_after_quote_date" if day else "receipt_date_missing"
        elif baseline.get("method") != ACTION_METHOD or baseline.get("receipt_date") != day or not baseline.get("isin"):
            reason = "historical_security_unverified"
        elif not current or baseline["isin"] != current.get("isin") or comparable_company_name(baseline.get("name")) != comparable_company_name(current.get("name")):
            reason = "security_identity_changed"
        else:
            before = dec(baseline.get("listed_shares_thousands"))
            after = dec(current.get("listed_shares_thousands"))
            if before is None or after is None or Decimal(before) <= 0 or Decimal(after) <= 0:
                reason = "listed_share_count_unverified"
            else:
                if Decimal(after) != Decimal(before):
                    reason = "listed_share_count_changed_without_action_evidence"
        holding["corporate_action_status"] = "unverified" if reason else "verified"
        holding["corporate_action_reason"] = reason
        holding["corporate_action_trade_date"] = trade_date
        if reason:
            unverified += 1
        else:
            verified += 1
    if state_path:
        state["revision"] += 1
        write_json(state_path, state)
    return {"checked_dates": checked_dates, "verified": verified, "unverified": unverified}


def recover_metadata(state, key, *, limit_days=100, state_path=None):
    """Re-query only the receipt dates of imported references missing identity."""
    pending = {}
    ledger = state.setdefault("metadata_recovery", {})
    today = kst_today()
    for no in state["unresolved"]:
        receipt = state["receipts"].get(no, {})
        if (receipt.get("corp_code") and receipt.get("stock_code")) or not RECEIPT.fullmatch(no):
            continue
        day = norm_date(no[:8])
        if not day:
            continue
        last = ledger.get(day, {}).get("checked_on")
        if last and (today - date.fromisoformat(last)).days < 7:
            continue
        pending.setdefault(day, set()).add(no)
    checked = found = 0
    for day, targets in sorted(pending.items(), reverse=True)[:limit_days]:
        params = {"bgn_de": day.replace("-", ""), "end_de": day.replace("-", ""),
                  "pblntf_ty": "D", "pblntf_detail_ty": "D001", "page_count": 100}
        first = dart_json("list.json", {**params, "page_no": 1}, key)
        if first.get("status") not in ("000", "013"):
            raise RuntimeError("DART metadata listing failed")
        count = int(first.get("total_page") or 0) if first.get("status") == "000" else 0
        pages = [first] + [dart_json("list.json", {**params, "page_no": page}, key) for page in range(2, count + 1)]
        validate_listing_pages(pages)
        for page in pages:
            for row in page.get("list") or []:
                if str(row.get("rcept_no")) in targets and nps_large_holding_listing(row):
                    apply_listing_row(state, row)
                    found += 1
        ledger[day] = {"checked_on": today.isoformat(), "target_count": len(targets),
                       "found_count": sum(bool(state["receipts"].get(no, {}).get("corp_code") and
                                                state["receipts"].get(no, {}).get("stock_code")) for no in targets)}
        checked += 1
        if state_path and checked % 10 == 0:
            state["revision"] += 1
            write_json(state_path, state)
    if state_path and checked % 10:
        state["revision"] += 1
        write_json(state_path, state)
    return {"dates_checked": checked, "references_matched": found}


def backfill_history(state_path: Path, start: date, end: date, key: str, *,
                     max_listing_pages=120, max_windows=20, parse_limit=30, recheck_limit=10,
                     ledger_key="historical_backfill"):
    """Scan old D001 listings forward, committing only fully verified windows.

    The historical cursor never advances the incremental cursor. Old receipt
    facts can enrich events but cannot promote a partial archive into today's
    holdings. The caller persists each completed window even if a later one fails.
    """
    if not key:
        raise ValueError("DART_API_KEY unavailable")
    if ledger_key not in ("historical_backfill", "early_direct_backfill"):
        raise ValueError("invalid historical ledger")
    if (start > end or end > kst_today() or max_listing_pages < 1 or max_windows < 1
            or not 0 <= parse_limit <= 300 or not 0 <= recheck_limit <= 100):
        raise ValueError("invalid historical backfill bounds")
    state = read_json(state_path)
    if not state.get("import_ledger") or not state.get("latest_complete_listing_date"):
        raise ValueError("incremental collection must be initialized")
    if end > date.fromisoformat(state["latest_complete_listing_date"]):
        raise ValueError("historical end exceeds current complete listing date")
    ledger = state.get(ledger_key)
    if ledger is None:
        ledger = {"start_date": start.isoformat(), "target_date": end.isoformat(),
                  "next_date": start.isoformat(), "coverage": []}
        state[ledger_key] = ledger
    elif ledger.get("start_date") != start.isoformat() or end < date.fromisoformat(ledger["target_date"]):
        raise ValueError("historical backfill range conflicts with persisted cursor")
    else:
        ledger["target_date"] = end.isoformat()
    cursor = date.fromisoformat(ledger["next_date"])
    if cursor < start or cursor > end + timedelta(days=1):
        raise ValueError("historical backfill cursor inconsistent")

    requests = windows = new_receipts = listed_nps = 0
    required_pages = None
    while cursor <= end and windows < max_windows and requests < max_listing_pages:
        last = min(cursor + timedelta(days=int(ledger.get("max_window_days") or 80) - 1), end)
        pages = None
        while True:
            params = {"bgn_de": cursor.strftime("%Y%m%d"), "end_de": last.strftime("%Y%m%d"),
                      "pblntf_ty": "D", "pblntf_detail_ty": "D001", "last_reprt_at": "N",
                      "sort": "date", "sort_mth": "asc", "page_count": 100}
            try:
                first = dart_json("list.json", {**params, "page_no": 1}, key)
            except Exception as exc:
                raise HistoricalCollectionError(historical_error_code(exc, "FIRST_PAGE"), cursor, last, 1) from None
            requests += 1
            if first.get("status") == "013":
                pages = [first]
                break
            try:
                page_count = int(first["total_page"])
            except (KeyError, TypeError, ValueError):
                raise HistoricalCollectionError("PAGINATION_METADATA", cursor, last, 1) from None
            if page_count < 1 or page_count > 10_000:
                raise HistoricalCollectionError("PAGINATION_METADATA", cursor, last, 1)
            if page_count > max_listing_pages:
                if last == cursor:
                    required_pages = page_count
                    break
                last = cursor + timedelta(days=(last - cursor).days // 2)
                ledger["max_window_days"] = (last - cursor).days + 1
                state["revision"] += 1
                write_json(state_path, state)
                if requests >= max_listing_pages:
                    break
                continue
            if requests + page_count - 1 > max_listing_pages:
                break  # This window fits a fresh run; do not commit a partial one.
            pages = [first]
            for number in range(2, page_count + 1):
                try:
                    pages.append(dart_json("list.json", {**params, "page_no": number}, key))
                except Exception as exc:
                    raise HistoricalCollectionError(historical_error_code(exc, "LATER_PAGE"), cursor, last, number) from None
                requests += 1
            break
        if pages is None:
            break
        try:
            validate_listing_pages(pages)
        except Exception as exc:
            raise HistoricalCollectionError(historical_error_code(exc, "PAGE_VALIDATION"), cursor, last) from None
        window_nps = 0
        for page_number, page in enumerate(pages, 1):
            for row_index, row in enumerate(page.get("list") or [], 1):
                if not nps_large_holding_listing(row):
                    continue
                no = str(row.get("rcept_no") or "")
                if no not in state["receipts"]:
                    new_receipts += 1
                try:
                    apply_listing_row(state, row, historical=True)
                except Exception as exc:
                    raise HistoricalCollectionError(historical_error_code(exc, "NPS_ROW"), cursor, last,
                                                    page_number, row_index) from None
                window_nps += 1
        listed_nps += window_nps
        completed_days = (last - cursor).days + 1
        ledger["coverage"].append({"from": cursor.isoformat(), "to": last.isoformat(),
                                   "checked_at": datetime.now(timezone.utc).isoformat(),
                                   "pages": len(pages), "nps_receipts": window_nps, "complete": True})
        cursor = last + timedelta(days=1)
        ledger["next_date"] = cursor.isoformat()
        ledger["max_window_days"] = min(80, completed_days * 2)
        state["revision"] += 1
        write_json(state_path, state)
        windows += 1

    historical_pending = {no for no in state["unresolved"]
                          if state["receipts"].get(no, {}).get("historical_backfill_only")
                          and state["receipts"][no].get("origin") == "dart_listing"
                          and state["receipts"][no].get("evidence") in
                          ("unresolved", "legacy_json_parser_result", "legacy_reference_only")}
    parse_candidates = {no for no in historical_pending
                        if int(state["receipts"][no].get("parse_attempt_count") or 0) < HISTORICAL_PARSE_ATTEMPTS
                        and state["receipts"][no].get("last_parse_attempt_on") != kst_today().isoformat()}
    parsed = (resolve_unfinished(state, key, limit=parse_limit, state_path=state_path,
                                 candidates=parse_candidates, promote_holdings=False)
              if parse_limit else 0)
    rechecked = recheck_legacy_history(state, key, limit=recheck_limit, state_path=state_path) if recheck_limit else {"checked": 0, "verified": 0}
    pending = sum(no in state["unresolved"] and int(state["receipts"][no].get("parse_attempt_count") or 0)
                  < HISTORICAL_PARSE_ATTEMPTS for no in historical_pending)
    exhausted = sum(no in state["unresolved"] and int(state["receipts"][no].get("parse_attempt_count") or 0)
                    >= HISTORICAL_PARSE_ATTEMPTS for no in historical_pending)
    complete = cursor > end
    return {"status": "LISTING_BUDGET_INSUFFICIENT" if required_pages is not None else
            "LISTING_COMPLETE_PARSING_PENDING" if complete and pending else
            "LISTING_COMPLETE_WITH_UNVERIFIED" if complete and exhausted else
            "LISTING_COMPLETE" if complete else "LISTING_IN_PROGRESS",
            "start_date": start.isoformat(), "target_date": end.isoformat(),
            "next_date": ledger["next_date"], "completed_windows": len(ledger["coverage"]),
            "windows_this_run": windows, "listing_requests": requests,
            "required_pages": required_pages,
            "nps_rows_this_run": listed_nps, "new_receipts_this_run": new_receipts,
            "parse_attempts": parsed, "new_receipts_pending": pending,
            "parse_attempts_exhausted": exhausted,
            "legacy_rechecked": rechecked["checked"], "legacy_verified": rechecked["verified"],
            "state_revision": state["revision"]}


def resume_history(state_path: Path, key: str, *, max_listing_pages=120, max_windows=20, parse_limit=30,
                   recheck_limit=10, ledger_key="historical_backfill"):
    if ledger_key not in ("historical_backfill", "early_direct_backfill"):
        raise ValueError("invalid historical ledger")
    ledger = read_json(state_path).get(ledger_key)
    if ledger is None:
        return {"status": "NOT_INITIALIZED", "windows_this_run": 0, "parse_attempts": 0}
    return backfill_history(state_path, date.fromisoformat(ledger["start_date"]),
                            date.fromisoformat(ledger["target_date"]), key,
                            max_listing_pages=max_listing_pages, max_windows=max_windows,
                            parse_limit=parse_limit, recheck_limit=recheck_limit, ledger_key=ledger_key)


def collect(state_path: Path, cutoff: date, key: str, overlap=7):
    if not key:
        raise ValueError("DART_API_KEY unavailable")
    state = read_json(state_path)
    if not state.get("import_ledger"):
        raise ValueError("IMPORT_PENDING_SOURCE")
    anchor = state.get("latest_complete_listing_date") or state.get("legacy_resume_hint")
    if not anchor:
        raise ValueError("no observed resume anchor")
    start = date.fromisoformat(anchor) - timedelta(days=overlap)
    cursor = start
    request_count = 0
    new_receipts = 0
    while cursor <= cutoff:
        end = min(cursor + timedelta(days=79), cutoff)
        base = {"bgn_de": cursor.strftime("%Y%m%d"), "end_de": end.strftime("%Y%m%d"),
                "pblntf_ty": "D", "pblntf_detail_ty": "D001", "page_count": 100}
        first = dart_json("list.json", {**base, "page_no": 1}, key)
        request_count += 1
        if first.get("status") == "013":
            pages = [first]
        else:
            total_page = int(first.get("total_page") or 0)
            total_count = int(first.get("total_count") or 0)
            if total_page < 1 or total_count < 0 or total_page != max(1, (total_count + 99) // 100):
                raise RuntimeError("DART pagination metadata inconsistent")
            pages = [first]
            for number in range(2, total_page + 1):
                pages.append(dart_json("list.json", {**base, "page_no": number}, key))
                request_count += 1
        validate_listing_pages(pages)
        for page in pages:
            if page.get("status") not in ("000", "013"):
                raise RuntimeError("DART listing page failed")
            for row in page.get("list") or []:
                no = str(row.get("rcept_no") or "")
                if no not in state["receipts"] and nps_large_holding_listing(row):
                    new_receipts += 1
                apply_listing_row(state, row)
        state["listing_coverage"].append({"from": cursor.isoformat(), "to": end.isoformat(),
            "checked_at": datetime.now(timezone.utc).isoformat(), "pages": len(pages), "complete": True})
        state["latest_complete_listing_date"] = end.isoformat()
        state["revision"] += 1
        write_json(state_path, state)
        cursor = end + timedelta(days=1)
    metadata = recover_metadata(state, key, state_path=state_path)
    parse_attempts = resolve_unfinished(state, key, state_path=state_path)
    basis = recheck_direct_basis(state, key, limit=20, state_path=state_path)
    observed = datetime.now(timezone.utc)
    trade_date = expected_session(observed, closures=holiday_set_for(observed),
                                  special_closes=CONFIRMED_SPECIAL_SESSIONS).isoformat()
    mapping_details, mapping_hash = krx_security_details(trade_date) if state["holdings"] else ({}, None)
    mapping_master = {code: item["name"] for code, item in mapping_details.items()}
    mapping = reconcile_security(state, key, state_path=state_path, master=mapping_master, master_hash=mapping_hash)
    actions = reconcile_corporate_actions(state, trade_date, mapping_details, state_path=state_path)
    if parse_attempts and not mapping["checked"]:
        state["revision"] += 1
        write_json(state_path, state)
    return {"status": "LISTING_COMPLETE_PARSING_PENDING" if state["unresolved"] else "LISTING_COMPLETE",
            "requested_from": start.isoformat(), "requested_to": cutoff.isoformat(),
            "requests": request_count, "new_receipts": new_receipts,
            "parse_attempts": parse_attempts, "basis_rechecked": basis,
            "metadata": metadata, "mapping": mapping, "corporate_actions": actions,
            "unresolved": len(state["unresolved"]), "state_revision": state["revision"]}


def record_reviewed_evidence(state_path: Path, fact_path: Path, commit=False):
    from pipeline.foliotrace.indirect import register_evidence
    state = read_json(state_path)
    fact = read_json(fact_path)
    result = register_evidence(state, fact)
    if result["changed"] and commit:
        if result["kind"] == "direct_ratio_basis":
            classify_events(state)
        state["revision"] += 1
        write_json(state_path, state)
    return {**result, "committed": bool(result["changed"] and commit), "state_revision": state["revision"]}


def price_and_value(state_path: Path, output: Path, client=None):
    state = read_json(state_path)
    if not state.get("import_ledger"):
        raise ValueError("IMPORT_PENDING_SOURCE")
    client = client or NaverClient()
    quotes = {}
    failed = {}
    cache_hits = 0
    now = datetime.now(timezone.utc)
    cache = state.setdefault("quote_cache", {})
    new_cache = {}
    current_rows, _, _ = reconcile_indirect(state, list(state["holdings"].values()))
    eligible = {row.get("stock_code") for row in current_rows
                if row.get("security_kind") in ("common", "preferred") and row.get("tracking") != "below-5-percent"
                and row.get("stock_code") and row.get("quantity") is not None}
    if not eligible:
        raise RuntimeError("no verified stock-class mappings for valuation")
    expected = (client.expected_session(now) if hasattr(client, "expected_session") else expected_session(now)).isoformat()
    special_closes = getattr(client, "special_closes", CONFIRMED_SPECIAL_SESSIONS)
    is_special = date.fromisoformat(expected) in special_closes
    for code in sorted(eligible):
        strict_key = f"{code}|KRX|regular|{expected}|naver-chart1530-kind-v2"
        delayed_key = f"{code}|KRX|regular|{expected}|naver-delayed-kind-v2"
        special_key = f"{code}|KRX|regular|{expected}|naver-special-kind-v1"
        cached_key = (special_key if is_special else strict_key if strict_key in cache else delayed_key)
        cached = cache.get(cached_key)
        expected_basis = ("naver_krx_1530_kind_confirmed" if cached_key == strict_key
                          else "naver_krx_delayed_auction_kind_confirmed" if cached_key == delayed_key
                          else "naver_krx_special_close_kind_confirmed")
        if cached and cached.get("verified") is True and cached.get("trade_date") == expected and cached.get("close_basis") == expected_basis:
            quotes[code] = cached
            new_cache[cached_key] = cached
            cache_hits += 1
            continue
        try:
            quotes[code] = client.quote(code)
            quote = quotes[code]
            suffix = ("naver-delayed-kind-v2" if quote.get("close_basis") == "naver_krx_delayed_auction_kind_confirmed"
                      else "naver-special-kind-v1" if quote.get("close_basis") == "naver_krx_special_close_kind_confirmed"
                      else "naver-chart1530-kind-v2")
            new_cache[f"{code}|KRX|regular|{quote['trade_date']}|{suffix}"] = quote
        except QuoteError as exc:
            failed[code] = str(exc)
    if eligible and not quotes:
        raise RuntimeError(f"all {len(eligible)} eligible quote codes failed on {expected}")
    if new_cache != cache:
        state["quote_cache"] = new_cache
        state["revision"] += 1
        write_json(state_path, state)
    snapshot = make_snapshot(state, quotes)
    if snapshot["trackedCount"] and (snapshot["pricedCount"] == 0 or snapshot["estimatedValue"] is None
                                     or snapshot["valuationCoverage"] == "unavailable"):
        raise RuntimeError("all tracked holdings are unpriced; production snapshot withheld")
    write_json(output, snapshot)
    return {"dataset_version": snapshot["datasetVersion"], "tracked": snapshot["trackedCount"],
            "eligible_codes": len(eligible), "priced": snapshot["pricedCount"],
            "valuation_coverage": snapshot["valuationCoverage"], "failed_quotes": failed,
            "requests": client.requests, "cache_hits": cache_hits,
            "output_sha256": sha(encoded(snapshot))}


def emit_snapshot(snapshot_path: Path, dist: Path):
    if dist.name != "dist" or not (dist / "index.html").is_file():
        raise ValueError("output must be a built dist directory")
    snapshot = read_json(snapshot_path)
    if snapshot.get("trackedCount", 0) > 0 and (snapshot.get("pricedCount") == 0
                                                 or snapshot.get("estimatedValue") is None
                                                 or snapshot.get("valuationCoverage") == "unavailable"):
        raise ValueError("all tracked holdings are unpriced; production snapshot withheld")
    version = snapshot.get("datasetVersion")
    if not isinstance(version, str) or not re.fullmatch(r"[a-f0-9]{64}", version):
        raise ValueError("invalid snapshot version")
    root = dist / "data/foliotrace/v1"
    target = root / "snapshots" / f"{version}.json"
    write_json(target, snapshot)
    manifest = {"schemaVersion": 1, "datasetVersion": version,
                "snapshotPath": f"snapshots/{version}.json", "snapshotSha256": sha(target.read_bytes())}
    write_json(root / "manifest.json", manifest)
    for lang in ("ko", "en"):
        page = dist / lang / "tools/foliotrace/index.html"
        source = page.read_text(encoding="utf-8")
        if 'class="seo-static-fallback"' not in source:
            raise ValueError("FolioTrace static fallback missing")
        is_ko = lang == "ko"
        label = "평가 기준 거래일" if is_ko else "Valuation trade date"
        value_label = "추정 평가금액" if is_ko else "Estimated value"
        unavailable = "검증된 평가금액 없음" if is_ko else "No verified estimate available"
        top_label = "상위 보유종목" if is_ko else "Top holdings"
        rows = sorted((h for h in snapshot["holdings"] if h["estimatedValue"] is not None),
                      key=lambda h: Decimal(h["estimatedValue"]), reverse=True)[:10]
        table = ""
        if rows:
            body = "".join(f"<tr><th scope='row'>{html.escape(h['name'])}</th><td>{html.escape(h['stockCode'])}</td><td>{html.escape(h['estimatedValue'])}</td></tr>" for h in rows)
            table = f"<h2>{top_label}</h2><table><thead><tr><th>{'종목' if is_ko else 'Security'}</th><th>{'코드' if is_ko else 'Code'}</th><th>KRW</th></tr></thead><tbody>{body}</tbody></table>"
        summary = f"<section data-foliotrace-dataset='{version}'><h2>{value_label}</h2><p>{html.escape(snapshot['estimatedValue'] or unavailable)}</p><p>{label}: {html.escape(snapshot['valuationTradeDate'] or unavailable)}</p>{table}</section>"
        page.write_text(source.replace("</main>", summary + "</main>", 1), encoding="utf-8")
    return {"dataset_version": version, "snapshot_sha256": manifest["snapshotSha256"],
            "manifest_sha256": sha((root / "manifest.json").read_bytes())}


def record_published(state_path: Path, *, version: str, trade_date: str | None, estimated_value: str | None):
    if not re.fullmatch(r"[a-f0-9]{64}", version):
        raise ValueError("invalid published dataset")
    state = read_json(state_path)
    if state.get("last_published_dataset") == version:
        return {"published_dataset": version, "history_count": len(state.get("published_history", [])),
                "state_revision": state["revision"], "idempotent_noop": True}
    future_filing = any(h.get("receipt_date") and h["receipt_date"] > trade_date
                        for h in state["holdings"].values()) if trade_date else False
    if trade_date and estimated_value is not None and not future_filing:
        if not norm_date(trade_date) or dec(estimated_value) is None:
            raise ValueError("invalid published valuation")
        history = [entry for entry in state.get("published_history", []) if entry["trade_date"] != trade_date]
        history.append({"trade_date": trade_date, "estimated_value": dec(estimated_value),
                        "dataset_version": version, "methodology_version": "1"})
        state["published_history"] = sorted(history, key=lambda entry: entry["trade_date"])[-90:]
    state["last_published_dataset"] = version
    state["revision"] += 1
    write_json(state_path, state)
    return {"published_dataset": version, "history_count": len(state.get("published_history", [])),
            "state_revision": state["revision"]}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    for name in ("inspect-source", "export-source"):
        q = sub.add_parser(name)
        q.add_argument("--source", type=Path, required=True)
        if name == "export-source": q.add_argument("--output", type=Path, required=True)
    q = sub.add_parser("import-seed")
    q.add_argument("--export", type=Path, required=True)
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--commit", action="store_true")
    q = sub.add_parser("backfill-legacy")
    q.add_argument("--export", type=Path, required=True)
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--commit", action="store_true")
    q = sub.add_parser("collect")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--cutoff", type=date.fromisoformat, default=kst_today())
    q = sub.add_parser("backfill-history")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--start", type=date.fromisoformat)
    q.add_argument("--end", type=date.fromisoformat)
    q.add_argument("--resume", action="store_true")
    q.add_argument("--max-listing-pages", type=int, default=120)
    q.add_argument("--max-windows", type=int, default=20)
    q.add_argument("--parse-limit", type=int, default=30)
    q.add_argument("--recheck-limit", type=int, default=10)
    q = sub.add_parser("backfill-early-direct")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--max-listing-pages", type=int, default=300)
    q.add_argument("--max-windows", type=int, default=20)
    q.add_argument("--parse-limit", type=int, default=20)
    q = sub.add_parser("scan-secondary")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--start", type=date.fromisoformat)
    q.add_argument("--end", type=date.fromisoformat)
    q.add_argument("--max-pages", type=int, default=300)
    q.add_argument("--max-windows", type=int, default=20)
    q.add_argument("--review-limit", type=int, default=30)
    q.add_argument("--scope", choices=("all", "equity", "prior-all", "prior-equity"), default="all")
    q = sub.add_parser("record-reviewed-evidence")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--fact", type=Path, required=True)
    q.add_argument("--commit", action="store_true")
    q = sub.add_parser("recheck-basis")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--receipt", required=True)
    q = sub.add_parser("diagnose-basis")
    q.add_argument("--receipt", required=True)
    q = sub.add_parser("price-and-value")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--output", type=Path, required=True)
    q = sub.add_parser("emit-snapshot")
    q.add_argument("--snapshot", type=Path, required=True)
    q.add_argument("--dist", type=Path, required=True)
    q = sub.add_parser("record-published")
    q.add_argument("--state", type=Path, required=True)
    q.add_argument("--dataset-version", required=True)
    q.add_argument("--trade-date")
    q.add_argument("--estimated-value")
    q = sub.add_parser("verify-migration")
    q.add_argument("--export", type=Path, required=True)
    q.add_argument("--state", type=Path, required=True)
    args = p.parse_args()
    try:
        if args.command == "inspect-source": result = inspect_source(args.source)
        elif args.command == "export-source": result = export_source(args.source, args.output)
        elif args.command == "import-seed": result = import_seed(args.export, args.state, args.commit)
        elif args.command == "backfill-legacy": result = backfill_legacy(args.export, args.state, args.commit)
        elif args.command == "collect": result = collect(args.state, args.cutoff, os.environ.get("DART_API_KEY", ""))
        elif args.command == "backfill-history":
            options = {"max_listing_pages": args.max_listing_pages, "max_windows": args.max_windows,
                       "parse_limit": args.parse_limit, "recheck_limit": args.recheck_limit}
            if args.resume and args.start is None and args.end is None:
                result = resume_history(args.state, os.environ.get("DART_API_KEY", ""), **options)
            elif not args.resume and args.start is not None and args.end is not None:
                result = backfill_history(args.state, args.start, args.end,
                                          os.environ.get("DART_API_KEY", ""), **options)
            else:
                raise ValueError("choose either an explicit historical range or --resume")
        elif args.command == "backfill-early-direct":
            result = backfill_history(args.state, date(2006, 1, 1), date(2008, 12, 31),
                os.environ.get("DART_API_KEY", ""), max_listing_pages=args.max_listing_pages,
                max_windows=args.max_windows, parse_limit=args.parse_limit, recheck_limit=0,
                ledger_key="early_direct_backfill")
        elif args.command == "scan-secondary":
            from scripts.foliotrace.secondary import scan_secondary
            state = read_json(args.state)
            start = args.start or (date(1999, 4, 1) if args.scope.startswith("prior-") else date(2006, 1, 1))
            target = args.end or (date(2005, 12, 31) if args.scope.startswith("prior-") else
                                  date(2008, 12, 31) if args.scope == "equity" else
                                  date.fromisoformat(state["latest_complete_listing_date"]))
            if target > kst_today():
                raise ValueError("secondary target beyond today")
            result = scan_secondary(args.state, start, target, max_pages=args.max_pages,
                                    max_windows=args.max_windows, read_state=read_json, write_state=write_json,
                                    key=os.environ.get("DART_API_KEY", ""), review_limit=args.review_limit,
                                    scope=args.scope)
        elif args.command == "record-reviewed-evidence":
            result = record_reviewed_evidence(args.state, args.fact, args.commit)
        elif args.command == "recheck-basis":
            state = read_json(args.state)
            result = recheck_direct_basis(state, os.environ.get("DART_API_KEY", ""), limit=1,
                                          state_path=args.state, target_receipt=args.receipt)
            result["receipt_no"] = args.receipt
        elif args.command == "diagnose-basis":
            if not RECEIPT.fullmatch(args.receipt):
                raise ValueError("DIRECT_BASIS_TARGET")
            parsed = dart_document(args.receipt, os.environ.get("DART_API_KEY", ""))
            result = {"receipt_no": args.receipt, "basis_verified": parsed.get("holding_date") is not None,
                      "basis_diagnostic": parsed["basis_diagnostic"]}
        elif args.command == "price-and-value": result = price_and_value(args.state, args.output)
        elif args.command == "emit-snapshot": result = emit_snapshot(args.snapshot, args.dist)
        elif args.command == "record-published": result = record_published(args.state, version=args.dataset_version,
            trade_date=args.trade_date, estimated_value=args.estimated_value)
        else:
            _, _, _, _, _, expected = normalize_seed(args.export)
            state = read_json(args.state)
            result = {"verified": expected["import_batch_id"] in state["import_ledger"],
                      "source_hash": expected["source_hash"], "unique_receipts": expected["unique_receipts"],
                      "state_receipts": len(state["receipts"]), "state_revision": state["revision"]}
            if not result["verified"] or result["state_receipts"] < result["unique_receipts"]:
                raise ValueError("migration verification failed")
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        if (args.command in ("backfill-history", "backfill-early-direct")
                and result.get("status") == "LISTING_BUDGET_INSUFFICIENT"
                or args.command == "scan-secondary" and result.get("status") == "SEARCH_BUDGET_INSUFFICIENT"):
            return 1
    except Exception as exc:
        error = {"error": type(exc).__name__}
        if args.command in ("backfill-history", "backfill-early-direct") and isinstance(exc, HistoricalCollectionError):
            error.update(code=exc.code, window_start=exc.start, window_end=exc.end)
            if exc.page_no is not None:
                error["page_no"] = exc.page_no
            if exc.row_index is not None:
                error["row_index"] = exc.row_index
        elif args.command == "scan-secondary":
            from scripts.foliotrace.secondary import SecondarySearchError
            if isinstance(exc, SecondarySearchError):
                error.update(code=exc.code, window_start=exc.start, window_end=exc.end,
                             term_index=exc.term_index, page_no=exc.page)
        elif args.command != "backfill-history":
            error["message"] = str(exc)
        print(json.dumps(error, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
