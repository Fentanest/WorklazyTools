import type { WordCompareOptions, WordWorkerPairResult } from "../word-compare/wordWorkerClient";
import { compareWordFilePairs } from "../word-compare/wordWorkerClient";
import type { HwpCompareOptions } from "../hwp-compare/hwpWorkerClient";
import { compareHwpFilePairs } from "../hwp-compare/hwpWorkerClient";
import { sniffDocumentFormat, validateDocumentPairFormats, type DocumentPairFormat } from "./documentFormat";

export interface DocumentFilePair {
  beforeFile: File;
  afterFile: File;
  beforePassword?: string;
  afterPassword?: string;
}

export interface DocumentCompareOptions extends HwpCompareOptions, WordCompareOptions {}

interface InspectedPair extends DocumentFilePair {
  index: number;
  formats: DocumentPairFormat;
}

export async function compareDocumentFilePairs(
  pairs: DocumentFilePair[],
  options: DocumentCompareOptions,
  onProgress?: (progress: number, message: string) => void,
  language: "ko" | "en" = "ko",
  signal?: AbortSignal,
) {
  const inspected = await inspectPairs(pairs, language, signal);
  const indexedResults = new Map<number, WordWorkerPairResult>();
  const groups = [
    { family: "word" as const, pairs: inspected.filter((pair) => pair.formats.family === "word") },
    { family: "hwp" as const, pairs: inspected.filter((pair) => pair.formats.family === "hwp") },
  ].filter((group) => group.pairs.length);
  let completed = 0;

  for (const group of groups) {
    if (signal?.aborted) throw cancelled(language);
    const base = (completed / pairs.length) * 100;
    const share = (group.pairs.length / pairs.length) * 100;
    const progress = (value: number, message: string) => onProgress?.(base + (value / 100) * share, message);
    const results = group.family === "word"
      ? await compareWordFilePairs(group.pairs.map(({ beforeFile, afterFile }) => ({ beforeFile, afterFile })), options, progress, language, signal)
      : await compareHwpFilePairs(group.pairs.map(({ beforeFile, afterFile, beforePassword, afterPassword }) => ({ beforeFile, afterFile, beforePassword, afterPassword })), options, progress, language, signal);
    results.forEach((result, resultIndex) => indexedResults.set(group.pairs[resultIndex].index, result));
    completed += group.pairs.length;
  }
  return pairs.map((_, index) => indexedResults.get(index)!);
}

export async function inspectPairs(
  pairs: DocumentFilePair[],
  language: "ko" | "en",
  signal?: AbortSignal,
) {
  const inspected: InspectedPair[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    if (signal?.aborted) throw cancelled(language);
    const pair = pairs[index];
    const [beforeBuffer, afterBuffer] = await Promise.all([pair.beforeFile.arrayBuffer(), pair.afterFile.arrayBuffer()]);
    try {
      inspected.push({
        ...pair,
        index,
        formats: validateDocumentPairFormats(
          sniffDocumentFormat(beforeBuffer),
          sniffDocumentFormat(afterBuffer),
          language,
        ),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(language === "en" ? `Document pair ${index + 1}: ${detail}` : `${index + 1}번 문서 쌍: ${detail}`);
    }
  }
  return inspected;
}

function cancelled(language: "ko" | "en") {
  return new DOMException(language === "en" ? "Document comparison was cancelled." : "문서 비교를 취소했습니다.", "AbortError");
}
