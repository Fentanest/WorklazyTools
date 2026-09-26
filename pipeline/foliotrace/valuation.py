"""Exact valuation of verified quotes from one regular KRX session."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def decimal(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError):
        return None
    return result if result.is_finite() else None


def value_holdings(holdings, quotes, trade_date):
    """Return immutable rows, denominator, and honest valuation coverage."""
    rows = []
    total = Decimal(0)
    priced = 0
    for holding in holdings:
        row = dict(holding)
        quantity = decimal(holding.get("quantity"))
        quote = quotes.get(holding.get("stock_code"))
        reason = None
        if holding.get("tracking") == "below-5-percent":
            reason = "tracking_exit"
        elif holding.get("security_kind") not in ("common", "preferred"):
            reason = "security_mapping_unverified"
        elif quantity is None or quantity < 0:
            reason = "quantity_unverified"
        elif quantity == 0:
            reason = "zero_quantity"
        elif not quote or quote.get("verified") is not True:
            reason = "quote_unverified"
        elif quote.get("trade_date") != trade_date or quote.get("market") != "KRX" or quote.get("session") != "regular":
            reason = "quote_date_or_session_mismatch"
        elif quote.get("currency") != "KRW" or quote.get("adjusted") is not False:
            reason = "quote_basis_unverified"
        else:
            close = decimal(quote.get("close"))
            if close is None or close <= 0:
                reason = "quote_unverified"
        if reason:
            row["estimated_value"] = None
            row["portfolio_weight_percent"] = None
            row["valuation_exclusion_reason"] = reason
        else:
            amount = quantity * close
            row["estimated_value"] = format(amount, "f")
            row["portfolio_weight_percent"] = None
            row["valuation_exclusion_reason"] = None
            total += amount
            priced += 1
        rows.append(row)
    if priced == 0:
        return {"holdings": rows, "estimated_value": None, "priced_count": 0,
                "valuation_coverage": "unavailable", "trade_date": None}
    for row in rows:
        if row["estimated_value"] is not None:
            weight = (Decimal(row["estimated_value"]) * 100 / total).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
            row["portfolio_weight_percent"] = format(weight, "f")
    return {"holdings": rows, "estimated_value": format(total, "f"), "priced_count": priced,
            "valuation_coverage": "complete" if priced == len(rows) else "partial", "trade_date": trade_date}
