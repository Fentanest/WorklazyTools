import { parseSpreadsheetInput } from '../spreadsheet-core/inputAdapter.ts';
import { GeneratorError } from './errors.ts';
export async function parseGeneratorData(fileName: string, buffer: ArrayBuffer, signal?: AbortSignal) {
  const book = await parseSpreadsheetInput(fileName, buffer, {signal});
  if (book.format !== 'xlsx' && book.format !== 'csv') throw new GeneratorError('UNSUPPORTED_DATA');
  return book;
}
