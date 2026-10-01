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
                "row_index": index,
                "holder": holder,
                "security_kind": (item.get("security") or "").strip() or None,
                "quantity": quantity,
                "quantity_raw": item.get("quantity"),
                "ownership_percent": ratio,
                "note_text": note,
                "note_applies_to_fields": [part.strip() for part in scope.split(",") if part.strip()],
                "row_offset": index,
            })
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
    doc_text = " ".join([layout["document_target"], layout["filer"] or "",
                         *[row_text(i) for i in range(len(rows))]])
    checks["equity_target"] = {"verified": bool(target) and target in doc_text,
                               "reason": "" if (target and target in doc_text)
                               else "equity_target_not_in_original"}
    cited_row = candidate.get("applies_to_row")
    scope_rows = holder_rows if cited_row is None else [cited_row] if cited_row in holder_rows else []
    if candidate.get("security_kind") is not None:
        checks["security_kind"] = {
            "verified": any(rows[i]["security_kind"] == candidate["security_kind"] for i in scope_rows),
            "row_refs": [i for i in scope_rows if rows[i]["security_kind"] == candidate["security_kind"]],
            "reason": "" if any(rows[i]["security_kind"] == candidate["security_kind"] for i in scope_rows)
            else "security_kind_not_on_holder_row"}
    else:
        checks["security_kind"] = {"verified": False, "row_refs": [],
                                   "reason": "security_kind_missing"}
    if candidate.get("quantity") is not None:
        try:
            wanted = yearend.normalize_number(candidate["quantity"], field="quantity")
        except ValueError:
            wanted = None
        hits = [i for i in scope_rows if rows[i]["quantity"] == wanted] if wanted else []
        checks["quantity"] = {"verified": bool(hits), "row_refs": hits,
                              "reason": "" if hits else "quantity_not_on_holder_row"}
    else:
        checks["quantity"] = {"verified": False, "row_refs": [], "reason": "quantity_missing"}
    if candidate.get("ownership_percent") is not None:
        try:
            wanted_ratio = yearend.normalize_number(candidate["ownership_percent"], field="ratio")
        except ValueError:
            wanted_ratio = None
        ratio_hits = [i for i in scope_rows if rows[i]["ownership_percent"] == wanted_ratio]
        same_row = any(i in checks["quantity"].get("row_refs", []) for i in ratio_hits)
        checks["ownership_percent"] = {
            "verified": bool(ratio_hits) and (same_row or not checks["quantity"]["verified"]),
            "row_refs": ratio_hits,
            "reason": "" if ratio_hits else "ratio_not_on_holder_row"}
    else:
        checks["ownership_percent"] = {"verified": True, "row_refs": [],
                                       "reason": "ratio_not_claimed_optional"}
    note = candidate.get("note_text")
    if note:
        occurrences = [i for i, row in enumerate(rows) if row["note_text"] == note]
        leaked = [i for i in occurrences if i not in scope_rows]
        checks["note_scope"] = {"verified": bool(occurrences) and not leaked,
                                "row_refs": occurrences,
                                "reason": "" if (occurrences and not leaked)
                                else "note_missing_or_spread_to_other_rows"}
    else:
        checks["note_scope"] = {"verified": True, "row_refs": [], "reason": "no_note_claimed"}
    known_dates = [value for value in layout["dates"].values() if value]
    known_dates += [item.get("date") for item in layout.get("register_notes", []) if item.get("date")]
    date_results = []
    for clue in candidate.get("date_clues") or []:
        text, role = clue.get("text"), clue.get("role")
        found_in_row = any(text and text in row_text(i) for i in scope_rows) if text else False
        found_in_meta = text and text in known_dates
        role_known = role in yearend.CITATION_DATE_ROLES
        date_results.append({"text": text, "role": role,
                             "verified": bool(found_in_row or found_in_meta) and role_known,
                             "ambiguous": bool(clue.get("ambiguous"))})
    checks["dates"] = {"verified": all(item["verified"] for item in date_results) if date_results else False,
                       "bindings": date_results,
                       "reason": "" if (date_results and all(item["verified"] for item in date_results))
                       else "dates_unresolved_or_role_unknown"}
    failed = [name for name, item in checks.items() if not item["verified"]]
    return {"verified": not failed, "checks": checks, "failed": failed}


def build_register_evidence_fact(candidate: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Shape a verified candidate as an ``indirect_holding`` fact for isolated checks.

    Only complete, verified candidates convert; anything else raises instead
    of loosening ``register_evidence`` validation.
    """
    present = {"holder": candidate.get("holder"),
               "equity_target": candidate.get("equity_target_corp"),
               "security_kind": candidate.get("security_kind"),
               "holder_scope": candidate.get("holder_scope"),
               "quantity": candidate.get("quantity"),
               "dates": candidate.get("date_bindings")}
    missing = [field for field, value in present.items() if value in (None, "")]
    if missing or not candidate.get("verification", {}).get("verified"):
        raise ValueError("YEAREND_EVIDENCE_INCOMPLETE")
    if candidate.get("holder_scope") != "single_holder":
        raise ValueError("YEAREND_EVIDENCE_SCOPE_UNMAPPABLE")
    required_ctx = ("corp_code", "stock_code", "filer_corp_code", "source_filing_date",
                    "basis_date", "source_receipt_no", "source_row_sha256",
                    "source_file_sha256", "source_document_sha256", "source_section_sha256",
                    "issuer_identity_sha256", "verified_at")
    if any(ctx.get(key) in (None, "") for key in required_ctx):
        raise ValueError("YEAREND_EVIDENCE_CTX_INCOMPLETE")
    security = {"보통주": "common", "우선주": "preferred"}.get(
        candidate["security_kind"], candidate["security_kind"])
    if security not in ("common", "preferred"):
        raise ValueError("YEAREND_EVIDENCE_SECURITY_UNMAPPABLE")
    return {
        "kind": "indirect_holding",
        "source_receipt_no": ctx["source_receipt_no"],
        "source_document_no": ctx.get("source_document_no"),
        "source_filing_date": ctx["source_filing_date"],
        "basis_date": ctx["basis_date"],
        "corp_code": ctx["corp_code"],
        "filer_corp_code": ctx["filer_corp_code"],
        "stock_code": ctx["stock_code"],
        "security_kind": security,
        "ownership_percent": candidate.get("ownership_percent"),
        "quantity": candidate.get("quantity"),
        "numeric_kind": "exact",
        "source_file_sha256": candidate.get("source_file_sha256") or ctx["source_file_sha256"],
        "source_row_sha256": candidate.get("source_row_sha256") or ctx["source_row_sha256"],
        "source_row_offset": int(candidate.get("source_row_offset") or 0),
        "parser_version": ctx.get("parser_version", "yearend-worker-v1"),
        "ratio_denominator": ctx.get("ratio_denominator", "issued_shares"),
        "holder_scope": ctx.get("holder_scope", "nps_only"),
        "owner_identity": "nps_confirmed",
        "basis_kind": "explicit_actual_holding",
        "source_status": "no_known_correction_or_withdrawal",
        "source_document_sha256": ctx["source_document_sha256"],
        "source_section_sha256": candidate.get("source_section_sha256") or ctx["source_section_sha256"],
        "issuer_identity_sha256": ctx["issuer_identity_sha256"],
        "verified_at": ctx["verified_at"],
        **({"denominator_quantity": candidate["denominator_quantity"],
            "denominator_date": candidate["denominator_date"]}
           if candidate.get("denominator_quantity") else {}),
    }


def _scan_archive(archive_dir: Optional[Path], receipt_no: str) -> List[Path]:
    if archive_dir is None:
        return []
    base = Path(archive_dir)
    found = [base / f"{receipt_no}.zip", *sorted(base.glob(f"{receipt_no}-*.zip"))]
    return [path for path in found if path.is_file()]


def process_followup(state: Dict[str, Any], request: Dict[str, Any], *,
                     archive_dir: Optional[Path] = None,
                     stored_responses: Optional[Dict[str, Dict[str, Any]]] = None,
                     output_dir: Optional[Path] = None,
                     fetch_document: Optional[Callable[..., bytes]] = None) -> Dict[str, Any]:
    """Run one citation-followup request offline to verification or a hold.

    ``fetch_document`` is accepted only so tests can arm a raising stub and
    prove the verified path never downloads; this function never calls it.
    Returns ``{request_key, outcome, changed, ...}``; ``changed`` mirrors
    whether persisted state or result files actually changed.
    """
    yearend.ensure_yearend_ledgers(state)
    request_key = request.get("request_key") or ""
    receipt_no = request.get("receipt_no") or ""
    if not request_key or not receipt_no:
        raise ValueError("YEAREND_WORKER_REQUEST")
    chain = list(request.get("chain") or []) + [receipt_no]
    if yearend.detect_citation_cycle(chain):
        result = yearend.enqueue_citation_followup(state, request_key, request.get("clue") or {})
        advanced = yearend.advance_followup(state, request_key, "citation_cycle_hold",
                                            note="citation chain revisits a receipt")
        return {"request_key": request_key, "outcome": "citation_cycle_hold",
                "changed": result["changed"] or advanced["changed"]}
    yearend.enqueue_citation_followup(state, request_key, request.get("clue") or {})
    item = state["citation_followup_queue"][request_key]
    registry = state["yearend_archive_registry"]
    if receipt_no not in registry:
        for path in _scan_archive(archive_dir, receipt_no):
            payload = path.read_bytes()
            with zipfile.ZipFile(BytesIO(payload)) as archive:
                names = [name for name in archive.namelist()
                         if name.lower().endswith(".xml") and not name.startswith("/")]
                inner_digest = (hashlib.sha256(archive.read(names[0])).hexdigest()
                                if len(names) == 1 else None)
            registry[receipt_no] = {
                "archive_path": path.name,
                "archive_sha256": hashlib.sha256(payload).hexdigest(),
                "inner_file_name": names[0] if len(names) == 1 else None,
                "inner_file_sha256": inner_digest,
            }
            break
    entry = registry.get(receipt_no)
    if entry is None:
        advanced = yearend.advance_followup(state, request_key, "missing_original",
                                            note="no archive file in archive_dir; add it and rerun")
        return {"request_key": request_key, "outcome": "missing_original",
                "changed": advanced["changed"], "state_changed": advanced["state_changed"]}
    lookup = yearend.lookup_original({receipt_no: entry}, receipt_no, archive_dir=archive_dir)
    item["last_lookup"] = {key: lookup[key] for key in lookup if key != "source"}
    if lookup["status"] != "archive_hit":
        outcome = "missing_original" if lookup["status"] in (
            "missing_original", "origin_unverified_cache_claim",
            "extraction_cache_only_no_archive", "origin_hash_unusable") else "comparison_pending_hold"
        advanced = yearend.advance_followup(state, request_key, outcome,
                                            note=f"archive verification: {lookup['status']}")
        return {"request_key": request_key, "outcome": outcome,
                "changed": advanced["changed"], "lookup_status": lookup["status"]}
    payload = yearend.load_verified_archive_bytes(archive_dir, receipt_no, entry)
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        xml_text = archive.read(lookup["inner_file_name"]).decode("utf-8")
    # Structured extraction first (real DART path), then worker tables, then
    # stored model responses.  The source is recorded on the candidate.
    secondary_claims: List[Dict[str, Any]] = []
    try:
        from scripts.foliotrace import secondary as _secondary
        secondary_claims = _secondary.extract_source_claims(xml_text) or []
    except Exception:
        secondary_claims = []
    candidate: Optional[Dict[str, Any]] = None
    extraction_source = "none"
    if secondary_claims:
        extraction_source = "secondary_structured"
        first = secondary_claims[0]
        candidate = {
            "holder_name": "국민연금공단",
            "equity_target_corp": request.get("equity_target_corp"),
            "document_target_corp": request.get("document_target_corp"),
            "security_kind": "common" if first.get("security_kind") == "보통주" else first.get("security_kind"),
            "holder_aggregation_scope": "single_holder",
            "quantity": first.get("quantity"),
            "ownership_percent": first.get("ownership_percent"),
            "date_clues": ([{"text": first["basis_date"], "role": "shareholder_register_date",
                             "ambiguous": False}] if first.get("basis_date") else []),
            "is_nps_claim": True,
        }
    else:
        table_error: Optional[str] = None
        try:
            layout = extract_holder_table(xml_text, lookup["archive_sha256"],
                                          lookup["inner_file_name"],
                                          lookup.get("inner_file_sha256") or "")
        except ValueError as exc:
            layout = None
            table_error = str(exc)
        nps_rows = [i for i, row in enumerate(layout["rows"]) if row["holder"] in (
            "국민연금공단", "국민연금기금", "National Pension Service")] if layout is not None else []
        if layout is None:
            pass
        elif len(nps_rows) > 1:
            advanced = yearend.advance_followup(state, request_key, "ambiguous_candidates",
                                                note="multiple distinct NPS rows need disambiguation")
            return {"request_key": request_key, "outcome": "ambiguous_candidates",
                    "changed": advanced["changed"]}
        if len(nps_rows) == 1:
            extraction_source = "worker_table_structured"
            target_row = nps_rows[0]
            date_bindings = []
            for note_item in layout["register_notes"]:
                if str(note_item.get("applies_to_row")) in (str(target_row), None) and note_item.get("date"):
                    date_bindings.append({"text": note_item["date"],
                                          "role": note_item.get("role") or "shareholder_register_date",
                                          "ambiguous": False})
            candidate = candidate_from_row(
                layout, target_row,
                equity_target=request.get("equity_target_corp") or layout["document_target"],
                date_bindings=date_bindings or [
                    {"text": value, "role": role, "ambiguous": True}
                    for role, value in layout["dates"].items() if value][:1])
            candidate["_layout"] = layout
    if candidate is None and stored_responses and request_key in stored_responses:
        extraction_source = "stored_model_response"
        stored = stored_responses[request_key]
        candidate = copy.deepcopy(stored.get("clue") or {})
        candidate["_stored_response_id"] = stored.get("response_id", request_key)
    if candidate is None:
        detail = f"; table extraction: {table_error}" if table_error else ""
        advanced = yearend.advance_followup(state, request_key, "search_zero_results",
                                            note="no verifiable candidate in verified original" + detail)
        return {"request_key": request_key, "outcome": "search_zero_results",
                "changed": advanced["changed"]}
    layout = candidate.pop("_layout", None)
    if layout is None:
        # Stored-response candidates are cross-checked against the raw text:
        # holder, target, quantity and dates must literally occur.
        layout = {"document_target": request.get("document_target_corp") or "",
                  "filer": None, "dates": {}, "rows": [], "register_notes": [],
                  "raw_text": xml_text}
        check = _verify_against_raw_text(xml_text, candidate)
    else:
        check = verify_candidate(layout, candidate)
    if not check["verified"]:
        outcome = "value_conflict" if any(
            check["checks"].get(name, {}).get("reason", "").endswith("not_on_holder_row")
            for name in ("quantity", "ownership_percent")) else "comparison_pending_hold"
        advanced = yearend.advance_followup(state, request_key, outcome,
                                            note=f"verification failed: {check['failed']}")
        item["last_verification"] = check
        return {"request_key": request_key, "outcome": outcome,
                "changed": advanced["changed"], "failed": check["failed"]}
    evidence = {
        "request_key": request_key,
        "extraction_source": extraction_source,
        "holder": candidate.get("holder_name"),
        "equity_target_corp": candidate.get("equity_target_corp"),
        "document_target_corp": candidate.get("document_target_corp") or (
            layout.get("document_target") if layout else None),
        "security_kind": candidate.get("security_kind"),
        "holder_scope": candidate.get("holder_aggregation_scope"),
        "quantity": candidate.get("quantity"),
        "ownership_percent": candidate.get("ownership_percent"),
        "note_binding": {"text": candidate.get("note_text"),
                         "applies_to_row": candidate.get("applies_to_row"),
                         "applies_to_fields": candidate.get("applies_to_fields")},
        "date_bindings": check["checks"]["dates"].get("bindings", []),
        "verification": {"verified": True,
                         "checks": {name: {"verified": item["verified"],
                                           "row_refs": item.get("row_refs", [])}
                                    for name, item in check["checks"].items()}},
        "provenance": {"receipt_no": receipt_no,
                       "archive_sha256": lookup["archive_sha256"],
                       "inner_file_name": lookup["inner_file_name"],
                       "inner_file_sha256": lookup.get("inner_file_sha256"),
                       "row_refs": check["checks"]["holder"].get("row_refs", [])},
    }
    if candidate.get("_stored_response_id"):
        evidence["stored_response_id"] = candidate["_stored_response_id"]
        evidence["accuracy_note"] = "stored_response_cross_checked_not_model_accuracy"
    text_spans = []
    if extraction_source == "stored_model_response":
        for name in ("holder", "equity_target", "quantity"):
            value = check["checks"].get(name, {})
            field_value = {"holder": candidate.get("holder_name"),
                           "equity_target": candidate.get("equity_target_corp"),
                           "quantity": candidate.get("quantity")}.get(name)
            if value.get("verified") and field_value:
                text_spans.append({"field": name, "text": str(field_value)})
    proof = {"archive_sha256": lookup["archive_sha256"],
             "inner_file_name": lookup["inner_file_name"],
             "row_refs": check["checks"]["holder"].get("row_refs", []),
             "text_spans": text_spans,
             "checked_fields": sorted(check["checks"])}
    if (item.get("state") == "resolved_verified_hold" and item.get("verification") == proof
            and item.get("evidence_id") == request_key):
        comparison_uptodate = _regenerate_comparison(
            state, request, evidence, proof, dry_run=True)
        if comparison_uptodate:
            return {"request_key": request_key, "outcome": "resolved_verified_hold",
                    "changed": False, "state_changed": False, "idempotent": True}
    advanced = yearend.advance_followup(state, request_key, "resolved_verified_hold",
                                        note="candidate verified against stored original",
                                        verification=proof)
    item["evidence_id"] = request_key
    item["last_verification"] = check
    comparison = _regenerate_comparison(state, request, evidence, proof)
    changed = advanced["changed"] or comparison["changed"]
    written: Dict[str, str] = {}
    if output_dir is not None:
        out = Path(output_dir)
        (out / "evidence-candidates").mkdir(parents=True, exist_ok=True)
        target = out / "evidence-candidates" / f"{request_key}.json"
        payload_text = json.dumps(evidence, ensure_ascii=False, indent=2, sort_keys=True)
        if not target.is_file() or target.read_text(encoding="utf-8") != payload_text:
            target.write_text(payload_text, encoding="utf-8")
            changed = True
            written["evidence_candidate"] = str(target)
        else:
            written["evidence_candidate"] = str(target)
    return {"request_key": request_key, "outcome": "resolved_verified_hold",
            "changed": changed, "state_changed": advanced["state_changed"],
            "evidence": evidence, "comparison": comparison, "written": written}


def _verify_against_raw_text(xml_text: str, candidate: Dict[str, Any]) -> Dict[str, Any]:
    """Cross-check a stored-response candidate against the original text."""
    checks: Dict[str, Dict[str, Any]] = {}

    def present(value: Any) -> bool:
        return bool(value) and str(value) in xml_text

    def normalized_present(value: Any) -> bool:
        if value is None:
            return False
        try:
            return yearend.normalize_number(value) in xml_text.replace(",", "") or str(value) in xml_text
        except ValueError:
            return False

    checks["holder"] = {"verified": present(candidate.get("holder_name")),
                        "row_refs": [], "reason": "" if present(candidate.get("holder_name"))
                        else "holder_not_in_original"}
    checks["equity_target"] = {"verified": present(candidate.get("equity_target_corp")),
                               "reason": "" if present(candidate.get("equity_target_corp"))
                               else "equity_target_not_in_original"}
    checks["security_kind"] = {"verified": present(candidate.get("security_kind")),
                               "row_refs": [],
                               "reason": "" if present(candidate.get("security_kind"))
                               else "security_kind_not_in_original"}
    checks["quantity"] = {"verified": normalized_present(candidate.get("quantity")),
                          "row_refs": [],
                          "reason": "" if normalized_present(candidate.get("quantity"))
                          else "quantity_not_in_original"}
    ratio = candidate.get("ownership_percent")
    checks["ownership_percent"] = {"verified": True, "row_refs": [], "reason": "ratio_not_claimed_optional"} \
        if ratio in (None, "") else {"verified": normalized_present(ratio), "row_refs": [],
                                     "reason": "" if normalized_present(ratio) else "ratio_not_in_original"}
    checks["note_scope"] = {"verified": True, "row_refs": [], "reason": "stored_response_note_unscoped"}
    date_results = [{"text": clue.get("text"), "role": clue.get("role"),
                     "verified": bool(clue.get("text")) and clue["text"] in xml_text
                     and clue.get("role") in yearend.CITATION_DATE_ROLES,
                     "ambiguous": bool(clue.get("ambiguous"))}
                    for clue in candidate.get("date_clues") or []]
    checks["dates"] = {"verified": bool(date_results) and all(item["verified"] for item in date_results),
                       "bindings": date_results,
                       "reason": "" if (date_results and all(item["verified"] for item in date_results))
                       else "dates_unresolved_or_role_unknown"}
    failed = [name for name, item in checks.items() if not item["verified"]]
    return {"verified": not failed, "checks": checks, "failed": failed}


def _regenerate_comparison(state: Dict[str, Any], request: Dict[str, Any],
                           evidence: Dict[str, Any], proof: Dict[str, Any],
                           *, dry_run: bool = False) -> Dict[str, Any]:
    """Regenerate the subject comparison from verified evidence (or preview it)."""
    subject_name = evidence.get("equity_target_corp") or request.get("equity_target_corp") or ""
    register_dates = [binding for binding in evidence.get("date_bindings", [])
                      if binding.get("role") == "shareholder_register_date" and binding.get("verified")]
    basis_date = register_dates[0]["text"] if register_dates else None
    basis_role = "shareholder_register_date" if register_dates else None
    if dry_run:
        record = (state.get("yearend_comparison") or {}).get(
            yearend.comparison_subject_key(
                subject_name, security_kind=request.get("security_kind"),
                stock_code=request.get("stock_code"),
                target_point=request.get("target_point"),
                input_id=request.get("input_id")) \
            if subject_name else "\0")
        if record is None:
            return {"changed": True}
        latest = record["versions"][-1] if record.get("versions") else None
        if latest is None:
            return {"changed": True}
        current = latest["evidence"]
        same = (current.get("disclosure_quantity") == evidence.get("quantity")
                and current.get("disclosure_ratio_display") == evidence.get("ownership_percent")
                and current.get("evidence_id") == request.get("request_key"))
        return {"changed": not same}
    existing = [row for row in yearend.build_comparison_table(state) if row["name"] == subject_name]
    first = existing[0] if existing else {}
    result = yearend.compare_yearend(
        state, subject_name or request.get("request_key"),
        excel_eval_eok_raw=first.get("excel_eval_eok_raw") or request.get("excel_eval_eok_raw") or "0",
        excel_ratio_display=first.get("excel_ratio_display") or request.get("excel_ratio_display") or "0",
        derived_estimate=first.get("derived_quantity_estimate") or request.get("derived_estimate"),
        price_date=first.get("price_date") or request.get("price_date"),
        disclosure_quantity=evidence.get("quantity"),
        disclosure_ratio_display=evidence.get("ownership_percent"),
        disclosure_basis_date=basis_date,
        disclosure_basis_role=basis_role,
        disclosure_receipt_no=evidence["provenance"]["receipt_no"],
        basis_confirmed=True, scope_confirmed=True,
        security_kind=request.get("security_kind"),
        stock_code=request.get("stock_code"),
        target_point=request.get("target_point"),
        input_id=request.get("input_id"),
        evidence_id=request.get("request_key"),
        note=f"worker verified from {evidence['provenance']['archive_sha256'][:16]}")
    return result
