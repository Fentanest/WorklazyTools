import type { DocumentComparisonManifest, DocumentSourceReference } from "./comparisonManifest.ts";

type Side = "before" | "after";

/** Serialize the manifest for the tracked-DOCX generator.
 *
 * Decisions, scopes and coverage repeat whole source references, so plain JSON copies
 * every reference many times (tens to hundreds of MB for ordinary documents). A
 * reference whose JSON equals its inventory entry is written once in `sources` and
 * elsewhere as `{"$src":[side,index]}`; `_resolve_manifest_sources` in tracked_docx.py
 * restores it. A reference that differs from its entry in any field stays inline. */
export function serializeManifestForTracked(manifest: DocumentComparisonManifest): string {
  const lists = new Set<unknown>([manifest.sources.before, manifest.sources.after]);
  const positions = new Map<object, [Side, number]>();
  const entries = new Map<string, Array<{ side: Side; index: number; json: string }>>();
  for (const side of ["before", "after"] as const) {
    manifest.sources[side].forEach((source, index) => {
      if (!positions.has(source)) positions.set(source, [side, index]);
      const id = JSON.stringify([source.part, source.path]);
      const list = entries.get(id) ?? [];
      if (!list.some((entry) => entry.side === side)) list.push({ side, index, json: JSON.stringify(source) });
      entries.set(id, list);
    });
  }
  const serialized = new WeakMap<object, string>();
  const stub = (value: DocumentSourceReference) => {
    const position = positions.get(value);
    if (position) return { $src: position };
    let json = serialized.get(value);
    if (json === undefined) { json = JSON.stringify(value); serialized.set(value, json); }
    const entry = entries.get(JSON.stringify([value.part, value.path]))?.find((item) => item.json === json);
    return entry ? { $src: [entry.side, entry.index] } : undefined;
  };
  return JSON.stringify(manifest, function (this: unknown, _key, value) {
    if (lists.has(this)) return value;
    if (value && typeof value === "object" && !Array.isArray(value) && typeof value.part === "string" && Array.isArray(value.path) && typeof value.kind === "string") {
      return stub(value as DocumentSourceReference) ?? value;
    }
    return value;
  });
}
