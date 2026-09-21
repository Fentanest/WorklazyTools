import { Component, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { confirmToolReady } from "../app/chunkRecovery";
import { Button } from "./ui/button";
import { setAdIneligible } from "../app/adEligibility";


class RouteBoundary extends Component<{ children: ReactNode; resetKey: string; onError?: () => void }, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() { return this.state.failed ? <RouteFailure /> : this.props.children; }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Reset only failure state; remounting the healthy subtree would discard
  // document-comparison sessions when navigating from input to results.
  const handleError = () => {
    // S5: Navigate to dedicated ad-free error page on first error.
    // Must use window.location.assign() to force FULL DOCUMENT reload (not same-document SPA nav).
    // This clears: HTML head (ad script tags), adsbygoogle global, all React state.
    // D4: Loop guard - prevent re-navigation if already on error page.
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const lang = pathSegments[0] || "en";
    // If we're already on the error page and get another error, don't navigate again.
    if (pathSegments[1] === "error") {
      // Second error in same session - show error in-place without navigation
      return;
    }
    window.location.assign(`/${lang}/error/`);
  };
  return <RouteBoundary resetKey={`${location.pathname}${location.search}`} onError={handleError}>{children}</RouteBoundary>;
}

function RouteFailure() {
  const { t } = useTranslation("common");
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    notice.current?.focus();
    setAdIneligible("routeError", true);
    return () => setAdIneligible("routeError", false);
  }, []);
  const goHome = () => {
    // D3: Don't reload. Return to home (clear state).
    const lang = document.documentElement.lang || "en";
    window.location.assign(`/${lang}/`);
  };
  return (
    <div className="page tool-page tool-route-loading outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" role="alert" tabIndex={-1} ref={notice} data-route-error>
      <div className="grid max-w-lg gap-4 px-4 text-center text-foreground">
        <p>{t("recovery.toolFailed")}</p>
        <Button type="button" onClick={goHome}>{t("recovery.goHome")}</Button>
      </div>
    </div>
  );
}

// Mount this INSIDE Suspense: its fallback commit is not tool success.
export function ToolReady({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!document.querySelector("[data-route-error], .tool-route-loading")) confirmToolReady();
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);
  return children;
}
