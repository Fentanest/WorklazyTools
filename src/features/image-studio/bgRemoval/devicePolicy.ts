export interface BgDeviceSignals {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  deviceMemory?: number;
}
export type ProductDeviceRestriction = 'low-memory';
export type ProductDeviceWarning = 'ios-webkit';

const currentDevice = (): BgDeviceSignals => typeof navigator === 'undefined' ? {} : navigator;
/** deviceMemory is a reported approximate bucket, not free RAM. Missing RAM is unknown. */
export function productDeviceRestriction(signals: BgDeviceSignals = currentDevice()): ProductDeviceRestriction | undefined {
  const memory = signals.deviceMemory;
  return typeof memory === 'number' && Number.isFinite(memory) && memory > 0 && memory <= 4 ? 'low-memory' : undefined;
}
/** iOS alone warns; it is not evidence that every iPhone/iPad has insufficient RAM. */
export function productDeviceWarning(signals: BgDeviceSignals = currentDevice()): ProductDeviceWarning | undefined {
  if (productDeviceRestriction(signals)) return undefined; // the explicit memory block takes precedence
  const ua = signals.userAgent ?? '';
  const appleMobile = /iPhone|iPad|iPod/i.test(ua) ||
    ((/Mac/i.test(signals.platform ?? '') || /Macintosh/i.test(ua)) && (signals.maxTouchPoints ?? 0) > 1);
  return appleMobile && /AppleWebKit\//i.test(ua) ? 'ios-webkit' : undefined;
}
