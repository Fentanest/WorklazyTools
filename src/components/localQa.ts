export const isLocalQaBuild = import.meta.env.VITE_LOCAL_QA === "1";

declare global {
  interface Window { __WORKLAZY_MOCK_PROVIDERS__?: boolean }
}

// Production previews on loopback must not call live ad/analytics suppliers.
// Provider-contract tests opt in only after installing a fail-closed mock route.
export function isThirdPartyBlockedForQa(): boolean {
  return isLocalQaBuild || /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
    && window.__WORKLAZY_MOCK_PROVIDERS__ !== true;
}
