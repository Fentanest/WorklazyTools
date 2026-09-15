// W3 hero asset pipeline — fixed PNG inputs -> AVIF + WebP x 3 widths.
//
// Inputs (committed, user-provided si-an sources):
//   scripts/assets/hero-coral.png  (1672x941, transparent)
//   scripts/assets/hero-mint.png    (1672x941, transparent)
// Outputs (committed generated artifacts + manifest):
//   public/assets/hero/{coral,mint}-{480,960,1440}.{avif,webp}  (12 files)
//   scripts/assets/hero-manifest.json
//
// Encoder is pinned: ImageMagick 6.9.12-98 Q16 x86_64 (18038), WebP quality
// 82, AVIF quality 50, MAGICK_THREAD_LIMIT=1. Generate mode refuses to touch
// outputs when the encoder signature differs. --verify checks origin hash,
// output hash/count/byte budget only, so CI needs no encoder install.
//
// Usage:
//   node scripts/generate-hero-assets.mjs
//   node scripts/generate-hero-assets.mjs --verify
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = {
  coral: "scripts/assets/hero-coral.png",
  mint: "scripts/assets/hero-mint.png",
};
const WIDTHS = [480, 960, 1440];
const OUTPUT_DIR = "public/assets/hero";
const MANIFEST_PATH = "scripts/assets/hero-manifest.json";
const WEBP_QUALITY = "82";
const AVIF_QUALITY = "50";
const AVIF_MAX_BYTES = 50 * 1024;
const WEBP_MAX_BYTES = 160 * 1024;
const EXPECTED_ENCODER_CORE = "ImageMagick 6.9.12-98 Q16 x86_64 18038";

if (!process.env.MAGICK_THREAD_LIMIT) process.env.MAGICK_THREAD_LIMIT = "1";

function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd: root }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${file} ${args.join(" ")} failed: ${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function encoderSignature() {
  const out = await run("convert", ["-version"]);
  const raw = out.split("\n")[0].trim();
  // Raw form: "Version: ImageMagick 6.9.12-98 Q16 x86_64 18038 https://...".
  // The plan writes it as "ImageMagick 6.9.12-98 Q16 x86_64 (18038)"; compare
  // the core tokens so the URL suffix and paren notation cannot mismatch.
  const core = raw.replace(/^Version:\s*/, "").replace(/\s+https?:\S+$/, "").replace(" (18038)", " 18038").trim();
  return { raw, core };
}

async function identifyDimensions(relativePath) {
  const out = await run("identify", ["-format", "%w %h", path.join(root, relativePath)]);
  const [width, height] = out.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`cannot read dimensions of ${relativePath}`);
  return { width, height };
}

function outputName(family, width, codec) {
  return `${family}-${width}.${codec}`;
}

async function generate() {
  const { raw: signature, core } = await encoderSignature();
  if (core !== EXPECTED_ENCODER_CORE) {
    throw new Error(`encoder mismatch: got "${signature}", want core "${EXPECTED_ENCODER_CORE}". Outputs left untouched.`);
  }
  const manifest = {
    encoder: signature,
    magickThreadLimit: process.env.MAGICK_THREAD_LIMIT,
    webpQuality: WEBP_QUALITY,
    avifQuality: AVIF_QUALITY,
    budgets: { avifMaxBytes: AVIF_MAX_BYTES, webpMaxBytes: WEBP_MAX_BYTES },
    sources: {},
    outputs: [],
  };
  await fsp.mkdir(path.join(root, OUTPUT_DIR), { recursive: true });
  for (const [family, source] of Object.entries(SOURCES)) {
    const sourceAbs = path.join(root, source);
    const sourceBytes = await fsp.readFile(sourceAbs);
    const sourceDims = await identifyDimensions(source);
    manifest.sources[family] = {
      file: source,
      sha256: sha256Hex(sourceBytes),
      bytes: sourceBytes.length,
      ...sourceDims,
    };
    for (const width of WIDTHS) {
      for (const [codec, quality, budget] of [["webp", WEBP_QUALITY, WEBP_MAX_BYTES], ["avif", AVIF_QUALITY, AVIF_MAX_BYTES]]) {
        const name = outputName(family, width, codec);
        const relative = `${OUTPUT_DIR}/${name}`;
        const command = `convert ${source} -strip -resize ${width}x -quality ${quality} ${relative}`;
        await run("convert", [sourceAbs, "-strip", "-resize", `${width}x`, "-quality", quality, path.join(root, relative)]);
        const bytes = await fsp.readFile(path.join(root, relative));
        const dims = await identifyDimensions(relative);
        if (bytes.length > budget) {
          throw new Error(`${relative} is ${bytes.length}B, over the ${budget}B ${codec} budget. Outputs left partially written; fix quality/widths.`);
        }
        manifest.outputs.push({
          family, width, codec, file: relative,
          sha256: sha256Hex(bytes), bytes: bytes.length, ...dims, command,
        });
        console.log(`${relative} ${bytes.length}B ${dims.width}x${dims.height} ${sha256Hex(bytes).slice(0, 12)}`);
      }
    }
  }
  if (manifest.outputs.length !== 12) throw new Error(`expected 12 outputs, got ${manifest.outputs.length}`);
  await fsp.writeFile(path.join(root, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest: ${MANIFEST_PATH}`);
}

async function verify() {
  const raw = await fsp.readFile(path.join(root, MANIFEST_PATH), "utf8").catch(() => {
    throw new Error(`missing manifest ${MANIFEST_PATH}; run generate mode first.`);
  });
  const manifest = JSON.parse(raw);
  const failures = [];
  for (const [family, info] of Object.entries(manifest.sources ?? {})) {
    const actual = await fsp.readFile(path.join(root, info.file)).catch(() => null);
    if (!actual) failures.push(`source missing: ${info.file}`);
    else if (sha256Hex(actual) !== info.sha256) failures.push(`source hash changed: ${info.file} (${family})`);
  }
  const outputs = manifest.outputs ?? [];
  if (outputs.length !== 12) failures.push(`output count is ${outputs.length}, want 12`);
  for (const entry of outputs) {
    const budget = entry.codec === "avif" ? manifest.budgets.avifMaxBytes : manifest.budgets.webpMaxBytes;
    const actual = await fsp.readFile(path.join(root, entry.file)).catch(() => null);
    if (!actual) failures.push(`output missing: ${entry.file}`);
    else {
      if (sha256Hex(actual) !== entry.sha256) failures.push(`output hash changed: ${entry.file}`);
      if (actual.length > budget) failures.push(`output over budget: ${entry.file} ${actual.length}B > ${budget}B`);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`verify: ${failure}`);
    throw new Error(`hero asset verify failed with ${failures.length} problem(s).`);
  }
  console.log(`verify: 12/12 outputs hash+count+budget OK (encoder check not required).`);
}

const verifyOnly = process.argv.includes("--verify");
try {
  if (verifyOnly) await verify();
  else await generate();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
