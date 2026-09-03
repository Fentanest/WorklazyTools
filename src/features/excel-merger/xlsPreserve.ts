export type XlsPreserveLanguage = "ko" | "en";

const OLE_COMPOUND_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0] as const;
const SIGNATURE_READ_SIZE = 4096;

export async function hasOleCompoundSignature(file: Blob) {
  const signature = new Uint8Array(await file.slice(0, OLE_COMPOUND_SIGNATURE.length).arrayBuffer());
  return hasOleCompoundSignatureBytes(signature);
}

export function hasOleCompoundSignatureBytes(data: Uint8Array) {
  return data.length >= OLE_COMPOUND_SIGNATURE.length
    && OLE_COMPOUND_SIGNATURE.every((value, index) => data[index] === value);
}

export function hasSpreadsheetMlSignature(data: Uint8Array) {
  const header = new TextDecoder("utf-8").decode(data.subarray(0, Math.min(data.length, SIGNATURE_READ_SIZE)))
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  return header.startsWith("<?xml")
    && (header.includes("<?mso-application") || header.includes("urn:schemas-microsoft-com:office:spreadsheet"));
}

export async function requiresLegacySpreadsheetConversion(file: Blob) {
  const header = new Uint8Array(await file.slice(0, SIGNATURE_READ_SIZE).arrayBuffer());
  return hasOleCompoundSignatureBytes(header) || hasSpreadsheetMlSignature(header);
}

export function xlsPreserveError(reason: unknown, language: XlsPreserveLanguage, fileName?: string) {
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return language === "en" ? "XLS preparation was cancelled." : "XLS 보존 준비를 취소했습니다.";
  }
  const code = reason instanceof Error ? reason.message : "";
  if (code === "isolation-required") {
    return language === "en"
      ? "This browser session cannot prepare XLS preservation. Reload this page in a current Chrome or Edge browser."
      : "현재 브라우저 환경에서 XLS 보존을 준비할 수 없습니다. 최신 Chrome 또는 Edge에서 이 페이지를 다시 열어 주세요.";
  }
  if (code === "cache-unavailable") {
    return language === "en"
      ? "Browser storage is unavailable. Allow site storage and try again."
      : "브라우저 저장 공간을 사용할 수 없습니다. 사이트 저장을 허용한 뒤 다시 시도해 주세요.";
  }
  if (code === "asset-download-failed") {
    return language === "en"
      ? "The files needed for XLS preservation could not be downloaded. Check your connection and available storage, then try again."
      : "XLS 보존에 필요한 파일을 내려받지 못했습니다. 인터넷 연결과 저장 공간을 확인한 뒤 다시 시도해 주세요.";
  }
  if (code === "office-operation-timeout") {
    if (fileName) {
      return language === "en"
        ? `Conversion of '${fileName}' took longer than expected. Keep this tab open and try again.`
        : `'${fileName}' 파일의 변환 시간이 예상보다 길어 중단했습니다. 이 탭을 유지한 채 다시 시도해 주세요.`;
    }
    return language === "en"
      ? "XLS conversion took longer than expected. Keep this tab open and try again."
      : "XLS 변환 시간이 예상보다 길어 중단했습니다. 이 탭을 유지한 채 다시 시도해 주세요.";
  }
  if (fileName && (code === "convert-failed" || code === "office-convert-verification-failed")) {
    return conversionFailedMessage(fileName, language);
  }
  if (fileName) return conversionFailedMessage(fileName, language);
  return language === "en"
    ? "The XLS file could not be prepared. Check that it is not damaged or password-protected, then try again."
    : "XLS 파일을 준비하지 못했습니다. 파일이 손상되지 않았는지, 암호로 보호되지 않았는지 확인한 뒤 다시 시도해 주세요.";
}

function conversionFailedMessage(fileName: string, language: XlsPreserveLanguage) {
  return language === "en"
    ? `Could not convert '${fileName}'. Check that the file is not damaged or password-protected, then try again.`
    : `'${fileName}' 파일을 변환하지 못했습니다. 파일이 손상되지 않았는지, 암호로 보호되지 않았는지 확인한 뒤 다시 시도해 주세요.`;
}
