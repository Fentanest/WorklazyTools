"""Explicitly verified third-party holding observations and conservative reconciliation."""
from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

RECEIPT = re.compile(r"\d{14}\Z")
CORP = re.compile(r"\d{8}\Z")
STOCK = re.compile(r"[0-9A-Z]{6}\Z")
DOCUMENT = re.compile(r"\d+\Z")
SHA = re.compile(r"[a-f0-9]{64}\Z")
DECIMAL = re.compile(r"(?:0|[1-9]\d*)(?:\.\d+)?\Z")
DENOMINATORS = {"shares_etc_total", "issued_shares", "voting_rights"}
OWNER_SCOPES = {"nps_only", "nps_reporting_group"}
NUMERIC_KINDS = {"exact", "lower_bound", "upper_bound", "estimated"}


def _date(value):
    if not isinstance(value, str):
        raise ValueError("EVIDENCE_DATE")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValueError("EVIDENCE_DATE") from None
    if parsed.isoformat() != value:
        raise ValueError("EVIDENCE_DATE")
    return value


def _hash(value):
    if not isinstance(value, str) or not SHA.fullmatch(value):
        raise ValueError("EVIDENCE_HASH")
    return value


def _decimal(value, *, maximum=None):
    if not isinstance(value, str) or not DECIMAL.fullmatch(value):
        raise ValueError("EVIDENCE_DECIMAL")
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        raise ValueError("EVIDENCE_DECIMAL") from None
    if not parsed.is_finite() or parsed < 0 or (maximum is not None and parsed > maximum):
        raise ValueError("EVIDENCE_DECIMAL")
    return format(parsed, "f")


def _identity(fact):
    if not CORP.fullmatch(str(fact.get("corp_code") or "")) or not STOCK.fullmatch(str(fact.get("stock_code") or "")):
        raise ValueError("EVIDENCE_IDENTITY")
    return fact["corp_code"], fact["stock_code"]


def _provenance(fact):
    no, document = fact.get("source_receipt_no"), fact.get("source_document_no")
    if (not isinstance(no, str) or not RECEIPT.fullmatch(no) or
            (document is not None and (not isinstance(document, str) or not DOCUMENT.fullmatch(document)))):
        raise ValueError("EVIDENCE_SOURCE")
    _hash(fact.get("source_document_sha256"))
    _hash(fact.get("source_section_sha256"))
    stamp = fact.get("verified_at")
    try:
        if not isinstance(stamp, str) or datetime.fromisoformat(stamp.replace("Z", "+00:00")).tzinfo is None:
            raise ValueError
    except ValueError:
        raise ValueError("EVIDENCE_VERIFICATION_TIME") from None
    return no, document


def _ratio_basis(fact):
    if fact.get("ratio_denominator") not in DENOMINATORS or fact.get("holder_scope") not in OWNER_SCOPES:
        raise ValueError("EVIDENCE_RATIO_BASIS")


def observation_key(fact):
    return ":".join((fact["source_receipt_no"], fact["source_document_no"] or "-", fact["corp_code"],
                     fact["stock_code"], fact["basis_date"], fact["source_row_sha256"]))


def register_evidence(state, fact):
    """Store a reviewed fact or later invalidation; never infer one from snippets."""
    if not isinstance(fact, dict):
        raise ValueError("EVIDENCE_SHAPE")
    kind = fact.get("kind")
    if kind == "direct_ratio_basis":
        required = {"kind", "direct_receipt_no", "source_document_no", "corp_code", "stock_code", "security_kind", "ratio_denominator",
                    "holder_scope", "basis_date", "basis_kind", "source_document_sha256", "source_section_sha256", "verified_at"}
        optional = {"denominator_quantity", "denominator_date"}
        if not required <= set(fact) or not set(fact) <= required | optional or not RECEIPT.fullmatch(str(fact.get("direct_receipt_no") or "")):
            raise ValueError("EVIDENCE_SHAPE")
        corp, stock = _identity(fact)
        _ratio_basis(fact)
        if fact["security_kind"] not in ("common", "preferred"):
            raise ValueError("EVIDENCE_SECURITY_KIND")
        direct_receipt_date = state.get("receipts", {}).get(fact["direct_receipt_no"], {}).get("receipt_date")
        if (fact["basis_kind"] != "explicit_actual_holding" or
                _date(fact["basis_date"]) > _date(direct_receipt_date)):
            raise ValueError("EVIDENCE_DIRECT_BASIS")
        _hash(fact["source_document_sha256"]); _hash(fact["source_section_sha256"])
        if "denominator_quantity" in fact:
            if Decimal(_decimal(fact["denominator_quantity"])) <= 0:
                raise ValueError("EVIDENCE_RATIO_BASIS")
            if _date(fact.get("denominator_date")) != fact["basis_date"]:
                raise ValueError("EVIDENCE_RATIO_BASIS")
        _provenance({**fact, "source_receipt_no": fact["direct_receipt_no"]})
        receipt = state.get("receipts", {}).get(fact["direct_receipt_no"], {})
        if (receipt.get("corp_code") != corp or receipt.get("stock_code") != stock or
                receipt.get("evidence") not in ("dart_structured", "dart_document")):
            raise ValueError("EVIDENCE_DIRECT_RECEIPT")
        key = fact["direct_receipt_no"]
        ledger = state.setdefault("direct_ratio_basis", {})
    elif kind == "indirect_holding":
        allowed = {"kind", "source_receipt_no", "source_document_no", "source_filing_date", "basis_date",
                   "corp_code", "filer_corp_code", "stock_code", "security_kind", "ownership_percent", "quantity",
                   "numeric_kind", "source_file_sha256", "source_row_sha256", "source_row_offset", "parser_version",
                   "ratio_denominator", "holder_scope", "owner_identity", "basis_kind", "source_status",
                   "source_document_sha256", "source_section_sha256", "issuer_identity_sha256", "verified_at"}
        if set(fact) != allowed:
            raise ValueError("EVIDENCE_SHAPE")
        corp, stock = _identity(fact)
        if not CORP.fullmatch(str(fact.get("filer_corp_code") or "")):
            raise ValueError("EVIDENCE_FILER_IDENTITY")
        _ratio_basis(fact); _provenance(fact); _hash(fact["issuer_identity_sha256"])
        _hash(fact["source_file_sha256"]); _hash(fact["source_row_sha256"])
        if not isinstance(fact["source_row_offset"], int) or fact["source_row_offset"] < 0 or not isinstance(fact["parser_version"], str) or not fact["parser_version"]:
            raise ValueError("EVIDENCE_SOURCE_ROW")
        filed, basis = _date(fact["source_filing_date"]), _date(fact["basis_date"])
        if basis > filed or fact["owner_identity"] != "nps_confirmed" or fact["basis_kind"] != "explicit_actual_holding" or fact["source_status"] != "no_known_correction_or_withdrawal":
            raise ValueError("EVIDENCE_NOT_ACTUAL_HOLDING")
        if fact["security_kind"] not in ("common", "preferred"):
            raise ValueError("EVIDENCE_SECURITY_KIND")
        if fact["numeric_kind"] not in NUMERIC_KINDS:
            raise ValueError("EVIDENCE_NUMERIC_KIND")
        if fact["ownership_percent"] is not None:
            _decimal(fact["ownership_percent"], maximum=100)
        if fact["quantity"] is not None:
            if fact["numeric_kind"] != "exact":
                raise ValueError("EVIDENCE_QUANTITY_BASIS")
            _decimal(fact["quantity"])
        key = observation_key(fact)
        ledger = state.setdefault("indirect_observations", {})
    elif kind == "invalidate_indirect":
        allowed = {"kind", "observation_key", "status", "source_receipt_no", "source_document_no",
                   "source_document_sha256", "source_section_sha256", "verified_at"}
        if set(fact) != allowed or fact.get("status") not in ("corrected", "withdrawn"):
            raise ValueError("EVIDENCE_SHAPE")
        key = fact.get("observation_key")
        if not isinstance(key, str) or key not in state.get("indirect_observations", {}):
            raise ValueError("EVIDENCE_OBSERVATION_MISSING")
        _provenance(fact)
        ledger = state.setdefault("indirect_invalidations", {})
    else:
        raise ValueError("EVIDENCE_KIND")
    prior = ledger.get(key)
    if prior is not None and prior != fact:
        raise ValueError("EVIDENCE_CONFLICT")
    if prior is not None:
        return {"kind": kind, "key": key, "changed": False}
    ledger[key] = dict(fact)
    return {"kind": kind, "key": key, "changed": True}


def _direct_date(receipt, holding):
    return receipt.get("listing_receipt_date") or receipt.get("receipt_date") or holding.get("receipt_date")


def _tracking(percent: str, numeric_kind: str) -> str:
    value = Decimal(percent)
    if numeric_kind == "exact":
        return "active" if value >= 5 else "below-5-percent"
    if numeric_kind == "lower_bound" and value >= 5:
        return "active"
    if numeric_kind == "upper_bound" and value < 5:
        return "below-5-percent"
    return "unknown"


def _unit(entry: dict) -> tuple:
    return tuple(entry[field] for field in
                 ("corp_code", "stock_code", "security_kind", "holder_scope", "ratio_denominator"))


def observation_timeline(state):
    """Order exact or bounded source facts by actual basis date within comparable units."""
    entries = []
    for no, basis in (state.get("direct_ratio_basis") or {}).items():
        receipt = (state.get("receipts") or {}).get(no) or {}
        ratio = receipt.get("company_ownership_percent")
        if (ratio is None or receipt.get("withdrawn_flag") or receipt.get("later_correction_flag")
                or receipt.get("corp_code") != basis.get("corp_code")
                or receipt.get("stock_code") != basis.get("stock_code")):
            continue
        security_kind = basis.get("security_kind") or receipt.get("security_kind")
        if security_kind not in ("common", "preferred"):
            current = (state.get("holdings") or {}).get(basis.get("corp_code")) or {}
            if current.get("receipt_no") == no:
                security_kind = current.get("security_kind")
        if security_kind not in ("common", "preferred"):
            continue
        try:
            normalized_ratio = _decimal(str(ratio), maximum=100)
        except ValueError:
            continue
        entries.append({"key": f"direct:{no}", "source": "direct", "corp_code": basis["corp_code"],
                        "stock_code": basis["stock_code"], "security_kind": security_kind,
                        "holder_scope": basis["holder_scope"], "ratio_denominator": basis["ratio_denominator"],
                        "basis_date": basis["basis_date"], "source_filing_date": _direct_date(receipt, {}),
                        "receipt_no": no, "ownership_percent": normalized_ratio, "numeric_kind": "exact",
                        "quantity": receipt.get("quantity")})
    invalidated = state.get("indirect_invalidations") or {}
    source_holds = state.get("indirect_source_holds") or {}
    incomplete = []
    for key, fact in (state.get("indirect_observations") or {}).items():
        if key in invalidated or fact["source_receipt_no"] in source_holds:
            continue
        entry = {"key": f"indirect:{key}", "source": "indirect", "corp_code": fact["corp_code"],
                        "stock_code": fact["stock_code"], "security_kind": fact["security_kind"],
                        "holder_scope": fact["holder_scope"], "ratio_denominator": fact["ratio_denominator"],
                        "basis_date": fact["basis_date"], "source_filing_date": fact["source_filing_date"],
                        "receipt_no": fact["source_receipt_no"], "ownership_percent": fact["ownership_percent"],
                        "numeric_kind": fact["numeric_kind"], "quantity": fact["quantity"]}
        if fact["ownership_percent"] is None:
            incomplete.append({**entry, "status": "source_ratio_missing", "previous_percent": None,
                               "percentage_point_change": None, "tracking_change": None})
        else:
            entries.append(entry)
    historical = []
    for key, fact in (state.get("verified_historical_observations") or {}).items():
        if fact.get("observation_status") not in (
                "historical_only_ratio_basis_unverified", "historical_only_denominator_date_unverified"):
            continue
        historical.append({"key": f"historical:{key}", "source": "indirect_historical",
            "corp_code": fact["corp_code"], "stock_code": fact["stock_code"],
            "security_kind": fact["security_kind"], "holder_scope": fact["holder_scope"],
            "ratio_denominator": fact["ratio_denominator"], "basis_date": fact["basis_date"],
            "source_filing_date": fact["source_filing_date"], "receipt_no": fact["source_receipt_no"],
            "ownership_percent": fact["ownership_percent"], "numeric_kind": "exact",
            "quantity": fact["quantity"], "status": "source_values_verified_comparison_pending",
            "previous_percent": None, "percentage_point_change": None, "tracking_change": None})
    grouped = {}
    for entry in entries:
        grouped.setdefault(_unit(entry), {}).setdefault(entry["basis_date"], []).append(entry)
    timeline = []
    for dates in grouped.values():
        previous = None
        for _, group in sorted(dates.items()):
            estimates = [item for item in group if item["numeric_kind"] == "estimated"]
            for item in estimates:
                timeline.append({**item, "status": "estimate_not_comparable", "previous_percent": None,
                                 "percentage_point_change": None, "tracking_change": None})
            group = [item for item in group if item["numeric_kind"] != "estimated"]
            if not group:
                continue
            exact = [item for item in group if item["numeric_kind"] == "exact"]
            if exact and len({Decimal(item["ownership_percent"]) for item in exact}) == 1:
                exact_value = Decimal(exact[0]["ownership_percent"])
                compatible_bounds = all(
                    item["numeric_kind"] == "exact" or
                    (item["numeric_kind"] == "lower_bound" and exact_value >= Decimal(item["ownership_percent"])) or
                    (item["numeric_kind"] == "upper_bound" and exact_value <= Decimal(item["ownership_percent"]))
                    for item in group)
                if compatible_bounds:
                    selected = sorted(exact, key=lambda item: (item["source"] != "direct", item["key"]))[0]
                    exact_quantities = {Decimal(str(item["quantity"])) for item in exact if item["quantity"] is not None}
                    if len(exact_quantities) <= 1:
                        delta = (Decimal(selected["ownership_percent"]) - Decimal(previous["ownership_percent"])) if previous and previous["numeric_kind"] == "exact" else None
                        change = None
                        if previous:
                            old = _tracking(previous["ownership_percent"], previous["numeric_kind"])
                            new = _tracking(selected["ownership_percent"], "exact")
                            if old != "unknown" and new != "unknown" and old != new:
                                change = "tracking-exit" if old == "active" else "tracking-reentry"
                        timeline.append({**selected, "status": "verified", "previous_percent": previous["ownership_percent"] if previous else None,
                                         "percentage_point_change": format(delta, "f") if delta is not None else None,
                                         "tracking_change": change})
                        for other in group:
                            if other is not selected:
                                timeline.append({**other, "status": "same_basis_bound_compatible" if other["numeric_kind"] != "exact" else "same_basis_duplicate",
                                                 "previous_percent": None, "percentage_point_change": None,
                                                 "tracking_change": None})
                        previous = selected
                        continue
            if not exact and len(group) > 1:
                lowers = [item for item in group if item["numeric_kind"] == "lower_bound"]
                uppers = [item for item in group if item["numeric_kind"] == "upper_bound"]
                lower = max((Decimal(item["ownership_percent"]) for item in lowers), default=None)
                upper = min((Decimal(item["ownership_percent"]) for item in uppers), default=None)
                if (lower is None or upper is None or lower <= upper):
                    # Keep the tightest source bound. A crossing interval has no
                    # single verified tracking status, so it stays visible only
                    # in the observation list until a more precise fact arrives.
                    selected_kind = "upper_bound" if upper is not None and upper < 5 else "lower_bound"
                    selected_value = upper if selected_kind == "upper_bound" else lower
                    selected = next((item for item in sorted(group, key=lambda row: row["key"])
                                     if item["numeric_kind"] == selected_kind and
                                     Decimal(item["ownership_percent"]) == selected_value), None)
                    if selected is not None and _tracking(selected["ownership_percent"], selected_kind) != "unknown":
                        old = _tracking(previous["ownership_percent"], previous["numeric_kind"]) if previous else "unknown"
                        new = _tracking(selected["ownership_percent"], selected_kind)
                        change = ("tracking-exit" if old == "active" else "tracking-reentry"
                                  if old == "below-5-percent" else None) if old != new else None
                        timeline.append({**selected, "status": "verified", "previous_percent": None,
                                         "percentage_point_change": None, "tracking_change": change})
                        for other in group:
                            if other is not selected:
                                timeline.append({**other, "status": "same_basis_bound_compatible",
                                                 "previous_percent": None, "percentage_point_change": None,
                                                 "tracking_change": None})
                        previous = selected
                        continue
                    for item in group:
                        timeline.append({**item, "status": "compatible_interval_unresolved",
                                         "previous_percent": None, "percentage_point_change": None,
                                         "tracking_change": None})
                    previous = None
                    continue
            signatures = {(item["numeric_kind"], Decimal(item["ownership_percent"]),
                           Decimal(str(item["quantity"])) if item["quantity"] is not None else None)
                          for item in group}
            if len(signatures) > 1:
                for item in group:
                    timeline.append({**item, "status": "same_basis_conflict", "previous_percent": None,
                                     "percentage_point_change": None, "tracking_change": None})
                previous = None
                continue
            selected = sorted(group, key=lambda item: (item["source"] != "direct", item["key"]))[0]
            delta = None
            if previous and previous["numeric_kind"] == selected["numeric_kind"] == "exact":
                delta = Decimal(selected["ownership_percent"]) - Decimal(previous["ownership_percent"])
            change = None
            if previous:
                old_tracking = _tracking(previous["ownership_percent"], previous["numeric_kind"])
                new_tracking = _tracking(selected["ownership_percent"], selected["numeric_kind"])
                if old_tracking != "unknown" and new_tracking != "unknown" and old_tracking != new_tracking:
                    change = "tracking-exit" if old_tracking == "active" else "tracking-reentry"
            timeline.append({**selected, "status": "verified", "previous_percent": previous["ownership_percent"] if previous else None,
                             "percentage_point_change": format(delta, "f") if delta is not None else None,
                             "tracking_change": change})
            for duplicate in group:
                if duplicate is not selected:
                    timeline.append({**duplicate, "status": "same_basis_duplicate", "previous_percent": None,
                                     "percentage_point_change": None, "tracking_change": None})
            previous = selected
    return sorted([*timeline, *historical, *incomplete], key=lambda item: (item["basis_date"], item["key"]))


def reconcile_indirect(state, holdings):
    """Publish one latest comparable observation without guessing missing dates or bases."""
    observations = state.get("indirect_observations") or {}
    invalidated = state.get("indirect_invalidations") or {}
    source_holds = state.get("indirect_source_holds") or {}
    profiles = state.get("direct_ratio_basis") or {}
    timeline = observation_timeline(state)
    by_key = {item["key"]: item for item in timeline}
    by_unit = {}
    for item in timeline:
        by_unit.setdefault(_unit(item), []).append(item)
    holdings_by_corp = {item.get("corp_code"): item for item in holdings}
    new_corp_units = {}
    for key, fact in observations.items():
        if (key not in invalidated and fact["source_receipt_no"] not in source_holds and
                fact["corp_code"] not in holdings_by_corp and
                fact["ownership_percent"] is not None and fact["numeric_kind"] != "estimated"):
            new_corp_units.setdefault(fact["corp_code"], set()).add(_unit(fact))
    reasons = {}
    chosen = {}
    chosen_direct = {}
    conflicted = set()
    for corp, current in holdings_by_corp.items():
        profile = profiles.get(current.get("receipt_no"))
        if not profile:
            continue
        unit = (corp, current.get("stock_code"), current.get("security_kind"),
                profile.get("holder_scope"), profile.get("ratio_denominator"))
        entries = by_unit.get(unit, [])
        if not entries:
            continue
        latest_date = max(item["basis_date"] for item in entries)
        latest = [item for item in entries if item["basis_date"] == latest_date]
        if any(item["status"] == "same_basis_conflict" for item in latest):
            conflicted.add(corp)
            continue
        selected = next((item for item in latest if item["status"] == "verified"), None)
        if not selected or selected["source"] != "direct":
            continue
        if any(receipt.get("corp_code") == corp and no not in profiles and
               no != current.get("receipt_no") and
               (_direct_date(receipt, {}) or "9999-12-31") >= latest_date
               for no, receipt in state.get("receipts", {}).items()
               if receipt.get("evidence") in ("dart_document", "dart_structured", "legacy_history_fact")):
            continue
        chosen_direct[corp] = selected
    for key, fact in sorted(observations.items()):
        corp, stock = fact["corp_code"], fact["stock_code"]
        current = holdings_by_corp.get(corp)
        current_profile = profiles.get(current.get("receipt_no")) if current else None
        unit = _unit(fact)
        entries = by_unit.get(unit, [])
        latest_date = max((item["basis_date"] for item in entries), default=None)
        latest = [item for item in entries if item["basis_date"] == latest_date]
        latest_selected = next((item for item in latest if item["status"] == "verified"), None)
        resolved = by_key.get(f"indirect:{key}")
        reason = None
        if key in invalidated or fact["source_receipt_no"] in source_holds:
            reason = "source_corrected_or_withdrawn"
        elif fact["ownership_percent"] is None:
            reason = "source_ratio_missing"
        elif fact["numeric_kind"] == "estimated":
            reason = "estimate_not_applicable"
        elif state.get("universe", {}).get(corp, {}).get("stock_code") != stock or (current and current.get("stock_code") != stock):
            reason = "issuer_identity_unverified"
        elif not current and len(new_corp_units.get(corp, ())) > 1:
            reason = "comparison_scope_unverified"
        elif current and current.get("latest_unresolved_receipt"):
            reason = "newer_direct_unresolved"
        elif current and not current_profile:
            reason = "ratio_basis_unverified"
        elif current and (current_profile["ratio_denominator"] != fact["ratio_denominator"] or
                          current_profile["holder_scope"] != fact["holder_scope"]):
            reason = "ratio_basis_unverified"
        elif current and current.get("security_kind") != fact["security_kind"]:
            reason = "security_kind_unverified"
        elif any(receipt.get("corp_code") == corp and no not in profiles and
                 no != (current.get("receipt_no") if current else None) and
                 (_direct_date(receipt, {}) or "9999-12-31") >= fact["basis_date"]
                 for no, receipt in state.get("receipts", {}).items()
                 if receipt.get("evidence") in ("dart_document", "dart_structured", "legacy_history_fact")):
            reason = "newer_direct_basis_unverified"
        elif latest and any(item["status"] == "same_basis_conflict" for item in latest):
            reason = "same_basis_conflict" if fact["basis_date"] == latest_date else "newer_conflict_pending"
            if current and current_profile and fact["basis_date"] == latest_date:
                conflicted.add(corp)
        elif not resolved or resolved["status"] != "verified":
            reason = resolved["status"] if resolved else "source_fact_unverified"
        elif fact["basis_date"] != latest_date:
            reason = "basis_not_newer_than_direct" if any(item["source"] == "direct" for item in latest) else "superseded_by_newer_observation"
        elif latest_selected is None or latest_selected["key"] != f"indirect:{key}":
            reason = "same_basis_duplicate"
        if reason is None:
            chosen[corp] = (fact, key, resolved)
        reasons[key] = reason
    for corp in conflicted:
        chosen.pop(corp, None)
    selected_keys = {key for _, key, _ in chosen.values()}
    published = []
    for key, fact in sorted(observations.items()):
        resolved = by_key.get(f"indirect:{key}")
        reason = reasons[key]
        published.append({"observationKey": key, "corpCode": fact["corp_code"],
            "stockCode": fact["stock_code"], "ownershipPercent": fact["ownership_percent"],
            "numericKind": fact["numeric_kind"], "basisDate": fact["basis_date"],
            "filingDate": fact["source_filing_date"], "receiptNo": fact["source_receipt_no"],
            "documentNo": fact["source_document_no"], "sourceSha256": fact["source_section_sha256"],
            "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={fact['source_receipt_no']}",
            "appliedToHolding": key in selected_keys, "reason": reason,
            "percentagePointChange": resolved["percentage_point_change"] if resolved else None,
            "trackingChange": resolved["tracking_change"] if resolved else None})
    result = []
    for source in [*holdings, *({"corp_code": corp, "stock_code": fact["stock_code"],
                                "name": state["universe"][corp].get("name") or "",
                                "security_kind": fact["security_kind"], "quantity": None,
                                "receipt_no": fact["source_receipt_no"],
                                "receipt_date": fact["source_filing_date"]}
                               for corp, (fact, _, _) in chosen.items() if corp not in holdings_by_corp)]:
        row = dict(source)
        corp = row.get("corp_code")
        if corp in conflicted:
            row.update(company_ownership_percent=None, quantity=None, tracking="unknown",
                       latest_unresolved_receipt=row.get("receipt_no"),
                       latest_unresolved_reason="same_basis_observation_conflict",
                       observation_status="same_basis_conflict")
        elif corp in chosen:
            fact, key, resolved = chosen[corp]
            old_no = row.get("receipt_no") if corp in holdings_by_corp else None
            row.update(receipt_no=fact["source_receipt_no"], receipt_date=fact["source_filing_date"],
                       holding_date=fact["basis_date"], quantity=fact["quantity"],
                       company_ownership_percent=fact["ownership_percent"],
                       tracking=_tracking(fact["ownership_percent"], fact["numeric_kind"]),
                       evidence="indirect_observation", corporate_action_status="unverified",
                       observation_status="verified", ownership_numeric_kind=fact["numeric_kind"],
                       indirect_source={"document_no": fact["source_document_no"],
                                        "section_sha256": fact["source_section_sha256"],
                                        "basis_date": fact["basis_date"], "direct_receipt_no": old_no,
                                        "ratio_denominator": fact["ratio_denominator"]})
        elif corp in chosen_direct:
            selected = chosen_direct[corp]
            receipt = state["receipts"][selected["receipt_no"]]
            row.update(receipt_no=selected["receipt_no"], receipt_date=selected["source_filing_date"],
                       holding_date=selected["basis_date"], quantity=receipt.get("quantity"),
                       company_ownership_percent=selected["ownership_percent"],
                       tracking=_tracking(selected["ownership_percent"], "exact"),
                       security_kind=selected["security_kind"], evidence=receipt.get("evidence"),
                       observation_status="verified", ownership_numeric_kind="exact")
            if selected["receipt_no"] != source.get("receipt_no"):
                row["corporate_action_status"] = "unverified"
        result.append(row)
    events = []
    for key, fact in sorted(observations.items()):
        resolved = by_key.get(f"indirect:{key}")
        if (not resolved or resolved["status"] != "verified" or key in invalidated or
                fact["source_receipt_no"] in source_holds or
                state.get("universe", {}).get(fact["corp_code"], {}).get("stock_code") != fact["stock_code"]):
            continue
        events.append({"observation_key": key, "receipt_no": fact["source_receipt_no"],
                       "receipt_date": fact["source_filing_date"], "basis_date": fact["basis_date"],
                       "corp_code": fact["corp_code"],
                       "stock_code": fact["stock_code"], "kind": resolved["tracking_change"] or "other",
                       "correction_of": None, "quantity": fact["quantity"],
                       "company_ownership_percent": fact["ownership_percent"],
                       "numeric_kind": fact["numeric_kind"], "source": "indirect_observation",
                       "percentage_point_change": resolved["percentage_point_change"]})
    return result, events, published
