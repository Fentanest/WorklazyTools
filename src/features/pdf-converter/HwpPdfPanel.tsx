import { createEditor, type RhwpEditor } from "@rhwp/editor";
import { Printer, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UtilityNotice } from "../../components/UtilitySurface";
import { PrimaryButton, SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { getRhwpStudioUrl } from "../../config/rhwp";
import { useAppLanguage } from "../../i18n/routing";

/** Use rhwp's official vector/text print surface; the user saves through the browser. */
export function HwpPdfPanel({ file, onClear }: { file: File; onClear: () => void }) {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const container = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RhwpEditor | undefined>(undefined);
  const [pages, setPages] = useState<number>();
  const [error, setError] = useState(false);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    let disposed = false;
    let editor: RhwpEditor | undefined;
    const mount = document.createElement("div"); mount.style.height = "100%";
    container.current?.appendChild(mount);
    const timeout = window.setTimeout(() => {
      disposed = true; editor?.destroy(); editorRef.current = undefined; mount.remove(); setError(true);
    }, 120_000);
    setPages(undefined); setError(false); setPrinting(false);
    const initialize = async () => {
      if (!container.current) return;
      // Child document navigations use the worker at their own URL's scope.
      // GitHub Pages cannot set COEP headers, so await our existing root worker
      // before embedding the same-origin rhwp Studio/print documents.
      if (import.meta.env.PROD && "serviceWorker" in navigator) {
        const base = new URL(import.meta.env.BASE_URL, location.origin);
        const registration = await navigator.serviceWorker.register(new URL("service-worker.js", base), { scope: base.pathname, updateViaCache: "none" });
        const worker = registration.installing ?? registration.waiting ?? registration.active;
        if (!worker) throw new Error("print-isolation-unavailable");
        await new Promise<void>((resolve, reject) => {
          const check = () => {
            if (worker.state === "activated" || worker.state === "redundant") {
              worker.removeEventListener("statechange", check);
              if (worker.state === "activated") resolve(); else reject(new Error("print-isolation-unavailable"));
            }
          };
          worker.addEventListener("statechange", check); check();
        });
      }
      if (disposed) return;
      const url = new URL("index.html", getRhwpStudioUrl()); url.searchParams.set("lang", language);
      editor = await createEditor(mount, {
        studioUrl: url.href, renderer: "canvas2d", width: "100%", height: "100%",
        requestTimeoutMs: 120_000, handshakeTimeoutMs: 8_000,
      });
      if (disposed) { editor.destroy(); return; }
      editor.element.title = language === "ko" ? "HWP PDF 인쇄 미리보기" : "HWP PDF print preview";
      editorRef.current = editor;
      await editor.chrome.set({ menu: false, toolbar: false, statusbar: true });
      const result = await editor.loadFile(await file.arrayBuffer(), file.name, { skipUnsavedGuard: true, suppressDialogs: true });
      window.clearTimeout(timeout);
      if (!disposed) setPages(result.pageCount);
    };
    void initialize().catch(() => {
      window.clearTimeout(timeout);
      if (!disposed) { setError(true); editor?.destroy(); editorRef.current = undefined; mount.remove(); }
    });
    return () => { disposed = true; window.clearTimeout(timeout); editor?.destroy(); editorRef.current = undefined; mount.remove(); };
  }, [file, language]);
  const print = async () => {
    const editor = editorRef.current;
    if (!editor || pages === undefined || printing) return;
    setPrinting(true); setError(false);
    container.current?.scrollIntoView({ block: "center", behavior: "instant" });
    try {
      const result = await editor.commands.execute("file:print-to-pdf", {}, { allowDialog: true });
      if (!result.ok) throw new Error("print-unavailable");
    } catch { if (editorRef.current === editor) setError(true); }
    finally { if (editorRef.current === editor) setPrinting(false); }
    // Closing a print dialog is not proof that a file was saved. Keep the unsaved guard.
  };
  return <SectionCard step={2} title={L("HWP·HWPX PDF 저장", "Save HWP / HWPX as PDF")} description={L("문서 미리보기에서 페이지를 확인하세요.", "Check the pages in the document preview.")}>
    <UtilityNotice kind="info" className="mb-4">{L(
      "HWP·HWPX는 rhwp의 PDF 인쇄 기능을 사용합니다. 아래 버튼과 미리보기의 ‘인쇄 창 열기’를 누른 뒤 브라우저 인쇄 대상에서 ‘PDF로 저장’을 선택하세요. 저장 여부는 이 페이지에서 확인할 수 없습니다. 원본과 글꼴·표·페이지를 비교해 주세요.",
      "HWP / HWPX uses rhwp’s PDF print feature. Press the button below, then Open print dialog in the preview, and choose Save as PDF as the browser’s print destination. This page cannot confirm whether you saved the file. Compare fonts, tables, and pages with the original.")}</UtilityNotice>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <PrimaryButton accent="coral" disabled={pages === undefined || error || printing} loading={printing} onClick={() => void print()}><Printer size={17} />{L("인쇄 창에서 PDF 저장", "Save PDF using print")}</PrimaryButton>
      <Button variant="outline" onClick={onClear}><X size={16} />{L("문서 닫기", "Close document")}</Button>
      <span role="status" className="text-sm text-muted-foreground">{error ? L("문서를 다시 선택해 주세요.", "Choose the document again.") : pages === undefined ? L("문서를 여는 중…", "Opening document…") : L(`${pages}페이지`, `${pages} page(s)`)}</span>
    </div>
    {error && <UtilityNotice kind="error" role="alert">{L("문서를 열거나 PDF 인쇄를 준비하지 못했습니다. 문서를 닫고 손상되지 않은 암호 해제 사본으로 다시 시도해 주세요.", "Could not open the document or prepare PDF printing. Close the document and try an intact, unlocked copy.")}</UtilityNotice>}
    <div ref={container} data-testid="hwp-pdf-preview" className="h-[560px] min-w-0 overflow-hidden rounded-xl border border-border bg-white" />
  </SectionCard>;
}
