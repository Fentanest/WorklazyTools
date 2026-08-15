import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import { Readable } from "readable-stream";

/**
 * ExcelJS converts CSV-looking numbers, dates, booleans, and error literals by
 * default. CSV has no cell type metadata, so preserving the source text is the
 * only lossless import policy.
 */
export function preserveCsvValue(value: string): string | null {
  return value === "" ? null : value;
}

export async function readCsvWorkbook(text: string, sheetName: string) {
  const workbook = new ExcelJS.Workbook();
  const stream = new Readable({ read() {} });
  stream.push(Buffer.from(text, "utf8"));
  stream.push(null);
  await workbook.csv.read(stream, { sheetName, map: preserveCsvValue });
  return workbook;
}
