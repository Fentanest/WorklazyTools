/// <reference lib="webworker" />

import JSZip from "jszip";
import { workerMessage as featureMessage } from "../../i18n/workerMessages";

const worker = self as unknown as DedicatedWorkerGlobalScope;

interface VideoZipInput {
  fileName: string;
  blob: Blob;
}

worker.onmessage = async (event: MessageEvent<{ files: VideoZipInput[]; archiveName: string; language?: "ko" | "en" }>) => {
  const language = event.data.language === "en" ? "en" : "ko";
  try {
    const files = event.data.files;
    if (!files.length) throw new Error(featureMessage(language, "video.messages.videoZip.thereAreNoResultFilesToAddTo"));
    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      zip.file(uniqueFileName(file.fileName, usedNames), file.blob);
      worker.postMessage({
        type: "progress",
        progress: Math.round(((index + 1) / files.length) * 35),
        message: featureMessage(language, "video.messages.videoZip.addingResultToZip", { p0: index + 1, p1: files.length }),
      });
    }

    const archive = await zip.generateAsync(
      { type: "uint8array", compression: "STORE", streamFiles: true },
      (metadata) => worker.postMessage({
        type: "progress",
        progress: 35 + Math.round(metadata.percent * 0.65),
        message: featureMessage(language, "video.messages.videoZip.creatingZipFile", { p0: Math.round(metadata.percent) }),
      }),
    );
    const buffer = archive.buffer as ArrayBuffer;
    worker.postMessage({
      type: "result",
      result: {
        buffer,
        fileName: event.data.archiveName,
        mimeType: "application/zip",
      },
    }, [buffer]);
  } catch (error) {
    worker.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  } finally {
    worker.close();
  }
};

function uniqueFileName(fileName: string, usedNames: Set<string>) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";
  let sequence = 2;
  let candidate = `${base}-${sequence}${extension}`;
  while (usedNames.has(candidate)) candidate = `${base}-${sequence += 1}${extension}`;
  usedNames.add(candidate);
  return candidate;
}

export {};
