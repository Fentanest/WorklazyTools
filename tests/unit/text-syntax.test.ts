import assert from "node:assert/strict";
import test from "node:test";

import { highlighterLoaded, highlightSpans, loadHighlighter, SYNTAX_LANGUAGES } from "../../src/features/text-compare/syntaxHighlight.ts";
import { syntaxSpans, textRenderPieces } from "../../src/features/text-compare/viewProjection.ts";

const kinds = (text: string, language: Parameters<typeof highlightSpans>[1]) => highlightSpans(text, language, 512).map(span => [text.slice(span.start, span.end), span.kind]);

test("Diffchecker's 21 languages load lazily and color lines as character spans", async () => {
  assert.equal(SYNTAX_LANGUAGES.length, 21);
  // Until loaded, only the built-in JSON/JavaScript tokenizer colors anything.
  assert.equal(highlighterLoaded(), false);
  assert.deepEqual(syntaxSpans("def f(): return 1", "python"), []);
  assert.ok(syntaxSpans("const a = 1", "javascript").length > 0);
  await loadHighlighter();
  assert.ok(highlighterLoaded());
  assert.deepEqual(kinds("def total(items): return len(items) # 개수", "python").filter(([, kind]) => kind !== "title"), [["def", "keyword"], ["return", "keyword"], ["len", "keyword"], ["# 개수", "comment"]]);
  assert.deepEqual(kinds("SELECT name FROM users WHERE id = 3", "sql").filter(([, kind]) => kind === "keyword").map(([text]) => text), ["SELECT", "FROM", "WHERE"]);
  assert.ok(kinds("<a href=\"x&amp;y\">링크</a>", "xml").some(([text, kind]) => text === "\"x&amp;y\"" && kind === "string"));
  for (const language of SYNTAX_LANGUAGES) assert.ok(Array.isArray(highlightSpans("x = 1 // y", language.value, 512)), language.value);
  // Offsets index the original text, also with entities and surrogate pairs.
  const line = "let s = \"<&>😀\"; // 한";
  for (const span of highlightSpans(line, "typescript", 512)) assert.ok(span.end <= line.length && span.start < span.end);
  assert.ok(kinds(line, "typescript").some(([text, kind]) => text === "\"<&>😀\"" && kind === "string"));
  // Render pieces keep change marks and syntax together and still cover the whole line.
  const pieces = textRenderPieces({ raw: line, key: line, start: 10, end: 10 + line.length, number: 1, lastNumber: 1, normalizedStart: 0 }, [{ start: 14, end: 15, kind: "changed" }], "typescript");
  assert.equal(pieces.pieces.map(piece => piece.text).join(""), line);
  assert.ok(pieces.pieces.some(piece => piece.mark === "changed") && pieces.pieces.some(piece => piece.syntax === "keyword"));
});
