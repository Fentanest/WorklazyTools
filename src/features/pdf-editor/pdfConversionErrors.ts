import { workerMessage } from "../../i18n/workerMessages.ts";

export const conversionErrorKeys = {
  IMAGE_DECODE: "pdf.conversionErrors.imageDecode",
  IMAGE_LIMIT: "pdf.conversionErrors.imageLimit",
  IMAGE_PREPARE: "pdf.conversionErrors.imagePrepare",
  DOCUMENT_CREATE: "pdf.conversionErrors.documentCreate",
  DOCUMENT_IMAGE: "pdf.conversionErrors.documentImage",
  DOCUMENT_EXPORT: "pdf.conversionErrors.documentExport",
  NO_TABLES: "pdf.conversionErrors.noTables",
  OCR_REQUIRED_FOR_TABLES: "pdf.conversionErrors.ocrRequiredForTables",
  SCAN_TABLE_UNAVAILABLE: "pdf.conversionErrors.scanTableUnavailable",
  INVALID_RANGE: "pdf.conversionErrors.invalidRange",
  NO_TEXT: "pdf.messages.PdfConvertPanel.noTextWasExtractedEnableAutomaticOcrFor",
  OCR_OUTPUT: "pdf.messages.PdfConvertPanel.searchablePdfDataCouldNotBeCreatedFor",
  CONVERSION: "pdf.conversionErrors.conversion",
  INPUT: "pdf.conversionErrors.input",
  PREVIEW: "pdf.conversionErrors.preview",
} as const;
export type PdfConversionErrorCode = keyof typeof conversionErrorKeys;
export function isConversionErrorCode(code: unknown): code is PdfConversionErrorCode {
  return typeof code === "string" && Object.hasOwn(conversionErrorKeys, code);
}

/** Only controlled codes and bounded non-document values cross the UI boundary. */
export class PdfConversionError extends Error {
  readonly code: PdfConversionErrorCode;
  readonly values: Record<string, string | number>;
  constructor(code: PdfConversionErrorCode, values: { page?: number; format?: string; count?: number } = {}) {
    super(code);
    this.name = "PdfConversionError";
    this.code = code;
    this.values = {};
    for (const key of ["page", "count"] as const) {
      const value = values[key];
      if (Number.isSafeInteger(value) && value! > 0 && value! <= 1_000_000) this.values[key] = value!;
    }
    if (typeof values.format === "string" && /^(docx|xlsx|txt|pptx|hwpx|searchable-pdf)$/i.test(values.format)) this.values.format = values.format.toUpperCase();
  }
}

export function conversionErrorToken(error: PdfConversionError): string {
  return workerMessage(undefined, conversionErrorKeys[error.code], error.values);
}
