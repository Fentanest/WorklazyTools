import {
  AlertCircle,
  Download,
  FileText,
  Info,
  LockKeyhole,
  TextSearch,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { OperationProgress } from "../../components/OperationProgress";
import { FileShareButton } from "../../components/FileShareButton";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { RhwpVersionNotice } from "../../components/RhwpVersionNotice";
import { ToolGuide } from "../../components/ToolGuide";
import { PageHeader, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { DocumentFileColumn } from "../document-compare/DocumentFileColumn";
import { DocumentPairingPreview } from "../document-compare/DocumentPairingPreview";
import { createComparisonExcelReports, createComparisonReportArtifact } from "../document-compare/comparisonResults";
import { useDocumentPairFiles } from "../document-compare/useDocumentPairFiles";
import { fileKey, useHwpCompareSession } from "./hwpCompareSession";
import { compareHwpFilePairs } from "./hwpWorkerClient";
import { useAppLanguage, useLocalizedPath } from "../../i18n/routing";

export function HwpComparePage() {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const resultBasePath = useLocalizedPath("/tools/hwp-compare/results");
  const session = useHwpCompareSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useOperationProgress();
  const comparisonControllerRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => comparisonControllerRef.current?.abort(), []);
  const hasFiles = session.beforeFiles.length > 0 || session.afterFiles.length > 0;
  const countMismatch = hasFiles && session.beforeFiles.length !== session.afterFiles.length;
  const hasOutput = session.webOutput || session.excelOutput;
  const ready = session.beforeFiles.length > 0 && !countMismatch && hasOutput && !loading;
  const pairingError = countMismatch
    ? L(`수정 전 ${session.beforeFiles.length}개와 수정 후 ${session.afterFiles.length}개의 파일 수가 일치하지 않습니다. 같은 개수로 맞춰 주세요.`, `${session.beforeFiles.length} before files and ${session.afterFiles.length} after files do not match. Use the same count.`)
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
    accepts: isHwpFile,
    onReset: resetOutput,
  });

  const updateFiles = (files: File[], side: "before" | "after") => {
    const rejected = pairFiles.updateFiles(files, side);
    if (rejected.length) setError(L(`HWP·HWPX가 아닌 파일을 제외했습니다: ${rejected.map((file) => file.name).join(", ")}`, `Non-HWP/HWPX files were excluded: ${rejected.map((file) => file.name).join(", ")}`));
  };

  const runComparison = async () => {
    if (pairingError) { setError(pairingError); return; }
    if (!ready) return;
    session.clearResults();
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    comparisonControllerRef.current = controller;
    operation.start(L(`${session.beforeFiles.length}개 HWP 문서 쌍의 비교를 준비하고 있습니다.`, `Preparing ${session.beforeFiles.length} HWP document pairs.`));
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
        language,
        controller.signal,
      );
      const comparisonResults = workerResults.map((item) => item.result);
      let reports: ArrayBuffer[] = [];
      if (session.excelOutput) {
        operation.update(80, L(`${comparisonResults.length}개 Excel 보고서를 준비합니다.`, `Preparing ${comparisonResults.length} Excel reports.`));
        reports = await createComparisonExcelReports(comparisonResults, (nextProgress, message) => operation.update(80 + Math.round(nextProgress * 0.2), message), language, controller.signal);
      }
      session.replaceResults(comparisonResults.map((result, index) => {
        const report = reports[index];
        return {
          pairNumber: index + 1,
          result,
          ...createComparisonReportArtifact(report, index + 1, result.beforeName, result.afterName, language, "HWP"),
        };
      }));
      operation.succeed(L(`${comparisonResults.length}개 HWP 문서 쌍의 결과를 모두 만들었습니다.`, `Created results for all ${comparisonResults.length} HWP document pairs.`));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : L("HWP 문서를 비교하지 못했습니다.", "Could not compare the HWP documents.");
      setError(message);
      operation.fail(message);
    } finally {
      setLoading(false);
      if (comparisonControllerRef.current === controller) comparisonControllerRef.current = undefined;
    }
  };

  return (
    <div className="page tool-page page-enter accent-context-orange hwp-compare-page">
      <PageHeader eyebrow="HWP DOCUMENT TOOL" title={L("HWP 비교", "HWP Compare")} description={L("여러 HWP·HWPX 문서 쌍의 본문과 표 변경을 한 번에 비교하세요.", "Compare body text and table changes across multiple HWP and HWPX document pairs.")}>
        <div className="header-status ready"><span className="status-dot" /> {L("서버 전송 없이 비교", "Compare without server uploads")}</div>
      </PageHeader>
      <PrivacyBanner compact />

      <SectionCard step={1} title={L("비교할 문서", "Documents to compare")} description={L("목록의 같은 번호끼리 비교합니다. 드래그로 순서를 맞추거나 좌우 화살표로 문서를 옮기세요.", "Files are paired by list position. Drag to reorder or use the side arrows to move documents.")}>
        <div className="compare-file-grid">
          <DocumentFileColumn
            files={session.beforeFiles}
            side="before"
            sideLabel={L("수정 전", "Before")}
            hint={L("원본 HWP·HWPX · 여러 번 나눠 추가 가능", "Original HWP or HWPX · add more at any time")}
            accept=".hwp,.hwpx"
            accent="orange"
            listClassName="hwp-sortable-files"
            onFiles={(files) => updateFiles(files, "before")}
            onRemove={(index) => pairFiles.removeFile("before", index)}
            onMove={(from, to) => pairFiles.moveFile("before", from, to)}
            onMoveAcross={(index) => pairFiles.moveAcross("before", index)}
            renderAccessory={(file) => <label className="hwp-file-password"><LockKeyhole size={13} /><input type="password" value={session.passwords[fileKey(file)] ?? ""} autoComplete="off" aria-label={language === "en" ? `Opening password for ${file.name}` : `${file.name} 열기 암호`} placeholder={language === "en" ? "Encrypted documents only" : "암호 문서만 입력"} onChange={(event) => { session.setPassword(file, event.target.value); resetOutput(); }} /></label>}
          />
          <DocumentFileColumn
            files={session.afterFiles}
            side="after"
            sideLabel={L("수정 후", "After")}
            hint={L("변경된 HWP·HWPX · 여러 번 나눠 추가 가능", "Revised HWP or HWPX · add more at any time")}
            accept=".hwp,.hwpx"
            accent="orange"
            listClassName="hwp-sortable-files"
            onFiles={(files) => updateFiles(files, "after")}
            onRemove={(index) => pairFiles.removeFile("after", index)}
            onMove={(from, to) => pairFiles.moveFile("after", from, to)}
            onMoveAcross={(index) => pairFiles.moveAcross("after", index)}
            renderAccessory={(file) => <label className="hwp-file-password"><LockKeyhole size={13} /><input type="password" value={session.passwords[fileKey(file)] ?? ""} autoComplete="off" aria-label={language === "en" ? `Opening password for ${file.name}` : `${file.name} 열기 암호`} placeholder={language === "en" ? "Encrypted documents only" : "암호 문서만 입력"} onChange={(event) => { session.setPassword(file, event.target.value); resetOutput(); }} /></label>}
          />
        </div>
        {pairingError && <div className="pair-count-error" role="alert"><AlertCircle size={17} /><span><strong>{L("파일 수가 맞지 않습니다.", "File counts do not match.")}</strong><small>{pairingError}</small></span></div>}
        {!pairingError && session.beforeFiles.length > 0 && <DocumentPairingPreview beforeFiles={session.beforeFiles} afterFiles={session.afterFiles} language={language} />}
      </SectionCard>

      <div className="word-options-grid">
        <SectionCard step={2} title={L("결과 형식", "Output formats")}>
          <div className="settings-list compact-settings output-selection-list">
            <ToggleRow label={L("웹 비교", "Web comparison")} description={L("좌우 문서 화면에서 변경 내용을 확인합니다.", "Review changes in a side-by-side document view.")} checked={session.webOutput} onChange={(checked) => { session.setWebOutput(checked); resetOutput(); }} />
            <ToggleRow label={L("Excel 보고서", "Excel report")} description={L("일반 변경과 표별 비교 시트를 만듭니다.", "Create worksheets for general changes and each table.")} checked={session.excelOutput} onChange={(checked) => { session.setExcelOutput(checked); resetOutput(); }} />
          </div>
          <div className="output-preview"><FileText size={20} /><span><strong>{hasOutput ? [session.webOutput && L("웹", "Web"), session.excelOutput && "Excel"].filter(Boolean).join(" · ") : L("결과 형식을 하나 이상 선택하세요.", "Select at least one output format.")}</strong><small>{L("각 문서 쌍마다 결과를 따로 제공합니다.", "Results are provided separately for each document pair.")}</small></span></div>
        </SectionCard>
        <SectionCard step={3} title={L("비교 범위", "Comparison scope")}>
          <div className="settings-list compact-settings">
            <ToggleRow label={L("서식 변경 포함", "Include formatting changes")} checked={session.formatting} onChange={(checked) => { session.setFormatting(checked); resetOutput(); }} />
            <ToggleRow label={L("표 비교", "Compare tables")} description={L("행·열 삽입을 고려해 대응되는 셀을 찾습니다.", "Match corresponding cells while accounting for inserted rows and columns.")} checked={session.tables} onChange={(checked) => { session.setTables(checked); resetOutput(); }} />
            <ToggleRow label={L("기타 문서 영역", "Other document areas")} description={L("머리말·꼬리말, 각주·미주", "Headers, footers, footnotes and endnotes")} checked={session.metadata} onChange={(checked) => { session.setMetadata(checked); resetOutput(); }} />
          </div>
        </SectionCard>
      </div>

      <div className="comparison-prepare-note"><Info size={16} /><span><strong>{L("첫 실행에는 HWP 문서 비교 기능을 준비합니다.", "HWP document comparison is prepared on the first run.")}</strong><small>{L("준비가 끝나면 선택한 문서 쌍을 순서대로 비교합니다.", "After preparation, the selected document pairs are compared in order.")}</small></span></div>
      <div className="tool-action-bar">
        <div><TextSearch size={20} /><span><strong>{ready ? L(`${session.beforeFiles.length}개 문서 쌍을 비교할 준비가 됐어요.`, `${session.beforeFiles.length} document pairs are ready.`) : pairingError ? L("양쪽 파일 개수를 맞춰 주세요.", "Use the same number of files on both sides.") : !hasOutput ? L("결과 형식을 하나 이상 선택해 주세요.", "Select at least one output format.") : L("수정 전·후 문서를 선택해 주세요.", "Choose before and after documents.")}</strong><small>{L("파일과 입력한 암호는 현재 브라우저 메모리에서만 사용됩니다.", "Files and passwords are used only in current browser memory.")}</small></span></div>
        <PrimaryButton accent="orange" disabled={!ready || Boolean(pairingError)} loading={loading} onClick={() => void runComparison()}>{loading ? L(`${operation.progress}% 비교 중`, `Comparing ${operation.progress}%`) : session.beforeFiles.length ? L(`${session.beforeFiles.length}개 문서 쌍 비교`, `Compare ${session.beforeFiles.length} document pairs`) : L("문서 쌍 비교", "Compare document pairs")}</PrimaryButton>
        {loading && <button type="button" className="secondary-button" onClick={() => comparisonControllerRef.current?.abort()}>{L("비교 취소", "Cancel comparison")}</button>}
      </div>
      <OperationProgress status={operation.status} progress={operation.progress} message={operation.message} logs={operation.logs} accent="orange" title={L("HWP 비교 진행 상황", "HWP comparison progress")} />
      {error && !pairingError && <div className="error-banner" role="alert"><AlertCircle size={19} /><div><strong>{L("비교하지 못했습니다.", "Comparison failed.")}</strong><span>{error}</span></div></div>}

      {session.results.length > 0 && (
        <section className="word-batch-results" aria-live="polite">
          <div className="content-heading"><div><p className="eyebrow success">{L("작업 완료", "Complete")}</p><h2>{L(`${session.results.length}개 HWP 문서 쌍의 결과`, `Results for ${session.results.length} HWP document pairs`)}</h2><p>{L("웹 비교와 Excel 보고서를 문서 쌍별로 열 수 있습니다.", "Open the web comparison and Excel report for each document pair.")}</p></div></div>
          <div className="word-pair-result-list">
            {session.results.map((item) => (
              <article className="word-pair-result-card" key={item.pairNumber}>
                <span className="pair-number">{item.pairNumber}</span>
                <div className="pair-result-copy"><strong>{item.result.beforeName}</strong><span>→</span><strong>{item.result.afterName}</strong><small>{item.result.changes.length ? L(`${item.result.changes.length}개 변경 발견`, `${item.result.changes.length} changes found`) : L("변경 없음", "No changes")}</small></div>
                <div className="pair-result-actions">
                  {session.webOutput && <Link className="secondary-button" to={`${resultBasePath}/${item.pairNumber}`}><TextSearch size={15} /> {L("웹 비교 보기", "View web comparison")}</Link>}
                  {item.reportUrl && <a className="result-download hwp-download" href={item.reportUrl} download={item.reportFileName}><Download size={15} /> {L("Excel 보고서", "Excel report")}</a>}
                  {item.reportUrl && <FileShareButton url={item.reportUrl} fileName={item.reportFileName || L("worklazy-HWP-비교보고서.xlsx", "worklazy-HWP-comparison-report.xlsx")} />}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <ToolGuide
        title={L("HWP·HWPX 문서 비교 안내", "HWP and HWPX comparison guide")}
        description={L("문서 구조를 브라우저 안에서 분석해 여러 문서 쌍의 결과를 따로 제공합니다.", "Analyze document structure in the browser and create separate results for multiple pairs.")}
        blocks={language === "en" ? [
          { title: "Batch comparison", paragraphs: ["Add the same number of HWP or HWPX files to both sides. Files at the same list position are compared together."] },
          { title: "Body text and outline numbering", paragraphs: ["Body text, paragraph and character formatting, and document-defined outline numbers are compared together."] },
          { title: "Table structure", paragraphs: ["Tables appear as before-and-after grids. Similar rows and columns are matched to reduce false changes after insertions."] },
          { title: "Current boundaries", paragraphs: ["Headers, footers, footnotes and endnotes are supported. Review comments, tracked changes, shape text and some nested tables may be omitted or simplified."] },
          { title: "Tracked HWP output", paragraphs: ["Web and Excel output are available. A tracked-changes HWP file with accept/reject controls is not currently generated."] },
        ] : [
          { title: "다중 동시 비교", paragraphs: ["수정 전과 수정 후에 같은 개수의 HWP 또는 HWPX를 넣으세요. 같은 순번의 파일끼리 비교하며 목록 안에서 순서를 바꾸거나 반대편으로 옮길 수 있습니다."] },
          { title: "본문과 개요 번호", paragraphs: ["본문 문단의 텍스트와 문단·글자 서식을 비교하며 문서에 정의된 개요 번호는 본문 앞에 함께 표시합니다. 일반 글자로 직접 입력한 번호도 본문의 일부로 비교됩니다."] },
          { title: "표 구조 변경", paragraphs: ["각 표는 수정 전·후 격자로 표시하고 Excel에서는 표마다 시트를 만듭니다. 중간에 행이나 열이 추가되어도 내용 유사도로 대응 관계를 찾아 뒤쪽 셀 전체가 변경으로 잡히는 현상을 줄입니다."] },
          { title: "현재 지원 경계", paragraphs: ["머리말·꼬리말과 각주·미주 텍스트를 비교합니다. HWP 검토 메모와 변경 추적 기록, 도형 안 텍스트와 일부 중첩 표는 현재 브라우저 분석 범위에 포함되지 않아 결과에서 제외되거나 단순화될 수 있습니다."] },
          { title: "변경 추적 HWP", paragraphs: ["웹 비교와 Excel 보고서를 지원합니다. Word의 DOCX처럼 수락·거부할 수 있는 HWP 변경 추적 파일 생성은 현재 제공하지 않습니다."] },
        ]}
        faq={language === "en" ? [
          { question: "Can HWP and HWPX be compared with each other?", answer: "Yes. They can be mixed within a pair and are compared using the extracted document structure." },
          { question: "How do I open an encrypted document?", answer: "Enter its opening password below the file. Supported encryption is handled in the browser; DRM documents are unsupported." },
          { question: "Is this identical to Hancom Office comparison?", answer: "No. Core text, outlines, tables and document areas are compared structurally, but review data and complex objects may differ." },
        ] : [
          { question: "HWP와 HWPX를 서로 비교할 수 있나요?", answer: "가능합니다. 같은 쌍 안에서 HWP와 HWPX를 섞어도 추출된 문서 구조를 기준으로 비교합니다." },
          { question: "암호 문서는 어떻게 여나요?", answer: "각 파일 아래 암호 입력란에 열기 암호를 입력하세요. 지원되는 HWP/HWPX 암호 방식은 브라우저에서 해제하며 암호를 서버로 전송하지 않습니다. DRM 문서는 지원하지 않습니다." },
          { question: "한컴오피스의 자체 비교와 완전히 같나요?", answer: "아닙니다. 본문·개요·표·머리말·꼬리말·각주·미주를 구조적으로 비교하지만, 검토 정보와 복잡한 개체는 한컴오피스 결과와 차이가 날 수 있습니다." },
        ]}
      />
      <RhwpVersionNotice mode="compare" />
    </div>
  );
}

function isHwpFile(file: File) {
  return /\.(hwp|hwpx)$/i.test(file.name);
}
