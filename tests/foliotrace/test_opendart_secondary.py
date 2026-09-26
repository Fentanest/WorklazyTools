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

    def test_forward_first_advances_under_tight_budget(self):
        def fetch(params):
            bgn, end, page = params["bgn_de"], params["end_de"], params["page_no"]
            first = date(int(bgn[:4]), int(bgn[4:6]), int(bgn[6:8]))
            last = date(int(end[:4]), int(end[4:6]), int(end[6:8]))
            days = (last - first).days + 1
            total = 101 * days
            pages = (total + 99) // 100
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
                "overlap_coverage": [], "queue": queue, "positives": {}}
            folio.write_json(path, state)
            cursors = []
            for _ in range(5):
                result = opendart_secondary.scan_opendart_secondary(
                    path, date(2006, 1, 1), date(2006, 1, 10),
                    max_listing_pages=2, max_windows=10, review_limit=0,
                    overlap_days=3, fetch_list=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
                cursors.append(result["next_date"])
            # Forward runs first, so the cursor escapes 2006-01-05 even though
            # one day already costs the whole 2-page budget.
            self.assertGreater(cursors[-1], "2006-01-05")
            self.assertEqual(list(sorted(cursors)), cursors)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertGreater(len(ledger["coverage"]), 4)
            self.assertEqual(saved["receipts"], {})

    def test_completed_overlap_starts_new_cycle_and_sees_late_rows(self):
        from datetime import timedelta
        seen = {"late": False}

        def fetch(params):
            bgn, end, page = params["bgn_de"], params["end_de"], params["page_no"]
            first = date(int(bgn[:4]), int(bgn[4:6]), int(bgn[6:8]))
            last = date(int(end[:4]), int(end[4:6]), int(end[6:8]))
            days = (last - first).days + 1
            total = 101 * days
            pages = (total + 99) // 100
            rows = []
            for day_offset in range(days):
                tag = (first + timedelta(days=day_offset)).strftime("%Y%m%d")
                for i in range(101):
                    receipt_no = f"{tag}{i:06d}"
                    rm = "유철" if (seen["late"] and tag == "20060109" and i == 0) else ""
                    rows.append(row(receipt_no, tag, rm=rm))
            span = rows[(page - 1) * 100:page * 100]
            return list_page(span, total, page, pages)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            queue = {}
            for day_number in range(1, 11):
                tag = f"200601{day_number:02d}"
                for i in range(101):
                    no = f"{tag}{i:06d}"
                    queue[no] = {"receipt_no": no, "rcept_dt": tag,
                                 "source_status": "source_review_pending",
                                 "parser_version": None, "source_attempt_count": 0,
                                 "last_source_attempt_on": None, "source_sha256": None}
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-01-01",
                "target_date": "2006-01-10", "next_date": "2006-01-11",
                "max_window_days": 1, "overlap_next_date": None,
                "coverage": [{"from": f"200601{d:02d}", "to": f"200601{d:02d}", "complete": True}
                             for d in range(1, 11)],
                "overlap_coverage": [], "queue": queue, "positives": {}}
            folio.write_json(path, state)
            calls, resets = [], []
            for run in range(3):
                if run == 1:
                    seen["late"] = True
                result = opendart_secondary.scan_opendart_secondary(
                    path, date(2006, 1, 1), date(2006, 1, 10),
                    max_listing_pages=10, max_windows=10, review_limit=0,
                    overlap_days=3, fetch_list=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
                calls.append(result["listing_requests"])
                resets.append(result["overlap_cycle_reset"])
            # Every run lists a full bounded cycle; the lane never goes silent.
            self.assertTrue(all(count > 0 for count in calls))
            self.assertEqual(resets, [False, True, True])
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertGreaterEqual(len(ledger["overlap_coverage"]), 3)
            # The late combined-code row surfaced on the second cycle.
            late_no = "20060109" + f"{0:06d}"
            self.assertTrue(saved["opendart_secondary_backfill"]["queue"][late_no]["correction_hold"])
            self.assertTrue(saved["opendart_secondary_backfill"]["queue"][late_no]["withdrawal_flag"])
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
                                "integration_required": "sol_holding_observation"}}}
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
        self.assertEqual(flags("사업보고서", "유정"), (True, False))
        self.assertEqual(flags("사업보고서", "유철"), (True, True))
        self.assertEqual(flags("사업보고서", "코정"), (True, False))
        self.assertEqual(flags("사업보고서", "코철"), (True, True))
        self.assertEqual(flags("사업보고서", "유연정"), (True, False))
        self.assertEqual(flags("사업보고서", "취"), (True, False))
        self.assertEqual(flags("사업보고서", "철저히 검토바랍니다"), (False, False))
        self.assertEqual(flags("사업보고서", "본 건 정정 요구"), (True, False))
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
                "positives": {}}
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

    def test_listing_refresh_synchronizes_or_retracts_positives(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION
        withdrawn_no, corrected_no = receipt(tag, 1), receipt(tag, 2)

        def positive_row(no, held=False):
            return {"receipt_no": no, "corp_code": "00000001", "corp_name": "회사",
                    "stock_code": "000000", "report_nm": "사업보고서", "rcept_dt": tag,
                    "rm": "", "first_seen_from": tag, "first_seen_to": tag,
                    "correction_hold": held, "withdrawal_flag": False,
                    "source_status": "source_context_review_pending",
                    "parser_version": current, "source_attempt_count": 1,
                    "last_source_attempt_on": None, "source_sha256": f"sha-{no}",
                    "source_history": []}

        payload = list_page(
            [row(withdrawn_no, tag, rm="유철"), row(corrected_no, tag, rm="유정")], 2, 1, 1)
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
                "queue": {withdrawn_no: positive_row(withdrawn_no),
                          corrected_no: positive_row(corrected_no)},
                "positives": {
                    withdrawn_no: {"receipt_no": withdrawn_no, "correction_hold": False,
                                   "withdrawal_flag": False, "relation": "holding_observation_pending",
                                   "source_claims": [{"quantity": "7"}]},
                    corrected_no: {"receipt_no": corrected_no, "correction_hold": False,
                                   "withdrawal_flag": False, "relation": "holding_observation_pending",
                                   "source_claims": [{"quantity": "8"}]}}}
            folio.write_json(path, state)
            # No source review on this run: the sync must come from listing alone.
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, overlap_days=3,
                fetch_list=lambda _params: payload,
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["overlap_windows"], 1)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            queue = ledger["queue"]
            # Withdrawn filings lose their applied positive; the audit stays.
            self.assertNotIn(withdrawn_no, ledger["positives"])
            self.assertTrue(queue[withdrawn_no]["withdrawal_flag"])
            self.assertTrue(any(entry.get("note") == "positive_retracted_withdrawal"
                                for entry in queue[withdrawn_no]["source_history"]))
            # New correction holds synchronize flags without dropping the record.
            corrected = ledger["positives"][corrected_no]
            self.assertTrue(corrected["correction_hold"])
            self.assertFalse(corrected["withdrawal_flag"])
            self.assertEqual(corrected["relation"], "correction_relation_unverified")
            self.assertEqual(corrected["source_claims"], [{"quantity": "8"}])
            self.assertTrue(any(entry.get("note") == "positive_eligibility_synchronized"
                                for entry in queue[corrected_no]["source_history"]))
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})

    def test_queue_bound_reports_instead_of_dropping(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION

        def terminal(no, day_tag):
            return {"receipt_no": no, "rcept_dt": day_tag,
                    "source_status": "source_mention_unverified",
                    "parser_version": current, "source_attempt_count": 1,
                    "last_source_attempt_on": None, "source_sha256": f"sha-{no}",
                    "correction_hold": False, "withdrawal_flag": False,
                    "source_history": []}

        pending = [receipt(tag, i) for i in range(1, 4)]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            queue = {no: terminal(no, "20060207") for no in [receipt("20060207", 1)]}
            for no in pending:
                queue[no] = {**terminal(no, tag), "source_status": "source_review_pending",
                             "parser_version": None, "source_sha256": None}
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-08",
                "overlap_next_date": None, "coverage": [], "overlap_coverage": [],
                "queue": queue, "positives": {}}
            folio.write_json(path, state)
            # A cap of 1 with 4 queued rows (3 pending) first spills the one
            # archivable terminal row, then halts listing with an explicit
            # bound status instead of pretending success or dropping rows.
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, max_queue_entries=1,
                fetch_list=lambda _params: self.fail("bound must stop listing"),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["status"], "QUEUE_BOUND_EXCEEDED")
            self.assertEqual(result["listing_requests"], 0)
            self.assertEqual(result["archived_this_run"], 1)
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertEqual(len(ledger["queue"]), 3)
            self.assertEqual(ledger["coverage"], [])
            self.assertEqual(sum(entry["count"] for months in ledger["archive_manifest"].values()
                                 for entry in months.values()), 1)
            # Under a sufficient bound the same lane lists normally.
            healthy = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, max_queue_entries=20000,
                fetch_list=lambda _params: list_page([row(receipt(tag, 9), tag)], 1, 1, 1),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(healthy["new_receipts"], 1)
            self.assertEqual(len(folio.read_json(path)["opendart_secondary_backfill"]["queue"]), 4)

    def test_terminal_spill_archives_durably_and_keeps_scan_moving(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            queue = {}
            for i in range(1, 7):
                no = receipt(tag, i)
                queue[no] = {"receipt_no": no, "rcept_dt": tag,
                             "source_status": "source_mention_unverified",
                             "parser_version": current, "source_attempt_count": 1,
                             "last_source_attempt_on": None, "source_sha256": f"sha-{no}",
                             "correction_hold": False, "withdrawal_flag": False,
                             "source_history": []}
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "overlap_next_date": "2006-02-09",
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "overlap_coverage": [], "queue": queue, "positives": {}}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, max_queue_entries=2,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                read_state=folio.read_json, write_state=folio.write_json)
            # Six terminal rows against a bound of two: four spill to shards,
            # the scan finishes, and nothing is lost.
            self.assertEqual(result["archived_this_run"], 4)
            self.assertEqual(result["status"], "SOURCE_REVIEW_COMPLETE")
            saved = folio.read_json(path)
            ledger = saved["opendart_secondary_backfill"]
            self.assertLessEqual(len(ledger["queue"]), 2)
            manifest = ledger["archive_manifest"]["200602"]
            self.assertEqual(sum(entry["count"] for entry in manifest.values()), 4)
            archive_dir = opendart_secondary.archive_dir_for(path)
            shard = json.loads((archive_dir / "shard-200602-0000.json").read_text(encoding="utf-8"))
            self.assertEqual(shard["id_digest"], manifest["0"]["id_digest"])
            self.assertEqual(
                sorted(row[0] for row in shard["rows"]),
                sorted(row[0] for row in shard["rows"]))
            self.assertEqual(len(shard["rows"]), 4)

    def test_crash_between_shard_and_commit_loses_nothing(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            ids = [receipt(tag, i) for i in range(1, 4)]
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "overlap_next_date": "2006-02-09",
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "overlap_coverage": [], "positives": {},
                "queue": {no: {"receipt_no": no, "rcept_dt": tag,
                               "source_status": "source_mention_unverified",
                               "parser_version": current, "source_attempt_count": 1,
                               "last_source_attempt_on": None, "source_sha256": f"sha-{no}",
                               "correction_hold": False, "withdrawal_flag": False,
                               "source_history": []} for no in ids}}
            folio.write_json(path, state)
            archive_dir = opendart_secondary.archive_dir_for(path)
            # Simulate the crash: shard file durable, ledger commit never happened.
            opendart_secondary._write_shard_rows(
                archive_dir, "200602", 0,
                [[no, "source_mention_unverified", current, f"sha-{no}", False, False]
                 for no in ids])
            # Restart archives the still-queued rows again; the union keeps
            # every ID (spill moves only the over-bound rows) and the upgrade
            # replay deduplicates them.
            restarted = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, max_queue_entries=1,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(restarted["status"], "SOURCE_REVIEW_COMPLETE")
            saved = folio.read_json(path)
            shard_ids: set = set()
            for shard_file in sorted(archive_dir.glob("shard-*.json")):
                shard_ids.update(
                    row[0] for row in json.loads(shard_file.read_text(encoding="utf-8"))["rows"])
            live = set(saved["opendart_secondary_backfill"]["queue"])
            for no in ids:
                self.assertIn(no, live | shard_ids)
            with patch.object(secondary, "SOURCE_PARSER_VERSION", "bumped-parser"):
                replay = opendart_secondary.rehydrate_archive(
                    path, limit=100, read_state=folio.read_json,
                    write_state=folio.write_json)
            self.assertEqual(replay["rehydrated"], 2)
            rehydrated = folio.read_json(path)["opendart_secondary_backfill"]["queue"]
            self.assertEqual(sorted(rehydrated), sorted(ids))
            self.assertTrue(all(entry["parser_version"] == current for entry in rehydrated.values()))

    def test_upgrade_rehydration_respects_limit_and_manifest(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION
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
                "queue": {receipt(tag, i): {
                    "receipt_no": receipt(tag, i), "rcept_dt": tag,
                    "source_status": "source_mention_unverified",
                    "parser_version": current, "source_attempt_count": 1,
                    "last_source_attempt_on": None, "source_sha256": f"sha-{i}",
                    "correction_hold": False, "withdrawal_flag": False,
                    "source_history": []} for i in range(1, 5)}}
            folio.write_json(path, state)
            opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, max_queue_entries=1,
                fetch_list=lambda _params: self.fail("completed range refetched"),
                read_state=folio.read_json, write_state=folio.write_json)
            ledger = folio.read_json(path)["opendart_secondary_backfill"]
            self.assertEqual(sum(entry["count"] for months in ledger["archive_manifest"].values()
                                 for entry in months.values()), 3)
            with patch.object(secondary, "SOURCE_PARSER_VERSION", "bumped-parser"):
                first = opendart_secondary.rehydrate_archive(
                    path, limit=2, read_state=folio.read_json,
                    write_state=folio.write_json)
                self.assertEqual((first["rehydrated"], first["remaining_archived"]), (2, 1))
                second = opendart_secondary.rehydrate_archive(
                    path, limit=2, read_state=folio.read_json,
                    write_state=folio.write_json)
                self.assertEqual((second["rehydrated"], second["remaining_archived"]), (1, 0))
            saved = folio.read_json(path)["opendart_secondary_backfill"]
            self.assertEqual(len(saved["queue"]), 4)
            self.assertEqual(saved["archive_manifest"], {})

    def test_archived_rows_not_requeued_on_recrawl(self):
        day = date(2006, 2, 8)
        tag = "20060208"
        current = secondary.SOURCE_PARSER_VERSION
        no = receipt(tag, 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            fresh_state(path)
            state = folio.read_json(path)
            state["opendart_secondary_backfill"] = {
                "method": opendart_secondary.METHOD, "start_date": "2006-02-08",
                "target_date": "2006-02-08", "next_date": "2006-02-09",
                "overlap_next_date": None,
                "coverage": [{"from": "2006-02-08", "to": "2006-02-08", "complete": True}],
                "overlap_coverage": [], "queue": {}, "positives": {}}
            folio.write_json(path, state)
            archive_dir = opendart_secondary.archive_dir_for(path)
            record = opendart_secondary._write_shard_rows(
                archive_dir, "200602", 0,
                [[no, "source_mention_unverified", current, "sha-kept", False, False]])
            state = folio.read_json(path)
            state["opendart_secondary_backfill"]["archive_manifest"] = {"200602": {"0": record}}
            folio.write_json(path, state)
            result = opendart_secondary.scan_opendart_secondary(
                path, day, day, review_limit=0, overlap_days=3,
                fetch_list=lambda _params: list_page([row(no, tag)], 1, 1, 1),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["overlap_windows"], 1)
            self.assertGreaterEqual(result["archived_hits"], 1)
            self.assertEqual(result["new_receipts"], 0)
            saved = folio.read_json(path)["opendart_secondary_backfill"]
            self.assertNotIn(no, saved["queue"])

    def test_alternating_phases_share_tight_budget_with_late_amendment(self):
        from datetime import timedelta
        seen = {"late": False}

        def fetch(params):
            bgn, end, page = params["bgn_de"], params["end_de"], params["page_no"]
            first = date(int(bgn[:4]), int(bgn[4:6]), int(bgn[6:8]))
            last = date(int(end[:4]), int(end[4:6]), int(end[6:8]))
            days = (last - first).days + 1
            rows = []
            for day_offset in range(days):
                tag = (first + timedelta(days=day_offset)).strftime("%Y%m%d")
                for i in range(101):
                    rows.append(row(f"{tag}{i:06d}", tag))
                if seen["late"] and tag == "20060108":
                    rows.append(row(f"{tag}{101:06d}", tag,
                                    report="[기재정정]사업보고서", rm="코정"))
            total = len(rows)
            pages = (total + 99) // 100
            span = rows[(page - 1) * 100:page * 100]
            return list_page(span, total, page, pages)

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
                "overlap_coverage": [], "queue": queue, "positives": {}}
            folio.write_json(path, state)
            cursors, phases, overlaps = [], [], 0
            for run in range(10):
                if run == 5:
                    seen["late"] = True
                result = opendart_secondary.scan_opendart_secondary(
                    path, date(2006, 1, 1), date(2006, 1, 10),
                    max_listing_pages=2, max_windows=10, review_limit=0,
                    overlap_days=3, fetch_list=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
                cursors.append(result["next_date"])
                phases.append(result["last_phase"])
                overlaps += result["overlap_windows"]
            # Both frontiers move despite the 2-page budget: forward escapes
            # the stall, overlap rescans keep happening, and phases alternate.
            self.assertGreater(cursors[-1], "2006-01-05")
            self.assertEqual(list(sorted(cursors)), cursors)
            self.assertGreater(overlaps, 0)
            self.assertIn("overlap", phases)
            self.assertIn("forward", phases)
            saved = folio.read_json(path)
            # The late correction filing on 2006-01-08 is picked up by the
            # forward scan once the frontier reaches it.
            amended = saved["opendart_secondary_backfill"]["queue"]["20060108" + f"{101:06d}"]
            self.assertTrue(amended["correction_hold"])
            self.assertFalse(amended["withdrawal_flag"])
            self.assertEqual(saved["receipts"], {})

    def test_runner_reports_bound_stop_as_failure(self):
        from scripts.foliotrace import run_opendart_secondary
        self.assertIn("QUEUE_BOUND_EXCEEDED", run_opendart_secondary.INCOMPLETE_STATUSES)
        self.assertIn("LISTING_BUDGET_INSUFFICIENT", run_opendart_secondary.INCOMPLETE_STATUSES)
        self.assertNotIn("SOURCE_REVIEW_COMPLETE", run_opendart_secondary.INCOMPLETE_STATUSES)


if __name__ == "__main__":
    unittest.main()
