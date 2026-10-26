export type TextEncoding = "utf-8" | "utf-16le" | "utf-16be";
export interface TextSource { name: string; text: string; encoding: TextEncoding; bom: boolean; sourceRevision?:string; bytes?:number; mime?:string }
export const MAX_TEXT_BYTES = 4 * 1024 * 1024;

export function decodeText(bytes: Uint8Array, name: string, requested?: TextEncoding): TextSource {
  if (bytes.byteLength > MAX_TEXT_BYTES) throw new Error("TEXT_TOO_LARGE");
  const encoding: TextEncoding = requested ?? (bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8");
  const bom = encoding === "utf-8" ? bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
    : encoding === "utf-16le" ? bytes[0] === 0xff && bytes[1] === 0xfe : bytes[0] === 0xfe && bytes[1] === 0xff;
  try { return { name, encoding, bom, text: new TextDecoder(encoding, { fatal: true }).decode(bytes) }; }
  catch { throw new Error("TEXT_ENCODING_INVALID"); }
}
export async function readText(file: File, encoding?: TextEncoding): Promise<TextSource> {
  if (file.size > MAX_TEXT_BYTES) throw new Error("TEXT_TOO_LARGE");
  return decodeText(new Uint8Array(await file.arrayBuffer()), file.name, encoding);
}
export function encodeText(text: string, encoding: TextEncoding, bom: boolean): Uint8Array {
  if (encoding === "utf-8") {
    const bytes = new TextEncoder().encode(text);
    if (!bom) return bytes;
    const output = new Uint8Array(bytes.length + 3); output.set([0xef, 0xbb, 0xbf]); output.set(bytes, 3); return output;
  }
  const output = new Uint8Array(text.length * 2 + (bom ? 2 : 0));
  const view = new DataView(output.buffer); const little = encoding === "utf-16le";
  if (bom) view.setUint16(0, 0xfeff, little);
  for (let i = 0; i < text.length; i++) view.setUint16(i * 2 + (bom ? 2 : 0), text.charCodeAt(i), little);
  return output;
}
