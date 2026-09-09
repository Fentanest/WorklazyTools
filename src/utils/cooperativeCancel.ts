const DEFAULT_CANCELED_MESSAGE = "The operation was canceled.";

export function yieldToEventLoop() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export function throwIfAborted(signal?: AbortSignal, canceledMessage = DEFAULT_CANCELED_MESSAGE): void {
  if (signal?.aborted) throw new DOMException(canceledMessage, "AbortError");
}

export async function yieldBeforeResultRegistration(signal?: AbortSignal, canceledMessage = DEFAULT_CANCELED_MESSAGE): Promise<void> {
  await yieldToEventLoop();
  throwIfAborted(signal, canceledMessage);
}
