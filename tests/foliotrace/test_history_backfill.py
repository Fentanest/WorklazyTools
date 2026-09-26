import copy
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from scripts.foliotrace import folio
from pipeline.foliotrace.publish import make_snapshot


CORP = "00104856"
CODE = "005930"
CURRENT = "20260923000001"
OLD = "20200106000001"


def state():
    value = folio.empty_state()
    value["import_ledger"] = ["synthetic"]
    value["latest_complete_listing_date"] = "2026-09-26"
    value["universe"][CORP] = {"name": "Synthetic", "stock_code": CODE}
    value["receipts"][CURRENT] = {"receipt_no": CURRENT, "receipt_date": "2026-09-23",
        "corp_code": CORP, "stock_code": CODE, "quantity": "100",
        "company_ownership_percent": "6", "evidence": "dart_document"}
    value["holdings"][CORP] = {"corp_code": CORP, "stock_code": CODE,
        "name": "Synthetic", "receipt_no": CURRENT, "receipt_date": "2026-09-23",
        "quantity": "100", "company_ownership_percent": "6", "evidence": "dart_document"}
    return value


def row(no=OLD, **changes):
    result = {"rcept_no": no, "rcept_dt": no[:8], "corp_code": CORP,
              "stock_code": CODE, "corp_name": "Synthetic", "flr_nm": "국민연금공단",
              "report_nm": "주식등의대량보유상황보고서", "rm": ""}
    return {**result, **changes}


def page(rows):
    return {"status": "000", "page_no": "1", "total_page": "1",
            "total_count": str(len(rows)), "list": rows}


class HistoricalBackfillTests(unittest.TestCase):
    def test_first_window_failure_reports_only_safe_stage_and_status(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            with patch.object(folio, "dart_json", side_effect=RuntimeError("DART status 021")) as request:
                with self.assertRaises(folio.HistoricalCollectionError) as failure:
                    folio.backfill_history(path, date(2009, 1, 1), date(2009, 3, 21),
                                           "private-test-key", parse_limit=0, recheck_limit=0)
            self.assertEqual(failure.exception.code, "DART_STATUS_021")
            self.assertEqual((failure.exception.start, failure.exception.end, failure.exception.page_no),
                             ("2009-01-01", "2009-03-21", 1))
            self.assertEqual((request.call_args.args[1]["sort"], request.call_args.args[1]["sort_mth"]),
                             ("date", "asc"))
            self.assertNotIn("private-test-key", str(failure.exception))
            self.assertIsNone(folio.read_json(path)["historical_backfill"])

    def test_listing_page_and_nps_row_failures_have_distinct_safe_codes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            malformed = {"status": "000", "page_no": "2", "total_page": "1",
                         "total_count": "1", "list": [row()]}
            with patch.object(folio, "dart_json", return_value=malformed):
                with self.assertRaises(folio.HistoricalCollectionError) as failure:
                    folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 31),
                                           "private-test-key", parse_limit=0, recheck_limit=0)
            self.assertEqual(failure.exception.code, "PAGE_IDENTITY")
            with patch.object(folio, "dart_json", return_value=page([row(rcept_dt="20201340")])):
                with self.assertRaises(folio.HistoricalCollectionError) as failure:
                    folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 31),
                                           "private-test-key", parse_limit=0, recheck_limit=0)
            self.assertEqual((failure.exception.code, failure.exception.page_no, failure.exception.row_index),
                             ("NPS_DATE", 1, 1))
            self.assertIsNone(folio.read_json(path)["historical_backfill"])

    def test_official_listing_date_can_differ_from_receipt_number_prefix(self):
        initial = state()
        self.assertTrue(folio.apply_listing_row(initial, row(rcept_dt="20200107"), historical=True))
        receipt = initial["receipts"][OLD]
        self.assertEqual(receipt["receipt_date"], "2020-01-07")
        self.assertEqual(receipt["listing_receipt_date"], "2020-01-07")
        self.assertTrue(receipt["receipt_prefix_date_mismatch"])
        self.assertEqual(initial["unresolved"][OLD], "needs_filing_parse")

        initial["receipts"]["20200107000002"] = {"receipt_no": "20200107000002",
            "receipt_date": "2020-01-06", "corp_code": CORP, "stock_code": CODE,
            "quantity": "90", "company_ownership_percent": "6", "evidence": "dart_document"}
        initial["receipts"][OLD].update(quantity="80", company_ownership_percent="5.7",
                                         evidence="dart_document")
        for no in (OLD, "20200107000002"):
            receipt = initial["receipts"][no]
            initial["events"][no] = {"receipt_no": no, "receipt_date": receipt["receipt_date"],
                "corp_code": CORP, "stock_code": CODE, "kind": "other", "correction_of": None,
                "quantity": receipt["quantity"], "company_ownership_percent": receipt["company_ownership_percent"],
                "source": "dart_document"}
        folio.classify_events(initial)
        self.assertEqual(initial["events"]["20200107000002"]["kind"], "new-report")
        self.assertEqual(initial["events"][OLD]["kind"], "decrease")

    def test_conflicting_imported_date_is_not_parsed_or_published_as_dart_fact(self):
        initial = state()
        initial["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2019-12-31",
            "corp_code": CORP, "stock_code": CODE, "quantity": "75",
            "company_ownership_percent": "5.5", "origin": "legacy_import",
            "evidence": "legacy_json_parser_result"}
        initial["events"][OLD] = {"receipt_no": OLD, "receipt_date": "2019-12-31",
            "corp_code": CORP, "stock_code": CODE, "kind": "other",
            "correction_of": None, "quantity": "75", "company_ownership_percent": "5.5",
            "source": "legacy_json_parser_result"}
        folio.apply_listing_row(initial, row(), historical=True)
        self.assertEqual(initial["unresolved"][OLD], "receipt_date_conflict")
        self.assertEqual(initial["receipts"][OLD]["listing_receipt_date"], "2020-01-06")
        self.assertEqual(initial["receipts"][OLD]["legacy_receipt_date"], "2019-12-31")
        with patch.object(folio, "structured_receipt", side_effect=AssertionError("date conflict parsed")), \
             patch.object(folio, "dart_document", side_effect=AssertionError("date conflict parsed")):
            self.assertEqual(folio.resolve_unfinished(initial, "test-key", limit=10), 0)
        self.assertEqual(initial["unresolved"][OLD], "receipt_date_conflict")
        self.assertEqual(initial["events"][OLD]["source"], "legacy_json_parser_result")
        self.assertNotIn(OLD, {event["receiptNo"] for event in make_snapshot(initial, {})["events"]})
        initial["holdings"][CORP].update(receipt_no=OLD, receipt_date="2019-12-31",
            quantity="75", company_ownership_percent="5.5", security_kind="common",
            corporate_action_status="verified", corporate_action_trade_date="2026-09-23")
        quote = {CODE: {"close": "100", "trade_date": "2026-09-23", "market": "KRX",
                        "session": "regular", "currency": "KRW", "adjusted": False,
                        "provider": "naver", "observed_at": "2026-09-26T00:00:00Z", "verified": True}}
        holding = make_snapshot(initial, quote)["holdings"][0]
        self.assertEqual(holding["receiptDate"], "2020-01-06")
        self.assertEqual(holding["evidence"], "unresolved-latest")
        self.assertEqual(holding["valuationExclusionReason"], "latest_filing_unresolved")
        self.assertIsNone(holding["estimatedValue"])

    def test_daily_resolver_respects_historical_receipt_retry_cap(self):
        initial = state()
        folio.apply_listing_row(initial, row(), historical=True)
        receipt = initial["receipts"][OLD]
        receipt["parse_attempt_count"] = folio.HISTORICAL_PARSE_ATTEMPTS - 1
        receipt["last_parse_attempt_on"] = folio.kst_today().isoformat()
        with patch.object(folio, "structured_receipt", side_effect=AssertionError("same-day retry")):
            self.assertEqual(folio.resolve_unfinished(initial, "test-key"), 0)
        receipt["last_parse_attempt_on"] = "2020-01-01"
        with patch.object(folio, "structured_receipt", side_effect=RuntimeError("temporary")), \
             patch.object(folio, "dart_document", side_effect=RuntimeError("temporary")):
            self.assertEqual(folio.resolve_unfinished(initial, "test-key"), 1)
        self.assertEqual(receipt["parse_attempt_count"], folio.HISTORICAL_PARSE_ATTEMPTS)
        with patch.object(folio, "structured_receipt", side_effect=AssertionError("cap bypassed")):
            self.assertEqual(folio.resolve_unfinished(initial, "test-key"), 0)

    def test_only_the_nps_institution_large_holding_listing_is_accepted(self):
        self.assertTrue(folio.nps_large_holding_listing(row(flr_nm="국민연금관리공단")))
        self.assertTrue(folio.nps_large_holding_listing(row(flr_nm="National Pension Service")))
        self.assertTrue(folio.nps_large_holding_listing(row(flr_nm="국민연금관리공단 (기금)",
            report_nm="일반투자자-주식등의대량보유(변동)보고서")))
        self.assertFalse(folio.nps_large_holding_listing(row(flr_nm="국민연금02-1동양벤처조합")))
        self.assertFalse(folio.nps_large_holding_listing(row(flr_nm="국민연금공단벤처조합")))
        self.assertFalse(folio.nps_large_holding_listing(row(flr_nm="국민연금공단",
            report_nm="임원ㆍ주요주주특정증권등소유상황보고서")))
        initial = state()
        self.assertFalse(folio.apply_listing_row(initial, row(flr_nm="국민연금02-1동양벤처조합"), historical=True))
        self.assertNotIn(OLD, initial["receipts"])

    def test_listed_legacy_event_is_rechecked_with_original_fact_preserved(self):
        initial = state()
        initial["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2020-01-06",
            "corp_code": CORP, "stock_code": CODE, "quantity": "75",
            "company_ownership_percent": "5.5", "origin": "legacy_import",
            "evidence": "legacy_history_fact"}
        folio.apply_listing_row(initial, row(), historical=True)
        original_holding = copy.deepcopy(initial["holdings"])
        with patch.object(folio, "structured_receipt", return_value={
                "quantity": "80", "company_ownership_percent": "5.7",
                "reason": "", "evidence": "dart_structured"}) as parse:
            self.assertEqual(folio.recheck_legacy_history(initial, "test-key"), {"checked": 1, "verified": 1})
            self.assertEqual(folio.recheck_legacy_history(initial, "test-key"), {"checked": 0, "verified": 0})
        self.assertEqual(parse.call_count, 1)
        self.assertEqual(initial["receipts"][OLD]["legacy_fact"]["quantity"], "75")
        self.assertEqual(initial["events"][OLD]["quantity"], "80")
        self.assertEqual(initial["events"][OLD]["source"], "dart_structured")
        self.assertEqual(initial["holdings"], original_holding)

    def test_failed_legacy_recheck_keeps_imported_fact_and_retries_later(self):
        initial = state()
        initial["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2020-01-06",
            "corp_code": CORP, "stock_code": CODE, "quantity": "75",
            "company_ownership_percent": "5.5", "origin": "legacy_import",
            "evidence": "legacy_history_fact"}
        folio.apply_listing_row(initial, row(), historical=True)
        with patch.object(folio, "structured_receipt", side_effect=RuntimeError("transport")), \
             patch.object(folio, "dart_document", side_effect=RuntimeError("transport")):
            self.assertEqual(folio.recheck_legacy_history(initial, "test-key"), {"checked": 1, "verified": 0})
        self.assertEqual(initial["receipts"][OLD]["quantity"], "75")
        self.assertEqual(initial["receipts"][OLD]["evidence"], "legacy_history_fact")
        self.assertEqual(initial["receipts"][OLD]["source_recheck_error"], "RuntimeError")
        self.assertEqual(folio.recheck_legacy_history(initial, "test-key"), {"checked": 0, "verified": 0})

    def test_historical_coverage_uses_only_checked_listing_and_pending_past_events(self):
        initial = state()
        initial["historical_backfill"] = {"start_date": "2020-01-01", "target_date": "2020-01-31",
            "next_date": "2020-02-01", "coverage": [{"from": "2020-01-01", "to": "2020-01-31"}]}
        initial["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2020-01-06",
            "corp_code": CORP, "stock_code": CODE, "quantity": "75",
            "company_ownership_percent": "5.5", "origin": "legacy_import",
            "evidence": "legacy_history_fact"}
        folio.apply_listing_row(initial, row(), historical=True)
        folio.apply_listing_row(initial, row("20200107000001"), historical=True)
        coverage = make_snapshot(initial, {})["historicalCoverage"]
        self.assertEqual(coverage, {"searchStartDate": "2020-01-01", "searchTargetDate": "2020-01-31",
            "listingCompleteThrough": "2020-01-31", "listingComplete": True,
            "firstObservedNpsReceiptDate": "2020-01-06", "parsingPendingCount": 1,
            "legacySourceRecheckCount": 1})

    def test_scheduled_resume_is_noop_before_initialization_and_after_completion(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            self.assertEqual(folio.resume_history(path, "")["status"], "NOT_INITIALIZED")
            saved = folio.read_json(path)
            saved["historical_backfill"] = {"start_date": "2020-01-01", "target_date": "2020-01-31",
                                            "next_date": "2020-02-01", "coverage": [{"from": "2020-01-01",
                                                "to": "2020-01-31", "complete": True}]}
            folio.write_json(path, saved)
            before = path.read_bytes()
            with patch.object(folio, "dart_json", side_effect=AssertionError("listing refetched")):
                result = folio.resume_history(path, "test-key")
            self.assertEqual(result["status"], "LISTING_COMPLETE")
            self.assertEqual(result["listing_requests"], 0)
            self.assertEqual(path.read_bytes(), before)

    def test_scheduled_resume_parses_pending_receipt_without_listing_request(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            initial = state()
            initial["historical_backfill"] = {"start_date": "2020-01-01", "target_date": "2020-01-31",
                "next_date": "2020-02-01", "coverage": [{"from": "2020-01-01", "to": "2020-01-31",
                                                   "complete": True}]}
            folio.apply_listing_row(initial, row(), historical=True)
            folio.write_json(path, initial)
            with patch.object(folio, "dart_json", side_effect=AssertionError("listing refetched")), \
                 patch.object(folio, "structured_receipt", return_value={
                     "quantity": "80", "company_ownership_percent": "5.7",
                     "reason": "", "evidence": "dart_structured"}):
                result = folio.resume_history(path, "test-key")
            self.assertEqual((result["listing_requests"], result["parse_attempts"]), (0, 1))
            self.assertEqual(result["status"], "LISTING_COMPLETE")
            self.assertEqual(folio.read_json(path)["events"][OLD]["quantity"], "80")

    def test_public_event_source_never_calls_legacy_or_unknown_evidence_dart_verified(self):
        initial = state()
        for number, source in enumerate(("legacy_import", "legacy_history_fact", "unclassified", "dart_document", "dart_structured")):
            no = f"20200106{number:06d}"
            initial["events"][no] = {"receipt_no": no, "receipt_date": "2020-01-06",
                "corp_code": CORP, "stock_code": CODE, "kind": "other",
                "correction_of": None, "quantity": "80", "company_ownership_percent": "5.7",
                "source": source}
        public = make_snapshot(initial, {})
        actual = {event["receiptNo"]: event["source"] for event in public["events"]}
        self.assertEqual([actual[f"20200106{number:06d}"] for number in range(5)],
                         ["legacy-import", "legacy-import", "legacy-import",
                          "dart-document", "dart-structured"])

    def test_complete_windows_resume_without_moving_incremental_cursor_or_holdings(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            initial = state()
            initial["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2020-01-06",
                "corp_code": CORP, "stock_code": CODE, "quantity": "75",
                "company_ownership_percent": "5.5", "origin": "legacy_import",
                "evidence": "legacy_history_fact"}
            folio.write_json(path, initial)
            def listing(endpoint, params, key):
                if params["bgn_de"] == "20200101":
                    return page([row(OLD), row("20200107000001")])
                return {"status": "013", "list": []}
            with patch.object(folio, "dart_json", side_effect=listing):
                first = folio.backfill_history(path, date(2020, 1, 1), date(2020, 4, 1),
                                               "test-key", max_windows=1, parse_limit=0, recheck_limit=0)
                second = folio.backfill_history(path, date(2020, 1, 1), date(2020, 4, 1),
                                                "test-key", max_windows=1, parse_limit=0, recheck_limit=0)
            saved = folio.read_json(path)
            self.assertEqual((first["windows_this_run"], second["windows_this_run"]), (1, 1))
            self.assertEqual(second["status"], "LISTING_COMPLETE_PARSING_PENDING")
            self.assertEqual(second["next_date"], "2020-04-02")
            self.assertEqual(len(saved["historical_backfill"]["coverage"]), 2)
            self.assertEqual(saved["latest_complete_listing_date"], "2026-09-26")
            self.assertEqual(saved["holdings"], initial["holdings"])
            self.assertEqual(saved["receipts"][OLD]["origin"], "legacy_import")
            self.assertIn("listing_verified_at", saved["receipts"][OLD])
            self.assertNotIn("historical_backfill_only", saved["receipts"][OLD])
            self.assertTrue(saved["receipts"]["20200107000001"]["historical_backfill_only"])

    def test_later_window_failure_keeps_only_completed_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            def listing(endpoint, params, key):
                if params["bgn_de"] == "20200101":
                    return {"status": "013", "list": []}
                raise RuntimeError("transient listing failure")
            with patch.object(folio, "dart_json", side_effect=listing):
                with self.assertRaises(RuntimeError):
                    folio.backfill_history(path, date(2020, 1, 1), date(2020, 4, 1),
                                           "test-key", parse_limit=0)
            saved = folio.read_json(path)
            self.assertEqual(saved["historical_backfill"]["next_date"], "2020-03-21")
            self.assertEqual(len(saved["historical_backfill"]["coverage"]), 1)
            self.assertEqual(saved["latest_complete_listing_date"], "2026-09-26")

    def test_old_document_facts_add_event_without_rewriting_current_holding(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            initial = state()
            original_holding = copy.deepcopy(initial["holdings"])
            folio.write_json(path, initial)
            facts = {"quantity": "80", "company_ownership_percent": "5.7",
                     "reason": "", "evidence": "dart_structured"}
            with patch.object(folio, "dart_json", return_value=page([row()])), \
                 patch.object(folio, "structured_receipt", return_value=facts):
                result = folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 31),
                                                "test-key", parse_limit=1)
            saved = folio.read_json(path)
            self.assertEqual(result["parse_attempts"], 1)
            self.assertEqual(result["status"], "LISTING_COMPLETE")
            self.assertEqual(saved["holdings"], original_holding)
            self.assertEqual(saved["events"][OLD]["quantity"], "80")
            self.assertEqual(saved["events"][OLD]["source"], "dart_structured")
            self.assertNotIn(OLD, saved["unresolved"])

    def test_imported_unresolved_receipt_stays_eligible_for_daily_resolution(self):
        initial = state()
        initial["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2020-01-06",
            "corp_code": CORP, "stock_code": CODE, "evidence": "legacy_json_parser_result"}
        initial["unresolved"][OLD] = "needs_filing_parse"
        folio.apply_listing_row(initial, row(), historical=True)
        self.assertNotIn("historical_backfill_only", initial["receipts"][OLD])
        with patch.object(folio, "structured_receipt", return_value={
                "quantity": "80", "company_ownership_percent": "5.7",
                "reason": "", "evidence": "dart_structured"}):
            self.assertEqual(folio.resolve_unfinished(initial, "test-key", limit=1), 1)
        self.assertEqual(initial["events"][OLD]["quantity"], "80")

    def test_live_overlap_can_promote_a_previously_historical_only_receipt(self):
        initial = state()
        later = "20260925000001"
        folio.apply_listing_row(initial, row(later), historical=True)
        self.assertTrue(initial["receipts"][later]["historical_backfill_only"])
        folio.apply_listing_row(initial, row(later))
        self.assertNotIn("historical_backfill_only", initial["receipts"][later])
        with patch.object(folio, "structured_receipt", return_value={
                "quantity": "120", "company_ownership_percent": "6.5",
                "reason": "", "evidence": "dart_structured"}):
            self.assertEqual(folio.resolve_unfinished(initial, "test-key", limit=1), 1)
        self.assertEqual(initial["holdings"][CORP]["receipt_no"], later)

    def test_insufficient_page_budget_never_advances_a_partial_window(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            first = {"status": "000", "page_no": "1", "total_page": "2",
                     "total_count": "200", "list": [row(f"20200106{i:06d}") for i in range(100)]}
            with patch.object(folio, "dart_json", return_value=first) as request:
                result = folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 31),
                                                "test-key", max_listing_pages=1, parse_limit=0)
            self.assertEqual(request.call_count, 1)
            self.assertEqual(result["windows_this_run"], 0)
            self.assertEqual(result["next_date"], "2020-01-01")
            saved = folio.read_json(path)["historical_backfill"]
            self.assertEqual(saved["coverage"], [])
            self.assertLess(saved["max_window_days"], 31)

    def test_oversize_window_shrinks_without_skipping_dates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            oversized = {"status": "000", "page_no": "1", "total_page": "3",
                         "total_count": "300", "list": [row(f"20200101{i:06d}") for i in range(100)]}
            def listing(endpoint, params, key):
                return oversized if params["end_de"] == "20200131" else {"status": "013", "list": []}
            with patch.object(folio, "dart_json", side_effect=listing):
                result = folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 31),
                    "test-key", max_listing_pages=2, max_windows=1, parse_limit=0, recheck_limit=0)
            self.assertEqual(result["listing_requests"], 2)
            self.assertEqual(result["windows_this_run"], 1)
            coverage = folio.read_json(path)["historical_backfill"]["coverage"][0]
            self.assertEqual((coverage["from"], coverage["to"], coverage["pages"], coverage["complete"]),
                             ("2020-01-01", "2020-01-16", 1, True))
            self.assertEqual(result["next_date"], "2020-01-17")

    def test_single_day_over_budget_reports_required_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state())
            oversized = {"status": "000", "page_no": "1", "total_page": "3",
                         "total_count": "300", "list": [row(f"20200101{i:06d}") for i in range(100)]}
            with patch.object(folio, "dart_json", return_value=oversized):
                result = folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 1),
                    "test-key", max_listing_pages=2, parse_limit=0, recheck_limit=0)
            self.assertEqual(result["status"], "LISTING_BUDGET_INSUFFICIENT")
            self.assertEqual(result["required_pages"], 3)
            self.assertEqual(result["next_date"], "2020-01-01")
            self.assertIsNone(folio.read_json(path)["historical_backfill"])

    def test_historical_withdrawal_retains_fact_and_unresolved_relation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            initial = state()
            folio.write_json(path, initial)
            with patch.object(folio, "dart_json", return_value=page([
                    row(report_nm="[기재정정]주식등의대량보유상황보고서", rm="철")])), \
                 patch.object(folio, "structured_receipt", return_value={
                     "quantity": "80", "company_ownership_percent": "5.7",
                     "reason": "", "evidence": "dart_structured"}):
                folio.backfill_history(path, date(2020, 1, 1), date(2020, 1, 31),
                                       "test-key", parse_limit=1)
            saved = folio.read_json(path)
            self.assertEqual(saved["holdings"], initial["holdings"])
            self.assertEqual(saved["events"][OLD]["quantity"], "80")
            self.assertEqual(saved["unresolved"][OLD], "withdrawal_unverified")
            self.assertIsNone(saved["receipts"][OLD]["correction_of"])


if __name__ == "__main__":
    unittest.main()
