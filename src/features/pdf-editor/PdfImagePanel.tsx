import { FileImage, GripVertical, Images, Trash2 } from "lucide-react";
import Sortable from "sortablejs";
import { useEffect, useRef, useState } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { FileDropZone, FileList, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { PdfThumbnail } from "./PdfThumbnail";
import { inspectPdf, pdfToImageArchive, releasePdf } from "./pdfPreview";
import { PdfDownloadCard, PdfError, normalizeOutputName, useDownloadResult } from "./pdfUi";
import { imagesToPdf } from "./pdfWorkerClient";
import type { PdfPageItem } from "./types";

export function PdfImagePanel({ direction }: { direction: "image-to-pdf" | "pdf-to-image" }) {
  return direction === "image-to-pdf" ? <ImagesToPdf /> : <PdfToImages />;
}

function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageMode, setPageMode] = useState<"a4" | "image">("a4");
  const [outputName, setOutputName] = useState("Worklazy-이미지-PDF");
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
        setFiles((current) => moveItem(current, oldIndex, newIndex));
        download.clearResult();
      },
    });
    return () => sortable.destroy();
  }, [files.length]);

  const addFiles = (next: File[]) => {
    const invalid = next.find((file) => !/\.(png|jpe?g)$/i.test(file.name));
    if (invalid) {
      setError(`${invalid.name}: JPG와 PNG 이미지만 추가할 수 있습니다.`);
      return;
    }
    setError("");
    setFiles(next);
    download.clearResult();
  };

  const exportPdf = async () => {
    setError("");
    download.clearResult();
    operation.start(`${files.length}개 이미지를 PDF 페이지로 준비하는 중…`);
    try {
      const output = await imagesToPdf(files, pageMode, normalizeOutputName(outputName, "Worklazy-이미지-PDF"), operation.update);
      download.makeResult(output);
      operation.succeed("이미지 순서를 반영한 PDF를 만들었습니다.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "이미지를 PDF로 변환하지 못했습니다.";
      setError(message);
      operation.fail(message);
    }
  };

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title="이미지 추가" description="JPG와 PNG를 여러 장 추가하고 원하는 순서로 정리하세요." className="accent-context-violet">
            <FileDropZone accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple files={files} onFiles={addFiles} accent="violet" hint="JPG·PNG 여러 장을 선택하거나 끌어다 놓으세요." />
          </SectionCard>
          {!!files.length && (
            <SectionCard step={2} title="페이지 순서" description="끌어서 PDF의 페이지 순서를 바꾸세요." className="accent-context-violet">
              <div ref={listRef} className="pdf-image-grid">
                {files.map((file, index) => <ImageCard key={`${file.name}-${file.lastModified}-${index}`} file={file} index={index} onRemove={() => { setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index)); download.clearResult(); }} />)}
              </div>
            </SectionCard>
          )}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><Images size={18} /><h2>PDF 설정</h2></div>
            <div className="pdf-summary-control"><span>페이지 크기</span><SegmentedControl value={pageMode} onChange={setPageMode} label="이미지 PDF 페이지 크기" options={[{ value: "a4", label: "A4 맞춤" }, { value: "image", label: "이미지 크기" }]} /></div>
            <dl>
              <div><dt>이미지</dt><dd>{files.length}개</dd></div>
              <div><dt>방향</dt><dd>A4 자동</dd></div>
              <div><dt>잘림</dt><dd>없음</dd></div>
            </dl>
            <label className="pdf-output-field"><span>출력 파일명</span><input value={outputName} onChange={(event) => setOutputName(event.target.value)} /><small>.pdf</small></label>
            <PrimaryButton accent="violet" disabled={!files.length || operation.status === "running"} loading={operation.status === "running"} onClick={exportPdf}><FileImage size={18} /> PDF 만들기</PrimaryButton>
          </section>
          <OperationProgress {...operation} accent="violet" title="이미지 변환 로그" />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function PdfToImages() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<96 | 144 | 216>(144);
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
    operation.start(`${next.name} 페이지 확인 중…`);
    try {
      const inspected = await inspectPdf(next);
      setFile(next);
      setPageCount(inspected.pageCount);
      operation.succeed(`${inspected.pageCount}개 페이지를 불러왔습니다.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "PDF를 읽지 못했습니다.";
      setError(message);
      operation.fail(message);
    } finally { setLoading(false); }
  };

  const convert = async () => {
    if (!file) return;
    setError("");
    download.clearResult();
    operation.start("PDF 페이지 이미지 변환을 시작합니다.");
    try {
      const output = await pdfToImageArchive(file, format, dpi, 0.9, operation.update);
      download.makeBlobResult(output.blob, output.fileName, ["페이지 수와 해상도가 높을수록 변환 시간과 메모리 사용량이 커집니다."]);
      operation.succeed(`${pageCount}개 페이지 이미지를 ZIP으로 만들었습니다.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "PDF를 이미지로 변환하지 못했습니다.";
      setError(message);
      operation.fail(message);
    }
  };

  const previewItems: PdfPageItem[] = file ? Array.from({ length: pageCount }, (_, index) => ({ id: `image-preview-${index}`, sourceId: "image-source", sourceName: file.name, sourcePageIndex: index, rotation: 0 })) : [];

  return (
    <>
      <div className="workflow-grid pdf-workflow-grid">
        <div>
          <SectionCard step={1} title="PDF 선택" description="각 페이지를 고해상도 PNG 또는 JPG 이미지로 변환합니다." className="accent-context-violet">
            <FileDropZone accept=".pdf,application/pdf" files={file ? [file] : []} onFiles={setInput} accent="violet" hint="이미지로 변환할 PDF 하나를 선택하세요." />
            {file && <FileList files={[file]} accent="violet" onRemove={() => { void releasePdf(file); setFile(null); setPageCount(0); download.clearResult(); }} />}
          </SectionCard>
          {!!file && <SectionCard step={2} title="페이지 미리보기" description="모든 페이지가 같은 형식과 해상도로 변환됩니다." className="accent-context-violet pdf-page-section"><div className="pdf-page-grid compact">{previewItems.map((item, index) => <PdfThumbnail key={item.id} item={item} file={file} outputIndex={index} draggable={false} />)}</div></SectionCard>}
        </div>
        <aside className="workflow-summary">
          <section className="summary-card">
            <div className="summary-title"><FileImage size={18} /><h2>이미지 설정</h2></div>
            <div className="pdf-summary-control"><span>파일 형식</span><SegmentedControl value={format} onChange={setFormat} label="출력 이미지 형식" options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPG" }]} /></div>
            <label className="settings-row select-row"><span><strong>해상도</strong><small>높을수록 선명하고 느립니다.</small></span><select value={dpi} onChange={(event) => setDpi(Number(event.target.value) as 96 | 144 | 216)}><option value={96}>화면용 · 96 DPI</option><option value={144}>선명하게 · 144 DPI</option><option value={216}>고해상도 · 216 DPI</option></select></label>
            <dl><div><dt>페이지</dt><dd>{pageCount}개</dd></div><div><dt>출력</dt><dd>ZIP</dd></div></dl>
            <PrimaryButton accent="violet" disabled={!file || loading || operation.status === "running"} loading={operation.status === "running"} onClick={convert}><Images size={18} /> 이미지 ZIP 만들기</PrimaryButton>
          </section>
          <OperationProgress {...operation} accent="violet" title="PDF 이미지 변환 로그" />
        </aside>
      </div>
      <PdfError message={error} />
      {download.result && <PdfDownloadCard result={download.result} />}
    </>
  );
}

function ImageCard({ file, index, onRemove }: { file: File; index: number; onRemove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <article className="pdf-image-card"><div className="pdf-page-card-top"><button type="button" className="pdf-drag-handle" aria-label={`${index + 1}번 이미지 순서 변경`}><GripVertical size={16} /></button><strong>{index + 1}</strong><button type="button" className="pdf-image-remove" onClick={onRemove} aria-label={`${file.name} 제거`}><Trash2 size={15} /></button></div><div className="pdf-image-preview"><img src={url} alt="" /></div><div className="pdf-page-source"><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div></article>;
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
