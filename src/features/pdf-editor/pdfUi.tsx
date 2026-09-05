import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ResultCard, formatBytes } from "../../components/ui";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FileShareButton } from "../../components/FileShareButton";
import { useAppLanguage } from "../../i18n/routing";
import type { PdfWorkerResult } from "./types";
import { featureMessage } from "../../i18n/featureMessages";
import { cn } from "../../lib/utils";

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

export function PdfDownloadCard({ result, title, compact = false }: { result: DownloadResult; title?: string; compact?: boolean }) {
  const language = useAppLanguage();
  const displayTitle = title ?? featureMessage(language, "pdf.messages.pdfUi.yourFileIsReady");
  if (compact) {
    return (
      <Card as="section" className="pdf-download-compact mt-2.5 gap-0 overflow-visible rounded-2xl border border-violet-300/50 bg-violet-50/70 p-3 py-3 text-muted-foreground shadow-none ring-0 dark:border-violet-900 dark:bg-violet-950/35" aria-live="polite">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300"><CheckCircle2 size={18} /><strong className="text-sm text-foreground">{displayTitle}</strong></div>
        <a className={cn(buttonVariants({ size: "lg" }), "mt-2.5 min-w-0 justify-center rounded-xl bg-violet-700 px-3 font-bold text-white shadow-md shadow-violet-700/20 hover:bg-violet-800")} data-testid="pdf-download" href={result.url} download={result.fileName}>
          <Download size={16} /> <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{result.fileName}</span><small className="border-l border-white/25 pl-2 text-xs text-white/75">{formatBytes(result.size)}</small>
        </a>
        <FileShareButton url={result.url} fileName={result.fileName} shadcn className="mt-2 min-h-10 w-full justify-center rounded-xl" />
        {!!result.warnings.length && <div className="mt-3">{result.warnings.map((warning) => <p className="mt-1 flex items-start gap-1 text-[13px] text-amber-800 dark:text-amber-300" key={warning}><AlertTriangle className="mt-0.5 shrink-0" size={13} /> {warning}</p>)}</div>}
      </Card>
    );
  }
  return (
    <ResultCard accent="violet" title={displayTitle} message={featureMessage(language, "pdf.messages.pdfUi.thisFileWasCreatedInYourBrowserDownload")}>
      <a className={cn(buttonVariants({ size: "lg" }), "mt-3 w-fit max-w-full rounded-xl bg-violet-700 px-3 font-bold text-white shadow-md shadow-violet-700/20 hover:bg-violet-800")} data-testid="pdf-download" href={result.url} download={result.fileName}>
        <Download size={16} /><span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{result.fileName}</span><small className="border-l border-white/25 pl-2 text-xs text-white/75">{formatBytes(result.size)}</small>
      </a>
      <FileShareButton url={result.url} fileName={result.fileName} shadcn className="mt-2 rounded-xl" />
      {!!result.warnings.length && <div className="mt-3">{result.warnings.map((warning) => <p className="mt-1 flex items-start gap-1 text-[13px] text-amber-800 dark:text-amber-300" key={warning}><AlertTriangle className="mt-0.5 shrink-0" size={13} /> {warning}</p>)}</div>}
    </ResultCard>
  );
}

export function PdfError({ message }: { message: string }) {
  const language = useAppLanguage();
  if (!message) return null;
  return <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive" data-testid="pdf-error" role="alert"><AlertTriangle className="shrink-0" size={19} /><div className="flex flex-col"><strong className="text-sm">{featureMessage(language, "pdf.messages.pdfUi.unableToContinue")}</strong><span className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</span></div></div>;
}

export function normalizeOutputName(value: string, fallback: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-") || fallback;
}
