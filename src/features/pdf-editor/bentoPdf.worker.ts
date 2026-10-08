/// <reference lib="webworker" />

import type { PyMuPDF } from "@bentopdf/pymupdf-wasm";

type Request = { id: number; type: "docx" | "xlsx"; pdf: Blob; fileName: string } | { id: number; type: "page-image-docx"; pages: Array<{ blob: Blob; width: number; height: number }> } | { id: number; type: "select-pages" | "profile-pages"; pdf: Blob; pages: number[] };
const scope = self as DedicatedWorkerGlobalScope;
let runtime: PyMuPDF | undefined;
let loading: Promise<PyMuPDF> | undefined;
let queue = Promise.resolve();

function engine() {
  if (runtime) return Promise.resolve(runtime);
  loading ??= (async () => {
    const base = new URL(`${import.meta.env.BASE_URL}vendor/bento-pymupdf/0.11.16/`, self.location.origin).href;
    const module = await import(/* @vite-ignore */ `${base}dist/index.js`) as typeof import("@bentopdf/pymupdf-wasm");
    const instance = new module.PyMuPDF({ assetPath: `${base}assets/` });
    await instance.load();
    runtime = instance;
    return instance;
  })().catch(error => { loading = undefined; runtime = undefined; throw error; });
  return loading;
}

scope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      scope.postMessage({ id: request.id, type: "progress", value: 5 });
      const pdf = await engine();
      scope.postMessage({ id: request.id, type: "progress", value: 28 });
      if (request.type === "profile-pages") {
        const profiles = await (pdf as PyMuPDF & { inspectTextLayers(input: Blob, pages: number[]): Promise<unknown[]> }).inspectTextLayers(request.pdf, request.pages);
        scope.postMessage({ id: request.id, type: "result", blob: new Blob(), profiles });
      } else if (request.type === "select-pages") {
        const doc = await pdf.open(request.pdf);
        try {
          doc.selectPages(request.pages);
          scope.postMessage({ id: request.id, type: "result", blob: doc.saveAsBlob() });
        } finally { doc.close(); }
      } else if (request.type === "page-image-docx") {
        const blob = await (pdf as PyMuPDF & { pageImagesToDocx(pages: Array<{ blob: Blob; width: number; height: number }>): Promise<Blob> }).pageImagesToDocx(request.pages);
        scope.postMessage({ id: request.id, type: "result", blob });
      } else if (request.type === "docx") {
        const blob = await pdf.pdfToDocx(request.pdf);
        scope.postMessage({ id: request.id, type: "result", blob });
      } else {
        const doc = await pdf.open(request.pdf);
        const tables: Array<{ page: number; rows: (string | null)[][] }> = [];
        try {
          for (let index = 0; index < doc.pageCount; index += 1) {
            const page = doc.getPage(index);
            for (const table of page.findTables()) tables.push({ page: index + 1, rows: table.rows });
            scope.postMessage({ id: request.id, type: "progress", value: 28 + 55 * (index + 1) / doc.pageCount });
          }
        } finally { doc.close(); }
        if (!tables.length) throw new Error("NO_TABLES");
        // BentoPDF src/js/workflow/nodes/pdf-to-xlsx-node.ts convertToXlsx,
        // 3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97: findTables + SheetJS.
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        for (const [index, table] of tables.entries()) {
          const worksheet = XLSX.utils.aoa_to_sheet(table.rows);
          XLSX.utils.book_append_sheet(workbook, worksheet, tables.length === 1 ? "Table" : `Table ${index + 1} (Page ${table.page})`.slice(0, 31));
        }
        const blob = new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        scope.postMessage({ id: request.id, type: "result", blob, tableCount: tables.length, tablePages: [...new Set(tables.map(table => table.page - 1))] });
      }
    } catch (error) {
      scope.postMessage({ id: request.id, type: "error", code: error instanceof Error ? error.message : String(error) });
    }
  });
};
