// Run in a fresh process: npm's Pyodide runtime is also the deployed runtime version.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadPyodide } from 'pyodide';
import { compareDocumentModels, diffText } from '../src/features/document-compare/documentComparison.ts';
import { serializeManifestForTracked } from '../src/features/document-compare/manifestWire.ts';

test('20,000 blank paragraphs per side complete the real Pyodide tracked pipeline', { timeout: 120_000 }, async (t) => {
  globalThis.worklazyDiffJson = (a, b) => JSON.stringify(diffText(a, b));
  globalThis.worklazyComparisonManifestJson = (a, b, formatting, tables, metadata) => JSON.stringify(
    compareDocumentModels('before', 'after', JSON.parse(a), JSON.parse(b), { formatting, tables, metadata }, 'en').manifest);
  globalThis.worklazyWireManifestJson = (a, b) => serializeManifestForTracked(
    compareDocumentModels('before', 'after', JSON.parse(a), JSON.parse(b), { formatting: true, tables: true, metadata: true }, 'en').manifest);
  const py = await loadPyodide();
  py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON', fs.readFileSync('src/features/word-compare/formatting-policy.json', 'utf8'));
  for (const name of ['compare', 'accept_revisions', 'tracked_docx']) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, 'utf8'));
  const heapBefore = py._module.HEAPU8.byteLength;
  const result = JSON.parse(py.runPython(String.raw`
import time
from js import worklazyWireManifestJson
n = 20000
def package(path):
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + '<w:p/>' * n + '<w:p><w:r><w:t>Stable anchor</w:t></w:r></w:p><w:sectPr/></w:body></w:document>')
package('/before.docx')
package('/after.docx')
started = time.perf_counter()
a = extract_document_model(open('/before.docx', 'rb').read(), True, True, 'en')
b = extract_document_model(open('/after.docx', 'rb').read(), True, True, 'en')
wire = worklazyWireManifestJson(a, b)
balance_seconds = []
original_balance = _balance_blank_paragraphs
def measured_balance(before, after, result):
    start = time.perf_counter()
    original_balance(before, after, result)
    balance_seconds.append(time.perf_counter() - start)
_balance_blank_paragraphs = measured_balance
generation_start = time.perf_counter()
try:
    generate_tracked_document('/before.docx', '/after.docx', '/out.docx', 'D02', True, True, True, wire)
finally:
    _balance_blank_paragraphs = original_balance
generation_seconds = time.perf_counter() - generation_start
pipeline_seconds = time.perf_counter() - started
accept_tracked_document('/out.docx', '/accepted.docx')
with zipfile.ZipFile('/out.docx') as z, zipfile.ZipFile('/accepted.docx') as accepted, zipfile.ZipFile('/after.docx') as after:
    assert z.testzip() is None
    root = ET.fromstring(z.read('word/document.xml'))
    paragraphs = root.findall(W + 'body/' + W + 'p')
    assert len(paragraphs) == n + 1
    assert not any(node.tag in (W+'ins', W+'del') for node in root.iter())
    # With identical inputs, Reject All is the same unchanged paragraph stream.
    expected = ET.fromstring(after.read('word/document.xml'))
    assert ET.tostring(root) == ET.tostring(expected)
    assert ET.tostring(ET.fromstring(accepted.read('word/document.xml'))) == ET.tostring(expected)
json.dumps({'n': n, 'paragraphs': len(paragraphs), 'balanceSeconds': balance_seconds, 'generationSeconds': generation_seconds,
            'pipelineSeconds': pipeline_seconds, 'inputBytes': len(open('/before.docx', 'rb').read())})
`));
  assert.equal(result.n, 20000);
  assert.equal(result.paragraphs, 20001);
  assert.equal(result.balanceSeconds.length, 1);
  const metrics = { ...result, runtime: py.version, heapBeforeBytes: heapBefore,
    heapAfterBytes: py._module.HEAPU8.byteLength, processPeakRssKiB: process.resourceUsage().maxRSS };
  t.diagnostic(JSON.stringify(metrics));
});
