/// <reference lib="webworker" />
import ort from 'onnxruntime-web/webgpu';
import { manifest, verifyAsset, sha256, type VerifiedAsset } from '../assets.ts';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<{ ep: 'wasm' | 'webgpu'; model: VerifiedAsset; runtime: VerifiedAsset }>) => {
  const events: Record<string, unknown>[] = []; const original = WebAssembly.instantiate;
  let session: import('onnxruntime-web').InferenceSession | undefined;
  try {
    const expectedModel = manifest.models.find(item => item.id === data.model.asset.id)!;
    const expectedRuntime = manifest.runtimes.find(item => item.id === 'webgpu')!;
    await verifyAsset(data.model.buffer, expectedModel); await verifyAsset(data.runtime.buffer, expectedRuntime);
    WebAssembly.instantiate = (async (...args: unknown[]) => {
      const bytes = args[0];
      if (bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes)) {
        const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        events.push({ type: 'consumed-wasm', bytes: buffer.byteLength, sha256: await sha256(buffer) });
      }
      const result = await Reflect.apply(original, WebAssembly, args);
      const instance = result instanceof WebAssembly.Instance ? result : result.instance;
      events.push({ type: 'abi', exportIcKind: typeof instance.exports.ic });
      return result;
    }) as typeof WebAssembly.instantiate;
    ort.env.wasm.proxy = false; ort.env.wasm.numThreads = 1; ort.env.wasm.wasmBinary = data.runtime.buffer;
    session = await ort.InferenceSession.create(data.model.buffer, { executionProviders: [data.ep] });
    worker.postMessage({ ok: true, ep: data.ep, inputNames: session.inputNames, outputNames: session.outputNames, modelSHA256: await sha256(data.model.buffer), events });
  } catch (error) { worker.postMessage({ ok: false, ep: data.ep, error: String(error), events }); }
  finally { WebAssembly.instantiate = original; await session?.release(); worker.close(); }
};
