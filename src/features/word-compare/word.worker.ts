/// <reference lib="webworker" />

import compareScript from "./compare.py?raw";
import trackedDocxScript from "./tracked_docx.py?raw";
import type { WordCompareResult } from "../excel-merger/types";

const PYODIDE_VERSION = "0.29.4";
const PYODIDE_BASE_URL = new URL(
  `vendor/pyodide/${PYODIDE_VERSION}/`,
  new URL(import.meta.env.BASE_URL, self.location.origin),
).href;
const PYODIDE_MODULE_URL = `${PYODIDE_BASE_URL}pyodide.mjs`;
const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent) => {
  const beforePath = "/tmp/worklazy-before.docx";
  const afterPath = "/tmp/worklazy-after.docx";
  const trackedPath = "/tmp/worklazy-tracked.docx";
  let compareFunction: { (...args: unknown[]): string; destroy?: () => void } | undefined;
  let trackedFunction: { (...args: unknown[]): number; destroy?: () => void } | undefined;
  let activePair = 0;

  try {
    const pairs = event.data.pairs as Array<{
      beforeName: string;
      afterName: string;
      beforeBuffer: ArrayBuffer;
      afterBuffer: ArrayBuffer;
    }>;
    if (!pairs.length) throw new Error("비교할 문서 쌍이 없습니다.");

    progress(3, `${pairs.length}개 문서 쌍을 안전한 작업 공간으로 전달했습니다.`);
    progress(5, "문서 비교 기능을 준비하는 중… (첫 실행은 시간이 걸릴 수 있어요)");
    const pyodideModule = await import(/* @vite-ignore */ PYODIDE_MODULE_URL);
    progress(18, "비교 기능을 불러왔습니다. 문서 분석 환경을 준비합니다.");
    const pyodide = await pyodideModule.loadPyodide({ indexURL: PYODIDE_BASE_URL });
    progress(42, "문서 비교 준비를 완료했습니다.");

    pyodide.runPython(compareScript);
    pyodide.runPython(trackedDocxScript);
    const compare = pyodide.globals.get("compare_documents") as { (...args: unknown[]): string; destroy?: () => void };
    const generateTracked = pyodide.globals.get("generate_tracked_document") as { (...args: unknown[]): number; destroy?: () => void };
    compareFunction = compare;
    trackedFunction = generateTracked;
    const results: Array<{ result: WordCompareResult; trackedBuffer?: ArrayBuffer }> = [];
    const transfers: ArrayBuffer[] = [];

    for (let index = 0; index < pairs.length; index += 1) {
      activePair = index + 1;
      const pair = pairs[index];
      const startProgress = 45 + Math.round((index / pairs.length) * 50);
      const endProgress = 45 + Math.round(((index + 1) / pairs.length) * 50);
      progress(startProgress, `[${activePair}/${pairs.length}] ${pair.beforeName} ↔ ${pair.afterName} 분석 중…`);
      pyodide.FS.writeFile(beforePath, new Uint8Array(pair.beforeBuffer));
      pyodide.FS.writeFile(afterPath, new Uint8Array(pair.afterBuffer));
      const resultText = compare(
        pyodide.FS.readFile(beforePath),
        pyodide.FS.readFile(afterPath),
        pair.beforeName,
        pair.afterName,
        event.data.options.formatting,
        event.data.options.tables,
        event.data.options.metadata,
      );
      const result = JSON.parse(resultText) as WordCompareResult;
      let trackedBuffer: ArrayBuffer | undefined;
      if (event.data.options.trackedDocument) {
        progress(Math.min(endProgress - 1, startProgress + Math.round((endProgress - startProgress) * 0.7)), `[${activePair}/${pairs.length}] Word 변경 추적 파일 생성 중…`);
        generateTracked(
          beforePath,
          afterPath,
          trackedPath,
          event.data.options.revisionAuthor,
          event.data.options.formatting,
          event.data.options.tables,
          event.data.options.metadata,
        );
        const trackedBytes = pyodide.FS.readFile(trackedPath) as Uint8Array;
        trackedBuffer = trackedBytes.slice().buffer;
        transfers.push(trackedBuffer);
        pyodide.FS.unlink(trackedPath);
      }
      results.push({ result, trackedBuffer });
      pyodide.FS.unlink(beforePath);
      pyodide.FS.unlink(afterPath);
      progress(endProgress, `[${activePair}/${pairs.length}] 비교 결과 정리 완료`);
    }

    compare.destroy?.();
    generateTracked.destroy?.();
    progress(100, `${pairs.length}개 문서 쌍 비교 완료`);
    worker.postMessage({ type: "result", result: results }, transfers);
  } catch (error) {
    compareFunction?.destroy?.();
    trackedFunction?.destroy?.();
    const rawMessage = error instanceof Error ? error.message : String(error);
    const detail = /zip|document\.xml|BadZipFile/i.test(rawMessage)
      ? "DOCX 파일 구조를 읽지 못했습니다. 손상되었거나 실제 DOCX 형식이 아닌지 확인해 주세요."
      : /fetch|network|import/i.test(rawMessage)
        ? "문서 비교 실행 환경을 불러오지 못했습니다. 사이트를 온라인에서 다시 연 뒤 재시도해 주세요."
        : rawMessage;
    const message = activePair ? `${activePair}번 문서 쌍: ${detail}` : detail;
    worker.postMessage({ type: "error", error: { message } });
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: value, message });
}

export {};
