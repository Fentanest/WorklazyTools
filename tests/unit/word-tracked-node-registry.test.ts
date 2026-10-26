import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// The node registry replaces the per-node maps; every lookup must return what the maps returned,
// also after the trees change (a section gains references, a body's blocks are replaced) and when
// a part is registered again (Astra plan review: C).
test("node registry answers every lookup as the per-node maps did", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import json, random
random.seed(7)
def tree(depth, width):
    root = ET.Element(W + "document")
    level = [root]
    for level_index in range(depth):
        nxt = []
        for node in level:
            for _ in range(random.randint(1 if level_index < 3 else 0, width)):
                nxt.append(ET.SubElement(node, W + random.choice(("p", "r", "t", "tbl", "tr", "tc", "sectPr"))))
        level = nxt
    return root
registrations = [(tree(5, 4), "word/document.xml", "before"), (tree(6, 3), "word/document.xml", "after"),
                 (tree(3, 5), "word/header1.xml", "after"), (tree(2, 2), "word/document.xml", "after")]
# A node registered twice: the header's first child also hangs under the document.
registrations[1][0].append(registrations[2][0][0])
def register_all():
    for root, part, side in registrations:
        _register_manifest_root(root, part, side)
# The maps: plain dicts take the per-node path.
_MANIFEST_NODE_KEYS = {}; _MANIFEST_SOURCE_NODES = {}
register_all()
maps = (_MANIFEST_NODE_KEYS, _MANIFEST_SOURCE_NODES)
registry = _NodeRegistry(); _MANIFEST_NODE_KEYS = _NodeKeys(registry); _MANIFEST_SOURCE_NODES = _SourceNodes(registry)
register_all()
old_keys, old_nodes = maps
registered = [node for root, _, _ in registrations for node in root.iter()]
# The trees change after registration, as section references and block replacement do.
for root, _, _ in registrations:
    for node in list(root.iter())[:40]:
        node.insert(0, ET.Element(W + "headerReference"))
        if len(node) > 2: node.remove(node[-1])
nodes = registered + [node for root, _, _ in registrations for node in root.iter()] + [ET.Element(W + "p")]
node_mismatch = sum(1 for node in nodes if _MANIFEST_NODE_KEYS.get(node) != old_keys.get(node) or (node in _MANIFEST_NODE_KEYS) != (node in old_keys))
key_mismatch = sum(1 for key in old_nodes if _MANIFEST_SOURCE_NODES.get(key) is not old_nodes[key])
odd = [("after", ("word/document.xml", (True,))), ("after", ("word/document.xml", (1.0,))), ("after", ("word/document.xml", (-1,))),
       ("after", ("word/document.xml", (999,))), ("after", ("word/document.xml", ("0",))), ("after", ("word/document.xml", ())),
       ("after", ("word/missing.xml", ())), ("before", "word/document.xml"), ("after", ("word/document.xml", (0,), 1)), "x", None, 3,
       ("after", ("word/document.xml", (1.5,)))]
odd_mismatch = [repr(key) for key in odd if _MANIFEST_SOURCE_NODES.get(key) is not old_nodes.get(key) or (key in _MANIFEST_SOURCE_NODES) != (key in old_nodes)]
def error(call):
    try:
        call(); return None
    except Exception as failure:
        return type(failure).__name__
unhashable = [error(lambda: _MANIFEST_SOURCE_NODES.get(("after", ("word/document.xml", [0])))), error(lambda: old_nodes.get(("after", ("word/document.xml", [0]))))]
missing = [error(lambda: _MANIFEST_SOURCE_NODES[("after", ("word/document.xml", (999,)))]), error(lambda: _MANIFEST_NODE_KEYS[ET.Element("x")])]
json.dumps({"nodes": len(nodes), "keys": len(old_nodes), "nodeMismatch": node_mismatch, "keyMismatch": key_mismatch, "odd": odd_mismatch, "unhashable": unhashable, "missing": missing})
`) as string;
  const outcome = JSON.parse(result);
  assert.ok(outcome.keys > 200, `enough registered keys (${outcome.keys})`);
  assert.equal(outcome.nodeMismatch, 0);
  assert.equal(outcome.keyMismatch, 0);
  assert.deepEqual(outcome.odd, []);
  assert.deepEqual(outcome.unhashable, ["TypeError", "TypeError"]);
  assert.deepEqual(outcome.missing, ["KeyError", "KeyError"]);
});
