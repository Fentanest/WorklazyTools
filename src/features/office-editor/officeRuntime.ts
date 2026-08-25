interface OfficeModule {
  canvas: HTMLCanvasElement;
  uno_scripts: string[];
  locateFile: (path: string, prefix: string) => string;
  mainScriptUrlOrBlob: Blob;
  uno_main?: Promise<MessagePort>;
}

interface OfficeFileSystem {
  mkdir(path: string): void;
  writeFile(path: string, bytes: Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
}

declare global {
  var Module: OfficeModule;
}

export interface OfficeRuntime {
  open(file: File): Promise<void>;
  save(): Promise<{ bytes: Uint8Array; fileName: string }>;
  convertLegacySpreadsheet(file: File): Promise<{ bytes: Uint8Array; fileName: string }>;
}

export async function launchOfficeRuntime(
  canvas: HTMLCanvasElement,
  assetBaseUrl: string,
): Promise<OfficeRuntime> {
  const mainScriptUrlOrBlob = new Blob(
    [`importScripts('${new URL("soffice.js", assetBaseUrl).href}');`],
    { type: "text/javascript" },
  );
  globalThis.Module = {
    canvas,
    uno_scripts: [
      new URL("zeta.js", assetBaseUrl).href,
      new URL("office_thread.js", assetBaseUrl).href,
    ],
    locateFile: (path) => new URL(path, assetBaseUrl).href,
    mainScriptUrlOrBlob,
  };

  await loadClassicScript(new URL("soffice.js", assetBaseUrl).href);
  const port = await globalThis.Module.uno_main;
  if (!port) throw new Error("office-start-failed");
  const waiters = new Map<string, Array<{ resolve: () => void; reject: (reason: Error) => void }>>();
  const received = new Set<string>();
  const waitFor = (command: string, timeoutMs = 90_000) => new Promise<void>((resolve, reject) => {
    if (received.delete(command)) { resolve(); return; }
    const waiter = { resolve, reject };
    waiters.set(command, [...(waiters.get(command) ?? []), waiter]);
    window.setTimeout(() => {
      const remaining = (waiters.get(command) ?? []).filter((candidate) => candidate !== waiter);
      if (remaining.length) waiters.set(command, remaining);
      else waiters.delete(command);
      reject(new Error("office-operation-timeout"));
    }, timeoutMs);
  });
  port.onmessage = (event) => {
    const command = String(event.data?.cmd ?? "");
    const callbacks = waiters.get(command) ?? [];
    waiters.delete(command);
    if (callbacks.length) callbacks.forEach((callback) => callback.resolve());
    else received.add(command);
    if (command === "open-failed" || command === "save-failed" || command === "convert-failed") {
      const expected = command === "open-failed" ? "opened" : command === "save-failed" ? "saved" : "converted";
      const failures = waiters.get(expected) ?? [];
      waiters.delete(expected);
      failures.forEach((callback) => callback.reject(new Error(command)));
    }
  };
  await waitFor("ready");
  let fileName = "document.odt";

  return {
    async open(file) {
      fileName = safeFileName(file.name);
      const fileSystem = (globalThis as typeof globalThis & { FS: OfficeFileSystem }).FS;
      try { fileSystem.mkdir("/tmp/office"); } catch { /* 이미 준비된 폴더입니다. */ }
      fileSystem.writeFile(`/tmp/office/${fileName}`, new Uint8Array(await file.arrayBuffer()));
      const opened = waitFor("opened");
      port.postMessage({ cmd: "open", filename: fileName });
      await opened;
    },
    async save() {
      const saved = waitFor("saved");
      port.postMessage({ cmd: "save" });
      await saved;
      const fileSystem = (globalThis as typeof globalThis & { FS: OfficeFileSystem }).FS;
      const bytes = fileSystem.readFile(`/tmp/office/${fileName}`).slice();
      if (!isPlausibleOfficeFile(bytes)) throw new Error("office-save-verification-failed");
      return { bytes, fileName };
    },
    async convertLegacySpreadsheet(file) {
      const inputName = safeFileName(file.name);
      const outputName = `${stripExtension(inputName)}-worklazy.xlsx`;
      const inputPath = `/tmp/office/${inputName}`;
      const outputPath = `/tmp/office/${outputName}`;
      const fileSystem = (globalThis as typeof globalThis & { FS: OfficeFileSystem }).FS;
      try { fileSystem.mkdir("/tmp/office"); } catch { /* 이미 준비된 폴더입니다. */ }
      fileSystem.writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));
      try {
        const converted = waitFor("converted", 120_000);
        port.postMessage({ cmd: "convert-xls", filename: inputName, output: outputName });
        await converted;
        const bytes = fileSystem.readFile(outputPath).slice();
        if (!isPlausibleOfficeFile(bytes) || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("office-convert-verification-failed");
        return { bytes, fileName: outputName };
      } finally {
        try { fileSystem.unlink(inputPath); } catch { /* 이미 정리된 입력 파일입니다. */ }
        try { fileSystem.unlink(outputPath); } catch { /* 변환에 실패하면 출력 파일이 없을 수 있습니다. */ }
      }
    },
  };
}

function loadClassicScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("office-start-failed"));
    document.body.appendChild(script);
  });
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|%#\u0000-\u001f]/g, "_").trim();
  return cleaned || "document.odt";
}

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, "") || "spreadsheet";
}

function isPlausibleOfficeFile(bytes: Uint8Array) {
  if (bytes.byteLength < 512) return false;
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const compound = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return zip || compound;
}
