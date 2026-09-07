const ROW_ELEMENTS = new Set(["row"]);
const CELL_ELEMENTS = new Set(["c"]);
const SHARED_STRING_ELEMENTS = new Set(["si"]);
const TEXT_ELEMENTS = new Set(["t"]);
const CELL_VALUE_ELEMENTS = new Set(["f", "is", "v"]);

export function createSharedStringValueLookup(xml) {
  const values = [];
  const matches = xmlElements(xml, SHARED_STRING_ELEMENTS);
  let exhausted = false;
  return (index) => {
    if (!Number.isSafeInteger(index) || index < 0) return false;
    while (!exhausted && values.length <= index) {
      const match = matches.next();
      if (match.done) exhausted = true;
      else values.push(textElementsHaveValue(match.value.content));
    }
    return values[index] === true;
  };
}

export function countWorksheetDataRows(xml, sharedStringHasValue = () => false, maximum = Number.POSITIVE_INFINITY) {
  let ordinal = 0;
  let dataRows = 0;
  for (const row of xmlElements(xml, ROW_ELEMENTS)) {
    ordinal += 1;
    const rawRowNumber = xmlAttribute(row.openingTag, "r");
    const decodedRowNumber = rawRowNumber === undefined ? undefined : decodeXmlCharacterReferences(rawRowNumber);
    if (rawRowNumber !== undefined && decodedRowNumber === undefined) continue;
    const rowNumber = rawRowNumber === undefined ? ordinal : Number(decodedRowNumber);
    if (!Number.isFinite(rowNumber) || rowNumber <= 1 || !rowHasCellValue(row.content, sharedStringHasValue)) continue;
    dataRows += 1;
    if (dataRows >= maximum) break;
  }
  return dataRows;
}

function rowHasCellValue(rowXml, sharedStringHasValue) {
  for (const cell of xmlElements(rowXml, CELL_ELEMENTS)) {
    let formula;
    let inlineString;
    let value;
    for (const child of xmlElements(cell.content, CELL_VALUE_ELEMENTS)) {
      if (child.name === "f" && formula === undefined) formula = child.content;
      else if (child.name === "is" && inlineString === undefined) inlineString = child.content;
      else if (child.name === "v" && value === undefined) value = child.content;
    }
    const rawCellType = xmlAttribute(cell.openingTag, "t");
    const cellType = rawCellType === undefined ? undefined : decodeXmlCharacterReferences(rawCellType);
    if (rawCellType !== undefined && cellType === undefined) continue;
    const formulaText = formula === undefined ? undefined : xmlCharacterData(formula);
    if ((formulaText?.length ?? 0) > 0) return true;
    const valueText = value === undefined ? undefined : xmlCharacterData(value, cellType === "s");
    if (cellType === "s") {
      if (/^\d+$/u.test(valueText ?? "") && sharedStringHasValue(Number(valueText))) return true;
      continue;
    }
    if ((valueText?.length ?? 0) > 0) return true;
    if (inlineString !== undefined && textElementsHaveValue(inlineString)) return true;
  }
  return false;
}

function textElementsHaveValue(xml) {
  for (const text of xmlElements(xml, TEXT_ELEMENTS)) {
    if ((xmlCharacterData(text.content)?.length ?? 0) > 0) return true;
  }
  return false;
}

function xmlCharacterData(xml, decodeReferences = false) {
  let cursor = 0;
  let content = "";
  while (cursor < xml.length) {
    const start = xml.indexOf("<", cursor);
    if (start < 0) {
      const tail = decodeReferences ? decodeXmlCharacterReferences(xml.slice(cursor)) : xml.slice(cursor);
      return tail === undefined ? undefined : content + tail;
    }
    const text = decodeReferences ? decodeXmlCharacterReferences(xml.slice(cursor, start)) : xml.slice(cursor, start);
    if (text === undefined) return undefined;
    content += text;

    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      if (end < 0) return undefined;
      cursor = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", start)) {
      const end = xml.indexOf("]]>", start + 9);
      if (end < 0) return undefined;
      content += xml.slice(start + 9, end);
      cursor = end + 3;
      continue;
    }
    if (xml.startsWith("<?", start)) {
      const end = xml.indexOf("?>", start + 2);
      if (end < 0) return undefined;
      cursor = end + 2;
      continue;
    }

    const end = findXmlTagEnd(xml, start + 1);
    if (end < 0) return undefined;
    cursor = end;
  }
  return content;
}

function decodeXmlCharacterReferences(value) {
  let cursor = 0;
  let decoded = "";
  while (cursor < value.length) {
    const start = value.indexOf("&", cursor);
    if (start < 0) return decoded + value.slice(cursor);
    decoded += value.slice(cursor, start);
    const end = value.indexOf(";", start + 1);
    if (end < 0) return undefined;
    const reference = value.slice(start + 1, end);
    const character = decodeXmlCharacterReference(reference);
    if (character === undefined) return undefined;
    decoded += character;
    cursor = end + 1;
  }
  return decoded;
}

function decodeXmlCharacterReference(reference) {
  if (reference === "amp") return "&";
  if (reference === "lt") return "<";
  if (reference === "gt") return ">";
  if (reference === "quot") return '"';
  if (reference === "apos") return "'";

  let digits;
  let radix;
  if (/^#[0-9]+$/u.test(reference)) {
    digits = reference.slice(1);
    radix = 10;
  } else if (/^#x[0-9a-fA-F]+$/u.test(reference)) {
    digits = reference.slice(2);
    radix = 16;
  } else {
    return undefined;
  }
  const codePoint = Number.parseInt(digits, radix);
  if (!isXmlCharacter(codePoint)) return undefined;
  return String.fromCodePoint(codePoint);
}

function isXmlCharacter(codePoint) {
  return codePoint === 9
    || codePoint === 10
    || codePoint === 13
    || (codePoint >= 32 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function* xmlElements(xml, names) {
  let cursor = 0;
  while (cursor < xml.length) {
    const opening = nextXmlTag(xml, cursor);
    if (!opening) return;
    cursor = opening.end;
    if (opening.closing || !names.has(opening.name)) continue;

    const openingTag = xml.slice(opening.start, opening.end);
    if (opening.selfClosing) {
      yield { name: opening.name, openingTag, content: "" };
      continue;
    }

    const contentStart = opening.end;
    let depth = 1;
    let closing;
    while (depth > 0) {
      const candidate = nextXmlTag(xml, cursor);
      if (!candidate) return;
      cursor = candidate.end;
      if (candidate.name !== opening.name) continue;
      if (candidate.closing) depth -= 1;
      else if (!candidate.selfClosing) depth += 1;
      if (depth === 0) closing = candidate;
    }
    yield { name: opening.name, openingTag, content: xml.slice(contentStart, closing.start) };
  }
}

function nextXmlTag(xml, from) {
  let start = xml.indexOf("<", from);
  while (start >= 0) {
    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      if (end < 0) return undefined;
      start = xml.indexOf("<", end + 3);
      continue;
    }
    if (xml.startsWith("<![CDATA[", start)) {
      const end = xml.indexOf("]]>", start + 9);
      if (end < 0) return undefined;
      start = xml.indexOf("<", end + 3);
      continue;
    }
    if (xml.startsWith("<?", start)) {
      const end = xml.indexOf("?>", start + 2);
      if (end < 0) return undefined;
      start = xml.indexOf("<", end + 2);
      continue;
    }

    let cursor = start + 1;
    const closing = xml[cursor] === "/";
    if (closing) cursor += 1;
    const nameStart = cursor;
    while (cursor < xml.length && isXmlNameCharacter(xml.charCodeAt(cursor))) cursor += 1;
    if (cursor === nameStart) {
      const end = findXmlTagEnd(xml, cursor);
      if (end < 0) return undefined;
      start = xml.indexOf("<", end);
      continue;
    }

    const end = findXmlTagEnd(xml, cursor);
    if (end < 0) return undefined;
    let marker = end - 2;
    while (marker >= cursor && isXmlWhitespace(xml.charCodeAt(marker))) marker -= 1;
    return {
      start,
      end,
      name: xml.slice(nameStart, cursor),
      closing,
      selfClosing: !closing && xml[marker] === "/",
    };
  }
  return undefined;
}

function findXmlTagEnd(xml, from) {
  let quote = "";
  for (let cursor = from; cursor < xml.length; cursor += 1) {
    const character = xml[cursor];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return cursor + 1;
    }
  }
  return -1;
}

function xmlAttribute(tag, name) {
  let cursor = 1;
  if (tag[cursor] === "/") cursor += 1;
  while (cursor < tag.length && isXmlNameCharacter(tag.charCodeAt(cursor))) cursor += 1;
  while (cursor < tag.length) {
    while (cursor < tag.length && isXmlWhitespace(tag.charCodeAt(cursor))) cursor += 1;
    if (tag[cursor] === "/" || tag[cursor] === ">") return undefined;
    const nameStart = cursor;
    while (cursor < tag.length && isXmlNameCharacter(tag.charCodeAt(cursor))) cursor += 1;
    const attributeName = tag.slice(nameStart, cursor);
    while (cursor < tag.length && isXmlWhitespace(tag.charCodeAt(cursor))) cursor += 1;
    if (tag[cursor] !== "=") return undefined;
    cursor += 1;
    while (cursor < tag.length && isXmlWhitespace(tag.charCodeAt(cursor))) cursor += 1;
    const quote = tag[cursor];
    if (quote !== '"' && quote !== "'") return undefined;
    const valueStart = cursor + 1;
    const valueEnd = tag.indexOf(quote, valueStart);
    if (valueEnd < 0) return undefined;
    if (attributeName === name) return tag.slice(valueStart, valueEnd);
    cursor = valueEnd + 1;
  }
  return undefined;
}

function isXmlNameCharacter(code) {
  return (code >= 48 && code <= 57)
    || (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || code === 45
    || code === 46
    || code === 58
    || code === 95;
}

function isXmlWhitespace(code) {
  return code === 9 || code === 10 || code === 13 || code === 32;
}
