import { createContext, type Dispatch, type SetStateAction, useContext, useState } from "react";
import { Outlet } from "react-router-dom";

import type { WordCompareResult } from "../excel-merger/types";
import { documentFileKey } from "./filePairs";
import { useComparisonResults } from "./useComparisonResults";

export interface DocumentPairResult {
  pairNumber: number;
  result: WordCompareResult;
  reportUrl?: string;
  reportFileName?: string;
  trackedUrl?: string;
  trackedFileName?: string;
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
  formatting: boolean;
  setFormatting: Dispatch<SetStateAction<boolean>>;
  tables: boolean;
  setTables: Dispatch<SetStateAction<boolean>>;
  metadata: boolean;
  setMetadata: Dispatch<SetStateAction<boolean>>;
  results: DocumentPairResult[];
  replaceResults: (results: DocumentPairResult[]) => void;
  clearResults: () => void;
}

const DocumentCompareSessionContext = createContext<DocumentCompareSessionValue | null>(null);

export function DocumentCompareSessionProvider() {
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [webOutput, setWebOutput] = useState(true);
  const [excelOutput, setExcelOutput] = useState(true);
  const [trackedOutput, setTrackedOutput] = useState(true);
  const [rewriteRevisionAuthor, setRewriteRevisionAuthor] = useState(false);
  const [revisionAuthor, setRevisionAuthor] = useState("Worklazy Tools");
  const [formatting, setFormatting] = useState(true);
  const [tables, setTables] = useState(true);
  const [metadata, setMetadata] = useState(true);
  const { results, replaceResults, clearResults } = useComparisonResults<DocumentPairResult>();
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
    formatting,
    setFormatting,
    tables,
    setTables,
    metadata,
    setMetadata,
    results,
    replaceResults,
    clearResults,
  }}><Outlet /></DocumentCompareSessionContext.Provider>;
}

export function useDocumentCompareSession() {
  const context = useContext(DocumentCompareSessionContext);
  if (!context) throw new Error("문서 비교 화면을 준비하지 못했습니다.");
  return context;
}

export { documentFileKey as fileKey } from "./filePairs";
