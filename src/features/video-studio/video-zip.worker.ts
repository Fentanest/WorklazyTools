/// <reference lib="webworker" />

import JSZip from "jszip";

const worker = self as unknown as DedicatedWorkerGlobalScope;

interface VideoZipInput {
  fileName: string;
  blob: Blob;
}

worker.onmessage = async (event: MessageEvent<{ files: VideoZipInput[] }>) => {
  try {
    const files = event.data.files;
    if (!files.length) throw new Error("ZIP으로 묶을 결과 파일이 없습니다.");
    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      zip.file(uniqueFileName(file.fileName, usedNames), await file.blob.arrayBuffer());
      worker.postMessage({
        type: "progress",
        progress: Math.round(((index + 1) / files.length) * 35),
        message: `${index + 1}/${files.length} 결과를 ZIP에 추가하는 중…`,
      });
    }

    const archive = await zip.generateAsync(
      { type: "uint8array", compression: "STORE", streamFiles: true },
      (metadata) => worker.postMessage({
        type: "progress",
        progress: 35 + Math.round(metadata.percent * 0.65),
        message: `ZIP 파일 만드는 중… ${Math.round(metadata.percent)}%`,
      }),
    );
    const buffer = archive.buffer as ArrayBuffer;
    worker.postMessage({
      type: "result",
      result: {
        buffer,
        fileName: `worklazy-비디오-결과-${files.length}개.zip`,
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
