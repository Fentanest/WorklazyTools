import { Boxes, ExternalLink, ShieldCheck } from "lucide-react";

import { RHWP_UPSTREAM_URL, RHWP_VERSION } from "../config/rhwp";
import { useAppLanguage } from "../i18n/routing";
import { cn } from "../lib/utils";

export function RhwpVersionNotice({ mode, compact = false }: {
  mode: "editor" | "compare";
  compact?: boolean;
}) {
  const language = useAppLanguage();
  const detail = mode === "editor"
    ? (language === "en" ? "Official Studio files are included with this site" : "공식 Studio 파일을 이 사이트에 포함해 제공")
    : (language === "en" ? "Official comparison files are included with this site" : "공식 비교 파일을 이 사이트에 포함해 제공");

  return (
    <footer
      data-slot="rhwp-version-notice"
      data-compact={compact ? "true" : undefined}
      className={cn(
        "mt-6 flex min-h-11 items-center gap-[9px] rounded-[13px] border border-orange-500/20 bg-orange-500/10 px-3 py-[9px] text-orange-700 dark:text-orange-300",
        compact && "m-0 min-h-[27px] shrink-0 rounded-none border-x-0 border-b-0 px-2.5 py-1",
      )}
      aria-label={language === "en" ? "rhwp version in use" : "rhwp 사용 버전"}
    >
      {mode === "editor" ? <ShieldCheck size={15} /> : <Boxes size={15} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-[13px] text-foreground">rhwp {RHWP_VERSION}</strong><small className="text-xs leading-[1.35] text-muted-foreground">{detail}</small></span>
      {!compact && <a className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-orange-700 hover:underline dark:text-orange-300" href={RHWP_UPSTREAM_URL} target="_blank" rel="noreferrer">{language === "en" ? "Official open source" : "공식 오픈소스"} <ExternalLink size={12} /></a>}
    </footer>
  );
}
