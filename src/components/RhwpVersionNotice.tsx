import { Boxes, ExternalLink, ShieldCheck } from "lucide-react";

import { RHWP_UPSTREAM_URL, RHWP_VERSION } from "../config/rhwp";

export function RhwpVersionNotice({ mode, compact = false }: {
  mode: "editor" | "compare";
  compact?: boolean;
}) {
  const detail = mode === "editor"
    ? "공식 Studio 정적 빌드를 이 사이트에 포함해 실행"
    : "@rhwp/core WebAssembly를 이 사이트에 포함해 Worker에서 실행";

  return (
    <footer className={`rhwp-version-notice${compact ? " compact" : ""}`} aria-label="rhwp 사용 버전">
      {mode === "editor" ? <ShieldCheck size={15} /> : <Boxes size={15} />}
      <span><strong>rhwp {RHWP_VERSION}</strong><small>{detail}</small></span>
      {!compact && <a href={RHWP_UPSTREAM_URL} target="_blank" rel="noreferrer">공식 오픈소스 <ExternalLink size={12} /></a>}
    </footer>
  );
}
