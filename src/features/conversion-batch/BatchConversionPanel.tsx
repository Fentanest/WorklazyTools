import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { stripLanguagePrefix } from "../../i18n/languages";
import { Download, Printer, RotateCcw, Trash2, X } from "lucide-react";
import { useUnsavedWorkGuard } from "../../app/toolState";
import { UtilityInput, UtilityNotice, UtilitySelect } from "../../components/UtilitySurface";
import { FileDropZone, PrimaryButton, SectionCard, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { useAppLanguage } from "../../i18n/routing";
import { createZipArchiveBlob } from "../../utils/zipArchive";
import { HwpPdfPanel } from "../pdf-converter/HwpPdfPanel";
import { BATCH_LIMITS, BatchQueue, type BatchError, type BatchStatus } from "./batchQueue";
import { batchProcessor, defaultBatchOptions, validateBatchFile, type BatchMode, type BatchOptions } from "./batchProcessors";
import { releaseOfficePdfSession } from "../pdf-converter/officePdfClient";
import { releaseBentoPdfSession } from "../pdf-editor/bentoPdfClient";
import { releasePdfOcrSession } from "../pdf-editor/pdfOcrClient";
import { releaseStirlingDocumentSession } from "../pdf-editor/stirlingDocumentClient";

function releasePdfDocumentSessions() { releaseBentoPdfSession(); void releasePdfOcrSession(); releaseStirlingDocumentSession(); }

export function BatchConversionPanel({ mode, files, initialOptions, onFilesChange, onClose }: { mode: BatchMode; files: File[]; initialOptions?: Partial<BatchOptions>; onFilesChange?: (files: File[]) => void; onClose: () => void }) {
  const language = useAppLanguage();
  const location = useLocation();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const [queue, setQueue] = useState<BatchQueue>();
  const [, refresh] = useState(0);
  const [options, setOptions] = useState<BatchOptions>(() => ({ ...defaultBatchOptions, ...initialOptions }));
  const [admissionError, setAdmissionError] = useState(false);
  const [printing, setPrinting] = useState<number>();
  const [zipUrl, setZipUrl] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState(false);
  const zipTask = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const next = new BatchQueue(file => validateBatchFile(mode, file));
    const unsubscribe = next.subscribe(() => refresh(value => value + 1));
    setAdmissionError(!next.add(files)); setQueue(next);
    return () => { unsubscribe(); next.dispose(); zipTask.current?.abort(); if (mode === "document-pdf") releaseOfficePdfSession(); if (mode === "pdf-document") releasePdfDocumentSessions(); };
  }, [files, mode]);
  const items = queue?.items ?? [];
  useEffect(() => { if (queue) onFilesChange?.(queue.items.map(item => item.file)); });
  const outputs = items.flatMap(item => item.output ? [{ ...item.output, id: item.id }] : []);
  const outputKey = outputs.map(output => `${output.id}:${output.url}`).join("|");
  useEffect(() => { setZipUrl(""); setZipError(false); zipTask.current?.abort(); }, [outputKey]);
  useEffect(() => () => { if (zipUrl) URL.revokeObjectURL(zipUrl); }, [zipUrl]);
  useUnsavedWorkGuard(`conversion-batch-${mode}`, items.some(item => !item.saved), { kind: "files", scopePath: stripLanguagePrefix(location.pathname).replace(/\/$/, "") });
  const busy = Boolean(queue?.running || zipBusy || printing !== undefined);
  const selectedPrint = items.find(item => item.id === printing);
  const status: Record<BatchStatus, string> = {
    pending: L("대기", "Queued"), running: L("변환 중", "Converting"), success: L("변환 완료", "Converted"), failed: L("실패", "Failed"), cancelled: L("취소됨", "Cancelled"),
    "print-needed": L("개별 인쇄 필요", "Individual printing needed"), "print-reviewed": L("인쇄 확인을 마침 · 저장 여부 확인 불가", "Print review finished · save status unknown"),
  };
  const errors: Record<BatchError, string> = {
    unsupported: L("이 탭에서 지원하지 않는 파일 형식입니다.", "This tab does not support this file format."),
    "input-limit": L("파일당 50 MiB 이하만 처리합니다.", "Files must be no larger than 50 MiB each."),
    "output-limit": L("결과 용량 제한에 도달했습니다. 기존 결과를 저장·제거하고 다시 시도하거나 파일·페이지를 줄여 주세요.", "The result size limit was reached. Save and remove existing results, or retry with a smaller file or fewer pages."),
    "page-limit": L("일괄 변환은 파일당 선택한 200페이지까지 처리합니다. 페이지 범위를 줄여 주세요.", "Batch conversion processes up to 200 selected pages per file. Reduce the page range."),
    range: L("이 파일의 페이지 수에 맞는 범위를 입력해 주세요.", "Enter a page range that exists in this file."),
    encrypted: L("암호를 해제한 사본을 선택해 주세요.", "Choose an unlocked copy."),
    "no-text": L("읽을 수 있는 글자가 없습니다. 스캔 PDF라면 OCR을 켜고 다시 시도하세요.", "No readable text was found. If this is a scan, turn on OCR and try again."),
    "no-tables": L("PDF에서 표를 찾지 못했습니다. 일반 글은 TXT·DOCX를 선택해 주세요.", "No table was found in the PDF. Choose TXT or DOCX for prose."),
    "ocr-required-for-tables": L("스캔 PDF의 표를 읽으려면 OCR을 자동으로 설정해 다시 시도하세요.", "To read tables in this scan, turn on automatic OCR and try again."),
    "scan-table-unavailable": L("OCR로 글자를 인식했지만 표 셀은 찾지 못했습니다. DOCX·TXT로 인식 결과를 확인해 주세요.", "OCR recognized text but found no reliable table cells. Review the result as DOCX or TXT."),
    "image-decode": L("PDF의 그림을 읽지 못해 이 파일 변환을 중단했습니다. 원본 파일을 확인해 주세요.", "An image in this PDF could not be decoded. Check the source file and retry."),
    unavailable: L("변환 준비를 완료하지 못했습니다. 연결 상태와 데스크톱 브라우저를 확인해 주세요.", "Conversion could not be prepared. Check your connection and use a current desktop browser."),
    timeout: L("변환 시간이 초과됐습니다. 더 작은 파일로 다시 시도해 주세요.", "Conversion timed out. Retry with a smaller file."),
    conversion: L("변환하지 못했습니다. 파일 형식·손상·암호 여부를 확인한 뒤 다시 시도해 주세요.", "Conversion failed. Check the file format, damage or password protection, then retry."),
  };
  const update = <K extends keyof BatchOptions>(key: K, value: BatchOptions[K]) => setOptions(current => ({ ...current, [key]: value }));
  const buildZip = async () => {
    if (busy || !outputs.length) return;
    const controller = new AbortController(); zipTask.current = controller;
    setZipBusy(true); setZipError(false);
    try {
      const blob = await createZipArchiveBlob(outputs, controller.signal);
      if (!controller.signal.aborted) setZipUrl(URL.createObjectURL(blob));
    } catch { if (!controller.signal.aborted) setZipError(true); }
    finally { if (zipTask.current === controller) { zipTask.current = undefined; setZipBusy(false); } }
  };
  return <div data-testid="conversion-batch" className="space-y-4">
    <SectionCard step={1} title={L("여러 파일 변환", "Convert multiple files")} description={L("파일별로 순서대로 처리합니다. 한 파일이 실패해도 다음 파일은 계속합니다.", "Files are processed one at a time. A failed file does not stop the next file.")}>
      <FileDropZone multiple files={[]} disabled={busy} accent="coral" accept={mode === "document-pdf" ? ".hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx" : mode === "markdown" ? ".docx,.xlsx,.xls,.pptx,.pdf" : ".pdf"}
        onFiles={added => setAdmissionError(!(queue?.add(added) ?? false))} hint={L("최대 20개 · 파일당 50 MiB · 입력 합계 200 MiB", "Up to 20 files · 50 MiB each · 200 MiB total input")} />
      {admissionError && <UtilityNotice kind="error" role="alert" className="mt-3">{L("선택한 묶음이 파일 수 또는 합계 용량 제한을 넘어서 추가되지 않았습니다. 더 작은 묶음을 선택하세요.", "The selected group was not added because it exceeds the file count or total size limit. Choose a smaller group.")}</UtilityNotice>}
    </SectionCard>
    <UtilityNotice kind="info">{L("변환 결과는 합계 128 MiB까지 보관하고, 전체 ZIP은 결과 합계 64 MiB까지 만듭니다. 변환 중 메모리는 파일 용량보다 커질 수 있습니다. 큰 문서는 작은 묶음으로 처리하세요.", "Up to 128 MiB of results are retained. A combined ZIP is available for results totaling up to 64 MiB. Conversion may use much more memory than the input size. Process large documents in smaller groups.")}</UtilityNotice>
    {mode === "document-pdf" && <UtilityNotice kind="info">{L("워드·엑셀·PPT는 변환 후 ZIP으로 받을 수 있습니다. HWP·HWPX는 파일마다 브라우저 인쇄에서 PDF로 저장해야 하며 ZIP에 포함되지 않습니다. 첫 변환은 준비 시간이 더 걸릴 수 있습니다.", "Word, Excel and PowerPoint results can be downloaded together as a ZIP. HWP and HWPX need Save as PDF in the print dialog for each file and are not included in the ZIP. The first conversion may take longer to prepare.")}</UtilityNotice>}
    {mode === "markdown" && <UtilityNotice kind="info">{L("문서의 제목·문단·표를 Markdown으로 저장합니다. 원본 서식과 수식은 유지되지 않으며 스캔 PDF의 글자는 인식하지 않습니다.", "Save headings, paragraphs and tables as Markdown. Original formatting and formulas are not kept, and text in scanned PDFs is not recognized.")}</UtilityNotice>}
    {mode === "pdf-images" && <UtilityNotice kind="info">{L("PDF마다 페이지 이미지 ZIP을 만듭니다. 전체 다운로드 ZIP에는 이 문서별 ZIP들이 들어갑니다.", "Each PDF produces a ZIP of page images. The combined download contains these per-document ZIPs.")}</UtilityNotice>}
    {mode === "pdf-document" && <UtilityNotice kind="info">{L("편집 가능한 내용과 페이지 모양 유지 중 선택하세요. 스캔 페이지의 글자를 편집하려면 OCR을 사용하고, 결과의 숫자·표·읽기 순서를 원본과 비교하세요.", "Choose editable content or preserve page appearance. Use OCR for editable text from scans, then compare numbers, tables and reading order with the original.")}</UtilityNotice>}
    {(mode === "pdf-document" || mode === "pdf-images") && <SectionCard step={2} title={L("공통 변환 설정", "Shared conversion settings")} description={L("이후 시작·재시도하는 파일에 적용합니다. 완료된 결과는 유지합니다.", "Applies to files started or retried next. Existing results are kept.")}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        {mode === "pdf-document" && <>
          <label className="grid gap-1 text-sm">{L("출력 형식", "Output format")}<UtilitySelect value={options.format} onChange={event => update("format", event.target.value as BatchOptions["format"])}>{["docx", "xlsx", "pptx", "hwpx", "txt", "searchable-pdf"].map(format => <option key={format} value={format}>{format === "searchable-pdf" ? L("검색 가능한 PDF", "Searchable PDF") : format.toUpperCase()}</option>)}</UtilitySelect></label>
          <label className="grid gap-1 text-sm">{L("OCR 적용", "OCR scope")}<UtilitySelect value={options.ocrMode} onChange={event => update("ocrMode", event.target.value as BatchOptions["ocrMode"])}><option value="auto">{L("자동", "Auto")}</option><option value="off">{L("끄기", "Off")}</option><option value="all">{L("모든 페이지", "All pages")}</option></UtilitySelect></label>
          <label className="grid gap-1 text-sm">{L("OCR 글 배치", "OCR text layout")}<UtilitySelect value={options.ocrLayout} onChange={event => update("ocrLayout", event.target.value as BatchOptions["ocrLayout"])}><option value="sparse">{L("표·흩어진 글자", "Tables / scattered text")}</option><option value="paragraphs">{L("연속된 문단", "Continuous paragraphs")}</option></UtilitySelect></label>
          {(["docx", "pptx", "hwpx"] as BatchOptions["format"][]).includes(options.format) && <label className="grid gap-1 text-sm">{L("출력 방식", "Output mode")}<UtilitySelect value={options.outputMode} onChange={event => update("outputMode", event.target.value as BatchOptions["outputMode"])}><option value="editable">{L("편집 가능한 내용", "Editable content")}</option><option value="page-image">{L("페이지 모양 유지 · 글자 편집 불가", "Preserve pages · text not editable")}</option></UtilitySelect></label>}
        </>}
        {mode === "pdf-images" && <>
          <label className="grid gap-1 text-sm">{L("이미지 형식", "Image format")}<UtilitySelect value={options.imageFormat} onChange={event => update("imageFormat", event.target.value as "png" | "jpeg")}><option value="png">PNG</option><option value="jpeg">JPG</option></UtilitySelect></label>
          <label className="grid gap-1 text-sm">{L("해상도", "Resolution")}<UtilitySelect value={options.dpi} onChange={event => update("dpi", Number(event.target.value) as BatchOptions["dpi"])}>{[96, 144, 216].map(dpi => <option key={dpi} value={dpi}>{dpi} DPI</option>)}</UtilitySelect></label>
        </>}
        <label className="grid gap-1 text-sm">{L("파일별 페이지 범위", "Page range in each file")}<UtilityInput value={options.pageRange} onChange={event => update("pageRange", event.target.value)} placeholder={L("전체 · 예: 1, 3-5 · 최대 200페이지", "All · e.g. 1, 3-5 · up to 200 pages")} /></label>
      </fieldset>
    </SectionCard>}
    <div className="flex flex-wrap gap-2">
      <PrimaryButton accent="coral" disabled={busy || !items.some(item => item.status === "pending")} onClick={() => { void (async () => { try { await queue?.run(batchProcessor(mode, { ...options }, language)); } finally { if (mode === "document-pdf") releaseOfficePdfSession(); if (mode === "pdf-document") releasePdfDocumentSessions(); } })(); }}>{L("대기 파일 변환", "Convert queued files")}</PrimaryButton>
      {queue?.running && <Button variant="outline" onClick={() => queue.cancelAll()}><X size={16} />{L("남은 변환 모두 취소", "Cancel all remaining")}</Button>}
      {!items.length && <Button variant="outline" onClick={onClose}>{L("단일 파일 화면", "Single-file view")}</Button>}
    </div>
    <ul className="space-y-3" aria-label={L("변환 목록", "Conversion queue")}>
      {items.map(item => <li key={item.id} data-testid="batch-row" data-state={item.status} className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="min-w-0 break-all text-sm">{item.file.name}</strong><span className="text-sm text-muted-foreground">{formatBytes(item.file.size)}</span></div>
        <p role="status" className="my-2 text-sm">{status[item.status]}{item.status === "running" ? ` · ${item.progress}%` : ""}</p>
        {item.status === "running" && <progress aria-label={L("파일 변환 진행률", "File conversion progress")} className="w-full accent-primary" max={100} value={item.progress} />}
        {item.error && <UtilityNotice kind="error" role="alert" className="my-2">{errors[item.error]}</UtilityNotice>}
        {Boolean(item.output?.warningCount) && <div className="my-2 text-sm">{item.output?.warningLanguage === language && item.output.warnings?.length
          ? <ul className="list-disc space-y-1 pl-5">{item.output.warnings.slice(0, 8).map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
          : <p>{L("추출·OCR 결과에 주의 사항이 있습니다. 원본과 텍스트·이미지·표를 대조하세요.", "Extraction or OCR requires review. Compare text, images and tables with the original.")}</p>}</div>}
        <div className="flex flex-wrap gap-2">
          {item.output && <Button render={<a data-testid="batch-download" href={item.output.url} download={item.output.fileName} onClick={() => queue?.saved(item.id)} />}><Download size={16} /><span className="break-all whitespace-normal">{item.output.fileName}</span></Button>}
          {["pending", "running"].includes(item.status) && <Button variant="outline" onClick={() => queue?.cancel(item.id)}><X size={16} />{L("취소", "Cancel")}</Button>}
          {["failed", "cancelled", "print-reviewed"].includes(item.status) && <Button variant="outline" disabled={busy} onClick={() => queue?.retry(item.id)}><RotateCcw size={16} />{L("다시 대기", "Queue again")}</Button>}
          {item.status === "print-needed" && <Button variant="outline" disabled={busy} onClick={() => setPrinting(item.id)}><Printer size={16} />{L("이 문서 인쇄", "Print this document")}</Button>}
          <Button variant="outline" disabled={busy} onClick={() => queue?.remove(item.id)} aria-label={L(`${item.file.name} 제거`, `Remove ${item.file.name}`)}><Trash2 size={16} />{L("제거", "Remove")}</Button>
        </div>
      </li>)}
    </ul>
    {selectedPrint && <div className="space-y-3"><HwpPdfPanel key={selectedPrint.id} file={selectedPrint.file} onClear={() => setPrinting(undefined)} /><Button variant="outline" onClick={() => { queue?.reviewed(selectedPrint.id); setPrinting(undefined); }}>{L("인쇄 확인을 마치고 목록으로", "Finish print review and return to list")}</Button><p className="text-sm">{L("이 버튼은 PDF 저장을 확인하지 않습니다.", "This button does not confirm that a PDF was saved.")}</p></div>}
    {!!outputs.length && <SectionCard step={3} title={L("전체 다운로드", "Download all")} description={L("변환에 성공한 다운로드 파일만 포함합니다. 같은 파일명은 번호로 구분합니다.", "Includes successfully converted downloadable files. Duplicate names receive a number.")}>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || outputs.reduce((sum, output) => sum + output.blob.size, 0) > BATCH_LIMITS.zipBytes} onClick={() => void buildZip()}>{L("전체 ZIP 만들기", "Create combined ZIP")}</Button>
        {zipBusy && <Button variant="outline" onClick={() => zipTask.current?.abort()}>{L("ZIP 취소", "Cancel ZIP")}</Button>}
        {zipUrl && <Button render={<a data-testid="batch-zip-download" href={zipUrl} download="worklazy-converted.zip" onClick={() => outputs.forEach(output => queue?.saved(output.id))} />}><Download size={16} />{L("전체 ZIP 다운로드", "Download combined ZIP")}</Button>}
      </div>
      {outputs.reduce((sum, output) => sum + output.blob.size, 0) > BATCH_LIMITS.zipBytes && <p className="mt-2 text-sm">{L("결과 합계가 64 MiB를 넘었습니다. 개별 다운로드를 사용하세요.", "Results exceed 64 MiB. Use the individual downloads.")}</p>}
      {zipError && <UtilityNotice kind="error" role="alert">{L("ZIP을 만들지 못했습니다. 개별 다운로드를 사용하거나 다시 시도하세요.", "Could not create the ZIP. Use individual downloads or retry.")}</UtilityNotice>}
    </SectionCard>}
  </div>;
}
