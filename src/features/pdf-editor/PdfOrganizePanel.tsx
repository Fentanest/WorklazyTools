import { FileArchive, FileCheck2, Info, Layers3, Plus, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, parsePageRange, releasePdf } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { exportPdfGroups, mergePdfPages } from "./pdfWorkerClient";
import { createLocalId, normalizeRotation, type PdfPageItem, type PdfSourceFile } from "./types";

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
  const [sources, setSources] = useState<PdfSourceFile[]>([]);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selectionRange, setSelectionRange] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("merged");
  const [rangeRows, setRangeRows] = useState<RangeRow[]>(() => [createRangeRow(1)]);
  const [outputName, setOutputName] = useState("Worklazy-PDF-편집");
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const multiRangePanelRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<PdfSourceFile[]>([]);
  const operation = useOperationProgress();
  const download = useDownloadResult();

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
    if (!grid) return;
    const sortable = Sortable.create(grid, {
      animation: 170,
      handle: ".pdf-drag-handle",
      draggable: ".pdf-page-card",
      delay: 120,
      delayOnTouchOnly: true,
      fallbackTolerance: 4,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        setPages((current) => moveItem(current, oldIndex, newIndex));
        download.clearResult();
      },
    });
    return () => sortable.destroy();
  }, [pages.length]);

  const evaluatedRanges = useMemo(() => evaluateRangeRows(rangeRows, pages.length), [rangeRows, pages.length]);
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
    operation.start(`${incoming.length}개 PDF의 페이지를 확인하는 중…`);
    const addedSources: PdfSourceFile[] = [];
    const addedPages: PdfPageItem[] = [];
    try {
      for (let index = 0; index < incoming.length; index += 1) {
        const file = incoming[index];
        if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error(`${file.name}: PDF 파일만 추가할 수 있습니다.`);
        operation.update(8 + (index / incoming.length) * 82, `[${index + 1}/${incoming.length}] ${file.name} 페이지 확인 중…`);
        const inspected = await inspectPdf(file);
        const sourceId = createLocalId("pdf");
        addedSources.push({ id: sourceId, file, pageCount: inspected.pageCount });
        for (let pageIndex = 0; pageIndex < inspected.pageCount; pageIndex += 1) {
          addedPages.push({ id: createLocalId("page"), sourceId, sourceName: file.name, sourcePageIndex: pageIndex, rotation: 0 });
        }
      }
      setSources((current) => [...current, ...addedSources]);
      setPages((current) => [...current, ...addedPages]);
      setSelectedPageIds((current) => new Set([...current, ...addedPages.map((page) => page.id)]));
      operation.succeed(`${addedPages.length}개 페이지를 편집 화면에 추가하고 모두 선택했습니다.`);
    } catch (reason) {
      addedSources.forEach((source) => { void releasePdf(source.file); });
      const message = reason instanceof Error ? reason.message : "PDF 파일을 읽지 못했습니다.";
      setError(message);
      operation.fail(message);
    } finally {
      setInspecting(false);
    }
  };

  const removeSource = (index: number) => {
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
    operation.start("선택 페이지, 편집 순서와 회전값을 확인하는 중…");
    try {
      const sourceFiles = sources.map((source) => ({ id: source.id, file: source.file }));
      const archiveName = normalizeOutputName(outputName, "Worklazy-PDF-편집");
      if (outputMode === "merged") {
        if (!selectedPages.length) throw new Error("하나의 PDF로 저장할 페이지를 선택해 주세요.");
        const output = await mergePdfPages(sourceFiles, selectedPages.map(toPagePlan), archiveName, operation.update);
        download.makeResult(output);
        operation.succeed(`${selectedPages.length}개 선택 페이지를 하나의 PDF로 생성했습니다.`);
        return;
      }

      let groups: Array<{ fileName: string; pages: ReturnType<typeof toPagePlan>[] }>;
      if (outputMode === "ranges") {
        if (!rangesValid) throw new Error("여러 범위의 파일명과 페이지 범위를 확인해 주세요.");
        groups = evaluatedRanges.map((row) => ({ fileName: row.name, pages: row.indexes.map((index) => toPagePlan(pages[index])) }));
      } else {
        if (!selectedPages.length) throw new Error("페이지별 PDF로 저장할 페이지를 선택해 주세요.");
        groups = selectedPages.map((page) => {
          const position = pages.findIndex((candidate) => candidate.id === page.id) + 1;
          return { fileName: `${archiveName}-${String(position).padStart(3, "0")}`, pages: [toPagePlan(page)] };
        });
      }
      const output = await exportPdfGroups(sourceFiles, groups, archiveName, operation.update);
      download.makeResult(output);
      operation.succeed(`${groups.length}개 PDF를 만들어 ZIP으로 묶었습니다.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "PDF를 생성하지 못했습니다.";
      setError(message);
      operation.fail(message);
    }
  };

  const applySelectionRange = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    try {
      const indexes = parsePageRange(selectionRange, pages.length);
      setSelectedPageIds(new Set(indexes.map((index) => pages[index].id)));
      setSelectionError("");
      setError("");
      download.clearResult();
    } catch (reason) {
      setSelectionError(reason instanceof Error ? reason.message : "선택할 페이지 범위를 확인해 주세요.");
    }
  };

  const updateRangeRow = (id: string, field: "name" | "range", value: string) => {
    setRangeRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    download.clearResult();
  };

  const removePage = (id: string) => {
    setPages((current) => current.filter((page) => page.id !== id));
    setSelectedPageIds((current) => { const next = new Set(current); next.delete(id); return next; });
    download.clearResult();
  };

  const rotatePage = (id: string) => {
    setPages((current) => current.map((page) => page.id === id ? { ...page, rotation: normalizeRotation(page.rotation + 90) } : page));
    download.clearResult();
  };

  const movePage = (index: number, direction: -1 | 1) => {
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
        : [{ ...(current[0] ?? createRangeRow(1)), range: selectedRange }]);
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
          <SectionCard step={1} title="PDF 추가" description="여러 PDF의 모든 페이지를 한 편집 화면에 불러옵니다." className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" multiple files={sources.map((source) => source.file)} onFiles={handleFiles} accent="violet" hint="PDF를 한 번에 고르거나 여러 번 나눠 추가하세요." />
            <FileList files={sources.map((source) => source.file)} onRemove={removeSource} accent="violet" />
          </SectionCard>

          {!!pages.length && (
            <SectionCard step={2} title="페이지 편집·선택" description={outputMode === "ranges" ? "결과별 범위를 지정하고, 페이지를 끌어서 이동하거나 회전·삭제하세요." : "현재 순서를 기준으로 출력할 페이지를 고르고, 끌어서 이동하거나 회전·삭제하세요."} className="accent-context-violet pdf-page-section">
              <div className="pdf-editor-note"><Info size={15} /><span>{outputMode === "ranges" ? "번호 배지는 페이지가 포함된 결과 범위를 뜻합니다. 휴지통은 모든 결과에서 해당 페이지를 제거하며, 회전값은 실제 출력 PDF에도 기록됩니다." : "선택 해제는 현재 출력에서만 제외합니다. 휴지통은 편집 목록에서 페이지를 완전히 제거하며, 회전값은 실제 출력 PDF에도 기록됩니다."}</span></div>
              {outputMode === "ranges" ? (
                <div ref={multiRangePanelRef} className="pdf-multi-range-panel">
                  <div className="pdf-multi-range-heading">
                    <div><strong>출력 범위 설정</strong><span>각 행이 하나의 PDF가 되며, 같은 페이지를 여러 결과에 넣을 수 있습니다.</span></div>
                    <button type="button" className="secondary-button" onClick={() => setRangeRows((current) => [...current, createRangeRow(current.length + 1)])}><Plus size={15} /> 범위 추가</button>
                  </div>
                  <div className="pdf-range-groups">
                    {evaluatedRanges.map((row, index) => <div className={`pdf-range-group${row.error ? " invalid" : ""}`} key={row.id}>
                      <b>{index + 1}</b>
                      <label><span>결과 파일명</span><input value={row.name} onChange={(event) => updateRangeRow(row.id, "name", event.target.value)} placeholder={`분할-${String(index + 1).padStart(2, "0")}`} /><small>.pdf</small></label>
                      <label><span>현재 순서의 페이지 범위</span><input value={row.range} onChange={(event) => updateRangeRow(row.id, "range", event.target.value)} placeholder="예: 1-3, 5" /></label>
                      <button type="button" onClick={() => setRangeRows((current) => current.filter((candidate) => candidate.id !== row.id))} disabled={rangeRows.length === 1} aria-label={`${index + 1}번 범위 삭제`}><Trash2 size={16} /></button>
                      {row.error && <em>{row.error}</em>}
                    </div>)}
                  </div>
                  <p className="pdf-range-help">페이지 번호는 아래 편집 화면의 현재 순서를 따릅니다. 예를 들어 <code>5, 1-3</code>은 5, 1, 2, 3 순서의 PDF를 만듭니다.</p>
                </div>
              ) : (
                <div className="pdf-selection-toolbar">
                  <div>
                    <button type="button" onClick={selectAllPages}>전체 선택</button>
                    <button type="button" onClick={clearPageSelection}>선택 해제</button>
                    <strong>{selectedPages.length}/{pages.length} 선택</strong>
                  </div>
                  <form className="pdf-selection-range-form" onSubmit={applySelectionRange} noValidate>
                    <label htmlFor="pdf-selection-range" className="visually-hidden">선택할 페이지 범위</label>
                    <input id="pdf-selection-range" value={selectionRange} onChange={(event) => { setSelectionRange(event.target.value); setSelectionError(""); }} placeholder="예: 1-3, 5" aria-invalid={!!selectionError} aria-describedby={selectionError ? "pdf-selection-range-error" : undefined} />
                    <button type="submit">범위로 선택</button>
                    {selectionError && <em id="pdf-selection-range-error" role="alert">{selectionError}</em>}
                  </form>
                </div>
              )}
              <div ref={gridRef} className="pdf-page-grid">
                {pages.map((page, index) => {
                  const source = sources.find((candidate) => candidate.id === page.sourceId);
                  if (!source) return null;
                  return <PdfThumbnail key={page.id} item={page} file={source.file} outputIndex={index} selected={outputMode !== "ranges" && selectedPageIds.has(page.id)} groupNumbers={outputMode === "ranges" ? groupMembership.get(page.id) : []} onSelect={outputMode === "ranges" ? undefined : () => togglePageSelection(page.id)} onRotate={() => rotatePage(page.id)} onRemove={() => removePage(page.id)} onMove={(direction) => movePage(index, direction)} />;
                })}
              </div>
            </SectionCard>
          )}
        </div>

        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><Layers3 size={18} /><h2>편집·출력 요약</h2></div>
            <div className="pdf-output-mode-list" role="radiogroup" aria-label="PDF 출력 방식">
              <button type="button" role="radio" aria-checked={outputMode === "merged"} className={outputMode === "merged" ? "selected" : ""} onClick={() => setMode("merged")}><FileCheck2 size={16} /><span><strong>하나의 PDF</strong><small>선택 페이지를 현재 순서로 저장</small></span></button>
              <button type="button" role="radio" aria-checked={outputMode === "ranges"} className={outputMode === "ranges" ? "selected" : ""} onClick={() => setMode("ranges")}><FileArchive size={16} /><span><strong>여러 범위별 PDF</strong><small>입력 행마다 PDF를 만들어 ZIP 저장</small></span></button>
              <button type="button" role="radio" aria-checked={outputMode === "separate"} className={outputMode === "separate" ? "selected" : ""} onClick={() => setMode("separate")}><Layers3 size={16} /><span><strong>페이지별 PDF</strong><small>선택 페이지를 각각 나눠 ZIP 저장</small></span></button>
            </div>
            <dl>
              <div><dt>원본 파일</dt><dd>{sources.length}개</dd></div>
              <div><dt>{outputMode === "ranges" ? "범위 포함 페이지" : "선택 페이지"}</dt><dd>{outputMode === "ranges" ? rangePageCount : selectedPages.length}개</dd></div>
              <div><dt>결과 PDF</dt><dd>{resultFileCount}개</dd></div>
              <div><dt>회전한 페이지</dt><dd>{pages.filter((page) => page.rotation).length}개</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{outputMode === "merged" ? "출력 파일명" : "ZIP 파일명"}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.{outputMode === "merged" ? "pdf" : "zip"}</small></label>
            <PrimaryButton accent="violet" disabled={!pages.length || !resultFileCount || inspecting || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}>{outputMode === "merged" ? <FileCheck2 size={18} /> : <FileArchive size={18} />} {outputMode === "merged" ? "새 PDF 만들기" : "PDF ZIP 만들기"}</PrimaryButton>
            <p className="prototype-note">암호로 보호된 PDF는 보호를 해제한 사본이 필요합니다.</p>
          </section>
          <OperationProgress {...operation} accent="violet" title="PDF 편집·추출 로그" />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function createRangeRow(index: number): RangeRow {
  return { id: createLocalId("pdf-range"), name: `분할-${String(index).padStart(2, "0")}`, range: "" };
}

function evaluateRangeRows(rows: RangeRow[], pageCount: number): EvaluatedRangeRow[] {
  const normalizedNames = rows.map((row) => normalizeOutputName(row.name, "").replace(/\.pdf$/i, "").toLocaleLowerCase());
  return rows.map((row, index) => {
    let indexes: number[] = [];
    let error = "";
    if (!row.name.trim()) error = "결과 파일명을 입력해 주세요.";
    else if (normalizedNames.filter((name) => name === normalizedNames[index]).length > 1) error = "다른 범위와 파일명이 중복됩니다.";
    else {
      try { indexes = parsePageRange(row.range, pageCount); }
      catch (reason) { error = reason instanceof Error ? reason.message : "페이지 범위를 확인해 주세요."; }
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

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
