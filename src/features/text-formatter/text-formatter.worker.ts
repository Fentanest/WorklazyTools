/// <reference lib="webworker" />

import { format as formatSql } from "sql-formatter";

import { formatXml } from "./formatterCore";

type FormatKind = "json" | "sql" | "xml";

self.onmessage = (event: MessageEvent<{ kind: FormatKind; mode: "pretty" | "minify"; text: string; indent: number; language?: string }>) => {
  try {
    const { kind, mode, text, indent } = event.data;
    const korean = event.data.language !== "en";
    let result = "";
    if (kind === "json") result = JSON.stringify(JSON.parse(text), null, mode === "pretty" ? indent : 0);
    if (kind === "sql") {
      const formatted = formatSql(text, { language: "sql", tabWidth: indent, keywordCase: "upper", linesBetweenQueries: 1 });
      result = mode === "pretty" ? formatted : collapseSql(formatted);
    }
    if (kind === "xml") {
      result = formatXml(text, mode, indent, korean);
    }
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: normalizeError(error, event.data.language !== "en") });
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

function normalizeError(error: unknown, korean: boolean) {
  if (!(error instanceof Error)) return korean ? "문법을 확인하지 못했습니다." : "The syntax could not be checked.";
  const jsonPosition = error.message.match(/position\s+(\d+)/i);
  return jsonPosition ? korean ? `${error.message} · ${Number(jsonPosition[1]) + 1}번째 문자 주변을 확인하세요.` : `${error.message} · Check near character ${Number(jsonPosition[1]) + 1}.` : error.message;
}

export {};
