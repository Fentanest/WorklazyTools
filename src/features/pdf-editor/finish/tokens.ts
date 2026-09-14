export interface TokenWarning {
  code: "unknown-token";
  token: string;
  offset: number;
}

export interface TokenError {
  code: "date-format";
  offset: number;
  token: string;
}

export interface CapturedTokenValues {
  page: number;
  pages: number;
  filename: string;
  date: Date;
  locale: string;
}

export interface CaptureTokenValuesInput {
  page: number;
  pages: number;
  filename: string;
  clock: () => Date;
  locale: string;
}

export interface TokenExpansion {
  text: string;
  warnings: TokenWarning[];
  errors: TokenError[];
}

const DATE_FIELDS = ["YYYY", "MM", "DD"] as const;

function pad2(value: number) {
  return `${value}`.padStart(2, "0");
}

export function filenameBaseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}

export const FILENAME_LIMIT_MIN = 1;
export const FILENAME_LIMIT_MAX = 1000;

export type ParsedFilenameLimit =
  | { valid: true; limit: number | null }
  | { valid: false };

export function parseFilenameLimit(raw: string): ParsedFilenameLimit {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, limit: null };
  if (!/^\d+$/.test(trimmed)) return { valid: false };
  const limit = Number(trimmed);
  if (!Number.isSafeInteger(limit) || limit < FILENAME_LIMIT_MIN || limit > FILENAME_LIMIT_MAX) return { valid: false };
  return { valid: true, limit };
}

export function segmentGraphemes(text: string): string[] | null {
  if (typeof Intl.Segmenter !== "function") return null;
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(({ segment }) => segment);
}

export function truncateFilenameByGraphemes(base: string, limit: number): string | null {
  const clusters = segmentGraphemes(base);
  if (!clusters) return null;
  if (clusters.length < limit) return base;
  if (limit <= 1) return "…";
  return `${clusters.slice(0, limit - 1).join("")}…`;
}

export function applyFilenameLimit(base: string, limit: number | null): string | null {
  if (limit === null) return base;
  return truncateFilenameByGraphemes(base, limit);
}

export function captureTokenValues(input: CaptureTokenValuesInput): CapturedTokenValues {
  const captured = input.clock();
  if (!(captured instanceof Date) || Number.isNaN(captured.getTime())) throw new RangeError("invalid-clock-value");
  return {
    page: input.page,
    pages: input.pages,
    filename: filenameBaseName(input.filename),
    date: new Date(captured.getTime()),
    locale: input.locale,
  };
}

export function formatDatePattern(format: string, date: Date): string | null {
  if (!format) return null;
  const fields = { YYYY: `${date.getFullYear()}`, MM: pad2(date.getMonth() + 1), DD: pad2(date.getDate()) };
  let index = 0;
  const used = new Set<string>();
  let output = "";
  let expectField = true;
  while (index < format.length) {
    if (expectField) {
      const field = DATE_FIELDS.find((candidate) => format.startsWith(candidate, index));
      if (!field || used.has(field)) return null;
      used.add(field);
      output += fields[field];
      index += field.length;
      expectField = false;
    } else {
      const separator = format[index];
      if (!["-", ".", "/", " "].includes(separator)) return null;
      output += separator;
      index += 1;
      expectField = true;
    }
  }
  return !expectField && used.size > 0 ? output : null;
}

function defaultDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale).format(date);
}

export function expandTokens(template: string, values: CapturedTokenValues): TokenExpansion {
  const warnings: TokenWarning[] = [];
  const errors: TokenError[] = [];
  const text = template.replace(/\{([^{}]*)\}/g, (token, body: string, offset: number) => {
    if (body === "page") return `${values.page}`;
    if (body === "pages") return `${values.pages}`;
    if (body === "filename") return values.filename;
    if (body === "date") return defaultDate(values.date, values.locale);
    if (body.startsWith("date:")) {
      const formatted = formatDatePattern(body.slice(5), values.date);
      if (formatted !== null) return formatted;
      errors.push({ code: "date-format", offset, token });
      return token;
    }
    warnings.push({ code: "unknown-token", token, offset });
    return token;
  });
  return { text, warnings, errors };
}
