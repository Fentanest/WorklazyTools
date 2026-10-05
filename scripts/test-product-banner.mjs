import { spawnSync } from "node:child_process";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export function assess(expected, observed, exitCode) {
  const seen = new Map();
  let invalid = new Set(expected).size !== expected.length || expected.length === 0;
  for (const item of observed) {
    if (seen.has(item.name) || !expected.includes(item.name)) invalid = true;
    seen.set(item.name, item.status);
  }
  const cases = expected.map((name) => ({ name, status: seen.get(name) || "NOT_RUN" }));
  const counts = { passed: 0, failed: 0, notRun: 0 };
  for (const item of cases) counts[item.status === "PASS" ? "passed" : item.status === "FAIL" ? "failed" : "notRun"]++;
  return { cases, ...counts, ok: !invalid && exitCode === 0 && counts.passed === expected.length };
}
export function validSuites(suites) {
  const required = ["unit", "render", "export", "ui", "t5b", "r3a", "r3b", "late-image", "matrix", "editor-repair"];
  return Array.isArray(suites) && required.every((id) => suites.filter((s) => s.id === id).length === 1)
    && new Set(suites.map((s) => s.id)).size === suites.length;
}

/** Print only declared synthetic case names and safe failure metadata, never raw TAP values. */
export function caseDiagnostics(cases, tap) {
  const failures = new Map(tap.split(/(?=^(?:# Subtest:|(?:not )?ok \d+ - |1\.\.))/m).flatMap((block) => {
    const name = block.match(/^not ok \d+ - (.+)\r?\n/u)?.[1];
    return name ? [[name, block]] : [];
  }));
  return cases.filter(({ status }) => status !== "PASS").map(({ name, status }) => {
    const block = failures.get(name) || "";
    const message = block.match(/^\s*error: (?:[|>][-+]?\r?\n[ \t]+)?['"]?((?:(?:locator|page|frame|browserContext)\.[a-zA-Z]+: )?(?:Timeout \d{1,9}ms exceeded\.|Test timeout of \d{1,9}ms exceeded\.|Target page, context or browser has been closed|Expected values to be strictly (?:deep-)?equal:|The expression evaluated to a falsy value:|Sample control did not settle in the viewport|Settled sample control is covered))/m)?.[1];
    const stack = block.split(/\n\s*stack:.*\n/u)[1] || block;
    const sampleFailure = block.match(/\b(?:Sample control did not settle in the viewport|Settled sample control is covered)\b/u)?.[0];
    return { case: name.slice(0, 256), status,
      errorType: block.match(/^\s*failureType: ['"]?(testCodeFailure|hookFailed|cancelledByParent|testTimeoutFailure|subtestsFailed)\b/m)?.[1] || "unavailable",
      location: stack.match(/\b(?:tests|src|scripts)\/[\w./-]+\.(?:mjs|tsx?|js):\d+(?::\d+)?/u)?.[0]?.slice(0, 160) || "unavailable",
      message: message?.slice(0, 160) || sampleFailure || "[message redacted or unavailable]" };
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const root = process.env.PB_JOB_ROOT;
  if (!root) throw new Error("PB_JOB_ROOT required");
  const ready = JSON.parse(await readFile(`${root}/build-ready.json`, "utf8"));
  for (const [name, hash] of Object.entries(ready.hashes)) {
    if (createHash("sha256").update(await readFile(`${ready.outDir}/assets/${name}`)).digest("hex") !== hash) throw new Error("Completed build changed");
  }
  const manifest = JSON.parse(await readFile("tests/product-banner/cases.json", "utf8"));
  if (!validSuites(manifest.suites)) throw new Error("Required suite missing or duplicated");
  await mkdir(`${root}/runs`, { recursive: true });
  // Persistent suites create unique profiles beneath this job-owned parent.
  await mkdir(`${root}/profiles`, { recursive: true });
  const run = await mkdtemp(`${root}/runs/core-`);
  const suites = [];
  for (const suite of manifest.suites) {
    const dir = `${run}/${suite.id}`;
    await mkdir(dir);
    const env = { ...process.env, PB_DIST: ready.outDir, PB_T5B_DIST: ready.outDir,
      PB_RENDER_SHOT_DIR: `${dir}/shots`, PB_RENDER_RESULT_PATH: `${dir}/geometry.json`,
      PB_T4_WORK_DIR: dir, PB_T4_SHOT_DIR: `${dir}/shots`, PB_T5_SHOT_DIR: `${dir}/shots`,
      PB_REPAIR_RESULT_DIR: dir, PB_T5B_SHOT_DIR: `${dir}/shots-${path.basename(run)}`, PB_R3A_SHOT_DIR: `${dir}/shots`,
      PB_LATE_RESULT_DIR: `${dir}/late`, PB_R3BFIX_ROOT: root,
      PB_R3BFIX_RUN: path.basename(run).toLowerCase(), PB_MATRIX_RESULT_DIR: dir, PB_IMAGE_ENGINE: "chromium" };
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test",
      "--test-reporter=tap", `--test-reporter-destination=${dir}/tap.log`,
      "--test-reporter=./tests/product-banner/case-reporter.mjs", "--test-reporter-destination=stdout", ...suite.files],
      { env, encoding: "utf8", timeout: suite.id === "matrix" ? 1200000 : 600000, maxBuffer: 8 * 1024 * 1024 });
    await writeFile(`${dir}/stdout.log`, result.stdout || "");
    await writeFile(`${dir}/outcomes.jsonl`, result.stdout || "");
    await writeFile(`${dir}/stderr.log`, result.stderr || "");
    const observed = (result.stdout || "").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const assessment = assess(suite.cases, observed, result.status);
    suites.push({ id: suite.id, exitCode: result.status, ...assessment });
    console.log(`${suite.id}: pass=${assessment.passed} fail=${assessment.failed} not_run=${assessment.notRun}`);
    if (!assessment.ok) {
      const tap = await readFile(`${dir}/tap.log`, "utf8").catch(() => "");
      for (const diagnostic of caseDiagnostics(assessment.cases, tap)) console.log(`  ${JSON.stringify(diagnostic)}`);
    }
  }
  const totals = suites.reduce((sum, s) => ({ passed: sum.passed + s.passed, failed: sum.failed + s.failed, notRun: sum.notRun + s.notRun }), { passed: 0, failed: 0, notRun: 0 });
  await writeFile(`${run}/RESULTS.json`, JSON.stringify({ scope: manifest.scope, suites, totals, deferred: manifest.deferred }, null, 2));
  console.log(`# tests ${totals.passed + totals.failed}\n# pass ${totals.passed}\n# fail ${totals.failed}\n# not_run ${totals.notRun}\nresults ${run}`);
  process.exitCode = suites.every((s) => s.ok) ? 0 : 1;
}
