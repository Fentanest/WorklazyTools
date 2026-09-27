import hashlib
import json
import unittest

from scripts.foliotrace.reuse_published_snapshot import verify_published_snapshot


VERSION = "a" * 64


def published_pair(**snapshot_changes):
    snapshot = {
        "datasetVersion": VERSION,
        "trackedCount": 2,
        "pricedCount": 1,
        "estimatedValue": "1000",
        "valuationCoverage": "partial",
        **snapshot_changes,
    }
    data = json.dumps(snapshot, separators=(",", ":")).encode()
    manifest = {
        "schemaVersion": 1,
        "datasetVersion": VERSION,
        "snapshotPath": f"snapshots/{VERSION}.json",
        "snapshotSha256": hashlib.sha256(data).hexdigest(),
    }
    return manifest, data


class ReusePublishedSnapshotTests(unittest.TestCase):
    def test_reuses_exact_verified_bytes_only_for_recorded_version(self):
        manifest, data = published_pair()
        self.assertEqual(verify_published_snapshot(json.dumps(manifest).encode(), data, VERSION), data)
        with self.assertRaisesRegex(ValueError, "differs from the last recorded deployment"):
            verify_published_snapshot(json.dumps(manifest).encode(), data, "b" * 64)

    def test_rejects_changed_bytes_and_unexpected_snapshot_path(self):
        manifest, data = published_pair()
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            verify_published_snapshot(json.dumps(manifest).encode(), data + b" ", VERSION)
        manifest["snapshotPath"] = "../unpublished.json"
        with self.assertRaisesRegex(ValueError, "invalid published FolioTrace manifest"):
            verify_published_snapshot(json.dumps(manifest).encode(), data, VERSION)

    def test_rejects_unpriced_published_data(self):
        manifest, data = published_pair(pricedCount=0, estimatedValue=None, valuationCoverage="unavailable")
        with self.assertRaisesRegex(ValueError, "valuation is unavailable"):
            verify_published_snapshot(json.dumps(manifest).encode(), data, VERSION)


if __name__ == "__main__":
    unittest.main()
