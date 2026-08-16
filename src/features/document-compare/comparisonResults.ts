import type { AppLanguage } from "../../i18n/languages";
import type { WordCompareResult } from "../excel-merger/types";
import { createWordExcelReports } from "../excel-merger/excelWorkerClient";
import { stripDocumentExtension } from "./filePairs";

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type WorkerProgress = (progress: number, message: string) => void;

export async function createComparisonExcelReports(
  results: WordCompareResult[],
  onProgress: WorkerProgress,
  language: AppLanguage,
  signal?: AbortSignal,
) {
  return createWordExcelReports(results, onProgress, language, signal);
}

export function createComparisonReportArtifact(
  buffer: ArrayBuffer | undefined,
  pairNumber: number,
  beforeName: string,
  afterName: string,
  language: AppLanguage,
  documentKind?: "HWP",
) {
  if (!buffer) return {};
  const base = `${pairNumber}_${stripDocumentExtension(beforeName)}_vs_${stripDocumentExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
  const suffix = documentKind === "HWP"
    ? language === "en" ? "HWP-comparison-report" : "HWP-비교보고서"
    : language === "en" ? "comparison-report" : "비교보고서";
  return {
    reportUrl: URL.createObjectURL(new Blob([buffer], { type: EXCEL_MIME })),
    reportFileName: `${base}_${suffix}.xlsx`,
  };
}
