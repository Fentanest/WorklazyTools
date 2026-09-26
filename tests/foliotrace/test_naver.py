import importlib.util
import unittest
from pathlib import Path


PATH = Path(__file__).resolve().parents[2] / "pipeline/foliotrace/naver.py"
SPEC = importlib.util.spec_from_file_location("naver", PATH)
naver = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(naver)


def response(code="000660", close="1,863,000", over="1,864,000"):
    basic = {"itemCode": code, "stockEndType": "stock", "closePrice": close,
             "marketStatus": "CLOSE", "marketStatusDetailType": "close",
             "localTradedAt": "2026-09-23T20:20:23+09:00",
             "stockExchangeType": {"code": "KS", "zoneId": "Asia/Seoul", "nationCode": "KOR"},
             "overMarketPriceInfo": {"tradingSessionType": "AFTER_MARKET", "overPrice": over}}
    daily = [{"localTradedAt": "2026-09-23", "closePrice": close}]
    return basic, daily


class NaverTests(unittest.TestCase):
    def test_regular_close_ignores_different_after_market_price(self):
        basic, daily = response()
        quote = naver.parse_quote("000660", basic, daily, "2026-09-26T00:00:00Z")
        self.assertEqual(quote["close"], "1863000")
        self.assertEqual(quote["trade_date"], "2026-09-23")
        self.assertEqual(quote["session"], "regular")
        self.assertEqual(quote["adjusted"], False)

    def test_alphanumeric_code_and_rejections(self):
        basic, daily = response("0126Z0", "331,000")
        self.assertEqual(naver.parse_quote("0126Z0", basic, daily, "2026-09-26T00:00:00Z")["close"], "331000")
        for changed in ({"marketStatus": "OPEN"}, {"itemCode": "005930"}, {"closePrice": "1,864,000"}):
            with self.subTest(changed=changed), self.assertRaises(naver.QuoteError):
                naver.parse_quote("0126Z0", {**basic, **changed}, daily, "2026-09-26T00:00:00Z")
        with self.assertRaises(naver.QuoteError):
            naver.parse_quote("0126Z0", basic, [{"localTradedAt": "2026-09-22", "closePrice": "331,000"}], "2026-09-26T00:00:00Z")
        with self.assertRaises(naver.QuoteError):
            naver.parse_quote("0126Z0", basic, daily, "2026-10-02T00:00:00Z")


if __name__ == "__main__":
    unittest.main()
