import type { HLJSApi, LanguageFn } from "highlight.js";

/** Diffchecker 7.3.0's syntax menu (module 67551): 21 highlight.js languages, label order kept. */
export const SYNTAX_LANGUAGES = [
  { value: "c", label: "C" }, { value: "cpp", label: "C++" }, { value: "csharp", label: "C#" }, { value: "clojure", label: "Clojure" },
  { value: "css", label: "CSS" }, { value: "go", label: "Go" }, { value: "java", label: "Java" }, { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" }, { value: "markdown", label: "Markdown" }, { value: "objectivec", label: "Objective-C" }, { value: "php", label: "PHP" },
  { value: "python", label: "Python" }, { value: "xml", label: "HTML, XML" }, { value: "ruby", label: "Ruby" }, { value: "rust", label: "Rust" },
  { value: "shell", label: "Shell" }, { value: "sql", label: "SQL" }, { value: "swift", label: "Swift" }, { value: "typescript", label: "TypeScript" },
  { value: "yaml", label: "YAML" },
] as const;
export type SyntaxLanguage = typeof SYNTAX_LANGUAGES[number]["value"];
export const isSyntaxLanguage = (value: string): value is SyntaxLanguage => SYNTAX_LANGUAGES.some(language => language.value === value);

let highlighter: HLJSApi | undefined, loading: Promise<HLJSApi> | undefined;
/** Loads highlight.js core and the grammars on first use, so the page does not carry them until a language is chosen. */
export function loadHighlighter(): Promise<HLJSApi> {
  loading ??= (async () => {
    const grammar = (module: { default: LanguageFn }) => module.default;
    const [core, ...languages] = await Promise.all([
      import("highlight.js/lib/core"),
      import("highlight.js/lib/languages/c"), import("highlight.js/lib/languages/cpp"), import("highlight.js/lib/languages/csharp"),
      import("highlight.js/lib/languages/clojure"), import("highlight.js/lib/languages/css"), import("highlight.js/lib/languages/go"),
      import("highlight.js/lib/languages/java"), import("highlight.js/lib/languages/javascript"), import("highlight.js/lib/languages/json"),
      import("highlight.js/lib/languages/markdown"), import("highlight.js/lib/languages/objectivec"), import("highlight.js/lib/languages/php"),
      import("highlight.js/lib/languages/python"), import("highlight.js/lib/languages/xml"), import("highlight.js/lib/languages/ruby"),
      import("highlight.js/lib/languages/rust"), import("highlight.js/lib/languages/shell"), import("highlight.js/lib/languages/sql"),
      import("highlight.js/lib/languages/swift"), import("highlight.js/lib/languages/typescript"), import("highlight.js/lib/languages/yaml"),
    ]);
    const hljs = core.default.newInstance();
    SYNTAX_LANGUAGES.forEach((language, index) => hljs.registerLanguage(language.value, grammar(languages[index])));
    highlighter = hljs;
    return hljs;
  })();
  return loading;
}
export const highlighterLoaded = () => highlighter !== undefined;

// highlight.js scopes folded into the result view's colors.
const KIND: Record<string, string> = {
  keyword: "keyword", literal: "keyword", built_in: "keyword", type: "keyword", "selector-tag": "keyword", doctag: "keyword",
  string: "string", regexp: "string", symbol: "string", "template-tag": "string", "template-variable": "string", addition: "string",
  number: "number", comment: "comment", quote: "comment", meta: "comment", deletion: "comment",
  title: "title", "title.function": "title", "title.class": "title", name: "title", tag: "title", attr: "title", attribute: "title",
  section: "title", "selector-id": "title", "selector-class": "title", variable: "title", params: "title", property: "title",
};
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", "#x27": "'", "#39": "'" };

/** Colored spans of one line as character offsets; at most `limit` spans. Empty until the highlighter is loaded. */
export function highlightSpans(text: string, language: SyntaxLanguage, limit: number) {
  if (!highlighter || !text) return [];
  const html = highlighter.highlight(text, { language, ignoreIllegals: true }).value;
  const spans: Array<{ start: number; end: number; kind: string }> = [], stack: (string | undefined)[] = [];
  let offset = 0, pending = "";
  const flush = () => {
    if (!pending) return;
    let kind: string | undefined;
    for (let i = stack.length - 1; i >= 0 && kind === undefined; i--) kind = stack[i];
    if (kind) { const last = spans.at(-1); if (last && last.kind === kind && last.end === offset) last.end += pending.length; else spans.push({ start: offset, end: offset + pending.length, kind }); }
    offset += pending.length; pending = "";
  };
  for (const token of html.matchAll(/<span class="([^"]*)">|<\/span>|&([#\w]+);|[^<&]+/gu)) {
    if (token[0] === "</span>") { flush(); stack.pop(); }
    else if (token[1] !== undefined) { flush(); const scope = token[1].split(" ")[0].replace(/^hljs-/u, ""); stack.push(KIND[scope] ?? KIND[scope.split(".")[0]]); }
    else if (token[2] !== undefined) pending += ENTITIES[token[2]] ?? token[0];
    else pending += token[0];
    // More spans than the caller can draw: it falls back to plain text.
    if (spans.length > limit) return spans;
  }
  flush();
  // The highlighted text must be the input itself; anything else is not shown.
  return offset === text.length ? spans : [];
}
