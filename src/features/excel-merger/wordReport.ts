import ExcelJS from "exceljs";

import type { WordCompareResult } from "./types";

type Localizer = (ko: string, en: string) => string;

function toArrayBuffer(value: Uint8Array | ArrayBuffer) {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

export async function buildWordReport(result: WordCompareResult, language: "ko" | "en", reportProgress: (value: number, message: string) => void) {
  const local: Localizer = (ko, en) => language === "en" ? en : ko;
  reportProgress(10, local("보고서 생성을 시작했습니다.", "Starting report generation."));
  reportProgress(20, local("요약 시트를 구성하고 있습니다.", "Building the summary sheet."));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Worklazy Tools";
  const summary = workbook.addWorksheet(local("요약", "Summary"));
  summary.columns = [
    { header: local("항목", "Item"), key: "label", width: 24 },
    { header: local("내용", "Value"), key: "value", width: 54 },
  ];
  summary.addRows([
    { label: local("수정 전", "Before"), value: result.beforeName },
    { label: local("수정 후", "After"), value: result.afterName },
    { label: local("추가", "Added"), value: result.summary.added },
    { label: local("삭제", "Deleted"), value: result.summary.deleted },
    { label: local("내용 변경", "Content changed"), value: result.summary.changed },
    { label: local("서식 변경", "Formatting changed"), value: result.summary.format },
    { label: local("이동", "Moved"), value: result.summary.moved ?? 0 },
  ]);
  styleHeader(summary.getRow(1), "D3D3D3", "FF1D1D1F");
  summary.getCell("B9").value = {
    richText: [{ text: local("파란색 취소선", "Blue strikethrough"), font: { color: { argb: "FF0000FF" }, strike: true } }],
  };
  summary.getCell("A9").value = local("삭제 표시", "Deletion mark");
  summary.getCell("B10").value = {
    richText: [{ text: local("빨간색 굵게", "Bold red"), font: { color: { argb: "FFFF0000" }, bold: true } }],
  };
  summary.getCell("A10").value = local("삽입 표시", "Insertion mark");

  const generalChanges = result.changes.filter((change) => change.section !== "table");
  const changes = workbook.addWorksheet(local("변경 내용", "Changes"));
  reportProgress(40, local(`${generalChanges.length}개 일반 변경 내용을 보고서에 기록합니다.`, `Writing ${generalChanges.length} general changes to the report.`));
  changes.columns = [
    { header: local("구분", "Section"), key: "section", width: 13 },
    { header: local("위치", "Location"), key: "location", width: 24 },
    { header: local("수정 전", "Before"), key: "before", width: 55 },
    { header: local("수정 후", "After"), key: "after", width: 55 },
    { header: local("변경 유형", "Change type"), key: "kind", width: 14 },
  ];
  generalChanges.forEach((change) => {
    const row = changes.addRow({
      section: sectionLabel(change.section, local),
      location: change.location,
      kind: `${changeKindLabel(change.kind, local)}${change.moved && change.kind !== "moved" ? ` · ${local("이동", "Moved")}` : ""}`,
    });
    row.getCell(3).value = wordDiffRichText(change, "before");
    row.getCell(4).value = wordDiffRichText(change, "after");
  });
  styleHeader(changes.getRow(1), "D3D3D3", "FF1D1D1F");
  changes.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.height = 38;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD8D8DC" } },
        left: { style: "thin", color: { argb: "FFD8D8DC" } },
        bottom: { style: "thin", color: { argb: "FFD8D8DC" } },
        right: { style: "thin", color: { argb: "FFD8D8DC" } },
      };
    });
    const kind = row.getCell(5).value;
    if (kind === local("추가", "Added")) row.getCell(5).font = { color: { argb: "FFFF0000" }, bold: true };
    if (kind === local("삭제", "Deleted")) row.getCell(5).font = { color: { argb: "FF0000FF" }, bold: true };
    if (kind === local("서식 변경", "Formatting changed")) row.getCell(5).font = { color: { argb: "FF7C3AED" }, bold: true };
    if (String(kind).includes(local("이동", "Moved"))) row.getCell(5).font = { color: { argb: "FF0F8B8D" }, bold: true };
  });
  changes.views = [{ state: "frozen", ySplit: 1 }];
  changes.autoFilter = "A1:E1";

  reportProgress(62, local(`${result.tables?.length ?? 0}개 표의 전후 비교 시트를 구성합니다.`, `Building before-and-after sheets for ${result.tables?.length ?? 0} tables.`));
  buildWordTableSheets(workbook, result, local);

  reportProgress(85, local("보고서 서식 적용 완료 · Excel 파일 저장 중…", "Report formatting complete · Saving the Excel file…"));
  return toArrayBuffer(await workbook.xlsx.writeBuffer());
}

function buildWordTableSheets(workbook: ExcelJS.Workbook, result: WordCompareResult, local: Localizer) {
  const beforeChanges = new Map(result.changes.filter((change) => change.section === "table" && change.beforeLocation)
    .map((change) => [change.beforeLocation, change]));
  const afterChanges = new Map(result.changes.filter((change) => change.section === "table" && change.afterLocation)
    .map((change) => [change.afterLocation, change]));

  (result.tables ?? []).forEach((table) => {
    const suffix = table.beforeIndex === null ? local(" (수정 후만)", " (after only)") : table.afterIndex === null ? local(" (수정 전만)", " (before only)") : "";
    const sheet = workbook.addWorksheet(local(`표 ${table.index + 1}${suffix}`, `Table ${table.index + 1}${suffix}`).slice(0, 31));
    const beforeWidth = Math.max(1, ...table.before.map((row) => row.length));
    const afterWidth = Math.max(1, ...table.after.map((row) => row.length));
    const afterStartColumn = beforeWidth + 2;
    const tableStartRow = 3;

    styleWordTableHeader(sheet, 1, 1, beforeWidth, table.beforeIndex === null ? local("수정 전 없음", "No before table") : local("수정 전", "Before"));
    styleWordTableHeader(sheet, 1, afterStartColumn, afterWidth, table.afterIndex === null ? local("수정 후 없음", "No after table") : local("수정 후", "After"));
    if (table.beforeIndex === null) sheet.getCell(2, afterStartColumn).value = local("이 표는 수정 후 문서에만 있습니다.", "This table exists only in the after document.");
    if (table.afterIndex === null) sheet.getCell(2, 1).value = local("이 표는 수정 전 문서에만 있습니다.", "This table exists only in the before document.");

    table.before.forEach((row, rowIndex) => row.forEach((sourceCell, columnIndex) => {
      const kind = table.beforeKinds[rowIndex]?.[columnIndex] ?? "deleted";
      const cell = sheet.getCell(tableStartRow + rowIndex, 1 + columnIndex);
      styleWordTableCell(cell, sourceCell.text, kind, "before", beforeChanges.get(sourceCell.location));
    }));
    table.after.forEach((row, rowIndex) => row.forEach((sourceCell, columnIndex) => {
      const kind = table.afterKinds[rowIndex]?.[columnIndex] ?? "added";
      const cell = sheet.getCell(tableStartRow + rowIndex, afterStartColumn + columnIndex);
      styleWordTableCell(cell, sourceCell.text, kind, "after", afterChanges.get(sourceCell.location));
    }));

    for (let column = 1; column <= beforeWidth; column += 1) sheet.getColumn(column).width = 18;
    sheet.getColumn(beforeWidth + 1).width = 3;
    for (let column = afterStartColumn; column < afterStartColumn + afterWidth; column += 1) sheet.getColumn(column).width = 18;
    sheet.views = [{ state: "frozen", ySplit: 2 }];
  });
}

function styleWordTableHeader(sheet: ExcelJS.Worksheet, row: number, startColumn: number, width: number, label: string) {
  if (width > 1) sheet.mergeCells(row, startColumn, row, startColumn + width - 1);
  const cell = sheet.getCell(row, startColumn);
  cell.value = label;
  cell.font = { bold: true, color: { argb: "FF1D1D1F" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = wordTableBorder();
}

function styleWordTableCell(
  cell: ExcelJS.Cell,
  text: string,
  kind: string,
  side: "before" | "after",
  change?: WordCompareResult["changes"][number],
) {
  if (change && (kind === "changed" || kind === "deleted" || kind === "added")) {
    cell.value = wordDiffRichText(change, side);
  } else {
    cell.value = text;
  }
  cell.alignment = { vertical: "top", wrapText: true };
  cell.border = wordTableBorder();
  if (kind === "deleted") cell.font = { color: { argb: "FF0000FF" }, strike: true };
  if (kind === "added") cell.font = { color: { argb: "FFFF0000" }, bold: true };
  if (kind === "format") {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
    cell.font = { color: { argb: "FF6D28D9" } };
  }
}

function wordTableBorder(): Partial<ExcelJS.Borders> {
  const edge = { style: "thin" as const, color: { argb: "FFBFC0C5" } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function wordDiffRichText(change: WordCompareResult["changes"][number], side: "before" | "after"): ExcelJS.CellRichTextValue {
  const allowedType = side === "before" ? "deleted" : "added";
  const segments = change.segments.filter((segment) => segment.type === "equal" || segment.type === allowedType);
  const fallbackText = side === "before" ? change.before : change.after;
  const richText = (segments.length ? segments : [{ type: allowedType, text: fallbackText }]).map((segment) => {
    if (segment.type === "deleted") {
      return { text: segment.text, font: { color: { argb: "FF0000FF" }, strike: true } };
    }
    if (segment.type === "added") {
      return { text: segment.text, font: { color: { argb: "FFFF0000" }, bold: true } };
    }
    return { text: segment.text };
  });
  return { richText };
}

function styleHeader(row: ExcelJS.Row, color: string, fontColor = "FFFFFFFF") {
  row.font = { bold: true, color: { argb: fontColor } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color.toUpperCase()}` } };
  row.alignment = { vertical: "middle" };
  row.height = 24;
}

function sectionLabel(section: string, local: Localizer) {
  if (section === "body") return local("본문", "Body");
  if (section === "table") return local("표", "Table");
  if (section === "headerFooter") return local("머리말·꼬리말", "Header/Footer");
  if (section === "comment") return local("메모", "Comment");
  return local("각주·미주", "Footnote/Endnote");
}

function changeKindLabel(kind: string, local: Localizer) {
  return kind === "added" ? local("추가", "Added") : kind === "deleted" ? local("삭제", "Deleted") : kind === "format" ? local("서식 변경", "Formatting changed") : kind === "moved" ? local("이동", "Moved") : local("내용 변경", "Content changed");
}
