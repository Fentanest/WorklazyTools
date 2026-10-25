import { documentCapabilities, documentProvenance } from "../document-compare/documentCapabilities";
/// <reference lib="webworker" />

import acceptRevisionsScript from "./accept_revisions.py?raw";
import compareScript from "./compare.py?raw";
import trackedDocxScript from "./tracked_docx.py?raw";
import formattingPolicy from "./formatting-policy.json";
import pyodidePackage from "pyodide/package.json";
import type { WordCompareResult } from "../excel-merger/types";
import { compareDocumentModels, diffText, type ComparisonModel } from "../document-compare/documentComparison";
import { serializeManifestForTracked } from "../document-compare/manifestWire";
import { sniffDocumentFormat, type DocumentFormat } from "../document-compare/documentFormat";
import { extractLegacyDocModel } from "./docModel";
import { restoreModelTransport } from "./modelTransport";

const PYODIDE_VERSION = pyodidePackage.version;
const PYODIDE_BASE_URL = new URL(
  `vendor/pyodide/${PYODIDE_VERSION}/`,
  new URL(import.meta.env.BASE_URL, self.location.origin),
).href;
const PYODIDE_MODULE_URL = `${PYODIDE_BASE_URL}pyodide.mjs`;
const worker = self as unknown as DedicatedWorkerGlobalScope;
const bridgeGlobal = worker as DedicatedWorkerGlobalScope & {
  worklazyDiffJson: (before: string, after: string) => string;
  worklazyComparisonManifestJson: (...args: unknown[]) => string;
};

bridgeGlobal.worklazyDiffJson = (before, after) => {
  if (typeof before !== "string" || typeof after !== "string") {
    throw new TypeError("Document diff inputs must be strings.");
  }
  return JSON.stringify(diffText(before, after));
};

bridgeGlobal.worklazyComparisonManifestJson = (before, after, formatting, tables, metadata) => JSON.stringify(compareDocumentModels(
  "", "", JSON.parse(before as string), JSON.parse(after as string),
  { formatting: Boolean(formatting), tables: Boolean(tables), metadata: Boolean(metadata) }, "en",
).manifest);

worker.onmessage = async (event: MessageEvent) => {
  let extractFunction: { (...args: unknown[]): ModelBytes; destroy?: () => void } | undefined;
  let trackedFunction: { (...args: unknown[]): number; destroy?: () => void } | undefined;
  let acceptFunction: { (...args: unknown[]): number; destroy?: () => void } | undefined;
  let rewriteCommentsFunction: { (...args: unknown[]): number; destroy?: () => void } | undefined;
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
    const formats = pairs.map((pair) => ({
      before: sniffDocumentFormat(pair.beforeBuffer),
      after: sniffDocumentFormat(pair.afterBuffer),
    }));
    const invalidIndex = formats.findIndex((pair) => !isWordFormat(pair.before) || !isWordFormat(pair.after));
    if (invalidIndex >= 0) {
      const format = formats[invalidIndex];
      if (format.before === "encrypted-office" || format.after === "encrypted-office") {
        throw new Error(L("암호로 보호된 Word 파일은 열 수 없습니다. Word에서 암호를 해제한 사본으로 다시 시도해 주세요.", "Password-protected Word files cannot be opened. Remove the password in Word and try an unlocked copy."));
      }
      throw new Error(L("선택한 파일의 실제 형식을 Word DOCX 또는 Word 97–2003 DOC로 확인할 수 없습니다.", "The selected file could not be identified as Word DOCX or Word 97–2003 DOC."));
    }

    progress(3, L(`${pairs.length}개 문서 쌍을 비교할 준비가 되었습니다.`, `${pairs.length} document pairs are ready for comparison.`));
    const needsDocx = formats.some((pair) => pair.before === "docx" || pair.after === "docx");
    let pyodide: Awaited<ReturnType<(typeof import("pyodide"))["loadPyodide"]>> | undefined;
    let extract: { (...args: unknown[]): ModelBytes; destroy?: () => void } | undefined;
    let generateTracked: { (...args: unknown[]): number; destroy?: () => void } | undefined;
    if (needsDocx) {
      progress(5, L("DOCX 분석 기능을 준비하는 중… (첫 실행은 시간이 걸릴 수 있어요)", "Preparing DOCX analysis… The first run may take a while."));
      const pyodideModule = await import(/* @vite-ignore */ PYODIDE_MODULE_URL);
      progress(18, L("필요한 비교 파일을 불러왔습니다. 문서 분석을 준비합니다.", "Required comparison files loaded. Preparing document analysis."));
      const loadedPyodide = await pyodideModule.loadPyodide({ indexURL: PYODIDE_BASE_URL });
      pyodide = loadedPyodide;
      progress(42, L("문서 비교 준비를 완료했습니다.", "Document comparison is ready."));
      loadedPyodide.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", JSON.stringify(formattingPolicy));
      loadedPyodide.runPython(compareScript);
      loadedPyodide.runPython(acceptRevisionsScript);
      loadedPyodide.runPython(trackedDocxScript);
      extract = loadedPyodide.globals.get("extract_document_model_compact") as { (...args: unknown[]): ModelBytes; destroy?: () => void };
      generateTracked = loadedPyodide.globals.get("generate_tracked_document") as { (...args: unknown[]): number; destroy?: () => void };
      extractFunction = extract;
      trackedFunction = generateTracked;
      acceptFunction = loadedPyodide.globals.get("accept_tracked_document") as { (...args: unknown[]): number; destroy?: () => void };
      rewriteCommentsFunction = loadedPyodide.globals.get("rewrite_new_comment_authors") as { (...args: unknown[]): number; destroy?: () => void };
    } else {
      progress(42, L("DOC 문서 비교 준비를 완료했습니다.", "DOC comparison is ready."));
    }
    const results: Array<{ result: WordCompareResult; trackedBuffer?: ArrayBuffer }> = [];
    const transfers: ArrayBuffer[] = [];

    for (let index = 0; index < pairs.length; index += 1) {
      activePair = index + 1;
      const pair = pairs[index];
      const startProgress = 45 + Math.round((index / pairs.length) * 50);
      const endProgress = 45 + Math.round(((index + 1) / pairs.length) * 50);
      progress(startProgress, L(`[${activePair}/${pairs.length}] ${pair.beforeName} ↔ ${pair.afterName} 분석 중…`, `[${activePair}/${pairs.length}] Analyzing ${pair.beforeName} ↔ ${pair.afterName}…`));
      const pairFormats = formats[index];
      const pathPrefix = `/tmp/worklazy-word-${index}`;
      const beforePath = `${pathPrefix}-before.docx`;
      const afterPath = `${pathPrefix}-after.docx`;
      const acceptedBeforePath = `${pathPrefix}-accepted-before.docx`;
      const acceptedAfterPath = `${pathPrefix}-accepted-after.docx`;
      const trackedPath = `${pathPrefix}-tracked.docx`;
      const temporaryPaths = [beforePath, afterPath, acceptedBeforePath, acceptedAfterPath, trackedPath];
      let beforeBuffer = pair.beforeBuffer;
      let afterBuffer = pair.afterBuffer;
      let trackedBuffer: ArrayBuffer | undefined;
      try {
        const docxPair = pairFormats.before === "docx" && pairFormats.after === "docx";
        const rewriteRevisionAuthor = Boolean(event.data.options.trackedDocument && event.data.options.rewriteRevisionAuthor);
        if (rewriteRevisionAuthor && docxPair && pyodide && acceptFunction && rewriteCommentsFunction) {
          pyodide.FS.writeFile(beforePath, new Uint8Array(pair.beforeBuffer));
          pyodide.FS.writeFile(afterPath, new Uint8Array(pair.afterBuffer));
          acceptFunction(beforePath, acceptedBeforePath);
          acceptFunction(afterPath, acceptedAfterPath);
          rewriteCommentsFunction(acceptedBeforePath, acceptedAfterPath, event.data.options.revisionAuthor);
          beforeBuffer = (pyodide.FS.readFile(acceptedBeforePath) as Uint8Array).slice().buffer;
          afterBuffer = (pyodide.FS.readFile(acceptedAfterPath) as Uint8Array).slice().buffer;
        }

        const beforeModel = extractWordModel(beforeBuffer, pairFormats.before, event.data.options, en ? "en" : "ko", extract);
        const afterModel = extractWordModel(afterBuffer, pairFormats.after, event.data.options, en ? "en" : "ko", extract);
        beforeModel.capabilities = documentCapabilities(pairFormats.before === "doc" ? "doc" : "docx",beforeModel);
        afterModel.capabilities = documentCapabilities(pairFormats.after === "doc" ? "doc" : "docx",afterModel);
        beforeModel.provenance = await documentProvenance(pair.beforeBuffer,beforeBuffer,rewriteRevisionAuthor && docxPair);
        afterModel.provenance = await documentProvenance(pair.afterBuffer,afterBuffer,rewriteRevisionAuthor && docxPair);
        const result = compareDocumentModels(
          pair.beforeName,
          pair.afterName,
          beforeModel,
          afterModel,
          event.data.options,
          en ? "en" : "ko",
        );
        if ([...result.manifest.coverage.before, ...result.manifest.coverage.after].some((item) => item.reason === "blank-paragraph")) {
          result.warnings.push(L("화면에서 비교하지 않는 빈 문단의 배치는 수정본 기준으로 유지됩니다.", "The layout of empty paragraphs omitted from the comparison is kept from the revised file."));
        }
        if (!event.data.options.formatting) {
          result.warnings.push(L("서식 비교를 끄면 대응하는 내용은 수정본 서식을 유지합니다. 수정본에 대응 문단이 없는 삭제 문단을 복원하면 원본 서식이 유지됩니다.", "When formatting comparison is off, paired content keeps the revised formatting. Restoring a wholly deleted paragraph without a revised counterpart keeps its original formatting."));
        }
        if (!event.data.options.tables || !event.data.options.metadata) {
          result.warnings.push(L("비교에서 제외한 서식·표·문서 정보는 수정본 기준으로 유지됩니다.", "Excluded formatting, tables and document information are kept from the revised file."));
        }
        if ((beforeModel.comments?.length || afterModel.comments?.length) && event.data.options.trackedDocument) {
          result.warnings.push(L("변경 추적 파일의 메모와 기존 변경 기록은 수정본 기준으로 유지됩니다. 메모 본문의 변경은 Word에서 거부하여 원본으로 복원할 수 없습니다.", "Comments and existing revision history in the tracked file are kept from the revised file. Rejecting changes in Word does not restore original comment text."));
        }
        if (event.data.options.trackedDocument && docxPair && pyodide && generateTracked) {
          progress(Math.min(endProgress - 1, startProgress + Math.round((endProgress - startProgress) * 0.7)), L(`[${activePair}/${pairs.length}] Word 변경 추적 파일 생성 중…`, `[${activePair}/${pairs.length}] Creating tracked-changes Word file…`));
          const trackedBeforePath = rewriteRevisionAuthor ? acceptedBeforePath : beforePath;
          const trackedAfterPath = rewriteRevisionAuthor ? acceptedAfterPath : afterPath;
          if (!rewriteRevisionAuthor) {
            pyodide.FS.writeFile(beforePath, new Uint8Array(pair.beforeBuffer));
            pyodide.FS.writeFile(afterPath, new Uint8Array(pair.afterBuffer));
          }
          try {
            generateTracked(
              trackedBeforePath,
              trackedAfterPath,
              trackedPath,
              event.data.options.revisionAuthor,
              event.data.options.formatting,
              event.data.options.tables,
              event.data.options.metadata,
              compactManifestBytes(serializeManifestForTracked(result.manifest)),
              JSON.stringify(result.manifest.formattingMask.requested),
            );
            const trackedBytes = pyodide.FS.readFile(trackedPath) as Uint8Array;
            trackedBuffer = trackedBytes.slice().buffer;
            transfers.push(trackedBuffer);
          } catch (error) {
            // The tracked file is an extra download: any failure here (a guarded source shape,
            // memory exhaustion or an unexpected generator error) drops only this pair's DOCX.
            trackedBuffer = undefined;
            const guarded = /COMPARISON_MANIFEST|COMPARISON_DECISION|UNMAPPED_VISIBLE_XML_NODE|SHARED_DIFF|UNSUPPORTED_TRACKED_SOURCE/.test(String(error));
            result.warnings.push(guarded ? L(
              "일부 원문 위치를 변경 추적 파일에 안전하게 연결할 수 없어 DOCX 다운로드를 제공하지 않습니다. 화면 비교 결과를 확인해 주세요.",
              "The tracked DOCX download is unavailable because some source locations could not be represented safely. Review the on-screen comparison.",
            ) : L(
              "변경 추적 파일을 만드는 중 문제가 생겨 이 문서 쌍의 DOCX 다운로드를 제공하지 않습니다. 화면 비교 결과는 그대로 확인할 수 있습니다.",
              "The tracked DOCX download is unavailable for this document pair because creating it failed. The on-screen comparison is still available.",
            ));
          }
        }
        results.push({ result, trackedBuffer });
      } finally {
        for (const path of temporaryPaths) {
          try {
            pyodide?.FS.unlink(path);
          } catch {
            // The path may not have been created before cancellation or failure.
          }
        }
      }
      progress(endProgress, L(`[${activePair}/${pairs.length}] 비교 결과 정리 완료`, `[${activePair}/${pairs.length}] Comparison result ready`));
    }

    progress(100, L(`${pairs.length}개 문서 쌍 비교 완료`, `Compared ${pairs.length} document pairs`));
    worker.postMessage({ type: "result", result: results }, transfers);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const detail = /zip|document\.xml|BadZipFile/i.test(rawMessage)
      ? L("DOCX 파일 구조를 읽지 못했습니다. 손상되었거나 실제 DOCX 형식이 아닌지 확인해 주세요.", "Could not read the DOCX structure. Check whether the file is damaged or is not actually a DOCX file.")
      : /fetch|network|import/i.test(rawMessage)
        ? L("비교에 필요한 파일을 내려받지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.", "Could not download files required for comparison. Check your connection and try again.")
        : /Word 6\/95|Word 97.?2003|DOC 파일|DOC file/i.test(rawMessage)
          ? rawMessage
          : L("문서를 분석하지 못했습니다. 파일이 손상되지 않았는지 확인한 뒤 다시 시도해 주세요.", "Could not analyze the document. Check that the file is not damaged and try again.");
    const message = activePair ? L(`${activePair}번 문서 쌍: ${detail}`, `Document pair ${activePair}: ${detail}`) : detail;
    worker.postMessage({ type: "error", error: { message } });
  } finally {
    extractFunction?.destroy?.();
    trackedFunction?.destroy?.();
    acceptFunction?.destroy?.();
    rewriteCommentsFunction?.destroy?.();
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: value, message });
}

function isWordFormat(format: DocumentFormat): format is "doc" | "docx" {
  return format === "doc" || format === "docx";
}

// Model and manifest cross between Python and JavaScript as UTF-8 bytes (far faster than long
// strings) with the WordprocessingML namespace written as one control character, which JSON text
// never holds unescaped (compare.py MODEL_NAMESPACE_TOKEN, tracked_docx.py _manifest_text).
const WORD_NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}";
type ModelBytes = { toJs(): Uint8Array; destroy?: () => void };
function restoreModelJson(bytes: ModelBytes) {
  const view = bytes.toJs();
  bytes.destroy?.();
  return new TextDecoder().decode(view).replaceAll("\u0001", WORD_NAMESPACE);
}
function compactManifestBytes(json: string) {
  return new TextEncoder().encode(json.replaceAll(WORD_NAMESPACE, "\u0001"));
}

function extractWordModel(
  buffer: ArrayBuffer,
  format: DocumentFormat,
  options: { formatting: boolean; tables: boolean; metadata: boolean },
  language: "ko" | "en",
  extract: { (...args: unknown[]): ModelBytes } | undefined,
) {
  if (format === "doc") return extractLegacyDocModel(new Uint8Array(buffer), options, language);
  if (format === "docx" && extract) {
    return restoreModelTransport(JSON.parse(restoreModelJson(extract(new Uint8Array(buffer), true, true, language)))) as ComparisonModel;
  }
  throw new Error(language === "en" ? "The Word file format is not supported." : "지원하지 않는 Word 파일 형식입니다.");
}

export {};
