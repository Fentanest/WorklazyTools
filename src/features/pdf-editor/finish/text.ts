import { expandTokens, type CapturedTokenValues, type TokenError, type TokenWarning } from "./tokens.ts";

export interface TextControlError {
  code: "control-character";
  line: number;
  column: number;
  codePoint: number;
}

export interface PreparedText {
  text: string;
  lines: string[];
  warnings: TokenWarning[];
  errors: Array<TokenError | TextControlError>;
}

export interface TextFontProbe {
  encodeText(text: string): unknown;
  widthOfTextAtSize(text: string, size: number): number;
}

export interface NotoFontProbe extends TextFontProbe {
  getCharacterSet(): number[];
}

export interface TextCandidate {
  field: string;
  prepared: PreparedText;
}

export interface MissingScalar {
  field: string;
  line: number;
  column: number;
  codePoint: number;
}

export interface DocumentFontDecision {
  font: "helvetica" | "noto";
  blocked: boolean;
  missing: MissingScalar[];
}

export interface TextRegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TextAlignment = "left" | "center" | "right";
export type TextVerticalAlignment = "top" | "bottom";

export interface LayoutRun {
  text: string;
  width: number;
  x: number;
  y: number;
  sourceLine: number;
}

export type LayoutError = "invalid-layout" | "narrow-region";
export type LayoutWarning = "horizontal-overflow" | "vertical-overflow";

export type TextLayoutResult =
  | { ok: false; error: LayoutError; ellipsisWidth?: number }
  | { ok: true; runs: LayoutRun[]; warnings: LayoutWarning[]; lineHeight: number; ellipsisWidth: number };

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SixTextRegion {
  region: `${TextVerticalAlignment}-${TextAlignment}`;
  alignment: TextAlignment;
  vertical: TextVerticalAlignment;
  box: TextRegionBox;
}

function isBlockedControl(codePoint: number) {
  return codePoint <= 0x1f && codePoint !== 0x0a || codePoint === 0x7f || codePoint >= 0x80 && codePoint <= 0x9f;
}

function locateControls(text: string): TextControlError[] {
  const errors: TextControlError[] = [];
  let line = 1;
  let column = 1;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 0x0a) {
      line += 1;
      column = 1;
    } else {
      if (isBlockedControl(codePoint)) errors.push({ code: "control-character", line, column, codePoint });
      column += 1;
    }
  }
  return errors;
}

export function preprocessText(template: string, values: CapturedTokenValues): PreparedText {
  const expanded = expandTokens(template, values);
  const normalized = expanded.text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  return {
    text: normalized,
    lines: normalized.split("\n"),
    warnings: expanded.warnings,
    errors: [...expanded.errors, ...locateControls(normalized)],
  };
}

function missingInRun(field: string, line: string, lineNumber: number, characters: Set<number>): MissingScalar[] {
  const result: MissingScalar[] = [];
  let column = 1;
  for (const character of line) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (!characters.has(codePoint)) result.push({ field, line: lineNumber, column, codePoint });
    column += 1;
  }
  return result;
}

export function decideDocumentFont(
  candidates: readonly TextCandidate[],
  helvetica: TextFontProbe,
  noto: NotoFontProbe,
): DocumentFontDecision {
  let needsNoto = false;
  let blocked = candidates.some(({ prepared }) => prepared.errors.length > 0);
  for (const candidate of candidates) {
    for (const [index, line] of candidate.prepared.lines.entries()) {
      if (!line) continue;
      try {
        helvetica.encodeText(line);
      } catch {
        needsNoto = true;
      }
    }
  }
  const runsToCheck = candidates.flatMap((candidate) => candidate.prepared.lines.map((line, index) => ({ field: candidate.field, line, lineNumber: index + 1 })));
  const characterSet = needsNoto ? new Set(noto.getCharacterSet()) : null;
  const missing = characterSet
    ? runsToCheck.flatMap(({ field, line, lineNumber }) => missingInRun(field, line, lineNumber, characterSet))
    : [];
  if (missing.length > 0) blocked = true;
  return { font: needsNoto ? "noto" : "helvetica", blocked, missing };
}

function fitWithEllipsis(text: string, width: number, font: TextFontProbe, size: number) {
  const characters = [...text];
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, middle).join("")}…`;
    if (font.widthOfTextAtSize(candidate, size) <= width) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join("")}…`;
}

export function layoutTextLines(input: {
  lines: readonly string[];
  size: number;
  region: TextRegionBox;
  alignment: TextAlignment;
  vertical: TextVerticalAlignment;
  font: TextFontProbe;
}): TextLayoutResult {
  const { lines, size, region, alignment, vertical, font } = input;
  const values = [size, region.x, region.y, region.width, region.height];
  if (values.some((value) => !Number.isFinite(value)) || size <= 0 || region.width <= 0 || region.height < 0) {
    return { ok: false, error: "invalid-layout" };
  }
  const lineHeight = size * 1.2;
  const ellipsisWidth = font.widthOfTextAtSize("…", size);
  if (!Number.isFinite(ellipsisWidth) || ellipsisWidth <= 0) return { ok: false, error: "invalid-layout" };
  if (region.width < ellipsisWidth) return { ok: false, error: "narrow-region", ellipsisWidth };
  const warnings = new Set<LayoutWarning>();
  const measured: Array<{ text: string; width: number; sourceLine: number }> = [];
  for (const [index, line] of lines.entries()) {
    let text = line;
    let width = font.widthOfTextAtSize(text, size);
    if (width > region.width) {
      text = fitWithEllipsis(text, region.width, font, size);
      width = font.widthOfTextAtSize(text, size);
      warnings.add("horizontal-overflow");
    }
    measured.push({ text, width, sourceLine: index + 1 });
  }
  const maximumLines = Math.max(0, Math.floor((region.height + Number.EPSILON * 16) / lineHeight));
  const visible = measured.slice(0, maximumLines);
  if (visible.length < measured.length) warnings.add("vertical-overflow");
  const runs = visible.map((run, index) => {
    const x = alignment === "left"
      ? region.x
      : alignment === "center"
        ? region.x + (region.width - run.width) / 2
        : region.x + region.width - run.width;
    const y = vertical === "top"
      ? region.y + region.height - size - index * lineHeight
      : region.y + (visible.length - index - 1) * lineHeight;
    return { ...run, x, y };
  });
  return { ok: true, runs, warnings: [...warnings], lineHeight, ellipsisWidth };
}

export function createSixTextRegions(pageWidth: number, pageHeight: number, margins: PageMargins): SixTextRegion[] {
  const values = [pageWidth, pageHeight, margins.top, margins.right, margins.bottom, margins.left];
  if (values.some((value) => !Number.isFinite(value)) || pageWidth <= 0 || pageHeight <= 0 || Object.values(margins).some((value) => value < 0)) {
    throw new RangeError("invalid-region-geometry");
  }
  const width = pageWidth - margins.left - margins.right;
  const height = pageHeight - margins.top - margins.bottom;
  if (width <= 0 || height <= 0) throw new RangeError("margin-exhausts-page");
  const columnWidth = width / 3;
  const rowHeight = height / 2;
  const regions: SixTextRegion[] = [];
  for (const vertical of ["top", "bottom"] as const) {
    for (const [column, alignment] of (["left", "center", "right"] as const).entries()) {
      regions.push({
        region: `${vertical}-${alignment}`,
        alignment,
        vertical,
        box: {
          x: margins.left + column * columnWidth,
          y: vertical === "top" ? margins.bottom + rowHeight : margins.bottom,
          width: columnWidth,
          height: rowHeight,
        },
      });
    }
  }
  return regions;
}
