import { createContext, useContext, useState } from "react";
import { Outlet } from "react-router-dom";

import type { WordCompareResult } from "../excel-merger/types";
import { documentFileKey } from "../document-compare/filePairs";
import { useComparisonResults } from "../document-compare/useComparisonResults";

export interface HwpPairResult {
  pairNumber: number;
  result: WordCompareResult;
  reportUrl?: string;
  reportFileName?: string;
}

interface HwpCompareSessionValue {
  beforeFiles: File[];
  setBeforeFiles: React.Dispatch<React.SetStateAction<File[]>>;
  afterFiles: File[];
  setAfterFiles: React.Dispatch<React.SetStateAction<File[]>>;
  passwords: Record<string, string>;
  setPassword: (file: File, password: string) => void;
  webOutput: boolean;
  setWebOutput: React.Dispatch<React.SetStateAction<boolean>>;
  excelOutput: boolean;
  setExcelOutput: React.Dispatch<React.SetStateAction<boolean>>;
  formatting: boolean;
  setFormatting: React.Dispatch<React.SetStateAction<boolean>>;
  tables: boolean;
  setTables: React.Dispatch<React.SetStateAction<boolean>>;
  metadata: boolean;
  setMetadata: React.Dispatch<React.SetStateAction<boolean>>;
  results: HwpPairResult[];
  replaceResults: (results: HwpPairResult[]) => void;
  clearResults: () => void;
}

const HwpCompareSessionContext = createContext<HwpCompareSessionValue | null>(null);

export function HwpCompareSessionProvider() {
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [webOutput, setWebOutput] = useState(true);
  const [excelOutput, setExcelOutput] = useState(true);
  const [formatting, setFormatting] = useState(true);
  const [tables, setTables] = useState(true);
  const [metadata, setMetadata] = useState(true);
  const { results, replaceResults, clearResults } = useComparisonResults<HwpPairResult>();

  const value: HwpCompareSessionValue = {
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

  return <HwpCompareSessionContext.Provider value={value}><Outlet /></HwpCompareSessionContext.Provider>;
}

export function useHwpCompareSession() {
  const context = useContext(HwpCompareSessionContext);
  if (!context) throw new Error("HWP 비교 세션이 준비되지 않았습니다.");
  return context;
}

export { documentFileKey as fileKey } from "../document-compare/filePairs";
