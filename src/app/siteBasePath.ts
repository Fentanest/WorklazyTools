/** BrowserRouter strips BASE_URL; browser and service-worker URLs do not. */
export function withSiteBasePath(pathname: string, baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function stripSiteBasePath(pathname: string, baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  if (!base) return pathname;
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : null;
}
