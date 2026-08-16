import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

const XML_VALUE_OPTIONS = {
  ignoreAttributes: false,
  preserveOrder: true,
  commentPropName: "#comment",
  cdataPropName: "#cdata",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
} as const;

export function formatXml(text: string, mode: "pretty" | "minify", indent: number, korean: boolean) {
  const validation = XMLValidator.validate(text, { allowBooleanAttributes: true });
  if (validation !== true) {
    throw new Error(korean
      ? `XML ${validation.err.line}행 ${validation.err.col}열: ${validation.err.msg}`
      : `XML line ${validation.err.line}, column ${validation.err.col}: ${validation.err.msg}`);
  }

  const parser = new XMLParser(XML_VALUE_OPTIONS);
  const builder = new XMLBuilder({
    ...XML_VALUE_OPTIONS,
    format: mode === "pretty",
    indentBy: " ".repeat(indent),
    suppressEmptyNode: false,
  });
  return builder.build(parser.parse(text));
}

export function collapseSql(value: string, backslashEscapes: boolean) {
  let output = "";
  let quote = "";
  let pendingSpace = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      output += char;
      if (char === quote && value[index + 1] === quote) { output += value[++index]; continue; }
      if (char === quote && (!backslashEscapes || value[index - 1] !== "\\")) quote = "";
      continue;
    }
    if ((char === "-" && value[index + 1] === "-") || char === "#") {
      const start = char === "#" ? index + 1 : index + 2;
      const end = value.indexOf("\n", start);
      const comment = value.slice(start, end < 0 ? value.length : end).trim().replaceAll("*/", "* /");
      if (pendingSpace && output) output += " ";
      output += `/* ${comment} */`;
      pendingSpace = true;
      index = end < 0 ? value.length : end;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { if (pendingSpace && output) output += " "; pendingSpace = false; quote = char; output += char; continue; }
    if (/\s/.test(char)) { pendingSpace = true; continue; }
    if (pendingSpace && output && !/[,(]/.test(char) && !/[.(]$/.test(output)) output += " ";
    pendingSpace = false;
    output += char;
  }
  return output.trim();
}
