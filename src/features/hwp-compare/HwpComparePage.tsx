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
  LockKeyhole,
  TextSearch,
  X,
} from "lucide-react";
import { type DragEvent as ReactDragEvent, useState } from "react";
import { Link } from "react-router-dom";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, formatBytes, PageHeader, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { createWordExcelReports } from "../excel-merger/excelWorkerClient";
import { fileKey, useHwpCompareSession } from "./hwpCompareSession";
import { compareHwpFilePairs } from "./hwpWorkerClient";

export function HwpComparePage() {
  const session = useHwpCompareSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useOperationProgress();
  const hasFiles = session.beforeFiles.length > 0 || session.afterFiles.length > 0;
  const countMismatch = hasFiles && session.beforeFiles.length !== session.afterFiles.length;
  const hasOutput = session.webOutput || session.excelOutput;
  const ready = session.beforeFiles.length > 0 && !countMismatch && hasOutput && !loading;
  const pairingError = countMismatch
    ? `수정 전 ${session.beforeFiles.length}개와 수정 후 ${session.afterFiles.length}개의 파일 수가 일치하지 않습니다. 같은 개수로 맞춰 주세요.`
    : null;

  const resetOutput = () => {
    session.clearResults();
    setError(null);
    operation.reset();
  };

  const updateFiles = (files: File[], side: "before" | "after") => {
    const rejected = files.filter((file) => !isHwpFile(file));
    const accepted = deduplicateFiles(files.filter(isHwpFile));
    (side === "before" ? session.setBeforeFiles : session.setAfterFiles)(accepted);
    resetOutput();
    if (rejected.length) setError(`HWP·HWPX가 아닌 파일을 제외했습니다: ${rejected.map((file) => file.name).join(", ")}`);
  };

  const removeFile = (side: "before" | "after", index: number) => {
    const setter = side === "before" ? session.setBeforeFiles : session.setAfterFiles;
    setter((current) => current.filter((_, itemIndex) => itemIndex !== index));
    resetOutput();
  };

  const moveFile = (side: "before" | "after", from: number, to: number) => {
    const setter = side === "before" ? session.setBeforeFiles : session.setAfterFiles;
    setter((current) => reorder(current, from, to));
    resetOutput();
  };

  const moveAcross = (side: "before" | "after", index: number) => {
    const source = side === "before" ? session.beforeFiles : session.afterFiles;
    const target = side === "before" ? session.afterFiles : session.beforeFiles;
    const setSource = side === "before" ? session.setBeforeFiles : session.setAfterFiles;
    const setTarget = side === "before" ? session.setAfterFiles : session.setBeforeFiles;
    const file = source[index];
    if (!file) return;
    setSource(source.filter((_, itemIndex) => itemIndex !== index));
    const targetIndex = Math.min(index, target.length);
    setTarget([...target.slice(0, targetIndex), file, ...target.slice(targetIndex)]);
    resetOutput();
  };

  const runComparison = async () => {
    if (pairingError) { setError(pairingError); return; }
    if (!ready) return;
    session.clearResults();
    setError(null);
    setLoading(true);
    operation.start(`${session.beforeFiles.length}개 HWP 문서 쌍의 비교를 준비하고 있습니다.`);
    try {
      const workerResults = await compareHwpFilePairs(
        session.beforeFiles.map((beforeFile, index) => ({
          beforeFile,
          afterFile: session.afterFiles[index],
          beforePassword: session.passwords[fileKey(beforeFile)] || undefined,
          afterPassword: session.passwords[fileKey(session.afterFiles[index])] || undefined,
        })),
        { formatting: session.formatting, tables: session.tables, metadata: session.metadata },
        (nextProgress, message) => operation.update(session.excelOutput ? Math.round(nextProgress * 0.8) : nextProgress, message),
      );
      const comparisonResults = workerResults.map((item) => item.result);
      let reports: ArrayBuffer[] = [];
      if (session.excelOutput) {
        operation.update(80, `${comparisonResults.length}개 Excel 보고서를 준비합니다.`);
        reports = await createWordExcelReports(comparisonResults, (nextProgress, message) => operation.update(80 + Math.round(nextProgress * 0.2), message));
      }
      session.replaceResults(comparisonResults.map((result, index) => {
        const report = reports[index];
        return {
          pairNumber: index + 1,
          result,
          reportUrl: report ? URL.createObjectURL(new Blob([report], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })) : undefined,
          reportFileName: report ? createReportFileName(index + 1, result.beforeName, result.afterName) : undefined,
        };
      }));
      operation.succeed(`${comparisonResults.length}개 HWP 문서 쌍의 결과를 모두 만들었습니다.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "HWP 문서를 비교하지 못했습니다.";
      setError(message);
      operation.fail(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page tool-page page-enter accent-context-orange hwp-compare-page">
      <PageHeader eyebrow="HWP DOCUMENT TOOL" title="HWP 비교" description="여러 HWP·HWPX 문서 쌍의 본문과 표 변경을 한 번에 비교하세요.">
        <div className="header-status ready"><span className="status-dot" /> 서버 전송 없이 비교</div>
      </PageHeader>
      <PrivacyBanner compact />

      <SectionCard step={1} title="비교할 문서" description="목록의 같은 번호끼리 비교합니다. 드래그로 순서를 맞추거나 좌우 화살표로 문서를 옮기세요.">
        <div className="compare-file-grid">
          <HwpFileColumn
            files={session.beforeFiles}
            side="before"
            sideLabel="수정 전"
            passwords={session.passwords}
            onPassword={(file, password) => { session.setPassword(file, password); resetOutput(); }}
            onFiles={(files) => updateFiles(files, "before")}
            onRemove={(index) => removeFile("before", index)}
            onMove={(from, to) => moveFile("before", from, to)}
            onMoveAcross={(index) => moveAcross("before", index)}
          />
          <HwpFileColumn
            files={session.afterFiles}
            side="after"
            sideLabel="수정 후"
            passwords={session.passwords}
            onPassword={(file, password) => { session.setPassword(file, password); resetOutput(); }}
            onFiles={(files) => updateFiles(files, "after")}
            onRemove={(index) => removeFile("after", index)}
            onMove={(from, to) => moveFile("after", from, to)}
            onMoveAcross={(index) => moveAcross("after", index)}
          />
        </div>
        {pairingError && <div className="pair-count-error" role="alert"><AlertCircle size={17} /><span><strong>파일 수가 맞지 않습니다.</strong><small>{pairingError}</small></span></div>}
        {!pairingError && session.beforeFiles.length > 0 && <PairingPreview beforeFiles={session.beforeFiles} afterFiles={session.afterFiles} />}
      </SectionCard>

      <div className="word-options-grid">
        <SectionCard step={2} title="결과 형식">
          <div className="settings-list compact-settings output-selection-list">
            <ToggleRow label="웹 비교" description="좌우 문서 화면에서 변경 내용을 확인합니다." checked={session.webOutput} onChange={(checked) => { session.setWebOutput(checked); resetOutput(); }} />
            <ToggleRow label="Excel 보고서" description="일반 변경과 표별 비교 시트를 만듭니다." checked={session.excelOutput} onChange={(checked) => { session.setExcelOutput(checked); resetOutput(); }} />
          </div>
          <div className="output-preview"><FileText size={20} /><span><strong>{hasOutput ? [session.webOutput && "웹", session.excelOutput && "Excel"].filter(Boolean).join(" · ") : "결과 형식을 하나 이상 선택하세요."}</strong><small>각 문서 쌍마다 결과를 따로 제공합니다.</small></span></div>
        </SectionCard>
        <SectionCard step={3} title="비교 범위">
          <div className="settings-list compact-settings">
            <ToggleRow label="서식 변경 포함" checked={session.formatting} onChange={(checked) => { session.setFormatting(checked); resetOutput(); }} />
            <ToggleRow label="표 비교" description="행·열 삽입을 고려해 대응되는 셀을 찾습니다." checked={session.tables} onChange={(checked) => { session.setTables(checked); resetOutput(); }} />
            <ToggleRow label="기타 문서 영역" description="머리말·꼬리말, 각주·미주" checked={session.metadata} onChange={(checked) => { session.setMetadata(checked); resetOutput(); }} />
          </div>
        </SectionCard>
      </div>

      <div className="comparison-prepare-note"><Info size={16} /><span><strong>첫 실행에는 HWP 분석 모듈을 준비합니다.</strong><small>준비가 끝나면 선택한 문서 쌍을 Worker에서 순서대로 비교합니다.</small></span></div>
      <div className="tool-action-bar">
        <div><TextSearch size={20} /><span><strong>{ready ? `${session.beforeFiles.length}개 문서 쌍을 비교할 준비가 됐어요.` : pairingError ? "양쪽 파일 개수를 맞춰 주세요." : !hasOutput ? "결과 형식을 하나 이상 선택해 주세요." : "수정 전·후 문서를 선택해 주세요."}</strong><small>파일과 입력한 암호는 현재 브라우저 메모리에서만 사용됩니다.</small></span></div>
        <PrimaryButton accent="orange" disabled={!ready || Boolean(pairingError)} loading={loading} onClick={() => void runComparison()}>{loading ? `${operation.progress}% 비교 중` : session.beforeFiles.length ? `${session.beforeFiles.length}개 문서 쌍 비교` : "문서 쌍 비교"}</PrimaryButton>
      </div>
      <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="orange" title="HWP 비교 진행 상황" />
      {error && !pairingError && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>비교하지 못했습니다.</strong><span>{error}</span></div></div>}

      {session.results.length > 0 && (
        <section className="word-batch-results" aria-live="polite">
          <div className="content-heading"><div><p className="eyebrow success">작업 완료</p><h2>{session.results.length}개 HWP 문서 쌍의 결과</h2><p>웹 비교와 Excel 보고서를 문서 쌍별로 열 수 있습니다.</p></div></div>
          <div className="word-pair-result-list">
            {session.results.map((item) => (
              <article className="word-pair-result-card" key={item.pairNumber}>
                <span className="pair-number">{item.pairNumber}</span>
                <div className="pair-result-copy"><strong>{item.result.beforeName}</strong><span>→</span><strong>{item.result.afterName}</strong><small>{item.result.changes.length ? `${item.result.changes.length}개 변경 발견` : "변경 없음"}</small></div>
                <div className="pair-result-actions">
                  {session.webOutput && <Link className="secondary-button" to={`/tools/hwp-compare/results/${item.pairNumber}`}><TextSearch size={15} /> 웹 비교 보기</Link>}
                  {item.reportUrl && <a className="result-download hwp-download" href={item.reportUrl} download={item.reportFileName}><Download size={15} /> Excel 보고서</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <ToolGuide
        title="HWP·HWPX 문서 비교 안내"
        description="문서 구조를 브라우저 안에서 분석해 여러 문서 쌍의 결과를 따로 제공합니다."
        blocks={[
          { title: "다중 동시 비교", paragraphs: ["수정 전과 수정 후에 같은 개수의 HWP 또는 HWPX를 넣으세요. 같은 순번의 파일끼리 비교하며 목록 안에서 순서를 바꾸거나 반대편으로 옮길 수 있습니다."] },
          { title: "본문과 개요 번호", paragraphs: ["본문 문단의 텍스트와 문단·글자 서식을 비교하며 문서에 정의된 개요 번호는 본문 앞에 함께 표시합니다. 일반 글자로 직접 입력한 번호도 본문의 일부로 비교됩니다."] },
          { title: "표 구조 변경", paragraphs: ["각 표는 수정 전·후 격자로 표시하고 Excel에서는 표마다 시트를 만듭니다. 중간에 행이나 열이 추가되어도 내용 유사도로 대응 관계를 찾아 뒤쪽 셀 전체가 변경으로 잡히는 현상을 줄입니다."] },
          { title: "현재 지원 경계", paragraphs: ["머리말·꼬리말과 각주·미주 텍스트를 비교합니다. HWP 검토 메모와 변경 추적 기록, 도형 안 텍스트와 일부 중첩 표는 현재 브라우저 분석 범위에 포함되지 않아 결과에서 제외되거나 단순화될 수 있습니다."] },
          { title: "변경 추적 HWP", paragraphs: ["웹 비교와 Excel 보고서를 지원합니다. Word의 DOCX처럼 수락·거부할 수 있는 HWP 변경 추적 파일 생성은 현재 제공하지 않습니다."] },
        ]}
        faq={[
          { question: "HWP와 HWPX를 서로 비교할 수 있나요?", answer: "가능합니다. 같은 쌍 안에서 HWP와 HWPX를 섞어도 추출된 문서 구조를 기준으로 비교합니다." },
          { question: "암호 문서는 어떻게 여나요?", answer: "각 파일 아래 암호 입력란에 열기 암호를 입력하세요. 지원되는 HWP/HWPX 암호 방식은 브라우저에서 해제하며 암호를 서버로 전송하지 않습니다. DRM 문서는 지원하지 않습니다." },
          { question: "한컴오피스의 자체 비교와 완전히 같나요?", answer: "아닙니다. 본문·개요·표·머리말·꼬리말·각주·미주를 구조적으로 비교하지만, 검토 정보와 복잡한 개체는 한컴오피스 결과와 차이가 날 수 있습니다." },
        ]}
      />
      <RhwpVersionNotice mode="compare" />
    </div>
  );
}

function HwpFileColumn({ files, side, sideLabel, passwords, onPassword, onFiles, onRemove, onMove, onMoveAcross }: {
  files: File[];
  side: "before" | "after";
  sideLabel: string;
  passwords: Record<string, string>;
  onPassword: (file: File, password: string) => void;
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
      onDragEnter={(event) => { if (isExternalFileDrag(event)) { event.preventDefault(); setReceivingFiles(true); } }}
      onDragOver={(event) => { if (isExternalFileDrag(event)) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(event) => { const next = event.relatedTarget; if (!(next instanceof Node && event.currentTarget.contains(next))) setReceivingFiles(false); }}
      onDrop={(event) => {
        if (!isExternalFileDrag(event)) return;
        event.preventDefault();
        setReceivingFiles(false);
        if ((event.target as Element).closest(".drop-zone")) return;
        const dropped = Array.from(event.dataTransfer.files);
        if (dropped.length) onFiles([...files, ...dropped]);
      }}
    >
      <FileDropZone label={`${sideLabel} · ${files.length}개`} accept=".hwp,.hwpx" hint={`원본 ${sideLabel === "수정 전" ? "HWP·HWPX" : "또는 변경된 HWP·HWPX"} · 여러 파일 선택 가능`} multiple files={files} onFiles={onFiles} accent="orange" />
      {!!files.length && (
        <ol className="sortable-word-files hwp-sortable-files" aria-label={`${sideLabel} 문서 순서`}>
          {files.map((file, index) => <HwpFileRow key={fileKey(file)} file={file} index={index} count={files.length} side={side} sideLabel={sideLabel} password={passwords[fileKey(file)] ?? ""} onPassword={onPassword} onRemove={onRemove} onMove={onMove} onMoveAcross={onMoveAcross} />)}
        </ol>
      )}
      {receivingFiles && <div className="word-column-drop-hint">여기에 놓아 {sideLabel} 문서 추가</div>}
    </div>
  );
}

function HwpFileRow({ file, index, count, side, sideLabel, password, onPassword, onRemove, onMove, onMoveAcross }: {
  file: File;
  index: number;
  count: number;
  side: "before" | "after";
  sideLabel: string;
  password: string;
  onPassword: (file: File, password: string) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onMoveAcross: (index: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <li
      className={dragging ? "dragging" : ""}
      draggable
      onDragStart={(event) => { setDragging(true); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-hwp-index", String(index)); }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-hwp-index")) event.preventDefault(); }}
      onDrop={(event) => { if (!event.dataTransfer.types.includes("application/x-hwp-index")) return; event.preventDefault(); const from = Number(event.dataTransfer.getData("application/x-hwp-index")); if (Number.isInteger(from)) onMove(from, index); setDragging(false); }}
      onDragEnd={() => setDragging(false)}
    >
      <span className="drag-handle" title="드래그해서 순서 변경"><GripVertical size={16} /></span>
      <b>{index + 1}</b>
      <span className="sortable-file-copy"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
      <span className="sortable-file-actions">
        <button className="move-across-button" type="button" onClick={() => onMoveAcross(index)} aria-label={`${file.name} 반대 목록으로 이동`}>{side === "before" ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}</button>
        <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`${file.name} 위로 이동`}><ArrowUp size={14} /></button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`${file.name} 아래로 이동`}><ArrowDown size={14} /></button>
        <button type="button" onClick={() => onRemove(index)} aria-label={`${file.name} 제거`}><X size={15} /></button>
      </span>
      <label className="hwp-file-password"><LockKeyhole size={13} /><input type="password" value={password} autoComplete="off" aria-label={`${file.name} 열기 암호`} placeholder="암호 문서만 입력" onChange={(event) => onPassword(file, event.target.value)} /></label>
    </li>
  );
}

function PairingPreview({ beforeFiles, afterFiles }: { beforeFiles: File[]; afterFiles: File[] }) {
  return <div className="pairing-preview"><div className="pairing-preview-title"><strong>{beforeFiles.length}개 비교 쌍</strong><small>목록 순서대로 연결됩니다.</small></div><ol>{beforeFiles.map((file, index) => <li key={fileKey(file)}><b>{index + 1}</b><span>{file.name}</span><i>↔</i><span>{afterFiles[index].name}</span></li>)}</ol></div>;
}

function isHwpFile(file: File) {
  return /\.(hwp|hwpx)$/i.test(file.name);
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
  return files.filter((file) => { const key = fileKey(file); if (seen.has(key)) return false; seen.add(key); return true; });
}

function createReportFileName(pairNumber: number, beforeName: string, afterName: string) {
  const base = `${pairNumber}_${stripExtension(beforeName)}_vs_${stripExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_");
  return `${base.slice(0, 120)}_hwp_compare.xlsx`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}
