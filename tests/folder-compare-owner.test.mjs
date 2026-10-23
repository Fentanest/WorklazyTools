import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { Admission } from '../src/features/folder-compare/core.ts';
import { FolderOwner } from '../src/features/folder-compare/owner.ts';
import { directorySource } from '../src/features/folder-compare/directory.ts';
const fileInput = (...files) => ({ kind: 'files', files });
const file = (name, contents) => new File([contents], name);
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function zipInput(name, contents) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await writer.add(name, new BlobReader(new Blob([contents])));
  return { kind: 'zip', file: new File([await writer.close()], 'source.zip') };
}
test('owner emits cloneable snapshots with raw paths and separate path/content/integrity states', async () => {
  const owner = new FolderOwner(); const views = [];
  try {
    await owner.compare(1, fileInput(file('a', 'x'), file('left', 'x')), fileInput(file('a', 'y'), file('right', 'x')), {}, v => views.push(structuredClone(v)));
    const result = views.at(-1); assert.equal(result.phase, 'done');
    assert.equal(result.rows.find(r => r.key === 'a').content, 'different');
    assert.equal(result.rows.find(r => r.key === 'a').integrity, 'verified');
    assert.equal(result.rows.find(r => r.key === 'left').pairing, 'left-only');
    assert.equal(result.rows[0].left[0].id, '1:left:files:0');
    assert.equal(JSON.stringify(result).includes('open'), false);
  } finally { await owner.clear(2); }
});
test('explicit ZIP root view does not strip FileList subdirectories or alter originals', async () => {
  const original = file('a.txt', 'same'); Object.defineProperty(original, 'webkitRelativePath', { value: 'chosen/sub/a.txt' });
  const owner = new FolderOwner(); let result;
  try {
    await owner.compare(1, fileInput(original), await zipInput('archive/sub/a.txt', 'same'), { stripRoot: true }, v => { result = v; });
    assert.equal(result.rows.length, 1); assert.equal(result.rows[0].key, 'sub/a.txt'); assert.equal(result.rows[0].content, 'equal');
    assert.equal(result.rows[0].right[0].path, 'archive/sub/a.txt'); assert.equal(result.rows[0].left[0].path, 'sub/a.txt');
  } finally { await owner.clear(2); }
});
test('omitted ZIP root directory cannot collide with its same-named child file', async () => {
  const writer=new ZipWriter(new BlobWriter(),{useWebWorkers:false});
  await writer.add('archive/',undefined,{directory:true});
  await writer.add('archive/archive',new BlobReader(new Blob(['same'])));
  const input={kind:'zip',file:new File([await writer.close()],'archive.zip')};
  const owner=new FolderOwner();let result;
  try{
    await owner.compare(1,input,fileInput(file('archive','same')),{stripRoot:true},v=>{result=v;});
    assert.equal(result.rows.length,1);assert.equal(result.rows[0].key,'archive');
    assert.equal(result.rows[0].pairing,'matched');assert.equal(result.rows[0].content,'equal');
    assert.equal(result.rows[0].left[0].path,'archive/archive');
  }finally{await owner.clear(2);}
});
test('owner replacement and clear await delayed reads before next source admission', async () => {
  const ready = deferred(), release = deferred(); const owner = new FolderOwner(); const publications = [];
  const delayed = { size: 1, name: 'a', slice() { ready.resolve(); return { arrayBuffer: async () => { await release.promise; return new Uint8Array([1]).buffer; } }; } };
  const old = owner.compare(1, fileInput(delayed), fileInput(file('a', new Uint8Array([1]))), {}, v => publications.push(v));
  await ready.promise;
  const nextViews = []; const skipped = owner.compare(2, fileInput(file('b', 'b')), fileInput(file('b', 'b')), {}, () => assert.fail('superseded'));
  const next = owner.compare(3, fileInput(file('c', 'c')), fileInput(file('c', 'c')), {}, v => nextViews.push(v));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(nextViews.length, 0);
  const oldCount = publications.length; release.resolve(); await Promise.all([old, skipped, next]);
  assert.equal(publications.length, oldCount); assert.equal(nextViews.at(-1).rows[0].content, 'equal');
  await owner.clear(4);
});
test('cancel preserves completed rows and yields event-loop ownership on empty files', async () => {
  const owner = new FolderOwner(); const files = Array.from({ length: 500 }, (_, i) => file(`${i}`, '')); let final;
  try {
    await owner.compare(1, fileInput(...files), fileInput(...files), {}, view => {
      final = view;
      if (view.phase === 'comparing' && !view.completed) setTimeout(() => owner.cancel(), 0);
    });
    assert.equal(final.phase, 'canceled'); assert(final.rows.some(r => r.content === 'equal')); assert(final.rows.some(r => r.content === 'canceled'));
  } finally { await owner.clear(2); }
});
test('readonly directory traverses snapshots, empty folders, abort and access denial without writes', async () => {
  const write = () => assert.fail('filesystem mutation');
  const empty = { kind: 'directory', name: 'empty', async *values() {} };
  const nested = { kind: 'directory', name: 'sub', async *values() { yield { kind: 'file', name: 'a', getFile: async () => file('a', 'a'), createWritable: write }; } };
  const root = { kind: 'directory', name: 'root', async *values() { yield empty; yield nested; }, removeEntry: write, requestPermission: write };
  const source = await directorySource(root, 'dir', new Admission(), new AbortController().signal);
  assert.deepEqual(source.entries.map(e => e.rawPath), ['empty', 'sub', 'sub/a']);
  assert(source.entries[0].directory); await source.close();
  const control = new AbortController(); control.abort(); await assert.rejects(directorySource(root, 'dir', new Admission(), control.signal));
  const denied = { kind: 'directory', name: 'denied', async *values() { throw new DOMException('denied', 'NotAllowedError'); } };
  await assert.rejects(directorySource(denied, 'dir', new Admission(), new AbortController().signal), /denied/);
});
