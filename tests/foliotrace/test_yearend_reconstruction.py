"""Year-end reconciliation tests: units plus processing-path coverage.

Input classes stay distinct:
- ``real_workbook``: stored local ``.xlsx`` bytes (measured, when present).
- synthetic inputs: hand-built workbooks and filing ZIPs (no real facts).
- stored responses: replayed dicts, cross-checked against the original.
- test doubles: ``TestDoubleAdapter`` only, never real accuracy.

No test performs network I/O, touches the operating state, or calls a real
model.  A National Pension positive citation from a real filing original is
reported unmeasured until such an original is secured; synthetic success
never closes it.
"""
import copy
import io
import json
import os
import sys
import tempfile
import unittest
import unittest.mock
import zipfile
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET

from pipeline.foliotrace import yearend, yearend_worker
from pipeline.foliotrace.indirect import register_evidence
from scripts.foliotrace import folio

REPO = Path(__file__).resolve().parents[2]
REAL_XLSX = REPO / "국내주식 종목별 투자 현황(2025년말).xlsx"
REAL_NPS_FIXTURE = Path(os.environ.get("FOLIOTRACE_REAL_NPS_FIXTURE", ""))


def synthetic_workbook(rows):
    """Minimal xlsx bytes: rows of (seq, name, eval_raw, weight_raw, ratio_raw)."""
    shared, index_of = [], {}

    def intern(text):
        if text not in index_of:
            index_of[text] = len(shared)
            shared.append(text)
        return index_of[text]

    sheet_rows = []
    for i, (seq, name, eval_raw, weight_raw, ratio_raw) in enumerate(rows, start=8):
        sheet_rows.append(
            f'<row r="{i}"><c r="A{i}"><v>{seq}</v></c>'
            f'<c r="B{i}" t="s"><v>{intern(name)}</v></c>'
            f'<c r="C{i}"><v>{eval_raw}</v></c>'
            f'<c r="D{i}"><v>{weight_raw}</v></c>'
            f'<c r="E{i}"><v>{ratio_raw}</v></c></row>')
    shared_xml = ("<?xml version='1.0'?><sst xmlns='http://schemas.openxmlformats.org/"
                  "spreadsheetml/2006/main'>" + "".join(f"<si><t>{s}</t></si>" for s in shared) + "</sst>")
    sheet_xml = ("<?xml version='1.0'?><worksheet xmlns='http://schemas.openxmlformats.org/"
                 "spreadsheetml/2006/main'><sheetData>" + "".join(sheet_rows) + "</sheetData></worksheet>")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml.encode())
        archive.writestr("xl/sharedStrings.xml", shared_xml.encode())
    return output.getvalue()


def xml_escape(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def worker_doc(rows, document_target="SYNCO", notes=(), filing_date="2026-03-18",
               obligation_date="2026-03-10", writing_date="2026-03-12"):
    body = [f'<filing filing-date="{filing_date}">',
            f'<filing-meta document-target="{xml_escape(document_target)}" '
            f'filer="{xml_escape(document_target)}" '
            f'obligation-date="{obligation_date}" writing-date="{writing_date}"/>',
            '<holder-table title="주식 소유 현황">']
    for row in rows:
        attrs = " ".join(f'{key}="{xml_escape(value)}"' for key, value in row.items())
        body.append(f"<holder-row {attrs}/>")
    body.append("</holder-table>")
    for date, role, applies_row, applies_field, note in notes:
        body.append(f'<register-note date="{date}" role="{role}" applies-to-row="{applies_row}" '
                    f'applies-to-field="{applies_field}" note="{xml_escape(note)}"/>')
    body.append("</filing>")
    return "".join(body)


def worker_zip(xml_text, inner="filing.xml"):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(inner, xml_text.encode())
    return output.getvalue()


NPS_DOC_ROWS = (
    {"holder": "First Eagle", "security": "보통주", "quantity": "9,778,216",
     "ratio": "8.29", "note": "'20.03.02 공시기준", "note-applies-to": "quantity"},
    {"holder": "국민연금공단", "security": "보통주", "quantity": "9,133,543",
     "ratio": "7.74", "note": "2025년 12월 31일 현재 주주명부 기준", "note-applies-to": "quantity"},
)
NPS_DOC_NOTES = (("2025-12-31", "shareholder_register_date", "1", "quantity", "주주명부 기준"),)


def base_isolated_state():
    state = folio.empty_state()
    state["receipts"]["20260318001422"] = {"receipt_no": "20260318001422"}
    return state


def default_comparison_args():
    return dict(excel_eval_eok_raw="1", excel_ratio_display="1.00",
                derived_estimate="100", price_date="2025-12-30")


class WorkbookAndNumericUnits(unittest.TestCase):
    def test_bnk_raw_precision_preserved_with_residual_not_zeroed(self):
        if not REAL_XLSX.is_file():
            self.skipTest("real workbook absent: BNK precision unmeasured")
        parsed = yearend.parse_yearend_workbook(REAL_XLSX.read_bytes())
        bnk = next(row for row in parsed["rows"] if row["name"] == "BNK금융지주")
        self.assertEqual(bnk["eval_eok_raw"], "4240.6411091999998")
        derived = yearend.derive_quantity_estimate(bnk["eval_eok_raw"], "15870", "2025-12-30")
        self.assertEqual(derived["derived_quantity_estimate"], "26721116")
        self.assertEqual(Decimal(derived["eval_won_exact"]), Decimal("424064110919.99998"))
        self.assertEqual(Decimal(derived["residual_won"]), Decimal("-0.00002"))
        displayed_residual = Decimal("4240.641109") * Decimal(100000000) - Decimal(26721116) * Decimal(15870)
        self.assertEqual(displayed_residual, Decimal("-20"))
        self.assertNotEqual(Decimal(derived["residual_won"]), Decimal("-20"))

    def test_rounded_ratio_never_uniquely_fixes_denominator(self):
        ktg_qty, disclosure_qty, denom = "9117617", "9133543", "117976645"
        excel = yearend.classify_ratio_compatibility(ktg_qty, denom, "7.73")
        disclosure = yearend.classify_ratio_compatibility(disclosure_qty, denom, "7.74")
        self.assertTrue(excel["reproduces_display_with_this_denominator"])
        self.assertTrue(disclosure["reproduces_display_with_this_denominator"])
        for result in (excel, disclosure):
            self.assertEqual(result["denominator_status"], "compatible_candidate_not_proven")
            self.assertEqual(result["cause_status"], "unresolved_quantity_vs_denominator_assumption")
            self.assertNotEqual(result["denominator_status"], "denominator_proven")
        alt = yearend.classify_ratio_compatibility(ktg_qty, "117976640", "7.73")
        self.assertTrue(alt["reproduces_display_with_this_denominator"])

    def test_display_precision_gap_is_not_balance_confirmation(self):
        gap = yearend.derive_quantity_estimate("4240.641109", "15870", "2025-12-30")
        self.assertEqual(Decimal(gap["residual_won"]), Decimal("-20"))
        self.assertEqual(gap["quantity_basis_status"], "unconfirmed_derived_not_disclosure_confirmed")

    def test_derived_estimate_never_named_official_balance(self):
        derived = yearend.derive_quantity_estimate("12956.133757", "142100", "2025-12-30")
        self.assertEqual(derived["kind"], "derived_quantity_estimate")
        self.assertNotIn("official", derived["kind"])
        self.assertIsNone(derived["quantity_basis_date"])
        with self.assertRaisesRegex(ValueError, "YEAREND_DERIVED_KIND"):
            yearend.store_derived_quantity(base_isolated_state(), "KT&G",
                                           {**derived, "kind": "official_balance"})

    def test_numeric_writing_normalized_but_invalid_rejected(self):
        self.assertEqual(yearend.normalize_number("1,000"), "1000")
        self.assertEqual(yearend.normalize_number(" 1000 "), "1000")
        self.assertEqual(yearend.normalize_number("0"), "0")
        with self.assertRaisesRegex(ValueError, "YEAREND_NUMERIC_MISSING"):
            yearend.normalize_number("")
        with self.assertRaisesRegex(ValueError, "YEAREND_NUMERIC_MISSING"):
            yearend.normalize_number(None)
        for bad, code in (("-1", "YEAREND_NUMERIC_NEGATIVE"), ("-0.5", "YEAREND_NUMERIC_NEGATIVE"),
                          ("NaN", "YEAREND_NUMERIC_NONFINITE"), ("Infinity", "YEAREND_NUMERIC_NONFINITE"),
                          ("nan", "YEAREND_NUMERIC_NONFINITE"), ("abc", "YEAREND_NUMERIC_SHAPE")):
            with self.subTest(value=bad):
                with self.assertRaisesRegex(ValueError, code):
                    yearend.normalize_number(bad)
        with self.assertRaisesRegex(ValueError, "YEAREND_EVAL"):
            yearend.derive_quantity_estimate("-1", "100", "2025-12-30")
        with self.assertRaisesRegex(ValueError, "YEAREND_EVAL"):
            yearend.derive_quantity_estimate("NaN", "100", "2025-12-30")
        with self.assertRaisesRegex(ValueError, "YEAREND_EVAL_MISSING"):
            yearend.derive_quantity_estimate("", "100", "2025-12-30")


class WorkbookParserTests(unittest.TestCase):
    def test_richtext_shared_string_preserves_cell_identity(self):
        sst = ('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
               '<si><r><t>ABC</t></r><r><t>Co</t></r></si><si><t>NEXT</t></si></sst>')
        sheet_rows = []
        for row, index in ((8, 0), (9, 1)):
            sheet_rows.append(
                f'<row r="{row}"><c r="A{row}"><v>{row - 7}</v></c>'
                f'<c r="B{row}" t="s"><v>{index}</v></c>'
                f'<c r="C{row}"><v>1</v></c><c r="D{row}"><v>0.5</v></c>'
                f'<c r="E{row}"><v>0.01</v></c></row>')
        sheet = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                 '<sheetData>' + "".join(sheet_rows) + "</sheetData></worksheet>")
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("xl/sharedStrings.xml", sst)
            archive.writestr("xl/worksheets/sheet1.xml", sheet)
        got = yearend.parse_yearend_workbook(output.getvalue())
        self.assertEqual([row["name"] for row in got["rows"]], ["ABCCo", "NEXT"])

    def test_missing_cell_does_not_shift_columns(self):
        sheet = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                 '<sheetData><row r="8"><c r="A8"><v>1</v></c>'
                 '<c r="B8" t="s"><v>0</v></c>'
                 '<c r="D8"><v>0.5</v></c><c r="E8"><v>0.01</v></c></row></sheetData></worksheet>')
        sst = ('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
               '<si><t>GAP</t></si></sst>')
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("xl/sharedStrings.xml", sst)
            archive.writestr("xl/worksheets/sheet1.xml", sheet)
        (row,) = yearend.parse_yearend_workbook(output.getvalue())["rows"]
        self.assertEqual((row["name"], row["eval_eok_raw"], row["weight_raw"], row["ratio_raw"]),
                         ("GAP", "", "0.5", "0.01"))

    def test_nameless_data_row_raises_instead_of_misreading(self):
        sheet = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                 '<sheetData><row r="8"><c r="A8"><v>1</v></c>'
                 '<c r="C8"><v>9</v></c></row></sheetData></worksheet>')
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("xl/sharedStrings.xml", "<sst/>")
            archive.writestr("xl/worksheets/sheet1.xml", sheet)
        with self.assertRaisesRegex(ValueError, "YEAREND_NAME_CELL_MISSING"):
            yearend.parse_yearend_workbook(output.getvalue())

    def test_real_workbook_matches_independent_xml_reader(self):
        if not REAL_XLSX.is_file():
            self.skipTest("real workbook absent: unmeasured")
        payload = REAL_XLSX.read_bytes()
        parsed = yearend.parse_yearend_workbook(payload)
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            strings = ["".join(t.text or "" for t in si.findall(".//s:t", ns))
                       for si in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", ns)]
            expected = {}
            for row in ET.fromstring(archive.read("xl/worksheets/sheet1.xml")).findall("s:sheetData/s:row", ns):
                rno = int(row.attrib["r"])
                if rno < 8:
                    continue
                cells = {}
                for cell in row.findall("s:c", ns):
                    value = cell.find("s:v", ns)
                    text = value.text if value is not None else ""
                    if cell.get("t") == "s" and text:
                        text = strings[int(text)]
                    cells["".join(ch for ch in cell.get("r", "") if ch.isalpha())] = text
                if cells.get("A", "").isdigit() and cells.get("B"):
                    expected[rno] = cells
        self.assertEqual(parsed["row_count"], 1206)
        self.assertEqual(len(expected), 1206)
        for row in parsed["rows"]:
            actual = expected[row["row_number"]]
            for col, key in (("A", "seq_raw"), ("B", "name"), ("C", "eval_eok_raw"),
                             ("D", "weight_raw"), ("E", "ratio_raw")):
                self.assertEqual(row[key], actual[col], (row["row_number"], col))


class ComparisonVersioningTests(unittest.TestCase):
    def test_pending_comparison_receives_later_evidence(self):
        state = {}
        yearend.compare_yearend(state, "SYNTHETIC", **default_comparison_args())
        result = yearend.compare_yearend(
            state, "SYNTHETIC", **default_comparison_args(),
            disclosure_quantity="100", disclosure_ratio_display="1.00",
            disclosure_basis_date="2025-12-31",
            disclosure_basis_role="shareholder_register_date",
            disclosure_receipt_no="20260318001422")
        self.assertTrue(result["changed"])
        self.assertEqual(result["version"], 2)
        record = state["yearend_comparison"]["SYNTHETIC"]
        self.assertEqual(len(record["versions"]), 2)
        self.assertEqual(record["versions"][0]["status"], "comparison_pending_hold")
        # Excel originals survive untouched through regeneration.
        self.assertEqual(record["excel_eval_eok_raw"], "1")

    def test_equal_values_are_match_unconfirmed_not_discrepancy(self):
        state = {}
        yearend.compare_yearend(state, "SYNTHETIC", **default_comparison_args(),
                                disclosure_quantity="100", disclosure_ratio_display="1.00")
        status = state["yearend_comparison"]["SYNTHETIC"]["status"]
        self.assertNotEqual(status, "discrepancy_unexplained")
        self.assertEqual(status, "values_match_basis_unconfirmed")

    def test_differing_values_split_by_basis_comparability(self):
        comparable, unbasis = {}, {}
        yearend.compare_yearend(comparable, "S", **default_comparison_args(),
                                disclosure_quantity="101", disclosure_basis_date="2025-12-31",
                                disclosure_basis_role="shareholder_register_date")
        yearend.compare_yearend(unbasis, "S", **default_comparison_args(), disclosure_quantity="101")
        self.assertEqual(comparable["yearend_comparison"]["S"]["status"], "discrepancy_unexplained")
        self.assertEqual(unbasis["yearend_comparison"]["S"]["status"], "values_differ_basis_unconfirmed")

    def test_conflicting_excel_original_raises(self):
        state = {}
        yearend.compare_yearend(state, "SYNTHETIC", **default_comparison_args())
        with self.assertRaisesRegex(ValueError, "YEAREND_INPUT_CONFLICT"):
            yearend.compare_yearend(state, "SYNTHETIC", **{**default_comparison_args(),
                                                           "excel_eval_eok_raw": "2"})

    def test_identical_evidence_rerun_is_idempotent(self):
        state = {}
        first = yearend.compare_yearend(state, "SYNTHETIC", **default_comparison_args(),
                                        disclosure_quantity="100")
        second = yearend.compare_yearend(state, "SYNTHETIC", **default_comparison_args(),
                                         disclosure_quantity="100")
        self.assertTrue(first["changed"])
        self.assertFalse(second["changed"])
        self.assertEqual(len(state["yearend_comparison"]["SYNTHETIC"]["versions"]), 1)

    def test_subjects_split_by_security_and_target_point(self):
        state = {}
        yearend.compare_yearend(state, "S", **default_comparison_args(), security_kind="common")
        yearend.compare_yearend(state, "S", **default_comparison_args(), security_kind="preferred")
        yearend.compare_yearend(state, "S", **default_comparison_args(), target_point="2024-12-31")
        yearend.compare_yearend(state, "S", **default_comparison_args(), target_point="2025-12-31")
        self.assertEqual(len(state["yearend_comparison"]), 4)

    def test_stock_code_never_invented(self):
        state = {}
        yearend.compare_yearend(state, "S", **default_comparison_args())
        self.assertIsNone(state["yearend_comparison"]["S"]["stock_code"])
        self.assertEqual(state["yearend_comparison"]["S"]["stock_code_status"], "unconfirmed")
        yearend.compare_yearend(state, "T", **default_comparison_args(), stock_code="005930")
        self.assertEqual(state["yearend_comparison"]["T|code:005930"]["stock_code_status"],
                         "provided_unverified")


class QueueContractTests(unittest.TestCase):
    def test_conflicting_clue_reports_change_and_preserves_both(self):
        state = {}
        yearend.enqueue_citation_followup(state, "SYNTHETIC", {"source_text": "one"})
        before = copy.deepcopy(state)
        result = yearend.enqueue_citation_followup(state, "SYNTHETIC", {"source_text": "two"})
        self.assertEqual(result["changed"], state != before)
        self.assertTrue(result["changed"])
        self.assertTrue(result["state_changed"])
        item = state["citation_followup_queue"]["SYNTHETIC"]
        self.assertEqual(item["state"], "value_conflict")
        self.assertEqual(item["clue"], {"source_text": "one"})
        self.assertEqual(item["conflicting_clues"], [{"source_text": "two"}])

    def test_same_outcome_advance_reports_history_mutation(self):
        state = {}
        yearend.enqueue_citation_followup(state, "SYNTHETIC", {})
        before = copy.deepcopy(state)
        result = yearend.advance_followup(state, "SYNTHETIC", "pending_search")
        self.assertEqual(result["changed"], state != before)
        self.assertTrue(result["changed"])
        self.assertFalse(result["state_changed"])
        self.assertTrue(result["history_appended"])

    def test_empty_clue_cannot_reach_verified_without_proof(self):
        state = {}
        yearend.enqueue_citation_followup(state, "SYNTHETIC", {})
        with self.assertRaisesRegex(ValueError, "YEAREND_VERIFY_REQUIRED"):
            yearend.advance_followup(state, "SYNTHETIC", "resolved_verified_hold")
        self.assertNotEqual(state["citation_followup_queue"]["SYNTHETIC"]["state"],
                            "resolved_verified_hold")
        with self.assertRaisesRegex(ValueError, "YEAREND_VERIFY_REQUIRED"):
            yearend.advance_followup(state, "SYNTHETIC", "resolved_verified_hold",
                                     verification={"archive_sha256": "x"})

    def test_conflict_and_history_survive_file_round_trip(self):
        state = base_isolated_state()
        yearend.enqueue_citation_followup(state, "SYNTHETIC", {"source_text": "one"})
        yearend.enqueue_citation_followup(state, "SYNTHETIC", {"source_text": "two"})
        yearend.advance_followup(state, "SYNTHETIC", "missing_original", note="resume")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            folio.write_json(path, state)
            reloaded = folio.read_json(path)
        item = reloaded["citation_followup_queue"]["SYNTHETIC"]
        self.assertEqual(item["state"], "missing_original")
        self.assertEqual(item["clue"], {"source_text": "one"})
        self.assertEqual(item["conflicting_clues"], [{"source_text": "two"}])
        self.assertEqual(len(item["history"]), 2)
        self.assertGreaterEqual(item["resume_count"], 2)

    def test_caller_mutation_cannot_rewrite_stored_clue(self):
        state = {}
        clue = {"source_text": "one", "date_clues": [{"text": "2020-03-02"}]}
        yearend.enqueue_citation_followup(state, "SYNTHETIC", clue)
        clue["date_clues"].append({"text": "forged"})
        clue["source_text"] = "rewritten"
        stored = state["citation_followup_queue"]["SYNTHETIC"]["clue"]
        self.assertEqual(stored, {"source_text": "one", "date_clues": [{"text": "2020-03-02"}]})


class ArchiveVerificationTests(unittest.TestCase):
    def test_metadata_flag_alone_never_hits(self):
        result = yearend.lookup_original(
            {"SYNTHETIC": {"has_archive_bytes": True, "archive_bytes_sha256": "a" * 64}}, "SYNTHETIC")
        self.assertNotEqual(result["status"], "archive_hit")
        self.assertEqual(result["status"], "origin_unverified_cache_claim")

    def test_verified_bytes_hit_and_failures_distinguished(self):
        payload = worker_zip("<filing/>")
        digest = hashlib_sha(payload)
        good = {"archive_sha256": digest, "inner_file_name": "filing.xml",
                "inner_file_sha256": hashlib_sha(b"<filing/>")}
        hit = yearend.lookup_original({"R": good}, "R", archive_bytes=payload)
        self.assertEqual(hit["status"], "archive_hit")
        self.assertEqual(
            yearend.lookup_original({"R": {"archive_sha256": "zz"}}, "R",
                                    archive_bytes=payload)["status"], "origin_hash_unusable")
        self.assertEqual(
            yearend.lookup_original({"R": good}, "R", archive_bytes=b"tampered")["status"],
            "archive_hash_mismatch")
        corrupt_entry = {**good, "archive_sha256": hashlib_sha(b"not a zip")}
        self.assertEqual(
            yearend.lookup_original({"R": corrupt_entry}, "R",
                                    archive_bytes=b"not a zip")["status"], "archive_corrupt")
        self.assertEqual(
            yearend.lookup_original({"R": {**good, "inner_file_name": "absent.xml"}}, "R",
                                    archive_bytes=payload)["status"], "inner_file_missing")
        self.assertEqual(
            yearend.lookup_original({"R": {**good, "inner_file_sha256": "b" * 64}}, "R",
                                    archive_bytes=payload)["status"], "inner_hash_mismatch")
        self.assertEqual(yearend.lookup_original({}, "R")["status"], "missing_original")
        self.assertEqual(yearend.lookup_original(
            {"R": {"archive_sha256": digest, "source_claims": [], "source_mention_count": 0}},
            "R")["status"], "extraction_cache_only_no_archive")

    def test_reparse_verified_archive_reads_stored_bytes(self):
        payload = worker_zip("<filing/>")
        entry = {"archive_sha256": hashlib_sha(payload), "inner_file_name": "filing.xml",
                 "inner_file_sha256": hashlib_sha(b"<filing/>")}
        with tempfile.TemporaryDirectory() as directory:
            archive_dir = Path(directory)
            (archive_dir / "R.zip").write_bytes(payload)
            seen = yearend.reparse_verified_archive(
                archive_dir, "R", entry, lambda data: ("parsed", len(data)))
        self.assertEqual(seen, ("parsed", len(payload)))


def hashlib_sha(payload: bytes) -> str:
    import hashlib
    return hashlib.sha256(payload).hexdigest()


def hashlib_matches(payload: bytes, entry: dict) -> bool:
    import hashlib
    return hashlib.sha256(payload).hexdigest() == entry.get("archive_sha256")


class WorkerTableProcessingTests(unittest.TestCase):
    def setUp(self):
        self.xml = worker_doc(NPS_DOC_ROWS, notes=NPS_DOC_NOTES)
        self.payload = worker_zip(self.xml)
        self.digest = hashlib_sha(self.payload)
        self.inner_digest = hashlib_sha(self.xml.encode())
        self.layout = yearend_worker.extract_holder_table(
            self.xml, self.digest, "filing.xml", self.inner_digest)

    def test_nps_row_distinguished_from_first_eagle(self):
        candidate = yearend_worker.candidate_from_row(
            self.layout, 1,
            date_bindings=[{"text": "2025-12-31", "role": "shareholder_register_date",
                            "ambiguous": False}])
        check = yearend_worker.verify_candidate(self.layout, candidate)
        self.assertTrue(check["verified"], check["failed"])
        self.assertEqual(candidate["holder_name"], "국민연금공단")
        self.assertEqual(candidate["quantity"], "9133543")
        self.assertNotEqual(candidate["quantity"], "9778216")
        self.assertTrue(candidate["is_nps_claim"])
        other = yearend_worker.candidate_from_row(self.layout, 0)
        self.assertFalse(other["is_nps_claim"])
        self.assertEqual(other["quantity"], "9778216")

    def test_note_bound_to_cited_row_only(self):
        bindings = [{"text": "2025-12-31", "role": "shareholder_register_date",
                     "ambiguous": False}]
        leaked = yearend_worker.candidate_from_row(self.layout, 0, date_bindings=bindings)
        leaked["note_text"] = self.layout["rows"][1]["note_text"]
        check = yearend_worker.verify_candidate(self.layout, leaked)
        self.assertFalse(check["verified"])
        self.assertIn("note_scope", check["failed"])
        proper = yearend_worker.candidate_from_row(self.layout, 1, date_bindings=bindings)
        self.assertTrue(yearend_worker.verify_candidate(self.layout, proper)["verified"])

    def test_dates_keep_roles_or_hold(self):
        candidate = yearend_worker.candidate_from_row(
            self.layout, 1,
            date_bindings=[{"text": "2026-03-18", "role": "filing_date", "ambiguous": True},
                           {"text": "2026-03-10", "role": "obligation_date", "ambiguous": True},
                           {"text": "2026-03-12", "role": "writing_basis_date", "ambiguous": True},
                           {"text": "2025-12-31", "role": "shareholder_register_date",
                            "ambiguous": False}])
        check = yearend_worker.verify_candidate(self.layout, candidate)
        self.assertTrue(check["verified"], check["failed"])
        roles = {binding["role"] for binding in check["checks"]["dates"]["bindings"]}
        self.assertEqual(roles, {"filing_date", "obligation_date", "writing_basis_date",
                                 "shareholder_register_date"})
        mystery = yearend_worker.candidate_from_row(self.layout, 1, date_bindings=[
            {"text": "2025-12-31", "role": "mystery_date", "ambiguous": False}])
        failed = yearend_worker.verify_candidate(self.layout, mystery)
        self.assertFalse(failed["verified"])
        self.assertIn("dates", failed["failed"])

    def test_wrong_target_corp_never_applied_to_document_corp(self):
        rows = ({"holder": "국민연금공단", "security": "보통주", "quantity": "100",
                 "ratio": "8.41", "note": "KB금융 지분"},)
        layout = yearend_worker.extract_holder_table(
            worker_doc(rows, document_target="천보"), "a" * 64, "filing.xml", "b" * 64)
        candidate = yearend_worker.candidate_from_row(
            layout, 0, equity_target="KB금융",
            date_bindings=[{"text": "2026-03-18", "role": "filing_date", "ambiguous": True}])
        self.assertTrue(yearend_worker.verify_candidate(layout, candidate)["verified"])
        self.assertEqual(candidate["equity_target_corp"], "KB금융")
        self.assertNotEqual(candidate["equity_target_corp"], layout["document_target"])

    def test_multiple_nps_rows_are_ambiguous_not_merged(self):
        rows = ({"holder": "국민연금공단", "security": "보통주", "quantity": "100", "ratio": "1.00"},
                {"holder": "국민연금기금", "security": "보통주", "quantity": "200", "ratio": "2.00"})
        state = base_isolated_state()
        with tempfile.TemporaryDirectory() as directory:
            archive_dir = Path(directory)
            (archive_dir / "R.zip").write_bytes(worker_zip(worker_doc(rows)))
            outcome = yearend_worker.process_followup(
                state, {"request_key": "amb", "receipt_no": "R"}, archive_dir=archive_dir)
        self.assertEqual(outcome["outcome"], "ambiguous_candidates")

    def test_past_quantity_and_later_ratio_stay_separate_points(self):
        state = {}
        yearend.compare_yearend(state, "KT&G", excel_eval_eok_raw="12956.133757",
                                excel_ratio_display="7.73", derived_estimate="9117617",
                                price_date="2025-12-30", disclosure_quantity="9778216",
                                disclosure_ratio_display="8.29",
                                disclosure_basis_date="2025-12-31",
                                disclosure_basis_role="shareholder_register_date",
                                disclosure_receipt_no="20260318001422",
                                denominator_quantity="117976645", denominator_date="2025-12-31",
                                target_point="2025-12-31")
        row = state["yearend_comparison"]["KT&G|asof:2025-12-31"]
        self.assertEqual(row["disclosure_quantity"], "9778216")
        self.assertEqual(row["disclosure_ratio_display"], "8.29")
        self.assertNotIn("7.12", json.dumps(row))


class WorkerEndToEndTests(unittest.TestCase):
    def run_request(self, archive_present=True, request=None, stored=None):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        archive_dir = root / "archives"
        archive_dir.mkdir()
        if archive_present:
            (archive_dir / "20260318001422.zip").write_bytes(worker_zip(worker_doc(NPS_DOC_ROWS, document_target="KT&G", notes=NPS_DOC_NOTES)))
        state = base_isolated_state()
        req = request or {"request_key": "ktg-nps", "receipt_no": "20260318001422",
                          "equity_target_corp": "KT&G", "document_target_corp": "KT&G"}
        return root, state, yearend_worker.process_followup(
            state, req, archive_dir=archive_dir,
            stored_responses=stored, output_dir=root / "out",
            fetch_document=self._forbidden_fetch)

    @staticmethod
    def _forbidden_fetch(*args, **kwargs):
        raise AssertionError("verified path must never download")

    def test_missing_then_stage_then_verify_then_idempotent(self):
        root, state, first = self.run_request(archive_present=False)
        self.assertEqual(first["outcome"], "missing_original")
        self.assertTrue(first["changed"])
        # Stage the prepared original and rerun the same request.
        (root / "archives" / "20260318001422.zip").write_bytes(
            worker_zip(worker_doc(NPS_DOC_ROWS, document_target="KT&G", notes=NPS_DOC_NOTES)))
        req = {"request_key": "ktg-nps", "receipt_no": "20260318001422",
               "equity_target_corp": "KT&G", "document_target_corp": "KT&G"}
        second = yearend_worker.process_followup(
            state, req, archive_dir=root / "archives", output_dir=root / "out",
            fetch_document=self._forbidden_fetch)
        self.assertEqual(second["outcome"], "resolved_verified_hold")
        self.assertTrue(second["changed"])
        evidence_path = Path(second["written"]["evidence_candidate"])
        self.assertTrue(evidence_path.is_file())
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        self.assertEqual(evidence["quantity"], "9133543")
        self.assertEqual(evidence["extraction_source"], "worker_table_structured")
        comparisons = yearend.build_comparison_table(state)
        self.assertEqual(len(comparisons), 1)
        self.assertEqual(comparisons[0]["disclosure_quantity"], "9133543")
        history_len = len(state["citation_followup_queue"]["ktg-nps"]["history"])
        versions = len(state["yearend_comparison"]["KT&G"]["versions"])
        third = yearend_worker.process_followup(
            state, req, archive_dir=root / "archives", output_dir=root / "out",
            fetch_document=self._forbidden_fetch)
        self.assertEqual(third["outcome"], "resolved_verified_hold")
        self.assertFalse(third["changed"])
        self.assertTrue(third.get("idempotent"))
        self.assertEqual(len(state["citation_followup_queue"]["ktg-nps"]["history"]), history_len)
        self.assertEqual(len(state["yearend_comparison"]["KT&G"]["versions"]), versions)

    def test_verified_evidence_converts_to_register_evidence_on_isolated_state(self):
        _, state, second = self.run_request(archive_present=True)
        self.assertEqual(second["outcome"], "resolved_verified_hold")
        evidence = second["evidence"]
        state["universe"]["00126380"] = {"corp_code": "00126380", "stock_code": "005930",
                                         "name": "KT&G"}
        fact = yearend_worker.build_register_evidence_fact(
            {**evidence, "quantity": "9133543", "ownership_percent": "7.74",
             "security_kind": "common", "verification": {"verified": True},
             "source_row_offset": 1},
            {"corp_code": "00126380", "stock_code": "005930", "filer_corp_code": "00126380",
             "source_filing_date": "2026-03-18", "basis_date": "2025-12-31",
             "source_receipt_no": "20260318001422", "source_row_sha256": "b" * 64,
             "source_file_sha256": "a" * 64, "source_document_sha256": "a" * 64,
             "source_section_sha256": "b" * 64, "issuer_identity_sha256": "c" * 64,
             "verified_at": "2026-10-01T00:00:00Z"})
        result = register_evidence(state, fact)
        self.assertTrue(result["changed"])
        with self.assertRaisesRegex(ValueError, "YEAREND_EVIDENCE_INCOMPLETE"):
            yearend_worker.build_register_evidence_fact(
                {**evidence, "verification": {"verified": False}}, {})

    def test_citation_cycle_and_false_cache_cannot_verify(self):
        state = base_isolated_state()
        cycled = yearend_worker.process_followup(
            state, {"request_key": "cycle", "receipt_no": "A", "chain": ["A"]})
        self.assertEqual(cycled["outcome"], "citation_cycle_hold")
        forged = yearend_worker.process_followup(
            base_isolated_state(),
            {"request_key": "forged", "receipt_no": "R", "clue": {}},
            archive_dir=None, fetch_document=self._forbidden_fetch)
        self.assertEqual(forged["outcome"], "missing_original")

    def test_stored_response_cross_checked_before_verified(self):
        xml_text = ("<filing><note>SYNCO 국민연금공단 보통주 100주 2025-12-31 기준</note></filing>")
        payload = worker_zip(xml_text)
        with tempfile.TemporaryDirectory() as directory:
            archive_dir = Path(directory)
            (archive_dir / "R.zip").write_bytes(payload)
            state = base_isolated_state()
            good = {"response_id": "stored-1",
                    "clue": {"holder_name": "국민연금공단", "equity_target_corp": "SYNCO",
                             "security_kind": "보통주", "quantity": "100",
                             "date_clues": [{"text": "2025-12-31",
                                             "role": "shareholder_register_date",
                                             "ambiguous": False}]}}
            ok_request = {"request_key": "stored-ok", "receipt_no": "R",
                          "document_target_corp": "SYNCO", "equity_target_corp": "SYNCO"}
            ok_result = yearend_worker.process_followup(
                state, ok_request, archive_dir=archive_dir,
                stored_responses={"stored-ok": good}, fetch_document=self._forbidden_fetch)
            self.assertEqual(ok_result["outcome"], "resolved_verified_hold")
            self.assertEqual(ok_result["evidence"]["stored_response_id"], "stored-1")
            bad = copy.deepcopy(good)
            bad["clue"]["quantity"] = "999"
            bad_request = {"request_key": "stored-bad", "receipt_no": "R",
                           "document_target_corp": "SYNCO", "equity_target_corp": "SYNCO"}
            bad_result = yearend_worker.process_followup(
                state, bad_request, archive_dir=archive_dir,
                stored_responses={"stored-bad": bad}, fetch_document=self._forbidden_fetch)
            self.assertNotEqual(bad_result["outcome"], "resolved_verified_hold")

    def test_worker_leaves_operating_ledgers_untouched(self):
        _, state, result = self.run_request(archive_present=True)
        self.assertEqual(result["outcome"], "resolved_verified_hold")
        self.assertEqual(state["indirect_observations"], {})
        self.assertEqual(state["direct_ratio_basis"], {})
        self.assertNotIn("00126380", state["holdings"])

    def test_real_nps_positive_original_is_unmeasured(self):
        if REAL_NPS_FIXTURE.is_file():
            self.skipTest("real NPS fixture supplied: measure separately")
        self.assertFalse(REAL_NPS_FIXTURE.is_file())
        # Synthetic success above never stands in for this measurement.


class CliWiringTests(unittest.TestCase):
    def test_cli_missing_resume_verified_idempotent(self):
        from scripts.foliotrace import run_yearend_followup
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state_path = root / "state.json"
            archive_dir = root / "archives"
            archive_dir.mkdir()
            out = root / "out"
            request_path = root / "req.json"
            request_path.write_text(json.dumps(
                {"request_key": "cli-nps", "receipt_no": "20260318001422",
                 "equity_target_corp": "KT&G", "document_target_corp": "KT&G"}))
            base = ["run_yearend_followup", "--state", str(state_path),
                    "--archive-dir", str(archive_dir), "--output-dir", str(out),
                    "--request", str(request_path)]
            with unittest.mock.patch.object(sys, "argv", base):
                self.assertEqual(run_yearend_followup.main(), 0)
            self.assertEqual(json.loads((out / "run-log.json").read_text())["outcomes"][0]["outcome"],
                             "missing_original")
            (archive_dir / "20260318001422.zip").write_bytes(
                worker_zip(worker_doc(NPS_DOC_ROWS, document_target="KT&G", notes=NPS_DOC_NOTES)))
            with unittest.mock.patch.object(sys, "argv", base):
                self.assertEqual(run_yearend_followup.main(), 0)
            self.assertEqual(json.loads((out / "run-log.json").read_text())["outcomes"][0]["outcome"],
                             "resolved_verified_hold")
            versions = len(folio.read_json(state_path)["yearend_comparison"]["KT&G"]["versions"])
            with unittest.mock.patch.object(sys, "argv", base):
                self.assertEqual(run_yearend_followup.main(), 0)
            summary = json.loads((out / "run-log.json").read_text())
            self.assertFalse(summary["outcomes"][0]["changed"])
            self.assertEqual(len(folio.read_json(state_path)["yearend_comparison"]["KT&G"]["versions"]),
                             versions)
            self.assertTrue((out / "evidence-candidates" / "cli-nps.json").is_file())
            self.assertTrue((out / "comparison.json").is_file())


class ExistingContractRegressionTests(unittest.TestCase):
    def test_register_evidence_contract_untouched(self):
        state = base_isolated_state()
        state["universe"]["00126380"] = {"corp_code": "00126380", "stock_code": "005930", "name": "X"}
        state["receipts"]["20260602000001"] = {"receipt_no": "20260602000001", "receipt_date": "2026-06-02",
                                               "corp_code": "00126380", "stock_code": "005930",
                                               "evidence": "dart_document"}
        fact = {"kind": "indirect_holding", "source_receipt_no": "20260602000001",
                "source_document_no": "1", "source_filing_date": "2026-06-02", "basis_date": "2026-06-01",
                "corp_code": "00126380", "filer_corp_code": "00126380", "stock_code": "005930",
                "security_kind": "common", "ownership_percent": "5.05", "quantity": "10",
                "numeric_kind": "exact", "source_file_sha256": "a" * 64, "source_row_sha256": "b" * 64,
                "source_row_offset": 0, "parser_version": "v", "ratio_denominator": "issued_shares",
                "holder_scope": "nps_only", "owner_identity": "nps_confirmed",
                "basis_kind": "yearend_shareholder_register",
                "source_status": "no_known_correction_or_withdrawal",
                "source_document_sha256": "a" * 64, "source_section_sha256": "b" * 64,
                "issuer_identity_sha256": "c" * 64, "verified_at": "2026-09-27T00:00:00Z"}
        with self.assertRaisesRegex(ValueError, "EVIDENCE_NOT_ACTUAL_HOLDING"):
            register_evidence(state, fact)
        good = dict(fact, basis_kind="explicit_actual_holding",
                    denominator_quantity="100", denominator_date="2026-06-02")
        with self.assertRaisesRegex(ValueError, "EVIDENCE_RATIO_BASIS"):
            register_evidence(state, good)

    def test_single_match_never_registers_obligation_date(self):
        state = base_isolated_state()
        before = copy.deepcopy(state["indirect_observations"])
        self.assertEqual(yearend.verify_citation_against_original("9133543", "9133543"),
                         "values_match_basis_unconfirmed")
        self.assertEqual(state["indirect_observations"], before)

    def test_dart_key_setup_incomplete_without_substitute(self):
        self.assertEqual(yearend.resolve_dart_key({})["status"], "setup_incomplete")
        self.assertEqual(yearend.resolve_dart_key({"TYPESAFE_API_KEY": "x" * 10})["status"],
                         "setup_incomplete")
        self.assertEqual(yearend.resolve_dart_key({"DART_API_KEY": "k"})["status"], "ready")

    def test_llm_double_flagged_and_stored_response_offline(self):
        double = yearend.TestDoubleAdapter({"is_nps_claim": True})
        self.assertTrue(double.is_test_double)
        response = double.propose_clue({"request_key": "q"})
        self.assertTrue(response["is_test_double"])
        self.assertIn("do_not_report_as_accuracy", response["status"])
        stored = yearend.StoredResponseAdapter({"q": {"clue": {"a": 1}}})
        self.assertEqual(stored.propose_clue({"request_key": "q"})["status"], "stored_response")
        self.assertEqual(stored.propose_clue({"request_key": "missing"})["status"],
                         "comparison_pending_hold")


if __name__ == "__main__":
    unittest.main()
