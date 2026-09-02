/// <reference lib="webworker" />

import { BlobWriter } from "@zip.js/zip.js";
import type { VideoResultStorageSession, VideoWorkerOutput } from "./types";
import { FEATURE_MESSAGE_TOKEN_PREFIX, workerMessage as featureMessage } from "../../i18n/workerMessages";
import { canFallbackToBlobAfterQuotaFailure, isStorageQuotaError } from "./videoResultStorage";
import { createVideoResultWritableTarget, VideoResultQuotaError, type VideoResultWritableTarget } from "./videoResultStorage.worker";
import { writeVideoZipArchive } from "./videoZipArchive";

const worker = self as unknown as DedicatedWorkerGlobalScope;

interface VideoZipInput {
  fileName: string;
  blob: Blob;
}

interface VideoZipStartMessage {
  type: "start";
  files: VideoZipInput[];
  archiveName: string;
  language?: "ko" | "en";
  resultStorage?: VideoResultStorageSession;
}

let activeController: AbortController | undefined;

worker.onmessage = (event: MessageEvent<VideoZipStartMessage | { type: "cancel" }>) => {
  if (event.data.type === "cancel") {
    activeController?.abort();
    return;
  }
  if (activeController) return;
  activeController = new AbortController();
  void createArchive(event.data, activeController);
};

async function createArchive(message: VideoZipStartMessage, controller: AbortController) {
  const language = message.language === "en" ? "en" : "ko";
  let target: VideoResultWritableTarget | undefined;
  try {
    if (!message.files.length) throw new Error(featureMessage(language, "video.messages.videoZip.thereAreNoResultFilesToAddTo"));
    const expectedSize = estimateArchiveSize(message.files);
    let output: VideoWorkerOutput;
    if (message.resultStorage?.mode === "opfs") {
      try {
        target = await createVideoResultWritableTarget(message.resultStorage, message.archiveName, expectedSize);
        output = await writeArchive(message.files, message.archiveName, target.writable, controller.signal, language)
          .then(() => target!.complete(message.archiveName, "application/zip"));
      } catch (error) {
        await target?.discard().catch(() => undefined);
        target = undefined;
        if (controller.signal.aborted) throw controller.signal.reason;
        if ((error instanceof VideoResultQuotaError || isStorageQuotaError(error)) && !canFallbackToBlobAfterQuotaFailure(expectedSize)) {
          throw new VideoResultQuotaError();
        }
        output = await writeArchiveToFile(message.files, message.archiveName, controller.signal, language);
      }
    } else {
      output = await writeArchiveToFile(message.files, message.archiveName, controller.signal, language);
    }
    if (controller.signal.aborted) {
      await target?.discard().catch(() => undefined);
      throw controller.signal.reason;
    }
    worker.postMessage({ type: "result", result: output });
  } catch (error) {
    await target?.discard().catch(() => undefined);
    if (controller.signal.aborted) {
      worker.postMessage({ type: "canceled" });
    } else {
      const quotaFailure = error instanceof VideoResultQuotaError || isStorageQuotaError(error);
      const messageToken = quotaFailure
        ? featureMessage(language, "video.messages.videoZip.thereIsNotEnoughBrowserStorageForThisZip")
        : error instanceof Error && error.message.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX)
          ? error.message
          : featureMessage(language, "video.messages.videoZipClient.unableToCreateTheZipFile");
      worker.postMessage({ type: "error", error: { message: messageToken, code: quotaFailure ? "RESULT_STORAGE_QUOTA" : "ZIP_CREATION_ERROR" } });
    }
  } finally {
    activeController = undefined;
    worker.close();
  }
}

async function writeArchiveToFile(files: VideoZipInput[], archiveName: string, signal: AbortSignal, language: "ko" | "en") {
  const blobWriter = new BlobWriter("application/zip");
  await writeArchive(files, archiveName, blobWriter, signal, language);
  const blob = await blobWriter.getData();
  const file = new File([blob], archiveName, { type: "application/zip", lastModified: Date.now() });
  return {
    data: { kind: "file" as const, file },
    fileName: archiveName,
    mimeType: "application/zip",
    size: file.size,
  } satisfies VideoWorkerOutput;
}

async function writeArchive(
  files: VideoZipInput[],
  archiveName: string,
  writable: WritableStream | BlobWriter,
  signal: AbortSignal,
  language: "ko" | "en",
) {
  await writeVideoZipArchive(
    files,
    writable,
    signal,
    ({ entryIndex, entryCount, loadedBytes, totalBytes }) => {
      worker.postMessage({
        type: "progress",
        progress: Math.min(96, Math.round((loadedBytes / totalBytes) * 96)),
        message: featureMessage(language, "video.messages.videoZip.addingResultToZip", { p0: entryIndex + 1, p1: entryCount }),
      });
    },
    () => worker.postMessage({
      type: "progress",
      progress: 98,
      message: featureMessage(language, "video.messages.videoZip.finalizingZipFile", { p0: archiveName }),
    }),
  );
}

function estimateArchiveSize(files: VideoZipInput[]) {
  return files.reduce((sum, file) => sum + file.blob.size, 0) + files.length * 512 + 4096;
}

export {};
