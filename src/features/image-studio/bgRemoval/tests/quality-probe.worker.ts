/// <reference lib="webworker" />
// QA only: compare verified pins without the UI capability gate. No user telemetry.
import { normalizeRgb, inputSize, multiplyAlpha, applyMask } from '../pixels.ts';
import { inferUsableMask } from '../inference.ts';
import { verifyAsset } from '../assets.ts';
import type { BgMode } from '../assets.ts';

self.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined;
  try {
    await verifyAsset(data.model.buffer, data.model.asset);
    await verifyAsset(data.runtime.buffer, data.runtime.asset);
    const mode = data.mode as BgMode;
    const loaded = mode === 'person' ? await import('onnxruntime-web/wasm') : await import('onnxruntime-web/webgpu');
    const ort = (loaded as unknown as { default: typeof import('onnxruntime-web') }).default;
    ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmBinary = data.runtime.buffer;
    const start = performance.now();
    bitmap = await createImageBitmap(data.input);
    const size = inputSize(bitmap.width, bitmap.height, mode);
    const canvas = new OffscreenCanvas(size.width, size.height), cx = canvas.getContext('2d')!;
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'low'; cx.drawImage(bitmap, 0, 0, size.width, size.height);
    const normalized = normalizeRgb(cx.getImageData(0, 0, size.width, size.height).data, size.width, size.height, mode);
    const events: unknown[] = [];
    const infer = async (ep: 'wasm' | 'webgpu') => {
      if (data.scenario === 'constant-gpu' && ep === 'webgpu') {
        events.push({ provider: ep, simulated: true, constant: 2.3125 });
        return { data: new Float32Array(512 * 512).fill(2.3125), width: 512, height: 512 };
      }
      const session = await ort.InferenceSession.create(data.model.buffer, { executionProviders: [ep], graphOptimizationLevel: 'all' });
      const input = new ort.Tensor('float32', normalized, [1, 3, size.height, size.width]);
      let outputs: Awaited<ReturnType<typeof session.run>> | undefined;
      try {
        outputs = await session.run({ [session.inputNames[0]]: input });
        const result = outputs[session.outputNames[0]];
        events.push({ provider: ep, simulated: false, inputNames: session.inputNames, inputMetadata: session.inputMetadata, outputNames: session.outputNames, outputMetadata: session.outputMetadata, dims: result.dims });
        return { data: (result.data as Float32Array).slice(), width: Number(result.dims.at(-1)), height: Number(result.dims.at(-2)) };
      } finally {
        input.dispose(); if (outputs) Object.values(outputs).forEach(t => t.dispose());
        await session.release();
      }
    };
    const mask = data.scenario === 'constant-gpu'
      ? await inferUsableMask(mode, infer, () => events.push({ fallback: true }))
      : await infer(data.ep);
    const out = new OffscreenCanvas(bitmap.width, bitmap.height), ox = out.getContext('2d')!; ox.drawImage(bitmap, 0, 0);
    const pixels = ox.getImageData(0, 0, bitmap.width, bitmap.height);
    // Raw provider comparison deliberately keeps pre-fix composition to expose a bad alpha.
    const compose = data.scenario === 'constant-gpu' ? applyMask : multiplyAlpha;
    compose(pixels.data, bitmap.width, bitmap.height, mask.data, mask.width, mask.height, mode === 'product');
    ox.putImageData(pixels, 0, 0);
    self.postMessage({ ok: true, milliseconds: performance.now() - start, events, inputStats: stats(normalized), inputSamples: [0, size.width * size.height, 2 * size.width * size.height].map(i => [...normalized.slice(i, i + 8)]), maskStats: stats(mask.data), blob: await out.convertToBlob() });
  } catch (error) { self.postMessage({ ok: false, error: String(error) }); }
  finally { bitmap?.close(); self.close(); }
};
function stats(values: Float32Array) {
  let min = Infinity, max = -Infinity, mean = 0, m2 = 0, count = 0, nonfinite = 0;
  const histogram = new Array(12).fill(0);
  for (const v of values) {
    if (!Number.isFinite(v)) { nonfinite++; continue; }
    min = Math.min(min, v); max = Math.max(max, v);
    const delta = v - mean; mean += delta / ++count; m2 += delta * (v - mean);
    histogram[Math.max(0, Math.min(11, Math.floor(v / 5) + 6))]++;
  }
  return { min, max, mean, variance: m2 / count, nonfinite, histogram, histogramBinEdges: [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25] };
}
