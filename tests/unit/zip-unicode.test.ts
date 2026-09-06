import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compareUnicodeZips } from "../zip-unicode-comparison.mjs";

test("production ZIP writer and JSZip preserve Korean filenames through unzip and Python zipfile", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "zip-unicode-unit-"));
  try {
    const results = await compareUnicodeZips(directory);
    assert.deepEqual(results.map(({ python }) => python), [results[0].python, results[0].python]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
