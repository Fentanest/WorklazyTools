import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type LoadOptions,
  type PDFFont,
} from "pdf-lib";

export { degrees, rgb };
export type { PDFDocument, PDFFont, LoadOptions };

export function createPdfDocument() {
  return PDFDocument.create({ updateMetadata: false });
}

export function loadPdfDocument(bytes: ArrayBuffer | Uint8Array, options: LoadOptions = {}) {
  return PDFDocument.load(bytes, { updateMetadata: false, ...options });
}

export function embedHelvetica(document: PDFDocument) {
  return document.embedFont(StandardFonts.Helvetica);
}

export function embedCustomPdfFont(document: PDFDocument, bytes: ArrayBuffer | Uint8Array): Promise<PDFFont> {
  document.registerFontkit(fontkit);
  return document.embedFont(bytes, { subset: false });
}

export function getPdfFontCharacterSet(bytes: ArrayBuffer | Uint8Array): number[] {
  return fontkit.create(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).characterSet;
}
