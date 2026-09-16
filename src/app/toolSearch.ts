export interface SearchableTool {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  eyebrow: string;
  highlights: Array<{ label: string }>;
  categoryLabel: string;
  categoryShortLabel: string;
  path: string;
}

export interface SearchableCategory {
  id: string;
  label: string;
  shortLabel: string;
}

// Repository-fixed aliases. Do not guess beyond this table.
const TOOL_ALIASES: Record<string, string[]> = {
  "excel-merger": ["엑셀", "xls", "xlsx"],
  "excel-compare": ["엑셀", "xls", "xlsx"],
  "excel-cleaner": ["엑셀", "xls", "xlsx"],
  "document-compare": ["문서", "워드", "한글", "docx", "hwp"],
  "hwp-editor": ["한글", "hwp", "hwpx", "한글 편집"],
  "pdf-editor": ["피디에프", "pdf"],
  "image-studio": ["사진", "이미지", "png", "jpg"],
  "document-generator": ["워드 메일머지", "메일머지", "mail merge", "문서 일괄 생성", "양식 자동 채우기", "DOCX", "Word"],
  "document-redactor": ["개인정보 마스킹", "검정 박스", "PDF 가리기", "문서 가리기"],
  "video-studio": ["비디오 스튜디오", "video", "영상 자르기"],
  "qr-studio": ["QR 스튜디오", "QR 만들기", "QR 스캔"],
};

const CHOSEONG_BASE = 0xac00;
const CHOSEONG_COUNT = 19;

// Choseong comparison happens in the U+1100 block: NFKC maps compatibility
// jamo (U+3131-) there, so both the query and the corpus normalize first and
// only then reduce syllables to their choseong in the same space.
function toChoseongSpace(text: string): string {
  return [...text.normalize("NFKC")].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code >= CHOSEONG_BASE && code <= 0xd7a3) {
      return String.fromCodePoint(0x1100 + Math.floor((code - CHOSEONG_BASE) / 588));
    }
    return character;
  }).join("");
}

function isChoseongQuery(normalized: string): boolean {
  const compact = normalized.replace(/\s+/g, "");
  return compact.length > 0 && [...compact].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x1100 && code < 0x1100 + CHOSEONG_COUNT;
  });
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function toolCorpus(tool: SearchableTool): { text: string; choseong: string } {
  const fields = [
    tool.title,
    tool.shortTitle,
    tool.description,
    tool.eyebrow,
    tool.categoryLabel,
    tool.categoryShortLabel,
    ...tool.highlights.map((highlight) => highlight.label),
    ...(TOOL_ALIASES[tool.id] ?? []),
  ];
  const text = normalizeSearchText(fields.join(" "));
  const choseongFields = [tool.title, tool.shortTitle, ...(TOOL_ALIASES[tool.id] ?? [])];
  return { text, choseong: toChoseongSpace(choseongFields.join(" ")) };
}

/**
 * Shared matcher for the topbar search and the ToolsPage filter.
 * Normalized AND substring matching over the localized corpus in registry
 * order. Chosung matching applies only when the whole query (sans spaces)
 * is choseong; mixed queries like "ㅁㅅ pdf" are literal. No fuzzy matching.
 */
export function matchTools<T extends SearchableTool>(tools: readonly T[], query: string): T[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [...tools];
  const terms = normalized.split(" ").filter(Boolean);
  const choseongOnly = isChoseongQuery(normalized);
  const corpora = new Map<string, { text: string; choseong: string }>();
  return tools.filter((tool) => {
    let corpus = corpora.get(tool.id);
    if (!corpus) {
      corpus = toolCorpus(tool);
      corpora.set(tool.id, corpus);
    }
    return terms.every((term) => {
      if (corpus.text.includes(term)) return true;
      if (choseongOnly) return corpus.choseong.includes(term.replace(/\s+/g, ""));
      return false;
    });
  });
}

export function toolAliasesFor(toolId: string): string[] {
  return [...(TOOL_ALIASES[toolId] ?? [])];
}
