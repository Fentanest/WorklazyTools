import { Component, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { confirmToolReady } from "../app/chunkRecovery";
import { Button } from "./ui/button";

class RouteBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <RouteFailure /> : this.props.children; }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Reset only failure state; remounting the healthy subtree would discard
  // document-comparison sessions when navigating from input to results.
  return <RouteBoundary resetKey={`${location.pathname}${location.search}`}>{children}</RouteBoundary>;
}

function RouteFailure() {
  const { t } = useTranslation("common");
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { notice.current?.focus(); }, []);
  return (
    <div className="page tool-page tool-route-loading outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" role="alert" tabIndex={-1} ref={notice} data-route-error>
      <div className="grid max-w-lg gap-4 px-4 text-center text-foreground">
        <p>{t("recovery.toolFailed")}</p>
        <Button type="button" onClick={() => window.location.reload()}>{t("recovery.retry")}</Button>
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
