import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createResultDownload, combineResultDownloads } from '../../src/utils/resultDownload.ts';
import { createZipArchiveBlob } from '../../src/utils/zipArchive.ts';

for (const extension of ['png', 'jpg', 'pdf', 'docx', 'xlsx', 'hwpx', 'md', 'html', 'mp4']) {
  test(`one final ${extension} downloads unchanged`, async () => {
    const blob = new Blob(['original bytes'], { type: 'application/octet-stream' });
    const result = await createResultDownload([{ fileName: `한글 결과.${extension}`, blob }], 'unused.zip');
    assert.equal(result.fileName, `한글 결과.${extension}`);
    assert.equal(result.blob, blob);
  });
}

test('multiple files preserve Unicode, duplicate bytes and contain no ZIP entries', async () => {
  const result = await createResultDownload([
    { fileName: '한글.png', blob: new Blob(['first']) },
    { fileName: '한글.png', blob: new Blob(['second']) },
    { fileName: 'bad/name.pdf', blob: new Blob(['third']) },
  ], '결과.zip', undefined, undefined, { useWebWorkers: false });
  const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());
  assert.deepEqual(Object.keys(archive.files), ['한글.png', '한글-2.png', 'bad_name.pdf']);
  assert.equal(await archive.file('한글-2.png')!.async('string'), 'second');
  assert.ok(Object.keys(archive.files).every(name => !/\.zip$/i.test(name)));
});

test('combined PDF image bundles are flattened with document prefixes, including same input names', async () => {
  const blob = await createZipArchiveBlob([
    { fileName: '쪽-001.png', blob: new Blob(['one']) },
    { fileName: '쪽-002.png', blob: new Blob(['two']) },
  ], undefined, undefined, undefined, { useWebWorkers: false });
  const result = await combineResultDownloads([
    { fileName: '한글.zip', blob, archive: true },
    { fileName: '한글.zip', blob, archive: true },
    { fileName: '직접.png', blob: new Blob(['three']) },
  ], 'all.zip');
  const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());
  assert.deepEqual(Object.keys(archive.files), ['1-한글-쪽-001.png', '1-한글-쪽-002.png', '2-한글-쪽-001.png', '2-한글-쪽-002.png', '직접.png']);
  assert.equal(await archive.file('2-한글-쪽-002.png')!.async('string'), 'two');
  assert.ok(Object.keys(archive.files).every(name => !/\.zip$/i.test(name)));
});

test('a combined download with only one success returns that file, and keeps office containers intact', async () => {
  const blob = new Blob(['PK office content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const result = await combineResultDownloads([{ fileName: '결과.docx', blob }], 'all.zip');
  assert.equal(result.blob, blob);
  assert.equal(result.fileName, '결과.docx');
});

test('flattened singleton returns the file; expanded sizes and cancellation are enforced', async () => {
  const blob = await createZipArchiveBlob([{ fileName: '한 장.png', blob: new Blob(['12345']) }], undefined, undefined, undefined, { useWebWorkers: false });
  const files = [{ fileName: '문서.zip', blob, archive: true }];
  const result = await combineResultDownloads(files, 'all.zip');
  assert.match(result.fileName, /\.png$/);
  assert.equal(await result.blob.text(), '12345');
  await assert.rejects(combineResultDownloads(files, 'all.zip', undefined, 4), /DOWNLOAD_SIZE_LIMIT/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(combineResultDownloads(files, 'all.zip', controller.signal), { name: 'AbortError' });
  await assert.rejects(createResultDownload([], 'all.zip'), /NO_DOWNLOAD_RESULTS/);
});
