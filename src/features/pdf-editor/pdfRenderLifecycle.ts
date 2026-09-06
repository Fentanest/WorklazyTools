import type { PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from "pdfjs-dist";

type PdfRenderTask = Pick<RenderTask, "cancel" | "promise">;
type PdfRenderPage = Pick<PDFPageProxy, "cleanup">;
type PdfLoadingTask = Pick<PDFDocumentLoadingTask, "destroy">;

interface PdfRenderDocumentOwnership {
  loadingTask?: PdfLoadingTask;
  ownsDocument?: boolean;
}

interface WaitForPdfRenderOptions extends PdfRenderDocumentOwnership {
  signal?: AbortSignal;
  canceledMessage?: string;
}

export async function cancelPdfRender(
  renderTask: PdfRenderTask,
  page: PdfRenderPage,
  ownership: PdfRenderDocumentOwnership = {},
): Promise<void> {
  if (ownership.ownsDocument && !ownership.loadingTask) {
    throw new Error("An owned PDF document requires its loading task.");
  }

  renderTask.cancel();
  let pendingError: unknown;
  try {
    await renderTask.promise;
  } catch (error) {
    if (!isRenderingCancelledException(error)) pendingError = error;
  }

  try {
    page.cleanup();
  } catch (error) {
    pendingError ??= error;
  }

  if (ownership.ownsDocument) {
    try {
      await ownership.loadingTask?.destroy();
    } catch (error) {
      pendingError ??= error;
    }
  }

  if (pendingError !== undefined) throw pendingError;
}

export async function waitForPdfRender(
  renderTask: PdfRenderTask,
  page: PdfRenderPage,
  options: WaitForPdfRenderOptions = {},
): Promise<void> {
  let cancellation: Promise<void> | undefined;
  const cancel = () => {
    cancellation ??= cancelPdfRender(renderTask, page, options);
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();

  try {
    await renderTask.promise;
    if (options.signal?.aborted) {
      cancel();
      await cancellation;
      throw new DOMException(options.canceledMessage ?? "PDF rendering was canceled.", "AbortError");
    }
  } catch (error) {
    if (!options.signal?.aborted && !isRenderingCancelledException(error)) throw error;
    cancel();
    await cancellation;
    throw new DOMException(options.canceledMessage ?? "PDF rendering was canceled.", "AbortError");
  } finally {
    options.signal?.removeEventListener("abort", cancel);
  }
}

export function isRenderingCancelledException(error: unknown): boolean {
  return error instanceof Error && error.name === "RenderingCancelledException";
}
