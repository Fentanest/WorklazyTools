export interface FormulaCoordinateTransform {
  rows?: ReadonlyArray<number | null>;
  columns?: ReadonlyArray<number | null>;
  expandInsertedColumns?: boolean;
}

export interface FormulaTransformResult {
  formula: string;
  degraded: boolean;
  reason?: "NONCONTIGUOUS_REFERENCE";
}

interface ReferencePoint {
  column: number;
  row: number;
  absoluteColumn: boolean;
  absoluteRow: boolean;
}

const REFERENCE = /(^|[^A-Z0-9_.])((\$?)([A-Z]{1,3})(\$?)([1-9][0-9]*))(?::((\$?)([A-Z]{1,3})(\$?)([1-9][0-9]*)))?/giu;

export function transformFormulaReferences(formula: string, transform: FormulaCoordinateTransform): FormulaTransformResult {
  const pieces = splitFormulaStrings(formula);
  let degraded = false;
  const output = pieces.map((piece) => {
    if (piece.quoted) return piece.text;
    return piece.text.replace(REFERENCE, (match, prefix: string, _first: string, firstColumnAbsolute: string, firstColumn: string, firstRowAbsolute: string, firstRow: string, second: string | undefined, secondColumnAbsolute: string | undefined, secondColumn: string | undefined, secondRowAbsolute: string | undefined, secondRow: string | undefined, offset: number, source: string) => {
      const after = source[offset + match.length];
      if (!second && after === "(") return match;
      const start = point(firstColumn, firstRow, firstColumnAbsolute, firstRowAbsolute);
      if (!validPoint(start)) return match;
      if (!second) {
        const mapped = mapPoint(start, transform);
        return `${prefix}${mapped ? encodePoint(mapped) : "#REF!"}`;
      }
      const end = point(secondColumn!, secondRow!, secondColumnAbsolute!, secondRowAbsolute!);
      if (!validPoint(end)) return match;
      const mappedRows = mapInterval(start.row, end.row, transform.rows, false);
      const mappedColumns = mapInterval(start.column, end.column, transform.columns, transform.expandInsertedColumns ?? false);
      if (mappedRows === "noncontiguous" || mappedColumns === "noncontiguous") {
        degraded = true;
        return match;
      }
      if (!mappedRows || !mappedColumns) return `${prefix}#REF!`;
      const mappedStart = { ...start, row: mappedRows.start, column: mappedColumns.start };
      const mappedEnd = { ...end, row: mappedRows.end, column: mappedColumns.end };
      return `${prefix}${encodePoint(mappedStart)}:${encodePoint(mappedEnd)}`;
    });
  }).join("");
  return degraded ? { formula, degraded: true, reason: "NONCONTIGUOUS_REFERENCE" } : { formula: output, degraded: false };
}

export function formulaNeedsValueDowngrade(formula: string) {
  return /(?:^|[^A-Z0-9_])(?:INDIRECT|OFFSET)\s*\(/iu.test(formula)
    || /(?:'[^']+'|[A-Z0-9_.]+)!\$?[A-Z]{1,3}\$?[1-9][0-9]*/iu.test(formula)
    || /\[[^\]]+\]/u.test(formula);
}

function splitFormulaStrings(formula: string) {
  const pieces: Array<{ text: string; quoted: boolean }> = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < formula.length; index += 1) {
    if (formula[index] !== '"') continue;
    if (quoted && formula[index + 1] === '"') { index += 1; continue; }
    if (index > start) pieces.push({ text: formula.slice(start, index), quoted });
    pieces.push({ text: '"', quoted: true });
    quoted = !quoted;
    start = index + 1;
  }
  if (start < formula.length) pieces.push({ text: formula.slice(start), quoted });
  return pieces;
}

function point(column: string, row: string, absoluteColumn: string, absoluteRow: string): ReferencePoint {
  return { column: decodeColumn(column), row: Number(row), absoluteColumn: absoluteColumn === "$", absoluteRow: absoluteRow === "$" };
}

function validPoint(value: ReferencePoint) {
  return value.column >= 1 && value.column <= 16_384 && value.row >= 1 && value.row <= 1_048_576;
}

function mapPoint(value: ReferencePoint, transform: FormulaCoordinateTransform): ReferencePoint | undefined {
  const row = transform.rows ? transform.rows[value.row] : value.row;
  const column = transform.columns ? transform.columns[value.column] : value.column;
  return row === null || row === undefined || column === null || column === undefined ? undefined : { ...value, row, column };
}

function mapInterval(start: number, end: number, map: ReadonlyArray<number | null> | undefined, expandGaps: boolean) {
  if (!map) return { start, end };
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  const values: number[] = [];
  for (let index = lower; index <= upper; index += 1) {
    const mapped = map[index];
    if (mapped !== null && mapped !== undefined) values.push(mapped);
  }
  if (!values.length) return undefined;
  const unique = [...new Set(values)].sort((left, right) => left - right);
  if (!expandGaps && unique.some((value, index) => index > 0 && value !== unique[index - 1] + 1)) return "noncontiguous" as const;
  const reversed = start > end;
  return reversed ? { start: unique.at(-1)!, end: unique[0] } : { start: unique[0], end: unique.at(-1)! };
}

function encodePoint(value: ReferencePoint) {
  return `${value.absoluteColumn ? "$" : ""}${encodeColumn(value.column)}${value.absoluteRow ? "$" : ""}${value.row}`;
}

function decodeColumn(value: string) {
  let result = 0;
  for (const character of value.toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64;
  return result;
}

function encodeColumn(value: number) {
  let current = value;
  let result = "";
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + current % 26) + result;
    current = Math.floor(current / 26);
  }
  return result;
}
