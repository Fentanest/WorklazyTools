import {buildNoteProjection,bindNoteDecisions,type NoteFacts} from "./noteProjection.ts";
import {buildStoryProjection,bindStoryDecisions,emptyStoryBindingChanges,type StoryFacts} from "./storyProjection.ts";
import type { DocumentCapabilities, DocumentProvenance } from "./documentCapabilities.ts";
import { normalizeFormattingMask, formattingGroup, maskPolicyVersion, maskedSourceFormatting, type FormattingMask } from "./formattingMask.ts";
import type {
  WordCellComment,
  WordCompareResult,
  WordDiffItem,
  WordDiffSegment,
  WordDocumentViewItem,
  WordRecordKind,
  WordTableAxisPair,
  WordTableCell,
  WordTableComparison,
  WordViewKind,
} from "../excel-merger/types";
import { alignDocumentSequence, alignSequence, type SequenceGroup, type SequencePair } from "./documentAlignment.ts";

import { buildMergeProjections } from "./mergeProjection.ts";
import { buildObjectEventContexts, eventPosition } from "./objectEventContext.ts";
import { buildDrawingRestoreProjections } from "./drawingRestoreProjection.ts";
import { buildRestoreStyleProjections } from "./restoreStyleProjection.ts";
import { buildWordFormatting, projectWordFormatting, type ManifestFormattingView } from "./wordFormatting.ts";
import { completeManifestCoverage, freezeComparisonManifest } from "./comparisonManifest.ts";
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, ManifestRecord } from "./comparisonManifest.ts";

export interface ComparisonRecord {
  nativeSource?: {format:"doc"|"hwp";story:string;paragraph:number;section?:number;control?:number};
  commentId?: string;
  source?: DocumentSourceReference;
  rawText?: string;
  paragraphs?: ManifestRecord[];
  text: string;
  format: string;
  formatRuns?: Array<{ text: string; style: string }>;
  location: string;
  comments?: WordCellComment[];
}

export interface ComparisonTable {
  location: string;
  grid: WordTableCell[][];
  sourceIndex?: number;
}

export interface ComparisonBlock {
  nativeSource?: ComparisonRecord["nativeSource"];
  source?: DocumentSourceReference;
  rawText?: string;
  type: "paragraph" | "table";
  text: string;
  format: string;
  formatRuns?: Array<{ text: string; style: string }>;
  location: string;
  comments?: WordCellComment[];
  table?: ComparisonTable;
}

export interface ComparisonModel {
  storyFacts?:StoryFacts;
  noteFacts?:NoteFacts;
  capabilities?: DocumentCapabilities;
  provenance?: DocumentProvenance;
  fields?: Array<{kind:string; instruction:string; cachedText:string; sources:DocumentSourceReference[]}>;
  sourceRevision?: string;
  sourceInventory?: DocumentSourceReference[];
  blocks: ComparisonBlock[];
  headerFooter: ComparisonRecord[];
  notes: ComparisonRecord[];
  comments?: ComparisonRecord[];
  warnings: string[];
}

export interface ComparisonOptions {
  requestedFormattingMask?: Partial<FormattingMask>;
  formattingMask?: Partial<FormattingMask>;
  formatting: boolean;
  tables: boolean;
  metadata: boolean;
}

interface ComparisonLanguage {
  emptyCell: (row: number, column: number) => string;
  table: (index: number) => string;
}

export function compareDocumentModels(
  beforeName: string,
  afterName: string,
  before: ComparisonModel,
  after: ComparisonModel,
  options: ComparisonOptions,
  language: "ko" | "en",
): WordCompareResult & { manifest: DocumentComparisonManifest } {
  const requested = normalizeFormattingMask(options.formattingMask);
  if ((!before.sourceInventory || !after.sourceInventory) && Object.values(requested).some(enabled => !enabled)) throw new Error(language === "en" ? "Detailed formatting groups require two DOCX files." : "세부 서식 선택은 두 파일 모두 DOCX일 때 사용할 수 있습니다.");
  const effective = Object.fromEntries(Object.entries(requested).map(([group, enabled]) => [group, options.formatting && enabled])) as FormattingMask;
  const rawBefore = before, rawAfter = after;
  before = scopedComparisonModel(before, options);
  after = scopedComparisonModel(after, options);
  const labels: ComparisonLanguage = language === "en"
    ? { emptyCell: (row, column) => `Empty cell ${row}:${column}`, table: (index) => `Table ${index}` }
    : { emptyCell: (row, column) => `빈 셀 ${row}:${column}`, table: (index) => `표 ${index}` };
  const manifest: DocumentComparisonManifest = {
    noteFacts:{before:before.noteFacts,after:after.noteFacts},noteProjection:{policy:"worklazy-note-projection-1",supported:true,reasons:[],pairs:[],references:[]},
    storyFacts:{before:before.storyFacts,after:after.storyFacts},storyProjection:{policy:"worklazy-story-projection-1",supported:true,reasons:[],pairs:[],bindings:[]},
    nativeSources: {before:before.blocks.flatMap(block=>block.nativeSource?[block.nativeSource]:[]),after:after.blocks.flatMap(block=>block.nativeSource?[block.nativeSource]:[])},
    capabilities: {before:before.capabilities,after:after.capabilities}, provenance: {before:before.provenance,after:after.provenance}, fields:{before:before.fields ?? [],after:after.fields ?? []},
    version: 1, decisions: [], policyVersion: "worklazy-document-1",
    inputRevision: { before: before.sourceRevision, after: after.sourceRevision },
    options: { formatting: options.formatting, tables: options.tables, metadata: options.metadata },
    preservation: { comments: "preserve-after-existing-contract", existingRevisions: "preserve-after-history" },
    formattingMask: {version: maskPolicyVersion, requested, effective, inactiveRequested: options.requestedFormattingMask ? normalizeFormattingMask(options.requestedFormattingMask) : undefined},
    formattingPolicyVersion: "worklazy-formatting-1", formattingScopes: [], restoreStylePolicyVersion: "worklazy-restore-style-1", restorePropertyPairs: [], propertyExclusions: [], propertyActions: [], formattingExcluded: [],
    coverage: { before: [], after: [] },
    sources: { before: before.sourceInventory ?? [], after: after.sourceInventory ?? [] },
    exclusions: {
      formatting: options.formatting ? "compare" : "preserve-after",
      tables: options.tables ? [] : [...before.sourceInventory ?? [], ...after.sourceInventory ?? []].filter((source) => source.kind === "tbl"),
      metadata: options.metadata ? [] : [...rawBefore.headerFooter, ...rawAfter.headerFooter, ...rawBefore.notes, ...rawAfter.notes, ...rawBefore.comments ?? [], ...rawAfter.comments ?? []].flatMap((record) => record.source ? [record.source] : []),
    },
  };
  const changes: WordDiffItem[] = [];
  const tables: WordTableComparison[] = [];
  const documentViews: ManifestFormattingView[] = [];
  const blockGroups = alignDocumentSequence(before.blocks, after.blocks, {
    textOf: (item) => item.text,
    compatible: (left, right) => left.type === right.type,
    canGroup: (item) => item.type === "paragraph",
    include: (item) => item.type === "table" ? options.tables : Boolean(item.text.trim()) || Boolean(item.comments?.length) || Boolean(item.source?.opaqueSignature),
  });

  for (const [groupIndex, group] of blockGroups.entries()) {
    const leftBlocks = group.beforeIndexes.map((index) => before.blocks[index]);
    const rightBlocks = group.afterIndexes.map((index) => after.blocks[index]);
    const left = leftBlocks[0];
    const right = rightBlocks[0];
    if (left?.type === "table" || right?.type === "table") {
      const table = compareTable(left?.table, right?.table, tables.length, changes, options.formatting, labels);
      tables.push(table);
      const decision = decisionOf(leftBlocks, rightBlocks, group.moved, "table", `body:${groupIndex}`);
      decision.rows = table.rowPairs;
      decision.columns = table.columnPairs;
      decision.children = [];
      for (const row of table.rowPairs) for (const column of table.columnPairs) {
        const a = row.beforeIndex === null || column.beforeIndex === null ? undefined : left?.table?.grid[row.beforeIndex]?.[column.beforeIndex] as (WordTableCell & ManifestRecord) | undefined;
        const b = row.afterIndex === null || column.afterIndex === null ? undefined : right?.table?.grid[row.afterIndex]?.[column.afterIndex] as (WordTableCell & ManifestRecord) | undefined;
        decision.children.push(...paragraphDecisions(a?.paragraphs ?? [], b?.paragraphs ?? [], `${decision.id}:cell:${row.beforeIndex}:${row.afterIndex}:${column.beforeIndex}:${column.afterIndex}`));
      }
      manifest.decisions.push(decision);
      const baseTableKind = tableViewKind(table);
      documentViews.push({
        comparisonDecisionId: decision.id,
        kind: group.moved && baseTableKind === "unchanged" ? "moved" : baseTableKind,
        section: "table",
        blockType: "table",
        tableIndex: table.index,
        beforeLocation: left?.location ?? "",
        afterLocation: right?.location ?? "",
        before: left?.text ?? "",
        after: right?.text ?? "",
        segments: decision.segments,
        comments: [],
        moved: group.moved,
      });
      continue;
    }
    const decision = decisionOf(leftBlocks, rightBlocks, group.moved, "paragraph", `body:${groupIndex}`);
    manifest.decisions.push(decision);
    documentViews.push(compareRecord(
      combineRecords(leftBlocks),
      combineRecords(rightBlocks),
      "body",
      changes,
      options.formatting,
      group,
      decision,
    ));
  }

  manifest.storyProjection=buildStoryProjection(manifest);
  const headerFooter:ManifestFormattingView[]=[];
  if(before.storyFacts&&after.storyFacts){
    for(const pair of manifest.storyProjection.pairs){const start=manifest.decisions.length;
      headerFooter.push(...compareRecordList(before.headerFooter.filter(record=>record.source?.part===pair.beforePart),after.headerFooter.filter(record=>record.source?.part===pair.afterPart),"headerFooter",changes,options.formatting,manifest));
      bindStoryDecisions(manifest,pair,manifest.decisions.slice(start));
    }
  }else headerFooter.push(...compareRecordList(before.headerFooter,after.headerFooter,"headerFooter",changes,options.formatting,manifest));
  for(const view of emptyStoryBindingChanges(manifest,language)){headerFooter.push(view);changes.push({kind:view.kind,section:'headerFooter',location:view.afterLocation||view.beforeLocation,beforeLocation:view.beforeLocation,afterLocation:view.afterLocation,before:view.before,after:view.after,segments:view.segments});}
  manifest.noteProjection=buildNoteProjection(manifest);
  const note:ManifestFormattingView[]=[];
  if(before.noteFacts&&after.noteFacts){for(const pair of manifest.noteProjection.pairs){const start=manifest.decisions.length;
    const records=(side:'before'|'after')=>(side==='before'?before:after).notes.filter(record=>pair[side]&&record.source?.part===pair[side]!.source.part&&pair[side]!.source.path.every((value,index)=>record.source!.path[index]===value));
    note.push(...compareRecordList(records('before'),records('after'),'note',changes,options.formatting,manifest));bindNoteDecisions(manifest,pair,manifest.decisions.slice(start));
  }}else note.push(...compareRecordList(before.notes,after.notes,'note',changes,options.formatting,manifest));
  const commentChanges: WordDiffItem[] = [];
  const commentViews = compareRecordList(before.comments ?? [], after.comments ?? [], "comment", commentChanges, options.formatting, manifest);
  changes.push(...commentChanges);
  const objectDecisions = (items:ComparisonDecision[]) => { for(const decision of items) {
    objectDecisions(decision.children ?? []);
    if(decision.type!=="paragraph" || decision.trackedRepresentation!=="revision")continue;
    const events=(side:"before"|"after")=>decision[side].flatMap(parent=>manifest.sources[side].filter(source=>source.objectEvent && source.part===parent.part && JSON.stringify(source.objectEvent.paragraphPath)===JSON.stringify(parent.path)));
    const before=events("before"),after=events("after");
    const runFact=(side:"before"|"after",event:DocumentSourceReference)=>manifest.sources[side].find(source=>source.part===event.part && JSON.stringify(source.path)===JSON.stringify(event.objectEvent!.runPath))?.normalizedProperties?.rPr??{supported:{},unsupported:{},history:false};
    const contexts=buildObjectEventContexts(manifest,decision,before,after);
    const positions={before:new Map(before.map(ref=>[ref,[eventPosition(decision,contexts,"before",ref),eventPosition(decision,contexts,"before",ref,true)]])),after:new Map(after.map(ref=>[ref,[eventPosition(decision,contexts,"after",ref),eventPosition(decision,contexts,"after",ref,true)]]))};
    const position=(side:"before"|"after",ref:DocumentSourceReference,end=false)=>positions[side].get(ref)![end?1:0];
    // Pair drawing events only at the TS text mapping's same boundary, in source
    // order. Identity is the actual source reference, never a volatile rId.
    const available=after.filter(source=>(source.objectEvent!.kind==="drawing"||options.metadata&&source.objectEvent!.kind==="note"));
    const drawingProperties=before.filter(source=>(source.objectEvent!.kind==="drawing"||options.metadata&&source.objectEvent!.kind==="note")).flatMap(a=>{
      const index=available.findIndex(b=>a.objectEvent!.kind===b.objectEvent!.kind && (a.objectEvent!.kind!=="note"||a.objectEvent!.signature===b.objectEvent!.signature) && position("before",a)===position("after",b));
      if(index<0)return [];
      const b=available.splice(index,1)[0],old=runFact("before",a),next=runFact("after",b);
      const names=[...new Set([...Object.keys(old.supported),...Object.keys(next.supported)])].filter(name=>JSON.stringify(old.supported[name]??[])!==JSON.stringify(next.supported[name]??[]));
      return [{representation:next.history?"preserve-after-history" as const:"revision" as const,before:a,after:b,beforeFact:old,afterFact:next,families:names.filter(name=>manifest.formattingMask.effective[formattingGroup("rPr",name)]),excludedFamilies:[...new Set([...Object.keys(old.unsupported),...Object.keys(next.unsupported)])].filter(name=>JSON.stringify(old.unsupported[name]??[])!==JSON.stringify(next.unsupported[name]??[])).concat(names.filter(name=>!manifest.formattingMask.effective[formattingGroup("rPr",name)]))}];
    });
    const propertiesSupported=true;
    const unchangedLinks=before.filter(a=>a.objectEvent!.kind==="hyperlink").flatMap(a=>after.filter(b=>b.objectEvent!.kind==="hyperlink" && a.objectEvent!.signature===b.objectEvent!.signature && position("before",a)===position("after",b) && position("before",a,true)===position("after",b,true)).map(b=>({before:a,after:b})));
    if(before.length || after.length)decision.objectEvents={unchangedDrawings:drawingProperties.filter(pair=>pair.before.objectEvent!.signature===pair.after.objectEvent!.signature && (!pair.families.length || pair.representation==="preserve-after-history")).map(pair=>({before:pair.before,after:pair.after})),contexts,deletedDrawingStyles:[],drawingProperties,unchangedLinks,propertiesSupported,policy:"worklazy-source-events-5",before,after,changed:JSON.stringify(before.filter(source=>options.metadata||source.objectEvent!.kind!=="note").map(source=>[source.objectEvent!.kind,position("before",source),position("before",source,true),source.objectEvent!.signature]))!==JSON.stringify(after.filter(source=>options.metadata||source.objectEvent!.kind!=="note").map(source=>[source.objectEvent!.kind,position("after",source),position("after",source,true),source.objectEvent!.signature]))};
  }};
  objectDecisions(manifest.decisions);
  buildDrawingRestoreProjections(manifest);
  buildMergeProjections(manifest);
  buildRestoreStyleProjections(manifest);
  buildWordFormatting(manifest, diffCharacters);
  projectWordFormatting(manifest, documentViews, headerFooter, note, changes, tables, language);
  const objectViews=(items:ComparisonDecision[],parentView?:ManifestFormattingView)=>{for(const decision of items){
    const view=[...documentViews,...headerFooter,...note].find(view=>view.comparisonDecisionId===decision.id)??parentView;
    objectViews(decision.children??[],view);
    if(!decision.objectEvents?.changed || !view)continue;
    if(view.kind==="unchanged")view.kind="changed";
    const allEvents=[...decision.objectEvents.before,...decision.objectEvents.after];
    (view as ManifestFormattingView & {objectLabels?:string[]}).objectLabels=[...(allEvents.some(ref=>ref.objectEvent!.kind!=="note")?[language==="en"?"Image or hyperlink change":"이미지·하이퍼링크 변경"]:[]),...(options.metadata&&allEvents.some(ref=>ref.objectEvent!.kind==="note")?[language==="en"?"Footnote or endnote reference change":"각주·미주 참조 변경"]:[])];
    if(view.tableIndex!==undefined){
      const table=tables[view.tableIndex];table.kind="changed";
      for(const side of ["before","after"] as const)for(const [r,row] of table[side].entries())for(const [c,cell]of row.entries()){
        const source=(cell as unknown as {source?:DocumentSourceReference}).source;
        if(source && decision[side].some(ref=>ref.part===source.part && source.path.every((value,index)=>ref.path[index]===value)))table[side+"Kinds" as "beforeKinds"|"afterKinds"][r][c]="changed";
      }
    }
    if(!changes.some(change=>change.beforeLocation===view.beforeLocation && change.afterLocation===view.afterLocation && change.kind!=="format"))changes.push({kind:"changed",section:view.section,location:view.afterLocation||view.beforeLocation,beforeLocation:view.beforeLocation,afterLocation:view.afterLocation,before:view.before,after:view.after,segments:view.segments});
  }};
  objectViews(manifest.decisions);
  const objectFormattingHistory=(items:ComparisonDecision[]):boolean=>items.some(decision=>decision.objectEvents?.drawingProperties.some(pair=>pair.families.length && pair.representation==="preserve-after-history") || objectFormattingHistory(decision.children??[]));
  const unsupportedObjectFormatting=(items:ComparisonDecision[]):boolean=>items.some(decision=>decision.objectEvents?.propertiesSupported===false || unsupportedObjectFormatting(decision.children??[]));
  const summary: WordCompareResult["summary"] = { added: 0, deleted: 0, changed: 0, format: 0, unchanged: 0, moved: 0 };
  for (const change of changes) {
    if (change.kind === "moved") continue;
    summary[change.kind] += 1;
  }
  const visibleViews = [...documentViews, ...headerFooter, ...note];
  summary.unchanged = visibleViews.filter((view) => view.kind === "unchanged" || view.kind === "comment").length
    + commentViews.filter((view) => view.kind === "unchanged").length;
  summary.moved = visibleViews.filter((view) => view.moved || view.kind === "moved").length;

  completeManifestCoverage(manifest);
  return {
    beforeName,
    afterName,
    manifest: freezeComparisonManifest(manifest),
    summary,
    changes,
    tables,
    views: { document: documentViews, headerFooter, note },
    warnings: [...new Set([...before.warnings, ...after.warnings, ...(unsupportedObjectFormatting(manifest.decisions)?[language==="en"?"Some formatting attached to images could not be compared. Review the original files alongside the result.":"이미지에 연결된 서식 일부는 비교하지 못했습니다. 원본 파일을 함께 확인해 주세요."]:[]), ...(options.formatting && Object.values(requested).some(enabled=>!enabled) ? [language === "en" ? "Excluded formatting groups are kept from the revised file." : "비교에서 제외한 서식 항목은 수정본 기준으로 유지됩니다."] : []), ...(before.fields?.length || after.fields?.length ? [language === "en" ? "Word fields use their stored values. Page numbers, dates and tables of contents are not recalculated." : "Word 필드는 저장된 값을 비교하며 쪽 번호·날짜·목차를 다시 계산하지 않습니다."] : []), ...(manifest.formattingExcluded.length ? [language === "en" ? "Some advanced formatting is kept from the revised file and is not included in tracked formatting changes." : "일부 고급 서식은 수정본 기준으로 유지되며 변경 추적 서식 비교에 포함되지 않습니다."] : []), ...((manifest.formattingScopes.some((scope) => scope.families.length && scope.afterFact.history) || objectFormattingHistory(manifest.decisions)) ? [language === "en" ? "Some formatting keeps the revised file’s existing revision history." : "일부 서식은 수정본에 있는 기존 변경 기록을 유지합니다."] : [])])],
  };
}

// Extraction retains every source node. Scope filtering belongs to this shared
// decision builder, including paragraphs flattened from metadata tables.
function scopedMetadata(model: ComparisonModel, records: ComparisonRecord[], options: ComparisonOptions) {
  if (!options.metadata) return [];
  if (options.tables) return records;
  const tables = (model.sourceInventory ?? []).filter((source) => source.kind === "tbl");
  const included = (record: ManifestRecord) => !record.source || !tables.some((table) =>
    table.part === record.source!.part && table.path.every((index, depth) => record.source!.path[depth] === index));
  return records.filter(included).flatMap((record) => {
    if (!record.paragraphs?.length) return [record];
    const paragraphs = record.paragraphs.filter(included);
    if (paragraphs.length === record.paragraphs.length) return [record];
    if (!paragraphs.length) return [];
    const projected = combineRecords(paragraphs.map((item) => ({ ...item, format: (item as Partial<ComparisonRecord>).format ?? "", formatRuns: (item as Partial<ComparisonRecord>).formatRuns, location: record.location })))!;
    return [{ ...record, ...projected, paragraphs, rawText: paragraphs.map((item) => item.rawText ?? item.text).join("\n") }];
  });
}

function scopedComparisonModel(model: ComparisonModel, options: ComparisonOptions): ComparisonModel {
  const masked = Boolean(model.sourceInventory) && Object.values(normalizeFormattingMask(options.formattingMask)).some(enabled => !enabled);
  const comments = scopedMetadata(model, model.comments ?? [], options).map(record => masked ? {...record,format:maskedSourceFormatting(model.sourceInventory!,record.source,normalizeFormattingMask(options.formattingMask)),formatRuns:undefined} : record);
  const byId = new Map(comments.filter((record) => record.commentId !== undefined).map((record) => [record.commentId!, record]));
  const knownIds = new Set((model.comments ?? []).flatMap((record) => record.commentId === undefined ? [] : [record.commentId]));
  const attached = (items: WordCellComment[] = []) => !options.metadata ? [] : items.flatMap((comment) => {
    const projected = byId.get(comment.id);
    return projected ? [{ ...comment, text: projected.text }] : knownIds.has(comment.id) ? [] : [{ ...comment }];
  });
  const record = <T extends { comments?: WordCellComment[] }>(item: T): T => {
    const source=item as T & {rawText?:string;paragraphs?:ManifestRecord[]};
    const unnumbered = model.sourceInventory && !normalizeFormattingMask(options.formattingMask).numbering
      ? source.rawText ?? source.paragraphs?.map(paragraph=>paragraph.rawText ?? paragraph.text).join("\n") : undefined;
    return {...item,...(unnumbered !== undefined ? {text:unnumbered} : {}),...(masked ? {format:"",formatRuns:undefined} : {}),comments:attached(item.comments)};
  };
  return { ...model, comments,
    headerFooter: scopedMetadata(model, model.headerFooter, options).map(record),
    notes: scopedMetadata(model, model.notes, options).map(record),
    blocks: model.blocks.map((block) => ({ ...record(block), ...(block.table ? { table: { ...block.table, grid: block.table.grid.map((row) => row.map(record)) } } : {}) })),
  };
}

function compareRecordList(
  before: ComparisonRecord[],
  after: ComparisonRecord[],
  section: "headerFooter" | "note" | "comment",
  changes: WordDiffItem[],
  formatting: boolean,
  manifest: DocumentComparisonManifest,
) {
  const groups = alignDocumentSequence(before, after, { textOf: (item) => item.text, include:item=>Boolean(item.text.trim()) || Boolean(item.source?.opaqueSignature) || Boolean(item.paragraphs?.some(paragraph=>paragraph.source?.opaqueSignature)) });
  const decisions = groups.map((group, groupIndex) => {
    const left = group.beforeIndexes.map((index) => before[index]);
    const right = group.afterIndexes.map((index) => after[index]);
    const decision = decisionOf(left, right, group.moved, "paragraph", `${section}:${groupIndex}`);
    if (section === "comment") {
      decision.trackedRepresentation = "preserve-after";
      decision.trackedReason = "existing-comment-contract";
      decision.children = paragraphDecisions(left.flatMap((record) => record.paragraphs ?? []), right.flatMap((record) => record.paragraphs ?? []), `${decision.id}:comment`);
      for (const child of decision.children) {
        child.trackedRepresentation = "preserve-after";
        child.trackedReason = "existing-comment-contract";
      }
    }
    manifest.decisions.push(decision);
    return decision;
  });
  return groups.map((group, groupIndex) => compareRecord(
    combineRecords(group.beforeIndexes.map((index) => before[index])),
    combineRecords(group.afterIndexes.map((index) => after[index])),
    section,
    changes,
    formatting,
    group,
    decisions[groupIndex],
  ));
}


function decisionOf(before: ManifestRecord[], after: ManifestRecord[], moved = false, type: ComparisonDecision["type"] = "paragraph", context = "paragraph"): ComparisonDecision {
  const beforeText = before.map((record) => record.rawText ?? record.text).join("\n");
  const afterText = after.map((record) => record.rawText ?? record.text).join("\n");
  let splitSlices: Array<[number, number]> | undefined;
  const comparisons = [{ before: beforeText, after: afterText, segments: diffText(beforeText, afterText) }];
  // Paragraph-break revisions use synthetic text slices. Their text decisions
  // are fixed here too, so the XML emitter never chooses a second alignment.
  if (before.length === 1 && after.length === 2) {
    const a = Array.from(beforeText);
    const tail = Array.from(after[1].rawText ?? after[1].text);
    let suffix = 0;
    while (suffix < a.length && suffix < tail.length && a[a.length - 1 - suffix] === tail[tail.length - 1 - suffix]) suffix++;
    const boundary = a.length - suffix;
    splitSlices = [[0, boundary], [boundary, a.length]];
    for (const [old, next] of [[a.slice(0, boundary).join(""), after[0].rawText ?? after[0].text], [a.slice(boundary).join(""), tail.join("")]]) {
      comparisons.push({ before: old, after: next, segments: diffText(old, next) });
    }
  } else if (before.length === 2 && after.length === 1) {
    const old = before.map((record) => record.rawText ?? record.text).join("");
    comparisons.push({ before: old, after: afterText, segments: diffText(old, afterText) });
  }
  return {
    comparisons,
    splitSlices,
    trackedRepresentation: "revision",
    id: [...before, ...after].some((record) => record.source)
      ? JSON.stringify([type, before.map((record) => record.source ? Object.fromEntries(Object.entries(record.source).filter(([name])=>!["objectEvent","objectEventsSupported","unsupportedObjectQName"].includes(name))) : null), after.map((record) => record.source ? Object.fromEntries(Object.entries(record.source).filter(([name])=>!["objectEvent","objectEventsSupported","unsupportedObjectQName"].includes(name))) : null)])
      : `source-less:${type}:${context}`,
    type, before: before.flatMap((record) => record.source ? [record.source] : []),
    after: after.flatMap((record) => record.source ? [record.source] : []), moved,
    segments: diffText(before.map((record) => record.text).join("\n"), after.map((record) => record.text).join("\n")),
    textSegments: diffText(beforeText, afterText), beforeText, afterText,
  };
}

function paragraphDecisions(before: ManifestRecord[], after: ManifestRecord[], context: string): ComparisonDecision[] {
  return alignDocumentSequence(before, after, { textOf: (record) => record.text, include:record=>Boolean(record.text.trim()) || Boolean(record.source?.opaqueSignature) }).map((group, index) => decisionOf(
    group.beforeIndexes.map((index) => before[index]), group.afterIndexes.map((index) => after[index]), group.moved, "paragraph", `${context}:${index}`,
  ));
}

function combineRecords(records: Array<Pick<ComparisonRecord, "text" | "format" | "formatRuns" | "location" | "comments"> | ComparisonBlock>) {
  if (!records.length) return undefined;
  const first = records[0];
  const last = records[records.length - 1];
  const formatRuns = records.every((record) => record.formatRuns)
    ? records.flatMap((record, index) => [
      ...(index ? [{ text: "\n", style: "__paragraph-break__" }] : []),
      ...record.formatRuns!,
    ])
    : undefined;
  return {
    text: records.map((record) => record.text).join("\n"),
    format: records.map((record) => record.format).join("||paragraph-break||"),
    formatRuns,
    location: first.location === last.location ? first.location : `${first.location}~${last.location}`,
    comments: records.flatMap((record) => record.comments ?? []),
  };
}

function compareRecord(
  before: ComparisonRecord | undefined,
  after: ComparisonRecord | undefined,
  section: Exclude<WordRecordKind, "table">,
  changes: WordDiffItem[],
  formatting: boolean,
  group?: SequenceGroup,
  decision?: ComparisonDecision,
): ManifestFormattingView {
  const beforeText = before?.text ?? "";
  const afterText = after?.text ?? "";
  const comments = compareComments(before?.comments ?? [], after?.comments ?? []);
  const moved = group?.moved === true;
  const baseKind: WordViewKind = !before
    ? "added"
    : !after
      ? "deleted"
      : beforeText !== afterText
        ? "changed"
        : !comments.every((comment) => comment.kind === "unchanged")
          ? "comment"
          : formatting && before.format !== after.format
            ? "format"
            : "unchanged";
  const kind: WordViewKind = moved && baseKind === "unchanged" ? "moved" : baseKind;
  const segments = decision?.segments ?? diffText(beforeText, afterText);
  if (kind !== "unchanged" && kind !== "comment") {
    changes.push({
      kind,
      section,
      location: after?.location || before?.location || "",
      beforeLocation: before?.location ?? "",
      afterLocation: after?.location ?? "",
      before: beforeText,
      after: afterText,
      segments,
      moved,
    });
    if (baseKind === "changed" && formatting) {
      changes.push(...inlineFormattingChanges(before, after, section));
    }
  }
  return {
    comparisonDecisionId: decision?.id,
    kind,
    section,
    blockType: "paragraph",
    beforeLocation: before?.location ?? "",
    afterLocation: after?.location ?? "",
    before: beforeText,
    after: afterText,
    segments,
    comments,
    moved,
  };
}

function inlineFormattingChanges(
  before: ComparisonRecord | undefined,
  after: ComparisonRecord | undefined,
  section: Exclude<WordRecordKind, "table">,
): WordDiffItem[] {
  if (!before?.formatRuns || !after?.formatRuns) return [];
  const beforeStyles = expandedStyles(before.text, before.formatRuns);
  const afterStyles = expandedStyles(after.text, after.formatRuns);
  if (!beforeStyles || !afterStyles) return [];

  const result: WordDiffItem[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  for (const segment of diffCharacters(before.text, after.text)) {
    const characters = Array.from(segment.text);
    if (segment.type === "equal") {
      let start = -1;
      for (let index = 0; index <= characters.length; index += 1) {
        const changed = index < characters.length
          && beforeStyles[beforeIndex + index] !== afterStyles[afterIndex + index];
        if (changed && start < 0) start = index;
        if ((!changed || index === characters.length) && start >= 0) {
          const text = characters.slice(start, index).join("");
          result.push({
            kind: "format",
            section,
            location: after.location || before.location,
            beforeLocation: before.location,
            afterLocation: after.location,
            before: text,
            after: text,
            segments: [{ type: "equal", text }],
          });
          start = -1;
        }
      }
      beforeIndex += characters.length;
      afterIndex += characters.length;
    } else if (segment.type === "deleted") {
      beforeIndex += characters.length;
    } else {
      afterIndex += characters.length;
    }
  }
  return result;
}

function expandedStyles(text: string, runs: Array<{ text: string; style: string }>) {
  if (runs.map((run) => run.text).join("") !== text) return undefined;
  return runs.flatMap((run) => Array.from(run.text, () => run.style));
}

function compareComments(before: WordCellComment[], after: WordCellComment[]): WordDocumentViewItem["comments"] {
  return alignSequence(before, after, (comment) => `${comment.author}\0${comment.text}`).map((pair) => {
    const left = pair.beforeIndex === null ? undefined : before[pair.beforeIndex];
    const right = pair.afterIndex === null ? undefined : after[pair.afterIndex];
    const kind: "added" | "deleted" | "changed" | "unchanged" = !left ? "added" : !right ? "deleted" : left.author !== right.author || left.text !== right.text ? "changed" : "unchanged";
    return {
      kind,
      beforeId: left?.id ?? "",
      afterId: right?.id ?? "",
      beforeAuthor: left?.author ?? "",
      afterAuthor: right?.author ?? "",
      before: left?.text ?? "",
      after: right?.text ?? "",
      segments: diffText(left?.text ?? "", right?.text ?? ""),
    };
  });
}

function compareTable(
  before: ComparisonTable | undefined,
  after: ComparisonTable | undefined,
  index: number,
  changes: WordDiffItem[],
  formatting: boolean,
  labels: ComparisonLanguage,
): WordTableComparison {
  const beforeGrid = before?.grid ?? [];
  const afterGrid = after?.grid ?? [];
  const rowPairs = before && after
    ? alignSequence(beforeGrid, afterGrid, rowText).map(toAxisPair)
    : before ? beforeGrid.map((_, row) => ({ beforeIndex: row, afterIndex: null })) : afterGrid.map((_, row) => ({ beforeIndex: null, afterIndex: row }));
  const beforeColumns = transpose(beforeGrid, labels);
  const afterColumns = transpose(afterGrid, labels);
  const columnPairs = before && after
    ? alignSequence(beforeColumns, afterColumns, rowText).map(toAxisPair)
    : before ? beforeColumns.map((_, col) => ({ beforeIndex: col, afterIndex: null })) : afterColumns.map((_, col) => ({ beforeIndex: null, afterIndex: col }));
  const beforeKinds = beforeGrid.map((row) => row.map<WordViewKind>(() => "unchanged"));
  const afterKinds = afterGrid.map((row) => row.map<WordViewKind>(() => "unchanged"));

  for (const rowPair of rowPairs) {
    for (const columnPair of columnPairs) {
      const beforeCell = rowPair.beforeIndex === null || columnPair.beforeIndex === null ? undefined : beforeGrid[rowPair.beforeIndex]?.[columnPair.beforeIndex];
      const afterCell = rowPair.afterIndex === null || columnPair.afterIndex === null ? undefined : afterGrid[rowPair.afterIndex]?.[columnPair.afterIndex];
      if (!beforeCell && !afterCell) continue;
      const commentChanged = beforeCell && afterCell && !sameComments(beforeCell.comments, afterCell.comments);
      const kind: WordViewKind = !beforeCell
        ? "added"
        : !afterCell
          ? "deleted"
          : beforeCell.text !== afterCell.text
            ? "changed"
            : commentChanged
              ? "comment"
              : formatting && beforeCell.format !== afterCell.format ? "format" : "unchanged";
      const segments = diffText(beforeCell?.text ?? "", afterCell?.text ?? "");
      if (beforeCell) {
        beforeCell.segments = segments;
        beforeKinds[rowPair.beforeIndex!][columnPair.beforeIndex!] = kind;
      }
      if (afterCell) {
        afterCell.segments = segments;
        afterKinds[rowPair.afterIndex!][columnPair.afterIndex!] = kind;
      }
      if (kind !== "unchanged" && kind !== "comment") {
        changes.push({
          kind,
          section: "table",
          location: afterCell?.location || beforeCell?.location || labels.table(index + 1),
          beforeLocation: beforeCell?.location ?? "",
          afterLocation: afterCell?.location ?? "",
          before: beforeCell?.text ?? "",
          after: afterCell?.text ?? "",
          segments,
        });
      }
    }
  }

  const allKinds = [...beforeKinds.flat(), ...afterKinds.flat()];
  const kind = !before ? "added" : !after ? "deleted" : allKinds.some((value) => value !== "unchanged") ? "changed" : "unchanged";
  return {
    index,
    kind,
    beforeIndex: before ? before.sourceIndex ?? index : null,
    afterIndex: after ? after.sourceIndex ?? index : null,
    before: beforeGrid,
    after: afterGrid,
    rowPairs,
    columnPairs,
    beforeKinds,
    afterKinds,
  };
}

export function diffText(before: string, after: string): WordDiffSegment[] {
  if (before === after) return before ? [{ type: "equal", text: before }] : [];
  const left = tokenize(before);
  const right = tokenize(after);
  return diffUnits(left, right, before, after);
}

function diffCharacters(before: string, after: string): WordDiffSegment[] {
  if (before === after) return before ? [{ type: "equal", text: before }] : [];
  const left = Array.from(before);
  const right = Array.from(after);
  if ((left.length + 1) * (right.length + 1) > 1_500_000) return diffText(before, after);

  const matches: Array<{ left: number; right: number; size: number }> = [];
  const pending = [{ leftStart: 0, leftEnd: left.length, rightStart: 0, rightEnd: right.length }];
  while (pending.length) {
    const range = pending.pop()!;
    const match = longestContiguousMatch(left, right, range);
    if (!match.size) continue;
    matches.push(match);
    if (range.leftStart < match.left && range.rightStart < match.right) {
      pending.push({ leftStart: range.leftStart, leftEnd: match.left, rightStart: range.rightStart, rightEnd: match.right });
    }
    const leftAfter = match.left + match.size;
    const rightAfter = match.right + match.size;
    if (leftAfter < range.leftEnd && rightAfter < range.rightEnd) {
      pending.push({ leftStart: leftAfter, leftEnd: range.leftEnd, rightStart: rightAfter, rightEnd: range.rightEnd });
    }
  }
  matches.sort((a, b) => a.left - b.left || a.right - b.right);

  const segments: WordDiffSegment[] = [];
  const append = (type: WordDiffSegment["type"], text: string) => {
    if (!text) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === type) previous.text += text;
    else segments.push({ type, text });
  };
  let leftIndex = 0;
  let rightIndex = 0;
  for (const match of matches) {
    append("deleted", left.slice(leftIndex, match.left).join(""));
    append("added", right.slice(rightIndex, match.right).join(""));
    append("equal", left.slice(match.left, match.left + match.size).join(""));
    leftIndex = match.left + match.size;
    rightIndex = match.right + match.size;
  }
  append("deleted", left.slice(leftIndex).join(""));
  append("added", right.slice(rightIndex).join(""));
  return segments;
}

function longestContiguousMatch(
  left: string[],
  right: string[],
  range: { leftStart: number; leftEnd: number; rightStart: number; rightEnd: number },
) {
  const width = range.rightEnd - range.rightStart;
  let previous = new Uint32Array(width + 1);
  let best = { left: range.leftStart, right: range.rightStart, size: 0 };
  for (let leftIndex = range.leftStart; leftIndex < range.leftEnd; leftIndex += 1) {
    const current = new Uint32Array(width + 1);
    for (let offset = 1; offset <= width; offset += 1) {
      const rightIndex = range.rightStart + offset - 1;
      if (left[leftIndex] !== right[rightIndex]) continue;
      current[offset] = previous[offset - 1] + 1;
      const size = current[offset];
      const candidateLeft = leftIndex - size + 1;
      const candidateRight = rightIndex - size + 1;
      if (size > best.size || (size === best.size && (candidateLeft < best.left || (candidateLeft === best.left && candidateRight < best.right)))) {
        best = { left: candidateLeft, right: candidateRight, size };
      }
    }
    previous = current;
  }
  return best;
}

function diffUnits(left: string[], right: string[], before: string, after: string): WordDiffSegment[] {
  const rows = left.length + 1;
  const cols = right.length + 1;
  if (rows * cols > 1_500_000) return [{ type: "deleted", text: before }, { type: "added", text: after }];
  const matrix = new Uint32Array(rows * cols);
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      matrix[row * cols + col] = left[row - 1] === right[col - 1]
        ? matrix[(row - 1) * cols + col - 1] + 1
        : Math.max(matrix[(row - 1) * cols + col], matrix[row * cols + col - 1]);
    }
  }
  const reversed: WordDiffSegment[] = [];
  let row = left.length;
  let col = right.length;
  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && left[row - 1] === right[col - 1]) {
      reversed.push({ type: "equal", text: left[--row] });
      col -= 1;
    } else if (col > 0 && (row === 0 || matrix[row * cols + col - 1] >= matrix[(row - 1) * cols + col])) {
      reversed.push({ type: "added", text: right[--col] });
    } else {
      reversed.push({ type: "deleted", text: left[--row] });
    }
  }
  const result: WordDiffSegment[] = [];
  for (const segment of reversed.reverse()) {
    const previous = result[result.length - 1];
    if (previous?.type === segment.type) previous.text += segment.text;
    else result.push({ ...segment });
  }
  return result;
}

function tokenize(text: string) {
  return text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

function rowText(row: WordTableCell[]) {
  return row.map((cell) => cell.text).join("\u241f");
}

function transpose(grid: WordTableCell[][], labels: ComparisonLanguage) {
  const width = Math.max(0, ...grid.map((row) => row.length));
  return Array.from({ length: width }, (_, column) => grid.map((row, rowIndex) => row[column] ?? emptyCell(labels.emptyCell(rowIndex + 1, column + 1))));
}

function emptyCell(location: string): WordTableCell {
  return { text: "", format: "", location, segments: [], comments: [] };
}

function toAxisPair(pair: SequencePair): WordTableAxisPair {
  return { beforeIndex: pair.beforeIndex, afterIndex: pair.afterIndex };
}

function tableViewKind(table: WordTableComparison): WordViewKind {
  if (table.beforeIndex === null) return "added";
  if (table.afterIndex === null) return "deleted";
  const kinds = [...table.beforeKinds.flat(), ...table.afterKinds.flat()];
  if (kinds.some((kind) => kind === "added" || kind === "deleted" || kind === "changed")) return "changed";
  if (kinds.some((kind) => kind === "comment")) return "comment";
  if (kinds.some((kind) => kind === "format")) return "format";
  return "unchanged";
}

function sameComments(before: WordCellComment[], after: WordCellComment[]) {
  return JSON.stringify(before.map(({ author, text }) => ({ author, text })))
    === JSON.stringify(after.map(({ author, text }) => ({ author, text })));
}
