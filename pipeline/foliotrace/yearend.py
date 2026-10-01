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
- Stored archives are reparsed from bytes only; no network is used.
- Only ``DART_API_KEY`` enables the DART path.  ``TYPESAFE_API_KEY`` and
  other service keys are never substituted.
"""
from __future__ import annotations

import hashlib
import re
import zipfile
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from io import BytesIO
from typing import Any, Dict, List, Literal, Optional, TypedDict


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

CITATION_DATE_ROLES = frozenset({
    "receipt_date",
    "obligation_date",
    "writing_basis_date",
    "transaction_date",
    "shareholder_register_date",
    "filing_date",
})


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
# Raw Excel handling (structure-preserving, no quantity column invented)
# ---------------------------------------------------------------------------

def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse_yearend_workbook(payload: bytes) -> Dict[str, Any]:
    """Extract year-end rows preserving raw cell strings and hashes.

    Takes stored ``.xlsx`` bytes only; performs no network I/O.  Returns the
    workbook sha, per-row raw values (evaluation in 억원, weight, ratio) and
    row-level sha256 over the raw ``<row>`` XML so a parser upgrade can
    reprocess the stored bytes deterministically.
    """
    archive_sha = hashlib.sha256(payload).hexdigest()
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        try:
            sheet_xml = archive.read("xl/worksheets/sheet1.xml").decode("utf-8")
        except KeyError:
            raise ValueError("YEAREND_SHEET_MISSING")
        try:
            shared_xml = archive.read("xl/sharedStrings.xml").decode("utf-8")
        except KeyError:
            shared_xml = ""
    names: List[str] = []
    if shared_xml:
        for match in re.finditer(r"<t[^>]*>(.*?)</t>", shared_xml, re.S):
            text = re.sub(r"<[^>]+>", "", match.group(1))
            # Minimal XML-entity unescape for shared strings.
            names.append(text.replace("&amp;", "&").replace("&lt;", "<")
                         .replace("&gt;", ">").replace("&quot;", '"')
                         .replace("&apos;", "'"))
    rows: List[Dict[str, Any]] = []
    for match in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet_xml, re.S):
        row_no = int(match.group(1))
        if row_no < 8:
            continue
        body = match.group(2)
        cells = re.findall(r'<c r="[A-Z]+%d"[^>]*?(?:t="s")?[^>]*>(.*?)</c>' % row_no, body, re.S)
        values: List[str] = []
        for cell in cells:
            inner = re.search(r"<v>(.*?)</v>", cell, re.S)
            raw = inner.group(1).strip() if inner else ""
            if 't="s"' in match.group(0) and False:  # placeholder, resolved per-cell below
                pass
            values.append(raw)
        # Resolve per-cell shared-string refs using the cell tags in order.
        tags = re.findall(r'<c r="([A-Z]+)%d"([^>]*)>' % row_no, body)
        resolved: List[str] = []
        for (col, attrs), raw in zip(tags, values):
            if 't="s"' in attrs:
                try:
                    resolved.append(names[int(raw)])
                except (ValueError, IndexError):
                    resolved.append(raw)
            else:
                resolved.append(raw)
        if len(resolved) < 5:
            continue
        seq_raw, name, eval_raw, weight_raw, ratio_raw = resolved[:5]
        if not seq_raw or not name:
            continue
        rows.append({
            "row_number": row_no,
            "seq_raw": seq_raw,
            "name": name,
            "eval_eok_raw": eval_raw,      # raw <v> text, e.g. '4240.6411091999998'
            "weight_raw": weight_raw,
            "ratio_raw": ratio_raw,        # raw scientific notation preserved
            "row_sha256": _sha(match.group(0)),
        })
    if not rows:
        raise ValueError("YEAREND_NO_DATA_ROWS")
    return {"workbook_sha256": archive_sha, "row_count": len(rows), "rows": rows}


def evaluation_won(eval_eok_raw: str) -> Dict[str, str]:
    """Convert the raw 억원 cell to won without hiding precision."""
    try:
        raw = Decimal(eval_eok_raw)
    except (InvalidOperation, ValueError):
        raise ValueError("YEAREND_EVAL_SHAPE")
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
        price = Decimal(price_won)
        converted = evaluation_won(eval_eok_raw)
        won = Decimal(converted["eval_won_exact"])
    except (InvalidOperation, ValueError):
        raise ValueError("YEAREND_DERIVE_SHAPE")
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
        qty, denom, shown = Decimal(quantity), Decimal(denominator), Decimal(displayed_ratio_percent)
    except (InvalidOperation, ValueError):
        raise ValueError("YEAREND_RATIO_SHAPE")
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
                "yearend_comparison", "citation_followup_queue")


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
    ledger[key] = dict(value)
    return {"key": key, "changed": True}


def store_excel_input(state: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
    """Preserve one Excel row as an input record (not an observation)."""
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
                    hold_reason: Optional[str] = None) -> Dict[str, Any]:
    """Record a per-issue comparison; originals and estimates stay separate.

    Never overwrites the Excel original with a disclosure value and never
    writes to ``indirect_observations``.  Past quantities and later-denominator
    recalculated ratios are stored in distinct fields.
    """
    ensure_yearend_ledgers(state)
    if "indirect_observations" in state and not isinstance(state["indirect_observations"], dict):
        raise ValueError("YEAREND_STATE_SHAPE")
    record = {
        "name": name,
        # Excel-published layer (as printed + raw).
        "excel_eval_eok_raw": excel_eval_eok_raw,
        "excel_ratio_display": excel_ratio_display,
        # Derived layer (clearly labelled, with its own price date).
        "derived_quantity_estimate": derived_estimate,
        "price_date": price_date,
        "price_date_role": "price_reference_date_not_holding_basis",
        # Disclosure-confirmed layer (only when directly read from a filing).
        "disclosure_quantity": disclosure_quantity,
        "disclosure_ratio_display": disclosure_ratio_display,
        "disclosure_basis_date": disclosure_basis_date,
        "disclosure_basis_role": disclosure_basis_role,
        "disclosure_receipt_no": disclosure_receipt_no,
        # Denominator layer kept apart from the quantity layer.
        "denominator_quantity": denominator_quantity,
        "denominator_date": denominator_date,
        "status": hold_reason or ("comparison_pending_hold"
                                  if disclosure_quantity is None
                                  else "discrepancy_unexplained"),
        "overwrite_performed": False,
    }
    return _store_unique(state["yearend_comparison"], name, record, "YEAREND_COMPARISON_CONFLICT")


def build_comparison_table(state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return per-issue original / estimate / disclosure / hold-reason rows."""
    return [dict(value) for _, value in sorted((state.get("yearend_comparison") or {}).items())]


# ---------------------------------------------------------------------------
# Citation clues, regex hints (auxiliary only), and the follow-up queue
# ---------------------------------------------------------------------------

CITATION_HINT = re.compile(
    r"(대량보유|대량소유|5%\s*이상|주주명부|주식\s*분포|주주에\s*관한\s*사항|"
    r"최대주주|보고의무발생일|작성기준일|공시기준|기준일)",
)
DATE_HINT = re.compile(
    r"(\d{4})[.\-년\s]*(\d{1,2})[.\-월\s]*(\d{1,2})?[일\s]*",
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


@dataclass
class FollowupItem:
    request_key: str
    clue: Dict[str, Any]
    state: str = "pending_search"
    history: List[Dict[str, Any]] = field(default_factory=list)
    resume_count: int = 0


def enqueue_citation_followup(state: Dict[str, Any], request_key: str,
                              clue: Dict[str, Any]) -> Dict[str, Any]:
    """Idempotent enqueue; duplicate requests reuse the stored item."""
    ensure_yearend_ledgers(state)
    queue = state["citation_followup_queue"]
    if request_key in queue:
        stored = queue[request_key]
        if stored.get("clue") != clue:
            # A materially different clue for the same key is a conflict hold,
            # not a silent overwrite.
            stored["state"] = "value_conflict"
            return {"key": request_key, "changed": False, "state": "value_conflict"}
        return {"key": request_key, "changed": False, "state": stored["state"]}
    queue[request_key] = {"request_key": request_key, "clue": dict(clue),
                          "state": "pending_search", "history": [], "resume_count": 0}
    return {"key": request_key, "changed": True, "state": "pending_search"}


def advance_followup(state: Dict[str, Any], request_key: str, outcome: str, *,
                     note: str = "") -> Dict[str, Any]:
    """Move one queue item to a distinct outcome state; safe to resume."""
    ensure_yearend_ledgers(state)
    if outcome not in FOLLOWUP_STATES:
        raise ValueError("YEAREND_FOLLOWUP_STATE")
    item = state["citation_followup_queue"].get(request_key)
    if item is None:
        raise ValueError("YEAREND_FOLLOWUP_MISSING")
    item["history"].append({"outcome": outcome, "note": note})
    # Terminal-ish outcomes persist; resume only re-records without duplicating.
    if item["state"] != outcome:
        item["state"] = outcome
        item["resume_count"] += 1
        return {"key": request_key, "changed": True, "state": outcome}
    item["resume_count"] += 1
    return {"key": request_key, "changed": False, "state": outcome}


def detect_citation_cycle(chain: List[str]) -> bool:
    """True when a citation chain revisits a receipt (A cites B cites A)."""
    return len(set(chain)) != len(chain)


def verify_citation_against_original(cited_quantity: Optional[str],
                                     original_quantity: Optional[str]) -> str:
    """Compare an inline citation against its secured original.

    Never registers an observation and never derives an obligation date.
    A quantity match alone keeps the item on hold for explicit date-role
    confirmation; only an exact, separately confirmed date binding resolves.
    """
    if cited_quantity is None or original_quantity is None:
        return "comparison_pending_hold"
    if str(cited_quantity) != str(original_quantity):
        return "value_conflict"
    return "comparison_pending_hold"


# ---------------------------------------------------------------------------
# Cache lookup, stored-archive replay, DART key handling (offline-safe)
# ---------------------------------------------------------------------------

def lookup_original(cache: Dict[str, Any], receipt_no: str) -> Dict[str, Any]:
    """Distinguish archive hits from extraction-only caches and misses."""
    entry = (cache or {}).get(receipt_no)
    if entry is None:
        return {"status": "missing_original", "receipt_no": receipt_no}
    if entry.get("archive_bytes_sha256") and entry.get("has_archive_bytes"):
        return {"status": "archive_hit", "receipt_no": receipt_no,
                "archive_sha256": entry["archive_bytes_sha256"]}
    return {"status": "extraction_cache_only_no_archive", "receipt_no": receipt_no}


def reparse_stored_archive(payload: bytes, parser) -> Any:
    """Reparse already-downloaded bytes; the parser must not use the network."""
    return parser(payload)


def resolve_dart_key(environ: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Enable the DART path only from ``DART_API_KEY``.

    Other service keys (e.g. ``TYPESAFE_API_KEY``) are never substituted; a
    missing dedicated key reports ``setup_incomplete``.
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
        self._responses = dict(responses)

    def propose_clue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        key = str(payload.get("request_key") or "")
        if key not in self._responses:
            return {"status": "comparison_pending_hold", "reason": "no_stored_response"}
        return {"status": "stored_response", **dict(self._responses[key])}


class TestDoubleAdapter(CitationLlmAdapter):
    """Explicit test double; flagged so success is never real accuracy."""

    is_test_double = True

    def __init__(self, clue: Optional[Dict[str, Any]] = None):
        self._clue = dict(clue or {})

    def propose_clue(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "test_double_response_do_not_report_as_accuracy",
                "is_test_double": True, "clue": dict(self._clue)}


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
    return list(API_BUDGET_TOUCH_POINTS)
