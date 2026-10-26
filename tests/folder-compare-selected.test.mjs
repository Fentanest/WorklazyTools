import test from 'node:test';
import assert from 'node:assert/strict';
import { Admission, fileSource, pairEntries } from '../src/features/folder-compare/core.ts';
import { ReadWork, materialize, renameCandidates } from '../src/features/folder-compare/selected.ts';
import { FolderOwner } from '../src/features/folder-compare/owner.ts';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { zipSource } from '../src/features/folder-compare/zip.ts';
import { DeepSession, compareSelected } from '../src/features/folder-compare/deep.ts';
const signal = () => new AbortController().signal;
const entries = (side, names) => fileSource(names.map(([name, value]) => new File([value], name)), side, new Admission()).entries;
test('verified rename groups retain many-to-many duplicate content without path reassignment', async () => {
  const left = entries('l', [['a', 'same'], ['b', 'same'], ['unmatched', 'different']]);
  const right = entries('r', [['c', 'same'], ['d', 'same'], ['other', 'distinct']]);
  const rows = pairEntries(left, right); const before = rows.map(r => [r.pairing, r.content]);
  const result = await renameCandidates(rows, new ReadWork(), signal());
  assert.equal(result.state, 'complete'); assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0], { left: [left[0].id, left[1].id], right: [right[0].id, right[1].id] });
  assert.deepEqual(rows.map(r => [r.pairing, r.content]), before); assert(result.readBytes > 0);
});
test('rename reread limits and abort are explicit; no unverified candidates escape', async () => {
  const rows = pairEntries(entries('l', [['a', 'same']]), entries('r', [['b', 'same']]));
  const result = await renameCandidates(rows, new ReadWork(1), signal()); assert.equal(result.state, 'limited'); assert.equal(result.groups.length, 0);
  const control = new AbortController(); control.abort(); assert.equal((await renameCandidates(rows, new ReadWork(), control.signal)).state, 'canceled');
});
test('selected materialization validates caps, EOF, cancellation and charges rereads only', async () => {
  const admission = new Admission(); const source = fileSource([new File(['hello'], 'path.txt')], 'r', admission); const work = new ReadWork();
  const file = await materialize(source.entries[0], 4 * 1024 ** 2, work, signal()); assert.equal(await file.text(), 'hello'); assert.equal(file.name, 'path.txt');
  assert.equal(work.bytes, 5); assert.equal(admission.logical, 5);
  await assert.rejects(materialize({ ...source.entries[0], size: 4 * 1024 ** 2 + 1 }, 4 * 1024 ** 2, work, signal()), /selected-limit/);
  await assert.rejects(materialize(source.entries[0], 5, work, signal()), /selected-limit/);
  const control = new AbortController(); control.abort(); await assert.rejects(materialize(source.entries[0], 4 * 1024 ** 2, work, control.signal));
});
test('owner resolves selected pairs by current side identity and rejects stale identities', async () => {
  const owner = new FolderOwner(); let view;
  try {
    await owner.compare(1, { kind: 'files', files: [new File(['a'], 'a')] }, { kind: 'files', files: [new File(['b'], 'a')] }, {}, value => { view = value; });
    const row = view.rows[0]; const files = await owner.selected(1, row.left[0].id, row.right[0].id, 4 * 1024 ** 2); assert.equal(await files[0].text(), 'a');
    await assert.rejects(owner.selected(1, row.right[0].id, row.left[0].id, 4 * 1024 ** 2), /stale-source/);
    await owner.clear(2); await assert.rejects(owner.selected(1, row.left[0].id, row.right[0].id, 4 * 1024 ** 2), /stale-source/);
  } finally { await owner.clear(3); }
});
test('deep ownership waits old read settlement; only latest queued consumer starts', async () => {
  const session = new DeepSession(); let release; const events = [];
  const old = session.run(async s => { events.push('old'); await new Promise(r => { release = r; }); s.throwIfAborted(); }); old.catch(() => {});
  await new Promise(r => setImmediate(r));
  const skipped = session.run(async () => events.push('skipped')); skipped.catch(() => {});
  const latest = session.run(async () => events.push('latest'));
  await new Promise(r => setImmediate(r)); assert.deepEqual(events, ['old']); release();
  await Promise.allSettled([old, skipped, latest]); assert.deepEqual(events, ['old', 'latest']); await session.clear();
});
test('deep tools enforce selected-pair budget before importing engines and Excel requires sheets', async () => {
  const huge = { size: 17 * 1024 ** 2 };
  await assert.rejects(compareSelected('pdf', [huge, huge], signal(), 'en'), /selected-limit/);
  await assert.rejects(compareSelected('excel', [new File([], 'a.xlsx'), new File([], 'b.xlsx')], signal(), 'en'), /sheet-selection/);
});
test('cleanup from an obsolete deep panel cannot cancel a newer owner job', async () => {
  const session = new DeepSession(); await session.run(async () => {}); const obsolete = session.currentId;
  let release; const next = session.run(async signal => { await new Promise(r => { release = r; }); signal.throwIfAborted(); return 'complete'; });
  await new Promise(r => setImmediate(r)); session.cancel(obsolete); release(); assert.equal(await next, 'complete');
});
test('reread budget preflight prevents starting extraction beyond remaining work', async () => {
  const entry = entries('l', [['a', 'hello']])[0]; let opened = false;
  const guarded = { ...entry, open(s) { opened = true; return entry.open(s); } };
  await assert.rejects(materialize(guarded, 4 * 1024 ** 2, new ReadWork(4), signal()), /reread-limit/); assert.equal(opened, false);
});
test('late genuine ZIP CRC failure blocks both selected files and rename evidence', async () => {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false }); await writer.add('a', new BlobReader(new Blob(['same'])));
  const bytes = new Uint8Array(await (await writer.close()).arrayBuffer()), view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 20; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 16, 123, true); break; }
  const source = await zipSource(new Blob([bytes]), 'bad', new Admission(), signal());
  try {
    await assert.rejects(materialize(source.entries[0], 4 * 1024 ** 2, new ReadWork(), signal()));
    const rows = pairEntries(source.entries, entries('right', [['b', 'same']]));
    const result = await renameCandidates(rows, new ReadWork(), signal()); assert.equal(result.groups.length, 0); assert.deepEqual(result.unreadable, [source.entries[0].id]);
  } finally { await source.close(); }
});
test('cleared owner cannot rename using retained obsolete File snapshots', async () => {
  const owner = new FolderOwner();
  await owner.compare(1, { kind: 'files', files: [new File(['x'], 'a')] }, { kind: 'files', files: [new File(['x'], 'b')] }, {}, () => {});
  await owner.clear(2); const result = await owner.renames(2); assert.deepEqual(result.groups, []); assert.equal(result.readBytes, 0); await owner.clear(3);
});
test('multi-chunk ZIP materialization preserves every selected byte after complete CRC verification', async () => {
  const bytes = Uint8Array.from({ length: 2 * 1024 ** 2 + 17 }, (_, i) => i % 251);
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false }); await writer.add('large.bin', new BlobReader(new Blob([bytes])));
  const source = await zipSource(await writer.close(), 'large', new Admission(), signal());
  try { const work = new ReadWork(); const file = await materialize(source.entries[0], 16 * 1024 ** 2, work, signal());
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes); assert.equal(work.bytes, bytes.length);
  } finally { await source.close(); }
});
