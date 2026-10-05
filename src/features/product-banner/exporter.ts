import { createDisplayModel, type BannerDisplayModel } from "./displayModel.ts";
import { renderBanner } from "./render.ts";
import { saveProjectJson } from "./projectJson.ts";
import { escapeHtml, scriptJson, utf8Bytes } from "./serialization.ts";
import type { BannerProject } from "./stateTypes.ts";

export const BANNER_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";
export const OUTPUT_LIMITS = { bytes: 20 * 1024 * 1024, warningBytes: 512 * 1024 } as const;
export type ExportRuntime = Readonly<{ banner: string; heightParent: string }>;
export const exportHelp = {
  ko: { direct: "자동 넘김에는 JavaScript 허용이 필요합니다. 부모 CSS와 충돌할 수 있습니다. 강한 격리에는 iframe을 사용하세요.",
    frame: "iframe은 설정 높이를 사용합니다. 높이를 조절하세요. 더 긴 내용은 내부에서 스크롤합니다. CSP 또는 srcdoc 필터링으로 표시가 제한될 수 있습니다.",
    auto: "높이 자동 맞춤 — 보조 스크립트 포함. 스크립트가 차단되면 설정 높이를 사용합니다.",
    images: "상품 사진은 원격 주소를 참조하며 오프라인 표시를 보장하지 않습니다.", large: "상품 수, 긴 텍스트 및 중첩 srcdoc의 문자 변환으로 출력이 커집니다. 상품은 자동으로 줄이지 않습니다." },
  en: { direct: "Automatic rotation requires JavaScript. Host CSS can conflict; use an iframe for stronger isolation.",
    frame: "The iframe uses the configured height. Adjust it as needed; taller content scrolls inside. CSP or srcdoc filtering can restrict display.",
    auto: "Automatic height — includes a helper script. If scripts are blocked, the configured height remains.",
    images: "Product images use remote URLs; offline images are not guaranteed.", large: "Product count, long text and nested srcdoc escaping increase output size. Products are never silently removed." },
} as const;

/** Reserve space at 320px for wrapped footer text, controls and the configured visible rows. */
export function defaultFrameHeight(model: BannerDisplayModel): number {
  const s = model.settings;
  const details = (s.showName ? 50 : 0) + (s.showPrice ? 50 : 0) + (s.showDiscount ? 25 : 0);
  const card = s.imageHeight + details + (s.showButton ? 60 : 0) + 40;
  const row = ["slim", "vertical"].includes(s.design) ? Math.max(s.imageHeight, details, s.showButton ? 60 : 0) + 24 : card;
  const rows = s.design === "vertical" ? Math.min(model.products.length, s.visibleCount) : s.design === "grid" ? Math.min(model.products.length, s.gridRows) : 1;
  const footer = 100 + Math.ceil(s.affiliateNotice.length / 24) * 18 + (model.fileBasedInformation ? 36 : 0);
  return Math.min(2400, Math.max(s.iframeHeight, Math.ceil(row * rows + footer + 90)));
}

/** Dependencies are checked in executable assets, not in legitimate publisher text/URLs. */
export function assertExportRuntime(source: string): void {
  if (typeof source !== "string" || !source.trim() || /react|xlsx|gtag|googletagmanager|adsbygoogle|coupang|naver[\s._-]*wcs|blob:|<\/script|<!--|\bimport\s|\bimport\s*\(|\b(?:fetch|eval)\s*\(|new\s+Function|XMLHttpRequest|sendBeacon/iu.test(source)) throw new Error("INVALID_EXPORT_RUNTIME");
}

/** UI owns clipboard/download gestures; all four output contents and byte counts come from here. */
export function exportBanner(project: BannerProject, runtime: ExportRuntime, options: { height?: number; parentOrigin?: string } = {}) {
  assertExportRuntime(runtime.banner); assertExportRuntime(runtime.heightParent);
  const model = createDisplayModel(project), s = model.settings, help = exportHelp[s.language];
  const { markup, css } = renderBanner(model);
  // CSS values have already passed validateSettings; neither raw CSS nor raw scripts are accepted from a project.
  const html = `<style>${css}</style>${markup}<script>${runtime.banner}</script>`;
  // Reject before nesting/escaping an already oversized document, avoiding needless allocations.
  if (utf8Bytes(html) > OUTPUT_LIMITS.bytes) throw new Error("EXPORT_SIZE_LIMIT");
  const documentFor = (auto: boolean) => `<!doctype html><html lang="${s.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s.language === "ko" ? "알리익스프레스 광고 배너 만들기" : "AliExpress Ad Banner Builder"}</title><style>body{margin:0}</style></head><body>${auto ? `<script type="application/json" data-wlpb-frame-config>${scriptJson({ parentOrigin: options.parentOrigin || "" })}</script>` : ""}${html}</body></html>`;
  if (options.parentOrigin && (!/^https:\/\//u.test(options.parentOrigin) || new URL(options.parentOrigin).origin !== options.parentOrigin)) throw new Error("INVALID_PARENT_ORIGIN");
  const height = options.height ?? defaultFrameHeight(model);
  if (!Number.isInteger(height) || height < 120 || height > 2400) throw new Error("INVALID_IFRAME_HEIGHT");
  const frame = `<iframe data-wlpb-frame title="${s.language === "ko" ? "알리익스프레스 광고 배너 만들기" : "AliExpress Ad Banner Builder"}" width="100%" height="${height}" loading="lazy" style="border:0" sandbox="${BANNER_SANDBOX}" srcdoc="${escapeHtml(documentFor(s.autoHeight))}">${escapeHtml(help.frame)}</iframe>`;
  const iframe = `<span data-wlpb-embed>${frame}<small>${escapeHtml(s.autoHeight ? help.auto : help.frame)}</small></span>${s.autoHeight ? `<script>${runtime.heightParent}</script>` : ""}`;
  const standalone = documentFor(false), json = saveProjectJson(project);
  const contents = { html, iframe, standalone, json };
  const bytes = Object.fromEntries(Object.entries(contents).map(([key, value]) => [key, utf8Bytes(value)])) as Record<keyof typeof contents, number>;
  if (Object.values(bytes).some((size) => size > OUTPUT_LIMITS.bytes)) throw new Error("EXPORT_SIZE_LIMIT");
  return { ...contents, bytes, height, productCount: model.products.length,
    largeOutput: Object.values(bytes).some((size) => size >= OUTPUT_LIMITS.warningBytes), help };
}
