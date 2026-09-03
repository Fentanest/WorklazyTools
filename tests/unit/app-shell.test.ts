import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const appShellSource = read("src/components/AppShell.tsx");

test("AppShell keeps SEO, analytics, ad isolation, navigation, and redirect ownership", () => {
  assert.match(appShellSource, /<RouteSeo \/>[\s\S]*?<VideoIsolationBoundary[\s\S]*?<OfficeIsolationBoundary[\s\S]*?<ExcelPreserveIsolationBoundary[\s\S]*?<AnalyticsLoader[\s\S]*?<AdSenseLoader \/>/);
  assert.match(appShellSource, /!videoStudioActive && !videoIsolationDocument && !officeEditorAppActive && !officeIsolationDocument && !excelPreserveActive && !excelIsolationDocument/);
  assert.match(appShellSource, /normalizedPath === "\/tools\/video-studio"/);
  assert.match(appShellSource, /normalizedPath === "\/tools\/office-editor\/app"/);
  assert.match(appShellSource, /normalizedPath === "\/tools\/excel-merger\/xls-preserve"/);
  assert.match(appShellSource, /target\.pathname = localizedPath\(language, "\/tools\/video-studio\/"\)/);
  assert.match(appShellSource, /target\.pathname = localizedPath\(language, "\/tools\/office-editor\/app\/"\)/);
  assert.match(appShellSource, /target\.pathname = localizedPath\(language, "\/tools\/excel-merger\/xls-preserve\/"\)/);
  assert.match(appShellSource, /<aside className="sidebar glass-panel"/);
  assert.match(appShellSource, /<nav className="bottom-tabs glass-bar"/);
});

test("AppShell delegates the mobile modal and focus trap to the shadcn Base UI sheet", () => {
  const sheetSource = read("src/components/ui/sheet.tsx");
  assert.match(sheetSource, /Dialog as SheetPrimitive/);
  assert.match(sheetSource, /<SheetOverlay className=\{overlayClassName\} \/>/);
  assert.match(appShellSource, /<Sheet open=\{mobileMenuOpen\} onOpenChange=\{setMobileMenuOpen\}/);
  assert.match(appShellSource, /<SheetTrigger[\s\S]*?id="mobile-navigation-trigger"/);
  assert.match(appShellSource, /<SheetContent[\s\S]*?side="bottom"[\s\S]*?overlayClassName="sheet-backdrop z-\[80\]"/);
  assert.match(appShellSource, /<SheetClose[\s\S]*?navigation\.close/);
  assert.doesNotMatch(appShellSource, /document\.addEventListener\("keydown"|event\.key === "Tab"/);
});

test("repo-wide executable ad references stay inside the explicit runtime and verification allowlist", () => {
  const trackedAndNew = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).split("\0").filter(Boolean);
  const executableExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
  const vendorPrefix = "public/vendor/"; // Generated third-party runtimes are owned by the pinned vendor scripts.
  const needles = [
    ["AdSense", "Loader"].join(""),
    ["data-worklazy", "-adsense"].join(""),
    ["pagead2.googlesyndication.com", "/pagead/js/adsbygoogle"].join(""),
  ];
  const matches = trackedAndNew
    .filter((relativePath) => executableExtensions.has(path.extname(relativePath)) && !relativePath.startsWith(vendorPrefix))
    .filter((relativePath) => needles.some((needle) => read(relativePath).includes(needle)))
    .sort();
  const allowlist = [
    "scripts/validate-static-output.mjs", // Owner: static isolation-page absence assertions.
    "src/components/AdSenseLoader.tsx", // Owner: the sole script creator.
    "src/components/AppShell.tsx", // Owner: the sole route-level render gate.
    "tests/excel-cleaner-smoke.mjs", // Owner: standard-route presence assertion.
    "tests/excel-compare-smoke.mjs", // Owner: standard-route presence assertion.
    "tests/new-tools-smoke.mjs", // Owner: video-isolation absence and request assertions.
    "tests/office-editor-smoke.mjs", // Owner: office-isolation absence assertion.
    "tests/unit/app-shell.test.ts", // Owner: this explicit repository-wide allowlist audit.
    "tests/utility-tools-smoke.mjs", // Owner: video-isolation absence and standard-route restoration assertions.
    "tests/xls-preserve-smoke.mjs", // Owner: XLS-isolation absence assertion.
  ].sort();
  assert.deepEqual(matches, allowlist);
});
