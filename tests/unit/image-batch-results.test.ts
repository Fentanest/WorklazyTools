import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
const temp = mkdtempSync(path.join(tmpdir(), 'w6-worker-'));
const target = path.join(temp, 'worker.mjs');
buildSync({ entryPoints: ['src/features/image-studio/image.worker.ts'], outfile: target, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const globals = globalThis as any;
const saved = { self: globals.self, OffscreenCanvas: globals.OffscreenCanvas, createImageBitmap: globals.createImageBitmap };
const messages: any[] = [];
let fallback = false, closed = 0, bitmapClosed = 0;
const worker = { postMessage: (value: any) => messages.push(structuredClone(value)), close: () => closed++, onmessage: null as any };
globals.self = worker;
globals.createImageBitmap = async () => ({ width: 80, height: 60, close: () => bitmapClosed++ });
globals.OffscreenCanvas = class {
  width: number; height: number;
  constructor(width: number, height: number) { this.width = width; this.height = height; }
  getContext() { return { clearRect() {}, fillRect() {}, drawImage() {}, save() {}, restore() {} }; }
  async convertToBlob({ type }: { type: string }) { return new Blob([`encoded-${this.width}x${this.height}`], { type: fallback ? 'image/png' : type }); }
};
await import(pathToFileURL(target).href);
after(() => { Object.assign(globals, saved); rmSync(temp, { recursive: true, force: true }); });
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const options = { mode: 'original', width: 80, height: 60, format: 'webp', quality: 0.9, background: 'transparent', watermarkText: '', watermarkPosition: 'center', watermarkOpacity: 0.7 };
for (const useFallback of [false, true]) test(`individual encoded Blobs equal ZIP entry bytes; PNG fallback=${useFallback}`, async () => {
  fallback = useFallback; messages.length = 0;
  await worker.onmessage({ data: { type: 'batch', inputs: ['one.png', 'two.png'].map(name => ({ name, mimeType: 'image/png', buffer: new ArrayBuffer(1) })), options, archiveName: 'batch.zip', language: 'en' } });
  const envelope = messages.at(-1); assert.equal(envelope.type, 'result', JSON.stringify(envelope));
  const result = envelope.result; assert.equal(result.mimeType, 'application/zip'); assert.equal(result.fileName, 'batch.zip');
  const zip = await JSZip.loadAsync(result.buffer); assert.equal(result.images.length, 2);
  for (const image of result.images) {
    assert.ok(image.blob instanceof Blob); assert.equal(image.size, image.blob.size);
    assert.equal(image.mimeType, useFallback ? 'image/png' : 'image/webp'); assert.equal(image.blob.type, image.mimeType);
    assert.ok(image.fileName.endsWith(useFallback ? '.png' : '.webp'));
    assert.equal(hash(new Uint8Array(await image.blob.arrayBuffer())), hash(await zip.file(image.fileName)!.async('uint8array')));
  }
});
test('empty batch emits only failure and closes without exposing partial results', async () => {
  messages.length = 0;
  await worker.onmessage({ data: { type: 'batch', inputs: [], options, archiveName: 'batch.zip' } });
  assert.equal(messages.at(-1).type, 'error'); assert.ok(!messages.some(value => value.type === 'result'));
  assert.equal(closed, 3); assert.equal(bitmapClosed, 4);
});
