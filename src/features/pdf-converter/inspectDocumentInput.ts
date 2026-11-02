import { BlobReader, ZipReader } from "@zip.js/zip.js";

/** Inspect the input container only; never start the conversion runtime. */
export async function inspectDocumentInput(file: File, signal: AbortSignal): Promise<boolean> {
  if (!file.size || file.size > 50 * 1024 * 1024) return false;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  signal.throwIfAborted();
  if (["docx", "xlsx", "pptx", "hwpx"].includes(extension)) {
    const reader = new ZipReader(new BlobReader(file));
    try {
      const entries = await reader.getEntries(); signal.throwIfAborted();
      const required = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml", hwpx: "Contents/content.hpf" }[extension]!;
      return entries.some(entry => entry.filename === required && !entry.directory && entry.uncompressedSize > 0)
        && !entries.some(entry => entry.encrypted);
    } finally { await reader.close(); }
  }
  if (!["doc", "xls", "ppt", "hwp"].includes(extension)) return false;
  const bytes = new Uint8Array(await file.arrayBuffer()); signal.throwIfAborted();
  if (![0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((value,index)=>bytes[index]===value)) return false;
  const { CFB } = await import("xlsx"); signal.throwIfAborted();
  const container = CFB.read(bytes, { type: "array" });
  const required = { doc: ["WordDocument"], xls: ["Workbook", "Book"], ppt: ["PowerPoint Document"], hwp: ["FileHeader"] }[extension]!;
  return required.some(name => container.FileIndex.some((entry: { name: string; size: number }) => entry.name === name && entry.size > 0))
    && !container.FileIndex.some((entry: { name: string; size: number }) => entry.name === "EncryptedPackage");
}
