import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  FileText,
  GripVertical,
  Info,
  TextSearch,
  X,
} from "lucide-react";
import { type DragEvent as ReactDragEvent, useState } from "react";
import { Link } from "react-router-dom";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import {
  FileDropZone,
  formatBytes,
  PageHeader,
  PrimaryButton,
  SectionCard,
  ToggleRow,
} from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { createWordExcelReports } from "../excel-merger/excelWorkerClient";
import { useWordCompareSession } from "./wordCompareSession";
import { compareWordFilePairs } from "./wordWorkerClient";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";

export function WordComparePage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const resultBasePath = useLocalizedPath("/tools/word-compare/results");
  const {
    beforeFiles,
    setBeforeFiles,
    afterFiles,
    setAfterFiles,
    webOutput,
    setWebOutput,
    excelOutput,
    setExcelOutput,
    trackedOutput,
    setTrackedOutput,
    revisionAuthor,
    setRevisionAuthor,
    formatting,
    setFormatting,
    tables,
    setTables,
    metadata,
    setMetadata,
    results,
    replaceResults,
    clearResults,
  } = useWordCompareSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useOperationProgress();

  const hasFiles = beforeFiles.length > 0 || afterFiles.length > 0;
  const hasOutput = webOutput || excelOutput || trackedOutput;
  const countMismatch = hasFiles && beforeFiles.length !== afterFiles.length;
  const ready = beforeFiles.length > 0 && beforeFiles.length === afterFiles.length && hasOutput && !loading;
  const pairingError = countMismatch
    ? L(`수정 전 ${beforeFiles.length}개와 수정 후 ${afterFiles.length}개의 파일 수가 일치하지 않습니다. 같은 개수로 맞춰 주세요.`, `${beforeFiles.length} before files and ${afterFiles.length} after files do not match. Use the same count on both sides.`)
    : null;

  const resetOutput = () => {
    clearResults();
    setError(null);
    operation.reset();
  };

  const updateDocxFiles = (files: File[], setter: typeof setBeforeFiles) => {
    const rejected = files.filter((file) => !file.name.toLowerCase().endsWith(".docx"));
    const accepted = deduplicateFiles(files.filter((file) => file.name.toLowerCase().endsWith(".docx")));
    setter(accepted);
    clearResults();
    operation.reset();
    setError(rejected.length ? L(`DOCX가 아닌 파일을 제외했습니다: ${rejected.map((file) => file.name).join(", ")}`, `Non-DOCX files were excluded: ${rejected.map((file) => file.name).join(", ")}`) : null);
  };

  const removeFile = (side: "before" | "after", index: number) => {
    const setter = side === "before" ? setBeforeFiles : setAfterFiles;
    setter((current) => current.filter((_, itemIndex) => itemIndex !== index));
    resetOutput();
  };

  const moveFile = (side: "before" | "after", from: number, to: number) => {
    const setter = side === "before" ? setBeforeFiles : setAfterFiles;
    setter((current) => reorder(current, from, to));
    resetOutput();
  };

  const moveFileAcross = (side: "before" | "after", index: number) => {
    const sourceFiles = side === "before" ? beforeFiles : afterFiles;
    const targetFiles = side === "before" ? afterFiles : beforeFiles;
    const sourceSetter = side === "before" ? setBeforeFiles : setAfterFiles;
    const targetSetter = side === "before" ? setAfterFiles : setBeforeFiles;
    const file = sourceFiles[index];
    if (!file) return;

    sourceSetter(sourceFiles.filter((_, itemIndex) => itemIndex !== index));
    const targetIndex = Math.min(index, targetFiles.length);
    targetSetter([
      ...targetFiles.slice(0, targetIndex),
      file,
      ...targetFiles.slice(targetIndex),
    ]);
    resetOutput();
  };

  const runComparison = async () => {
    if (pairingError) {
      setError(pairingError);
      return;
    }
    if (!ready) return;

    clearResults();
    setError(null);
    setLoading(true);
    operation.start(L(`${beforeFiles.length}개 문서 쌍의 비교를 준비하고 있습니다.`, `Preparing ${beforeFiles.length} document pairs.`));

    try {
      const workerResults = await compareWordFilePairs(
        beforeFiles.map((beforeFile, index) => ({ beforeFile, afterFile: afterFiles[index] })),
        {
          formatting,
          tables,
          metadata,
          trackedDocument: trackedOutput,
          revisionAuthor: revisionAuthor.trim() || "Worklazy Tools",
        },
        (nextProgress, message) => {
          operation.update(excelOutput ? Math.round(nextProgress * 0.8) : nextProgress, message);
        },
        language,
      );
      const comparisonResults = workerResults.map((item) => item.result);

      let reportBuffers: ArrayBuffer[] = [];
      if (excelOutput) {
        operation.update(80, L(`${comparisonResults.length}개 Excel 보고서를 준비합니다.`, `Preparing ${comparisonResults.length} Excel reports.`));
        reportBuffers = await createWordExcelReports(comparisonResults, (nextProgress, message) => {
          operation.update(80 + Math.round(nextProgress * 0.2), message);
        }, language);
      }

      replaceResults(comparisonResults.map((result, index) => {
        const reportBuffer = reportBuffers[index];
        const trackedBuffer = workerResults[index]?.trackedBuffer;
        return {
          pairNumber: index + 1,
          result,
          reportUrl: reportBuffer ? URL.createObjectURL(new Blob([reportBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          })) : undefined,
          reportFileName: reportBuffer ? createReportFileName(index + 1, result.beforeName, result.afterName, language) : undefined,
          trackedUrl: trackedBuffer ? URL.createObjectURL(new Blob([trackedBuffer], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          })) : undefined,
          trackedFileName: trackedBuffer ? createTrackedFileName(index + 1, result.beforeName, result.afterName, language) : undefined,
        };
      }));
      operation.succeed(L(`${comparisonResults.length}개 문서 쌍의 결과를 모두 만들었습니다.`, `Created results for all ${comparisonResults.length} document pairs.`));
    } catch (comparisonError) {
      const message = comparisonError instanceof Error ? comparisonError.message : L("Word 문서를 비교하지 못했습니다.", "Could not compare the Word documents.");
      setError(message);
      operation.fail(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page tool-page page-enter accent-context-blue">
      <PageHeader eyebrow="DOCUMENT TOOL" title="Word Compare" description={L("여러 DOCX 문서 쌍의 변경 내용을 다중 동시 비교로 한 번에 확인하세요.", "Compare changes across multiple pairs of DOCX documents in one batch.")}>
        <div className="header-status ready"><span className="status-dot" /> {L("파일 업로드 없이 비교", "Compare without file uploads")}</div>
      </PageHeader>
      <PrivacyBanner compact />

      <SectionCard step={1} title={L("비교할 문서", "Documents to compare")} description={L("드래그로 순서를 맞추거나 화살표로 문서를 반대쪽 목록에 옮기세요.", "Drag to align the order, or use the arrows to move a document to the other list.")}>
        <div className="compare-file-grid">
          <div>
            <WordFileColumn
              files={beforeFiles}
              sideLabel={L("수정 전", "Before")}
              hint={L("원본 DOCX · 여러 번 나눠 추가 가능", "Original DOCX · add more at any time")}
              onFiles={(files) => updateDocxFiles(files, setBeforeFiles)}
              onRemove={(index) => removeFile("before", index)}
              onMove={(from, to) => moveFile("before", from, to)}
              onMoveAcross={(index) => moveFileAcross("before", index)}
            />
          </div>
          <div>
            <WordFileColumn
              files={afterFiles}
              sideLabel={L("수정 후", "After")}
              hint={L("변경된 DOCX · 여러 번 나눠 추가 가능", "Revised DOCX · add more at any time")}
              onFiles={(files) => updateDocxFiles(files, setAfterFiles)}
              onRemove={(index) => removeFile("after", index)}
              onMove={(from, to) => moveFile("after", from, to)}
              onMoveAcross={(index) => moveFileAcross("after", index)}
            />
          </div>
        </div>

        {pairingError && <div className="pair-count-error" role="alert"><AlertCircle size={17} /><span><strong>{L("파일 수가 맞지 않습니다.", "File counts do not match.")}</strong><small>{pairingError}</small></span></div>}
        {!pairingError && beforeFiles.length > 0 && <PairingPreview beforeFiles={beforeFiles} afterFiles={afterFiles} language={language} />}
      </SectionCard>

      <div className="word-options-grid">
        <SectionCard step={2} title={L("결과 형식", "Output formats")}>
          <div className="settings-list compact-settings output-selection-list">
            <ToggleRow label={L("웹 비교", "Web comparison")} description={L("좌우 문서 화면에서 변경 내용을 확인합니다.", "Review changes in a side-by-side document view.")} checked={webOutput} onChange={(checked) => { setWebOutput(checked); resetOutput(); }} />
            <ToggleRow label={L("Excel 보고서", "Excel report")} description={L("일반 변경과 표 변경 시트를 만듭니다.", "Create worksheets for general changes and table changes.")} checked={excelOutput} onChange={(checked) => { setExcelOutput(checked); resetOutput(); }} />
            <ToggleRow label={L("Word 변경 추적", "Tracked-changes Word file")} description={L("Word에서 변경을 수락·거부할 수 있는 DOCX를 만듭니다.", "Create a DOCX whose changes can be accepted or rejected in Word.")} checked={trackedOutput} onChange={(checked) => { setTrackedOutput(checked); resetOutput(); }} />
          </div>
          {trackedOutput && (
            <label className="revision-author-field">
              <span>{L("변경 내용 작성자", "Revision author")}</span>
              <input
                type="text"
                value={revisionAuthor}
                maxLength={80}
                placeholder="Worklazy Tools"
                onChange={(event) => { setRevisionAuthor(event.target.value); resetOutput(); }}
              />
            </label>
          )}
          <div className="output-preview">
            <FileText size={20} />
            <span><strong>{hasOutput ? [webOutput && L("웹", "Web"), excelOutput && "Excel", trackedOutput && L("Word 추적", "Tracked Word")].filter(Boolean).join(" · ") : L("결과 형식을 하나 이상 선택하세요.", "Select at least one output format.")}</strong><small>{trackedOutput ? L("Word 검토 탭에서 삽입·삭제 내용을 수락하거나 거부할 수 있습니다.", "Accept or reject insertions and deletions in Word's Review tab.") : L("문서 쌍마다 선택한 결과를 각각 제공합니다.", "Each selected output is provided for every document pair.")}</small></span>
          </div>
        </SectionCard>

        <SectionCard step={3} title={L("비교 범위", "Comparison scope")}>
          <div className="settings-list compact-settings">
            <ToggleRow label={L("서식 변경 포함", "Include formatting changes")} checked={formatting} onChange={(checked) => { setFormatting(checked); resetOutput(); }} />
            <ToggleRow label={L("표 비교", "Compare tables")} checked={tables} onChange={(checked) => { setTables(checked); resetOutput(); }} />
            <ToggleRow label={L("기타 문서 영역", "Other document areas")} description={L("머리말·꼬리말, 메모, 각주·미주", "Headers, footers, comments, footnotes and endnotes")} checked={metadata} onChange={(checked) => { setMetadata(checked); resetOutput(); }} />
          </div>
        </SectionCard>
      </div>

      <div className="comparison-prepare-note"><Info size={16} /><span><strong>{L("오프라인에서 사이트를 처음 열면 비교를 시작할 수 없습니다.", "Comparison cannot start on a first visit while offline.")}</strong><small>{L("비교 실행 환경은 Worklazy Tools 배포 파일에서만 불러오며 외부 CDN을 사용하지 않습니다. 실행 환경을 불러온 뒤 선택한 파일은 브라우저 안에서만 처리합니다.", "The comparison runtime is loaded only from this Worklazy Tools deployment, not an external CDN. Your selected files are then processed only in the browser.")}</small></span></div>

      <div className="tool-action-bar">
        <div><TextSearch size={20} /><span><strong>{ready ? L(`${beforeFiles.length}개 문서 쌍을 비교할 준비가 됐어요.`, `${beforeFiles.length} document pairs are ready.`) : pairingError ? L("양쪽 파일 개수를 맞춰 주세요.", "Use the same number of files on both sides.") : !hasOutput ? L("결과 형식을 하나 이상 선택해 주세요.", "Select at least one output format.") : L("수정 전·후 문서를 선택해 주세요.", "Choose before and after documents.")}</strong><small>{L("비교 중에도 화면을 계속 사용할 수 있습니다.", "You can continue using the page during comparison.")}</small></span></div>
        <PrimaryButton accent="blue" disabled={!ready || Boolean(pairingError)} loading={loading} onClick={() => void runComparison()}>{loading ? L(`${operation.progress}% 비교 중`, `Comparing ${operation.progress}%`) : beforeFiles.length ? L(`${beforeFiles.length}개 문서 쌍 비교`, `Compare ${beforeFiles.length} document pairs`) : L("문서 쌍 비교", "Compare document pairs")}</PrimaryButton>
      </div>

      <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="blue" title={L("Word 비교 진행 상황", "Word comparison progress")} />

      {error && !pairingError && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>{L("비교하지 못했습니다.", "Comparison failed.")}</strong><span>{error}</span></div></div>}

      {results.length > 0 && (
        <section className="word-batch-results" aria-live="polite">
          <div className="content-heading">
            <div><p className="eyebrow success">{L("작업 완료", "Complete")}</p><h2>{L(`${results.length}개 문서 쌍의 결과`, `Results for ${results.length} document pairs`)}</h2><p>{L("각 문서 쌍에서 선택한 웹·Excel·Word 변경 추적 결과를 개별적으로 열 수 있습니다.", "Open each selected web, Excel or tracked Word result separately for every pair.")}</p></div>
          </div>
          <div className="word-pair-result-list">
            {results.map((item) => (
              <article className="word-pair-result-card" key={item.pairNumber}>
                <span className="pair-number">{item.pairNumber}</span>
                <div className="pair-result-copy">
                  <strong>{item.result.beforeName}</strong>
                  <span>→</span>
                  <strong>{item.result.afterName}</strong>
                  <small>{item.result.changes.length ? L(`${item.result.changes.length}개 변경 발견`, `${item.result.changes.length} changes found`) : L("변경 없음", "No changes")}</small>
                </div>
                <div className="pair-result-actions">
                  {webOutput && <Link className="secondary-button" to={`${resultBasePath}/${item.pairNumber}`}><TextSearch size={15} /> {L("웹 비교 보기", "View web comparison")}</Link>}
                  {item.reportUrl && <a className="result-download blue-download" href={item.reportUrl} download={item.reportFileName}><Download size={15} /> {L("Excel 보고서", "Excel report")}</a>}
                  {item.trackedUrl && <a className="result-download tracked-download" href={item.trackedUrl} download={item.trackedFileName}><Download size={15} /> {L("Word 변경 추적", "Tracked Word file")}</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <ToolGuide
        title={L("Word 문서 비교 사용 안내", "Word comparison guide")}
        description={L("여러 문서를 순서대로 짝지어 비교하고, 각 문서 쌍의 결과를 따로 확인할 수 있습니다.", "Pair documents by list order and review each pair separately.")}
        blocks={language === "en" ? [
          { title: "Creating document pairs", paragraphs: ["Add the same number of DOCX files to Before and After. Files are paired by list position; drag to reorder or use the side arrows to move a file."] },
          { title: "First run and connectivity", paragraphs: ["The self-hosted browser runtime must be downloaded on the first run. Documents and results are never sent to a comparison server."] },
          { title: "Comparison scope", paragraphs: ["Body paragraphs are compared by default. Tables, formatting, headers, footers, comments, footnotes and endnotes can be included."] },
          { title: "Web, Excel and tracked Word output", paragraphs: ["Each pair can have an independent web view, an Excel report, and a DOCX with supported tracked insertions, deletions and formatting changes."] },
          { title: "Items to verify", paragraphs: ["Automatic numbering, fields, text in shapes and complex layouts may differ from Microsoft Word. Verify important results in the original documents."] },
        ] : [
          { title: "문서 쌍 만들기", paragraphs: ["수정 전과 수정 후 영역에 같은 개수의 DOCX를 넣으세요. 각 목록의 1번끼리, 2번끼리 순서대로 비교합니다. 드래그로 순서를 바꾸거나 좌우 화살표로 파일을 반대 목록에 옮길 수 있습니다."] },
          { title: "최초 실행과 인터넷 연결", paragraphs: ["오프라인에서 사이트를 처음 열면 브라우저용 문서 비교 실행 환경을 받을 수 없어 비교를 시작할 수 없습니다. 실행 환경은 Worklazy Tools와 같은 GitHub Pages 배포 경로에서 제공되며 외부 CDN을 사용하지 않습니다. DOCX 파일과 비교 결과는 외부 작업 서버로 전송하지 않습니다."] },
          { title: "비교하는 범위", paragraphs: ["본문 문단을 기본으로 비교하며, 선택에 따라 표 셀과 머리말·꼬리말, 메모, 각주·미주의 텍스트도 각각 구분해 분석합니다."] },
          { title: "다중 동시 비교", paragraphs: ["여러 문서 쌍을 한 번에 비교하고, 웹에서는 각 문서 쌍의 독립된 상세 화면을 확인할 수 있습니다. Excel 보고서에서는 일반 변경과 표 변경을 나누고, 각 표를 별도 시트에서 수정 전·후 격자로 비교합니다."] },
          { title: "Word 변경 추적 파일", paragraphs: ["수정 후 문서를 바탕으로 삽입·삭제와 지원되는 서식 변경 기록이 포함된 DOCX를 만듭니다. 기존 작성자 기록은 유지하며, 문서 간 자동 번호 정의도 함께 보완합니다."] },
          { title: "표 구조 변경", paragraphs: ["표 중간에 행이나 열이 추가되면 내용 유사도로 기존 행·열의 대응 관계를 찾습니다. 뒤로 밀린 기존 셀 전체를 변경으로 표시하지 않고 실제 추가·삭제·수정된 셀만 구분합니다."] },
          { title: "표시 차이가 생길 수 있는 항목", paragraphs: ["자동 번호, 계산 필드, 도형 안의 텍스트와 복잡한 레이아웃은 실제 Word 화면과 다를 수 있으므로 중요한 결과는 원본 문서에서도 확인하세요."] },
        ]}
        faq={language === "en" ? [
          { question: "What if the file counts differ?", answer: "A mismatch is shown immediately and comparison remains disabled until both lists contain the same number of files." },
          { question: "How are files paired?", answer: "The first files are paired together, then the second files, following the displayed order." },
          { question: "Can I create a tracked-changes Word file?", answer: "Yes. The result contains supported insertions, deletions and formatting revisions, though complex Word structures can differ from Word's own comparison." },
        ] : [
          { question: "수정 전과 수정 후 파일 수가 다르면 어떻게 되나요?", answer: "파일 수 불일치 오류가 즉시 표시되고 비교 버튼이 비활성화됩니다. 양쪽 파일 수를 같게 맞춘 뒤 진행할 수 있습니다." },
          { question: "파일은 어떤 순서로 짝지어지나요?", answer: "화면에 표시된 순서대로 1번끼리, 2번끼리 짝지어집니다. 드래그나 위·아래 버튼으로 순서를 바꾸고, 좌우 버튼으로 문서를 반대 목록에 옮길 수 있습니다." },
          { question: "Word 변경 내용 추적 파일도 만들 수 있나요?", answer: "Word 변경 추적을 선택하면 삽입·삭제와 지원되는 서식 변경 기록이 포함된 DOCX를 생성합니다. 목록 번호는 문서 정의를 병합해 유지하지만 필드, 도형, 복잡한 병합 표는 Word의 자체 비교 결과와 차이가 날 수 있습니다." },
        ]}
      />
    </div>
  );
}

function WordFileColumn({ files, sideLabel, hint, onFiles, onRemove, onMove, onMoveAcross }: {
  files: File[];
  sideLabel: string;
  hint: string;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onMoveAcross: (index: number) => void;
}) {
  const language = useAppLanguage();
  const [receivingFiles, setReceivingFiles] = useState(false);

  const isExternalFileDrag = (event: ReactDragEvent<HTMLDivElement>) => Array.from(event.dataTransfer.types).includes("Files");

  return (
    <div
      className={`word-file-column${receivingFiles ? " receiving-files" : ""}`}
      onDragEnter={(event) => {
        if (!isExternalFileDrag(event)) return;
        event.preventDefault();
        setReceivingFiles(true);
      }}
      onDragOver={(event) => {
        if (!isExternalFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setReceivingFiles(false);
      }}
      onDrop={(event) => {
        if (!isExternalFileDrag(event)) return;
        event.preventDefault();
        setReceivingFiles(false);
        if ((event.target as Element).closest(".drop-zone")) return;
        const droppedFiles = Array.from(event.dataTransfer.files);
        if (droppedFiles.length) onFiles([...files, ...droppedFiles]);
      }}
    >
      <FileDropZone
        label={language === "en" ? `${sideLabel} · ${files.length} files` : `${sideLabel} · ${files.length}개`}
        accept=".docx"
        hint={hint}
        multiple
        files={files}
        onFiles={onFiles}
        accent="blue"
      />
      <SortableWordFileList files={files} sideLabel={sideLabel} onRemove={onRemove} onMove={onMove} onMoveAcross={onMoveAcross} />
      {receivingFiles && <div className="word-column-drop-hint">{language === "en" ? `Drop to add ${sideLabel.toLowerCase()} documents` : `여기에 놓아 ${sideLabel} 문서 추가`}</div>}
    </div>
  );
}

function SortableWordFileList({ files, sideLabel, onRemove, onMove, onMoveAcross }: {
  files: File[];
  sideLabel: string;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onMoveAcross: (index: number) => void;
}) {
  const language = useAppLanguage();
  const isBefore = sideLabel === "수정 전" || sideLabel === "Before";
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  if (!files.length) return null;

  return (
    <ol className="sortable-word-files" aria-label={language === "en" ? `${sideLabel} document order` : `${sideLabel} 문서 순서`}>
      {files.map((file, index) => (
        <li
          className={`${draggedIndex === index ? "dragging" : ""}${overIndex === index ? " drag-over" : ""}`}
          key={fileKey(file)}
          draggable
          onDragStart={(event) => {
            setDraggedIndex(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
          }}
          onDragEnter={() => setOverIndex(index)}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedIndex !== null && draggedIndex !== index) onMove(draggedIndex, index);
            setDraggedIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => { setDraggedIndex(null); setOverIndex(null); }}
        >
          <span className="drag-handle" title={language === "en" ? "Drag to reorder" : "드래그해서 순서 변경"}><GripVertical size={16} /></span>
          <b>{index + 1}</b>
          <span className="sortable-file-copy"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
          <span className="sortable-file-actions">
            <button
              className="move-across-button"
              type="button"
              onClick={() => onMoveAcross(index)}
              aria-label={language === "en" ? `Move ${file.name} to the ${isBefore ? "After" : "Before"} list` : `${file.name} ${isBefore ? "수정 후" : "수정 전"} 목록으로 이동`}
              title={language === "en" ? `Move to ${isBefore ? "After" : "Before"}` : `${isBefore ? "수정 후" : "수정 전"}로 이동`}
            >{isBefore ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}</button>
            <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={language === "en" ? `Move ${file.name} up` : `${file.name} 위로 이동`}><ArrowUp size={14} /></button>
            <button type="button" disabled={index === files.length - 1} onClick={() => onMove(index, index + 1)} aria-label={language === "en" ? `Move ${file.name} down` : `${file.name} 아래로 이동`}><ArrowDown size={14} /></button>
            <button type="button" onClick={() => onRemove(index)} aria-label={language === "en" ? `Remove ${file.name}` : `${file.name} 제거`}><X size={15} /></button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function PairingPreview({ beforeFiles, afterFiles, language }: { beforeFiles: File[]; afterFiles: File[]; language: "ko" | "en" }) {
  return (
    <div className="pairing-preview">
      <div className="pairing-preview-title"><strong>{language === "en" ? `${beforeFiles.length} comparison pairs` : `${beforeFiles.length}개 비교 쌍`}</strong><small>{language === "en" ? "Paired in list order." : "목록 순서대로 연결됩니다."}</small></div>
      <ol>
        {beforeFiles.map((file, index) => <li key={fileKey(file)}><b>{index + 1}</b><span>{file.name}</span><i>↔</i><span>{afterFiles[index].name}</span></li>)}
      </ol>
    </div>
  );
}

function reorder<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function deduplicateFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = fileKey(file);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function createReportFileName(pairNumber: number, beforeName: string, afterName: string, language: "ko" | "en") {
  const base = `${pairNumber}_${stripExtension(beforeName)}_vs_${stripExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_");
  return `${base.slice(0, 120)}_${language === "en" ? "comparison-report" : "비교보고서"}.xlsx`;
}

function createTrackedFileName(pairNumber: number, beforeName: string, afterName: string, language: "ko" | "en") {
  const base = `${pairNumber}_${stripExtension(beforeName)}_vs_${stripExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_");
  return `${base.slice(0, 120)}_${language === "en" ? "tracked-changes" : "변경추적"}.docx`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}
