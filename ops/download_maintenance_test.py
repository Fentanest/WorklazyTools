"""Offline maintenance retry checks: actual downloader, synthetic HTTP only."""
import contextlib
import io
import json
import sys
import tempfile
import types
import unittest
import zipfile
from pathlib import Path
from unittest import mock

import download


class MaintenanceDownloadTest(unittest.TestCase):
    def run_case(self, maximum=10, response_status=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = [dict(rcept_no=f"2026100900{i:04d}", key_slot="DART_API_KEY1",
                         started_at=f"2026-10-09T00:00:0{i}+00:00") for i in range(3)]
            rows[1]["key_slot"] = "DART_API_KEY2"
            # 0: confirmed maintenance; 1: unknown reservation; 2: unavailable ZIP.
            results = [dict(rows[0], status=200, api_status="800", zip_received=False),
                       dict(rows[2], status=200, api_status="014", zip_received=False)]
            for name, data in [("api-reservations.jsonl", rows), ("api-requests.jsonl", results),
                               ("api-queue.jsonl", rows)]:
                (root / name).write_text("".join(json.dumps(r) + "\n" for r in data))
            (root / "manifest.json").write_text("{}")
            body = io.BytesIO()
            with zipfile.ZipFile(body, "w") as archive:
                archive.writestr("test.xml", "<DOCUMENT/>")
            payload = body.getvalue() if response_status is None else (
                f"<result><status>{response_status}</status></result>".encode())
            session = mock.Mock()
            session.get.return_value = types.SimpleNamespace(status_code=200, content=payload)
            with mock.patch.object(download, "HERE", root), mock.patch.object(download, "REPO", root), \
                 mock.patch.object(download, "STOP", False), \
                 mock.patch.object(download, "keys", return_value={"DART_API_KEY1": "a" * 40,
                                                                  "DART_API_KEY2": "b" * 40}), \
                 mock.patch.object(download.requests, "Session", return_value=session), \
                 mock.patch.object(download.signal, "signal"), \
                 mock.patch.object(sys, "argv", ["download.py", "--interval", "0", "--defer-parse",
                                                "--max-per-key", str(maximum)]), \
                 contextlib.redirect_stdout(io.StringIO()):
                download.main()
            progress = json.loads((root / "download-progress.json").read_text())
            return session.get.call_args_list, progress

    def test_confirmed_maintenance_retries_without_replaying_unknown_or_014(self):
        calls, progress = self.run_case()
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].kwargs["params"]["rcept_no"], "20261009000000")
        self.assertEqual(progress["downloaded_api_receipts"], 1)
        self.assertEqual(progress["unknown_reserved_requests"], 1)
        self.assertEqual(progress["request_counts"], {"DART_API_KEY1": 3, "DART_API_KEY2": 1})

    def test_maintenance_retry_still_respects_consumed_daily_quota(self):
        calls, progress = self.run_case(maximum=2)
        self.assertEqual(len(calls), 1)
        self.assertEqual(progress["request_counts"], {"DART_API_KEY1": 2, "DART_API_KEY2": 2})

    def test_repeated_maintenance_stops_after_one_request(self):
        calls, progress = self.run_case(response_status="800")
        self.assertEqual(len(calls), 1)
        self.assertEqual(progress["downloaded_api_receipts"], 0)
        self.assertTrue(progress["stopped"])


if __name__ == "__main__":
    unittest.main()
