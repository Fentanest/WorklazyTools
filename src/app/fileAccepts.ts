// Shared intake contract. Keep this module independent of feature/page code.
export interface HandoffReceiverDefinition {
  paths: readonly string[]; extensions: readonly string[]; max: number;
  kind: "inspection" | "selection";
  // Future text receivers must opt in; the existing eight remain file-only.
  payload?: "text";
}
const spreadsheets = ["xlsx", "xlsm", "xls", "xlsb", "csv"];
const images = ["jpg", "jpeg", "png", "webp"];
export const fileAccepts = {
  "hwp-editor": { paths: ["/tools/hwp-editor"], extensions: ["hwp", "hwpx", "hml"], max: 1, kind: "inspection" },
  "excel-compare": { paths: ["/tools/excel-compare"], extensions: spreadsheets, max: 2, kind: "inspection" },
  "pdf-compare": { paths: ["/tools/pdf-compare"], extensions: ["pdf"], max: 2, kind: "inspection" },
  "image-compare": { paths: ["/tools/image-compare"], extensions: images, max: 2, kind: "inspection" },
  "document-compare": { paths: ["/tools/document-compare"], extensions: ["docx", "doc", "hwp", "hwpx"], max: 2, kind: "inspection" },
  "excel-cleaner": { paths: ["/tools/excel-cleaner"], extensions: spreadsheets, max: 50, kind: "inspection" },
  "excel-merger": { paths: ["/tools/excel-merger"], extensions: spreadsheets, max: 50, kind: "inspection" },
  "document-generator": { paths: ["/tools/document-generator"], extensions: ["docx", "xlsx", "csv"], max: 50, kind: "inspection" },
  "image-privacy": { paths: ["/tools/image-privacy"], extensions: images, max: 50, kind: "selection" },
  "pdf-organize": { paths: ["/tools/pdf-editor", "/tools/pdf-editor/merge"], extensions: ["pdf"], max: 50, kind: "inspection" },
  "pdf-finish": { paths: ["/tools/pdf-editor/watermark"], extensions: ["pdf"], max: 50, kind: "inspection" },
  "image-edit": { paths: ["/tools/image-studio", "/tools/image-studio/resize", "/tools/image-studio/mosaic", "/tools/image-studio/watermark"], extensions: images, max: 1, kind: "inspection" },
  "image-batch": { paths: ["/tools/image-studio"], extensions: images, max: 50, kind: "selection" },
} as const satisfies Record<string, HandoffReceiverDefinition>;
export type ReceiverId = keyof typeof fileAccepts;
export function acceptsFile(receiverId: ReceiverId, file: File): boolean {
  return (fileAccepts[receiverId].extensions as readonly string[]).includes(file.name.split(".").pop()?.toLowerCase() ?? "");
}

// Persistent targets stay separate: adding them must not opt memory senders in.
export const isolatedFileAccepts = {
  "document-redactor": { path: "/tools/document-redactor", extensions: ["pdf", "jpg", "jpeg", "png", "webp"], max: 20 },
  "document-to-pdf": { path: "/tools/pdf-converter/document-to-pdf", extensions: ["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"], max: 20 },
  "xls-preserve": { path: "/tools/excel-merger/xls-preserve", extensions: spreadsheets, max: 20 },
} as const;
export type IsolatedReceiverId = keyof typeof isolatedFileAccepts;
