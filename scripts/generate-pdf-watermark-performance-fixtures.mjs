import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, PDFName } from "pdf-lib";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "tests/fixtures/pdf-watermark-performance");
const definitions = [
  { id: "raw-1KiB-w1024", decodedBytes: 1024, width: 1024, compression: "raw" },
  { id: "raw-10KiB-w1024", decodedBytes: 10 * 1024, width: 1024, compression: "raw" },
  { id: "raw-64KiB-w1024", decodedBytes: 64 * 1024, width: 1024, compression: "raw" },
  { id: "raw-200KiB-w1024", decodedBytes: 200 * 1024, width: 1024, compression: "raw" },
  { id: "raw-1MiB-w1024", decodedBytes: 1024 * 1024, width: 1024, compression: "raw" },
  { id: "flate-1MiB-w8192", decodedBytes: 1024 * 1024, width: 8192, compression: "flate" },
  { id: "flate-4MiB-w8192", decodedBytes: 4 * 1024 * 1024, width: 8192, compression: "flate" },
  { id: "flate-8MiB-w8192", decodedBytes: 8 * 1024 * 1024, width: 8192, compression: "flate" },
  { id: "curve-16MiB-w8192", decodedBytes: 16 * 1024 * 1024, width: 8192, compression: "flate", curve: true },
  { id: "curve-32MiB-w8192", decodedBytes: 32 * 1024 * 1024, width: 8192, compression: "flate", curve: true },
  { id: "curve-64MiB-w8192", decodedBytes: 64 * 1024 * 1024, width: 8192, compression: "flate", curve: true },
  { id: "curve-128MiB-w8192", decodedBytes: 128 * 1024 * 1024, width: 8192, compression: "flate", curve: true },
];

await fs.mkdir(outputDirectory, { recursive: true });
const files = [];
for (const definition of definitions) {
  if (definition.decodedBytes % definition.width !== 0) throw new Error(`Non-integral fixture height: ${definition.id}`);
  const document = await PDFDocument.create({ updateMetadata: false });
  const page = document.addPage([400, 600]);
  const height = definition.decodedBytes / definition.width;
  const prefix = Buffer.from(`q\n320 0 0 320 40 140 cm\nBI /W ${definition.width} /H ${height} /BPC 8 /CS /G ID\n`, "latin1");
  const payload = Buffer.alloc(definition.decodedBytes, 0x29);
  const content = Buffer.concat([prefix, payload, Buffer.from("\nEI\nQ", "latin1")]);
  const stream = definition.compression === "flate" ? document.context.flateStream(content) : document.context.stream(content);
  page.node.set(PDFName.of("Contents"), document.context.register(stream));
  const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
  const fileName = `${definition.id}.pdf`;
  await fs.writeFile(path.join(outputDirectory, fileName), bytes);
  files.push({
    ...definition,
    height,
    file: fileName,
    inputBytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  });
}
await fs.writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`);
console.log(`PDF watermark performance fixtures generated: ${files.length}.`);
