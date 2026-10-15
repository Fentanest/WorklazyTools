import { useNavigate } from "react-router-dom";
import { useFileDropTarget } from "../../components/FileDropProvider";
import { useDocumentPairFiles } from "./useDocumentPairFiles";
import { isSupportedDocumentName } from "./filePairs";
import { startTransition, useEffect, useRef, useState } from "react";

import { useUnsavedWorkGuard } from "../../app/toolState";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import { DocumentCompareResultPage as SharedDocumentCompareResultPage } from "../word-compare/WordCompareResultPage";
import { useDocumentCompareSession } from "./documentCompareSession";

export function DocumentCompareResultPage() {
  const language = useAppLanguage();
  const session = useDocumentCompareSession();
  const { results, beforeFiles, afterFiles } = session;
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const inputPath = useLocalizedPath("/tools/document-compare");
  const pairFiles = useDocumentPairFiles({ beforeFiles, afterFiles,
    setBeforeFiles: session.setBeforeFiles, setAfterFiles: session.setAfterFiles,
    accepts: isSupportedDocumentName, onReset: session.clearResults });
  const receive = (files: File[], side: "before" | "after") => {
    // Commit result invalidation and the route change together. Otherwise the
    // old route briefly renders an expired result and its ad guard reloads the document.
    startTransition(() => {
      pairFiles.updateFiles([...(side === "before" ? beforeFiles : afterFiles), ...files], side);
      navigate(inputPath);
    });
  };
  useFileDropTarget({ element: () => dropRef.current, label: () => language === "en" ? "Before" : "수정 전",
    accept: ".docx,.doc,.hwp,.hwpx", disabled: false, scopeSelector: '[data-document-side="before"]', receive: files => receive(files, "before") });
  useFileDropTarget({ element: () => dropRef.current, label: () => language === "en" ? "After" : "수정 후",
    accept: ".docx,.doc,.hwp,.hwpx", disabled: false, scopeSelector: '[data-document-side="after"]', receive: files => receive(files, "after") });
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
  return <div ref={dropRef}><SharedDocumentCompareResultPage
    results={results}
    basePath="/tools/document-compare"
    toolLabel={language === "en" ? "document comparison" : "문서 비교"}
    eyebrow="DOCUMENT COMPARE"
    accentClass="accent-context-blue"
    trackedLabel={language === "en" ? "Tracked Word file" : "Word 변경 추적"}
    showCommentLegend
    footer={<RhwpVersionNotice mode="compare" />}
  /></div>;
}
