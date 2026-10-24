import { formattingGroup } from "./formattingMask.ts";
import { childSources, findSource, paragraphSources } from "./manifestIndex.ts";
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, FormattingScope, PropertyFact, TextComparison } from "./comparisonManifest.ts";

const W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}";
import policy from "../word-compare/formatting-policy.json" with { type: "json" };
const local = (name: string) => name.startsWith(W) ? name.slice(W.length) : name;
const key = (ref: DocumentSourceReference) => JSON.stringify([ref.part, ref.path]);
const emptyFact: PropertyFact = { supported: {}, unsupported: {}, history: false };
function rawChanged(before: PropertyFact | undefined, after: PropertyFact | undefined, supported = true) {
  const a = before?.[supported ? "supported" : "unsupported"] ?? {}, b = after?.[supported ? "supported" : "unsupported"] ?? {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((name) => JSON.stringify(a[name] ?? []) !== JSON.stringify(b[name] ?? []));
}
function changed(manifest: DocumentComparisonManifest, property: string, before: PropertyFact | undefined, after: PropertyFact | undefined, supported = true) {
  const names = rawChanged(before, after);
  return supported ? names.filter(name => manifest.formattingMask.effective[formattingGroup(property,name)]) : [...rawChanged(before,after,false), ...names.filter(name => !manifest.formattingMask.effective[formattingGroup(property,name)])];
}
interface StyleEntry { fact: PropertyFact; source: DocumentSourceReference }
function rawStyles(manifest: DocumentComparisonManifest, side: "before" | "after", refs: DocumentSourceReference[], joinBreaks: boolean) {
  const result: Array<StyleEntry | undefined> = [];
  for (const [index, ref] of refs.entries()) {
    if (index && joinBreaks) result.push(undefined);
    const paragraph = findSource(manifest, side, ref);
    const length = Array.from(paragraph?.rawText ?? "").length;
    const styles = Array<StyleEntry | undefined>(length).fill(undefined);
    for (const source of paragraphSources(manifest, side, ref.part, ref.path)) {
      if (!source.textRange) continue;
      for (let position = source.textRange[0]; position < source.textRange[1] && position < length; position++) styles[position] = { fact: source.normalizedProperties?.rPr ?? emptyFact, source };
    }
    result.push(...styles);
  }
  return result;
}
function attachComparison(manifest: DocumentComparisonManifest, decision: ComparisonDecision, comparison: TextComparison, beforeStyles: Array<StyleEntry | undefined>, afterStyles: Array<StyleEntry | undefined>, beforeRef: DocumentSourceReference, afterRef: DocumentSourceReference, beforeSlices: NonNullable<TextComparison["formatting"]>["beforeSlices"], afterSlices: NonNullable<TextComparison["formatting"]>["afterSlices"]) {
  const source = (side: "before" | "after", ref: DocumentSourceReference) => findSource(manifest, side, ref)!;
  const oldParagraph = source("before", beforeRef).normalizedProperties?.pPr ?? emptyFact, newParagraph = source("after", afterRef).normalizedProperties?.pPr ?? emptyFact;
  const comparisonId = `${decision.id}:comparison:${decision.comparisons.indexOf(comparison)}`;
  const paragraphScopeId = `${comparisonId}:pPr`;
  const paragraphFamilies = changed(manifest, "pPr", oldParagraph, newParagraph);
  manifest.formattingScopes.push({ id: paragraphScopeId, before: beforeRef, after: afterRef, property: "pPr", beforeFact: oldParagraph, afterFact: newParagraph, families: paragraphFamilies, excludedFamilies: changed(manifest, "pPr", oldParagraph, newParagraph, false), comparisonId });
  const spans: NonNullable<TextComparison["formatting"]>["spans"] = [];
  let before = 0, after = 0;
  let previousScope: FormattingScope | undefined;
  for (const segment of comparison.segments) {
    const size = Array.from(segment.text).length;
    if (segment.type === "equal") for (let offset = 0; offset < size; offset++) {
      const a = beforeStyles[before + offset], b = afterStyles[after + offset];
      if (!a || !b) { manifest.formattingExcluded.push(decision.id); continue; }
      const names = changed(manifest, "rPr", a.fact, b.fact), excluded = changed(manifest, "rPr", a.fact, b.fact, false);
      if (rawChanged(a.fact,b.fact,false).length) manifest.formattingExcluded.push(decision.id);
      if (previousScope && previousScope.beforeStart! + previousScope.length! === before + offset && previousScope.afterStart! + previousScope.length! === after + offset && key(previousScope.before) === key(a.source) && key(previousScope.after) === key(b.source)) previousScope.length!++;
      else {
        previousScope = { id: `${comparisonId}:rPr:${before + offset}:${after + offset}`, before: a.source, after: b.source, property: "rPr", beforeFact: a.fact, afterFact: b.fact, families: names, excludedFamilies: excluded, comparisonId, beforeStart: before + offset, afterStart: after + offset, length: 1 };
        manifest.formattingScopes.push(previousScope);
      }
      if (names.length) {
        const previous = spans.at(-1);
        if (previous?.scopeId === previousScope.id) previous.length++;
        else spans.push({ beforeStart: before + offset, afterStart: after + offset, length: 1, families: names, history: b.fact.history, scopeId: previousScope.id });
      }
    }
    if (segment.type !== "added") before += size;
    if (segment.type !== "deleted") after += size;
  }
  if (rawChanged(oldParagraph,newParagraph,false).length) manifest.formattingExcluded.push(decision.id);
  comparison.formatting = { paragraphFamilies, paragraphHistory: newParagraph.history, paragraphScopeId, beforeSlices, afterSlices, spans, history: newParagraph.history || afterStyles.some((style) => style?.fact.history) };
}
export function buildWordFormatting(manifest: DocumentComparisonManifest, characterDiff: (before: string, after: string) => Array<{ type: "equal" | "added" | "deleted"; text: string }>) {
  if (!manifest.options.formatting) return;
  if (manifest.formattingPolicyVersion !== policy.version) throw new Error("Formatting policy is stale");
  const decisions: ComparisonDecision[] = [];
  const visit = (items: ComparisonDecision[]) => { for (const decision of items) { decisions.push(decision); visit(decision.children ?? []); } };
  visit(manifest.decisions);
  for (const decision of decisions) {
    if (decision.type !== "paragraph" || (decision.trackedRepresentation !== "revision" && decision.trackedRepresentation !== "replace") || !decision.before.length || !decision.after.length) continue;
    const left = rawStyles(manifest, "before", decision.before, true), right = rawStyles(manifest, "after", decision.after, true);
    const screenFamilies = new Set<string>(); let oldOffset = 0, newOffset = 0;
    for (const segment of characterDiff(decision.beforeText, decision.afterText)) {
      const size = Array.from(segment.text).length;
      if (segment.type === "equal") for (let offset = 0; offset < size; offset++) for (const family of changed(manifest, "rPr", left[oldOffset + offset]?.fact, right[newOffset + offset]?.fact)) screenFamilies.add(family);
      if (segment.type !== "added") oldOffset += size;
      if (segment.type !== "deleted") newOffset += size;
    }
    for(const pair of decision.objectEvents?.drawingProperties ?? []) {
      for(const family of pair.families)screenFamilies.add(family);
      if(pair.excludedFamilies.some(name=>!Object.hasOwn(pair.beforeFact.supported,name)&&!Object.hasOwn(pair.afterFact.supported,name)))manifest.formattingExcluded.push(decision.id);
    }
    decision.screenFormattingFamilies = [...screenFamilies];
    if (decision.before.length === 1 && decision.after.length === 1) attachComparison(manifest, decision, decision.comparisons[0], left, right, decision.before[0], decision.after[0], [{ source: decision.before[0], range: [0, left.length] }], [{ source: decision.after[0], range: [0, right.length] }]);
    if (decision.before.length === 1 && decision.after.length === 2) for (let index = 0; index < 2; index++) {
      const [start, end] = decision.splitSlices![index];
      attachComparison(manifest, decision, decision.comparisons[index + 1], left.slice(start, end), rawStyles(manifest, "after", [decision.after[index]], false), decision.before[0], decision.after[index], [{ source: decision.before[0], range: [start, end] }], [{ source: decision.after[index], range: [0, Array.from(decision.comparisons[index + 1].after).length] }]);
    }
    if (decision.before.length === 2 && decision.after.length === 1) attachComparison(manifest, decision, decision.comparisons[1], rawStyles(manifest, "before", decision.before, false), right, decision.before[0], decision.after[0], decision.before.map((source) => ({ source, range: [0, Array.from(findSource(manifest, "before", source)?.rawText ?? "").length] })), [{ source: decision.after[0], range: [0, right.length] }]);
  }
  const children = (side: "before" | "after", parent: DocumentSourceReference, kind: string) => childSources(manifest, side, parent, kind);
  const movedDecisionIds = new Set(decisions.filter((decision) => decision.moved).map((decision) => decision.id));
  const add = (before: DocumentSourceReference | undefined, after: DocumentSourceReference | undefined, property: string, decisionId?: string) => {
    if (!before || !after) return;
    const old = before.normalizedProperties?.[property] ?? emptyFact, next = after.normalizedProperties?.[property] ?? emptyFact;
    const names = changed(manifest, property, old, next), excluded = changed(manifest, property, old, next, false);
    const scopeId = `scope:${JSON.stringify([key(before), key(after), property])}`;
    manifest.formattingScopes.push({ id: scopeId, before, after, property, beforeFact: old, afterFact: next, families: names, excludedFamilies: excluded });
    if (rawChanged(old,next,false).length) manifest.formattingExcluded.push(decisionId ?? property);
    if (names.length) manifest.propertyActions.push({ id: `format:${scopeId}`, scopeId, before, after, property, families: names, representation: next.history ? "preserve-after-history" : decisionId !== undefined && movedDecisionIds.has(decisionId) ? "whole-node-revision" : "revision", decisionId });
  };
  for (const decision of decisions.filter((item) => item.type === "table" && item.before.length === 1 && item.after.length === 1)) {
    const before = findSource(manifest, "before", decision.before[0])!, after = findSource(manifest, "after", decision.after[0])!;
    add(before, after, "tblPr", decision.id); add(before, after, "tblGrid", decision.id);
    const a = children("before", before, "tr"), b = children("after", after, "tr");
    for (const row of decision.rows ?? []) {
      if (row.beforeIndex === null || row.afterIndex === null) continue;
      add(a[row.beforeIndex], b[row.afterIndex], "trPr", decision.id);
      const left = children("before", a[row.beforeIndex], "tc"), right = children("after", b[row.afterIndex], "tc");
      for (const column of decision.columns ?? []) if (column.beforeIndex !== null && column.afterIndex !== null) add(left[column.beforeIndex], right[column.afterIndex], "tcPr", decision.id);
    }
  }
  for(const section of manifest.storyProjection.sections)if(!section.final&&section.before&&section.after)add(findSource(manifest,"before",section.before!.source),findSource(manifest,"after",section.after!.source),"sectPr",section.ownerDecisionId);
  add(manifest.sources.before.find((ref) => ref.kind === "body"), manifest.sources.after.find((ref) => ref.kind === "body"), "sectPr");
  // First style per styleId on each side, as the per-style `find`/`some` scans did.
  const stylesById = { before: new Map<string | undefined, DocumentSourceReference>(), after: new Map<string | undefined, DocumentSourceReference>() };
  for (const side of ["before", "after"] as const) for (const ref of manifest.sources[side]) if (ref.kind === "style" && !stylesById[side].has(ref.attributes?.[W + "styleId"])) stylesById[side].set(ref.attributes?.[W + "styleId"], ref);
  for (const side of ["before", "after"] as const) for (const source of manifest.sources[side].filter((ref) => ref.kind === "style")) {
    if (!stylesById[side === "before" ? "after" : "before"].has(source.attributes?.[W + "styleId"])) {
      for (const property of ["pPr", "rPr"]) manifest.propertyExclusions.push({ side, source, property, reason: "unpaired-style" });
      manifest.formattingExcluded.push("unpaired-style");
    }
  }
  for (const after of manifest.sources.after.filter((ref) => ref.kind === "style")) {
    const before = stylesById.before.get(after.attributes?.[W + "styleId"]);
    add(before, after, "pPr"); add(before, after, "rPr");
  }
}

const labels: Record<string, [string, string]> = {
  dstrike: ["이중 취소선", "Double strikethrough"], caps: ["모두 대문자", "All caps"], smallCaps: ["작은 대문자", "Small caps"], bCs: ["복합 문자 굵게", "Complex-script bold"], iCs: ["복합 문자 기울임", "Complex-script italic"], vertAlign: ["위·아래 첨자", "Superscript or subscript"], outline: ["글자 윤곽", "Text outline"], shadow: ["글자 그림자", "Text shadow"], emboss: ["양각", "Emboss"], imprint: ["음각", "Imprint"], kern: ["글자 커닝", "Kerning"], position: ["글자 위치", "Text position"], w: ["글자 너비", "Character width"], vanish: ["숨긴 글자", "Hidden text"],
  keepNext: ["다음 문단과 함께", "Keep with next"], keepLines: ["문단 나눔 방지", "Keep lines together"], pageBreakBefore: ["문단 앞 쪽 나눔", "Page break before"], widowControl: ["문단 첫줄·끝줄 보호", "Widow and orphan control"], suppressLineNumbers: ["줄 번호 숨김", "Suppress line numbers"], pBdr: ["문단 테두리", "Paragraph borders"], tabs: ["탭 위치", "Tab stops"], textDirection: ["글 방향", "Text direction"], textAlignment: ["글자 세로 정렬", "Text alignment"], contextualSpacing: ["같은 스타일 문단 간격", "Contextual spacing"], mirrorIndents: ["맞쪽 들여쓰기", "Mirror indents"],
  gridCol: ["표 열 너비·구성", "Table column widths and layout"], tblStyle: ["표 스타일", "Table style"], tblCellSpacing: ["셀 간격", "Cell spacing"], tblInd: ["표 들여쓰기", "Table indentation"], tblBorders: ["표 테두리", "Table borders"], tblLayout: ["표 배치", "Table layout"], tblCellMar: ["표 셀 여백", "Table cell margins"], tblLook: ["표 스타일 적용", "Table style options"], bidiVisual: ["표 읽기 방향", "Table reading direction"], cantSplit: ["행 나눔 방지", "Keep row together"], tblHeader: ["머리글 행 반복", "Repeat header row"], hidden: ["숨긴 행", "Hidden row"], tcW: ["셀 너비", "Cell width"], gridSpan: ["셀 가로 병합", "Cell column span"], vMerge: ["셀 세로 병합", "Vertical cell merge"], tcBorders: ["셀 테두리", "Cell borders"], noWrap: ["셀 줄 바꿈 방지", "Prevent cell wrapping"], tcMar: ["셀 여백", "Cell margins"], tcFitText: ["셀에 글자 맞춤", "Fit text to cell"], hideMark: ["셀 끝 표시 숨김", "Hide cell end mark"],
  type: ["구역 나눔", "Section break"], paperSrc: ["용지 공급", "Paper source"], pgBorders: ["쪽 테두리", "Page borders"], lnNumType: ["줄 번호", "Line numbering"], pgNumType: ["쪽 번호", "Page numbering"], cols: ["단 구성", "Columns"], formProt: ["양식 보호", "Form protection"], noEndnote: ["미주 배치", "Endnote placement"], titlePg: ["첫 쪽 다르게", "Different first page"], bidi: ["구역 읽기 방향", "Section reading direction"], rtlGutter: ["제본 방향", "Gutter direction"], docGrid: ["문서 격자", "Document grid"],
  sz: ["글꼴 크기", "Font size"], rFonts: ["글꼴", "Font family"], b: ["굵게", "Bold"], i: ["기울임", "Italic"], u: ["밑줄", "Underline"], strike: ["취소선", "Strikethrough"], color: ["글자색", "Text color"], highlight: ["강조색", "Highlight"],
  jc: ["정렬", "Alignment"], pStyle: ["문단 스타일", "Paragraph style"], spacing: ["간격", "Spacing"], ind: ["들여쓰기", "Indentation"], tblW: ["표 너비", "Table width"], shd: ["음영", "Shading"], vAlign: ["세로 정렬", "Vertical alignment"], trHeight: ["행 높이", "Row height"], pgSz: ["용지 크기", "Page size"], pgMar: ["쪽 여백", "Page margins"],
};
export function formattingLabels(names: string[], language: "ko" | "en") { return [...new Set(names.map((name) => labels[local(name)]?.[language === "en" ? 1 : 0] ?? (language === "en" ? "Formatting" : "서식")))]; }
export function decisionFormattingFamilies(decision: ComparisonDecision) { return [...new Set([...decision.mergeProjection?.properties.flatMap(item=>item.families) ?? [], ...decision.screenFormattingFamilies ?? [], ...decision.comparisons.flatMap((item) => [...item.formatting?.paragraphFamilies ?? [], ...item.formatting?.spans.flatMap((span) => span.families) ?? []])])]; }

import type { WordDiffItem, WordDocumentViewItem, WordTableComparison } from "../excel-merger/types";
export interface ManifestFormattingView extends WordDocumentViewItem { comparisonDecisionId?: string; formattingLabels?: string[] }
export function projectWordFormatting(manifest: DocumentComparisonManifest, document: ManifestFormattingView[], headers: ManifestFormattingView[], notes: ManifestFormattingView[], changes: WordDiffItem[], tables: WordTableComparison[], language: "ko" | "en") {
  const views = [...document, ...headers, ...notes];
  const pushChange = (view: ManifestFormattingView, names: string[]) => {
    view.formattingLabels = [...new Set([...view.formattingLabels ?? [], ...formattingLabels(names, language)])];
    if (view.kind === "unchanged") view.kind = "format";
    if (!changes.some((change) => change.kind === "format" && change.beforeLocation === view.beforeLocation && change.afterLocation === view.afterLocation)) changes.push({ kind: "format", section: view.section, location: `${view.afterLocation || view.beforeLocation} · ${view.formattingLabels.join(", ")}`, beforeLocation: view.beforeLocation, afterLocation: view.afterLocation, before: view.before, after: view.after, segments: view.segments });
  };
  const visit = (items: ComparisonDecision[], parentView?: ManifestFormattingView) => {
    for (const decision of items) {
      const ownView = views.find((item) => item.comparisonDecisionId === decision.id);
      const view = ownView ?? parentView;
      const families = decisionFormattingFamilies(decision);
      if (view && decision.comparisons.some((item) => item.formatting)) {
        // DOCX property snapshots supersede serialization-only format noise.
        if (ownView && !families.length) {
          if (view.kind === "format") view.kind = decision.moved ? "moved" : "unchanged";
          for (let index = changes.length - 1; index >= 0; index--) if (changes[index].kind === "format" && changes[index].beforeLocation === view.beforeLocation && changes[index].afterLocation === view.afterLocation) changes.splice(index, 1);
        }
        if (families.length) {
          pushChange(view, families);
          if (view.tableIndex !== undefined) {
            const table=tables[view.tableIndex]; table.kind="changed";
            for (const side of ["before","after"] as const) for (const [r,row] of table[side].entries()) for (const [c,cell] of row.entries()) {
              const source=(cell as unknown as {source?:DocumentSourceReference}).source;
              if (source && decision[side].some(ref => ref.part===source.part && source.path.every((value,index)=>ref.path[index]===value)) && table[side+"Kinds" as "beforeKinds"|"afterKinds"][r][c]==="unchanged") table[side+"Kinds" as "beforeKinds"|"afterKinds"][r][c]="format";
            }
          }
        }
      }
      visit(decision.children ?? [], view);
    }
  };
  visit(manifest.decisions);
  for (const action of manifest.propertyActions) {
    const view = views.find((item) => item.comparisonDecisionId === action.decisionId);
    if (view) {
      pushChange(view, action.families);
      if (view.tableIndex !== undefined) {
        const table = tables[view.tableIndex]; table.kind = "changed";
        for (const side of ["before", "after"] as const) for (const [rowIndex, row] of table[side].entries()) for (const [columnIndex, cell] of row.entries()) {
          const source = (cell as unknown as { source?: DocumentSourceReference }).source;
          if (source && source.part === action[side].part && action[side].path.every((value, index) => source.path[index] === value) && table[side === "before" ? "beforeKinds" : "afterKinds"][rowIndex][columnIndex] === "unchanged") table[side === "before" ? "beforeKinds" : "afterKinds"][rowIndex][columnIndex] = "format";
        }
      }
    } else {
      const label = action.after.kind === "style" ? `${language === "en" ? "Style" : "스타일"} ${action.after.label || action.after.attributes?.[W + "styleId"] || ""}` : language === "en" ? "Document settings" : "문서 설정";
      const extra: ManifestFormattingView = { kind: "format", section: "body", blockType: "paragraph", comparisonDecisionId: action.id, beforeLocation: label, afterLocation: label, before: label, after: label, segments: [{ type: "equal", text: label }], comments: [] };
      document.push(extra); views.push(extra); pushChange(extra, action.families);
    }
  }
}
