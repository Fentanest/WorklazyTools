/** Failures that mean the browser ran out of memory while a document was processed: Python's
 * MemoryError in Pyodide, WebAssembly memory that could not grow, typed-array allocation and the
 * out-of-bounds trap a failed allocation leaves behind in compiled readers. */
export const OUT_OF_MEMORY = /MemoryError|out of memory|Cannot enlarge memory|could not allocate memory|Array buffer allocation failed|Aborted\(OOM\)|memory access out of bounds/i;

export function isOutOfMemory(value: unknown) {
  const text = value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? "");
  return OUT_OF_MEMORY.test(text);
}

export function outOfMemoryMessage(language: "ko" | "en") {
  return language === "en"
    ? "Ran out of memory before the comparison finished. Compare fewer documents at a time, or split large documents, and try again."
    : "메모리가 부족해 비교를 끝내지 못했습니다. 한 번에 비교하는 문서 수를 줄이거나, 큰 문서는 나눠서 다시 비교해 주세요.";
}

export function trackedOutOfMemoryMessage(language: "ko" | "en") {
  return language === "en"
    ? "Ran out of memory while creating the tracked-changes Word file for this pair. The on-screen comparison is still available."
    : "메모리가 부족해 이 문서 쌍의 Word 변경 추적 파일을 만들지 못했습니다. 화면 비교 결과는 그대로 볼 수 있습니다.";
}
