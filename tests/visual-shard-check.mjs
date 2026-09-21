// VISUAL_SHARD partition self-check (no browser needed).
//
// Builds the real capture matrix from the checked-in config and verifies
// the two-shard contract the procedure requires:
//   shard 1/2 holds ceil(N/2), shard 2/2 holds floor(N/2);
//   union == full set; intersection == 0; missing == 0; duplicates == 0.
//
// The runner imports its matrix and shard selection from
// tests/visual-regression-matrix.mjs, the same module used here, so a
// passing check constrains the actual shard executions.
import { visualRegressionConfig } from "./visual-regression.config.mjs";
import { buildCaptureMatrix, selectVisualShard } from "./visual-regression-matrix.mjs";

const full = buildCaptureMatrix(visualRegressionConfig.scenarios, visualRegressionConfig.viewports);
const first = selectVisualShard(full, { index: 1, total: 2 });
const second = selectVisualShard(full, { index: 2, total: 2 });

const total = full.length;
const expectedFirst = Math.ceil(total / 2);
const expectedSecond = Math.floor(total / 2);
const fullNames = full.map(({ name }) => name);
const firstNames = first.map(({ name }) => name);
const secondNames = second.map(({ name }) => name);
const firstSet = new Set(firstNames);
const secondSet = new Set(secondNames);
const union = new Set([...firstSet, ...secondSet]);
const intersection = [...firstSet].filter((name) => secondSet.has(name));
const missing = fullNames.filter((name) => !union.has(name));
const duplicates = (firstNames.length - firstSet.size) + (secondNames.length - secondSet.size);
// Determinism: the manifest order must rebuild identically, otherwise two
// shard runs could silently cover different sets.
const rebuiltNames = buildCaptureMatrix(visualRegressionConfig.scenarios, visualRegressionConfig.viewports).map(({ name }) => name);
const orderStable = rebuiltNames.length === fullNames.length && rebuiltNames.every((name, index) => name === fullNames[index]);

console.log(`VISUAL_SHARD partition check: N=${total}; shard1=${first.length} (expect ${expectedFirst}); shard2=${second.length} (expect ${expectedSecond}); union=${union.size}; intersection=${intersection.length}; missing=${missing.length}; duplicates=${duplicates}; orderStable=${orderStable}.`);

const violations = [];
if (first.length !== expectedFirst) violations.push(`shard 1/2 holds ${first.length}, expected ceil(N/2)=${expectedFirst}`);
if (second.length !== expectedSecond) violations.push(`shard 2/2 holds ${second.length}, expected floor(N/2)=${expectedSecond}`);
if (union.size !== total) violations.push(`union holds ${union.size} of ${total}`);
if (intersection.length !== 0) violations.push(`intersection is not empty: ${intersection.slice(0, 5).join(", ")}`);
if (missing.length !== 0) violations.push(`missing: ${missing.slice(0, 5).join(", ")}`);
if (duplicates !== 0) violations.push(`${duplicates} duplicates inside shards`);
if (!orderStable) violations.push("manifest order is not rebuild-stable");
if (violations.length > 0) {
  console.error(`VISUAL_SHARD contract violated:\n${violations.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("VISUAL_SHARD contract holds: union=full set, intersection=0, missing=0, duplicates=0.");
}
