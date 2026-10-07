import assert from "node:assert/strict";
import { test } from "node:test";
import { PdfConversionError, conversionErrorToken, isConversionErrorCode } from "../../src/features/pdf-editor/pdfConversionErrors.ts";

test("conversion errors accept only controlled codes and safe display values", () => {
  for (const value of ["__proto__", "constructor", "raw SDK error", null, {}]) assert.equal(isConversionErrorCode(value), false);
  assert.equal(isConversionErrorCode("DOCUMENT_IMAGE"), true);
  const error = new PdfConversionError("DOCUMENT_EXPORT", { page: 3, count: 9, format: "hwpx" });
  assert.deepEqual(error.values, { page: 3, count: 9, format: "HWPX" });
  assert.equal(error.message, "DOCUMENT_EXPORT");
  const token = conversionErrorToken(error);
  assert.deepEqual(JSON.parse(token.slice(token.indexOf(":")+1)), {key:"pdf.conversionErrors.documentExport",values:error.values});
});
test("conversion errors drop document-shaped and invalid interpolation values", () => {
  for (const page of [-1, 0, NaN, Infinity, 1.5, 1000001]) assert.deepEqual(new PdfConversionError("IMAGE_PREPARE", {page}).values, {});
  assert.deepEqual(new PdfConversionError("DOCUMENT_EXPORT", {format:'{"private":"SDK failure"}'}).values, {});
  assert.deepEqual(new PdfConversionError("DOCUMENT_EXPORT", {format:{toString(){throw new Error("must not stringify");}} as unknown as string}).values, {});
});
