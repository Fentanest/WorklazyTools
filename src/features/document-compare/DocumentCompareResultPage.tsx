import { useEffect, useState } from "react";

import { useUnsavedWorkGuard } from "../../app/toolState";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { useAppLanguage } from "../../i18n/routing";
import { DocumentCompareResultPage as SharedDocumentCompareResultPage } from "../word-compare/WordCompareResultPage";
import { useDocumentCompareSession } from "./documentCompareSession";

export function DocumentCompareResultPage() {
  const language = useAppLanguage();
  const { results, beforeFiles, afterFiles } = useDocumentCompareSession();
  // S9 unsaved-work guard: leaving this page drops the in-memory session
  // files. Report downloads (rendered by the shared page below) mark the
  // work saved; the guard clears itself when the session is empty.
  const [saved, setSaved] = useState(false);
  useUnsavedWorkGuard("document-compare", (beforeFiles.length > 0 || afterFiles.length > 0) && !saved, {
    kind: "files",
    scopePath: "/tools/document-compare",
  });
  useEffect(() => {
    setSaved(false);
  }, [beforeFiles, afterFiles, results]);
  useEffect(() => {
    const onDownloadClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[download]");
      if (anchor) setSaved(true);
    };
    document.addEventListener("click", onDownloadClick, true);
    return () => document.removeEventListener("click", onDownloadClick, true);
  }, []);
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
