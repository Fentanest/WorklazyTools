import { BannerStateError, DESIGN_IDS, type BannerLanguage, type BannerSettings, type DesignId } from "./stateTypes.ts";
import { boolean, integer, oneOf, record, string } from "./stateValidation.ts";

export const SETTING_RANGES = {
  visibleCount: [1, 12], width: [320, 2560], imageHeight: [48, 600], gridColumns: [1, 6], gridRows: [1, 10],
  intervalSeconds: [2, 60], iframeHeight: [120, 2400],
} as const;
export const DEFAULT_AFFILIATE_NOTICES = {
  ko: "이 배너의 상품 링크를 통해 구매하면 게시자에게 수수료가 지급될 수 있습니다.",
  en: "The publisher may earn a commission if you purchase through product links in this banner.",
} as const;
const layoutDefaults = {
  "photo-strip": { visibleCount: 4, imageHeight: 160, showName: false, showButton: false, autoPlay: true, iframeHeight: 300 },
  "product-card": { visibleCount: 3, imageHeight: 180, showName: true, showButton: false, autoPlay: true, iframeHeight: 420 },
  slim: { visibleCount: 1, imageHeight: 64, showName: true, showButton: false, autoPlay: true, iframeHeight: 200 },
  vertical: { visibleCount: 4, imageHeight: 80, showName: true, showButton: false, autoPlay: false, iframeHeight: 600 },
  grid: { visibleCount: 4, imageHeight: 160, showName: true, showButton: false, autoPlay: false, iframeHeight: 600 },
} as const;
export function createDefaultSettings(language: BannerLanguage, design: DesignId = "photo-strip"): BannerSettings {
  return validateSettings({ design, ...layoutDefaults[design], width: 1030, gridPreset: "2x2", gridColumns: 2, gridRows: 2,
    showPrice: false, showDiscount: false, colors: { background: "#ffffff", text: "#172033", accent: "#2563eb", border: "#d5dbe5" },
    theme: "auto", intervalSeconds: 5, moveBy: "one", language, advertisingLabel: true,
    affiliateNotice: DEFAULT_AFFILIATE_NOTICES[language], autoHeight: false });
}
/** Reject invalid types/ranges. Only documented layout constraints are corrected. Unknown fields are discarded. */
export function validateSettings(value: unknown): BannerSettings {
  try {
    const v = record(value), colors = record(v.colors);
    const size = (key: keyof typeof SETTING_RANGES) => integer(v[key], ...SETTING_RANGES[key]);
    const color = (key: string) => { const text = string(colors[key]); if (!/^#[\da-f]{6}$/iu.test(text)) throw new BannerStateError("INVALID_SETTING"); return text; };
    const design = oneOf(v.design, DESIGN_IDS), gridPreset = oneOf(v.gridPreset, ["2x2", "3x2", "custom"]);
    const visibleCount = size("visibleCount"), gridColumns = size("gridColumns"), gridRows = size("gridRows");
    const autoPlay = boolean(v.autoPlay);
    if (v.advertisingLabel !== true) throw new BannerStateError("INVALID_SETTING");
    return { design, visibleCount: design === "slim" ? 1 : visibleCount, width: size("width"), imageHeight: size("imageHeight"),
      gridPreset, gridColumns: gridPreset === "custom" ? gridColumns : gridPreset === "2x2" ? 2 : 3,
      gridRows: gridPreset === "custom" ? gridRows : 2,
      showName: boolean(v.showName), showPrice: boolean(v.showPrice), showDiscount: boolean(v.showDiscount), showButton: boolean(v.showButton),
      colors: { background: color("background"), text: color("text"), accent: color("accent"), border: color("border") },
      theme: oneOf(v.theme, ["light", "dark", "auto"]), autoPlay: design === "vertical" || design === "grid" ? false : autoPlay,
      intervalSeconds: size("intervalSeconds"), moveBy: oneOf(v.moveBy, ["one", "page"]), language: oneOf(v.language, ["ko", "en"]),
      advertisingLabel: true, affiliateNotice: string(v.affiliateNotice), iframeHeight: size("iframeHeight"), autoHeight: boolean(v.autoHeight) };
  } catch (error) {
    if (error instanceof BannerStateError && error.code === "PROJECT_LIMIT") throw error;
    throw new BannerStateError("INVALID_SETTING");
  }
}
export type SettingsPatch = Partial<Omit<BannerSettings, "colors">> & { colors?: Partial<BannerSettings["colors"]> };
export function updateSettings(current: BannerSettings, patch: SettingsPatch): BannerSettings {
  // Switching designs applies that design's layout defaults, leaving publisher text/theme/price choices intact.
  const layout = patch.design && patch.design !== current.design ? layoutDefaults[oneOf(patch.design, DESIGN_IDS)] : {};
  const notice = patch.language && patch.language !== current.language && current.affiliateNotice === DEFAULT_AFFILIATE_NOTICES[current.language]
    ? DEFAULT_AFFILIATE_NOTICES[oneOf(patch.language, ["ko", "en"])] : current.affiliateNotice;
  return validateSettings({ ...current, ...layout, affiliateNotice: notice, ...patch, colors: { ...current.colors, ...patch.colors } });
}
