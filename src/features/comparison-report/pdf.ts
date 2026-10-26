import {readablePdfBlocks} from './pdfPresentation.ts';
import { createPdfDocument, embedCustomPdfFont, getPdfFontCharacterSet, rgb } from '../../utils/pdfFontEmbed.ts';
import { assertSnapshot, assertOutput, assertReport, rawReportText, REPORT_LIMITS, type ExportSnapshot } from './snapshot.ts';
export async function loadReportFont(signal: AbortSignal): Promise<Uint8Array> {
  const {createQrLabelFontLoader}=await import('../qr-studio/qrLabelFont.ts');
  assertReport(new URL(import.meta.env.BASE_URL,location.origin).origin===location.origin,'REPORT_FONT');
  const loader=createQrLabelFontLoader(import.meta.env.BASE_URL,location.origin);
  try{const loaded=await loader.load('full',signal);return new Uint8Array(loaded.bytes);}finally{loader.dispose();}
}
/** Visible text budget in UTF-16 units; the complete data is always in the attachment. */
export const REPORT_PDF_TEXT_UNITS = 4 * 1024 ** 2;
const IGNORABLE = /^[\u00AD\u034F\u200B-\u200F\u2060-\u2064\uFE00-\uFE0F\uFEFF\u{E0000}-\u{E0FFF}]$/u;
const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');
/** Keeps a grapheme the font can draw; otherwise draws each code point it can, decomposes
 * presentation-form ligatures, drops invisible format characters and marks the rest. */
export function displayGrapheme(grapheme: string, coverage: ReadonlySet<number>): string {
  const drawable = (text: string) => [...text].every(cp => /[\r\n\t]/.test(cp) || coverage.has(cp.codePointAt(0)!));
  if (!/[\uFB00-\uFB06]/u.test(grapheme) && drawable(grapheme)) return grapheme;
  let out = '';
  for (const cp of grapheme) {
    const compatible = /[\uFB00-\uFB06]/u.test(cp) ? cp.normalize('NFKC') : cp;
    if (drawable(compatible)) out += compatible;
    else if (!IGNORABLE.test(cp)) out += `[U+${hex(cp.codePointAt(0)!)}]`;
  }
  return out;
}
export async function writeSnapshotPdf(snapshot: ExportSnapshot, signal: AbortSignal, fontBytes?: Uint8Array): Promise<Blob> {
  assertSnapshot(snapshot);signal.throwIfAborted(); const bytes = fontBytes ?? await loadReportFont(signal);
  assertReport(bytes.length <= 8 * 1024 ** 2, 'REPORT_FONT');
  const plain=readablePdfBlocks(snapshot);
  assertReport(plain.reduce((n,block)=>n+block.reduce((m,s)=>m+s.length,0),0) <= REPORT_PDF_TEXT_UNITS && plain.reduce((n,block)=>n+block.length,0) <= REPORT_LIMITS.pdfPages * 40, 'REPORT_PDF_LIMIT');
  assertReport(typeof Intl.Segmenter === 'function', 'REPORT_PDF_LAYOUT');
  const segmenter = new Intl.Segmenter(undefined,{granularity:'grapheme'});
  const coverage = new Set(getPdfFontCharacterSet(bytes));
  // A character missing from the font is shown as [U+XXXX] instead of rejecting the whole report.
  let substituted=false;
  const show=(field:string)=>{let out='';for(const{segment}of segmenter.segment(field)){const shown=displayGrapheme(segment,coverage);if(shown!==segment&&shown.includes('[U+'))substituted=true;out+=shown;}return out;};
  let blocks=plain.map(block=>block.map(show));
  if(substituted)blocks=readablePdfBlocks(snapshot,{glyphFallback:true}).map(block=>block.map(show));
  for (const block of blocks) for (const field of block) for (const cp of field.replace(/[\r\n\t]/g, '')) assertReport(coverage.has(cp.codePointAt(0)!), 'REPORT_UNSUPPORTED_GLYPH');
  const document = await createPdfDocument(); const font = await embedCustomPdfFont(document, bytes, { subset: true }); signal.throwIfAborted();
  const size = 10, lineHeight = 16, width = 499, left = 48, bottom = 48;
  let page = document.addPage([595, 842]), y = 794, pages = 1, count = 0;
  const draw = async (line: string) => {
    signal.throwIfAborted(); if (y < bottom) { assertReport(++pages <= REPORT_LIMITS.pdfPages, 'REPORT_PDF_LIMIT'); page = document.addPage([595, 842]); y = 794; }
    page.drawText(line, { x: left, y, font, size, color: rgb(0.08, 0.08, 0.1) }); y -= lineHeight;
    if (++count % 128 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); signal.throwIfAborted(); }
  };
  // Shaping the whole line for every character is quadratic. Sums of cached per-grapheme widths
  // stay within 3% of the shaped width (kerning and ligatures only narrow these fonts), so the
  // shaped width is measured only near the right edge.
  const advances = new Map<string, number>();
  const advance = (grapheme: string) => { let value = advances.get(grapheme); if (value === undefined) { value = font.widthOfTextAtSize(grapheme, size); advances.set(grapheme, value); } return value; };
  const estimate = (text: string) => { let total = 0; for (const { segment } of segmenter.segment(text)) total += advance(segment); return total; };
  const fits = (text: string, estimated: number) => estimated <= width * 0.97 || font.widthOfTextAtSize(text, size) <= width;
  // Prefer whole words where spaces exist; keep grapheme fallback for long words/CJK.
  // No character deletion, ellipsis or whitespace collapsing; original line endings stay attached.
  for (const block of blocks) {
    for (const field of block) for (const paragraph of field.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ').split('\n')) {
      let line = '', estimated = 0;
      for (const { segment: character } of segmenter.segment(paragraph)) {
        assertReport(character.length <= 64, 'REPORT_PDF_LAYOUT');
        const step = advance(character);
        while (line.length + character.length > 512 || !fits(line + character, estimated + step)) {
          assertReport(!!line, 'REPORT_PDF_LIMIT');const space=line.lastIndexOf(' ');
          if(space>0){await draw(line.slice(0,space+1));line=line.slice(space+1);}else{await draw(line);line='';}
          estimated = estimate(line);
        }
        line += character; estimated += step;
      }
      await draw(line);
    }
    await draw('');
  }
  signal.throwIfAborted();
  // Same UTF-8 JSON bytes as the existing lossless TXT writer; no re-diff or metadata loss.
  const attachment=new TextEncoder().encode(rawReportText(snapshot));
  await document.attach(attachment,'comparison-data.json',{mimeType:'application/json',description:'Complete comparison data'});
  signal.throwIfAborted(); const output = await document.save(); signal.throwIfAborted(); return assertOutput(new Blob([output as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
}
