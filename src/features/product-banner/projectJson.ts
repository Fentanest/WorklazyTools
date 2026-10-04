import { BannerStateError, PROJECT_LIMITS, PROJECT_SCHEMA_VERSION, type BannerProject, type EditProduct } from "./stateTypes.ts";
import { boolean, integer, nullableString, record, string } from "./stateValidation.ts";
import { validateSettings } from "./settings.ts";
import type { PriceValue } from "./inputTypes.ts";

/** Bound the entire tree, including ignored fields, before decoding the allowlist. No merging/reviver/evaluation. */
function inspectTree(value: unknown, depth = 0, ancestors = new Set<object>()): void {
  if (depth > PROJECT_LIMITS.depth) throw new BannerStateError("PROJECT_LIMIT");
  if (typeof value === "string") { string(value); return; }
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value)) throw new BannerStateError("INVALID_PROJECT");
  ancestors.add(value);
  for (const key of Object.keys(value)) {
    string(key);
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new BannerStateError("INVALID_PROJECT");
    inspectTree((value as Record<string, unknown>)[key], depth + 1, ancestors);
  }
  ancestors.delete(value);
}
export function validatePrice(value: unknown): PriceValue {
  const v = record(value), raw = nullableString(v.raw), currency = nullableString(v.currency);
  if (currency !== null && !/^[A-Z]{3}$/u.test(currency)) throw new BannerStateError("INVALID_PROJECT");
  if (v.amount !== null && (typeof v.amount !== "number" || !Number.isFinite(v.amount) || v.amount < 0 || v.amount > Number.MAX_SAFE_INTEGER)) throw new BannerStateError("INVALID_PROJECT");
  if (raw === null && v.amount !== null) throw new BannerStateError("INVALID_PROJECT");
  return { raw, amount: v.amount as number | null, currency };
}
export function validateDiscount(value: unknown): EditProduct["discount"] {
  const v = record(value), raw = nullableString(v.raw);
  if (v.percent !== null && (typeof v.percent !== "number" || !Number.isFinite(v.percent) || v.percent < 0 || v.percent > 100 || raw === null)) throw new BannerStateError("INVALID_PROJECT");
  return { raw, percent: v.percent as number | null };
}
export function validateImportedAt(value: unknown): string {
  const text = string(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(text) || !Number.isFinite(Date.parse(text))) throw new BannerStateError("INVALID_PROJECT");
  if (new Date(text).toISOString() !== text) throw new BannerStateError("INVALID_PROJECT");
  return text;
}
function decodeProduct(value: unknown): EditProduct {
  const v = record(value), source = record(v.source), urls = record(v.originalUrls), id = string(v.id);
  if (!/^pb-[1-9]\d{0,9}$/u.test(id)) throw new BannerStateError("INVALID_PROJECT");
  // Invalid URLs remain editable. Display-model construction refuses them instead of silently losing products.
  return { id, originalOrder: integer(v.originalOrder, 1), included: boolean(v.included), name: string(v.name),
    imageUrl: string(v.imageUrl).trim(), promotionUrl: string(v.promotionUrl).trim(),
    originalUrls: { imageUrl: string(urls.imageUrl), promotionUrl: string(urls.promotionUrl) }, productId: nullableString(v.productId),
    originPrice: validatePrice(v.originPrice), discountPrice: validatePrice(v.discountPrice), discount: validateDiscount(v.discount),
    source: { fileIndex: integer(source.fileIndex), sheetIndex: integer(source.sheetIndex), rowNumber: integer(source.rowNumber, 1), importedAt: validateImportedAt(source.importedAt) } };
}
export function validateProject(value: unknown): BannerProject {
  inspectTree(value);
  const v = record(value);
  if (v.schemaVersion !== PROJECT_SCHEMA_VERSION) throw new BannerStateError("UNSUPPORTED_VERSION");
  const nextId = integer(v.nextId, 1, 10_000_000_000);
  if (!Array.isArray(v.products)) throw new BannerStateError("INVALID_PROJECT");
  if (v.products.length > PROJECT_LIMITS.products) throw new BannerStateError("PROJECT_LIMIT");
  const products = v.products.map(decodeProduct), ids = new Set<string>(), orders = new Set<number>();
  for (const p of products) {
    if (ids.has(p.id) || orders.has(p.originalOrder) || Number(p.id.slice(3)) >= nextId) throw new BannerStateError("INVALID_PROJECT");
    ids.add(p.id); orders.add(p.originalOrder);
  }
  return { schemaVersion: PROJECT_SCHEMA_VERSION, nextId, products, settings: validateSettings(v.settings) };
}
export function loadProjectJson(text: string): BannerProject {
  if (typeof text !== "string") throw new BannerStateError("INVALID_PROJECT");
  if (text.length > PROJECT_LIMITS.bytes || new TextEncoder().encode(text).byteLength > PROJECT_LIMITS.bytes) throw new BannerStateError("PROJECT_LIMIT");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new BannerStateError("INVALID_PROJECT"); }
  return validateProject(value);
}
export function saveProjectJson(project: BannerProject): string {
  // Construct every nested object from permitted fields, even when a caller supplied extra runtime properties.
  const text = JSON.stringify(validateProject(project));
  if (new TextEncoder().encode(text).byteLength > PROJECT_LIMITS.bytes) throw new BannerStateError("PROJECT_LIMIT");
  return text;
}
