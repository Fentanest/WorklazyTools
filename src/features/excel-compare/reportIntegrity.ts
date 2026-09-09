import JSZip from "jszip";

import { countWorksheetDataRows, createSharedStringValueLookup } from "../../utils/xlsxReportDataRows.mjs";

export const REPORT_INTEGRITY_ERROR_CODE = "REPORT_INTEGRITY_FAILED";

const WORKSHEET_PATH = /^xl\/worksheets\/sheet\d+\.xml$/u;

export async function assertGeneratedXlsxReport(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw reportIntegrityError();
  }
  try {
    const archive = await JSZip.loadAsync(buffer);
    const worksheets = Object.values(archive.files).filter((entry) => !entry.dir && WORKSHEET_PATH.test(entry.name));
    if (!worksheets.length) throw new Error("MISSING_WORKSHEET");
    const sharedStringsXml = await archive.file("xl/sharedStrings.xml")?.async("string");
    const sharedStringHasValue = sharedStringsXml ? createSharedStringValueLookup(sharedStringsXml) : undefined;
    let hasDataRow = false;
    for (const worksheet of worksheets) {
      const xml = await worksheet.async("string");
      for (const match of xml.matchAll(/<col\b[^>]*\/?\s*>/gu)) {
        const customWidth = xmlAttribute(match[0], "customWidth");
        if (customWidth !== "1" && customWidth?.toLowerCase() !== "true") continue;
        const rawWidth = xmlAttribute(match[0], "width");
        const width = rawWidth === undefined ? Number.NaN : Number(rawWidth);
        if (!Number.isFinite(width) || width <= 0) throw new Error("INVALID_COLUMN_WIDTH");
      }
      if (!hasDataRow && countWorksheetDataRows(xml, sharedStringHasValue, 1) > 0) hasDataRow = true;
    }
    if (!hasDataRow) throw new Error("MISSING_REPORT_DATA");
  } catch {
    throw reportIntegrityError();
  }
}

export function assertReceivedXlsxReport(buffer: ArrayBuffer, reportByteLength: number) {
  if (!Number.isSafeInteger(reportByteLength) || reportByteLength <= 0 || buffer.byteLength !== reportByteLength) {
    throw reportIntegrityError();
  }
}

export function assertReportBlobSize(blob: Blob, reportByteLength: number) {
  if (!Number.isSafeInteger(reportByteLength) || reportByteLength <= 0 || blob.size !== reportByteLength) {
    throw reportIntegrityError();
  }
}

function reportIntegrityError() {
  const error = new Error(REPORT_INTEGRITY_ERROR_CODE) as Error & { code: string };
  error.code = REPORT_INTEGRITY_ERROR_CODE;
  return error;
}

function xmlAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2];
}
