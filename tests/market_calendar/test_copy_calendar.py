"""Fresh-dist recovery must use the deployed copy and verify all its bytes."""
import contextlib
import hashlib
from http.client import IncompleteRead
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('copy_calendar', 'scripts/copy-market-calendar.py')
calendar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(calendar)


class CopyCalendarTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.target = self.root / 'dist/data/market-calendar/v1'
        payload = b'[{"date":"20261119"}]'
        self.published = {'calendar-2026.json': payload, 'manifest.json': json.dumps({
            'schema_version': 1, 'files': [{'year': 2026, 'path': 'calendar-2026.json',
            'sha256': hashlib.sha256(payload).hexdigest()}]}).encode()}
        for name, data in self.published.items():
            (self.source / name).write_bytes(data)

    def prepare(self, published=None):
        available = self.published if published is None else published
        def download(name, limit):
            if name not in available:
                raise FileNotFoundError(name)
            return available[name]
        log = io.StringIO()
        with patch.object(calendar, 'download', side_effect=download) as request, contextlib.redirect_stderr(log):
            result = calendar.prepare_calendar(self.source, self.target)
        return result, request, log.getvalue()

    def assert_published(self):
        self.assertEqual({p.name: p.read_bytes() for p in self.target.iterdir()}, self.published)

    def test_verified_source_needs_no_fallback(self):
        result, request, log = self.prepare()
        self.assertEqual(result, 'copied')
        request.assert_not_called()
        self.assertEqual(log, '')
        self.assert_published()

    def test_hash_mismatch_restores_current_site_into_fresh_dist(self):
        (self.source / 'calendar-2026.json').write_bytes(b'corrupt')
        result, request, log = self.prepare()
        self.assertEqual(result, 'restored-published')
        self.assertEqual(request.call_count, 2)
        self.assertIn('hash mismatch', log)
        self.assert_published()

    def test_checkout_failure_restores_current_site(self):
        self.source = self.root / 'absent-checkout'
        result, _, log = self.prepare()
        self.assertEqual(result, 'restored-published')
        self.assertIn('copy failed', log)
        self.assert_published()

    def test_no_previous_publication_leaves_fresh_dist_without_data(self):
        self.source = self.root / 'absent-checkout'
        result, _, log = self.prepare({})
        self.assertEqual(result, 'unavailable')
        self.assertEqual(log.count('::warning::'), 2)
        self.assertFalse(self.target.exists())

    def test_corrupt_fallback_does_not_publish_partial_or_unverified_files(self):
        (self.source / 'calendar-2026.json').write_bytes(b'corrupt')
        fallback = dict(self.published, **{'calendar-2026.json': b'bad fallback'})
        result, _, log = self.prepare(fallback)
        self.assertEqual(result, 'unavailable')
        self.assertIn('Published market calendar unavailable', log)
        self.assertFalse(self.target.exists())

    def test_existing_copy_is_unchanged_if_both_inputs_fail(self):
        calendar.copy_calendar(self.source, self.target)
        (self.source / 'calendar-2026.json').write_bytes(b'corrupt')
        result, _, _ = self.prepare({})
        self.assertEqual(result, 'unavailable')
        self.assert_published()

    def test_fallback_path_traversal_is_rejected_before_file_download(self):
        self.source = self.root / 'absent-checkout'
        manifest = json.loads(self.published['manifest.json'])
        manifest['files'][0]['path'] = '../other.json'
        result, request, _ = self.prepare({'manifest.json': json.dumps(manifest).encode()})
        self.assertEqual(result, 'unavailable')
        self.assertEqual(request.call_count, 1)
        self.assertFalse(self.target.exists())

    def test_workflow_always_runs_recovery_after_optional_checkout(self):
        workflow = Path('.github/workflows/deploy-pages.yml').read_text()
        step = workflow.split('- name: Copy verified market calendar or restore deployed publication')[1].split('- name: Run unit tests')[0]
        self.assertIn('--fallback-published', step)
        self.assertNotIn('if:', step)
        self.assertNotIn('continue-on-error:', step)

    def test_interrupted_published_download_records_unavailable_without_failing_site(self):
        self.source = self.root / 'absent-checkout'
        with patch.object(calendar, 'download', side_effect=IncompleteRead(b'partial')), contextlib.redirect_stderr(io.StringIO()) as log:
            self.assertEqual(calendar.prepare_calendar(self.source, self.target), 'unavailable')
        self.assertIn('Published market calendar unavailable', log.getvalue())
        self.assertFalse(self.target.exists())


if __name__ == '__main__':
    unittest.main()
