import JSZip from "jszip";

const WORKSHEET_PATH = /^xl\/worksheets\/sheet\d+\.xml$/u;

export async function assertVisibleXlsxReport(bytes) {
  const archive = await JSZip.loadAsync(bytes);
  const worksheets = Object.values(archive.files).filter((entry) => !entry.dir && WORKSHEET_PATH.test(entry.name));
  if (!worksheets.length) throw new Error("XLSX report contains no worksheets.");

  let customWidthColumns = 0;
  let dataRows = 0;
  const widths = [];
  for (const worksheet of worksheets) {
    const xml = await worksheet.async("string");
    for (const match of xml.matchAll(/<col\b[^>]*\/?\s*>/gu)) {
      const customWidth = xmlAttribute(match[0], "customWidth");
      if (customWidth !== "1" && customWidth?.toLowerCase() !== "true") continue;
      customWidthColumns += 1;
      const rawWidth = xmlAttribute(match[0], "width");
      const width = rawWidth === undefined ? Number.NaN : Number(rawWidth);
      if (!Number.isFinite(width) || width <= 0) {
        throw new Error(`XLSX report column has an invalid custom width in ${worksheet.name}: ${match[0]}`);
      }
      const minimum = Number(xmlAttribute(match[0], "min"));
      const maximum = Number(xmlAttribute(match[0], "max"));
      const span = Number.isSafeInteger(minimum) && Number.isSafeInteger(maximum) && maximum >= minimum ? maximum - minimum + 1 : 1;
      customWidthColumns += span - 1;
      for (let index = 0; index < span; index += 1) widths.push(width);
    }
    let ordinal = 0;
    for (const match of xml.matchAll(/<row\b[^>]*>/gu)) {
      ordinal += 1;
      const rowNumber = Number(xmlAttribute(match[0], "r") ?? ordinal);
      if (Number.isFinite(rowNumber) && rowNumber > 1) dataRows += 1;
    }
  }
  if (!customWidthColumns) throw new Error("XLSX report contains no custom-width columns.");
  if (!dataRows) throw new Error("XLSX report contains no data rows.");
  return { worksheetCount: worksheets.length, customWidthColumns, dataRows, widths };
}

function xmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2];
}
