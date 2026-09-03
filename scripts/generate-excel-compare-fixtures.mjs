import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import JSZip from "jszip";
import XLSX from "xlsx";

// This is the gzip-compressed examples/vbaProject.bin from XlsxWriter commit
// 5d4606d89a955226d2d0825a0f44309043ae7251 (BSD-2-Clause). Its Module1
// contains the real say_hello VBA procedure. Keeping the deterministic project
// bytes here lets the synthetic XLSM fixture be generated without Excel or a
// network dependency.
const VBA_PROJECT_GZIP_BASE64 = "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";

const outputDirectory = path.resolve(process.argv[2] || "/tmp/worklazy-excel-compare-fixtures");
await fs.mkdir(outputDirectory, { recursive: true });

const vbaProject = gunzipSync(Buffer.from(VBA_PROJECT_GZIP_BASE64, "base64"));
verifyVbaProject(vbaProject);

const left = fixtureWorkbook(false);
const right = fixtureWorkbook(true);
await writeWorkbook("left.xlsx", left, "xlsx");
await writeWorkbook("right.xlsx", right, "xlsx");
await writeWorkbook("date-1900.xlsx", dateWorkbook(false), "xlsx");
await writeWorkbook("date-1904.xlsx", dateWorkbook(true), "xlsx");
await writeWorkbook("cancel-left.xlsx", largeWorkbook("L"), "xlsx");
await writeWorkbook("cancel-right.xlsx", largeWorkbook("R"), "xlsx");

const macro = fixtureWorkbook(false);
macro.vbaraw = vbaProject;
await writeWorkbook("macro.xlsm", macro, "xlsm", { bookVBA: true });

const biff8 = XLSX.utils.book_new();
const biff8Sheet = XLSX.utils.aoa_to_sheet([[7]]);
// BIFF8 CellParsedFormula: cce=3, PtgInt(7). `bf` makes the writer emit
// a Formula record with a cached numeric value instead of a plain Number.
biff8Sheet.A1 = { t: "n", v: 7, bf: Uint8Array.from([3, 0, 0x1e, 7, 0]) };
XLSX.utils.book_append_sheet(biff8, biff8Sheet, "Data");
await writeWorkbook("formula-biff8.xls", biff8, "biff8");

const xlsbBase = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(xlsbBase, XLSX.utils.aoa_to_sheet([[7, 7]]), "Data");
const xlsb = await addXlsbReferenceFormula(XLSX.write(xlsbBase, { bookType: "xlsb", type: "buffer" }));
await fs.writeFile(path.join(outputDirectory, "formula.xlsb"), xlsb);

const spreadsheetMl = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Data"><Table><Row><Cell><Data ss:Type="Number">7</Data></Cell><Cell ss:Formula="=RC[-1]"><Data ss:Type="Number">7</Data></Cell></Row></Table></Worksheet></Workbook>`;
await fs.writeFile(path.join(outputDirectory, "spreadsheetml.xls"), spreadsheetMl);
await fs.writeFile(path.join(outputDirectory, "sample.csv"), "ID,Amount\nA,10\nB,20\n", "utf8");
await fs.writeFile(path.join(outputDirectory, "damaged.xlsx"), Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]));

await verifyFormula(path.join(outputDirectory, "formula-biff8.xls"), "7");
await verifyFormula(path.join(outputDirectory, "formula.xlsb"), "A1");
const macroArchive = await JSZip.loadAsync(await fs.readFile(path.join(outputDirectory, "macro.xlsm")));
const embeddedProject = await macroArchive.file("xl/vbaProject.bin")?.async("nodebuffer");
if (!embeddedProject || !embeddedProject.equals(vbaProject)) throw new Error("Generated XLSM did not preserve its VBA project.");

console.log(JSON.stringify({
  outputDirectory,
  fixtures: ["left.xlsx", "right.xlsx", "date-1900.xlsx", "date-1904.xlsx", "cancel-left.xlsx", "cancel-right.xlsx", "formula-biff8.xls", "formula.xlsb", "macro.xlsm", "spreadsheetml.xls", "sample.csv", "damaged.xlsx"],
  formulas: { biff8: "7", xlsb: "A1", xlsm: "B2+C2" },
  vbaProjectBytes: vbaProject.length,
}, null, 2));

function fixtureWorkbook(changed) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["ID", "Debit", "Credit", "Balance", "Note"],
    ["A-001", 10, 20, 30, changed ? "updated" : "base"],
    ["A-002", 5, 7, 12, "stable"],
  ]);
  sheet.D2 = { t: "n", v: 30, f: "B2+C2", z: "#,##0.00" };
  sheet.D3 = { t: "n", v: 12, f: "B3+C3", z: "#,##0.00" };
  sheet.A1.s = { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "FF22A65A" } } };
  sheet["!merges"] = [XLSX.utils.decode_range("E2:E3")];
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  return workbook;
}

function dateWorkbook(date1904) {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { WBProps: { date1904 } };
  const sheet = XLSX.utils.aoa_to_sheet([["Date", "DateTime"], [new Date("2024-02-29T00:00:00.000Z"), new Date("2024-02-29T12:34:56.000Z")]], { cellDates: true });
  sheet.A2.z = "yyyy-mm-dd";
  sheet.B2.z = "yyyy-mm-dd hh:mm:ss";
  XLSX.utils.book_append_sheet(workbook, sheet, "Dates");
  return workbook;
}

function largeWorkbook(prefix) {
  const workbook = XLSX.utils.book_new();
  const rows = [["ID", "Amount", "Date", "Partner", "Memo"]];
  for (let index = 0; index < 5_000; index += 1) rows.push([`${prefix}-${index}`, index + 0.25, "2026-09-03", `Partner ${index % 17}`, `${prefix} row ${index}`]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Data");
  return workbook;
}

async function writeWorkbook(name, workbook, bookType, extra = {}) {
  const buffer = XLSX.write(workbook, { bookType, type: "buffer", cellStyles: true, ...extra });
  await fs.writeFile(path.join(outputDirectory, name), buffer);
}

function verifyFormula(filePath, expected) {
  return fs.readFile(filePath).then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true });
    const worksheet = workbook.Sheets.Data;
    const formula = worksheet.B1?.f ?? worksheet.A1?.f;
    if (String(formula) !== expected) throw new Error(`${path.basename(filePath)} formula was not preserved.`);
  });
}

function verifyVbaProject(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))) throw new Error("VBA project is not an OLE compound file.");
  const cfb = XLSX.CFB.read(buffer, { type: "buffer" });
  const project = XLSX.CFB.find(cfb, "/PROJECT");
  const module = XLSX.CFB.find(cfb, "/VBA/Module1");
  if (!project || !module || !Buffer.from(project.content).toString("latin1").includes("Module=Module1") || module.size < 100) {
    throw new Error("VBA project does not contain its declared code module.");
  }
}

async function addXlsbReferenceFormula(buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const entry = archive.file("xl/worksheets/sheet1.bin");
  if (!entry) throw new Error("Generated XLSB has no worksheet binary.");
  const source = await entry.async("nodebuffer");
  const chunks = [];
  let offset = 0;
  let numericCellCount = 0;
  let replaced = false;
  while (offset < source.length) {
    const record = readXlsbRecord(source, offset);
    if (!replaced && [0x0002, 0x0005, 0x000d, 0x0010].includes(record.type) && ++numericCellCount === 2) {
      const payload = Buffer.alloc(33);
      payload.writeUInt32LE(1, 0); // full-cell column B
      payload.writeDoubleLE(7, 8); // cached numeric result
      payload.writeUInt32LE(7, 18); // formula token bytes
      payload[22] = 0x24; // PtgRef, relative row and column
      payload.writeUInt32LE(0, 23); // row 1
      payload.writeUInt16LE(0xc000, 27); // column A, relative flags
      payload.writeUInt32LE(0, 29); // no extra formula data
      chunks.push(writeXlsbHeader(0x0009, payload.length), payload); // BrtFmlaNum
      replaced = true;
    } else {
      chunks.push(source.subarray(offset, record.end));
    }
    offset = record.end;
  }
  if (!replaced) throw new Error("Could not locate the XLSB formula target cell.");
  archive.file("xl/worksheets/sheet1.bin", Buffer.concat(chunks));
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

function readXlsbRecord(buffer, offset) {
  let cursor = offset;
  let type = buffer[cursor++];
  if (type & 0x80) type = (type & 0x7f) | (buffer[cursor++] << 7);
  let length = 0;
  let shift = 0;
  let byte;
  do {
    byte = buffer[cursor++];
    length |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return { type, end: cursor + length };
}

function writeXlsbHeader(type, length) {
  const bytes = type <= 0x7f ? [type] : [(type & 0x7f) | 0x80, type >> 7];
  do {
    const value = length & 0x7f;
    length >>>= 7;
    bytes.push(value | (length ? 0x80 : 0));
  } while (length);
  return Buffer.from(bytes);
}
