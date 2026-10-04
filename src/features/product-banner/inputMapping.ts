import { INPUT_LIMITS, ProductBannerInputError, type BannerInputProduct, type CellValue, type ColumnMapping, type FileInputResult, type InputBook, type InputRow, type MappingIssue, type PriceValue, type ProductField, type SheetSelection, type SheetSummary } from "./inputTypes.ts";
import { validateProductUrl } from "./urlPolicy.ts";

const aliases: Record<ProductField, string[]> = {
  imageUrl: ["image url", "imageurl", "image", "이미지 주소", "이미지 url", "상품 이미지", "상품 이미지 주소"],
  promotionUrl: ["promotion url", "promotionurl", "affiliate url", "affiliate link", "product url", "제휴 링크", "상품 링크", "프로모션 url"],
  name: ["product desc", "product description", "product name", "title", "name", "상품명", "상품 설명"],
  productId: ["productid", "product id", "상품 id", "상품id", "상품 번호"],
  videoUrl: ["video url", "videourl", "동영상 url", "동영상 주소"],
  originPrice: ["origin price", "original price", "정가", "원래 가격"],
  discountPrice: ["discount price", "sale price", "할인가", "판매가"],
  discount: ["discount", "discount rate", "할인", "할인율"],
  currency: ["currency", "통화"],
};
export function normalizeHeader(value: string): string { return value.replace(/\uFEFF/gu, "").trim().replace(/\s+/gu, " ").toLowerCase(); }
export function mapHeaders(labels: string[]): { mapping: ColumnMapping; issues: MappingIssue[] } {
  const mapping: ColumnMapping = {}, issues: MappingIssue[] = [];
  for (const field of Object.keys(aliases) as ProductField[]) {
    const columns = labels.flatMap((label, column) => aliases[field].includes(normalizeHeader(label)) ? [column] : []);
    if (columns.length === 1) mapping[field] = columns[0];
    else if (columns.length > 1) issues.push({ code: "MAPPING_AMBIGUOUS", field, columns });
    else if (field === "imageUrl" || field === "promotionUrl") issues.push({ code: "MAPPING_REQUIRED", field });
  }
  return { mapping, issues };
}
export function summarizeSheets(book: InputBook): SheetSummary[] {
  return book.sheets.map((sheet, sheetIndex) => {
    const headerCandidates = sheet.rows.slice(0, 25).map((row) => {
      const labels = row.cells.map((cell) => cell?.text ?? "");
      return { rowNumber: row.rowNumber, labels, ...mapHeaders(labels) };
    });
    const ranked = [...headerCandidates].sort((a, b) => Object.keys(b.mapping).length - Object.keys(a.mapping).length);
    const best = ranked[0];
    return { sheetIndex, name: sheet.name, rowCount: sheet.rowCount, columnCount: sheet.columnCount, headerCandidates,
      suggestedHeaderRow: best && !best.issues.length ? best.rowNumber : null };
  });
}
function currencyValue(raw?: string | null): string | null { return raw && /^[A-Za-z]{3}$/u.test(raw.trim()) ? raw.trim().toUpperCase() : null; }
export function parsePrice(cell: CellValue | null | undefined, currencyRaw?: string): PriceValue {
  const raw = cell?.text ?? null, currency = currencyValue(currencyRaw);
  if (raw == null || !raw.trim() || cell?.cacheMissing || cell?.kind === "error") return { raw, amount: null, currency };
  const match = /^(?:([A-Za-z]{3})\s+)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)$/u.exec(raw.trim());
  const prefix = currencyValue(match?.[1]);
  const amount = match ? Number(match[2].replace(/,/gu, "")) : NaN;
  return { raw, amount: Number.isFinite(amount) && !(prefix && currency && prefix !== currency) ? amount : null, currency: currency ?? prefix };
}
export function parseDiscount(cell: CellValue | null | undefined): BannerInputProduct["discount"] {
  const raw = cell?.text ?? null;
  if (raw == null || cell?.cacheMissing || cell?.kind === "error") return { raw, percent: null };
  const match = /^(\d+(?:\.\d+)?)\s*%$/u.exec(raw.trim());
  // A numeric percentage-formatted Excel cell stores a fraction; ordinary numbers are ambiguous.
  const percent = match ? Number(match[1]) : cell?.kind === "number" && /%/u.test(cell.display ?? "") ? Number(raw) * 100 : NaN;
  return { raw, percent: Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null };
}
function productFromRow(row: InputRow, mapping: ColumnMapping, fileIndex: number, sheetIndex: number): BannerInputProduct {
  const cell = (field: ProductField) => mapping[field] == null ? null : row.cells[mapping[field]!] ?? null;
  const value = (field: ProductField) => cell(field)?.text ?? "";
  const imageUrl = value("imageUrl").trim(), promotionUrl = value("promotionUrl").trim(), name = value("name");
  const id = cell("productId"), needsReview: BannerInputProduct["needsReview"] = [];
  if (!validateProductUrl(imageUrl).valid || cell("imageUrl")?.cacheMissing) needsReview.push("imageUrl");
  if (!validateProductUrl(promotionUrl).valid || cell("promotionUrl")?.cacheMissing) needsReview.push("promotionUrl");
  if (!name.trim() || cell("name")?.cacheMissing) needsReview.push("name");
  const invalidId = id && (id.unsafeInteger || id.cacheMissing || id.kind === "error" || (id.kind === "number" && !Number.isSafeInteger(Number(id.text))));
  if (invalidId) needsReview.push("productId");
  return { source: { fileIndex, sheetIndex, rowNumber: row.rowNumber }, imageUrl, promotionUrl, name,
    productId: invalidId ? null : id?.text ?? null, videoUrl: value("videoUrl") || null,
    originPrice: parsePrice(cell("originPrice"), value("currency")), discountPrice: parsePrice(cell("discountPrice"), value("currency")),
    discount: parseDiscount(cell("discount")), needsReview,
    sourceHyperlinks: { ...(cell("imageUrl")?.hyperlink ? { imageUrl: cell("imageUrl")!.hyperlink } : {}), ...(cell("promotionUrl")?.hyperlink ? { promotionUrl: cell("promotionUrl")!.hyperlink } : {}) } };
}
export function extractInputProducts(book: InputBook, fileIndex: number, fileName: string, selections?: SheetSelection[]): FileInputResult {
  const sheets = summarizeSheets(book), products: BannerInputProduct[] = [], issues: FileInputResult["issues"] = [];
  const selected: SheetSelection[] = selections ?? sheets.map((sheet) => ({ sheetIndex: sheet.sheetIndex, headerRow: sheet.suggestedHeaderRow ?? undefined }));
  for (const selection of [...selected].sort((a, b) => a.sheetIndex - b.sheetIndex)) {
    const { sheetIndex } = selection, sheet = book.sheets[sheetIndex];
    if (!sheet || !Number.isInteger(sheetIndex)) { issues.push({ sheetIndex, code: "SHEET_NOT_FOUND" }); continue; }
    const header = sheet.rows.find((row) => row.rowNumber === selection.headerRow);
    if (!header) { issues.push({ sheetIndex, code: selection.headerRow == null ? "MAPPING_REQUIRED" : "HEADER_ROW_INVALID" }); continue; }
    const mapped = mapHeaders(header.cells.map((cell) => cell?.text ?? ""));
    const mapping = { ...mapped.mapping, ...selection.mapping };
    const unresolved = mapped.issues.filter((issue) => selection.mapping?.[issue.field] == null);
    for (const field of Object.keys(mapping) as ProductField[]) {
      const column = mapping[field]!;
      if (!Number.isInteger(column) || column < 0 || column >= sheet.columnCount) unresolved.push({ code: "MAPPING_REQUIRED", field });
      if (Object.entries(mapping).some(([other, index]) => other !== field && index === column)) unresolved.push({ code: "MAPPING_AMBIGUOUS", field });
    }
    if (unresolved.length) { issues.push(...unresolved.map((issue) => ({ sheetIndex, code: issue.code, field: issue.field }))); continue; }
    for (const row of sheet.rows) {
      if (row.rowNumber <= header.rowNumber) continue;
      products.push(productFromRow(row, mapping, fileIndex, sheetIndex));
      if (products.length > INPUT_LIMITS.products) throw new ProductBannerInputError("PRODUCT_LIMIT");
    }
  }
  return { fileIndex, fileName, format: book.format, sheets, products, issues };
}
