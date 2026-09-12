import { SafeFileNameRegistry, reserveSafeFileName } from '../../utils/fileNameSafety.ts';
import { GeneratorError } from './errors.ts';
import type { GeneratorRow, RowOrigin } from './types.ts';

export const defaultGeneratorName = 'document-{file}-{row}.docx';
export function sourceBaseName(name: string) { return name.split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').normalize('NFC'); }
export function nameVariables(pattern: string): string[] {
  const keys: string[] = [];
  const remainder = pattern.replace(/\{([^{}]+)\}/g, (_, name: string) => { keys.push(name); return ''; });
  if (/[{}]/.test(remainder)) throw new GeneratorError('INVALID_NAME');
  return keys.filter(key => key !== 'row' && key !== 'file');
}
export function assignGeneratorNames(rows: readonly GeneratorRow[], pattern = defaultGeneratorName): GeneratorRow[] {
  nameVariables(pattern);
  const registry = new SafeFileNameRegistry();
  const owners = new Map<string, RowOrigin>();
  return rows.map(row => {
    if (row.error) return row;
    const replaced = pattern.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (key === 'row') return String(row.row);
      if (key === 'file') return sourceBaseName(row.sourceFile);
      if (!Object.hasOwn(row.values, key)) throw new GeneratorError('MISSING_MAPPING', { variables: [key] });
      return row.values[key];
    });
    const segments = replaced.match(/\.docx/gi) ?? [];
    let name = replaced;
    if (/\.docx$/i.test(name)) {
      if (segments.length !== 1) throw new GeneratorError('INVALID_NAME');
      name = name.slice(0, -5) + '.docx';
    } else {
      if (segments.length || /\.[^.]+$/.test(name)) throw new GeneratorError('INVALID_NAME');
      name += '.docx';
    }
    name = name.normalize('NFC');
    const collisionKey = name.toLocaleLowerCase('en-US');
    if (owners.has(collisionKey)) throw new GeneratorError('NAME_COLLISION', { origins: [owners.get(collisionKey)!, row] });
    try { const fileName = reserveSafeFileName(name, registry); owners.set(collisionKey, row); return { ...row, fileName }; }
    catch { throw new GeneratorError('INVALID_NAME'); }
  });
}
