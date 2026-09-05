import { Download, FileArchive, FileCheck2, Info, Layers3, Plus, Scissors, Settings2, Trash2, X } from "lucide-react";
import Sortable from "sortablejs";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { UtilityInput, UtilityNotice, UtilitySelect } from "../../components/UtilitySurface";
import { FileDropZone, FileList, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
import { cn } from "../../lib/utils";

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
      <div className="pdf-workflow-grid grid grid-cols-[minmax(0,1fr)_290px] items-start gap-4 max-[820px]:grid-cols-1">
        <div>
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfOrganizePanel.addPdfs")} description={featureMessage(language, "pdf.messages.PdfOrganizePanel.loadEveryPageFromMultiplePdfsIntoOne")} className="[&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
            <FileDropZone accept=".pdf,application/pdf" multiple files={sources.map((source) => source.file)} onFiles={handleFiles} disabled={locked} accent="violet" hint={featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseMultiplePdfsAtOnceOrAddMore")} />
            <FileList files={sources.map((source) => source.file)} onRemove={removeSource} accent="violet" />
          </SectionCard>

          {!!pages.length && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfOrganizePanel.editAndSelectPages")} description={outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.defineEachOutputRangeThenDragRotateOr") : featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseOutputPagesInTheCurrentOrderThen")} className="overflow-visible [&_.ui-step-number]:bg-violet-700 [&_.ui-step-number]:shadow-violet-700/20">
              <UtilityNotice className="mb-4 bg-violet-500/10 text-muted-foreground"><Info className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300" size={15} /><span>{outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.numberBadgesShowWhichOutputRangesIncludeA") : featureMessage(language, "pdf.messages.PdfOrganizePanel.deselectingExcludesAPageFromThisOutputDeleting")}</span></UtilityNotice>
              {outputMode !== "ranges" && (
                <div className="pdf-selection-toolbar mb-3 flex items-center justify-between gap-2.5 rounded-xl bg-muted p-2 max-[620px]:flex-col max-[620px]:items-stretch">
                  <div className="flex items-center gap-1 max-[620px]:justify-between">
                    <Button className="min-h-[29px] rounded-lg px-2 text-xs font-bold text-violet-700 dark:text-violet-300" variant="ghost" size="sm" type="button" onClick={selectAllPages}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.selectAll")}</Button>
                    <Button className="min-h-[29px] rounded-lg px-2 text-xs font-bold text-violet-700 dark:text-violet-300" variant="ghost" size="sm" type="button" onClick={clearPageSelection}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.clearSelection")}</Button>
                    <strong className="ml-1 whitespace-nowrap text-xs text-muted-foreground">{selectedPages.length}/{pages.length} {featureMessage(language, "pdf.messages.PdfOrganizePanel.selected")}</strong>
                  </div>
                  <form className="pdf-selection-range-form grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 max-[620px]:w-full" onSubmit={applySelectionRange} noValidate>
                    <label htmlFor="pdf-selection-range" className="sr-only">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageRangeToSelect")}</label>
                    <UtilityInput className="h-[31px] w-[120px] rounded-lg px-2 text-xs max-[620px]:w-full" id="pdf-selection-range" value={selectionRange} onChange={(event) => { setSelectionRange(event.target.value); setSelectionError(""); }} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eG135")} aria-invalid={!!selectionError} aria-describedby={selectionError ? "pdf-selection-range-error" : undefined} />
                    <Button className="min-h-[29px] rounded-lg px-2 text-xs font-bold text-violet-700 dark:text-violet-300" variant="ghost" size="sm" type="submit">{featureMessage(language, "pdf.messages.PdfOrganizePanel.selectRange")}</Button>
                    {selectionError && <em className="col-span-2 text-xs leading-relaxed text-destructive not-italic" id="pdf-selection-range-error" role="alert">{selectionError}</em>}
                  </form>
                </div>
              )}
              <div ref={gridRef} className="pdf-page-grid grid grid-cols-[repeat(auto-fill,minmax(166px,1fr))] gap-3 max-[620px]:grid-cols-2">
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

        <div className={cn("pdf-output-sidebar-shell contents max-[820px]:fixed max-[820px]:inset-0 max-[820px]:z-80 max-[820px]:hidden max-[820px]:items-end max-[820px]:justify-center max-[820px]:bg-black/25 max-[820px]:p-2.5 max-[820px]:backdrop-blur-sm", mobileWorkspaceOpen && "max-[820px]:flex")} data-open={mobileWorkspaceOpen || undefined} onMouseDown={() => mobileWorkspace && closeMobileOutputWorkspace()}>
          <aside ref={mobileWorkspaceRef} className="pdf-output-workspace sticky top-6 min-w-0 max-[820px]:static max-[820px]:max-h-[calc(100dvh-20px)] max-[820px]:w-[min(560px,100%)]" role={mobileWorkspace ? "dialog" : undefined} aria-modal={mobileWorkspace || undefined} aria-labelledby="pdf-output-workspace-title" onMouseDown={(event) => event.stopPropagation()}>
            <Card as="section" data-testid="pdf-output-card" className="pdf-output-card max-h-[calc(100dvh-48px)] gap-0 overflow-hidden rounded-3xl border border-border py-0 shadow-sm ring-0 max-[820px]:max-h-[calc(100dvh-20px)] max-[820px]:rounded-[28px] max-[820px]:bg-card max-[820px]:shadow-2xl">
              <div className="pdf-output-mobile-header relative hidden min-h-[45px] shrink-0 items-center justify-center px-3.5 pt-2 max-[820px]:flex">
                <span className="h-[5px] w-9 rounded-full bg-muted-foreground/25" />
                <Button ref={mobileWorkspaceCloseRef} className="absolute top-2 right-3 size-9 rounded-full" variant="ghost" size="icon" type="button" onClick={closeMobileOutputWorkspace} aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.closeOutputWorkspace")}><X size={20} /></Button>
              </div>
              <div className="pdf-output-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[18px] pt-5 pb-3 [overscroll-behavior:contain] [scrollbar-color:rgba(118,118,128,.38)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] max-[820px]:pt-2">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><Layers3 size={18} /><h2 className="font-heading text-[15px] font-medium text-foreground" id="pdf-output-workspace-title">{featureMessage(language, "pdf.messages.PdfOrganizePanel.editOutputSummary")}</h2></div>
                <div className="pdf-output-mode-list mt-4 grid gap-1.5" role="radiogroup" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.pdfOutputMode")}>
                  {([
                    ["merged", FileCheck2, featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdf"), featureMessage(language, "pdf.messages.PdfOrganizePanel.saveSelectedPagesInCurrentOrder")],
                    ["ranges", FileArchive, featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdfPerRange"), featureMessage(language, "pdf.messages.PdfOrganizePanel.createEachRowAsAPdfInA")],
                    ["separate", Layers3, featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdfPerPage"), featureMessage(language, "pdf.messages.PdfOrganizePanel.splitSelectedPagesIntoAZip")],
                  ] as const).map(([value, Icon, label, hint]) => { const selected = outputMode === value; return <Button key={value} type="button" role="radio" aria-checked={selected} data-selected={selected || undefined} variant="outline" className={cn("min-h-[54px] w-full grid-cols-[auto_minmax(0,1fr)] justify-start gap-2 rounded-xl border-transparent bg-muted px-2.5 py-2 text-left text-muted-foreground", selected && "border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 dark:text-violet-300")} disabled={locked} onClick={() => setMode(value)}><Icon size={16} /><span className="flex min-w-0 flex-col"><strong className="text-[13px] text-foreground">{label}</strong><small className="mt-1 whitespace-normal text-xs leading-snug text-muted-foreground">{hint}</small></span></Button>; })}
                </div>

                {outputMode === "ranges" && (
                  <section className="pdf-multi-range-panel mx-[-7px] mt-4 mb-1 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-2.5" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.outputRanges")}>
                    <div className="pdf-multi-range-heading mb-2.5 flex flex-col items-stretch gap-2">
                      <div className="flex min-w-0 flex-col"><strong className="text-sm text-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputRanges")}</strong><span className="mt-1 text-xs leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.eachRowCreatesOnePdfAndAPage")}</span></div>
                      <div className="pdf-multi-range-actions grid grid-cols-2 gap-1.5">
                        <Button type="button" className="min-w-0 rounded-xl px-1.5 text-xs" variant="secondary" onClick={startQuickSplit} disabled={locked || quickSplitOpen}><Scissors size={15} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.quickContinuousSplit")}</Button>
                        <Button type="button" className="min-w-0 rounded-xl px-1.5 text-xs" variant="secondary" onClick={addRange} disabled={locked || quickSplitOpen}><Plus size={15} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.addRange")}</Button>
                      </div>
                    </div>

                    {quickSplitOpen ? (
                      <div className="pdf-range-selection-toolbar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-violet-500/25 bg-card p-2 text-xs text-muted-foreground" data-mode="quick-split" role="region" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.quickContinuousSplit")}>
                        <div className="col-span-2 flex flex-col"><strong className="text-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseWhereToSplit")}</strong><span className="mt-0.5 leading-snug">{featureMessage(language, "pdf.messages.PdfOrganizePanel.quickSplitReplacesCurrentRanges")}</span></div>
                        <b className="text-violet-700 dark:text-violet-300">{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputCount", { p0: splitAfterPageIds.size + 1 })}</b>
                        <div className="pdf-range-toolbar-actions flex justify-end gap-1"><Button type="button" size="xs" variant="ghost" onClick={cancelQuickSplit}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.cancel")}</Button><Button type="button" size="xs" className="bg-violet-700 text-white hover:bg-violet-800" onClick={applyQuickSplit}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.applyContinuousSplit")}</Button></div>
                      </div>
                    ) : (
                      <div className="pdf-range-selection-toolbar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-violet-500/25 bg-card p-2 text-xs text-muted-foreground" role="region" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.visualRangeSelection")}>
                        <label className="col-span-2 grid gap-1"><span className="font-bold">{featureMessage(language, "pdf.messages.PdfOrganizePanel.editingRange")}</span><UtilitySelect className="h-8 text-xs" value={activeRange?.id ?? ""} onChange={(event) => setActiveRangeId(event.target.value)}>{evaluatedRanges.map((row, index) => <option value={row.id} key={row.id}>{index + 1}. {row.name || featureMessage(language, "pdf.messages.PdfOrganizePanel.unnamedRange")}</option>)}</UtilitySelect></label>
                        <strong className="text-violet-700 dark:text-violet-300">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pagesChecked", { p0: activeRangeIndexes.size, p1: pages.length })}</strong>
                        <span className="col-span-2 leading-snug">{featureMessage(language, "pdf.messages.PdfOrganizePanel.shiftClickSelectsBetween")}</span>
                        <div className="pdf-range-toolbar-actions col-start-2 row-start-2 flex justify-end gap-1"><Button type="button" size="xs" variant="ghost" onClick={() => setActiveRangePages(true)}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.selectAll")}</Button><Button type="button" size="xs" variant="ghost" onClick={() => setActiveRangePages(false)}>{featureMessage(language, "pdf.messages.PdfOrganizePanel.clearSelection")}</Button></div>
                      </div>
                    )}

                    <div className="pdf-range-groups grid max-h-[min(36dvh,330px)] gap-2 overflow-y-auto pr-1 [overscroll-behavior:contain] [scrollbar-gutter:stable]">
                      {evaluatedRanges.map((row, index) => { const active = row.id === activeRange?.id; return <div className={cn("pdf-range-group grid grid-cols-[minmax(0,1fr)_32px] items-center gap-2 rounded-xl border border-transparent bg-card p-2", active && "border-violet-500/45 ring-2 ring-violet-500/10", row.error && "border-destructive/30")} data-active={active || undefined} data-invalid={row.error ? "true" : undefined} key={row.id}>
                        <Button type="button" className="pdf-range-activate col-start-1 row-start-1 w-fit justify-self-start rounded-lg p-1 text-[10px] font-bold text-muted-foreground" variant="ghost" size="sm" onClick={() => setActiveRangeId(row.id)} aria-pressed={active} disabled={locked || quickSplitOpen}><b className="grid size-[25px] place-items-center rounded-lg bg-violet-700 text-[13px] text-white">{index + 1}</b><span>{featureMessage(language, active ? "pdf.messages.PdfOrganizePanel.editing" : "pdf.messages.PdfOrganizePanel.editWithChecks")}</span></Button>
                        <label className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-card px-2 py-1.5"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputFileName")}</span><UtilityInput className="h-7 border-0 bg-transparent px-0 text-[13px] focus-visible:ring-0" value={row.name} disabled={locked || quickSplitOpen} onFocus={() => setActiveRangeId(row.id)} onChange={(event) => updateRangeRow(row.id, "name", event.target.value)} placeholder={`${featureMessage(language, "pdf.messages.PdfOrganizePanel.split")}-${String(index + 1).padStart(2, "0")}`} /><small className="text-xs text-muted-foreground">.pdf</small></label>
                        <label className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-card px-2 py-1.5"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageRangeInCurrentOrder")}</span><UtilityInput className="h-7 border-0 bg-transparent px-0 text-[13px] focus-visible:ring-0" value={row.range} disabled={locked || quickSplitOpen} onFocus={() => setActiveRangeId(row.id)} onChange={(event) => updateRangeRow(row.id, "range", event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eG135")} /></label>
                        <Button type="button" className="col-start-2 row-start-1 size-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20" variant="ghost" size="icon-sm" onClick={() => removeRange(row.id)} disabled={locked || rangeRows.length === 1 || quickSplitOpen} aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.deleteRange", { p0: index + 1 })}><Trash2 size={16} /></Button>
                        {row.error && <em className="col-span-2 text-xs text-destructive not-italic">{row.error}</em>}
                      </div>; })}
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageNumbersFollowTheCurrentEditorOrderFor")} <code className="rounded bg-violet-500/10 px-1 py-0.5 text-violet-700 dark:text-violet-300">5, 1-3</code>{featureMessage(language, "pdf.messages.PdfOrganizePanel.createsAPdfOrdered5123")}</p>
                  </section>
                )}

                <dl className="my-5">
                  <SummaryRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.sourceFiles")} value={sources.length} />
                  <SummaryRow label={outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.pagesInRanges") : featureMessage(language, "pdf.messages.PdfOrganizePanel.selectedPages")} value={includedPageCount} />
                  <SummaryRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.outputPdfs")} value={resultFileCount} />
                  <SummaryRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.rotatedPages")} value={pages.filter((page) => page.rotation).length} />
                </dl>
                <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-violet-700 dark:text-violet-300"><span className="col-span-2 text-xs font-bold text-muted-foreground">{outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.outputFileName2") : featureMessage(language, "pdf.messages.PdfOrganizePanel.zipFileName")}</span><UtilityInput className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={outputName} disabled={locked} onChange={(event) => setOutputName(event.target.value)} /><small className="text-xs text-muted-foreground">.{outputMode === "merged" ? "pdf" : "zip"}</small></label>
                <label className="pdf-output-field mb-3 grid min-h-[43px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-muted px-2.5 py-1.5 text-violet-700 dark:text-violet-300"><span className="col-span-2 text-xs font-bold text-muted-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.watermarkTextOptional")}</span><UtilityInput className="col-span-2 h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={watermarkText} disabled={locked} maxLength={120} onChange={(event) => setWatermarkText(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eGInternalReview")} /></label>
                <ToggleRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.addPageNumbers")} description={featureMessage(language, "pdf.messages.PdfOrganizePanel.numberEachOutputPdfFrom1AtThe")} checked={pageNumbers} onChange={setPageNumbers} disabled={locked} />
                <ToggleRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.imageBasedCompression")} description={outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.redrawPagesAs144DpiJpegToReduce") : featureMessage(language, "pdf.messages.PdfOrganizePanel.availableOnlyWhenCreatingOnePdf")} checked={imageCompression && outputMode === "merged"} onChange={setImageCompression} disabled={locked || outputMode !== "merged"} />
              </div>

              <div className="pdf-output-action-zone max-h-[min(58dvh,540px)] shrink-0 overflow-y-auto border-t border-border bg-violet-500/5 px-[18px] pt-3.5 pb-[18px] [scrollbar-gutter:stable] max-[820px]:pb-[calc(18px+env(safe-area-inset-bottom))]">
                <PrimaryButton accent="violet" disabled={exportDisabled} loading={operation.status === "running"} onClick={exportPdf}>
                  {operation.status !== "running" && (outputMode === "merged" ? <FileCheck2 size={18} /> : <FileArchive size={18} />)}
                  {operation.status === "running" ? creatingLabel : operation.status === "error" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.retryOutput") : createLabel}
                </PrimaryButton>
                <p className="mx-0.5 mt-3 text-center text-sm leading-relaxed text-muted-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.passwordProtectedPdfsRequireAnUnlockedCopy")}</p>
                <OperationProgress {...operation} compact accent="violet" title={featureMessage(language, "pdf.messages.PdfOrganizePanel.pdfEditExtractLog")} />
                <PdfError message={error} />
                {download.result && <div ref={downloadResultRef}><PdfDownloadCard result={download.result} compact /></div>}
              </div>
            </Card>
          </aside>
        </div>
      </div>
      {mobileWorkspace && (pages.length > 0 || operation.status === "running" || !!download.result) && (
        <div className="pdf-mobile-output-dock fixed right-3 bottom-[calc(82px+env(safe-area-inset-bottom))] left-3 z-50 grid min-h-[62px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[19px] border border-border bg-card/95 p-2 shadow-xl backdrop-blur-xl" role="region" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.outputWorkspace")}>
          <Button ref={mobileWorkspaceTriggerRef} className="pdf-mobile-output-summary min-h-[47px] min-w-0 justify-start gap-2 rounded-xl px-2 text-left text-violet-700 dark:text-violet-300" variant="ghost" type="button" aria-haspopup="dialog" aria-expanded={mobileWorkspaceOpen} onClick={openMobileOutputWorkspace}>
            <Settings2 size={18} />
            <span className="flex min-w-0 flex-col"><strong className="text-[13px] text-foreground">{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputWorkspace")}</strong><small className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">{operation.status === "running" ? creatingLabel : featureMessage(language, "pdf.messages.PdfOrganizePanel.outputWorkspaceSummary", { p0: resultFileCount, p1: includedPageCount })}</small></span>
          </Button>
          {download.result && operation.status === "success" ? (
            <a className="pdf-mobile-download inline-flex min-h-[46px] min-w-24 items-center justify-center gap-1 rounded-xl bg-violet-700 px-3 text-center text-xs font-bold leading-tight text-white shadow-md shadow-violet-700/20" href={download.result.url} download={download.result.fileName}><Download size={17} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.downloadResult")}</a>
          ) : (
            <Button className="pdf-mobile-create min-h-[46px] min-w-24 rounded-xl bg-violet-700 px-3 text-center text-xs font-bold leading-tight text-white shadow-md shadow-violet-700/20 hover:bg-violet-800" type="button" disabled={exportDisabled} onClick={() => void exportPdf()}>{operation.status === "running" ? `${operation.progress}%` : operation.status === "error" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.retry") : createLabel}</Button>
          )}
        </div>
      )}
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between border-b border-border py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="m-0 font-bold text-foreground">{value}</dd></div>;
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
