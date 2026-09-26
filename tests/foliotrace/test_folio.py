import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
from pipeline.foliotrace.publish import digest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts/foliotrace/folio.py"
SPEC = importlib.util.spec_from_file_location("folio", MODULE_PATH)
folio = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(folio)


class MigrationTests(unittest.TestCase):
    def test_kst_cutoff_uses_korean_calendar_date_on_utc_runner(self):
        self.assertEqual(folio.kst_today(datetime(2026, 9, 25, 15, 1, tzinfo=timezone.utc)), date(2026, 9, 26))

    def test_same_day_correction_and_withdrawal_keep_prior_holding_until_link_verified(self):
        state = folio.empty_state()
        state["universe"]["00104856"] = {"name": "Test", "stock_code": "005930"}
        state["holdings"]["00104856"] = {"corp_code": "00104856", "stock_code": "005930", "receipt_no": "20260924000001", "quantity": "10", "tracking": "active"}
        rows = [
            {"rcept_no": "20260925000001", "corp_code": "00104856", "rcept_dt": "20260925", "flr_nm": "국민연금공단", "report_nm": "주식등의대량보유상황보고서", "rm": "정"},
            {"rcept_no": "20260925000002", "corp_code": "00104856", "rcept_dt": "20260925", "flr_nm": "국민연금공단", "report_nm": "[정정]주식등의대량보유상황보고서", "rm": ""},
            {"rcept_no": "20260925000003", "corp_code": "00104856", "rcept_dt": "20260925", "flr_nm": "국민연금공단", "report_nm": "주식등의대량보유상황보고서", "rm": "철"},
        ]
        for row in rows:
            folio.apply_listing_row(state, row)
        for row in rows:
            folio.apply_listing_row(state, row)  # overlap rerun
        self.assertEqual(len(state["receipts"]), 3)
        with patch.object(folio, "structured_receipt", return_value={"quantity": "20", "company_ownership_percent": "6", "reason": "", "evidence": "dart_structured"}):
            self.assertEqual(folio.resolve_unfinished(state, "test-key"), 3)
        self.assertEqual(state["holdings"]["00104856"]["receipt_no"], "20260924000001")
        self.assertEqual(state["holdings"]["00104856"]["latest_unresolved_receipt"], "20260925000003")
        self.assertTrue(all(state["receipts"][row["rcept_no"]]["correction_of"] is None for row in rows))
        self.assertEqual(len(state["events"]), 3)
        self.assertEqual(len(state["unresolved"]), 3)

    def test_delayed_structured_row_uses_exact_document_fallback(self):
        state = folio.empty_state()
        state["universe"]["00104856"] = {"name": "Test", "stock_code": "005930"}
        folio.apply_listing_row(state, {"rcept_no": "20260925000001", "corp_code": "00104856", "rcept_dt": "20260925", "flr_nm": "국민연금공단", "report_nm": "주식등의대량보유상황보고서"})
        with patch.object(folio, "structured_receipt", return_value=None), patch.object(folio, "dart_document", return_value={"quantity": "12", "company_ownership_percent": "5.2", "reason": "", "xml_sha256": "abc"}) as document:
            self.assertEqual(folio.resolve_unfinished(state, "test-key"), 1)
        document.assert_called_once_with("20260925000001", "test-key")
        self.assertEqual(state["holdings"]["00104856"]["quantity"], "12")
        self.assertEqual(state["events"]["20260925000001"]["source"], "dart_document")

    def test_document_parser_requires_nps_and_preserves_decimal(self):
        def document(filer):
            xml = f'<ROOT><TE ACODE="RPT_RSP_NM">{filer}</TE><TE ACODE="SUM_TMT_CNT">9,007,199,254,740,993</TE><TE ACODE="SUM_TMT_RT">5.25</TE></ROOT>'
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w") as archive:
                archive.writestr("report.xml", xml.encode("utf-8"))
            return output.getvalue()

        parsed = folio.parse_filing_document(document("국민연금공단"))
        self.assertEqual(parsed["quantity"], "9007199254740993")
        self.assertEqual(parsed["company_ownership_percent"], "5.25")
        with self.assertRaises(ValueError):
            folio.parse_filing_document(document("다른기관"))

    def test_exact_voting_only_mapping_and_ambiguous_class(self):
        def table(extra="-"):
            cells = ["국민연금기금", "219-82-01593", "식별", "1,033,888", extra, "-", "-", "-", "-", "-", "-", "-", "1,033,888", "7.10"]
            return "<TABLE><TR><TH>보유주식등의 내역</TH><TH>의결권 있는 주식</TH><TH>주수</TH></TR><TR>" + "".join(f"<TD>{v}</TD>" for v in cells) + "</TR></TABLE>"
        self.assertEqual(folio.verified_voting_share_quantity(table(), "1033888"), "1033888")
        self.assertIsNone(folio.verified_voting_share_quantity(table("1"), "1033888"))
        self.assertIsNone(folio.verified_voting_share_quantity(table(), "1033889"))
        class_row = "<TABLE><TR><TD>보통주</TD><TD>009450</TD><TD>1,033,888</TD></TR></TABLE>"
        self.assertEqual(folio.verified_common_stock_code(class_row, "1033888"), "009450")
        self.assertIsNone(folio.verified_common_stock_code(class_row.replace("009450", "009451"), "1033889"))
        state = folio.empty_state()
        no = "20260401003327"
        state["universe"]["00101488"] = {"name": "Test", "stock_code": "009450"}
        state["holdings"]["00101488"] = {"corp_code": "00101488", "stock_code": "009450", "name": "Test", "receipt_no": no,
                                          "quantity": "1033888", "security_kind": "unknown", "valuation_exclusion_reason": "security_mapping_unverified"}
        state["mapping_ledger"][no] = {"status": "unverified", "method": "earlier-parser", "reason": "old"}
        parsed = {"quantity": "1033888", "verified_voting_share_quantity": "1033888", "verified_common_stock_code": "009450", "xml_sha256": "a" * 64}
        with patch.object(folio, "dart_document", return_value=parsed) as document:
            self.assertEqual(folio.reconcile_security(state, "test-key", pause=lambda _: None,
                                                      master={"009450": "Test"}, master_hash="b" * 64)["mapped"], 1)
            self.assertEqual(folio.reconcile_security(state, "test-key", pause=lambda _: None,
                                                      master={"009450": "Test"})["checked"], 0)
        document.assert_called_once_with(no, "test-key")
        self.assertEqual(state["mapping_ledger"][no]["method"], folio.MAPPING_METHOD)
        self.assertEqual(state["holdings"]["00101488"]["security_kind"], "common")
        self.assertEqual(state["holdings"]["00101488"]["quantity"], "1033888")
        self.assertEqual(folio.parse_krx_security_master('<table><tr><td>주권</td><td>Test</td><td>KR7009450008</td><td>2020</td><td>1</td></tr><tr><td>주권</td><td>Test우</td><td>KR7009451006</td><td>2020</td><td>1</td></tr></table>'), {"009450": "Test"})

    def test_targeted_legacy_reference_metadata_recovery(self):
        state = folio.empty_state()
        no = "20200804001234"
        state["receipts"][no] = {"receipt_no": no, "evidence": "legacy_reference_only", "corp_code": None, "stock_code": None,
                                  "quantity": None, "origin": "legacy_import"}
        state["unresolved"][no] = "metadata_missing"
        state["universe"]["00101488"] = {"name": "Test", "stock_code": "009450"}
        row = {"rcept_no": no, "corp_code": "00101488", "rcept_dt": "20200804", "flr_nm": "국민연금공단",
               "report_nm": "주식등의대량보유상황보고서", "corp_name": "Test"}
        with patch.object(folio, "dart_json", return_value={"status": "000", "total_page": "1", "total_count": "1", "list": [row]}) as dart:
            first = folio.recover_metadata(state, "test-key")
            second = folio.recover_metadata(state, "test-key")
        self.assertEqual(first["references_matched"], 1)
        self.assertEqual(second["dates_checked"], 0)
        self.assertEqual(dart.call_args.args[1]["bgn_de"], "20200804")
        self.assertEqual(state["receipts"][no]["stock_code"], "009450")

    def test_quote_cache_snapshot_and_published_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state_path, output = root / "state.json", root / "publish.json"
            state = folio.empty_state()
            state["import_ledger"] = ["seed"]
            no = "20260923000001"
            state["receipts"][no] = {"receipt_date": "2026-09-23"}
            state["holdings"]["00101488"] = {"corp_code": "00101488", "stock_code": "009450", "name": "Test",
                "receipt_no": no, "receipt_date": "2026-09-23", "quantity": "9007199254740993",
                "company_ownership_percent": "5", "security_kind": "common", "tracking": "active", "evidence": "dart_document",
                "corporate_action_status": "verified", "corporate_action_trade_date": "2026-09-23"}
            folio.write_json(state_path, state)
            quote = {"close": "1.25", "currency": "KRW", "market": "KRX", "session": "regular",
                     "trade_date": "2026-09-23", "adjusted": False, "provider": "naver", "observed_at": "2026-09-26T00:00:00Z", "verified": True,
                     "close_basis": "naver_krx_1530_kind_confirmed"}
            state["quote_cache"]["009450|KRX|regular|2026-09-23|raw"] = {**quote, "close": "99", "close_basis": "basic_daily_v1"}
            folio.write_json(state_path, state)
            class Client:
                requests = 2
                def quote(self, code):
                    self.requests += 2
                    return quote
            with patch.object(folio, "expected_session", return_value=date(2026, 9, 23)):
                first = folio.price_and_value(state_path, output, Client())
                second = folio.price_and_value(state_path, output, Client())
            self.assertEqual(first["priced"], 1)
            self.assertEqual(first["cache_hits"], 0)
            self.assertEqual(second["cache_hits"], 1)
            self.assertEqual(folio.read_json(output)["estimatedValue"], "11258999068426241.25")
            snap = folio.read_json(output)
            projection = {key: value for key, value in snap.items() if key != "datasetVersion"}
            projection["history"] = [{**item, "datasetVersion": ""} if item["datasetVersion"] == snap["datasetVersion"] else item
                                     for item in snap["history"]]
            self.assertEqual(digest(projection), snap["datasetVersion"])
            recorded = folio.record_published(state_path, version=snap["datasetVersion"],
                                               trade_date=snap["valuationTradeDate"], estimated_value=snap["estimatedValue"])
            self.assertEqual(recorded["history_count"], 1)
            self.assertTrue(folio.record_published(state_path, version=snap["datasetVersion"],
                trade_date=snap["valuationTradeDate"], estimated_value=snap["estimatedValue"])["idempotent_noop"])
            dist = root / "dist"
            for lang in ("ko", "en"):
                page = dist / lang / "tools/foliotrace/index.html"
                page.parent.mkdir(parents=True)
                page.write_text('<div class="seo-static-fallback"><main></main></div>')
            (dist / "index.html").write_text("built")
            emitted = folio.emit_snapshot(output, dist)
            self.assertEqual(emitted["snapshot_sha256"], folio.sha((dist / "data/foliotrace/v1/snapshots" / f'{snap["datasetVersion"]}.json').read_bytes()))
            self.assertIn("11258999068426241.25", (dist / "en/tools/foliotrace/index.html").read_text())

    def test_production_valuation_rejects_zero_mappings_and_total_quote_outage(self):
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "state.json"
            output = Path(directory) / "publish.json"
            state = folio.empty_state()
            state["import_ledger"] = ["seed"]
            state["holdings"]["00101488"] = {"stock_code": "009450", "quantity": "10", "security_kind": "unknown"}
            folio.write_json(state_path, state)
            with self.assertRaisesRegex(RuntimeError, "no verified stock-class mappings"):
                folio.price_and_value(state_path, output)
            self.assertFalse(output.exists())
            state["holdings"]["00101488"]["security_kind"] = "common"
            folio.write_json(state_path, state)
            class FailedClient:
                requests = 1
                def quote(self, code):
                    raise folio.QuoteError("quote request failed")
            with patch.object(folio, "expected_session", return_value=date(2026, 9, 23)):
                with self.assertRaisesRegex(RuntimeError, "all 1 eligible quote codes failed"):
                    folio.price_and_value(state_path, output, FailedClient())
            self.assertFalse(output.exists())

    def test_export_import_preserves_stock_code_and_does_not_import_price(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            (source / "universe.json").write_text(json.dumps({"01965324": ["Test", "0126Z0"]}))
            (source / "report-cache.json").write_text(json.dumps({"20260908000001": {"filer": "국민연금공단", "stkqy": 12.5, "stkrt": 6.2}}))
            (source / "holdings-latest.json").write_text(json.dumps({"as_of_date": "20260925", "holdings": [{"corp_code": "01965324", "code": "0126Z0", "name": "Test", "rcept_no": "20260908000001", "last_report_date": "20260908", "stkqy": 12.5, "stkrt": 6.2, "price": 100, "market_value": 1250}]}))
            export = root / "export"
            state = root / "state.json"
            folio.export_source(source, export)
            first = folio.import_seed(export, state, True)
            second = folio.import_seed(export, state, True)
            self.assertEqual(first["holdings_with_evidence"], 1)
            self.assertEqual(first["resume_anchor"], "2026-09-08")
            self.assertTrue(second["idempotent_noop"])
            data = folio.read_json(state)
            self.assertEqual(data["revision"], 1)
            self.assertEqual(data["holdings"]["01965324"]["stock_code"], "0126Z0")
            self.assertNotIn("price", data["holdings"]["01965324"])
            self.assertNotIn("market_value", data["holdings"]["01965324"])

    def test_collect_overlaps_observed_anchor_and_advances_only_complete_chunk(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            data = folio.empty_state()
            data["import_ledger"] = ["seed"]
            data["legacy_resume_hint"] = "2026-09-08"
            folio.write_json(state, data)
            calls = []

            def fake_dart(endpoint, params, key):
                calls.append(params.copy())
                if params["page_no"] == 1:
                    return {"status": "000", "total_page": "2", "total_count": "101", "list": [{"rcept_no": "20260909000001", "corp_code": "00104856", "stock_code": "005930", "rcept_dt": "20260909", "flr_nm": "국민연금공단", "corp_name": "Test"}] + [{"flr_nm": "Other"}] * 99}
                return {"status": "000", "list": [{"flr_nm": "Other"}]}

            with patch.object(folio, "dart_json", side_effect=fake_dart), patch.object(folio, "resolve_unfinished", return_value=0):
                result = folio.collect(state, date(2026, 9, 26), "test-key")
            self.assertEqual(result["requested_from"], "2026-09-01")
            self.assertEqual(result["new_receipts"], 1)
            self.assertEqual(len(calls), 2)
            self.assertEqual(folio.read_json(state)["latest_complete_listing_date"], "2026-09-26")

    def test_partial_listing_does_not_advance_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            data = folio.empty_state()
            data["import_ledger"] = ["seed"]
            data["legacy_resume_hint"] = "2026-09-08"
            folio.write_json(state, data)
            with patch.object(folio, "dart_json", return_value={"status": "000", "total_page": "2", "total_count": "101", "list": []}):
                with self.assertRaises(RuntimeError):
                    folio.collect(state, date(2026, 9, 26), "test-key")
            self.assertIsNone(folio.read_json(state)["latest_complete_listing_date"])

    def test_completed_chunk_survives_later_chunk_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            data = folio.empty_state()
            data["import_ledger"] = ["seed"]
            data["legacy_resume_hint"] = "2026-01-08"
            folio.write_json(state, data)

            def fake_dart(endpoint, params, key):
                if params["bgn_de"] == "20260101":
                    return {"status": "013", "list": []}
                raise RuntimeError("later chunk failed")

            with patch.object(folio, "dart_json", side_effect=fake_dart):
                with self.assertRaises(RuntimeError):
                    folio.collect(state, date(2026, 4, 1), "test-key")
            saved = folio.read_json(state)
            self.assertEqual(saved["latest_complete_listing_date"], "2026-03-21")
            self.assertEqual(len(saved["listing_coverage"]), 1)


if __name__ == "__main__":
    unittest.main()
