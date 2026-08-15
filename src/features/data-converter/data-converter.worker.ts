/// <reference lib="webworker" />

import Papa from "papaparse";

type Kind = "csv" | "json" | "html";
interface TableData { headers: string[]; rows: string[][]; warnings?: string[] }

self.onmessage = async (event: MessageEvent<{ source: Kind; target: Kind; text: string; language?: string }>) => {
  const korean = event.data.language !== "en";
  try {
    const table = await parseTable(event.data.source, event.data.text, korean);
    const result = serializeTable(event.data.target, table.headers, table.rows);
    self.postMessage({ type: "result", result, rows: table.rows.length, columns: table.headers.length, warnings: table.warnings ?? [] });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : korean ? "표 데이터를 변환하지 못했습니다." : "The table data could not be converted." });
  }
};

function parseTable(kind: Kind, text: string, korean: boolean): TableData | Promise<TableData> {
  if (kind === "csv") return parseCsvStream(text, korean);
  if (kind === "json") {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) throw new Error(korean ? "JSON 최상위 값은 배열이어야 합니다." : "The top-level JSON value must be an array.");
    if (!value.length) return { headers: [], rows: [] };
    if (Array.isArray(value[0])) {
      const width = Math.max(...value.map((row) => Array.isArray(row) ? row.length : 0));
      return { headers: Array.from({ length: width }, (_, index) => `${korean ? "열" : "Column "}${index + 1}`), rows: value.map((row) => (row as unknown[]).map(stringifyCell)) };
    }
    const headers = Array.from(new Set(value.flatMap((row) => Object.keys(row as object))));
    return { headers, rows: value.map((row) => headers.map((header) => stringifyCell((row as Record<string, unknown>)[header]))) };
  }
  const rows = Array.from(text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (match) => Array.from(match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi), (cell) => decodeEntities(cell[1].replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").trim())));
  if (!rows.length) throw new Error(korean ? "HTML에서 table 행을 찾지 못했습니다." : "No table rows were found in the HTML.");
  return { headers: rows[0], rows: rows.slice(1) };
}

function parseCsvStream(text: string, korean: boolean) {
  return new Promise<TableData>((resolve, reject) => {
    const records: Record<string, string>[] = [];
    const warnings: string[] = [];
    let headers: string[] = [];
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
          parser.abort();
          reject(new Error(`${fatal.row !== undefined ? `${korean ? `${fatal.row + 1}행` : `Row ${fatal.row + 1}`}: ` : ""}${fatal.message}`));
          return;
        }
        headers = results.meta.fields ?? headers;
        records.push(...results.data);
      },
      complete: () => resolve({ headers, rows: records.map((row) => headers.map((header) => row[header] ?? "")), warnings }),
      error: (error: Error) => reject(error),
    });
  });
}

function serializeTable(kind: Kind, headers: string[], rows: string[][]) {
  if (kind === "csv") return Papa.unparse({ fields: headers, data: rows });
  if (kind === "json") return JSON.stringify(rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2);
  return `<table>\n  <thead>\n    <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>\n  </thead>\n  <tbody>\n${rows.map((row) => `    <tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("\n")}\n  </tbody>\n</table>`;
}

function stringifyCell(value: unknown) { return value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function decodeEntities(value: string) { return value.replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&"); }

export {};
