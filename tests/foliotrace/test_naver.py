import importlib.util
import json
import unittest
from datetime import datetime, time, timezone
from pathlib import Path
from unittest.mock import patch


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


def chart(code="000660", close="1862000", day="20260923"):
    return (f'<?xml version="1.0" encoding="EUC-KR"?><protocol><chartdata name="테스트" symbol="{code}" '
            f'timeframe="minute"><item data="{day}1530|null|null|null|{close}|100" />'
            f'<item data="{day}1959|null|null|null|1863000|200" /></chartdata></protocol>').encode("euc-kr")


class NaverTests(unittest.TestCase):
    def test_official_calendar_holiday_and_special_session_close(self):
        dates = ["2026-01-01", "2026-02-16", "2026-05-01", "2026-09-24", "2026-10-09"]
        holidays = naver.parse_krx_holidays(json.dumps({"block1": [{"calnd_dd": day} for day in dates]}).encode(), 2026)
        observed = datetime(2026, 10, 10, 1, tzinfo=timezone.utc)
        self.assertEqual(naver.expected_session(observed, closures=holidays).isoformat(), "2026-10-08")
        with self.assertRaisesRegex(naver.QuoteError, "calendar response invalid"):
            naver.parse_krx_holidays(json.dumps({"block1": [{"calnd_dd": day} for day in dates[:-1]] +
                                                 [{"calnd_dd": dates[0]}]}).encode(), 2026)

        special = {naver.date(2026, 11, 12): (time(16, 30), time(17, 30))}
        before = datetime(2026, 11, 12, 8, 0, tzinfo=timezone.utc)
        after = datetime(2026, 11, 12, 8, 35, tzinfo=timezone.utc)
        self.assertEqual(naver.expected_session(before, closures=holidays, special_closes=special).isoformat(), "2026-11-11")
        self.assertEqual(naver.expected_session(after, closures=holidays, special_closes=special).isoformat(), "2026-11-12")
        basic = {"itemCode": "000660", "stockEndType": "stock", "closePrice": "110",
                 "marketStatus": "CLOSE", "marketStatusDetailType": "close",
                 "localTradedAt": "2026-11-12T17:35:00+09:00",
                 "stockExchangeType": {"code": "KS", "zoneId": "Asia/Seoul", "nationCode": "KOR"}}
        daily = [{"localTradedAt": "2026-11-12", "closePrice": "110"}]
        special_chart = (b'<protocol><chartdata symbol="000660" timeframe="minute">'
                         b'<item data="202611121530|null|null|null|100|1"/>'
                         b'<item data="202611121630|null|null|null|110|2"/></chartdata></protocol>')
        result = naver.parse_quote("000660", basic, daily, special_chart, "2026-11-12T08:35:00Z",
                                   official_close="110", holidays=holidays, special_closes=special)
        self.assertEqual((result["close"], result["close_basis"]), ("110", "naver_krx_special_close_kind_confirmed"))
        with self.assertRaisesRegex(naver.QuoteError, "chart/KRX close mismatch"):
            naver.parse_quote("000660", basic, daily, special_chart, "2026-11-12T08:35:00Z",
                              official_close="110", holidays=holidays)

    def test_missing_chart_row_retries_larger_window_once(self):
        basic, daily = response(close="110")
        client = naver.NaverClient()
        with patch.object(client, "_json", side_effect=[basic, daily]), \
             patch.object(client, "_chart", side_effect=[chart(day="20260922"), chart(close="100")]) as fetch_chart, \
             patch.object(client, "_kind_close", return_value="100") as official, \
             patch.object(naver, "holiday_set_for", return_value=frozenset({naver.date(2026, 9, 24), naver.date(2026, 9, 25)})):
            result = client.quote("000660", "2026-09-26T00:00:00Z")
        self.assertEqual(result["close"], "100")
        self.assertEqual([call.args[1] for call in fetch_chart.call_args_list], [500, 2000])
        official.assert_called_once()

    def test_special_session_intraday_minute_must_match_official_close(self):
        basic, daily = response(close="110")
        minute = chart(close="100")
        with self.assertRaisesRegex(naver.QuoteError, "chart/KRX close mismatch"):
            naver.parse_quote("000660", basic, daily, minute, "2026-09-26T00:00:00Z", official_close="110")
        with self.assertRaisesRegex(naver.QuoteError, "KRX close unverified"):
            naver.parse_quote("000660", basic, daily, minute, "2026-09-26T00:00:00Z")

    def test_official_prior_close_row_is_usable_during_newer_session(self):
        page = ('<input id="repIsuSrtCd" value="A402340"><input id="comAbbrv" value="SK스퀘어">'
                '* 2026-09-28 종가 기준<table><tr><th>현재가</th><td>1200000</td></tr>'
                '<tr><th>2026-09-23 종가</th><td>1190000</td></tr></table>')
        self.assertEqual(naver.parse_kind_close(page, "2026-09-23", "402340", "SK스퀘어"), "1190000")
        with self.assertRaisesRegex(naver.QuoteError, "close date unverified"):
            naver.parse_kind_close(page.replace("2026-09-28 종가 기준", "2026-09-22 종가 기준"),
                                   "2026-09-23", "402340", "SK스퀘어")

    def test_exact_security_code_allows_official_company_suffix(self):
        page = ('<input id="repIsuSrtCd" value="A015760"><input id="comAbbrv" value="한국전력공사">'
                '* 2026-09-23 종가 기준<table><tr><th>현재가</th><td>23750</td></tr>'
                '<tr><th>2026-09-23 종가</th><td>23750</td></tr></table>')
        self.assertEqual(naver.parse_kind_close(page, "2026-09-23", "015760", "한국전력"), "23750")
        with self.assertRaisesRegex(naver.QuoteError, "security identity mismatch"):
            naver.parse_kind_close(page.replace("A015760", "A015761"), "2026-09-23", "015760", "한국전력")

    def test_exact_security_code_allows_sk_company_spelling(self):
        page = ('<input id="repIsuSrtCd" value="A326030"><input id="comAbbrv" value="에스케이바이오팜">'
                '* 2026-09-23 종가 기준<table><tr><th>현재가</th><td>100</td></tr>'
                '<tr><th>2026-09-23 종가</th><td>100</td></tr></table>')
        self.assertEqual(naver.parse_kind_close(page, "2026-09-23", "326030", "SK바이오팜"), "100")
        with self.assertRaisesRegex(naver.QuoteError, "security identity mismatch"):
            naver.parse_kind_close(page.replace("A326030", "A326031"), "2026-09-23", "326030", "SK바이오팜")

    def test_regular_close_ignores_different_after_market_price(self):
        basic, daily = response()
        quote = naver.parse_quote("000660", basic, daily, chart(), "2026-09-26T00:00:00Z", official_close="1862000")
        self.assertEqual(quote["close"], "1862000")
        self.assertEqual(quote["daily_reference_close"], "1863000")
        self.assertEqual(quote["trade_date"], "2026-09-23")
        self.assertEqual(quote["session"], "regular")
        self.assertEqual(quote["adjusted"], False)

    def test_alphanumeric_code_and_rejections(self):
        basic, daily = response("0126Z0", "331,000")
        self.assertEqual(naver.parse_quote("0126Z0", basic, daily, chart("0126Z0", "330000"), "2026-09-26T00:00:00Z", official_close="330000")["close"], "330000")
        for changed in ({"marketStatus": "OPEN"}, {"itemCode": "005930"}, {"closePrice": "1,864,000"}):
            with self.subTest(changed=changed), self.assertRaises(naver.QuoteError):
                naver.parse_quote("0126Z0", {**basic, **changed}, daily, chart("0126Z0", "330000"), "2026-09-26T00:00:00Z", official_close="330000")
        with self.assertRaises(naver.QuoteError):
            naver.parse_quote("0126Z0", basic, [{"localTradedAt": "2026-09-22", "closePrice": "331,000"}], chart("0126Z0", "330000"), "2026-09-26T00:00:00Z", official_close="330000")
        with self.assertRaises(naver.QuoteError):
            naver.parse_quote("0126Z0", basic, daily, chart("0126Z0", "330000"), "2026-10-02T00:00:00Z", official_close="330000")

    def test_chart_rejects_missing_or_duplicate_regular_close(self):
        with self.assertRaisesRegex(naver.QuoteError, "15:30 close unverified"):
            naver.parse_regular_chart("000660", chart(day="20260922"), "2026-09-23")
        duplicate = chart().replace(b"</chartdata>", b'<item data="202609231530|null|null|null|1862000|100" /></chartdata>')
        with self.assertRaisesRegex(naver.QuoteError, "15:30 close unverified"):
            naver.parse_regular_chart("000660", duplicate, "2026-09-23")
        with self.assertRaisesRegex(naver.QuoteError, "regular chart invalid"):
            naver.parse_regular_chart("000660", b"<!DOCTYPE protocol>" + chart(), "2026-09-23")

    def test_delayed_close_requires_exact_official_identity_date_and_price(self):
        late = chart("402340", "1190000").replace(b"202609231530", b"202609231532")
        with self.assertRaisesRegex(naver.QuoteError, "15:30 close unverified"):
            naver.parse_regular_chart("402340", late, "2026-09-23")
        self.assertEqual(naver.parse_regular_chart("402340", late, "2026-09-23", official_close="1190000"), "1190000")
        with self.assertRaisesRegex(naver.QuoteError, "chart/KRX close mismatch"):
            naver.parse_regular_chart("402340", late, "2026-09-23", official_close="1191000")
        too_late = late.replace(b"202609231532", b"202609231540")
        with self.assertRaisesRegex(naver.QuoteError, "delayed close unverified"):
            naver.parse_regular_chart("402340", too_late, "2026-09-23", official_close="1190000")
        conflict = late.replace(b"</chartdata>", b'<item data="202609231536|null|null|null|1191000|101" /></chartdata>')
        with self.assertRaisesRegex(naver.QuoteError, "chart/KRX close mismatch"):
            naver.parse_regular_chart("402340", conflict, "2026-09-23", official_close="1190000")
        page = ('<input id="repIsuSrtCd" value="A402340"><input id="comAbbrv" value="SK스퀘어">'
                '* 2026-09-23 종가 기준<table><tr><th>현재가</th><td>1190000</td></tr>'
                '<tr><th>2026-09-23 종가</th><td>1190000</td></tr></table>')
        self.assertEqual(naver.parse_kind_close(page, "2026-09-23", "402340", "SK스퀘어"), "1190000")
        with self.assertRaisesRegex(naver.QuoteError, "security identity mismatch"):
            naver.parse_kind_close(page, "2026-09-23", "402340", "다른회사")
        with self.assertRaisesRegex(naver.QuoteError, "close date unverified"):
            naver.parse_kind_close(page, "2026-09-22", "402340", "SK스퀘어")

    def test_intraday_cache_miss_uses_independently_cross_checked_prior_close(self):
        basic, daily = response(close="110")
        basic.update(marketStatus="OPEN", marketStatusDetailType="open",
                     localTradedAt="2026-09-28T10:00:00+09:00",
                     compareToPreviousClosePrice="10",
                     compareToPreviousPrice={"name": "RISING"})
        daily = [{"localTradedAt": "2026-09-28", "closePrice": "110"},
                 {"localTradedAt": "2026-09-23", "closePrice": "100"}]
        quote = naver.parse_quote("000660", basic, daily, chart(close="99"), "2026-09-28T01:00:00Z", official_close="99")
        self.assertEqual((quote["trade_date"], quote["close"]), ("2026-09-23", "99"))
        basic["compareToPreviousClosePrice"] = "9"
        self.assertEqual(naver.parse_quote("000660", basic, daily, chart(close="99"), "2026-09-28T01:00:00Z", official_close="99")["close"], "99")
        with self.assertRaisesRegex(naver.QuoteError, "latest completed KRX session unverified"):
            naver.parse_quote("000660", basic, daily[:1], chart(close="99"), "2026-09-28T01:00:00Z", official_close="99")


if __name__ == "__main__":
    unittest.main()
