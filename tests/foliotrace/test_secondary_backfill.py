import tempfile
import unittest
import io
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import patch

from scripts.foliotrace import folio, secondary
from pipeline.foliotrace.publish import make_snapshot


def result_page(rows, total=None, page=1, pages=1):
    total = len(rows) if total is None else total
    body = "".join(
        f'<tr><th><a class="company">{company}</a>'
        f'<a class="second" href="/dsaf001/main.do?rcpNo={no}&dcmNo={dcm}">{report}</a></th>'
        f'<td>{snippet}</td><td class="info">제출인</td><td class="date">{day}</td></tr>'
        for no, dcm, company, report, snippet, day in rows)
    page_info = f'<div class="pageInfo">[{page}/{pages}]</div>' if total else ""
    return (f'<table>{body}</table>{page_info}<input id="totalCnt" value="{total}">').encode()


POSCO = ("20060208000020", "1251611", "포스코", "의결권대리행사권유참고서류",
         "국민연금공단 보통주 *****", "2006.02.08")
NOISE = ("20060208000286", "1252220", "회사", "투자설명서",
         "국민연금관리공단 빌딩 4층", "2006.02.08")


class SecondaryBackfillTests(unittest.TestCase):
    def test_source_archive_marks_context_for_review_without_extracting_quantity(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("filing.xml", "<DOC><ROW>국민연금관리공단</ROW><ROW>보통주 2,407,509</ROW></DOC>")
        result = secondary.inspect_source_document(buffer.getvalue())
        self.assertEqual(result["status"], "source_context_review_pending")
        self.assertGreater(result["equity_context_count"], 0)
        self.assertNotIn("quantity", result)

    def test_parser_keeps_official_page_identity_and_receipt_metadata(self):
        day = date(2006, 2, 8)
        page = secondary.parse_search_page(result_page([POSCO]), 1, day, day)
        self.assertEqual((page["total"], page["page_count"]), (1, 1))
        self.assertEqual(page["rows"][0]["receipt_no"], POSCO[0])
        self.assertEqual(page["rows"][0]["document_no"], POSCO[1])
        count_with_separator = result_page([POSCO], total=1).replace(b'value="1"', b'value="1,000"')
        with self.assertRaisesRegex(ValueError, "PAGE_COUNT"):
            secondary.parse_search_page(count_with_separator, 1, day, day)
        with self.assertRaisesRegex(ValueError, "PAGE_IDENTITY"):
            secondary.parse_search_page(result_page([POSCO], page=2, pages=2, total=11), 1, day, day)
        with self.assertRaisesRegex(ValueError, "ROW_DATE_RANGE"):
            secondary.parse_search_page(result_page([POSCO]), 1, date(2006, 2, 9), date(2006, 2, 9))

    def test_completed_window_deduplicates_terms_and_keeps_noise_out_of_candidate_ledger(self):
        day = date(2006, 2, 8)
        answers = {
            secondary.TERMS[0]: result_page([POSCO]),
            secondary.TERMS[1]: result_page([NOISE, POSCO]),
            secondary.TERMS[2]: result_page([]),
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json)
            saved = folio.read_json(path)
            ledger = saved["secondary_backfill"]
            self.assertEqual(result["status"], "SEARCH_COMPLETE")
            self.assertEqual((result["search_requests"], result["new_candidates"]), (3, 1))
            self.assertEqual(ledger["next_date"], "2006-02-09")
            self.assertEqual(ledger["coverage"][0]["unique_documents"], 2)
            self.assertEqual(ledger["coverage"][0]["term_hits"][secondary.TERMS[1]], 2)
            self.assertEqual(set(ledger["candidates"]), {f'{POSCO[0]}:{POSCO[1]}'})
            self.assertEqual(saved["receipts"], {})
            self.assertEqual(saved["holdings"], {})
            snapshot = make_snapshot(saved, {})
            self.assertEqual(snapshot["secondaryCoverage"]["allContentCheckedThrough"], "2006-02-08")
            self.assertEqual(snapshot["secondaryCoverage"]["candidateDocumentCount"], 1)
            again = secondary.scan_secondary(path, day, day, fetch=lambda *_: self.fail("complete range refetched"),
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(again["search_requests"], 0)

    def test_source_review_is_bounded_and_never_promotes_holdings(self):
        day = date(2006, 2, 8)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("filing.xml", "<DOC>국민연금공단 보통주 *****</DOC>")
        answers = {secondary.TERMS[0]: result_page([POSCO]),
                   secondary.TERMS[1]: result_page([]), secondary.TERMS[2]: result_page([])}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, day, day, fetch=lambda term, *_: answers[term],
                read_state=folio.read_json, write_state=folio.write_json, key="test-key", review_limit=1,
                fetch_document=lambda no, key: buffer.getvalue())
            saved = folio.read_json(path)
            candidate = next(iter(saved["secondary_backfill"]["candidates"].values()))
            self.assertEqual(result["source_document_requests"], 1)
            self.assertEqual(candidate["review_status"], "source_context_review_pending")
            self.assertEqual(saved["holdings"], {})
            self.assertEqual(saved["events"], {})

    def test_failed_later_page_does_not_advance_window(self):
        day = date(2006, 2, 8)
        first = result_page([(f'20060208{i:06d}', str(1251611 + i), *POSCO[2:])
                             for i in range(10)], total=11, pages=2)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            def fetch(term, _start, _end, page):
                if term == secondary.TERMS[0] and page == 1:
                    return first
                if term == secondary.TERMS[0]:
                    raise RuntimeError("SEARCH_TRANSPORT")
                return result_page([])
            with self.assertRaises(secondary.SecondarySearchError) as failure:
                secondary.scan_secondary(path, day, day, fetch=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual((failure.exception.code, failure.exception.page), ("SEARCH_TRANSPORT", 2))
            self.assertIsNone(folio.read_json(path)["secondary_backfill"] if "secondary_backfill" in folio.read_json(path) else None)

    def test_repeated_document_on_nonadjacent_page_rejects_checkpoint(self):
        day = date(2006, 2, 8)
        rows = [(f'20060208{i:06d}', str(1251611 + i), '포스코',
                 '의결권대리행사권유참고서류', '국민연금공단 보통주', '2006.02.08')
                for i in range(20)]
        responses = {1: result_page(rows[:10], total=21, page=1, pages=3),
                     2: result_page(rows[10:], total=21, page=2, pages=3),
                     3: result_page([rows[0]], total=21, page=3, pages=3)}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            folio.write_json(path, folio.empty_state())
            def fetch(term, _start, _end, page):
                return responses[page] if term == secondary.TERMS[0] else result_page([])
            with self.assertRaises(secondary.SecondarySearchError) as failure:
                secondary.scan_secondary(path, day, day, fetch=fetch,
                    read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(failure.exception.code, 'PAGINATION_REPEAT')
            self.assertIsNone(folio.read_json(path)['secondary_backfill'])

    def test_site_page_cap_splits_window_before_checkpoint(self):
        start, end = date(2006, 2, 8), date(2006, 2, 9)
        calls = []
        def fetch(term, first, last, page):
            calls.append((term, first, last, page))
            if term == secondary.TERMS[0] and first != last:
                return result_page([POSCO] * 10, total=1010, pages=101)
            return result_page([])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, folio.empty_state())
            result = secondary.scan_secondary(path, start, end, max_windows=1, fetch=fetch,
                read_state=folio.read_json, write_state=folio.write_json)
            self.assertEqual(result["next_date"], "2006-02-09")
            self.assertEqual(folio.read_json(path)["secondary_backfill"]["coverage"][0]["to"], "2006-02-08")
            self.assertTrue(any(first == last == start for _, first, last, _ in calls))

    def test_early_direct_uses_separate_cursor_and_preserves_current_holdings(self):
        initial = folio.empty_state()
        initial["import_ledger"] = ["synthetic"]
        initial["latest_complete_listing_date"] = "2026-09-26"
        initial["historical_backfill"] = {"start_date": "2009-01-01", "target_date": "2026-09-26",
            "next_date": "2010-01-01", "coverage": []}
        initial["holdings"]["00104856"] = {"receipt_no": "20260923000001", "quantity": "100"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, initial)
            with patch.object(folio, "dart_json", return_value={"status": "013", "list": []}):
                result = folio.backfill_history(path, date(2006, 1, 1), date(2006, 1, 7), "test-key",
                    parse_limit=0, recheck_limit=0, ledger_key="early_direct_backfill")
            saved = folio.read_json(path)
            self.assertEqual(result["status"], "LISTING_COMPLETE")
            self.assertEqual(saved["early_direct_backfill"]["next_date"], "2006-01-08")
            self.assertEqual(saved["historical_backfill"], initial["historical_backfill"])
            self.assertEqual(saved["holdings"], initial["holdings"])


if __name__ == "__main__":
    unittest.main()
