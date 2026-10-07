import { renderBanner } from "./render";
import { defaultFrameHeight } from "./exporter";
import { escapeHtml } from "./serialization";
import type { BannerDisplayModel } from "./displayModel";
import type { BannerSettings } from "./stateTypes";

/** Preview only: fixed synthetic assets never enter the editor, JSON or exporter. */
export function samplePreview(settings: BannerSettings, runtime: string) {
  const names = ["cup", "lamp", "bag"];
  const model: BannerDisplayModel = {
    settings, fileBasedInformation: false,
    products: names.map((name, index) => ({
      id: `sample-${index}`, name: settings.language === "ko" ? `샘플 상품 ${index + 1}` : `Sample product ${index + 1}`,
      accessibleName: settings.language === "ko" ? `샘플 상품 ${index + 1}` : `Sample product ${index + 1}`,
      imageUrl: `https://example.com/worklazy-sample/${name}.svg`, promotionUrl: `https://example.com/#sample-${index + 1}`,
    })),
  };
  const rendered = renderBanner(model);
  // Replace only these trusted, fixed image attributes after normal rendering.
  // User URLs still pass the unchanged HTTPS validation in the real exporter.
  let markup = rendered.markup;
  for (const name of names) {
    const local = new URL(`${import.meta.env.BASE_URL}product-banner-samples/${name}.svg`, window.location.href).href;
    markup = markup.replace(`src="https://example.com/worklazy-sample/${name}.svg"`, `src="${escapeHtml(local)}"`);
  }
  return { document: `<!doctype html><html lang="${settings.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${rendered.css}</style></head><body>${markup}<script>${runtime}</script></body></html>`, height: defaultFrameHeight(model) };
}
