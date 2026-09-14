import { videoParentAssetUrl } from "./videoDirectPaths";
export function localizedVideoWorkerUrl(sourceUrl: string) {
  const source = new URL(sourceUrl, window.location.origin);
  const basePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
  const relativePath = window.location.pathname.startsWith(basePath)
    ? window.location.pathname.slice(basePath.length)
    : window.location.pathname.replace(/^\//, "");
  const language = relativePath.match(/^(ko|en)(?:\/|$)/)?.[1];
  const workerPath = `${basePath}tools/video-studio/workers/`;
  if (language && source.pathname.includes(workerPath) && !source.pathname.includes(`${basePath}${language}/tools/video-studio/workers/`)) {
    source.pathname = videoParentAssetUrl(window.location.pathname, import.meta.env.BASE_URL, window.location.origin, `workers/${source.pathname.slice(source.pathname.indexOf(workerPath) + workerPath.length)}`).pathname;
  }
  return source;
}
