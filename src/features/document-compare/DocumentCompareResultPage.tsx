import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { useAppLanguage } from "../../i18n/routing";
import { DocumentCompareResultPage as SharedDocumentCompareResultPage } from "../word-compare/WordCompareResultPage";
import { useDocumentCompareSession } from "./documentCompareSession";

export function DocumentCompareResultPage() {
  const language = useAppLanguage();
  const { results } = useDocumentCompareSession();
  return <SharedDocumentCompareResultPage
    results={results}
    basePath="/tools/document-compare"
    toolLabel={language === "en" ? "document comparison" : "문서 비교"}
    eyebrow="DOCUMENT COMPARE"
    accentClass="accent-context-blue"
    trackedLabel={language === "en" ? "Tracked Word file" : "Word 변경 추적"}
    showCommentLegend
    footer={<RhwpVersionNotice mode="compare" />}
  />;
}
