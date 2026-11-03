export interface BgDeviceSignals {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  deviceMemory?: number;
}
export type ProductDeviceRestriction = 'ios-webkit' | 'low-memory';

/** deviceMemory is an approximate bucket, not free RAM; Safari does not expose it. */
export function productDeviceRestriction(signals: BgDeviceSignals = typeof navigator === 'undefined' ? {} : navigator): ProductDeviceRestriction | undefined {
  const ua = signals.userAgent ?? '';
  const appleMobile = /iPhone|iPad|iPod/i.test(ua) ||
    ((/Mac/i.test(signals.platform ?? '') || /Macintosh/i.test(ua)) && (signals.maxTouchPoints ?? 0) > 1);
  // Includes iOS browsers/webviews using WebKit and desktop-mode iPadOS.
  // This is a conservative crash mitigation for the platform, not a RAM estimate.
  if (appleMobile && /AppleWebKit\//i.test(ua)) return 'ios-webkit';
  const memory = signals.deviceMemory;
  if (typeof memory === 'number' && Number.isFinite(memory) && memory > 0 && memory <= 4) return 'low-memory';
  return undefined;
}
