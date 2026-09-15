// W0 theme static contract: every product HTML sets data-theme exactly once,
// before any module script, with native color-scheme support and a single
// theme-color meta. Usage: node tests/ui-theme-static.mjs --dist dist [--out out.json]
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const get = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const dist = path.resolve(get("--dist", "dist"));
const out = get("--out", undefined);

const EXCEPTIONS = new Map([
  ["vendor/rhwp-studio/0.8.6/index.html", "RHWP snapshot owner: upstream Studio entry"],
  ["vendor/rhwp-studio/0.8.6/print.html", "RHWP snapshot owner: upstream print document"],
  ["naver05161fb06bc9701a23cfc09ad5773578.html", "Publishing integration owner: exact Naver site verification payload"],
]);

const failures = [];
let checked = 0;
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    if (!entry.name.endsWith(".html")) continue;
    const relative = path.relative(dist, file).replaceAll(path.sep, "/");
    if (EXCEPTIONS.has(relative)) continue;
    const html = await fs.readFile(file, "utf8");
    checked++;
    const setters = html.match(/setAttribute\("data-theme"/g) ?? [];
    if (setters.length !== 1) failures.push(`${relative}: expected 1 data-theme setter, found ${setters.length}.`);
    const setterAt = html.indexOf('setAttribute("data-theme"');
    const firstModule = html.search(/<script[^>]*type="module"/);
    if (setterAt === -1 || (firstModule !== -1 && setterAt > firstModule)) {
      failures.push(`${relative}: theme init must run before the first module script.`);
    }
    const themeColors = html.match(/<meta name="theme-color"[^>]*>/g) ?? [];
    if (themeColors.length !== 1) failures.push(`${relative}: expected 1 theme-color meta, found ${themeColors.length}.`);
    if (/prefers-color-scheme/.test(html)) failures.push(`${relative}: must not gate theme-color on prefers-color-scheme.`);
    if (!/colorScheme/.test(html)) failures.push(`${relative}: theme init must set the native colorScheme.`);
  }
}
await walk(dist);
const report = { checked, failures };
if (out) await fs.writeFile(out, `${JSON.stringify(report, null, 1)}\n`);
if (failures.length) {
  for (const failure of failures) console.error(`THEME-STATIC-FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Theme static contract passed: ${checked} documents.`);
