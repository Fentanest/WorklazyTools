import type { GeneratorErrorCode, GeneratorLanguage, RowOrigin } from './types.ts';

export class GeneratorError extends Error {
  readonly code: GeneratorErrorCode;
  readonly variables?: string[];
  readonly origins?: RowOrigin[];
  constructor(code: GeneratorErrorCode, detail?: { variables?: string[]; origins?: RowOrigin[] }) {
    super(code);
    this.name = 'GeneratorError';
    this.code = code;
    this.variables = detail?.variables;
    this.origins = detail?.origins;
  }
}
export function generatorErrorCode(error: unknown, fallback: GeneratorErrorCode): GeneratorErrorCode {
  return error instanceof GeneratorError ? error.code : error instanceof DOMException && error.name === 'AbortError' ? 'CANCELED' : fallback;
}
export function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new GeneratorError('CANCELED'); }
const messages: Record<GeneratorErrorCode, [string, string]> = {
  CANCELED: ['취소했습니다.', 'Canceled.'], BUSY: ['현재 작업을 마친 뒤 다시 시도해 주세요.', 'Wait for the current operation to finish.'],
  DISPOSED: ['파일을 다시 선택해 주세요.', 'Select the files again.'],
  UNSUPPORTED_DATA: ['XLSX 또는 CSV 파일을 선택해 주세요.', 'Choose an XLSX or CSV file.'],
  DAMAGED_DATA: ['데이터 파일을 읽지 못했습니다. 파일을 확인해 주세요.', 'Could not read the data file. Check the file.'],
  UNSUPPORTED_TEMPLATE: ['일반 DOCX 양식을 선택해 주세요.', 'Choose a standard DOCX template.'],
  DAMAGED_TEMPLATE: ['양식을 읽지 못했습니다. 파일을 확인해 주세요.', 'Could not read the template. Check the file.'],
  UNSUPPORTED_TAG: ['양식에는 단순 변수만 사용할 수 있습니다.', 'Use only simple variables in the template.'],
  MISSING_MAPPING: ['양식 변수에 연결할 열을 선택해 주세요.', 'Map each template variable to a column.'],
  INVALID_ALIAS: ['비어 있거나 중복된 머리글에는 서로 다른 별칭을 지정해 주세요.', 'Assign distinct aliases to blank or duplicate headers.'],
  INVALID_SELECTION: ['시트와 머리글 행을 확인해 주세요.', 'Check the selected sheet and header row.'],
  CELL_ERROR: ['오류가 있는 셀을 확인해 주세요.', 'Check the cell containing an error.'],
  MISSING_CACHE: ['계산 결과가 없는 수식입니다. 스프레드시트에서 계산 후 저장해 주세요.', 'The formula has no saved result. Recalculate and save the spreadsheet.'],
  INVALID_VALUE: ['문서에 넣을 수 없는 문자가 있습니다.', 'A value contains characters that cannot be inserted into the document.'],
  INVALID_NAME: ['DOCX 파일 이름을 확인해 주세요.', 'Check the DOCX filename.'],
  NAME_COLLISION: ['같은 결과 이름이 있습니다. 이름 규칙을 변경해 주세요.', 'Result names collide. Change the filename pattern.'],
  STORAGE_LIMIT: ['저장 공간 한도에 도달했습니다. 완료된 결과를 내려받아 주세요.', 'The storage limit was reached. Download the completed results.'],
  STORAGE_WRITE: ['결과를 저장하지 못했습니다. 완료된 결과는 유지됩니다.', 'Could not save the result. Completed results are preserved.'],
  STORAGE_READ: ['저장된 결과를 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read a saved result. Try again.'],
  GENERATION_FAILED: ['이 행의 문서를 만들지 못했습니다.', 'Could not generate the document for this row.'],
  EXPORT_FAILED: ['파일을 내보내지 못했습니다. 개별 결과는 유지됩니다.', 'Could not export the file. Individual results are preserved.'],
  NO_RESULTS: ['내보낼 결과가 없습니다.', 'There are no results to export.'],
};
export function generatorMessage(code: GeneratorErrorCode, language: GeneratorLanguage) { return messages[code][language === 'en' ? 1 : 0]; }
