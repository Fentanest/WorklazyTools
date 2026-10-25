import type { DocumentComparisonManifest } from "./comparisonManifest.ts";

/** The part of the comparison manifest the result pages read (Word field notes). */
export type ScreenManifest = Pick<DocumentComparisonManifest, "fields">;

/** A comparison result as the page keeps it. The full manifest (every source fact of both
 * documents, hundreds of megabytes for large files) is only the tracked-DOCX generator's input,
 * which the worker passes on in compact form; the page receives just the field notes. */
export function screenResult<T extends { manifest: DocumentComparisonManifest }>(result: T): Omit<T, "manifest"> & { manifest: ScreenManifest } {
  const { manifest, ...rest } = result;
  return { ...rest, manifest: { fields: manifest.fields } };
}
