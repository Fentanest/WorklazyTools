/// <reference lib="webworker" />

import { format as formatSql, type SqlLanguage } from "sql-formatter";

import { formatXml } from "./formatterCore";

type FormatKind = "json" | "sql" | "xml";

self.onmessage = (event: MessageEvent<{ kind: FormatKind; mode: "pretty" | "minify"; text: string; indent: number; dialect?: SqlLanguage; language?: string }>) => {
  try {
    const { kind, mode, text, indent } = event.data;
    const korean = event.data.language !== "en";
    let result = "";
    let warning = "";
    if (kind === "json") {
      if (containsUnsafeJsonInteger(text)) warning = korean ? "JavaScript가 정확히 표현할 수 없는 큰 정수가 있습니다. 숫자를 문자열로 감싸지 않으면 값이 반올림될 수 있습니다." : "This JSON contains an integer JavaScript cannot represent exactly. Wrap it in quotes to prevent rounding.";
      result = JSON.stringify(JSON.parse(text), null, mode === "pretty" ? indent : 0);
    }
    if (kind === "sql") {
      const dialect = event.data.dialect ?? "sql";
      const formatted = formatSql(text, { language: dialect, tabWidth: indent, keywordCase: "upper", linesBetweenQueries: 1 });
      result = mode === "pretty" ? formatted : collapseSql(formatted, dialect === "mysql" || dialect === "mariadb");
    }
    if (kind === "xml") {
      result = formatXml(text, mode, indent, korean);
    }
    self.postMessage({ type: "result", result, warning });
  } catch (error) {
    self.postMessage({ type: "error", message: normalizeError(error, event.data.language !== "en") });
  }
};

function collapseSql(value: string, backslashEscapes: boolean) {
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
    if (char === "-" && value[index + 1] === "-" || char === "#") {
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

function containsUnsafeJsonInteger(text: string) {
  let quote = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quote = false;
      continue;
    }
    if (char === '"') { quote = true; continue; }
    if (char === "-" || /\d/.test(char)) {
      const match = text.slice(index).match(/^-?\d+(?![.eE\d])/);
      if (!match) continue;
      const integer = match[0];
      try { if (BigInt(integer) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(integer) < BigInt(Number.MIN_SAFE_INTEGER)) return true; }
      catch { /* JSON.parse will report the syntax error. */ }
      index += integer.length - 1;
    }
  }
  return false;
}

function normalizeError(error: unknown, korean: boolean) {
  if (!(error instanceof Error)) return korean ? "문법을 확인하지 못했습니다." : "The syntax could not be checked.";
  const jsonPosition = error.message.match(/position\s+(\d+)/i);
  return jsonPosition ? korean ? `${error.message} · ${Number(jsonPosition[1]) + 1}번째 문자 주변을 확인하세요.` : `${error.message} · Check near character ${Number(jsonPosition[1]) + 1}.` : error.message;
}

export {};
