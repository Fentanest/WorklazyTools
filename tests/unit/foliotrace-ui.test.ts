import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const pageSource = read("src/features/foliotrace/ui/FolioTracePage.tsx");
const cssSource = read("src/features/foliotrace/ui/foliotrace.css");
const contractsSource = read("src/features/foliotrace/contracts.ts");

test("FolioTrace UI reuses Sol's contract instead of inventing a competing one", () => {
  assert.match(pageSource, /export function FolioTracePage/);
  assert.match(pageSource, /export type \{ FolioTracePageProps \} from "\.\.\/contracts"/);
  assert.doesNotMatch(pageSource, /interface FolioTracePageProps|type FolioTracePageProps =/);
  assert.match(contractsSource, /FolioTracePageProps/);
});

test("FolioTrace page handles every view status without sample-data fallback", () => {
  for (const status of ["loading", "missing-import", "load-error", "schema-error", "ready"]) {
    assert.ok(pageSource.includes(`"${status}"`), `missing view status: ${status}`);
  }
  assert.match(pageSource, /stale/);
  assert.doesNotMatch(pageSource, /fetch\(|axios|DART_API_KEY|naver/i);
  assert.ok(!pageSource.includes("Math.random"), "must not invent sample values");
});

test("FolioTrace table keeps search/sort/filter/reset, string codes, tabular numbers", () => {
  assert.match(pageSource, /type="search"/);
  assert.match(pageSource, /setSortKey|setQuality|setQuery/);
  assert.match(pageSource, /resetFilters|Reset filters/);
  assert.match(pageSource, /<code className="foliotrace-code">\{h\.stockCode\}/);
  assert.doesNotMatch(pageSource, /Number\(h\.stockCode\)|parseInt\(h\.stockCode/);
  assert.ok(cssSource.includes("tabular-nums"), "numeric columns need tabular figures");
  assert.match(pageSource, /history\.length >= 2/);
  assert.match(pageSource, /renormalize|denominator/i);
});

test("FolioTrace detail reuses the shared Sheet and stays scoped/themed", () => {
  assert.match(pageSource, /from "\.\.\/\.\.\/\.\.\/components\/ui\/sheet"/);
  assert.match(pageSource, /<SheetContent side="right"/);
  assert.match(pageSource, /<SheetTitle>|<SheetDescription>/);
  const hexColors = cssSource.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
  assert.deepEqual(hexColors, [], `scoped CSS must use semantic tokens, found: ${hexColors.join(",")}`);
  assert.ok(cssSource.includes("var(--wl-"), "scoped CSS must use --wl-* tokens");
  const selectors = cssSource.match(/\.[a-z][a-z0-9-]*/g) ?? [];
  const foreign = selectors.filter((s) => !s.startsWith(".foliotrace-"));
  assert.deepEqual(foreign, [], `CSS scope leak: ${foreign.join(",")}`);
});

test("FolioTrace copy ships Korean and English without touching shared locales", () => {
  assert.match(pageSource, /ko:\s*\{/);
  assert.match(pageSource, /en:\s*\{/);
  assert.ok(pageSource.includes("국민연금 전체 자산") || pageSource.includes("전체 자산"), "scope disclaimer (ko)");
  assert.ok(pageSource.includes("Not total NPS assets") || pageSource.includes("Not valuable"), "scope disclaimer (en)");
});
