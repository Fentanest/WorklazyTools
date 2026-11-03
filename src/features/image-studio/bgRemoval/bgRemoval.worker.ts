/// <reference lib="webworker" />
import { manifest, sha256, verifyAsset } from './assets.ts';
import { BgRemovalError, normalizeError } from './errors.ts';
import { inputSize, normalizeRgb, applyMask } from './pixels.ts';
import { inferUsableMask } from './inference.ts';
import type { WorkerRequest, WorkerResponse, Diagnostic } from './protocol.ts';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const send = (value: Omit<WorkerResponse, 'runId'>) => worker.postMessage({ ...value, runId: data.runId });
  const audit = (event: Diagnostic) => send({ type: 'audit', data: event } as Omit<WorkerResponse, 'runId'>);
  let bitmap: ImageBitmap | undefined;
  let restoreAudit: (() => void) | undefined;
  try {
    for (const item of data.assets) await verifyAsset(item.buffer, item.asset);
    const model = data.assets.find(item => item.asset.id === data.mode)!;
    const descriptor = manifest.models.find(item => item.id === data.mode)!;
    const wasm = data.assets.find(item => item.asset.id === descriptor.runtime)!;
    const loaded = data.mode === 'person' ? await import('onnxruntime-web/wasm') : await import('onnxruntime-web/webgpu');
    const ort = (loaded as unknown as { default: typeof import('onnxruntime-web') }).default;
    ort.env.wasm.proxy = false; ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmBinary = wasm.buffer;
    if (data.auditRuntime) restoreAudit = auditInstantiation(audit);
    audit({ type: 'assigned', modelSHA256: await sha256(model.buffer), wasmSHA256: await sha256(wasm.buffer), modelBytes: model.buffer.byteLength, wasmBytes: wasm.buffer.byteLength, wasmBinaryIdentity: ort.env.wasm.wasmBinary === wasm.buffer, proxy: ort.env.wasm.proxy, numThreads: ort.env.wasm.numThreads });
    bitmap = await createImageBitmap(data.input, { imageOrientation: 'from-image', premultiplyAlpha: 'none' });
    const { width, height } = bitmap; const size = inputSize(width, height, data.mode);
    const small = new OffscreenCanvas(size.width, size.height); const sx = small.getContext('2d', { willReadFrequently: true });
    const output = new OffscreenCanvas(width, height); const ox = output.getContext('2d', { willReadFrequently: true });
    if (!sx || !ox) throw new BgRemovalError('bg-unsupported');
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'low'; sx.drawImage(bitmap, 0, 0, size.width, size.height);
    ox.drawImage(bitmap, 0, 0);
    const normalized = normalizeRgb(sx.getImageData(0, 0, size.width, size.height).data, size.width, size.height, data.mode);
    send({ type: 'progress', stage: 'compute', current: 0, total: 1 } as Omit<WorkerResponse, 'runId'>);
    const mask = await inferUsableMask(data.mode, async executionProvider => {
      // Release tensors and the previous session before creating the CPU retry.
      const session = await ort.InferenceSession.create(model.buffer, { executionProviders: [executionProvider], graphOptimizationLevel: 'all' });
      let input: import('onnxruntime-web').Tensor | undefined;
      let results: Awaited<ReturnType<typeof session.run>> | undefined;
      try {
        audit({ type: 'session', inputNames: session.inputNames, outputNames: session.outputNames, inputMetadata: session.inputMetadata, outputMetadata: session.outputMetadata, modelBufferSHA256: await sha256(model.buffer), executionProvider });
        if (!session.inputNames.length || (data.mode === 'product' && session.inputNames[0] !== 'input_image')) throw new BgRemovalError('bg-inference-failed');
        input = new ort.Tensor('float32', normalized, [1, 3, size.height, size.width]);
        results = await session.run({ [session.inputNames[0]]: input });
        const result = results[session.outputNames[0]], dims = result.dims;
        const mh = Number(dims[dims.length - 2]), mw = Number(dims[dims.length - 1]);
        if (!(result.data instanceof Float32Array) || !Number.isInteger(mw) || !Number.isInteger(mh) || mw <= 0 || mh <= 0 || result.data.length !== mw * mh) throw new BgRemovalError('bg-inference-failed');
        return { data: result.data.slice(), width: mw, height: mh };
      } finally {
        input?.dispose(); if (results) for (const value of Object.values(results)) value.dispose();
        await session.release();
      }
    }, () => audit({ type: 'mask-fallback', from: 'webgpu', to: 'wasm', reason: 'bg-mask-unusable' }));
    const pixels = ox.getImageData(0, 0, width, height);
    applyMask(pixels.data, width, height, mask.data, mask.width, mask.height, data.mode === 'product');
    ox.putImageData(pixels, 0, 0);
    const blob = await output.convertToBlob({ type: 'image/png' });
    audit({ type: 'shape', width, height, tensorWidth: size.width, tensorHeight: size.height, maskWidth: mask.width, maskHeight: mask.height });
    send({ type: 'progress', stage: 'compute', current: 1, total: 1 } as Omit<WorkerResponse, 'runId'>);
    send({ type: 'result', blob, width, height } as Omit<WorkerResponse, 'runId'>);
  } catch (error) { send({ type: 'error', code: normalizeError(error).code } as Omit<WorkerResponse, 'runId'>); }
  finally { restoreAudit?.(); bitmap?.close(); worker.close(); }
};
/** Test-only probe hashes the actual binary argument passed to the WebAssembly engine. */
function auditInstantiation(emit: (event: Diagnostic) => void): () => void {
  const original = WebAssembly.instantiate;
  const replacement = async (...args: unknown[]) => {
    const input = args[0];
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      const bytes = input instanceof ArrayBuffer ? input : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
      emit({ type: 'consumed-wasm', bytes: bytes.byteLength, sha256: await sha256(bytes) });
    }
    return Reflect.apply(original, WebAssembly, args);
  };
  WebAssembly.instantiate = replacement as typeof original;
  return () => { WebAssembly.instantiate = original; };
}
