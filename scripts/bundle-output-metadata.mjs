import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const OUTPUT_METADATA_SCHEMA = "vite-output-kind-and-bytes-v1";
const executable = (file) => /\.m?js$/.test(file);

// Module weights are captured before Rollup drops rendered module code. Output
// kind/bytes come from writeBundle, after every generateBundle hook completed.
export function moduleAttributionPlugin(outputPath) {
  let chunks;
  return {
    name: "worklazy-bundle-module-attribution",
    apply: "build",
    generateBundle(_options, bundle) {
      chunks = Object.values(bundle).filter((item) => item.type === "chunk").map((chunk) => ({
        file: chunk.fileName,
        modules: Object.entries(chunk.modules).map(([id, module]) => {
          const codeAvailable = typeof module.code === "string";
          const code = codeAvailable ? module.code : "";
          return {
            id, renderedLength: module.renderedLength,
            renderedGzip: code.length ? gzipSync(code).length : 0,
            renderedSha256: crypto.createHash("sha256").update(code).digest("hex"),
            codeAvailable,
          };
        }),
      }));
    },
    writeBundle(_options, bundle) {
      const outputs = Object.values(bundle).filter((item) => executable(item.fileName)).map((item) => {
        const bytes = Buffer.from(item.type === "chunk" ? item.code : item.source);
        return {
          file: item.fileName, kind: item.type, bytes: bytes.length,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          references: item.type === "chunk"
            ? [...new Set([...(item.referencedFiles ?? []), ...(item.viteMetadata?.importedAssets ?? [])])].sort()
            : [],
        };
      }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const serialized = `${JSON.stringify({ schema: OUTPUT_METADATA_SCHEMA, chunks, outputs })}\n`;
      fs.writeFileSync(outputPath, serialized);
      fs.writeFileSync(`${outputPath}.sha256`, `${crypto.createHash("sha256").update(serialized).digest("hex")}\n`);
    },
  };
}
