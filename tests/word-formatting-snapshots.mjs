import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
const fixtures = JSON.parse(fs.readFileSync("tests/fixtures/document-compare/formatting-authority.json", "utf8")).fixtures;
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
py.globals.set("FORMAT_FIXTURES_JSON", JSON.stringify(fixtures));
py.runPython(fs.readFileSync("src/features/word-compare/compare.py", "utf8"));
py.runPython(String.raw`
rows = []
policy = json.loads(WORKLAZY_FORMATTING_POLICY_JSON)
for fixture in json.loads(FORMAT_FIXTURES_JSON):
    facts = []
    for xml in (fixture['beforeXml'], fixture['afterXml']):
        element = ET.fromstring('<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + xml + '</root>')[0]
        def tree(node):
            return {'name':node.tag,'attributes':dict(node.attrib),'text':node.text or '', 'children':[tree(child) for child in node]}
        property_name = element.tag.rsplit('}',1)[-1]
        facts.append(_normalized_property_fact(tree(element), property_name, policy))
    rows.append({'id':fixture['id'],'changed':facts[0]['supported'] != facts[1]['supported'], 'expected':fixture['expectAction']})
`);
const rows = py.globals.get("rows").toJs({ dict_converter: Object.fromEntries });
assert.equal(rows.length, 21);
for (const row of rows) assert.equal(row.changed, row.expected, row.id);
console.log(JSON.stringify({ sourceSnapshotFixtures: rows.length, namespaceToggleHistoryControls: true }));
