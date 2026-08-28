import type { PdfWorkerResult } from "./types";

export function movePdfItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function normalizePdfRotation(value: number): 0 | 90 | 180 | 270 {
  return (((value % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

export function pdfBinaryResult(bytes: Uint8Array | ArrayBuffer, fileName: string, mimeType: string, warnings: string[]): PdfWorkerResult {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { buffer, fileName, mimeType, warnings };
}

export function ensurePdfExtension(name: string, extension: string) {
  const base = name.trim().replace(/\.[^.]+$/, "") || "worklazy-result";
  return `${base}.${extension}`;
}

export function sanitizePdfFileName(name: string, fallback: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-") || fallback;
}

export function compactPdfPageRange(indexes: readonly number[], sortAscending = false) {
  const uniqueIndexes = [...new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0))];
  if (!uniqueIndexes.length) return "";
  if (sortAscending) uniqueIndexes.sort((left, right) => left - right);
  const numbers = uniqueIndexes.map((index) => index + 1);
  const parts: string[] = [];
  let start = numbers[0];
  let previous = numbers[0];
  let direction = 0;
  for (let index = 1; index <= numbers.length; index += 1) {
    const current = numbers[index];
    const nextDirection = current === undefined ? 0 : Math.sign(current - previous);
    if (current !== undefined && Math.abs(current - previous) === 1 && (direction === 0 || direction === nextDirection)) {
      direction = nextDirection;
      previous = current;
      continue;
    }
    parts.push(start === previous ? String(start) : `${start}-${previous}`);
    start = current;
    previous = current;
    direction = 0;
  }
  return parts.join(", ");
}

export function splitPdfPageRanges(pageCount: number, boundaryAfterIndexes: readonly number[]) {
  if (pageCount <= 0) return [];
  const boundaries = [...new Set(boundaryAfterIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < pageCount - 1)
    .sort((left, right) => left - right);
  const groups: number[][] = [];
  let start = 0;
  for (const boundary of boundaries) {
    groups.push(Array.from({ length: boundary - start + 1 }, (_, index) => start + index));
    start = boundary + 1;
  }
  groups.push(Array.from({ length: pageCount - start }, (_, index) => start + index));
  return groups;
}

export async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}
