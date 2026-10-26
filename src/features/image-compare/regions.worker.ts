/// <reference lib="webworker" />
import { assertImageBudget } from "./memory.ts";
import { loadCvRuntime } from "./cvRuntime.ts";
import { detectRegions, type RegionCv } from "./regions.ts";
import type { RegionOptions, RegionPass } from "./types.ts";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async ({ data }: MessageEvent<{ delta: Uint8Array; width: number; height: number; options: RegionOptions; id: string; runId: string; resources: { sourcePixels: number; encodedBytes: number; retainedSessionBytes?:number } }>) => {
  try {
    assertImageBudget(data.resources.sourcePixels, data.width * data.height, data.resources.encodedBytes,0,data.resources.retainedSessionBytes??0);
    scope.postMessage({ type: "progress", progress: 5 });
    const {cv,memory}=await loadCvRuntime<RegionCv>(()=>scope.postMessage({type:"progress",progress:40,phase:"READY"}));
    const detected = detectRegions(cv, data.delta, data.width, data.height, data.options, data.id);
    const result: RegionPass = { ...detected, nativeHeapBytes: memory.buffer.byteLength, id: data.id, sourceRunId: data.runId, options: data.options, engine: "opencv-4.13.0-dev-channel-regions-v1" };
    scope.postMessage({ type: "result", result });
  } catch (error) { scope.postMessage({ type: "error", code: error instanceof Error && /^[A-Z_]+$/u.test(error.message) ? error.message : "REGION_PROCESSING_FAILED" }); }
  finally { scope.close(); }
};
