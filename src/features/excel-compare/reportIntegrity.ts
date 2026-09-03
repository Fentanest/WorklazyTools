export const REPORT_INTEGRITY_ERROR_CODE = "REPORT_INTEGRITY_FAILED";

export function assertGeneratedXlsxReport(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
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
