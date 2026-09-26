"""Naver domestic daily close adapter with explicit source and session checks."""
from __future__ import annotations

import json
from html.parser import HTMLParser
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, time as clock_time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo


CODE = re.compile(r"^[0-9A-Z]{6}$")
BASE = "https://m.stock.naver.com/api/stock"
CHART_BASE = "https://fchart.stock.naver.com/sise.nhn"
KIND_BASE = "https://kind.krx.co.kr/common/stockprices.do"
# Confirmed KRX closures: https://kind.krx.co.kr/external/dst/notice/11637/
# [한국거래소] 2026년 올빼미공시 안내.pdf (2026 Chuseok, Sep 24-27).
KNOWN_CLOSURES = {date(2026, 9, 24), date(2026, 9, 25)}


class QuoteError(ValueError):
    pass


def _amount(value, *, allow_zero=False):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9][0-9,]*(?:\.[0-9]+)?", value):
        raise QuoteError("invalid close price")
    try:
        n = Decimal(value.replace(",", ""))
    except InvalidOperation as exc:
        raise QuoteError("invalid close price") from exc
    if not n.is_finite() or n < 0 or (n == 0 and not allow_zero):
        raise QuoteError("invalid close price")
    return format(n, "f")


def expected_session(observed):
    kst = observed.astimezone(ZoneInfo("Asia/Seoul"))
    candidate = kst.date() if kst.time() >= clock_time(16, 30) else kst.date() - timedelta(days=1)
    while candidate.weekday() >= 5 or candidate in KNOWN_CLOSURES:
        candidate -= timedelta(days=1)
    return candidate


def parse_regular_chart(code, payload, traded, *, official_close=None, with_basis=False):
    """Select a Naver minute only when the dated KRX close confirms its price."""
    if not CODE.fullmatch(code) or not isinstance(payload, bytes) or len(payload) > 2_000_000 or b"<!DOCTYPE" in payload.upper() or b"<!ENTITY" in payload.upper():
        raise QuoteError("regular chart invalid")
    try:
        root = ET.fromstring(payload.decode("euc-kr"))
    except (ET.ParseError, UnicodeError, LookupError, ValueError) as exc:
        raise QuoteError("regular chart invalid") from exc
    chart = root.find("chartdata")
    if chart is None or chart.get("symbol") != code or chart.get("timeframe") != "minute":
        raise QuoteError("regular chart identity mismatch")
    stamp = traded.replace("-", "") + "1530"
    rows = [item.get("data", "").split("|") for item in chart.findall("item")]
    matched = [row for row in rows if row and row[0] == stamp]
    if len(matched) == 1 and len(matched[0]) == 6 and official_close is not None:
        close = _amount(matched[0][4])
        if close != _amount(official_close):
            raise QuoteError("regular chart/KRX close mismatch")
        return (close, "naver_krx_1530_kind_confirmed") if with_basis else close
    if matched or official_close is None:
        raise QuoteError("regular chart 15:30 close unverified")
    prefix = traded.replace("-", "")
    delayed = [row for row in rows if len(row) == 6 and row[0].startswith(prefix)
               and re.fullmatch(r"15(?:3[1-9])", row[0][8:])]
    if not delayed or min(row[0][8:] for row in delayed) > "1535":
        raise QuoteError("regular chart delayed close unverified")
    prices = {_amount(row[4]) for row in delayed}
    if prices != {_amount(official_close)}:
        raise QuoteError("regular chart/KRX close mismatch")
    close = _amount(official_close)
    return (close, "naver_krx_delayed_auction_kind_confirmed") if with_basis else close


class _KindRows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None
        self.inputs = {}

    def handle_starttag(self, tag, attrs):
        if tag == "input":
            fields = dict(attrs)
            if fields.get("id") in ("repIsuSrtCd", "comAbbrv"):
                self.inputs[fields["id"]] = fields.get("value")
        if tag == "tr":
            self.row = []
        elif self.row is not None and tag in ("th", "td"):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("th", "td") and self.cell is not None and self.row is not None:
            self.row.append("".join(self.cell).strip())
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def parse_kind_close(page, traded, code, name):
    if not isinstance(page, str) or len(page) > 1_000_000:
        raise QuoteError("KRX close response invalid")
    referenced = re.findall(r"\*\s*(\d{4}-\d{2}-\d{2})\s*종가 기준", page)
    if len(referenced) != 1 or referenced[0] < traded:
        raise QuoteError("KRX close date unverified")
    parser = _KindRows()
    parser.feed(page)
    official_name = parser.inputs.get("comAbbrv")
    same_name = isinstance(name, str) and (official_name == name or official_name == name + "공사"
                                           or name.startswith("SK") and official_name == "에스케이" + name[2:])
    if parser.inputs.get("repIsuSrtCd") != f"A{code}" or not same_name:
        raise QuoteError("KRX security identity mismatch")
    rows = [row for row in parser.rows if len(row) >= 2 and row[0] == f"{traded} 종가"]
    current = [row for row in parser.rows if len(row) >= 2 and row[0] == "현재가"]
    if len(rows) != 1 or len(current) != 1:
        raise QuoteError("KRX close date unverified")
    close = _amount(rows[0][1])
    if referenced[0] == traded and close != _amount(current[0][1]):
        raise QuoteError("KRX close response mismatch")
    return close


def parse_quote(code, basic, daily, chart, observed_at, *, today=None, official_close=None):
    """Cross-check Naver identity/date, then use the 15:30 KRX chart close."""
    if not CODE.fullmatch(code) or not isinstance(basic, dict) or not isinstance(daily, list) or not daily:
        raise QuoteError("invalid quote response")
    exchange = basic.get("stockExchangeType")
    if basic.get("itemCode") != code or basic.get("stockEndType") != "stock":
        raise QuoteError("security identity mismatch")
    if not isinstance(exchange, dict) or exchange.get("code") not in ("KS", "KQ") or exchange.get("zoneId") != "Asia/Seoul" or exchange.get("nationCode") != "KOR":
        raise QuoteError("market unverified")
    try:
        basic_at = datetime.fromisoformat(basic["localTradedAt"])
        observed = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
    except (KeyError, TypeError, ValueError) as exc:
        raise QuoteError("quote date unverified") from exc
    if basic_at.tzinfo is None or observed.tzinfo is None:
        raise QuoteError("quote date mismatch")
    today = today or observed.astimezone(ZoneInfo("Asia/Seoul")).date()
    expected = expected_session(observed)
    dated = [row for row in daily if isinstance(row, dict) and row.get("localTradedAt") == expected.isoformat()]
    if len(dated) != 1 or expected > today or expected.weekday() >= 5:
        raise QuoteError(f"latest completed KRX session unverified: expected {expected.isoformat()}")
    daily_close = _amount(dated[0].get("closePrice"))
    basic_date = basic_at.astimezone(ZoneInfo("Asia/Seoul")).date()
    if basic_date == expected:
        if basic.get("marketStatus") != "CLOSE" or basic.get("marketStatusDetailType") != "close":
            raise QuoteError("regular close not final")
        corroborated = _amount(basic.get("closePrice"))
    elif basic_date == today and basic_date > expected:
        # During the next session, the basic comparison may use a different
        # prior session close; the dated 15:30 chart is the price evidence.
        corroborated = daily_close
    else:
        raise QuoteError("quote date mismatch")
    if daily_close != corroborated:
        raise QuoteError("source daily/basic mismatch")
    if official_close is None:
        raise QuoteError("KRX close unverified")
    close, basis = parse_regular_chart(code, chart, expected.isoformat(), official_close=official_close, with_basis=True)
    return {"close": close, "currency": "KRW", "market": "KRX", "session": "regular",
            "trade_date": expected.isoformat(), "adjusted": False, "provider": "naver",
            "observed_at": observed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), "verified": True,
            "daily_reference_close": daily_close,
            "close_basis": basis}


class NaverClient:
    def __init__(self, *, opener=None, sleep=time.sleep, min_interval=0.25, retries=2):
        self.opener = opener or urllib.request.urlopen
        self.sleep = sleep
        self.min_interval = min_interval
        self.retries = retries
        self.next_request_at = 0.0
        self.cache = {}
        self.requests = 0

    def _json(self, url):
        for attempt in range(self.retries + 1):
            delay = self.next_request_at - time.monotonic()
            if delay > 0:
                self.sleep(delay)
            self.next_request_at = time.monotonic() + self.min_interval
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FolioTrace/1.0", "Accept": "application/json"})
            try:
                self.requests += 1
                with self.opener(request, timeout=10) as response:
                    if not response.headers.get("Content-Type", "").lower().startswith("application/json"):
                        raise QuoteError("unexpected quote content type")
                    return json.load(response)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                if attempt == self.retries or isinstance(exc, urllib.error.HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                    raise QuoteError("quote request failed") from exc
                self.sleep(min(2 ** attempt, 4))
        raise QuoteError("quote request failed")

    def _chart(self, code, count):
        url = f"{CHART_BASE}?symbol={code}&timeframe=minute&count={count}&requestType=0"
        for attempt in range(self.retries + 1):
            delay = self.next_request_at - time.monotonic()
            if delay > 0:
                self.sleep(delay)
            self.next_request_at = time.monotonic() + self.min_interval
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FolioTrace/1.0", "Accept": "application/xml,text/xml"})
            try:
                self.requests += 1
                with self.opener(request, timeout=10) as response:
                    if "xml" not in response.headers.get("Content-Type", "").lower():
                        raise QuoteError("unexpected regular chart content type")
                    return response.read(2_000_001)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                if attempt == self.retries or isinstance(exc, urllib.error.HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                    raise QuoteError("regular chart request failed") from exc
                self.sleep(min(2 ** attempt, 4))
        raise QuoteError("regular chart request failed")

    def _kind_close(self, code, trade_date, name):
        url = f"{KIND_BASE}?isurCd={code[:5]}&method=searchStockPricesMain"
        for attempt in range(self.retries + 1):
            delay = self.next_request_at - time.monotonic()
            if delay > 0:
                self.sleep(delay)
            self.next_request_at = time.monotonic() + self.min_interval
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FolioTrace/1.0", "Accept": "text/html"})
            try:
                self.requests += 1
                with self.opener(request, timeout=10) as response:
                    if not response.headers.get("Content-Type", "").lower().startswith("text/html"):
                        raise QuoteError("unexpected KRX content type")
                    return parse_kind_close(response.read(1_000_001).decode("utf-8"), trade_date, code, name)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, UnicodeError) as exc:
                if attempt == self.retries or isinstance(exc, urllib.error.HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                    raise QuoteError("KRX close request failed") from exc
                self.sleep(min(2 ** attempt, 4))
        raise QuoteError("KRX close request failed")

    def quote(self, code, observed_at=None):
        if not CODE.fullmatch(code):
            raise QuoteError("invalid stock code")
        if code in self.cache:
            return self.cache[code]
        observed_at = observed_at or datetime.now(timezone.utc).isoformat()
        basic = self._json(f"{BASE}/{code}/basic")
        daily = self._json(f"{BASE}/{code}/price?pageSize=5&page=1")
        chart = self._chart(code, 500)
        traded = expected_session(datetime.fromisoformat(observed_at.replace("Z", "+00:00"))).isoformat()
        official_close = self._kind_close(code, traded, basic.get("stockName"))
        try:
            quote = parse_quote(code, basic, daily, chart, observed_at, official_close=official_close)
        except QuoteError as exc:
            if not any(reason in str(exc) for reason in ("15:30 close unverified", "delayed close unverified")):
                raise
            chart = self._chart(code, 2000)
            quote = parse_quote(code, basic, daily, chart, observed_at, official_close=official_close)
        self.cache[code] = quote
        return quote
