import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

test("the opt-in local QA build blocks analytics, events, and AdSense without changing production defaults", () => {
  const gate = read("src/components/localQa.ts");
  const analytics = read("src/components/AnalyticsLoader.tsx");
  const adsense = read("src/components/AdSenseLoader.tsx");

  assert.match(gate, /import\.meta\.env\.VITE_LOCAL_QA === "1"/);
  assert.equal((analytics.match(/isLocalQaBuild/g) || []).length, 4);
  assert.equal((adsense.match(/isLocalQaBuild/g) || []).length, 2);
  assert.match(analytics, /isLocalQaBuild \|\| !initialized/);
  assert.match(adsense, /!import\.meta\.env\.PROD \|\| isLocalQaBuild \|\| consent !== "granted"/);
});
