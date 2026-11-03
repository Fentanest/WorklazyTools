import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPyodide } from 'pyodide';

test('character token styling scales with runs and emitted nodes cannot mutate snapshots', { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => '[]', worklazyComparisonManifestJson: () => '{}' });
  const py = await loadPyodide();
  for (const name of ['compare', 'accept_revisions', 'tracked_docx']) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, 'utf8'));
  assert.equal(py.runPython(String.raw`
paragraph = ET.fromstring('<w:p xmlns:w="' + WORD_NS + '"><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>' + '가😀abc ' * 2000 + '</w:t><w:tab/><w:br/></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>tail</w:t></w:r></w:p>')
source = ET.tostring(paragraph)
original_copy = copy.deepcopy
property_copies = [0]
def counted_copy(node, *args, **kwargs):
    if isinstance(node, ET.Element) and node.tag == W + 'rPr': property_copies[0] += 1
    return original_copy(node, *args, **kwargs)
copy.deepcopy = counted_copy
try: tokens = _styled_tokens(paragraph)
finally: copy.deepcopy = original_copy
assert ''.join(token['text'] for token in tokens) == '가😀abc ' * 2000 + '\t\ntail'
assert property_copies[0] <= 2, ('run property copy budget', property_copies[0])
assert ET.tostring(paragraph) == source
red = tokens[0]['properties']; italic = tokens[-1]['properties']
assert red is not italic and red.find(W + 'b') is not None and italic.find(W + 'i') is not None
emitted = _token_run('result', red)
emitted.find(W + 'rPr').find(W + 'color').set(W + 'val', '000000')
assert red.find(W + 'color').get(W + 'val') == 'FF0000'
paragraph[0].find(W + 'rPr').find(W + 'color').set(W + 'val', '00FF00')
assert red.find(W + 'color').get(W + 'val') == 'FF0000'
assert _styled_tokens(paragraph)[0]['properties'].find(W + 'color').get(W + 'val') == '00FF00'
# A later call takes a fresh snapshot; there is no process-wide cache.
assert _styled_tokens(paragraph)[0]['properties'] is not red
True
`), true);
});
