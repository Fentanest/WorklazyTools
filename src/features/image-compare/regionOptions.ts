import type {RegionOptions} from './types.ts';
/** Inputs are original-image units; outputs are the actual working-pixel scan parameters. */
export function effectiveRegionOptions(options:RegionOptions,scale:number):RegionOptions{
 if(!Number.isFinite(scale)||scale<=0||scale>1||!Number.isInteger(options.diffThreshold)||options.diffThreshold<0||options.diffThreshold>255||!Number.isInteger(options.groupingRadius)||options.groupingRadius<0||options.groupingRadius>32||!Number.isFinite(options.minArea)||options.minArea<0||!Number.isFinite(options.maxAreaFraction)||options.maxAreaFraction<=0||options.maxAreaFraction>1)throw new Error('INVALID_REGION_OPTIONS');
 if(scale===1)return {...options};
 return {...options,groupingRadius:options.groupingRadius===0?0:Math.max(1,Math.round(options.groupingRadius*scale)),minArea:options.minArea===0?0:Math.max(1,Math.round(options.minArea*scale*scale))};
}
