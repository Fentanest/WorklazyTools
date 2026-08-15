/// <reference lib="webworker" />

import alignmentScript from "./alignment.py?raw";
import compareScript from "./compare.py?raw";
import trackedDocxScript from "./tracked_docx.py?raw";
import pyodidePackage from "pyodide/package.json";
import type { WordCompareResult } from "../excel-merger/types";

const PYODIDE_VERSION = pyodidePackage.version;
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
  const en = event.data.language === "en";
  const L = (ko: string, english: string) => en ? english : ko;

  try {
    const pairs = event.data.pairs as Array<{
      beforeName: string;
      afterName: string;
      beforeBuffer: ArrayBuffer;
      afterBuffer: ArrayBuffer;
    }>;
    if (!pairs.length) throw new Error(L("비교할 문서 쌍이 없습니다.", "There are no document pairs to compare."));
    const encryptedPair = pairs.find((pair) => isCompoundOfficeFile(pair.beforeBuffer) || isCompoundOfficeFile(pair.afterBuffer));
    if (encryptedPair) throw new Error(L("암호화된 DOCX는 현재 브라우저 비교에서 열 수 없습니다. Word에서 암호를 해제한 사본으로 다시 시도해 주세요.", "Encrypted DOCX files cannot be opened by this browser comparison. Remove the password in Word and try an unlocked copy."));

    progress(3, L(`${pairs.length}개 문서 쌍을 안전한 작업 공간으로 전달했습니다.`, `Moved ${pairs.length} document pairs into the processing workspace.`));
    progress(5, L("문서 비교 기능을 준비하는 중… (첫 실행은 시간이 걸릴 수 있어요)", "Loading document comparison… The first run may take a while."));
    const pyodideModule = await import(/* @vite-ignore */ PYODIDE_MODULE_URL);
    progress(18, L("비교 기능을 불러왔습니다. 문서 분석 환경을 준비합니다.", "Comparison loaded. Preparing document analysis."));
    const pyodide = await pyodideModule.loadPyodide({ indexURL: PYODIDE_BASE_URL });
    progress(42, L("문서 비교 준비를 완료했습니다.", "Document comparison is ready."));

    pyodide.runPython(alignmentScript);
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
      progress(startProgress, L(`[${activePair}/${pairs.length}] ${pair.beforeName} ↔ ${pair.afterName} 분석 중…`, `[${activePair}/${pairs.length}] Analyzing ${pair.beforeName} ↔ ${pair.afterName}…`));
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
        en ? "en" : "ko",
      );
      const result = JSON.parse(resultText) as WordCompareResult;
      let trackedBuffer: ArrayBuffer | undefined;
      if (event.data.options.trackedDocument) {
        progress(Math.min(endProgress - 1, startProgress + Math.round((endProgress - startProgress) * 0.7)), L(`[${activePair}/${pairs.length}] Word 변경 추적 파일 생성 중…`, `[${activePair}/${pairs.length}] Creating tracked-changes Word file…`));
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
      progress(endProgress, L(`[${activePair}/${pairs.length}] 비교 결과 정리 완료`, `[${activePair}/${pairs.length}] Comparison result ready`));
    }

    compare.destroy?.();
    generateTracked.destroy?.();
    progress(100, L(`${pairs.length}개 문서 쌍 비교 완료`, `Compared ${pairs.length} document pairs`));
    worker.postMessage({ type: "result", result: results }, transfers);
  } catch (error) {
    compareFunction?.destroy?.();
    trackedFunction?.destroy?.();
    const rawMessage = error instanceof Error ? error.message : String(error);
    const detail = /zip|document\.xml|BadZipFile/i.test(rawMessage)
      ? L("DOCX 파일 구조를 읽지 못했습니다. 손상되었거나 실제 DOCX 형식이 아닌지 확인해 주세요.", "Could not read the DOCX structure. Check whether the file is damaged or is not actually a DOCX file.")
      : /fetch|network|import/i.test(rawMessage)
        ? L("문서 비교 실행 환경을 불러오지 못했습니다. 사이트를 온라인에서 다시 연 뒤 재시도해 주세요.", "Could not load the comparison runtime. Reopen the site while online and try again.")
        : rawMessage;
    const message = activePair ? L(`${activePair}번 문서 쌍: ${detail}`, `Document pair ${activePair}: ${detail}`) : detail;
    worker.postMessage({ type: "error", error: { message } });
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: value, message });
}

function isCompoundOfficeFile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  return bytes.length === 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 && bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1;
}

export {};
