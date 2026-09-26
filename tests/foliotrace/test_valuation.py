import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[2] / "pipeline/foliotrace/valuation.py"
SPEC = importlib.util.spec_from_file_location("valuation", MODULE_PATH)
valuation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(valuation)


class ValuationTests(unittest.TestCase):
    def test_exact_decimal_and_global_denominator(self):
        holdings = [
            {"stock_code": "005930", "quantity": "9007199254740993", "security_kind": "common", "tracking": "active"},
            {"stock_code": "0126Z0", "quantity": "2", "security_kind": "preferred", "tracking": "active"},
            {"stock_code": "000001", "quantity": "2", "security_kind": "unknown", "tracking": "active"},
        ]
        quotes = {
            "005930": {"close": "1.25", "verified": True, "trade_date": "2026-09-25", "market": "KRX", "session": "regular"},
            "0126Z0": {"close": "2", "verified": True, "trade_date": "2026-09-25", "market": "KRX", "session": "regular"},
            "000001": {"close": "100", "verified": True, "trade_date": "2026-09-25", "market": "KRX", "session": "regular"},
        }
        result = valuation.value_holdings(holdings, quotes, "2026-09-25")
        self.assertEqual(result["holdings"][0]["estimated_value"], "11258999068426241.25")
        self.assertEqual(result["estimated_value"], "11258999068426245.25")
        self.assertEqual(result["priced_count"], 2)
        self.assertEqual(result["valuation_coverage"], "partial")
        self.assertEqual(result["holdings"][2]["valuation_exclusion_reason"], "security_mapping_unverified")

    def test_old_day_and_total_failure_are_not_zero_value(self):
        result = valuation.value_holdings(
            [{"stock_code": "005930", "quantity": "100", "security_kind": "common", "tracking": "active"}],
            {"005930": {"close": "10", "verified": True, "trade_date": "2026-09-24", "market": "KRX", "session": "regular"}},
            "2026-09-25",
        )
        self.assertIsNone(result["estimated_value"])
        self.assertEqual(result["valuation_coverage"], "unavailable")
        self.assertEqual(result["holdings"][0]["valuation_exclusion_reason"], "quote_date_or_session_mismatch")


if __name__ == "__main__":
    unittest.main()
