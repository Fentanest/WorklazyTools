import {
  CircleHelp,
  Grid2X2,
  Home,
  LockKeyhole,
  Menu,
  MessageSquarePlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { GITHUB_ISSUES_URL } from "../constants/links";
import { localizedPath, stripLanguagePrefix } from "../i18n/languages";
import { useAppLanguage } from "../i18n/routing";
import { useToolCatalog } from "../i18n/useToolCatalog";
import { AdSenseLoader } from "./AdSenseLoader";
import { AnalyticsLoader, trackToolOpen } from "./AnalyticsLoader";
import { AppInstallControl } from "./AppInstallControl";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PrivacyConsentBanner } from "./PrivacyConsentBanner";
import { resetPrivacyConsent } from "./privacyConsent";
import { RouteSeo } from "./RouteSeo";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { toolIconAccentClasses } from "./toolAccentStyles";

const primaryNavigation = [
  { to: "/", labelKey: "navigation.home", icon: Home, end: true },
  { to: "/tools", labelKey: "navigation.allTools", icon: Grid2X2, end: true },
  { to: "/about", labelKey: "navigation.about", icon: CircleHelp, end: true },
];
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const { tools } = useToolCatalog();
  const location = useLocation();
  const normalizedPath = stripLanguagePrefix(location.pathname).replace(/\/+$/, "") || "/";
  const videoStudioActive = normalizedPath === "/tools/video-studio";
  const officeEditorAppActive = normalizedPath === "/tools/office-editor/app";
  const excelPreserveActive = normalizedPath === "/tools/excel-merger/xls-preserve";
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

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} triggerId="mobile-navigation-trigger">
      <div className="app-shell">
      <RouteSeo />
      <VideoIsolationBoundary active={videoStudioActive} isolationDocument={videoIsolationDocument} language={language} />
      <OfficeIsolationBoundary active={officeEditorAppActive} isolationDocument={officeIsolationDocument} language={language} />
      <ExcelPreserveIsolationBoundary active={excelPreserveActive} isolationDocument={excelIsolationDocument} language={language} />
      <AnalyticsLoader disabled={(videoStudioActive && !videoIsolationDocument) || officeEditorAppActive || excelPreserveActive} />
      {!videoStudioActive && !videoIsolationDocument && !officeEditorAppActive && !officeIsolationDocument && !excelPreserveActive && !excelIsolationDocument && <AdSenseLoader />}
      <aside className="sidebar glass-panel" aria-label={t("navigation.primaryLabel")}>
        <NavLink className="brand brand-image-link" to={localizedPath(language, "/")} aria-label={`Worklazy Tools ${t("navigation.home")}`}>
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Worklazy Tools" />
        </NavLink>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-caption">{t("navigation.browse")}</p>
            {primaryNavigation.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} language={language} label={t(item.labelKey as never)} />
            ))}
          </div>

          <div className="nav-group">
            <p className="nav-caption">{t("navigation.tools")}</p>
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <NavLink className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`} key={tool.id} to={tool.path} onClick={() => trackToolOpen(tool.id, "sidebar", language)}>
                  <span className={`nav-icon accent-${tool.accent}`}><Icon size={18} /></span>
                  <span>{tool.shortTitle}</span>
                </NavLink>
              );
            })}
          </div>
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
        </div>
      </aside>

      <header className="mobile-header glass-bar">
        <NavLink className="mobile-brand" to={localizedPath(language, "/")}>
          <img className="mobile-brand-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Worklazy Tools" />
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

      <nav className="desktop-language-switcher" aria-label={t("language.switchLabel")}><LanguageSwitcher /></nav>

      <main className="main-content" id="main-content">
        <RouteErrorBoundary><Outlet /></RouteErrorBoundary>
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
      </SheetContent>
      </div>
    </Sheet>
  );
}

function VideoIsolationBoundary({ active, isolationDocument, language }: { active: boolean; isolationDocument: boolean; language: "ko" | "en" }) {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (active && !isolationDocument) {
      const target = new URL(window.location.href);
      target.pathname = localizedPath(language, "/tools/video-studio/");
      window.location.replace(target.href);
      return;
    }
    if (!active && isolationDocument) window.location.replace(window.location.href);
  }, [active, isolationDocument, language]);

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
