import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const lock = JSON.parse(await fs.readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
const productionPackages = Object.entries(lock.packages || {})
  .filter(([packagePath, metadata]) => packagePath.startsWith("node_modules/") && metadata?.dev !== true)
  .sort(([left], [right]) => left.localeCompare(right));

const sections = [
  "WORKLAZY TOOLS — THIRD-PARTY LICENSE BUNDLE",
  "",
  "Generated from package-lock.json and installed production packages.",
  "Worklazy-authored materials are NOT licensed by this file.",
  "",
  "RUNTIME-LOADED COMPONENTS",
  "Pyodide 0.29.4 — MPL-2.0 — https://github.com/pyodide/pyodide",
  "Tesseract language data — see the model's upstream notice and https://github.com/tesseract-ocr/tessdata",
  "ZetaOffice / LibreOffice browser build snapshot 2026-08-25 — MPL-2.0 — https://git.libreoffice.org/core/+/refs/heads/distro/allotropia/zeta-24-2",
  "LibreOffice source and license information — https://www.libreoffice.org/about-us/licenses/",
  "JSDoc legacy Word reader snapshot 821695a — 0BSD — https://github.com/Alpaq92/JSDoc",
];

for (const [packagePath, lockMetadata] of productionPackages) {
  const directory = path.join(projectRoot, packagePath);
  let metadata;
  try {
    metadata = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8"));
  } catch {
    continue;
  }

  const files = await fs.readdir(directory).catch(() => []);
  const noticeFiles = files
    .filter((name) => /^(licen[cs]e|copying|notice)(\..*)?$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  sections.push("", "=".repeat(78), `${metadata.name || packagePath.slice(13)} ${metadata.version || lockMetadata.version || ""}`.trim());
  sections.push(`Declared license: ${formatLicense(metadata.license || lockMetadata.license || "Not declared")}`);
  if (metadata.homepage) sections.push(`Homepage: ${metadata.homepage}`);
  if (!noticeFiles.length) {
    sections.push("No top-level license/notice text was present in the installed package. Consult the package source and metadata above.");
    continue;
  }
  for (const fileName of noticeFiles) {
    const content = await fs.readFile(path.join(directory, fileName), "utf8").catch(() => "");
    const normalized = content.replaceAll("\r\n", "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
    if (normalized) sections.push("", `--- ${fileName} ---`, normalized);
  }
}

const legalDirectory = path.join(projectRoot, "public", "legal");
await fs.mkdir(legalDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(legalDirectory, "third-party-licenses.txt"), `${sections.join("\n")}\n`),
  fs.copyFile(path.join(projectRoot, "LICENSE"), path.join(legalDirectory, "worklazy-license.txt")),
]);

function formatLicense(license) {
  if (typeof license === "string") return license;
  if (Array.isArray(license)) return license.map(formatLicense).join(" OR ");
  return JSON.stringify(license);
}
