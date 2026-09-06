import { ArrowLeft, ArrowRight, Download, Info, MessageSquare, TextSearch } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { FileShareButton } from "../../components/FileShareButton";
import { PageHeader, SegmentedControl } from "../../components/ui";
import { UtilityNotice, UtilityPage } from "../../components/UtilitySurface";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { cn } from "../../lib/utils";
import type {
  WordCompareResult,
  WordCommentViewItem,
  WordDiffSegment,
  WordDocumentViewItem,
  WordTableCell,
  WordTableComparison,
} from "../excel-merger/types";
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

export function DocumentCompareResultPage({
  results,
  basePath,
  toolLabel,
  eyebrow,
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
      <UtilityPage toolId="document-compare-result">
        <PageHeader eyebrow={eyebrow} title={L("비교 결과를 다시 열 수 없어요.", "This comparison result is no longer available.")} description={L("비교 결과는 현재 브라우저 탭에서만 유지됩니다.", "Comparison results remain only in the current browser tab.")} />
        <Card as="section" className="min-h-72 place-items-center content-center gap-0 rounded-4xl border border-border p-8 text-center shadow-sm" data-testid="document-expired-result">
          <TextSearch className="text-blue-700 dark:text-blue-300" size={27} />
          <h2 className="mt-3 font-heading text-lg font-medium">{L("문서를 다시 선택해 주세요.", "Choose the documents again.")}</h2>
          <p className="mt-2 mb-4 max-w-lg text-sm leading-relaxed text-muted-foreground">{L("페이지를 새로고침했거나 탭을 다시 연 경우, 문서 보호를 위해 이전 비교 내용은 남아 있지 않습니다.", "After a reload or reopened tab, the previous comparison is discarded to protect your documents.")}</p>
          <Button render={<Link to={localizedBasePath} />} variant="secondary" className="rounded-xl font-bold"><ArrowLeft size={15} /> {L(`${toolLabel}로 돌아가기`, `Back to ${toolLabel}`)}</Button>
        </Card>
      </UtilityPage>
    );
  }

  const previous = results.find((item) => item.pairNumber === pairNumber - 1);
  const next = results.find((item) => item.pairNumber === pairNumber + 1);
  const changedPages = areaPages.filter((item) => item.kind !== "unchanged").length;

  return (
    <UtilityPage toolId="document-compare-result">
      <div className="mb-4"><Button render={<Link to={localizedBasePath} data-testid="document-result-back" />} variant="ghost" className="rounded-xl px-0 font-bold text-blue-700 hover:bg-blue-500/10 hover:text-blue-800 dark:text-blue-300"><ArrowLeft size={16} /> {L("전체 비교 결과", "All comparison results")}</Button></div>
      <PageHeader
        eyebrow={`PAIR ${pair.pairNumber} OF ${results.length}`}
        title={L(`${pair.pairNumber}번 문서 비교`, `Document comparison ${pair.pairNumber}`)}
        description={L(`${pair.result.beforeName}과 ${pair.result.afterName}의 변경 내용입니다.`, `Changes between ${pair.result.beforeName} and ${pair.result.afterName}.`)}
      >
        {pair.reportUrl && <Button render={<a href={pair.reportUrl} download={pair.reportFileName} data-testid="document-result-excel-download" />} variant="secondary" className="rounded-xl font-bold"><Download size={15} /> {L("Excel 보고서", "Excel report")}</Button>}
        {pair.reportUrl && <FileShareButton url={pair.reportUrl} fileName={pair.reportFileName || (language === "en" ? "worklazy-comparison-report.xlsx" : "worklazy-비교보고서.xlsx")} />}
        {pair.trackedUrl && trackedLabel && <Button render={<a href={pair.trackedUrl} download={pair.trackedFileName} data-testid="document-result-tracked-download" />} variant="secondary" className="rounded-xl font-bold"><Download size={15} /> {trackedLabel}</Button>}
        {pair.trackedUrl && trackedLabel && <FileShareButton url={pair.trackedUrl} fileName={pair.trackedFileName || (language === "en" ? "worklazy-tracked-changes.docx" : "worklazy-변경추적.docx")} />}
      </PageHeader>
      <PrivacyBanner compact />

      <Card as="section" className="mt-3 gap-0 overflow-visible rounded-4xl border border-border p-5 shadow-md" data-testid="document-result-view">
        <ComparisonSummary result={pair.result} />
        <div className="flex items-center justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch [&_[data-ui-component=segmented-control]]:min-w-[380px] max-[720px]:[&_[data-ui-component=segmented-control]]:min-w-0 max-[720px]:[&_[data-ui-component=segmented-control]_button]:min-w-0 max-[720px]:[&_[data-ui-component=segmented-control]_button]:whitespace-normal max-[720px]:[&_[data-ui-component=segmented-control]_button]:px-2 max-[720px]:[&_[data-ui-component=segmented-control]_button]:leading-tight" data-testid="document-result-toolbar">
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
          <div className="flex items-center gap-3 max-[720px]:justify-between">
            {resultTab === "document" && <ContentToggle checked={showFullContent} onChange={setShowFullContent} />}
            <small className="whitespace-nowrap text-xs text-muted-foreground">{L(`${visiblePages.length}개 표시 · ${changedPages}개 변경`, `${visiblePages.length} shown · ${changedPages} changed`)}</small>
          </div>
        </div>

        <DiffLegend showComments={showCommentLegend} />
        <DocumentPageComparison
          beforeName={pair.result.beforeName}
          afterName={pair.result.afterName}
          items={visiblePages}
          tables={pair.result.tables}
        />

        {pair.result.warnings.map((warning) => <UtilityNotice className="mt-3" key={warning}><Info className="mt-0.5 shrink-0" size={14} /> {warning}</UtilityNotice>)}
      </Card>

      <nav className="mt-3.5 flex items-center justify-between" aria-label={L("다른 문서 쌍 비교 결과", "Other document-pair results")}>
        {previous ? <Button render={<Link to={`${localizedBasePath}/results/${previous.pairNumber}`} />} variant="secondary" className="rounded-xl font-bold text-blue-700 dark:text-blue-300"><ArrowLeft size={15} /> {L(`${previous.pairNumber}번 비교`, `Comparison ${previous.pairNumber}`)}</Button> : <span />}
        {next && <Button render={<Link to={`${localizedBasePath}/results/${next.pairNumber}`} />} variant="secondary" className="rounded-xl font-bold text-blue-700 dark:text-blue-300">{L(`${next.pairNumber}번 비교`, `Comparison ${next.pairNumber}`)} <ArrowRight size={15} /></Button>}
      </nav>
      {footer}
    </UtilityPage>
  );
}

function ComparisonSummary({ result }: { result: WordCompareResult }) {
  const language = useAppLanguage();
  const items = [
    { id: "added", label: language === "en" ? "Added" : "추가", value: result.summary.added, tone: "text-green-700 dark:text-green-300" },
    { id: "deleted", label: language === "en" ? "Deleted" : "삭제", value: result.summary.deleted, tone: "text-red-700 dark:text-red-300" },
    { id: "changed", label: language === "en" ? "Content changed" : "내용 변경", value: result.summary.changed, tone: "text-blue-700 dark:text-blue-300" },
    { id: "format", label: language === "en" ? "Formatting changed" : "서식 변경", value: result.summary.format, tone: "text-violet-700 dark:text-violet-300" },
    ...(result.summary.moved ? [{ id: "moved", label: language === "en" ? "Moved" : "이동", value: result.summary.moved, tone: "text-teal-700 dark:text-teal-300" }] : []),
  ];
  return <div className="mb-4 grid grid-cols-5 gap-2 max-[720px]:grid-cols-2" data-testid="document-result-summary">{items.map((item) => <div className="flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-muted" data-summary-kind={item.id} key={item.label}><strong className={cn("text-[22px] tracking-[-.04em]", item.tone)}>{item.value}</strong><span className="mt-1 text-[13px] font-bold text-muted-foreground">{item.label}</span></div>)}</div>;
}

function DiffLegend({ showComments }: { showComments: boolean }) {
  const language = useAppLanguage();
  return (
    <div className="mt-3 flex items-center justify-end gap-3.5 overflow-x-auto text-xs text-muted-foreground max-[720px]:justify-start" aria-label={language === "en" ? "Change legend" : "변경 표시 안내"}>
      <span className="inline-flex items-center"><i className="rounded-md bg-blue-500/10 px-1.5 py-1 text-blue-800 line-through not-italic dark:text-blue-300">{language === "en" ? "Deleted content" : "삭제된 내용"}</i></span>
      <span className="inline-flex items-center"><i className="rounded-md bg-red-500/10 px-1.5 py-1 font-extrabold text-red-700 not-italic dark:text-red-300">{language === "en" ? "Added content" : "추가된 내용"}</i></span>
      <span className="inline-flex items-center"><i className="rounded-md bg-violet-500/10 px-1.5 py-1 text-violet-700 not-italic dark:text-violet-300">{language === "en" ? "Formatting changed" : "서식 변경"}</i></span>
      {showComments && <span className="inline-flex items-center"><i className="rounded-md bg-amber-500/10 px-1.5 py-1 font-bold text-amber-800 not-italic dark:text-amber-300">{language === "en" ? "Comment changed" : "메모 변경"}</i></span>}
    </div>
  );
}

function ContentToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const language = useAppLanguage();
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted py-1 pr-1.5 pl-2.5">
      <strong className="whitespace-nowrap text-[13px]">{language === "en" ? "Show all content" : "내용 전체"}</strong>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onChange}
        aria-label={language === "en" ? "Show all content" : "내용 전체"}
        nativeButton
        render={<button type="button" />}
      />
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
  const changedIndexes = useMemo(() => items.flatMap((item, index) => item.kind === "unchanged" ? [] : [index]), [items]);
  const [currentChange, setCurrentChange] = useState(-1);
  useEffect(() => setCurrentChange(-1), [items]);
  const goToChange = (direction: -1 | 1) => {
    if (!changedIndexes.length) return;
    const nextPosition = currentChange < 0 ? (direction > 0 ? 0 : changedIndexes.length - 1) : Math.max(0, Math.min(changedIndexes.length - 1, currentChange + direction));
    setCurrentChange(nextPosition);
    document.getElementById(`comparison-change-${changedIndexes[nextPosition]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  if (!items.length) return <div className="mt-3 grid min-h-32 place-items-center content-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground" data-testid="document-empty-result"><TextSearch size={22} /><strong className="text-sm">{language === "en" ? "There is no content to compare in this area." : "이 영역에는 비교할 내용이 없습니다."}</strong></div>;

  return (
    <div className="mt-2.5 overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-slate-200 dark:bg-slate-800" data-testid="document-page-scroll">
      {!!changedIndexes.length && <nav className="sticky top-2 z-[4] mx-auto mb-2.5 flex w-max max-w-[calc(100%-20px)] items-center gap-2 rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-xl" aria-label={language === "en" ? "Navigate changes" : "변경 내용 이동"}><Button variant="secondary" className="rounded-xl" type="button" onClick={() => goToChange(-1)} disabled={currentChange === 0}><ArrowLeft size={14} /> {language === "en" ? "Previous change" : "이전 변경"}</Button><span className="min-w-14 text-center font-bold text-muted-foreground">{currentChange < 0 ? `– / ${changedIndexes.length}` : `${currentChange + 1} / ${changedIndexes.length}`}</span><Button variant="secondary" className="rounded-xl" type="button" onClick={() => goToChange(1)} disabled={currentChange === changedIndexes.length - 1}>{language === "en" ? "Next change" : "다음 변경"} <ArrowRight size={14} /></Button></nav>}
      <div className="grid min-w-[940px] grid-cols-2 gap-x-[22px] p-5 text-[#1d1d1f]" role="table" data-testid="document-page-view" aria-label={language === "en" ? "Full before-and-after document comparison" : "수정 전후 문서 전체 비교"}>
        <div className="sticky top-0 z-[3] flex min-w-0 items-center gap-2 rounded-t-lg border border-b-0 border-[#d5d5da] bg-white/[.97] px-9 py-3 shadow-[0_-3px_14px_rgba(35,38,45,.08)]" role="columnheader" data-document-side="before"><span className="shrink-0 rounded-md bg-[#efeff2] px-1.5 py-1 text-xs font-extrabold text-[#606066]">{language === "en" ? "Before" : "수정 전"}</span><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">{beforeName}</strong></div>
        <div className="sticky top-0 z-[3] flex min-w-0 items-center gap-2 rounded-t-lg border border-b-0 border-[#d5d5da] bg-white/[.97] px-9 py-3 shadow-[0_-3px_14px_rgba(35,38,45,.08)]" role="columnheader" data-document-side="after"><span className="shrink-0 rounded-md bg-[#efeff2] px-1.5 py-1 text-xs font-extrabold text-[#606066]">{language === "en" ? "After" : "수정 후"}</span><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">{afterName}</strong></div>
        {items.map((item, index) => {
          const table = item.blockType === "table" && item.tableIndex !== undefined
            ? tables.find((candidate) => candidate.index === item.tableIndex)
            : undefined;
          return (
          <div id={item.kind === "unchanged" ? undefined : `comparison-change-${index}`} className="col-span-full grid grid-cols-2 gap-x-[22px]" data-document-kind={item.kind} data-table-block={Boolean(table) || undefined} role="row" key={`${item.section}-${item.beforeLocation}-${item.afterLocation}-${index}`}>
            <DocumentBlock item={item} side="before" table={table} first={index === 0} last={index === items.length - 1} />
            <DocumentBlock item={item} side="after" table={table} first={index === 0} last={index === items.length - 1} />
          </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentBlock({ item, side, table, first, last }: {
  item: WordDocumentViewItem;
  side: "before" | "after";
  table?: WordTableComparison;
  first: boolean;
  last: boolean;
}) {
  const language = useAppLanguage();
  const location = side === "before" ? item.beforeLocation : item.afterLocation;
  const text = side === "before" ? item.before : item.after;
  if (table) {
    const tableMissing = side === "before" ? table.beforeIndex === null : table.afterIndex === null;
    return (
      <article className={documentBlockClasses(item, side, tableMissing, first, last, true)} data-document-side={side} data-document-kind={item.kind} data-missing={tableMissing || undefined} role="cell">
        <div className={documentMetadataClasses(item)} data-testid="document-block-meta">
          <small className="sr-only">{location || (side === "before" ? (language === "en" ? "Not in before" : "수정 전에는 없음") : (language === "en" ? "Not in after" : "수정 후에는 없음"))}</small>
          {(item.kind !== "unchanged" || item.moved) && <span className="rounded-md bg-[#f0f0f3]/90 px-1.5 py-1 text-xs font-extrabold text-[#57575e]">{changeKindLabel(item.kind, language)}{item.moved && item.kind !== "moved" ? ` · ${language === "en" ? "Moved" : "이동"}` : ""}</span>}
        </div>
        <DocumentTable table={table} side={side} />
      </article>
    );
  }
  const isMissing = !location && !text;
  const isChangedSide = (side === "before" && (item.kind === "deleted" || item.kind === "changed"))
    || (side === "after" && (item.kind === "added" || item.kind === "changed"));

  return (
    <article className={documentBlockClasses(item, side, isMissing, first, last, false)} data-document-side={side} data-document-kind={item.kind} data-document-section={item.section} data-missing={isMissing || undefined} role="cell">
      <div className={documentMetadataClasses(item)} data-testid="document-block-meta">
        <small className="sr-only">{location || (side === "before" ? (language === "en" ? "Not in before" : "수정 전에는 없음") : (language === "en" ? "Not in after" : "수정 후에는 없음"))}</small>
        {(item.kind !== "unchanged" || item.moved) && <span className="rounded-md bg-[#f0f0f3]/90 px-1.5 py-1 text-xs font-extrabold text-[#57575e]">{changeKindLabel(item.kind, language)}{item.moved && item.kind !== "moved" ? ` · ${language === "en" ? "Moved" : "이동"}` : ""}</span>}
      </div>
      {isMissing
        ? <p className="m-0 text-center font-sans text-[13px] text-[#99999f]">{item.kind === "added" ? (language === "en" ? "Added item" : "추가된 항목") : (language === "en" ? "Deleted item" : "삭제된 항목")}</p>
        : <p className={documentParagraphClasses(item.kind)}>
          {isChangedSide || item.kind === "added" || item.kind === "deleted"
            ? <SideDiffText segments={item.segments} side={side} fallback={text} />
            : text || "\u00a0"}
        </p>}
      <InlineComments comments={item.comments ?? []} side={side} />
    </article>
  );
}

function documentBlockClasses(item: WordDocumentViewItem, side: "before" | "after", missing: boolean, first: boolean, last: boolean, table: boolean) {
  const changedBefore = side === "before" && (item.kind === "changed" || item.kind === "deleted");
  const changedAfter = side === "after" && (item.kind === "changed" || item.kind === "added");
  return cn(
    "relative min-h-0 min-w-0 border-x border-[#dddde1] bg-white px-9 py-px",
    first && "pt-7",
    last && "min-h-20 rounded-b-lg border-b pb-12 shadow-[0_9px_15px_rgba(35,38,45,.08)]",
    table && "py-2",
    missing && "flex flex-col justify-center bg-[repeating-linear-gradient(-45deg,#fafafa,#fafafa_9px,#f6f6f8_9px,#f6f6f8_18px)]",
    changedBefore && "shadow-[inset_3px_0_#0000ff]",
    changedAfter && "shadow-[inset_3px_0_#ff2d2d]",
    item.kind === "format" && "shadow-[inset_3px_0_#7c3aed]",
    item.kind === "comment" && "shadow-[inset_3px_0_#ff9f0a]",
    item.kind === "moved" && "shadow-[inset_3px_0_#0f8b8d]",
  );
}

function documentMetadataClasses(item: WordDocumentViewItem) {
  return cn(
    "pointer-events-none absolute top-1.5 right-2 z-[2] flex justify-end",
    item.kind === "unchanged" && !item.moved && "hidden",
  );
}

function documentParagraphClasses(kind: WordDocumentViewItem["kind"]) {
  return cn(
    "m-0 whitespace-pre-wrap break-anywhere font-serif text-[15px] leading-relaxed text-justify",
    kind === "format" && "rounded-md bg-violet-500/10 px-1.5 py-1",
  );
}

function documentTableCellClasses(kind?: WordDocumentViewItem["kind"]) {
  return cn(
    kind === "added" && "!bg-red-500/[.055]",
    kind === "deleted" && "!bg-blue-500/[.045]",
    kind === "changed" && "!bg-blue-500/[.055]",
    kind === "format" && "!bg-violet-500/[.07]",
  );
}

function documentFormatHighlightClasses(kind?: WordDocumentViewItem["kind"]) {
  return kind === "format" ? "rounded-md bg-violet-500/10 px-1.5 py-1" : undefined;
}

function inlineCommentClasses(kind: WordCommentViewItem["kind"]) {
  return cn(
    "rounded-lg border border-amber-300 bg-amber-50 p-2.5",
    kind === "changed" && "border-l-[3px] border-l-amber-500",
    kind === "deleted" && "border-l-[3px] border-l-blue-700",
    kind === "added" && "border-l-[3px] border-l-red-600",
  );
}

function DocumentTable({ table, side }: { table: WordTableComparison; side: "before" | "after" }) {
  const language = useAppLanguage();
  const grid = side === "before" ? table.before : table.after;
  const kinds = side === "before" ? table.beforeKinds : table.afterKinds;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse font-serif text-sm leading-relaxed [&_td]:h-9 [&_td]:min-w-12 [&_td]:border [&_td]:border-[#77777d] [&_td]:bg-white [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:whitespace-pre-wrap [&_td]:break-anywhere" data-testid="document-table" aria-label={language === "en" ? `${side === "before" ? "Before" : "After"} table ${table.index + 1}` : `${side === "before" ? "수정 전" : "수정 후"} 표 ${table.index + 1}`}>
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
  if (!cell) return <td className="!border-[#d5d5da] !bg-[repeating-linear-gradient(-45deg,#fafafa,#fafafa_7px,#f2f2f5_7px,#f2f2f5_14px)]" aria-hidden="true" />;
  const changed = kind && kind !== "unchanged";
  return (
    <td className={documentTableCellClasses(kind)} data-document-kind={kind}>
      <span className={documentFormatHighlightClasses(kind)}>
        {changed
          ? <SideDiffText segments={cell.segments} side={side} fallback={cell.text} />
          : cell.text || "\u00a0"}
      </span>
      {cell.comments.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {cell.comments.map((comment, index) => (
            <span className="flex items-start gap-1 rounded bg-amber-100 px-1.5 py-1 font-sans text-xs text-amber-900 [&_svg]:mt-px [&_svg]:shrink-0" key={`${comment.id}-${index}`}><MessageSquare size={9} />{comment.author && <strong className="after:content-['_·_']">{comment.author}</strong>}{comment.text}</span>
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
    <div className="mt-3 flex flex-col gap-1.5 border-t border-dashed border-amber-300 pt-2.5">
      {visibleComments.map((comment, index) => {
        const author = side === "before" ? comment.beforeAuthor : comment.afterAuthor;
        const commentId = side === "before" ? comment.beforeId : comment.afterId;
        const text = side === "before" ? comment.before : comment.after;
        return (
          <aside className={inlineCommentClasses(comment.kind)} data-comment-kind={comment.kind} key={`${commentId}-${index}`}>
            <div className="flex items-center gap-1.5 text-amber-800 [&_svg]:shrink-0"><MessageSquare size={11} /><strong className="text-xs">{language === "en" ? "Comment" : "메모"}{author ? ` · ${author}` : ""}</strong></div>
            <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-amber-950"><SideDiffText segments={comment.segments} side={side} fallback={text} /></p>
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
  const changeType = side === "before" ? "deleted" : "added";
  const visible = mergeSideSegments(segments.filter((segment) => segment.type === "equal" || segment.type === changeType), changeType);
  if (!visible.length) return <>{fallback}</>;
  return <>{visible.map((segment, index) => {
    if (segment.type === "deleted") return <span className="bg-blue-500/10 text-blue-800 line-through decoration-[1.5px]" data-diff-kind="deleted" key={`${segment.type}-${index}`}>{segment.text}</span>;
    if (segment.type === "added") return <span className="bg-red-500/10 font-extrabold text-red-700" data-diff-kind="added" key={`${segment.type}-${index}`}>{segment.text}</span>;
    return <span key={`${segment.type}-${index}`}>{segment.text}</span>;
  })}</>;
}

function mergeSideSegments(segments: WordDiffSegment[], changeType: "added" | "deleted") {
  const merged: WordDiffSegment[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];
    const previous = merged.at(-1);
    if (segment.type === "equal" && /^\s+$/u.test(segment.text) && previous?.type === changeType && next?.type === changeType) {
      previous.text += segment.text + next.text;
      index += 1;
      continue;
    }
    if (previous?.type === segment.type) previous.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}

function changeKindLabel(kind: WordDocumentViewItem["kind"], language: "ko" | "en") {
  if (language === "en") return kind === "added" ? "Added" : kind === "deleted" ? "Deleted" : kind === "format" ? "Formatting changed" : kind === "comment" ? "Comment changed" : kind === "changed" ? "Content changed" : kind === "moved" ? "Moved" : "Unchanged";
  return kind === "added" ? "추가" : kind === "deleted" ? "삭제" : kind === "format" ? "서식 변경" : kind === "comment" ? "메모 변경" : kind === "changed" ? "내용 변경" : kind === "moved" ? "이동" : "변경 없음";
}
