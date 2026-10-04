import type { PriceValue } from "./inputTypes.ts";

export const PROJECT_SCHEMA_VERSION = 1 as const;
export const PROJECT_LIMITS = { bytes: 20 * 1024 * 1024, products: 10_000, stringLength: 4096, depth: 8 } as const;
export const UNDO_LIMITS = { steps: 50, productSlots: 50_000 } as const;
export const DESIGN_IDS = ["photo-strip", "product-card", "slim", "vertical", "grid"] as const;
export type DesignId = typeof DESIGN_IDS[number];
export type BannerLanguage = "ko" | "en";
export type ImageStatus = "unchecked" | "checking" | "success" | "failure";
export type BannerSettings = Readonly<{
  design: DesignId; visibleCount: number; width: number; imageHeight: number;
  gridPreset: "2x2" | "3x2" | "custom"; gridColumns: number; gridRows: number;
  showName: boolean; showPrice: boolean; showDiscount: boolean; showButton: boolean;
  colors: Readonly<{ background: string; text: string; accent: string; border: string }>;
  theme: "light" | "dark" | "auto"; autoPlay: boolean; intervalSeconds: number; moveBy: "one" | "page";
  language: BannerLanguage; advertisingLabel: true; affiliateNotice: string;
  iframeHeight: number; autoHeight: boolean;
}>;
export type EditProduct = Readonly<{
  id: string; originalOrder: number; included: boolean; name: string;
  imageUrl: string; promotionUrl: string;
  originalUrls: Readonly<{ imageUrl: string; promotionUrl: string }>;
  productId: string | null;
  originPrice: Readonly<PriceValue>; discountPrice: Readonly<PriceValue>;
  discount: Readonly<{ raw: string | null; percent: number | null }>;
  source: Readonly<{ fileIndex: number; sheetIndex: number; rowNumber: number; importedAt: string }>;
}>;
export type BannerProject = Readonly<{
  schemaVersion: typeof PROJECT_SCHEMA_VERSION; nextId: number;
  products: readonly EditProduct[]; settings: BannerSettings;
}>;
export type EditorSnapshot = Readonly<{ project: BannerProject; selectedIds: readonly string[] }>;
export type BannerEditorState = EditorSnapshot & Readonly<{
  past: readonly EditorSnapshot[]; savedProject: BannerProject;
  imageStates: Readonly<Record<string, Readonly<{ url: string; status: ImageStatus }>>>;
}>;
export class BannerStateError extends Error {
  readonly code: "INVALID_PROJECT" | "UNSUPPORTED_VERSION" | "PROJECT_LIMIT" | "INVALID_SETTING" | "INVALID_ACTION" | "REPLACEMENT_CONFIRMATION_REQUIRED" | "INVALID_PRODUCT_URL";
  constructor(code: BannerStateError["code"]) { super(code); this.name = "BannerStateError"; this.code = code; }
}
