import { defaultFormattingMask, type FormattingMask } from "./formattingMask";
import { createContext, type Dispatch, type SetStateAction, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import type { WordCompareResult } from "../excel-merger/types";
import { documentFileKey } from "./filePairs";
import { useComparisonResults } from "./useComparisonResults";

export interface DocumentPairResult {
  pairNumber: number;
  result: WordCompareResult;
  reportUrl?: string;
  reportFileName?: string;
  reportUnavailable?: boolean;
  originalBeforeUrl?: string;
  originalAfterUrl?: string;
  trackedUrl?: string;
  trackedFileName?: string;
  /** The tracked DOCX follows the screen result: pending until it arrives or is unavailable. */
  trackedStatus?: "pending" | "ready" | "unavailable";
}

interface DocumentCompareSessionValue {
  beforeFiles: File[];
  setBeforeFiles: Dispatch<SetStateAction<File[]>>;
  afterFiles: File[];
  setAfterFiles: Dispatch<SetStateAction<File[]>>;
  passwords: Record<string, string>;
  setPassword: (file: File, password: string) => void;
  webOutput: boolean;
  setWebOutput: Dispatch<SetStateAction<boolean>>;
  excelOutput: boolean;
  setExcelOutput: Dispatch<SetStateAction<boolean>>;
  trackedOutput: boolean;
  setTrackedOutput: Dispatch<SetStateAction<boolean>>;
  rewriteRevisionAuthor: boolean;
  setRewriteRevisionAuthor: Dispatch<SetStateAction<boolean>>;
  revisionAuthor: string;
  setRevisionAuthor: Dispatch<SetStateAction<string>>;
  formattingMask: FormattingMask;
  setFormattingMask: Dispatch<SetStateAction<FormattingMask>>;
  formatting: boolean;
  setFormatting: Dispatch<SetStateAction<boolean>>;
  tables: boolean;
  setTables: Dispatch<SetStateAction<boolean>>;
  metadata: boolean;
  setMetadata: Dispatch<SetStateAction<boolean>>;
  results: DocumentPairResult[];
  replaceResults: (results: DocumentPairResult[]) => void;
  updateResult: (pairNumber: number, update: (current: DocumentPairResult) => DocumentPairResult) => void;
  clearResults: () => void;
  /** Work that continues after the results are shown (tracked DOCX files); aborted when a new
   * comparison starts, the results are cleared or the tool is left. */
  adoptBackground: (controller: AbortController | undefined) => void;
  /** Lets go of `controller` (finished work) only if it is still the adopted one. */
  releaseBackground: (controller: AbortController) => void;
}

const DocumentCompareSessionContext = createContext<DocumentCompareSessionValue | null>(null);

export function DocumentCompareSessionProvider() {
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [webOutput, setWebOutput] = useState(true);
  const [excelOutput, setExcelOutput] = useState(true);
  const [trackedOutput, setTrackedOutput] = useState(true);
  // On by default (2026-10-25 user decision): existing revisions are accepted first, so reject-all in Word returns
  // the original and the web view compares clean versions. The user's own files are never changed.
  const [rewriteRevisionAuthor, setRewriteRevisionAuthor] = useState(true);
  const [revisionAuthor, setRevisionAuthor] = useState("Worklazy Tools");
  const [formattingMask, setFormattingMask] = useState<FormattingMask>({...defaultFormattingMask});
  const [formatting, setFormatting] = useState(true);
  const [tables, setTables] = useState(true);
  const [metadata, setMetadata] = useState(true);
  const { results, replaceResults, clearResults: clearComparisonResults } = useComparisonResults<DocumentPairResult>();
  const background = useRef<AbortController | undefined>(undefined);
  const adoptBackground = useCallback((controller: AbortController | undefined) => { if (background.current !== controller) background.current?.abort(); background.current = controller; }, []);
  const releaseBackground = useCallback((controller: AbortController) => { if (background.current === controller) background.current = undefined; }, []);
  useEffect(() => () => background.current?.abort(), []);
  const updateResult = useCallback((pairNumber: number, update: (current: DocumentPairResult) => DocumentPairResult) => replaceResults((current) => current.map((item) => item.pairNumber === pairNumber ? update(item) : item)), [replaceResults]);
  const clearResults = useCallback(() => { adoptBackground(undefined); clearComparisonResults(); }, [adoptBackground, clearComparisonResults]);
  return <DocumentCompareSessionContext.Provider value={{
    beforeFiles,
    setBeforeFiles,
    afterFiles,
    setAfterFiles,
    passwords,
    setPassword: (file, password) => setPasswords((current) => ({ ...current, [documentFileKey(file)]: password })),
    webOutput,
    setWebOutput,
    excelOutput,
    setExcelOutput,
    trackedOutput,
    setTrackedOutput,
    rewriteRevisionAuthor,
    setRewriteRevisionAuthor,
    revisionAuthor,
    setRevisionAuthor,
    formattingMask,
    setFormattingMask,
    formatting,
    setFormatting,
    tables,
    setTables,
    metadata,
    setMetadata,
    results,
    replaceResults,
    updateResult,
    clearResults,
    adoptBackground,
    releaseBackground,
  }}><Outlet /></DocumentCompareSessionContext.Provider>;
}

export function useDocumentCompareSession() {
  const context = useContext(DocumentCompareSessionContext);
  if (!context) throw new Error("문서 비교 화면을 준비하지 못했습니다.");
  return context;
}

export { documentFileKey as fileKey } from "./filePairs";
