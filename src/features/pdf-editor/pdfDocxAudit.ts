import type { PdfTextDocument } from "./types";

/** Detect source text that pdf2docx silently omits despite a valid DOCX ZIP. */
export async function missingDocxSourceText(blob: Blob, document: PdfTextDocument): Promise<Array<{ pageNumber: number; text: string }>> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(blob);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("DOCX_DOCUMENT_MISSING");
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.getElementsByTagName("parsererror").length) throw new Error("DOCX_DOCUMENT_INVALID");
  const output = normalized(Array.from(parsed.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t"), node => node.textContent ?? "").join(""));
  const expected = new Map<string, { count: number; pageNumber: number; text: string }>();
  for (const page of document.pages) for (const line of page.lines) {
    for (const token of line.text.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? []) {
      const text = normalized(token);
      if (text.length < 2) continue;
      const prior = expected.get(text);
      if (prior) prior.count += 1;
      else expected.set(text, { count: 1, pageNumber: page.pageNumber, text: token });
    }
  }
  const missing: Array<{ pageNumber: number; text: string }> = [];
  for (const [text, item] of expected) {
    let found = 0, from = 0;
    while (found < item.count) {
      const at = output.indexOf(text, from);
      if (at < 0) break;
      found += 1; from = at + text.length;
    }
    if (found < item.count) missing.push({ pageNumber: item.pageNumber, text: item.text });
  }
  return missing;
}

function normalized(value: string) { return value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase(); }
