export type PdfConvertPreset = { purpose: "ocr"; format: "searchable-pdf"; pageRange: ""; ocrMode?: never } | { purpose: "convert"; format: "docx"; pageRange: ""; ocrMode: "auto" };
export function pdfConvertDirty(s: { file: unknown; loading: boolean; status: string; result: unknown }) { return Boolean(s.file) || s.loading || s.status === "running" || Boolean(s.result); }
