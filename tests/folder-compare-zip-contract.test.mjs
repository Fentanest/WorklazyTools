import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';
import { Admission, LIMITS, fileSource, pairEntries, compareBytes } from '../src/features/folder-compare/core.ts';
import { zipSource } from '../src/features/folder-compare/zip.ts';
const signal = () => new AbortController().signal;
function crc32(bytes) { let crc = -1; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
/** Independent tiny STORE fixture writer: headers stay deliberately editable. */
function archive(records) {
  const local = [], central = []; let offset = 0;
  for (const record of records) {
    const name = Buffer.from(record.name), localName = Buffer.from(record.localName ?? record.name), bytes = Buffer.from(record.bytes ?? []);
    const crc = crc32(bytes), size = record.size ?? bytes.length;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(record.flags ?? 0, 6);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(bytes.length, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(localName.length, 26);
    local.push(lh, localName, bytes);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50); ch.writeUInt16LE(0x0314, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(record.flags ?? 0, 8);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(bytes.length, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(((record.mode ?? 0o100644) * 65536) >>> 0, 38); ch.writeUInt32LE(record.offset ?? offset, 42);
    central.push(ch, name); offset += lh.length + localName.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(records.length, 8); end.writeUInt16LE(records.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return new Blob([...local, directory, end]);
}
const external = bytes => fileSource([new File([bytes], 'a')], 'external', new Admission()).entries[0];
test('duplicate raw ZIP paths remain distinct identities in ambiguous bucket', async () => {
  const source = await zipSource(archive([{ name: 'a' }, { name: 'a' }]), 'dup', new Admission(), signal());
  try { assert.equal(source.entries.length, 2); assert.notEqual(source.entries[0].id, source.entries[1].id);
    const row = pairEntries(source.entries, [external('')])[0]; assert.equal(row.pairing, 'ambiguous'); assert.equal(row.left.length, 2);
  } finally { await source.close(); }
});
test('symlink and encrypted ZIP records are explicitly unsupported and cannot open', async () => {
  const source = await zipSource(archive([{ name: 'link', mode: 0o120777 }, { name: 'secret', flags: 1 }]), 'unsupported', new Admission(), signal());
  try { assert.equal(source.entries[0].issue, 'symlink-unsupported'); assert.equal(source.entries[1].issue, 'encrypted-unsupported');
    for (const entry of source.entries) assert.throws(() => entry.open(signal()), /unsupported/);
  } finally { await source.close(); }
});
test('ZIP traversal, backslash, absolute, drive and NUL reject without sanitizing', async () => {
  for (const name of ['../a', '/a', 'C:/a', 'a\\b', 'a\0b']) {
    let source;
    try { source = await zipSource(archive([{ name }]), 'unsafe', new Admission(), signal());
      assert.equal(source.entries[0].rawPath, name); assert.equal(source.entries[0].issue, 'unsafe-path');
      assert.throws(() => source.entries[0].open(signal()));
    } catch (error) { if (error?.code === 'ERR_ASSERTION') throw error; }
    finally { if (source) await source.close(); }
  }
});
test('forged expanded size and mismatched local header never yield byte equality', async () => {
  for (const record of [{ name: 'a', bytes: 'payload', size: 1 }, { name: 'a', localName: 'b', bytes: 'payload' }]) {
    const source = await zipSource(archive([record]), 'lying', new Admission(), signal());
    try { await assert.rejects(compareBytes(source.entries[0], external('payload'), signal())); }
    finally { await source.close(); }
  }
});
test('central directory allocation is rejected before any oversized Blob slice', async () => {
  const blob = archive(Array.from({ length: 40000 }, (_, i) => ({ name: `f${String(i).padStart(7, '0')}` })));
  const slice = blob.slice.bind(blob); const sizes = [];
  blob.slice = (start, end, type) => { sizes.push(end - start); return slice(start, end, type); };
  await assert.rejects(zipSource(blob, 'large-dir', new Admission(), signal()), /allocation-limit/);
  assert(sizes.every(size => size <= LIMITS.allocation));
  const admission = new Admission(); for (let i = 0; i < 50000; i++) admission.add(0); assert.throws(() => admission.add(0), /folder-limit/);
});
test('genuine forced ZIP64 archive verifies under the same bounded reader', async () => {
  const writer = new ZipWriter(new BlobWriter(), { zip64: true, useWebWorkers: false });
  await writer.add('a', new BlobReader(new Blob(['zip64'])), { zip64: true });
  const source = await zipSource(await writer.close(), 'zip64', new Admission(), signal());
  try { assert.equal((await compareBytes(source.entries[0], external('zip64'), signal())).equal, true); }
  finally { await source.close(); }
});
test('overlapping central records cannot both obtain verified extraction', async () => {
  const source = await zipSource(archive([{ name: 'a', bytes: 'x' }, { name: 'a', bytes: 'x', offset: 0 }]), 'overlap', new Admission(), signal());
  try {
    assert.equal((await compareBytes(source.entries[0], external('x'), signal())).equal, true);
    await assert.rejects(compareBytes(source.entries[1], external('x'), signal()), /overlap/i);
  } finally { await source.close(); }
});
