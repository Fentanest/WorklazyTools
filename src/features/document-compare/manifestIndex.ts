import type { DocumentComparisonManifest, DocumentSourceReference } from "./comparisonManifest.ts";

type Side = "before" | "after";
export const sourceKey = (ref: Pick<DocumentSourceReference, "part" | "path">) => JSON.stringify([ref.part, ref.path]);

/** Lookups that were linear scans over every XML node per decision. Every list keeps
 * the original array order and every single lookup keeps the first match, so results
 * are identical to the `find`/`filter` calls they replace. */
interface SideIndex {
  length: number;
  byKey: Map<string, DocumentSourceReference>;
  byParagraph: Map<string, DocumentSourceReference[]>;
  byEventParagraph: Map<string, DocumentSourceReference[]>;
  children: Map<string, DocumentSourceReference[]>;
  order: Map<DocumentSourceReference, number>;
  byPart?: Map<string, DocumentSourceReference[]>;
}

const cache = new WeakMap<DocumentSourceReference[], SideIndex>();

function sideIndex(manifest: DocumentComparisonManifest, side: Side): SideIndex {
  const sources = manifest.sources[side];
  const cached = cache.get(sources);
  if (cached && cached.length === sources.length) return cached;
  const index: SideIndex = { length: sources.length, byKey: new Map(), byParagraph: new Map(), byEventParagraph: new Map(), children: new Map(), order: new Map() };
  sources.forEach((source, position) => {
    index.order.set(source, position);
    const key = sourceKey(source);
    if (!index.byKey.has(key)) index.byKey.set(key, source);
    if (source.paragraphPath) push(index.byParagraph, JSON.stringify([source.part, source.paragraphPath]), source);
    if (source.objectEvent) push(index.byEventParagraph, JSON.stringify([source.part, source.objectEvent.paragraphPath]), source);
    if (source.path.length) push(index.children, JSON.stringify([source.part, source.path.slice(0, -1), source.kind]), source);
  });
  cache.set(sources, index);
  return index;
}

function push(map: Map<string, DocumentSourceReference[]>, key: string, value: DocumentSourceReference) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function comparePaths(a: number[], b: number[]) {
  for (let index = 0; index < Math.min(a.length, b.length); index++) if (a[index] !== b[index]) return a[index] - b[index];
  return a.length - b.length;
}

/** `sources[side].find((ref) => sourceKey(ref) === sourceKey(target))` */
export function findSource(manifest: DocumentComparisonManifest, side: Side, target: Pick<DocumentSourceReference, "part" | "path">) {
  return sideIndex(manifest, side).byKey.get(sourceKey(target));
}

/** Sources whose `paragraphPath` equals `path` in `part`, in source order. */
export function paragraphSources(manifest: DocumentComparisonManifest, side: Side, part: string, path: number[]) {
  return sideIndex(manifest, side).byParagraph.get(JSON.stringify([part, path])) ?? [];
}

/** Sources with an object event whose `paragraphPath` equals `path` in `part`, in source order. */
export function eventSources(manifest: DocumentComparisonManifest, side: Side, part: string, path: number[] | undefined) {
  return sideIndex(manifest, side).byEventParagraph.get(JSON.stringify([part, path])) ?? [];
}

/** Direct children of `parent` with the given kind, in source order. */
export function childSources(manifest: DocumentComparisonManifest, side: Side, parent: Pick<DocumentSourceReference, "part" | "path">, kind: string) {
  return sideIndex(manifest, side).children.get(JSON.stringify([parent.part, parent.path, kind])) ?? [];
}

/** `root` and every source under it (same part, `root.path` prefix), in source order. */
export function subtreeSources(manifest: DocumentComparisonManifest, side: Side, root: Pick<DocumentSourceReference, "part" | "path">) {
  const index = sideIndex(manifest, side);
  if (!index.byPart) {
    index.byPart = new Map();
    for (const source of manifest.sources[side]) push(index.byPart, source.part, source);
    for (const list of index.byPart.values()) list.sort((a, b) => comparePaths(a.path, b.path) || index.order.get(a)! - index.order.get(b)!);
  }
  const list = index.byPart.get(root.part) ?? [];
  let low = 0, high = list.length;
  while (low < high) { const middle = (low + high) >> 1; if (comparePaths(list[middle].path, root.path) < 0) low = middle + 1; else high = middle; }
  const result: DocumentSourceReference[] = [];
  for (let position = low; position < list.length && root.path.every((value, offset) => list[position].path[offset] === value); position++) result.push(list[position]);
  return result.sort((a, b) => index.order.get(a)! - index.order.get(b)!);
}

const textLengths = new WeakMap<DocumentSourceReference, number>();
/** Code-point length of the inventory entry's `rawText` for `target` (0 when absent). */
export function sourceTextLength(manifest: DocumentComparisonManifest, side: Side, target: Pick<DocumentSourceReference, "part" | "path">) {
  const source = findSource(manifest, side, target);
  if (!source) return 0;
  let length = textLengths.get(source);
  if (length === undefined) { length = Array.from(source.rawText ?? "").length; textLengths.set(source, length); }
  return length;
}
