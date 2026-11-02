import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

// Execute the actual panel and React state. Raster/ZIP IO and the surrounding
// UI are fixtures; input, conversion, removal, selection and labels are real.
async function mountPanel(language: "ko" | "en") {
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost/${language}/tools/pdf-converter/pdf-to-image/` });
  const originals = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of ["window", "document", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key as "window"] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const messages = JSON.parse(fs.readFileSync(`src/locales/${language}/common.json`, "utf8"));
  const t = (key: string) => key.split(".").reduce((value, part) => value?.[part], messages) ?? key;
  let zone: any;
  const sender = { reason: undefined as string | undefined, send() {} };
  const shell = ({ children, ...props }: any) => React.createElement("div", Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith("data-"))), children);
  const button = ({ children, onClick, disabled, ...props }: any) => React.createElement("button", { onClick, disabled, ...Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith("data-"))) }, children);
  const fallback = new Proxy({}, { get: (_target, key) => key === "__esModule" ? true : shell });
  const archive = { files: Object.fromEntries(["page-1.png", "page-2.png"].map(name => [name, { dir: false, async: async () => new Uint8Array([1]) }])) };
  const require = (id: string): any => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return jsx;
    if (id === "jszip") return { __esModule: true, default: { loadAsync: async () => archive } };
    if (id === "react-i18next") return { useTranslation: () => ({ t }) };
    if (id.endsWith("/AppShell")) return { useMemoryHandoff: () => sender };
    if (id.endsWith("/routing")) return { useAppLanguage: () => language };
    if (id.endsWith("/featureMessages")) return { featureMessage: (_language: string, key: string) => key };
    if (id.endsWith("/useHandoffReceiver")) return { useHandoffReceiver: () => ({ notReceived: false, recoveryFiles: [], dismiss() {} }) };
    if (id.endsWith("/toolState")) return { useUnsavedWorkGuard() {}, setUnsavedWork() {} };
    if (id.endsWith("/useOperationProgress")) return { useOperationProgress: () => ({ status: "idle", start() {}, succeed() {}, fail() {}, reset() {}, update() {} }) };
    if (id === "./pdfPreview") return { inspectPdf: async () => ({ pageCount: 2 }), releasePdf: async () => {}, pdfToImageArchive: async () => ({ blob: new Blob(["synthetic archive"]), fileName: "pages.zip" }) };
    if (id === "./PdfThumbnail") return { PdfThumbnail: () => React.createElement("div", { "data-testid": "pdf-page-card" }) };
    if (id === "./pdfUi") return { PdfError: () => null, PdfDownloadCard: () => React.createElement("div", { "data-testid": "pdf-download" }), useDownloadResult: () => {
      const [result, setResult] = React.useState<any>(null);
      return { result, clearResult: () => setResult(null), makeBlobResult: () => setResult({ fileName: "pages.zip" }) };
    } };
    if (id === "../../components/ui") return { FileDropZone: (props: any) => { zone = props; return null; }, FileList: ({ onRemove }: any) => React.createElement("button", { "data-testid": "remove-pdf", onClick: onRemove }, "Remove"), SectionCard: shell, SegmentedControl: () => null, PrimaryButton: (props: any) => button({ ...props, "data-testid": "convert-pdf" }) };
    if (id.endsWith("/ui/button")) return { Button: button };
    return fallback;
  };
  const file = path.resolve(process.env.PDF_IMAGE_SOURCE_ROOT ?? ".", "src/features/pdf-editor/PdfImagePanel.tsx");
  const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { require, exports, File, Blob, AbortController, Set, Map, console }, { filename: file });
  const root = createRoot(dom.window.document.getElementById("root")!);
  await React.act(async () => root.render(React.createElement(exports.PdfImagePanel, { direction: "pdf-to-image" })));
  const query = (selector: string) => dom.window.document.querySelector(selector) as HTMLElement | null;
  return { sender, query, messages,
    async convert() {
      await React.act(async () => { zone.onFiles([new File(["synthetic"], "pages.pdf")]); await new Promise(resolve => setTimeout(resolve, 0)); });
      await React.act(async () => { query('[data-testid="convert-pdf"]')!.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
      assert.ok(query('[data-testid="pdf-image-result-grid"]'));
    },
    async remove() { await React.act(async () => query('[data-testid="remove-pdf"]')!.click()); },
    async toggle(index: number) { await React.act(async () => (dom.window.document.querySelectorAll('[data-testid="pdf-image-result-grid"] input')[index] as HTMLInputElement).click()); },
    async close() { await React.act(async () => root.unmount()); dom.window.close(); for (const [key, original] of originals) { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); } },
  };
}

for (const language of ["ko", "en"] as const) test(`PDF image removal clears the generated chooser and download (${language})`, async () => {
  const panel = await mountPanel(language);
  try {
    await panel.convert();
    assert.ok(panel.query('[data-testid="pdf-download"]'));
    assert.ok(panel.query('[data-testid="pdf-images-send-to-studio"]'));
    await panel.remove();
    assert.equal(!!panel.query('[data-testid="pdf-image-result-grid"]'), false, 'generated chooser must disappear');
    assert.equal(!!panel.query('[data-testid="pdf-images-send-to-studio"]'), false);
    assert.equal(!!panel.query('[data-testid="pdf-download"]'), false);
    assert.equal(!!panel.query('[data-testid="remove-pdf"]'), false);
    await panel.convert();
    assert.equal(document.querySelectorAll('[data-testid="pdf-image-result-grid"] input:checked').length, 2);
  } finally { await panel.close(); }
});

for (const language of ["ko", "en"] as const) test(`PDF image send label follows the selected count and preserves retry (${language})`, async () => {
  const panel = await mountPanel(language);
  const send = () => panel.query('[data-testid="pdf-images-send-to-studio"]') as HTMLButtonElement;
  try {
    await panel.convert();
    assert.equal(send().textContent, panel.messages.sendTo.editImages);
    assert.equal(send().disabled, false);
    await panel.toggle(1);
    assert.equal(send().textContent, panel.messages.sendTo.editImage);
    assert.equal(send().disabled, false);
    await panel.toggle(0);
    assert.equal(send().disabled, true);
    panel.sender.reason = "retryable failure";
    await panel.toggle(0);
    assert.equal(send().textContent, panel.messages.sendTo.retry);
    assert.equal(send().disabled, false);
  } finally { await panel.close(); }
});
