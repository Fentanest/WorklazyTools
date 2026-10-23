/// <reference lib="webworker" />
import { assertImageBudget } from "./memory.ts";
import { inspectImageHeader } from "./input.ts";
import { validateDimensions, workingGeometry } from "./geometry.ts";
import { compareRgba } from "./kernel.ts";
import type { ImageCompareResult, Matrix, PixelOptions, Transform } from "./types.ts";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async ({ data }: MessageEvent<{ leftName: string; rightName: string; left: ArrayBuffer; right: ArrayBuffer; options: PixelOptions; transform: Transform; previousViewBytes: number; runId: string }>) => {
  let left: ImageBitmap | undefined, right: ImageBitmap | undefined;
  try {
    const leftMetadata = inspectImageHeader(data.leftName, data.left), rightMetadata = inspectImageHeader(data.rightName, data.right);
    const dimensions = (metadata: typeof leftMetadata) => metadata.exifOrientation >= 5 ? [metadata.height, metadata.width] : [metadata.width, metadata.height];
    const [lw, lh] = dimensions(leftMetadata), [rw, rh] = dimensions(rightMetadata);
    const encodedBytes = data.left.byteLength + data.right.byteLength;
    // Preflight source decode, transformed output, views and later CV scans before either bitmap allocation.
    workingGeometry(lw, lh, rw, rh, data.transform, encodedBytes, data.previousViewBytes);
    scope.postMessage({ type: "progress", progress: 10 });
    left = await createImageBitmap(new Blob([data.left], { type: leftMetadata.mime }), { imageOrientation: "from-image", colorSpaceConversion: "default", premultiplyAlpha: "none" });
    right = await createImageBitmap(new Blob([data.right], { type: rightMetadata.mime }), { imageOrientation: "from-image", colorSpaceConversion: "default", premultiplyAlpha: "none" });
    leftMetadata.decodedWidth = left.width; leftMetadata.decodedHeight = left.height; rightMetadata.decodedWidth = right.width; rightMetadata.decodedHeight = right.height;
    validateDimensions(left.width, left.height); validateDimensions(right.width, right.height);
    const geometry = workingGeometry(left.width, left.height, right.width, right.height, data.transform, encodedBytes, data.previousViewBytes);
    const sourcePixels = left.width * left.height + right.width * right.height;
    const a = render(left, geometry.width, geometry.height, geometry.leftMatrix), b = render(right, geometry.width, geometry.height, geometry.rightMatrix);
    left.close(); right.close(); left = undefined; right = undefined;
    scope.postMessage({ type: "progress", progress: 45 });
    const compared = compareRgba(a.rgba, b.rgba, geometry.width, geometry.height, a.valid, b.valid, data.options);
    const result: ImageCompareResult = { ...compared, quality: { mode: "full-resolution", scale: 1, resources: assertImageBudget(sourcePixels, geometry.width * geometry.height, encodedBytes, data.previousViewBytes) }, runId: data.runId, engine: "pixelmatch-7.1.0-rgba-v1", width: geometry.width, height: geometry.height, left: a.rgba, right: b.rgba, leftValid: a.valid, rightValid: b.valid, sources: { left: leftMetadata, right: rightMetadata }, options: data.options, geometry: { ...geometry, rightTransform: data.transform } };
    scope.postMessage({ type: "result", result }, [result.left.buffer, result.right.buffer, result.leftValid.buffer, result.rightValid.buffer, result.changedMask.buffer, result.channelDelta.buffer, result.overlay.buffer, result.subtract.buffer] as ArrayBuffer[]);
  } catch (error) { scope.postMessage({ type: "error", code: error instanceof Error && /^[A-Z_]+$/u.test(error.message) ? error.message : "IMAGE_DECODE_FAILED" }); }
  finally { left?.close(); right?.close(); scope.close(); }
};
function render(bitmap: ImageBitmap, width: number, height: number, matrix: Matrix) {
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });
  if (!context) throw new Error("IMAGE_CANVAS_UNAVAILABLE");
  context.setTransform(...matrix); context.drawImage(bitmap, 0, 0); const rgba = context.getImageData(0, 0, width, height).data;
  context.resetTransform(); context.clearRect(0, 0, width, height); context.setTransform(...matrix); context.fillStyle = "white"; context.fillRect(0, 0, bitmap.width, bitmap.height);
  const coverage = context.getImageData(0, 0, width, height).data, valid = new Uint8Array(width * height);
  for (let i = 0; i < valid.length; i++) valid[i] = coverage[i * 4 + 3] === 255 ? 1 : 0;
  canvas.width = canvas.height = 1;
  return { rgba, valid };
}
