const ROW_ELEMENT = /<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/gu;
const CELL_ELEMENT = /<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/gu;
const SHARED_STRING_ELEMENT = /<si\b[^>]*(?:\/>|>([\s\S]*?)<\/si>)/gu;
const TEXT_ELEMENT = /<t\b[^>]*>([\s\S]*?)<\/t>/gu;

export function createSharedStringValueLookup(xml) {
  const values = [];
  const matches = xml.matchAll(SHARED_STRING_ELEMENT);
  let exhausted = false;
  return (index) => {
    if (!Number.isSafeInteger(index) || index < 0) return false;
    while (!exhausted && values.length <= index) {
      const match = matches.next();
      if (match.done) exhausted = true;
      else values.push(textElementsHaveValue(match.value[1] ?? ""));
    }
    return values[index] === true;
  };
}

export function countWorksheetDataRows(xml, sharedStringHasValue = () => false, maximum = Number.POSITIVE_INFINITY) {
  let ordinal = 0;
  let dataRows = 0;
  for (const rowMatch of xml.matchAll(ROW_ELEMENT)) {
    ordinal += 1;
    const rowTag = rowMatch[0].match(/^<row\b[^>]*>/u)?.[0] ?? rowMatch[0];
    const rawRowNumber = xmlAttribute(rowTag, "r");
    const rowNumber = rawRowNumber === undefined ? ordinal : Number(rawRowNumber);
    if (!Number.isFinite(rowNumber) || rowNumber <= 1 || !rowHasCellValue(rowMatch[0], sharedStringHasValue)) continue;
    dataRows += 1;
    if (dataRows >= maximum) break;
  }
  return dataRows;
}

function rowHasCellValue(rowXml, sharedStringHasValue) {
  for (const cellMatch of rowXml.matchAll(CELL_ELEMENT)) {
    const cellXml = cellMatch[0];
    const cellTag = cellXml.match(/^<c\b[^>]*>/u)?.[0] ?? cellXml;
    const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/u);
    if (xmlAttribute(cellTag, "t") === "s") {
      const indexText = valueMatch?.[1] ?? "";
      if (/^\d+$/u.test(indexText) && sharedStringHasValue(Number(indexText))) return true;
      continue;
    }
    if ((valueMatch?.[1] ?? "").length > 0) return true;
    const inlineString = cellXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/u);
    if (inlineString && textElementsHaveValue(inlineString[1])) return true;
  }
  return false;
}

function textElementsHaveValue(xml) {
  for (const match of xml.matchAll(TEXT_ELEMENT)) {
    if (match[1].length > 0) return true;
  }
  return false;
}

function xmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2];
}
