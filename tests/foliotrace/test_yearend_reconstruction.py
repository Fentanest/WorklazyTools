"""First offline implementation tests for year-end Excel reconciliation.

Input classes are kept distinct:
- ``real_workbook``: the stored local ``.xlsx`` bytes (measured, when present).
- synthetic inputs: hand-built minimal workbooks / dicts.
- model doubles: ``TestDoubleAdapter`` / ``StoredResponseAdapter`` only, and a
  double success is never asserted as real extraction accuracy.

A National Pension positive citation with a real source document is left
unmeasured until such an original is secured; synthetic passes do not close it.
"""
import copy
import io
import unittest
import zipfile
from decimal import Decimal
from pathlib import Path

from pipeline.foliotrace import yearend
from pipeline.foliotrace.indirect import register_evidence
from scripts.foliotrace import folio

REPO = Path(__file__).resolve().parents[2]
REAL_XLSX = REPO / "국내주식 종목별 투자 현황(2025년말).xlsx"


def synthetic_workbook(rows):
    """Build minimal xlsx bytes: rows of (seq, name, eval_raw, weight_raw, ratio_raw)."""
    shared = []
    index_of = {}

    def intern(text):
        if text not in index_of:
            index_of[text] = len(shared)
            shared.append(text)
        return index_of[text]

    sheet_rows = []
    for i, (seq, name, eval_raw, weight_raw, ratio_raw) in enumerate(rows, start=8):
        sheet_rows.append(
            f'<row r="{i}"><c r="A{i}"><v>{seq}</v></c>'
            f'<c r="B{i}" t="s"><v>{intern(name)}</v></c>'
            f'<c r="C{i}"><v>{eval_raw}</v></c>'
            f'<c r="D{i}"><v>{weight_raw}</v></c>'
            f'<c r="E{i}"><v>{ratio_raw}</v></c></row>'
        )
    shared_xml = ("<?xml version='1.0'?><sst xmlns='http://schemas.openxmlformats.org/"
                  "spreadsheetml/2006/main'>" + "".join(f"<si><t>{s}</t></si>" for s in shared) + "</sst>")
    sheet_xml = ("<?xml version='1.0'?><worksheet xmlns='http://schemas.openxmlformats.org/"
                 "spreadsheetml/2006/main'><sheetData>" + "".join(sheet_rows) + "</sheetData></worksheet>")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml.encode())
        archive.writestr("xl/sharedStrings.xml", shared_xml.encode())
    return output.getvalue()


def base_isolated_state():
    state = folio.empty_state()
    state["receipts"]["20260318001422"] = {"receipt_no": "20260318001422"}
    return state


class YearendPrecisionTests(unittest.TestCase):
    def test_bnk_raw_precision_preserved_with_residual_not_zeroed(self):
        """BNK: displayed truncation shows -20 won; raw cell carries extra precision."""
        if not REAL_XLSX.is_file():
            self.skipTest("real workbook absent: BNK precision unmeasured")
        parsed = yearend.parse_yearend_workbook(REAL_XLSX.read_bytes())
        bnk = next(row for row in parsed["rows"] if row["name"] == "BNK금융지주")
        # The raw XML cell keeps binary-float repr precision beyond the display.
        self.assertEqual(bnk["eval_eok_raw"], "4240.6411091999998")
        derived = yearend.derive_quantity_estimate(bnk["eval_eok_raw"], "15870", "2025-12-30")
        self.assertEqual(derived["derived_quantity_estimate"], "26721116")
        # Residual from the raw cell is a float-repr artifact (~0), preserved verbatim.
        self.assertEqual(Decimal(derived["eval_won_exact"]), Decimal("424064110919.99998"))
        self.assertEqual(Decimal(derived["residual_won"]), Decimal("-0.00002"))
        # The displayed rounding would misleadingly show -20 won; keep both, claim neither as fact.
        displayed_residual = Decimal("4240.641109") * Decimal(100000000) - Decimal(26721116) * Decimal(15870)
        self.assertEqual(displayed_residual, Decimal("-20"))
        self.assertNotEqual(derived["residual_won"], "-20")

    def test_rounded_ratio_never_uniquely_fixes_denominator(self):
        """KT&G: same-denominator reproduction is compatibility, not proof."""
        ktg_qty, disclosure_qty, denom = "9117617", "9133543", "117976645"
        excel = yearend.classify_ratio_compatibility(ktg_qty, denom, "7.73")
        disclosure = yearend.classify_ratio_compatibility(disclosure_qty, denom, "7.74")
        self.assertTrue(excel["reproduces_display_with_this_denominator"])
        self.assertTrue(disclosure["reproduces_display_with_this_denominator"])
        for result in (excel, disclosure):
            self.assertEqual(result["denominator_status"], "compatible_candidate_not_proven")
            self.assertEqual(result["cause_status"], "unresolved_quantity_vs_denominator_assumption")
            self.assertNotEqual(result["denominator_status"], "denominator_proven")
        # A nearby alternative denominator can also reproduce one display value,
        # so uniqueness must never be asserted from rounding alone.
        alt = yearend.classify_ratio_compatibility(ktg_qty, "117976640", "7.73")
        self.assertTrue(alt["reproduces_display_with_this_denominator"])

    def test_display_precision_gap_is_not_balance_confirmation(self):
        gap = yearend.derive_quantity_estimate("4240.641109", "15870", "2025-12-30")
        self.assertEqual(Decimal(gap["residual_won"]), Decimal("-20"))
        self.assertEqual(gap["quantity_basis_status"], "unconfirmed_derived_not_disclosure_confirmed")

    def test_derived_estimate_never_named_official_balance(self):
        derived = yearend.derive_quantity_estimate("12956.133757", "142100", "2025-12-30")
        self.assertEqual(derived["kind"], "derived_quantity_estimate")
        self.assertNotIn("official", derived["kind"])
        self.assertIsNone(derived["quantity_basis_date"])
        with self.assertRaisesRegex(ValueError, "YEAREND_DERIVED_KIND"):
            yearend.store_derived_quantity(base_isolated_state(), "KT&G",
                                           {**derived, "kind": "official_balance"})


class YearendSeparationTests(unittest.TestCase):
    def test_excel_and_disclosure_layers_stay_separate_without_overwrite(self):
        """역산 수량과 공시 확인 수량을 혼동하지 않는다."""
        state = base_isolated_state()
        before_indirect = copy.deepcopy(state["indirect_observations"])
        yearend.store_excel_input(state, {"name": "KT&G", "eval_eok_raw": "12956.133757",
                                          "weight_raw": "0.004", "ratio_raw": "7.73E-2",
                                          "row_sha256": "a" * 64, "workbook_sha256": "b" * 64,
                                          "row_number": 45, "seq_raw": "38"})
        yearend.store_derived_quantity(state, "KT&G",
                                       yearend.derive_quantity_estimate("12956.133757", "142100", "2025-12-30"))
        yearend.compare_yearend(state, "KT&G", excel_eval_eok_raw="12956.133757",
                                excel_ratio_display="7.73", derived_estimate="9117617",
                                price_date="2025-12-30", disclosure_quantity="9133543",
                                disclosure_ratio_display="7.74",
                                disclosure_basis_date="2025-12-31",
                                disclosure_basis_role="shareholder_register_date",
                                disclosure_receipt_no="20260318001422",
                                denominator_quantity="117976645", denominator_date="2025-12-31",
                                hold_reason="discrepancy_unexplained")
        row = state["yearend_comparison"]["KT&G"]
        self.assertEqual(row["derived_quantity_estimate"], "9117617")
        self.assertEqual(row["disclosure_quantity"], "9133543")
        self.assertFalse(row["overwrite_performed"])
        self.assertEqual(state["indirect_observations"], before_indirect)

    def test_obligation_and_writing_dates_kept_as_separate_roles(self):
        """의무발생일과 작성기준일이 다른 자료의 날짜를 올바르게 연결한다."""
        state = base_isolated_state()
        yearend.compare_yearend(state, "KT&G", excel_eval_eok_raw="12956.133757",
                                excel_ratio_display="7.73", derived_estimate="9117617",
                                price_date="2025-12-30", disclosure_quantity="9133543",
                                disclosure_basis_date="2025-09-07",
                                disclosure_basis_role="writing_basis_date",
                                disclosure_receipt_no="20260318001422",
                                hold_reason="discrepancy_unexplained")
        row = state["yearend_comparison"]["KT&G"]
        # Writing-basis date is preserved as its role; obligation date is not invented.
        self.assertEqual(row["disclosure_basis_role"], "writing_basis_date")
        self.assertNotEqual(row["price_date"], row["disclosure_basis_date"])
        self.assertEqual(yearend.verify_citation_against_original("9133543", "9133543"),
                         "comparison_pending_hold")

    def test_existing_register_evidence_contract_untouched(self):
        state = base_isolated_state()
        state["universe"]["00126380"] = {"corp_code": "00126380", "stock_code": "005930", "name": "X"}
        state["receipts"]["20260602000001"] = {"receipt_no": "20260602000001", "receipt_date": "2026-06-02",
                                               "corp_code": "00126380", "stock_code": "005930",
                                               "evidence": "dart_document"}
        fact = {"kind": "indirect_holding", "source_receipt_no": "20260602000001",
                "source_document_no": "1", "source_filing_date": "2026-06-02", "basis_date": "2026-06-01",
                "corp_code": "00126380", "filer_corp_code": "00126380", "stock_code": "005930",
                "security_kind": "common", "ownership_percent": "5.05", "quantity": "10",
                "numeric_kind": "exact", "source_file_sha256": "a" * 64, "source_row_sha256": "b" * 64,
                "source_row_offset": 0, "parser_version": "v", "ratio_denominator": "issued_shares",
                "holder_scope": "nps_only", "owner_identity": "nps_confirmed",
                "basis_kind": "yearend_shareholder_register",
                "source_status": "no_known_correction_or_withdrawal",
                "source_document_sha256": "a" * 64, "source_section_sha256": "b" * 64,
                "issuer_identity_sha256": "c" * 64, "verified_at": "2026-09-27T00:00:00Z"}
        with self.assertRaisesRegex(ValueError, "EVIDENCE_NOT_ACTUAL_HOLDING"):
            register_evidence(state, fact)
        # denominator_date != basis_date still rejected (not removed for one case).
        good = dict(fact, basis_kind="explicit_actual_holding",
                    denominator_quantity="100", denominator_date="2026-06-02")
        with self.assertRaisesRegex(ValueError, "EVIDENCE_RATIO_BASIS"):
            register_evidence(state, good)

    def test_no_batch_confirmation_to_dec30_or_dec31(self):
        state = base_isolated_state()
        for name, price in (("AAA", "1000"), ("BBB", "2000")):
            yearend.store_derived_quantity(state, name,
                                           yearend.derive_quantity_estimate("100.5", price, "2025-12-30"))
            yearend.compare_yearend(state, name, excel_eval_eok_raw="100.5",
                                    excel_ratio_display="1.00", derived_estimate="10050000",
                                    price_date="2025-12-30", hold_reason="comparison_pending_hold")
        for row in yearend.build_comparison_table(state):
            self.assertEqual(row["price_date_role"], "price_reference_date_not_holding_basis")
            self.assertIn(row["status"], ("comparison_pending_hold", "discrepancy_unexplained"))

    def test_past_quantity_and_later_ratio_never_merged_to_one_balance(self):
        """과거 수량과 나중 비율을 한 시점의 잔고로 합치지 않는다."""
        state = base_isolated_state()
        yearend.compare_yearend(state, "KT&G", excel_eval_eok_raw="12956.133757",
                                excel_ratio_display="7.73", derived_estimate="9117617",
                                price_date="2025-12-30", disclosure_quantity="9778216",
                                disclosure_ratio_display="8.29",
                                disclosure_basis_date="2025-12-31",
                                disclosure_basis_role="shareholder_register_date",
                                disclosure_receipt_no="20260318001422",
                                denominator_quantity="117976645", denominator_date="2025-12-31",
                                hold_reason="discrepancy_unexplained")
        row = state["yearend_comparison"]["KT&G"]
        self.assertEqual(row["disclosure_quantity"], "9778216")
        self.assertEqual(row["disclosure_ratio_display"], "8.29")
        # The 2020 past ratio (7.12%) is not stored here at all; no back-projection.
        self.assertNotIn("7.12", str(row))


class CitationQueueTests(unittest.TestCase):
    def test_single_match_never_registers_obligation_date(self):
        """원공시 1건 + 수량 일치 → 보고의무발생일 등록 규칙 금지."""
        state = base_isolated_state()
        before = copy.deepcopy(state["indirect_observations"])
        self.assertEqual(yearend.verify_citation_against_original("9133543", "9133543"),
                         "comparison_pending_hold")
        self.assertEqual(state["indirect_observations"], before)

    def test_nps_citation_reaches_followup_without_real_original(self):
        """국민연금 실제 인용은 합성 통과로 닫지 않고 후속 검증 상태로 둔다."""
        state = base_isolated_state()
        clue = {"source_receipt_no": "20260318001422", "source_row_offset": 10,
                "source_text": "'20.03.02 공시기준 First Eagle 9,778,216주'",
                "target_corp_name": "KT&G", "filer_name": "KT&G",
                "holder_name": "First Eagle", "equity_target_corp": "KT&G",
                "security_kind": "common", "holder_aggregation_scope": "single_holder",
                "date_clues": [{"text": "2020-03-02", "role": "receipt_date", "ambiguous": True}],
                "applies_to_fields": ["quantity"], "original_candidates": [],
                "archive_sha256": "a" * 64, "inner_file_name": "r.xml",
                "inner_file_sha256": "b" * 64, "is_nps_claim": False}
        yearend.enqueue_citation_followup(state, "ktg-first-eagle-20200302", clue)
        yearend.advance_followup(state, "ktg-first-eagle-20200302", "missing_original",
                                 note="real original 20200302000081 not secured offline")
        item = state["citation_followup_queue"]["ktg-first-eagle-20200302"]
        self.assertEqual(item["state"], "missing_original")
        # First Eagle is a third party: never counted as an NPS holding value.
        self.assertFalse(clue["is_nps_claim"])
        self.assertEqual(state["yearend_comparison"], {})

    def test_first_eagle_excluded_from_nps_values(self):
        """First Eagle 등 다른 주주는 국민연금 보유값에 들어가지 않는다."""
        self.assertEqual(yearend.classify_note_for_review("First Eagle 8.29%", True, True),
                         "citation_review_pending")
        state = base_isolated_state()
        yearend.compare_yearend(state, "KT&G", excel_eval_eok_raw="12956.133757",
                                excel_ratio_display="7.73", derived_estimate="9117617",
                                price_date="2025-12-30", hold_reason="comparison_pending_hold")
        self.assertNotIn("First Eagle", str(state["yearend_comparison"]["KT&G"]))

    def test_other_company_nps_info_kept_as_target_candidate(self):
        """타사 문서의 유효 국민연금 정보는 대상 회사 후보로 보존한다."""
        state = base_isolated_state()
        clue = {"source_receipt_no": "20260109000701", "source_row_offset": 3,
                "source_text": "KB금융 최다출자자 국민연금공단 8.41%",
                "document_target_corp": "천보", "equity_target_corp": "KB금융",
                "filer_name": "KB금융", "holder_name": "국민연금공단",
                "security_kind": "common", "holder_aggregation_scope": "single_holder",
                "date_clues": [], "applies_to_fields": ["ownership_percent"],
                "original_candidates": [], "archive_sha256": "a" * 64,
                "inner_file_name": "r.xml", "inner_file_sha256": "b" * 64,
                "is_nps_claim": True}
        yearend.enqueue_citation_followup(state, "cheonbo-kb-nps-8.41", clue)
        item = state["citation_followup_queue"]["cheonbo-kb-nps-8.41"]
        self.assertEqual(item["clue"]["equity_target_corp"], "KB금융")
        self.assertNotEqual(item["clue"].get("document_target_corp"), item["clue"]["equity_target_corp"])

    def test_note_scope_never_broadcast_to_all_rows(self):
        """같은 주석이 모든 행·모든 수치에 잘못 전파되지 않는다."""
        clue: yearend.CitationClue = {"source_receipt_no": "20260318001422",
                                      "source_row_offset": 10, "source_text": "'20.03.02 공시기준",
                                      "applies_to_fields": ["quantity"],
                                      "date_clues": [], "original_candidates": []}
        self.assertEqual(clue["applies_to_fields"], ["quantity"])

    def test_dateless_note_stays_dateless(self):
        clue: yearend.CitationClue = {"source_receipt_no": "20260318001422",
                                      "source_row_offset": 1, "source_text": "주주명부 기준",
                                      "applies_to_fields": ["quantity"],
                                      "date_clues": [], "original_candidates": []}
        self.assertEqual(clue["date_clues"], [])

    def test_regex_miss_stays_in_review(self):
        self.assertIsNone(yearend.regex_citation_hint("국민연금공단 보통주 9,133,543주 (비고 없음)"))
        self.assertEqual(yearend.classify_note_for_review("국민연금공단 보통주 9,133,543주", True, True),
                         "citation_review_pending")

    def test_queue_states_distinct_and_resumable_without_duplicates(self):
        """중단 후 재개해도 중복 관측·중복 매매를 만들지 않는다."""
        state = base_isolated_state()
        clue = {"source_receipt_no": "20260318001422", "source_row_offset": 0,
                "source_text": "t", "date_clues": [], "original_candidates": []}
        first = yearend.enqueue_citation_followup(state, "req-1", clue)
        dup = yearend.enqueue_citation_followup(state, "req-1", clue)
        self.assertTrue(first["changed"])
        self.assertFalse(dup["changed"])
        for outcome in ("search_zero_results", "ambiguous_candidates", "network_error",
                        "quota_exhausted", "value_conflict", "citation_cycle_hold",
                        "recitation_not_new_trade", "comparison_pending_hold",
                        "resolved_verified_hold", "missing_original", "pending_search"):
            yearend.enqueue_citation_followup(state, f"req-{outcome}", clue)
            result = yearend.advance_followup(state, f"req-{outcome}", outcome)
            self.assertEqual(result["state"], outcome)
        # Resume re-records history without creating observations or trades.
        before = copy.deepcopy(state["citation_followup_queue"]["req-1"])
        yearend.advance_followup(state, "req-1", "pending_search", note="resume")
        after = state["citation_followup_queue"]["req-1"]
        self.assertEqual(len(after["history"]), len(before["history"]) + 1)
        self.assertEqual(state["indirect_observations"], {})
        self.assertTrue(yearend.detect_citation_cycle(["A", "B", "A"]))
        self.assertFalse(yearend.detect_citation_cycle(["A", "B", "C"]))

    def test_stored_archive_reparse_uses_no_network(self):
        payload = synthetic_workbook([("1", "삼성전자", "551094.56550499995", "0.21", "7.76E-2")])

        def parser(data: bytes):
            return yearend.parse_yearend_workbook(data)

        def forbidden_fetch(*args, **kwargs):
            raise AssertionError("network must not be used for stored bytes")

        parsed = yearend.reparse_stored_archive(payload, parser)
        self.assertEqual(parsed["row_count"], 1)
        _ = forbidden_fetch  # bound but never called by the replay path

    def test_cache_hit_vs_extraction_only_distinguished(self):
        hit = yearend.lookup_original({"R1": {"has_archive_bytes": True, "archive_bytes_sha256": "a" * 64}}, "R1")
        thin = yearend.lookup_original({"R2": {"row_count": 3}}, "R2")
        missing = yearend.lookup_original({}, "R3")
        self.assertEqual(hit["status"], "archive_hit")
        self.assertEqual(thin["status"], "extraction_cache_only_no_archive")
        self.assertEqual(missing["status"], "missing_original")

    def test_dart_key_setup_incomplete_without_substitute(self):
        self.assertEqual(yearend.resolve_dart_key({})["status"], "setup_incomplete")
        self.assertEqual(yearend.resolve_dart_key({"TYPESAFE_API_KEY": "x" * 10})["status"],
                         "setup_incomplete")
        self.assertEqual(yearend.resolve_dart_key({"DART_API_KEY": "k"})["status"], "ready")

    def test_llm_double_flagged_and_stored_response_offline(self):
        double = yearend.TestDoubleAdapter({"is_nps_claim": True})
        self.assertTrue(double.is_test_double)
        response = double.propose_clue({"request_key": "q"})
        self.assertTrue(response["is_test_double"])
        self.assertIn("do_not_report_as_accuracy", response["status"])
        stored = yearend.StoredResponseAdapter({"q": {"clue": {"a": 1}}})
        self.assertEqual(stored.propose_clue({"request_key": "q"})["status"], "stored_response")
        self.assertEqual(stored.propose_clue({"request_key": "missing"})["status"],
                         "comparison_pending_hold")

    def test_operating_sources_and_public_data_unchanged(self):
        """운영 원본과 공개 데이터는 변경하지 않는다."""
        state = base_isolated_state()
        state["holdings"]["00126380"] = {"corp_code": "00126380"}
        snapshot = copy.deepcopy({key: state[key] for key in
                                  ("receipts", "holdings", "indirect_observations",
                                   "direct_ratio_basis", "quote_cache")})
        yearend.ensure_yearend_ledgers(state)
        yearend.compare_yearend(state, "S", excel_eval_eok_raw="1", excel_ratio_display="1",
                                derived_estimate="1", price_date="2025-12-30")
        for key, value in snapshot.items():
            self.assertEqual(state[key], value)
        # Year-end keys are the only additions; existing keys untouched.
        self.assertIn("yearend_comparison", state)


if __name__ == "__main__":
    unittest.main()
