import ExcelJS from "exceljs";

export type IncomingSheetReferenceIndex = ReadonlySet<number>;

const SHEET_QUALIFIER = /(?:'((?:''|[^'])+)'|([^'!+\-*/^&=<>(),:;\s]+))!/g;

export function buildIncomingSheetReferenceIndex(workbook: ExcelJS.Workbook): IncomingSheetReferenceIndex {
  const sheetsByName = new Map(workbook.worksheets.map((worksheet) => [worksheet.name.toLocaleLowerCase(), worksheet]));
  const referencedSheetIds = new Set<number>();
  workbook.worksheets.forEach((worksheet) => {
    worksheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type !== ExcelJS.ValueType.Formula) return;
      const formula = cell.formula ?? "";
      for (const match of formula.matchAll(SHEET_QUALIFIER)) {
        const referencedName = (match[1] ? match[1].replaceAll("''", "'") : match[2]).toLocaleLowerCase();
        const referencedSheet = sheetsByName.get(referencedName);
        if (referencedSheet && referencedSheet !== worksheet) referencedSheetIds.add(referencedSheet.id);
      }
    }));
  });
  return referencedSheetIds;
}

export function hasIncomingSheetReference(workbook: ExcelJS.Workbook, target: ExcelJS.Worksheet, index = buildIncomingSheetReferenceIndex(workbook)) {
  return index.has(target.id);
}
