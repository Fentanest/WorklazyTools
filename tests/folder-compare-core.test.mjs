import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { Admission, LIMITS, blobBytes, compareBytes, fileSource, pairEntries, pathIssue, FolderRun } from '../src/features/folder-compare/core.ts';
import { BoundedZipReader, zipSource } from '../src/features/folder-compare/zip.ts';
const signal = () => new AbortController().signal;
function entry(path, bytes, chunks = [bytes.length || 1], lateError = false) {
  return { id: path, rawPath: path, size: bytes.length, directory: false, open() {
    let offset = 0, index = 0;
    const reader = new ReadableStream({ pull(c) { if (offset === bytes.length) { c.close(); return; }
      const end = Math.min(bytes.length, offset + chunks[index++ % chunks.length]); c.enqueue(bytes.slice(offset, end)); offset = end;
    } }, { highWaterMark: 0 }).getReader();
    const done = lateError ? Promise.reject(new Error('CRC')) : Promise.resolve(); done.catch(() => {});
    return { reader, done, close: async () => { await reader.cancel(); reader.releaseLock(); } };
  } };
}
test('path policy rejects traversal, absolute, drive, backslash and NUL without rewriting', () => {
  for (const path of ['../a', '/a', 'C:a', 'a\\b', 'a\0b', 'a//b', './a']) assert.equal(pathIssue(path), 'unsafe-path');
  assert.equal(pathIssue(' a /é.txt'), undefined);
});
test('collision buckets retain duplicate identities and explicit normalization', () => {
  const a = entry('é', new Uint8Array()); const b = entry('e\u0301', new Uint8Array());
  assert.equal(pairEntries([a, a], [a])[0].pairing, 'ambiguous');
  assert.equal(pairEntries([a, b], []).length, 2);
  assert.equal(pairEntries([a, b], [], { nfc: true })[0].left.length, 2);
  assert.equal(pairEntries([entry('A', [])], [entry('a', [])]).length, 2);
});
test('independent stream boundaries and final-byte differences', async () => {
  const bytes = Uint8Array.from({ length: 200 }, (_, i) => i);
  assert.equal((await compareBytes(entry('a', bytes, [1, 7]), entry('b', bytes, [33]), signal())).equal, true);
  const changed = bytes.slice(); changed[199] = 0;
  assert.equal((await compareBytes(entry('a', bytes), entry('b', changed, [3]), signal())).equal, false);
  assert.equal((await compareBytes(entry('a', new Uint8Array()), entry('b', new Uint8Array()), signal())).equal, true);
  await assert.rejects(compareBytes(entry('a', bytes), entry('b', bytes, [8], true), signal()), /CRC/);
});
test('entire-job budget, archive allocation guard and slice reads', async () => {
  const admission = new Admission(); admission.add(LIMITS.entry); assert.throws(() => admission.add(LIMITS.entry + 1));
  const bounded = new BoundedZipReader(new Blob([new Uint8Array(20)]), signal());
  await assert.rejects(bounded.readUint8Array(0, LIMITS.allocation + 1), /allocation/);
  const file = new File([new Uint8Array(LIMITS.chunk + 2)], 'a');
  file.arrayBuffer = () => { throw new Error('whole-file read'); };
  const source = fileSource([file], 'r', new Admission());
  assert.equal((await compareBytes(source.entries[0], source.entries[0], signal())).equal, true);
});
async function archive(contents) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [name, bytes] of contents) await writer.add(name, new BlobReader(new Blob([bytes])));
  return writer.close();
}
test('ZIP compares bounded extraction against File bytes and drains CRC', async () => {
  const bytes = Uint8Array.from({ length: 150000 }, (_, i) => i % 251);
  const zip = await zipSource(await archive([['a', bytes]]), 'z', new Admission(), signal());
  try { assert.equal((await compareBytes(zip.entries[0], entry('a', bytes, [711]), signal())).equal, true); }
  finally { await zip.close(); }
});
test('cancel preserves completed rows, unfinished rows remain canceled', async () => {
  const one = entry('a', new Uint8Array([1])); const two = entry('b', new Uint8Array([2]));
  const rows = pairEntries([one, two], [one, two]); const run = new FolderRun();
  await run.compare(rows, () => { if (rows[0].content === 'equal') run.cancel(); });
  assert.equal(rows[0].content, 'equal'); assert.equal(rows[1].content, 'canceled');
});
test('ZIP late CRC corruption cannot become equal', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const blob = await archive([['a', bytes]]); const buffer = new Uint8Array(await blob.arrayBuffer());
  // Corrupt central CRC, preserving compressed content and metadata structure.
  const view = new DataView(buffer.buffer); let found = false;
  for (let i = 0; i < buffer.length - 20; i++) if (view.getUint32(i, true) === 0x02014b50) {
    view.setUint32(i + 16, 1234, true); found = true; break;
  }
  assert.equal(found, true);
  const zip = await zipSource(new Blob([buffer]), 'crc', new Admission(), signal());
  try { await assert.rejects(compareBytes(zip.entries[0], entry('a', bytes), signal())); }
  finally { await zip.close(); }
});
test('ZIP cancellation settles blocked extraction and cleanup', async () => {
  const bytes = new Uint8Array(500000); const controller = new AbortController();
  const zip = await zipSource(await archive([['a', bytes]]), 'cancel', new Admission(), signal());
  const opened = zip.entries[0].open(controller.signal);
  controller.abort();
  await opened.close(); await zip.close();
});
test('obsolete generation cannot publish completion', async () => {
  let release;
  const delayed = entry('a', new Uint8Array([1]));
  const original = delayed.open;
  delayed.open = s => { const opened = original(s); opened.done = new Promise(resolve => { release = resolve; }); return opened; };
  const rows = pairEntries([delayed], [entry('a', new Uint8Array([1]))]);
  const run = new FolderRun(); let updates = 0;
  const work = run.compare(rows, () => updates++);
  await new Promise(resolve => setTimeout(resolve, 0)); run.invalidate(); release(); await work;
  assert.equal(updates, 0); assert.equal(rows[0].content, 'pending');
});
