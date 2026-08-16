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
import { createLocalId, type PdfPageItem, type PdfSourceFile } from "./types";
import { mapWithConcurrency, movePdfItem as moveItem, normalizePdfRotation as normalizeRotation } from "./pdfShared";
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
  const [outputName, setOutputName] = useState(featureMessage(language, "pdf.messages.PdfOrganizePanel.worklazyPdfEdited"));
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
  }, [download.clearResult, locked, pages.length]);

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
          <SectionCard step={1} title={featureMessage(language, "pdf.messages.PdfOrganizePanel.addPdfs")} description={featureMessage(language, "pdf.messages.PdfOrganizePanel.loadEveryPageFromMultiplePdfsIntoOne")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" multiple files={sources.map((source) => source.file)} onFiles={handleFiles} disabled={locked} accent="violet" hint={featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseMultiplePdfsAtOnceOrAddMore")} />
            <FileList files={sources.map((source) => source.file)} onRemove={removeSource} accent="violet" />
          </SectionCard>

          {!!pages.length && (
            <SectionCard step={2} title={featureMessage(language, "pdf.messages.PdfOrganizePanel.editAndSelectPages")} description={outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.defineEachOutputRangeThenDragRotateOr") : featureMessage(language, "pdf.messages.PdfOrganizePanel.chooseOutputPagesInTheCurrentOrderThen")} className="accent-context-violet pdf-page-section">
              <div className="pdf-editor-note"><Info size={15} /><span>{outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.numberBadgesShowWhichOutputRangesIncludeA") : featureMessage(language, "pdf.messages.PdfOrganizePanel.deselectingExcludesAPageFromThisOutputDeleting")}</span></div>
              {outputMode === "ranges" ? (
                <div ref={multiRangePanelRef} className="pdf-multi-range-panel">
                  <div className="pdf-multi-range-heading">
                    <div><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputRanges")}</strong><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.eachRowCreatesOnePdfAndAPage")}</span></div>
                    <button type="button" className="secondary-button" onClick={() => setRangeRows((current) => [...current, createRangeRow(current.length + 1, language)])}><Plus size={15} /> {featureMessage(language, "pdf.messages.PdfOrganizePanel.addRange")}</button>
                  </div>
                  <div className="pdf-range-groups">
                    {evaluatedRanges.map((row, index) => <div className={`pdf-range-group${row.error ? " invalid" : ""}`} key={row.id}>
                      <b>{index + 1}</b>
                      <label><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputFileName")}</span><input value={row.name} onChange={(event) => updateRangeRow(row.id, "name", event.target.value)} placeholder={`${featureMessage(language, "pdf.messages.PdfOrganizePanel.split")}-${String(index + 1).padStart(2, "0")}`} /><small>.pdf</small></label>
                      <label><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageRangeInCurrentOrder")}</span><input value={row.range} onChange={(event) => updateRangeRow(row.id, "range", event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eG135")} /></label>
                      <button type="button" onClick={() => setRangeRows((current) => current.filter((candidate) => candidate.id !== row.id))} disabled={rangeRows.length === 1} aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.deleteRange", { p0: index + 1 })}><Trash2 size={16} /></button>
                      {row.error && <em>{row.error}</em>}
                    </div>)}
                  </div>
                  <p className="pdf-range-help">{featureMessage(language, "pdf.messages.PdfOrganizePanel.pageNumbersFollowTheCurrentEditorOrderFor")} <code>5, 1-3</code>{featureMessage(language, "pdf.messages.PdfOrganizePanel.createsAPdfOrdered5123")}</p>
                </div>
              ) : (
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
                  return <PdfThumbnail key={page.id} item={page} file={source.file} outputIndex={index} totalItems={pages.length} selected={outputMode !== "ranges" && selectedPageIds.has(page.id)} groupNumbers={outputMode === "ranges" ? groupMembership.get(page.id) : []} draggable={!locked} onSelect={locked || outputMode === "ranges" ? undefined : () => togglePageSelection(page.id)} onRotate={locked ? undefined : () => rotatePage(page.id)} onRemove={locked ? undefined : () => removePage(page.id)} onMove={locked ? undefined : (direction) => movePage(index, direction)} />;
                })}
              </div>
            </SectionCard>
          )}
        </div>

        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><Layers3 size={18} /><h2>{featureMessage(language, "pdf.messages.PdfOrganizePanel.editOutputSummary")}</h2></div>
            <div className="pdf-output-mode-list" role="radiogroup" aria-label={featureMessage(language, "pdf.messages.PdfOrganizePanel.pdfOutputMode")}>
              <button type="button" role="radio" aria-checked={outputMode === "merged"} className={outputMode === "merged" ? "selected" : ""} onClick={() => setMode("merged")}><FileCheck2 size={16} /><span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdf")}</strong><small>{featureMessage(language, "pdf.messages.PdfOrganizePanel.saveSelectedPagesInCurrentOrder")}</small></span></button>
              <button type="button" role="radio" aria-checked={outputMode === "ranges"} className={outputMode === "ranges" ? "selected" : ""} onClick={() => setMode("ranges")}><FileArchive size={16} /><span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdfPerRange")}</strong><small>{featureMessage(language, "pdf.messages.PdfOrganizePanel.createEachRowAsAPdfInA")}</small></span></button>
              <button type="button" role="radio" aria-checked={outputMode === "separate"} className={outputMode === "separate" ? "selected" : ""} onClick={() => setMode("separate")}><Layers3 size={16} /><span><strong>{featureMessage(language, "pdf.messages.PdfOrganizePanel.onePdfPerPage")}</strong><small>{featureMessage(language, "pdf.messages.PdfOrganizePanel.splitSelectedPagesIntoAZip")}</small></span></button>
            </div>
            <dl>
              <div><dt>{featureMessage(language, "pdf.messages.PdfOrganizePanel.sourceFiles")}</dt><dd>{sources.length}</dd></div>
              <div><dt>{outputMode === "ranges" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.pagesInRanges") : featureMessage(language, "pdf.messages.PdfOrganizePanel.selectedPages")}</dt><dd>{outputMode === "ranges" ? rangePageCount : selectedPages.length}</dd></div>
              <div><dt>{featureMessage(language, "pdf.messages.PdfOrganizePanel.outputPdfs")}</dt><dd>{resultFileCount}</dd></div>
              <div><dt>{featureMessage(language, "pdf.messages.PdfOrganizePanel.rotatedPages")}</dt><dd>{pages.filter((page) => page.rotation).length}</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.outputFileName2") : featureMessage(language, "pdf.messages.PdfOrganizePanel.zipFileName")}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.{outputMode === "merged" ? "pdf" : "zip"}</small></label>
            <label className="pdf-output-field"><span>{featureMessage(language, "pdf.messages.PdfOrganizePanel.watermarkTextOptional")}</span><input value={watermarkText} maxLength={120} onChange={(event) => setWatermarkText(event.target.value)} placeholder={featureMessage(language, "pdf.messages.PdfOrganizePanel.eGInternalReview")} /></label>
            <ToggleRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.addPageNumbers")} description={featureMessage(language, "pdf.messages.PdfOrganizePanel.numberEachOutputPdfFrom1AtThe")} checked={pageNumbers} onChange={setPageNumbers} />
            <ToggleRow label={featureMessage(language, "pdf.messages.PdfOrganizePanel.imageBasedCompression")} description={outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.redrawPagesAs144DpiJpegToReduce") : featureMessage(language, "pdf.messages.PdfOrganizePanel.availableOnlyWhenCreatingOnePdf")} checked={imageCompression && outputMode === "merged"} onChange={setImageCompression} disabled={outputMode !== "merged"} />
            <PrimaryButton accent="violet" disabled={!pages.length || !resultFileCount || inspecting || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}>{outputMode === "merged" ? <FileCheck2 size={18} /> : <FileArchive size={18} />} {outputMode === "merged" ? featureMessage(language, "pdf.messages.PdfOrganizePanel.createPdf") : featureMessage(language, "pdf.messages.PdfOrganizePanel.createPdfZip")}</PrimaryButton>
            <p className="prototype-note">{featureMessage(language, "pdf.messages.PdfOrganizePanel.passwordProtectedPdfsRequireAnUnlockedCopy")}</p>
          </section>
          <OperationProgress {...operation} accent="violet" title={featureMessage(language, "pdf.messages.PdfOrganizePanel.pdfEditExtractLog")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
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
