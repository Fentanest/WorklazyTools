"""Year-end Excel reconciliation as a separate input/comparison layer.

This module connects the existing FolioTrace pipeline without altering its
contracts:

- Excel originals and derived quantities live in dedicated ledgers
  (``yearend_excel_inputs`` / ``yearend_derived_quantities`` /
  ``yearend_comparison``).  They are never written into
  ``indirect_observations`` / ``direct_ratio_basis`` and no DART receipt
  number or original basis is fabricated for them.
- ``pipeline.foliotrace.indirect.register_evidence`` is not modified here:
  it still requires ``basis_kind == "explicit_actual_holding"``,
  ``numeric_kind == "exact"`` when a quantity is present, and
  ``denominator_date == basis_date`` when a denominator is present.
- Citation handling never auto-registers an ``indirect_holding``.  A single
  cited filing plus a quantity match does not yield an obligation date.
- All date roles (receipt / obligation / writing-basis / transaction /
  shareholder-register) are preserved as separate candidates; no field is
  batch-assigned as ``basis_date`` for every quantity.
- Operational LLM calls stay behind an injectable adapter.  Offline checks
  use stored responses or explicit test doubles, and a test-double success
  is never reported as real extraction accuracy.
- Stored archives are verified (bytes, ZIP hash, inner file, inner hash)
  before use and reparsed from bytes only; no network is used.
- Only ``DART_API_KEY`` enables the DART path.  ``TYPESAFE_API_KEY`` and
  other service keys are never substituted.  Callers inject the environment
  mapping explicitly; this module never reads ``os.environ`` itself.

Comparison records are versioned: the Excel original is immutable while the
comparison view is regenerated whenever evidence is added.  Re-running with
identical input and identical evidence is idempotent and creates nothing.
"""
from __future__ import annotations

import copy
import hashlib
import re
import zipfile
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict


WON_PER_EOK = Decimal("100000000")
PRICE_DATE_2025_LAST_TRADE = "2025-12-30"
REGISTER_DATE_2025_CLOSE = "2025-12-31"

FOLLOWUP_STATES = frozenset({
    "pending_search",
    "missing_original",
    "search_zero_results",
    "ambiguous_candidates",
    "network_error",
    "quota_exhausted",
    "value_conflict",
    "citation_cycle_hold",
    "recitation_not_new_trade",
    "comparison_pending_hold",
    "resolved_verified_hold",
})

# Terminal states a worker may only enter with attached verification proof.
VERIFIED_TERMINAL_STATES = frozenset({"resolved_verified_hold"})

CITATION_DATE_ROLES = frozenset({
    "receipt_date",
    "obligation_date",
    "writing_basis_date",
    "transaction_date",
    "shareholder_register_date",
    "filing_date",
})

SHA256 = re.compile(r"[a-f0-9]{64}\Z")


class DateClue(TypedDict, total=False):
    text: str
    role: str
    ambiguous: bool


class CitationClue(TypedDict, total=False):
    source_receipt_no: str
    source_row_offset: int
    source_text: str
    # Archive / file provenance (ZIP + inner file identity + hashes).
    archive_sha256: str
    inner_file_name: str
    inner_file_sha256: str
    # Table / row / column / note position.
    table_title: str
    row_index: int
    column_name: str
    note_text: str
    # Which fields the note applies to (never "all rows / all values" by default).
    applies_to_fields: List[str]
    # Document / filer / holder / equity-target identity.
    document_target_corp: str
    filer_name: str
    holder_name: str
    equity_target_corp: str
    # Security kind + holder aggregation scope.
    security_kind: str
    holder_aggregation_scope: str
    # Date clues with roles; empty list is valid (dateless notes stay dateless).
    date_clues: List[DateClue]
    # Original-filing candidates + original evidence (receipt numbers only when found).
    original_candidates: List[str]
    original_evidence: str
    is_nps_claim: bool


# ---------------------------------------------------------------------------
# Numeric normalization (format-insensitive compare, strict rejection)
# ---------------------------------------------------------------------------

def normalize_number(value: Any, *, field: str = "quantity",
                     allow_negative: bool = False) -> str:
    """Normalize a numeric writing to a canonical decimal string.

    ``1,000`` and ``1000`` compare equal while the original writing is kept
    by the caller.  ``None``/``""`` raise ``YEAREND_NUMERIC_MISSING`` so a
    zero value and a missing value are never confused.  Negatives (unless
    explicitly allowed), NaN and Infinity raise instead of flowing into a
    quantity or an evaluation.
    """
    if value is None or (isinstance(value, str) and value.strip() == ""):
        raise ValueError("YEAREND_NUMERIC_MISSING")
    if isinstance(value, bool):
        raise ValueError("YEAREND_NUMERIC_SHAPE")
    text = str(value).strip().replace(",", "").replace(" ", "").replace("_", "")
    if re.fullmatch(r"[+-]?(nan|inf|infinity)", text, re.I):
        raise ValueError("YEAREND_NUMERIC_NONFINITE")
    try:
        number = Decimal(text)
    except InvalidOperation:
        raise ValueError("YEAREND_NUMERIC_SHAPE") from None
    if not number.is_finite():
        raise ValueError("YEAREND_NUMERIC_NONFINITE")
    if not allow_negative and number < 0:
        raise ValueError("YEAREND_NUMERIC_NEGATIVE")
    return format(number, "f")


def _equal_numeric(left: Any, right: Any) -> Optional[bool]:
    """Tri-state numeric equality on normalized values; None when incomparable."""
    try:
        return Decimal(normalize_number(left)) == Decimal(normalize_number(right))
    except ValueError as exc:
        if str(exc) == "YEAREND_NUMERIC_MISSING":
            return None
        raise


# ---------------------------------------------------------------------------
# Raw Excel handling (structure-preserving, no quantity column invented)
# ---------------------------------------------------------------------------

def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _shared_strings(shared_xml: str) -> List[str]:
    """Join every <t> run inside one <si> so rich-text cells keep identity."""
    if not shared_xml:
        return []
    names: List[str] = []
    for item in re.finditer(r"<si\b[^>]*>(.*?)</si>", shared_xml, re.S):
        runs = re.findall(r"<t[^>]*>(.*?)</t>", item.group(1), re.S)
        text = "".join(re.sub(r"<[^>]+>", "", run) for run in runs)
        names.append(text.replace("&amp;", "&").replace("&lt;", "<")
                     .replace("&gt;", ">").replace("&quot;", '"')
                     .replace("&apos;", "'"))
    return names


def parse_yearend_workbook(payload: bytes) -> Dict[str, Any]:
    """Extract year-end rows preserving raw cell strings and hashes.

    Takes stored ``.xlsx`` bytes only; performs no network I/O.  Cells are
    mapped by column letter (A-E), so a missing cell never shifts later
    columns into the wrong field.  A data row (numeric sequence in A) without
    a name in B raises instead of being silently misread; only non-data rows
    (headers, titles) are skipped.
    """
    archive_sha = hashlib.sha256(payload).hexdigest()
    try:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            try:
                sheet_xml = archive.read("xl/worksheets/sheet1.xml").decode("utf-8")
            except KeyError:
                raise ValueError("YEAREND_SHEET_MISSING") from None
            try:
                shared_xml = archive.read("xl/sharedStrings.xml").decode("utf-8")
            except KeyError:
                shared_xml = ""
    except zipfile.BadZipFile:
        raise ValueError("YEAREND_NOT_A_WORKBOOK") from None
    names = _shared_strings(shared_xml)
    rows: List[Dict[str, Any]] = []
    for match in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet_xml, re.S):
        row_no = int(match.group(1))
        if row_no < 8:
            continue
        body = match.group(2)
        cells: Dict[str, str] = {}
        for cell in re.finditer(r'<c r="([A-Z]+)%d"(.*?)>(.*?)</c>' % row_no, body, re.S):
            column, attrs, inner = cell.group(1), cell.group(2), cell.group(3)
            value_match = re.search(r"<v>(.*?)</v>", inner, re.S)
            raw = value_match.group(1).strip() if value_match else ""
            if 't="s"' in attrs:
                try:
                    raw = names[int(raw)]
                except (ValueError, IndexError):
                    raise ValueError("YEAREND_SHARED_STRING_REF") from None
            cells[column] = raw
        seq_raw = cells.get("A", "")
        if not seq_raw.isdigit():
            continue
        if not cells.get("B"):
            raise ValueError("YEAREND_NAME_CELL_MISSING")
        rows.append({
            "row_number": row_no,
            "seq_raw": seq_raw,
            "name": cells.get("B", ""),
            "eval_eok_raw": cells.get("C", ""),  # raw <v> text, e.g. '4240.6411091999998'
            "weight_raw": cells.get("D", ""),
            "ratio_raw": cells.get("E", ""),     # raw scientific notation preserved
            "row_sha256": _sha(match.group(0)),
        })
    if not rows:
        raise ValueError("YEAREND_NO_DATA_ROWS")
    return {"workbook_sha256": archive_sha, "row_count": len(rows), "rows": rows}


def evaluation_won(eval_eok_raw: str) -> Dict[str, str]:
    """Convert the raw 억원 cell to won without hiding precision."""
    try:
        raw = Decimal(normalize_number(eval_eok_raw, field="evaluation"))
    except ValueError as exc:
        if str(exc) == "YEAREND_NUMERIC_MISSING":
            raise ValueError("YEAREND_EVAL_MISSING") from None
        raise ValueError("YEAREND_EVAL_SHAPE") from None
    won = raw * WON_PER_EOK
    return {
        "eval_eok_raw": eval_eok_raw,
        "eval_won_exact": format(won, "f"),
        "unit": "KRW",
        "unit_conversion": "1eok_KRW_equals_100000000_KRW",
        "float_storage_note": "raw_cell_may_carry_binary_float_repr",
    }


def derive_quantity_estimate(eval_eok_raw: str, price_won: str, price_date: str) -> Dict[str, Any]:
    """Derive a quantity estimate from evaluation / price; never an official balance.

    Preserves the raw evaluation, the price and its date, the pre-rounding
    quotient, the rounding method, and the residual in won.  The result key is
    ``derived_quantity_estimate`` — it must not be relabelled as an official
    holding quantity.
    """
    try:
        price = Decimal(normalize_number(price_won, field="price"))
        converted = evaluation_won(eval_eok_raw)
        won = Decimal(converted["eval_won_exact"])
    except ValueError:
        raise
    if price <= 0:
        raise ValueError("YEAREND_PRICE_SHAPE")
    quotient = won / price
    rounded = quotient.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    residual = won - rounded * price
    return {
        "kind": "derived_quantity_estimate",
        "eval_eok_raw": eval_eok_raw,
        "eval_won_exact": converted["eval_won_exact"],
        "price_won": format(price, "f"),
        "price_date": price_date,
        "price_date_role": "price_reference_date_not_holding_basis",
        "quantity_basis_date": None,
        "quantity_basis_status": "unconfirmed_derived_not_disclosure_confirmed",
        "pre_round_quotient": format(quotient, "f"),
        "derived_quantity_estimate": format(rounded, "f"),
        "rounding": "ROUND_HALF_UP_to_integer",
        "residual_won": format(residual, "f"),
    }


def classify_ratio_compatibility(quantity: str, denominator: str,
                                 displayed_ratio_percent: str) -> Dict[str, Any]:
    """Check whether one denominator reproduces a displayed ratio.

    Returns compatibility only — never "denominator proven" and never a
    confirmed single cause.  Callers must keep the competing explanations
    (quantity difference vs denominator assumption) as unresolved candidates.
    """
    try:
        qty = Decimal(normalize_number(quantity))
        denom = Decimal(normalize_number(denominator, field="denominator"))
        shown = Decimal(normalize_number(displayed_ratio_percent, field="ratio"))
    except ValueError:
        raise ValueError("YEAREND_RATIO_SHAPE") from None
    if denom <= 0:
        raise ValueError("YEAREND_RATIO_SHAPE")
    exact = qty / denom * Decimal(100)
    scale = Decimal(1).scaleb(shown.as_tuple().exponent)
    reproduces = exact.quantize(scale, rounding=ROUND_HALF_UP) == shown
    return {
        "reproduces_display_with_this_denominator": reproduces,
        "exact_percent": format(exact, "f"),
        "displayed_percent": format(shown, "f"),
        # Deliberately non-committal: reproducibility is not proof of use.
        "denominator_status": "compatible_candidate_not_proven" if reproduces else "incompatible_with_this_denominator",
        "cause_status": "unresolved_quantity_vs_denominator_assumption",
    }


# ---------------------------------------------------------------------------
# Separate ledgers (never indirect_observations)
# ---------------------------------------------------------------------------

YEAREND_KEYS = ("yearend_excel_inputs", "yearend_derived_quantities",
                "yearend_comparison", "citation_followup_queue",
                "yearend_archive_registry")


def ensure_yearend_ledgers(state: Dict[str, Any]) -> Dict[str, Any]:
    for key in YEAREND_KEYS:
        state.setdefault(key, {})
    return state


def _store_unique(ledger: Dict[str, Any], key: str, value: Dict[str, Any], code: str) -> Dict[str, Any]:
    prior = ledger.get(key)
    if prior is not None:
        if prior != value:
            raise ValueError(code)
        return {"key": key, "changed": False}
    ledger[key] = copy.deepcopy(value)
    return {"key": key, "changed": True}


def store_excel_input(state: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
    """Preserve one Excel row as an immutable input record (not an observation)."""
    ensure_yearend_ledgers(state)
    required = {"name", "eval_eok_raw", "weight_raw", "ratio_raw", "row_sha256", "workbook_sha256"}
    if not required <= set(row):
        raise ValueError("YEAREND_INPUT_SHAPE")
    key = f"{row['workbook_sha256'][:16]}:{row['row_sha256'][:16]}:{row['name']}"
    return _store_unique(state["yearend_excel_inputs"], key, row, "YEAREND_INPUT_CONFLICT")


def store_derived_quantity(state: Dict[str, Any], name: str, derived: Dict[str, Any]) -> Dict[str, Any]:
    ensure_yearend_ledgers(state)
    if derived.get("kind") != "derived_quantity_estimate":
        raise ValueError("YEAREND_DERIVED_KIND")
    key = f"{name}:{derived.get('price_date')}:{derived.get('price_won')}"
    return _store_unique(state["yearend_derived_quantities"], key, {**derived, "name": name},
                         "YEAREND_DERIVED_CONFLICT")


def comparison_subject_key(name: str, *, security_kind: Optional[str] = None,
                           stock_code: Optional[str] = None,
                           target_point: Optional[str] = None,
                           input_id: Optional[str] = None) -> str:
    """Distinguish comparisons by input, security, target point and evidence scope.

    A bare name alone never merges different inputs, securities, target
    points or evidence scopes.
    """
    parts = [name]
    if stock_code:
        parts.append(f"code:{stock_code}")
    if security_kind:
        parts.append(f"sec:{security_kind}")
    if target_point:
        parts.append(f"asof:{target_point}")
    if input_id:
        parts.append(f"input:{input_id}")
    return "|".join(parts)


def assess_comparison(*, derived_estimate: Optional[str] = None,
                      excel_ratio_display: Optional[str] = None,
                      disclosure_quantity: Optional[str] = None,
                      disclosure_ratio_display: Optional[str] = None,
                      disclosure_basis_date: Optional[str] = None,
                      disclosure_basis_role: Optional[str] = None,
                      basis_confirmed: bool = False,
                      scope_confirmed: bool = False) -> str:
    """Assess equality and comparability without inventing a discrepancy.

    Arithmetic equality and a confirmed balance are reported separately: equal
    numbers with unconfirmed basis/scope yield ``values_match_basis_unconfirmed``,
    never a discrepancy and never a confirmation.  A discrepancy requires
    actually differing values.
    """
    has_disclosure = disclosure_quantity is not None or disclosure_ratio_display is not None
    if not has_disclosure:
        return "comparison_pending_hold"
    qty_equal = _equal_numeric(derived_estimate, disclosure_quantity) \
        if derived_estimate is not None and disclosure_quantity is not None else None
    ratio_equal = _equal_numeric(excel_ratio_display, disclosure_ratio_display) \
        if excel_ratio_display is not None and disclosure_ratio_display is not None else None
    compared = [value for value in (qty_equal, ratio_equal) if value is not None]
    if not compared:
        return "comparison_pending_hold"
    basis_given = bool(disclosure_basis_date and disclosure_basis_role)
    if all(compared):
        if basis_confirmed and scope_confirmed:
            return "values_match_basis_confirmed"
        return "values_match_basis_unconfirmed"
    if basis_given:
        return "discrepancy_unexplained"
    return "values_differ_basis_unconfirmed"


def compare_yearend(state: Dict[str, Any], name: str, *,
                    excel_eval_eok_raw: str,
                    excel_ratio_display: str,
                    derived_estimate: Optional[str],
                    price_date: Optional[str],
                    disclosure_quantity: Optional[str] = None,
                    disclosure_ratio_display: Optional[str] = None,
                    disclosure_basis_date: Optional[str] = None,
                    disclosure_basis_role: Optional[str] = None,
                    disclosure_receipt_no: Optional[str] = None,
                    denominator_quantity: Optional[str] = None,
                    denominator_date: Optional[str] = None,
                    basis_confirmed: bool = False,
                    scope_confirmed: bool = False,
                    security_kind: Optional[str] = None,
                    stock_code: Optional[str] = None,
                    target_point: Optional[str] = None,
                    input_id: Optional[str] = None,
                    evidence_id: Optional[str] = None,
                    hold_reason: Optional[str] = None,
                    note: str = "") -> Dict[str, Any]:
    """Record or regenerate a per-subject comparison; originals stay immutable.

    The Excel original stored on first write wins; a conflicting original for
    the same subject raises ``YEAREND_INPUT_CONFLICT`` instead of overwriting.
    Added evidence appends a new version (with its change note) and refreshes
    the latest view.  Identical input with identical evidence is idempotent.
    Past quantities and later-denominator recalculated ratios live in distinct
    fields and are never merged into one balance.  Nothing is written to
    ``indirect_observations``.  An explicitly passed ``hold_reason`` records
    the caller's judgment; otherwise the status is assessed from the values.
    """
    ensure_yearend_ledgers(state)
    subject = comparison_subject_key(name, security_kind=security_kind,
                                     stock_code=stock_code, target_point=target_point,
                                     input_id=input_id)
    ledger = state["yearend_comparison"]
    record = ledger.get(subject)
    excel_snapshot = {"excel_eval_eok_raw": excel_eval_eok_raw,
                      "excel_ratio_display": excel_ratio_display,
                      "derived_quantity_estimate": derived_estimate,
                      "price_date": price_date}
    if record is None:
        record = {
            "subject_key": subject,
            "name": name,
            "stock_code": stock_code,
            "stock_code_status": "provided_unverified" if stock_code else "unconfirmed",
            "security_kind": security_kind,
            "target_point": target_point,
            "input_id": input_id,
            **excel_snapshot,
            "price_date_role": "price_reference_date_not_holding_basis",
            "versions": [],
            "overwrite_performed": False,
        }
    elif any(record.get(field) != value for field, value in excel_snapshot.items()):
        raise ValueError("YEAREND_INPUT_CONFLICT")
    evidence = {
        "disclosure_quantity": disclosure_quantity,
        "disclosure_ratio_display": disclosure_ratio_display,
        "disclosure_basis_date": disclosure_basis_date,
        "disclosure_basis_role": disclosure_basis_role,
        "disclosure_receipt_no": disclosure_receipt_no,
        "denominator_quantity": denominator_quantity,
        "denominator_date": denominator_date,
        "basis_confirmed": bool(basis_confirmed),
        "scope_confirmed": bool(scope_confirmed),
        "evidence_id": evidence_id,
    }
    latest = record["versions"][-1] if record["versions"] else None
    if latest is not None and latest["evidence"] == evidence and latest.get("hold_reason") == hold_reason:
        return {"key": subject, "changed": False,
                "state": record["status"], "version": latest["version"]}
    status = hold_reason or assess_comparison(
        derived_estimate=derived_estimate, excel_ratio_display=excel_ratio_display,
        disclosure_quantity=disclosure_quantity, disclosure_ratio_display=disclosure_ratio_display,
        disclosure_basis_date=disclosure_basis_date, disclosure_basis_role=disclosure_basis_role,
        basis_confirmed=basis_confirmed, scope_confirmed=scope_confirmed)
    version = {"version": len(record["versions"]) + 1, "evidence": evidence,
               "status": status, "hold_reason": hold_reason, "note": note}
    record["versions"].append(copy.deepcopy(version))
    record.update({
        **{key: evidence[key] for key in evidence},
        "status": status,
        "latest_hold_reason": hold_reason,
    })
    ledger[subject] = record
    return {"key": subject, "changed": True, "state": status, "version": version["version"]}


def comparison_history(state: Dict[str, Any], subject: str) -> List[Dict[str, Any]]:
    record = (state.get("yearend_comparison") or {}).get(subject) or {}
    return copy.deepcopy(record.get("versions", []))


def build_comparison_table(state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return per-subject original / estimate / disclosure / hold-reason rows."""
    rows = []
    for subject, value in sorted((state.get("yearend_comparison") or {}).items()):
        row = dict(value)
        row.pop("versions", None)
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# Citation clues, regex hints (auxiliary only), and the follow-up queue
# ---------------------------------------------------------------------------

CITATION_HINT = re.compile(
    r"(대량보유|대량소유|5%\s*이상|주주명부|주식\s*분포|주주에\s*관한\s*사항|"
    r"최대주주|보고의무발생일|작성기준일|공시기준|기준일)",
)


def regex_citation_hint(text: str) -> Optional[str]:
    """Auxiliary hint only; absence never drops a note from review."""
    if CITATION_HINT.search(text or ""):
        return "citation_keyword_hint"
    return None


def classify_note_for_review(text: str, mentions_nps: bool, has_equity_context: bool) -> str:
    """Keep structurally uninterpreted NPS tables/notes as review targets.

    A regex miss must not permanently exclude a National Pension related
    table or note; such rows stay ``structure_review_pending``.
    """
    if mentions_nps and has_equity_context:
        return "citation_review_pending"
    if mentions_nps:
        return "structure_review_pending"
    if regex_citation_hint(text):
        return "citation_review_pending"
    return "no_nps_mention"


def enqueue_citation_followup(state: Dict[str, Any], request_key: str,
                              clue: Dict[str, Any]) -> Dict[str, Any]:
    """Idempotent enqueue; reports exactly what persisted.

    ``changed`` is True whenever the persisted queue entry mutated (new item,
    state transition, history append, conflicting-clue preservation) and False
    only when nothing was written.  ``state_changed`` isolates the status
    transition.  A conflicting clue for a known key moves the item to
    ``value_conflict`` while preserving both the original and the newcomer.
    Clues are deep-copied so later caller-side mutation cannot alter history.
    """
    ensure_yearend_ledgers(state)
    if not isinstance(clue, dict):
        raise ValueError("YEAREND_CLUE_SHAPE")
    queue = state["citation_followup_queue"]
    snapshot = copy.deepcopy(queue.get(request_key))
    if request_key in queue:
        stored = queue[request_key]
        if stored.get("clue") != clue:
            stored.setdefault("conflicting_clues", []).append(copy.deepcopy(clue))
            stored["history"].append({"outcome": "value_conflict",
                                      "note": "same request key carries a different clue; both preserved"})
            stored["state"] = "value_conflict"
            stored["resume_count"] = stored.get("resume_count", 0) + 1
            changed = snapshot != queue[request_key]
            return {"key": request_key, "changed": changed, "state_changed": True,
                    "history_appended": True, "state": "value_conflict"}
        return {"key": request_key, "changed": False, "state_changed": False,
                "history_appended": False, "state": stored["state"]}
    queue[request_key] = {"request_key": request_key, "clue": copy.deepcopy(clue),
                          "conflicting_clues": [],
                          "state": "pending_search", "history": [], "resume_count": 0}
    return {"key": request_key, "changed": True, "state_changed": True,
            "history_appended": False, "state": "pending_search"}


def advance_followup(state: Dict[str, Any], request_key: str, outcome: str, *,
                     note: str = "", verification: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Append one outcome to the item history; verified completion needs proof.

    Every call that mutates the persisted entry reports ``changed`` True, so
    an runner using it as the save signal can never lose history or resume
    counters.  ``state_changed`` tells a status transition apart from a
    history-only append.  Verified terminal states (``resolved_verified_hold``)
    require a ``verification`` proof naming the used original, its position
    and the checked fields; requesting them without proof raises instead of
    persisting an unfounded completion.
    """
    ensure_yearend_ledgers(state)
    if outcome not in FOLLOWUP_STATES:
        raise ValueError("YEAREND_FOLLOWUP_STATE")
    item = state["citation_followup_queue"].get(request_key)
    if item is None:
        raise ValueError("YEAREND_FOLLOWUP_MISSING")
    if outcome in VERIFIED_TERMINAL_STATES:
        required = {"archive_sha256", "inner_file_name", "row_refs", "checked_fields"}
        if (not isinstance(verification, dict) or not required <= set(verification)
                or not verification["checked_fields"]
                or (not verification["row_refs"]
                    and not verification.get("text_spans"))):
            raise ValueError("YEAREND_VERIFY_REQUIRED")
        item["verification"] = copy.deepcopy(verification)
    before_state = item["state"]
    item["history"].append({"outcome": outcome, "note": note})
    item["state"] = outcome
    item["resume_count"] = item.get("resume_count", 0) + 1
    return {"key": request_key, "changed": True,
            "state_changed": before_state != outcome,
            "history_appended": True, "state": outcome}


def detect_citation_cycle(chain: List[str]) -> bool:
    """True when a citation chain revisits a receipt (A cites B cites A)."""
    return len(set(chain)) != len(chain)


def verify_citation_against_original(cited_quantity: Optional[str],
                                     original_quantity: Optional[str]) -> str:
    """Compare an inline citation against its secured original.

    Never registers an observation and never derives an obligation date.
    Format differences (``1,000`` vs ``1000``) are normalized before compare.
    Equal numbers report ``values_match_basis_unconfirmed`` — arithmetic
    equality, not a confirmed balance, holder, or date — while missing values
    stay pending and differing values conflict.
    """
    if cited_quantity is None or original_quantity is None:
        return "comparison_pending_hold"
    try:
        equal = _equal_numeric(cited_quantity, original_quantity)
    except ValueError:
        raise
    if equal is None:
        return "comparison_pending_hold"
    if not equal:
        return "value_conflict"
    return "values_match_basis_unconfirmed"


# ---------------------------------------------------------------------------
# Archive verification, stored-archive replay (offline-safe)
# ---------------------------------------------------------------------------

def _candidate_archive_files(archive_dir: Optional[Path], receipt_no: str,
                             entry: Dict[str, Any]) -> List[Path]:
    candidates: List[Path] = []
    if archive_dir is None:
        return candidates
    base = Path(archive_dir)
    declared = entry.get("archive_path")
    if declared:
        candidates.append(base / str(declared))
    candidates.append(base / f"{receipt_no}.zip")
    candidates.extend(sorted(base.glob(f"{receipt_no}-*.zip")))
    seen, ordered = set(), []
    for path in candidates:
        if path not in seen:
            seen.add(path)
            ordered.append(path)
    return ordered


def lookup_original(cache: Dict[str, Any], receipt_no: str, *,
                    archive_dir: Optional[Path] = None,
                    archive_bytes: Optional[bytes] = None,
                    inner_file_name: Optional[str] = None) -> Dict[str, Any]:
    """Verify a stored original; metadata claims alone never hit.

    Returns ``archive_hit`` only after real bytes were found, their SHA-256
    matches a well-formed expected hash, the ZIP opens, the needed inner file
    exists and its hash matches.  A metadata-only claim yields
    ``origin_unverified_cache_claim``; extraction metadata without bytes yields
    ``extraction_cache_only_no_archive``.  Missing files, hash mismatches,
    corrupt ZIPs and missing inner files each have their own status.
    """
    entry = (cache or {}).get(receipt_no)
    if entry is None:
        return {"status": "missing_original", "receipt_no": receipt_no}
    expected = entry.get("archive_sha256") or entry.get("archive_bytes_sha256")
    if not isinstance(expected, str) or not SHA256.fullmatch(expected):
        return {"status": "origin_hash_unusable", "receipt_no": receipt_no}
    payload: Optional[bytes] = archive_bytes
    source: Optional[str] = "supplied_bytes" if payload is not None else None
    if payload is None:
        for path in _candidate_archive_files(archive_dir, receipt_no, entry):
            if path.is_file():
                try:
                    payload = path.read_bytes()
                except OSError:
                    continue
                source = str(path)
                break
    if payload is None:
        if entry.get("source_claims") is not None or entry.get("source_mention_count") is not None:
            return {"status": "extraction_cache_only_no_archive", "receipt_no": receipt_no}
        return {"status": "origin_unverified_cache_claim", "receipt_no": receipt_no}
    if hashlib.sha256(payload).hexdigest() != expected:
        return {"status": "archive_hash_mismatch", "receipt_no": receipt_no, "source": source}
    try:
        archive = zipfile.ZipFile(BytesIO(payload))
    except zipfile.BadZipFile:
        return {"status": "archive_corrupt", "receipt_no": receipt_no, "source": source}
    with archive:
        names = [name for name in archive.namelist()
                 if name.lower().endswith(".xml") and not name.startswith("/") and ".." not in name]
        wanted = inner_file_name or entry.get("inner_file_name")
        if wanted is not None:
            if wanted not in names:
                return {"status": "inner_file_missing", "receipt_no": receipt_no,
                        "source": source, "inner_file_name": wanted}
            targets = [wanted]
        elif len(names) == 1:
            targets = names
        else:
            return {"status": "inner_file_ambiguous" if names else "inner_file_missing",
                    "receipt_no": receipt_no, "source": source}
        expected_inner = entry.get("inner_file_sha256")
        digests = {}
        for target in targets:
            digest = hashlib.sha256(archive.read(target)).hexdigest()
            digests[target] = digest
            if expected_inner is not None and digest != expected_inner:
                return {"status": "inner_hash_mismatch", "receipt_no": receipt_no,
                        "source": source, "inner_file_name": target}
    return {"status": "archive_hit", "receipt_no": receipt_no, "source": source,
            "archive_sha256": expected, "inner_file_name": targets[0],
            "inner_file_sha256": digests[targets[0]] if wanted is None else expected_inner}


def load_verified_archive_bytes(archive_dir: Optional[Path], receipt_no: str,
                                entry: Dict[str, Any], *,
                                archive_bytes: Optional[bytes] = None) -> bytes:
    """Return verified archive bytes or raise with a distinct lookup status."""
    result = lookup_original(entry and {receipt_no: entry} or {}, receipt_no,
                             archive_dir=archive_dir, archive_bytes=archive_bytes)
    if result["status"] != "archive_hit":
        raise ValueError(f"YEAREND_ORIGINAL_{result['status'].upper()}")
    if archive_bytes is not None:
        return archive_bytes
    for path in _candidate_archive_files(archive_dir, receipt_no, entry):
        if path.is_file() and (result.get("source") in (str(path), "supplied_bytes") or True):
            try:
                payload = path.read_bytes()
            except OSError:
                continue
            if hashlib.sha256(payload).hexdigest() == entry.get("archive_sha256") or \
                    hashlib.sha256(payload).hexdigest() == entry.get("archive_bytes_sha256"):
                return payload
    raise ValueError("YEAREND_ORIGINAL_UNRESOLVABLE")


def reparse_stored_archive(payload: bytes, parser) -> Any:
    """Reparse already-downloaded bytes; the parser must not use the network."""
    return parser(payload)


def reparse_verified_archive(archive_dir: Optional[Path], receipt_no: str,
                             entry: Dict[str, Any], parser,
                             *, archive_bytes: Optional[bytes] = None) -> Any:
    """Verify the stored original first, then hand its bytes to the parser."""
    return parser(load_verified_archive_bytes(archive_dir, receipt_no, entry,
                                              archive_bytes=archive_bytes))


def resolve_dart_key(environ: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Enable the DART path only from an explicitly injected ``DART_API_KEY``.

    Other service keys (e.g. ``TYPESAFE_API_KEY``) are never substituted; a
    missing dedicated key reports ``setup_incomplete``.  The mapping must be
    passed in (worker CLIs build it from the process environment); this module
    never reads ``os.environ`` on its own.
    """
    source = environ if environ is not None else {}
    key = source.get("DART_API_KEY") or ""
    if key:
        return {"status": "ready"}
    return {"status": "setup_incomplete"}


# ---------------------------------------------------------------------------
# LLM adapter separation (stored responses / explicit test doubles only)
# ---------------------------------------------------------------------------

class CitationLlmAdapter:
    """Base adapter; operational providers subclass this behind injection."""

    is_test_double = False

    def propose_clue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError


class StoredResponseAdapter(CitationLlmAdapter):
    """Offline adapter replaying pre-saved responses keyed by request."""

    def __init__(self, responses: Dict[str, Dict[str, Any]]):
        self._responses = copy.deepcopy(responses)

    def propose_clue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        key = str(payload.get("request_key") or "")
        if key not in self._responses:
            return {"status": "comparison_pending_hold", "reason": "no_stored_response"}
        return {"status": "stored_response", **copy.deepcopy(self._responses[key])}


class TestDoubleAdapter(CitationLlmAdapter):
    """Explicit test double; flagged so success is never real accuracy."""

    is_test_double = True

    def __init__(self, clue: Optional[Dict[str, Any]] = None):
        self._clue = copy.deepcopy(clue or {})

    def propose_clue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "test_double_response_do_not_report_as_accuracy",
                "is_test_double": True, "clue": copy.deepcopy(self._clue)}


# ---------------------------------------------------------------------------
# Common API-budget touch points (listing + document + search lanes)
# ---------------------------------------------------------------------------

API_BUDGET_TOUCH_POINTS = (
    "folio.collect:list_pages",
    "folio.resolve_unfinished:document_fetch",
    "folio.recheck_direct_basis:document_refetch",
    "target_source.ingest_target:list_pages+document+family_page",
    "opendart_secondary.scan:list_pages+document_review",
    "secondary_lane.search_ax:search_pages",
    "secondary.fetch_source_document:document_fetch",
)


def api_budget_touch_points() -> List[str]:
    """Known network touch points; a name list, not a budget enforcement."""
    return list(API_BUDGET_TOUCH_POINTS)
