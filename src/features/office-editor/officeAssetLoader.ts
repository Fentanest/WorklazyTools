import { OFFICE_ASSETS, OFFICE_DOWNLOAD_BYTES, OFFICE_ASSET_VERSION, officeAssetBaseUrl } from "./officeAssets";

export interface OfficeDownloadProgress {
  loaded: number;
  total: number;
  fileNumber: number;
  fileCount: number;
  cached: boolean;
}

export async function prepareOfficeAssets(
  onProgress: (progress: OfficeDownloadProgress) => void,
  signal?: AbortSignal,
) {
  if (!("caches" in window)) throw new Error("cache-unavailable");
  const cache = await caches.open(`worklazy-office-${OFFICE_ASSET_VERSION}`);
  const baseUrl = officeAssetBaseUrl();
  let completedBytes = 0;
  for (let index = 0; index < OFFICE_ASSETS.length; index += 1) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
    const asset = OFFICE_ASSETS[index];
    const url = new URL(asset.name, baseUrl).href;
    const cached = await cache.match(url);
    if (cached && Number(cached.headers.get("x-worklazy-office-size")) === asset.size) {
      completedBytes += asset.size;
      onProgress({ loaded: completedBytes, total: OFFICE_DOWNLOAD_BYTES, fileNumber: index + 1, fileCount: OFFICE_ASSETS.length, cached: true });
      continue;
    }
    if (cached) await cache.delete(url);
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok || !response.body) throw new Error("asset-download-failed");
    const cacheHeaders = new Headers(response.headers);
    cacheHeaders.set("x-worklazy-office-size", String(asset.size));
    const cachedResponse = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers: cacheHeaders,
    });
    const cacheWrite = cache.put(url, cachedResponse);
    const reader = response.body.getReader();
    let currentBytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        currentBytes += value.byteLength;
        onProgress({
          loaded: Math.min(OFFICE_DOWNLOAD_BYTES, completedBytes + currentBytes),
          total: OFFICE_DOWNLOAD_BYTES,
          fileNumber: index + 1,
          fileCount: OFFICE_ASSETS.length,
          cached: false,
        });
      }
      await cacheWrite;
      if (currentBytes !== asset.size) {
        await cache.delete(url);
        throw new Error("asset-download-failed");
      }
    } catch (reason) {
      await cacheWrite.catch(() => undefined);
      await cache.delete(url);
      throw reason;
    }
    completedBytes += asset.size;
  }
  return baseUrl;
}
