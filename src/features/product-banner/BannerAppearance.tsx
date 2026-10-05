import { UtilityField, UtilityInput, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { DESIGN_IDS, type BannerSettings } from "./stateTypes";
import { SETTING_RANGES, type SettingsPatch } from "./settings";
import type { BannerUiText } from "./uiMessages";

export function BannerAppearance({ settings: s, update, text }: { settings: BannerSettings; update: (patch: SettingsPatch) => void; text: BannerUiText }) {
  return <div className="space-y-4">
    <UtilityField><span>{text.design}</span><UtilitySelect aria-label={text.design} value={s.design} onChange={(e) => update({ design: e.target.value as BannerSettings["design"] })}>{DESIGN_IDS.map((id, i) => <option key={id} value={id}>{text.designs[i]}</option>)}</UtilitySelect></UtilityField>
    <UtilityField><span>{text.width}</span><UtilityInput type="number" min={320} max={2560} value={s.width} onChange={(e) => { const width = e.target.valueAsNumber; if (Number.isInteger(width) && width >= 320 && width <= 2560) update({ width }); }} /></UtilityField>
    <UtilityField><span>{text.theme}</span><UtilitySelect aria-label={text.theme} value={s.theme} onChange={(e) => update({ theme: e.target.value as BannerSettings["theme"] })}>{["light", "dark", "auto"].map((id, i) => <option key={id} value={id}>{text.themes[i]}</option>)}</UtilitySelect></UtilityField>
    <UtilityField><span>{text.language}</span><UtilitySelect aria-label={text.language} value={s.language} onChange={(e) => update({ language: e.target.value as BannerSettings["language"] })}><option value="ko">한국어</option><option value="en">English</option></UtilitySelect></UtilityField>
    <label className="flex items-center gap-2"><input type="checkbox" checked={s.autoPlay} disabled={s.design === "vertical" || s.design === "grid"} onChange={(e) => update({ autoPlay: e.target.checked })} />{text.play}</label>
    <details><summary className="cursor-pointer">{text.advanced}</summary><div className="mt-4 space-y-4">
      {(["visibleCount", "imageHeight", "intervalSeconds", "gridColumns", "gridRows"] as const).map((key) => <UtilityField key={key}><span>{text.controls[key]}</span><UtilityInput type="number" min={SETTING_RANGES[key][0]} max={SETTING_RANGES[key][1]} value={s[key]} disabled={(key === "visibleCount" && s.design === "slim") || ((key === "gridColumns" || key === "gridRows") && s.gridPreset !== "custom")} onChange={(e) => { const value = e.target.valueAsNumber; if (Number.isInteger(value) && value >= SETTING_RANGES[key][0] && value <= SETTING_RANGES[key][1]) update({ [key]: value }); }} /></UtilityField>)}
      <UtilityField><span>{text.controls.gridPreset}</span><UtilitySelect value={s.gridPreset} onChange={(e) => update({ gridPreset: e.target.value as BannerSettings["gridPreset"] })}><option value="2x2">2 × 2</option><option value="3x2">3 × 2</option><option value="custom">{text.controls.custom}</option></UtilitySelect></UtilityField>
      <UtilityField><span>{text.controls.moveBy}</span><UtilitySelect value={s.moveBy} onChange={(e) => update({ moveBy: e.target.value as BannerSettings["moveBy"] })}><option value="one">{text.controls.one}</option><option value="page">{text.controls.page}</option></UtilitySelect></UtilityField>
      {(["showName", "showPrice", "showDiscount", "showButton"] as const).map((key) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={s[key]} onChange={(e) => update({ [key]: e.target.checked })} />{text.controls[key]}</label>)}
      {(["background", "text", "accent", "border"] as const).map((key) => <UtilityField key={key}><span>{text.controls[key]}</span><UtilityInput type="color" value={s.colors[key]} onChange={(e) => update({ colors: { [key]: e.target.value } })} /></UtilityField>)}
      <UtilityField><span>{text.height}</span><UtilityInput type="number" min={120} max={2400} value={s.iframeHeight} onChange={(e) => { const height = e.target.valueAsNumber; if (Number.isInteger(height) && height >= 120 && height <= 2400) update({ iframeHeight: height }); }} /></UtilityField>
      <label className="flex items-center gap-2"><input type="checkbox" checked={s.autoHeight} onChange={(e) => update({ autoHeight: e.target.checked })} />{text.autoHeight}</label>
      <UtilityField><span>{text.notice}</span><UtilityTextarea value={s.affiliateNotice} maxLength={4096} onChange={(e) => update({ affiliateNotice: e.target.value })} /></UtilityField>
      {!s.affiliateNotice.trim() && <p role="status" className="text-destructive">{text.noticeWarning}</p>}
    </div></details>
  </div>;
}
