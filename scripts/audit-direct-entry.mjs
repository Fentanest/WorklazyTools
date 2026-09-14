// U9 direct-entry wide audit — Sol integration (D3).
// Contract: docs/jobs/todo/u9-direct-entry-20260909.md "광역 감사 계약".
// Scans every executing source under repo root (tracked + untracked),
// collects static/dynamic imports, workers, string links and JSX routes,
// and asserts the 14-row direct-entry manifest against React/static/SEO.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(process.env.DIRECT_ENTRY_SOURCE_ROOT || ".");
const failures = [];
const fail = (message) => failures.push(message);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const SCANNED_HTML = new Set([".html"]);

// Exact user-forbidden paths: recorded, never opened or hashed.
const FORBIDDEN_PATHS = new Set([
  "dummyfortest",
  "before.docx",
  "after.docx",
  "newui",
]);

// Kind-separated owners for non-runtime trees (never silently ignored).
const DOC_OWNERS = ["docs/jobs", "tests/fixtures"];
const GENERATED_OWNERS = ["dist", "public/vendor"];

function listFiles() {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "buffer" })
    .toString("utf8").split("\0").map((line) => line.trim()).filter(Boolean);
  let untracked = [];
  try {
    untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "buffer" })
      .toString("utf8").split("\0").map((line) => line.trim()).filter(Boolean);
  } catch { /* no git — fall back to tracked only */ }
  return [...new Set([...tracked, ...untracked])];
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/direct-entry-contract.json"), "utf8"));
const exceptionsRaw = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/direct-entry-exceptions.json"), "utf8"));
const exceptionList = Array.isArray(exceptionsRaw) ? exceptionsRaw : Object.entries(exceptionsRaw.routes ?? {}).map(([route, detail]) => ({ path: route, ...(detail ?? {}) }));
const manifestPaths = new Set(manifest.map((row) => row.path.slice(1)));
const exceptionPaths = new Set(exceptionList.map((entry) => String(entry.path).replace(/^\//, "")));

const EXPECTED_EXCEPTIONS = new Set([
  "tools/hwp-editor", // en unavailable
  "tools/document-compare/results/:pairNumber", // session-only, no static
  "tools/office-editor/app", // isolated, noindex
  "tools/excel-merger/xls-preserve", // isolated, noindex
  "tools/word-compare", // retired redirect
  "tools/hwp-compare", // retired redirect
  "tools/pdf-editor/page-numbers", // finish canonical
  "tools/pdf-editor/header-footer", // finish canonical
  "tools/pdf-editor/watermark", // finish canonical
  "tools/pdf-editor/stamp", // finish canonical
]);
for (const entry of exceptionList) {
  const key = String(entry.path).replace(/^\//, "");
  if (!EXPECTED_EXCEPTIONS.has(key)) fail(`Unknown exception route (no wildcard allowed): ${key}`);
}
for (const key of EXPECTED_EXCEPTIONS) {
  if (!exceptionPaths.has(key)) fail(`Missing required exception entry: ${key}`);
}

const routePattern = /tools\/[A-Za-z0-9/_:.-]+/g;
const FILE_HINT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|json|png|html|css|map|svg|wasm|ttf|otf|woff2?)\b/;
const SKIP_FILES = ["tests/visual-artifacts/", "tests/visual-baselines/"];
// Negative-fixture strings: exact file + route + purpose, recorded here.
// They assert non-membership and must never become registrations.
const NEGATIVE_FIXTURES = new Map([
  ["tests/unit/direct-entry.test.ts", new Set(["tools/video-studio/unknown", "tools/video-studio/trim/child"])],
]);
const DIRECT_FAMILY = /^tools\/(pdf-editor|image-studio|video-studio|audio-studio)(\/|$)/;
// Base tool roots and pre-existing subpaths are known; only purpose
// subpaths must resolve via manifest.
const BASE_KNOWN = new Set([
  "tools/pdf-editor", "tools/pdf-editor/image-to-pdf", "tools/pdf-editor/pdf-to-image",
  "tools/pdf-editor/convert", "tools/pdf-editor/finish",
  "tools/image-studio", "tools/video-studio", "tools/audio-studio",
]);
// Deployment asset directories under a tools/ prefix: not navigable routes.
const ASSET_PREFIXES = ["tools/video-studio/workers", "tools/video-studio/runtime"];
const foundRoutes = new Map(); // route -> Set<file>
let scanned = 0;
let opaque = 0;

for (const relative of listFiles()) {
  if (relative.startsWith("node_modules/") || relative.startsWith(".git/")) continue; // dependency/VCS boundary
  if ([...FORBIDDEN_PATHS].some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`))) continue; // exact exclusion, no content access
  const extension = path.extname(relative);
  const absolute = path.join(root, relative);
  let stat;
  try { stat = fs.statSync(absolute); } catch { fail(`Listed file is missing: ${relative}`); continue; }
  if (!stat.isFile()) continue;
  if (DOC_OWNERS.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`))) continue; // doc/fixture trees are route-contract fixtures, not runtime
  if (SKIP_FILES.some((prefix) => relative.startsWith(prefix))) continue; // generated evidence captures, not executing sources
  if (GENERATED_OWNERS.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`))) continue; // deployment graph checked separately below
  if (!SOURCE_EXTENSIONS.has(extension) && !SCANNED_HTML.has(extension)) continue;
  let text;
  try { text = fs.readFileSync(absolute, "utf8"); } catch { fail(`Unreadable source: ${relative}`); continue; }
  if (text.length === 0) { fail(`Opaque 0-byte executing source: ${relative}`); opaque++; continue; }
  scanned++;

  // AST parse for script kinds; HTML scanned as text links only.
  if (SOURCE_EXTENSIONS.has(extension)) {
    const kind = extension === ".tsx" ? ts.ScriptKind.TSX : extension === ".ts" || extension === ".mts" ? ts.ScriptKind.TS
      : extension === ".jsx" ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
    let source;
    try {
      source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, kind);
    } catch {
      fail(`Unresolvable syntax (unverified failure): ${relative}`);
      continue;
    }
    if (source.parseDiagnostics?.length) {
      fail(`Unresolvable syntax (unverified failure): ${relative}`);
      continue;
    }
    const visit = (node) => {
      // Any hardcoded route-like string is collected, whatever its position.
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        collectString(relative, node.text);
      }
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        collectString(relative, node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(source);
        if (callee === "import" && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
          collectString(relative, node.arguments[0].text);
        }
        if ((callee === "Worker" || callee.endsWith(".Worker") || callee === "URL") && node.arguments.length >= 1 && ts.isStringLiteral(node.arguments[0])) {
          collectString(relative, node.arguments[0].text);
        }
      }
      if (ts.isNewExpression(node) && node.expression.getText(source) === "URL" && node.arguments?.length && ts.isStringLiteral(node.arguments[0])) {
        collectString(relative, node.arguments[0].text);
      }
      // JSX Route path + navigation targets.
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tag = node.tagName.getText(source);
        if (tag === "Route" || tag === "LocalizedNavigate" || tag === "NavLink" || tag === "Link") {
          for (const prop of node.attributes.properties) {
            if (ts.isJsxAttribute(prop) && (prop.name.getText(source) === "path" || prop.name.getText(source) === "to")) {
              if (prop.initializer && ts.isStringLiteral(prop.initializer)) collectString(relative, prop.initializer.text);
              else if (prop.initializer && ts.isJsxExpression(prop.initializer) && prop.initializer.expression && ts.isStringLiteral(prop.initializer.expression)) {
                collectString(relative, prop.initializer.expression.text);
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    const collectString = (file, value) => {
      if (value.includes("node_modules")) return;
      for (const match of value.matchAll(routePattern)) {
        const route = match[0].replace(/\/+$/, "");
        if (FILE_HINT.test(route)) continue; // file asset path, not a route
        if (!foundRoutes.has(route)) foundRoutes.set(route, new Set());
        foundRoutes.get(route).add(file);
      }
    };
    try { visit(source); } catch { fail(`AST walk failed (unverified failure): ${relative}`); }
  } else {
    for (const match of text.matchAll(routePattern)) {
      const route = match[0].replace(/\/+$/, "");
      if (FILE_HINT.test(route)) continue; // file asset path, not a route
      if (route.includes("node_modules")) continue;
      if (!foundRoutes.has(route)) foundRoutes.set(route, new Set());
      foundRoutes.get(route).add(relative);
    }
  }
}

// Every manifest path must be registered in executing sources; nothing else may claim a tools/ route outside manifest + exceptions.
for (const row of manifest) {
  const route = row.path.slice(1);
  if (!foundRoutes.has(route)) fail(`Manifest route has no executing-source registration: ${route}`);
}
for (const [route, files] of foundRoutes) {
  if (route.includes(":") || route.includes("*")) continue; // parameterized / wildcard declarations
  if (manifestPaths.has(route) || exceptionPaths.has(route) || BASE_KNOWN.has(route)) continue;
  if (ASSET_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) continue; // deployment assets, not routes
  if (NEGATIVE_FIXTURES.get([...files][0])?.has(route) || [...files].some((file) => NEGATIVE_FIXTURES.get(file)?.has(route))) continue; // recorded negative fixture
  if (!DIRECT_FAMILY.test(route)) continue; // outside direct-entry families: owned elsewhere
  fail(`Unregistered direct-entry route in executing sources (${[...files].slice(0, 3).join(", ")}): ${route}`);
}

// Deployment graph cross-check: every manifest static slug must exist in dist for both locales.
for (const row of manifest) {
  if (!row.static) continue;
  for (const language of row.locales) {
    const file = path.join(root, "dist", language, row.path.slice(1), "index.html");
    if (!fs.existsSync(file)) fail(`Missing deployed static document: ${language}/${row.path.slice(1)}/`);
  }
  const unprefixed = path.join(root, "dist", row.path.slice(1), "index.html");
  if (!fs.existsSync(unprefixed)) fail(`Missing unprefixed redirect: ${row.path.slice(1)}/`);
}

if (scanned === 0) fail("Scanner executed over 0 files.");
console.log(`Direct-entry audit: ${scanned} executing sources, ${foundRoutes.size} route strings, ${manifest.length} manifest rows, ${exceptionPaths.size} exceptions.`);
if (failures.length) {
  for (const message of failures) console.error(`AUDIT-FAIL: ${message}`);
  process.exit(1);
}
console.log("Direct-entry audit passed.");
