import { isVideoDirectPath, videoParentAssetUrl } from "../features/video-studio/videoDirectPaths";
import { isRedactorDocument, isRedactorPath } from "../app/redactorIsolation";
import {
  CircleHelp,
  Github,
  Grid2X2,
  Home,
  LockKeyhole,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SunMoon,
  X,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const FocusModeContext = createContext<(mode: "standard" | "editor") => void>(() => {});
export function useFocusMode() { return useContext(FocusModeContext); }
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { GITHUB_ISSUES_URL } from "../constants/links";
import { localizedPath, stripLanguagePrefix } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";
import { useToolCatalog } from "../i18n/useToolCatalog";
import { useWorklazyTheme } from "../hooks/useWorklazyTheme";
import { cn } from "../lib/utils";
import { AdSenseLoader } from "./AdSenseLoader";
import { setAdIneligible } from "../app/adEligibility";

import { AnalyticsLoader, trackToolOpen } from "./AnalyticsLoader";
import { AppInstallControl } from "./AppInstallControl";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PrivacyConsentBanner } from "./PrivacyConsentBanner";
import { resetPrivacyConsent } from "./privacyConsent";
import { RouteSeo } from "./RouteSeo";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { getUnsavedWorkGeneration, getUnsavedWorkKind, hasUnsavedWork, isGuardedTarget, subscribeUnsavedWork } from "../app/toolState";
import { UnsavedWorkDialog } from "./UnsavedWorkDialog";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { getToolIconTone } from "./toolAccentStyles";
import { DocumentRedactorFallback } from "../features/document-redactor/DocumentRedactorFallback";


function isAdFreePath(pathname: string) {
  const p = stripLanguagePrefix(pathname);
  return p.startsWith("/tools/hwp-editor") || 
         p.startsWith("/tools/document-compare") || 
         p.startsWith("/tools/pdf-compare") || 
         p.startsWith("/tools/pdf-editor");
}

const GITHUB_REPO_URL = GITHUB_ISSUES_URL.replace(/\/issues\/?$/, "");

const primaryNavigation = [
  { to: "/", labelKey: "navigation.home", icon: Home, end: true },
  { to: "/tools", labelKey: "navigation.allTools", icon: Grid2X2, end: true },
  { to: "/about", labelKey: "navigation.about", icon: CircleHelp, end: true },
];
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<"standard" | "editor">("standard");
  useEffect(() => {
    const onFocus = (e: any) => setFocusMode(e.detail);
    window.addEventListener("worklazy-focus", onFocus);
    return () => window.removeEventListener("worklazy-focus", onFocus);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const { toolCategories, tools } = useToolCatalog();
  const { theme, cycleTheme } = useWorklazyTheme();
  const location = useLocation();
  const navigate = useNavigate();
  // S9 unsaved-work guard. The registry is consulted *before* the route
  // changes so "stay" keeps the tool state untouched. Works for sidebar
  // links, mobile tabs/sheet, home/tool cards, and in-body links because all
  // of them render plain anchors.
  const [, setGuardTick] = useState(0);
  useEffect(() => subscribeUnsavedWork(() => setGuardTick((tick) => tick + 1)), []);
  const unsavedActive = hasUnsavedWork();
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pendingTargetRef = useRef<string | null>(null);  // S9: store target URL for ad-free check
  const leaveAfterPopRef = useRef<(() => void) | null>(null);
  const [guardOpen, setGuardOpen] = useState(false);
  const guardEntryRef = useRef(false);
  const guardKeyRef = useRef<string | null>(null);
  const skipPopRef = useRef(false);
  const leaveApprovedRef = useRef<{
    targetUrl: string;
    sourceUrl: string;
    unsavedGeneration: number;
  } | null>(null);
  // Set while a confirmed "leave" is in flight so the sentinel effect below
  // neither re-pushes a guard entry nor pops one under the navigation.
  // Cleared on stay and whenever the pathname actually changes.
  const leavingRef = useRef(false);

  const closeGuardStay = useCallback(() => {
    leaveApprovedRef.current = null;
    pendingActionRef.current = null;
    pendingTargetRef.current = null;
    leavingRef.current = false;
    setGuardOpen(false);
    if (hasUnsavedWork() && !guardEntryRef.current) {
      window.history.pushState({ worklazyUnsavedGuard: true }, "", window.location.href);
      guardEntryRef.current = true;
      guardKeyRef.current = location.key;
    }
  }, [location.key]);

  const confirmGuardLeave = useCallback(() => {
    if (leavingRef.current) return;
    const action = pendingActionRef.current;
    const targetUrl = pendingTargetRef.current;
    pendingActionRef.current = null;
    pendingTargetRef.current = null;
    setGuardOpen(false);
    if (!action) return;
    leavingRef.current = true;

    // Check if destination is an ad-free path
    let targetIsAdFree = false;
    if (targetUrl) {
      try {
        const targetPathname = new URL(targetUrl, window.location.href).pathname;
        targetIsAdFree = isAdFreePath(targetPathname);
      } catch {
        targetIsAdFree = false;
      }
    }

    // For ad-free paths: skip history.back() to avoid async document navigation issues
    if (targetIsAdFree) {
      guardEntryRef.current = false;
      guardKeyRef.current = null;
      if (targetUrl) {
        leaveApprovedRef.current = {
          targetUrl,
          sourceUrl: window.location.href,
          unsavedGeneration: getUnsavedWorkGeneration(),
        };
        window.location.assign(targetUrl);
        return;
      }
      action();
      return;
    }

    // For normal paths: use history.back() pathway
    if (guardEntryRef.current) {
      // Remove our same-URL guard entry first so Back from the destination
      // behaves normally, then run the pending navigation once it pops.
      guardEntryRef.current = false;
      guardKeyRef.current = null;
      skipPopRef.current = true;
      leaveAfterPopRef.current = action;
      window.history.back();
    } else {
      action();
    }
  }, []);

  const requestGuardedNavigate = useCallback((to: string, perform: () => void) => {
    let target: URL | null = null;
    try {
      target = new URL(to, window.location.href);
    } catch {
      perform();
      return;
    }
    if (target.origin !== window.location.origin) {
      perform();
      return;
    }
    const targetStripped = stripLanguagePrefix(target.pathname).replace(/\/+$/, "") || "/";
    const currentStripped = stripLanguagePrefix(window.location.pathname).replace(/\/+$/, "") || "/";
    if (targetStripped === currentStripped || !hasUnsavedWork() || !isGuardedTarget(targetStripped)) {
      perform();
      return;
    }
    pendingActionRef.current = perform;
    pendingTargetRef.current = target.href;  // S9: store full URL for ad-free path check
    leaveApprovedRef.current = null;
    setGuardOpen(true);
  }, []);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null | undefined;
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (/^(mailto|tel|sms|blob|data|javascript):/i.test(href)) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const targetStripped = stripLanguagePrefix(url.pathname).replace(/\/+$/, "") || "/";
      const currentStripped = stripLanguagePrefix(window.location.pathname).replace(/\/+$/, "") || "/";
      if (targetStripped === currentStripped) return;
      if (!hasUnsavedWork() || !isGuardedTarget(targetStripped)) return;
      event.preventDefault();
      event.stopPropagation();
      const destination = `${url.pathname}${url.search}${url.hash}`;
      pendingActionRef.current = () => navigate(destination);
      pendingTargetRef.current = url.href;
      leaveApprovedRef.current = null;
      setGuardOpen(true);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [navigate]);

  useEffect(() => {
    if (!unsavedActive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const approved = leaveApprovedRef.current;
      if (
        approved
        && approved.sourceUrl === window.location.href
        && approved.unsavedGeneration === getUnsavedWorkGeneration()
      ) {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedActive]);

  useEffect(() => {
    const onPageShow = () => {
      leaveApprovedRef.current = null;
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    leavingRef.current = false;
  }, [location.pathname, location.key]);

  useEffect(() => {
    if (leavingRef.current) return;
    if (unsavedActive && !guardOpen) {
      // Keep a guard entry at the top of the stack (also after exempt
      // same-scope navigations, which push real entries above it) so Back is
      // always intercepted first and silent removal only ever pops our own
      // same-URL entry.
      if (!guardEntryRef.current || guardKeyRef.current !== location.key) {
        window.history.pushState({ worklazyUnsavedGuard: true }, "", window.location.href);
        guardEntryRef.current = true;
        guardKeyRef.current = location.key;
      }
    } else if (!unsavedActive && guardEntryRef.current) {
      guardEntryRef.current = false;
      guardKeyRef.current = null;
      skipPopRef.current = true;
      window.history.back();
    }
  }, [unsavedActive, guardOpen, location.key]);

  useEffect(() => {
    const onPopState = () => {
      leaveApprovedRef.current = null;
      if (skipPopRef.current) {
        skipPopRef.current = false;
        const deferred = leaveAfterPopRef.current;
        leaveAfterPopRef.current = null;
        deferred?.();
        return;
      }
      if (!guardEntryRef.current) return;
      guardEntryRef.current = false;
      guardKeyRef.current = null;
      if (hasUnsavedWork()) {
        pendingActionRef.current = () => {
          window.history.back();
        };
        leaveApprovedRef.current = null;
        setGuardOpen(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const adFree = isAdFreePath(location.pathname);
  useEffect(() => {
    if (adFree && document.querySelector("script[data-worklazy-adsense]")) {
      window.location.replace(window.location.href);
    }
  }, [adFree]);
  const normalizedPath = stripLanguagePrefix(location.pathname).replace(/\/+$/, "") || "/";
  const redactorActive = isRedactorPath(location.pathname);
  const redactorDocument = isRedactorDocument();
  useEffect(() => { if (import.meta.env.PROD && redactorActive !== redactorDocument) window.location.replace(window.location.href); }, [redactorActive, redactorDocument]);
  const videoStudioActive = isVideoDirectPath(location.pathname, import.meta.env.BASE_URL);
  const officeEditorAppActive = normalizedPath === "/tools/office-editor/app";
  const excelPreserveActive = normalizedPath === "/tools/excel-merger/xls-preserve";
  const [videoControllerReady, setVideoControllerReady] = useState(false);
  const [videoIsolationFailed, setVideoIsolationFailed] = useState(false);
  const videoIsolationDocument = Boolean(document.querySelector('meta[name="worklazy-video-isolation"]'));
  const officeIsolationDocument = Boolean(document.querySelector('meta[name="worklazy-office-isolation"]'));
  const excelIsolationDocument = Boolean(document.querySelector('meta[name="worklazy-excel-preserve-isolation"]'));

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 820px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileMenuOpen(false);
    };
    mobileViewport.addEventListener("change", closeAtDesktop);
    return () => mobileViewport.removeEventListener("change", closeAtDesktop);
  }, []);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 820px)").matches) setMobileMenuOpen(true);
    else setSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <FocusModeContext.Provider value={setFocusMode}>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} triggerId="mobile-navigation-trigger">
      <div className={cn("app-shell", sidebarCollapsed && "wl-collapsed", focusMode === "editor" && "editor-mode")}>
      <RouteSeo />
      <VideoIsolationBoundary active={videoStudioActive} isolationDocument={videoIsolationDocument} onReady={setVideoControllerReady} onFailed={setVideoIsolationFailed} />
      <OfficeIsolationBoundary active={officeEditorAppActive} isolationDocument={officeIsolationDocument} language={language} />
      <ExcelPreserveIsolationBoundary active={excelPreserveActive} isolationDocument={excelIsolationDocument} language={language} />
      {!redactorActive && !redactorDocument && <AnalyticsLoader disabled={(videoStudioActive && !videoIsolationDocument) || officeEditorAppActive || excelPreserveActive} />}
      {!redactorActive && !redactorDocument && !videoStudioActive && !videoIsolationDocument && !officeEditorAppActive && !officeIsolationDocument && !excelPreserveActive && !excelIsolationDocument && !adFree && <AdSenseLoader />}
      <aside className="sidebar glass-panel" aria-label={t("navigation.primaryLabel")}>
        <NavLink className="brand-card" to={localizedPath(language, "/")} aria-label={`Worklazy Tools ${t("navigation.home")}`}>
          <svg
            className="brand-panel-art"
            viewBox="0 0 264 144"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <polygon
              points="244,0 264,0 264,44 164,144 116,144"
              fill="var(--brand-facet-back)"
            />
            <polygon
              points="264,44 264,144 164,144"
              fill="var(--brand-facet-front)"
            />
          </svg>
          <span className="brand-card-row">
            <span className="brand-mark" aria-hidden="true">W</span>
            <span className="brand-name">Worklazy Tools</span>
          </span>
          <span className="brand-side-pill">CLIENT SIDE</span>
          <span className="brand-tagline">{t("brand.tagline")}</span>
        </NavLink>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-caption">{t("navigation.browse")}</p>
            {primaryNavigation.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} language={language} label={t(item.labelKey as never)} />
            ))}
          </div>

          {toolCategories.map((category) => {
            const categoryTools = tools.filter((tool) => tool.category === category.id);
            if (!categoryTools.length) return null;
            return (
              <div className="nav-group" key={category.id}>
                <p className="nav-caption">{category.shortLabel}</p>
                {categoryTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <NavLink className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`} key={tool.id} to={tool.path} onClick={() => trackToolOpen(tool.id, "sidebar", language)}>
                      <span className={cn("nav-icon tone-icon-badge")} data-icon-tone={getToolIconTone(tool.id)}><Icon size={17} /></span>
                      <span>{tool.shortTitle}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-assure">
            <LockKeyhole size={16} />
            <span>{t("privacy.mini").split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</span>
          </div>
          <NavItem {...primaryNavigation[2]} language={language} label={t(primaryNavigation[2].labelKey as never)} />
          <a className="sidebar-link" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            <span className={cn("nav-icon tone-icon-badge")} data-icon-tone="utility"><MessageSquarePlus size={17} /></span>
            <span>{t("footer.feedback")}</span>
          </a>
        </div>
      </aside>

      <header className="mobile-header glass-bar">
        <NavLink className="mobile-brand" to={localizedPath(language, "/")}>
          <img className="mobile-brand-logo" src={`${import.meta.env.BASE_URL}${theme.startsWith("light-") ? "logo-light.svg" : "logo.svg"}`} alt="Worklazy Tools" />
        </NavLink>
        <div className="mobile-header-actions">
          <AppInstallControl />
          <SheetTrigger
            id="mobile-navigation-trigger"
            render={<button className="icon-button" type="button" aria-label={t("navigation.openMenu")} />}
          >
            <Menu size={21} />
          </SheetTrigger>
          <LanguageSwitcher compact />
        </div>
      </header>

      {focusMode !== "editor" && <TopBar theme={theme} onCycleTheme={cycleTheme} onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} onGuardedNavigate={requestGuardedNavigate} />}

      <main className={`main-content${redactorActive ? " redactor-main-content" : ""}`} id="main-content">
        <RouteErrorBoundary>
          {(!redactorActive || redactorDocument) && (!videoStudioActive || !import.meta.env.PROD || videoIsolationDocument && videoControllerReady) && <Outlet />}
          {redactorActive && !redactorDocument && <DocumentRedactorFallback />}
        </RouteErrorBoundary>
        {import.meta.env.PROD && videoStudioActive && !videoControllerReady && <div className="tool-route-loading min-h-[420px]" role="status">{videoIsolationFailed ? (language === "ko" ? "비디오 도구를 준비하지 못했습니다. 페이지를 새로고침해 다시 시도하세요." : "The video tool could not start. Refresh the page to try again.") : t("status.loadingTool", { tool: "Video Studio" })}</div>}
        <footer className="global-footer">
          <span>© {new Date().getFullYear()} Worklazy Tools</span>
          <nav aria-label={t("footer.policyLabel")}>
            <NavLink to={localizedPath(language, "/about")}>{t("footer.service")}</NavLink>
            <NavLink to={localizedPath(language, "/privacy")}>{t("footer.privacy")}</NavLink>
            <NavLink to={localizedPath(language, "/terms")}>{t("footer.terms")}</NavLink>
            <NavLink to={localizedPath(language, "/licenses")}>{t("footer.licenses")}</NavLink>
            <NavLink to={localizedPath(language, "/contact")}>{t("footer.contact")}</NavLink>
            <button type="button" className="footer-link-button" onClick={resetPrivacyConsent}>{t("footer.consentSettings")}</button>
          </nav>
        </footer>
      </main>
      <PrivacyConsentBanner />
      <UnsavedWorkDialog
        open={guardOpen}
        kind={getUnsavedWorkKind()}
        onStay={closeGuardStay}
        onLeave={confirmGuardLeave}
      />

      <nav className="bottom-tabs glass-bar" aria-label={t("navigation.mobileLabel")}>
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={localizedPath(language, item.to)}
              end={item.end}
              className={({ isActive }) => `bottom-tab${isActive ? " active" : ""}`}
            >
              <Icon size={21} strokeWidth={2.1} />
              <span>{t(item.labelKey as never)}</span>
            </NavLink>
          );
        })}
      </nav>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        overlayClassName="sheet-backdrop z-[80]"
        className="mobile-sheet z-[90] max-h-[calc(100dvh-20px)] overflow-hidden data-[side=bottom]:inset-x-[10px] data-[side=bottom]:bottom-[10px] data-[side=bottom]:w-auto data-[side=bottom]:max-w-[520px] data-[side=bottom]:rounded-[28px]"
        aria-label={t("navigation.shortcuts")}
        aria-modal="true"
      >
        <div className="sheet-grabber" />
        <div className="sheet-header">
          <div>
            <p className="mb-2 text-sm font-extrabold tracking-[.14em] text-muted-foreground">{t("navigation.shortcuts")}</p>
            <SheetTitle className="text-[23px] font-bold tracking-[-0.045em]">{t("navigation.chooseTask")}</SheetTitle>
          </div>
          <SheetClose render={<button className="icon-button subtle" type="button" aria-label={t("navigation.close")} />}>
            <X size={20} />
          </SheetClose>
        </div>
        <div className="sheet-tool-list min-h-0 flex-1 overflow-y-auto">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <NavLink className="sheet-tool-item" to={tool.path} key={tool.id} onClick={() => trackToolOpen(tool.id, "mobile_sheet", language)}>
                <span className="grid size-[43px] shrink-0 place-items-center rounded-[13px] shadow-[inset_0_1px_1px_rgba(255,255,255,.65)] tone-icon-badge" data-icon-tone={getToolIconTone(tool.id)}><Icon size={22} /></span>
                <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
              </NavLink>
            );
          })}
          <a className="sheet-tool-item" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            <span className="grid size-[43px] shrink-0 place-items-center rounded-[13px] shadow-[inset_0_1px_1px_rgba(255,255,255,.65)] tone-icon-badge" data-icon-tone="utility"><MessageSquarePlus size={22} /></span>
            <span><strong>{t("footer.feedback")}</strong><small>{t("footer.feedbackDescription")}</small></span>
          </a>
        </div>
      </SheetContent>
      </div>
    </Sheet>
    </FocusModeContext.Provider>
  );
}

function TopBar({ theme, onCycleTheme, onToggleSidebar, sidebarCollapsed, onGuardedNavigate }: {
  theme: string;
  onCycleTheme: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  onGuardedNavigate: (to: string, perform: () => void) => void;
}) {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const CollapseIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    const search = next.toString();
    const to = `${localizedPath(language, "/tools")}${search ? `?${search}` : ""}`;
    onGuardedNavigate(to, () => {
      navigate(to);
      trackToolOpen("topbar-search", "topbar", language);
    });
  };

  return (
    <div className="wl-topbar" role="region" aria-label={t("topbar.regionLabel")}>
      <button type="button" className="wl-icon-button" onClick={onToggleSidebar} aria-label={t("topbar.toggleSidebar")}>
        <CollapseIcon size={20} />
      </button>
      <form className="wl-search" role="search" onSubmit={submitSearch}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("topbar.searchPlaceholder")}
          aria-label={t("topbar.searchLabel")}
        />
        <kbd>Ctrl + K</kbd>
      </form>
      <LanguageSwitcher compact />
      <button
        type="button"
        className="wl-icon-button wl-theme-button"
        onClick={onCycleTheme}
        aria-label={t("theme.label")}
        title={`${t("theme.label")}: ${t(`theme.${theme}` as never)}`}
      >
        <SunMoon size={19} />
        <span className="wl-theme-dot" aria-hidden="true" />
      </button>
      <a className="wl-icon-button wl-github-button" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" aria-label={t("topbar.githubLabel")}>
        <Github size={19} />
      </a>
    </div>
  );
}

function VideoIsolationBoundary({ active, isolationDocument, onReady, onFailed }: { active: boolean; isolationDocument: boolean; onReady: (ready: boolean) => void; onFailed: (failed: boolean) => void }) {
  // A language-only SPA change keeps the original document/controller and all input state.
  const [workerUrl] = useState(() => videoParentAssetUrl(window.location.pathname, import.meta.env.BASE_URL, window.location.origin, "coi-serviceworker.js").href);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (active !== isolationDocument) { window.location.replace(window.location.href); return; }
    if (!active) return;
    if (!navigator.serviceWorker) { onFailed(true); return; }
    let disposed = false;
    let watchedWorker: ServiceWorker | null = null;
    const check = () => {
      if (disposed) return;
      if (navigator.serviceWorker.controller?.scriptURL === workerUrl) {
        if (window.crossOriginIsolated) onReady(true);
        else window.location.reload();
      } else if (watchedWorker?.state === "activated") window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", check);
    void navigator.serviceWorker.register(workerUrl, { scope: new URL("./", workerUrl).href }).then(registration => {
      if (disposed) return;
      watchedWorker = registration.active ?? registration.installing ?? registration.waiting;
      watchedWorker?.addEventListener("statechange", check);
      check();
    }).catch(() => { if (!disposed) onFailed(true); });
    return () => { disposed = true; navigator.serviceWorker.removeEventListener("controllerchange", check); watchedWorker?.removeEventListener("statechange", check); };
  }, [active, isolationDocument, onReady, onFailed, workerUrl]);
  return null;
}

function OfficeIsolationBoundary({ active, isolationDocument, language }: { active: boolean; isolationDocument: boolean; language: "ko" | "en" }) {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (active && !isolationDocument) {
      const target = new URL(window.location.href);
      target.pathname = localizedPath(language, "/tools/office-editor/app/");
      window.location.replace(target.href);
      return;
    }
    if (!active && isolationDocument) window.location.replace(window.location.href);
  }, [active, isolationDocument, language]);

  return null;
}

function ExcelPreserveIsolationBoundary({ active, isolationDocument, language }: { active: boolean; isolationDocument: boolean; language: "ko" | "en" }) {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (active && !isolationDocument) {
      const target = new URL(window.location.href);
      target.pathname = localizedPath(language, "/tools/excel-merger/xls-preserve/");
      window.location.replace(target.href);
      return;
    }
    if (!active && isolationDocument) window.location.replace(window.location.href);
  }, [active, isolationDocument, language]);

  return null;
}

interface NavItemProps {
  to: string;
  label: string;
  labelKey?: string;
  icon: typeof Home;
  end: boolean;
  language: "ko" | "en";
}

function NavItem({ to, label, icon: Icon, language }: NavItemProps) {
  const location = useLocation();
  const currentPath = stripLanguagePrefix(location.pathname).replace(/\/+$/, "") || "/";
  const active = currentPath === to;
  return (
    <Link className={`sidebar-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} to={localizedPath(language, to)}>
      <span className="nav-icon nav-icon-plain"><Icon size={17} /></span>
      <span>{label}</span>
    </Link>
  );
}
