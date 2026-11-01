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
  "product-banner": ["알리익스프레스", "알리", "광고 배너", "배너 만들기", "배너 생성기", "제휴 마케팅", "제휴 링크", "엑셀", "aliexpress", "affiliate", "ad", "banner", "builder", "excel", "csv", "html", "iframe"],
  "market-calendar": ["증시", "휴장일", "krx", "nxt", "nyse", "nasdaq", "stock", "market", "calendar"],
  "excel-merger": ["엑셀", "xls", "xlsx"],
  "excel-compare": ["엑셀", "xls", "xlsx", "엑셀 대사", "대사", "diff", "diff checker"],
  "excel-cleaner": ["엑셀", "xls", "xlsx", "엑셀 중복 제거", "공백 제거", "중복 제거", "빈 행 삭제"],
  "document-compare": ["문서", "워드", "한글", "docx", "hwp", "diff", "diff checker"],
  "text-compare": ["텍스트", "비교", "diff", "diff checker"],
  "image-compare": ["이미지 비교", "diff", "diff checker"],
  "pdf-compare": ["pdf 비교", "diff", "diff checker"],
  "folder-compare": ["폴더 비교", "diff", "diff checker"],
  "hwp-editor": ["한글", "hwp", "hwpx", "한글 편집", "한글 뷰어", "hwp 뷰어", "hwp viewer"],
  "office-editor": ["워드 온라인", "엑셀 온라인", "word", "excel", "powerpoint", "office"],
  "pdf-editor": ["피디에프", "pdf", "PDF 나누기", "PDF 자르기", "PDF 직인", "쪽번호", "stamp", "watermark"],
  "pdf-converter": ["피디에프 변환", "PDF 워드 변환", "PDF 엑셀 변환", "PDF PPT 변환", "PDF 한글 변환", "스캔 PDF OCR", "검색 가능한 PDF", "HWP", "HWPX", "워드", "Word", "오피스", "Office", "엑셀", "Excel", "프레젠테이션", "PPT", "PPTX", "PowerPoint", "JPG", "PNG", "image to pdf", "pdf to image", "convert word to pdf", "pdf to word", "pdf to powerpoint", "word to pdf", "pdf to docx", "pdf to xlsx", "pdf to pptx", "pdf to hwpx", "searchable pdf", "scanned pdf ocr", "hwp to pdf"],
  "document-markdown": ["워드 마크다운", "엑셀 마크다운", "프레젠테이션", "마크다운", "Word to Markdown", "Excel to Markdown", "PowerPoint to Markdown", "PDF to Markdown", "DOCX", "XLSX", "XLS", "PPTX", "MarkItDown", "markdown"],
  "image-studio": ["사진", "이미지", "png", "jpg", "리사이즈", "image resizer", "블러", "얼굴 모자이크", "pixelate", "mosaic"],
  "audio-studio": ["음악 자르기", "mp3 cutter", "오디오", "mp3", "음악", "녹음"],
  "document-generator": ["워드 메일머지", "메일머지", "mail merge", "문서 일괄 생성", "양식 자동 채우기", "DOCX", "Word", "워드 온라인", "엑셀 온라인"],
  "document-redactor": ["개인정보 마스킹", "검정 박스", "PDF 가리기", "문서 가리기"],
  "payroll-calculator": ["4대보험", "급여", "실수령액", "퇴직금", "payroll", "salary"],
  "image-privacy": ["사진 메타데이터", "exif", "gps", "위치정보", "metadata"],
  "security-tools": ["랜덤 비밀번호", "비밀번호", "password", "random"],
  "qr-studio": ["QR 스튜디오", "QR 만들기", "QR 스캔", "QR코드", "qr", "qrcode"],
  "data-converter": ["데이터 변환", "csv", "json", "html", "table"],
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
