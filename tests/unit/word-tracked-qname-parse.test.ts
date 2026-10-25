import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// _qname_safe_parse takes a fast path when every namespace declaration is on the root element; for
// every input it must leave the same tree (attribute order included), the same namespace
// registrations and the same error as the event-by-event parse it falls back to.
test("QName-safe parsing fast path matches the event-by-event parse", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import json
NS = {"w": WORD_NS, "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006", "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
      "wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing", "xsi": "http://www.w3.org/2001/XMLSchema-instance", "v": "urn:schemas-microsoft-com:vml"}
def decl(*names): return "".join(' xmlns:%s="%s"' % (name, NS[name]) for name in names)
body = '<w:body><w:p w14:paraId="1"><mc:AlternateContent><mc:Choice Requires="wp14"><w:r/></mc:Choice><mc:Fallback/></mc:AlternateContent></w:p><w:p mc:Ignorable="w14"><w:r><w:t xsi:type="w:CT_Text">x</w:t></w:r></w:p></w:body>'
samples = {
    "root declared": '<w:document' + decl("w", "mc", "w14", "wp14", "xsi") + ' mc:Ignorable="w14 wp14">' + body + '</w:document>',
    "nested declaration": '<w:document' + decl("w", "mc", "w14") + ' mc:Ignorable="w14"><w:body><w:p' + decl("wp14") + '><mc:AlternateContent><mc:Choice Requires="wp14"/></mc:AlternateContent></w:p></w:body></w:document>',
    "nested rebinding": '<w:document' + decl("w", "mc", "w14") + ' mc:Ignorable="w14"><w:body xmlns:w14="urn:other"><w:p mc:Ignorable="w14"/></w:body></w:document>',
    "undeclared prefix": '<w:document' + decl("w", "mc") + ' mc:Ignorable="w14"/>',
    "empty Requires": '<w:document' + decl("w", "mc") + '><mc:AlternateContent><mc:Choice Requires=" "/></mc:AlternateContent></w:document>',
    "two-word xsi:type": '<w:document' + decl("w", "xsi") + '><w:t xsi:type="w:a w:b"/></w:document>',
    "default namespace type": '<document xmlns="' + WORD_NS + '"' + decl("xsi") + '><t xsi:type="CT_Text"/></document>',
    "processing attributes": '<w:document' + decl("w", "mc", "w14") + ' mc:ProcessContent="w14:sdt" mc:PreserveElements="w14:x" mc:PreserveAttributes="w14:y" mc:MustUnderstand="w14"/>',
    "wltq input": '<w:document' + decl("w", "mc") + ' xmlns:wltq0="' + NS["w14"] + '" mc:Ignorable="wltq0"/>',
    "unicode prefix": '<문:document xmlns:문="' + WORD_NS + '"' + decl("mc") + ' mc:Ignorable="문"/>',
    "malformed": '<w:document' + decl("w", "mc") + ' mc:Ignorable="w"><w:body>',
    "malformed after bad Choice": '<w:document' + decl("w", "mc") + '><mc:Choice Requires=""/><w:body>',
}
initial = dict(ET._namespace_map)
def run(parse, data, register):
    ET._namespace_map.clear(); ET._namespace_map.update(initial)
    try:
        root = parse(data, register)
        outcome = ["ok", [[node.tag, list(node.attrib.items()), node.text, node.tail] for node in root.iter()]]
    except Exception as error:
        outcome = ["error", type(error).__name__, str(error) if isinstance(error, ValueError) and not isinstance(error, ET.ParseError) else ""]
    return outcome, sorted(ET._namespace_map.items())
mismatch, kinds = [], {}
for name, text in samples.items():
    for register in (True, False):
        data = text.encode("utf-8")
        fast, slow = run(_qname_safe_parse, data, register), run(_qname_safe_parse_events, data, register)
        if fast != slow: mismatch.append([name, register])
        kinds[name] = fast[0][0] if fast[0][0] == "ok" else fast[0][1] + ":" + fast[0][2]
fast_taken = {name: _qname_safe_parse_root_declared(samples[name].encode("utf-8"), False) is not None for name in ("root declared", "nested declaration", "malformed")}
ET._namespace_map.clear(); ET._namespace_map.update(initial)
json.dumps({"mismatch": mismatch, "kinds": kinds, "fast": fast_taken})
`) as string;
  const outcome = JSON.parse(result);
  assert.deepEqual(outcome.mismatch, []);
  assert.deepEqual(outcome.fast, { "root declared": true, "nested declaration": false, malformed: false });
  assert.equal(outcome.kinds["root declared"], "ok");
  assert.equal(outcome.kinds["undeclared prefix"], "ValueError:UNSUPPORTED_TRACKED_SOURCE_QNAME");
  assert.equal(outcome.kinds["empty Requires"], "ValueError:UNSUPPORTED_TRACKED_SOURCE_QNAME");
  assert.equal(outcome.kinds["two-word xsi:type"], "ValueError:UNSUPPORTED_TRACKED_SOURCE_QNAME");
  assert.match(outcome.kinds.malformed, /^ParseError/);
});
