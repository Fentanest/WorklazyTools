import { JSDOM } from "jsdom";

let selectorDocument;
const nonblank = (value) => typeof value === "string" && value.trim().length > 0;
const everyEntry = (array, predicate) => Array.isArray(array) && array.length > 0 && Array.from(array).every(predicate);

function validSelector(value) {
  if (!nonblank(value)) return false;
  selectorDocument ??= new JSDOM("").window.document;
  try {
    selectorDocument.querySelector(value);
    return true;
  } catch {
    return false;
  }
}

// axe UnlabelledFrameSelector: CSS strings, or shadow paths of >=2 CSS strings.
function validTarget(target) {
  return everyEntry(target, (part) => typeof part === "string" ? validSelector(part)
    : Array.isArray(part) && part.length >= 2 && everyEntry(part, validSelector));
}

function assertNodeEvidence(node, context) {
  if (!node || !validTarget(node.target) || !everyEntry(node.reasons, nonblank)) {
    throw new Error(`Incomplete accessibility target or reason was discarded (blank or malformed): ${context}.`);
  }
}

function ruleCounts(rules, nodeCount, context) {
  if (!Array.isArray(rules)) throw new Error(`Missing accessibility collection evidence: ${context}.`);
  const counts = new Map();
  for (const rule of rules) {
    const count = rule && nodeCount(rule);
    if (!rule || !nonblank(rule.id) || counts.has(rule.id) || !Number.isSafeInteger(count) || count < 1) {
      throw new Error(`Invalid accessibility collection evidence: ${context}.`);
    }
    counts.set(rule.id, count);
  }
  return counts;
}

// Capture directly from axe BEFORE projection, ownership classification or pixel resolution.
// Never rebuild this receipt from the report being checked. Empty arrays are valid
// only when this independent collection record also says no rules were collected.
export function createAccessibilityReceipt(audit, pageId) {
  if (!nonblank(pageId)) throw new Error("Missing accessibility collection page id.");
  const collected = (rules, kind) => Object.freeze([...ruleCounts(rules,
    (rule) => Array.isArray(rule.nodes) ? rule.nodes.length : undefined, `${pageId}/${kind}`)]
    .map(([id, nodeCount]) => Object.freeze({ id, nodeCount })));
  return Object.freeze({ schemaVersion: 1, pageId,
    violations: collected(audit.violations, "violations"),
    incomplete: collected(audit.incomplete, "incomplete") });
}

export function assertAccessibilityEvidence(result) {
  const receipt = result.collectionReceipt;
  if (!receipt || receipt.schemaVersion !== 1 || receipt.pageId !== result.id) {
    throw new Error(`Missing or invalid accessibility collection receipt: ${result.id}.`);
  }
  const collectedViolations = ruleCounts(receipt.violations, (rule) => rule.nodeCount, `${result.id}/receipt/violations`);
  const collectedIncomplete = ruleCounts(receipt.incomplete, (rule) => rule.nodeCount, `${result.id}/receipt/incomplete`);
  const reportedViolations = ruleCounts(result.violations, (rule) => rule.nodes, `${result.id}/violations`);
  const reportedIncomplete = ruleCounts(result.incomplete,
    (rule) => Array.isArray(rule.nodes) ? rule.nodes.length : undefined, `${result.id}/incomplete`);
  for (const rule of result.incomplete) {
    for (const node of rule.nodes) assertNodeEvidence(node, `${result.id}/${rule.id}`);
  }
  if (result.resolvedIncomplete !== undefined && !Array.isArray(result.resolvedIncomplete)) {
    throw new Error(`Invalid resolved accessibility collection evidence: ${result.id}.`);
  }
  for (const node of result.resolvedIncomplete ?? []) {
    assertNodeEvidence(node, `${result.id}/resolved`);
    if (!nonblank(node.rule)) throw new Error(`Invalid resolved accessibility rule: ${result.id}.`);
    reportedIncomplete.set(node.rule, (reportedIncomplete.get(node.rule) ?? 0) + 1);
  }
  for (const [kind, collected, reported] of [
    ["violations", collectedViolations, reportedViolations],
    ["incomplete", collectedIncomplete, reportedIncomplete],
  ]) {
    if (collected.size !== reported.size || [...collected].some(([id, count]) => reported.get(id) !== count)) {
      throw new Error(`Accessibility collection receipt count mismatch: ${result.id}/${kind}.`);
    }
  }
}
