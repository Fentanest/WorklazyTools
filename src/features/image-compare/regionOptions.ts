import type {RegionOptions} from './types.ts';
export type RegionPresetId = "tiny" | "words" | "graphics";
export const REGION_PRESETS: readonly RegionPresetId[] = ["tiny", "words", "graphics"];
/** Diffchecker's built-in presets in original-image units, scaled by e = image diagonal / 425. */
export function regionPreset(id: RegionPresetId, width: number, height: number): RegionOptions {
  const e = Math.hypot(width, height) / 425, clamp = (value: number, low: number, high: number) => Math.round(Math.min(high, Math.max(low, value)));
  if (id === "tiny") return { diffThreshold: 80, groupingRadius: 0, minArea: 2, maxAreaFraction: 0.01 };
  if (id === "words") return { diffThreshold: 20, groupingRadius: clamp(4 * e, 2, 12), minArea: clamp(30 * e, 15, 300), maxAreaFraction: 0.15 };
  return { diffThreshold: 25, groupingRadius: clamp(10 * e, 5, 25), minArea: clamp(200 * e, 100, 2000), maxAreaFraction: 0.5 };
}
/** Inputs are original-image units; outputs are the actual working-pixel scan parameters. */
export function effectiveRegionOptions(options:RegionOptions,scale:number):RegionOptions{
 if(!Number.isFinite(scale)||scale<=0||scale>1||!Number.isInteger(options.diffThreshold)||options.diffThreshold<0||options.diffThreshold>255||!Number.isInteger(options.groupingRadius)||options.groupingRadius<0||options.groupingRadius>32||!Number.isFinite(options.minArea)||options.minArea<0||!Number.isFinite(options.maxAreaFraction)||options.maxAreaFraction<=0||options.maxAreaFraction>1)throw new Error('INVALID_REGION_OPTIONS');
 if(scale===1)return {...options};
 return {...options,groupingRadius:options.groupingRadius===0?0:Math.max(1,Math.round(options.groupingRadius*scale)),minArea:options.minArea===0?0:Math.max(1,Math.round(options.minArea*scale*scale))};
}
