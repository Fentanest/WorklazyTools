/// <reference lib="webworker" />
import Papa from "papaparse";
type Kind = "csv" | "json" | "html";
self.onmessage = async (event: MessageEvent<{ source: Kind; target: Kind; text: string }>) => {
  try { const table = await parseTable(event.data.source, event.data.text); const result = serializeTable(event.data.target, table.headers, table.rows); self.postMessage({ type: "result", result, rows: table.rows.length, columns: table.headers.length }); }
  catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : "표 데이터를 변환하지 못했습니다." }); }
};
function parseTable(kind: Kind, text: string) {
  if (kind === "csv") return parseCsvStream(text);
  if (kind === "json") { const value = JSON.parse(text); if (!Array.isArray(value)) throw new Error("JSON 최상위 값은 배열이어야 합니다."); if (!value.length) return { headers: [], rows: [] as string[][] }; if (Array.isArray(value[0])) { const width = Math.max(...value.map((row) => Array.isArray(row) ? row.length : 0)); return { headers: Array.from({ length: width }, (_, index) => `열${index + 1}`), rows: value.map((row) => (row as unknown[]).map(stringifyCell)) }; } const headers = Array.from(new Set(value.flatMap((row) => Object.keys(row as object)))); return { headers, rows: value.map((row) => headers.map((header) => stringifyCell((row as Record<string, unknown>)[header]))) }; }
  const rows = Array.from(text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (match) => Array.from(match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi), (cell) => decodeEntities(cell[1].replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").trim())));
  if (!rows.length) throw new Error("HTML에서 table 행을 찾지 못했습니다."); return { headers: rows[0], rows: rows.slice(1) };
}
function parseCsvStream(text: string) { return new Promise<{ headers: string[]; rows: string[][] }>((resolve, reject) => { const records: Record<string, string>[] = []; let headers: string[] = []; Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", chunkSize: 256 * 1024, transformHeader: (header, index) => header.trim() || `열${index + 1}`, chunk: (results: Papa.ParseResult<Record<string, string>>) => { if (results.errors.length) { reject(new Error(`${results.errors[0].row !== undefined ? `${results.errors[0].row + 1}행: ` : ""}${results.errors[0].message}`)); return; } headers = results.meta.fields ?? headers; records.push(...results.data); }, complete: () => resolve({ headers, rows: records.map((row) => headers.map((header) => row[header] ?? "")) }), error: (error: Error) => reject(error) }); }); }
function serializeTable(kind: Kind, headers: string[], rows: string[][]) { if (kind === "csv") return Papa.unparse({ fields: headers, data: rows }); if (kind === "json") return JSON.stringify(rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2); return `<table>\n  <thead>\n    <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>\n  </thead>\n  <tbody>\n${rows.map((row) => `    <tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("\n")}\n  </tbody>\n</table>`; }
function stringifyCell(value: unknown) { return value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function decodeEntities(value: string) { return value.replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&"); }
export {};
