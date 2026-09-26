#!/usr/bin/env python3
"""Bounded public DART document structure probe; never prints credential-bearing URLs."""
from __future__ import annotations

import hashlib
import html
import io
import json
import os
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.foliotrace.secondary import fetch_source_document

RECEIPTS = ("20060124800040", "20081007000289", "20030909000232",
            "20090227000244", "20260908000302", "20260623000336")
NPS = re.compile(r"국민연금(?:관리)?공단|National Pension Service", re.I)
TAG = re.compile(r"<[^>]*>", re.S)
ROWS = re.compile(r"<TR\b[^>]*>.*?</TR>", re.I | re.S)
CELLS = re.compile(r"<T[DEUH]\b[^>]*>(.*?)</T[DEUH]>", re.I | re.S)
ACODES = re.compile(r"<T[DEUH]\b[^>]*\bACODE=\"([^\"]+)\"", re.I | re.S)
DATES = re.compile(r"(?:19|20)\d{2}[.\-/년 ]+\d{1,2}(?:[.\-/월 ]+\d{1,2})?")
SENSITIVE = re.compile(r"https?://|crtfc_key|token|password|secret|@", re.I)


def clean(value: str, limit=100) -> str:
    text = " ".join(html.unescape(TAG.sub(" ", value)).split())
    return "[redacted]" if SENSITIVE.search(text) else text[:limit]


def inspect(receipt_no: str, payload: bytes) -> dict:
    result = {"receipt_no": receipt_no, "archive_sha256": hashlib.sha256(payload).hexdigest(), "files": []}
    try:
        archive = zipfile.ZipFile(io.BytesIO(payload))
    except zipfile.BadZipFile:
        return {**result, "archive_status": "not_zip"}
    for name in archive.namelist()[:50]:
        if not name.lower().endswith((".xml", ".html", ".htm")) or archive.getinfo(name).file_size > 20_000_000:
            continue
        raw = archive.read(name)
        decoded = None
        for codec in ("utf-8", "cp949", "euc-kr"):
            try:
                decoded = raw.decode(codec)
                break
            except UnicodeError:
                continue
        if decoded is None:
            continue
        rows = []
        basis_rows = []
        date_rows = []
        ownership_context_rows = []
        ownership_adjacent_rows = []
        if receipt_no in ("20060124800040", "20081007000289"):
            all_rows = list(ROWS.finditer(decoded))
            anchors = [index for index, match in enumerate(all_rows) if
                       (NPS.search(match.group(0)) or "발행주식총수" in match.group(0))]
            nearby = sorted({position for anchor in anchors for position in range(max(0, anchor - 2),
                            min(len(all_rows), anchor + 3))})[:40]
            for position in nearby:
                match = all_rows[position]
                ownership_adjacent_rows.append({
                    "row_offset": match.start(), "row_sha256": hashlib.sha256(match.group(0).encode()).hexdigest(),
                    "cells": [clean(cell, 80) for cell in CELLS.findall(match.group(0))[:16]]})
        for row in ROWS.finditer(decoded):
            source_row = row.group(0)
            if receipt_no in ("20060124800040", "20081007000289"):
                plain_row = clean(source_row, 600)
                if (re.search(r"발행\s*주식\s*총수|총발행\s*주식|소유\s*주식|보유\s*비율|주식\s*교환|주식\s*이전|기준일|이번보고서제출일|최대주주등", plain_row)
                        and len(ownership_context_rows) < 40):
                    ownership_context_rows.append({
                        "row_offset": row.start(), "row_sha256": hashlib.sha256(source_row.encode()).hexdigest(),
                        "cells": [clean(cell, 80) for cell in CELLS.findall(source_row)[:16]],
                        "preceding_heading": clean(decoded[max(0, row.start() - 350):row.start()], 180)})
            direct_basis_row = receipt_no in ("20090227000244", "20260908000302", "20260623000336") and re.search(
                r"이번보고서|직전보고서|증\s*감|보고서작성기준일", source_row)
            historical_date_row = receipt_no in ("20060124800040", "20081007000289") and re.search(
                r"2006년\s*02월\s*01일|2008년\s*9월\s*26일|2008년\s*9월\s*29일", source_row)
            if NPS.search(source_row) or direct_basis_row or historical_date_row:
                neighborhood = decoded[max(0, row.start() - 1500):min(len(decoded), row.end() + 300)]
                item = {"cells": [clean(cell, 80) for cell in CELLS.findall(source_row)[:20]],
                             "acodes": ACODES.findall(source_row)[:20],
                             "row_sha256": hashlib.sha256(source_row.encode()).hexdigest(),
                             "near_date_tokens": list(dict.fromkeys(DATES.findall(neighborhood)))[:12],
                             "preceding_context": clean(decoded[max(0, row.start() - 1800):row.start()], 650),
                             "following_context": clean(decoded[row.end():min(len(decoded), row.end() + 300)], 200),
                             "row_offset": row.start()}
                if NPS.search(source_row) and len(rows) < 12:
                    rows.append(item)
                if direct_basis_row and len(basis_rows) < 12:
                    basis_rows.append(item)
                if historical_date_row and len(date_rows) < 12:
                    date_rows.append(item)
            if len(rows) >= 12 and len(basis_rows) >= 12 and len(date_rows) >= 12:
                break
        if rows or NPS.search(decoded):
            dates = list(dict.fromkeys(DATES.findall(decoded)))[:20]
            result["files"].append({"xml_sha256": hashlib.sha256(raw).hexdigest(),
                                    "xml_bytes": len(raw), "nps_rows": rows,
                                    "basis_rows": basis_rows,
                                    "date_rows": date_rows,
                                    "ownership_context_rows": ownership_context_rows,
                                    "ownership_adjacent_rows": ownership_adjacent_rows,
                                    "nps_mentions": len(NPS.findall(decoded)),
                                    "date_tokens": [clean(item, 40) for item in dates]})
    result["archive_status"] = "parsed"
    return result


def main() -> int:
    key = os.environ.get("DART_API_KEY", "")
    if not key:
        print(json.dumps({"error": "DART_KEY_UNAVAILABLE"}), file=sys.stderr)
        return 1
    output = Path(sys.argv[1]) if len(sys.argv) == 2 else Path("source-structure-probe.json")
    observations = []
    for receipt_no in RECEIPTS:
        try:
            observations.append(inspect(receipt_no, fetch_source_document(receipt_no, key)))
        except (RuntimeError, ValueError, OSError):
            observations.append({"receipt_no": receipt_no, "archive_status": "request_unavailable"})
    output.write_text(json.dumps({"receipts": observations}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checked": len(observations), "statuses": [item["archive_status"] for item in observations]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
