/**
 * ExcelJS converts CSV-looking numbers, dates, booleans, and error literals by
 * default. CSV has no cell type metadata, so preserving the source text is the
 * only lossless import policy.
 */
export function preserveCsvValue(value: string): string | null {
  return value === "" ? null : value;
}
