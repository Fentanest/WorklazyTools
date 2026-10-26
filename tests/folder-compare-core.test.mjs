import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobReader, BlobWriter, ZipWriter, ZipReader } from '@zip.js/zip.js';
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
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const turn = () => new Promise(resolve => setImmediate(resolve));
test('zero and partial fake Blob slices reject before EOF; true empty file stays equal', async () => {
  for (const actual of [0, 2, 4]) {
    let calls = 0;
    const blob = { size: 3, slice() { calls++; return { arrayBuffer: async () => new ArrayBuffer(actual) }; } };
    const source = { ...entry('short', new Uint8Array(3)), open: s => blobBytes(blob, s) };
    await assert.rejects(compareBytes(source, entry('ok', new Uint8Array(3)), signal()), /blob-short-read/);
    assert.equal(calls, 1);
  }
  const empty = { ...entry('empty', new Uint8Array()), open: s => blobBytes(new Blob(), s) };
  assert.equal((await compareBytes(empty, empty, signal())).equal, true);
});
test('replacement waits pending Blob read cleanup; superseded and canceled queues never open', async () => {
  const reading = deferred(), release = deferred(); let active = 0, peak = 0;
  const opens = [];
  const wrap = (path, blob) => ({ ...entry(path, new Uint8Array([1])), open(s) {
    opens.push(path); active++; peak = Math.max(peak, active); const bytes = blobBytes(blob, s);
    return { ...bytes, close: async () => { await bytes.close(); active--; } };
  } });
  const delayed = { size: 1, slice() { reading.resolve(); return { arrayBuffer: async () => { await release.promise; return new Uint8Array([1]).buffer; } }; } };
  const normal = new Blob([new Uint8Array([1])]);
  const run = new FolderRun(); let staleUpdates = 0;
  const rowsFor = (name, left = normal) => pairEntries([wrap(name, left)], [wrap(name, normal)]);
  const oldRows = rowsFor('old', delayed);
  const old = run.compare(oldRows, () => staleUpdates++); await reading.promise;
  const skipped = run.compare(rowsFor('superseded'), () => assert.fail('superseded publication'));
  const canceledRows = rowsFor('canceled'); const canceled = run.compare(canceledRows, () => {}); run.cancel();
  await turn(); assert.deepEqual(opens, ['old', 'old']); assert.equal(active, 2);
  release.resolve(); await Promise.all([old, skipped, canceled]);
  assert.equal(active, 0); assert.equal(staleUpdates, 0); assert.equal(canceledRows[0].content, 'canceled');
  const newestRows = rowsFor('newest'); await run.compare(newestRows, () => {});
  assert.equal(newestRows[0].content, 'equal'); assert.equal(active, 0); assert.equal(peak, 2);
  assert.deepEqual(opens, ['old', 'old', 'newest', 'newest']);
});
test('ZIP entry/source repeated close await delayed real extraction finalization', async () => {
  const original = ZipReader.prototype.getEntriesGenerator;
  const finishing = deferred(), release = deferred(); let finalized = false;
  ZipReader.prototype.getEntriesGenerator = async function* (...args) {
    for await (const item of original.apply(this, args)) {
      if (!item.directory) {
        const getData = item.getData.bind(item);
        item.getData = async (...dataArgs) => {
          try { return await getData(...dataArgs); }
          finally { finishing.resolve(); await release.promise; finalized = true; }
        };
      }
      yield item;
    }
  };
  let zip, opened;
  try {
    zip = await zipSource(await archive([['a', new Uint8Array([1, 2, 3])]]), 'finalize', new Admission(), signal());
    opened = zip.entries[0].open(signal());
    while (!(await opened.reader.read()).done) { /* Drain real ZIP to EOF. */ }
    await finishing.promise;
    let entryClosed = false, sourceClosed = false, doneSettled = false;
    opened.done.finally(() => { doneSettled = true; }).catch(() => {});
    const entryClose = opened.close().then(() => { entryClosed = true; });
    const repeatedEntryClose = opened.close();
    const sourceClose = zip.close().then(() => { sourceClosed = true; });
    const repeatedSourceClose = zip.close();
    await turn(); assert.equal(entryClosed, false); assert.equal(sourceClosed, false); assert.equal(finalized, false);
    release.resolve(); await Promise.all([entryClose, repeatedEntryClose, sourceClose, repeatedSourceClose]);
    assert.equal(finalized, true); assert.equal(doneSettled, true); await opened.done;
    assert.throws(() => zip.entries[0].open(signal()), /source-closed/);
  } finally {
    release.resolve(); if (opened) await opened.close(); if (zip) await zip.close();
    ZipReader.prototype.getEntriesGenerator = original;
  }
});
test('genuine ZIP versus ZIP reaches verified EOF and truncated archive rejects', async () => {
  const bytes = Uint8Array.from({ length: 180003 }, (_, i) => i % 239);
  const archiveA = await archive([['a', bytes]]); const archiveB = await archive([['a', bytes]]);
  const admission = new Admission();
  const a = await zipSource(archiveA, 'A', admission, signal());
  const b = await zipSource(archiveB, 'B', admission, signal());
  try { assert.deepEqual(await compareBytes(a.entries[0], b.entries[0], signal()), { equal: true, integrity: 'verified' }); }
  finally { await Promise.all([a.close(), b.close()]); }
  await assert.rejects(zipSource(archiveA.slice(0, archiveA.size - 10), 'truncated', new Admission(), signal()));
});
test('latest queued replacement opens only after obsolete Blob read releases ownership', async () => {
  const reading = deferred(), release = deferred(); const events = []; let active = 0, peak = 0;
  const make = (name, delayed = false) => ({ ...entry(name, new Uint8Array([1])), open(s) {
    events.push(`open:${name}`); active++; peak = Math.max(peak, active);
    const blob = delayed ? { size: 1, slice() { reading.resolve(); return { arrayBuffer: async () => {
      await release.promise; return new Uint8Array([1]).buffer;
    } }; } } : new Blob([new Uint8Array([1])]);
    const opened = blobBytes(blob, s);
    return { ...opened, close: async () => { await opened.close(); events.push(`close:${name}`); active--; } };
  } });
  const run = new FolderRun();
  const old = run.compare(pairEntries([make('old', true)], [make('old')]), () => assert.fail('old publication'));
  await reading.promise;
  const skipped = run.compare(pairEntries([make('skipped')], [make('skipped')]), () => assert.fail('skipped publication'));
  const rows = pairEntries([make('latest')], [make('latest')]);
  const latest = run.compare(rows, () => {});
  await turn(); assert.deepEqual(events, ['open:old', 'open:old']);
  release.resolve(); await Promise.all([old, skipped, latest]);
  assert.equal(rows[0].content, 'equal'); assert.equal(peak, 2); assert.equal(active, 0);
  assert.deepEqual(events.slice(0, 4), ['open:old', 'open:old', 'close:old', 'close:old']);
  assert.equal(events.includes('open:skipped'), false);
});
async function within(promise, milliseconds = 1000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('ownership cleanup timed out')), milliseconds);
  })]); } finally { clearTimeout(timer); }
}
test('source-only ZIP close cancels undrained owned reader and settles extraction', async () => {
  const zip = await zipSource(await archive([['a', new Uint8Array([1, 2, 3, 4, 5, 6, 7])]]), 'nodrain', new Admission(), signal());
  const opened = zip.entries[0].open(signal()); let doneSettled = false;
  await new Promise(resolve => setTimeout(resolve, 30));
  opened.done.finally(() => { doneSettled = true; }).catch(() => {});
  try {
    // No read() or entry close: source must own and unblock its backpressured entry.
    await within(zip.close());
    assert.equal(doneSettled, true);
    await assert.rejects(opened.reader.read(), /released|attached|reader/i);
    assert.throws(() => zip.entries[0].open(signal()), /source-closed/);
    await zip.close(); await opened.close();
  } finally { await opened.close(); await zip.close(); }
});
test('undrained ZIP source close and overlapping entry close await delayed extraction together', async () => {
  const original = ZipReader.prototype.getEntriesGenerator;
  const finishing = deferred(), release = deferred(); let finalized = false;
  ZipReader.prototype.getEntriesGenerator = async function* (...args) {
    for await (const item of original.apply(this, args)) {
      if (!item.directory) {
        const getData = item.getData.bind(item);
        item.getData = async (...dataArgs) => {
          try { return await getData(...dataArgs); }
          finally { finishing.resolve(); await release.promise; finalized = true; }
        };
      }
      yield item;
    }
  };
  let zip, opened;
  try {
    zip = await zipSource(await archive([['a', new Uint8Array([1, 2, 3])]]), 'nodrain-delay', new Admission(), signal());
    opened = zip.entries[0].open(signal());
    await new Promise(resolve => setTimeout(resolve, 30));
    let sourceClosed = false, entryClosed = false, doneSettled = false;
    opened.done.finally(() => { doneSettled = true; }).catch(() => {});
    const sourceClose = zip.close().then(() => { sourceClosed = true; });
    const repeatedSourceClose = zip.close();
    assert.throws(() => zip.entries[0].open(signal()), /source-closed/);
    // Source close must reach the extraction's finally without consumer demand.
    await within(finishing.promise);
    const entryClose = opened.close().then(() => { entryClosed = true; });
    await turn(); assert.equal(sourceClosed, false); assert.equal(entryClosed, false); assert.equal(doneSettled, false);
    release.resolve(); await within(Promise.all([sourceClose, repeatedSourceClose, entryClose, opened.close()]));
    assert.equal(finalized, true); assert.equal(doneSettled, true);
    assert.equal(sourceClosed, true); assert.equal(entryClosed, true);
  } finally {
    release.resolve(); if (opened) await opened.close(); if (zip) await zip.close();
    ZipReader.prototype.getEntriesGenerator = original;
  }
});
