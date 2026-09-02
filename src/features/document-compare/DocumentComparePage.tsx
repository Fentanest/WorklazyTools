import { AlertCircle, Download, FileText, Info, LockKeyhole, TextSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { FileShareButton } from "../../components/FileShareButton";
import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { ToolGuide } from "../../components/ToolGuide";
import { PageHeader, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";
import { createComparisonExcelReports, createComparisonReportArtifact } from "./comparisonResults";
import { compareDocumentFilePairs } from "./documentCompareClient";
import { fileKey, useDocumentCompareSession } from "./documentCompareSession";
import { DocumentFileColumn } from "./DocumentFileColumn";
import { DocumentPairingPreview } from "./DocumentPairingPreview";
import { stripDocumentExtension } from "./filePairs";
import { useDocumentPairFiles } from "./useDocumentPairFiles";

export function DocumentComparePage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const resultBasePath = useLocalizedPath("/tools/document-compare/results");
  const session = useDocumentCompareSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useOperationProgress();
  const comparisonControllerRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => comparisonControllerRef.current?.abort(), []);

  const hasFiles = session.beforeFiles.length > 0 || session.afterFiles.length > 0;
  const countMismatch = hasFiles && session.beforeFiles.length !== session.afterFiles.length;
  const hasOutput = session.webOutput || session.excelOutput || session.trackedOutput;
  const ready = session.beforeFiles.length > 0 && !countMismatch && hasOutput && !loading;
  const pairingError = countMismatch
    ? L(`수정 전 ${session.beforeFiles.length}개와 수정 후 ${session.afterFiles.length}개의 파일 수가 다릅니다.`, `${session.beforeFiles.length} before files and ${session.afterFiles.length} after files do not match.`)
    : null;
  const resetOutput = () => {
    session.clearResults();
    setError(null);
    operation.reset();
  };
  const pairFiles = useDocumentPairFiles({
    beforeFiles: session.beforeFiles,
    afterFiles: session.afterFiles,
    setBeforeFiles: session.setBeforeFiles,
    setAfterFiles: session.setAfterFiles,
    accepts: isSupportedDocumentName,
    onReset: resetOutput,
  });

  const updateFiles = (files: File[], side: "before" | "after") => {
    const rejected = pairFiles.updateFiles(files, side);
    setError(rejected.length
      ? L(`DOCX·DOC·HWP·HWPX가 아닌 파일을 제외했습니다: ${rejected.map((file) => file.name).join(", ")}`, `Files other than DOCX, DOC, HWP, and HWPX were excluded: ${rejected.map((file) => file.name).join(", ")}`)
      : null);
  };

  const runComparison = async () => {
    if (pairingError) { setError(pairingError); return; }
    if (!ready) return;
    session.clearResults();
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    comparisonControllerRef.current = controller;
    operation.start(L(`${session.beforeFiles.length}개 문서 쌍의 실제 형식을 확인하고 있습니다.`, `Checking the actual formats of ${session.beforeFiles.length} document pairs.`));
    try {
      const pairs = session.beforeFiles.map((beforeFile, index) => ({
        beforeFile,
        afterFile: session.afterFiles[index],
        beforePassword: session.passwords[fileKey(beforeFile)] || undefined,
        afterPassword: session.passwords[fileKey(session.afterFiles[index])] || undefined,
      }));
      const workerResults = await compareDocumentFilePairs(pairs, {
        formatting: session.formatting,
        tables: session.tables,
        metadata: session.metadata,
        trackedDocument: session.trackedOutput,
        rewriteRevisionAuthor: session.trackedOutput && session.rewriteRevisionAuthor,
        revisionAuthor: session.revisionAuthor.trim() || "Worklazy Tools",
      }, (nextProgress, message) => {
        operation.update(session.excelOutput ? Math.round(nextProgress * 0.8) : nextProgress, message);
      }, language, controller.signal);
      const results = workerResults.map((item) => item.result);
      let reports: ArrayBuffer[] = [];
      if (session.excelOutput) {
        operation.update(80, L(`${results.length}개 Excel 보고서를 준비합니다.`, `Preparing ${results.length} Excel reports.`));
        reports = await createComparisonExcelReports(results, (nextProgress, message) => {
          operation.update(80 + Math.round(nextProgress * 0.2), message);
        }, language, controller.signal);
      }
      session.replaceResults(results.map((result, index) => {
        const trackedBuffer = workerResults[index]?.trackedBuffer;
        return {
          pairNumber: index + 1,
          result,
          ...createComparisonReportArtifact(reports[index], index + 1, result.beforeName, result.afterName, language),
          trackedUrl: trackedBuffer ? URL.createObjectURL(new Blob([trackedBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })) : undefined,
          trackedFileName: trackedBuffer ? trackedFileName(index + 1, result.beforeName, result.afterName, language) : undefined,
        };
      }));
      operation.succeed(L(`${results.length}개 문서 쌍의 결과를 모두 만들었습니다.`, `Created results for all ${results.length} document pairs.`));
    } catch (reason) {
      const message = comparisonErrorMessage(reason, language);
      setError(message);
      operation.fail(message);
    } finally {
      setLoading(false);
      if (comparisonControllerRef.current === controller) comparisonControllerRef.current = undefined;
    }
  };

  const passwordAccessory = (file: File) => isHwpName(file.name) ? (
    <label className="hwp-file-password">
      <LockKeyhole size={13} />
      <input
        type="password"
        value={session.passwords[fileKey(file)] ?? ""}
        autoComplete="off"
        aria-label={L(`${file.name} 열기 암호`, `Opening password for ${file.name}`)}
        placeholder={L("암호 문서만 입력", "Encrypted documents only")}
        onChange={(event) => { session.setPassword(file, event.target.value); resetOutput(); }}
      />
    </label>
  ) : null;

  return (
    <div className="page tool-page page-enter accent-context-blue hwp-compare-page">
      <PageHeader eyebrow="DOCUMENT TOOL" title={L("문서 비교", "Document Compare")} description={L("DOCX·DOC 또는 HWP·HWPX 문서 쌍을 같은 메뉴에서 정확히 비교하세요.", "Compare DOCX/DOC or HWP/HWPX document pairs accurately from one tool.")}>
        <div className="header-status ready"><span className="status-dot" /> {L("서버 전송 없이 비교", "Compare without server uploads")}</div>
      </PageHeader>
      <PrivacyBanner compact />

      <SectionCard step={1} title={L("비교할 문서", "Documents to compare")} description={L("같은 번호의 파일끼리 비교합니다. Word와 HWP는 서로 짝지을 수 없습니다.", "Files at the same position are paired. Word and HWP documents cannot be paired together.")}>
        <div className="compare-file-grid">
          <DocumentFileColumn
            files={session.beforeFiles}
            side="before"
            sideLabel={L("수정 전", "Before")}
            hint={L("DOCX·DOC·HWP·HWPX", "DOCX, DOC, HWP, or HWPX")}
            accept=".docx,.doc,.hwp,.hwpx"
            accent="blue"
            listClassName="hwp-sortable-files"
            onFiles={(files) => updateFiles(files, "before")}
            onRemove={(index) => pairFiles.removeFile("before", index)}
            onMove={(from, to) => pairFiles.moveFile("before", from, to)}
            onMoveAcross={(index) => pairFiles.moveAcross("before", index)}
            renderAccessory={passwordAccessory}
          />
          <DocumentFileColumn
            files={session.afterFiles}
            side="after"
            sideLabel={L("수정 후", "After")}
            hint={L("같은 계열 문서끼리 짝지어 주세요", "Pair files from the same document family")}
            accept=".docx,.doc,.hwp,.hwpx"
            accent="blue"
            listClassName="hwp-sortable-files"
            onFiles={(files) => updateFiles(files, "after")}
            onRemove={(index) => pairFiles.removeFile("after", index)}
            onMove={(from, to) => pairFiles.moveFile("after", from, to)}
            onMoveAcross={(index) => pairFiles.moveAcross("after", index)}
            renderAccessory={passwordAccessory}
          />
        </div>
        {pairingError && <div className="pair-count-error" role="alert"><AlertCircle size={17} /><span><strong>{L("파일 수가 맞지 않습니다.", "File counts do not match.")}</strong><small>{pairingError}</small></span></div>}
        {!pairingError && session.beforeFiles.length > 0 && <DocumentPairingPreview beforeFiles={session.beforeFiles} afterFiles={session.afterFiles} language={language} />}
      </SectionCard>

      <div className="word-options-grid">
        <SectionCard step={2} title={L("결과 형식", "Output formats")}>
          <div className="settings-list compact-settings output-selection-list">
            <ToggleRow label={L("웹 비교", "Web comparison")} description={L("좌우 화면에서 변경 내용을 확인합니다.", "Review changes in a side-by-side view.")} checked={session.webOutput} onChange={(checked) => { session.setWebOutput(checked); resetOutput(); }} />
            <ToggleRow label={L("Excel 보고서", "Excel report")} description={L("일반 변경과 표별 비교 시트를 만듭니다.", "Create worksheets for general changes and tables.")} checked={session.excelOutput} onChange={(checked) => { session.setExcelOutput(checked); resetOutput(); }} />
            <ToggleRow label={L("Word 변경 추적 (DOCX 전용)", "Tracked-changes Word file (DOCX only)")} description={L("두 파일 모두 DOCX인 비교 결과에만 적용됩니다.", "Applied only when both files in a pair are DOCX.")} checked={session.trackedOutput} onChange={(checked) => { session.setTrackedOutput(checked); resetOutput(); }} />
          </div>
          {session.trackedOutput && <>
            <div className="settings-list compact-settings output-selection-list">
              <ToggleRow
                label={L("변경 내용 작성자 통일", "Use one revision author")}
                description={L("기존 변경 내용을 먼저 수락하고 새 변경 기록의 작성자를 아래 이름으로 통일합니다.", "Accept existing revisions first, then use the name below for all new tracked changes.")}
                checked={session.rewriteRevisionAuthor}
                onChange={(checked) => { session.setRewriteRevisionAuthor(checked); resetOutput(); }}
              />
            </div>
            <label className="revision-author-field"><span>{L("변경 내용 작성자", "Revision author")}</span><input type="text" value={session.revisionAuthor} maxLength={80} placeholder="Worklazy Tools" disabled={!session.rewriteRevisionAuthor} onChange={(event) => { session.setRevisionAuthor(event.target.value); resetOutput(); }} /></label>
          </>}
          <div className="output-preview"><FileText size={20} /><span><strong>{hasOutput ? [session.webOutput && L("웹", "Web"), session.excelOutput && "Excel", session.trackedOutput && L("DOCX 변경 추적", "Tracked DOCX")].filter(Boolean).join(" · ") : L("결과 형식을 하나 이상 선택하세요.", "Select at least one output format.")}</strong><small>{L("지원되는 결과만 문서 쌍별로 제공합니다.", "Supported outputs are provided separately for each pair.")}</small></span></div>
        </SectionCard>
        <SectionCard step={3} title={L("비교 범위", "Comparison scope")}>
          <div className="settings-list compact-settings">
            <ToggleRow label={L("서식 변경 포함", "Include formatting changes")} checked={session.formatting} onChange={(checked) => { session.setFormatting(checked); resetOutput(); }} />
            <ToggleRow label={L("표 비교", "Compare tables")} checked={session.tables} onChange={(checked) => { session.setTables(checked); resetOutput(); }} />
            <ToggleRow label={L("기타 문서 영역", "Other document areas")} description={L("머리말·꼬리말, 메모, 각주·미주", "Headers, footers, comments, footnotes, and endnotes")} checked={session.metadata} onChange={(checked) => { session.setMetadata(checked); resetOutput(); }} />
          </div>
        </SectionCard>
      </div>

      <div className="comparison-prepare-note"><Info size={16} /><span><strong>{L("파일 형식에 맞는 비교 기능을 자동으로 준비합니다.", "The appropriate comparison support is prepared automatically.")}</strong><small>{L("처음 필요한 파일을 받는 동안에도 진행률과 현재 단계를 표시하며, 문서는 브라우저 안에서 처리합니다.", "Progress and the current step remain visible during the first download, and documents are processed in your browser.")}</small></span></div>
      <div className="tool-action-bar">
        <div><TextSearch size={20} /><span><strong>{ready ? L(`${session.beforeFiles.length}개 문서 쌍을 비교할 준비가 됐어요.`, `${session.beforeFiles.length} document pairs are ready.`) : pairingError ? L("양쪽 파일 개수를 맞춰 주세요.", "Use the same number of files on both sides.") : !hasOutput ? L("결과 형식을 하나 이상 선택해 주세요.", "Select at least one output format.") : L("수정 전·후 문서를 선택해 주세요.", "Choose before and after documents.")}</strong><small>{L("HWP 암호는 해당 파일 아래 입력란에서만 사용됩니다.", "HWP passwords are used only for their selected files.")}</small></span></div>
        <PrimaryButton accent="blue" disabled={!ready || Boolean(pairingError)} loading={loading} onClick={() => void runComparison()}>{loading ? L(`${operation.progress}% 비교 중`, `Comparing ${operation.progress}%`) : session.beforeFiles.length ? L(`${session.beforeFiles.length}개 문서 쌍 비교`, `Compare ${session.beforeFiles.length} document pairs`) : L("문서 쌍 비교", "Compare document pairs")}</PrimaryButton>
        {loading && <button type="button" className="secondary-button" onClick={() => comparisonControllerRef.current?.abort()}>{L("비교 취소", "Cancel comparison")}</button>}
      </div>
      <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="blue" title={L("문서 비교 진행 상황", "Document comparison progress")} />
      {error && !pairingError && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>{L("비교하지 못했습니다.", "Comparison failed.")}</strong><span>{error}</span></div></div>}

      {session.results.length > 0 && <section className="word-batch-results" aria-live="polite">
        <div className="content-heading"><div><p className="eyebrow success">{L("작업 완료", "Complete")}</p><h2>{L(`${session.results.length}개 문서 쌍의 결과`, `Results for ${session.results.length} document pairs`)}</h2><p>{L("지원되는 결과를 문서 쌍별로 열 수 있습니다.", "Open the supported outputs for each document pair.")}</p></div></div>
        <div className="word-pair-result-list">{session.results.map((item) => <article className="word-pair-result-card" key={item.pairNumber}>
          <span className="pair-number">{item.pairNumber}</span>
          <div className="pair-result-copy"><strong>{item.result.beforeName}</strong><span>→</span><strong>{item.result.afterName}</strong><small>{item.result.changes.length ? L(`${item.result.changes.length}개 변경 발견`, `${item.result.changes.length} changes found`) : L("변경 없음", "No changes")}</small></div>
          <div className="pair-result-actions">
            {session.webOutput && <Link className="secondary-button" to={`${resultBasePath}/${item.pairNumber}`}><TextSearch size={15} /> {L("웹 비교 보기", "View web comparison")}</Link>}
            {item.reportUrl && <a className="result-download blue-download" href={item.reportUrl} download={item.reportFileName}><Download size={15} /> {L("Excel 보고서", "Excel report")}</a>}
            {item.reportUrl && <FileShareButton url={item.reportUrl} fileName={item.reportFileName || L("문서-비교보고서.xlsx", "document-comparison-report.xlsx")} />}
            {item.trackedUrl && <a className="result-download tracked-download" href={item.trackedUrl} download={item.trackedFileName}><Download size={15} /> {L("Word 변경 추적", "Tracked Word file")}</a>}
          </div>
        </article>)}</div>
      </section>}

      <ToolGuide
        title={L("문서 비교 사용 안내", "Document comparison guide")}
        description={L("Word와 HWP 문서 계열을 한 화면에서 비교하되 서로 다른 계열의 잘못된 조합은 차단합니다.", "Compare Word and HWP document families in one tool while blocking invalid cross-family pairs.")}
        blocks={language === "en" ? [
          { title: "Supported pairs", paragraphs: ["DOCX and DOC can be compared with each other. HWP and HWPX can be compared with each other. A Word file cannot be paired with an HWP file."] },
          { title: "How matching works", paragraphs: ["The same alignment rules handle empty paragraphs, nearby edits, paragraph splits or merges, and moved paragraphs for every supported format."] },
          { title: "Tracked Word output", paragraphs: ["Tracked output is limited to DOCX pairs. By default, existing revision authors are preserved. Turn on Use one revision author to accept existing revisions first, assign new tracked changes to the name you enter, preserve existing comments, and use that name only for comments newly added to the revised document."] },
          { title: "Items to verify", paragraphs: ["Exact page layout, drawing objects, calculated fields, review data, and complex nested tables may differ from desktop office applications."] },
        ] : [
          { title: "지원 조합", paragraphs: ["DOCX와 DOC는 서로 비교할 수 있고, HWP와 HWPX도 서로 비교할 수 있습니다. Word 문서와 HWP 문서를 한 쌍으로 비교할 수는 없습니다."] },
          { title: "문단 대응 방식", paragraphs: ["모든 지원 형식에 같은 정렬 규칙을 적용해 빈 문단, 가까운 문구 수정, 문단 분할·병합과 문단 이동을 구분합니다."] },
          { title: "Word 변경 추적", paragraphs: ["DOCX 문서 쌍에서만 변경 추적 파일을 만듭니다. 기본값에서는 기존 변경 내용의 작성자를 보존합니다. 작성자 통일을 켜면 기존 변경 내용을 먼저 수락한 뒤 새 변경 기록을 입력한 이름으로 통일하며, 기존 메모는 유지하고 수정 후 문서에 새로 추가된 메모만 같은 이름을 사용합니다."] },
          { title: "확인이 필요한 항목", paragraphs: ["정확한 페이지 배치, 도형, 계산 필드, 검토 기록과 복잡한 중첩 표는 데스크톱 오피스 프로그램의 결과와 다를 수 있습니다."] },
        ]}
        faq={language === "en" ? [
          { question: "Can I compare DOC with DOCX?", answer: "Yes. Both belong to the Word family, so either order is supported." },
          { question: "Can I compare DOCX with HWP?", answer: "No. The pair is rejected before analysis. Pair Word files together and HWP files together." },
          { question: "Does tracked Word output work for DOC?", answer: "No. It is limited to pairs where both files are DOCX." },
        ] : [
          { question: "DOC와 DOCX를 서로 비교할 수 있나요?", answer: "가능합니다. 둘 다 Word 계열이므로 어느 쪽 순서든 비교할 수 있습니다." },
          { question: "DOCX와 HWP를 비교할 수 있나요?", answer: "불가능합니다. 분석 전에 해당 쌍을 차단하므로 Word 문서끼리, HWP 문서끼리 짝지어 주세요." },
          { question: "DOC도 Word 변경 추적 파일을 만들 수 있나요?", answer: "아닙니다. 두 파일이 모두 DOCX인 문서 쌍에만 적용됩니다." },
        ]}
      />
      <RhwpVersionNotice mode="compare" />
    </div>
  );
}

function isSupportedDocumentName(file: File) {
  return /\.(docx?|hwp|hwpx)$/i.test(file.name);
}

function isHwpName(name: string) {
  return /\.(hwp|hwpx)$/i.test(name);
}

function trackedFileName(pairNumber: number, beforeName: string, afterName: string, language: "ko" | "en") {
  const base = `${pairNumber}_${stripDocumentExtension(beforeName)}_vs_${stripDocumentExtension(afterName)}`.replace(/[\\/:*?"<>|]/g, "_");
  return `${base.slice(0, 120)}_${language === "en" ? "tracked-changes" : "변경추적"}.docx`;
}

function comparisonErrorMessage(reason: unknown, language: "ko" | "en") {
  const fallback = language === "en"
    ? "Could not compare the documents. Check the selected files and try again."
    : "문서를 비교하지 못했습니다. 선택한 파일을 확인한 뒤 다시 시도해 주세요.";
  if (!(reason instanceof Error)) return fallback;
  const message = reason.message.trim();
  if (reason.name === "AbortError") return language === "en" ? "Document comparison was cancelled." : "문서 비교를 취소했습니다.";
  const safeMessage = /^(?:Document pair \d+:|\d+번 문서 쌍:|Password-protected Word files|암호로 보호된 Word 파일|The selected file|선택한 파일|Could not (?:read|analyze|start|download)|문서가 너무 커서|HWP 문서를 읽지 못했습니다|암호를 확인하거나|Word 문서 비교를 시작하지 못했습니다|HWP 문서 비교를 시작하지 못했습니다|This DOC file|이 DOC 파일)/i.test(message);
  return safeMessage ? message : fallback;
}
