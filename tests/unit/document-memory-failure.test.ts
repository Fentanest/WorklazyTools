import assert from "node:assert/strict";
import test from "node:test";
import { isOutOfMemory, outOfMemoryMessage, trackedOutOfMemoryMessage } from "../../src/features/document-compare/memoryFailure.ts";

test("out-of-memory failures are recognised from Pyodide, WebAssembly and allocation errors only", () => {
  for (const failure of [
    Object.assign(new Error("Traceback (most recent call last):\nMemoryError"), { name: "PythonError" }),
    new RangeError("WebAssembly.Memory.grow(): Maximum memory size exceeded; could not allocate memory"),
    new RangeError("Array buffer allocation failed"),
    "Uncaught RangeError: Out of memory",
    "Aborted(OOM). Build with -sASSERTIONS for more info.",
    "Cannot enlarge memory, requested 2147483648 bytes",
    new Error("RuntimeError: memory access out of bounds"),
  ]) assert.equal(isOutOfMemory(failure), true, String(failure));
  for (const other of [new Error("BadZipFile: File is not a zip file"), new Error("Password-protected Word files cannot be opened."), "fetch failed", undefined]) assert.equal(isOutOfMemory(other), false, String(other));
});

test("memory messages tell the user to compare less at a time", () => {
  assert.equal(outOfMemoryMessage("ko"), "메모리가 부족해 비교를 끝내지 못했습니다. 한 번에 비교하는 문서 수를 줄이거나, 큰 문서는 나눠서 다시 비교해 주세요.");
  assert.match(outOfMemoryMessage("en"), /^Ran out of memory before the comparison finished\. Compare fewer documents at a time, or split large documents/);
  assert.match(trackedOutOfMemoryMessage("ko"), /^메모리가 부족해 이 문서 쌍의 Word 변경 추적 파일을 만들지 못했습니다\./);
});
