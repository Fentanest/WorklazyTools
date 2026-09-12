import type { AppLanguage } from '../../i18n/languages.ts';
import type { PairComparison } from './types.ts';
import { checkAbort } from './kernel.ts';
const LABELS = {
  en: { sheet: 'PDF comparison', empty: 'Summary', warning: 'Extracted text can differ from the original. Pixel comparison does not establish document identity.', headers: ['Before file', 'After file', 'Before page', 'After page', 'Mapping source', 'Pair status', 'Page status', 'Before text available', 'After text available', 'Text comparison', 'Extracted text diff', 'Visual comparison', 'Pixel count', 'Pixel ratio', 'DPI', 'Scale factor', 'Threshold', 'Size changed', 'Before dimensions', 'After dimensions', 'Warning', 'Partial', 'Error'] },
  ko: { sheet: 'PDF 비교', empty: '요약', warning: '추출된 텍스트는 원문과 다를 수 있습니다. 픽셀 비교는 문서의 동일성을 보장하지 않습니다.', headers: ['변경 전 파일', '변경 후 파일', '변경 전 쪽', '변경 후 쪽', '쪽 대응', '파일쌍 상태', '쪽 상태', '변경 전 텍스트 있음', '변경 후 텍스트 있음', '추출 텍스트 비교', '추출 텍스트 변경', '시각 비교', '차이 픽셀 수', '차이 비율', 'DPI', '배율', '임계값', '쪽 크기 변경', '변경 전 크기', '변경 후 크기', '주의', '부분 결과', '오류'] },
};
const STATUS: Record<string, [string, string]> = {
  'page-number': ['쪽 번호로 대응', 'Match by page number'], manual: ['수동 대응', 'Manual mapping'], complete: ['완료', 'Complete'], failed: ['실패', 'Failed'], canceled: ['취소됨', 'Canceled'], unknown: ['미확인', 'Unknown'],
  'equal-extracted-text': ['추출된 텍스트에서 차이 없음', 'No difference in extracted text'], 'different-extracted-text': ['추출된 텍스트에 차이 있음', 'Difference in extracted text'], unavailable: ['비교할 텍스트 없음', 'No text to compare'],
  'equal-pixels': ['설정된 렌더링에서 픽셀 차이 없음', 'No pixel difference at the selected rendering settings'], 'different-pixels': ['픽셀 차이 있음', 'Pixel difference'], added: ['추가', 'Added'], deleted: ['삭제', 'Deleted'],
  password: ['잠금 없는 PDF 사본이 필요합니다', 'Use an unlocked PDF copy'], 'invalid-pdf': ['PDF를 읽을 수 없습니다', 'Cannot read this PDF'], 'read-failed': ['파일 읽기에 실패했습니다', 'File could not be read'], 'render-failed': ['쪽 비교에 실패했습니다', 'Page comparison failed'], 'invalid-mapping': ['쪽 대응을 확인하세요', 'Check page mapping'],
};
export function pairReportDefinition(pair: PairComparison, language: AppLanguage) {
  const labels = LABELS[language]; const label = (value: string) => STATUS[value]?.[language === 'ko' ? 0 : 1] ?? value;
  const rows = pair.pages.map(page => {
    const g = page.geometry;
    return [pair.beforeName, pair.afterName, page.mapping.before === null ? '' : page.mapping.before + 1, page.mapping.after === null ? '' : page.mapping.after + 1,
      label(pair.mappingSource), label(pair.status), label(page.status), page.beforeTextAvailable, page.afterTextAvailable, label(page.textComparison),
      page.segments.filter(segment => segment.type !== 'equal').map(segment => `${segment.type === 'deleted' ? '−' : '+'} ${segment.text}`).join('\n'),
      label(page.visualComparison), page.pixelCount ?? '', page.pixelRatio ?? '', g?.dpi ?? '', g?.scaleFactor ?? '', page.threshold, g?.pageSizeChanged ?? '',
      g ? `${g.beforeWidth}×${g.beforeHeight}` : '', g ? `${g.afterWidth}×${g.afterHeight}` : '',
      labels.warning + (g?.reducedResolution ? (language === 'ko' ? ' 비교 해상도를 낮췄습니다.' : ' Comparison resolution was reduced.') : ''), pair.partial, page.error ? label(page.error) : ''];
  });
  if (!rows.length) rows.push([pair.beforeName, pair.afterName, '', '', label(pair.mappingSource), label(pair.status), labels.empty, '', '', '', '', '', '', '', '', '', '', '', '', '', labels.warning, pair.partial, pair.error ? label(pair.error) : '']);
  return { sheets: [{ name: labels.sheet, headers: labels.headers, rows }] };
}
export async function writePairReport(pair: PairComparison, language: AppLanguage, signal?: AbortSignal) {
  checkAbort(signal);
  const [{ writeXlsxReport }, { createSafeFileName }] = await Promise.all([import('../../utils/xlsxReport.ts'), import('../../utils/fileNameSafety.ts')]);
  checkAbort(signal);
  const buffer = await writeXlsxReport(pairReportDefinition(pair, language)); checkAbort(signal);
  return { blob: new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName: createSafeFileName(`${pair.beforeName.replace(/\.pdf$/i, '')}-${pair.afterName.replace(/\.pdf$/i, '')}-comparison.xlsx`) };
}
export async function writeComparisonReports(pairs: readonly PairComparison[], language: AppLanguage, signal?: AbortSignal) {
  checkAbort(signal); if (!pairs.length) throw new Error('No comparison results');
  if (pairs.length === 1) return writePairReport(pairs[0], language, signal);
  const [{ writeZipArchive, createSafeZipArchiveSources }, { BlobWriter }] = await Promise.all([import('../../utils/zipArchive.ts'), import('@zip.js/zip.js')]);
  checkAbort(signal);
  const files = [];
  for (const pair of pairs) { files.push(await writePairReport(pair, language, signal)); checkAbort(signal); }
  const blob = await writeZipArchive(createSafeZipArchiveSources(files), new BlobWriter('application/zip'), signal) as Blob;
  checkAbort(signal); return { blob, fileName: 'pdf-comparison-reports.zip' };
}
