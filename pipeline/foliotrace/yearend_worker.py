"""Offline citation-followup worker for year-end reconciliation.

Connects the pieces the first implementation left separate::

    stored archive input
    -> verified ZIP / inner-file read
    -> table / row / column / note layout with source positions
    -> candidate from structured extraction or a stored model response
    -> candidate-vs-original evidence check
    -> follow-up request or verifiable evidence candidate
    -> comparison regeneration
    -> state + result files saved

No network is used on any path.  Archive bytes come only from the supplied
archive directory; a ``fetch_document`` hook exists solely so tests can arm
a raising stub and prove it is never called.  Nothing is written to
``indirect_observations``; verified evidence candidates are emitted as
separate result files that isolated tests may check against
``register_evidence`` without loosening its validation.

Worker-local filing XML convention (offline follow-up docs only; free-form
DART prose keeps going through stored model responses whose accuracy stays
unmeasured):

.. code-block:: xml

    <filing filing-date="2026-03-18">
      <filing-meta document-target="KT&G" filer="KT&G"
                   obligation-date="2026-03-10" writing-date="2026-03-12"/>
      <holder-table title="주식 소유 현황">
        <holder-row holder="First Eagle" security="보통주"
                    quantity="9,778,216" ratio="8.29" note="'20.03.02 공시기준"/>
      </holder-table>
      <register-note date="2025-12-31" role="shareholder_register_date"
                     applies-to-row="0" applies-to-field="quantity"/>
    </filing>
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import zipfile
from io import BytesIO
from datetime import date
from decimal import Decimal
import html
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from xml.etree import ElementTree as ET

from pipeline.foliotrace import yearend


REQUIRED_EVIDENCE_FIELDS = ("holder", "equity_target", "security_kind",
                            "holder_scope", "quantity", "dates")


def _text(element: Optional[ET.Element]) -> str:
    return "".join(element.itertext()) if element is not None else ""


def extract_holder_table(xml_text: str, archive_sha256: str,
                         inner_file_name: str, inner_file_sha256: str) -> Dict[str, Any]:
    """Parse worker-convention tables preserving row positions and notes.

    Returns meta dates, per-row records (holder, security, normalized
    quantity/ratio, note text, note scope, row offset) and document-target
    identity.  Raises ``YEAREND_WORKER_XML`` on malformed input instead of
    guessing.
    """
    # DART documents do not use this explicit worker fixture schema. Avoid a
    # second full-document XML parse on that path.
    if "<filing-meta" not in xml_text:
        raise ValueError("YEAREND_WORKER_META_MISSING")
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        raise ValueError("YEAREND_WORKER_XML") from None
    meta = root.find("filing-meta")
    if meta is None:
        raise ValueError("YEAREND_WORKER_META_MISSING")
    document_target = (meta.get("document-target") or "").strip()
    if not document_target:
        raise ValueError("YEAREND_WORKER_TARGET_MISSING")
    dates = {
        "filing_date": (root.get("filing-date") or "").strip() or None,
        "obligation_date": (meta.get("obligation-date") or "").strip() or None,
        "writing_date": (meta.get("writing-date") or "").strip() or None,
    }
    rows: List[Dict[str, Any]] = []
    for table in root.findall("holder-table"):
        title = (table.get("title") or "").strip()
        for index, item in enumerate(table.findall("holder-row")):
            holder = (item.get("holder") or "").strip()
            if not holder:
                raise ValueError("YEAREND_WORKER_HOLDER_MISSING")
            try:
                quantity = yearend.normalize_number(item.get("quantity") or "", field="quantity")
            except ValueError as exc:
                if str(exc) == "YEAREND_NUMERIC_MISSING":
                    quantity = None
                else:
                    raise
            ratio = item.get("ratio")
            if ratio is not None and str(ratio).strip() != "":
                ratio = yearend.normalize_number(ratio, field="ratio")
            else:
                ratio = None
            note = (item.get("note") or "").strip() or None
            scope = (item.get("note-applies-to") or "quantity").strip()
            rows.append({
                "table_title": title,
                "row_index": len(rows),
                "holder": holder,
                "security_kind": (item.get("security") or "").strip() or None,
                "quantity": quantity,
                "quantity_raw": item.get("quantity"),
                "ownership_percent": ratio,
                "note_text": note,
                "note_applies_to_fields": [part.strip() for part in scope.split(",") if part.strip()],
                "row_offset": len(rows),
                "holder_scope": (item.get("holder-scope") or "single_holder"),
            })
    row_matches = list(re.finditer(r"<holder-row\b[^>]*(?:/>|>.*?</holder-row>)", xml_text, re.S))
    for row, match in zip(rows, row_matches):
        row["source_span"] = _span(xml_text, match.start(), match.end(), "holder_row")
    notes = []
    for item in root.findall("register-note"):
        notes.append({
            "date": (item.get("date") or "").strip() or None,
            "role": (item.get("role") or "").strip() or None,
            "applies_to_row": item.get("applies-to-row"),
            "applies_to_field": item.get("applies-to-field"),
            "note": (item.get("note") or "").strip() or None,
        })
    return {
        "document_target": document_target,
        "filer": (meta.get("filer") or "").strip() or None,
        "dates": dates,
        "rows": rows,
        "register_notes": notes,
        "provenance": {"archive_sha256": archive_sha256,
                       "inner_file_name": inner_file_name,
                       "inner_file_sha256": inner_file_sha256},
    }


def candidate_from_row(layout: Dict[str, Any], row_index: int, *,
                       holder_scope: str = "single_holder",
                       equity_target: Optional[str] = None,
                       date_bindings: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Build a candidate strictly from one parsed row (no cross-row spread)."""
    try:
        row = layout["rows"][row_index]
    except IndexError:
        raise ValueError("YEAREND_WORKER_ROW_RANGE") from None
    return {
        "holder_name": row["holder"],
        "equity_target_corp": equity_target or layout["document_target"],
        "document_target_corp": layout["document_target"],
        "security_kind": row["security_kind"],
        "holder_aggregation_scope": holder_scope,
        "quantity": row["quantity"],
        "ownership_percent": row["ownership_percent"],
        "note_text": row["note_text"],
        "applies_to_fields": list(row["note_applies_to_fields"]),
        "applies_to_row": row_index,
        "date_clues": copy.deepcopy(date_bindings or []),
        "source_row_offset": row["row_offset"],
        "is_nps_claim": row["holder"] in ("국민연금공단", "국민연금기금", "National Pension Service"),
    }


def verify_candidate(layout: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    """Check every candidate field against the parsed original.

    A claim of ``is_nps_claim`` or the mere presence of fields never counts
    as verification; each field must be found in the original with its
    position recorded.  Note scope is bound to the cited row only.  Dates keep
    their roles and unresolved dates block verification instead of being
    collapsed into one ``basis_date``.
    """
    checks: Dict[str, Dict[str, Any]] = {}
    rows = layout["rows"]

    def row_text(index: int) -> str:
        row = rows[index]
        return " ".join(part for part in (
            row["holder"], row["security_kind"] or "", str(row["quantity_raw"] or ""),
            str(row["ownership_percent"] or ""), row["note_text"] or "") if part)

    holder_rows = [i for i, row in enumerate(rows) if row["holder"] == candidate.get("holder_name")]
    checks["holder"] = {"verified": bool(holder_rows),
                        "row_refs": holder_rows,
                        "reason": "" if holder_rows else "holder_not_in_original"}
    target = candidate.get("equity_target_corp")
    checks["equity_target"] = {"verified": bool(target) and target == layout["document_target"],
                               "reason": "issuer_identity_not_bound"}
    cited_row = candidate.get("applies_to_row")
    scope_rows = holder_rows if cited_row is None else [cited_row] if cited_row in holder_rows else []
    if candidate.get("security_kind") is not None:
        checks["security_kind"] = {
            "verified": any(canonical_security(rows[i]["security_kind"]) == canonical_security(candidate["security_kind"]) for i in scope_rows),
            "row_refs": [i for i in scope_rows if canonical_security(rows[i]["security_kind"]) == canonical_security(candidate["security_kind"])],
            "reason": "" if any(canonical_security(rows[i]["security_kind"]) == canonical_security(candidate["security_kind"]) for i in scope_rows)
            else "security_kind_not_on_holder_row"}
    else:
        checks["security_kind"] = {"verified": False, "row_refs": [],
                                   "reason": "security_kind_missing"}
    if candidate.get("quantity") is not None:
        try:
            wanted = yearend.normalize_number(candidate["quantity"], field="quantity")
        except ValueError:
            wanted = None
        hits = [i for i in scope_rows if yearend._equal_numeric(rows[i]["quantity"], wanted) is True] if wanted else []
        checks["quantity"] = {"verified": bool(hits), "row_refs": hits,
                              "reason": "" if hits else "quantity_not_on_holder_row"}
    else:
        checks["quantity"] = {"verified": False, "row_refs": [], "reason": "quantity_missing"}
    if candidate.get("ownership_percent") is not None:
        try:
            wanted_ratio = yearend.normalize_number(candidate["ownership_percent"], field="ratio")
        except ValueError:
            wanted_ratio = None
        ratio_hits = [i for i in scope_rows if yearend._equal_numeric(rows[i]["ownership_percent"], wanted_ratio) is True]
        same_row = any(i in checks["quantity"].get("row_refs", []) for i in ratio_hits)
        checks["ownership_percent"] = {
            "verified": bool(ratio_hits) and (same_row or not checks["quantity"]["verified"]),
            "row_refs": ratio_hits,
            "reason": "" if ratio_hits else "ratio_not_on_holder_row"}
    else:
        checks["ownership_percent"] = {"verified": True, "row_refs": [],
                                       "reason": "ratio_not_claimed_optional"}
    # All numeric fields must describe ONE located row, never separate rows.
    joint = [i for i in scope_rows
             if canonical_security(rows[i]["security_kind"]) == canonical_security(candidate.get("security_kind"))
             and yearend._equal_numeric(rows[i]["quantity"], candidate.get("quantity")) is True
             and (candidate.get("ownership_percent") is None or
                  yearend._equal_numeric(rows[i]["ownership_percent"], candidate.get("ownership_percent")) is True)]
    checks["association"] = {"verified": len(joint) == 1, "row_refs": joint,
                              "reason": "single_holder_security_quantity_row_required"}
    checks["holder_scope"] = {"verified": len(joint) == 1 and
        candidate.get("holder_aggregation_scope") == rows[joint[0]].get("holder_scope", "single_holder") == "single_holder",
        "row_refs": joint, "reason": "aggregation_scope_unverified"}
    checks["owner_identity"] = {"verified": candidate.get("holder_name") in NPS_NAMES,
                                "row_refs": joint, "reason": "owner_not_nps"}
    note = candidate.get("note_text")
    checks["note_scope"] = {"verified": len(joint) == 1 and
        note == rows[joint[0]]["note_text"] and
        list(candidate.get("applies_to_fields") or []) == rows[joint[0]]["note_applies_to_fields"],
        "row_refs": joint, "reason": "note_or_field_scope_not_bound"}
    date_results = []
    meta_roles = {"filing_date": "filing_date", "receipt_date": "filing_date",
                  "obligation_date": "obligation_date", "writing_basis_date": "writing_date"}
    for clue in candidate.get("date_clues") or []:
        text, role = clue.get("text"), clue.get("role")
        row_ref = clue.get("applies_to_row", joint[0] if len(joint) == 1 else None)
        field = clue.get("applies_to_field", "quantity")
        matched = []
        if role in meta_roles and text == layout["dates"].get(meta_roles[role]):
            matched = [{"applies_to_field": "document_metadata", "applies_to_row": None}]
        else:
            matched = [n for n in layout.get("register_notes", []) if n.get("date") == text
                       and n.get("role") == role and str(n.get("applies_to_row")) == str(row_ref)
                       and n.get("applies_to_field") == field and row_ref in joint]
        valid = valid_date(text) and role in yearend.CITATION_DATE_ROLES and bool(matched)
        date_results.append({"text": text, "role": role, "verified": valid,
                             "ambiguous": bool(clue.get("ambiguous")),
                             "applies_to_row": matched[0]["applies_to_row"] if matched else row_ref,
                             "applies_to_field": matched[0]["applies_to_field"] if matched else field})
    checks["dates"] = {"verified": bool(date_results) and all(b["verified"] for b in date_results),
                       "bindings": date_results, "reason": "date_role_or_scope_unverified"}
    failed = [name for name, item in checks.items() if not item["verified"]]
    spans = [rows[i]["source_span"] for i in joint if rows[i].get("source_span")]
    return {"verified": not failed, "checks": checks, "failed": failed, "text_spans": spans}


NPS_NAMES = frozenset({"국민연금공단", "국민연금관리공단", "국민연금기금", "National Pension Service"})


def canonical_security(value):
    return {"보통주": "common", "우선주": "preferred"}.get(value, value)


def valid_date(value):
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def holding_basis(evidence):
    bindings = [b for b in evidence.get("date_bindings", []) if b.get("verified") and not b.get("ambiguous")
                and b.get("role") in ("shareholder_register_date", "writing_basis_date")
                and b.get("applies_to_field") == "quantity"]
    if len({b["text"] for b in bindings}) == 1:
        return bindings[0]
    return None


def build_register_evidence_fact(candidate: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Convert only source-proven facts; context supplies IDs, never holding proof."""
    check = candidate.get("verification") or {}
    if not check.get("verified"):
        raise ValueError("YEAREND_EVIDENCE_INCOMPLETE")
    required_checks = ("owner_identity", "holder_scope", "association", "equity_target", "dates", "quantity")
    if (candidate.get("holder") not in NPS_NAMES or
            any(not check.get("checks", {}).get(k, {}).get("verified") for k in required_checks)):
        raise ValueError("YEAREND_EVIDENCE_OWNER_OR_PROOF")
    basis = holding_basis(candidate)
    if basis is None or ctx.get("basis_date") != basis["text"]:
        raise ValueError("YEAREND_EVIDENCE_BASIS")
    if (candidate.get("holder_scope") != "single_holder" or
            candidate.get("source_status") != "actual_holding_basis_verified" or
            not candidate.get("basis_evidence")):
        raise ValueError("YEAREND_EVIDENCE_SCOPE_UNMAPPABLE")
    if (candidate.get("ratio_denominator") != "issued_shares" or
            not candidate.get("denominator_evidence") or not candidate.get("denominator_quantity") or
            candidate.get("denominator_date") != basis["text"]):
        raise ValueError("YEAREND_EVIDENCE_DENOMINATOR")
    required_ctx = ("corp_code", "stock_code", "filer_corp_code", "source_filing_date",
                    "source_receipt_no", "source_document_sha256", "issuer_identity_sha256", "verified_at", "source_status")
    if any(ctx.get(k) in (None, "") for k in required_ctx):
        raise ValueError("YEAREND_EVIDENCE_CTX_INCOMPLETE")
    if ctx["source_status"] != "no_known_correction_or_withdrawal":
        raise ValueError("YEAREND_EVIDENCE_SOURCE_STATUS")
    provenance = candidate.get("provenance") or {}
    if ctx["source_receipt_no"] != provenance.get("receipt_no"):
        raise ValueError("YEAREND_EVIDENCE_SOURCE_MISMATCH")
    identity = candidate.get("subject_identity") or {}
    ticker_binding = identity.get("ticker_binding") or {}
    if (not identity.get("corp_code") or not identity.get("stock_code") or
            ticker_binding.get("verified") is not True or
            ticker_binding.get("corp_code") != identity.get("corp_code") or
            ticker_binding.get("stock_code") != identity.get("stock_code") or
            not ticker_binding.get("mapping_sha256") or not ticker_binding.get("mapping_path") or
            ctx["corp_code"] != identity["corp_code"] or
            ctx["filer_corp_code"] != identity["corp_code"] or
            ctx["stock_code"] != identity["stock_code"] or
            ctx["issuer_identity_sha256"] != identity.get("source_header_sha256") or
            ctx["source_document_sha256"] != provenance.get("inner_file_sha256")):
        raise ValueError("YEAREND_EVIDENCE_SUBJECT_OR_SOURCE_MISMATCH")
    return {
        "kind": "indirect_holding", "source_receipt_no": provenance["receipt_no"],
        "source_document_no": ctx.get("source_document_no"),
        "source_filing_date": ctx["source_filing_date"], "basis_date": basis["text"],
        "corp_code": ctx["corp_code"], "stock_code": ctx["stock_code"], "filer_corp_code": ctx["filer_corp_code"],
        "security_kind": canonical_security(candidate["security_kind"]),
        "quantity": candidate["quantity"], "ownership_percent": candidate.get("ownership_percent"),
        "numeric_kind": "exact", "ratio_denominator": candidate["ratio_denominator"],
        "holder_scope": "nps_only", "owner_identity": "nps_confirmed", "basis_kind": "explicit_actual_holding",
        "denominator_quantity": candidate["denominator_quantity"], "denominator_date": candidate["denominator_date"],
        "source_status": ctx["source_status"],
        "source_file_sha256": provenance["inner_file_sha256"],
        "source_row_sha256": candidate["source_row_sha256"],
        "source_row_offset": candidate["source_row_offset"],
        "source_document_sha256": ctx["source_document_sha256"],
        "source_section_sha256": candidate["source_section_sha256"],
        "issuer_identity_sha256": ctx["issuer_identity_sha256"],
        "verified_at": ctx["verified_at"], "parser_version": candidate["parser_version"],
    }


def _scan_archive(archive_dir: Optional[Path], receipt_no: str) -> List[Path]:
    if archive_dir is None:
        return []
    base = Path(archive_dir)
    exact = base / f"{receipt_no}.zip"
    if exact.is_file():
        return [exact]
    found = sorted(base.glob(f"{receipt_no}-*.zip"))
    return [path for path in found if path.is_file()]


def validate_request(request):
    if not isinstance(request, dict):
        raise ValueError("YEAREND_WORKER_REQUEST")
    if not isinstance(request.get("request_key"), str) or not request["request_key"]:
        raise ValueError("YEAREND_WORKER_REQUEST")
    if not isinstance(request.get("receipt_no"), str) or not re.fullmatch(r"[A-Za-z0-9_-]+", request["receipt_no"]):
        raise ValueError("YEAREND_WORKER_RECEIPT")
    if not isinstance(request.get("clue", {}), dict):
        raise ValueError("YEAREND_CLUE_SHAPE")
    if not isinstance(request.get("chain", []), list) or any(not isinstance(n, str) for n in request.get("chain", [])):
        raise ValueError("YEAREND_WORKER_CHAIN")
    for field in ("equity_target_corp", "document_target_corp", "security_kind", "stock_code", "target_point", "input_id"):
        if request.get(field) is not None and not isinstance(request[field], str):
            raise ValueError("YEAREND_WORKER_SUBJECT")
    if request.get("target_point") is not None and not valid_date(request["target_point"]):
        raise ValueError("YEAREND_WORKER_TARGET_DATE")
    for field in ("excel_eval_eok_raw", "excel_ratio_display", "derived_estimate"):
        if request.get(field) is not None:
            yearend.normalize_number(request[field])
    # The persisted snapshot contains every supplied field, including chain and
    # comparison identity. JSON roundtrip prevents mutable or non-JSON inputs.
    return json.loads(json.dumps(request, ensure_ascii=False, allow_nan=False))


def evidence_path(output_dir, request_key):
    # Human keys remain in JSON; paths use only a stable SHA-256 filename.
    base = Path(output_dir).resolve()
    directory = (base / "evidence-candidates").resolve()
    if directory.parent != base:
        raise ValueError("YEAREND_ARTIFACT_CONTAINMENT")
    target = directory / (hashlib.sha256(request_key.encode()).hexdigest() + ".json")
    if target.resolve().parent != directory:
        raise ValueError("YEAREND_ARTIFACT_CONTAINMENT")
    return target


def process_followup(state: Dict[str, Any], request: Dict[str, Any], *,
                     archive_dir: Optional[Path] = None,
                     corpcode_path: Optional[Path] = None,
                     stored_responses: Optional[Dict[str, Dict[str, Any]]] = None,
                     output_dir: Optional[Path] = None,
                     fetch_document: Optional[Callable[..., bytes]] = None) -> Dict[str, Any]:
    """Offline verification of one complete request. Never calls fetch_document."""
    request = validate_request(request)
    before = copy.deepcopy(state)
    yearend.ensure_yearend_ledgers(state)
    key, receipt = request["request_key"], request["receipt_no"]
    enqueued = yearend.enqueue_citation_followup(state, key, request.get("clue") or {}, request=request)
    item = state["citation_followup_queue"][key]

    def hold(outcome, note, **detail):
        yearend.advance_followup(state, key, outcome, note=note)
        return {"request_key": key, "outcome": outcome, **detail}

    if enqueued["state"] == "value_conflict":
        result = {"request_key": key, "outcome": "value_conflict", "reason": "explicit_adjudication_required"}
    elif yearend.detect_citation_cycle(list(request.get("chain") or []) + [receipt]):
        result = hold("citation_cycle_hold", "citation chain revisits a receipt")
    else:
        try:
            result = _process_original(state, request, archive_dir, stored_responses, output_dir, hold, corpcode_path)
        except (OSError, zipfile.BadZipFile, RuntimeError, UnicodeError, ValueError, KeyError) as exc:
            # Ordinary bad inputs affect only this request; queue history and
            # previously completed items survive. No terminal state is set yet.
            result = hold("comparison_pending_hold", "original/artifact processing failed",
                          error=type(exc).__name__ + ":" + str(exc))
    result["state_changed"] = before != state
    result["changed"] = before != state or bool(result.get("artifact_changed"))
    return result


def _process_original(state, request, archive_dir, stored_responses, output_dir, hold, corpcode_path=None):
    key, receipt = request["request_key"], request["receipt_no"]
    item = state["citation_followup_queue"][key]
    registry = state["yearend_archive_registry"]
    if receipt not in registry:
        for path in _scan_archive(archive_dir, receipt):
            payload = path.read_bytes()
            entry = {"archive_path": path.name, "archive_sha256": hashlib.sha256(payload).hexdigest()}
            # Save the observed archive identity even when ZIP discovery fails.
            registry[receipt] = entry
            try:
                with zipfile.ZipFile(BytesIO(payload)) as archive:
                    names = [n for n in archive.namelist() if n.lower().endswith(".xml")
                             and not n.startswith("/") and ".." not in n]
                    if len(names) == 1:
                        entry.update(inner_file_name=names[0],
                                     inner_file_sha256=hashlib.sha256(archive.read(names[0])).hexdigest())
            except (zipfile.BadZipFile, RuntimeError, OSError):
                return hold("comparison_pending_hold", "archive verification: archive_corrupt", lookup_status="archive_corrupt")
            break
    entry = registry.get(receipt)
    if entry is None:
        return hold("missing_original", "no archive file in archive_dir; add it and rerun")
    lookup = yearend.lookup_original({receipt: entry}, receipt, archive_dir=archive_dir)
    item["last_lookup"] = {k: v for k, v in lookup.items() if k != "source"}
    if lookup["status"] != "archive_hit":
        outcome = "missing_original" if lookup["status"] in (
            "missing_original", "origin_unverified_cache_claim", "extraction_cache_only_no_archive", "origin_hash_unusable") else "comparison_pending_hold"
        return hold(outcome, "archive verification: " + lookup["status"], lookup_status=lookup["status"])
    payload = yearend.load_verified_archive_bytes(archive_dir, receipt, entry)
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        xml_text = archive.read(lookup["inner_file_name"]).decode("utf-8")
    target_point = request.get("target_point")
    if target_point:
        y, m, d = (int(part) for part in target_point.split("-"))
        date_hint = re.compile(rf"(?:{y}[-.]0?{m}[-.]0?{d}|{y}년\s*0?{m}월\s*0?{d}일)")
        # Absence is a cheap *hold* for the supported date grammars, never a
        # proof of a date role or a numeric/issuer/holder relationship.
        if not date_hint.search(xml_text) and not date_hint.search(html.unescape(re.sub(r"<[^>]+>", " ", xml_text))):
            return hold("comparison_pending_hold", "target date absent from supported source date grammars",
                        reason="target_date_not_located")
    claims = []
    table_error = None
    try:
        layout = extract_holder_table(xml_text, lookup["archive_sha256"], lookup["inner_file_name"], lookup["inner_file_sha256"])
    except ValueError as exc:
        layout = None
        table_error = str(exc)
    if layout is None and not (stored_responses and key in stored_responses):
        # Unsupported/mismatched issuer headers cannot yield a verified fact.
        # Check that inexpensive structural gate before repeatedly scanning
        # large tables from attachment/name discovery leads.
        identity = source_identity(xml_text)
        if (not identity or not (identity["name"] == request.get("equity_target_corp") or
                (identity.get("corp_code") and identity["corp_code"] == request.get("corp_code"))) or
                (request.get("corp_code") and identity.get("corp_code") != request["corp_code"])):
            return hold("comparison_pending_hold", "issuer header not bound to requested subject",
                        failed=["equity_target"], reason="issuer_header_not_bound")
        from scripts.foliotrace import secondary
        claims = secondary.extract_source_claims(xml_text)
    candidate = None
    source = "none"
    check = None
    # Injected responses are proposals only and use the same verification as
    # deterministic extraction. A changed proposal is never silently ignored.
    if stored_responses and key in stored_responses:
        candidate = copy.deepcopy(stored_responses[key].get("clue") or {})
        source = "stored_model_response"
        check = verify_candidate(layout, candidate) if layout else _verify_against_raw_text(xml_text, candidate)
    elif layout is not None:
        rows = [i for i, row in enumerate(layout["rows"]) if row["holder"] in NPS_NAMES and
                (not request.get("security_kind") or canonical_security(row["security_kind"]) == canonical_security(request["security_kind"]))]
        if len(rows) > 1:
            return hold("ambiguous_candidates", "multiple NPS rows require disambiguation")
        if rows:
            idx = rows[0]
            bindings = [{"text": n["date"], "role": n["role"], "ambiguous": False,
                         "applies_to_row": idx, "applies_to_field": n["applies_to_field"]}
                        for n in layout["register_notes"] if str(n.get("applies_to_row")) == str(idx)]
            bindings += [{"text": value, "role": role, "ambiguous": False,
                          "applies_to_field": "document_metadata"}
                         for role, value in (("filing_date", layout["dates"].get("filing_date")),
                                             ("obligation_date", layout["dates"].get("obligation_date")),
                                             ("writing_basis_date", layout["dates"].get("writing_date"))) if value]
            candidate = candidate_from_row(layout, idx, equity_target=request.get("equity_target_corp") or layout["document_target"], date_bindings=bindings)
            check = verify_candidate(layout, candidate)
            source = "worker_table_structured"
    elif claims:
        # Select an exact security / target point, not the first parser result.
        selected = [c for c in claims if (not request.get("security_kind") or
                    canonical_security(c.get("security_kind")) == canonical_security(request["security_kind"]))
                    and (not request.get("target_point") or c.get("basis_date") == request["target_point"])]
        selected = list({json.dumps(c, sort_keys=True): c for c in selected}.values())
        if len(selected) > 1:
            return hold("ambiguous_candidates", "multiple structured claims require disambiguation")
        if selected:
            candidate, check = _adapt_secondary(xml_text, selected[0], request, corpcode_path=corpcode_path)
            source = "secondary_structured"
    if candidate is None:
        return hold("search_zero_results", "no candidate in original; " + str(table_error or "no exact structured subject"),
                    claim_count=len(claims))
    # A request's security or issuer cannot be changed by a proposal.
    if request.get("security_kind") and canonical_security(candidate.get("security_kind")) != canonical_security(request["security_kind"]):
        check["checks"]["request_subject"] = {"verified": False, "reason": "security_subject_mismatch"}
    if request.get("equity_target_corp") and candidate.get("equity_target_corp") != request["equity_target_corp"]:
        check["checks"]["request_subject"] = {"verified": False, "reason": "issuer_subject_mismatch"}
    check["failed"] = [n for n, v in check["checks"].items() if not v["verified"]]
    check["verified"] = not check["failed"]
    item["last_verification"] = check
    if not check["verified"]:
        return hold("comparison_pending_hold", "unsupported source associations", failed=check["failed"])
    clue = request.get("clue") or {}
    citation_checks = {}
    for field in ("quantity", "ownership_percent"):
        if field in clue:
            citation_checks[field] = yearend.verify_citation_against_original(clue[field], candidate.get(field))
    for field in ("holder_name", "equity_target_corp", "security_kind", "holder_aggregation_scope"):
        if field in clue:
            a, b = clue[field], candidate.get(field)
            if field == "security_kind":
                a, b = canonical_security(a), canonical_security(b)
            citation_checks[field] = "comparison_pending_hold" if b is None else "values_match_basis_unconfirmed" if a == b else "value_conflict"
    # A cited note/date needs the same original-bound validation, not occurrence.
    if any(f in clue for f in ("date_clues", "note_text", "applies_to_fields", "applies_to_row")):
        cited = {**candidate, **clue}
        cited_check = verify_candidate(layout, cited) if layout else _verify_against_raw_text(xml_text, cited)
        citation_checks["scope"] = "values_match_basis_unconfirmed" if cited_check["verified"] else "comparison_pending_hold"
    item["citation_checks"] = citation_checks
    if "value_conflict" in citation_checks.values():
        return hold("value_conflict", "cited fields disagree with secured original")
    if "comparison_pending_hold" in citation_checks.values():
        return hold("comparison_pending_hold", "cited fields not supported by secured original")
    evidence = {
        "request_key": key, "extraction_source": source,
        "holder": candidate.get("holder_name"), "equity_target_corp": candidate.get("equity_target_corp"),
        "document_target_corp": candidate.get("document_target_corp"),
        "security_kind": candidate.get("security_kind"), "holder_scope": candidate.get("holder_aggregation_scope"),
        "quantity": candidate.get("quantity"), "ownership_percent": candidate.get("ownership_percent"),
        "note_binding": {"text": candidate.get("note_text"), "applies_to_row": candidate.get("applies_to_row"),
                         "applies_to_fields": candidate.get("applies_to_fields")},
        "date_bindings": check["checks"]["dates"].get("bindings", []), "verification": check,
        "provenance": {"receipt_no": receipt, "archive_sha256": lookup["archive_sha256"],
                       "inner_file_name": lookup["inner_file_name"], "inner_file_sha256": lookup["inner_file_sha256"],
                       "row_refs": check["checks"]["holder"].get("row_refs", []),
                       "text_spans": check.get("text_spans", [])},
    }
    for field in ("source_status", "basis_evidence", "ratio_denominator", "denominator_evidence", "denominator_date",
                  "denominator_quantity", "source_row_sha256", "source_row_offset", "source_section_sha256", "parser_version", "subject_identity"):
        if field in candidate:
            evidence[field] = candidate[field]
    if source == "stored_model_response":
        evidence["stored_response_id"] = stored_responses[key].get("response_id", key)
        evidence["accuracy_note"] = "source_validation_not_model_accuracy"
    evidence["subject_key"] = _subject(request, evidence)
    proof = {**evidence["provenance"], "checked_fields": sorted(check["checks"]),
             "evidence_sha256": hashlib.sha256(json.dumps(evidence, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
             "subject_key": evidence["subject_key"]}
    preview = _regenerate_comparison(state, request, evidence, proof, dry_run=True)
    target = evidence_path(output_dir, key) if output_dir is not None else None
    serialized = json.dumps(evidence, ensure_ascii=False, indent=2, sort_keys=True)
    file_current = target is None or (target.is_file() and target.read_text(encoding="utf-8") == serialized)
    if (item.get("state") == "resolved_verified_hold" and item.get("verification") == proof
            and item.get("evidence") == evidence and not preview["changed"] and file_current):
        return {"request_key": key, "outcome": "resolved_verified_hold", "idempotent": True, "evidence": evidence}
    # Prepare comparison in isolation. If comparison or artifact work fails,
    # no resolved state or partially regenerated comparison is published.
    staged = copy.deepcopy(state)
    comparison = _regenerate_comparison(staged, request, evidence, proof)
    written = {}
    if target is not None:
        target.parent.mkdir(parents=True, exist_ok=True)
        if not file_current:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent,
                                             prefix=target.stem + "-", suffix=".tmp", delete=False) as stream:
                stream.write(serialized)
                temporary = Path(stream.name)
            temporary.replace(target)
        written["evidence_candidate"] = str(target)
    state["yearend_comparison"] = staged["yearend_comparison"]
    yearend.advance_followup(state, key, "resolved_verified_hold", note="source associations verified; comparison basis assessed separately", verification=proof)
    item["evidence"] = evidence
    item["evidence_id"] = key
    return {"request_key": key, "outcome": "resolved_verified_hold", "evidence": evidence,
            "comparison": comparison, "written": written, "artifact_changed": not file_current}


def _span(text, start, end, role):
    quote = text[start:end]
    return {"representation": "original_xml_utf8_codepoints", "start": start, "end": end,
            "text": quote, "sha256": hashlib.sha256(quote.encode()).hexdigest(), "role": role}


def source_identity(xml_text):
    """Only an explicit issuer header, before body, establishes issuer identity."""
    prefix = xml_text.split("<BODY", 1)[0]
    try:
        if "<!DOCTYPE" in prefix or "<!ENTITY" in prefix:
            return None
        fragment = prefix + "</DOCUMENT>" if "<BODY" in xml_text else prefix
        root = ET.fromstring(fragment)
        # Header role is structural. An auditor/body/summary name is not issuer.
        elements = list(root.findall("COMPANY-NAME")) if root.tag in ("DOCUMENT", "DOC") else []
        if root.tag == "DOCUMENT":
            elements += list(root.findall("DOCUMENT-HEADER/COMPANY-NAME"))
        if len(elements) != 1:
            return None
    except ET.ParseError:
        return None
    matches = list(re.finditer(r'<COMPANY-NAME\b([^>]*)>([^<]+)</COMPANY-NAME>', prefix, re.I))
    if len(matches) != 1 or html.unescape(matches[0][2]).strip() != _text(elements[0]).strip():
        return None
    m = matches[0]
    codes = re.findall(r'\bAREGCIK=[\'"]([0-9]{8})[\'"]', m[1])
    return {"name": html.unescape(m[2]).strip(), "corp_code": codes[0] if len(codes) == 1 else None,
            "span": _span(xml_text, m.start(), m.end(), "issuer_header")}


def _adapt_secondary(xml_text, claim, request, *, corpcode_path=None):
    from scripts.foliotrace import secondary
    offset = claim.get("row_offset")
    row = next((m for m in secondary.SOURCE_ROWS.finditer(xml_text) if m.start() == offset), None)
    row_valid = row is not None and hashlib.sha256(row[0].encode()).hexdigest() == claim.get("row_sha256")
    cells = secondary._row_cells(row[0]) if row_valid else []
    owners = [c for c in cells if secondary.EXACT_NPS.fullmatch(c)]
    identity = source_identity(xml_text)
    issuer_valid = bool(identity and (identity["name"] == request.get("equity_target_corp") or
        (identity.get("corp_code") and identity["corp_code"] == request.get("corp_code"))) and
        (not request.get("corp_code") or identity.get("corp_code") == request["corp_code"]))
    # These parser structures prove their own date, NPS-only scope and class.
    supported = claim.get("structure") in ("dated_share_distribution_all_common", "dated_five_percent_shareholder_all_common")
    verified_status = claim.get("status") == "actual_holding_basis_verified"
    checks = {name: {"verified": value, "row_refs": [offset] if row_valid else []} for name, value in {
        "holder": row_valid and len(owners) == 1, "owner_identity": row_valid and len(owners) == 1,
        "equity_target": issuer_valid, "security_kind": supported and claim.get("security_kind") == "보통주",
        "holder_scope": supported and claim.get("holder_scope") == "nps_only",
        "quantity": row_valid and claim.get("quantity") is not None,
        "ownership_percent": row_valid and claim.get("ownership_percent") is not None,
        "association": row_valid and supported, "note_scope": supported,
        "dates": verified_status and supported and valid_date(claim.get("basis_date")),
    }.items()}
    # The original bounded section (including date headers and register note),
    # row hash and explicit header survive adaptation. No ISO-string search.
    start = xml_text.rfind("<TABLE", 0, offset) if isinstance(offset, int) else -1
    end = xml_text.find("</TABLE>", row.end()) + len("</TABLE>") if row else -1
    section = _span(xml_text, start, end, "holder_table_date_and_note") if start >= 0 and end > start else None
    if section is None:
        checks["association"]["verified"] = False
    candidate = {"holder_name": owners[0] if len(owners) == 1 else None,
                 "equity_target_corp": request.get("equity_target_corp"),
                 "document_target_corp": identity["name"] if identity else None,
                 "security_kind": claim.get("security_kind"), "holder_aggregation_scope": "single_holder" if supported else None,
                 "quantity": claim.get("quantity"), "ownership_percent": claim.get("ownership_percent"),
                 "source_status": claim.get("status"), "source_row_sha256": claim.get("row_sha256"),
                 "source_row_offset": offset, "source_section_sha256": section["sha256"] if section else None,
                 "parser_version": secondary.SOURCE_PARSER_VERSION}
    binding = None
    if issuer_valid and identity.get("corp_code") and corpcode_path is not None:
        # Read the caller-selected local DART corpcode registry, never request
        # identity or a universe/cache claim. Retain the exact bytes as proof.
        mapping_bytes = Path(corpcode_path).read_bytes()
        companies = json.loads(mapping_bytes)
        codes = {c.get("stock_code") for c in companies if c.get("corp_code") == identity["corp_code"]
                 and re.fullmatch(r"\d{6}", str(c.get("stock_code") or ""))}
        if len(codes) == 1:
            binding = {"verified": True, "basis": "local_dart_corpcode_registry",
                       "corp_code": identity["corp_code"], "stock_code": next(iter(codes)),
                       "mapping_path": str(Path(corpcode_path).resolve()),
                       "mapping_sha256": hashlib.sha256(mapping_bytes).hexdigest()}
    candidate["subject_identity"] = {
        "corp_code": identity.get("corp_code") if issuer_valid else None,
        "stock_code": binding["stock_code"] if binding else None,
        "ticker_binding": binding, "request_ticker_lead": request.get("stock_code"),
        "source_header_sha256": identity["span"]["sha256"] if issuer_valid else None,
    }
    if binding and request.get("stock_code") and request["stock_code"] != binding["stock_code"]:
        checks["ticker_identity"] = {"verified": False, "reason": "request_ticker_mismatches_corpcode_registry"}
    for field in ("basis_evidence", "ratio_denominator", "denominator_evidence", "denominator_date", "denominator_quantity"):
        candidate[field] = claim.get(field)
    bindings = [{"text": claim["basis_date"], "role": "shareholder_register_date", "ambiguous": False,
                 "verified": checks["dates"]["verified"], "applies_to_row": offset, "applies_to_field": "quantity",
                 "source_basis_evidence": claim.get("basis_evidence")} ] if claim.get("basis_date") else []
    # R-17: an explicit warning that the table writing-date balance may differ
    # keeps reported values but blocks that date as an actual holding basis.
    if section and re.search(r"작성기준일.*?(?:차이|다를|상이)", html.unescape(re.sub(r"<[^>]+>", " ", section["text"])), re.S):
        for binding in bindings:
            binding["ambiguous"] = True
            binding["limitation"] = "writing_date_balance_difference_warning"
    checks["dates"]["bindings"] = bindings
    spans = ([section, _span(xml_text, row.start(), row.end(), "nps_holder_row")] if row_valid and section else [])
    if identity:
        spans.append(identity["span"])
    return candidate, {"checks": checks, "verified": all(c["verified"] for c in checks.values()),
                       "failed": [n for n, c in checks.items() if not c["verified"]], "text_spans": spans}


def _verify_against_raw_text(xml_text: str, candidate: Dict[str, Any]) -> Dict[str, Any]:
    """No semantic promotion of arbitrary prose. Proposals need source structure.

    Raw spans/whole numeric tokens alone do not establish issuer/holder/class/
    holding/date relationships. Unsupported prose stays pending for an adapter
    that provides a registered, independently validated row schema.
    """
    return {"verified": False, "checks": {field: {"verified": False, "row_refs": [],
            "reason": "bounded_semantic_source_structure_required"} for field in (
                "holder", "owner_identity", "equity_target", "security_kind", "holder_scope", "association",
                "quantity", "ownership_percent", "note_scope", "dates")}, "failed": list(REQUIRED_EVIDENCE_FIELDS)}


def _subject(request, evidence):
    return yearend.comparison_subject_key(evidence.get("equity_target_corp") or request.get("equity_target_corp") or request["request_key"],
        security_kind=request.get("security_kind"), stock_code=request.get("stock_code"),
        target_point=request.get("target_point"), input_id=request.get("input_id"))


def _regenerate_comparison(state: Dict[str, Any], request: Dict[str, Any],
                           evidence: Dict[str, Any], proof: Dict[str, Any], *, dry_run: bool = False) -> Dict[str, Any]:
    subject = _subject(request, evidence)
    first = (state.get("yearend_comparison") or {}).get(subject) or {}
    basis = holding_basis(evidence)
    target = request.get("target_point")
    basis_confirmed = bool(basis and (not target or basis["text"] == target))
    if dry_run:
        state = copy.deepcopy(state)
    return yearend.compare_yearend(
        state, evidence.get("equity_target_corp") or request.get("equity_target_corp") or request["request_key"],
        excel_eval_eok_raw=first.get("excel_eval_eok_raw", request.get("excel_eval_eok_raw", "0")),
        excel_ratio_display=first.get("excel_ratio_display", request.get("excel_ratio_display", "0")),
        derived_estimate=first.get("derived_quantity_estimate", request.get("derived_estimate")),
        price_date=first.get("price_date", request.get("price_date")),
        disclosure_quantity=evidence.get("quantity"), disclosure_ratio_display=evidence.get("ownership_percent"),
        disclosure_basis_date=basis["text"] if basis else None, disclosure_basis_role=basis["role"] if basis else None,
        disclosure_receipt_no=evidence["provenance"]["receipt_no"],
        denominator_quantity=evidence.get("denominator_quantity"), denominator_date=evidence.get("denominator_date"),
        basis_confirmed=basis_confirmed,
        scope_confirmed=basis_confirmed and evidence["verification"]["checks"]["holder_scope"]["verified"]
        and canonical_security(request.get("security_kind")) in ("common", "preferred")
        and canonical_security(request.get("security_kind")) == canonical_security(evidence.get("security_kind")),
        security_kind=request.get("security_kind"), stock_code=request.get("stock_code"), target_point=target,
        input_id=request.get("input_id"), evidence_id=request["request_key"],
        evidence_fingerprint=proof["evidence_sha256"], note="source-bound offline verification")
