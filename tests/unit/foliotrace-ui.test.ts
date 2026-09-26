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
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|https?:\/\/|DART_API_KEY/i);
    assert.doesNotMatch(source, /dart\.fss\.or\.kr/i);
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
  const selectors = (cssSource.match(/^\s*\.[a-z][a-z0-9-]*/gm) ?? []).map((s) => s.trim());
  const foreign = selectors.filter((s) => !s.startsWith(".foliotrace-"));
  assert.deepEqual(foreign, [], `CSS scope leak: ${foreign.join(",")}`);
});

test("scoped CSS uses only production tokens or valid fallbacks", () => {
  // Production loads worklazy-theme.css, not theme.css: every --wl-*
  // reference must carry a literal fallback (only radius tokens remain).
  const bare = cssSource.match(/var\(--wl-(?!radius)[a-z-]*\)/g) ?? [];
  assert.deepEqual(bare, [], `unresolvable production tokens: ${bare.join(", ")}`);
  for (const token of ["--brand", "--bg-solid", "--label", "--label-secondary", "--separator"]) {
    assert.ok(cssSource.includes(token), `expected production token ${token}`);
  }
});

test("React page renders the shared FAQ entries visibly (FT-10)", () => {
  // The former failure: guide paragraphs existed but no FAQ was rendered
  // after React mount replaced the static fallback.
  assert.match(pageSource, /getFaqsForPath/);
  assert.match(pageSource, /<details key/);
  assert.match(pageSource, /<summary>\{entry\.question\}<\/summary>/);
  assert.match(cssSource, /\.foliotrace-faq/);
});

test("coverage cards show one concise summary with labeled expandable details", () => {
  assert.match(pageSource, /historicalCoverageDetails/);
  assert.match(pageSource, /indirectDetails/);
  assert.match(pageSource, /indirectSummary/);
  assert.match(pageSource, /foliotrace-coverage-details/);
  assert.match(cssSource, /\.foliotrace-coverage-details/);
  assert.match(cssSource, /\.foliotrace-history-coverage summary/);
  assert.match(cssSource, /\.foliotrace-indirect-clue summary/);
});

test("user-facing copy avoids raw pipeline jargon", () => {
  for (const banned of ["정적 JSON", "static JSON", "DART 배치",
    "DART batch", "미구현", "Unimplemented", "파싱 미완료", "security mapping",
    "이관(import", "data import is not complete"]) {
    assert.ok(!pageSource.includes(banned), `pipeline jargon on screen: ${banned}`);
    assert.ok(!holdingsSource.includes(banned), `pipeline jargon in labels: ${banned}`);
  }
});

test("long exact amounts wrap in cards/history; table keeps nowrap in its scroll container", () => {
  assert.match(
    cssSource,
    /\.foliotrace-summary-card \.foliotrace-summary-value\s*\{[^}]*white-space:\s*normal/,
  );
  assert.match(
    cssSource,
    /\.foliotrace-history \.foliotrace-num\s*\{[^}]*white-space:\s*normal/,
  );
  assert.match(cssSource, /\.foliotrace-num\s*\{[^}]*tabular-nums/);
  assert.match(cssSource, /\.foliotrace-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  // Long values prefer wrapping at group boundaries (<wbr/> adds no text).
  assert.match(pageSource, /<wbr key/);
});
