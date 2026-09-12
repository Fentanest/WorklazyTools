export const REDACTOR_MARKER = 'meta[name="worklazy-redactor-isolation"][content="document-scope"]';
export function isRedactorPath(pathname: string) {
  return /^\/(?:ko\/|en\/)?tools\/document-redactor\/?$/.test(pathname);
}
export function isRedactorDocument() {
  return Boolean(document.querySelector(REDACTOR_MARKER));
}
export function installRedactorNavigation() {
  // Capture before React Router handles links: previously executed advertising scripts
  // must never share the document in which a file can be selected.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target instanceof Element ? event.target.closest('a[href]') : null) as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self') return;
    const target = new URL(anchor.href, location.href);
    if (target.origin !== location.origin || !(isRedactorDocument() || isRedactorPath(target.pathname))) return;
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
