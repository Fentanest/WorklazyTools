/// <reference lib="webworker" />

import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import { format as formatSql } from "sql-formatter";

type FormatKind = "json" | "sql" | "xml";

self.onmessage = (event: MessageEvent<{ kind: FormatKind; mode: "pretty" | "minify"; text: string; indent: number }>) => {
  try {
    const { kind, mode, text, indent } = event.data;
    let result = "";
    if (kind === "json") result = JSON.stringify(JSON.parse(text), null, mode === "pretty" ? indent : 0);
    if (kind === "sql") {
      const formatted = formatSql(text, { language: "sql", tabWidth: indent, keywordCase: "upper", linesBetweenQueries: 1 });
      result = mode === "pretty" ? formatted : collapseSql(formatted);
    }
    if (kind === "xml") {
      const validation = XMLValidator.validate(text, { allowBooleanAttributes: true });
      if (validation !== true) throw new Error(`XML ${validation.err.line}행 ${validation.err.col}열: ${validation.err.msg}`);
      const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, commentPropName: "#comment" });
      const builder = new XMLBuilder({ ignoreAttributes: false, preserveOrder: true, format: mode === "pretty", indentBy: " ".repeat(indent), suppressEmptyNode: false, commentPropName: "#comment" });
      result = builder.build(parser.parse(text));
    }
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: normalizeError(error) });
  }
};

function collapseSql(value: string) {
  let output = "";
  let quote = "";
  let pendingSpace = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      output += char;
      if (char === quote && value[index + 1] === quote) { output += value[++index]; continue; }
      if (char === quote && value[index - 1] !== "\\") quote = "";
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

function normalizeError(error: unknown) {
  if (!(error instanceof Error)) return "문법을 확인하지 못했습니다.";
  const jsonPosition = error.message.match(/position\s+(\d+)/i);
  return jsonPosition ? `${error.message} · ${Number(jsonPosition[1]) + 1}번째 문자 주변을 확인하세요.` : error.message;
}

export {};
