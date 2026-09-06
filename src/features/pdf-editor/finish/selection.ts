export type PageParity = "all" | "odd" | "even";

export type RangeParseError =
  | "empty-range"
  | "invalid-range"
  | "descending-range"
  | "page-out-of-bounds";

export type RangeParseResult =
  | { ok: true; pages: number[]; canonicalText: string }
  | { ok: false; pages: []; error: RangeParseError };

export interface PageSelectionState {
  totalPages: number;
  exactPages: number[];
  parity: PageParity;
  rangeText: string;
  canExecute: boolean;
}

export type FilePageSelections = Readonly<Record<string, PageSelectionState>>;

export interface PageLowerBoundOptions {
  startPage: number;
  excludeCover: boolean;
}

function assertPageCount(totalPages: number) {
  if (!Number.isSafeInteger(totalPages) || totalPages < 0) throw new RangeError("invalid-page-count");
}

function sortedUniquePages(pages: Iterable<number>) {
  return [...new Set(pages)].sort((left, right) => left - right);
}

export function formatCanonicalRange(pages: Iterable<number>): string {
  const sorted = sortedUniquePages(pages);
  if (sorted.some((page) => !Number.isSafeInteger(page) || page < 1)) throw new RangeError("invalid-page-number");
  const parts: string[] = [];
  for (let index = 0; index < sorted.length;) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index];
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    index += 1;
  }
  return parts.join(",");
}

export function parseRange(rangeText: string, totalPages: number): RangeParseResult {
  assertPageCount(totalPages);
  if (!rangeText.trim()) return { ok: false, pages: [], error: "empty-range" };
  const pages = new Set<number>();
  for (const rawPart of rangeText.split(",")) {
    const part = rawPart.trim();
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return { ok: false, pages: [], error: "invalid-range" };
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return { ok: false, pages: [], error: "invalid-range" };
    }
    if (start > end) return { ok: false, pages: [], error: "descending-range" };
    if (start < 1 || end > totalPages) return { ok: false, pages: [], error: "page-out-of-bounds" };
    for (let page = start; page <= end; page += 1) pages.add(page);
  }
  const exactPages = sortedUniquePages(pages);
  return { ok: true, pages: exactPages, canonicalText: formatCanonicalRange(exactPages) };
}

export function applyParity(pages: Iterable<number>, parity: PageParity): number[] {
  return sortedUniquePages(pages).filter((page) => parity === "all" || (parity === "odd" ? page % 2 === 1 : page % 2 === 0));
}

export function selectionAnchor({ startPage, excludeCover }: PageLowerBoundOptions): number {
  if (!Number.isSafeInteger(startPage) || startPage < 1) throw new RangeError("invalid-start-page");
  return Math.max(startPage, excludeCover ? 2 : 1);
}

export function isThumbnailDisabled(
  page: number,
  totalPages: number,
  options: PageLowerBoundOptions,
): boolean {
  assertPageCount(totalPages);
  return !Number.isSafeInteger(page) || page < selectionAnchor(options) || page > totalPages;
}

export function createPageSelection(
  totalPages: number,
  rangeText: string,
  parity: PageParity,
  options: PageLowerBoundOptions,
): PageSelectionState | { error: RangeParseError; state: PageSelectionState } {
  const parsed = parseRange(rangeText, totalPages);
  if (!parsed.ok) {
    return {
      error: parsed.error,
      state: { totalPages, exactPages: [], parity, rangeText, canExecute: false },
    };
  }
  const lowerBound = selectionAnchor(options);
  const exactPages = applyParity(parsed.pages.filter((page) => page >= lowerBound), parity);
  return {
    totalPages,
    exactPages,
    parity,
    rangeText: parsed.canonicalText,
    canExecute: exactPages.length > 0,
  };
}

export function toggleThumbnailPage(
  state: PageSelectionState,
  page: number,
  options: PageLowerBoundOptions,
): PageSelectionState {
  if (isThumbnailDisabled(page, state.totalPages, options)) return state;
  const selected = new Set(state.exactPages);
  if (selected.has(page)) selected.delete(page);
  else selected.add(page);
  const exactPages = sortedUniquePages(selected);
  return {
    ...state,
    exactPages,
    parity: "all",
    rangeText: formatCanonicalRange(exactPages),
    canExecute: exactPages.length > 0,
  };
}

export function setFilePageSelection(
  selections: FilePageSelections,
  fileKey: string,
  selection: PageSelectionState,
): FilePageSelections {
  if (!fileKey) throw new RangeError("empty-file-key");
  return { ...selections, [fileKey]: selection };
}

export function displayNumber(
  physicalPage: number,
  startNumber: number,
  options: PageLowerBoundOptions,
): number {
  if (!Number.isSafeInteger(physicalPage) || physicalPage < 1) throw new RangeError("invalid-physical-page");
  if (!Number.isSafeInteger(startNumber)) throw new RangeError("invalid-start-number");
  return startNumber + physicalPage - selectionAnchor(options);
}

export function tokenPageCount(totalPages: number): number {
  assertPageCount(totalPages);
  return totalPages;
}
