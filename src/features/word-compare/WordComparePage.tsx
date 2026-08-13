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

export function WordComparePage() {
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
    ? `수정 전 ${beforeFiles.length}개와 수정 후 ${afterFiles.length}개의 파일 수가 일치하지 않습니다. 같은 개수로 맞춰 주세요.`
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
    setError(rejected.length ? `DOCX가 아닌 파일을 제외했습니다: ${rejected.map((file) => file.name).join(", ")}` : null);
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
    operation.start(`${beforeFiles.length}개 문서 쌍의 비교를 준비하고 있습니다.`);

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
      );
      const comparisonResults = workerResults.map((item) => item.result);

      let reportBuffers: ArrayBuffer[] = [];
      if (excelOutput) {
        operation.update(80, `${comparisonResults.length}개 Excel 보고서를 준비합니다.`);
        reportBuffers = await createWordExcelReports(comparisonResults, (nextProgress, message) => {
          operation.update(80 + Math.round(nextProgress * 0.2), message);
        });
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
          reportFileName: reportBuffer ? createReportFileName(index + 1, result.beforeName, result.afterName) : undefined,
          trackedUrl: trackedBuffer ? URL.createObjectURL(new Blob([trackedBuffer], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          })) : undefined,
          trackedFileName: trackedBuffer ? createTrackedFileName(index + 1, result.beforeName, result.afterName) : undefined,
        };
      }));
      operation.succeed(`${comparisonResults.length}개 문서 쌍의 결과를 모두 만들었습니다.`);
    } catch (comparisonError) {
      const message = comparisonError instanceof Error ? comparisonError.message : "Word 문서를 비교하지 못했습니다.";
      setError(message);
      operation.fail(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page tool-page page-enter accent-context-blue">
      <PageHeader eyebrow="DOCUMENT TOOL" title="Word Compare" description="여러 DOCX 문서 쌍의 변경 내용을 다중 동시 비교로 한 번에 확인하세요.">
        <div className="header-status ready"><span className="status-dot" /> 파일 업로드 없이 비교</div>
      </PageHeader>
      <PrivacyBanner compact />

      <SectionCard step={1} title="비교할 문서" description="드래그로 순서를 맞추거나 화살표로 문서를 반대쪽 목록에 옮기세요.">
        <div className="compare-file-grid">
          <div>
            <WordFileColumn
              files={beforeFiles}
              sideLabel="수정 전"
              hint="원본 DOCX · 여러 파일 선택 가능"
              onFiles={(files) => updateDocxFiles(files, setBeforeFiles)}
              onRemove={(index) => removeFile("before", index)}
              onMove={(from, to) => moveFile("before", from, to)}
              onMoveAcross={(index) => moveFileAcross("before", index)}
            />
          </div>
          <div>
            <WordFileColumn
              files={afterFiles}
              sideLabel="수정 후"
              hint="변경된 DOCX · 여러 파일 선택 가능"
              onFiles={(files) => updateDocxFiles(files, setAfterFiles)}
              onRemove={(index) => removeFile("after", index)}
              onMove={(from, to) => moveFile("after", from, to)}
              onMoveAcross={(index) => moveFileAcross("after", index)}
            />
          </div>
        </div>

        {pairingError && <div className="pair-count-error" role="alert"><AlertCircle size={17} /><span><strong>파일 수가 맞지 않습니다.</strong><small>{pairingError}</small></span></div>}
        {!pairingError && beforeFiles.length > 0 && <PairingPreview beforeFiles={beforeFiles} afterFiles={afterFiles} />}
      </SectionCard>

      <div className="word-options-grid">
        <SectionCard step={2} title="결과 형식">
          <div className="settings-list compact-settings output-selection-list">
            <ToggleRow label="웹 비교" description="좌우 문서 화면에서 변경 내용을 확인합니다." checked={webOutput} onChange={(checked) => { setWebOutput(checked); resetOutput(); }} />
            <ToggleRow label="Excel 보고서" description="일반 변경과 표 변경 시트를 만듭니다." checked={excelOutput} onChange={(checked) => { setExcelOutput(checked); resetOutput(); }} />
            <ToggleRow label="Word 변경 추적" description="Word에서 변경을 수락·거부할 수 있는 DOCX를 만듭니다." checked={trackedOutput} onChange={(checked) => { setTrackedOutput(checked); resetOutput(); }} />
          </div>
          {trackedOutput && (
            <label className="revision-author-field">
              <span>변경 내용 작성자</span>
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
            <span><strong>{hasOutput ? [webOutput && "웹", excelOutput && "Excel", trackedOutput && "Word 추적"].filter(Boolean).join(" · ") : "결과 형식을 하나 이상 선택하세요."}</strong><small>{trackedOutput ? "Word 검토 탭에서 삽입·삭제 내용을 수락하거나 거부할 수 있습니다." : "문서 쌍마다 선택한 결과를 각각 제공합니다."}</small></span>
          </div>
        </SectionCard>

        <SectionCard step={3} title="비교 범위">
          <div className="settings-list compact-settings">
            <ToggleRow label="서식 변경 포함" checked={formatting} onChange={(checked) => { setFormatting(checked); resetOutput(); }} />
            <ToggleRow label="표 비교" checked={tables} onChange={(checked) => { setTables(checked); resetOutput(); }} />
            <ToggleRow label="기타 문서 영역" description="머리말·꼬리말, 메모, 각주·미주" checked={metadata} onChange={(checked) => { setMetadata(checked); resetOutput(); }} />
          </div>
        </SectionCard>
      </div>

      <div className="comparison-prepare-note"><Info size={16} /><span><strong>처음 비교할 때 준비 시간이 조금 필요합니다.</strong><small>한 번 준비한 뒤 선택한 모든 문서 쌍을 순서대로 비교합니다.</small></span></div>

      <div className="tool-action-bar">
        <div><TextSearch size={20} /><span><strong>{ready ? `${beforeFiles.length}개 문서 쌍을 비교할 준비가 됐어요.` : pairingError ? "양쪽 파일 개수를 맞춰 주세요." : !hasOutput ? "결과 형식을 하나 이상 선택해 주세요." : "수정 전·후 문서를 선택해 주세요."}</strong><small>비교 중에도 화면을 계속 사용할 수 있습니다.</small></span></div>
        <PrimaryButton accent="blue" disabled={!ready || Boolean(pairingError)} loading={loading} onClick={() => void runComparison()}>{loading ? `${operation.progress}% 비교 중` : beforeFiles.length ? `${beforeFiles.length}개 문서 쌍 비교` : "문서 쌍 비교"}</PrimaryButton>
      </div>

      <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="blue" title="Word 비교 진행 상황" />

      {error && !pairingError && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>비교하지 못했습니다.</strong><span>{error}</span></div></div>}

      {results.length > 0 && (
        <section className="word-batch-results" aria-live="polite">
          <div className="content-heading">
            <div><p className="eyebrow success">작업 완료</p><h2>{results.length}개 문서 쌍의 결과</h2><p>각 문서 쌍에서 선택한 웹·Excel·Word 변경 추적 결과를 개별적으로 열 수 있습니다.</p></div>
          </div>
          <div className="word-pair-result-list">
            {results.map((item) => (
              <article className="word-pair-result-card" key={item.pairNumber}>
                <span className="pair-number">{item.pairNumber}</span>
                <div className="pair-result-copy">
                  <strong>{item.result.beforeName}</strong>
                  <span>→</span>
                  <strong>{item.result.afterName}</strong>
                  <small>{item.result.changes.length ? `${item.result.changes.length}개 변경 발견` : "변경 없음"}</small>
                </div>
                <div className="pair-result-actions">
                  {webOutput && <Link className="secondary-button" to={`/tools/word-compare/results/${item.pairNumber}`}><TextSearch size={15} /> 웹 비교 보기</Link>}
                  {item.reportUrl && <a className="result-download blue-download" href={item.reportUrl} download={item.reportFileName}><Download size={15} /> Excel 보고서</a>}
                  {item.trackedUrl && <a className="result-download tracked-download" href={item.trackedUrl} download={item.trackedFileName}><Download size={15} /> Word 변경 추적</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <ToolGuide
        title="Word 문서 비교 사용 안내"
        description="여러 문서를 순서대로 짝지어 비교하고, 각 문서 쌍의 결과를 따로 확인할 수 있습니다."
        blocks={[
          { title: "문서 쌍 만들기", paragraphs: ["수정 전과 수정 후 영역에 같은 개수의 DOCX를 넣으세요. 각 목록의 1번끼리, 2번끼리 순서대로 비교합니다. 드래그로 순서를 바꾸거나 좌우 화살표로 파일을 반대 목록에 옮길 수 있습니다."] },
          { title: "비교하는 범위", paragraphs: ["본문 문단을 기본으로 비교하며, 선택에 따라 표 셀과 머리말·꼬리말, 메모, 각주·미주의 텍스트도 각각 구분해 분석합니다."] },
          { title: "다중 동시 비교", paragraphs: ["여러 문서 쌍을 한 번에 비교하고, 웹에서는 각 문서 쌍의 독립된 상세 화면을 확인할 수 있습니다. Excel 보고서에서는 일반 변경과 표 변경을 나누고, 각 표를 별도 시트에서 수정 전·후 격자로 비교합니다."] },
          { title: "Word 변경 추적 파일", paragraphs: ["수정 후 문서를 바탕으로 삽입·삭제와 지원되는 서식 변경 revision이 포함된 DOCX를 만듭니다. 기존 작성자 기록은 유지하며, 문서 간 자동 번호 정의도 함께 보완합니다."] },
          { title: "표 구조 변경", paragraphs: ["표 중간에 행이나 열이 추가되면 내용 유사도로 기존 행·열의 대응 관계를 찾습니다. 뒤로 밀린 기존 셀 전체를 변경으로 표시하지 않고 실제 추가·삭제·수정된 셀만 구분합니다."] },
          { title: "표시 차이가 생길 수 있는 항목", paragraphs: ["자동 번호, 계산 필드, 도형 안의 텍스트와 복잡한 레이아웃은 실제 Word 화면과 다를 수 있으므로 중요한 결과는 원본 문서에서도 확인하세요."] },
        ]}
        faq={[
          { question: "수정 전과 수정 후 파일 수가 다르면 어떻게 되나요?", answer: "파일 수 불일치 오류가 즉시 표시되고 비교 버튼이 비활성화됩니다. 양쪽 파일 수를 같게 맞춘 뒤 진행할 수 있습니다." },
          { question: "파일은 어떤 순서로 짝지어지나요?", answer: "화면에 표시된 순서대로 1번끼리, 2번끼리 짝지어집니다. 드래그나 위·아래 버튼으로 순서를 바꾸고, 좌우 버튼으로 문서를 반대 목록에 옮길 수 있습니다." },
          { question: "Word 변경 내용 추적 파일도 만들 수 있나요?", answer: "Word 변경 추적을 선택하면 삽입·삭제와 지원되는 서식 변경 revision이 포함된 DOCX를 생성합니다. 목록 번호는 문서 정의를 병합해 유지하지만 필드, 도형, 복잡한 병합 표는 Word의 자체 비교 결과와 차이가 날 수 있습니다." },
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
        label={`${sideLabel} · ${files.length}개`}
        accept=".docx"
        hint={hint}
        multiple
        files={files}
        onFiles={onFiles}
        accent="blue"
      />
      <SortableWordFileList files={files} sideLabel={sideLabel} onRemove={onRemove} onMove={onMove} onMoveAcross={onMoveAcross} />
      {receivingFiles && <div className="word-column-drop-hint">여기에 놓아 {sideLabel} 문서 추가</div>}
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  if (!files.length) return null;

  return (
    <ol className="sortable-word-files" aria-label={`${sideLabel} 문서 순서`}>
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
          <span className="drag-handle" title="드래그해서 순서 변경"><GripVertical size={16} /></span>
          <b>{index + 1}</b>
          <span className="sortable-file-copy"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
          <span className="sortable-file-actions">
            <button
              className="move-across-button"
              type="button"
              onClick={() => onMoveAcross(index)}
              aria-label={`${file.name} ${sideLabel === "수정 전" ? "수정 후" : "수정 전"} 목록으로 이동`}
              title={`${sideLabel === "수정 전" ? "수정 후" : "수정 전"}로 이동`}
            >{sideLabel === "수정 전" ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}</button>
            <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`${file.name} 위로 이동`}><ArrowUp size={14} /></button>
            <button type="button" disabled={index === files.length - 1} onClick={() => onMove(index, index + 1)} aria-label={`${file.name} 아래로 이동`}><ArrowDown size={14} /></button>
            <button type="button" onClick={() => onRemove(index)} aria-label={`${file.name} 제거`}><X size={15} /></button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function PairingPreview({ beforeFiles, afterFiles }: { beforeFiles: File[]; afterFiles: File[] }) {
  return (
    <div className="pairing-preview">
      <div className="pairing-preview-title"><strong>{beforeFiles.length}개 비교 쌍</strong><small>목록 순서대로 연결됩니다.</small></div>
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

function createReportFileName(pairNumber: number, beforeName: string, afterName: string) {
  const base = `${pairNumber}_${stripExtension(beforeName)}_vs_${stripExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_");
  return `${base.slice(0, 120)}_compare.xlsx`;
}

function createTrackedFileName(pairNumber: number, beforeName: string, afterName: string) {
  const base = `${pairNumber}_${stripExtension(beforeName)}_vs_${stripExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_");
  return `${base.slice(0, 120)}_tracked.docx`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}
