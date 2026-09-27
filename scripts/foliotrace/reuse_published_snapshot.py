"""Reuse the currently published FolioTrace snapshot for a source-only Pages push.

The scheduled/manual workflow produces new data. A main push must keep the last
published dataset, even when overnight backfill has advanced the data branch.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


DATA_URL = "https://worklazy.net/data/foliotrace/v1/"
VERSION = re.compile(r"[a-f0-9]{64}\Z")


def verify_published_snapshot(manifest_bytes: bytes, snapshot_bytes: bytes, expected_version: str) -> bytes:
    manifest = json.loads(manifest_bytes)
    version = manifest.get("datasetVersion")
    if not isinstance(version, str) or not VERSION.fullmatch(version) or version != expected_version:
        raise ValueError("published FolioTrace version differs from the last recorded deployment")
    if manifest.get("schemaVersion") != 1 or manifest.get("snapshotPath") != f"snapshots/{version}.json":
        raise ValueError("invalid published FolioTrace manifest")
    if hashlib.sha256(snapshot_bytes).hexdigest() != manifest.get("snapshotSha256"):
        raise ValueError("published FolioTrace snapshot hash mismatch")
    snapshot = json.loads(snapshot_bytes)
    if snapshot.get("datasetVersion") != version:
        raise ValueError("published FolioTrace snapshot version mismatch")
    if (snapshot.get("trackedCount", 0) <= 0 or snapshot.get("pricedCount", 0) <= 0
            or snapshot.get("estimatedValue") is None or snapshot.get("valuationCoverage") == "unavailable"):
        raise ValueError("published FolioTrace valuation is unavailable")
    return snapshot_bytes


def download(path: str, limit: int) -> bytes:
    request = Request(DATA_URL + path, headers={"Cache-Control": "no-cache"})
    with urlopen(request, timeout=30) as response:
        resolved = urlsplit(response.geturl())
        if resolved.scheme != "https" or resolved.hostname != "worklazy.net":
            raise ValueError("published FolioTrace data redirected away from worklazy.net")
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("published FolioTrace data exceeds the size limit")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    state = json.loads(args.state.read_bytes())
    expected_version = state.get("last_published_dataset")
    if not isinstance(expected_version, str) or not VERSION.fullmatch(expected_version):
        raise ValueError("no recorded FolioTrace deployment to reuse")
    manifest_bytes = download("manifest.json", 16_384)
    manifest = json.loads(manifest_bytes)
    if manifest.get("datasetVersion") != expected_version:
        raise ValueError("published FolioTrace version differs from the last recorded deployment")
    snapshot_bytes = download(f"snapshots/{expected_version}.json", 20_000_000)
    verified = verify_published_snapshot(manifest_bytes, snapshot_bytes, expected_version)
    args.output.write_bytes(verified)
    print(json.dumps({"reused_dataset_version": expected_version,
                      "snapshot_sha256": hashlib.sha256(verified).hexdigest()}))


if __name__ == "__main__":
    main()
