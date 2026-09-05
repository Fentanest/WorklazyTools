import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postcss from "postcss";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesheetPath = path.join(repositoryRoot, "src", "styles", "global.css");

const runtimeSourceExtensions = new Set([
  ".cjs",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".ts",
  ".tsx",
]);

const generatedMarkupSources = Object.freeze([
  { path: "scripts/generate-static-pages.mjs", owner: "static page generator", purpose: "emits SEO fallback markup that consumes global CSS" },
]);

// These scopes are not product markup owners. Keep the exclusions explicit so a
// new product directory cannot silently become an orphan-scan wildcard.
const excludedScopes = Object.freeze([
  { path: ".git", owner: "Git", purpose: "repository metadata" },
  { path: "dist", owner: "build", purpose: "generated production output" },
  { path: "dist-measure", owner: "bundle:measure", purpose: "generated measurement output" },
  { path: "docs", owner: "project documentation", purpose: "documentation references do not consume runtime CSS" },
  { path: "node_modules", owner: "npm", purpose: "third-party dependencies" },
  { path: "public/vendor", owner: "vendoring scripts", purpose: "pinned third-party runtime snapshots" },
  { path: "scripts", owner: "build and verification tooling", purpose: "tool selectors do not consume product runtime CSS" },
  { path: "tests", owner: "test harness", purpose: "selectors and fixtures verify product markup but do not own it" },
]);

// Exact runtime-generated classes that cannot appear as complete literals in
// owned source. Every entry names its producer instead of allowing a prefix.
const generatedClassAllowlist = Object.freeze([
  { className: "accent-blue", owner: "AppShell", purpose: "accent-${tool.accent}" },
  { className: "accent-green", owner: "AppShell", purpose: "accent-${tool.accent}" },
  { className: "accent-orange", owner: "AppShell", purpose: "accent-${tool.accent}" },
  { className: "accent-pink", owner: "AppShell", purpose: "accent-${tool.accent}" },
  { className: "accent-sky", owner: "AppShell", purpose: "accent-${tool.accent}" },
  { className: "accent-violet", owner: "AppShell", purpose: "accent-${tool.accent}" },
  { className: "canvas-container", owner: "Fabric.js", purpose: "runtime canvas wrapper" },
  { className: "ui-accent-blue", owner: "ToolCard/OperationProgress/ResultCard", purpose: "ui-accent-${accent}" },
  { className: "ui-accent-green", owner: "ToolCard/OperationProgress/ResultCard", purpose: "ui-accent-${accent}" },
  { className: "ui-accent-orange", owner: "ToolCard/OperationProgress/ResultCard", purpose: "ui-accent-${accent}" },
  { className: "ui-accent-pink", owner: "ToolCard/OperationProgress/ResultCard", purpose: "ui-accent-${accent}" },
  { className: "ui-accent-sky", owner: "ToolCard/OperationProgress/ResultCard", purpose: "ui-accent-${accent}" },
  { className: "ui-accent-violet", owner: "ToolCard/OperationProgress/ResultCard", purpose: "ui-accent-${accent}" },
  { className: "ui-log-error", owner: "OperationProgress", purpose: "ui-log-${entry.status}" },
  { className: "ui-log-success", owner: "OperationProgress", purpose: "ui-log-${entry.status}" },
  { className: "ui-status-error", owner: "OperationProgress", purpose: "ui-status-${status}" },
  { className: "upper-canvas", owner: "Fabric.js", purpose: "runtime interaction canvas" },
]);

const excludedByPath = new Map(excludedScopes.map((entry) => [entry.path, entry]));
const allowedByClass = new Map(generatedClassAllowlist.map((entry) => [entry.className, entry]));
const stylesheet = fs.readFileSync(stylesheetPath, "utf8");
const root = postcss.parse(stylesheet, { from: stylesheetPath });
const sourceFiles = collectRuntimeSourceFiles(repositoryRoot);
const sources = sourceFiles.map((relativePath) => ({
  relativePath,
  text: fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
}));

const cssClassNames = new Set();
root.walkRules((rule) => {
  for (const match of rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) cssClassNames.add(match[1]);
});

const staleAllowlist = [...allowedByClass.keys()].filter((className) => !cssClassNames.has(className));
if (staleAllowlist.length) {
  throw new Error(`CSS orphan allowlist contains absent classes: ${staleAllowlist.join(", ")}`);
}

const zeroReferenceClasses = new Set([...cssClassNames].filter((className) => (
  !allowedByClass.has(className)
  && !sources.some(({ text }) => hasExactToken(text, className))
)));
const orphanSelectorArms = [];
root.walkRules((rule) => {
  for (const selector of splitSelectorList(rule.selector)) {
    const classNames = [...selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
    const orphanClasses = [...new Set(classNames.filter((className) => zeroReferenceClasses.has(className)))];
    if (orphanClasses.length) {
      orphanSelectorArms.push({
        line: rule.source.start.line,
        selector: selector.trim(),
        orphanClasses,
      });
    }
  }
});

console.log(`CSS orphan audit: ${cssClassNames.size} class tokens, ${sourceFiles.length} owned runtime source files.`);
console.log(`Explicit non-product scope exclusions: ${excludedScopes.length}.`);
for (const entry of excludedScopes) console.log(`  - ${entry.path}: ${entry.owner}; ${entry.purpose}`);
console.log(`Explicit generated-markup sources: ${generatedMarkupSources.length}.`);
for (const entry of generatedMarkupSources) console.log(`  - ${entry.path}: ${entry.owner}; ${entry.purpose}`);
console.log(`Explicit generated-class allowlist: ${generatedClassAllowlist.length}.`);
for (const entry of generatedClassAllowlist) console.log(`  - .${entry.className}: ${entry.owner}; ${entry.purpose}`);

if (orphanSelectorArms.length) {
  console.error(`Found ${zeroReferenceClasses.size} zero-reference classes across ${orphanSelectorArms.length} selector arms:`);
  for (const entry of orphanSelectorArms) {
    console.error(`  ${path.relative(repositoryRoot, stylesheetPath)}:${entry.line} ${entry.selector} [${entry.orphanClasses.join(", ")}]`);
  }
  process.exitCode = 1;
} else {
  console.log("CSS orphan audit passed: 0 zero-reference selector arms.");
}

function collectRuntimeSourceFiles(rootPath) {
  const files = [];
  visit(rootPath, "");
  for (const entry of generatedMarkupSources) files.push(entry.path);
  return files.sort();

  function visit(absoluteDirectory, relativeDirectory) {
    for (const directoryEntry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${directoryEntry.name}` : directoryEntry.name;
      if (isExcluded(relativePath)) continue;
      const absolutePath = path.join(absoluteDirectory, directoryEntry.name);
      if (directoryEntry.isDirectory()) visit(absolutePath, relativePath);
      else if (directoryEntry.isFile() && runtimeSourceExtensions.has(path.extname(directoryEntry.name))) files.push(relativePath);
    }
  }
}

function isExcluded(relativePath) {
  for (const excludedPath of excludedByPath.keys()) {
    if (relativePath === excludedPath || relativePath.startsWith(`${excludedPath}/`)) return true;
  }
  return false;
}

function hasExactToken(source, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^_a-zA-Z0-9-])${escaped}(?=$|[^_a-zA-Z0-9-])`, "m").test(source);
}

function splitSelectorList(selectorList) {
  const selectors = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  let quote = "";
  for (let index = 0; index < selectorList.length; index += 1) {
    const character = selectorList[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth -= 1;
    else if (character === "(") roundDepth += 1;
    else if (character === ")") roundDepth -= 1;
    else if (character === "," && squareDepth === 0 && roundDepth === 0) {
      selectors.push(selectorList.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(selectorList.slice(start));
  return selectors;
}
