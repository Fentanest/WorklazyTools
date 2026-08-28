import { Download, FileArchive, FileCheck2, Info, Layers3, Plus, Scissors, Settings2, Trash2, X } from "lucide-react";
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
import { createLocalId, type PdfPageItem, type PdfSourceFile } from "./types";
import { compactPdfPageRange, mapWithConcurrency, movePdfItem as moveItem, normalizePdfRotation as normalizeRotation, splitPdfPageRanges } from "./pdfShared";
import { featureMessage } from "../../i18n/featureMessages";

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
    const [sources, setSources] = useState<PdfSourceFile[]>([]);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selectionRange, setSelectionRange] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("merged");
  const [rangeRows, setRangeRows] = useState<RangeRow[]>(() => [createRangeRow(1, language)]);
  const [activeRangeId, setActiveRangeId] = useState(() => rangeRows[0].id);
  const [quickSplitOpen, setQuickSplitOpen] = useState(false);
  const [splitAfterPageIds, setSplitAfterPageIds] = useState<Set<string>>(new Set());
  const [outputName, setOutputName] = useState(featureMessage(language, "pdf.messages.PdfOrganizePanel.worklazyPdfEdited"));
  const [watermarkText, setWatermarkText] = useState("");
  const [pageNumbers, setPageNumbers] = useState(false);
  const [imageCompression, setImageCompression] = useState(false);
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [mobileWorkspace, setMobileWorkspace] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const downloadResultRef = useRef<HTMLDivElement>(null);
  const mobileWorkspaceRef = useRef<HTMLElement>(null);
  const mobileWorkspaceTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileWorkspaceCloseRef = useRef<HTMLButtonElement>(null);
  const sourcesRef = useRef<PdfSourceFile[]>([]);
  const hadDownloadResultRef = useRef(false);
  const selectionAnchorsRef = useRef(new Map<string, string>());
  const operation = useOperationProgress();
  const download = useDownloadResult();
  const locked = inspecting || operation.status === "running";

  useEffect(() => { sourcesRef.current = sources; }, [sources]);
  useEffect(() => () => { sourcesRef.current.forEach((source) => { void releasePdf(source.file); }); }, []);

  useEffect(() => {
    if (outputMode === "ranges") return;
    const indexes = pages.flatMap((page, index) => selectedPageIds.has(page.id) ? [index] : []);
    setSelectionRange(compactPdfPageRange(indexes, true));
  }, [outputMode, pages, selectedPageIds]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const update = () => {
      setMobileWorkspace(query.matches);
      if (!query.matches) setMobileWorkspaceOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileWorkspaceOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => mobileWorkspaceCloseRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileOutputWorkspace();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(mobileWorkspaceRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileWorkspaceOpen]);

  useEffect(() => {
    if (rangeRows.some((row) => row.id === activeRangeId)) return;
    if (rangeRows[0]) setActiveRangeId(rangeRows[0].id);
  }, [activeRangeId, rangeRows]);

  useEffect(() => {
    if (!download.result) return;
    const frame = requestAnimationFrame(() => downloadResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [download.result]);

  useEffect(() => {
    if (download.result) {
      hadDownloadResultRef.current = true;
      return;
    }
    if (!hadDownloadResultRef.current) return;
    hadDownloadResultRef.current = false;
    operation.reset();
  }, [download.result, operation.reset]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || locked || quickSplitOpen) return;
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
  }, [download.clearResult, locked, pages.length, quickSplitOpen]);

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
  const activeRange = evaluatedRanges.find((row) => row.id === activeRangeId) ?? evaluatedRanges[0];
  let activeIndexes: number[] = [];
  try { if (activeRange) activeIndexes = parsePageRange(activeRange.range, pages.length, language); } catch { /* 입력 중인 범위는 아직 선택으로 표시하지 않습니다. */ }
  const activeRangeIndexes = new Set(activeIndexes);
  const rangesValid = evaluatedRanges.length > 0 && evaluatedRanges.every((row) => !row.error);
  const rangePageCount = groupMembership.size;
  const resultFileCount = outputMode === "merged" ? (selectedPages.length ? 1 : 0) : outputMode === "ranges" ? (rangesValid ? rangeRows.length : 0) : selectedPages.length;

  const handleFiles = async (nextFiles: File[]) => {
    const incoming = nextFiles.filter((file) => !sources.some((source) => source.file === file));
    if (!incoming.length) return;
    setError("");
    setInspecting(true);
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfOrganizePanel.checkingPagesInPdfs", { p0: incoming.length }));
    const addedSources: PdfSourceFile[] = [];
    const addedPages: PdfPageItem[] = [];
    try {
      for (let index = 0; index < incoming.length; index += 1) {
        const file = incoming[index];
        if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error(featureMessage(language, "pdf.messages.PdfOrganizePanel.onlyPdfFilesCanBeAdded", { p0: file.name }));
        operation.update(8 + (index / incoming.length) * 82, featureMessage(language, "pdf.messages.PdfOrganizePanel.checkingPagesIn", { p0: index + 1, p1: incoming.length, p2: file.name }));
        const inspected = await inspectPdf(file, language, { requirePdfLibCompatibility: true });
        const sourceId = createLocalId("pdf");
        addedSources.push({ id: sourceId, file, pageCount: inspected.pageCount });
        for (let pageIndex = 0; pageIndex < inspected.pageCount; pageIndex += 1) {
          addedPages.push({ id: createLocalId("page"), sourceId, sourceName: file.name, sourcePageIndex: pageIndex, rotation: 0 });
        }
      }
      setSources((current) => [...current, ...addedSources]);
      setPages((current) => [...current, ...addedPages]);
      setSelectedPageIds((current) => new Set([...current, ...addedPages.map((page) => page.id)]));
      operation.succeed(featureMessage(language, "pdf.messages.PdfOrganizePanel.addedAndSelectedAllPages", { p0: addedPages.length }));
    } catch (reason) {
      addedSources.forEach((source) => { void releasePdf(source.file); });
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfOrganizePanel.unableToReadThePdfFiles");
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
    setSplitAfterPageIds((current) => new Set([...current].filter((id) => !removedIds.has(id))));
    void releasePdf(source.file);
    download.clearResult();
  };

  const exportPdf = async () => {
    setError("");
    download.clearResult();
    operation.start(featureMessage(language, "pdf.messages.PdfOrganizePanel.checkingSelectedPagesOrderAndRotations"));
    try {
      const sourceFiles = sources.map((source) => ({ id: source.id, file: source.file }));
      const archiveName = normalizeOutputName(outputName, featureMessage(language, "pdf.messages.PdfOrganizePanel.worklazyPdfEdited"));
      if (outputMode === "merged") {
        if (!selectedPages.length) throw new Error(featureMessage(language, "pdf.messages.PdfOrganizePanel.selectPagesToSaveInOnePdf"));
        const output = imageCompression
          ? await imagesToPdf(await mapWithConcurrency(selectedPages, 4, async (page, index) => {
            const source = sources.find((candidate) => candidate.id === page.sourceId);
            if (!source) throw new Error(featureMessage(language, "pdf.messages.PdfOrganizePanel.theSourcePageCouldNotBeFound"));
            operation.update(5 + (index / selectedPages.length) * 55, featureMessage(language, "pdf.messages.PdfOrganizePanel.renderingCompressedPage", { p0: index + 1, p1: selectedPages.length }));
            return renderPdfPageAsJpeg(source.file, page.sourcePageIndex, page.rotation, language);
          }), "image", archiveName, operation.update, language, { watermarkText, pageNumbers, imagesAlreadyNormalized: true })
          : await mergePdfPages(sourceFiles, selectedPages.map(toPagePlan), archiveName, operation.update, language, { watermarkText, pageNumbers });
        download.makeResult(output);
        operation.succeed(featureMessage(language, "pdf.messages.PdfOrganizePanel.createdOnePdfFromSelectedPages", { p0: selectedPages.length }));
        return;
      }

      let groups: Array<{ fileName: string; pages: ReturnType<typeof toPagePlan>[] }>;
      if (outputMode === "ranges") {
        if (!rangesValid) throw new Error(featureMessage(language, "pdf.messages.PdfOrganizePanel.checkTheFileNamesAndPageRanges"));
        groups = evaluatedRanges.map((row) => ({ fileName: row.name, pages: row.indexes.map((index) => toPagePlan(pages[index])) }));
      } else {
        if (!selectedPages.length) throw new Error(featureMessage(language, "pdf.messages.PdfOrganizePanel.selectPagesToSaveAsSeparatePdfs"));
        groups = selectedPages.map((page) => {
          const position = pages.findIndex((candidate) => candidate.id === page.id) + 1;
          return { fileName: `${archiveName}-${String(position).padStart(3, "0")}`, pages: [toPagePlan(page)] };
        });
      }
      const output = await exportPdfGroups(sourceFiles, groups, archiveName, operation.update, language, { watermarkText, pageNumbers });
      download.makeResult(output);
      operation.succeed(featureMessage(language, "pdf.messages.PdfOrganizePanel.createdPdfsAndPackedThemIntoAZip", { p0: groups.length }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfOrganizePanel.unableToCreateThePdfOutput");
      setError(message);
      operation.fail(message);
      if (mobileWorkspace) setMobileWorkspaceOpen(true);
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
      setSelectionError(reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfOrganizePanel.checkThePageRangeToSelect"));
    }
  };

  const updateRangeRow = (id: string, field: "name" | "range", value: string) => {
    setRangeRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setActiveRangeId(id);
    download.clearResult();
  };

  const removePage = (id: string) => {
    if (locked) return;
    setPages((current) => current.filter((page) => page.id !== id));
    setSelectedPageIds((current) => { const next = new Set(current); next.delete(id); return next; });
    setSplitAfterPageIds((current) => { const next = new Set(current); next.delete(id); return next; });
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
      const selectedRange = compactPdfPageRange(selectedIndexes, true);
      setRangeRows((current) => current.some((row) => row.range.trim())
        ? current
        : [{ ...(current[0] ?? createRangeRow(1, language)), range: selectedRange }]);
    }
    setQuickSplitOpen(false);
    setSplitAfterPageIds(new Set());
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

  const togglePageSelection = (id: string, selected: boolean, extend: boolean) => {
    const affectedIds = extend ? pageIdsBetweenAnchor(pages, selectionAnchorsRef.current.get("single"), id) : [id];
    setSelectedPageIds((current) => setItemsSelected(current, affectedIds, selected));
    selectionAnchorsRef.current.set("single", id);
    setSelectionError("");
    download.clearResult();
  };

  const addRange = () => {
    const row = createRangeRow(rangeRows.length + 1, language);
    setRangeRows((current) => [...current, row]);
    setActiveRangeId(row.id);
    download.clearResult();
  };

  const removeRange = (id: string) => {
    if (rangeRows.length === 1) return;
    const removedIndex = rangeRows.findIndex((row) => row.id === id);
    const nextRows = rangeRows.filter((row) => row.id !== id);
    setRangeRows(nextRows);
    if (activeRangeId === id) setActiveRangeId(nextRows[Math.min(Math.max(removedIndex, 0), nextRows.length - 1)]?.id ?? "");
    selectionAnchorsRef.current.delete(id);
    download.clearResult();
  };

  const toggleRangePage = (id: string, selected: boolean, extend: boolean) => {
    const row = rangeRows.find((candidate) => candidate.id === activeRangeId) ?? rangeRows[0];
    if (!row) return;
    let indexes: number[] = [];
    try { indexes = parsePageRange(row.range, pages.length, language); } catch { /* 빈 범위는 체크한 페이지부터 구성합니다. */ }
    const pageIndex = pages.findIndex((page) => page.id === id);
    if (pageIndex < 0) return;
    const affectedIds = extend ? pageIdsBetweenAnchor(pages, selectionAnchorsRef.current.get(row.id), id) : [id];
    const affectedIndexes = affectedIds.map((pageId) => pages.findIndex((page) => page.id === pageId)).filter((index) => index >= 0);
    const nextIndexes = [...indexes];
    for (const index of affectedIndexes) {
      const position = nextIndexes.indexOf(index);
      if (selected && position < 0) nextIndexes.push(index);
      if (!selected && position >= 0) nextIndexes.splice(position, 1);
    }
    setRangeRows((current) => current.map((candidate) => candidate.id === row.id ? { ...candidate, range: compactPdfPageRange(nextIndexes) } : candidate));
    selectionAnchorsRef.current.set(row.id, id);
    setActiveRangeId(row.id);
    setError("");
    download.clearResult();
  };

  const setActiveRangePages = (selected: boolean) => {
    const row = rangeRows.find((candidate) => candidate.id === activeRangeId) ?? rangeRows[0];
    if (!row) return;
    setRangeRows((current) => current.map((candidate) => candidate.id === row.id ? { ...candidate, range: selected ? compactPdfPageRange(pages.map((_, index) => index)) : "" } : candidate));
    selectionAnchorsRef.current.delete(row.id);
    download.clearResult();
  };

  const toggleSplitAfter = (id: string) => {
    setSplitAfterPageIds((current) => toggleSetItem(current, id));
  };

  const startQuickSplit = () => {
    setQuickSplitOpen(true);
    setSplitAfterPageIds(new Set());
  };

  const cancelQuickSplit = () => {
    setQuickSplitOpen(false);
    setSplitAfterPageIds(new Set());
  };

  const applyQuickSplit = () => {
    const boundaryIndexes = pages.flatMap((page, index) => splitAfterPageIds.has(page.id) ? [index] : []);
    const groups = splitPdfPageRanges(pages.length, boundaryIndexes);
    const nextRows = groups.map((indexes, index) => ({
      id: rangeRows[index]?.id ?? createLocalId("pdf-range"),
      name: `${featureMessage(language, "pdf.messages.PdfOrganizePanel.split")}-${String(index + 1).padStart(2, "0")}`,
      range: compactPdfPageRange(indexes),
    }));
    setRangeRows(nextRows);
    setActiveRangeId(nextRows[0]?.id ?? "");
    cancelQuickSplit();
    setError("");
    download.clearResult();
  };

  function openMobileOutputWorkspace() {
    setMobileWorkspaceOpen(true);
  }

  function closeMobileOutputWorkspace() {
    setMobileWorkspaceOpen(false);
    requestAnimationFrame(() => mobileWorkspaceTriggerRef.current?.focus());
  }

  const exportDisabled = !pages.length || !resultFileCount || inspecting || operation.status === "running" || quickSplitOpen;
  const includedPageCount = outputMode === "ranges" ? rangePageCount : selectedPages.length;
  const createLabel = outputMode === "merged"
    ? featureMessage(language, "pdf.messages.PdfOrganizePanel.createPdf")
    : featureMessage(language, "pdf.messages.PdfOrganizePanel.createPdfZip");
  const creatingLabel = featureMessage(language, outputMode === "merged"
    ? "pdf.messages.PdfOrganizePanel.creatingPdf"
    : "pdf.messages.PdfOrganizePanel.creatingPdfZip", { p0: operation.progress });

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfOrganizePanel.addPdfs")} description={featureMessage(language, "pdf.messages.PdfOrganizePanel.loadEveryPageFromMultiplePdfsIntoOne")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" multiple files={sources.map((source) => source.file)} onFiles={handleFiles} disabled={locked} accent="violet" hint={featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseMultiplePdfsAtOnceOrAddMore")} />
            <FileList files={sources.map((source) => source.file)} onRemove={removeSource} accent="violet" />
          </SectionCard>

          {!!pages.length && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfOrganizePanel.editAndSelectPages")} description={outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.defineEachOutputRangeThenDragRotateOr") : featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseOutputPagesInTheCurrentOrderThen")} className="accent-context-violet pdf-page-section">
              <div className="pdf-editor-note"><Info size={15} /><span>{outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.numberBadgesShowWhichOutputRangesIncludeA") : featureMessage(language, "pdf.messages.PdfOrganizePanel.deselectingExcludesAPageFromThisOutputDeleting")}</span></div>
              {outputMode !== "ranges" && (
                <div className="pdf-selection-toolbar">
                  <div>
                    <button type="button" onClick={selectAllPages}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.selectAll")}</button>
                    <button type="button" onClick={clearPageSelection}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.clearSelection")}</button>
                    <strong>{selectedPages.length}/{pages.length} {featureMessage(language, "pdf.messages.PdfOrganizePanel.selected")}</strong>
                  </div>
                  <form className="pdf-selection-range-form" onSubmit={applySelectionRange} noValidate>
                    <label htmlFor="pdf-selection-range" className="visually-hidden">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageRangeToSelect")}</label>
                    <input id="pdf-selection-range" value={selectionRange} onChange={(event) => { setSelectionRange(event.target.value); setSelectionError(""); }} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eG135")} aria-invalid={!!selectionError} aria-describedby={selectionError ? "pdf-selection-range-error" : undefined} />
                    <button type="submit">{featureMessage(language, "pdf.messages.PdfOrganizePanel.selectRange")}</button>
                    {selectionError && <em id="pdf-selection-range-error" role="alert">{selectionError}</em>}
                  </form>
                </div>
              )}
              <div ref={gridRef} className="pdf-page-grid">
                {pages.map((page, index) => {
                  const source = sources.find((candidate) => candidate.id === page.sourceId);
                  if (!source) return null;
                  const pageEditingLocked = locked || quickSplitOpen;
                  return <PdfThumbnail key={page.id} item={page} file={source.file} outputIndex={index} totalItems={pages.length} selected={outputMode === "ranges" ? !quickSplitOpen && activeRangeIndexes.has(index) : selectedPageIds.has(page.id)} groupNumbers={outputMode === "ranges" ? groupMembership.get(page.id) : []} draggable={!pageEditingLocked} onSelect={locked || quickSplitOpen ? undefined : outputMode === "ranges" ? (selected, extend) => toggleRangePage(page.id, selected, extend) : (selected, extend) => togglePageSelection(page.id, selected, extend)} onSplitAfter={outputMode === "ranges" && quickSplitOpen && index < pages.length - 1 ? () => toggleSplitAfter(page.id) : undefined} splitAfter={splitAfterPageIds.has(page.id)} onRotate={pageEditingLocked ? undefined : () => rotatePage(page.id)} onRemove={pageEditingLocked ? undefined : () => removePage(page.id)} onMove={pageEditingLocked ? undefined : (direction) => movePage(index, direction)} />;
                })}
              </div>
            </SectionCard>
          )}
        </div>

        <div className={`pdf-output-sidebar-shell${mobileWorkspaceOpen ? " mobile-open" : ""}`} onMouseDown={() => mobileWorkspace && closeMobileOutputWorkspace()}>
          <aside ref={mobileWorkspaceRef} className="workflow-summary pdf-output-workspace" role={mobileWorkspace ? "dialog" : undefined} aria-modal={mobileWorkspace || undefined} aria-labelledby="pdf-output-workspace-title" onMouseDown={(event) => event.stopPropagation()}>
            <section className="summary-card pdf-output-card">
              <div className="pdf-output-mobile-header">
                <span className="sheet-grabber" />
                <button ref={mobileWorkspaceCloseRef} className="icon-button subtle" type="button" onClick={closeMobileOutputWorkspace} aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.closeOutputWorkspace")}><X size={20} /></button>
              </div>
              <div className="pdf-output-scroll">
                <div className="summary-title"><Layers3 size={18} /><h2 id="pdf-output-workspace-title">{featureMessage(language, "pdf.messages.PdfOrganizePanel.editOutputSummary")}</h2></div>
                <div className="pdf-output-mode-list" role="radiogroup" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.pdfOutputMode")}>
                  <button type="button" role="radio" aria-checked={outputMode === "merged"} className={outputMode === "merged" ? "selected" : ""} disabled={locked} onClick={() => setMode("merged")}><FileCheck2 size={16} /><span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdf")}</strong><small>{featureMessage(language, "pdf.messages.PdfOrganizePanel.saveSelectedPagesInCurrentOrder")}</small></span></button>
                  <button type="button" role="radio" aria-checked={outputMode === "ranges"} className={outputMode === "ranges" ? "selected" : ""} disabled={locked} onClick={() => setMode("ranges")}><FileArchive size={16} /><span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdfPerRange")}</strong><small>{featureMessage(language, "pdf.messages.PdfOrganizePanel.createEachRowAsAPdfInA")}</small></span></button>
                  <button type="button" role="radio" aria-checked={outputMode === "separate"} className={outputMode === "separate" ? "selected" : ""} disabled={locked} onClick={() => setMode("separate")}><Layers3 size={16} /><span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdfPerPage")}</strong><small>{featureMessage(language, "pdf.messages.PdfOrganizePanel.splitSelectedPagesIntoAZip")}</small></span></button>
                </div>

                {outputMode === "ranges" && (
                  <section className="pdf-multi-range-panel" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.outputRanges")}>
                    <div className="pdf-multi-range-heading">
                      <div><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputRanges")}</strong><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.eachRowCreatesOnePdfAndAPage")}</span></div>
                      <div className="pdf-multi-range-actions">
                        <button type="button" className="secondary-button" onClick={startQuickSplit} disabled={locked || quickSplitOpen}><Scissors size={15} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.quickContinuousSplit")}</button>
                        <button type="button" className="secondary-button" onClick={addRange} disabled={locked || quickSplitOpen}><Plus size={15} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.addRange")}</button>
                      </div>
                    </div>

                    {quickSplitOpen ? (
                      <div className="pdf-range-selection-toolbar quick-split" role="region" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.quickContinuousSplit")}>
                        <Scissors size={17} />
                        <div><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseWhereToSplit")}</strong><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.quickSplitReplacesCurrentRanges")}</span></div>
                        <b>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputCount", { p0: splitAfterPageIds.size + 1 })}</b>
                        <div className="pdf-range-toolbar-actions"><button type="button" onClick={cancelQuickSplit}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.cancel")}</button><button type="button" className="primary" onClick={applyQuickSplit}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.applyContinuousSplit")}</button></div>
                      </div>
                    ) : (
                      <div className="pdf-range-selection-toolbar" role="region" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.visualRangeSelection")}>
                        <label><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.editingRange")}</span><select value={activeRange?.id ?? ""} onChange={(event) => setActiveRangeId(event.target.value)}>{evaluatedRanges.map((row, index) => <option value={row.id} key={row.id}>{index + 1}. {row.name || featureMessage(language, "pdf.messages.PdfOrganizePanel.unnamedRange")}</option>)}</select></label>
                        <strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.pagesChecked", { p0: activeRangeIndexes.size, p1: pages.length })}</strong>
                        <span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.shiftClickSelectsBetween")}</span>
                        <div className="pdf-range-toolbar-actions"><button type="button" onClick={() => setActiveRangePages(true)}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.selectAll")}</button><button type="button" onClick={() => setActiveRangePages(false)}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.clearSelection")}</button></div>
                      </div>
                    )}

                    <div className="pdf-range-groups">
                      {evaluatedRanges.map((row, index) => <div className={`pdf-range-group${row.error ? " invalid" : ""}${row.id === activeRange?.id ? " active" : ""}`} key={row.id}>
                        <button type="button" className="pdf-range-activate" onClick={() => setActiveRangeId(row.id)} aria-pressed={row.id === activeRange?.id} disabled={locked || quickSplitOpen}><b>{index + 1}</b><span>{featureMessage(language, row.id === activeRange?.id ? "pdf.messages.PdfOrganizePanel.editing" : "pdf.messages.PdfOrganizePanel.editWithChecks")}</span></button>
                        <label><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputFileName")}</span><input value={row.name} disabled={locked || quickSplitOpen} onFocus={() => setActiveRangeId(row.id)} onChange={(event) => updateRangeRow(row.id, "name", event.target.value)} placeholder={`${featureMessage(language, "pdf.messages.PdfOrganizePanel.split")}-${String(index + 1).padStart(2, "0")}`} /><small>.pdf</small></label>
                        <label><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageRangeInCurrentOrder")}</span><input value={row.range} disabled={locked || quickSplitOpen} onFocus={() => setActiveRangeId(row.id)} onChange={(event) => updateRangeRow(row.id, "range", event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eG135")} /></label>
                        <button type="button" onClick={() => removeRange(row.id)} disabled={locked || rangeRows.length === 1 || quickSplitOpen} aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.deleteRange", { p0: index + 1 })}><Trash2 size={16} /></button>
                        {row.error && <em>{row.error}</em>}
                      </div>)}
                    </div>
                    <p className="pdf-range-help">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageNumbersFollowTheCurrentEditorOrderFor")} <code>5, 1-3</code>{featureMessage(language, "pdf.messages.PdfOrganizePanel.createsAPdfOrdered5123")}</p>
                  </section>
                )}

                <dl>
                  <div><dt>{featureMessage(language, "pdf.messages.PdfOrganizePanel.sourceFiles")}</dt><dd>{sources.length}</dd></div>
                  <div><dt>{outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.pagesInRanges") : featureMessage(language, "pdf.messages.PdfOrganizePanel.selectedPages")}</dt><dd>{includedPageCount}</dd></div>
                  <div><dt>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputPdfs")}</dt><dd>{resultFileCount}</dd></div>
                  <div><dt>{featureMessage(language, "pdf.messages.PdfOrganizePanel.rotatedPages")}</dt><dd>{pages.filter((page) => page.rotation).length}</dd></div>
                </dl>
                <label className="pdf-output-field"><span>{outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.outputFileName2") : featureMessage(language, "pdf.messages.PdfOrganizePanel.zipFileName")}</span><input value={outputName} disabled={locked} onChange={(event) => setOutputName(event.target.value)} /><small>.{outputMode === "merged" ? "pdf" : "zip"}</small></label>
                <label className="pdf-output-field"><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.watermarkTextOptional")}</span><input value={watermarkText} disabled={locked} maxLength={120} onChange={(event) => setWatermarkText(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eGInternalReview")} /></label>
                <ToggleRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.addPageNumbers")} description={featureMessage(language, "pdf.messages.PdfOrganizePanel.numberEachOutputPdfFrom1AtThe")} checked={pageNumbers} onChange={setPageNumbers} disabled={locked} />
                <ToggleRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.imageBasedCompression")} description={outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.redrawPagesAs144DpiJpegToReduce") : featureMessage(language, "pdf.messages.PdfOrganizePanel.availableOnlyWhenCreatingOnePdf")} checked={imageCompression && outputMode === "merged"} onChange={setImageCompression} disabled={locked || outputMode !== "merged"} />
              </div>

              <div className="pdf-output-action-zone">
                <PrimaryButton accent="violet" disabled={exportDisabled} loading={operation.status === "running"} onClick={exportPdf}>
                  {operation.status !== "running" && (outputMode === "merged" ? <FileCheck2 size={18} /> : <FileArchive size={18} />)}
                  {operation.status === "running" ? creatingLabel : operation.status === "error" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.retryOutput") : createLabel}
                </PrimaryButton>
                <p className="prototype-note">{featureMessage(language, "pdf.messages.PdfOrganizePanel.passwordProtectedPdfsRequireAnUnlockedCopy")}</p>
                <OperationProgress {...operation} compact accent="violet" title={featureMessage(language, "pdf.messages.PdfOrganizePanel.pdfEditExtractLog")} />
                <PdfError message={error} />
                {download.result && <div ref={downloadResultRef}><PdfDownloadCard result={download.result} compact /></div>}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {mobileWorkspace && (pages.length > 0 || operation.status === "running" || !!download.result) && (
        <div className="pdf-mobile-output-dock" role="region" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.outputWorkspace")}>
          <button ref={mobileWorkspaceTriggerRef} className="pdf-mobile-output-summary" type="button" aria-haspopup="dialog" aria-expanded={mobileWorkspaceOpen} onClick={openMobileOutputWorkspace}>
            <Settings2 size={18} />
            <span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputWorkspace")}</strong><small aria-live="polite">{operation.status === "running" ? creatingLabel : featureMessage(language, "pdf.messages.PdfOrganizePanel.outputWorkspaceSummary", { p0: resultFileCount, p1: includedPageCount })}</small></span>
          </button>
          {download.result && operation.status === "success" ? (
            <a className="pdf-mobile-download" href={download.result.url} download={download.result.fileName}><Download size={17} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.downloadResult")}</a>
          ) : (
            <button className="pdf-mobile-create" type="button" disabled={exportDisabled} onClick={() => void exportPdf()}>{operation.status === "running" ? `${operation.progress}%` : operation.status === "error" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.retry") : createLabel}</button>
          )}
        </div>
      )}
    </>
  );
}

function createRangeRow(index: number, language: AppLanguage): RangeRow {
  return { id: createLocalId("pdf-range"), name: `${featureMessage(language, "pdf.messages.PdfOrganizePanel.split")}-${String(index).padStart(2, "0")}`, range: "" };
}

function evaluateRangeRows(rows: RangeRow[], pageCount: number, language: AppLanguage): EvaluatedRangeRow[] {
    const normalizedNames = rows.map((row) => normalizeOutputName(row.name, "").replace(/\.pdf$/i, "").toLocaleLowerCase());
  return rows.map((row, index) => {
    let indexes: number[] = [];
    let error = "";
    if (!row.name.trim()) error = featureMessage(language, "pdf.messages.PdfOrganizePanel.enterAnOutputFileName");
    else if (normalizedNames.filter((name) => name === normalizedNames[index]).length > 1) error = featureMessage(language, "pdf.messages.PdfOrganizePanel.thisFileNameDuplicatesAnotherRange");
    else {
      try { indexes = parsePageRange(row.range, pageCount, language); }
      catch (reason) { error = reason instanceof Error ? reason.message : featureMessage(language, "pdf.messages.PdfOrganizePanel.checkThePageRange"); }
    }
    return { ...row, indexes, error };
  });
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

function setItemsSelected(current: Set<string>, ids: readonly string[], selected: boolean) {
  const next = new Set(current);
  ids.forEach((id) => { if (selected) next.add(id); else next.delete(id); });
  return next;
}

function pageIdsBetweenAnchor(pages: readonly PdfPageItem[], anchorId: string | undefined, targetId: string) {
  const targetIndex = pages.findIndex((page) => page.id === targetId);
  const anchorIndex = anchorId ? pages.findIndex((page) => page.id === anchorId) : -1;
  if (targetIndex < 0 || anchorIndex < 0) return [targetId];
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return pages.slice(start, end + 1).map((page) => page.id);
}

function restoreSortableDom(container: HTMLElement, oldIndex: number, newIndex: number) {
  const moved = container.children.item(newIndex);
  if (!moved) return;
  container.removeChild(moved);
  container.insertBefore(moved, container.children.item(oldIndex));
}
