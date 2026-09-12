import type { GeneratorLanguage, GeneratorManifestRow } from './types.ts';
import { generatorMessage } from './errors.ts';

export async function createGeneratorManifest(rows: readonly GeneratorManifestRow[], language: GeneratorLanguage): Promise<Blob> {
  const {writeXlsxReport} = await import('../../utils/xlsxReport.ts');
  const en = language === 'en';
  const labels = {success: en ? 'Succeeded' : '성공', failed: en ? 'Failed' : '실패', canceled: en ? 'Canceled' : '취소', 'not-started': en ? 'Not started' : '미시작'};
  const bytes = await writeXlsxReport({sheets: [{
    name: en ? 'Results' : '결과',
    headers: en ? ['Source file', 'Sheet', 'Row', 'Filename', 'Status', 'Bytes', 'Reason'] : ['원본 파일', '시트', '행', '파일 이름', '상태', '바이트', '사유'],
    rows: rows.map(row => [row.sourceFile, row.sheet, row.row, row.fileName, labels[row.status], row.bytes, row.error ? generatorMessage(row.error, language) : '']),
  }]});
  return new Blob([bytes as BlobPart], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
