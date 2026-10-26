import assert from "node:assert/strict";
import test from "node:test";
import { BlobReader, ZipReader } from "@zip.js/zip.js";
import { decodeLegacyName } from "../../src/features/folder-compare/zip.ts";

// A one-entry stored ZIP whose name bytes carry no UTF-8 flag (as Korean Windows writes them).
function legacyZip(name: Uint8Array, data: Uint8Array) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8); crc = (crc ^ 0xffffffff) >>> 0;
  const local = new Uint8Array(30 + name.length + data.length), l = new DataView(local.buffer);
  l.setUint32(0, 0x04034b50, true); l.setUint16(4, 10, true); l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
  local.set(name, 30); local.set(data, 30 + name.length);
  const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
  c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 10, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
  central.set(name, 46);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, 1, true); e.setUint16(10, 1, true); e.setUint32(12, central.length, true); e.setUint32(16, local.length, true);
  return new Blob([local, central, end]);
}

async function names(blob: Blob) {
  const reader = new ZipReader(new BlobReader(blob), { decodeText: decodeLegacyName });
  try { return (await reader.getEntries()).map((entry) => entry.filename); } finally { await reader.close(); }
}

test("ZIP names without the UTF-8 flag read as UTF-8, then CP949", async () => {
  const cp949 = new Uint8Array([0xba, 0xb8, 0xb0, 0xed, 0xbc, 0xad, 0x2e, 0x74, 0x78, 0x74]); // 보고서.txt
  assert.deepEqual(await names(legacyZip(cp949, new TextEncoder().encode("hi"))), ["보고서.txt"]);
  assert.deepEqual(await names(legacyZip(new TextEncoder().encode("보고서.txt"), new TextEncoder().encode("hi"))), ["보고서.txt"]);
  assert.deepEqual(await names(legacyZip(new TextEncoder().encode("plain.txt"), new TextEncoder().encode("hi"))), ["plain.txt"]);
  assert.equal(decodeLegacyName(new Uint8Array([0xff]), "cp437", "comment"), undefined);
});
