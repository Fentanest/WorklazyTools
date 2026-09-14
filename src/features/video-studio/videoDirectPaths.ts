export const VIDEO_DIRECT_PATHS = ["/tools/video-studio", "/tools/video-studio/trim", "/tools/video-studio/merge", "/tools/video-studio/extract-audio"] as const;
export function isVideoDirectPath(pathname: string, baseUrl = "/") {
  const base = baseUrl.replace(/\/+$/, "");
  const withoutBase = base && (pathname === base || pathname.startsWith(`${base}/`)) ? pathname.slice(base.length) : pathname;
  const normalized = withoutBase.replace(/^\/(ko|en)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return VIDEO_DIRECT_PATHS.some(path => path === normalized);
}
export function videoParentAssetUrl(pathname: string, baseUrl: string, origin: string, relativeAsset: string) {
  const base = new URL(baseUrl, origin).pathname.replace(/\/?$/, "/");
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "");
  const language = relative.match(/^(ko|en)(?:\/|$)/)?.[1];
  return new URL(`${base}${language ? `${language}/` : ""}tools/video-studio/${relativeAsset}`, origin);
}
