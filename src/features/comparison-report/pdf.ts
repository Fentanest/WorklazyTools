import { REPORT_LABELS } from './labels.ts';
import { createPdfDocument, embedCustomPdfFont, getPdfFontCharacterSet, rgb } from '../../utils/pdfFontEmbed.ts';
import { assertSnapshot, assertOutput, assertReport, reportMetadata, REPORT_LIMITS, type ExportSnapshot } from './snapshot.ts';
export async function loadReportFont(signal: AbortSignal): Promise<Uint8Array> {
  const {createQrLabelFontLoader}=await import('../qr-studio/qrLabelFont.ts');
  assertReport(new URL(import.meta.env.BASE_URL,location.origin).origin===location.origin,'REPORT_FONT');
  const loader=createQrLabelFontLoader(import.meta.env.BASE_URL,location.origin);
  try{const loaded=await loader.load('full',signal);return new Uint8Array(loaded.bytes);}finally{loader.dispose();}
}
export async function writeSnapshotPdf(snapshot: ExportSnapshot, signal: AbortSignal, fontBytes?: Uint8Array): Promise<Blob> {
  assertSnapshot(snapshot);signal.throwIfAborted(); const bytes = fontBytes ?? await loadReportFont(signal);
  assertReport(bytes.length <= 8 * 1024 ** 2, 'REPORT_FONT');
  const labels=REPORT_LABELS[snapshot.language];
  const text = [labels.metadata, `${labels.completion}: ${snapshot.completion}`, `${labels.scope}: ${snapshot.scope.kind}`, ...snapshot.warnings.map(w=>`${labels.warning}: ${w}`), ...Object.entries(reportMetadata(snapshot)).filter(([key])=>!['warnings','completion'].includes(key)).map(([key,value])=>`${key}: ${JSON.stringify(value)}`), labels.layout, ...snapshot.rows.flatMap(r => [`${labels.id}: ${r.id} · ${labels.status}: ${r.status}`, ...(r.coordinates===undefined?[]:[`${labels.coordinates}: ${JSON.stringify(r.coordinates)}`]), ...(r.metadata===undefined?[]:[`${labels.metadata}: ${JSON.stringify(r.metadata)}`]), labels.left+':', r.left, labels.right+':', r.right])];
  assertReport(text.reduce((n,s)=>n+s.length,0) <= 512 * 1024 && text.length <= REPORT_LIMITS.pdfPages * 40, 'REPORT_PDF_LIMIT');
  assertReport(typeof Intl.Segmenter === 'function', 'REPORT_PDF_LAYOUT');
  const segmenter = new Intl.Segmenter(undefined,{granularity:'grapheme'});
  const coverage = new Set(getPdfFontCharacterSet(bytes));
  for (const field of text) for (const cp of field.replace(/[\r\n\t]/g, '')) assertReport(coverage.has(cp.codePointAt(0)!) && !/[\uFB00-\uFB06]/u.test(cp), 'REPORT_UNSUPPORTED_GLYPH');
  const document = await createPdfDocument(); const font = await embedCustomPdfFont(document, bytes); signal.throwIfAborted();
  const size = 10, lineHeight = 16, width = 499, left = 48, bottom = 48;
  let page = document.addPage([595, 842]), y = 794, pages = 1, count = 0;
  const draw = async (line: string) => {
    signal.throwIfAborted(); if (y < bottom) { assertReport(++pages <= REPORT_LIMITS.pdfPages, 'REPORT_PDF_LIMIT'); page = document.addPage([595, 842]); y = 794; }
    page.drawText(line, { x: left, y, font, size, color: rgb(0.08, 0.08, 0.1) }); y -= lineHeight;
    if (++count % 128 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); signal.throwIfAborted(); }
  };
  // Code-point wrapping preserves every original character; no ellipsis or whitespace collapsing.
  for (const field of text) {
    for (const paragraph of field.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ').split('\n')) {
      let line = '';
      for (const { segment: character } of segmenter.segment(paragraph)) {
        assertReport(character.length <= 64, 'REPORT_PDF_LAYOUT');
        if (line.length + character.length > 512 || font.widthOfTextAtSize(line + character, size) > width) { assertReport(!!line, 'REPORT_PDF_LIMIT'); await draw(line); line = ''; }
        line += character;
      }
      await draw(line);
    }
    await draw('');
  }
  signal.throwIfAborted(); const output = await document.save(); signal.throwIfAborted(); return assertOutput(new Blob([output as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
}
