"""Build the public, versioned FolioTrace snapshot from normalized state."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from .valuation import decimal, value_holdings
from .indirect import reconcile_indirect, effective_source_holds


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def make_snapshot(state, quotes, now=None):
    now = now or datetime.now(timezone.utc)
    stamp = now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    trade_dates = sorted({q["trade_date"] for q in quotes.values() if q.get("verified") and q.get("trade_date")})
    trade_date = trade_dates[-1] if trade_dates else None
    holdings = []
    pending_by_corp = {}
    def receipt_order(no):
        receipt = state.get("receipts", {}).get(no, {})
        return (receipt.get("listing_receipt_date") or receipt.get("receipt_date") or "", no or "")
    for no in state.get("unresolved", {}):
        receipt = state.get("receipts", {}).get(no, {})
        corp = receipt.get("corp_code")
        if corp and receipt_order(no) > receipt_order(pending_by_corp.get(corp, "")):
            pending_by_corp[corp] = no
    for source in sorted(state["holdings"].values(), key=lambda h: (h.get("stock_code") or "", h.get("corp_code") or "")):
        holding = dict(source)
        current_no = holding.get("receipt_no")
        current = state["receipts"].get(current_no, {})
        latest_no = max((holding.get("latest_unresolved_receipt") or "", pending_by_corp.get(holding.get("corp_code"), "")),
                        key=receipt_order)
        if receipt_order(latest_no) < receipt_order(current_no):
            latest_no = ""
        if current.get("withdrawn_flag") or current.get("is_correction") or current.get("later_correction_flag"):
            latest_no = max((latest_no or "", current_no or ""), key=receipt_order)
        if latest_no:
            holding["latest_unresolved_receipt"] = latest_no
            holding["latest_unresolved_reason"] = state.get("unresolved", {}).get(latest_no) or "correction_relation_unverified"
        holdings.append(holding)
    holdings, indirect_events, observation_rows = reconcile_indirect(state, holdings)
    issuer_observations = state.get("issuer_scope_observations") or {}
    scoped_by_corp = {}
    source_holds = effective_source_holds(state)
    for key, fact in issuer_observations.items():
        references = [ref for ref in fact.get("references", [])
                      if ref.get("receipt_no") not in source_holds]
        if references:
            scoped_by_corp.setdefault(fact["corp_code"], []).append((key, fact, references))
    scoped_conflicts = set()
    for candidates in scoped_by_corp.values():
        by_date = {}
        for key, fact, _ in candidates:
            by_date.setdefault(fact["basis_date"], []).append((key, fact))
        for group in by_date.values():
            if len({(fact["quantity"], fact["ownership_percent"], fact["denominator_quantity"])
                    for _, fact in group}) > 1:
                scoped_conflicts.update(key for key, _ in group)
    for holding in holdings:
        candidates = scoped_by_corp.get(holding.get("corp_code")) or []
        if not candidates:
            continue
        latest_date = max(fact["basis_date"] for _, fact, _ in candidates)
        latest = [(key, fact, refs) for key, fact, refs in candidates
                  if fact["basis_date"] == latest_date]
        if len({(fact["quantity"], fact["ownership_percent"], fact["denominator_quantity"])
                for _, fact, _ in latest}) != 1:
            holding["issuer_scope_status"] = "same_basis_conflict"
            continue
        direct_basis = holding.get("holding_date") or holding.get("receipt_date")
        if direct_basis and latest_date <= direct_basis:
            continue
        pending_no = holding.get("latest_unresolved_receipt")
        pending_receipt = state.get("receipts", {}).get(pending_no) or {}
        pending_date = pending_receipt.get("listing_receipt_date") or pending_receipt.get("receipt_date")
        if pending_date and pending_date >= latest_date:
            holding["issuer_scope_status"] = "newer_direct_filing_unresolved"
            continue
        key, fact, refs = sorted(latest, key=lambda entry: entry[0])[0]
        primary = sorted(refs, key=lambda ref: (ref["filing_date"], ref["receipt_no"]))[0]
        holding["direct_baseline"] = {"receipt_no": holding.get("receipt_no"),
                                      "receipt_date": holding.get("receipt_date"),
                                      "holding_date": holding.get("holding_date"),
                                      "ownership_percent": holding.get("company_ownership_percent"),
                                      "quantity": holding.get("quantity")}
        later_changes = [change for change in (state.get("issuer_scope_later_changes") or {}).values()
                         if change.get("corp_code") == holding.get("corp_code") and
                         change.get("basis_date", "") > fact["basis_date"] and
                         any(ref.get("receipt_no") not in source_holds for ref in change.get("references", []))]
        later_date = max((change["basis_date"] for change in later_changes), default=None)
        holding.update(company_ownership_percent=fact["ownership_percent"],
                       quantity=None, security_kind="unknown", holding_date=latest_date,
                       receipt_no=primary["receipt_no"], receipt_date=primary["filing_date"],
                       evidence="issuer_scope_observation", tracking="unknown",
                       issuer_scope_source={"key": key, "quantity": fact["quantity"],
                                            "denominator_quantity": fact["denominator_quantity"],
                                            "denominator_date": fact["denominator_date"],
                                            "reference_count": len(refs),
                                            "later_change_date": later_date,
                                            "receipt_no": primary["receipt_no"],
                                            "document_no": primary["document_no"]})
    valued = value_holdings(holdings, quotes, trade_date) if trade_date else value_holdings(holdings, {}, "")
    rows = []
    for row in valued["holdings"]:
        code = row.get("stock_code") or ""
        candidate_quote = None if row.get("evidence") == "issuer_scope_observation" else quotes.get(code)
        close = decimal(candidate_quote.get("close")) if candidate_quote else None
        quote = (candidate_quote if candidate_quote and candidate_quote.get("verified") is True and
                 candidate_quote.get("trade_date") == trade_date and
                 candidate_quote.get("market") == "KRX" and candidate_quote.get("session") == "regular" and
                 candidate_quote.get("currency") == "KRW" and candidate_quote.get("adjusted") is False and
                 close is not None and close > 0 else None)
        receipt = state["receipts"].get(row.get("receipt_no"), {})
        evidence = row.get("evidence") or ""
        rows.append({"corpCode": row.get("corp_code") or "", "stockCode": code, "name": row.get("name") or "",
                     "securityKind": row.get("security_kind") or "unknown", "quantity": row.get("quantity"),
                     "companyOwnershipPercent": row.get("company_ownership_percent"),
                     "ownershipNumericKind": row.get("ownership_numeric_kind"),
                     "observationStatus": row.get("observation_status"),
                     "receiptNo": row.get("receipt_no") or "",
                     "receiptDate": (receipt.get("listing_receipt_date") if state["unresolved"].get(row.get("receipt_no")) == "receipt_date_conflict" else row.get("receipt_date")) or "",
                     "holdingDate": row.get("holding_date"),
                     "evidence": "issuer-scope-observation" if evidence == "issuer_scope_observation" else "unresolved-latest" if row.get("latest_unresolved_receipt") else "indirect-observation" if evidence == "indirect_observation" else "legacy-import" if evidence == "legacy_import" else "dart-structured" if evidence == "dart_structured" else "dart-document" if evidence == "dart_document" else "unresolved-latest",
                     "indirectSource": ({"documentNo": row["indirect_source"]["document_no"],
                                         "sourceSha256": row["indirect_source"]["section_sha256"],
                                         "basisDate": row["indirect_source"]["basis_date"],
                                         "directReceiptNo": row["indirect_source"]["direct_receipt_no"],
                                         "ratioDenominator": row["indirect_source"]["ratio_denominator"]}
                                        if row.get("indirect_source") else None),
                     "issuerScopeSource": ({"observationKey": row["issuer_scope_source"]["key"],
                       "sourceQuantity": row["issuer_scope_source"]["quantity"],
                       "denominatorQuantity": row["issuer_scope_source"]["denominator_quantity"],
                       "denominatorDate": row["issuer_scope_source"]["denominator_date"],
                       "referenceCount": row["issuer_scope_source"]["reference_count"],
                       "laterChangeDate": row["issuer_scope_source"]["later_change_date"],
                       "receiptNo": row["issuer_scope_source"]["receipt_no"],
                       "documentNo": row["issuer_scope_source"]["document_no"]}
                       if row.get("issuer_scope_source") else None),
                     "directBaseline": ({"receiptNo": row["direct_baseline"]["receipt_no"],
                       "receiptDate": row["direct_baseline"]["receipt_date"],
                       "holdingDate": row["direct_baseline"]["holding_date"],
                       "ownershipPercent": row["direct_baseline"]["ownership_percent"],
                       "quantity": row["direct_baseline"]["quantity"]}
                       if row.get("direct_baseline") else None),
                     "issuerScopeConflict": row.get("issuer_scope_status") == "same_basis_conflict",
                     "latestUnresolvedReceiptNo": row.get("latest_unresolved_receipt") or None,
                     "latestUnresolvedReason": row.get("latest_unresolved_reason") or None,
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
        if state.get("unresolved", {}).get(no) in ("receipt_date_conflict", "receipt_chronology_unverified"):
            continue
        events.append({"receiptNo": no, "receiptDate": event.get("receipt_date") or "",
                       "basisDate": state.get("receipts", {}).get(no, {}).get("holding_date"),
                       "corpCode": event.get("corp_code") or "", "stockCode": event.get("stock_code"),
                       "kind": event.get("kind") or "other", "correctionOf": event.get("correction_of"),
                       "quantity": event.get("quantity"), "companyOwnershipPercent": event.get("company_ownership_percent"),
                       "source": "dart-structured" if event.get("source") == "dart_structured" else "dart-document" if event.get("source") == "dart_document" else "legacy-import",
                       "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={no}" if no else None})
    for event in indirect_events:
        no = event["receipt_no"]
        events.append({"receiptNo": no, "receiptDate": event["receipt_date"],
                       "basisDate": event["basis_date"],
                       "observationKey": event["observation_key"],
                       "corpCode": event["corp_code"], "stockCode": event["stock_code"],
                       "kind": event.get("kind") or "other", "correctionOf": None,
                       "quantity": event["quantity"], "companyOwnershipPercent": event["company_ownership_percent"],
                       "numericKind": event["numeric_kind"],
                       "percentagePointChange": event.get("percentage_point_change"),
                       "source": "indirect-observation",
                       "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={no}"})
    for fact in (state.get("issuer_scope_later_changes") or {}).values():
        refs = [ref for ref in fact.get("references", []) if ref.get("receipt_no") not in source_holds]
        if not refs:
            continue
        ref = min(refs, key=lambda item: (item["filing_date"], item["receipt_no"]))
        no = ref["receipt_no"]
        events.append({"receiptNo": no, "receiptDate": ref["filing_date"],
                       "basisDate": fact["basis_date"], "corpCode": fact["corp_code"],
                       "stockCode": None, "kind": "unquantified-change",
                       "correctionOf": None, "quantity": None,
                       "companyOwnershipPercent": None,
                       "source": "issuer-scope-observation",
                       "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={no}"})
    events.sort(key=lambda event: (event.get("basisDate") or event["receiptDate"], event["receiptNo"]), reverse=True)
    receipts = [r.get("receipt_date") for r in state["receipts"].values() if r.get("receipt_date")]
    coverage = state.get("listing_coverage") or []
    history = [item for item in state.get("published_history", []) if item.get("methodology_version") == "1"
               and item.get("estimated_value") is not None and item.get("trade_date")]
    has_future_filing = any(h.get("receipt_date") and trade_date and h["receipt_date"] > trade_date for h in holdings)
    if valued["estimated_value"] is not None and trade_date and not has_future_filing:
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
                "holdings": rows, "events": events, "verifiedIndirectObservations": observation_rows,
                "issuerScopeObservations": [{"observationKey": key, "corpCode": fact["corp_code"],
                    "stockCode": fact["stock_code"], "issuerName": fact["issuer_name"],
                    "basisDate": fact["basis_date"], "ownershipPercent": fact["ownership_percent"],
                    "sourceQuantity": fact["quantity"], "denominatorQuantity": fact["denominator_quantity"],
                    "denominatorDate": fact["denominator_date"], "securityKind": "unclassified",
                    "ratioDenominator": "issued_shares", "holderScope": "nps_only",
                    "references": [{"receiptNo": ref["receipt_no"], "documentNo": ref["document_no"],
                        "filingDate": ref["filing_date"], "archiveSha256": ref["archive_sha256"],
                        "fileSha256": ref["file_sha256"], "rowSha256": ref["row_sha256"],
                        "parserVersion": ref["parser_version"],
                        "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={ref['receipt_no']}"}
                        for ref in fact["references"]],
                    "status": "same_basis_conflict" if key in scoped_conflicts else "comparison_pending"}
                    for key, fact in sorted(issuer_observations.items(),
                                            key=lambda item: (item[1]["basis_date"], item[0]), reverse=True)],
                "issuerScopeLaterChanges": [{"corpCode": fact["corp_code"],
                    "basisDate": fact["basis_date"], "kind": fact["kind"],
                    "references": [{"receiptNo": ref["receipt_no"],
                                    "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={ref['receipt_no']}"}
                                   for ref in fact["references"] if ref["receipt_no"] not in source_holds]}
                    for fact in sorted((item for item in (state.get("issuer_scope_later_changes") or {}).values()
                                        if any(ref.get("receipt_no") not in source_holds
                                               for ref in item.get("references", []))),
                                       key=lambda item: (item["basis_date"], item["corp_code"]), reverse=True)],
                "historicalObservations": [{"corpCode": item["corp_code"], "stockCode": item["stock_code"],
                    "issuerName": item["issuer_name"], "quantity": item["quantity"],
                    "ownershipPercent": item["ownership_percent"], "basisDate": item["basis_date"],
                    "filingDate": item["source_filing_date"], "receiptNo": item["source_receipt_no"],
                    "documentNo": item["source_document_no"],
                    "sourceRowSha256": item["source_row_sha256"],
                    "ratioDenominator": item["ratio_denominator"],
                    "denominatorQuantity": item.get("denominator_quantity"),
                    "denominatorDate": item.get("denominator_date"),
                    "status": item["observation_status"],
                    "filingUrl": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={item['source_receipt_no']}"}
                    for item in sorted((fact for fact in state.get("verified_historical_observations", {}).values()
                                        if fact.get("observation_status") != "historical_comparable_registered"),
                                       key=lambda entry: (entry["basis_date"], entry["source_receipt_no"]),
                                       reverse=True)],
                "history": [{"tradeDate": item["trade_date"], "estimatedValue": item["estimated_value"],
                             "datasetVersion": item["dataset_version"]} for item in history]}
    historical = state.get("historical_backfill")
    if historical and historical.get("coverage"):
        completed_through = historical["coverage"][-1]["to"]
        listed = [receipt.get("listing_receipt_date") for receipt in state["receipts"].values()
                  if receipt.get("listing_verified_at") and receipt.get("listing_receipt_date")
                  and historical["start_date"] <= receipt["listing_receipt_date"] <= completed_through]
        pending = [receipt for no, receipt in state["receipts"].items()
                   if receipt.get("historical_backfill_only") and no in state["unresolved"]
                   and receipt.get("evidence") in ("unresolved", "legacy_json_parser_result", "legacy_reference_only")]
        current_nos = {holding.get("receipt_no") for holding in state["holdings"].values()}
        legacy_recheck = sum(receipt.get("origin") == "legacy_import" and no not in current_nos and
                             bool(receipt.get("listing_verified_at")) and
                             receipt.get("evidence") not in ("dart_structured", "dart_document")
                             for no, receipt in state["receipts"].items())
        snapshot["historicalCoverage"] = {
            "searchStartDate": historical["start_date"], "searchTargetDate": historical["target_date"],
            "listingCompleteThrough": completed_through,
            "listingComplete": completed_through >= historical["target_date"],
            "firstObservedNpsReceiptDate": min(listed) if listed else None,
            "parsingPendingCount": len(pending), "legacySourceRecheckCount": legacy_recheck}
    secondary = state.get("secondary_backfill") or {}
    equity = state.get("secondary_equity_backfill") or {}
    prior = state.get("secondary_prior_backfill") or {}
    prior_equity = state.get("secondary_prior_equity_backfill") or {}
    early_direct = state.get("early_direct_backfill") or {}
    if any(item.get("coverage") for item in (secondary, equity, prior, prior_equity, early_direct)):
        from scripts.foliotrace.secondary import decode_noncandidate_keys
        candidates = {}
        for lane in (secondary, equity, prior, prior_equity):
            for key, item in (lane.get("candidates") or {}).items():
                previous = candidates.get(key)
                if previous is None or (previous.get("review_status") == "source_review_pending" and
                                        item.get("review_status") != "source_review_pending"):
                    candidates[key] = item
        noncandidate_ids = set()
        reviews = {}
        for lane in (secondary, equity, prior, prior_equity):
            for window in lane.get("coverage") or []:
                noncandidate_ids.update(decode_noncandidate_keys(window))
            for key, item in (lane.get("noncandidate_reviews") or {}).items():
                previous = reviews.get(key)
                if previous is None or (previous.get("review_status") == "source_review_pending" and
                                        item.get("review_status") != "source_review_pending"):
                    reviews[key] = item
        noncandidate_ids.difference_update(candidates)
        noncandidate_unreviewed = sum(reviews.get(key, {}).get("review_status") in
                                     (None, "source_review_pending") for key in noncandidate_ids)
        noncandidate_context = sum(reviews.get(key, {}).get("review_status") ==
                                   "source_context_review_pending" for key in noncandidate_ids)
        snapshot["secondaryCoverage"] = {
            "searchStartDate": prior.get("start_date") or prior_equity.get("start_date") or
                               secondary.get("start_date") or equity.get("start_date") or "2006-01-01",
            "searchTargetDate": secondary.get("target_date") or state.get("latest_complete_listing_date") or
                                early_direct.get("target_date") or equity.get("target_date") or
                                prior.get("target_date") or prior_equity.get("target_date"),
            "priorContentCheckedThrough": prior["coverage"][-1]["to"] if prior.get("coverage") else None,
            "priorEquityCheckedThrough": prior_equity["coverage"][-1]["to"] if prior_equity.get("coverage") else None,
            "allContentCheckedThrough": secondary["coverage"][-1]["to"] if secondary.get("coverage") else None,
            "equityContentCheckedThrough": equity["coverage"][-1]["to"] if equity.get("coverage") else None,
            "earlyDirectCheckedThrough": early_direct["coverage"][-1]["to"] if early_direct.get("coverage") else None,
            "candidateDocumentCount": len(candidates),
            "noncandidateUnreviewedCount": noncandidate_unreviewed,
            "sourceContextReviewCount": sum(item.get("review_status") == "source_context_review_pending"
                                            for item in candidates.values()) + noncandidate_context,
            "sourceReviewPendingCount": sum(item.get("review_status") == "source_review_pending"
                                            for item in candidates.values())}
    snapshot["datasetVersion"] = digest({k: v for k, v in snapshot.items() if k != "datasetVersion"})
    for item in snapshot["history"]:
        if item["datasetVersion"] == "":
            item["datasetVersion"] = snapshot["datasetVersion"]
    return snapshot
