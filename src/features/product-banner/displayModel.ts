import { validatePrice, validateDiscount } from "./projectJson.ts";
import { validateSettings } from "./settings.ts";
import { string } from "./stateValidation.ts";
import { BannerStateError, type BannerProject, type BannerSettings } from "./stateTypes.ts";
import { parsePrice } from "./inputMapping.ts";
import { validateProductUrl } from "./urlPolicy.ts";
import type { PriceValue } from "./inputTypes.ts";

export type DisplayPrice = Readonly<{ text: string; currency: string }>;
export type DisplayProduct = Readonly<{
  id: string; name: string; accessibleName: string; imageUrl: string; promotionUrl: string;
  prices?: Readonly<{ original?: DisplayPrice; sale?: DisplayPrice }>;
  discount?: string;
}>;
/** T3's only input. Neither editor/session metadata nor unselected price data crosses this boundary. */
export type BannerDisplayModel = Readonly<{
  settings: BannerSettings; products: readonly DisplayProduct[]; fileBasedInformation: boolean;
}>;
function displayPrice(value: PriceValue): DisplayPrice | undefined {
  const price = validatePrice(value);
  if (price.amount === null || price.currency === null) return undefined;
  // Revalidate the raw numeric token before displaying it, preserving every source digit.
  // The display model contains only that token and currency, never the full raw field.
  const parsed = parsePrice({ text: price.raw!, kind: "string" }, price.currency);
  if (parsed.amount !== price.amount || parsed.currency !== price.currency) return undefined;
  const text = price.raw!.trim().replace(/^[A-Za-z]{3}\s+/u, "");
  return { text, currency: price.currency };
}
export function createDisplayModel(project: BannerProject): BannerDisplayModel {
  const settings = validateSettings(project.settings);
  const products = project.products.filter((p) => p.included).map((p, index): DisplayProduct => {
    const image = validateProductUrl(string(p.imageUrl)), link = validateProductUrl(string(p.promotionUrl));
    if (!image.valid || !link.valid) throw new BannerStateError("INVALID_PRODUCT_URL");
    const name = string(p.name), accessibleName = name.trim() || (settings.language === "ko" ? `상품 ${index + 1}` : `Product ${index + 1}`);
    const result: { id: string; name: string; accessibleName: string; imageUrl: string; promotionUrl: string; prices?: DisplayProduct["prices"]; discount?: string } = {
      id: p.id, name, accessibleName, imageUrl: image.value, promotionUrl: link.value,
    };
    if (settings.showPrice) {
      const original = displayPrice(p.originPrice), sale = displayPrice(p.discountPrice);
      if (original || sale) result.prices = { ...(original ? { original } : {}), ...(sale ? { sale } : {}) };
    }
    if (settings.showDiscount) {
      const discount = validateDiscount(p.discount);
      if (discount.percent !== null) result.discount = `${discount.percent}%`;
    }
    return result;
  });
  return { settings, products, fileBasedInformation: settings.showPrice || settings.showDiscount };
}
