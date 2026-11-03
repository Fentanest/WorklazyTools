import assert from "node:assert/strict";
import test from "node:test";
import { createAccessibilityReceipt } from "../accessibility-evidence.mjs";
import { assertAccessibilityResults, summarizeAccessibility } from "../accessibility-audit.mjs";

const registeredPages = [{ id: "evidence" }];
const node = () => ({ target: [".shared"], reasons: ["Needs manual review"], owner: "shared-existing" });
function collected({ resolved = false, zero = false } = {}) {
  // Independent raw axe input: the receipt is captured before the projection.
  const raw = { violations: [], incomplete: zero ? [] : [{ id: "color-contrast", nodes: [node()] }] };
  const collectionReceipt = createAccessibilityReceipt(raw, "evidence");
  return { id: "evidence", collectionReceipt, violations: [],
    incomplete: zero || resolved ? [] : structuredClone(raw.incomplete),
    ...(resolved ? { resolvedIncomplete: [{ ...node(), rule: "color-contrast", owner: "f2-watermark", resolution: "measured-pixel" }] } : {}) };
}
const summarize = (result) => summarizeAccessibility([result], registeredPages);

test("genuine collected zero passes after JSON roundtrip; a missing receipt never certifies zero", () => {
  const result = JSON.parse(JSON.stringify(collected({ zero: true })));
  assert.equal(summarize(result).incompleteNodes, 0);
  delete result.collectionReceipt;
  assert.throws(() => summarize(result), /collection receipt/);
});

for (const [kind, values] of [
  ["target", [[], [""], [" \t\n"], ".shared", [null], [42], [{}], [[""]], [[".host", " "]], [[".host", 1]], [[[".host", ".child"]]], ["["], [".shared", ""], Array(1)]],
  ["reasons", [[], [""], [" \t\n"], "Needs review", [null], [false], [1], [{}], [["Needs review"]], ["Needs review", ""], Array(1)]],
] as const) {
  for (const [index, value] of values.entries()) {
    for (const resolved of [false, true]) {
      test(`rejects malformed ${kind} case ${index}, resolved=${resolved}`, () => {
        const result = collected({ resolved });
        const evidence = resolved ? result.resolvedIncomplete[0] : result.incomplete[0].nodes[0];
        evidence[kind] = value;
        assert.throws(() => summarize(result), /target or reason was discarded/);
      });
    }
  }
}

test("axe frame and shadow CSS paths retain their nested shape and reasons", () => {
  const result = collected();
  result.incomplete[0].nodes[0].target = ["iframe[title='editor']", [".shadow-host", "button:nth-child(2):not([disabled])"]];
  assert.equal(summarize(result).inheritedIncompleteNodes, 1);
  assert.deepEqual(result.incomplete[0].nodes[0].reasons, ["Needs manual review"]);
});

test("receipt rejects dropped arrays, rules, nodes, rekeyed rules and redistributed counts", () => {
  for (const mutate of [
    (r) => { r.incomplete = []; },
    (r) => { delete r.incomplete; },
    (r) => { r.incomplete[0].nodes = []; },
    (r) => { r.incomplete[0].id = "label"; },
    (r) => { r.incomplete[0].nodes.push(node()); },
    (r) => { r.incomplete.push({ id: "label", nodes: [node()] }); },
    (r) => { r.incomplete.push(structuredClone(r.incomplete[0])); },
  ]) {
    const result = collected();
    mutate(result);
    assert.throws(() => summarize(result));
  }
  const result = collected();
  result.collectionReceipt = createAccessibilityReceipt({ violations: [], incomplete: [
    { id: "color-contrast", nodes: [node(), node()] }, { id: "label", nodes: [node()] },
  ] }, result.id);
  result.incomplete.push({ id: "label", nodes: [node(), node()] });
  assert.throws(() => summarize(result), /receipt count mismatch/);
});

test("receipt reconciles retained and pixel-resolved nodes without dropping fully resolved rules", () => {
  const result = collected({ resolved: true });
  assert.equal(summarize(result).pixelResolvedIncompleteNodes, 1);
  for (const bad of [[], null, {}, undefined]) {
    const changed = structuredClone(result);
    changed.resolvedIncomplete = bad;
    assert.throws(() => summarize(changed));
  }
  result.collectionReceipt = createAccessibilityReceipt({ violations: [], incomplete: [{ id: "color-contrast", nodes: [node(), node()] }] }, result.id);
  result.incomplete = [{ id: "color-contrast", nodes: [node()] }];
  const summary = summarize(result);
  assert.equal(summary.inheritedIncompleteNodes, 1);
  assert.equal(summary.pixelResolvedIncompleteNodes, 1);
  result.resolvedIncomplete[0].rule = "label";
  assert.throws(() => summarize(result), /receipt count mismatch/);
});

test("receipt schema, page identity and rule counts fail closed", () => {
  for (const mutate of [
    (r) => { r.collectionReceipt = null; },
    (r) => { r.collectionReceipt.schemaVersion = 2; },
    (r) => { r.collectionReceipt.pageId = "another-page"; },
    (r) => { delete r.collectionReceipt.incomplete; },
    (r) => { r.collectionReceipt.incomplete[0].nodeCount = -1; },
    (r) => { r.collectionReceipt.incomplete[0].nodeCount = 0; },
    (r) => { r.collectionReceipt.incomplete[0].nodeCount = "1"; },
    (r) => { r.collectionReceipt.incomplete[0].nodeCount = 1.5; },
    (r) => { r.collectionReceipt.incomplete[0].nodeCount = Number.MAX_SAFE_INTEGER + 1; },
    (r) => { r.collectionReceipt.incomplete[0].id = " "; },
    (r) => { r.collectionReceipt.incomplete.push(r.collectionReceipt.incomplete[0]); },
  ]) {
    const result = structuredClone(collected());
    mutate(result);
    assert.throws(() => summarize(result));
  }
});

test("collection requires real arrays and nonempty unique raw rules; receipt survives raw mutation", () => {
  for (const incomplete of [undefined, {}, [null], [{ id: " ", nodes: [node()] }], [{ id: "contrast", nodes: [] }],
    [{ id: "contrast", nodes: [node()] }, { id: "contrast", nodes: [node()] }]]) {
    assert.throws(() => createAccessibilityReceipt({ violations: [], incomplete }, "evidence"));
  }
  const raw = { violations: [], incomplete: [{ id: "contrast", nodes: [node()] }] };
  const receipt = createAccessibilityReceipt(raw, "evidence");
  raw.incomplete[0].nodes.length = 0;
  raw.incomplete.length = 0;
  assert.equal(receipt.incomplete[0].nodeCount, 1);
  assert.throws(() => { receipt.incomplete.length = 0; });
});

test("violations cannot disappear; their existing severity and limits semantics are preserved", () => {
  const result = collected({ zero: true });
  result.collectionReceipt = createAccessibilityReceipt({ violations: [{ id: "contrast", nodes: [{}, {}] }], incomplete: [] }, result.id);
  assert.throws(() => summarize(result), /receipt count mismatch/);
  result.violations = [{ id: "contrast", impact: "moderate", nodes: 2 }];
  const report = { results: [result], summary: { violations: 0 }, externalRequests: [] };
  assert.throws(() => assertAccessibilityResults(report, { registeredPages }), /limits exceeded/);
  assert.equal(assertAccessibilityResults(report, { registeredPages, limits: { critical: 0, serious: 0, total: 1 } }).violations, 1);
  result.violations[0].nodes = 1;
  assert.throws(() => summarize(result), /receipt count mismatch/);
});
