import { useId, useState } from "react";
import { UtilityField, UtilityInput, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { DESIGN_IDS, type BannerSettings } from "./stateTypes";
import { SETTING_RANGES, type SettingsPatch } from "./settings";
import type { BannerUiText } from "./uiMessages";

/** Keep incomplete keyboard input separate from the validated project settings. */
function NumericSettingInput({ value, min, max, disabled, update, hint, label }: { value: number; min: number; max: number; disabled?: boolean; update: (value: number) => void; hint: string; label: string }) {
  const [edit, setEdit] = useState({ value, draft: String(value) });
  const hintId = useId();
  // Undo, JSON loads and design defaults can replace the committed value externally.
  if (edit.value !== value) setEdit({ value, draft: String(value) });
  const draft = edit.value === value ? edit.draft : String(value);
  const number = draft.trim() ? Number(draft) : NaN;
  const valid = Number.isInteger(number) && number >= min && number <= max;
  return <>
    <UtilityInput aria-label={label} type="number" inputMode="numeric" step={1} min={min} max={max} disabled={disabled} value={draft} aria-invalid={!valid} aria-describedby={!valid ? hintId : undefined}
      onChange={(e) => {
        const draft = e.target.value, number = e.target.valueAsNumber;
        const valid = Number.isInteger(number) && number >= min && number <= max;
        setEdit({ value: valid ? number : value, draft });
        if (valid) update(number);
      }}
      onBlur={() => setEdit({ value, draft: String(value) })} />
    {!valid && <span id={hintId} role="status" className="text-sm font-normal text-destructive">{hint.replace("{min}", String(min)).replace("{max}", String(max))}</span>}
  </>;
}

export function BannerAppearance({ settings: s, update, text }: { settings: BannerSettings; update: (patch: SettingsPatch) => void; text: BannerUiText }) {
  return <div className="space-y-4">
    <UtilityField><span>{text.design}</span><UtilitySelect aria-label={text.design} value={s.design} onChange={(e) => update({ design: e.target.value as BannerSettings["design"] })}>{DESIGN_IDS.map((id, i) => <option key={id} value={id}>{text.designs[i]}</option>)}</UtilitySelect></UtilityField>
    <UtilityField><span>{text.width}</span><NumericSettingInput min={SETTING_RANGES.width[0]} max={SETTING_RANGES.width[1]} value={s.width} update={(width) => update({ width })} hint={text.numberHint} label={text.width} /></UtilityField>
    <UtilityField><span>{text.theme}</span><UtilitySelect aria-label={text.theme} value={s.theme} onChange={(e) => update({ theme: e.target.value as BannerSettings["theme"] })}>{["light", "dark", "auto"].map((id, i) => <option key={id} value={id}>{text.themes[i]}</option>)}</UtilitySelect></UtilityField>
    <UtilityField><span>{text.language}</span><UtilitySelect aria-label={text.language} value={s.language} onChange={(e) => update({ language: e.target.value as BannerSettings["language"] })}><option value="ko">한국어</option><option value="en">English</option></UtilitySelect></UtilityField>
    <label className="flex items-center gap-2"><input type="checkbox" checked={s.autoPlay} disabled={s.design === "vertical" || s.design === "grid"} onChange={(e) => update({ autoPlay: e.target.checked })} />{text.play}</label>
    <details><summary className="cursor-pointer">{text.advanced}</summary><div className="mt-4 space-y-4">
      {(["visibleCount", "imageHeight", "intervalSeconds", "gridColumns", "gridRows"] as const).map((key) => <UtilityField key={key}><span>{text.controls[key]}</span><NumericSettingInput min={SETTING_RANGES[key][0]} max={SETTING_RANGES[key][1]} value={s[key]} disabled={(key === "visibleCount" && s.design === "slim") || ((key === "gridColumns" || key === "gridRows") && s.gridPreset !== "custom")} update={(value) => update({ [key]: value })} hint={text.numberHint} label={text.controls[key]} /></UtilityField>)}
      <UtilityField><span>{text.controls.gridPreset}</span><UtilitySelect aria-label={text.controls.gridPreset} value={s.gridPreset} onChange={(e) => update({ gridPreset: e.target.value as BannerSettings["gridPreset"] })}><option value="2x2">2 × 2</option><option value="3x2">3 × 2</option><option value="custom">{text.controls.custom}</option></UtilitySelect></UtilityField>
      <UtilityField><span>{text.controls.moveBy}</span><UtilitySelect aria-label={text.controls.moveBy} value={s.moveBy} onChange={(e) => update({ moveBy: e.target.value as BannerSettings["moveBy"] })}><option value="one">{text.controls.one}</option><option value="page">{text.controls.page}</option></UtilitySelect></UtilityField>
      {(["showName", "showPrice", "showDiscount", "showButton"] as const).map((key) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={s[key]} onChange={(e) => update({ [key]: e.target.checked })} />{text.controls[key]}</label>)}
      {(["background", "text", "accent", "border"] as const).map((key) => <UtilityField key={key}><span>{text.controls[key]}</span><UtilityInput type="color" value={s.colors[key]} onChange={(e) => update({ colors: { [key]: e.target.value } })} /></UtilityField>)}
      <UtilityField><span>{text.height}</span><NumericSettingInput min={SETTING_RANGES.iframeHeight[0]} max={SETTING_RANGES.iframeHeight[1]} value={s.iframeHeight} update={(iframeHeight) => update({ iframeHeight })} hint={text.numberHint} label={text.height} /></UtilityField>
      <label className="flex items-center gap-2"><input type="checkbox" checked={s.autoHeight} onChange={(e) => update({ autoHeight: e.target.checked })} />{text.autoHeight}</label>
      <UtilityField><span>{text.notice}</span><UtilityTextarea value={s.affiliateNotice} maxLength={4096} onChange={(e) => update({ affiliateNotice: e.target.value })} /></UtilityField>
      {!s.affiliateNotice.trim() && <p role="status" className="text-destructive">{text.noticeWarning}</p>}
    </div></details>
  </div>;
}
