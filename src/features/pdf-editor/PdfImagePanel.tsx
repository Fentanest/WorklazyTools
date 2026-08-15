import { FileImage, GripVertical, Images, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage } from "../../i18n/routing";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, parsePageRange, pdfToImageArchive, releasePdf } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { movePdfItem as moveItem } from "./pdfShared";
import { imagesToPdf } from "./pdfWorkerClient";
import { createLocalId, type PdfPageItem } from "./types";

export function PdfImagePanel({ direction }: { direction: "image-to-pdf" | "pdf-to-image" }) {
  return direction === "image-to-pdf" ? <ImagesToPdf /> : <PdfToImages />;
}

function ImagesToPdf() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const [files, setFiles] = useState<File[]>([]);
  const [pageMode, setPageMode] = useState<"a4" | "image">("a4");
  const [outputName, setOutputName] = useState(language === "ko" ? "Worklazy-이미지-PDF" : "Worklazy-image-PDF");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const operation = useOperationProgress();
  const download = useDownloadResult();

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const sortable = Sortable.create(list, {
      animation: 170,
      handle: ".pdf-drag-handle",
      draggable: ".pdf-image-card",
      delay: 120,
      delayOnTouchOnly: true,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        restoreSortableDom(list, oldIndex, newIndex);
        setFiles((current) => moveItem(current, oldIndex, newIndex));
        download.clearResult();
      },
    });
    return () => sortable.destroy();
  }, [files.length]);

  const addFiles = (next: File[]) => {
    const invalid = next.find((file) => !/\.(png|jpe?g)$/i.test(file.name));
    if (invalid) {
      setError(L(`${invalid.name}: JPG와 PNG 이미지만 추가할 수 있습니다.`, `${invalid.name}: only JPG and PNG images are supported.`));
      return;
    }
    setError("");
    setFiles(next);
    download.clearResult();
  };

  const exportPdf = async () => {
    setError("");
    download.clearResult();
    operation.start(L(`${files.length}개 이미지를 PDF 페이지로 준비하는 중…`, `Preparing ${files.length} images as PDF pages…`));
    try {
      const output = await imagesToPdf(files, pageMode, normalizeOutputName(outputName, L("Worklazy-이미지-PDF", "Worklazy-image-PDF")), operation.update, language);
      download.makeResult(output);
      operation.succeed(L("이미지 순서를 반영한 PDF를 만들었습니다.", "Created a PDF in the selected image order."));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("이미지를 PDF로 변환하지 못했습니다.", "Unable to convert the images to PDF.");
      setError(message);
      operation.fail(message);
    }
  };

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={L("이미지 추가", "Add images")} description={L("JPG와 PNG를 여러 장 추가하고 원하는 순서로 정리하세요.", "Add JPG and PNG images and arrange them in any order.")} className="accent-context-violet">
            <FileDropZone accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple files={files} onFiles={addFiles} accent="violet" hint={L("JPG·PNG를 한 번에 고르거나 여러 번 나눠 추가하세요.", "Choose JPG/PNG images at once or add more later.")} />
          </SectionCard>
          {!!files.length && (
            <SectionCard step={2} title={L("페이지 순서", "Page order")} description={L("끌어서 PDF의 페이지 순서를 바꾸세요.", "Drag images to change the PDF page order.")} className="accent-context-violet">
              <div ref={listRef} className="pdf-image-grid">
                {files.map((file, index) => <ImageCard key={fileKey(file)} file={file} index={index} onRemove={() => { setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index)); download.clearResult(); }} />)}
              </div>
            </SectionCard>
          )}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><Images size={18} /><h2>{L("PDF 설정", "PDF settings")}</h2></div>
            <div className="pdf-summary-control"><span>{L("페이지 크기", "Page size")}</span><SegmentedControl value={pageMode} onChange={setPageMode} label={L("이미지 PDF 페이지 크기", "Image PDF page size")} options={[{ value: "a4", label: L("A4 맞춤", "Fit A4") }, { value: "image", label: L("이미지 크기", "Image size") }]} /></div>
            <dl>
              <div><dt>{L("이미지", "Images")}</dt><dd>{files.length}</dd></div>
              <div><dt>{L("방향", "Orientation")}</dt><dd>{L("A4 자동", "Automatic A4")}</dd></div>
              <div><dt>{L("잘림", "Cropping")}</dt><dd>{L("없음", "None")}</dd></div>
            </dl>
            <label className="pdf-output-field"><span>{L("출력 파일명", "Output file name")}</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.pdf</small></label>
            <PrimaryButton accent="violet" disabled={!files.length || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}><FileImage size={18} /> {L("PDF 만들기", "Create PDF")}</PrimaryButton>
          </section>
          <OperationProgress {...operation} accent="violet" title={L("이미지 변환 로그", "Image conversion log")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function PdfToImages() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<96 | 144 | 216>(144);
  const [pageRange, setPageRange] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const operation = useOperationProgress();
  const download = useDownloadResult();

  useEffect(() => () => { if (file) void releasePdf(file); }, [file]);

  const setInput = async (files: File[]) => {
    const next = files.at(-1);
    if (!next || next === file) return;
    setLoading(true);
    setError("");
    download.clearResult();
    operation.start(L(`${next.name} 페이지 확인 중…`, `Checking pages in ${next.name}…`));
    try {
      const inspected = await inspectPdf(next, language);
      setFile(next);
      setPageCount(inspected.pageCount);
      setPageRange("");
      operation.succeed(L(`${inspected.pageCount}개 페이지를 불러왔습니다.`, `Loaded ${inspected.pageCount} pages.`));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("PDF를 읽지 못했습니다.", "Unable to read the PDF.");
      setError(message);
      operation.fail(message);
    } finally { setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    setError("");
    download.clearResult();
    operation.start(L("PDF 페이지 이미지 변환을 시작합니다.", "Starting PDF page image conversion."));
    try {
      const selectedPages = pageRange.trim() ? parsePageRange(pageRange, pageCount, language) : undefined;
      const output = await pdfToImageArchive(file, format, dpi, 0.9, operation.update, language, selectedPages);
      download.makeBlobResult(output.blob, output.fileName, [L("페이지 수와 해상도가 높을수록 변환 시간과 메모리 사용량이 커집니다.", "More pages and higher resolution increase conversion time and memory use.")]);
      const convertedCount = selectedPages?.length ?? pageCount;
      operation.succeed(L(`${convertedCount}개 페이지 이미지를 ZIP으로 만들었습니다.`, `Created a ZIP containing ${convertedCount} page images.`));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("PDF를 이미지로 변환하지 못했습니다.", "Unable to convert the PDF to images.");
      setError(message);
      operation.fail(message);
    }
  };

  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `image-preview-${index}`, sourceId: "image-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title={L("PDF 선택", "Choose a PDF")} description={L("각 페이지를 고해상도 PNG 또는 JPG 이미지로 변환합니다.", "Convert every page to a high-resolution PNG or JPG image.")} className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint={L("이미지로 변환할 PDF 하나를 선택하세요.", "Choose one PDF to convert to images.")} />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {!!file && <SectionCard step={2} title={L("페이지 미리보기", "Page preview")} description={L("모든 페이지가 같은 형식과 해상도로 변환됩니다.", "Every page is converted with the same format and resolution.")} className="accent-context-violet pdf-page-section"><div className="pdf-page-grid compact">{previewItems.map((item, index) => <PdfThumbnail key={`${file.name}-${file.size}-${file.lastModified}-${item.id}`} item={item} file={file} outputIndex={index} totalItems={previewItems.length} draggable={false} />)}</div></SectionCard>}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><FileImage size={18} /><h2>{L("이미지 설정", "Image settings")}</h2></div>
            <div className="pdf-summary-control"><span>{L("파일 형식", "File format")}</span><SegmentedControl value={format} onChange={setFormat} label={L("출력 이미지 형식", "Output image format")} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }]} /></div>
            <label className="settings-row select-row"><span><strong>{L("해상도", "Resolution")}</strong><small>{L("높을수록 선명하고 느립니다.", "Higher is sharper but slower.")}</small></span><select value={dpi} onChange={(event) => setDpi(Number(event.target.value) as 96 | 144 | 216)}><option value={96}>{L("화면용 · 96 DPI", "Screen · 96 DPI")}</option><option value={144}>{L("선명하게 · 144 DPI", "Sharp · 144 DPI")}</option><option value={216}>{L("고해상도 · 216 DPI", "High resolution · 216 DPI")}</option></select></label>
            <label className="pdf-output-field"><span>{L("변환할 페이지", "Pages to convert")}</span><input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder={L("전체 · 예: 1-3, 7, 10-", "All · e.g. 1-3, 7, 10-")} /><small>{pageRange.trim() ? L("지정", "Custom") : L("전체", "All")}</small></label>
            <dl><div><dt>{L("페이지", "Pages")}</dt><dd>{pageCount}</dd></div><div><dt>{L("출력", "Output")}</dt><dd>ZIP</dd></div></dl>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><Images size={18} /> {L("이미지 ZIP 만들기", "Create image ZIP")}</PrimaryButton>
          </section>
          <OperationProgress {...operation} accent="violet" title={L("PDF 이미지 변환 로그", "PDF image conversion log")} />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function ImageCard({ file, index, onRemove }: { file: File; index: number; onRemove: () => void }) {
  const language = useAppLanguage();
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <article className="pdf-image-card"><div className="pdf-page-card-top"><button type="button" className="pdf-drag-handle" aria-label={language === "ko" ? `${index + 1}번 이미지 순서 변경` : `Reorder image ${index + 1}`}><GripVertical size={16} /></button><strong>{index + 1}</strong><button type="button" className="pdf-image-remove" onClick={onRemove} aria-label={language === "ko" ? `${file.name} 제거` : `Remove ${file.name}`}><Trash2 size={15} /></button></div><div className="pdf-image-preview"><img src={url} alt="" /></div><div className="pdf-page-source"><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div></article>;
}

const imageFileIds = new WeakMap<File, string>();
function fileKey(file: File) {
  let id = imageFileIds.get(file);
  if (!id) { id = createLocalId("pdf-image"); imageFileIds.set(file, id); }
  return id;
}

function restoreSortableDom(container: HTMLElement, oldIndex: number, newIndex: number) {
  const moved = container.children.item(newIndex);
  if (!moved) return;
  container.removeChild(moved);
  container.insertBefore(moved, container.children.item(oldIndex));
}
