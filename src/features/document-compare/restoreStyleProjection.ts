import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, SourceSlices } from "./comparisonManifest.ts";
import { childSources, findSource, paragraphSources, sourceTextLength } from "./manifestIndex.ts";
const key = (ref: DocumentSourceReference) => JSON.stringify([ref.part, ref.path]);
const sameSource = (a: DocumentSourceReference | undefined, b: DocumentSourceReference | undefined) => a === b || (a ? key(a) : "") === (b ? key(b) : "");
export function comparisonSourceSlices(manifest: DocumentComparisonManifest, decision: ComparisonDecision, index: number): SourceSlices {
  const full = (side: "before" | "after", refs: DocumentSourceReference[]) => refs.map((source) => ({ source, range: [0, sourceTextLength(manifest, side, source)] as [number, number] }));
  if (decision.before.length === 1 && decision.after.length === 2) return { before: [{ source: decision.before[0], range: decision.splitSlices![index - 1] }], after: full("after", [decision.after[index - 1]]) };
  return { before: full("before", decision.before), after: full("after", decision.after) };
}
export function buildRestoreStyleProjections(manifest: DocumentComparisonManifest) {
  const visit = (decisions: ComparisonDecision[]) => {
    for (const decision of decisions) {
      visit(decision.children ?? []);
      if (decision.type !== "paragraph" || decision.trackedRepresentation !== "revision") continue;
      if (!decision.before.length && !decision.after.length) continue;
      if (!decision.after.length) { decision.deletedFormattingPolicy = "restore-before-unpaired"; continue; }
      if (!decision.before.length) continue;
      decision.deletedFormattingPolicy = "paired-revised";
      const indexes = decision.before.length === 1 && decision.after.length === 1 ? [0] : decision.after.length === 2 ? [1, 2] : [1];
      for (const index of indexes) {
        const comparison = decision.comparisons[index];
        const slices = comparisonSourceSlices(manifest, decision, index);
        comparison.sourceSlices = slices;
        const styles: Array<DocumentSourceReference | undefined> = [];
        for (const slice of slices.after) {
          // First run (in source order) covering each position, as `runs.find` did per position.
          const [start, end] = slice.range;
          const covering = new Array<DocumentSourceReference | undefined>(Math.max(0, end - start));
          for (const ref of paragraphSources(manifest, "after", slice.source.part, slice.source.path)) {
            if (!ref.textRange) continue;
            for (let position = Math.max(start, ref.textRange[0]); position < Math.min(end, ref.textRange[1]); position++) covering[position - start] ??= ref;
          }
          for (let position = start; position < end; position++) styles.push(covering[position - start]);
        }
        comparison.restoreStyles = [];
        let before = 0, after = 0;
        for (const segment of comparison.segments) {
          const size = Array.from(segment.text).length;
          if (segment.type !== "added") for (let offset = 0; offset < size; offset++) {
            const cursor = after + (segment.type === "equal" ? offset : 0);
            const source = styles[cursor] ?? styles[Math.min(cursor, styles.length) - 1];
            const policy = source ? "copy-revised-run" : "inherit-after-default";
            const previous = comparison.restoreStyles.at(-1);
            if (previous && previous.beforeStart + previous.length === before + offset && previous.afterStart + (previous.kind === "equal" ? previous.length : 0) === cursor && previous.kind === segment.type && previous.policy === policy && sameSource(previous.source, source)) previous.length++;
            else comparison.restoreStyles.push({ beforeStart: before + offset, afterStart: cursor, length: 1, kind: segment.type, policy, ...(source ? { source } : {}) });
          }
          if (segment.type !== "added") before += size;
          if (segment.type !== "deleted") after += size;
        }
      }
      decision.wholeRestoreStyles = decision.before.map((beforeSource) => {
        const projections = [] as NonNullable<ComparisonDecision["wholeRestoreStyles"]>[number]["projections"];
        for (const index of indexes) {
          const comparison = decision.comparisons[index]; let offset = 0;
          for (const slice of comparison.sourceSlices!.before) {
            if (key(slice.source) === key(beforeSource)) for (const projection of comparison.restoreStyles!) {
              const start = Math.max(offset, projection.beforeStart), end = Math.min(offset + slice.range[1] - slice.range[0], projection.beforeStart + projection.length);
              if (start < end) projections.push({ ...projection, beforeStart: slice.range[0] + start - offset, afterStart: projection.afterStart + (projection.kind === "equal" ? start - projection.beforeStart : 0), length: end - start });
            }
            offset += slice.range[1] - slice.range[0];
          }
        }
        return { before: beforeSource, afterParagraph: decision.after[0], projections };
      });
    }
  };
  visit(manifest.decisions);
  const children = (side: "before" | "after", parent: DocumentSourceReference, kind: string) => childSources(manifest, side, parent, kind);
  const add = (before: DocumentSourceReference | undefined, after: DocumentSourceReference | undefined, property: string) => { if (before && after) manifest.restorePropertyPairs.push({ before, after, property }); };
  const tables = (items: ComparisonDecision[]) => { for (const decision of items) {
    tables(decision.children ?? []);
    if (decision.type !== "table" || decision.before.length !== 1 || decision.after.length !== 1) continue;
    const before = decision.before[0], after = decision.after[0]; add(before, after, "tblPr"); add(before, after, "tblGrid");
    const left = children("before", before, "tr"), right = children("after", after, "tr");
    for (const row of decision.rows ?? []) if (row.beforeIndex !== null && row.afterIndex !== null) {
      const a = left[row.beforeIndex], b = right[row.afterIndex]; add(a, b, "trPr");
      const oldCells = children("before", a, "tc"), newCells = children("after", b, "tc");
      for (const column of decision.columns ?? []) if (column.beforeIndex !== null && column.afterIndex !== null) add(oldCells[column.beforeIndex], newCells[column.afterIndex], "tcPr");
    }
  } };
  tables(manifest.decisions);
}
