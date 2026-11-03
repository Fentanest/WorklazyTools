export type BgErrorCode = 'ai-cancelled' | 'bg-model-fetch-failed' | 'bg-model-integrity' | 'bg-inference-failed' | 'bg-out-of-memory' | 'bg-unsupported' | 'bg-secure-context-required';
export class BgRemovalError extends Error {
  readonly code: BgErrorCode;
  constructor(code: BgErrorCode) { super(code); this.code = code; this.name = 'BgRemovalError'; }
}
export const messages = {
  ko: {
    'bg-secure-context-required': '배경 제거는 HTTPS 보안 연결이 필요합니다. HTTPS 주소로 다시 접속해 주세요. 모델은 받지 않았습니다.',
    'ai-cancelled': '', 'bg-model-fetch-failed': '배경 제거 파일을 받지 못했습니다. 다시 시도해 주세요.',
    'bg-model-integrity': '배경 제거 파일을 확인하지 못했습니다. 다시 받아 주세요.',
    'bg-inference-failed': '배경을 제거하지 못했습니다. 사물·제품 모드라면 인물 모드를 별도 선택해 다시 시도할 수 있습니다.',
    'bg-out-of-memory': '이 기기의 메모리가 부족합니다. 이미지 크기를 줄여 다시 시도해 주세요.',
    'bg-unsupported': '이 기기에서 사물·제품 모드를 실행하지 못했습니다. 인물 모드를 선택해 다시 시도해 주세요.',
    'cache-unavailable': '저장 공간 문제로 다음에 다시 받아야 합니다.',
  },
  en: {
    'bg-secure-context-required': 'Background removal requires a secure HTTPS connection. Open the HTTPS address to continue. No model was downloaded.',
    'ai-cancelled': '', 'bg-model-fetch-failed': 'Could not download background removal files. Please try again.',
    'bg-model-integrity': 'Could not verify background removal files. Please download them again.',
    'bg-inference-failed': 'Could not remove the background. You can separately select portrait mode and try again.',
    'bg-out-of-memory': 'This device is low on memory. Try a smaller image.',
    'bg-unsupported': 'Object and product mode could not run on this device. Please select portrait mode and try again.',
    'cache-unavailable': 'Storage is unavailable. The files will need to be downloaded again next time.',
  },
} as const;
export function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new BgRemovalError('ai-cancelled');
}
export function normalizeError(error: unknown): BgRemovalError {
  if (error instanceof BgRemovalError) return error;
  if (error instanceof Error && error.name === 'AbortError') return new BgRemovalError('ai-cancelled');
  if (error instanceof Error && /out of memory|memory access|allocation|bad_alloc/i.test(error.message)) return new BgRemovalError('bg-out-of-memory');
  return new BgRemovalError('bg-inference-failed');
}
