import { AlertTriangle, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { ResultCard, formatBytes } from "../../components/ui";
import { FileShareButton } from "../../components/FileShareButton";
import type { PdfWorkerResult } from "./types";

export interface DownloadResult {
  url: string;
  fileName: string;
  size: number;
  warnings: string[];
}

export function useDownloadResult() {
  const [result, setResult] = useState<DownloadResult | null>(null);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const makeResult = (output: PdfWorkerResult) => {
    if (result) URL.revokeObjectURL(result.url);
    const blob = new Blob([output.buffer], { type: output.mimeType });
    setResult({ url: URL.createObjectURL(blob), fileName: output.fileName, size: blob.size, warnings: output.warnings });
  };
  const makeBlobResult = (blob: Blob, fileName: string, warnings: string[] = []) => {
    if (result) URL.revokeObjectURL(result.url);
    setResult({ url: URL.createObjectURL(blob), fileName, size: blob.size, warnings });
  };
  const clearResult = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
  };
  return { result, makeResult, makeBlobResult, clearResult };
}

export function PdfDownloadCard({ result, title = "결과 파일이 준비됐어요." }: { result: DownloadResult; title?: string }) {
  return (
    <ResultCard accent="violet" title={title} message="브라우저에서 생성한 파일입니다. 다운로드 후 결과를 확인해 주세요.">
      <a className="result-download accent-violet" href={result.url} download={result.fileName}>
        <Download size={16} /> {result.fileName}<small>{formatBytes(result.size)}</small>
      </a>
      <FileShareButton url={result.url} fileName={result.fileName} />
      {!!result.warnings.length && <div className="result-warnings">{result.warnings.map((warning) => <p key={warning}><AlertTriangle size={13} /> {warning}</p>)}</div>}
    </ResultCard>
  );
}

export function PdfError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="error-banner" role="alert"><AlertTriangle size={19} /><div><strong>작업을 계속할 수 없습니다.</strong><span>{message}</span></div></div>;
}

export function normalizeOutputName(value: string, fallback: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-") || fallback;
}
