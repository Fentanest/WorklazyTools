import { useState, type FormEvent } from "react";
import { UtilityInput } from "../../components/UtilitySurface";
import { Button } from "../../components/ui/button";
import type { ImageT } from "./ImageViews.tsx";
import { REGION_PRESETS, regionPreset } from "./regionOptions.ts";
import { addPreset, customDefault, deletePreset, matchingPreset, presetNameError, readCustomPresets, readDefaultPreset, renamePreset, sameRegionOptions, updatePresetOptions, writeRegionPresets, REGION_PRESET_LIMITS, type CustomRegionPreset, type DefaultRegionPreset, type PresetNameError } from "./regionPresets.ts";
import type { RegionOptions } from "./types.ts";

/** Built-in and saved region presets: apply, save the current values, and manage (default, rename, update, delete). */
export function RegionPresetBar({ width, height, options, disabled, t, onApply }: { width: number; height: number; options: RegionOptions; disabled: boolean; t: ImageT; onApply: (options: RegionOptions, gesture: string) => void }) {
  const [state, setState] = useState(() => { const presets = readCustomPresets(); return { presets, defaultPreset: readDefaultPreset(presets) }; });
  const [saving, setSaving] = useState<string>(), [managing, setManaging] = useState(false), [renaming, setRenaming] = useState<{ from: string; to: string }>(), [error, setError] = useState<PresetNameError>();
  const { presets, defaultPreset } = state, current = matchingPreset(options, presets, width, height);
  const commit = (next: CustomRegionPreset[], nextDefault: DefaultRegionPreset) => { setState({ presets: next, defaultPreset: nextDefault }); writeRegionPresets(next, nextDefault); };
  const save = (event: FormEvent) => {
    event.preventDefault(); if (saving === undefined) return;
    const problem = presetNameError(saving, presets); if (problem) { setError(problem); return; }
    commit(addPreset(presets, saving, options), defaultPreset); setSaving(undefined); setError(undefined);
  };
  const rename = (event: FormEvent) => {
    event.preventDefault(); if (!renaming) return;
    const problem = presetNameError(renaming.to, presets, renaming.from); if (problem) { setError(problem); return; }
    const next = renamePreset(presets, defaultPreset, renaming.from, renaming.to); commit(next.presets, next.defaultPreset); setRenaming(undefined); setError(undefined);
  };
  const tag = (id: DefaultRegionPreset) => id === defaultPreset ? ` · ${t("regions.presets.currentDefault")}` : "";
  return <div className="my-2" data-testid="image-region-preset-bar">
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("regions.presets.title")} data-testid="image-region-presets"><span className="text-sm">{t("regions.presets.title")}</span>
      {REGION_PRESETS.map(id => <Button key={id} type="button" variant={current === id ? "secondary" : "outline"} aria-pressed={current === id} className="rounded-xl" data-region-preset={id} disabled={disabled} onClick={() => onApply(regionPreset(id, width, height), `region-preset-${id}`)}>{t(`regions.presets.${id}`)}{defaultPreset === id ? " ★" : ""}</Button>)}
      {presets.map(preset => <Button key={preset.name} type="button" variant={current === customDefault(preset.name) ? "secondary" : "outline"} aria-pressed={current === customDefault(preset.name)} className="rounded-xl" data-region-custom={preset.name} disabled={disabled} onClick={() => onApply({ ...preset.options }, "region-preset-custom")}>{preset.name}{defaultPreset === customDefault(preset.name) ? " ★" : ""}</Button>)}
      {!current && saving === undefined && <Button type="button" variant="ghost" data-testid="image-region-preset-save" disabled={presets.length >= REGION_PRESET_LIMITS.count} onClick={() => { setSaving(""); setError(undefined); }}>{t("regions.presets.save")}</Button>}
      <Button type="button" variant="ghost" aria-expanded={managing} data-testid="image-region-preset-manage" onClick={() => { setManaging(value => !value); setRenaming(undefined); setError(undefined); }}>{t(managing ? "regions.presets.done" : "regions.presets.manage")}</Button>
    </div>
    {saving !== undefined && <form className="my-2 flex flex-wrap items-end gap-2" onSubmit={save} data-testid="image-region-preset-save-form">
      <label className="grid gap-1 text-sm">{t("regions.presets.name")}<UtilityInput autoFocus value={saving} maxLength={REGION_PRESET_LIMITS.nameLength} placeholder={t("regions.presets.namePlaceholder")} onChange={event => { setSaving(event.target.value); setError(undefined); }} /></label>
      <Button type="submit">{t("regions.presets.confirmSave")}</Button><Button type="button" variant="secondary" onClick={() => { setSaving(undefined); setError(undefined); }}>{t("regions.presets.cancel")}</Button></form>}
    {error && <p role="alert" className="text-sm text-destructive" data-testid="image-region-preset-error">{t(`regions.presets.errors.${error}`, { count: REGION_PRESET_LIMITS.count, length: REGION_PRESET_LIMITS.nameLength })}</p>}
    {managing && <div className="my-2 rounded-xl border border-border p-2 text-sm" data-testid="image-region-preset-list">
      <p className="mb-2 text-xs text-muted-foreground">{t("regions.presets.storedHere")}</p>
      <ul className="grid gap-2">
        {REGION_PRESETS.map(id => <li key={id} className="flex flex-wrap items-center gap-2" data-preset-row={id}><span className="font-medium">{t(`regions.presets.${id}`)}</span><span className="text-xs text-muted-foreground">{t("regions.presets.builtIn")}{tag(id)}</span>
          <Button type="button" size="sm" variant="outline" disabled={defaultPreset === id} onClick={() => commit(presets, id)}>{t("regions.presets.makeDefault")}</Button></li>)}
        {presets.map(preset => { const id = customDefault(preset.name); return <li key={preset.name} className="flex flex-wrap items-center gap-2" data-preset-row={id}>
          {renaming?.from === preset.name ? <form className="flex flex-wrap items-center gap-2" onSubmit={rename}><UtilityInput autoFocus aria-label={t("regions.presets.rename")} value={renaming.to} maxLength={REGION_PRESET_LIMITS.nameLength} onChange={event => { setRenaming({ from: preset.name, to: event.target.value }); setError(undefined); }} onKeyDown={event => { if (event.key === "Escape") { setRenaming(undefined); setError(undefined); } }} /><Button type="submit" size="sm">{t("regions.presets.confirmRename")}</Button><Button type="button" size="sm" variant="secondary" onClick={() => { setRenaming(undefined); setError(undefined); }}>{t("regions.presets.cancel")}</Button></form>
            : <span className="font-medium">{preset.name}</span>}
          <span className="text-xs text-muted-foreground">{t("regions.presets.saved")}{tag(id)}</span>
          <Button type="button" size="sm" variant="outline" disabled={defaultPreset === id} onClick={() => commit(presets, id)}>{t("regions.presets.makeDefault")}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setRenaming({ from: preset.name, to: preset.name }); setError(undefined); }}>{t("regions.presets.rename")}</Button>
          <Button type="button" size="sm" variant="outline" disabled={sameRegionOptions(preset.options, options)} data-preset-update={preset.name} onClick={() => commit(updatePresetOptions(presets, preset.name, options), defaultPreset)}>{t("regions.presets.update")}</Button>
          <Button type="button" size="sm" variant="outline" className="text-destructive" data-preset-delete={preset.name} onClick={() => { const next = deletePreset(presets, defaultPreset, preset.name); commit(next.presets, next.defaultPreset); }}>{t("regions.presets.delete")}</Button>
        </li>; })}
      </ul>
      {defaultPreset && <Button type="button" size="sm" variant="ghost" className="mt-2" data-testid="image-region-preset-clear-default" onClick={() => commit(presets, null)}>{t("regions.presets.clearDefault")}</Button>}
    </div>}
  </div>;
}
