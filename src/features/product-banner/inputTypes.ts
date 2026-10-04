export const INPUT_LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  products: 10_000,
  worksheetCells: 250_000,
  sheets: 100,
} as const;

export const INPUT_ERROR_CODES = [
  "EMPTY_FILE", "FILE_TOO_LARGE", "PRODUCT_LIMIT", "CELL_LIMIT", "SHEET_LIMIT",
  "UNSUPPORTED_FORMAT", "HTML_XLS_UNSUPPORTED", "ENCRYPTED_FILE", "DAMAGED_FILE",
  "CSV_INVALID", "WORKER_START_FAILED", "WORKER_FAILED", "WORKER_TIMEOUT", "CANCELED",
  "MAPPING_REQUIRED", "MAPPING_AMBIGUOUS", "SHEET_NOT_FOUND", "HEADER_ROW_INVALID",
] as const;
export type InputErrorCode = typeof INPUT_ERROR_CODES[number];
export type InputFormat = "xls" | "xlsx" | "csv";
export type ProductField = "imageUrl" | "promotionUrl" | "name" | "productId" | "videoUrl" | "originPrice" | "discountPrice" | "discount" | "currency";
export type ColumnMapping = Partial<Record<ProductField, number>>;
export type CellValue = { text: string; kind: "string" | "number" | "boolean" | "error"; display?: string; hyperlink?: string; formula?: boolean; cacheMissing?: boolean; unsafeInteger?: boolean };
export type InputRow = { rowNumber: number; cells: (CellValue | null)[] };
export type InputSheet = { name: string; rows: InputRow[]; rowCount: number; columnCount: number };
export type InputBook = { format: InputFormat; sheets: InputSheet[] };
export type MappingIssue = { code: "MAPPING_REQUIRED" | "MAPPING_AMBIGUOUS"; field: ProductField; columns?: number[] };
export type SheetSummary = { sheetIndex: number; name: string; rowCount: number; columnCount: number; headerCandidates: { rowNumber: number; labels: string[]; mapping: ColumnMapping; issues: MappingIssue[] }[]; suggestedHeaderRow: number | null };
export type SheetSelection = { sheetIndex: number; headerRow?: number; mapping?: ColumnMapping };
export type PriceValue = { raw: string | null; amount: number | null; currency: string | null };
export type BannerInputProduct = {
  source: { fileIndex: number; sheetIndex: number; rowNumber: number };
  imageUrl: string; promotionUrl: string; name: string; productId: string | null; videoUrl: string | null;
  originalUrls: { imageUrl: string; promotionUrl: string };
  originPrice: PriceValue; discountPrice: PriceValue; discount: { raw: string | null; percent: number | null };
  needsReview: ("imageUrl" | "promotionUrl" | "name" | "productId")[];
  sourceHyperlinks: Partial<Record<"imageUrl" | "promotionUrl", string>>;
};
export type FileInputResult = { fileIndex: number; fileName: string; format: InputFormat; sheets: SheetSummary[]; products: BannerInputProduct[]; issues: { sheetIndex: number; code: InputErrorCode; field?: ProductField }[] };
export type FileInputFailure = { fileIndex: number; fileName: string; code: InputErrorCode };
export type BatchInputResult = { files: FileInputResult[]; failures: FileInputFailure[]; products: BannerInputProduct[] };

export class ProductBannerInputError extends Error {
  readonly code: InputErrorCode;
  constructor(code: InputErrorCode) { super(code); this.name = "ProductBannerInputError"; this.code = code; }
}
