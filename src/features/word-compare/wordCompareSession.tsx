import { createContext, type Dispatch, type SetStateAction, useContext, useState } from "react";
import { Outlet } from "react-router-dom";

import type { WordCompareResult } from "../excel-merger/types";
import { useComparisonResults } from "../document-compare/useComparisonResults";

export interface WordPairResult {
  pairNumber: number;
  result: WordCompareResult;
  reportUrl?: string;
  reportFileName?: string;
  trackedUrl?: string;
  trackedFileName?: string;
}

interface WordCompareSessionValue {
  beforeFiles: File[];
  setBeforeFiles: Dispatch<SetStateAction<File[]>>;
  afterFiles: File[];
  setAfterFiles: Dispatch<SetStateAction<File[]>>;
  webOutput: boolean;
  setWebOutput: Dispatch<SetStateAction<boolean>>;
  excelOutput: boolean;
  setExcelOutput: Dispatch<SetStateAction<boolean>>;
  trackedOutput: boolean;
  setTrackedOutput: Dispatch<SetStateAction<boolean>>;
  revisionAuthor: string;
  setRevisionAuthor: Dispatch<SetStateAction<string>>;
  formatting: boolean;
  setFormatting: Dispatch<SetStateAction<boolean>>;
  tables: boolean;
  setTables: Dispatch<SetStateAction<boolean>>;
  metadata: boolean;
  setMetadata: Dispatch<SetStateAction<boolean>>;
  results: WordPairResult[];
  replaceResults: (results: WordPairResult[]) => void;
  clearResults: () => void;
}

const WordCompareSessionContext = createContext<WordCompareSessionValue | null>(null);

export function WordCompareSessionProvider() {
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [webOutput, setWebOutput] = useState(true);
  const [excelOutput, setExcelOutput] = useState(true);
  const [trackedOutput, setTrackedOutput] = useState(true);
  const [revisionAuthor, setRevisionAuthor] = useState("Worklazy Tools");
  const [formatting, setFormatting] = useState(true);
  const [tables, setTables] = useState(true);
  const [metadata, setMetadata] = useState(true);
  const { results, replaceResults, clearResults } = useComparisonResults<WordPairResult>();

  const value: WordCompareSessionValue = {
    beforeFiles,
    setBeforeFiles,
    afterFiles,
    setAfterFiles,
    webOutput,
    setWebOutput,
    excelOutput,
    setExcelOutput,
    trackedOutput,
    setTrackedOutput,
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
  };

  return <WordCompareSessionContext.Provider value={value}><Outlet /></WordCompareSessionContext.Provider>;
}

export function useWordCompareSession() {
  const context = useContext(WordCompareSessionContext);
  if (!context) throw new Error("Word 비교 세션이 준비되지 않았습니다.");
  return context;
}
