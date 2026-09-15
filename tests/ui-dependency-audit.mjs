// W4 dependency termination audit: Base UI and shadcn leave no execution
// import, CSS import, CLI residue, or package/lock/license trace. CVA stays
// (N4 keeps class-variance-authority). Static scan only, never ships to dist.
// Usage: node tests/ui-dependency-audit.mjs --out out.json
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex === -1 ? undefined : args[outIndex + 1];
const passed = [];

const EXECUTABLE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);

async function* walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "dist-qa" || entry.name === "dist-measure") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXECUTABLE_EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

const failures = [];
// Import-shaped references only: test assertion strings that name the removed
// packages (negative checks) must not trip the scan.
const baseUiImport = /(^|\s)(import|export)[^;]*?from\s*["']@base-ui\/|require\(\s*["']@base-ui\/|import\(\s*["']@base-ui\//;
const shadcnImport = /(^|\s)(import|export)[^;]*?from\s*["']shadcn["'/]|require\(\s*["']shadcn["'/]|import\(\s*["']shadcn["'/]/;
for await (const file of walk(repositoryRoot)) {
  const relative = path.relative(repositoryRoot, file);
  if (relative.startsWith(`tests${path.sep}fixtures`)) continue;
  const text = await fs.readFile(file, "utf8");
  for (const [index, line] of text.split("\n").entries()) {
    if (baseUiImport.test(line)) failures.push(`${relative}:${index + 1}: Base UI execution import`);
    if (shadcnImport.test(line)) failures.push(`${relative}:${index + 1}: shadcn execution import`);
  }
}
assert.equal(failures.length, 0, `removed-dependency imports remain:\n${failures.slice(0, 10).join("\n")}`);
passed.push("no Base UI/shadcn execution imports repo-wide");

// CSS + CLI residue.
const tailwindCss = await fs.readFile(path.join(repositoryRoot, "src/styles/tailwind.css"), "utf8");
assert.ok(!tailwindCss.includes("shadcn/tailwind.css"), "shadcn vendor CSS import remains");
assert.ok(tailwindCss.includes("@custom-variant data-checked") && tailwindCss.includes("@custom-variant data-unchecked")
  && tailwindCss.includes("@custom-variant data-disabled") && tailwindCss.includes("@custom-variant data-vertical"),
  "re-homed state variants are missing");
passed.push("shadcn CSS import replaced by re-homed state variants");
await fs.access(path.join(repositoryRoot, "components.json")).then(
  () => { throw new Error("components.json CLI residue remains"); },
  () => {},
);
passed.push("components.json CLI residue is gone");

// package.json + lock.
const packageJson = JSON.parse(await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"));
for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
  for (const name of ["@base-ui/react", "shadcn"]) {
    assert.ok(!(packageJson[section]?.[name]), `${name} remains in ${section}`);
  }
}
assert.ok(packageJson.dependencies?.["class-variance-authority"], "class-variance-authority must stay");
passed.push("package.json drops Base UI/shadcn and keeps CVA");
const lockText = await fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8");
assert.ok(!lockText.includes('"node_modules/@base-ui/react"'), "lock still lists @base-ui/react");
assert.ok(!lockText.includes('"node_modules/shadcn"'), "lock still lists shadcn");
passed.push("package-lock drops Base UI/shadcn");

// Installed tree + generated license.
await fs.access(path.join(repositoryRoot, "node_modules/@base-ui/react")).then(
  () => { throw new Error("node_modules/@base-ui/react is still installed"); },
  () => {},
);
await fs.access(path.join(repositoryRoot, "node_modules/shadcn")).then(
  () => { throw new Error("node_modules/shadcn is still installed"); },
  () => {},
);
passed.push("installed tree drops Base UI/shadcn");
const licenses = await fs.readFile(path.join(repositoryRoot, "public/legal/third-party-licenses.txt"), "utf8");
assert.ok(!/base-ui/i.test(licenses), "generated license still notices Base UI");
assert.ok(!/^shadcn /im.test(licenses), "generated license still notices shadcn");
passed.push("generated license drops Base UI/shadcn");

console.log(`Dependency audit passed: ${passed.length} checks.`);
if (out) await fs.writeFile(out, `${JSON.stringify({ passed }, null, 1)}\n`);
