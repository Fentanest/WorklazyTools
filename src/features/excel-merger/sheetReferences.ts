import ExcelJS from "exceljs";

export function hasIncomingSheetReference(workbook: ExcelJS.Workbook, target: ExcelJS.Worksheet) {
  const escapedName = target.name.replace(/'/g, "''");
  const quotedQualifier = `'${escapedName}'!`.toLowerCase();
  const plainQualifier = `${target.name}!`.toLowerCase();
  let referenced = false;
  workbook.worksheets.forEach((worksheet) => {
    if (referenced || worksheet === target) return;
    worksheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
      if (referenced || cell.type !== ExcelJS.ValueType.Formula) return;
      const formula = cell.formula?.toLowerCase() ?? "";
      if (formula.includes(quotedQualifier) || formula.includes(plainQualifier)) referenced = true;
    }));
  });
  return referenced;
}
