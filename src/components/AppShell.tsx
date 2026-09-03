import {
  CircleHelp,
  Grid2X2,
  Home,
  LockKeyhole,
  Menu,
  MessageSquarePlus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation } from "react-router-dom";

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
import { GITHUB_ISSUES_URL } from "../constants/links";

const primaryNavigation = [
  { to: "/", labelKey: "navigation.home", icon: Home, end: true },
  { to: "/tools", labelKey: "navigation.allTools", icon: Grid2X2, end: true },
  { to: "/about", labelKey: "navigation.about", icon: CircleHelp, end: true },
];
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileSheetRef = useRef<HTMLElement>(null);
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
    if (!mobileMenuOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const sheet = mobileSheetRef.current;
    const focusable = () => Array.from(sheet?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileMenuOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
  }, [mobileMenuOpen]);

  return (
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
                <NavLink className="sidebar-link" key={tool.id} to={tool.path} onClick={() => trackToolOpen(tool.id, "sidebar", language)}>
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
          <button
            className="icon-button"
            type="button"
            aria-label={t("navigation.openMenu")}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={21} />
          </button>
          <LanguageSwitcher compact />
        </div>
      </header>

      <div className="desktop-language-switcher"><LanguageSwitcher /></div>

      <main className="main-content" id="main-content">
        <Outlet />
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

      {mobileMenuOpen && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <section
            ref={mobileSheetRef}
            className="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("navigation.shortcuts")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div>
                <p className="eyebrow">{t("navigation.shortcuts")}</p>
                <h2>{t("navigation.chooseTask")}</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setMobileMenuOpen(false)} aria-label={t("navigation.close")}>
                <X size={20} />
              </button>
            </div>
            <div className="sheet-tool-list">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <NavLink className="sheet-tool-item" to={tool.path} key={tool.id} onClick={() => trackToolOpen(tool.id, "mobile_sheet", language)}>
                    <span className={`tool-icon small accent-${tool.accent}`}><Icon size={22} /></span>
                    <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
                  </NavLink>
                );
              })}
              <a className="sheet-tool-item" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
                <span className="tool-icon small accent-blue"><MessageSquarePlus size={22} /></span>
                <span><strong>{t("footer.feedback")}</strong><small>{t("footer.feedbackDescription")}</small></span>
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
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

function NavItem({ to, label, icon: Icon, end, language }: NavItemProps) {
  return (
    <NavLink className="sidebar-link" to={localizedPath(language, to)} end={end}>
      <span className="nav-icon"><Icon size={18} /></span>
      <span>{label}</span>
    </NavLink>
  );
}
