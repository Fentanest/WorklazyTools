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
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { tools } from "../app/toolRegistry";
import { AdSenseLoader } from "./AdSenseLoader";
import { RouteSeo } from "./RouteSeo";

const primaryNavigation = [
  { to: "/", label: "홈", icon: Home, end: true },
  { to: "/tools", label: "모든 도구", icon: Grid2X2, end: true },
  { to: "/about", label: "정보", icon: CircleHelp, end: true },
];
const GITHUB_ISSUES_URL = "https://github.com/Fentanest/WorklazyTools/issues";

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <RouteSeo />
      <AdSenseLoader />
      <aside className="sidebar glass-panel" aria-label="주요 내비게이션">
        <NavLink className="brand brand-image-link" to="/" aria-label="Worklazy Tools 홈">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Worklazy Tools" />
        </NavLink>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-caption">둘러보기</p>
            {primaryNavigation.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>

          <div className="nav-group">
            <p className="nav-caption">도구</p>
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <NavLink className="sidebar-link" key={tool.id} to={tool.path}>
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
            <span>파일·암호 전송 없이<br />브라우저에서 처리</span>
          </div>
          <NavItem {...primaryNavigation[2]} />
          <a className="sidebar-link" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            <span className="nav-icon accent-blue"><MessageSquarePlus size={18} /></span>
            <span>문의·건의</span>
          </a>
        </div>
      </aside>

      <header className="mobile-header glass-bar">
        <NavLink className="mobile-brand" to="/">
          <img className="mobile-brand-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Worklazy Tools" />
        </NavLink>
        <button
          className="icon-button"
          type="button"
          aria-label="도구 메뉴 열기"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={21} />
        </button>
      </header>

      <main className="main-content" id="main-content">
        <Outlet />
        <footer className="global-footer">
          <span>© {new Date().getFullYear()} Worklazy Tools</span>
          <nav aria-label="정책 및 문의">
            <NavLink to="/about">서비스 소개</NavLink>
            <NavLink to="/privacy">개인정보처리방침</NavLink>
            <NavLink to="/terms">이용약관</NavLink>
            <NavLink to="/licenses">라이선스·제3자 고지</NavLink>
            <NavLink to="/contact">문의</NavLink>
          </nav>
        </footer>
      </main>

      <nav className="bottom-tabs glass-bar" aria-label="모바일 내비게이션">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `bottom-tab${isActive ? " active" : ""}`}
            >
              <Icon size={21} strokeWidth={2.1} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {mobileMenuOpen && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <section
            className="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="도구 바로가기"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div>
                <p className="eyebrow">바로가기</p>
                <h2>어떤 작업을 할까요?</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="닫기">
                <X size={20} />
              </button>
            </div>
            <div className="sheet-tool-list">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <NavLink className="sheet-tool-item" to={tool.path} key={tool.id}>
                    <span className={`tool-icon small accent-${tool.accent}`}><Icon size={22} /></span>
                    <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
                  </NavLink>
                );
              })}
              <a className="sheet-tool-item" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
                <span className="tool-icon small accent-blue"><MessageSquarePlus size={22} /></span>
                <span><strong>문의·건의</strong><small>GitHub Issues에 오류와 기능 제안 남기기</small></span>
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon: typeof Home;
  end: boolean;
}

function NavItem({ to, label, icon: Icon, end }: NavItemProps) {
  return (
    <NavLink className="sidebar-link" to={to} end={end}>
      <span className="nav-icon"><Icon size={18} /></span>
      <span>{label}</span>
    </NavLink>
  );
}
