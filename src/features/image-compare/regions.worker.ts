/// <reference lib="webworker" />
import { assertImageBudget, CV_INITIAL_MEMORY_BYTES } from "./memory.ts";
import { capCvMemory } from "./cvMemory.ts";
import { detectRegions, type RegionCv } from "./regions.ts";
import type { RegionOptions, RegionPass } from "./types.ts";
const scope = self as unknown as DedicatedWorkerGlobalScope & { Module?: { wasmBinary: ArrayBuffer; instantiateWasm: (imports: WebAssembly.Imports, receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void) => WebAssembly.Exports }; cv?: Promise<RegionCv> };
const assets = [
  ["opencv.js", "5930cd64d2f8f0fa6c572aae761837d95dd8d5b67c972c6a8a9daa37aa63795f", 128047],
  ["opencv_js.wasm", "8f4e4ff34715a0efc28262ca60248f93ab48b720b33378926321d8eb0dc448bd", 8355721],
] as const;
scope.onmessage = async ({ data }: MessageEvent<{ delta: Uint8Array; width: number; height: number; options: RegionOptions; id: string; runId: string; resources: { sourcePixels: number; encodedBytes: number } }>) => {
  let scriptUrl: string | undefined;
  try {
    assertImageBudget(data.resources.sourcePixels, data.width * data.height, data.resources.encodedBytes);
    scope.postMessage({ type: "progress", progress: 5 });
    const [script, wasm] = await Promise.all(assets.map(async ([name, hash, length]) => {
      const response = await fetch(new URL(name, scope.location.href));
      if (!response.ok) throw new Error("REGION_ASSET_UNAVAILABLE");
      const bytes = await response.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (v) => v.toString(16).padStart(2, "0")).join("");
      if (bytes.byteLength !== length || digest !== hash) throw new Error("REGION_ASSET_INTEGRITY");
      return bytes;
    }));
    let memory: WebAssembly.Memory | undefined;
    scope.Module = { wasmBinary: wasm, instantiateWasm: (imports, receive) => {
      const module = new WebAssembly.Module(wasm), instance = new WebAssembly.Instance(module, imports);
      const exportedMemory = instance.exports.Y;
      if (!(exportedMemory instanceof WebAssembly.Memory)) throw new Error("REGION_INITIALIZATION_FAILED");
      memory = capCvMemory(exportedMemory, CV_INITIAL_MEMORY_BYTES);
      receive(instance, module); return instance.exports;
    } };
    scriptUrl = URL.createObjectURL(new Blob([script], { type: "application/javascript" }));
    scope.importScripts(scriptUrl);
    const cv = await scope.cv;
    if (!cv) throw new Error("REGION_INITIALIZATION_FAILED");
    scope.postMessage({ type: "progress", progress: 40, phase: "READY" });
    const detected = detectRegions(cv, data.delta, data.width, data.height, data.options, data.id);
    const result: RegionPass = { ...detected, nativeHeapBytes: memory!.buffer.byteLength, id: data.id, sourceRunId: data.runId, options: data.options, engine: "opencv-4.13.0-dev-channel-regions-v1" };
    scope.postMessage({ type: "result", result });
  } catch (error) { scope.postMessage({ type: "error", code: error instanceof Error && /^[A-Z_]+$/u.test(error.message) ? error.message : "REGION_PROCESSING_FAILED" }); }
  finally { if (scriptUrl) URL.revokeObjectURL(scriptUrl); scope.close(); }
};
