import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { BlobWriter } from "@zip.js/zip.js";
import { createIncrementalZipArchiveWriter } from "../src/utils/zipArchive.ts";
import { validateSafeZipEntryPath } from "../src/utils/fileNameSafety.ts";

export const unicodeZipFixture = Object.freeze([
  { name: "한글 결과.txt", text: "한글 본문과 English\n" },
  { name: "보고서/서울 매출.csv", text: "도시,매출\n서울,1234\n" },
  { name: "검사-😀.txt", text: "유니코드 이름 보존\n" },
]);

export async function compareUnicodeZips(directory) {
  await fs.mkdir(directory, { recursive: true });
  const writer = createIncrementalZipArchiveWriter(new BlobWriter("application/zip"));
  const jszip = new JSZip();
  for (const entry of unicodeZipFixture) {
    await writer.add(validateSafeZipEntryPath(entry.name), new Blob([entry.text]));
    jszip.file(entry.name, entry.text, { createFolders: false });
  }
  const archives = {
    zipjs: Buffer.from(await (await writer.close()).arrayBuffer()),
    jszip: await jszip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }),
  };
  const results = [];
  for (const [implementation, bytes] of Object.entries(archives)) {
    const filename = path.join(directory, `${implementation}.zip`);
    await fs.writeFile(filename, bytes);
    const listing = execFileSync("unzip", ["-l", filename], { encoding: "utf8", env: { ...process.env, LANG: "C.UTF-8" } });
    for (const { name } of unicodeZipFixture) assert.ok(listing.includes(name), `unzip lost ${name}`);
    const python = JSON.parse(execFileSync("python3", ["-c", [
      "import json, sys, zipfile",
      "with zipfile.ZipFile(sys.argv[1]) as archive:",
      " print(json.dumps([dict(name=i.filename, utf8=bool(i.flag_bits & 0x800), text=archive.read(i).decode('utf-8')) for i in archive.infolist()], ensure_ascii=False))",
    ].join("\n"), filename], { encoding: "utf8" }));
    assert.deepEqual(python, unicodeZipFixture.map(({ name, text }) => ({ name, text, utf8: true })));
    const zip64 = bytes.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
    assert.equal(zip64, implementation === "zipjs");
    results.push({ implementation, bytes: bytes.length, zip64, listing, python });
  }
  await fs.writeFile(path.join(directory, "comparison.json"), `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await compareUnicodeZips(process.env.ZIP_COMPARISON_OUTPUT || "/tmp/worklazy-zip-unicode"), null, 2));
}
