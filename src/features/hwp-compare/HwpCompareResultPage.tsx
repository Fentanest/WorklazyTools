import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { DocumentCompareResultPage } from "../word-compare/WordCompareResultPage";
import { useHwpCompareSession } from "./hwpCompareSession";
import { useAppLanguage } from "../../i18n/routing";

export function HwpCompareResultPage() {
  const language = useAppLanguage();
  const { results } = useHwpCompareSession();
  return (
    <DocumentCompareResultPage
      results={results}
      basePath="/tools/hwp-compare"
      toolLabel={language === "en" ? "HWP comparison" : "HWP 비교"}
      eyebrow="HWP COMPARE"
      accentClass="accent-context-orange"
      footer={<RhwpVersionNotice mode="compare" />}
    />
  );
}
