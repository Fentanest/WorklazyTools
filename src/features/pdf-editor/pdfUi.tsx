import { AlertTriangle, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ResultCard, formatBytes } from "../../components/ui";
import { FileShareButton } from "../../components/FileShareButton";
import { useAppLanguage } from "../../i18n/routing";
import type { PdfWorkerResult } from "./types";
import { featureMessage } from "../../i18n/featureMessages";

export interface DownloadResult {
  url: string;
  fileName: string;
  size: number;
  warnings: string[];
}

export function useDownloadResult() {
  const [result, setResult] = useState<DownloadResult | null>(null);
  const resultRef = useRef<DownloadResult | null>(null);
  useEffect(() => () => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
  }, []);

  const replaceResult = useCallback((next: DownloadResult | null) => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = next;
    setResult(next);
  }, []);
  const makeResult = useCallback((output: PdfWorkerResult) => {
    const blob = new Blob([output.buffer], { type: output.mimeType });
    replaceResult({ url: URL.createObjectURL(blob), fileName: output.fileName, size: blob.size, warnings: output.warnings });
  }, [replaceResult]);
  const makeBlobResult = useCallback((blob: Blob, fileName: string, warnings: string[] = []) => {
    replaceResult({ url: URL.createObjectURL(blob), fileName, size: blob.size, warnings });
  }, [replaceResult]);
  const clearResult = useCallback(() => replaceResult(null), [replaceResult]);
  return useMemo(() => ({ result, makeResult, makeBlobResult, clearResult }), [clearResult, makeBlobResult, makeResult, result]);
}

export function PdfDownloadCard({ result, title }: { result: DownloadResult; title?: string }) {
  const language = useAppLanguage();
  return (
    <ResultCard accent="violet" title={title ?? (featureMessage(language, "pdf.messages.pdfUi.yourFileIsReady"))} message={featureMessage(language, "pdf.messages.pdfUi.thisFileWasCreatedInYourBrowserDownload")}>
      <a className="result-download accent-violet" href={result.url} download={result.fileName}>
        <Download size={16} /> {result.fileName}<small>{formatBytes(result.size)}</small>
      </a>
      <FileShareButton url={result.url} fileName={result.fileName} />
      {!!result.warnings.length && <div className="result-warnings">{result.warnings.map((warning) => <p key={warning}><AlertTriangle size={13} /> {warning}</p>)}</div>}
    </ResultCard>
  );
}

export function PdfError({ message }: { message: string }) {
  const language = useAppLanguage();
  if (!message) return null;
  return <div className="error-banner" role="alert"><AlertTriangle size={19} /><div><strong>{featureMessage(language, "pdf.messages.pdfUi.unableToContinue")}</strong><span>{message}</span></div></div>;
}

export function normalizeOutputName(value: string, fallback: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-") || fallback;
}
