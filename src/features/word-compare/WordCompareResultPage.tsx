import { ArrowLeft, ArrowRight, Download, Info, MessageSquare, TextSearch } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { type ReactNode, useMemo, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { PageHeader, SegmentedControl } from "../../components/ui";
import type {
  WordCompareResult,
  WordCommentViewItem,
  WordDiffSegment,
  WordDocumentViewItem,
  WordTableCell,
  WordTableComparison,
} from "../excel-merger/types";
import { useWordCompareSession } from "./wordCompareSession";
import { useLocalizedPath } from "../../i18n/routing";
import { useAppLanguage } from "../../i18n/routing";

type ResultTab = "document" | "headerFooter" | "note";

export interface DocumentCompareResultPair {
  pairNumber: number;
  result: WordCompareResult;
  reportUrl?: string;
  reportFileName?: string;
  trackedUrl?: string;
  trackedFileName?: string;
}

interface DocumentCompareResultPageProps {
  results: DocumentCompareResultPair[];
  basePath: string;
  toolLabel: string;
  eyebrow: string;
  accentClass: string;
  trackedLabel?: string;
  showCommentLegend?: boolean;
  footer?: ReactNode;
}

export function WordCompareResultPage() {
  const { results } = useWordCompareSession();
  const language = useAppLanguage();
  return <DocumentCompareResultPage results={results} basePath="/tools/word-compare" toolLabel={language === "en" ? "Word comparison" : "Word 비교"} eyebrow="WORD COMPARE" accentClass="accent-context-blue" trackedLabel={language === "en" ? "Tracked Word file" : "Word 변경 추적"} showCommentLegend />;
}

export function DocumentCompareResultPage({
  results,
  basePath,
  toolLabel,
  eyebrow,
  accentClass,
  trackedLabel,
  showCommentLegend = false,
  footer,
}: DocumentCompareResultPageProps) {
  const language = useAppLanguage();
  const L = (ko: string, en: string) => language === "en" ? en : ko;
  const localizedBasePath = useLocalizedPath(basePath);
  const { pairNumber: pairNumberParam } = useParams();
  const pairNumber = Number(pairNumberParam);
  const pair = results.find((item) => item.pairNumber === pairNumber);
  const [resultTab, setResultTab] = useState<ResultTab>("document");
  const [showFullContent, setShowFullContent] = useState(true);

  const areaPages = useMemo(() => pair?.result.views?.[resultTab] ?? [], [pair, resultTab]);
  const visiblePages = useMemo(
    () => resultTab === "document" && !showFullContent
      ? areaPages.filter((item) => item.kind !== "unchanged")
      : areaPages,
    [areaPages, resultTab, showFullContent],
  );

  if (!Number.isInteger(pairNumber) || pairNumber < 1) return <Navigate to={localizedBasePath} replace />;

  if (!pair) {
    return (
      <div className={`page tool-page page-enter ${accentClass}`}>
        <PageHeader eyebrow={eyebrow} title={L("비교 결과를 다시 열 수 없어요.", "This comparison result is no longer available.")} description={L("비교 결과는 현재 브라우저 탭에서만 유지됩니다.", "Comparison results remain only in the current browser tab.")} />
        <section className="expired-result-card">
          <TextSearch size={27} />
          <h2>{L("문서를 다시 선택해 주세요.", "Choose the documents again.")}</h2>
          <p>{L("페이지를 새로고침했거나 탭을 다시 연 경우, 문서 보호를 위해 이전 비교 내용은 남아 있지 않습니다.", "After a reload or reopened tab, the previous comparison is discarded to protect your documents.")}</p>
          <Link className="secondary-button" to={localizedBasePath}><ArrowLeft size={15} /> {L(`${toolLabel}로 돌아가기`, `Back to ${toolLabel}`)}</Link>
        </section>
      </div>
    );
  }

  const previous = results.find((item) => item.pairNumber === pairNumber - 1);
  const next = results.find((item) => item.pairNumber === pairNumber + 1);
  const changedPages = areaPages.filter((item) => item.kind !== "unchanged").length;

  return (
    <div className={`page tool-page page-enter ${accentClass}`}>
      <div className="result-view-back"><Link to={localizedBasePath}><ArrowLeft size={16} /> {L("전체 비교 결과", "All comparison results")}</Link></div>
      <PageHeader
        eyebrow={`PAIR ${pair.pairNumber} OF ${results.length}`}
        title={L(`${pair.pairNumber}번 문서 비교`, `Document comparison ${pair.pairNumber}`)}
        description={L(`${pair.result.beforeName}과 ${pair.result.afterName}의 변경 내용입니다.`, `Changes between ${pair.result.beforeName} and ${pair.result.afterName}.`)}
      >
        {pair.reportUrl && <a className="secondary-button" href={pair.reportUrl} download={pair.reportFileName}><Download size={15} /> {L("Excel 보고서", "Excel report")}</a>}
        {pair.reportUrl && <FileShareButton url={pair.reportUrl} fileName={pair.reportFileName || (language === "en" ? "worklazy-comparison-report.xlsx" : "worklazy-비교보고서.xlsx")} />}
        {pair.trackedUrl && trackedLabel && <a className="secondary-button" href={pair.trackedUrl} download={pair.trackedFileName}><Download size={15} /> {trackedLabel}</a>}
        {pair.trackedUrl && trackedLabel && <FileShareButton url={pair.trackedUrl} fileName={pair.trackedFileName || (language === "en" ? "worklazy-tracked-changes.docx" : "worklazy-변경추적.docx")} />}
      </PageHeader>
      <PrivacyBanner compact />

      <section className="comparison-preview pair-view-page">
        <ComparisonSummary result={pair.result} />
        <div className="comparison-toolbar document-toolbar">
          <SegmentedControl
            label={L("문서 영역", "Document area")}
            value={resultTab}
            onChange={setResultTab}
            options={[
              { value: "document", label: L("문서 전체", "Entire document") },
              { value: "headerFooter", label: L("머리말·꼬리말", "Headers & footers") },
              { value: "note", label: L("각주·미주", "Footnotes & endnotes") },
            ]}
          />
          <div className="document-toolbar-status">
            {resultTab === "document" && <ContentToggle checked={showFullContent} onChange={setShowFullContent} />}
            <small>{L(`${visiblePages.length}개 표시 · ${changedPages}개 변경`, `${visiblePages.length} shown · ${changedPages} changed`)}</small>
          </div>
        </div>

        <DiffLegend showComments={showCommentLegend} />
        <DocumentPageComparison
          beforeName={pair.result.beforeName}
          afterName={pair.result.afterName}
          items={visiblePages}
          tables={pair.result.tables}
        />

        {pair.result.warnings.map((warning) => <div className="comparison-warning" key={warning}><Info size={14} /> {warning}</div>)}
      </section>

      <nav className="pair-result-navigation" aria-label={L("다른 문서 쌍 비교 결과", "Other document-pair results")}>
        {previous ? <Link to={`${localizedBasePath}/results/${previous.pairNumber}`}><ArrowLeft size={15} /> {L(`${previous.pairNumber}번 비교`, `Comparison ${previous.pairNumber}`)}</Link> : <span />}
        {next && <Link to={`${localizedBasePath}/results/${next.pairNumber}`}>{L(`${next.pairNumber}번 비교`, `Comparison ${next.pairNumber}`)} <ArrowRight size={15} /></Link>}
      </nav>
      {footer}
    </div>
  );
}

function ComparisonSummary({ result }: { result: WordCompareResult }) {
  const language = useAppLanguage();
  const items = [
    { label: language === "en" ? "Added" : "추가", value: result.summary.added, className: "added" },
    { label: language === "en" ? "Deleted" : "삭제", value: result.summary.deleted, className: "deleted" },
    { label: language === "en" ? "Content changed" : "내용 변경", value: result.summary.changed, className: "changed" },
    { label: language === "en" ? "Formatting changed" : "서식 변경", value: result.summary.format, className: "format" },
  ];
  return <div className="comparison-summary">{items.map((item) => <div className={item.className} key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;
}

function DiffLegend({ showComments }: { showComments: boolean }) {
  const language = useAppLanguage();
  return (
    <div className="document-diff-legend" aria-label={language === "en" ? "Change legend" : "변경 표시 안내"}>
      <span><i className="legend-delete">{language === "en" ? "Deleted content" : "삭제된 내용"}</i></span>
      <span><i className="legend-add">{language === "en" ? "Added content" : "추가된 내용"}</i></span>
      <span><i className="legend-format">{language === "en" ? "Formatting changed" : "서식 변경"}</i></span>
      {showComments && <span><i className="legend-comment">{language === "en" ? "Comment changed" : "메모 변경"}</i></span>}
    </div>
  );
}

function ContentToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const language = useAppLanguage();
  return (
    <div className="document-content-toggle">
      <strong>{language === "en" ? "Show all content" : "내용 전체"}</strong>
      <button
        className={`ios-switch${checked ? " checked" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={language === "en" ? "Show all content" : "내용 전체"}
        onClick={() => onChange(!checked)}
      ><span /></button>
    </div>
  );
}

function DocumentPageComparison({ beforeName, afterName, items, tables }: {
  beforeName: string;
  afterName: string;
  items: WordDocumentViewItem[];
  tables: WordTableComparison[];
}) {
  const language = useAppLanguage();
  if (!items.length) {
    return <div className="empty-diff document-empty"><TextSearch size={22} /><strong>{language === "en" ? "There is no content to compare in this area." : "이 영역에는 비교할 내용이 없습니다."}</strong></div>;
  }

  return (
    <div className="document-page-scroll">
      <div className="document-page-view" role="table" aria-label={language === "en" ? "Full before-and-after document comparison" : "수정 전후 문서 전체 비교"}>
        <div className="document-page-column-heading before" role="columnheader"><span>{language === "en" ? "Before" : "수정 전"}</span><strong>{beforeName}</strong></div>
        <div className="document-page-column-heading after" role="columnheader"><span>{language === "en" ? "After" : "수정 후"}</span><strong>{afterName}</strong></div>
        {items.map((item, index) => {
          const table = item.blockType === "table" && item.tableIndex !== undefined
            ? tables.find((candidate) => candidate.index === item.tableIndex)
            : undefined;
          return (
          <div className={`document-page-row ${item.kind}${table ? " table-block" : ""}`} role="row" key={`${item.section}-${item.beforeLocation}-${item.afterLocation}-${index}`}>
            <DocumentBlock item={item} side="before" table={table} />
            <DocumentBlock item={item} side="after" table={table} />
          </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentBlock({ item, side, table }: {
  item: WordDocumentViewItem;
  side: "before" | "after";
  table?: WordTableComparison;
}) {
  const language = useAppLanguage();
  const location = side === "before" ? item.beforeLocation : item.afterLocation;
  const text = side === "before" ? item.before : item.after;
  if (table) {
    const tableMissing = side === "before" ? table.beforeIndex === null : table.afterIndex === null;
    return (
      <article className={`document-page-block ${side} table${tableMissing ? " missing" : ""}`} role="cell">
        <div className="document-block-meta">
          <small>{location || (side === "before" ? (language === "en" ? "Not in before" : "수정 전에는 없음") : (language === "en" ? "Not in after" : "수정 후에는 없음"))}</small>
          {item.kind !== "unchanged" && <span>{changeKindLabel(item.kind, language)}</span>}
        </div>
        <DocumentTable table={table} side={side} />
      </article>
    );
  }
  const isMissing = !location && !text;
  const isChangedSide = (side === "before" && (item.kind === "deleted" || item.kind === "changed"))
    || (side === "after" && (item.kind === "added" || item.kind === "changed"));

  return (
    <article className={`document-page-block ${side} ${item.section}${isMissing ? " missing" : ""}`} role="cell">
      <div className="document-block-meta">
        <small>{location || (side === "before" ? (language === "en" ? "Not in before" : "수정 전에는 없음") : (language === "en" ? "Not in after" : "수정 후에는 없음"))}</small>
        {item.kind !== "unchanged" && <span>{changeKindLabel(item.kind, language)}</span>}
      </div>
      {isMissing
        ? <p className="document-missing-copy">{item.kind === "added" ? (language === "en" ? "Added item" : "추가된 항목") : (language === "en" ? "Deleted item" : "삭제된 항목")}</p>
        : <p className={item.kind === "format" ? "format-highlight" : ""}>
          {isChangedSide || item.kind === "added" || item.kind === "deleted"
            ? <SideDiffText segments={item.segments} side={side} fallback={text} />
            : text}
        </p>}
      <InlineComments comments={item.comments ?? []} side={side} />
    </article>
  );
}

function DocumentTable({ table, side }: { table: WordTableComparison; side: "before" | "after" }) {
  const language = useAppLanguage();
  const grid = side === "before" ? table.before : table.after;
  const kinds = side === "before" ? table.beforeKinds : table.afterKinds;

  return (
    <div className="word-table-wrap">
      <table className="word-document-table" aria-label={language === "en" ? `${side === "before" ? "Before" : "After"} table ${table.index + 1}` : `${side === "before" ? "수정 전" : "수정 후"} 표 ${table.index + 1}`}>
        <tbody>
          {table.rowPairs.map((rowPair, alignedRowIndex) => {
            const rowIndex = side === "before" ? rowPair.beforeIndex : rowPair.afterIndex;
            return (
              <tr key={`row-${alignedRowIndex}`}>
                {table.columnPairs.map((columnPair, alignedColumnIndex) => {
                  const columnIndex = side === "before" ? columnPair.beforeIndex : columnPair.afterIndex;
                  const cell = rowIndex === null || columnIndex === null ? undefined : grid[rowIndex]?.[columnIndex];
                  const kind = rowIndex === null || columnIndex === null ? undefined : kinds[rowIndex]?.[columnIndex];
                  return (
                    <DocumentTableCell
                      cell={cell}
                      kind={kind}
                      side={side}
                      key={`cell-${alignedRowIndex}-${alignedColumnIndex}`}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTableCell({ cell, kind, side }: {
  cell?: WordTableCell;
  kind?: WordDocumentViewItem["kind"];
  side: "before" | "after";
}) {
  if (!cell) return <td className="structural-gap" aria-hidden="true" />;
  const changed = kind && kind !== "unchanged";
  return (
    <td className={kind ? `table-cell-${kind}` : undefined}>
      <span className={kind === "format" ? "format-highlight" : undefined}>
        {changed
          ? <SideDiffText segments={cell.segments} side={side} fallback={cell.text} />
          : cell.text || "\u00a0"}
      </span>
      {cell.comments.length > 0 && (
        <div className="table-cell-comments">
          {cell.comments.map((comment, index) => (
            <span key={`${comment.id}-${index}`}><MessageSquare size={9} />{comment.author && <strong>{comment.author}</strong>}{comment.text}</span>
          ))}
        </div>
      )}
    </td>
  );
}

function InlineComments({ comments, side }: { comments: WordCommentViewItem[]; side: "before" | "after" }) {
  const language = useAppLanguage();
  const visibleComments = comments.filter((comment) => side === "before" ? comment.before : comment.after);
  if (!visibleComments.length) return null;

  return (
    <div className="inline-comment-list">
      {visibleComments.map((comment, index) => {
        const author = side === "before" ? comment.beforeAuthor : comment.afterAuthor;
        const commentId = side === "before" ? comment.beforeId : comment.afterId;
        const text = side === "before" ? comment.before : comment.after;
        return (
          <aside className={`inline-comment-card ${comment.kind}`} key={`${commentId}-${index}`}>
            <div><MessageSquare size={11} /><strong>{language === "en" ? "Comment" : "메모"}{author ? ` · ${author}` : ""}</strong></div>
            <p><SideDiffText segments={comment.segments} side={side} fallback={text} /></p>
          </aside>
        );
      })}
    </div>
  );
}

function SideDiffText({ segments, side, fallback }: {
  segments: WordDiffSegment[];
  side: "before" | "after";
  fallback: string;
}) {
  const visible = segments.filter((segment) => segment.type === "equal" || segment.type === (side === "before" ? "deleted" : "added"));
  if (!visible.length) return <>{fallback}</>;
  return <>{visible.map((segment, index) => {
    if (segment.type === "deleted") return <span className="page-diff-delete" key={`${segment.type}-${index}`}>{segment.text}</span>;
    if (segment.type === "added") return <span className="page-diff-add" key={`${segment.type}-${index}`}>{segment.text}</span>;
    return <span key={`${segment.type}-${index}`}>{segment.text}</span>;
  })}</>;
}

function changeKindLabel(kind: WordDocumentViewItem["kind"], language: "ko" | "en") {
  if (language === "en") return kind === "added" ? "Added" : kind === "deleted" ? "Deleted" : kind === "format" ? "Formatting changed" : kind === "comment" ? "Comment changed" : kind === "changed" ? "Content changed" : "Unchanged";
  return kind === "added" ? "추가" : kind === "deleted" ? "삭제" : kind === "format" ? "서식 변경" : kind === "comment" ? "메모 변경" : kind === "changed" ? "내용 변경" : "변경 없음";
}
