"""Offline next-day selection and canonical sync checks; no API calls."""
import csv
import importlib.util
import json
import tempfile
import unittest
from unittest import mock
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("daily_collection", HERE / "daily_collection.py")
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


class DailyCollectionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=HERE)
        root = Path(self.temp.name)
        self.base = root / "dart-api-ledger-20261004"
        self.base.mkdir()
        source = root / "dart-fulltext-receipts"
        source.mkdir()
        entries = []
        for index in range(10):
            entries.append({"rcept_no": f"2026010100{index:04d}", "company_name": f"회사{index}",
                            "filing_date": "2026-01-01", "report_name": "사업보고서 (2025.12)" if index < 6 else "감사보고서",
                            "filer_name": f"회사{index}", "report_url": "https://dart.fss.or.kr/example"})
        for filename, subset in (("confirmed_equity_receipts.csv", entries[:5]),
                                 ("excluded_noise_receipts.csv", entries[5:])):
            with (source / filename).open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(entries[0]))
                writer.writeheader(); writer.writerows(subset)
        for filename in daily.SCRIPTS:
            (self.base / filename).write_text("# fixture script\n")
        daily.write_jsonl(self.base / "targets.jsonl", [{"rcept_no": entries[0]["rcept_no"]}])
        daily.write_jsonl(self.base / "api-reservations.jsonl", [{"rcept_no": entries[1]["rcept_no"]}])
        daily.write_jsonl(self.base / "api-requests.jsonl", [{"rcept_no": entries[2]["rcept_no"]}])
        daily.write_jsonl(self.base / "corpus.jsonl", [{"rcept_no": entries[3]["rcept_no"]}])
        daily.write_jsonl(self.base / "gemini-labels.jsonl", [{"rcept_no": entries[0]["rcept_no"]}])
        daily.write_jsonl(self.base / "download-failures.jsonl", [{"rcept_no": entries[2]["rcept_no"],
                                                                    "api_status": "014"}])

    def tearDown(self):
        self.temp.cleanup()

    def test_prepare_and_sync_are_deterministic_and_idempotent(self):
        manifest = daily.prepare_next_day(self.base, "2026-10-05", slots=4)
        day = Path(manifest["directory"])
        queue = daily.read_jsonl(day / "api-queue.jsonl")
        self.assertEqual(len(queue), 4)
        self.assertEqual({row["key_slot"] for row in queue}, set(daily.KEYS))
        self.assertEqual([row["key_slot"] for row in queue].count(daily.KEYS[0]), 2)
        self.assertTrue({row["rcept_no"] for row in queue}.isdisjoint(
            {f"2026010100{index:04d}" for index in (1, 2, 3)}))
        self.assertEqual(manifest["eligible_population"], 7)
        self.assertEqual(manifest["prior_api_014_web_fallback"], 1)
        self.assertEqual(daily.prepare_next_day(self.base, "2026-10-05", slots=4)["directory"], str(day))
        daily.write_jsonl(day / "corpus.jsonl", [{"rcept_no": queue[0]["rcept_no"], "source_complete": True}])
        self.assertEqual(daily.sync_day(self.base, "2026-10-05"), {"corpus": 1, "gemini_labels": 4})
        self.assertEqual(daily.sync_day(self.base, "2026-10-05"), {"corpus": 0, "gemini_labels": 0})
        self.assertEqual(len(daily.read_jsonl(self.base / "corpus.jsonl")), 2)

    def test_partial_ledger_blocks_selection(self):
        with (self.base / "api-reservations.jsonl").open("ab") as stream:
            stream.write(b'{"unfinished":')
        with self.assertRaisesRegex(ValueError, "PARTIAL_JSONL"):
            daily.prepare_next_day(self.base, "2026-10-05", slots=4)

    def test_remainder_smaller_than_daily_budget_is_all_selected(self):
        manifest = daily.prepare_next_day(self.base, "2026-10-05", slots=20)
        queue = daily.read_jsonl(Path(manifest["directory"]) / "api-queue.jsonl")
        self.assertEqual({r["rcept_no"] for r in queue},
                         {f"2026010100{index:04d}" for index in (0, 4, 5, 6, 7, 8, 9)})
        self.assertEqual(manifest["target_receipts"], 7)
        self.assertEqual(manifest["api_request_budget_per_key"], 10)
        self.assertEqual([r["key_slot"] for r in queue].count(daily.KEYS[0]), 4)

    def test_single_remaining_report_is_selected(self):
        daily.write_jsonl(self.base / "corpus.jsonl",
                          [{"rcept_no": f"2026010100{i:04d}"} for i in range(9)])
        manifest = daily.prepare_next_day(self.base, "2026-10-05", slots=20)
        queue = daily.read_jsonl(Path(manifest["directory"]) / "api-queue.jsonl")
        self.assertEqual([r["rcept_no"] for r in queue], ["20260101000009"])

    def test_empty_population_finishes_without_downloader_or_credentials(self):
        daily.write_jsonl(self.base / "corpus.jsonl",
                          [{"rcept_no": f"2026010100{i:04d}"} for i in range(10)])
        with mock.patch.object(daily.subprocess, "Popen") as launch:
            result = daily.run_day(self.base, "2026-10-05")
        launch.assert_not_called()
        self.assertEqual(result["completed"], 0)
        self.assertEqual(result["unattempted_receipts"], 0)
        self.assertEqual(result["download_exit_code"], 0)

    def test_previously_queued_but_never_requested_report_is_carried_forward(self):
        manifest = daily.prepare_next_day(self.base, "2026-10-05", slots=20)
        queue = daily.read_jsonl(Path(manifest["directory"]) / "api-queue.jsonl")
        ids = {r["rcept_no"] for r in queue}
        self.assertIn("20260101000000", ids)
        self.assertTrue(ids.isdisjoint({"20260101000001", "20260101000002", "20260101000003"}))

    def test_future_kst_date_blocks_runner_before_any_download(self):
        with self.assertRaisesRegex(ValueError, "BEFORE_KST_COLLECTION_DATE"):
            daily.run_day(self.base, "2099-01-01")
        self.assertFalse((self.base.parent / "dart-api-ledger-20990101").exists())

    def test_confirmed_maintenance_is_pending_but_unknown_reservation_is_not_replayed(self):
        rid = "20260101000002"
        reservation = {"rcept_no": rid, "key_slot": daily.KEYS[0],
                       "started_at": "2026-10-04T00:00:00+00:00"}
        daily.append(self.base / "api-reservations.jsonl", reservation)
        daily.write_jsonl(self.base / "api-requests.jsonl", [dict(reservation,
                          status=200, api_status="800", zip_received=False)])
        manifest = daily.prepare_next_day(self.base, "2026-10-05", slots=20)
        ids = {r["rcept_no"] for r in daily.read_jsonl(Path(manifest["directory"]) / "api-queue.jsonl")}
        self.assertIn(rid, ids)
        self.assertNotIn("20260101000001", ids)
        self.assertNotIn("20260101000003", ids)


if __name__ == "__main__":
    unittest.main()
