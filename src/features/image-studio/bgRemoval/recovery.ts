/** Best-effort, per-tab interruption hint. The only persisted payload is "1". */
export const IOS_PRODUCT_RUN_KEY = 'worklazy-bg-ios-product-running-v1';
type MarkerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class ProductRecoveryMarker {
  private owner?: symbol;
  private acknowledged = false;
  private readonly storage: () => MarkerStorage | undefined;
  constructor(storage: () => MarkerStorage | undefined = () => globalThis.sessionStorage) { this.storage = storage; }

  hasInterrupted(): boolean {
    if (this.owner || this.acknowledged) return false;
    try { return this.storage()?.getItem(IOS_PRODUCT_RUN_KEY) === '1'; }
    catch { return false; }
  }

  /** Acknowledge after rendering, not inside a React state initializer. */
  consume(): boolean {
    if (!this.hasInterrupted()) return false;
    this.acknowledged = true;
    try { this.storage()?.removeItem(IOS_PRODUCT_RUN_KEY); } catch { /* storage is optional */ }
    return true;
  }

  begin(): () => void {
    let storage: MarkerStorage;
    try {
      const candidate = this.storage();
      if (!candidate) return () => {};
      candidate.setItem(IOS_PRODUCT_RUN_KEY, '1');
      storage = candidate;
    } catch { return () => {}; }
    const owner = Symbol(); // in memory only; never persisted
    this.owner = owner;
    this.acknowledged = false;
    return () => {
      // A cancelled/older operation must not erase a newer run's flag.
      if (this.owner !== owner) return;
      this.owner = undefined;
      this.acknowledged = true;
      try { storage.removeItem(IOS_PRODUCT_RUN_KEY); } catch { /* never fail an image operation */ }
    };
  }
}

export const productRecoveryMarker = new ProductRecoveryMarker();
export const productRecoveryMessages = {
  ko: { body: '직전 사물·제품 배경 제거가 중단되었을 수 있습니다. 인물 모드로 다시 시도하는 것을 권장합니다.', dismiss: '닫기' },
  en: { body: 'The previous object/product background removal may have been interrupted. We recommend trying portrait mode.', dismiss: 'Dismiss' },
} as const;
