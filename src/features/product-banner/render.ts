import type { BannerDisplayModel, DisplayProduct } from "./displayModel.ts";
import { validateSettings } from "./settings.ts";
import { validateProductUrl } from "./urlPolicy.ts";
import { bannerCss } from "./styles.ts";

const escape = (value: string) => value.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const bannerLabels = {
  ko: { ad: "광고", source: "배너 제작 · worklazy.net", credit: "이 배너는 worklazy.net의 무료 배너 생성기로 만들었습니다.",
    previous: "이전 상품", next: "다음 상품", pause: "일시정지", play: "자동 넘김 재생", visit: "상품 보기", image: "사진을 불러올 수 없습니다", file: "파일 기준 정보", region: "상품 배너" },
  en: { ad: "Ad", source: "Made with worklazy.net", credit: "This banner was made with the free banner generator at worklazy.net.",
    previous: "Previous products", next: "Next products", pause: "Pause", play: "Play automatic rotation", visit: "View product", image: "Image unavailable", file: "Information from the file", region: "Product banner" },
} as const;

/** Only the display boundary is accepted; no editor state or export document is assembled here. */
export function renderBanner(model: BannerDisplayModel): Readonly<{ markup: string; css: string }> {
  const s = validateSettings(model.settings), labels = bannerLabels[s.language];
  const configuredSite = import.meta.env?.VITE_SITE_URL || "https://worklazy.net/";
  if (!validateProductUrl(configuredSite).valid) throw new Error("INVALID_SITE_URL");
  const source = new URL(`/${s.language}/tools/product-banner/`, configuredSite).href;
  const defaults = { background: "#ffffff", text: "#172033", accent: "#2563eb", border: "#d5dbe5" };
  const dark = { background: "#151d2c", text: "#f1f5f9", accent: "#93c5fd", border: "#475569" };
  const variables = Object.entries(s.colors).flatMap(([key, value]) => [
    `--wlpb-${key}:${value}`, `--wlpb-dark-${key}:${value.toLowerCase() === defaults[key as keyof typeof defaults] ? dark[key as keyof typeof dark] : value}`,
  ]).concat([`--wlpb-width:${s.width}px`, `--wlpb-image-height:${s.imageHeight}px`, `--wlpb-count:${s.visibleCount}`, `--wlpb-total:${Math.max(1, model.products.length)}`, `--wlpb-grid-columns:${s.gridColumns}`, `--wlpb-rows:${s.gridRows}`]).join(";");
  const link = (p: DisplayProduct, content: string, extra = "") => {
    if (!validateProductUrl(p.promotionUrl).valid || !validateProductUrl(p.imageUrl).valid) throw new Error("INVALID_PRODUCT_URL");
    return `<a class="wlpb-v1-link" href="${escape(p.promotionUrl)}" target="_blank" rel="sponsored noopener" draggable="false" ${extra}>${content}</a>`;
  };
  const items = model.products.map((p, i) => {
    const image = `<span class="wlpb-v1-photo"><img class="wlpb-v1-img" src="${escape(p.imageUrl)}" alt="${escape(p.accessibleName)}" loading="lazy" decoding="async" draggable="false"><span class="wlpb-v1-fallback" hidden>${labels.image}</span></span>`;
    const prices = s.showPrice && p.prices ? `<span class="wlpb-v1-prices">${p.prices.original ? `<span${p.prices.sale ? ' class="wlpb-v1-original"' : ""}>${escape(p.prices.original.currency)} ${escape(p.prices.original.text)}</span>` : ""}${p.prices.sale ? `<strong>${escape(p.prices.sale.currency)} ${escape(p.prices.sale.text)}</strong>` : ""}</span>` : "";
    const details = `<span class="wlpb-v1-details">${s.showName ? `<span class="wlpb-v1-name">${escape(p.name || p.accessibleName)}</span>` : ""}${prices}${s.showDiscount && p.discount ? `<span class="wlpb-v1-discount">${escape(p.discount)}</span>` : ""}</span>`;
    // Image/title and optional CTA are sibling links, never nested anchors.
    return `<li class="wlpb-v1-item" data-wlpb-index="${i}">${link(p, image + details, `aria-label="${escape(p.accessibleName)}"`)}${s.showButton ? link(p, labels.visit, `aria-label="${escape(`${labels.visit}: ${p.accessibleName}`)}" data-wlpb-cta`) : ""}</li>`;
  }).join("");
  const button = (action: string, label: string, text: string) => `<button class="wlpb-v1-control" type="button" data-wlpb-action="${action}" aria-label="${label}">${text}</button>`;
  return { css: bannerCss, markup: `<section class="wlpb-v1-root wlpb-v1-${s.design}" data-wlpb-root="1" data-wlpb-theme="${s.theme}" data-wlpb-design="${s.design}" data-wlpb-count="${s.visibleCount}" data-wlpb-rows="${s.gridRows}" data-wlpb-auto="${s.autoPlay}" data-wlpb-interval="${s.intervalSeconds}" data-wlpb-move="${s.moveBy}" style="${variables}" aria-label="${labels.region}">
<div class="wlpb-v1-layout"><ul class="wlpb-v1-list">${items}</ul></div>
<div class="wlpb-v1-controls" hidden>${button("previous", labels.previous, "‹")}${button("pause", labels.pause, labels.pause)}${button("next", labels.next, "›")}<span class="wlpb-v1-status" aria-live="off"></span></div>
<footer class="wlpb-v1-footer"><span class="wlpb-v1-ad">${labels.ad}</span>${s.affiliateNotice ? `<span class="wlpb-v1-notice">${escape(s.affiliateNotice)}</span>` : ""}${model.fileBasedInformation ? `<span class="wlpb-v1-notice">${labels.file}</span>` : ""}<a class="wlpb-v1-source" href="${escape(source)}" target="_blank" rel="nofollow noopener" title="${labels.credit}" aria-label="${labels.credit}">${labels.source}</a></footer>
</section>` };
}
