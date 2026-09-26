import json
import tempfile
import unittest
from datetime import datetime, time, timezone
from pathlib import Path
from unittest.mock import patch

from scripts.foliotrace import folio
from pipeline.foliotrace.publish import make_snapshot


CORP = "00104856"
CODE = "005930"
OLD = "20260922000001"


def state_with_holding():
    state = folio.empty_state()
    state["import_ledger"] = ["synthetic"]
    state["universe"][CORP] = {"name": "Synthetic", "stock_code": CODE}
    state["receipts"][OLD] = {"receipt_no": OLD, "receipt_date": "2026-09-22", "corp_code": CORP,
        "stock_code": CODE, "quantity": "100", "company_ownership_percent": "6", "evidence": "dart_document"}
    state["holdings"][CORP] = {"corp_code": CORP, "stock_code": CODE, "name": "Synthetic",
        "receipt_no": OLD, "receipt_date": "2026-09-22", "quantity": "100",
        "company_ownership_percent": "6", "security_kind": "common", "tracking": "active",
        "evidence": "dart_document", "corporate_action_status": "verified",
        "corporate_action_trade_date": "2026-09-23"}
    return state


def listing(no, **changes):
    row = {"rcept_no": no, "corp_code": CORP, "stock_code": CODE, "corp_name": "Synthetic",
        "rcept_dt": no[:8], "flr_nm": "국민연금공단", "report_nm": "주식등의대량보유상황보고서", "rm": ""}
    row.update(changes)
    return row


def quote():
    return {"close": "10", "currency": "KRW", "market": "KRX", "session": "regular",
        "trade_date": "2026-09-23", "adjusted": False, "provider": "naver",
        "observed_at": "2026-09-23T08:00:00Z", "verified": True}


class ReviewFixTests(unittest.TestCase):
    def test_special_session_rejects_cached_normal_close(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            state = state_with_holding()
            state["receipts"][OLD]["receipt_date"] = "2025-11-13"
            state["holdings"][CORP].update(receipt_date="2025-11-13", corporate_action_trade_date="2025-11-13")
            state["quote_cache"][f"{CODE}|KRX|regular|2025-11-13|naver-chart1530-kind-v2"] = {
                **quote(), "trade_date": "2025-11-13", "close_basis": "naver_krx_1530_kind_confirmed"}
            folio.write_json(path, state)
            class Client:
                requests = 0
                special_closes = {folio.date(2025, 11, 13): (time(16, 30), time(17, 30))}
                def expected_session(self, observed):
                    return folio.date(2025, 11, 13)
                def quote(self, code):
                    raise folio.QuoteError("special session close missing")
            with self.assertRaisesRegex(RuntimeError, "all 1 eligible quote codes failed"):
                folio.price_and_value(path, Path(directory) / "publish.json", Client())

    def test_duplicate_listing_pages_do_not_advance_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            state = folio.empty_state()
            state.update(import_ledger=["synthetic"], legacy_resume_hint="2026-09-23")
            folio.write_json(path, state)
            rows = [listing(f"20260923{i:06d}") for i in range(100)]
            def duplicate_page(endpoint, params, key):
                return {"status": "000", "total_page": "2", "total_count": "200",
                        "page_no": str(params["page_no"]), "list": rows}
            with patch.object(folio, "dart_json", side_effect=duplicate_page):
                with self.assertRaisesRegex(RuntimeError, "receipt coverage inconsistent"):
                    folio.collect(path, folio.date(2026, 9, 23), "test-key", overlap=0)
            saved = folio.read_json(path)
            self.assertIsNone(saved["latest_complete_listing_date"])
            self.assertEqual(saved["listing_coverage"], [])
            self.assertEqual(saved["receipts"], {})

    def test_metadata_recovery_rejects_duplicate_pages_without_marking_date_checked(self):
        state = folio.empty_state()
        no = "20260923000000"
        state["receipts"][no] = {"receipt_no": no, "corp_code": None, "stock_code": None,
                                "evidence": "legacy_reference_only", "origin": "legacy_import"}
        state["unresolved"][no] = "metadata_missing"
        rows = [listing(f"20260923{i:06d}") for i in range(100)]
        def duplicate(endpoint, params, key):
            return {"status": "000", "page_no": str(params["page_no"]), "total_page": "2",
                    "total_count": "200", "list": rows}
        with patch.object(folio, "dart_json", side_effect=duplicate):
            with self.assertRaisesRegex(RuntimeError, "receipt coverage inconsistent"):
                folio.recover_metadata(state, "test-key")
        self.assertEqual(state["metadata_recovery"], {})
        self.assertIsNone(state["receipts"][no]["corp_code"])

    def test_listing_page_identity_drift_is_rejected(self):
        first = {"status": "000", "page_no": "1", "total_page": "2", "total_count": "101",
                 "list": [listing(f"20260923{i:06d}") for i in range(100)]}
        second = {"status": "000", "page_no": "1", "total_page": "2", "total_count": "101",
                  "list": [listing("20260923000100")]}
        with self.assertRaisesRegex(RuntimeError, "page identity inconsistent"):
            folio.validate_listing_pages([first, second])

    def test_failed_parse_batch_does_not_starve_older_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            state = folio.empty_state()
            for i in range(31):
                folio.apply_listing_row(state, listing(f"20260923{i:06d}"))
            target = "20260923000000"
            folio.write_json(path, state)
            attempted = []
            def structured(no, *_):
                attempted.append(no)
                if no == target:
                    return {"quantity": "100", "company_ownership_percent": "6", "reason": "", "evidence": "dart_structured"}
                return None
            with patch.object(folio, "structured_receipt", side_effect=structured), \
                 patch.object(folio, "dart_document", side_effect=ValueError("unavailable")):
                first = folio.resolve_unfinished(state, "test-key", state_path=path)
                state = folio.read_json(path)
                second = folio.resolve_unfinished(state, "test-key", state_path=path)
            self.assertEqual((first, second), (30, 30))
            self.assertEqual(len(set(attempted)), 31)
            self.assertNotIn(target, folio.read_json(path)["unresolved"])
            self.assertEqual(folio.read_json(path)["holdings"][CORP]["quantity"], "100")

    def test_repeated_incomplete_listing_does_not_reset_retry_fairness(self):
        state = folio.empty_state()
        row = listing("20260923000010", stock_code="")
        folio.apply_listing_row(state, row)
        receipt = state["receipts"][row["rcept_no"]]
        receipt["parse_attempt_count"] = 7
        folio.apply_listing_row(state, row)
        self.assertEqual(receipt["parse_attempt_count"], 7)
        folio.apply_listing_row(state, {**row, "stock_code": CODE})
        self.assertEqual(receipt["parse_attempt_count"], 0)

    def test_current_receipt_identity_conflict_excludes_value(self):
        state = state_with_holding()
        folio.apply_listing_row(state, listing(OLD, stock_code="000660"))
        self.assertEqual(state["unresolved"][OLD], "security_identity_conflict")
        snapshot = make_snapshot(state, {CODE: quote()}, datetime(2026, 9, 23, 8, tzinfo=timezone.utc))
        self.assertEqual(snapshot["holdings"][0]["latestUnresolvedReceiptNo"], OLD)
        self.assertEqual(snapshot["holdings"][0]["valuationExclusionReason"], "latest_filing_unresolved")
        self.assertIsNone(snapshot["estimatedValue"])

    def test_newest_failed_filing_survives_older_successful_holding_replacement(self):
        state = state_with_holding()
        earlier, latest = "20260923000001", "20260923000002"
        folio.apply_listing_row(state, listing(earlier))
        folio.apply_listing_row(state, listing(latest))
        def structured(no, *_):
            if no == latest:
                return None
            return {"quantity": "200", "company_ownership_percent": "6", "reason": "", "evidence": "dart_structured"}
        with patch.object(folio, "structured_receipt", side_effect=structured), patch.object(folio, "dart_document", side_effect=ValueError("bad document")):
            self.assertEqual(folio.resolve_unfinished(state, "test-key"), 2)
        self.assertEqual(state["holdings"][CORP]["receipt_no"], earlier)
        self.assertIn(latest, state["unresolved"])
        state["holdings"][CORP].update(security_kind="common", corporate_action_status="verified")
        snapshot = make_snapshot(state, {CODE: quote()}, datetime(2026, 9, 23, 8, tzinfo=timezone.utc))
        self.assertEqual(snapshot["holdings"][0]["latestUnresolvedReceiptNo"], latest)
        self.assertEqual(snapshot["holdings"][0]["valuationExclusionReason"], "latest_filing_unresolved")
        self.assertIsNone(snapshot["estimatedValue"])

    def test_document_fact_is_applied_after_exact_metadata_recovery_without_redownload(self):
        state = folio.empty_state()
        no = "20260923000003"
        state["receipts"][no] = {"receipt_no": no, "corp_code": None, "stock_code": None,
            "receipt_date": None, "evidence": "legacy_reference_only", "origin": "legacy_import"}
        state["unresolved"][no] = "metadata_missing"
        parsed = {"quantity": "200", "company_ownership_percent": "6", "reason": "", "evidence": "dart_document"}
        with patch.object(folio, "dart_document", return_value=parsed):
            self.assertEqual(folio.resolve_unfinished(state, "test-key"), 1)
        self.assertEqual(state["unresolved"][no], "security_identity_missing")
        folio.apply_listing_row(state, listing(no))
        self.assertEqual(state["unresolved"][no], "parsed_identity_ready")
        with patch.object(folio, "dart_document", side_effect=AssertionError("document refetched")), patch.object(folio, "structured_receipt", side_effect=AssertionError("structured refetched")):
            self.assertEqual(folio.resolve_unfinished(state, "test-key"), 1)
        self.assertNotIn(no, state["unresolved"])
        self.assertEqual(state["holdings"][CORP]["quantity"], "200")

    def test_all_unpriced_production_candidate_is_withheld(self):
        state = state_with_holding()
        state["holdings"][CORP]["corporate_action_status"] = "unverified"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state_path, output = root / "state.json", root / "publish.json"
            folio.write_json(state_path, state)
            class Client:
                requests = 1
                def quote(self, code):
                    return {**quote(), "close_basis": "naver_krx_1530_kind_confirmed"}
            with patch.object(folio, "expected_session", return_value=folio.date(2026, 9, 23)):
                with self.assertRaisesRegex(RuntimeError, "all tracked holdings are unpriced"):
                    folio.price_and_value(state_path, output, Client())
            self.assertFalse(output.exists())
            unavailable = make_snapshot(state, {CODE: quote()})
            folio.write_json(output, unavailable)
            dist = root / "dist"
            dist.mkdir()
            (dist / "index.html").write_text("<html></html>")
            with self.assertRaisesRegex(ValueError, "all tracked holdings are unpriced"):
                folio.emit_snapshot(output, dist)

    def test_official_correction_and_withdrawal_exclude_old_quantity(self):
        state = state_with_holding()
        first = "20260923000001"
        second = "20260923000002"
        folio.apply_listing_row(state, listing(first, report_nm="[기재정정]주식등의대량보유상황보고서"))
        folio.apply_listing_row(state, listing(second, report_nm="[첨부정정]주식등의대량보유상황보고서", rm="철"))
        with patch.object(folio, "structured_receipt", return_value={"quantity": "200", "company_ownership_percent": "6", "reason": "", "evidence": "dart_structured"}):
            folio.resolve_unfinished(state, "test-key")
        self.assertTrue(state["receipts"][first]["is_correction"])
        self.assertTrue(state["receipts"][second]["is_correction"])
        self.assertEqual(state["holdings"][CORP]["quantity"], "100")
        snapshot = make_snapshot(state, {CODE: quote()}, datetime(2026, 9, 23, 8, tzinfo=timezone.utc))
        row = snapshot["holdings"][0]
        self.assertEqual(row["evidence"], "unresolved-latest")
        self.assertEqual(row["latestUnresolvedReceiptNo"], second)
        self.assertEqual(row["latestUnresolvedReason"], "withdrawal_unverified")
        self.assertIsNone(row["estimatedValue"])
        self.assertEqual(row["valuationExclusionReason"], "latest_filing_unresolved")
        self.assertEqual(state["events"][first]["kind"], "other")

    def test_new_issuer_identity_and_metadata_cache_retry(self):
        state = state_with_holding()
        new_no = "20260923000002"
        new_corp, new_code = "00999999", "0126Z0"
        state["receipts"][new_no] = {"receipt_no": new_no, "corp_code": None, "stock_code": None,
            "quantity": "200", "company_ownership_percent": "6", "evidence": "legacy_json_parser_result",
            "origin": "legacy_import"}
        state["unresolved"][new_no] = "metadata_missing"
        with patch.object(folio, "dart_json", return_value={"status": "000", "page_no": "1", "total_page": "1", "total_count": "1",
                "list": [listing(new_no, corp_code=new_corp, stock_code=new_code)]}) as api:
            recovery = folio.recover_metadata(state, "test-key")
        self.assertEqual(recovery["references_matched"], 1)
        self.assertGreater(api.call_count, 0)
        self.assertEqual(state["universe"][new_corp]["stock_code"], new_code)
        self.assertEqual(state["receipts"][new_no]["stock_code"], new_code)
        with patch.object(folio, "structured_receipt", return_value={"quantity": "200", "company_ownership_percent": "6", "reason": "", "evidence": "dart_structured"}):
            self.assertEqual(folio.resolve_unfinished(state, "test-key"), 1)
        self.assertEqual(state["holdings"][new_corp]["stock_code"], new_code)

    def test_new_issuer_mapping_retries_when_krx_master_gains_code(self):
        state = state_with_holding()
        target = state["holdings"][CORP]
        target["security_kind"] = "unknown"
        self.assertEqual(folio.reconcile_security(state, "test-key", master={}, master_hash="a" * 64)["mapped"], 0)
        self.assertEqual(state["mapping_ledger"][OLD]["reason"], "krx_stock_class_or_name_unverified")
        document = {"verified_voting_share_quantity": "100", "quantity": "100", "xml_sha256": "c" * 64,
                    "verified_common_stock_code": CODE}
        with patch.object(folio, "dart_document", return_value=document):
            result = folio.reconcile_security(state, "test-key", master={CODE: "Synthetic"}, master_hash="b" * 64)
        self.assertEqual(result["mapped"], 1)
        self.assertEqual(target["security_kind"], "common")

    def test_same_day_event_uses_prior_receipt_not_latest_holding(self):
        state = state_with_holding()
        a, b = "20260923000001", "20260923000002"
        folio.apply_listing_row(state, listing(a))
        folio.apply_listing_row(state, listing(b))
        with patch.object(folio, "structured_receipt", side_effect=lambda no, *_: {
                "quantity": "200" if no == a else "150", "company_ownership_percent": "6", "reason": "", "evidence": "dart_structured"}):
            folio.resolve_unfinished(state, "test-key")
        self.assertEqual((state["events"][a]["kind"], state["events"][b]["kind"]), ("other", "other"))
        self.assertEqual((state["events"][a]["quantity"], state["events"][b]["quantity"]), ("200", "150"))
        self.assertEqual(state["holdings"][CORP]["receipt_no"], b)

    def test_future_filing_is_not_backdated_or_history_replaced(self):
        state = state_with_holding()
        state["holdings"][CORP].update(receipt_no="20260928000001", receipt_date="2026-09-28", quantity="200")
        state["published_history"] = [{"trade_date": "2026-09-23", "estimated_value": "1000",
            "dataset_version": "a" * 64, "methodology_version": "1"}]
        snapshot = make_snapshot(state, {CODE: quote()}, datetime(2026, 9, 28, 1, tzinfo=timezone.utc))
        self.assertIsNone(snapshot["estimatedValue"])
        self.assertEqual(snapshot["holdings"][0]["valuationExclusionReason"], "filing_after_quote_date")
        self.assertEqual(snapshot["holdings"][0]["quote"]["close"], quote()["close"])
        self.assertIsNone(snapshot["holdings"][0]["estimatedValue"])
        unverified_quote = dict(quote(), adjusted=True)
        self.assertIsNone(make_snapshot(state, {CODE: unverified_quote})["holdings"][0]["quote"])
        self.assertEqual(snapshot["history"][0]["estimatedValue"], "1000")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state)
            folio.record_published(path, version="b" * 64, trade_date="2026-09-23", estimated_value="2000")
            self.assertEqual(folio.read_json(path)["published_history"][0]["estimated_value"], "1000")

    def test_legacy_history_quantity_events_and_idempotent_backfill(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, export, path = root / "source", root / "export", root / "state.json"
            source.mkdir()
            folio.write_json(source / "universe.json", {CORP: ["Synthetic", CODE]})
            folio.write_json(source / "report-cache.json", {})
            folio.write_json(source / "holdings-latest.json", {"holdings": [{"corp_code": CORP, "code": CODE,
                "name": "Synthetic", "rcept_no": OLD, "last_report_date": "20260922", "stkqy": "100",
                "stkrt": "6", "history": [{"rcept_no": "20260901000001", "date": "20260901",
                "stkqy": "80", "stkrt": "5.1"}]}]})
            folio.export_source(source, export)
            folio.import_seed(export, path, True)
            imported = folio.read_json(path)
            self.assertEqual(imported["receipts"]["20260901000001"]["quantity"], "80")
            self.assertEqual(imported["events"][OLD]["kind"], "other")
            self.assertEqual(imported["events"][OLD]["quantity"], "100")
            imported["events"] = {}
            imported["receipts"]["20260901000001"]["quantity"] = None
            imported["receipts"]["20260901000001"]["evidence"] = "legacy_reference_only"
            folio.write_json(path, imported)
            first = folio.backfill_legacy(export, path, True)
            second = folio.backfill_legacy(export, path, True)
            self.assertEqual((first["added_events"], second["added_events"]), (2, 0))
            self.assertEqual(folio.read_json(path)["receipts"]["20260901000001"]["quantity"], "80")
            self.assertEqual(folio.read_json(path)["receipts"]["20260901000001"]["evidence"], "legacy_history_fact")

    def test_dated_security_share_change_requires_action_evidence(self):
        state = state_with_holding()
        state["holdings"][CORP]["receipt_date"] = "2026-09-08"
        historic = {CODE: {"name": "Synthetic", "isin": "KR7005930003", "listed_shares_thousands": "100"}}
        current = {CODE: {"name": "Synthetic", "isin": "KR7005930003", "listed_shares_thousands": "100"}}
        fetch = lambda day: (historic, "a" * 64)
        result = folio.reconcile_corporate_actions(state, "2026-09-23", current, fetch=fetch)
        self.assertEqual(result["verified"], 1)
        current[CODE]["listed_shares_thousands"] = "125"
        result = folio.reconcile_corporate_actions(state, "2026-09-23", current, fetch=fetch)
        self.assertEqual(result["unverified"], 1)
        self.assertEqual(state["holdings"][CORP]["corporate_action_reason"], "listed_share_count_changed_without_action_evidence")

    def test_officially_confirmed_delayed_chart_close_is_cached_separately(self):
        state = state_with_holding()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            output = Path(directory) / "publish.json"
            folio.write_json(path, state)
            delayed = {**quote(), "close_basis": "naver_krx_delayed_auction_kind_confirmed"}
            class Client:
                requests = 0
                def quote(self, code):
                    self.requests += 1
                    return delayed
            client = Client()
            with patch.object(folio, "expected_session", return_value=folio.date(2026, 9, 23)):
                first = folio.price_and_value(path, output, client)
                second = folio.price_and_value(path, output, client)
            self.assertEqual((first["cache_hits"], second["cache_hits"], client.requests), (0, 1, 1))
            keys = list(folio.read_json(path)["quote_cache"])
            self.assertEqual(keys, [f"{CODE}|KRX|regular|2026-09-23|naver-delayed-kind-v2"])


if __name__ == "__main__":
    unittest.main()
