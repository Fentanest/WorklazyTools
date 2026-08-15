import { FileArchive, FileCheck2, Info, Layers3, Plus, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import type { AppLanguage } from "../../i18n/languages";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, parsePageRange, releasePdf, renderPdfPageAsJpeg } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { exportPdfGroups, imagesToPdf, mergePdfPages } from "./pdfWorkerClient";
import { createLocalId, normalizeRotation, type PdfPageItem, type PdfSourceFile } from "./types";
import { movePdfItem as moveItem } from "./pdfShared";

type OutputMode = "merged" | "ranges" | "separate";

interface RangeRow {
  id: string;
  name: string;
  range: string;
}

interface EvaluatedRangeRow extends RangeRow {
  indexes: number[];
  error: string;
}

export function PdfOrganizePanel() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const [sources, setSources] = useState<PdfSourceFile[]>([]);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selectionRange, setSelectionRange] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("merged");
  const [rangeRows, setRangeRows] = useState<RangeRow[]>(() => [createRangeRow(1, language)]);
  const [outputName, setOutputName] = useState(language === "ko" ? "Worklazy-PDF-편집" : "Worklazy-PDF-edited");
  const [watermarkText, setWatermarkText] = useState("");
  const [pageNumbers, setPageNumbers] = useState(false);
  const [imageCompression, setImageCompression] = useState(false);
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const multiRangePanelRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<PdfSourceFile[]>([]);
  const operation = useOperationProgress();
  const download = useDownloadResult();
  const locked = inspecting || operation.status === "running";

  useEffect(() => { sourcesRef.current = sources; }, [sources]);
  useEffect(() => () => { sourcesRef.current.forEach((source) => { void releasePdf(source.file); }); }, []);

  useEffect(() => {
    if (outputMode === "ranges") return;
    const indexes = pages.flatMap((page, index) => selectedPageIds.has(page.id) ? [index] : []);
    setSelectionRange(compactPageRange(indexes));
  }, [outputMode, pages, selectedPageIds]);

  useEffect(() => {
    if (outputMode !== "ranges") return;
    const frame = requestAnimationFrame(() => multiRangePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [outputMode]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || locked) return;
    const sortable = Sortable.create(grid, {
      animation: 170,
      handle: ".pdf-drag-handle",
      draggable: ".pdf-page-card",
      delay: 120,
      delayOnTouchOnly: true,
      fallbackTolerance: 4,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        restoreSortableDom(grid, oldIndex, newIndex);
        setPages((current) => moveItem(current, oldIndex, newIndex));
        download.clearResult();
      },
    });
    return () => sortable.destroy();
  }, [download, locked, pages.length]);

  const evaluatedRanges = useMemo(() => evaluateRangeRows(rangeRows, pages.length, language), [rangeRows, pages.length, language]);
  const groupMembership = useMemo(() => {
    const membership = new Map<string, number[]>();
    evaluatedRanges.forEach((row, groupIndex) => {
      if (row.error) return;
      row.indexes.forEach((pageIndex) => {
        const pageId = pages[pageIndex]?.id;
        if (pageId) membership.set(pageId, [...(membership.get(pageId) ?? []), groupIndex + 1]);
      });
    });
    return membership;
  }, [evaluatedRanges, pages]);
  const selectedPages = pages.filter((page) => selectedPageIds.has(page.id));
  const rangesValid = evaluatedRanges.length > 0 && evaluatedRanges.every((row) => !row.error);
  const rangePageCount = groupMembership.size;
  const resultFileCount = outputMode === "merged" ? (selectedPages.length ? 1 : 0) : outputMode === "ranges" ? (rangesValid ? rangeRows.length : 0) : selectedPages.length;

  const handleFiles = async (nextFiles: File[]) => {
    const incoming = nextFiles.filter((file) => !sources.some((source) => source.file === file));
    if (!incoming.length) return;
    setError("");
    setInspecting(true);
    download.clearResult();
    operation.start(L(`${incoming.length}개 PDF의 페이지를 확인하는 중…`, `Checking pages in ${incoming.length} PDFs…`));
    const addedSources: PdfSourceFile[] = [];
    const addedPages: PdfPageItem[] = [];
    try {
      for (let index = 0; index < incoming.length; index += 1) {
        const file = incoming[index];
        if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error(L(`${file.name}: PDF 파일만 추가할 수 있습니다.`, `${file.name}: only PDF files can be added.`));
        operation.update(8 + (index / incoming.length) * 82, L(`[${index + 1}/${incoming.length}] ${file.name} 페이지 확인 중…`, `[${index + 1}/${incoming.length}] Checking pages in ${file.name}…`));
        const inspected = await inspectPdf(file, language);
        const sourceId = createLocalId("pdf");
        addedSources.push({ id: sourceId, file, pageCount: inspected.pageCount });
        for (let pageIndex = 0; pageIndex < inspected.pageCount; pageIndex += 1) {
          addedPages.push({ id: createLocalId("page"), sourceId, sourceName: file.name, sourcePageIndex: pageIndex, rotation: 0 });
        }
      }
      setSources((current) => [...current, ...addedSources]);
      setPages((current) => [...current, ...addedPages]);
      setSelectedPageIds((current) => new Set([...current, ...addedPages.map((page) => page.id)]));
      operation.succeed(L(`${addedPages.length}개 페이지를 편집 화면에 추가하고 모두 선택했습니다.`, `Added and selected all ${addedPages.length} pages.`));
    } catch (reason) {
      addedSources.forEach((source) => { void releasePdf(source.file); });
      const message = reason instanceof Error ? reason.message : L("PDF 파일을 읽지 못했습니다.", "Unable to read the PDF files.");
      setError(message);
      operation.fail(message);
    } finally {
      setInspecting(false);
    }
  };

  const removeSource = (index: number) => {
    if (locked) return;
    const source = sources[index];
    if (!source) return;
    const removedIds = new Set(pages.filter((page) => page.sourceId === source.id).map((page) => page.id));
    setSources((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setPages((current) => current.filter((page) => page.sourceId !== source.id));
    setSelectedPageIds((current) => new Set([...current].filter((id) => !removedIds.has(id))));
    void releasePdf(source.file);
    download.clearResult();
  };

  const exportPdf = async () => {
    setError("");
    download.clearResult();
    operation.start(L("선택 페이지, 편집 순서와 회전값을 확인하는 중…", "Checking selected pages, order, and rotations…"));
    try {
      const sourceFiles = sources.map((source) => ({ id: source.id, file: source.file }));
      const archiveName = normalizeOutputName(outputName, L("Worklazy-PDF-편집", "Worklazy-PDF-edited"));
      if (outputMode === "merged") {
        if (!selectedPages.length) throw new Error(L("하나의 PDF로 저장할 페이지를 선택해 주세요.", "Select pages to save in one PDF."));
        const output = imageCompression
          ? await imagesToPdf(await Promise.all(selectedPages.map(async (page, index) => {
            const source = sources.find((candidate) => candidate.id === page.sourceId);
            if (!source) throw new Error(L("페이지 원본을 찾지 못했습니다.", "The source page could not be found."));
            operation.update(5 + (index / selectedPages.length) * 55, L(`[${index + 1}/${selectedPages.length}] 압축용 페이지를 렌더링하는 중…`, `[${index + 1}/${selectedPages.length}] Rendering compressed page…`));
            return renderPdfPageAsJpeg(source.file, page.sourcePageIndex, page.rotation, language);
          })), "image", archiveName, operation.update, language, { watermarkText, pageNumbers })
          : await mergePdfPages(sourceFiles, selectedPages.map(toPagePlan), archiveName, operation.update, language, { watermarkText, pageNumbers });
        download.makeResult(output);
        operation.succeed(L(`${selectedPages.length}개 선택 페이지를 하나의 PDF로 생성했습니다.`, `Created one PDF from ${selectedPages.length} selected pages.`));
        return;
      }

      let groups: Array<{ fileName: string; pages: ReturnType<typeof toPagePlan>[] }>;
      if (outputMode === "ranges") {
        if (!rangesValid) throw new Error(L("여러 범위의 파일명과 페이지 범위를 확인해 주세요.", "Check the file names and page ranges."));
        groups = evaluatedRanges.map((row) => ({ fileName: row.name, pages: row.indexes.map((index) => toPagePlan(pages[index])) }));
      } else {
        if (!selectedPages.length) throw new Error(L("페이지별 PDF로 저장할 페이지를 선택해 주세요.", "Select pages to save as separate PDFs."));
        groups = selectedPages.map((page) => {
          const position = pages.findIndex((candidate) => candidate.id === page.id) + 1;
          return { fileName: `${archiveName}-${String(position).padStart(3, "0")}`, pages: [toPagePlan(page)] };
        });
      }
      const output = await exportPdfGroups(sourceFiles, groups, archiveName, operation.update, language, { watermarkText, pageNumbers });
      download.makeResult(output);
      operation.succeed(L(`${groups.length}개 PDF를 만들어 ZIP으로 묶었습니다.`, `Created ${groups.length} PDFs and packed them into a ZIP.`));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("PDF를 생성하지 못했습니다.", "Unable to create the PDF output.");
      setError(message);
      operation.fail(message);
    }
  };

  const applySelectionRange = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (locked) return;
    try {
      const indexes = parsePageRange(selectionRange, pages.length, language);
      setSelectedPageIds(new Set(indexes.map((index) => pages[index].id)));
      setSelectionError("");
      setError("");
      download.clearResult();
    } catch (reason) {
      setSelectionError(reason instanceof Error ? reason.message : L("선택할 페이지 범위를 확인해 주세요.", "Check the page range to select."));
    }
  };

  const updateRangeRow = (id: string, field: "name" | "range", value: string) => {
    setRangeRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    download.clearResult();
  };

  const removePage = (id: string) => {
    if (locked) return;
    setPages((current) => current.filter((page) => page.id !== id));
    setSelectedPageIds((current) => { const next = new Set(current); next.delete(id); return next; });
    download.clearResult();
  };

  const rotatePage = (id: string) => {
    if (locked) return;
    setPages((current) => current.map((page) => page.id === id ? { ...page, rotation: normalizeRotation(page.rotation + 90) } : page));
    download.clearResult();
  };

  const movePage = (index: number, direction: -1 | 1) => {
    if (locked) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setPages((current) => moveItem(current, index, nextIndex));
    download.clearResult();
  };

  const setMode = (mode: OutputMode) => {
    if (mode === "ranges") {
      const selectedIndexes = pages.flatMap((page, index) => selectedPageIds.has(page.id) ? [index] : []);
      const selectedRange = compactPageRange(selectedIndexes);
      setRangeRows((current) => current.some((row) => row.range.trim())
        ? current
        : [{ ...(current[0] ?? createRangeRow(1, language)), range: selectedRange }]);
    }
    setOutputMode(mode);
    setSelectionError("");
    setError("");
    download.clearResult();
  };

  const selectAllPages = () => {
    setSelectedPageIds(new Set(pages.map((page) => page.id)));
    setSelectionError("");
    download.clearResult();
  };

  const clearPageSelection = () => {
    setSelectedPageIds(new Set());
    setSelectionError("");
    download.clearResult();
  };

  const togglePageSelection = (id: string) => {
    setSelectedPageIds((current) => toggleSetItem(current, id));
    setSelectionError("");
    download.clearResult();
  };

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={L("PDF 추가", "Add PDFs")} description={L("여러 PDF의 모든 페이지를 한 편집 화면에 불러옵니다.", "Load every page from multiple PDFs into one editor.")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" multiple files={sources.map((source) => source.file)} onFiles={handleFiles} disabled={locked} accent="violet" hint={L("PDF를 한 번에 고르거나 여러 번 나눠 추가하세요.", "Choose multiple PDFs at once or add more later.")} />
            <FileList files={sources.map((source) => source.file)} onRemove={removeSource} accent="violet" />
          </SectionCard>

          {!!pages.length && (
            <SectionCard step={2} title={L("페이지 편집·선택", "Edit and select pages")} description={outputMode === "ranges" ? L("결과별 범위를 지정하고, 페이지를 끌어서 이동하거나 회전·삭제하세요.", "Define each output range, then drag, rotate, or delete pages.") : L("현재 순서를 기준으로 출력할 페이지를 고르고, 끌어서 이동하거나 회전·삭제하세요.", "Choose output pages in the current order, then drag, rotate, or delete them.")} className="accent-context-violet pdf-page-section">
              <div className="pdf-editor-note"><Info size={15} /><span>{outputMode === "ranges" ? L("번호 배지는 페이지가 포함된 결과 범위를 뜻합니다. 휴지통은 모든 결과에서 해당 페이지를 제거하며, 회전값은 실제 출력 PDF에도 기록됩니다.", "Number badges show which output ranges include a page. Deleting removes it from every result, and rotations are written to the exported PDFs.") : L("선택 해제는 현재 출력에서만 제외합니다. 휴지통은 편집 목록에서 페이지를 완전히 제거하며, 회전값은 실제 출력 PDF에도 기록됩니다.", "Deselecting excludes a page from this output. Deleting removes it from the editor, and rotations are written to the exported PDF.")}</span></div>
              {outputMode === "ranges" ? (
                <div ref={multiRangePanelRef} className="pdf-multi-range-panel">
                  <div className="pdf-multi-range-heading">
                    <div><strong>{L("출력 범위 설정", "Output ranges")}</strong><span>{L("각 행이 하나의 PDF가 되며, 같은 페이지를 여러 결과에 넣을 수 있습니다.", "Each row creates one PDF, and a page may appear in multiple results.")}</span></div>
                    <button type="button" className="secondary-button" onClick={() => setRangeRows((current) => [...current, createRangeRow(current.length + 1, language)])}><Plus size={15} /> {L("범위 추가", "Add range")}</button>
                  </div>
                  <div className="pdf-range-groups">
                    {evaluatedRanges.map((row, index) => <div className={`pdf-range-group${row.error ? " invalid" : ""}`} key={row.id}>
                      <b>{index + 1}</b>
                      <label><span>{L("결과 파일명", "Output file name")}</span><input value={row.name} onChange={(event) => updateRangeRow(row.id, "name", event.target.value)} placeholder={`${L("분할", "split")}-${String(index + 1).padStart(2, "0")}`} /><small>.pdf</small></label>
                      <label><span>{L("현재 순서의 페이지 범위", "Page range in current order")}</span><input value={row.range} onChange={(event) => updateRangeRow(row.id, "range", event.target.value)} placeholder={L("예: 1-3, 5", "e.g. 1-3, 5")} /></label>
                      <button type="button" onClick={() => setRangeRows((current) => current.filter((candidate) => candidate.id !== row.id))} disabled={rangeRows.length === 1} aria-label={L(`${index + 1}번 범위 삭제`, `Delete range ${index + 1}`)}><Trash2 size={16} /></button>
                      {row.error && <em>{row.error}</em>}
                    </div>)}
                  </div>
                  <p className="pdf-range-help">{L("페이지 번호는 아래 편집 화면의 현재 순서를 따릅니다. 예를 들어", "Page numbers follow the current editor order. For example,")} <code>5, 1-3</code>{L("은 5, 1, 2, 3 순서의 PDF를 만듭니다.", " creates a PDF ordered 5, 1, 2, 3.")}</p>
                </div>
              ) : (
                <div className="pdf-selection-toolbar">
                  <div>
                    <button type="button" onClick={selectAllPages}>{L("전체 선택", "Select all")}</button>
                    <button type="button" onClick={clearPageSelection}>{L("선택 해제", "Clear selection")}</button>
                    <strong>{selectedPages.length}/{pages.length} {L("선택", "selected")}</strong>
                  </div>
                  <form className="pdf-selection-range-form" onSubmit={applySelectionRange} noValidate>
                    <label htmlFor="pdf-selection-range" className="visually-hidden">{L("선택할 페이지 범위", "Page range to select")}</label>
                    <input id="pdf-selection-range" value={selectionRange} onChange={(event) => { setSelectionRange(event.target.value); setSelectionError(""); }} placeholder={L("예: 1-3, 5", "e.g. 1-3, 5")} aria-invalid={!!selectionError} aria-describedby={selectionError ? "pdf-selection-range-error" : undefined} />
                    <button type="submit">{L("범위로 선택", "Select range")}</button>
                    {selectionError && <em id="pdf-selection-range-error" role="alert">{selectionError}</em>}
                  </form>
                </div>
              )}
              <div ref={gridRef} className="pdf-page-grid">
                {pages.map((page, index) => {
                  const source = sources.find((candidate) => candidate.id === page.sourceId);
                  if (!source) return null;
                  return <PdfThumbnail key={page.id} item={page} file={source.file} outputIndex={index} totalItems={pages.length} selected={outputMode !== "ranges" && selectedPageIds.has(page.id)} groupNumbers={outputMode === "ranges" ? groupMembership.get(page.id) : []} draggable={!locked} onSelect={locked || outputMode === "ranges" ? undefined : () => togglePageSelection(page.id)} onRotate={locked ? undefined : () => rotatePage(page.id)} onRemove={locked ? undefined : () => removePage(page.id)} onMove={locked ? undefined : (direction) => movePage(index, direction)} />;
                })}
              </div>
            </SectionCard>
          )}
        </div>

        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><Layers3 size={18} /><h2>{L("편집·출력 요약", "Edit & output summary")}</h2></div>
            <div className="pdf-output-mode-list" role="radiogroup" aria-label={L("PDF 출력 방식", "PDF output mode")}>
              <button type="button" role="radio" aria-checked={outputMode === "merged"} className={outputMode === "merged" ? "selected" : ""} onClick={() => setMode("merged")}><FileCheck2 size={16} /><span><strong>{L("하나의 PDF", "One PDF")}</strong><small>{L("선택 페이지를 현재 순서로 저장", "Save selected pages in current order")}</small></span></button>
              <button type="button" role="radio" aria-checked={outputMode === "ranges"} className={outputMode === "ranges" ? "selected" : ""} onClick={() => setMode("ranges")}><FileArchive size={16} /><span><strong>{L("여러 범위별 PDF", "One PDF per range")}</strong><small>{L("입력 행마다 PDF를 만들어 ZIP 저장", "Create each row as a PDF in a ZIP")}</small></span></button>
              <button type="button" role="radio" aria-checked={outputMode === "separate"} className={outputMode === "separate" ? "selected" : ""} onClick={() => setMode("separate")}><Layers3 size={16} /><span><strong>{L("페이지별 PDF", "One PDF per page")}</strong><small>{L("선택 페이지를 각각 나눠 ZIP 저장", "Split selected pages into a ZIP")}</small></span></button>
            </div>
            <dl>
              <div><dt>{L("원본 파일", "Source files")}</dt><dd>{sources.length}</dd></div>
              <div><dt>{outputMode === "ranges" ? L("범위 포함 페이지", "Pages in ranges") : L("선택 페이지", "Selected pages")}</dt><dd>{outputMode === "ranges" ? rangePageCount : selectedPages.length}</dd></div>
              <div><dt>{L("결과 PDF", "Output PDFs")}</dt><dd>{resultFileCount}</dd></div>
              <div><dt>{L("회전한 페이지", "Rotated pages")}</dt><dd>{pages.filter((page) => page.rotation).length}</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{outputMode === "merged" ? L("출력 파일명", "Output file name") : L("ZIP 파일명", "ZIP file name")}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.{outputMode === "merged" ? "pdf" : "zip"}</small></label>
            <label className="pdf-output-field"><span>{L("워터마크 문구 (선택)", "Watermark text (optional)")}</span><input value={watermarkText} maxLength={120} onChange={(event) => setWatermarkText(event.target.value)} placeholder={L("예: 사내 검토용", "e.g. INTERNAL REVIEW")} /></label>
            <ToggleRow label={L("페이지 번호 넣기", "Add page numbers")} description={L("각 결과 PDF의 아래쪽 가운데에 1부터 표시합니다.", "Number each output PDF from 1 at the bottom center.")} checked={pageNumbers} onChange={setPageNumbers} />
            <ToggleRow label={L("이미지 기반 압축", "Image-based compression")} description={outputMode === "merged" ? L("페이지를 144dpi JPEG로 다시 그려 용량을 줄입니다. 텍스트 검색·링크·양식은 사라집니다.", "Redraw pages as 144 dpi JPEG to reduce size. Text search, links, and forms are removed.") : L("하나의 PDF 출력에서만 사용할 수 있습니다.", "Available only when creating one PDF.")} checked={imageCompression && outputMode === "merged"} onChange={setImageCompression} disabled={outputMode !== "merged"} />
            <PrimaryButton accent="violet" disabled={!pages.length || !resultFileCount || inspecting || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}>{outputMode === "merged" ? <FileCheck2 size={18} /> : <FileArchive size={18} />} {outputMode === "merged" ? L("새 PDF 만들기", "Create PDF") : L("PDF ZIP 만들기", "Create PDF ZIP")}</PrimaryButton>
            <p className="prototype-note">{L("암호로 보호된 PDF는 보호를 해제한 사본이 필요합니다.", "Password-protected PDFs require an unlocked copy.")}</p>
          </section>
          <OperationProgress {...operation} accent="violet" title={L("PDF 편집·추출 로그", "PDF edit & extract log")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function createRangeRow(index: number, language: AppLanguage): RangeRow {
  return { id: createLocalId("pdf-range"), name: `${language === "ko" ? "분할" : "split"}-${String(index).padStart(2, "0")}`, range: "" };
}

function evaluateRangeRows(rows: RangeRow[], pageCount: number, language: AppLanguage): EvaluatedRangeRow[] {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const normalizedNames = rows.map((row) => normalizeOutputName(row.name, "").replace(/\.pdf$/i, "").toLocaleLowerCase());
  return rows.map((row, index) => {
    let indexes: number[] = [];
    let error = "";
    if (!row.name.trim()) error = L("결과 파일명을 입력해 주세요.", "Enter an output file name.");
    else if (normalizedNames.filter((name) => name === normalizedNames[index]).length > 1) error = L("다른 범위와 파일명이 중복됩니다.", "This file name duplicates another range.");
    else {
      try { indexes = parsePageRange(row.range, pageCount, language); }
      catch (reason) { error = reason instanceof Error ? reason.message : L("페이지 범위를 확인해 주세요.", "Check the page range."); }
    }
    return { ...row, indexes, error };
  });
}

function compactPageRange(indexes: number[]) {
  if (!indexes.length) return "";
  const numbers = [...new Set(indexes.map((index) => index + 1))].sort((left, right) => left - right);
  const parts: string[] = [];
  let start = numbers[0];
  let previous = numbers[0];
  for (let index = 1; index <= numbers.length; index += 1) {
    const current = numbers[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    parts.push(start === previous ? String(start) : `${start}-${previous}`);
    start = current;
    previous = current;
  }
  return parts.join(", ");
}

function toPagePlan(page: PdfPageItem) {
  return { sourceId: page.sourceId, pageIndex: page.sourcePageIndex, rotation: page.rotation };
}

function toggleSetItem(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function restoreSortableDom(container: HTMLElement, oldIndex: number, newIndex: number) {
  const moved = container.children.item(newIndex);
  if (!moved) return;
  container.removeChild(moved);
  container.insertBefore(moved, container.children.item(oldIndex));
}
