"""Build the public, versioned FolioTrace snapshot from normalized state."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from .valuation import value_holdings


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def make_snapshot(state, quotes, now=None):
    now = now or datetime.now(timezone.utc)
    stamp = now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    trade_dates = sorted({q["trade_date"] for q in quotes.values() if q.get("verified") and q.get("trade_date")})
    trade_date = trade_dates[-1] if trade_dates else None
    holdings = sorted(state["holdings"].values(), key=lambda h: (h.get("stock_code") or "", h.get("corp_code") or ""))
    valued = value_holdings(holdings, quotes, trade_date) if trade_date else value_holdings(holdings, {}, "")
    rows = []
    for row in valued["holdings"]:
        code = row.get("stock_code") or ""
        quote = quotes.get(code) if row["estimated_value"] is not None else None
        receipt = state["receipts"].get(row.get("receipt_no"), {})
        evidence = row.get("evidence") or ""
        rows.append({"corpCode": row.get("corp_code") or "", "stockCode": code, "name": row.get("name") or "",
                     "securityKind": row.get("security_kind") or "unknown", "quantity": row.get("quantity"),
                     "companyOwnershipPercent": row.get("company_ownership_percent"),
                     "receiptNo": row.get("receipt_no") or "", "receiptDate": row.get("receipt_date") or "",
                     "holdingDate": row.get("holding_date"),
                     "evidence": "legacy-import" if evidence == "legacy_import" else "dart-structured" if evidence == "dart_structured" else "dart-document" if evidence == "dart_document" else "unresolved-latest",
                     "tracking": row.get("tracking") or "unknown",
                     "quote": ({"close": quote["close"], "currency": "KRW", "market": "KRX", "session": "regular",
                                "tradeDate": quote["trade_date"], "adjusted": quote["adjusted"], "provider": "naver",
                                "observedAt": quote["observed_at"], "verified": True} if quote else None),
                     "estimatedValue": row["estimated_value"],
                     "portfolioWeightPercent": row["portfolio_weight_percent"],
                     "valuationExclusionReason": row["valuation_exclusion_reason"],
                     "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={row['receipt_no']}" if row.get("receipt_no") else None})
    events = []
    for event in sorted(state.get("events", {}).values(), key=lambda e: e.get("receipt_no", ""), reverse=True):
        no = event.get("receipt_no") or ""
        events.append({"receiptNo": no, "receiptDate": event.get("receipt_date") or "",
                       "corpCode": event.get("corp_code") or "", "stockCode": event.get("stock_code"),
                       "kind": event.get("kind") or "other", "correctionOf": event.get("correction_of"),
                       "quantity": event.get("quantity"), "companyOwnershipPercent": event.get("company_ownership_percent"),
                       "source": "legacy-import" if event.get("source") == "legacy_import" else "dart-structured" if event.get("source") == "dart_structured" else "dart-document",
                       "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={no}" if no else None})
    receipts = [r.get("receipt_date") for r in state["receipts"].values() if r.get("receipt_date")]
    coverage = state.get("listing_coverage") or []
    history = [item for item in state.get("published_history", []) if item.get("methodology_version") == "1"
               and item.get("estimated_value") is not None and item.get("trade_date")]
    if valued["estimated_value"] is not None and trade_date:
        history = [item for item in history if item["trade_date"] != trade_date]
        history.append({"trade_date": trade_date, "estimated_value": valued["estimated_value"],
                        "dataset_version": "", "methodology_version": "1"})
    history = sorted(history, key=lambda item: (item["trade_date"], item["dataset_version"]))[-90:]
    snapshot = {"schemaVersion": 1, "datasetVersion": "",
                "portfolio": {"id": "nps-kr-disclosed", "entityId": "nps", "market": "KRX", "currency": "KRW",
                              "scopeKo": "국민연금 국내주식 대량보유 공시 추정", "scopeEn": "NPS Korean large-shareholding filing estimate",
                              "methodologyVersion": "1", "legacyCoverage": state.get("legacy_coverage_status", "unverified")},
                "entity": {"id": "nps", "kind": "institution", "nameKo": "국민연금공단", "nameEn": "National Pension Service",
                           "officialId": None, "source": "OpenDART"},
                "valuationTradeDate": valued["trade_date"],
                "filingsCheckedAt": coverage[-1]["checked_at"] if coverage else None,
                "generatedAt": stamp, "publishedAt": None,
                "latestReceiptDate": max(receipts) if receipts else None,
                "trackedCount": len(rows), "pricedCount": valued["priced_count"], "unresolvedCount": len(state["unresolved"]),
                "estimatedValue": valued["estimated_value"], "valuationCoverage": valued["valuation_coverage"],
                "filingCoverage": "partial" if state["unresolved"] else "complete" if coverage else "unverified",
                "holdings": rows, "events": events,
                "history": [{"tradeDate": item["trade_date"], "estimatedValue": item["estimated_value"],
                             "datasetVersion": item["dataset_version"]} for item in history]}
    snapshot["datasetVersion"] = digest({k: v for k, v in snapshot.items() if k != "datasetVersion"})
    for item in snapshot["history"]:
        if item["datasetVersion"] == "":
            item["datasetVersion"] = snapshot["datasetVersion"]
    return snapshot
