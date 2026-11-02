import type { ReceiverId } from "./fileAccepts";

// Same import targets as App.tsx, including the PDF page's nested lazy panel.
// Do not cache rejected promises: a retry must invoke import() again.
export async function preloadReceiver(receiverId: ReceiverId): Promise<void> {
  switch (receiverId) {
    case "excel-cleaner": await import("../features/excel-cleaner/ExcelCleanerPage"); break;
    case "excel-merger": await import("../features/excel-merger/ExcelMergerPage"); break;
    case "document-generator": await import("../features/document-generator/DocumentGeneratorPage"); break;
    case "image-privacy": await import("../features/image-privacy/ImagePrivacyPage"); break;
    case "pdf-organize": await import("../features/pdf-editor/PdfEditorPage"); break;
    case "pdf-finish": await Promise.all([import("../features/pdf-editor/PdfEditorPage"), import("../features/pdf-editor/PdfFinishPanel")]); break;
    case "image-to-pdf":
    case "pdf-to-image":
    case "pdf-to-document": await import("../features/pdf-converter/PdfConverterPage"); break;
    case "image-edit":
    case "image-batch": await import("../features/image-studio/ImageStudioPage"); break;
  }
}
