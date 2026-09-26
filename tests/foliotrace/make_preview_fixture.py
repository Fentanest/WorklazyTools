"""Write synthetic FolioTrace UI data to an ignored dist tree for local review only."""
import argparse
import hashlib
import json
from pathlib import Path


def dump(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, required=True)
    args = parser.parse_args()
    if args.dist.name != "dist" or not args.dist.is_dir():
        raise SystemExit("fixture target must be an existing ignored dist directory")
    root = args.dist / "data/foliotrace/v1"
    version = hashlib.sha256(b"FolioTrace SYNTHETIC UI fixture v1").hexdigest()
    snapshot = {
        "schemaVersion": 1, "datasetVersion": version,
        "portfolio": {"id": "synthetic-preview", "entityId": "synthetic-entity", "market": "KRX", "currency": "KRW",
                      "scopeKo": "합성 시각검토 자료 · 실제 공시 아님", "scopeEn": "Synthetic visual review data · not a real filing",
                      "methodologyVersion": "fixture-1", "legacyCoverage": "unverified"},
        "entity": {"id": "synthetic-entity", "kind": "institution", "nameKo": "합성 테스트 기관", "nameEn": "Synthetic Test Entity",
                   "officialId": None, "source": "synthetic_fixture"},
        "valuationTradeDate": "2026-09-25", "filingsCheckedAt": "2026-09-26T00:00:00Z",
        "generatedAt": "2026-09-26T00:00:00Z", "publishedAt": "2026-09-26T00:00:00Z",
        "latestReceiptDate": "2026-09-24", "trackedCount": 2, "pricedCount": 1, "unresolvedCount": 1,
        "estimatedValue": "11258999068426241.25", "valuationCoverage": "partial", "filingCoverage": "unverified",
        "holdings": [
            {"corpCode": "00000001", "stockCode": "005930", "name": "합성 종목 A / Synthetic A", "securityKind": "common",
             "quantity": "9007199254740993", "companyOwnershipPercent": "5.25", "receiptNo": "20260924000001",
             "receiptDate": "2026-09-24", "holdingDate": None, "evidence": "dart-document", "tracking": "active",
             "quote": {"close": "1.25", "currency": "KRW", "market": "KRX", "session": "regular", "tradeDate": "2026-09-25",
                       "adjusted": False, "provider": "naver", "observedAt": "2026-09-26T00:00:00Z", "verified": True},
             "estimatedValue": "11258999068426241.25", "portfolioWeightPercent": "100", "valuationExclusionReason": None,
             "filingUrl": None},
            {"corpCode": "00000002", "stockCode": "0126Z0", "name": "합성 종목 B / Synthetic B", "securityKind": "unknown",
             "quantity": "100", "companyOwnershipPercent": None, "receiptNo": "20260923000001", "receiptDate": "2026-09-23",
             "holdingDate": None, "evidence": "legacy-import", "tracking": "unknown", "quote": None,
             "estimatedValue": None, "portfolioWeightPercent": None, "valuationExclusionReason": "security_mapping_unverified",
             "filingUrl": None},
        ],
        "events": [{"receiptNo": "20260924000001", "receiptDate": "2026-09-24", "corpCode": "00000001",
                    "stockCode": "005930", "kind": "new-report", "correctionOf": None, "quantity": "9007199254740993",
                    "companyOwnershipPercent": "5.25", "source": "dart-document", "filingUrl": None}],
        "history": [],
        "syntheticFixture": True,
    }
    root.joinpath("snapshots").mkdir(parents=True, exist_ok=True)
    payload = dump(snapshot)
    root.joinpath("snapshots", f"{version}.json").write_bytes(payload)
    manifest = {"schemaVersion": 1, "datasetVersion": version, "snapshotPath": f"snapshots/{version}.json",
                "snapshotSha256": hashlib.sha256(payload).hexdigest(), "syntheticFixture": True}
    root.joinpath("manifest.json").write_bytes(dump(manifest))
    print(json.dumps({"fixture": "SYNTHETIC_ONLY", "datasetVersion": version,
                      "snapshotSha256": manifest["snapshotSha256"], "path": str(root)}))


if __name__ == "__main__":
    main()
