import io
import zipfile
import unittest

from scripts.foliotrace.source_structure_probe import inspect


class SourceStructureProbeTests(unittest.TestCase):
    def test_extracts_only_bounded_nps_row_and_hash(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('filing.xml', '<DOC><TR><TD>국민연금관리공단</TD><TD>보통주</TD><TD>5.05%</TD></TR><P>2026-06-01</P></DOC>')
        result = inspect('20260602000001', buffer.getvalue())
        self.assertEqual(result['archive_status'], 'parsed')
        self.assertEqual(result['files'][0]['nps_rows'][0]['cells'], ['국민연금관리공단', '보통주', '5.05%'])
        self.assertIn('2026-06-01', result['files'][0]['date_tokens'])
        self.assertIn('2026-06-01', result['files'][0]['nps_rows'][0]['near_date_tokens'])
        self.assertNotIn('filing.xml', str(result))

    def test_status_xml_is_reported_without_raw_response(self):
        result = inspect('20260602000001', b'<result><status>020</status><secret>example</secret></result>')
        self.assertEqual(result['archive_status'], 'not_zip')
        self.assertNotIn('secret', str(result))
