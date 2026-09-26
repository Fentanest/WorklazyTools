import copy
import io
import json
import tempfile
import unittest
import urllib.error
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import patch

from scripts.foliotrace import folio, opendart_secondary, secondary
from scripts.foliotrace.opendart_secondary import OpendartListError


def row(no, day, report="사업보고서", corp="00000001", name="회사", stock="000000", rm=""):
    return {"corp_code": corp, "corp_name": name, "stock_code": stock,
            "rcept_no": no, "report_nm": report, "rcept_dt": day, "rm": rm}


def list_page(rows, total, page_no, total_pages):
    return {"status": "000", "page_no": page_no, "page_count": 100,
            "total_count": total, "total_page": total_pages, "list": rows}


def no_data():
    return {"status": "013", "page_no": 1, "page_count": 100,
            "total_count": 0, "total_page": 0}


def receipt(day, index):
    return f"{day}{index:06d}"


def fresh_state(path):
    folio.write_json(path, folio.empty_state())


class OpendartListPageTests(unittest.TestCase):
    def test_multi_page_window_queues_every_receipt_without_type_filter(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        d_report = row(receipt(tag, 1), tag, "최대주주등소유주식변동신고서",
                       corp="00126380", name="포스코", stock="005490")
        c_report = row(receipt(tag, 2), tag, "주식교환 종료보고서",
                       corp="00111111", name="케이비", stock="105560")
        noise = [row(receipt(tag, 100 + i), tag, "투자설명서") for i in range(248)]
        rows = [d_report, c_report] + noise
        mapping = {("20060208", "20060208", 1): list_page(rows[:100], 250, 1, 3),
                   ("20060208", "20060208", 2): list_page(rows[100:200], 250, 2, 3),
                   ("20060208", "20060208", 3): list_page(rows[200:], 250, 3, 3)}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0,
                fetch_list=lambda params: mapping[(params["bgn_de"], params["end_de"],
                                                   params["page_no"])],
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["status"], "LISTING_COMPLETE_SOURCE_PENDING")
            self.assertEqual((result["listing_requests"], result["new_receipts"]), (3, 250))
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertEqual(ledger["next_date"], "2006-02-09")
            self.assertEqual(len(ledger["queue"]), 250)
            # Neither the D-only assumption nor the title filter may drop rows.
            self.assertIn(d_report["rcept_no"], ledger["queue"])
            self.assertIn(c_report["rcept_no"], ledger["queue"])
            self.assertEqual(ledger["queue"][c_report["rcept_no"]]["report_nm"], "주식교환 종료보고서")
            self.assertEqual(ledger["coverage"][0]["total_receipts"], 250)
            # Shared ledgers stay untouched: listing alone observes nothing.
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})
            self.assertEqual(saved["events"], {})
            self.assertIsNone(saved["secondary_backfill"])
            self.assertEqual(result["holding_reflection"], "pending_sol_integration")

    def test_window_split_and_single_day_budget_overflow(self):
        def fetch(params):
            bgn, end, page = params["bgn_de"], params["end_de"], params["page_no"]
            days = (date(int(end[:4]), int(end[4:6]), int(end[6:8]))
                    - date(int(bgn[:4]), int(bgn[4:6]), int(bgn[6:8]))).days + 1
            total = 200 * days
            pages = 2 * days
            start_index = (page - 1) * 100
            rows = [row(receipt(bgn, 1000 + start_index + i), bgn) for i in range(
                min(100, total - start_index))]
            return list_page(rows, total, page, pages)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            result = opendart_secondary.scan_opendart_secondary(
                path, date(1999, 4, 1), date(1999, 4, 4),
                max_listing_pages=5, max_windows=1, review_limit=0,
                fetch_list=fetch, read_state=folio.read_json, write_state=folio.write_json)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            # 4-day window (8 pages) halves until two days (4 pages) fit.
            self.assertEqual((ledger["coverage"][0]["from"], ledger["coverage"][0]["to"]),
                             ("1999-04-01", "1999-04-02"))
            self.assertEqual(ledger["next_date"], "1999-04-03")
            self.assertEqual(result["status"], "LISTING_IN_PROGRESS")
            fresh_state(path)
            starved = opendart_secondary.scan_opendart_secondary(
                path, date(1999, 4, 2), date(1999, 4, 2),
                max_listing_pages=1, max_windows=5, review_limit=0,
                fetch_list=fetch, read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(starved["status"], "LISTING_BUDGET_INSUFFICIENT")
            self.assertEqual(starved["required_pages"], 2)
            self.assertEqual(starved["completed_windows"], 0)
            # A truncated page set is never committed as a completed window.
            self.assertEqual(len(folio.read_json(path)["opendart_secondary_backfill"]["coverage"]), 0)

    def test_duplicate_receipt_across_pages_is_rejected(self):
        tag = "20060208"
        shared = row(receipt(tag, 1), tag)
        mapping = {1: list_page([shared] + [row(receipt(tag, 10 + i), tag) for i in range(99)],
                                150, 1, 2),
                   2: list_page([shared] + [row(receipt(tag, 200 + i), tag) for i in range(49)],
                                150, 2, 2)}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            with self.assertRaisesRegex(OpendartListError, "RECEIPT_COVERAGE"):
                opendart_secondary.scan_opendart_secondary(
                    path, date(2006, 2, 8), date(2006, 2, 8), review_limit=0,
                    fetch_list=lambda params: mapping[params["page_no"]],
                    read_state=folio.read_json, write_state=folio.write_json)
            saved = folio.read_json(path)
            self.assertEqual(saved["opendart_secondary_backfill"]["coverage"], [])
            self.assertEqual(saved["opendart_secondary_backfill"]["next_date"], "2006-02-08")

    def test_last_page_transport_reports_page_number(self):
        tag = "20060208"
        first = list_page([row(receipt(tag, i), tag) for i in range(100)], 150, 1, 2)

        def fetch(params):
            if params["page_no"] == 1:
                return first
            raise OpendartListError("OPENDART_TRANSPORT", date(2006, 2, 8), date(2006, 2, 8))

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            with self.assertRaises(OpendartListError) as failure:
                opendart_secondary.scan_opendart_secondary(
                    path, date(2006, 2, 8), date(2006, 2, 8), review_limit=0,
                    fetch_list=fetch, read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual((failure.exception.code, failure.exception.page_no),
                             ("OPENDART_TRANSPORT", 2))
            self.assertEqual(folio.read_json(path)["opendart_secondary_backfill"]["coverage"], [])

    def test_fetch_retries_transport_then_reports_only_safe_code(self):
        payload = json.dumps(list_page([], 0, 1, 1)).encode()
        with patch.object(opendart_secondary.time, "sleep"), patch.object(
                opendart_secondary.urllib.request, "urlopen",
                side_effect=[urllib.error.URLError("down"), io.BytesIO(payload)]) as request:
            data = opendart_secondary.fetch_list_page({"bgn_de": "20060208"}, "test-key")
            self.assertEqual(data["status"], "000")
            self.assertEqual(request.call_count, 2)
        with patch.object(opendart_secondary.time, "sleep"), patch.object(
                opendart_secondary.urllib.request, "urlopen",
                side_effect=urllib.error.URLError("test-key transport detail")) as request:
            with self.assertRaisesRegex(OpendartListError, "OPENDART_TRANSPORT") as failure:
                opendart_secondary.fetch_list_page({"bgn_de": "20060208"}, "test-key")
            self.assertEqual(request.call_count, 3)
            self.assertNotIn("test-key", str(failure.exception))

    def test_official_no_data_advances_while_transport_holds_cursor(self):
        day = date(2006, 2, 8)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            empty = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, fetch_list=lambda _params: no_data(),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(empty["status"], "SOURCE_REVIEW_COMPLETE")
            self.assertEqual(empty["new_receipts"], 0)
            self.assertEqual(empty["completed_windows"], 1)

            def transport(_params):
                raise OpendartListError("OPENDART_TRANSPORT", day, day, 1)

            fresh_state(path)
            with self.assertRaisesRegex(OpendartListError, "OPENDART_TRANSPORT"):
                opendart_secondary.scan_opendart_secondary(
                    path, day, day, review_limit=0, fetch_list=transport,
                    read_state=folio.read_json, write_state=folio.write_json)
            saved = folio.read_json(path)
            self.assertEqual(saved["opendart_secondary_backfill"]["coverage"], [])
            self.assertEqual(saved["opendart_secondary_backfill"]["next_date"], "2006-02-08")

    def test_queue_backlog_pauses_listing_production(self):
        day = date(2006, 2, 8)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-09", "next_date": "2006-02-08",
                "coverage": [], "queue": {
                    receipt("20060208", 1): {"receipt_no": receipt("20060208", 1),
                                             "source_status": "source_review_pending",
                                             "source_attempt_count": 0,
                                             "last_source_attempt_on": None,
                                             "rcept_dt": "20060208"},
                    receipt("20060208", 2): {"receipt_no": receipt("20060208", 2),
                                             "source_status": "source_review_pending",
                                             "source_attempt_count": 0,
                                             "last_source_attempt_on": None,
                                             "rcept_dt": "20060208"}},
                "positives": {}}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, date(2006, 2, 9), max_pending=2, review_limit=0,
                fetch_list=lambda _params: self.fail("listing must pause on backlog"),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["status"], "QUEUE_BACKLOG")
            self.assertEqual(result["listing_requests"], 0)
            self.assertEqual(result["pending_sources"], 2)

    def test_completed_range_rerun_is_idempotent(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        payload = list_page([row(receipt(tag, i), tag) for i in range(3)], 3, 1, 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            first = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, fetch_list=lambda _params: payload,
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(first["new_receipts"], 3)
            again = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual((again["listing_requests"], again["new_receipts"]), (0, 0))
            self.assertEqual(again["queued_receipts"], 3)
            self.assertEqual(again["status"], "LISTING_COMPLETE_SOURCE_PENDING")

    def test_2006_range_leaves_fulltext_and_direct_cursors_untouched(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        payload = list_page([row(receipt(tag, 1), tag, "최대주주등소유주식변동신고서")], 1, 1, 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["secondary_backfill"] = {"method": "dart-fulltext-v2-lossless-queue",
                                           "next_date": "2006-02-08", "coverage": []}
            state["historical_backfill"] = {"next_date": "2006-01-01", "coverage": []}
            state["early_direct_backfill"] = {"next_date": "2006-01-01", "coverage": []}
            folio.write_json(path, state)
            before = copy.deepcopy(folio.read_json(path))
            opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, fetch_list=lambda _params: payload,
                read_state=folio.read_json, write_state=folio.write_json)
            after = folio.read_json(path)
            for cursor_key in ("secondary_backfill", "secondary_equity_backfill",
                               "secondary_prior_backfill", "secondary_prior_equity_backfill",
                               "historical_backfill", "early_direct_backfill"):
                self.assertEqual(after[cursor_key], before[cursor_key])
            self.assertEqual(after["receipts"], {})
            self.assertEqual(after["holdings"], {})

    def test_source_positive_negative_failure_preserved_separately(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        positive_no, negative_no, failed_no = receipt(tag, 1), receipt(tag, 2), receipt(tag, 3)
        payload = list_page([row(positive_no, tag, "임원ㆍ주요주주특정증권등소유상황보고서"),
                             row(negative_no, tag, "사업보고서"),
                             row(failed_no, tag, "[기재정정]사업보고서")], 3, 1, 1)

        def archive(body):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as filing:
                filing.writestr("filing.xml", body)
            return buffer.getvalue()

        positive_doc = archive("<DOC>국민연금공단 보통주 1000</DOC>")
        negative_doc = archive("<DOC>일반 주주총회 의사록</DOC>")

        def document(no, _key):
            if no == positive_no:
                return positive_doc
            if no == negative_no:
                return negative_doc
            raise RuntimeError("DOCUMENT_TRANSPORT")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, fetch_list=lambda _params: payload,
                read_state=folio.read_json, write_state=folio.write_json)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=3, fetch_list=lambda _params: payload,
                fetch_document=document, read_state=folio.read_json,
                write_state=folio.write_json, key="test-key")
            self.assertEqual(result["source_review_attempts"], 3)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            positive = ledger["queue"][positive_no]
            self.assertEqual(positive["source_status"], "source_context_review_pending")
            held = ledger["positives"][positive_no]
            self.assertIsNone(held["document_no"])
            self.assertIn("not fabricated", held["document_no_note"])
            self.assertEqual(held["integration_required"], "sol_holding_observation")
            negative = ledger["queue"][negative_no]
            self.assertNotEqual(negative["source_status"], "source_context_review_pending")
            self.assertIsNotNone(negative["source_sha256"])
            failed = ledger["queue"][failed_no]
            self.assertEqual(failed["source_status"], "source_review_pending")
            self.assertTrue(ledger["queue"][failed_no]["correction_hold"])
            # Failures stay queued; nothing is promoted into shared ledgers.
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})
            self.assertNotIn(failed_no, ledger["positives"])
            # Next-day rerun reuses cached sources instead of redownloading them.
            saved["opendart_secondary_backfill"]["queue"][positive_no]["last_source_attempt_on"] = "2006-02-08"
            saved["opendart_secondary_backfill"]["queue"][negative_no]["last_source_attempt_on"] = "2006-02-08"
            saved["opendart_secondary_backfill"]["queue"][failed_no]["last_source_attempt_on"] = "2006-02-08"
            folio.write_json(path, saved)
            calls = []

            def strict_document(no, _key):
                calls.append(no)
                return document(no, _key)

            opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=3,
                fetch_list=lambda _params: self.fail("range refetched"),
                fetch_document=strict_document, read_state=folio.read_json,
                write_state=folio.write_json, key="test-key")
            self.assertEqual(calls, [failed_no])

    def test_pre_1999_start_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            with self.assertRaisesRegex(ValueError, "invalid opendart secondary bounds"):
                opendart_secondary.scan_opendart_secondary(
                    path, date(1999, 3, 31), date(1999, 4, 1), review_limit=0,
                    fetch_list=lambda _params: no_data(),
                    read_state=folio.read_json, write_state=folio.write_json)

    def test_schedule_workflow_uses_literal_overlap_while_dispatch_uses_input(self):
        workflow = Path(__file__).resolve().parents[2] / ".github" / "workflows" / \
            "foliotrace-opendart-secondary.yml"
        text = workflow.read_text(encoding="utf-8")
        self.assertIn("--overlap-days 3", text)
        self.assertNotIn('args=(--state foliotrace-state/state.json --overlap-days "$OVERLAP_DAYS")',
                         text)
        self.assertIn('--overlap-days "$OVERLAP_DAYS"', text)

    def test_first_window_stays_within_three_calendar_months(self):
        self.assertLessEqual(opendart_secondary.MAX_WINDOW_DAYS, 89)
        for start in (date(2000, 1, 1), date(2000, 2, 1)):
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "state.json"
                fresh_state(path)
                opendart_secondary.scan_opendart_secondary(
                    path, start, date(2000, 12, 31), max_windows=1, review_limit=0,
                    fetch_list=lambda _params: no_data(),
                    read_state=folio.read_json, write_state=folio.write_json)
                window = folio.read_json(path)["opendart_secondary_backfill"]["coverage"][0]
                span = (date.fromisoformat(window["to"]) - date.fromisoformat(window["from"])).days
                self.assertEqual((window["from"], span), (start.isoformat(), 88))

    def test_parser_version_change_reviews_completed_verdicts_once(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        positive_no, negative_no, stable_no = receipt(tag, 1), receipt(tag, 2), receipt(tag, 3)
        current = secondary.SOURCE_PARSER_VERSION

        def archive(body):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as filing:
                filing.writestr("filing.xml", body)
            return buffer.getvalue()

        docs = {positive_no: archive("<DOC>국민연금공단 보통주 1000</DOC>"),
                negative_no: archive("<DOC>일반 주주총회 의사록</DOC>")}
        calls = []

        def document(no, _key):
            calls.append(no)
            return docs[no]

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "queue": {
                    positive_no: {"receipt_no": positive_no, "rcept_dt": tag,
                                  "source_status": "source_context_review_pending",
                                  "parser_version": "stale", "source_attempt_count": 1,
                                  "last_source_attempt_on": None, "source_sha256": "old"},
                    negative_no: {"receipt_no": negative_no, "rcept_dt": tag,
                                  "source_status": "source_mention_unverified",
                                  "parser_version": "stale", "source_attempt_count": 1,
                                  "last_source_attempt_on": None, "source_sha256": "old"},
                    stable_no: {"receipt_no": stable_no, "rcept_dt": tag,
                                "source_status": "source_mention_unverified",
                                "parser_version": current, "source_attempt_count": 1,
                                "last_source_attempt_on": None, "source_sha256": "kept"}},
                "positives": {}}
            state["secondary_source_cache"] = {
                positive_no: {"status": "source_context_review_pending",
                              "parser_version": "stale", "source_sha256": "old"},
                negative_no: {"status": "source_mention_unverified",
                              "parser_version": "stale", "source_sha256": "old"},
                stable_no: {"status": "source_mention_unverified",
                            "parser_version": current, "source_sha256": "kept"}}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=3,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                fetch_document=document, read_state=folio.read_json,
                write_state=folio.write_json, key="test-key")
            # Stale positive and negative are re-examined; the current-version
            # verdict is not downloaded again.
            self.assertEqual(calls, [positive_no, negative_no])
            self.assertEqual(result["source_review_attempts"], 2)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertEqual(ledger["queue"][positive_no]["parser_version"], current)
            self.assertEqual(ledger["queue"][negative_no]["parser_version"], current)
            self.assertEqual(ledger["queue"][stable_no]["parser_version"], current)
            self.assertEqual(saved["secondary_source_cache"][stable_no]["source_sha256"], "kept")
            self.assertIn(positive_no, ledger["positives"])
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})

    def test_non_object_json_is_a_shape_error_without_retry_or_secrets(self):
        for body in (b"[1,2]", b"not json"):
            with patch.object(opendart_secondary.time, "sleep"), patch.object(
                    opendart_secondary.urllib.request, "urlopen",
                    return_value=io.BytesIO(body)) as request:
                with self.assertRaisesRegex(OpendartListError, "RESPONSE_SHAPE") as failure:
                    opendart_secondary.fetch_list_page({"bgn_de": "20060208"}, "test-key")
                self.assertEqual(request.call_count, 1)
                self.assertNotIn("test-key", str(failure.exception))

    def test_overlap_budget_leaves_forward_cursor_advancing(self):
        def fetch(params):
            bgn, end, page = params["bgn_de"], params["end_de"], params["page_no"]
            first = date(int(bgn[:4]), int(bgn[4:6]), int(bgn[6:8]))
            last = date(int(end[:4]), int(end[4:6]), int(end[6:8]))
            days = (last - first).days + 1
            total, pages = 101 * days, 2 * days
            rows = []
            for day_offset in range(days):
                tag = (first + timedelta(days=day_offset)).strftime("%Y%m%d")
                for i in range(101):
                    rows.append(row(f"{tag}{i:06d}", tag))
            span = rows[(page - 1) * 100:page * 100]
            return list_page(span, total, page, pages)

        from datetime import timedelta
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            queue = {}
            for day_number in range(1, 5):
                tag = f"2006010{day_number}"
                for i in range(101):
                    no = f"{tag}{i:06d}"
                    queue[no] = {"receipt_no": no, "rcept_dt": tag,
                                 "source_status": "source_review_pending",
                                 "parser_version": None, "source_attempt_count": 0,
                                 "last_source_attempt_on": None, "source_sha256": None}
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-01-01",
                "target_date": "2006-01-10", "next_date": "2006-01-05",
                "max_window_days": 1, "overlap_next_date": None,
                "coverage": [{"from": f"2006010{d}", "to": f"2006010{d}", "complete": True}
                             for d in range(1, 5)],
                "overlap_coverage": [], "queue": queue, "positives": {},
                "evicted_count": 0, "evicted_digest": ""}
            folio.write_json(path, state)
            cursors = []
            for _ in range(5):
                result = opendart_secondary.scan_opendart_secondary(
                    path, date(2006, 1, 1), date(2006, 1, 10),
                    max_listing_pages=2, max_windows=10, review_limit=0,
                    overlap_days=3, fetch_list=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
                cursors.append(result["next_date"])
            # The forward cursor must escape the 2006-01-05 stall within 5 runs.
            self.assertGreater(cursors[-1], "2006-01-05")
            self.assertEqual(list(sorted(cursors)), cursors)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertGreaterEqual(len(ledger["overlap_coverage"]), 3)
            self.assertGreater(len(ledger["coverage"]), 4)
            self.assertIsNotNone(ledger["overlap_next_date"])
            self.assertEqual(saved["receipts"], {})

    def test_stale_pair_with_limit_one_stays_source_pending(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        first_no, second_no = receipt(tag, 1), receipt(tag, 2)

        def archive(body):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as filing:
                filing.writestr("filing.xml", body)
            return buffer.getvalue()

        stale_doc = archive("<DOC>일반 주주총회 의사록</DOC>")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "overlap_next_date": "2006-02-09",
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "overlap_coverage": [], "positives": {},
                "evicted_count": 0, "evicted_digest": "",
                "queue": {
                    no: {"receipt_no": no, "rcept_dt": tag,
                         "source_status": "source_mention_unverified",
                         "parser_version": "stale", "source_attempt_count": 1,
                         "last_source_attempt_on": None, "source_sha256": "old"}
                    for no in (first_no, second_no)}}
            state["secondary_source_cache"] = {
                no: {"status": "source_mention_unverified",
                     "parser_version": "stale", "source_sha256": "old"}
                for no in (first_no, second_no)}
            folio.write_json(path, state)
            first = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=1,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                fetch_document=lambda no, _key: stale_doc,
                read_state=folio.read_json, write_state=folio.write_json, key="test-key")
            self.assertEqual(first["source_review_attempts"], 1)
            # One stale entry remains, so the lane must not claim completion.
            self.assertEqual(first["pending_sources"], 1)
            self.assertEqual(first["status"], "LISTING_COMPLETE_SOURCE_PENDING")
            second = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=1,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                fetch_document=lambda no, _key: stale_doc,
                read_state=folio.read_json, write_state=folio.write_json, key="test-key")
            self.assertEqual(second["pending_sources"], 0)
            self.assertEqual(second["status"], "SOURCE_REVIEW_COMPLETE")

    def test_positive_to_negative_clears_claims_with_history(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        flipped_no, steady_no = receipt(tag, 1), receipt(tag, 2)
        current = secondary.SOURCE_PARSER_VERSION

        def archive(body):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as filing:
                filing.writestr("filing.xml", body)
            return buffer.getvalue()

        docs = {flipped_no: archive("<DOC>일반 주주총회 의사록</DOC>"),
                steady_no: archive("<DOC>국민연금공단 보통주 1000</DOC>")}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "overlap_next_date": "2006-02-09",
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "overlap_coverage": [],
                "queue": {
                    flipped_no: {"receipt_no": flipped_no, "rcept_dt": tag,
                                 "source_status": "source_context_review_pending",
                                 "parser_version": "stale", "source_attempt_count": 1,
                                 "last_source_attempt_on": None, "source_sha256": "old",
                                 "source_history": [{"status": "source_context_review_pending",
                                                     "parser_version": "stale",
                                                     "source_sha256": "old"}]},
                    steady_no: {"receipt_no": steady_no, "rcept_dt": tag,
                                "source_status": "source_context_review_pending",
                                "parser_version": "stale", "source_attempt_count": 1,
                                "last_source_attempt_on": None, "source_sha256": "old",
                                "source_history": []}},
                "positives": {
                    flipped_no: {"receipt_no": flipped_no, "source_claims": [{"quantity": "999"}],
                                 "parser_version": "stale",
                                 "integration_required": "sol_holding_observation"},
                    steady_no: {"receipt_no": steady_no, "source_claims": [{"quantity": "1"}],
                                "parser_version": "stale",
                                "integration_required": "sol_holding_observation"}},
                "evicted_count": 0, "evicted_digest": ""}
            state["secondary_source_cache"] = {
                no: {"status": "source_context_review_pending",
                     "parser_version": "stale", "source_sha256": "old"}
                for no in (flipped_no, steady_no)}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=2,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                fetch_document=lambda no, _key: docs[no],
                read_state=folio.read_json, write_state=folio.write_json, key="test-key")
            self.assertEqual(result["source_review_attempts"], 2)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            # The flipped receipt loses its old claims atomically; the audit
            # trail keeps both verdicts while the positives queue does not.
            self.assertNotIn(flipped_no, ledger["positives"])
            self.assertNotEqual(ledger["queue"][flipped_no]["source_status"],
                                "source_context_review_pending")
            flipped_history = ledger["queue"][flipped_no]["source_history"]
            self.assertEqual([entry["status"] for entry in flipped_history],
                             ["source_context_review_pending",
                              ledger["queue"][flipped_no]["source_status"]])
            self.assertEqual(ledger["positives"][steady_no]["source_claims"], [])
            self.assertEqual(ledger["positives"][steady_no]["parser_version"], current)
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})

    def test_rm_short_codes_hold_and_overlap_refreshes_metadata(self):
        flags = opendart_secondary._correction_flags
        self.assertEqual(flags("사업보고서", "정"), (True, False))
        self.assertEqual(flags("사업보고서", "철"), (True, True))
        self.assertEqual(flags("사업보고서", "유"), (False, False))
        self.assertEqual(flags("[기재정정]사업보고서", ""), (True, False))
        day = date(2006, 2, 8)
        tag = "20060208"
        no = receipt(tag, 1)
        updated = row(no, tag, "사업보고서", corp="00000001", name="새회사", stock="000000", rm="철")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "overlap_next_date": None,
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "overlap_coverage": [],
                "queue": {no: {"receipt_no": no, "corp_code": "00000001",
                               "corp_name": "구회사", "stock_code": "000000",
                               "report_nm": "사업보고서", "rcept_dt": tag, "rm": "",
                               "first_seen_from": tag, "first_seen_to": tag,
                               "correction_hold": False, "withdrawal_flag": False,
                               "source_status": "source_mention_unverified",
                               "parser_version": secondary.SOURCE_PARSER_VERSION,
                               "source_attempt_count": 1,
                               "last_source_attempt_on": None,
                               "source_sha256": "kept-sha", "source_history": []}},
                "positives": {}, "evicted_count": 0, "evicted_digest": ""}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, overlap_days=3,
                fetch_list=lambda _params: list_page([updated], 1, 1, 1),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["overlap_windows"], 1)
            saved = folio.read_json(path)
            item = saved["opendart_secondary_backfill"]["queue"][no]
            # Listing metadata refreshes on recrawl while source evidence stays.
            self.assertEqual(item["corp_name"], "새회사")
            self.assertTrue(item["correction_hold"])
            self.assertTrue(item["withdrawal_flag"])
            self.assertEqual(item["source_status"], "source_mention_unverified")
            self.assertEqual(item["source_sha256"], "kept-sha")
            self.assertEqual(item["parser_version"], secondary.SOURCE_PARSER_VERSION)

    def test_queue_bound_evicts_oldest_terminal_negatives_only(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION

        def terminal(no, day_tag, held=False):
            return {"receipt_no": no, "rcept_dt": day_tag,
                    "source_status": "source_mention_unverified",
                    "parser_version": current, "source_attempt_count": 1,
                    "last_source_attempt_on": None, "source_sha256": f"sha-{no}",
                    "correction_hold": held, "withdrawal_flag": False,
                    "source_history": []}

        old = [receipt("20060207", i) for i in range(1, 4)]
        held_no = receipt("20060207", 9)
        positive_no, pending_no = receipt(tag, 50), receipt(tag, 51)
        fresh = [receipt(tag, 60), receipt(tag, 61)]
        payload = list_page([row(no, tag) for no in fresh], 2, 1, 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            queue = {no: terminal(no, "20060207") for no in old}
            queue[held_no] = terminal(held_no, "20060207", held=True)
            queue[positive_no] = {**terminal(positive_no, tag),
                                  "source_status": "source_context_review_pending"}
            queue[pending_no] = {**terminal(pending_no, tag),
                                 "source_status": "source_review_pending",
                                 "parser_version": None, "source_sha256": None}
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-08",
                "overlap_next_date": None, "coverage": [], "overlap_coverage": [],
                "queue": queue,
                "positives": {positive_no: {"receipt_no": positive_no}},
                "evicted_count": 0, "evicted_digest": ""}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, max_queue_entries=5,
                fetch_list=lambda _params: payload,
                read_state=folio.read_json, write_state=folio.write_json)
            # 6 retained + 2 new = 8 rows against a bound of 5: only the three
            # oldest terminal negatives go, with explicit accounting.
            self.assertEqual(result["evicted_count"], 3)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertEqual(ledger["evicted_count"], 3)
            self.assertEqual(len(ledger["evicted_digest"]), 64)
            remaining = set(ledger["queue"])
            for no in old:
                self.assertNotIn(no, remaining)
            for no in (held_no, positive_no, pending_no, *fresh):
                self.assertIn(no, remaining)
            self.assertIn(positive_no, ledger["positives"])


if __name__ == "__main__":
    unittest.main()
