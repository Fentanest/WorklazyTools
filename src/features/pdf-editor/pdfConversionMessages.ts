import type { AppLanguage } from "../../i18n/languages";
import { featureMessage } from "../../i18n/featureMessages";
import { conversionErrorKeys, PdfConversionError, type PdfConversionErrorCode } from "./pdfConversionErrors";

// Existing safe, app-authored errors retain their recovery instructions. Never
// infer safety from an arbitrary library message, JSON, stack, or language.
const knownMessages = [
  "pdf.messages.pdfPreview.displayFilesUnavailable",
  "pdf.messages.pdfPreview.thisPdfIsPasswordProtectedTryAgainWith",
  "pdf.messages.pdfPreview.thereAreNoPdfPagesToProcess",
  "pdf.messages.pdfPreview.imageDecodingFailed",
  "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation",
  "pdf.messages.pdfWorkerClient.anErrorOccurredWhileProcessingThePdf",
] as const;

export function pdfConversionMessage(error: unknown, language: AppLanguage, fallback: PdfConversionErrorCode = "CONVERSION"): string {
  if (error instanceof PdfConversionError) return featureMessage(language, conversionErrorKeys[error.code], error.values);
  if (error instanceof Error) {
    for (const key of knownMessages) {
      if (error.message === featureMessage("ko", key) || error.message === featureMessage("en", key)) return featureMessage(language, key);
    }
  }
  return featureMessage(language, conversionErrorKeys[fallback]);
}
