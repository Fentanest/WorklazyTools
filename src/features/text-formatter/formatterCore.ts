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
