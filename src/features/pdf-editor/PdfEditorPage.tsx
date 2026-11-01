import type { PdfOrganizePreset } from "./pdfOrganizeDirect";
import type { PdfConvertPreset } from "./pdfConvertDirect";
import { BadgeCheck, Layers3 } from "lucide-react";
import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityPage } from "../../components/UtilitySurface";
import { PageHeader } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { ToolReady } from "../../components/RouteErrorBoundary";
import { useGuardedNavigate } from "../../components/AppShell";
import { holdAutoReload, release } from "../../app/chunkRecovery";
import { clearUnsavedWork, grantOneShotSafeTarget, setUnsavedWork } from "../../app/toolState";
import { featureMessage, featureResource } from "../../i18n/featureMessages";
import { localizedPath, stripLanguagePrefix } from "../../i18n/languages";
import { useAppLanguage } from "../../i18n/routing";
import { PdfConvertPanel } from "./PdfConvertPanel";
import { PdfOrganizePanel, type PdfOrganizeOutputMode, type PdfOrganizeProducedResult } from "./PdfOrganizePanel";
import { PDF_EDITOR_SAFE_PATHS } from "./pdfUi";
import type { PdfFinishPreset, PdfToolMode } from "./types";

/** Fresh lazy handle per retry: React caches a rejected lazy import. */
function createLazyFinishPanel() {
  return lazy(() => import("./PdfFinishPanel").then((module) => ({ default: module.PdfFinishPanel })));
}

interface PdfGuideCopy {
  title: string;
  description: string;
  blocks: Array<{ title: string; paragraphs: string[] }>;
  faq: Array<{ question: string; answer: string }>;
}

interface PdfPageCopy {
  modes: Record<PdfToolMode, { eyebrow: string; title: string; description: string }>;
  navigation: Record<PdfToolMode, string>;
}

const navigation = [
  { mode: "organize", to: "/tools/pdf-editor", icon: Layers3 },
  { mode: "finish", to: "/tools/pdf-editor/finish", icon: BadgeCheck },
] as const;

/**
 * W1 result handoff store (plan §4.1 D4-1).
 *
 * The route element remounts on organize<->finish navigation, so the retained
 * result and the pending intake live in this module slot (not component
 * state) while the ownership moves. Mapping to plan terms:
 * - `organizeResult` (upper store) == handoffSlot while retained
 * - `pendingFinishIntake` == handoffSlot with inFlight/auto
 * - `handedOff` == handoffSlot cleared by the ack
 * - `lastOrganizePath` / `acceptedPreset` restore == lastOrganizePath + route
 * - `organizeReopenFiles` == finish sources passed back to organize
 */
interface RetainedOrganizeResult {
  blob: Blob;
  name: string;
  generation: number;
  outputMode: PdfOrganizeOutputMode;
}

interface HandoffSlot extends RetainedOrganizeResult {
  /** organize->finish navigation in progress; the finish instance adopts it. */
  inFlight: boolean;
  /** finish should insert it automatically (handoff button), else suggest. */
  auto: boolean;
  /** insert attempts so retry re-runs the finish inspection. */
  attempt: number;
}

let handoffSlot: HandoffSlot | null = null;
let lastOrganizePath: string | null = null;
let organizeReopenFiles: File[] | null = null;
let resultGeneration = 0;
/** Whether this page currently holds the chunk-reload suspension. */
let w1HoldActive = false;

function isPdfEditorPath(pathname: string): boolean {
  const stripped = `/${stripLanguagePrefix(pathname).replace(/^\/+/, "")}`;
  return stripped === "/tools/pdf-editor" || stripped.startsWith("/tools/pdf-editor/");
}

/** Test hook: read the module handoff slot. */
export function __peekPdfHandoffSlotForTests(): { generation: number; inFlight: boolean; auto: boolean; attempt: number } | null {
  return handoffSlot
    ? { generation: handoffSlot.generation, inFlight: handoffSlot.inFlight, auto: handoffSlot.auto, attempt: handoffSlot.attempt }
    : null;
}

/** Test hook: reset the module handoff state. */
export function __clearPdfHandoffSlotForTests(): void {
  handoffSlot = null;
  organizeReopenFiles = null;
  if (w1HoldActive) {
    release();
    w1HoldActive = false;
  }
}

const RESULT_GUARD = {
  kind: "files" as const,
  scopePath: "/tools/pdf-editor",
  safePaths: [...PDF_EDITOR_SAFE_PATHS],
  messageKey: "pdf.messages.PdfEditorPage.unsavedResult",
};

/** finish 로드를 지연시킨 상태에서도 보호가 유지되는지 등의 D4-1 ack 순서. */
const HANDOFF_ACK_TIMEOUT_MS = 30_000;

type PdfEditorPageProps =
  | { mode: "organize"; organizePreset?: PdfOrganizePreset; finishPreset?: never }
  | { mode: "convert"; convertPreset?: PdfConvertPreset; finishPreset?: never }
  | { mode: "finish"; finishPreset: PdfFinishPreset };

export function PdfEditorPage(props: PdfEditorPageProps) {
  const { mode } = props;
  const language = useAppLanguage();
  const page = featureResource<PdfPageCopy>(language, "pdf.page");
  const definition = page.modes[mode];
  return (
    <UtilityPage toolId="pdf-editor" className={`max-w-none${mode === "organize" ? " max-[820px]:pb-[calc(170px+env(safe-area-inset-bottom))]" : ""}`}>
      <div className="pdf-tool-page" data-pdf-mode={mode}>
        <PageHeader eyebrow={definition.eyebrow} title={definition.title} description={definition.description}>
          <PrivacyBanner compact />
        </PageHeader>

        <PdfModeNavigation mode={mode} labels={page.navigation} ariaLabel={featureMessage(language, "pdf.messages.PdfEditorPage.pdfTools")} language={language} />

        {mode === "organize" && <OrganizeHandoffHost organizePreset={props.organizePreset} />}
        {mode === "finish" && <FinishHandoffHost preset={props.finishPreset} />}
        {mode === "convert" && <PdfConvertPanel preset={props.convertPreset} />}

        <PdfGuide mode={mode} />
      </div>
    </UtilityPage>
  );
}

/**
 * Organize side: owns the produced result, guards it (pdf-result), and starts
 * the prepared handoff. Remounts adopt the module slot (mode switches keep
 * the bytes; leaving pdf-editor discards them).
 */
function OrganizeHandoffHost({ organizePreset }: { organizePreset?: PdfOrganizePreset }) {
  const language = useAppLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const requestGuardedNavigate = useGuardedNavigate();
  const [retained, setRetained] = useState<RetainedOrganizeResult | null>(() => {
    if (handoffSlot) {
      const { inFlight, auto, attempt, ...result } = handoffSlot;
      void inFlight;
      void auto;
      void attempt;
      return result;
    }
    return null;
  });
  const [resultSaved, setResultSaved] = useState(false);
  const [reopenFiles, setReopenFiles] = useState<File[] | null>(() => {
    const files = organizeReopenFiles;
    organizeReopenFiles = null;
    return files;
  });
  const retainedRef = useRef(retained);
  retainedRef.current = retained;

  // Remember where organize was for [① 정리로 돌아가기].
  useEffect(() => {
    lastOrganizePath = `${location.pathname}${location.search}${location.hash}`;
  }, [location.pathname, location.search, location.hash]);

  const handleProduced = useCallback((produced: PdfOrganizeProducedResult) => {
    resultGeneration += 1;
    const next: HandoffSlot = {
      blob: produced.blob,
      name: produced.name,
      generation: resultGeneration,
      outputMode: produced.outputMode,
      inFlight: false,
      auto: false,
      attempt: 0,
    };
    handoffSlot = next;
    setRetained(next);
    setResultSaved(false);
  }, []);

  const handleInvalidated = useCallback(() => {
    handoffSlot = null;
    setRetained(null);
    setResultSaved(false);
  }, []);

  const handleSaved = useCallback(() => {
    // Download click / completed share: the bytes now exist outside the SPA,
    // so the result no longer blocks navigation. The payload stays for reuse
    // (handoff, suggestion) until it is invalidated or discarded.
    setResultSaved(true);
  }, []);

  const discardRetained = useCallback(() => {
    handoffSlot = null;
    setRetained(null);
    setResultSaved(false);
  }, []);

  const handleReopenConsumed = useCallback(() => {
    setReopenFiles(null);
  }, []);

  // W1 pdf-result (plan §4.1 T1): the parent owns the organize result until
  // it is saved, explicitly discarded, or handed to finish after its ack.
  // Managed directly (not useUnsavedWorkGuard): during the handoff the route
  // element remounts, and the finish instance adopts this exact entry.
  useEffect(() => {
    if (retained && !resultSaved) {
      setUnsavedWork("pdf-result", { hasWork: true, ...RESULT_GUARD });
    } else {
      clearUnsavedWork("pdf-result");
    }
    return () => {
      if (handoffSlot?.inFlight) return;
      if (w1HoldActive) {
        release();
        w1HoldActive = false;
      }
      clearUnsavedWork("pdf-result");
      if (typeof window !== "undefined" && !isPdfEditorPath(window.location.pathname)) {
        // Approved leave of pdf-editor: discard the retained bytes.
        handoffSlot = null;
      }
      // Mode switch inside pdf-editor: the next instance adopts handoffSlot.
    };
  }, [retained, resultSaved]);

  const requestHandoff = useCallback(() => {
    const current = retainedRef.current;
    if (!current || current.outputMode !== "merged") return;
    handoffSlot = { ...current, inFlight: true, auto: true, attempt: (handoffSlot?.attempt ?? 0) + 1 };
    if (!w1HoldActive) {
      holdAutoReload();
      w1HoldActive = true;
    }
    grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
    const target = localizedPath(language, "/tools/pdf-editor/watermark");
    requestGuardedNavigate(target, () => {
      navigate(target);
      return true;
    });
  }, [language, navigate, requestGuardedNavigate]);

  const retainedUrl = useMemo(() => (retained ? URL.createObjectURL(retained.blob) : null), [retained]);
  useEffect(() => () => {
    if (retainedUrl) URL.revokeObjectURL(retainedUrl);
  }, [retainedUrl]);

  return (
    <>
      <PdfOrganizePanel
        preset={organizePreset}
        initialFiles={reopenFiles}
        onInitialFilesConsumed={handleReopenConsumed}
        onResultProduced={handleProduced}
        onResultInvalidated={handleInvalidated}
        onResultSaved={handleSaved}
        onHandoffRequest={requestHandoff}
      />
      {retained && retainedUrl && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4" data-testid="pdf-retained-result" aria-live="polite">
          <strong className="text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfEditorPage.retainedResultTitle")}</strong>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{retained.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
              href={retainedUrl}
              download={retained.name}
              data-testid="pdf-retained-download"
            >
              {featureMessage(language, "pdf.messages.PdfEditorPage.retainedDownload")}
            </a>
            <Button type="button" variant="secondary" className="min-h-10 rounded-xl text-xs font-bold" data-testid="pdf-retained-send-to-finish" onClick={requestHandoff}>
              {featureMessage(language, "pdf.messages.PdfEditorPage.sendToFinish")}
            </Button>
            <Button type="button" variant="ghost" className="min-h-10 rounded-xl text-xs font-bold text-destructive" data-testid="pdf-retained-discard" onClick={discardRetained}>
              {featureMessage(language, "pdf.messages.PdfEditorPage.discardResult")}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Finish side: adopts the slot (auto intake or suggestion chip), acks only
 * after the finish inspection succeeds, and keeps the result otherwise.
 */
function FinishHandoffHost({ preset }: { preset: PdfFinishPreset }) {
  const language = useAppLanguage();
  const [slotTick, setSlotTick] = useState(0);
  const [intake, setIntake] = useState<{ blob: Blob; name: string; generation: number; attempt: number } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);
  const [boundaryKey, setBoundaryKey] = useState(0);
  const [LazyFinish, setLazyFinish] = useState(createLazyFinishPanel);
  const retryFinishLoad = useCallback(() => {
    // A rejected lazy import is cached by React: mint a fresh handle so the
    // retry actually refetches the chunk.
    setLazyFinish(createLazyFinishPanel());
    setBoundaryKey((key) => key + 1);
  }, []);
  const ackTimerRef = useRef<number | undefined>(undefined);
  const timedOutRef = useRef(false);
  timedOutRef.current = timedOut;
  // StrictMode remount guard: the mount adoption below must run once.
  const adoptedAttemptRef = useRef<number | null>(null);

  // Adopt the slot on mount: handoff (auto) or top-link arrival (suggest).
  useEffect(() => {
    const slot = handoffSlot;
    if (!slot) return;
    slot.inFlight = false;
    if (adoptedAttemptRef.current === slot.attempt) return;
    if (slot.auto) {
      adoptedAttemptRef.current = slot.attempt;
      slot.auto = false;
      setIntake({ blob: slot.blob, name: slot.name, generation: slot.generation, attempt: slot.attempt });
      // D4-1 ack timeout: without the finish ack the result stays here.
      const timer = window.setTimeout(() => {
        if (handoffSlot && !timedOutRef.current) {
          if (w1HoldActive) {
            release();
            w1HoldActive = false;
          }
          setTimedOut(true);
        }
      }, HANDOFF_ACK_TIMEOUT_MS);
      ackTimerRef.current = timer;
      return () => window.clearTimeout(timer);
    }
    // Suggestion: no auto insert; the chip below offers it.
    setSlotTick((tick) => tick + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (ackTimerRef.current !== undefined) {
      window.clearTimeout(ackTimerRef.current);
      ackTimerRef.current = undefined;
    }
  }, []);

  const clearAckTimer = () => {
    if (ackTimerRef.current !== undefined) {
      window.clearTimeout(ackTimerRef.current);
      ackTimerRef.current = undefined;
    }
  };

  const releaseHold = () => {
    if (w1HoldActive) {
      release();
      w1HoldActive = false;
    }
  };

  // W1 pdf-result adoption (plan §4.1 D4-1 steps 3-5): while finish has not
  // acked, the parent keeps hasWork so home/other/back/exit stay guarded.
  useEffect(() => {
    if (handoffSlot) {
      setUnsavedWork("pdf-result", { hasWork: true, ...RESULT_GUARD });
    } else {
      clearUnsavedWork("pdf-result");
    }
    return () => {
      if (handoffSlot?.inFlight) return;
      if (w1HoldActive) {
        release();
        w1HoldActive = false;
      }
      clearUnsavedWork("pdf-result");
      if (typeof window !== "undefined" && !isPdfEditorPath(window.location.pathname)) {
        handoffSlot = null;
      }
    };
    // Registry entries are module-global; slotTick re-runs adoption/cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotTick, intake, timedOut, failedAttempt, boundaryKey]);

  const handleAccepted = useCallback((generation: number) => {
    const slot = handoffSlot;
    // A stale ack (generation mismatch) must not move the protection.
    if (!slot || slot.generation !== generation) return;
    clearAckTimer();
    // Order (plan §4.1): finish true (set by the panel) -> ack -> result false.
    setUnsavedWork("pdf-result", { hasWork: false, ...RESULT_GUARD });
    handoffSlot = null;
    setIntake(null);
    setFailedAttempt(null);
    setTimedOut(false);
    releaseHold();
    setSlotTick((tick) => tick + 1);
  }, []);

  const handleFailed = useCallback((generation: number) => {
    const slot = handoffSlot;
    if (!slot || slot.generation !== generation) return;
    clearAckTimer();
    // The result stays; hold is released; the chip offers retry/download.
    releaseHold();
    setFailedAttempt(slot.attempt);
    setSlotTick((tick) => tick + 1);
  }, []);

  const requestInsert = useCallback(() => {
    const slot = handoffSlot;
    if (!slot) return;
    clearAckTimer();
    setTimedOut(false);
    setFailedAttempt(null);
    slot.attempt += 1;
    slot.auto = false;
    setIntake({ blob: slot.blob, name: slot.name, generation: slot.generation, attempt: slot.attempt });
    setSlotTick((tick) => tick + 1);
  }, []);

  const discardSlot = useCallback(() => {
    clearAckTimer();
    handoffSlot = null;
    setIntake(null);
    setFailedAttempt(null);
    setTimedOut(false);
    releaseHold();
    setSlotTick((tick) => tick + 1);
  }, []);

  const handleBackToOrganize = useCallback((files: File[]): string | null => {
    const slot = handoffSlot;
    if (slot) {
      organizeReopenFiles = [new File([slot.blob], slot.name, { type: "application/pdf" })];
      handoffSlot = null;
    } else if (files.length > 0) {
      organizeReopenFiles = [...files];
    } else {
      return null;
    }
    clearAckTimer();
    releaseHold();
    setIntake(null);
    setFailedAttempt(null);
    setTimedOut(false);
    setSlotTick((tick) => tick + 1);
    return lastOrganizePath ?? localizedPath(language, "/tools/pdf-editor");
  }, [language]);

  const slot = handoffSlot;
  const slotUrl = useMemo(() => (slot ? URL.createObjectURL(slot.blob) : null), [slot, slotTick]);
  useEffect(() => () => {
    if (slotUrl) URL.revokeObjectURL(slotUrl);
  }, [slotUrl]);
  const isSuggestion = !!slot && !intake && failedAttempt === null && !timedOut;
  const showChip = !!slot && (failedAttempt !== null || timedOut || isSuggestion);
  const chipFailed = failedAttempt !== null || timedOut;

  return (
    <>
      {slot && showChip && (
        <section className="mb-4 rounded-2xl border border-border bg-card p-4" data-testid="pdf-handoff-chip" aria-live="polite">
          <strong className="text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfEditorPage.retainedResultTitle")}</strong>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isSuggestion
              ? featureMessage(language, "pdf.finish.suggestionHint")
              : chipFailed
                ? featureMessage(language, "pdf.messages.PdfEditorPage.retainedResultFailed")
                : featureMessage(language, "pdf.messages.PdfEditorPage.retainedResultWaiting")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(failedAttempt !== null || timedOut || !intake) && (
              <Button type="button" variant="secondary" className="min-h-10 rounded-xl text-xs font-bold" data-testid="pdf-handoff-retry" onClick={requestInsert}>
                {isSuggestion
                  ? featureMessage(language, "pdf.finish.suggestionInsert")
                  : featureMessage(language, "pdf.messages.PdfEditorPage.retryIntake")}
              </Button>
            )}
            {slotUrl && (
              <a
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
                href={slotUrl}
                download={slot.name}
                data-testid="pdf-handoff-download"
                onClick={releaseHold}
              >
                {featureMessage(language, "pdf.messages.PdfEditorPage.retainedDownload")}
              </a>
            )}
            <Button type="button" variant="ghost" className="min-h-10 rounded-xl text-xs font-bold text-destructive" data-testid="pdf-handoff-discard" onClick={discardSlot}>
              {featureMessage(language, "pdf.messages.PdfEditorPage.discardResult")}
            </Button>
          </div>
        </section>
      )}
      <FinishLoadBoundary
        key={boundaryKey}
        language={language}
        downloadHref={slotUrl}
        downloadName={slot?.name}
        onDownloaded={releaseHold}
        onRetry={retryFinishLoad}
      >
        <Suspense fallback={<div className="tool-route-loading min-h-[420px]" role="status">{featureMessage(language, "pdf.messages.PdfEditorPage.loadingFinish")}</div>}>
          <ToolReady><LazyFinish
            preset={preset}
            handoffIntake={intake}
            onHandoffAccepted={handleAccepted}
            onHandoffFailed={handleFailed}
            organizePath={lastOrganizePath ?? localizedPath(language, "/tools/pdf-editor")}
            onBackToOrganize={handleBackToOrganize}
          /></ToolReady>
        </Suspense>
      </FinishLoadBoundary>
    </>
  );
}

/**
 * W1 local error boundary for finish (plan §4.1 D4-1): catches the finish
 * lazy-chunk load failure inside PdfEditorPage so the organize result
 * survives. The chunk-reload hold stays active, so no automatic reload or
 * error-document transition happens here.
 */
class FinishLoadBoundary extends Component<{
  language: ReturnType<typeof useAppLanguage>;
  downloadHref?: string | null;
  downloadName?: string;
  onDownloaded?: () => void;
  onRetry: () => void;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const language = this.props.language;
    return (
      <section className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4" data-testid="pdf-finish-load-failure" role="alert">
        <strong className="text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfEditorPage.finishLoadFailed")}</strong>
        <div className="mt-3 flex flex-wrap gap-2">
          {this.props.downloadHref && (
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
              href={this.props.downloadHref}
              download={this.props.downloadName}
              data-testid="pdf-finish-load-download"
              onClick={() => this.props.onDownloaded?.()}
            >
              {featureMessage(language, "pdf.messages.PdfEditorPage.retainedDownload")}
            </a>
          )}
          <Button type="button" variant="secondary" className="min-h-10 rounded-xl text-xs font-bold" data-testid="pdf-finish-load-retry" onClick={() => {
            this.setState({ failed: false });
            this.props.onRetry();
          }}>
            {featureMessage(language, "pdf.messages.PdfEditorPage.retryFinishLoad")}
          </Button>
        </div>
      </section>
    );
  }
}

function PdfModeNavigation({ mode, labels, ariaLabel, language }: {
  mode: PdfToolMode;
  labels: PdfPageCopy["navigation"];
  ariaLabel: string;
  language: ReturnType<typeof useAppLanguage>;
}) {
  const navigationRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useLayoutEffect(() => {
    const element = navigationRef.current;
    if (!element) return;
    const active = element.querySelector<HTMLElement>(`[data-pdf-nav-mode="${mode}"]`);
    if (active) element.scrollLeft = Math.max(0, active.offsetLeft - (element.clientWidth - active.offsetWidth) / 2);
  }, [mode]);

  useEffect(() => {
    const element = navigationRef.current;
    if (!element) return;
    const update = () => {
      const remaining = element.scrollWidth - element.clientWidth - element.scrollLeft;
      setOverflow({ left: element.scrollLeft > 2, right: remaining > 2 });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="relative mb-[17px]"
      data-testid="pdf-navigation-shell"
      data-scroll-cue={overflow.right ? "right" : overflow.left ? "left" : "none"}
    >
      <nav
        ref={navigationRef}
        className="pdf-tool-navigation grid grid-cols-[repeat(3,minmax(148px,1fr))] gap-1 overflow-x-auto rounded-2xl bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={ariaLabel}
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const selected = mode === item.mode;
          return (
            <NavLink
              key={item.mode}
              to={localizedPath(language, item.to)}
              end={item.mode === "organize"}
              data-active={selected || undefined}
              data-pdf-nav-mode={item.mode}
              className={`flex min-h-[43px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold outline-none transition-[color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-primary/30 ${selected ? "bg-card text-primary shadow-sm dark:text-primary" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
            >
              <Icon size={17} /><span>{labels[item.mode]}</span>
            </NavLink>
          );
        })}
      </nav>
      {overflow.left && <span aria-hidden="true" data-scroll-cue-side="left" className="pointer-events-none absolute inset-y-1 left-0 z-10 w-10 rounded-l-2xl bg-gradient-to-r from-background via-background/90 to-transparent" />}
      {overflow.right && <span aria-hidden="true" data-scroll-cue-side="right" className="pointer-events-none absolute inset-y-1 right-0 w-12 rounded-r-2xl bg-gradient-to-l from-background via-background/90 to-transparent" />}
    </div>
  );
}

function PdfGuide({ mode }: { mode: PdfToolMode }) {
  const language = useAppLanguage();
  const page = featureResource<PdfPageCopy>(language, "pdf.page");
  return <ToolGuideWrapper slug={mode === "convert" ? "pdfEditor.convert" : "pdfEditor.standard"} />;
}
