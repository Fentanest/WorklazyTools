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
    const rowNumber = rawRowNumber === undefined ? ordinal : Number(rawRowNumber);
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
    if ((formula?.length ?? 0) > 0) return true;
    if (xmlAttribute(cell.openingTag, "t") === "s") {
      const indexText = value ?? "";
      if (/^\d+$/u.test(indexText) && sharedStringHasValue(Number(indexText))) return true;
      continue;
    }
    if ((value?.length ?? 0) > 0) return true;
    if (inlineString !== undefined && textElementsHaveValue(inlineString)) return true;
  }
  return false;
}

function textElementsHaveValue(xml) {
  for (const text of xmlElements(xml, TEXT_ELEMENTS)) {
    if (text.content.length > 0) return true;
  }
  return false;
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
