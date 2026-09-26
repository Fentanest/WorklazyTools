"""Bounded DART full-text search for third-party NPS mentions.

Search hits are discovery facts, not NPS filings or holdings. Only complete,
validated date windows advance the separate cursor.
"""
from __future__ import annotations

import hashlib
import html
import http.client
import io
import math
import base64
import binascii
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import zlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from html.parser import HTMLParser
from pathlib import Path

TERMS = ("국민연금공단", "국민연금관리공단", "National Pension Service")
PAGE_SIZE = 10  # DART search.ax serves ten rows even when maxResults is larger.
MAX_SITE_PAGES = 100
METHOD = "dart-fulltext-v2-lossless-queue"
RECEIPT = re.compile(r"^\d{14}$")
DOCUMENT_KEY = re.compile(r"^\d{14}:\d+$")
STOCK_CONTEXT = re.compile(r"보통주|우선주|주주|보유|소유|지분|주식|주권|의결권|sharehold|stock|equity|voting", re.I)
REPORT_CONTEXT = re.compile(r"대량보유|의결권대리행사|주주명부|주식등의|sharehold", re.I)
SOURCE_PARSER_VERSION = "source-issued-shares-v5"
SOURCE_ROWS = re.compile(r"<TR\b[^>]*>.*?</TR>", re.I | re.S)
SOURCE_CELLS = re.compile(r"<T[DEUH]\b[^>]*>(.*?)</T[DEUH]>", re.I | re.S)
EXACT_NPS = re.compile(r"^(?:국민연금공단|국민연금관리공단|National Pension Service)$", re.I)


def _row_cells(raw: str) -> list[str]:
    return [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", cell)).split())
            for cell in SOURCE_CELLS.findall(raw)]


def _number(raw: str, maximum=None) -> str | None:
    value = raw.replace(",", "").strip()
    if not re.fullmatch(r"(?:0|[1-9]\d*)(?:\.\d+)?", value):
        return None
    try:
        number = Decimal(value)
    except InvalidOperation:
        return None
    if not number.is_finite() or number < 0 or (maximum is not None and number > maximum):
        return None
    return format(number, "f")


def extract_source_claims(xml: str) -> list[dict]:
    """Retain row-level numeric leads; no date, issuer, or ratio basis is inferred here."""
    claims = []
    for row in SOURCE_ROWS.finditer(xml):
        cells = _row_cells(row.group(0))
        positions = [index for index, cell in enumerate(cells) if EXACT_NPS.fullmatch(cell)]
        if len(positions) != 1:
            continue
        index = positions[0]
        candidate = None
        if (index + 3 < len(cells) and cells[index + 1] in ("보통주", "우선주")):
            candidate = (cells[index + 1], cells[index + 2], cells[index + 3], "explicit_stock_class_row")
        elif (index + 5 < len(cells) and cells[index + 3] == "본인"):
            candidate = (None, cells[index + 4], cells[index + 5], "owner_total_row")
        if candidate is None:
            continue
        security, quantity, ratio, structure = candidate
        normalized_quantity, normalized_ratio = _number(quantity), _number(ratio, maximum=100)
        if normalized_quantity is None or normalized_ratio is None:
            continue
        claims.append({"structure": structure, "security_kind": security,
                       "quantity": normalized_quantity, "ownership_percent": normalized_ratio,
                       "row_sha256": hashlib.sha256(row.group(0).encode()).hexdigest(),
                       "row_offset": row.start(), "basis_date": None,
                       "status": "source_context_review_pending"})
        if len(claims) >= 20:
            break
    return bind_change_section_basis(xml, claims)


def bind_change_section_basis(xml: str, claims: list[dict]) -> list[dict]:
    """Bind an NPS own-share row only when report, transaction, and total rows agree."""
    rows = [(match.start(), match.end(), _row_cells(match.group(0))) for match in SOURCE_ROWS.finditer(xml)]
    def korean_date(value):
        match = re.fullmatch(r"\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*", value)
        if not match:
            return None
        try:
            return date(*(int(part) for part in match.groups())).isoformat()
        except ValueError:
            return None
    reports = []
    for index, (start, _, cells) in enumerate(rows):
        if (len(cells) >= 5 and cells[0] == "이번보고서제출일" and cells[2] == "보통주" and
                _number(cells[3]) is not None and _number(cells[4], maximum=100) is not None):
            parsed = korean_date(cells[1])
            if parsed:
                reports.append((index, start, parsed, _number(cells[3]), _number(cells[4], maximum=100)))
    issued_candidates = []
    for index, (start, _, cells) in enumerate(rows[:-1]):
        if cells == ["보통주식총수(1)", "우선주식총수(2)", "발행주식총수(1+2)"]:
            following = rows[index + 1][2]
            if len(following) >= 3:
                amounts = [_number(value) for value in following[:3]]
                if all(amount is not None for amount in amounts):
                    common, preferred, total = map(Decimal, amounts)
                    if common + preferred == total and total > 0:
                        issued_candidates.append((start, common, preferred, total))
    for position, (row_index, start, basis, quantity, ratio) in enumerate(reports):
        next_start = reports[position + 1][1] if position + 1 < len(reports) else len(xml)
        section = xml[start:next_start]
        if "개인별세부변동사항" not in section or "최대주주등 주식소유현황" not in section:
            continue
        section_rows = rows[row_index + 1:reports[position + 1][0] if position + 1 < len(reports) else len(rows)]
        owner_rows = [cells for _, _, cells in section_rows if len(cells) >= 6 and EXACT_NPS.fullmatch(cells[0])
                      and cells[3] == "본인" and _number(cells[4]) == quantity
                      and _number(cells[5], maximum=100) == ratio]
        identity_rows = [cells for _, _, cells in section_rows if any(EXACT_NPS.fullmatch(cell) for cell in cells)
                         and "성명" in cells]
        changes = [cells for _, _, cells in section_rows if len(cells) >= 6 and
                   korean_date(cells[0]) == basis and cells[2] == "보통주" and
                   _number(cells[5]) == quantity]
        if len(owner_rows) != 1 or len(identity_rows) != 1 or len(changes) != 1:
            continue
        for claim in claims:
            if (claim["structure"] == "owner_total_row" and start < claim["row_offset"] < next_start and
                    claim["quantity"] == quantity and claim["ownership_percent"] == ratio):
                claim.update(basis_date=basis, security_kind="보통주",
                             status="actual_holding_basis_verified",
                             basis_evidence="matched_report_change_and_owner_total")
                preceding_issued = [entry for entry in issued_candidates if entry[0] < start]
                if len(preceding_issued) == 1:
                    _, common, preferred, total = preceding_issued[0]
                    displayed = Decimal(ratio)
                    scale = Decimal(1).scaleb(displayed.as_tuple().exponent)
                    if (preferred == 0 and Decimal(quantity) <= common and
                            (Decimal(quantity) / total * 100).quantize(scale, rounding=ROUND_HALF_UP) == displayed):
                        claim.update(ratio_denominator="issued_shares",
                                     denominator_quantity=format(total, "f"),
                                     denominator_date=None,
                                     denominator_evidence="same_document_issued_share_header_and_arithmetic")
    return claims


class SecondarySearchError(RuntimeError):
    def __init__(self, code: str, start: date, end: date, term_index: int | None = None,
                 page: int | None = None, required_pages: int | None = None):
        super().__init__(code)
        self.code, self.start, self.end = code, start.isoformat(), end.isoformat()
        self.term_index, self.page, self.required_pages = term_index, page, required_pages


def encode_noncandidate_keys(keys: list[str]) -> str:
    if keys != sorted(set(keys)) or any(not DOCUMENT_KEY.fullmatch(key) for key in keys):
        raise ValueError("NONCANDIDATE_KEYS")
    return base64.b64encode(zlib.compress("\n".join(keys).encode(), level=9)).decode("ascii")


def decode_noncandidate_keys(coverage: dict) -> list[str]:
    encoded = coverage.get("noncandidate_queue_zlib_b64")
    if not isinstance(encoded, str):
        raise ValueError("NONCANDIDATE_QUEUE_MISSING")
    try:
        packed = base64.b64decode(encoded, validate=True)
        inflater = zlib.decompressobj()
        raw = inflater.decompress(packed, 100_001)
        if not inflater.eof or inflater.unconsumed_tail or inflater.unused_data or len(raw) > 100_000:
            raise ValueError("NONCANDIDATE_QUEUE_SIZE")
        keys = raw.decode("ascii").splitlines() if raw else []
    except (ValueError, binascii.Error, zlib.error, UnicodeError) as exc:
        raise ValueError("NONCANDIDATE_QUEUE_INVALID") from exc
    if (keys != sorted(set(keys)) or any(not DOCUMENT_KEY.fullmatch(key) for key in keys)
            or len(keys) != coverage.get("noncandidate_documents")
            or hashlib.sha256("\n".join(keys).encode()).hexdigest() != coverage.get("noncandidate_key_digest")):
        raise ValueError("NONCANDIDATE_QUEUE_IDENTITY")
    return keys


class SearchRows(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = self.cell = self.anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.row = {"cells": [], "links": []}
        elif self.row is not None and tag in ("th", "td"):
            self.cell = {"kind": tag, "class": attrs.get("class", ""), "text": []}
        elif self.row is not None and tag == "a":
            self.anchor = {"class": attrs.get("class", ""), "href": attrs.get("href", ""), "text": []}

    def handle_data(self, data):
        if self.cell is not None:
            self.cell["text"].append(data)
        if self.anchor is not None:
            self.anchor["text"].append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor is not None:
            self.anchor["text"] = " ".join("".join(self.anchor["text"]).split())
            self.row["links"].append(self.anchor)
            self.anchor = None
        elif tag in ("td", "th") and self.cell is not None:
            self.cell["text"] = " ".join("".join(self.cell["text"]).split())
            self.row["cells"].append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row["links"]:
                self.rows.append(self.row)
            self.row = None


def parse_search_page(payload: bytes, expected_page: int, start: date, end: date):
    try:
        source = payload.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("ENCODING") from None
    count = re.search(r'<input\b[^>]*\bid="totalCnt"[^>]*\bvalue="([\d,]+)"', source)
    if not count:
        raise ValueError("COUNT_MISSING")
    total = int(count.group(1).replace(",", ""))
    if total < 0 or total > 1_000_000:
        raise ValueError("COUNT_INVALID")
    if total == 0:
        if expected_page != 1:
            raise ValueError("EMPTY_PAGE")
        parser = SearchRows()
        parser.feed(source)
        if parser.rows:
            raise ValueError("ROW_COUNT")
        return {"total": 0, "page_count": 0, "rows": [], "sha256": hashlib.sha256(payload).hexdigest()}
    page = re.search(r'<div\s+class="pageInfo">\s*\[(\d+)/(\d+)\]', source)
    if not page or int(page.group(1)) != expected_page:
        raise ValueError("PAGE_IDENTITY")
    page_count = int(page.group(2))
    if page_count != math.ceil(total / PAGE_SIZE):
        raise ValueError("PAGE_COUNT")
    parser = SearchRows()
    parser.feed(source)
    expected_rows = min(PAGE_SIZE, total - (expected_page - 1) * PAGE_SIZE)
    if len(parser.rows) != expected_rows:
        raise ValueError("ROW_COUNT")
    rows = []
    for raw in parser.rows:
        report_links = [link for link in raw["links"] if "rcpNo=" in link["href"]]
        if len(report_links) != 1:
            raise ValueError("REPORT_LINK")
        link = report_links[0]
        params = urllib.parse.parse_qs(urllib.parse.urlsplit(html.unescape(link["href"])).query)
        no = (params.get("rcpNo") or [""])[0]
        document_no = (params.get("dcmNo") or [""])[0]
        if not RECEIPT.fullmatch(no) or not document_no.isdigit():
            raise ValueError("REPORT_IDENTITY")
        date_cells = [cell["text"] for cell in raw["cells"] if "date" in cell["class"].split()]
        if len(date_cells) != 1:
            raise ValueError("ROW_DATE")
        try:
            filing_date = date.fromisoformat(date_cells[0].replace(".", "-"))
        except ValueError:
            raise ValueError("ROW_DATE") from None
        if not start <= filing_date <= end:
            raise ValueError("ROW_DATE_RANGE")
        company_links = [item for item in raw["links"] if "company" in item["class"].split()]
        if len(company_links) != 1:
            raise ValueError("COMPANY_IDENTITY")
        snippets = [cell["text"] for cell in raw["cells"] if cell["kind"] == "td" and "info" not in cell["class"] and "date" not in cell["class"]]
        if len(snippets) != 1:
            raise ValueError("SNIPPET_SHAPE")
        rows.append({"receipt_no": no, "document_no": document_no,
                     "filing_date": filing_date.isoformat(), "filing_company": company_links[0]["text"][:120],
                     "report_name": link["text"][:180], "snippet": snippets[0]})
    return {"total": total, "page_count": page_count, "rows": rows,
            "sha256": hashlib.sha256(payload).hexdigest()}


def fetch_search_page(term: str, start: date, end: date, page: int, *, dsp_type=None, retries=3):
    fields = {"option": "contents", "keyword": term, "startDate": start.strftime("%Y%m%d"),
              "endDate": end.strftime("%Y%m%d"), "currentPage": page,
              "maxResults": PAGE_SIZE, "maxLinks": 10, "selDate": 0, "autoSearch": "N"}
    if dsp_type:
        if dsp_type != "D":
            raise ValueError("SEARCH_SCOPE")
        fields["dspType"] = dsp_type
    request = urllib.request.Request("https://dart.fss.or.kr/dsab007/search.ax",
        data=urllib.parse.urlencode(fields).encode(),
        headers={"User-Agent": "FolioTrace/1.0", "Referer": "https://dart.fss.or.kr/dsab007/main.do?option=contents"})
    for attempt in range(retries):
        try:
            time.sleep(2)
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read(2_000_001)
            if len(payload) > 2_000_000:
                raise ValueError("RESPONSE_SIZE")
            return payload
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException):
            if attempt + 1 == retries:
                raise RuntimeError("SEARCH_TRANSPORT") from None
            time.sleep(attempt + 1)


def fetch_source_document(receipt_no: str, key: str, *, retries=3):
    if not RECEIPT.fullmatch(receipt_no) or not key:
        raise ValueError("DOCUMENT_INPUT")
    query = urllib.parse.urlencode({"crtfc_key": key, "rcept_no": receipt_no})
    url = f"https://opendart.fss.or.kr/api/document.xml?{query}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "FolioTrace/1.0"}), timeout=30) as response:
                payload = response.read(20_000_001)
            if len(payload) > 20_000_000:
                raise ValueError("DOCUMENT_SIZE")
            return payload
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException):
            if attempt + 1 == retries:
                raise RuntimeError("DOCUMENT_TRANSPORT") from None
            time.sleep(attempt + 1)


def inspect_source_document(payload: bytes):
    """Record only whether the source contains an NPS mention near equity terms."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(payload))
    except zipfile.BadZipFile:
        return {"status": "source_review_pending", "source_sha256": None,
                "parser_version": SOURCE_PARSER_VERSION}
    contexts = 0
    mentions = 0
    digests = []
    claims = []
    archive_sha256 = hashlib.sha256(payload).hexdigest()
    for name in archive.namelist():
        if (not name.lower().endswith(".xml") or name.startswith("/") or ".." in Path(name).parts
                or archive.getinfo(name).file_size > 20_000_000):
            continue
        raw = archive.read(name)
        digests.append(hashlib.sha256(raw).hexdigest())
        decoded = None
        for encoding in ("utf-8", "cp949"):
            try:
                decoded = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if decoded is None:
            continue
        file_claims = extract_source_claims(decoded)[:max(0, 20 - len(claims))]
        for claim in file_claims:
            claim["source_file_sha256"] = hashlib.sha256(raw).hexdigest()
        claims.extend(file_claims)
        plain = html.unescape(re.sub(r"<[^>]+>", " ", decoded))
        plain = " ".join(plain.split())
        for term in TERMS:
            for match in re.finditer(re.escape(term), plain, re.I):
                mentions += 1
                if STOCK_CONTEXT.search(plain[max(0, match.start() - 240):match.end() + 240]):
                    contexts += 1
    if not digests:
        return {"status": "source_review_pending", "source_sha256": None,
                "parser_version": SOURCE_PARSER_VERSION}
    return {"status": "source_context_review_pending" if contexts else
            "source_mention_no_equity_context" if mentions else "source_mention_unverified",
            "source_sha256": hashlib.sha256("".join(digests).encode()).hexdigest(),
            "source_archive_sha256": archive_sha256,
            "parser_version": SOURCE_PARSER_VERSION,
            "source_claims": claims,
            "source_mention_count": mentions, "equity_context_count": contexts}


def retain_verified_historical_claims(state: dict, candidate: dict) -> int:
    """Retain source-proven dated facts separately from current portfolio holdings."""
    facts = state.setdefault("verified_historical_observations", {})
    issuer_name = candidate.get("filing_company")
    matches = [(corp, company) for corp, company in state.get("universe", {}).items()
               if company.get("name") == issuer_name and company.get("stock_code")]
    created = 0
    for claim in candidate.get("source_claims") or []:
        if claim.get("status") != "actual_holding_basis_verified":
            candidate["application_status"] = "basis_or_owner_unverified"
            continue
        if not candidate.get("source_archive_sha256") or not claim.get("source_file_sha256"):
            candidate["application_status"] = "source_provenance_pending"
            continue
        if len(matches) != 1:
            candidate["application_status"] = "issuer_identity_unverified"
            continue
        corp, company = matches[0]
        key = (f'{candidate["receipt_no"]}:{candidate["document_no"]}:{corp}:'
               f'{company["stock_code"]}:{claim["basis_date"]}:{claim["row_sha256"]}')
        fact = {"source_receipt_no": candidate["receipt_no"],
                "source_document_no": candidate["document_no"],
                "source_filing_date": candidate["filing_date"],
                "source_archive_sha256": candidate["source_archive_sha256"],
                "source_file_sha256": claim["source_file_sha256"],
                "source_row_sha256": claim["row_sha256"],
                "source_row_offset": claim["row_offset"],
                "parser_version": candidate["parser_version"],
                "corp_code": corp, "stock_code": company["stock_code"],
                "issuer_name": issuer_name, "security_kind": "common",
                "holder_scope": "nps_only", "ratio_denominator": claim.get("ratio_denominator") or "unverified",
                "denominator_quantity": claim.get("denominator_quantity"),
                "denominator_date": claim.get("denominator_date"),
                "denominator_evidence": claim.get("denominator_evidence"),
                "basis_date": claim["basis_date"], "basis_evidence": claim["basis_evidence"],
                "quantity": claim["quantity"], "ownership_percent": claim["ownership_percent"],
                "observation_status": ("historical_only_denominator_date_unverified"
                    if claim.get("ratio_denominator") == "issued_shares" else
                    "historical_only_ratio_basis_unverified")}
        if facts.get(key) is None:
            facts[key] = fact
            created += 1
        elif facts[key] != fact:
            prior = facts[key]
            core = ("source_receipt_no", "source_document_no", "source_filing_date", "source_archive_sha256",
                    "source_file_sha256", "source_row_sha256", "corp_code", "stock_code", "security_kind",
                    "holder_scope", "basis_date", "quantity", "ownership_percent")
            if (all(prior.get(field) == fact.get(field) for field in core) and
                    prior.get("ratio_denominator") == "unverified" and
                    fact["ratio_denominator"] == "issued_shares"):
                facts[key] = fact
                candidate["application_status"] = "historical_fact_enriched"
                created += 1
            else:
                candidate["application_status"] = "historical_fact_conflict"
                continue
        if candidate.get("application_status") != "historical_fact_enriched":
            candidate["application_status"] = "historical_fact_retained"
    return created


def needs_source_provenance(candidate: dict) -> bool:
    return any(claim.get("status") == "actual_holding_basis_verified" and
               (not candidate.get("source_archive_sha256") or not claim.get("source_file_sha256"))
               for claim in candidate.get("source_claims") or [])


def scan_secondary(state_path: Path, start: date, end: date, *, max_pages=300, max_windows=20,
                   fetch=fetch_search_page, read_state=None, write_state=None,
                   key="", review_limit=0, fetch_document=fetch_source_document,
                   scope="all", source_only=False, source_receipt=None):
    if read_state is None or write_state is None:
        raise ValueError("state IO required")
    if start > end or max_pages < 1 or max_windows < 1 or not 0 <= review_limit <= 100:
        raise ValueError("invalid secondary search bounds")
    if review_limit and not key:
        raise ValueError("DART_API_KEY unavailable")
    if scope not in ("all", "equity", "prior-all", "prior-equity"):
        raise ValueError("invalid secondary scope")
    if source_receipt is not None and (not source_only or not RECEIPT.fullmatch(source_receipt)):
        raise ValueError("invalid source receipt selection")
    ledger_key = {"all": "secondary_backfill", "equity": "secondary_equity_backfill",
                  "prior-all": "secondary_prior_backfill",
                  "prior-equity": "secondary_prior_equity_backfill"}[scope]
    method = METHOD + ("-equity" if scope.endswith("equity") else "")
    if fetch is fetch_search_page and scope.endswith("equity"):
        fetch = lambda term, first, last, page: fetch_search_page(term, first, last, page, dsp_type="D")
    state = read_state(state_path)
    ledger = state.get(ledger_key)
    if ledger is None:
        ledger = {"method": method, "start_date": start.isoformat(), "target_date": end.isoformat(),
                  "next_date": start.isoformat(), "coverage": [], "candidates": {}}
        state[ledger_key] = ledger
    elif (ledger.get("method") != method or ledger.get("start_date") != start.isoformat()
          or end < date.fromisoformat(ledger["target_date"])):
        raise ValueError("secondary search range conflicts with persisted cursor")
    else:
        ledger["target_date"] = end.isoformat()
    cursor = date.fromisoformat(ledger["next_date"])
    if not start <= cursor <= end + timedelta(days=1):
        raise ValueError("secondary search cursor inconsistent")
    pages_used = windows = new_candidates = 0
    required_pages = None
    while not source_only and cursor <= end and windows < max_windows and pages_used < max_pages:
        last = min(cursor + timedelta(days=int(ledger.get("max_window_days") or 7) - 1), end)
        parsed_terms = []
        while True:
            parsed_terms = []
            projected_pages = 0
            too_large = False
            for term_index, term in enumerate(TERMS):
                try:
                    first = parse_search_page(fetch(term, cursor, last, 1), 1, cursor, last)
                except (ValueError, RuntimeError) as exc:
                    code = str(exc) if str(exc) in ("SEARCH_TRANSPORT", "RESPONSE_SIZE", "ENCODING", "COUNT_MISSING", "COUNT_INVALID", "EMPTY_PAGE", "PAGE_IDENTITY", "PAGE_COUNT", "ROW_COUNT", "REPORT_LINK", "REPORT_IDENTITY", "ROW_DATE", "ROW_DATE_RANGE", "COMPANY_IDENTITY", "SNIPPET_SHAPE") else "SEARCH_UNEXPECTED"
                    raise SecondarySearchError(code, cursor, last, term_index, 1) from None
                pages_used += 1
                parsed_terms.append((term, first))
                projected_pages += max(1, first["page_count"])
                if first["page_count"] > MAX_SITE_PAGES or projected_pages > max_pages:
                    too_large = True
                    break
            if too_large:
                if last == cursor:
                    required_pages = projected_pages
                    break
                last = cursor + timedelta(days=(last - cursor).days // 2)
                ledger["max_window_days"] = (last - cursor).days + 1
                state["revision"] += 1
                write_state(state_path, state)
                if pages_used >= max_pages:
                    parsed_terms = []
                    break
                continue
            if pages_used + projected_pages - len(parsed_terms) > max_pages:
                parsed_terms = []
                break
            break
        if required_pages is not None or not parsed_terms or len(parsed_terms) != len(TERMS):
            break
        all_rows = []
        page_digests = []
        term_counts = {}
        for term_index, (term, first) in enumerate(parsed_terms):
            term_counts[term] = first["total"]
            all_rows.extend((term, row) for row in first["rows"])
            page_digests.append(first["sha256"])
            seen_page_ids = {(row["receipt_no"], row["document_no"]) for row in first["rows"]}
            if len(seen_page_ids) != len(first["rows"]):
                raise SecondarySearchError("PAGINATION_REPEAT", cursor, last, term_index, 1)
            for page_number in range(2, first["page_count"] + 1):
                try:
                    page = parse_search_page(fetch(term, cursor, last, page_number), page_number, cursor, last)
                except (ValueError, RuntimeError) as exc:
                    code = str(exc) if str(exc) in ("SEARCH_TRANSPORT", "RESPONSE_SIZE", "ENCODING", "COUNT_MISSING", "COUNT_INVALID", "EMPTY_PAGE", "PAGE_IDENTITY", "PAGE_COUNT", "ROW_COUNT", "REPORT_LINK", "REPORT_IDENTITY", "ROW_DATE", "ROW_DATE_RANGE", "COMPANY_IDENTITY", "SNIPPET_SHAPE") else "SEARCH_UNEXPECTED"
                    raise SecondarySearchError(code, cursor, last, term_index, page_number) from None
                pages_used += 1
                if page["total"] != first["total"] or page["page_count"] != first["page_count"]:
                    raise SecondarySearchError("PAGINATION_CHANGED", cursor, last, term_index, page_number)
                page_ids = {(row["receipt_no"], row["document_no"]) for row in page["rows"]}
                if len(page_ids) != len(page["rows"]) or page_ids & seen_page_ids:
                    raise SecondarySearchError("PAGINATION_REPEAT", cursor, last, term_index, page_number)
                seen_page_ids.update(page_ids)
                all_rows.extend((term, row) for row in page["rows"])
                page_digests.append(page["sha256"])
        candidates = ledger["candidates"]
        unique_hits = {}
        term_candidate_counts = {term: 0 for term in TERMS}
        for term, row in all_rows:
            no = row["receipt_no"]
            document_key = f'{no}:{row["document_no"]}'
            prior = unique_hits.get(document_key)
            if prior and prior["filing_date"] != row["filing_date"]:
                raise SecondarySearchError("RECEIPT_CONFLICT", cursor, last)
            unique_hits[document_key] = row
            if STOCK_CONTEXT.search(row["snippet"]) or REPORT_CONTEXT.search(row["report_name"]):
                term_candidate_counts[term] += 1
                item = candidates.get(document_key)
                if item is None:
                    item = {"receipt_no": no, "document_no": row["document_no"],
                            "filing_date": row["filing_date"], "filing_company": row["filing_company"],
                            "report_name": row["report_name"], "search_terms": [],
                            "review_status": "source_review_pending",
                            "search_context_sha256": hashlib.sha256(row["snippet"].encode()).hexdigest()}
                    candidates[document_key] = item
                    new_candidates += 1
                if term not in item["search_terms"]:
                    item["search_terms"].append(term)
        noncandidate_keys = sorted(key for key in unique_hits if key not in candidates)
        ledger["coverage"].append({"from": cursor.isoformat(), "to": last.isoformat(),
            "checked_at": datetime.now(timezone.utc).isoformat(), "method": method,
            "pages": len(page_digests), "term_hits": term_counts,
            "unique_documents": len(unique_hits), "candidate_documents": sum(key in candidates for key in unique_hits),
            "term_candidate_hits": term_candidate_counts,
            "noncandidate_documents": len(noncandidate_keys),
            "noncandidate_sample": noncandidate_keys[:10],
            "noncandidate_key_digest": hashlib.sha256("\n".join(noncandidate_keys).encode()).hexdigest(),
            "noncandidate_queue_zlib_b64": encode_noncandidate_keys(noncandidate_keys),
            "page_digest": hashlib.sha256("".join(page_digests).encode()).hexdigest(), "complete": True})
        cursor = last + timedelta(days=1)
        ledger["next_date"] = cursor.isoformat()
        ledger["max_window_days"] = min(7, (last - date.fromisoformat(ledger["coverage"][-1]["from"])).days * 2 + 2)
        state["revision"] += 1
        write_state(state_path, state)
        windows += 1
    reviewed = context_candidates = source_requests = noncandidate_reviewed = retained = 0
    if review_limit:
        today = datetime.now(timezone.utc).date().isoformat()
        cache = state.setdefault("secondary_source_cache", {})
        for document_key, item in ledger["candidates"].items():
            if source_receipt and not document_key.startswith(source_receipt + ":"):
                continue
            if (item.get("parser_version") == SOURCE_PARSER_VERSION and
                    item.get("source_archive_sha256") and
                    any(claim.get("status") == "actual_holding_basis_verified" for claim in item.get("source_claims") or [])):
                retained += retain_verified_historical_claims(state, item)
        def check_source(receipt_no):
            nonlocal source_requests
            check = cache.get(receipt_no)
            if (check is None or check.get("parser_version") != SOURCE_PARSER_VERSION or needs_source_provenance(check)
                    or check.get("status") in ("source_review_pending", "source_unavailable")):
                source_requests += 1
                try:
                    check = inspect_source_document(fetch_document(receipt_no, key))
                except (ValueError, RuntimeError, zipfile.BadZipFile):
                    check = {"status": "source_review_pending", "parser_version": SOURCE_PARSER_VERSION}
                if check["status"] != "source_review_pending":
                    cache[receipt_no] = check
            return check
        noncandidate_reviews = ledger.setdefault("noncandidate_reviews", {})
        queue_dates = {}
        for window in ledger["coverage"]:
            for document_key in decode_noncandidate_keys(window):
                queue_dates.setdefault(document_key, window["from"])
        pending = []
        for document_key, item in ledger["candidates"].items():
            if source_receipt and not document_key.startswith(source_receipt + ":"):
                continue
            provenance_upgrade = needs_source_provenance(item)
            if ((item.get("review_status") == "source_review_pending" or
                 item.get("parser_version") != SOURCE_PARSER_VERSION or provenance_upgrade) and
                    (item.get("last_source_attempt_on") != today or
                     item.get("parser_version") != SOURCE_PARSER_VERSION or
                     (provenance_upgrade and item.get("provenance_last_attempt_on") != today))):
                pending.append((int(item.get("source_attempt_count") or 0),
                                item["filing_date"], 0, document_key, item))
        for document_key in queue_dates.keys() - ledger["candidates"].keys():
            if source_receipt and not document_key.startswith(source_receipt + ":"):
                continue
            previous = noncandidate_reviews.get(document_key, {})
            if ((previous.get("review_status") in (None, "source_review_pending") or
                 previous.get("parser_version") != SOURCE_PARSER_VERSION) and
                    (previous.get("last_source_attempt_on") != today or
                     previous.get("parser_version") != SOURCE_PARSER_VERSION)):
                pending.append((int(previous.get("source_attempt_count") or 0),
                                queue_dates[document_key], 1, document_key, previous))
        for _, _, priority, document_key, item in sorted(pending):
            if reviewed >= review_limit:
                break
            receipt_no = document_key.split(":", 1)[0]
            check = check_source(receipt_no)
            if priority == 0:
                item["source_attempt_count"] = int(item.get("source_attempt_count") or 0) + 1
                item["last_source_attempt_on"] = today
                if needs_source_provenance(item):
                    item["provenance_last_attempt_on"] = today
                item.update(check)
                item["review_status"] = check["status"]
                retained += retain_verified_historical_claims(state, item)
            else:
                noncandidate_reviews[document_key] = {
                    "review_status": check["status"],
                    "last_source_attempt_on": today,
                    "source_attempt_count": int(item.get("source_attempt_count") or 0) + 1,
                    "source_sha256": check.get("source_sha256"),
                    "parser_version": check.get("parser_version"),
                }
                noncandidate_reviewed += 1
            reviewed += 1
            context_candidates += int(check["status"] == "source_context_review_pending")
            if reviewed % 10 == 0:
                state["revision"] += 1
                write_state(state_path, state)
        if reviewed % 10 or (retained and reviewed == 0):
            state["revision"] += 1
            write_state(state_path, state)
    return {"status": "SOURCE_REVIEW_COMPLETE" if source_only else
            "SEARCH_BUDGET_INSUFFICIENT" if required_pages is not None else
            "SEARCH_COMPLETE" if cursor > end else "SEARCH_IN_PROGRESS",
            "next_date": ledger["next_date"], "target_date": ledger["target_date"],
            "completed_windows": len(ledger["coverage"]), "windows_this_run": windows,
            "search_requests": pages_used, "new_candidates": new_candidates,
            "candidate_count": len(ledger["candidates"]), "required_pages": required_pages,
            "source_review_attempts": reviewed, "source_document_requests": source_requests,
            "historical_facts_retained": retained,
            "source_context_candidates": context_candidates,
            "noncandidate_review_attempts": noncandidate_reviewed}
