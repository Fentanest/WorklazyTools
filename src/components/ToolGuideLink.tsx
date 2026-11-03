import { useTranslation } from "react-i18next";

/** The same guide affordance in initial, empty, loading, and result states. */
export function ToolGuideLink({ className = "inline-block text-sm font-medium text-[var(--brand,theme(colors.blue.600))] hover:underline dark:text-[var(--brand,theme(colors.blue.400))]" }: { className?: string }) {
  const { t } = useTranslation("common");
  return <a href="#tool-guide-title" className={className}>{t("actions.guideLink")} &darr;</a>;
}
