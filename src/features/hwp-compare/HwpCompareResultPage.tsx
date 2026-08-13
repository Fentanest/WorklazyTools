import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { DocumentCompareResultPage } from "../word-compare/WordCompareResultPage";
import { useHwpCompareSession } from "./hwpCompareSession";

export function HwpCompareResultPage() {
  const { results } = useHwpCompareSession();
  return (
    <DocumentCompareResultPage
      results={results}
      basePath="/tools/hwp-compare"
      toolLabel="HWP 비교"
      eyebrow="HWP COMPARE"
      accentClass="accent-context-orange"
      footer={<RhwpVersionNotice mode="compare" />}
    />
  );
}
