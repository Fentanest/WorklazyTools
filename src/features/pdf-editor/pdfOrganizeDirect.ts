export type PdfOrganizePreset =
 | { purpose: "merge"; outputMode: "merged"; quickSplit: false; postLoadFocus?: never }
 | { purpose: "split"; outputMode: "ranges"; quickSplit: true; postLoadFocus?: never }
 | { purpose: "delete"; outputMode: "merged"; quickSplit: false; postLoadFocus: "delete" }
 | { purpose: "rotate"; outputMode: "merged"; quickSplit: false; postLoadFocus: "rotate" };
export function pdfOrganizeDirty(s: { sources: readonly unknown[]; pages: readonly unknown[]; inspecting: boolean; status: string; result: unknown }) { return s.sources.length > 0 || s.pages.length > 0 || s.inspecting || s.status === "running" || Boolean(s.result); }
