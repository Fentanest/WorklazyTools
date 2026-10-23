import { assertSnapshot, assertOutput, assertReport, canonical, reportMetadata, REPORT_LIMITS, type ExportSnapshot, type ReportView } from './snapshot.ts';
export interface CapturedView { canvas: HTMLCanvasElement | OffscreenCanvas; snapshotId: string; view: ReportView; release(): void | Promise<void> }
export type CaptureView = (snapshot: ExportSnapshot, signal: AbortSignal) => Promise<CapturedView>;
function crc32(bytes: Uint8Array) { let crc = -1; for (const b of bytes) { crc ^= b; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
/** PNG iTXt stores report provenance alongside the existing view raster. No re-comparison or repaint. */
function attachMetadata(bytes: Uint8Array, metadata: unknown, expected: ReportView) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assertReport(bytes.length >= 33 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v), 'REPORT_CAPTURE');
  assertReport(view.getUint32(8)===13&&new TextDecoder().decode(bytes.subarray(12,16))==='IHDR'&&view.getUint32(16)===expected.width&&view.getUint32(20)===expected.height,'REPORT_CAPTURE');
  let position = 8, end = -1;
  while (position + 12 <= bytes.length) {
    const length = view.getUint32(position); assertReport(position + 12 + length <= bytes.length, 'REPORT_CAPTURE');
    const name = new TextDecoder().decode(bytes.subarray(position + 4, position + 8));
    if (name === 'IEND') { assertReport(length === 0 && position + 12 === bytes.length, 'REPORT_CAPTURE'); end = position; break; }
    position += 12 + length;
  }
  assertReport(end >= 0, 'REPORT_CAPTURE');
  const payload = new TextEncoder().encode('WorklazyReport\0\0\0\0\0' + JSON.stringify(metadata));
  const chunk = new Uint8Array(payload.length + 12), header = new DataView(chunk.buffer);
  header.setUint32(0, payload.length); chunk.set([105,84,88,116],4); chunk.set(payload,8); header.setUint32(chunk.length-4,crc32(chunk.subarray(4,chunk.length-4)));
  return new Blob([bytes.subarray(0,end) as Uint8Array<ArrayBuffer>, chunk, bytes.subarray(end) as Uint8Array<ArrayBuffer>], { type: 'image/png' });
}
export async function writeSnapshotPng(snapshot: ExportSnapshot, signal: AbortSignal, capture: CaptureView): Promise<Blob> {
  assertSnapshot(snapshot);const expected = snapshot.view;
  assertReport(expected && Number.isSafeInteger(expected.width) && Number.isSafeInteger(expected.height) && expected.width > 0 && expected.height > 0 && expected.width <= 8192 && expected.height <= 8192 && expected.width * expected.height <= REPORT_LIMITS.pngPixels, 'REPORT_CAPTURE_LIMIT');
  signal.throwIfAborted(); const captured = await capture(snapshot, signal);
  try {
    signal.throwIfAborted(); const canvas = captured.canvas;
    assertReport(captured.snapshotId === snapshot.id && canonical(captured.view) === canonical(expected) && canvas.width === expected.width && canvas.height === expected.height, 'REPORT_STALE_CAPTURE');
    if (expected.alpha === 'flattened') {
      assertReport(/^#[0-9a-f]{6}$/i.test(expected.background ?? ''), 'REPORT_CAPTURE');
      const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      assertReport(context, 'REPORT_CAPTURE'); const tileRows=Math.max(1,Math.floor(1024**2/(canvas.width*4)));let tiles=0;
      for(let y=0;y<canvas.height;y+=tileRows){
        signal.throwIfAborted();const pixels=context.getImageData(0,y,canvas.width,Math.min(tileRows,canvas.height-y)).data;
        try{for(let i=3;i<pixels.length;i+=4)assertReport(pixels[i]===255,'REPORT_CAPTURE_ALPHA');}
        finally{structuredClone(undefined,{transfer:[pixels.buffer]});}
        if(++tiles%16===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    const blob = 'convertToBlob' in canvas ? await canvas.convertToBlob({ type:'image/png' }) : await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('REPORT_CAPTURE')), 'image/png'));
    signal.throwIfAborted(); assertOutput(blob); const bytes = new Uint8Array(await blob.arrayBuffer()); signal.throwIfAborted();
    return assertOutput(attachMetadata(bytes, reportMetadata(snapshot), expected));
  } finally { await captured.release(); signal.throwIfAborted(); }
}
