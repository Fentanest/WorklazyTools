import type { BannerInputProduct } from "../../../src/features/product-banner/inputTypes.ts";
import { createEditorState, reduceEditorState } from "../../../src/features/product-banner/state.ts";
export const importedAt = "2026-10-05T00:00:00.000Z";
export function inputProduct(index = 1): BannerInputProduct {
  const imageUrl = `https://example.com/img/${index}.jpg`, promotionUrl = `https://EXAMPLE.com:443/a/../p/${index}?aff=synthetic&x=1%20a`;
  return { source: { fileIndex: 0, sheetIndex: 0, rowNumber: index + 1 }, name: `합성 상품 ${index}`, imageUrl, promotionUrl,
    originalUrls: { imageUrl: ` ${imageUrl} `, promotionUrl: ` ${promotionUrl} ` }, productId: `000${index}`, videoUrl: null,
    originPrice: { raw: "USD 282.87", amount: 282.87, currency: "USD" }, discountPrice: { raw: "USD 206.50", amount: 206.5, currency: "USD" },
    discount: { raw: "27%", percent: 27 }, needsReview: [], sourceHyperlinks: {} };
}
export function stateWith(count = 3) {
  return reduceEditorState(createEditorState("ko"), { type: "append", products: Array.from({ length: count }, (_, i) => inputProduct(i + 1)), importedAt });
}
