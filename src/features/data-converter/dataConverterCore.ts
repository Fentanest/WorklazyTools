import Papa from "papaparse";

export interface CsvTableData {
  headers: string[];
  rows: string[][];
  warnings: string[];
}

export function parseCsvStream(text: string, korean: boolean) {
  return new Promise<CsvTableData>((resolve, reject) => {
    const records: Record<string, string>[] = [];
    const warnings: string[] = [];
    let headers: string[] = [];
    let aborted = false;
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      chunkSize: 256 * 1024,
      transformHeader: (header, index) => header.trim() || `${korean ? "열" : "Column "}${index + 1}`,
      chunk: (results: Papa.ParseResult<Record<string, string>>, parser: Papa.Parser) => {
        const fatal = results.errors.find((error) => error.type !== "FieldMismatch");
        const mismatchCount = results.errors.filter((error) => error.type === "FieldMismatch").length;
        if (mismatchCount) warnings.push(korean ? `${mismatchCount}개 행의 열 개수가 헤더와 달라 빈 값을 보완하거나 남는 값을 제외했습니다.` : `${mismatchCount} rows had a different column count; missing values were filled and extras were omitted.`);
        if (fatal) {
          aborted = true;
          reject(new Error(`${fatal.row !== undefined ? `${korean ? `${fatal.row + 1}행` : `Row ${fatal.row + 1}`}: ` : ""}${fatal.message}`));
          parser.abort();
          return;
        }
        headers = results.meta.fields ?? headers;
        records.push(...results.data);
      },
      complete: () => {
        if (aborted) return;
        resolve({ headers, rows: records.map((row) => headers.map((header) => row[header] ?? "")), warnings });
      },
      error: (error: Error) => reject(error),
    });
  });
}
