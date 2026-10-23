import { sourcePolygon } from "./geometry.ts";
import { runModuleWorker } from "../../utils/workerLifecycle.ts";
import type { ImageCompareResult, PixelOptions, Transform, RegionOptions, RegionPass } from "./types.ts";
export async function compareImages(left: File, right: File, options: PixelOptions, transform: Transform, signal: AbortSignal, onProgress: (value: number) => void) {
  const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  if (signal.aborted) throw new DOMException("Canceled", "AbortError");
  return runModuleWorker<object, ImageCompareResult>(() => new Worker(new URL("./compare.worker.ts", import.meta.url), { type: "module" }), { leftName: left.name, rightName: right.name, left: a, right: b, options, transform, runId: crypto.randomUUID() }, { transfer: [a, b], signal, onProgress: ({ progress }) => onProgress(progress), canceledMessage: "Canceled", startErrorMessage: "IMAGE_PROCESSING_FAILED", resultErrorMessage: "IMAGE_PROCESSING_FAILED", inactivityTimeoutMs: 60_000 });
}
export function scanRegions(result: ImageCompareResult, options: RegionOptions, signal: AbortSignal, onProgress: (value: number) => void = () => undefined) {
  const delta = result.channelDelta.slice();
  return runModuleWorker<object, RegionPass>(() => new Worker(new URL(`${import.meta.env.BASE_URL}vendor/opencv/4.13.0-dev/regions.worker.js`, location.origin)), { delta, width: result.width, height: result.height, options, runId: result.runId, id: crypto.randomUUID() }, { transfer: [delta.buffer], signal, onProgress: ({ progress }) => onProgress(progress), canceledMessage: "Canceled", startErrorMessage: "REGION_PROCESSING_FAILED", resultErrorMessage: "REGION_PROCESSING_FAILED", inactivityTimeoutMs: 60_000 }).then((pass) => ({ ...pass, regions: pass.regions.map((region) => ({ ...region, sourcePolygons: { left: sourcePolygon(result.geometry.leftMatrix, region.bounds), right: sourcePolygon(result.geometry.rightMatrix, region.bounds) } })) }));
}
