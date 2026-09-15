import { isVideoDirectPath, videoParentAssetUrl } from "../features/video-studio/videoDirectPaths";
import { isRedactorDocument, isRedactorPath } from "../app/redactorIsolation";
import {
  CircleHelp,
  Grid2X2,
  Home,
  LockKeyhole,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { GITHUB_ISSUES_URL } from "../constants/links";
import { localizedPath, stripLanguagePrefix } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";
import { useToolCatalog } from "../i18n/useToolCatalog";
import type { ToolCategoryId } from "../app/toolRegistry";
import { AdSenseLoader } from "./AdSenseLoader";
import { AnalyticsLoader, trackToolOpen } from "./AnalyticsLoader";
import { AppInstallControl } from "./AppInstallControl";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PrivacyConsentBanner } from "./PrivacyConsentBanner";
import { ThemeCycleButton } from "./ThemeCycleButton";
import { TopbarSearch } from "./TopbarSearch";
import { resetPrivacyConsent } from "./privacyConsent";
import { RouteSeo } from "./RouteSeo";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { toolIconAccentClasses } from "./toolAccentStyles";

const SIDEBAR_COLLAPSED_KEY = "worklazy-sidebar-collapsed";

const primaryNavigation = [
  { to: "/", labelKey: "navigation.home", icon: Home, end: true },
  { to: "/tools", labelKey: "navigation.allTools", icon: Grid2X2, end: true },
  { to: "/about", labelKey: "navigation.about", icon: CircleHelp, end: true },
];

const DISPLAY_GROUPS = [
  { id: "documents", categories: ["documents"] as ToolCategoryId[] },
  { id: "media", categories: ["media"] as ToolCategoryId[] },
  { id: "other", categories: ["text-data", "work", "security-share"] as ToolCategoryId[] },
] as const;

function readSidebarCollapsed(): boolean {
  try {
    return window.sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => readSidebarCollapsed());
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const { toolCategories, tools } = useToolCatalog();
  const location = useLocation();
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

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Collapsed state is a session nicety; ignore storage failures.
      }
      return next;
    });
  };

  const categoryById = new Map(toolCategories.map((category) => [category.id, category]));

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} triggerId="mobile-navigation-trigger">
      <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <RouteSeo />
      <VideoIsolationBoundary active={videoStudioActive} isolationDocument={videoIsolationDocument} onReady={setVideoControllerReady} onFailed={setVideoIsolationFailed} />
      <OfficeIsolationBoundary active={officeEditorAppActive} isolationDocument={officeIsolationDocument} language={language} />
      <ExcelPreserveIsolationBoundary active={excelPreserveActive} isolationDocument={excelIsolationDocument} language={language} />
      {!redactorActive && !redactorDocument && <AnalyticsLoader disabled={(videoStudioActive && !videoIsolationDocument) || officeEditorAppActive || excelPreserveActive} />}
      {!redactorActive && !redactorDocument && !videoStudioActive && !videoIsolationDocument && !officeEditorAppActive && !officeIsolationDocument && !excelPreserveActive && !excelIsolationDocument && <AdSenseLoader />}
      <header className="app-topbar" data-testid="app-topbar">
        <button
          type="button"
          className="icon-button topbar-collapse"
          aria-label={sidebarCollapsed ? t("navigation.expandSidebar") : t("navigation.collapseSidebar")}
          aria-expanded={!sidebarCollapsed}
          aria-controls="desktop-sidebar"
          onClick={toggleSidebarCollapsed}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <SheetTrigger
          id="mobile-navigation-trigger"
          render={<button className="icon-button topbar-menu" type="button" aria-label={t("navigation.openMenu")} />}
        >
          <Menu size={21} />
        </SheetTrigger>
        <NavLink className="topbar-brand" to={localizedPath(language, "/")} aria-label={`Worklazy Tools ${t("navigation.home")}`}>
          <img className="topbar-brand-logo" width={32} height={32} src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        </NavLink>
        <TopbarSearch />
        <LanguageSwitcher compact />
        <ThemeCycleButton compact />
        <a className="icon-button topbar-github" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer" aria-label={t("navigation.github")}>
          <MessageSquarePlus size={19} />
        </a>
      </header>
      <aside className="sidebar glass-panel" id="desktop-sidebar" data-testid="desktop-sidebar" aria-label={t("navigation.primaryLabel")}>
        <div className="sidebar-brand-panel">
          <NavLink className="sidebar-brand" to={localizedPath(language, "/")} aria-label={`Worklazy Tools ${t("navigation.home")}`}>
            <span className="sidebar-brand-mark" aria-hidden="true">W</span>
            <span className="sidebar-brand-word">Worklazy Tools</span>
            <span className="sidebar-brand-badge" aria-hidden="true">CLIENT SIDE</span>
          </NavLink>
          <p className="sidebar-brand-tagline">{t("navigation.brandTagline")}</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-caption">{t("navigation.browse")}</p>
            {primaryNavigation.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} language={language} label={t(item.labelKey as never)} />
            ))}
          </div>

          {DISPLAY_GROUPS.map((group) => {
            const groupTools = tools.filter((tool) => (group.categories as readonly string[]).includes(tool.category));
            if (!groupTools.length) return null;
            return (
              <div className="nav-group" key={group.id} data-display-group={group.id}>
                <p className="nav-caption">{t(`navigation.toolGroups.${group.id}` as never)}</p>
                {groupTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <NavLink className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`} key={tool.id} to={tool.path} onClick={() => trackToolOpen(tool.id, "sidebar", language)}>
                      <span className={`nav-icon accent-${tool.accent}`}><Icon size={18} /></span>
                      <span>{tool.shortTitle}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="local-processing-mini">
            <LockKeyhole size={16} />
            <span>{t("privacy.mini").split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</span>
          </div>
          <NavItem {...primaryNavigation[2]} language={language} label={t(primaryNavigation[2].labelKey as never)} />
          <a className="sidebar-link" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            <span className="nav-icon accent-blue"><MessageSquarePlus size={18} /></span>
            <span>{t("footer.feedback")}</span>
          </a>
          <div className="sidebar-install">
            <AppInstallControl />
          </div>
        </div>
      </aside>

      <main className={`main-content${redactorActive ? " redactor-main-content" : ""}`} id="main-content">
        <RouteErrorBoundary>{(!redactorActive || redactorDocument) && (!videoStudioActive || !import.meta.env.PROD || videoIsolationDocument && videoControllerReady) && <Outlet />}</RouteErrorBoundary>
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
        side="left"
        showCloseButton={false}
        overlayClassName="sheet-backdrop z-[80]"
        className="mobile-drawer z-[90]"
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
                <span className={`grid size-[43px] shrink-0 place-items-center rounded-[13px] shadow-[inset_0_1px_1px_rgba(255,255,255,.65)] ${toolIconAccentClasses[tool.accent]}`}><Icon size={22} /></span>
                <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
              </NavLink>
            );
          })}
          <a className="sheet-tool-item" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            <span className={`grid size-[43px] shrink-0 place-items-center rounded-[13px] shadow-[inset_0_1px_1px_rgba(255,255,255,.65)] ${toolIconAccentClasses.blue}`}><MessageSquarePlus size={22} /></span>
            <span><strong>{t("footer.feedback")}</strong><small>{t("footer.feedbackDescription")}</small></span>
          </a>
        </div>
        <div className="sheet-install">
          <AppInstallControl />
        </div>
      </SheetContent>
      </div>
    </Sheet>
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
      <span className="nav-icon"><Icon size={18} /></span>
      <span>{label}</span>
    </Link>
  );
}
