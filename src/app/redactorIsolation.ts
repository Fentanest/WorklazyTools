import { stripSiteBasePath } from "./siteBasePath";

export const REDACTOR_MARKER = 'meta[name="worklazy-redactor-isolation"][content="document-scope"]';
export function isRedactorPath(pathname: string, baseUrl = "/") {
  const route = stripSiteBasePath(pathname, baseUrl);
  return route !== null && /^\/(?:ko\/|en\/)?tools\/document-redactor\/?$/.test(route);
}
export function isRedactorDocument() {
  return Boolean(document.querySelector(REDACTOR_MARKER));
}
function isDedicatedWorkspacePath(pathname: string) {
  const route = stripSiteBasePath(pathname, import.meta.env.BASE_URL);
  return route !== null && /^\/(?:ko\/|en\/)?tools\/(?:document-redactor|office-editor\/app|excel-merger\/xls-preserve)\/?$/.test(route);
}
function isDedicatedWorkspaceDocument() {
  return Boolean(document.querySelector(`${REDACTOR_MARKER}, meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]`));
}
export function installRedactorNavigation() {
  // Capture before React Router handles links so dedicated CSP/COEP documents
  // are entered directly, without mounting a transient SPA work screen.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target instanceof Element ? event.target.closest('a[href]') : null) as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self') return;
    const target = new URL(anchor.href, location.href);
    if (target.origin !== location.origin || !(isDedicatedWorkspaceDocument() || isDedicatedWorkspacePath(target.pathname))) return;
    if (target.href === location.href) return;
    event.preventDefault(); event.stopImmediatePropagation(); location.assign(target.href);
  }, true);
  window.addEventListener('pageshow', event => {
    if (event.persisted && isRedactorDocument()) {
      // pagehide releases worker and result ownership. A restored document must
      // perform a fresh preparation, rather than expose a disposed client.
      document.documentElement.inert = true;
      location.reload();
    }
  });
}
