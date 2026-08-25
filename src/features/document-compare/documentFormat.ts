export type DocumentFormat = "docx" | "doc" | "hwp" | "hwpx" | "encrypted-office" | "unknown";
export type DocumentFamily = "word" | "hwp";

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_SIGNATURES = [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]];

export function sniffDocumentFormat(buffer: ArrayBuffer): DocumentFormat {
  const bytes = new Uint8Array(buffer);
  if (startsWithAny(bytes, ZIP_SIGNATURES)) {
    if (containsAscii(bytes, "word/document.xml")) return "docx";
    if (containsAscii(bytes, "Contents/content.hpf") || containsAscii(bytes, "Contents/section0.xml")) return "hwpx";
    return "unknown";
  }
  if (startsWith(bytes, CFB_SIGNATURE)) {
    if (containsUtf16Le(bytes, "WordDocument")) return "doc";
    if (containsUtf16Le(bytes, "FileHeader")) return "hwp";
    if (containsUtf16Le(bytes, "EncryptedPackage")) return "encrypted-office";
  }
  return "unknown";
}

export function documentFamily(format: DocumentFormat): DocumentFamily | null {
  if (format === "doc" || format === "docx") return "word";
  if (format === "hwp" || format === "hwpx") return "hwp";
  return null;
}

export interface DocumentPairFormat {
  before: DocumentFormat;
  after: DocumentFormat;
  family: DocumentFamily;
  trackedDocxEligible: boolean;
}

export function validateDocumentPairFormats(
  before: DocumentFormat,
  after: DocumentFormat,
  language: "ko" | "en",
): DocumentPairFormat {
  if (before === "encrypted-office" || after === "encrypted-office") {
    throw new Error(language === "en"
      ? "Password-protected Word files are not supported. Remove the password and add an unlocked copy."
      : "암호로 보호된 Word 파일은 지원하지 않습니다. 암호를 해제한 사본을 추가해 주세요.");
  }
  const beforeFamily = documentFamily(before);
  const afterFamily = documentFamily(after);
  if (!beforeFamily || !afterFamily) {
    throw new Error(language === "en"
      ? "The actual file format could not be identified. Add a valid DOCX, DOC, HWP, or HWPX file."
      : "파일의 실제 형식을 확인할 수 없습니다. 올바른 DOCX, DOC, HWP 또는 HWPX 파일을 추가해 주세요.");
  }
  if (beforeFamily !== afterFamily) {
    throw new Error(language === "en"
      ? "Word and HWP documents cannot be compared with each other. Pair DOCX/DOC with Word files and HWP/HWPX with HWP files."
      : "Word 문서와 HWP 문서는 서로 비교할 수 없습니다. DOCX·DOC는 Word 문서끼리, HWP·HWPX는 HWP 문서끼리 짝지어 주세요.");
  }
  return {
    before,
    after,
    family: beforeFamily,
    trackedDocxEligible: before === "docx" && after === "docx",
  };
}

function startsWithAny(bytes: Uint8Array, signatures: number[][]) {
  return signatures.some((signature) => startsWith(bytes, signature));
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function containsAscii(bytes: Uint8Array, value: string) {
  const needle = new TextEncoder().encode(value);
  return containsBytes(bytes, needle);
}

function containsUtf16Le(bytes: Uint8Array, value: string) {
  const needle = new Uint8Array(value.length * 2);
  for (let index = 0; index < value.length; index += 1) {
    needle[index * 2] = value.charCodeAt(index) & 0xff;
    needle[index * 2 + 1] = value.charCodeAt(index) >>> 8;
  }
  return containsBytes(bytes, needle);
}

function containsBytes(bytes: Uint8Array, needle: Uint8Array) {
  if (!needle.length || bytes.length < needle.length) return false;
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}
