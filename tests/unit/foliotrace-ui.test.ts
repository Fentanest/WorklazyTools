import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const pageSource = read("src/features/foliotrace/ui/FolioTracePage.tsx");
const holdingsSource = read("src/features/foliotrace/ui/holdings.ts");
const cssSource = read("src/features/foliotrace/ui/foliotrace.css");

test("FolioTrace UI reuses Sol's contract instead of inventing a competing one", () => {
  assert.match(pageSource, /export function FolioTracePage/);
  assert.match(pageSource, /export type \{ FolioTracePageProps \} from "\.\.\/contracts"/);
  assert.doesNotMatch(pageSource, /interface FolioTracePageProps|type FolioTracePageProps =/);
});

test("FolioTrace UI never fetches external data or fabricates sample finances", () => {
  for (const source of [pageSource, holdingsSource]) {
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|DART_API_KEY/i);
    assert.doesNotMatch(source, /naver|dart\.fss\.or\.kr/i);
    assert.ok(!source.includes("Math.random"), "must not invent sample values");
  }
});

test("Number conversion exists only inside the visual-only approxNumber", () => {
  const lines = holdingsSource.split("\n");
  const start = lines.findIndex((line) => line.includes("export function approxNumber"));
  assert.ok(start !== -1, "approxNumber must exist and stay the single Number gateway");
  const end = lines.findIndex((line, index) => index > start && line === "}");
  assert.ok(end !== -1);
  const offenders = lines.filter(
    (line, index) => /Number\(/.test(line) && (index < start || index > end),
  );
  assert.deepEqual(offenders, [], `Number() outside approxNumber: ${offenders.join(" / ")}`);
  assert.ok(
    holdingsSource.includes("never feed financial text"),
    "the visual-only restriction must be documented at the source",
  );
});

test("FolioTrace styles stay inside the owned scope", () => {
  const selectors = cssSource.match(/\.[a-z][a-z0-9-]*/g) ?? [];
  const foreign = selectors.filter((s) => !s.startsWith(".foliotrace-"));
  assert.deepEqual(foreign, [], `CSS scope leak: ${foreign.join(",")}`);
});
