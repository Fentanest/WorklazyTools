import json
import tempfile
import unittest
from datetime import datetime, timezone
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
        with patch.object(folio, "dart_json", return_value={"status": "000", "total_page": "1", "total_count": "1",
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
        self.assertEqual(state["events"][a]["kind"], "increase")
        self.assertEqual(state["events"][b]["kind"], "decrease")
        self.assertEqual(state["holdings"][CORP]["receipt_no"], b)

    def test_future_filing_is_not_backdated_or_history_replaced(self):
        state = state_with_holding()
        state["holdings"][CORP].update(receipt_no="20260928000001", receipt_date="2026-09-28", quantity="200")
        state["published_history"] = [{"trade_date": "2026-09-23", "estimated_value": "1000",
            "dataset_version": "a" * 64, "methodology_version": "1"}]
        snapshot = make_snapshot(state, {CODE: quote()}, datetime(2026, 9, 28, 1, tzinfo=timezone.utc))
        self.assertIsNone(snapshot["estimatedValue"])
        self.assertEqual(snapshot["holdings"][0]["valuationExclusionReason"], "filing_after_quote_date")
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
            self.assertEqual(imported["events"][OLD]["kind"], "increase")
            imported["events"] = {}
            imported["receipts"]["20260901000001"]["quantity"] = None
            imported["receipts"]["20260901000001"]["evidence"] = "legacy_reference_only"
            folio.write_json(path, imported)
            first = folio.backfill_legacy(export, path, True)
            second = folio.backfill_legacy(export, path, True)
            self.assertEqual((first["added_events"], second["added_events"]), (2, 0))
            self.assertEqual(folio.read_json(path)["receipts"]["20260901000001"]["quantity"], "80")
            self.assertEqual(folio.read_json(path)["receipts"]["20260901000001"]["evidence"], "legacy_history_fact")

    def test_dated_security_share_jump_excluded_small_drift_retained(self):
        state = state_with_holding()
        state["holdings"][CORP]["receipt_date"] = "2026-09-08"
        historic = {CODE: {"name": "Synthetic", "isin": "KR7005930003", "listed_shares_thousands": "100"}}
        current = {CODE: {"name": "Synthetic", "isin": "KR7005930003", "listed_shares_thousands": "102"}}
        fetch = lambda day: (historic, "a" * 64)
        result = folio.reconcile_corporate_actions(state, "2026-09-23", current, fetch=fetch)
        self.assertEqual(result["verified"], 1)
        current[CODE]["listed_shares_thousands"] = "500"
        result = folio.reconcile_corporate_actions(state, "2026-09-23", current, fetch=fetch)
        self.assertEqual(result["unverified"], 1)
        self.assertEqual(state["holdings"][CORP]["corporate_action_reason"], "material_share_count_change")

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
            self.assertEqual(keys, [f"{CODE}|KRX|regular|2026-09-23|naver-chart1530-kind-v1"])


if __name__ == "__main__":
    unittest.main()
