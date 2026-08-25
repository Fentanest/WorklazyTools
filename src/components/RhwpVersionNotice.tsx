import { Boxes, ExternalLink, ShieldCheck } from "lucide-react";

import { RHWP_UPSTREAM_URL, RHWP_VERSION } from "../config/rhwp";
import { useAppLanguage } from "../i18n/routing";

export function RhwpVersionNotice({ mode, compact = false }: {
  mode: "editor" | "compare";
  compact?: boolean;
}) {
  const language = useAppLanguage();
  const detail = mode === "editor"
    ? (language === "en" ? "Official Studio files are included with this site" : "공식 Studio 파일을 이 사이트에 포함해 제공")
    : (language === "en" ? "Official comparison files are included with this site" : "공식 비교 파일을 이 사이트에 포함해 제공");

  return (
    <footer className={`rhwp-version-notice${compact ? " compact" : ""}`} aria-label={language === "en" ? "rhwp version in use" : "rhwp 사용 버전"}>
      {mode === "editor" ? <ShieldCheck size={15} /> : <Boxes size={15} />}
      <span><strong>rhwp {RHWP_VERSION}</strong><small>{detail}</small></span>
      {!compact && <a href={RHWP_UPSTREAM_URL} target="_blank" rel="noreferrer">{language === "en" ? "Official open source" : "공식 오픈소스"} <ExternalLink size={12} /></a>}
    </footer>
  );
}
