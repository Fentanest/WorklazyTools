/** The pinned module has no memory.grow instruction; all growth uses its JS loader's Memory.grow.
 * Cap that allocator before OpenCV initialization. Overflow becomes a recoverable scan failure.
 */
export function capCvMemory(memory: WebAssembly.Memory, maximumBytes: number) {
  if (memory.buffer.byteLength > maximumBytes) throw new Error("REGION_MEMORY_LIMIT");
  const grow = memory.grow.bind(memory);
  Object.defineProperty(memory, "grow", { configurable: false, writable: false, value: (pages: number) => {
    if (!Number.isSafeInteger(pages) || pages < 0 || memory.buffer.byteLength + pages * 65536 > maximumBytes) throw new RangeError("REGION_MEMORY_LIMIT");
    return grow(pages);
  } });
  return memory;
}
