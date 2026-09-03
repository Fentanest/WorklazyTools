const OLE_COMPOUND_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0] as const;
export const SPREADSHEET_SIGNATURE_READ_SIZE = 4096;

export async function hasOleCompoundSignature(file: Blob) {
  const signature = new Uint8Array(await file.slice(0, OLE_COMPOUND_SIGNATURE.length).arrayBuffer());
  return hasOleCompoundSignatureBytes(signature);
}

export function hasOleCompoundSignatureBytes(data: Uint8Array) {
  return data.length >= OLE_COMPOUND_SIGNATURE.length
    && OLE_COMPOUND_SIGNATURE.every((value, index) => data[index] === value);
}

export function hasSpreadsheetMlSignature(data: Uint8Array) {
  const header = new TextDecoder("utf-8").decode(data.subarray(0, Math.min(data.length, SPREADSHEET_SIGNATURE_READ_SIZE)))
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  return header.startsWith("<?xml")
    && (header.includes("<?mso-application") || header.includes("urn:schemas-microsoft-com:office:spreadsheet"));
}

export function expandSpreadsheetMlCdata(raw: string) {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_section, content: string) => content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;"));
}
