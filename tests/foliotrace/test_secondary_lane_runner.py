import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.foliotrace import run_secondary_lane


class SecondaryLaneRunnerTests(unittest.TestCase):
    def test_transport_code_sets_circuit_output_without_exposing_exception(self):
        class Result:
            returncode = 1
            stdout = ""
            stderr = '{"error":"SecondarySearchError","code":"SEARCH_TRANSPORT"}\n'

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            with patch.dict("os.environ", {"GITHUB_OUTPUT": str(output)}), patch.object(
                    run_secondary_lane.subprocess, "run", return_value=Result()):
                self.assertEqual(run_secondary_lane.main(), 1)
            self.assertEqual(output.read_text(), "site_transport=true\n")

    def test_other_error_does_not_trip_site_transport_circuit(self):
        class Result:
            returncode = 1
            stdout = ""
            stderr = '{"error":"SecondarySearchError","code":"PAGINATION_CHANGED"}\n'

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            with patch.dict("os.environ", {"GITHUB_OUTPUT": str(output)}), patch.object(
                    run_secondary_lane.subprocess, "run", return_value=Result()):
                self.assertEqual(run_secondary_lane.main(), 1)
            self.assertEqual(output.read_text(), "site_transport=false\n")
