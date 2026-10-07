/// <reference lib="webworker" />
import conversionScript from "./convert.py?raw";
import pyodidePackage from "pyodide/package.json";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const base = new URL(import.meta.env.BASE_URL, self.location.origin);
const runtimeBase = new URL("vendor/pyodide/" + pyodidePackage.version + "/", base).href;
const converterBase = new URL("vendor/markitdown/0.1.8/", base).href;
const originalFetch = globalThis.fetch.bind(globalThis);
// Pyodide must never fall back to a CDN for missing deployed packages.
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), self.location.href);
  if (url.origin !== self.location.origin) return Promise.reject(new Error("EXTERNAL_REQUEST_BLOCKED"));
  return originalFetch(input, init);
};
function progress(value: number, phase: string) {
  scope.postMessage({ type: "progress", progress: value, phase });
}
scope.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; extension: string }>) => {
  let pyodide: Awaited<ReturnType<(typeof import("pyodide"))["loadPyodide"]>> | undefined;
  let convert: { (extension: string): string; destroy(): void } | undefined;
  try {
    progress(5, "runtime");
    const response = await fetch(converterBase + "manifest.json");
    if (!response.ok) throw new Error("RUNTIME_UNAVAILABLE");
    const manifest = await response.json() as {
      version: string; pyodideVersion: string; pyodidePackages: string[];
      bundle: { file: string; sha256: string; bytes: number };
    };
    if (manifest.version !== "0.1.8" || manifest.pyodideVersion !== pyodidePackage.version || manifest.bundle.file !== "converters.zip") {
      throw new Error("RUNTIME_UNAVAILABLE");
    }
    const module = await import(/* @vite-ignore */ runtimeBase + "pyodide.mjs");
    pyodide = await module.loadPyodide({ indexURL: runtimeBase });
    progress(20, "packages");
    await pyodide!.loadPackage(manifest.pyodidePackages, {
      messageCallback: () => progress(35, "packages"),
      errorCallback: () => { /* Failure is handled by loadPackage/import below. */ },
    });
    progress(60, "packages");
    const archive = await fetch(converterBase + manifest.bundle.file);
    if (!archive.ok) throw new Error("RUNTIME_UNAVAILABLE");
    const bytes = await archive.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
    if (bytes.byteLength !== manifest.bundle.bytes || digest !== manifest.bundle.sha256) throw new Error("RUNTIME_UNAVAILABLE");
    pyodide!.unpackArchive(bytes, "zip", { extractDir: "/lib/python3.13/site-packages" });
    pyodide!.FS.writeFile("/tmp/input", new Uint8Array(event.data.buffer));
    progress(80, "converting");
    pyodide!.runPython(conversionScript);
    convert = pyodide!.globals.get("convert_document") as typeof convert;
    const markdown = convert!(event.data.extension);
    scope.postMessage({ type: "result", result: markdown });
  } catch (reason) {
    const message = String(reason);
    const code = message.includes("NO_TEXT") ? "NO_TEXT"
      : /PDFPasswordIncorrect|Password|encrypted/i.test(message) ? "ENCRYPTED"
      : /RUNTIME_UNAVAILABLE|EXTERNAL_REQUEST_BLOCKED|Failed to fetch|network error/i.test(message) ? "RUNTIME_UNAVAILABLE"
      : "CONVERSION_FAILED";
    scope.postMessage({ type: "error", code });
  } finally {
    convert?.destroy();
    try { pyodide?.FS.unlink("/tmp/input"); } catch { /* No input was installed. */ }
  }
};
