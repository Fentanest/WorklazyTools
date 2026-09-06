import type { AppLanguage } from "../../i18n/languages";
import { featureMessage, resolveFeatureMessage } from "../../i18n/featureMessages";
import { runModuleWorker } from "../../utils/workerLifecycle.ts";
import type { WorkerProgress } from "./types";

interface PdfWorkerErrorPayload {
  message?: string;
  code?: string;
}

interface PdfWorkerEnvelope<TResult> {
  type: "progress" | "result" | "error";
  progress?: number;
  message?: string;
  result?: TResult;
  error?: PdfWorkerErrorPayload;
}

const canceledMessages: Record<AppLanguage, string> = {
  ko: "PDF 작업을 취소했습니다.",
  en: "The PDF operation was canceled.",
};

export function pdfWorkerCanceledMessage(language: AppLanguage): string {
  return canceledMessages[language];
}

export function runPdfWorker<TRequest, TResult>(
  createWorker: () => Worker,
  request: TRequest,
  transfer: Transferable[],
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  signal?: AbortSignal,
): Promise<TResult> {
  let envelopeError: PdfWorkerErrorPayload | undefined;
  const startErrorMessage = featureMessage(language, "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation");
  const resultErrorMessage = featureMessage(language, "pdf.messages.pdfWorkerClient.anErrorOccurredWhileProcessingThePdf");

  return runModuleWorker<TRequest, TResult>(
    () => createPdfEnvelopeAdapter(createWorker, (error) => { envelopeError = error; }),
    request,
    {
      transfer,
      signal,
      canceledMessage: pdfWorkerCanceledMessage(language),
      startErrorMessage,
      resultErrorMessage,
      onProgress: ({ progress, phase }) => onProgress?.(
        progress,
        phase ? resolveFeatureMessage(language, phase) : featureMessage(language, "pdf.messages.pdfWorkerClient.processing"),
      ),
    },
  ).then(
    (result) => localizePdfWorkerResult(result, language),
    (error: unknown) => {
      if (!envelopeError?.message) throw error;
      const localized = new Error(resolveFeatureMessage(language, envelopeError.message)) as Error & {
        code?: string;
        details?: string[];
        ruleId?: string;
      };
      const lifecycleError = error as Error & { code?: string; details?: string[]; ruleId?: string };
      localized.code = envelopeError.code ?? lifecycleError.code;
      localized.details = lifecycleError.details;
      localized.ruleId = lifecycleError.ruleId;
      throw localized;
    },
  );
}

function createPdfEnvelopeAdapter(
  createWorker: () => Worker,
  captureError: (error: PdfWorkerErrorPayload | undefined) => void,
): Worker {
  const worker = createWorker();
  const adapter = {
    onmessage: null as Worker["onmessage"],
    onerror: null as Worker["onerror"],
    postMessage(message: unknown, transfer: Transferable[]) {
      worker.postMessage(message, transfer);
    },
    terminate() {
      worker.terminate();
    },
  };

  worker.onmessage = (event: MessageEvent<PdfWorkerEnvelope<unknown>>) => {
    const data = event.data;
    if (data.type === "error") captureError(data.error);
    const lifecycleData = data.type === "progress"
      ? { type: "progress", progress: data.progress, phase: data.message }
      : data.type === "error"
        ? { type: "error", code: data.error?.code }
        : { type: "result", result: data.result };
    adapter.onmessage?.call(adapter as unknown as Worker, { data: lifecycleData } as MessageEvent);
  };
  worker.onerror = (event) => adapter.onerror?.call(adapter as unknown as AbstractWorker, event);
  return adapter as unknown as Worker;
}

function localizePdfWorkerResult<TResult>(result: TResult, language: AppLanguage): TResult {
  if (!result || typeof result !== "object" || !("warnings" in result) || !Array.isArray(result.warnings)) return result;
  return {
    ...result,
    warnings: result.warnings.map((warning) => typeof warning === "string" ? resolveFeatureMessage(language, warning) : warning),
  };
}
