import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// The restore lookups are indexed per filter on first use; every case must end as the linear scan
// they replace did: same entries, same errors, a malformed entry outside the filter never raising
// (Astra R38).
test("tracked restore indexes match the linear scans they replace, errors included", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import json
PART = "word/document.xml"
def ref(*path): return {"part": PART, "path": list(path)}
def outcome(call):
    try:
        return ["ok", call()]
    except Exception as error:
        return ["error", type(error).__name__, str(error)]
def scan_pairs(name, origin):
    return [pair for pair in _MANIFEST["restorePropertyPairs"] if pair["property"] == name and _manifest_key(pair["before"]) == origin]
def scan_paired(origin):
    return [entry for decision in _MANIFEST_DECISIONS if decision.get("deletedFormattingPolicy") == "paired-revised" and decision["before"] and decision["after"] for entry in decision.get("wholeRestoreStyles", []) if _manifest_key(entry["before"]) == origin]
def install(pairs, decisions=()):
    _install_manifest({"version": 1, "decisions": list(decisions), "restorePropertyPairs": pairs, "options": {"formatting": False, "tables": True, "metadata": True},
                       "formattingMask": {key: {group: False for group in ("fontFamily", "size", "style", "color", "paragraph", "numbering")} for key in ("requested", "effective")}})
    _RESTORE_INDEX.clear()
source = ET.Element(W + "tc"); after = ET.Element(W + "tc"); ET.SubElement(after, W + "tcPr").set("marker", "after")
def restore(name):
    result = ET.Element(W + "tc")
    _restore_whole_properties(result, source, name, consume=False)
    return [child.get("marker") for child in result]
def compare(pairs, name):
    install(pairs)
    _MANIFEST_NODE_KEYS[source] = ("before", (PART, (0, 0)))
    _MANIFEST_SOURCE_NODES[("after", (PART, (0, 1)))] = after
    old = outcome(lambda: len(scan_pairs(name, (PART, (0, 0)))))
    _MANIFEST_KEY_CACHE.clear(); _RESTORE_INDEX.clear()
    first = outcome(lambda: restore(name)); again = outcome(lambda: restore(name))
    return {"scan": old, "first": first, "again": again}
good = {"property": "tcPr", "before": ref(0, 0), "after": ref(0, 1)}
cases = {
    "other property malformed": compare([{"property": "trPr", "before": ref(-1), "after": ref(0, 1)}, good], "tcPr"),
    "same property malformed": compare([good, {"property": "tcPr", "before": ref(-1), "after": ref(0, 1)}], "tcPr"),
    "duplicate": compare([good, dict(good)], "tcPr"),
    "none": compare([{"property": "trPr", "before": ref(0, 0), "after": ref(0, 1)}], "tcPr"),
    "unselected after malformed": compare([good, {"property": "tcPr", "before": ref(0, 5), "after": ref(-1)}], "tcPr"),
}
install([good]); _MANIFEST_NODE_KEYS.pop(source, None)
cases["no origin"] = {"first": outcome(lambda: restore("tcPr"))}
decisions = [
    {"id": "a", "before": [ref(0, 2)], "after": [ref(0, 3)], "deletedFormattingPolicy": "restore-before-unpaired", "wholeRestoreStyles": [{"before": ref(-1)}]},
    {"id": "b", "before": [ref(0, 2)], "after": [], "deletedFormattingPolicy": "paired-revised", "wholeRestoreStyles": [{"before": ref(-1)}]},
    {"id": "c", "before": [ref(0, 2)], "after": [ref(0, 3)], "deletedFormattingPolicy": "paired-revised", "wholeRestoreStyles": [{"before": ref(0, 2), "n": 1}, {"before": ref(0, 4), "n": 2}]},
]
install([], decisions)
paired = {"scan": [entry["n"] for entry in scan_paired((PART, (0, 2)))], "index": [entry["n"] for entry in _restore_index("paired-revised", lambda: (entry for decision in _MANIFEST_DECISIONS if decision.get("deletedFormattingPolicy") == "paired-revised" and decision["before"] and decision["after"] for entry in decision.get("wholeRestoreStyles", []))).get((PART, (0, 2)), [])]}
json.dumps({"cases": cases, "paired": paired})
`) as string;
  const { cases, paired } = JSON.parse(result);
  const sourceRef = ["error", "ValueError", "INVALID_COMPARISON_MANIFEST_SOURCE_REF"];
  const styleSource = ["error", "ValueError", "INVALID_COMPARISON_MANIFEST_STYLE_SOURCE"];
  assert.deepEqual(cases["other property malformed"], { scan: ["ok", 1], first: ["ok", ["after"]], again: ["ok", ["after"]] });
  assert.deepEqual(cases["same property malformed"], { scan: sourceRef, first: sourceRef, again: sourceRef });
  assert.deepEqual(cases.duplicate, { scan: ["ok", 2], first: styleSource, again: styleSource });
  assert.deepEqual(cases.none, { scan: ["ok", 0], first: ["ok", []], again: ["ok", []] });
  assert.deepEqual(cases["unselected after malformed"], { scan: ["ok", 1], first: ["ok", ["after"]], again: ["ok", ["after"]] });
  assert.deepEqual(cases["no origin"], { first: styleSource });
  assert.deepEqual(paired, { scan: [1], index: [1] });
});
