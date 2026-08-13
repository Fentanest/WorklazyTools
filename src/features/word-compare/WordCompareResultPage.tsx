import { ArrowLeft, ArrowRight, Download, Info, MessageSquare, TextSearch } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { type ReactNode, useMemo, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
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
  return <DocumentCompareResultPage results={results} basePath="/tools/word-compare" toolLabel="Word 비교" eyebrow="WORD COMPARE" accentClass="accent-context-blue" trackedLabel="Word 변경 추적" showCommentLegend />;
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

  if (!Number.isInteger(pairNumber) || pairNumber < 1) return <Navigate to={basePath} replace />;

  if (!pair) {
    return (
      <div className={`page tool-page page-enter ${accentClass}`}>
        <PageHeader eyebrow={eyebrow} title="비교 결과를 다시 열 수 없어요." description="비교 결과는 현재 브라우저 탭에서만 유지됩니다." />
        <section className="expired-result-card">
          <TextSearch size={27} />
          <h2>문서를 다시 선택해 주세요.</h2>
          <p>페이지를 새로고침했거나 탭을 다시 연 경우, 문서 보호를 위해 이전 비교 내용은 남아 있지 않습니다.</p>
          <Link className="secondary-button" to={basePath}><ArrowLeft size={15} /> {toolLabel}로 돌아가기</Link>
        </section>
      </div>
    );
  }

  const previous = results.find((item) => item.pairNumber === pairNumber - 1);
  const next = results.find((item) => item.pairNumber === pairNumber + 1);
  const changedPages = areaPages.filter((item) => item.kind !== "unchanged").length;

  return (
    <div className={`page tool-page page-enter ${accentClass}`}>
      <div className="result-view-back"><Link to={basePath}><ArrowLeft size={16} /> 전체 비교 결과</Link></div>
      <PageHeader
        eyebrow={`PAIR ${pair.pairNumber} OF ${results.length}`}
        title={`${pair.pairNumber}번 문서 비교`}
        description={`${pair.result.beforeName}과 ${pair.result.afterName}의 변경 내용입니다.`}
      >
        {pair.reportUrl && <a className="secondary-button" href={pair.reportUrl} download={pair.reportFileName}><Download size={15} /> Excel 보고서</a>}
        {pair.trackedUrl && trackedLabel && <a className="secondary-button" href={pair.trackedUrl} download={pair.trackedFileName}><Download size={15} /> {trackedLabel}</a>}
      </PageHeader>
      <PrivacyBanner compact />

      <section className="comparison-preview pair-view-page">
        <ComparisonSummary result={pair.result} />
        <div className="comparison-toolbar document-toolbar">
          <SegmentedControl
            label="문서 영역"
            value={resultTab}
            onChange={setResultTab}
            options={[
              { value: "document", label: "문서 전체" },
              { value: "headerFooter", label: "머리말·꼬리말" },
              { value: "note", label: "각주·미주" },
            ]}
          />
          <div className="document-toolbar-status">
            {resultTab === "document" && <ContentToggle checked={showFullContent} onChange={setShowFullContent} />}
            <small>{visiblePages.length}개 표시 · {changedPages}개 변경</small>
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

      <nav className="pair-result-navigation" aria-label="다른 문서 쌍 비교 결과">
        {previous ? <Link to={`${basePath}/results/${previous.pairNumber}`}><ArrowLeft size={15} /> {previous.pairNumber}번 비교</Link> : <span />}
        {next && <Link to={`${basePath}/results/${next.pairNumber}`}>{next.pairNumber}번 비교 <ArrowRight size={15} /></Link>}
      </nav>
      {footer}
    </div>
  );
}

function ComparisonSummary({ result }: { result: WordCompareResult }) {
  const items = [
    { label: "추가", value: result.summary.added, className: "added" },
    { label: "삭제", value: result.summary.deleted, className: "deleted" },
    { label: "내용 변경", value: result.summary.changed, className: "changed" },
    { label: "서식 변경", value: result.summary.format, className: "format" },
  ];
  return <div className="comparison-summary">{items.map((item) => <div className={item.className} key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;
}

function DiffLegend({ showComments }: { showComments: boolean }) {
  return (
    <div className="document-diff-legend" aria-label="변경 표시 안내">
      <span><i className="legend-delete">삭제된 내용</i></span>
      <span><i className="legend-add">추가된 내용</i></span>
      <span><i className="legend-format">서식 변경</i></span>
      {showComments && <span><i className="legend-comment">메모 변경</i></span>}
    </div>
  );
}

function ContentToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="document-content-toggle">
      <strong>내용 전체</strong>
      <button
        className={`ios-switch${checked ? " checked" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="내용 전체"
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
  if (!items.length) {
    return <div className="empty-diff document-empty"><TextSearch size={22} /><strong>이 영역에는 비교할 내용이 없습니다.</strong></div>;
  }

  return (
    <div className="document-page-scroll">
      <div className="document-page-view" role="table" aria-label="수정 전후 문서 전체 비교">
        <div className="document-page-column-heading before" role="columnheader"><span>수정 전</span><strong>{beforeName}</strong></div>
        <div className="document-page-column-heading after" role="columnheader"><span>수정 후</span><strong>{afterName}</strong></div>
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
  const location = side === "before" ? item.beforeLocation : item.afterLocation;
  const text = side === "before" ? item.before : item.after;
  if (table) {
    const tableMissing = side === "before" ? table.beforeIndex === null : table.afterIndex === null;
    return (
      <article className={`document-page-block ${side} table${tableMissing ? " missing" : ""}`} role="cell">
        <div className="document-block-meta">
          <small>{location || (side === "before" ? "수정 전에는 없음" : "수정 후에는 없음")}</small>
          {item.kind !== "unchanged" && <span>{changeKindLabel(item.kind)}</span>}
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
        <small>{location || (side === "before" ? "수정 전에는 없음" : "수정 후에는 없음")}</small>
        {item.kind !== "unchanged" && <span>{changeKindLabel(item.kind)}</span>}
      </div>
      {isMissing
        ? <p className="document-missing-copy">{item.kind === "added" ? "추가된 항목" : "삭제된 항목"}</p>
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
  const grid = side === "before" ? table.before : table.after;
  const kinds = side === "before" ? table.beforeKinds : table.afterKinds;

  return (
    <div className="word-table-wrap">
      <table className="word-document-table" aria-label={`${side === "before" ? "수정 전" : "수정 후"} 표 ${table.index + 1}`}>
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
            <div><MessageSquare size={11} /><strong>메모{author ? ` · ${author}` : ""}</strong></div>
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

function changeKindLabel(kind: WordDocumentViewItem["kind"]) {
  return kind === "added" ? "추가" : kind === "deleted" ? "삭제" : kind === "format" ? "서식 변경" : kind === "comment" ? "메모 변경" : kind === "changed" ? "내용 변경" : "변경 없음";
}
