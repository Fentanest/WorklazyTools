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

    def test_intraday_cache_miss_uses_independently_cross_checked_prior_close(self):
        basic, daily = response(close="110")
        basic.update(marketStatus="OPEN", marketStatusDetailType="open",
                     localTradedAt="2026-09-28T10:00:00+09:00",
                     compareToPreviousClosePrice="10",
                     compareToPreviousPrice={"name": "RISING"})
        daily = [{"localTradedAt": "2026-09-28", "closePrice": "110"},
                 {"localTradedAt": "2026-09-23", "closePrice": "100"}]
        quote = naver.parse_quote("000660", basic, daily, "2026-09-28T01:00:00Z")
        self.assertEqual((quote["trade_date"], quote["close"]), ("2026-09-23", "100"))
        basic["compareToPreviousClosePrice"] = "9"
        with self.assertRaisesRegex(naver.QuoteError, "regular close mismatch"):
            naver.parse_quote("000660", basic, daily, "2026-09-28T01:00:00Z")
        basic["compareToPreviousClosePrice"] = "10"
        with self.assertRaisesRegex(naver.QuoteError, "latest completed KRX session unverified"):
            naver.parse_quote("000660", basic, daily[:1], "2026-09-28T01:00:00Z")


if __name__ == "__main__":
    unittest.main()
