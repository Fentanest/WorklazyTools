import { Download, FileCheck2, FileText, FolderOpen, RefreshCw, X } from "lucide-react";
import { createEditor, type HmlSaveState, type RhwpEditor } from "@rhwp/editor";
import { useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, FileList, PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { UtilityPage } from "../../components/UtilitySurface";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { getRhwpStudioUrl } from "../../config/rhwp";
import { cn } from "../../lib/utils";

type ExportFormat = "hwp" | "hwpx" | "hml";

export function HwpEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [editorReady, setEditorReady] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [hmlSaveState, setHmlSaveState] = useState<HmlSaveState>();
  const [exporting, setExporting] = useState<ExportFormat>();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RhwpEditor | undefined>(undefined);
  const editorPromiseRef = useRef<Promise<RhwpEditor> | undefined>(undefined);
  const progress = useOperationProgress();
  const file = files[0];

  useEffect(() => {
    let disposed = false;
    const initialize = async () => {
      if (!containerRef.current) throw new Error("편집기 표시 영역을 찾지 못했습니다.");
      progress.start("공식 rhwp 편집기를 준비하는 중…");
      const editor = await createEditor(containerRef.current, {
        studioUrl: getRhwpStudioUrl(),
        renderer: "canvas2d",
        width: "100%",
        height: "100%",
        requestTimeoutMs: 120_000,
        handshakeTimeoutMs: 4_000,
      });
      if (disposed) {
        editor.destroy();
        throw new DOMException("편집기 화면이 닫혔습니다.", "AbortError");
      }
      editor.element.title = "rhwp HWP 문서 편집기";
      editorRef.current = editor;
      setEditorReady(true);
      progress.succeed("HWP 편집기를 사용할 수 있습니다.");
      return editor;
    };

    editorPromiseRef.current = initialize();
    editorPromiseRef.current.catch((error) => {
      if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
        progress.fail(normalizeEditorError(error));
      }
    });

    return () => {
      disposed = true;
      editorRef.current?.destroy();
      editorRef.current = undefined;
      editorPromiseRef.current = undefined;
    };
  }, [progress.fail, progress.start, progress.succeed]);

  const getEditor = async () => {
    const editor = editorRef.current ?? await editorPromiseRef.current;
    if (!editor) throw new Error("편집기가 아직 준비되지 않았습니다.");
    return editor;
  };

  const openDocument = async (nextFile: File) => {
    progress.start(`${nextFile.name} 파일을 편집기에서 여는 중…`);
    try {
      const editor = await getEditor();
      const result = await editor.loadFile(await nextFile.arrayBuffer(), nextFile.name, {
        skipUnsavedGuard: false,
        suppressDialogs: false,
      });
      setPageCount(result.pageCount);
      setDocumentOpen(true);
      setDocumentName(nextFile.name);
      try {
        setHmlSaveState(await editor.getHmlSaveState());
      } catch {
        setHmlSaveState(undefined);
      }
      progress.succeed(`${result.pageCount}페이지 문서를 편집기에서 열었습니다.`);
    } catch (error) {
      progress.fail(normalizeEditorError(error));
    }
  };

  const selectFiles = (next: File[]) => {
    const selected = next.slice(-1);
    setFiles(selected);
    const nextFile = selected[0];
    if (nextFile) void openDocument(nextFile);
  };

  const exportDocument = async (format: ExportFormat) => {
    if (!documentOpen || exporting) return;
    setExporting(format);
    progress.start(`${format.toUpperCase()} 파일을 만드는 중…`);
    try {
      const editor = await getEditor();
      if (format === "hml") {
        const state = await editor.getHmlSaveState();
        setHmlSaveState(state);
        if (!state.hmlSavable) {
          const reasons = state.blockers.map((item) => item.message).filter(Boolean).slice(0, 3).join(" · ");
          throw new Error(reasons || "이 문서는 HML 형식으로 저장할 수 없습니다.");
        }
      }

      let verificationMessage = "";
      if (format === "hwp") {
        const verification = await editor.exportHwpVerify();
        if (!verification.recovered || verification.pageCountBefore !== verification.pageCountAfter) {
          throw new Error("HWP 저장 자체 검증에서 페이지 구조가 일치하지 않아 다운로드를 중단했습니다.");
        }
        verificationMessage = " · 재열기 검증 완료";
      }

      const bytes = format === "hwp"
        ? await editor.exportHwp()
        : format === "hwpx"
          ? await editor.exportHwpx()
          : await editor.exportHml();
      const outputName = `${stripExtension(documentName || "worklazy-document")}-편집.${format}`;
      downloadBlob(new Blob([copyArrayBuffer(bytes)], { type: mimeTypeFor(format) }), outputName);
      try {
        await editor.notifySaved(outputName);
      } catch {
        // 구버전 Studio는 저장 완료 통지를 지원하지 않을 수 있다. 다운로드 결과는 유효하다.
      }
      progress.succeed(`${outputName} 다운로드를 시작했습니다${verificationMessage}.`);
    } catch (error) {
      progress.fail(normalizeEditorError(error));
    } finally {
      setExporting(undefined);
    }
  };

  const progressToneClass = progress.status === "error"
    ? "text-destructive"
    : progress.status === "running"
      ? "text-orange-600 dark:text-orange-300"
      : undefined;

  return (
    <UtilityPage
      toolId="hwp-editor"
      flush={documentOpen}
      className={documentOpen ? "fixed inset-y-0 right-0 left-[280px] z-20 m-0 flex h-dvh w-auto max-w-none flex-col overflow-hidden bg-background p-2 [animation:none] max-[1020px]:left-[250px] max-[820px]:inset-x-0 max-[820px]:top-[72px] max-[820px]:z-[60] max-[820px]:h-[calc(100dvh-72px)] max-[820px]:p-0 max-[820px]:[&~.global-footer]:hidden" : undefined}
    >
      {!documentOpen && <>
        <PageHeader eyebrow="HWP EDITOR" title="HWP·HWPX 문서 편집" description="공식 rhwp Studio의 메뉴·도구 모음·서식·표 편집 기능을 그대로 사용하고 다시 HWP·HWPX로 저장하세요.">
          <PrivacyBanner compact />
        </PageHeader>

        <SectionCard step={1} title="문서 열기" description="파일을 선택하면 아래 편집기에 바로 열립니다. 암호가 있으면 편집기 안에서 입력할 수 있습니다.">
          <FileDropZone files={files} onFiles={selectFiles} accept=".hwp,.hwpx,.hml,application/x-hwp,application/xml,text/xml" hint="HWP·HWPX·HML · 선택 즉시 편집기에서 열기" accent="orange" />
          <FileList files={files} onRemove={() => setFiles([])} accent="orange" />
          {file && editorReady && (
            <div className="mt-[11px] flex flex-wrap items-center gap-2 max-[620px]:[&>*]:w-full">
              <PrimaryButton accent="orange" loading={progress.status === "running"} onClick={() => void openDocument(file)}><RefreshCw size={18} /> 다시 열기</PrimaryButton>
            </div>
          )}
        </SectionCard>

        <OperationProgress {...progress} accent="orange" title="HWP 편집기 로그" />
      </>}

      <SectionCard step={2} title="문서 편집기" description={documentOpen ? `${documentName || "문서"} · ${pageCount}페이지` : "편집기가 준비되면 파일을 선택하거나 편집기 안의 파일 → 열기를 이용하세요."} className={documentOpen ? "!m-0 flex h-full flex-col !gap-0 overflow-hidden !rounded-2xl !border-0 !bg-card !p-0 shadow-xl [backdrop-filter:none] [&>.ui-section-heading]:hidden max-[820px]:!rounded-none" : "!mt-0 mb-[15px]"}>
        {documentOpen && <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 bg-card py-[7px] pr-2.5 pl-[13px] min-[821px]:pr-[133px] max-[620px]:min-h-[94px] max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-1.5 max-[620px]:p-[7px]" data-testid="hwp-focus-toolbar">
          <div className="flex min-w-0 items-center gap-[9px] text-orange-600 max-[620px]:min-h-[31px] max-[620px]:px-1 dark:text-orange-300" data-testid="hwp-focus-document">
            <FileText size={18} />
            <span className="flex min-w-0 flex-col gap-0.5"><strong className="max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground max-[620px]:max-w-60">{documentName || "HWP 문서"}</strong><small aria-live="polite" className={cn("text-xs tabular-nums text-muted-foreground", progressToneClass)}>{pageCount}페이지 · {progress.status === "running" || progress.status === "error" ? progress.message : "브라우저에서 편집 중"}</small></span>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5" data-testid="hwp-focus-actions">
            <Button className="h-9 rounded-xl px-[11px] text-[13px] font-bold" variant="secondary" type="button" onClick={() => setDocumentOpen(false)}><X size={16} /> 도구 화면</Button>
            <label className="relative inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-secondary px-[11px] text-[13px] font-bold whitespace-nowrap text-secondary-foreground transition-colors hover:bg-muted"><FolderOpen size={16} /> 다른 문서
              <input className="sr-only" data-testid="hwp-focus-open" type="file" accept=".hwp,.hwpx,.hml,application/x-hwp,application/xml,text/xml" onChange={(event) => { const next = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; selectFiles(next); }} />
            </label>
            <Button className="h-9 rounded-xl bg-orange-700 px-[11px] text-[13px] font-bold text-white shadow-md shadow-orange-700/20 hover:bg-orange-800" data-testid="hwp-save" type="button" disabled={Boolean(exporting)} onClick={() => void exportDocument("hwp")}><Download size={16} /> {exporting === "hwp" ? "저장 중…" : "HWP 저장"}</Button>
            <Button className="h-9 rounded-xl px-[11px] text-[13px] font-bold" variant="secondary" type="button" disabled={Boolean(exporting)} onClick={() => void exportDocument("hwpx")}><Download size={16} /> HWPX</Button>
            <Button className="h-9 rounded-xl px-[11px] text-[13px] font-bold" variant="secondary" type="button" disabled={Boolean(exporting) || hmlSaveState?.hmlSavable === false} onClick={() => void exportDocument("hml")}><Download size={16} /> HML</Button>
          </div>
        </div>}
        {!documentOpen && <div className="mb-[11px] flex items-start gap-[9px] rounded-xl bg-orange-500/10 px-3 py-2.5 text-orange-700 dark:text-orange-300">
          <FileCheck2 className="mt-px shrink-0" size={18} />
          <span className="flex flex-col gap-[3px]"><strong className="text-[13px] text-foreground">이 사이트에 포함된 공식 rhwp Studio</strong><small className="text-[13px] leading-5 text-muted-foreground">버전이 고정된 편집기·WASM·글꼴을 Worklazy Tools의 정적 자산에서 불러오며, 선택한 파일은 브라우저 내부 MessageChannel로 전달됩니다.</small></span>
        </div>}
        <div ref={containerRef} className={cn("h-[clamp(680px,78vh,980px)] w-full overflow-hidden rounded-2xl border border-border bg-[#f4f5f7] shadow-[0_16px_42px_rgba(30,35,50,.12)] empty:relative empty:bg-[linear-gradient(145deg,var(--muted),var(--card))] empty:after:absolute empty:after:inset-0 empty:after:grid empty:after:place-items-center empty:after:text-sm empty:after:font-bold empty:after:text-muted-foreground empty:after:content-['rhwp_편집기를_불러오는_중…'] [&>iframe]:block [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0 [&>iframe]:bg-white max-[620px]:h-[max(620px,78vh)] max-[620px]:rounded-lg dark:border-white/15 dark:shadow-[0_20px_50px_rgba(0,0,0,.38)]", documentOpen && "h-auto min-h-0 flex-1 rounded-none border-0 border-t border-border shadow-none max-[620px]:h-auto max-[620px]:rounded-none")} data-testid="hwp-editor-shell" aria-label="HWP 문서 편집기" />
        {documentOpen && <RhwpVersionNotice mode="editor" compact />}
      </SectionCard>

      {!documentOpen && <ToolGuide
        title="브라우저 HWP 편집 안내"
        description="Worklazy Tools에 포함된 공식 rhwp Studio가 별도 변환 서버 없이 브라우저 안에서 문서를 열고 편집·저장합니다."
        blocks={[
          { title: "편집 기능", paragraphs: ["글자 입력과 선택, 실행 취소·다시 실행, 글꼴·크기·강조·정렬·줄 간격, 표·그림·도형·수식·각주·미주·책갈피, 찾기와 문서 비교 등 현재 rhwp Studio에 활성화된 기능을 그대로 제공합니다."] },
          { title: "저장 형식", paragraphs: ["편집 결과는 HWP와 HWPX로 내려받을 수 있습니다. XML 기반 한글 문서 형식인 HML 저장은 원본 구조가 공식 저장 조건을 만족할 때만 활성화되며, PDF는 편집기의 파일 메뉴에서 브라우저 인쇄 기능을 이용합니다."] },
          { title: "공식 편집기 업데이트", paragraphs: ["Worklazy Tools는 rhwp 내부 코드를 수정하지 않습니다. 공식 릴리스의 버전과 커밋·파일 해시를 고정해 이 사이트에 포함하며, 새 버전은 실제 문서 열기·편집·저장 회귀 테스트를 통과한 뒤 교체합니다."] },
        ]}
        faq={[
          { question: "문서가 변환 서버로 업로드되나요?", answer: "아니요. 파일 바이트는 같은 Worklazy Tools 배포물에 포함된 rhwp 편집기로 브라우저 MessageChannel을 통해 전달됩니다. 편집기 실행 파일과 WASM·글꼴도 외부 rhwp 사이트가 아니라 이 사이트에서 받습니다." },
          { question: "암호 문서는 어떻게 여나요?", answer: "파일을 선택한 뒤 rhwp 편집기에서 표시하는 암호 입력 창을 사용하세요. 암호 역시 브라우저의 편집기 실행 공간에서만 사용됩니다." },
          { question: "한글 프로그램의 모든 기능과 같나요?", answer: "아닙니다. 화면에는 현재 upstream rhwp Studio가 구현하고 활성화한 기능만 표시됩니다. 비활성 메뉴와 아직 upstream에 없는 기능을 Worklazy Tools가 임의로 구현하지는 않습니다." },
          { question: "편집한 파일을 다시 HWP로 받을 수 있나요?", answer: "가능합니다. HWP 저장 시 공식 직렬화와 재열기 검증을 통과한 뒤 다운로드합니다. HWPX 저장도 함께 제공합니다." },
          { question: "편집 중 화면을 닫으면 어떻게 되나요?", answer: "공식 Studio는 브라우저 저장 공간을 이용한 복구 기능을 제공할 수 있지만, 중요한 작업은 중간중간 파일로 내려받아 별도 보관하는 것이 안전합니다." },
        ]}
      />}
      {!documentOpen && <RhwpVersionNotice mode="editor" />}
    </UtilityPage>
  );
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function mimeTypeFor(format: ExportFormat) {
  if (format === "hwp") return "application/x-hwp";
  if (format === "hwpx") return "application/vnd.hancom.hwpx";
  return "application/xml";
}

function copyArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function normalizeEditorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|initialization|connect/i.test(message)) return "공식 rhwp 편집기를 불러오지 못했습니다. 네트워크 연결이나 콘텐츠 차단 설정을 확인해 주세요.";
  if (/password|비밀번호|암호/i.test(message)) return "암호를 확인한 뒤 문서를 다시 열어 주세요.";
  if (/unsaved|저장되지|cancel/i.test(message)) return "현재 문서의 미저장 변경 확인 과정에서 열기를 취소했습니다.";
  return message || "HWP 편집 작업에 실패했습니다.";
}
