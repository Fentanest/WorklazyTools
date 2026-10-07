import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";

const root = path.resolve(import.meta.dirname, "..");
const contract = JSON.parse(await fs.readFile(path.join(root, "scripts/markitdown-assets.json"), "utf8"));
const pyodideRoot = path.join(root, "node_modules/pyodide");
const installed = JSON.parse(await fs.readFile(path.join(pyodideRoot, "package.json"), "utf8"));
if (installed.version !== contract.pyodideVersion) throw new Error("MarkItDown Pyodide version mismatch");
const lock = JSON.parse(await fs.readFile(path.join(pyodideRoot, "pyodide-lock.json"), "utf8"));
const cache = path.join(root, ".cache/markitdown");
const output = path.join(root, "public/vendor/markitdown", contract.markitdownVersion);
const pyodideOutput = path.join(root, "public/vendor/pyodide", contract.pyodideVersion);
await fs.mkdir(cache, { recursive: true });
await fs.mkdir(output, { recursive: true });
await fs.mkdir(pyodideOutput, { recursive: true });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
async function pinnedFile(spec) {
  const file = path.join(cache, spec.file);
  let bytes;
  try { bytes = await fs.readFile(file); } catch { /* Cold build. */ }
  if (!bytes || sha(bytes) !== spec.sha256) {
    const response = await fetch(spec.url);
    if (!response.ok) throw new Error("MarkItDown asset download failed: " + spec.file);
    bytes = Buffer.from(await response.arrayBuffer());
    if (sha(bytes) !== spec.sha256) throw new Error("MarkItDown asset checksum mismatch: " + spec.file);
    await fs.writeFile(file, bytes);
  }
  if (spec.bytes && bytes.length !== spec.bytes) throw new Error("MarkItDown asset size mismatch: " + spec.file);
  return bytes;
}
const selected = new Set();
function include(name) {
  if (selected.has(name)) return;
  const entry = lock.packages[name];
  if (!entry) throw new Error("Missing Pyodide package: " + name);
  selected.add(name);
  for (const dependency of entry.depends) include(dependency);
}
contract.pyodidePackages.forEach(include);
const pyodideFiles = [];
const pyodideNotices = [];
for (const name of [...selected].sort()) {
  const entry = lock.packages[name];
  const bytes = await pinnedFile({ file: entry.file_name, sha256: entry.sha256,
    url: "https://cdn.jsdelivr.net/pyodide/v" + contract.pyodideVersion + "/full/" + entry.file_name });
  await fs.writeFile(path.join(pyodideOutput, entry.file_name), bytes);
  pyodideFiles.push({ name, version: entry.version, file: entry.file_name, bytes: bytes.length, sha256: sha(bytes) });
  const wheel = await JSZip.loadAsync(bytes);
  for (const file of Object.keys(wheel.files).sort()) {
    if (!wheel.files[file].dir && /(^|\/)(?:licen[cs]e|copying|notice)(?:[._-][^/]*)?$/i.test(file)) {
      pyodideNotices.push("\n## " + name + " " + entry.version + " / " + file + "\n\n" + await wheel.file(file).async("string") + "\n");
    }
  }
}
const bundle = new JSZip();
const upstream = [];
const fixedDate = new Date("2000-01-01T00:00:00Z");
for (const spec of contract.wheels) {
  const archive = await JSZip.loadAsync(await pinnedFile(spec));
  for (const name of Object.keys(archive.files).sort()) {
    const entry = archive.files[name];
    if (entry.dir) continue;
    if (name.startsWith("/") || name.split("/").includes("..") || name.includes("\\")) throw new Error("Unsafe wheel entry: " + name);
    // These reviewed pure wheels contain package files and dist-info only.
    if (name === "xlsxwriter-3.2.9.data/scripts/vba_extract.py") continue; // CLI only; no macro extraction in browser.
    if (["pdfminer_six-20260107.data/scripts/dumppdf.py", "pdfminer_six-20260107.data/scripts/pdf2txt.py"].includes(name)) continue; // CLI entry points.
    if (name.includes(".data/")) throw new Error("Unreviewed wheel data path: " + name);
    if (bundle.file(name)) throw new Error("Duplicate wheel entry: " + name);
    bundle.file(name, await entry.async("uint8array"), { date: fixedDate, createFolders: false });
  }
  upstream.push({ name: spec.name, version: spec.version, sha256: spec.sha256, url: spec.url });
}
const entryPath = "markitdown/__init__.py";
const original = await bundle.file(entryPath).async("string");
const eagerImport = "from ._markitdown import (\n    MarkItDown,\n    PRIORITY_SPECIFIC_FILE_FORMAT,\n    PRIORITY_GENERIC_FILE_FORMAT,\n)";
if (original.split(eagerImport).length !== 2) throw new Error("MarkItDown entry point changed; adapter review required");
const lazyImport = await fs.readFile(path.join(root, "scripts/markitdown-lazy-entry.py"), "utf8");
const adapted = original.replace(eagerImport, lazyImport.trimEnd());
bundle.file(entryPath, adapted, { date: fixedDate, createFolders: false });
const patch = { path: entryPath, originalSha256: sha(Buffer.from(original)), adaptedSha256: sha(Buffer.from(adapted)),
  reason: "Load official individual converters without importing the Magika-based dispatcher. Converter implementations are unchanged." };
const zip = await bundle.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
await fs.writeFile(path.join(output, "converters.zip"), zip);
const manifest = { version: contract.markitdownVersion, pyodideVersion: contract.pyodideVersion,
  pyodidePackages: contract.pyodidePackages, pyodideFiles, upstream, patch,
  bundle: { file: "converters.zip", bytes: zip.length, sha256: sha(zip) },
  limitations: ["Explicit DOCX/XLSX/XLS/PPTX/PDF converter selection", "No Magika classification", "No PDF image rendering, OCR, LLM, or network converters",
    "Selected Pyodide wheels are verified for these converters; this is not an installation of all upstream extras"] };
await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
let notices = "# Microsoft MarkItDown browser converter distribution\n\nMicrosoft MarkItDown " + contract.markitdownVersion
  + " (MIT), https://github.com/microsoft/markitdown\n\nOnly the package entry point is adapted for lazy loading; individual converter code is unmodified. The normal Magika dispatcher is not used.\n\n";
for (const name of Object.keys(bundle.files).sort().filter(n => /\.dist-info\/(?:licenses\/|LICEN[CS]E|COPYING|NOTICE)/i.test(n))) {
  notices += "\n## " + name + "\n\n" + await bundle.file(name).async("string") + "\n";
}
notices += "\n# Pyodide converter dependencies\n" + pyodideNotices.join("\n");
await fs.writeFile(path.join(output, "THIRD_PARTY_LICENSES.txt"), notices);
console.log("MarkItDown " + contract.markitdownVersion + ": " + pyodideFiles.length + " pinned Pyodide packages; converter bundle " + zip.length + " bytes.");
