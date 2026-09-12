import type { SpreadsheetCellData } from '../spreadsheet-core/inputAdapter.ts';
import { GeneratorError } from './errors.ts';
import type { GeneratorRow, GeneratorSelection } from './types.ts';

export const forbiddenVariables = new Set(['__proto__', 'constructor', 'prototype']);
export function validateAlias(alias: string) {
  if (typeof alias !== 'string' || !alias || !alias.trim() || forbiddenVariables.has(alias) || /[{}\u0000-\u001f]/u.test(alias) || /^[#\/@%^!:?=]/u.test(alias) || alias === '.') {
    throw new GeneratorError('INVALID_ALIAS');
  }
  return alias;
}
export function cellDisplayValue(cell?: SpreadsheetCellData): string {
  if (cell?.type === 'error') throw new GeneratorError('CELL_ERROR');
  if (cell?.formula !== undefined && cell.cacheState !== 'present') throw new GeneratorError('MISSING_CACHE');
  if (!cell) return '';
  return cell.displayValue ?? (cell.value == null ? '' : String(cell.value));
}
export function mapGeneratorRows(selections: readonly GeneratorSelection[], variables: readonly string[]): GeneratorRow[] {
  const rows: GeneratorRow[] = [];
  const sources = new Set<string>();
  for (const selection of selections) {
    const { source, sheetName, headerRow, aliases = {} } = selection;
    if (sources.has(source.id)) throw new GeneratorError('INVALID_SELECTION');
    sources.add(source.id);
    if (!['xlsx', 'csv'].includes(source.book.format)) throw new GeneratorError('UNSUPPORTED_DATA');
    const sheet = source.book.sheets.find(item => item.name === sheetName);
    if (!sheet || !Number.isInteger(headerRow) || headerRow < 1 || headerRow > sheet.rowCount) throw new GeneratorError('INVALID_SELECTION');
    const dataRows = new Set(sheet.cells.filter(cell => cell.formula !== undefined || cell.type === 'error' || (cell.displayValue ?? (cell.value == null ? '' : String(cell.value))) !== '').map(cell => cell.row));
    const cells = new Map(sheet.cells.map(cell => [`${cell.row}:${cell.column}`, cell]));
    const headers = Array.from({ length: sheet.columnCount }, (_, i) => cellDisplayValue(cells.get(`${headerRow}:${i + 1}`)));
    const names = new Map<string, number>();
    for (let index = 0; index < headers.length; index++) {
      const column = index + 1;
      const explicit = Object.getOwnPropertyDescriptor(aliases, String(column));
      if (explicit && !('value' in explicit)) throw new GeneratorError('INVALID_ALIAS');
      const raw = headers[index];
      if ((!raw || headers.filter(value => value === raw).length > 1) && !explicit) throw new GeneratorError('INVALID_ALIAS');
      const alias = validateAlias(explicit ? explicit.value : raw);
      if (typeof alias !== 'string' || names.has(alias)) throw new GeneratorError('INVALID_ALIAS');
      names.set(alias, column);
    }
    const missing = variables.filter(name => !names.has(name));
    if (missing.length) throw new GeneratorError('MISSING_MAPPING', { variables: missing });
    for (let row = headerRow + 1; row <= sheet.rowCount; row++) {
      if (!dataRows.has(row)) continue;
      const values: Record<string, string> = Object.create(null);
      let error: GeneratorRow['error'];
      for (const [name, column] of names) {
        try { values[name] = cellDisplayValue(cells.get(`${row}:${column}`)); }
        catch (cause) { error ??= cause instanceof GeneratorError ? cause.code : 'INVALID_VALUE'; }
      }
      const original = sheet.rowLineage.find(line => line.sourceRow === row)?.sourceRow ?? cells.get(`${row}:1`)?.sourceRow ?? row;
      rows.push({ id: `row-${rows.length + 1}`, sourceId: source.id, sourceFile: source.fileName, sheet: sheetName, row: original, values, error });
    }
  }
  return rows;
}
