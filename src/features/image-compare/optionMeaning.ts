import type {PixelOptions} from './types.ts';
export function pixelOptionMeaning(options:PixelOptions){
  const {alphaThreshold,...common}=options;
  return {requested:{...options},applied:options.background==='transparent'?{...options}:common,inactive:options.background==='transparent'?[]:['alphaThreshold']} as const;
}
