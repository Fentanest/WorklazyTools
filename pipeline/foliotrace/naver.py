"""Naver domestic daily close adapter with explicit source and session checks."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from datetime import date, datetime, time as clock_time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo


CODE = re.compile(r"^[0-9A-Z]{6}$")
BASE = "https://m.stock.naver.com/api/stock"
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


def parse_quote(code, basic, daily, observed_at, *, today=None):
    """Select the last completed regular session and cross-check the basic quote."""
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
    close = _amount(dated[0].get("closePrice"))
    basic_date = basic_at.astimezone(ZoneInfo("Asia/Seoul")).date()
    if basic_date == expected:
        if basic.get("marketStatus") != "CLOSE" or basic.get("marketStatusDetailType") != "close":
            raise QuoteError("regular close not final")
        corroborated = _amount(basic.get("closePrice"))
    elif basic_date == today and basic_date > expected:
        direction = (basic.get("compareToPreviousPrice") or {}).get("name")
        change = Decimal(_amount(basic.get("compareToPreviousClosePrice"), allow_zero=True))
        current = Decimal(_amount(basic.get("closePrice")))
        if direction == "RISING":
            corroborated = format(current - change, "f")
        elif direction == "FALLING":
            corroborated = format(current + change, "f")
        elif direction == "UNCHANGED" and change == 0:
            corroborated = format(current, "f")
        else:
            raise QuoteError("previous close unverified")
    else:
        raise QuoteError("quote date mismatch")
    if close != corroborated:
        raise QuoteError("regular close mismatch")
    return {"close": close, "currency": "KRW", "market": "KRX", "session": "regular",
            "trade_date": expected.isoformat(), "adjusted": False, "provider": "naver",
            "observed_at": observed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), "verified": True}


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

    def quote(self, code, observed_at=None):
        if not CODE.fullmatch(code):
            raise QuoteError("invalid stock code")
        if code in self.cache:
            return self.cache[code]
        observed_at = observed_at or datetime.now(timezone.utc).isoformat()
        basic = self._json(f"{BASE}/{code}/basic")
        daily = self._json(f"{BASE}/{code}/price?pageSize=5&page=1")
        quote = parse_quote(code, basic, daily, observed_at)
        self.cache[code] = quote
        return quote
