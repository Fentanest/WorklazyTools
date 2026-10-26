import { REGION_PRESETS, regionPreset, type RegionPresetId } from "./regionOptions.ts";
import type { RegionOptions } from "./types.ts";

/** Saved region-scan presets after Diffchecker 7.3.0 (modules 34050/876/12081): a name and absolute option values
 * (built-ins scale with the image, saved presets do not), names unique ignoring case, a default that is a built-in
 * id or "custom:<name>". Kept in this browser only (localStorage); nothing leaves the device. */
export interface CustomRegionPreset { name: string; options: RegionOptions }
export type DefaultRegionPreset = RegionPresetId | `custom:${string}` | null;
export const REGION_PRESET_LIMITS = Object.freeze({ count: 50, nameLength: 60 });
const PRESETS_KEY = "worklazy.imageRegionPresets", DEFAULT_KEY = "worklazy.imageRegionDefaultPreset", CUSTOM = "custom:";
export type PresetNameError = "empty" | "tooLong" | "taken" | "full";

const key = (name: string) => name.trim().toLowerCase();
/** Option values a preset may hold, as the scan accepts them; anything else is dropped on read. */
export function validRegionOptions(value: unknown): RegionOptions | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { diffThreshold, groupingRadius, minArea, maxAreaFraction } = value as Record<string, unknown>;
  if (!Number.isInteger(diffThreshold) || (diffThreshold as number) < 0 || (diffThreshold as number) > 255) return undefined;
  if (!Number.isInteger(groupingRadius) || (groupingRadius as number) < 0 || (groupingRadius as number) > 32) return undefined;
  if (typeof minArea !== "number" || !Number.isFinite(minArea) || minArea < 0 || minArea > 1e9) return undefined;
  if (typeof maxAreaFraction !== "number" || !Number.isFinite(maxAreaFraction) || maxAreaFraction < 0.001 || maxAreaFraction > 1) return undefined;
  return { diffThreshold: diffThreshold as number, groupingRadius: groupingRadius as number, minArea, maxAreaFraction };
}
/** Two option sets are the same preset when every field differs by less than 1e-4 (Diffchecker's rule). */
export function sameRegionOptions(a: RegionOptions, b: RegionOptions) {
  return (["diffThreshold", "groupingRadius", "minArea", "maxAreaFraction"] as const).every(field => Math.abs(a[field] - b[field]) < 1e-4);
}
export function presetNameError(name: string, presets: readonly CustomRegionPreset[], except?: string): PresetNameError | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "empty";
  if (trimmed.length > REGION_PRESET_LIMITS.nameLength) return "tooLong";
  if (presets.some(preset => key(preset.name) === key(trimmed) && (except === undefined || key(except) !== key(trimmed)))) return "taken";
  if (except === undefined && presets.length >= REGION_PRESET_LIMITS.count) return "full";
  return undefined;
}

function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function readCustomPresets(): CustomRegionPreset[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(PRESETS_KEY) ?? "[]"), seen = new Set<string>(), presets: CustomRegionPreset[] = [];
    if (!Array.isArray(parsed)) return [];
    for (const item of parsed) {
      const name = typeof item?.name === "string" ? item.name.trim() : "", options = validRegionOptions(item?.options);
      if (!name || name.length > REGION_PRESET_LIMITS.nameLength || !options || seen.has(key(name)) || presets.length >= REGION_PRESET_LIMITS.count) continue;
      seen.add(key(name)); presets.push({ name, options });
    }
    return presets;
  } catch { return []; }
}
/** The stored default, matched case-insensitively to a saved name; an unknown name means no default. */
export function readDefaultPreset(presets: readonly CustomRegionPreset[]): DefaultRegionPreset {
  let value: string | null | undefined;
  try { value = storage()?.getItem(DEFAULT_KEY); } catch { value = undefined; }
  return normalizeDefault(value ?? null, presets);
}
export function normalizeDefault(value: string | null, presets: readonly CustomRegionPreset[]): DefaultRegionPreset {
  if (!value) return null;
  if ((REGION_PRESETS as readonly string[]).includes(value)) return value as RegionPresetId;
  const name = value.startsWith(CUSTOM) ? value.slice(CUSTOM.length) : value, match = presets.find(preset => key(preset.name) === key(name));
  return match ? `${CUSTOM}${match.name}` : null;
}
export function writeRegionPresets(presets: readonly CustomRegionPreset[], defaultPreset: DefaultRegionPreset) {
  try { const store = storage(); store?.setItem(PRESETS_KEY, JSON.stringify(presets)); if (defaultPreset) store?.setItem(DEFAULT_KEY, defaultPreset); else store?.removeItem(DEFAULT_KEY); } catch { /* per-viewer convenience only */ }
}

export const customDefault = (name: string): DefaultRegionPreset => `${CUSTOM}${name}`;
export function addPreset(presets: readonly CustomRegionPreset[], name: string, options: RegionOptions) {
  const error = presetNameError(name, presets); if (error) throw new Error(error);
  return [...presets, { name: name.trim(), options: { ...options } }];
}
/** Renaming the default keeps it the default under the new name. */
export function renamePreset(presets: readonly CustomRegionPreset[], defaultPreset: DefaultRegionPreset, from: string, to: string) {
  const error = presetNameError(to, presets, from); if (error) throw new Error(error);
  const next = presets.map(preset => preset.name === from ? { ...preset, name: to.trim() } : preset);
  return { presets: next, defaultPreset: defaultPreset === customDefault(from) ? customDefault(to.trim()) : defaultPreset };
}
/** Deleting the default leaves no default. */
export function deletePreset(presets: readonly CustomRegionPreset[], defaultPreset: DefaultRegionPreset, name: string) {
  return { presets: presets.filter(preset => preset.name !== name), defaultPreset: defaultPreset === customDefault(name) ? null : defaultPreset };
}
export function updatePresetOptions(presets: readonly CustomRegionPreset[], name: string, options: RegionOptions) {
  return presets.map(preset => preset.name === name ? { ...preset, options: { ...options } } : preset);
}
/** Options a default gives for an image of this size; built-ins scale, saved presets are copied. */
export function defaultPresetOptions(defaultPreset: DefaultRegionPreset, presets: readonly CustomRegionPreset[], width: number, height: number): RegionOptions | undefined {
  if (!defaultPreset) return undefined;
  if (!defaultPreset.startsWith(CUSTOM)) return regionPreset(defaultPreset as RegionPresetId, width, height);
  const preset = presets.find(item => item.name === defaultPreset.slice(CUSTOM.length));
  return preset ? { ...preset.options } : undefined;
}
/** Which preset the current values are: a built-in at this size first, then a saved one. */
export function matchingPreset(options: RegionOptions, presets: readonly CustomRegionPreset[], width: number, height: number): DefaultRegionPreset {
  const builtIn = REGION_PRESETS.find(id => sameRegionOptions(options, regionPreset(id, width, height)));
  if (builtIn) return builtIn;
  const saved = presets.find(preset => sameRegionOptions(options, preset.options));
  return saved ? customDefault(saved.name) : null;
}
