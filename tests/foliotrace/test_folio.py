import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts/foliotrace/folio.py"
SPEC = importlib.util.spec_from_file_location("folio", MODULE_PATH)
folio = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(folio)


class MigrationTests(unittest.TestCase):
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
                    return {"status": "000", "total_page": "2", "total_count": "101", "list": [{"rcept_no": "20260909000001", "corp_code": "00104856", "rcept_dt": "20260909", "flr_nm": "국민연금공단", "corp_name": "Test"}] + [{"flr_nm": "Other"}] * 99}
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
