import { normalizeFormattingMask, defaultFormattingMask } from "./formattingMask.ts";
import type { WordCompareOptions, WordWorkerPairResult } from "../word-compare/wordWorkerClient.ts";
import { compareWordFilePairs } from "../word-compare/wordWorkerClient.ts";
import type { HwpCompareOptions } from "../hwp-compare/hwpWorkerClient.ts";
import { compareHwpFilePairs } from "../hwp-compare/hwpWorkerClient.ts";
import { sniffDocumentFormat, validateDocumentPairFormats, type DocumentPairFormat } from "./documentFormat.ts";

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
    { family: "word" as const, native: false, pairs: inspected.filter((pair) => pair.formats.trackedDocxEligible) },
    { family: "word" as const, native: true, pairs: inspected.filter((pair) => pair.formats.family === "word" && !pair.formats.trackedDocxEligible) },
    { family: "hwp" as const, native: true, pairs: inspected.filter((pair) => pair.formats.family === "hwp") },
  ].filter((group) => group.pairs.length);
  let completed = 0;

  for (const group of groups) {
    if (signal?.aborted) throw cancelled(language);
    const base = (completed / pairs.length) * 100;
    const share = (group.pairs.length / pairs.length) * 100;
    const progress = (value: number, message: string) => onProgress?.(base + (value / 100) * share, message);
    const applied = formattingScopeForPair(!group.native,options);
    const results = group.family === "word"
      ? await compareWordFilePairs(group.pairs.map(({ beforeFile, afterFile }) => ({ beforeFile, afterFile })), applied, progress, language, signal)
      : await compareHwpFilePairs(group.pairs.map(({ beforeFile, afterFile, beforePassword, afterPassword }) => ({ beforeFile, afterFile, beforePassword, afterPassword })), applied, progress, language, signal);
    results.forEach((result, resultIndex) => {
      if (group.native && Object.values(normalizeFormattingMask(options.formattingMask)).some(enabled=>!enabled)) result.result.warnings.push(language === "en" ? "Detailed formatting groups apply to DOCX pairs only. This pair uses the full native formatting scope when formatting is enabled." : "세부 서식 선택은 DOCX 쌍에만 적용됩니다. 이 문서 쌍은 서식 비교를 켜면 기존의 전체 서식 범위로 비교합니다.");
      indexedResults.set(group.pairs[resultIndex].index, result);
    });
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

export function formattingScopeForPair(docxPair:boolean, options:DocumentCompareOptions):DocumentCompareOptions {
  const requested=normalizeFormattingMask(options.formattingMask);
  return {...options,formattingMask:docxPair?requested:{...defaultFormattingMask},requestedFormattingMask:docxPair?undefined:requested};
}
