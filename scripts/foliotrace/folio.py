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
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pipeline.foliotrace.naver import NaverClient, QuoteError, expected_session
from pipeline.foliotrace.publish import make_snapshot, encoded

RECEIPT = re.compile(r"^\d{14}$")
CORP = re.compile(r"^\d{8}$")
STOCK = re.compile(r"^[0-9A-Z]{6}$")
NPS = re.compile(r"국민연금|National Pension Service", re.I)
ALLOWED = ("universe.json", "report-cache.json", "holdings-latest.json", "state.json")
SOURCE_NOTE = "MyTradingDesk context-service NPS public DART cache"
MAPPING_METHOD = "dart-voting-krx-kind-v1"
ACTION_METHOD = "krx-listed-share-ratio-v1"
CORRECTION_PREFIXES = ("[기재정정]", "[첨부정정]", "[첨부추가]", "[정정]",
                       "[정정명령부과]", "[정정제출요구]", "[변경등록]", "정정")


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
        if not NPS.search(str(raw.get("filer") or "")):
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
        nps_rows = [row for row in table if len(row) >= 14 and any(NPS.search(cell) for cell in row[:3])]
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
    if not filer or not NPS.search(filer):
        raise ValueError("DART filer mismatch")
    quantity = dec(cell("ACODE", "SUM_TMT_CNT"))
    ownership = dec((cell("ACODE", "SUM_TMT_RT") or "").replace("%", ""))
    if quantity is None or ownership is None:
        raise ValueError("DART XML lacks holding quantity or ratio")
    voting = verified_voting_share_quantity(xml, quantity)
    return {"quantity": quantity, "company_ownership_percent": ownership,
            "reason": safe_str(cell("ACODE", "SUM_CHN_RWN")), "xml_sha256": sha(xml_bytes),
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
        if str(row.get("rcept_no") or "") != no or not NPS.search(str(row.get("repror") or "")):
            continue
        quantity = dec(row.get("stkqy"))
        ownership = dec(row.get("stkrt"))
        if quantity is None or ownership is None:
            break
        return {"quantity": quantity, "company_ownership_percent": ownership,
                "reason": safe_str(row.get("report_resn")), "evidence": "dart_structured"}
    return None


def apply_listing_row(state, row):
    """Retain correction/withdrawal flags without inventing a predecessor link.

    OpenDART list guide documents rm=정 (later correction exists) and rm=철
    (withdrawn): https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001
    """
    if not NPS.search(str(row.get("flr_nm") or "")):
        return False
    no, corp = str(row.get("rcept_no") or ""), str(row.get("corp_code") or "")
    if not RECEIPT.fullmatch(no) or not CORP.fullmatch(corp):
        raise RuntimeError("DART NPS row lacks identity")
    existing = state["receipts"].get(no)
    if existing and existing.get("corp_code") and existing["corp_code"] != corp:
        raise RuntimeError("DART receipt corp conflict")
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
        existing = {"receipt_no": no, "receipt_date": norm_date(row.get("rcept_dt")),
                    "corp_code": corp, "stock_code": stock_code,
                    "name": safe_str(row.get("corp_name")), "quantity": None, "company_ownership_percent": None,
                    "origin": "dart_listing", "evidence": "unresolved", "security_kind": "unknown", "reason": ""}
        state["receipts"][no] = existing
        state["unresolved"][no] = "needs_filing_parse"
        old = state["holdings"].get(corp)
        if old and no > old.get("receipt_no", ""):
            old["latest_unresolved_receipt"] = max(old.get("latest_unresolved_receipt", ""), no)
    elif existing.get("evidence") in ("legacy_reference_only", "legacy_json_parser_result") and (not existing.get("corp_code") or not existing.get("stock_code")):
        existing["corp_code"] = corp
        existing["stock_code"] = stock_code
        existing["receipt_date"] = norm_date(row.get("rcept_dt"))
        existing["metadata_evidence"] = "dart_listing"
        state["unresolved"][no] = "needs_filing_parse"
    existing.update(report_name=report_name, remarks=remarks, is_correction=correction,
                    correction_of=None, later_correction_flag=superseded, withdrawn_flag=withdrawn)
    if correction or superseded or withdrawn:
        state["unresolved"][no] = "correction_relation_unverified" if correction or superseded else "withdrawal_unverified"
    if listed_code and prior_code and listed_code != prior_code:
        state["unresolved"][no] = "security_identity_conflict"
    return existing["origin"] == "dart_listing" and existing["evidence"] == "unresolved"


def resolve_unfinished(state, key, limit=30):
    processed = 0
    structured_cache = {}
    for no in sorted(state["unresolved"], reverse=True):
        if processed >= limit:
            break
        receipt = state["receipts"].get(no)
        if not receipt or receipt.get("evidence") not in ("unresolved", "legacy_json_parser_result", "legacy_reference_only"):
            continue
        if state["unresolved"].get(no) == "security_identity_conflict":
            continue
        processed += 1
        try:
            corp = receipt.get("corp_code")
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
            if old and flagged_relation and no > old.get("receipt_no", ""):
                old["latest_unresolved_receipt"] = max(old.get("latest_unresolved_receipt", ""), no)
            if not flagged_relation and (not old or no >= old.get("receipt_no", "")):
                state["holdings"][corp] = {"corp_code": corp, "stock_code": stock,
                    "name": receipt.get("name") or state["universe"].get(corp, {}).get("name") or "",
                    "receipt_no": no, "receipt_date": receipt["receipt_date"],
                    "quantity": parsed["quantity"], "company_ownership_percent": parsed["company_ownership_percent"],
                    "holding_date": None, "security_kind": "unknown",
                    "tracking": "below-5-percent" if ownership < 5 else "active",
                    "evidence": parsed["evidence"], "valuation_exclusion_reason": "security_mapping_unverified"}
            if flagged_relation:
                state["unresolved"][no] = "correction_relation_unverified" if not receipt.get("withdrawn_flag") else "withdrawal_unverified"
            else:
                del state["unresolved"][no]
        else:
            state["unresolved"][no] = "security_identity_missing"
    classify_events(state)
    return processed


def classify_events(state):
    """Use the preceding verified receipt for each issuer, independent of parse order."""
    by_corp = {}
    for receipt in state["receipts"].values():
        corp = receipt.get("corp_code")
        no = receipt.get("receipt_no")
        if corp and RECEIPT.fullmatch(str(no or "")):
            by_corp.setdefault(corp, []).append(receipt)
    for corp, receipts in by_corp.items():
        previous = None
        for receipt in sorted(receipts, key=lambda item: item["receipt_no"]):
            no = receipt["receipt_no"]
            event = state.get("events", {}).get(no)
            flagged = any(receipt.get(field) for field in ("is_correction", "later_correction_flag", "withdrawn_flag"))
            quantity = dec(receipt.get("quantity"))
            ownership = dec(receipt.get("company_ownership_percent"))
            if event:
                kind = "other"
                if not flagged and quantity is not None and ownership is not None:
                    if Decimal(ownership) < 5:
                        kind = "tracking-exit"
                    elif "목적" in (receipt.get("reason") or ""):
                        kind = "purpose-change"
                    elif previous is None:
                        kind = "new-report"
                    elif previous.get("stock_code") == receipt.get("stock_code") and dec(previous.get("quantity")) is not None:
                        before, after = Decimal(dec(previous["quantity"])), Decimal(quantity)
                        kind = "increase" if after > before else "decrease" if after < before else "other"
                event["kind"] = kind
            if not flagged and quantity is not None and ownership is not None:
                previous = receipt


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
        if ledger.get(no, {}).get("method") == MAPPING_METHOD and ledger[no].get("status") in ("verified", "unverified"):
            continue
        corp = holding.get("corp_code")
        universe = state["universe"].get(corp, {})
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
            ledger[no] = {"status": "unverified", "method": MAPPING_METHOD, "reason": "krx_stock_class_or_name_unverified"}
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
                ratio = Decimal(after) / Decimal(before)
                if ratio >= Decimal("1.5") or ratio <= Decimal(2) / Decimal(3):
                    reason = "material_share_count_change"
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
                  "pblntf_detail_ty": "D001", "page_count": 100}
        first = dart_json("list.json", {**params, "page_no": 1}, key)
        total = int(first.get("total_count") or 0) if first.get("status") == "000" else 0
        count = int(first.get("total_page") or 0) if first.get("status") == "000" else 0
        if first.get("status") == "000" and (count < 1 or count != max(1, (total + 99) // 100)):
            raise RuntimeError("DART metadata pagination inconsistent")
        pages = [first] + [dart_json("list.json", {**params, "page_no": page}, key) for page in range(2, count + 1)]
        if sum(len(page.get("list") or []) for page in pages) != total:
            raise RuntimeError("DART metadata page count mismatch")
        for page in pages:
            for row in page.get("list") or []:
                if str(row.get("rcept_no")) in targets and NPS.search(str(row.get("flr_nm") or "")):
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
                "pblntf_detail_ty": "D001", "page_count": 100}
        first = dart_json("list.json", {**base, "page_no": 1}, key)
        request_count += 1
        if first.get("status") == "013":
            if first.get("list"):
                raise RuntimeError("DART no-data response contains rows")
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
            if sum(len(p.get("list") or []) for p in pages) != total_count:
                raise RuntimeError("DART listing page count mismatch")
        for page in pages:
            if page.get("status") not in ("000", "013"):
                raise RuntimeError("DART listing page failed")
            for row in page.get("list") or []:
                no = str(row.get("rcept_no") or "")
                if no not in state["receipts"] and NPS.search(str(row.get("flr_nm") or "")):
                    new_receipts += 1
                apply_listing_row(state, row)
        state["listing_coverage"].append({"from": cursor.isoformat(), "to": end.isoformat(),
            "checked_at": datetime.now(timezone.utc).isoformat(), "pages": len(pages), "complete": True})
        state["latest_complete_listing_date"] = end.isoformat()
        state["revision"] += 1
        write_json(state_path, state)
        cursor = end + timedelta(days=1)
    metadata = recover_metadata(state, key, state_path=state_path)
    parse_attempts = resolve_unfinished(state, key)
    trade_date = expected_session(datetime.now(timezone.utc)).isoformat()
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
            "parse_attempts": parse_attempts, "metadata": metadata, "mapping": mapping, "corporate_actions": actions,
            "unresolved": len(state["unresolved"]), "state_revision": state["revision"]}


def price_and_value(state_path: Path, output: Path, client=None):
    state = read_json(state_path)
    if not state.get("import_ledger"):
        raise ValueError("IMPORT_PENDING_SOURCE")
    client = client or NaverClient()
    quotes = {}
    failed = {}
    cache_hits = 0
    now = datetime.now(timezone.utc)
    expected = expected_session(now).isoformat()
    cache = state.setdefault("quote_cache", {})
    new_cache = {}
    eligible = {row.get("stock_code") for row in state["holdings"].values()
                if row.get("security_kind") in ("common", "preferred") and row.get("tracking") != "below-5-percent"
                and row.get("stock_code")}
    if not eligible:
        raise RuntimeError("no verified stock-class mappings for valuation")
    for code in sorted(eligible):
        key = f"{code}|KRX|regular|{expected}|raw"
        cached = cache.get(key)
        if cached and cached.get("verified") is True and cached.get("trade_date") == expected:
            quotes[code] = cached
            new_cache[key] = cached
            cache_hits += 1
            continue
        try:
            quotes[code] = client.quote(code)
            quote = quotes[code]
            new_cache[f"{code}|KRX|regular|{quote['trade_date']}|raw"] = quote
        except QuoteError as exc:
            failed[code] = str(exc)
    if eligible and not quotes:
        raise RuntimeError(f"all {len(eligible)} eligible quote codes failed on {expected}")
    if new_cache != cache:
        state["quote_cache"] = new_cache
        state["revision"] += 1
        write_json(state_path, state)
    snapshot = make_snapshot(state, quotes)
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
    except Exception as exc:
        print(json.dumps({"error": type(exc).__name__, "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
