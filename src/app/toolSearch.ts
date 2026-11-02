import { fileAccepts, type ReceiverId } from "./fileAccepts.ts";

export interface SearchableTool {
  id: string;
  synonyms?: readonly string[];
  tagline?: string;
  scenarioLabels?: ReadonlyArray<{ id: string; label: string }>;
  receiverIds?: readonly ReceiverId[];
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
    tool.tagline ?? "",
    ...(tool.scenarioLabels ?? []).map((scenario) => scenario.label),
    ...(tool.receiverIds ?? []).flatMap((id) => fileAccepts[id].extensions),
    tool.categoryLabel,
    tool.categoryShortLabel,
    ...tool.highlights.map((highlight) => highlight.label),
    ...(tool.synonyms ?? []),
  ];
  const text = normalizeSearchText(fields.join(" "));
  const choseongFields = [tool.title, tool.shortTitle, ...(tool.synonyms ?? [])];
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
