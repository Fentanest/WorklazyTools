import type { SpreadsheetCellData, SpreadsheetSheetData } from "../spreadsheet-core/inputAdapter.ts";

export const QR_BULK_LIMITS = Object.freeze({
  inputBytes: 50 * 1024 * 1024,
  selectedCells: 2_000_000,
  rows: 5_000,
  memoryRows: 1_000,
  pdfRows: 2_400,
  softOutputBytes: 200 * 1024 * 1024,
  hardOutputBytes: 500 * 1024 * 1024,
  millisecondsPerRowAt640: 72,
});

export const QR_LABEL_PRESETS = Object.freeze({
  a4: Object.freeze({ width: 595.28, height: 841.89 }),
  letter: Object.freeze({ width: 612, height: 792 }),
});
export const QR_LABEL_FONT_PATH = "vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf";

export type QrPayloadType = "text" | "email" | "tel" | "sms" | "wifi" | "vcard" | "url";
export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type QrWifiSecurity = "WEP" | "WPA" | "nopass";

export interface QrBulkHeader {
  column: number;
  name: string;
}

export interface QrPayloadFields {
  value?: string;
  address?: string;
  subject?: string;
  body?: string;
  number?: string;
  message?: string;
  security?: QrWifiSecurity;
  ssid?: string;
  password?: string;
  hidden?: boolean;
  familyName?: string;
  givenName?: string;
  formattedName?: string;
  organization?: string;
  phone?: string;
  email?: string;
  url?: string;
}

export type QrBulkErrorCode =
  | "MISSING_HEADER"
  | "DUPLICATE_HEADER"
  | "EMPTY_VALUE"
  | "INVALID_URL"
  | "INVALID_EMAIL"
  | "INVALID_WIFI_SECURITY"
  | "ROW_LIMIT"
  | "PDF_ROW_LIMIT"
  | "INPUT_LIMIT"
  | "CELL_LIMIT"
  | "OUTPUT_LIMIT"
  | "STORAGE_LIMIT";

export class QrBulkError extends Error {
  readonly code: QrBulkErrorCode;
  readonly detail?: string;

  constructor(code: QrBulkErrorCode, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
    this.name = "QrBulkError";
  }
}

type CompiledTemplatePart = { text: string } | { column: number };
export type CompiledQrTemplate = readonly CompiledTemplatePart[];

export function compileQrTemplate(template: string, headers: QrBulkHeader[]): CompiledQrTemplate {
  const byName = new Map<string, number[]>();
  headers.forEach(({ column, name }) => {
    const columns = byName.get(name) ?? [];
    columns.push(column);
    byName.set(name, columns);
  });
  const parts: CompiledTemplatePart[] = [];
  let offset = 0;
  for (const match of template.matchAll(/\{\{([^{}]+)\}\}/gu)) {
    const index = match.index ?? 0;
    if (index > offset) parts.push({ text: template.slice(offset, index) });
    const name = match[1].trim();
    const columns = byName.get(name);
    if (!columns?.length) throw new QrBulkError("MISSING_HEADER", name);
    if (columns.length > 1) throw new QrBulkError("DUPLICATE_HEADER", name);
    parts.push({ column: columns[0] });
    offset = index + match[0].length;
  }
  if (offset < template.length) parts.push({ text: template.slice(offset) });
  return parts;
}

export function renderQrTemplate(template: CompiledQrTemplate, valueForColumn: (column: number) => string) {
  return template.map((part) => "text" in part ? part.text : valueForColumn(part.column)).join("");
}

export function spreadsheetDisplayValue(cell: SpreadsheetCellData | undefined) {
  if (!cell) return "";
  if (cell.displayValue !== undefined) return cell.displayValue;
  if (cell.value instanceof Date) return cell.value.toISOString();
  return cell.value === null ? "" : String(cell.value);
}

export function createSpreadsheetDisplayLookup(sheet: SpreadsheetSheetData) {
  const values = new Map<string, string>();
  sheet.cells.forEach((cell) => values.set(`${cell.sourceRow}:${cell.sourceColumn}`, spreadsheetDisplayValue(cell)));
  return (sourceRow: number, sourceColumn: number) => values.get(`${sourceRow}:${sourceColumn}`) ?? "";
}

export function qrBulkHeaders(sheet: SpreadsheetSheetData, headerRow: number): QrBulkHeader[] {
  const cells = new Map(sheet.cells.filter((cell) => cell.sourceRow === headerRow).map((cell) => [cell.sourceColumn, cell]));
  return Array.from({ length: sheet.columnCount }, (_, index) => {
    const column = index + 1;
    return { column, name: spreadsheetDisplayValue(cells.get(column)) || spreadsheetColumnName(column) };
  });
}

export function buildQrPayload(type: QrPayloadType, fields: QrPayloadFields) {
  if (type === "text") return requireValue(fields.value);
  if (type === "url") {
    const value = requireValue(fields.value);
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new QrBulkError("INVALID_URL", value);
      return value;
    } catch (error) {
      if (error instanceof QrBulkError) throw error;
      throw new QrBulkError("INVALID_URL", value);
    }
  }
  if (type === "email") {
    const address = requireValue(fields.address);
    if (!/^[^\s@]+@[^\s@]+$/u.test(address)) throw new QrBulkError("INVALID_EMAIL", address);
    return `mailto:${address}?subject=${encodeURIComponent(fields.subject ?? "")}&body=${encodeURIComponent(fields.body ?? "")}`;
  }
  if (type === "tel") return `tel:${requireValue(fields.number)}`;
  if (type === "sms") return `SMSTO:${requireValue(fields.number)}:${fields.message ?? ""}`;
  if (type === "wifi") {
    const security = fields.security ?? "WPA";
    if (!(["WEP", "WPA", "nopass"] as const).includes(security)) throw new QrBulkError("INVALID_WIFI_SECURITY", security);
    return `WIFI:T:${security};S:${escapeWifi(requireValue(fields.ssid))};P:${escapeWifi(fields.password ?? "")};H:${fields.hidden === true ? "true" : "false"};;`;
  }
  const familyName = escapeVCard(fields.familyName ?? "");
  const givenName = escapeVCard(fields.givenName ?? "");
  const formattedName = escapeVCard(requireValue(fields.formattedName));
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${familyName};${givenName};;;`, `FN:${formattedName}`];
  if (fields.organization) lines.push(`ORG:${escapeVCard(fields.organization)}`);
  if (fields.phone) lines.push(`TEL:${escapeVCard(fields.phone)}`);
  if (fields.email) lines.push(`EMAIL:${escapeVCard(fields.email)}`);
  if (fields.url) lines.push(`URL:${escapeVCard(fields.url)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function escapeWifi(value: string) {
  return value.replace(/[;,:"]|\\/gu, (character) => "\\" + character);
}

export function escapeVCard(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/\r\n|\r|\n/gu, "\\n").replace(/,/gu, "\\,").replace(/;/gu, "\\;");
}

export function effectiveQrErrorCorrection(level: QrErrorCorrectionLevel, hasLogo: boolean): QrErrorCorrectionLevel {
  return hasLogo ? "H" : level;
}

export function effectiveQrQuietZone(modules: number, hasLogo: boolean) {
  const normalized = Math.min(8, Math.max(0, Math.round(modules)));
  return hasLogo ? Math.max(2, normalized) : normalized;
}

export function estimateQrBulkOutputBytes(rows: number, size: number, hasLogo: boolean, transparent: boolean) {
  const normalizedSize = Math.min(2048, Math.max(128, size));
  const pixels = normalizedSize * normalizedSize;
  const compressionFactor = (transparent ? 0.2 : 0.24) * (hasLogo ? 1.32 : 1);
  return Math.ceil(Math.max(0, rows) * (pixels * compressionFactor + 2_048));
}

export function estimateQrBulkDurationMs(rows: number, size: number) {
  return Math.ceil(Math.max(0, rows) * QR_BULK_LIMITS.millisecondsPerRowAt640 * Math.max(0.25, (size / 640) ** 2));
}

export function validateQrBulkBudget(input: {
  inputBytes: number;
  selectedCells: number;
  rows: number;
  estimatedOutputBytes: number;
  availableStorageBytes?: number;
  memoryFallback?: boolean;
  includePdf?: boolean;
}) {
  if (input.inputBytes > QR_BULK_LIMITS.inputBytes) throw new QrBulkError("INPUT_LIMIT");
  if (input.selectedCells > QR_BULK_LIMITS.selectedCells) throw new QrBulkError("CELL_LIMIT");
  const rowLimit = input.memoryFallback ? QR_BULK_LIMITS.memoryRows : QR_BULK_LIMITS.rows;
  if (input.rows > rowLimit) throw new QrBulkError("ROW_LIMIT");
  if (input.includePdf && input.rows > QR_BULK_LIMITS.pdfRows) throw new QrBulkError("PDF_ROW_LIMIT");
  if (input.estimatedOutputBytes > QR_BULK_LIMITS.hardOutputBytes) throw new QrBulkError("OUTPUT_LIMIT");
  if (input.availableStorageBytes !== undefined && input.estimatedOutputBytes > input.availableStorageBytes) throw new QrBulkError("STORAGE_LIMIT");
}

export function qrLabelCell(index: number, preset: keyof typeof QR_LABEL_PRESETS) {
  const { width, height } = QR_LABEL_PRESETS[preset];
  const margin = 36;
  const gapX = 6;
  const gapY = 6;
  const columns = 3;
  const rows = 8;
  const perPage = columns * rows;
  const position = index % perPage;
  const row = Math.floor(position / columns);
  const column = position % columns;
  const cellWidth = (width - 2 * margin - (columns - 1) * gapX) / columns;
  const cellHeight = (height - 2 * margin - (rows - 1) * gapY) / rows;
  return {
    page: Math.floor(index / perPage),
    row,
    column,
    x: margin + column * (cellWidth + gapX),
    y: height - margin - (row + 1) * cellHeight - row * gapY,
    width: cellWidth,
    height: cellHeight,
  };
}

function requireValue(value: string | undefined) {
  if (value === undefined || value.length === 0) throw new QrBulkError("EMPTY_VALUE");
  return value;
}

function spreadsheetColumnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
